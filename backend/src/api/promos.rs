use axum::{
    extract::{Path, State},
    http::{header::AUTHORIZATION, HeaderMap},
    Extension, Json,
};
use serde::Deserialize;
use serde_json::{json, Value};

use crate::{
    api::errors::AppError,
    db::queries,
    utils::jwt,
    AppState,
};

pub async fn get_active_promo(
    State(state): State<AppState>,
    headers: HeaderMap,
) -> Result<Json<Value>, AppError> {
    let user_id: Option<i32> = headers
        .get(AUTHORIZATION)
        .and_then(|v| v.to_str().ok())
        .and_then(|v| v.strip_prefix("Bearer "))
        .and_then(|token| jwt::decode_token(token, &state.config.jwt_secret).ok())
        .map(|claims| claims.sub);

    let promo = queries::get_active_promo(&state.db, user_id).await?;
    Ok(Json(json!({ "promo": promo })))
}

#[derive(Deserialize)]
pub struct DismissBody {
    pub promo_id: i32,
}

pub async fn dismiss_promo(
    State(state): State<AppState>,
    Extension(user_id): Extension<i32>,
    Json(body): Json<DismissBody>,
) -> Result<Json<Value>, AppError> {
    queries::dismiss_promo(&state.db, user_id, body.promo_id).await?;
    Ok(Json(json!({ "dismissed": true })))
}

// ── Admin handlers ────────────────────────────────────────────────────────────

pub async fn admin_list_promos(
    State(state): State<AppState>,
) -> Result<Json<Value>, AppError> {
    let promos = queries::admin_list_promos(&state.db).await?;
    Ok(Json(json!({ "promos": promos })))
}

#[derive(Deserialize)]
pub struct PromoBody {
    pub title: String,
    pub message: String,
    pub url: Option<String>,
    pub url_text: Option<String>,
    pub display_frequency: Option<String>,
    pub starts_at: Option<String>,
    pub ends_at: Option<String>,
    pub enabled: Option<bool>,
}

pub async fn admin_create_promo(
    State(state): State<AppState>,
    Json(body): Json<PromoBody>,
) -> Result<Json<Value>, AppError> {
    let input = queries::PromoInput {
        title: &body.title,
        message: &body.message,
        url: body.url.as_deref().filter(|s| !s.is_empty()),
        url_text: body.url_text.as_deref().filter(|s| !s.is_empty()),
        display_frequency: body.display_frequency.as_deref().unwrap_or("once"),
        starts_at: body.starts_at.as_deref().and_then(queries::parse_promo_dt),
        ends_at: body.ends_at.as_deref().and_then(queries::parse_promo_dt),
        enabled: body.enabled.unwrap_or(true),
    };
    let promo = queries::admin_create_promo(&state.db, input).await?;
    Ok(Json(json!({ "promo": promo })))
}

pub async fn admin_update_promo(
    State(state): State<AppState>,
    Path(id): Path<i32>,
    Json(body): Json<PromoBody>,
) -> Result<Json<Value>, AppError> {
    let input = queries::PromoInput {
        title: &body.title,
        message: &body.message,
        url: body.url.as_deref().filter(|s| !s.is_empty()),
        url_text: body.url_text.as_deref().filter(|s| !s.is_empty()),
        display_frequency: body.display_frequency.as_deref().unwrap_or("once"),
        starts_at: body.starts_at.as_deref().and_then(queries::parse_promo_dt),
        ends_at: body.ends_at.as_deref().and_then(queries::parse_promo_dt),
        enabled: body.enabled.unwrap_or(true),
    };
    let promo = queries::admin_update_promo(&state.db, id, input)
        .await?
        .ok_or(AppError::NotFound)?;
    Ok(Json(json!({ "promo": promo })))
}

pub async fn admin_delete_promo(
    State(state): State<AppState>,
    Path(id): Path<i32>,
) -> Result<Json<Value>, AppError> {
    let deleted = queries::admin_delete_promo(&state.db, id).await?;
    Ok(Json(json!({ "deleted": deleted })))
}
