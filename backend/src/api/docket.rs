use axum::{extract::{Path, State}, Extension, Json};
use serde::Serialize;

use crate::{
    api::errors::AppError,
    db::{
        models::{CourtSitting, DocketListItem, Judgment},
        queries,
    },
    AppState,
};

#[derive(Serialize)]
pub struct DocketDetail {
    pub case_number: String,
    pub user_case_id: i32,
    pub judgment: Option<Judgment>,
    pub sittings: Vec<CourtSitting>,
    pub notify_immediately: bool,
    pub notify_day_before: bool,
    pub notify_morning_of: bool,
}

pub async fn get_docket_list(
    State(state): State<AppState>,
    Extension(user_id): Extension<i32>,
) -> Result<Json<Vec<DocketListItem>>, AppError> {
    let items = queries::get_docket_list(&state.db, user_id).await?;
    Ok(Json(items))
}

pub async fn get_docket_detail(
    State(state): State<AppState>,
    Extension(user_id): Extension<i32>,
    Path(case_number): Path<String>,
) -> Result<Json<DocketDetail>, AppError> {
    // Permission gate: user must be tracking this case.
    let user_case_id =
        queries::get_user_case_id_for_case(&state.db, user_id, &case_number)
            .await?
            .ok_or(AppError::NotFound)?;

    let judgment =
        queries::get_judgment_by_case_number(&state.db, &case_number).await?;
    let sittings =
        queries::get_sittings_for_case(&state.db, &case_number).await?;
    let (notify_immediately, notify_day_before, notify_morning_of) =
        queries::get_case_notify_settings(&state.db, user_case_id).await?;

    Ok(Json(DocketDetail {
        case_number,
        user_case_id,
        judgment,
        sittings,
        notify_immediately,
        notify_day_before,
        notify_morning_of,
    }))
}
