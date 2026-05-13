use axum::{
    extract::{Path, Query, State},
    Extension, Json,
};
use serde::{Deserialize, Serialize};

use crate::{api::errors::AppError, db::{models::{UserCase, UserCaseSettings}, queries}, AppState};

#[derive(Serialize)]
pub struct CasesResponse {
    pub cases: Vec<UserCase>,
}

#[derive(Serialize)]
pub struct SuccessResponse {
    pub success: bool,
}

#[derive(Deserialize)]
pub struct AddCaseRequest {
    pub case_id: Option<i32>,
    /// For case_number-only tracking (no known case_id yet).
    pub case_number: Option<String>,
    /// `"judgment"` (default) or `"sitting"`
    pub case_type: Option<String>,
}

#[derive(Deserialize)]
pub struct RemoveCaseParams {
    /// `"judgment"` (default) or `"sitting"`
    pub case_type: Option<String>,
}

#[derive(Deserialize)]
pub struct UpdateSettingsRequest {
    pub notify_immediately: bool,
    pub notify_day_before: bool,
    pub notify_morning_of: bool,
}

pub async fn get_user_cases(
    State(state): State<AppState>,
    Extension(user_id): Extension<i32>,
) -> Result<Json<CasesResponse>, AppError> {
    let cases = queries::get_user_cases(&state.db, user_id).await?;
    Ok(Json(CasesResponse { cases }))
}

pub async fn add_user_case(
    State(state): State<AppState>,
    Extension(user_id): Extension<i32>,
    Json(body): Json<AddCaseRequest>,
) -> Result<Json<SuccessResponse>, AppError> {
    let case_type = body.case_type.as_deref().unwrap_or("judgment");

    if let Some(case_id) = body.case_id {
        match queries::add_user_case(&state.db, user_id, case_id, case_type).await {
            Ok(_) | Err(sqlx::Error::RowNotFound) => {}
            Err(e) => return Err(AppError::Sqlx(e)),
        }
    } else if let Some(ref num) = body.case_number {
        if num.trim().is_empty() {
            return Err(AppError::BadRequest("case_number cannot be empty".into()));
        }
        match queries::add_user_case_by_number(&state.db, user_id, num.trim(), case_type).await {
            Ok(_) | Err(sqlx::Error::RowNotFound) => {}
            Err(e) => return Err(AppError::Sqlx(e)),
        }
    } else {
        return Err(AppError::BadRequest("case_id or case_number is required".into()));
    }

    Ok(Json(SuccessResponse { success: true }))
}

pub async fn remove_user_case(
    State(state): State<AppState>,
    Extension(user_id): Extension<i32>,
    Path(case_id): Path<i32>,
    Query(params): Query<RemoveCaseParams>,
) -> Result<Json<SuccessResponse>, AppError> {
    let case_type = params.case_type.as_deref().unwrap_or("judgment");
    queries::remove_user_case(&state.db, user_id, case_id, case_type).await?;
    Ok(Json(SuccessResponse { success: true }))
}

/// Delete a user_cases row by its own ID (works for both ID-based and case_number-based).
pub async fn remove_user_case_by_row(
    State(state): State<AppState>,
    Extension(user_id): Extension<i32>,
    Path(row_id): Path<i32>,
) -> Result<Json<SuccessResponse>, AppError> {
    queries::remove_user_case_by_row(&state.db, user_id, row_id).await?;
    Ok(Json(SuccessResponse { success: true }))
}

/// Upsert notification preferences for a tracked case row.
pub async fn update_case_settings(
    State(state): State<AppState>,
    Extension(user_id): Extension<i32>,
    Path(row_id): Path<i32>,
    Json(body): Json<UpdateSettingsRequest>,
) -> Result<Json<UserCaseSettings>, AppError> {
    // Verify the row belongs to the requesting user before updating.
    let owned: Option<i32> = sqlx::query_scalar(
        "SELECT id FROM user_cases WHERE id = $1 AND user_id = $2",
    )
    .bind(row_id)
    .bind(user_id)
    .fetch_optional(&state.db)
    .await?;

    if owned.is_none() {
        return Err(AppError::NotFound);
    }

    let settings = queries::upsert_user_case_settings(
        &state.db,
        row_id,
        body.notify_immediately,
        body.notify_day_before,
        body.notify_morning_of,
    )
    .await?;

    Ok(Json(settings))
}
