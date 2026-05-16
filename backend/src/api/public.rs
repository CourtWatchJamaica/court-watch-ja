use axum::{extract::State, Json};
use serde::Serialize;

use crate::{
    api::errors::AppError,
    db::{
        models::{CourtSitting, Judgment},
        queries,
    },
    AppState,
};

#[derive(Serialize)]
pub struct PublicPreviewResponse {
    pub judgments: Vec<Judgment>,
    pub sittings: Vec<CourtSitting>,
}

pub async fn get_preview(
    State(state): State<AppState>,
) -> Result<Json<PublicPreviewResponse>, AppError> {
    let (judgments, sittings) = tokio::try_join!(
        queries::get_preview_judgments(&state.db),
        queries::get_preview_sittings(&state.db),
    )?;
    Ok(Json(PublicPreviewResponse { judgments, sittings }))
}
