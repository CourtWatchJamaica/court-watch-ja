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
pub struct PreferencesRequest {
    pub email_notifications: bool,
    /// Accepted for forward compatibility; there is no push delivery channel
    /// yet, so the value is not stored.
    #[serde(default)]
    #[allow(dead_code)]
    pub push_notifications: bool,
    /// Opt-in digest after every court scan. Optional so older clients that
    /// only send the email flag don't reset it.
    #[serde(default)]
    pub notify_on_scan: Option<bool>,
    /// 'in_app' | 'both'
    #[serde(default)]
    pub scan_alert_channel: Option<String>,
    /// 'every_scan' | 'daily' | 'weekly'
    #[serde(default)]
    pub scan_alert_frequency: Option<String>,
}

#[derive(Serialize)]
pub struct PreferencesResponse {
    pub email_notifications: bool,
    pub notify_on_scan: bool,
    pub scan_alert_channel: String,
    pub scan_alert_frequency: String,
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

pub async fn get_preferences(
    State(state): State<AppState>,
    Extension(user_id): Extension<i32>,
) -> Result<Json<PreferencesResponse>, AppError> {
    let prefs = queries::get_user_notification_prefs(&state.db, user_id).await?;
    Ok(Json(PreferencesResponse {
        email_notifications: prefs.email_notifications,
        notify_on_scan: prefs.notify_on_scan,
        scan_alert_channel: prefs.scan_alert_channel,
        scan_alert_frequency: prefs.scan_alert_frequency,
    }))
}

pub async fn update_preferences(
    State(state): State<AppState>,
    Extension(user_id): Extension<i32>,
    Json(body): Json<PreferencesRequest>,
) -> Result<Json<SuccessResponse>, AppError> {
    if let Some(ref c) = body.scan_alert_channel {
        if !queries::SCAN_ALERT_CHANNELS.contains(&c.as_str()) {
            return Err(AppError::BadRequest(
                "scan_alert_channel must be 'in_app' or 'both'".into(),
            ));
        }
    }
    if let Some(ref f) = body.scan_alert_frequency {
        if !queries::SCAN_ALERT_FREQUENCIES.contains(&f.as_str()) {
            return Err(AppError::BadRequest(
                "scan_alert_frequency must be 'every_scan', 'daily' or 'weekly'".into(),
            ));
        }
    }
    queries::set_user_notification_prefs(
        &state.db,
        user_id,
        body.email_notifications,
        body.notify_on_scan,
        body.scan_alert_channel.as_deref(),
        body.scan_alert_frequency.as_deref(),
    )
    .await?;
    Ok(Json(SuccessResponse { success: true }))
}
