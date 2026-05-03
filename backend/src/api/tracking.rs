use axum::{
    extract::{Path, Query, State},
    Extension, Json,
};
use serde::{Deserialize, Serialize};

use crate::{api::errors::AppError, db::{models::UserCase, queries}, AppState};

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
    pub case_id: i32,
    /// `"judgment"` (default) or `"sitting"`
    pub case_type: Option<String>,
}

#[derive(Deserialize)]
pub struct RemoveCaseParams {
    /// `"judgment"` (default) or `"sitting"`
    pub case_type: Option<String>,
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

    match queries::add_user_case(&state.db, user_id, body.case_id, case_type).await {
        Ok(_) | Err(sqlx::Error::RowNotFound) => {
            // RowNotFound means ON CONFLICT DO NOTHING fired — already tracking, still a success.
        }
        Err(e) => return Err(AppError::Sqlx(e)),
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
