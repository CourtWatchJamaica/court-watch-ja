use axum::Json;
use serde_json::{json, Value};

pub async fn status() -> Json<Value> {
    Json(json!({ "maintenance_mode": false }))
}
