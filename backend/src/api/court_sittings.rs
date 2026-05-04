use axum::{
    extract::{Path, Query, State},
    Json,
};
use chrono::NaiveDate;
use serde::{Deserialize, Serialize};

use crate::{api::errors::AppError, db::{models::CourtSitting, queries}, AppState};

#[derive(Serialize)]
pub struct SittingResponse {
    pub sitting: CourtSitting,
}

#[derive(Deserialize)]
pub struct SittingsParams {
    pub q: Option<String>,
    pub date_from: Option<String>,
    pub date_to: Option<String>,
    pub court: Option<String>,
}

#[derive(Serialize)]
pub struct SittingsResponse {
    pub sittings: Vec<CourtSitting>,
}

fn parse_date(s: &str) -> Result<NaiveDate, AppError> {
    NaiveDate::parse_from_str(s, "%Y-%m-%d")
        .map_err(|_| AppError::BadRequest(format!("Invalid date format: {s}. Use YYYY-MM-DD")))
}

pub async fn list_sittings(
    State(state): State<AppState>,
    Query(params): Query<SittingsParams>,
) -> Result<Json<SittingsResponse>, AppError> {
    let court = params.court.as_deref();

    // Full-text search takes priority over date-range filtering.
    if let Some(q) = &params.q {
        if !q.trim().is_empty() {
            let sittings = queries::search_court_sittings(&state.db, q.trim(), court).await?;
            return Ok(Json(SittingsResponse { sittings }));
        }
    }

    let date_from = params.date_from.as_deref().map(parse_date).transpose()?;
    let date_to   = params.date_to.as_deref().map(parse_date).transpose()?;
    let sittings  = queries::list_court_sittings(&state.db, date_from, date_to, court).await?;
    Ok(Json(SittingsResponse { sittings }))
}

pub async fn today_sittings(
    State(state): State<AppState>,
) -> Result<Json<SittingsResponse>, AppError> {
    let sittings = queries::get_today_sittings(&state.db).await?;
    Ok(Json(SittingsResponse { sittings }))
}

pub async fn get_sitting(
    State(state): State<AppState>,
    Path(id): Path<i32>,
) -> Result<Json<SittingResponse>, AppError> {
    let sitting = queries::get_court_sitting_by_id(&state.db, id)
        .await?
        .ok_or(AppError::NotFound)?;
    Ok(Json(SittingResponse { sitting }))
}
