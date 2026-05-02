use axum::{extract::State, Json};
use serde::{Deserialize, Serialize};

use crate::{
    api::errors::AppError,
    db::queries,
    utils::jwt,
    AppState,
};

#[derive(Deserialize)]
pub struct AuthRequest {
    pub email: String,
    pub password: String,
}

#[derive(Serialize)]
pub struct AuthResponse {
    pub token: String,
}

pub async fn signup(
    State(state): State<AppState>,
    Json(body): Json<AuthRequest>,
) -> Result<Json<AuthResponse>, AppError> {
    if body.email.is_empty() || body.password.is_empty() {
        return Err(AppError::BadRequest("Email and password are required".into()));
    }
    if body.password.len() < 8 {
        return Err(AppError::BadRequest("Password must be at least 8 characters".into()));
    }

    let hash = bcrypt::hash(&body.password, bcrypt::DEFAULT_COST)
        .map_err(|e| AppError::Internal(e.to_string()))?;

    let user = queries::create_user(&state.db, &body.email, &hash)
        .await
        .map_err(|e| match e {
            sqlx::Error::Database(ref dbe) if dbe.constraint() == Some("users_email_key") => {
                AppError::BadRequest("Email already registered".into())
            }
            other => AppError::Sqlx(other),
        })?;

    let token = jwt::encode_token(user.id, &state.config.jwt_secret)?;
    Ok(Json(AuthResponse { token }))
}

pub async fn login(
    State(state): State<AppState>,
    Json(body): Json<AuthRequest>,
) -> Result<Json<AuthResponse>, AppError> {
    let user = queries::find_user_by_email(&state.db, &body.email)
        .await?
        .ok_or(AppError::Unauthorized)?;

    let valid = bcrypt::verify(&body.password, &user.password_hash)
        .map_err(|e| AppError::Internal(e.to_string()))?;

    if !valid {
        return Err(AppError::Unauthorized);
    }

    let token = jwt::encode_token(user.id, &state.config.jwt_secret)?;
    Ok(Json(AuthResponse { token }))
}
