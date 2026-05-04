use axum::http::header::AUTHORIZATION;
use axum::{
    extract::{Request, State},
    middleware::Next,
    response::Response,
};

use crate::{api::errors::AppError, utils::jwt, AppState};

pub async fn require_auth(
    State(state): State<AppState>,
    mut req: Request,
    next: Next,
) -> Result<Response, AppError> {
    let token = req
        .headers()
        .get(AUTHORIZATION)
        .and_then(|v| v.to_str().ok())
        .and_then(|v| v.strip_prefix("Bearer "))
        .ok_or(AppError::Unauthorized)?;

    let claims = jwt::decode_token(token, &state.config.jwt_secret)?;

    // Insert user_id as i32 for backward-compatible Extension(user_id): Extension<i32> extractors.
    req.extensions_mut().insert(claims.sub);
    // Insert full Claims so role-checking middleware can read it without a DB round-trip.
    req.extensions_mut().insert(claims);

    Ok(next.run(req).await)
}

pub async fn require_admin(req: Request, next: Next) -> Result<Response, AppError> {
    let claims = req
        .extensions()
        .get::<crate::utils::jwt::Claims>()
        .ok_or(AppError::Unauthorized)?;

    if claims.role != "admin" && claims.role != "super_admin" {
        return Err(AppError::Forbidden);
    }
    Ok(next.run(req).await)
}

pub async fn require_super_admin(req: Request, next: Next) -> Result<Response, AppError> {
    let claims = req
        .extensions()
        .get::<crate::utils::jwt::Claims>()
        .ok_or(AppError::Unauthorized)?;

    if claims.role != "super_admin" {
        return Err(AppError::Forbidden);
    }
    Ok(next.run(req).await)
}
