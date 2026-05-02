use axum::{
    extract::{Path, State},
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
    queries::add_user_case(&state.db, user_id, body.case_id)
        .await
        .map_err(|e| match e {
            sqlx::Error::RowNotFound => {
                // ON CONFLICT DO NOTHING returns no row — treat as success
                e
            }
            other => other,
        })
        .or_else(|e| {
            if matches!(e, sqlx::Error::RowNotFound) {
                Ok(crate::db::models::UserCase {
                    id: 0,
                    user_id,
                    case_id: body.case_id,
                    created_at: chrono::Utc::now().naive_utc(),
                })
            } else {
                Err(AppError::Sqlx(e))
            }
        })?;
    Ok(Json(SuccessResponse { success: true }))
}

pub async fn remove_user_case(
    State(state): State<AppState>,
    Extension(user_id): Extension<i32>,
    Path(case_id): Path<i32>,
) -> Result<Json<SuccessResponse>, AppError> {
    queries::remove_user_case(&state.db, user_id, case_id).await?;
    Ok(Json(SuccessResponse { success: true }))
}
