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
    pub judge: Option<String>,
    pub case_number: Option<String>,
    pub page: Option<i64>,
    pub limit: Option<i64>,
}

#[derive(Serialize)]
pub struct SittingsResponse {
    pub sittings: Vec<CourtSitting>,
    pub total: i64,
}

fn parse_date_opt(s: Option<&str>) -> Result<Option<NaiveDate>, AppError> {
    match s {
        None | Some("") => Ok(None),
        Some(d) => NaiveDate::parse_from_str(d, "%Y-%m-%d")
            .map(Some)
            .map_err(|_| AppError::BadRequest(format!("Invalid date format: {d}. Use YYYY-MM-DD"))),
    }
}

pub async fn list_sittings(
    State(state): State<AppState>,
    Query(params): Query<SittingsParams>,
) -> Result<Json<SittingsResponse>, AppError> {
    let page = params.page.unwrap_or(1).max(1);
    let limit = params.limit.unwrap_or(20).clamp(1, 500);
    let q = params.q.as_deref();
    let court = params.court.as_deref();
    let judge = params.judge.as_deref();
    let case_number = params.case_number.as_deref();
    let date_from = parse_date_opt(params.date_from.as_deref())?;
    let date_to = parse_date_opt(params.date_to.as_deref())?;

    let (sittings, total) = queries::list_court_sittings(
        &state.db, q, date_from, date_to, court, judge, case_number, page, limit,
    ).await?;
    Ok(Json(SittingsResponse { sittings, total }))
}

pub async fn today_sittings(
    State(state): State<AppState>,
) -> Result<Json<SittingsResponse>, AppError> {
    let sittings = queries::get_today_sittings(&state.db).await?;
    let total = sittings.len() as i64;
    Ok(Json(SittingsResponse { sittings, total }))
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
