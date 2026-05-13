use axum::{
    extract::{Path, Query, State},
    Json,
};
use serde::{Deserialize, Serialize};

use crate::{
    api::{court_slug_to_name, errors::AppError},
    db::{models::Judgment, queries},
    AppState,
};

// ── Case Lookup ──────────────────────────────────────────────────────────────

#[derive(Deserialize)]
pub struct LookupParams {
    pub case_number: String,
}

#[derive(Serialize)]
pub struct LookupJudgmentItem {
    pub id: i32,
    pub case_number: String,
    pub title: Option<String>,
    pub date: Option<String>,
    pub court: Option<String>,
}

#[derive(Serialize)]
pub struct LookupSittingItem {
    pub id: i32,
    pub case_number: Option<String>,
    pub title: Option<String>,
    pub event_date: Option<String>,
    pub court: Option<String>,
}

#[derive(Serialize)]
pub struct CaseLookupResponse {
    pub found: bool,
    pub judgments: Vec<LookupJudgmentItem>,
    pub sittings: Vec<LookupSittingItem>,
    pub has_upcoming: bool,
    pub has_past: bool,
}

pub async fn case_lookup(
    State(state): State<AppState>,
    Query(params): Query<LookupParams>,
) -> Result<Json<CaseLookupResponse>, AppError> {
    let (j_rows, s_rows) = queries::case_lookup(&state.db, &params.case_number).await?;

    let today = chrono::Local::now().date_naive();
    let has_upcoming = s_rows.iter().any(|s| s.event_date.map(|d| d >= today).unwrap_or(false));
    let has_past = s_rows.iter().any(|s| s.event_date.map(|d| d < today).unwrap_or(false));
    let found = !j_rows.is_empty() || !s_rows.is_empty();

    let judgments = j_rows
        .into_iter()
        .map(|j| LookupJudgmentItem {
            id: j.id,
            case_number: j.case_number,
            title: j.title,
            date: j.date.map(|d| d.to_string()),
            court: j.court,
        })
        .collect();

    let sittings = s_rows
        .into_iter()
        .map(|s| LookupSittingItem {
            id: s.id,
            case_number: s.case_number,
            title: s.title,
            event_date: s.event_date.map(|d| d.to_string()),
            court: s.court_division,
        })
        .collect();

    Ok(Json(CaseLookupResponse { found, judgments, sittings, has_upcoming, has_past }))
}

#[derive(Deserialize)]
pub struct ListParams {
    pub q: Option<String>,
    pub page: Option<i64>,
    pub limit: Option<i64>,
    pub court: Option<String>,
    pub judge: Option<String>,
}

#[derive(Serialize)]
pub struct JudgmentsResponse {
    pub judgments: Vec<Judgment>,
    pub total: i64,
}

#[derive(Serialize)]
pub struct JudgmentResponse {
    pub judgment: Judgment,
}

pub async fn list_judgments(
    State(state): State<AppState>,
    Query(params): Query<ListParams>,
) -> Result<Json<JudgmentsResponse>, AppError> {
    let page = params.page.unwrap_or(1).max(1);
    let limit = params.limit.unwrap_or(10).clamp(1, 100);
    let q = params.q.as_deref();
    let court = params.court.as_deref().map(court_slug_to_name);
    let judge = params.judge.as_deref();

    let (judgments, total) = queries::list_judgments(&state.db, q, page, limit, court, judge).await?;
    Ok(Json(JudgmentsResponse { judgments, total }))
}

pub async fn get_judgment(
    State(state): State<AppState>,
    Path(id): Path<i32>,
) -> Result<Json<JudgmentResponse>, AppError> {
    let judgment = queries::get_judgment_by_id(&state.db, id)
        .await?
        .ok_or(AppError::NotFound)?;
    Ok(Json(JudgmentResponse { judgment }))
}
