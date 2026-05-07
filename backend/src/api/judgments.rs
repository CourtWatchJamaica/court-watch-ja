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
