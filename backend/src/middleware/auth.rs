use axum::{
    extract::{Request, State},
    middleware::Next,
    response::Response,
};
use axum::http::header::AUTHORIZATION;

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
    req.extensions_mut().insert(claims.sub);

    Ok(next.run(req).await)
}
