use axum::{extract::{Path, State}, Json};
use serde::Serialize;

use crate::{api::errors::AppError, db::{models::{CourtSitting, Judgment}, queries}, AppState};

#[derive(Serialize)]
pub struct PublicPreviewResponse {
    pub judgments: Vec<Judgment>,
    pub sittings: Vec<CourtSitting>,
}

pub async fn get_preview(
    State(state): State<AppState>,
) -> Result<Json<PublicPreviewResponse>, AppError> {
    let (judgments, sittings) = tokio::join!(
        queries::get_preview_judgments(&state.db),
        queries::get_preview_sittings(&state.db),
    );
    Ok(Json(PublicPreviewResponse {
        judgments: judgments?,
        sittings: sittings?,
    }))
}

#[derive(Serialize)]
pub struct CaseHistoryResponse {
    pub case_number: String,
    pub judgment: Option<Judgment>,
    pub sittings: Vec<CourtSitting>,
}

pub async fn get_case_history(
    State(state): State<AppState>,
    Path(case_number): Path<String>,
) -> Result<Json<CaseHistoryResponse>, AppError> {
    let case_number = case_number.to_uppercase();
    let (judgment, sittings) = tokio::join!(
        queries::get_judgment_by_case_number(&state.db, &case_number),
        queries::get_sittings_for_case(&state.db, &case_number),
    );
    Ok(Json(CaseHistoryResponse {
        case_number,
        judgment: judgment?,
        sittings: sittings?,
    }))
}
