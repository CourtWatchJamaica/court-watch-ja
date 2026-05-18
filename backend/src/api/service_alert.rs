use axum::{extract::State, Json};
use serde::Deserialize;
use serde_json::{json, Value};

use crate::{api::errors::AppError, AppState, ServiceAlert};

pub async fn get_service_alert(
    State(state): State<AppState>,
) -> Result<Json<Value>, AppError> {
    let alert = state.service_alert.lock().unwrap().clone();
    Ok(Json(json!({ "alert": alert })))
}

#[derive(Deserialize)]
pub struct ServiceAlertBody {
    pub title: Option<String>,
    pub message: Option<String>,
    pub severity: Option<String>,
    pub enabled: Option<bool>,
}

pub async fn set_service_alert(
    State(state): State<AppState>,
    Json(body): Json<ServiceAlertBody>,
) -> Result<Json<Value>, AppError> {
    let mut lock = state.service_alert.lock().unwrap();

    if body.enabled == Some(false) {
        *lock = None;
        return Ok(Json(json!({ "alert": null })));
    }

    let alert = ServiceAlert {
        title: body.title.unwrap_or_default(),
        message: body.message.unwrap_or_default(),
        severity: body.severity.unwrap_or_else(|| "info".to_string()),
        enabled: true,
    };
    *lock = Some(alert.clone());
    Ok(Json(json!({ "alert": alert })))
}
