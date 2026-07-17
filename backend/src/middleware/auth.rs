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

    let mut claims = jwt::decode_token(token, &state.config.jwt_secret)?;

    // Revocation check: the token is only valid while the user still exists,
    // its version matches, and the role hasn't changed.  This makes password/
    // email changes, role demotions, and account deletion take effect
    // immediately instead of at token expiry.
    let row: Option<(i32, String)> =
        sqlx::query_as("SELECT token_version, role FROM users WHERE id = $1")
            .bind(claims.sub)
            .fetch_optional(&state.db)
            .await
            .map_err(|e| AppError::Internal(format!("Auth lookup failed: {e}")))?;

    let (db_version, db_role) = row.ok_or(AppError::Unauthorized)?;
    if claims.ver != db_version {
        return Err(AppError::Unauthorized);
    }
    // Use the live role (covers promotions without forcing a re-login).
    claims.role = db_role;

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
