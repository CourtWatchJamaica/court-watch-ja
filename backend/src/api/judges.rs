use axum::{
    extract::{Path, Query, State},
    Json,
};
use serde::{Deserialize, Serialize};

use crate::{
    api::errors::AppError,
    db::{models::{Judge, JudgeWithCount, Judgment}, queries},
    AppState,
};

#[derive(Deserialize)]
pub struct JudgesParams {
    pub court: Option<String>,
}

#[derive(Deserialize)]
pub struct AutocompleteParams {
    pub q: Option<String>,
}

#[derive(Serialize)]
pub struct AutocompleteResponse {
    pub names: Vec<String>,
}

#[derive(Serialize)]
pub struct JudgesResponse {
    pub judges: Vec<JudgeWithCount>,
}

#[derive(Serialize)]
pub struct JudgeDetailResponse {
    pub judge: Judge,
    pub judgments: Vec<Judgment>,
}

pub async fn list_judges(
    State(state): State<AppState>,
    Query(params): Query<JudgesParams>,
) -> Result<Json<JudgesResponse>, AppError> {
    let judges = queries::list_judges(&state.db, params.court.as_deref()).await?;
    Ok(Json(JudgesResponse { judges }))
}

pub async fn autocomplete_judges(
    State(state): State<AppState>,
    Query(params): Query<AutocompleteParams>,
) -> Result<Json<AutocompleteResponse>, AppError> {
    let q = params.q.as_deref().unwrap_or("").trim();
    if q.is_empty() {
        return Ok(Json(AutocompleteResponse { names: vec![] }));
    }
    let names = queries::autocomplete_judges(&state.db, q).await?;
    Ok(Json(AutocompleteResponse { names }))
}

pub async fn get_judge(
    State(state): State<AppState>,
    Path(id): Path<i32>,
) -> Result<Json<JudgeDetailResponse>, AppError> {
    let judge = queries::get_judge_by_id(&state.db, id)
        .await?
        .ok_or(AppError::NotFound)?;

    let judgments = queries::get_judgments_by_judge(&state.db, &judge.name).await?;
    Ok(Json(JudgeDetailResponse { judge, judgments }))
}
