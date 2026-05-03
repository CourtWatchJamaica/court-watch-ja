use axum::{extract::{Query, State}, Json};
use serde::Deserialize;
use crate::{api::{errors::AppError, court_slug_to_name}, db::queries, AppState};

#[derive(Deserialize)]
pub struct CourtStatsParams {
    pub court: Option<String>,
}

pub async fn get_court_stats(
    State(state): State<AppState>,
    Query(params): Query<CourtStatsParams>,
) -> Result<Json<crate::db::models::CourtStats>, AppError> {
    let court = court_slug_to_name(params.court.as_deref().unwrap_or("supreme-court"));
    let stats = queries::get_court_stats(&state.db, court).await?;
    Ok(Json(stats))
}
