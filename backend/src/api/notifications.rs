use axum::{extract::{Path, State}, Extension, Json};
use serde::{Deserialize, Serialize};
use serde_json::{json, Value};

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

pub async fn get_unread_count(
    State(state): State<AppState>,
    Extension(user_id): Extension<i32>,
) -> Result<Json<Value>, AppError> {
    let count = queries::get_unread_notification_count(&state.db, user_id).await?;
    Ok(Json(json!({ "count": count })))
}

pub async fn mark_all_read(
    State(state): State<AppState>,
    Extension(user_id): Extension<i32>,
) -> Result<Json<Value>, AppError> {
    let updated = queries::mark_notifications_read(&state.db, user_id).await?;
    Ok(Json(json!({ "updated": updated })))
}

pub async fn mark_one_read(
    State(state): State<AppState>,
    Extension(user_id): Extension<i32>,
    Path(id): Path<i32>,
) -> Result<Json<Value>, AppError> {
    let marked = queries::mark_notification_read(&state.db, id, user_id).await?;
    Ok(Json(json!({ "marked": marked })))
}

pub async fn archive_notification(
    State(state): State<AppState>,
    Extension(user_id): Extension<i32>,
    Path(id): Path<i32>,
) -> Result<Json<Value>, AppError> {
    let archived = queries::archive_notification(&state.db, id, user_id).await?;
    Ok(Json(json!({ "archived": archived })))
}

pub async fn update_preferences(
    Extension(_user_id): Extension<i32>,
    Json(_body): Json<PreferencesRequest>,
) -> Result<Json<SuccessResponse>, AppError> {
    Ok(Json(SuccessResponse { success: true }))
}
