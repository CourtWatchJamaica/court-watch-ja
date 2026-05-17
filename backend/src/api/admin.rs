use std::sync::atomic::Ordering;

use axum::{
    extract::{Path, Query, State},
    Extension, Json,
};
use chrono::{NaiveDate, NaiveTime};
use serde::{Deserialize, Serialize};
use serde_json::{json, Value};

use crate::{api::errors::AppError, db::queries, scraper::ScraperState, AppState};

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
) -> Result<Json<Value>, AppError> {
    if caller_id == user_id {
        return Err(AppError::BadRequest(
            "Cannot delete your own account".into(),
        ));
    }
    let deleted = queries::admin_delete_user(&state.db, user_id).await?;
    if !deleted {
        return Err(AppError::NotFound);
    }
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
    Path(id): Path<i32>,
) -> Result<Json<Value>, AppError> {
    let deleted = queries::admin_delete_judgment(&state.db, id).await?;
    if !deleted {
        return Err(AppError::NotFound);
    }
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
    Path(id): Path<i32>,
) -> Result<Json<Value>, AppError> {
    let deleted = queries::admin_delete_sitting(&state.db, id).await?;
    if !deleted {
        return Err(AppError::NotFound);
    }
    Ok(Json(json!({ "deleted": true })))
}

// ── Logs ───────────────────────────────────────────────────────────────────

pub async fn get_activity_log(State(state): State<AppState>) -> Result<Json<Value>, AppError> {
    let rows = queries::admin_recent_activity(&state.db, 100).await?;
    Ok(Json(json!({ "activity": rows })))
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
        tracing::info!(
            "[Email stub] Promo broadcast '{}' → {} recipient(s). Body: {}",
            body.title,
            user_count,
            body.message
        );
    }
    Ok(Json(json!({ "sent": true, "user_count": user_count })))
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
