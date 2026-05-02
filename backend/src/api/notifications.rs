use axum::{extract::State, Extension, Json};
use serde::{Deserialize, Serialize};

use crate::{api::errors::AppError, db::{models::Notification, queries}, AppState};

#[derive(Serialize)]
pub struct NotificationsResponse {
    pub notifications: Vec<Notification>,
}

#[derive(Serialize)]
pub struct SuccessResponse {
    pub success: bool,
}

#[derive(Deserialize)]
#[allow(dead_code)]
pub struct PreferencesRequest {
    pub email_notifications: bool,
    pub push_notifications: bool,
}

pub async fn get_notifications(
    State(state): State<AppState>,
    Extension(user_id): Extension<i32>,
) -> Result<Json<NotificationsResponse>, AppError> {
    let notifications = queries::get_notifications(&state.db, user_id).await?;
    Ok(Json(NotificationsResponse { notifications }))
}

// Preferences are stored in env / future user_preferences table.
// Accept and acknowledge for now; extend with a preferences table if needed.
pub async fn update_preferences(
    Extension(_user_id): Extension<i32>,
    Json(_body): Json<PreferencesRequest>,
) -> Result<Json<SuccessResponse>, AppError> {
    Ok(Json(SuccessResponse { success: true }))
}
