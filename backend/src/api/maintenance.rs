use std::sync::atomic::Ordering;

use axum::{extract::State, Json};
use serde_json::{json, Value};

use crate::AppState;

pub async fn status(State(state): State<AppState>) -> Json<Value> {
    let on = state.maintenance_mode.load(Ordering::SeqCst);
    Json(json!({ "maintenance_mode": on }))
}
