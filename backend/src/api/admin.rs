use std::sync::atomic::Ordering;

use axum::{
    extract::{Path, Query, State},
    http::{header, HeaderMap, HeaderValue, StatusCode},
    response::IntoResponse,
    Extension, Json,
};
use chrono::{NaiveDate, NaiveTime};
use serde::{Deserialize, Serialize};
use serde_json::{json, Value};
use sqlx::PgPool;

use crate::{api::errors::AppError, db::queries, notifications::email as notif_email, scraper::ScraperState, AppState};

fn get_client_ip(headers: &HeaderMap) -> Option<String> {
    headers
        .get("x-forwarded-for")
        .and_then(|v| v.to_str().ok())
        .map(|s| s.split(',').next().unwrap_or(s).trim().to_string())
}

// ── Shared helpers ─────────────────────────────────────────────────────────

fn is_valid_role(role: &str) -> bool {
    matches!(role, "user" | "admin" | "super_admin")
}

// ── Users ──────────────────────────────────────────────────────────────────

#[derive(Serialize)]
pub struct UsersResponse {
    pub users: Vec<UserRow>,
}

#[derive(Serialize)]
pub struct UserRow {
    pub id: i32,
    pub email: String,
    pub role: String,
    pub created_at: String,
}

pub async fn list_users(State(state): State<AppState>) -> Result<Json<UsersResponse>, AppError> {
    let users = queries::admin_list_users(&state.db).await?;
    Ok(Json(UsersResponse {
        users: users
            .into_iter()
            .map(|u| UserRow {
                id: u.id,
                email: u.email,
                role: u.role,
                created_at: u.created_at.to_string(),
            })
            .collect(),
    }))
}

#[derive(Deserialize)]
pub struct SetRoleBody {
    pub role: String,
}

pub async fn set_user_role(
    State(state): State<AppState>,
    Extension(caller_id): Extension<i32>,
    Path(user_id): Path<i32>,
    Json(body): Json<SetRoleBody>,
) -> Result<Json<Value>, AppError> {
    if caller_id == user_id {
        return Err(AppError::BadRequest("Cannot change your own role".into()));
    }
    if !is_valid_role(&body.role) {
        return Err(AppError::BadRequest(format!("Invalid role: {}", body.role)));
    }
    let updated = queries::admin_set_user_role(&state.db, user_id, &body.role)
        .await?
        .ok_or(AppError::NotFound)?;
    Ok(Json(
        json!({ "id": updated.id, "email": updated.email, "role": updated.role }),
    ))
}

pub async fn delete_user(
    State(state): State<AppState>,
    Extension(caller_id): Extension<i32>,
    Path(user_id): Path<i32>,
    headers: HeaderMap,
) -> Result<Json<Value>, AppError> {
    if caller_id == user_id {
        return Err(AppError::BadRequest(
            "Cannot delete your own account".into(),
        ));
    }
    // Capture email before deletion for the log
    let target_email: Option<String> = sqlx::query_scalar("SELECT email FROM users WHERE id = $1")
        .bind(user_id)
        .fetch_optional(&state.db)
        .await?;
    let deleted = queries::admin_delete_user(&state.db, user_id).await?;
    if !deleted {
        return Err(AppError::NotFound);
    }
    let _ = queries::log_admin_action(
        &state.db,
        caller_id,
        "USER_DELETE",
        Some("user"),
        Some(user_id),
        Some(json!({ "email": target_email })),
        get_client_ip(&headers).as_deref(),
    )
    .await;
    Ok(Json(json!({ "deleted": true })))
}

// ── Config ─────────────────────────────────────────────────────────────────

pub async fn get_config(State(state): State<AppState>) -> Result<Json<Value>, AppError> {
    let rows = queries::admin_list_config(&state.db).await?;
    Ok(Json(json!({ "config": rows })))
}

#[derive(Deserialize)]
pub struct SetConfigBody {
    pub value: String,
}

pub async fn set_config(
    State(state): State<AppState>,
    Path(key): Path<String>,
    Json(body): Json<SetConfigBody>,
) -> Result<Json<Value>, AppError> {
    if body.value.is_empty() {
        return Err(AppError::BadRequest("Value cannot be empty".into()));
    }
    queries::set_system_config(&state.db, &key, &body.value).await?;
    Ok(Json(
        json!({ "key": key, "value": body.value, "updated": true }),
    ))
}

// ── Scraper ────────────────────────────────────────────────────────────────

pub async fn get_scraper_state(State(state): State<AppState>) -> Result<Json<Value>, AppError> {
    let scraper_state = ScraperState::load_from_db(&state.db, &state.config.scraper_state_path).await;
    let is_running = state.scraper_running.load(Ordering::SeqCst);

    Ok(Json(json!({
        "is_running": is_running,
        "processed_sc_count": scraper_state.processed_pdf_urls.len(),
        "processed_coa_count": scraper_state.processed_appeal_pdf_urls.len(),
        "processed_parish_count": scraper_state.processed_parish_pdf_urls.len(),
        "last_sc_scraped": scraper_state.last_judges_scraped_at,
        "last_coa_scraped": scraper_state.last_appeal_judges_scraped_at,
        "next_judgment_page": scraper_state.next_judgment_page,
        "next_appeal_page": scraper_state.next_appeal_page,
        "next_parish_page": scraper_state.next_parish_page,
        "pdf_failures": scraper_state.pdf_download_failures,
        "pdf_skipped": scraper_state.pdf_skipped,
        "pdf_skipped_count": scraper_state.pdf_skipped.len(),
    })))
}

pub async fn trigger_scraper(State(state): State<AppState>) -> Result<Json<Value>, AppError> {
    if state.scraper_running.load(Ordering::SeqCst) {
        return Err(AppError::BadRequest("Scraper is already running".into()));
    }
    state.scraper_running.store(true, Ordering::SeqCst);

    let pool = state.db.clone();
    let config = state.config.clone();
    let flag = state.scraper_running.clone();

    tokio::spawn(async move {
        if let Err(e) = crate::scraper::runner::run_all(&pool, &config).await {
            tracing::error!("[Admin] Manual scrape failed: {e}");
        }
        flag.store(false, Ordering::SeqCst);
    });

    Ok(Json(
        json!({ "started": true, "message": "Scraper started in background" }),
    ))
}

pub async fn deep_scrape(State(state): State<AppState>) -> Result<Json<Value>, AppError> {
    if state.scraper_running.load(Ordering::SeqCst) {
        return Err(AppError::BadRequest("Scraper is already running".into()));
    }
    state.scraper_running.store(true, Ordering::SeqCst);

    let pool = state.db.clone();
    let config = state.config.clone();
    let flag = state.scraper_running.clone();

    tokio::spawn(async move {
        // Lower the cutoff so scrapers go back to 2020
        if let Err(e) =
            crate::db::queries::set_system_config(&pool, "judgment_cutoff_date", "2020-01-01").await
        {
            tracing::error!("[DeepScrape] Failed to lower cutoff: {e}");
        }
        tracing::info!("[DeepScrape] Cutoff set to 2020-01-01 — starting full backfill");

        if let Err(e) = crate::scraper::runner::run_all(&pool, &config).await {
            tracing::error!("[DeepScrape] run_all failed: {e}");
        }

        match crate::db::queries::seed_judges_from_judgments(&pool).await {
            Ok(n) => tracing::info!("[DeepScrape] Judge seed: {n} row(s) upserted"),
            Err(e) => tracing::error!("[DeepScrape] Judge seed failed: {e}"),
        }

        // Restore the cutoff
        if let Err(e) =
            crate::db::queries::set_system_config(&pool, "judgment_cutoff_date", "2026-01-01").await
        {
            tracing::error!("[DeepScrape] Failed to restore cutoff: {e}");
        }
        tracing::info!("[DeepScrape] Cutoff restored to 2026-01-01. Deep scrape complete.");

        flag.store(false, Ordering::SeqCst);
    });

    Ok(Json(json!({
        "started": true,
        "message": "Deep backfill started (cutoff → 2020-01-01, restores to 2026-01-01 when done)"
    })))
}

#[derive(Deserialize)]
pub struct RemoveSkippedBody {
    pub url: String,
}

pub async fn remove_skipped_pdf(
    State(state): State<AppState>,
    Json(body): Json<RemoveSkippedBody>,
) -> Result<Json<Value>, AppError> {
    let mut scraper_state = ScraperState::load_from_db(&state.db, &state.config.scraper_state_path).await;
    scraper_state.clear_pdf_failure(&body.url);
    scraper_state
        .save_to_db(&state.db)
        .await
        .map_err(|e| AppError::Internal(e.to_string()))?;
    Ok(Json(json!({ "removed": true, "url": body.url })))
}

// ── Data: Judgments ────────────────────────────────────────────────────────

#[derive(Deserialize, Default)]
pub struct PageParams {
    #[serde(default = "default_page")]
    pub page: i64,
    #[serde(default = "default_limit")]
    pub limit: i64,
}
fn default_page() -> i64 {
    1
}
fn default_limit() -> i64 {
    50
}

pub async fn list_judgments(
    State(state): State<AppState>,
    Query(params): Query<PageParams>,
) -> Result<Json<Value>, AppError> {
    let (judgments, total) =
        queries::admin_list_judgments(&state.db, params.page, params.limit).await?;
    Ok(Json(json!({ "judgments": judgments, "total": total })))
}

#[derive(Deserialize)]
pub struct UpdateJudgmentBody {
    pub title: Option<String>,
    pub judge_name: Option<String>,
    pub court: Option<String>,
    pub date: Option<String>,
    pub summary_text: Option<String>,
}

pub async fn update_judgment(
    State(state): State<AppState>,
    Path(id): Path<i32>,
    Json(body): Json<UpdateJudgmentBody>,
) -> Result<Json<Value>, AppError> {
    let date: Option<NaiveDate> = body
        .date
        .as_deref()
        .filter(|s| !s.is_empty())
        .map(|s| NaiveDate::parse_from_str(s, "%Y-%m-%d"))
        .transpose()
        .map_err(|_| AppError::BadRequest("Invalid date format; expected YYYY-MM-DD".into()))?;

    let judgment = queries::admin_update_judgment(
        &state.db,
        id,
        body.title.as_deref(),
        body.judge_name.as_deref(),
        body.court.as_deref(),
        date,
        body.summary_text.as_deref(),
    )
    .await?
    .ok_or(AppError::NotFound)?;

    Ok(Json(json!({ "judgment": judgment })))
}

pub async fn delete_judgment(
    State(state): State<AppState>,
    Extension(caller_id): Extension<i32>,
    Path(id): Path<i32>,
    headers: HeaderMap,
) -> Result<Json<Value>, AppError> {
    let deleted = queries::admin_delete_judgment(&state.db, id).await?;
    if !deleted {
        return Err(AppError::NotFound);
    }
    let _ = queries::log_admin_action(
        &state.db,
        caller_id,
        "JUDGMENT_DELETE",
        Some("judgment"),
        Some(id),
        None,
        get_client_ip(&headers).as_deref(),
    )
    .await;
    Ok(Json(json!({ "deleted": true })))
}

// ── Data: Sittings ─────────────────────────────────────────────────────────

pub async fn list_sittings(
    State(state): State<AppState>,
    Query(params): Query<PageParams>,
) -> Result<Json<Value>, AppError> {
    let (sittings, total) =
        queries::admin_list_sittings(&state.db, params.page, params.limit).await?;
    Ok(Json(json!({ "sittings": sittings, "total": total })))
}

#[derive(Deserialize)]
pub struct UpdateSittingBody {
    pub title: Option<String>,
    pub judge_name: Option<String>,
    pub event_date: Option<String>,
    pub event_time: Option<String>,
}

pub async fn update_sitting(
    State(state): State<AppState>,
    Path(id): Path<i32>,
    Json(body): Json<UpdateSittingBody>,
) -> Result<Json<Value>, AppError> {
    let event_date: Option<NaiveDate> = body
        .event_date
        .as_deref()
        .filter(|s| !s.is_empty())
        .map(|s| NaiveDate::parse_from_str(s, "%Y-%m-%d"))
        .transpose()
        .map_err(|_| AppError::BadRequest("Invalid date format".into()))?;

    let event_time: Option<NaiveTime> = body
        .event_time
        .as_deref()
        .filter(|s| !s.is_empty())
        .map(|s| {
            NaiveTime::parse_from_str(s, "%H:%M:%S")
                .or_else(|_| NaiveTime::parse_from_str(s, "%H:%M"))
        })
        .transpose()
        .map_err(|_| {
            AppError::BadRequest("Invalid time format; expected HH:MM or HH:MM:SS".into())
        })?;

    let sitting = queries::admin_update_sitting(
        &state.db,
        id,
        body.title.as_deref(),
        body.judge_name.as_deref(),
        event_date,
        event_time,
    )
    .await?
    .ok_or(AppError::NotFound)?;

    Ok(Json(json!({ "sitting": sitting })))
}

pub async fn delete_sitting(
    State(state): State<AppState>,
    Extension(caller_id): Extension<i32>,
    Path(id): Path<i32>,
    headers: HeaderMap,
) -> Result<Json<Value>, AppError> {
    let deleted = queries::admin_delete_sitting(&state.db, id).await?;
    if !deleted {
        return Err(AppError::NotFound);
    }
    let _ = queries::log_admin_action(
        &state.db,
        caller_id,
        "SITTING_DELETE",
        Some("sitting"),
        Some(id),
        None,
        get_client_ip(&headers).as_deref(),
    )
    .await;
    Ok(Json(json!({ "deleted": true })))
}

// ── Logs ───────────────────────────────────────────────────────────────────

pub async fn get_activity_log(State(state): State<AppState>) -> Result<Json<Value>, AppError> {
    let rows = queries::admin_recent_activity(&state.db, 100).await?;
    Ok(Json(json!({ "activity": rows })))
}

#[derive(Deserialize, Default)]
pub struct LogFilterParams {
    #[serde(default = "default_page")]
    pub page: i64,
    #[serde(default = "default_limit")]
    pub limit: i64,
    pub from: Option<String>,
    pub to: Option<String>,
    pub admin_user_id: Option<i32>,
    pub action: Option<String>,
}

pub async fn get_admin_logs(
    State(state): State<AppState>,
    Query(params): Query<LogFilterParams>,
) -> Result<Json<Value>, AppError> {
    let filter = queries::AdminLogFilter {
        page: params.page,
        limit: params.limit.min(200),
        from: params.from.as_deref(),
        to: params.to.as_deref(),
        admin_user_id: params.admin_user_id,
        action: params.action.as_deref(),
    };
    let (logs, total) = queries::admin_get_logs(&state.db, filter).await?;
    Ok(Json(json!({ "logs": logs, "total": total, "page": params.page, "limit": params.limit.min(200) })))
}

// ── Scraper: Skip PDF permanently ─────────────────────────────────────────

pub async fn skip_pdf(
    State(state): State<AppState>,
    Json(body): Json<RemoveSkippedBody>,
) -> Result<Json<Value>, AppError> {
    let mut scraper_state = ScraperState::load_from_db(&state.db, &state.config.scraper_state_path).await;
    scraper_state.skip_pdf_permanently(&body.url);
    scraper_state
        .save_to_db(&state.db)
        .await
        .map_err(|e| AppError::Internal(e.to_string()))?;
    Ok(Json(json!({ "skipped": true, "url": body.url })))
}

// ── Data: Create Judgment ──────────────────────────────────────────────────

#[derive(Deserialize)]
pub struct CreateJudgmentBody {
    pub case_number: String,
    pub title: Option<String>,
    pub judge_name: Option<String>,
    pub court: Option<String>,
    pub date: Option<String>,
    pub pdf_url: Option<String>,
    pub summary_text: Option<String>,
}

pub async fn create_judgment(
    State(state): State<AppState>,
    Json(body): Json<CreateJudgmentBody>,
) -> Result<Json<Value>, AppError> {
    if body.case_number.trim().is_empty() {
        return Err(AppError::BadRequest("case_number is required".into()));
    }
    let date: Option<NaiveDate> = body
        .date
        .as_deref()
        .filter(|s| !s.is_empty())
        .map(|s| NaiveDate::parse_from_str(s, "%Y-%m-%d"))
        .transpose()
        .map_err(|_| AppError::BadRequest("Invalid date; expected YYYY-MM-DD".into()))?;
    let judgment = queries::admin_create_judgment(
        &state.db,
        &body.case_number,
        body.title.as_deref(),
        body.judge_name.as_deref(),
        body.court.as_deref(),
        date,
        body.pdf_url.as_deref(),
        body.summary_text.as_deref(),
    )
    .await?;
    Ok(Json(json!({ "judgment": judgment })))
}

// ── Data: Create Sitting ───────────────────────────────────────────────────

#[derive(Deserialize)]
pub struct CreateSittingBody {
    pub case_number: Option<String>,
    pub title: Option<String>,
    pub judge_name: Option<String>,
    pub court_division: Option<String>,
    pub event_type: Option<String>,
    pub event_date: Option<String>,
    pub event_time: Option<String>,
    pub lawyers: Option<String>,
    pub pdf_source_url: Option<String>,
}

pub async fn create_sitting(
    State(state): State<AppState>,
    Json(body): Json<CreateSittingBody>,
) -> Result<Json<Value>, AppError> {
    let event_date: Option<NaiveDate> = body
        .event_date
        .as_deref()
        .filter(|s| !s.is_empty())
        .map(|s| NaiveDate::parse_from_str(s, "%Y-%m-%d"))
        .transpose()
        .map_err(|_| AppError::BadRequest("Invalid date format".into()))?;
    let event_time: Option<NaiveTime> = body
        .event_time
        .as_deref()
        .filter(|s| !s.is_empty())
        .map(|s| {
            NaiveTime::parse_from_str(s, "%H:%M:%S")
                .or_else(|_| NaiveTime::parse_from_str(s, "%H:%M"))
        })
        .transpose()
        .map_err(|_| AppError::BadRequest("Invalid time; expected HH:MM or HH:MM:SS".into()))?;
    let sitting = queries::admin_create_sitting(
        &state.db,
        body.case_number.as_deref(),
        body.title.as_deref(),
        body.judge_name.as_deref(),
        body.court_division.as_deref(),
        body.event_type.as_deref(),
        event_date,
        event_time,
        body.lawyers.as_deref(),
        body.pdf_source_url.as_deref(),
    )
    .await?;
    Ok(Json(json!({ "sitting": sitting })))
}

// ── Announce ───────────────────────────────────────────────────────────────

#[derive(Deserialize)]
pub struct AnnounceBody {
    pub title: String,
    pub message: String,
    pub promo: Option<bool>,
}

pub async fn announce(
    State(state): State<AppState>,
    Json(body): Json<AnnounceBody>,
) -> Result<Json<Value>, AppError> {
    if body.title.trim().is_empty() {
        return Err(AppError::BadRequest("Title is required".into()));
    }
    if body.message.trim().is_empty() {
        return Err(AppError::BadRequest("Message is required".into()));
    }
    let user_count = queries::admin_announce(&state.db, &body.title, &body.message).await?;
    if body.promo.unwrap_or(false) {
        if let Some(api_key) = state.config.resend_api_key.clone() {
            let pool = state.db.clone();
            let subject = body.title.clone();
            let message = body.message.clone();
            tokio::spawn(async move {
                send_broadcast(&pool, &api_key, &subject, &message).await;
            });
        } else {
            tracing::warn!("[Broadcast] RESEND_API_KEY not set — email broadcast skipped (in-app notifications were still sent)");
        }
    }
    Ok(Json(json!({ "sent": true, "user_count": user_count })))
}

async fn send_broadcast(pool: &PgPool, api_key: &str, subject: &str, message: &str) {
    let emails = match queries::get_all_verified_emails(pool).await {
        Ok(e) => e,
        Err(err) => {
            tracing::error!("[Broadcast] Failed to fetch user emails: {err}");
            return;
        }
    };

    let total = emails.len();
    tracing::info!("[Broadcast] Starting email broadcast '{subject}' → {total} verified recipients");

    if total == 0 {
        tracing::warn!("[Broadcast] No verified users found — nothing to send");
        return;
    }

    let html = format_broadcast_html(subject, message);
    let client = reqwest::Client::new();
    let mut sent: i32 = 0;

    for (i, chunk) in emails.chunks(50).enumerate() {
        if i > 0 {
            tokio::time::sleep(std::time::Duration::from_secs(2)).await;
        }
        for email in chunk {
            match notif_email::send_email(
                &client,
                api_key,
                notif_email::EmailSender::Alerts,
                email,
                subject,
                &html,
            )
            .await
            {
                Ok(()) => sent += 1,
                Err(e) => tracing::error!("[Broadcast] Failed to send to {email}: {e}"),
            }
        }
    }

    match queries::log_broadcast_email(pool, subject, &html, sent).await {
        Ok(id) => tracing::info!("[Broadcast] Logged as broadcast_emails.id={id}"),
        Err(e) => tracing::error!("[Broadcast] Failed to log broadcast: {e}"),
    }

    tracing::info!("[Broadcast] Done — {sent}/{total} emails delivered");
}

fn format_broadcast_html(title: &str, message: &str) -> String {
    let app_url = std::env::var("APP_URL")
        .unwrap_or_else(|_| "https://courtwatchjamaica.com".into());
    let app_url_trimmed = app_url.trim_end_matches('/');
    let message_html = html_escape(message).replace('\n', "<br>");
    format!(
        r#"<!DOCTYPE html>
<html>
<body style="font-family:sans-serif;max-width:560px;margin:0 auto;color:#111;padding:24px 16px;">
  <p style="font-size:15px;font-weight:700;margin:0 0 12px;">{title}</p>
  <p style="font-size:14px;line-height:1.6;margin:0 0 24px;">{message_html}</p>
  <p><a href="{app_url_trimmed}" style="color:#009B3A;font-weight:600;">Visit CourtWatch JA →</a></p>
  <hr style="margin:32px 0;border:none;border-top:1px solid #eee;">
  <p style="font-size:11px;color:#999;">
    You're receiving this because you registered at courtwatchjamaica.com.
  </p>
</body>
</html>"#
    )
}

fn html_escape(s: &str) -> String {
    s.replace('&', "&amp;")
        .replace('<', "&lt;")
        .replace('>', "&gt;")
        .replace('"', "&quot;")
}

// ── Maintenance mode ───────────────────────────────────────────────────────

#[derive(Deserialize)]
pub struct MaintenanceBody {
    pub enabled: bool,
}

pub async fn toggle_maintenance(
    State(state): State<AppState>,
    Json(body): Json<MaintenanceBody>,
) -> Result<Json<Value>, AppError> {
    use std::sync::atomic::Ordering;
    state.maintenance_mode.store(body.enabled, Ordering::SeqCst);
    tracing::info!("[Admin] Maintenance mode → {}", body.enabled);
    Ok(Json(json!({ "maintenance_mode": body.enabled })))
}

// ── Dashboard Stats ────────────────────────────────────────────────────────

pub async fn get_admin_stats(State(state): State<AppState>) -> Result<Json<Value>, AppError> {
    let stats = queries::admin_get_dashboard_stats(&state.db).await?;
    let weeks = queries::admin_users_per_week(&state.db).await?;
    let days = queries::admin_emails_per_day(&state.db).await?;
    Ok(Json(json!({
        "user_count": stats.user_count,
        "active_trackers": stats.active_trackers,
        "emails_sent_this_month": stats.emails_sent_this_month,
        "upcoming_sittings": stats.upcoming_sittings,
        "pending_notifications": stats.pending_notifications,
        "last_scrape_at": stats.last_scrape_at,
        "judgment_count": stats.judgment_count,
        "sittings_count": stats.sittings_count,
        "users_per_week": weeks,
        "emails_per_day": days,
    })))
}

// ── Users: filtered + paginated ────────────────────────────────────────────

#[derive(Deserialize, Default)]
pub struct UserFilterParams {
    pub q: Option<String>,
    pub role: Option<String>,
    #[serde(default = "default_page")]
    pub page: i64,
    #[serde(default = "default_limit_20")]
    pub limit: i64,
}
fn default_limit_20() -> i64 {
    20
}

pub async fn list_users_filtered(
    State(state): State<AppState>,
    Query(params): Query<UserFilterParams>,
) -> Result<Json<Value>, AppError> {
    let (users, total) = queries::admin_list_users_filtered(
        &state.db,
        params.q.as_deref(),
        params.role.as_deref(),
        params.page,
        params.limit.min(100),
    )
    .await?;
    Ok(Json(json!({ "users": users, "total": total, "page": params.page, "limit": params.limit.min(100) })))
}

pub async fn get_user_detail(
    State(state): State<AppState>,
    Path(user_id): Path<i32>,
) -> Result<Json<Value>, AppError> {
    let detail = queries::admin_get_user_detail(&state.db, user_id)
        .await?
        .ok_or(AppError::NotFound)?;
    Ok(Json(json!({ "user": detail })))
}

// ── Upload PDF (stub — OCR hookup pending) ─────────────────────────────────

#[derive(Deserialize)]
pub struct UploadPdfBody {
    pub filename: String,
    pub content: String,  // base64-encoded PDF bytes
    pub doc_type: String, // "judgment" | "court_list"
    pub court: String,
}

pub async fn upload_pdf(
    State(_state): State<AppState>,
    Json(_body): Json<UploadPdfBody>,
) -> Result<Json<Value>, AppError> {
    Ok(Json(json!({
        "extracted": 0,
        "message": "Upload received. Processing will run on next scheduled scrape."
    })))
}

// ── Database backup ────────────────────────────────────────────────────────

const BACKUP_RATE_LIMIT_KEY: &str = "backup_last_request_at";
const BACKUP_RATE_LIMIT_SECS: i64 = 900; // 15 minutes

pub async fn download_backup(
    State(state): State<AppState>,
    Extension(admin_id): Extension<i32>,
    req_headers: HeaderMap,
) -> Result<axum::response::Response, AppError> {
    // ── Rate limit: once per 15 minutes ──────────────────────────────────
    if let Ok(Some(last_str)) =
        queries::get_system_config(&state.db, BACKUP_RATE_LIMIT_KEY).await
    {
        if let Ok(last_dt) =
            chrono::NaiveDateTime::parse_from_str(&last_str, "%Y-%m-%dT%H:%M:%S")
        {
            let elapsed = (chrono::Utc::now().naive_utc() - last_dt).num_seconds();
            if elapsed < BACKUP_RATE_LIMIT_SECS {
                let retry_after = BACKUP_RATE_LIMIT_SECS - elapsed;
                let mut res = (
                    StatusCode::TOO_MANY_REQUESTS,
                    Json(json!({
                        "error": "Backup rate-limited",
                        "retry_after_secs": retry_after
                    })),
                )
                    .into_response();
                res.headers_mut()
                    .insert("retry-after", retry_after.to_string().parse().unwrap());
                return Ok(res);
            }
        }
    }

    // Record this request immediately so parallel requests are also blocked.
    let _ = queries::set_system_config(
        &state.db,
        BACKUP_RATE_LIMIT_KEY,
        &chrono::Utc::now().naive_utc().format("%Y-%m-%dT%H:%M:%S").to_string(),
    )
    .await;

    // ── Generate the SQL dump ─────────────────────────────────────────────
    let sql =
        build_sql_backup(&state.db)
            .await
            .map_err(|e| AppError::Internal(format!("Backup generation failed: {e}")))?;

    // ── Update the staleness indicator used by the overview page ─────────
    let date_str = chrono::Utc::now().format("%Y-%m-%dT%H:%M:%S").to_string();
    let _ = queries::set_system_config(&state.db, "backup_last_date", &date_str).await;

    // ── Audit log ─────────────────────────────────────────────────────────
    let _ = queries::log_admin_action(
        &state.db,
        admin_id,
        "DB_BACKUP_DOWNLOAD",
        None,
        None,
        Some(json!({ "size_bytes": sql.len() })),
        get_client_ip(&req_headers).as_deref(),
    )
    .await;

    let filename = format!(
        "courtwatch_backup_{}.sql",
        chrono::Utc::now().format("%Y-%m-%d_%H%M%S")
    );

    let mut res = (StatusCode::OK, sql).into_response();
    res.headers_mut().insert(
        header::CONTENT_TYPE,
        HeaderValue::from_static("text/plain; charset=utf-8"),
    );
    res.headers_mut().insert(
        header::CONTENT_DISPOSITION,
        format!("attachment; filename=\"{filename}\"")
            .parse::<HeaderValue>()
            .unwrap(),
    );
    Ok(res)
}

// ── SQL dump generation ────────────────────────────────────────────────────

async fn build_sql_backup(pool: &PgPool) -> anyhow::Result<String> {
    use std::fmt::Write as FmtWrite;

    let now = chrono::Utc::now();
    let mut out = String::with_capacity(1024 * 1024); // 1 MB initial capacity

    // ── Header ────────────────────────────────────────────────────────────
    writeln!(out, "-- CourtWatch JA — Database Backup")?;
    writeln!(out, "-- Generated : {}", now.format("%Y-%m-%d %H:%M:%S UTC"))?;
    writeln!(out)?;
    writeln!(out, "-- RESTORE (incremental — skips rows that already exist):")?;
    writeln!(out, "--   psql \"$DATABASE_URL\" < backup.sql")?;
    writeln!(out)?;
    writeln!(out, "-- RESTORE (full replace — add TRUNCATE block first):")?;
    writeln!(out, "--   Uncomment the TRUNCATE lines below, then run psql.")?;
    writeln!(out)?;
    writeln!(out, "BEGIN;")?;
    writeln!(out, "SET session_replication_role = 'replica'; -- skip FK checks during restore")?;
    writeln!(out)?;
    writeln!(out, "-- Uncomment for full-replace restore (wipes all data):")?;

    // ── Discover tables ───────────────────────────────────────────────────
    let tables: Vec<(String,)> = sqlx::query_as(
        "SELECT table_name
         FROM information_schema.tables
         WHERE table_schema = 'public'
           AND table_type   = 'BASE TABLE'
           AND table_name  != '_sqlx_migrations'
         ORDER BY table_name",
    )
    .fetch_all(pool)
    .await?;

    // Emit a commented-out TRUNCATE for all tables (users can uncomment it).
    let table_list = tables
        .iter()
        .map(|(t,)| format!("\"{t}\""))
        .collect::<Vec<_>>()
        .join(", ");
    writeln!(out, "-- TRUNCATE {table_list} RESTART IDENTITY CASCADE;")?;
    writeln!(out)?;

    // ── Dump each table ───────────────────────────────────────────────────
    for (table_name,) in &tables {
        dump_table(&mut out, pool, table_name).await?;
    }

    // ── Reset sequences ───────────────────────────────────────────────────
    let seq_cols: Vec<(String, String, String)> = sqlx::query_as(
        "SELECT table_name, column_name, column_default
         FROM information_schema.columns
         WHERE table_schema  = 'public'
           AND column_default LIKE 'nextval%'",
    )
    .fetch_all(pool)
    .await?;

    if !seq_cols.is_empty() {
        writeln!(out)?;
        writeln!(out, "-- Reset sequences to current max so future inserts don't collide")?;
        for (table, col, default) in &seq_cols {
            if let Some(seq) = extract_seq_name(default) {
                writeln!(
                    out,
                    "SELECT setval('{seq}', COALESCE((SELECT MAX(\"{col}\") FROM \"{table}\"), 0) + 1, false);"
                )?;
            }
        }
    }

    writeln!(out)?;
    writeln!(out, "SET session_replication_role = 'origin';")?;
    writeln!(out, "COMMIT;")?;

    Ok(out)
}

async fn dump_table(out: &mut String, pool: &PgPool, table_name: &str) -> anyhow::Result<()> {
    use std::fmt::Write as FmtWrite;

    // Ordered column list from schema
    let columns: Vec<(String,)> = sqlx::query_as(
        "SELECT column_name
         FROM information_schema.columns
         WHERE table_schema = 'public' AND table_name = $1
         ORDER BY ordinal_position",
    )
    .bind(table_name)
    .fetch_all(pool)
    .await?;

    if columns.is_empty() {
        return Ok(());
    }

    let col_names: Vec<String> = columns.into_iter().map(|(c,)| c).collect();

    // Pick a stable ORDER BY column: prefer id, then first column
    let order_col = if col_names.iter().any(|c| c == "id") {
        "id"
    } else {
        col_names[0].as_str()
    };

    let cols_select = col_names
        .iter()
        .map(|c| format!("\"{c}\""))
        .collect::<Vec<_>>()
        .join(", ");

    // row_to_json handles all Postgres type → JSON serialization for us
    let query = format!(
        "SELECT row_to_json(row)::text \
         FROM (SELECT {cols_select} FROM \"{table_name}\" ORDER BY \"{order_col}\") row"
    );

    let rows: Vec<(String,)> = sqlx::query_as(&query).fetch_all(pool).await?;

    writeln!(out)?;
    writeln!(out, "-- {table_name} ({} row(s))", rows.len())?;

    if rows.is_empty() {
        return Ok(());
    }

    let col_list = col_names
        .iter()
        .map(|c| format!("\"{c}\""))
        .collect::<Vec<_>>()
        .join(", ");

    for (json_str,) in &rows {
        let val: serde_json::Value = serde_json::from_str(json_str)
            .map_err(|e| anyhow::anyhow!("row_to_json parse error in {table_name}: {e}"))?;

        let obj = val
            .as_object()
            .ok_or_else(|| anyhow::anyhow!("expected JSON object for table {table_name}"))?;

        let values = col_names
            .iter()
            .map(|c| json_val_to_sql(obj.get(c.as_str())))
            .collect::<Vec<_>>()
            .join(", ");

        writeln!(
            out,
            "INSERT INTO \"{table_name}\" ({col_list}) VALUES ({values}) ON CONFLICT DO NOTHING;"
        )?;
    }

    Ok(())
}

/// Convert a serde_json Value coming out of `row_to_json` to a SQL literal.
fn json_val_to_sql(val: Option<&serde_json::Value>) -> String {
    match val {
        None | Some(serde_json::Value::Null) => "NULL".to_string(),
        Some(serde_json::Value::Bool(b)) => if *b { "TRUE" } else { "FALSE" }.to_string(),
        Some(serde_json::Value::Number(n)) => n.to_string(),
        Some(serde_json::Value::String(s)) => {
            // Escape embedded single quotes by doubling them (standard SQL)
            format!("'{}'", s.replace('\'', "''"))
        }
        Some(serde_json::Value::Array(arr)) => {
            // Postgres text[] — row_to_json emits text arrays as JSON arrays
            if arr.is_empty() {
                "ARRAY[]::text[]".to_string()
            } else {
                let elems = arr
                    .iter()
                    .map(|v| json_val_to_sql(Some(v)))
                    .collect::<Vec<_>>()
                    .join(", ");
                format!("ARRAY[{elems}]")
            }
        }
        Some(obj @ serde_json::Value::Object(_)) => {
            // JSONB column — embed as a quoted JSON literal with ::jsonb cast
            format!("'{}'::jsonb", obj.to_string().replace('\'', "''"))
        }
    }
}

/// Extract the sequence name from a `column_default` value like
/// `nextval('users_id_seq'::regclass)`.
fn extract_seq_name(default_val: &str) -> Option<String> {
    let start = default_val.find('\'')? + 1;
    let rest = &default_val[start..];
    let end = rest.find('\'')?;
    Some(rest[..end].to_string())
}
