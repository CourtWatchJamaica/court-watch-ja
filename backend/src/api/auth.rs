use axum::{extract::State, Extension, Json};
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

#[derive(Serialize)]
pub struct MeResponse {
    pub id: i32,
    pub email: String,
    pub role: String,
    pub created_at: String,
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

    let token = jwt::encode_token(user.id, &user.email, &user.role, &state.config.jwt_secret)?;
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

    let token = jwt::encode_token(user.id, &user.email, &user.role, &state.config.jwt_secret)?;
    Ok(Json(AuthResponse { token }))
}

pub async fn me(
    State(state): State<AppState>,
    Extension(user_id): Extension<i32>,
) -> Result<Json<MeResponse>, AppError> {
    let user = queries::get_user_by_id(&state.db, user_id)
        .await?
        .ok_or(AppError::NotFound)?;

    Ok(Json(MeResponse {
        id: user.id,
        email: user.email,
        role: user.role,
        created_at: user.created_at.to_string(),
    }))
}

#[derive(Deserialize)]
pub struct UpdateProfileRequest {
    pub email: Option<String>,
    pub current_password: String,
    pub new_password: Option<String>,
}

pub async fn update_profile(
    State(state): State<AppState>,
    Extension(user_id): Extension<i32>,
    Json(body): Json<UpdateProfileRequest>,
) -> Result<Json<MeResponse>, AppError> {
    if body.email.is_none() && body.new_password.is_none() {
        return Err(AppError::BadRequest("No changes provided".into()));
    }

    let user = queries::get_user_by_id(&state.db, user_id)
        .await?
        .ok_or(AppError::NotFound)?;

    let valid = bcrypt::verify(&body.current_password, &user.password_hash)
        .map_err(|e| AppError::Internal(e.to_string()))?;

    if !valid {
        return Err(AppError::BadRequest("Current password is incorrect".into()));
    }

    let new_hash = if let Some(ref pw) = body.new_password {
        if pw.len() < 8 {
            return Err(AppError::BadRequest(
                "New password must be at least 8 characters".into(),
            ));
        }
        Some(
            bcrypt::hash(pw, bcrypt::DEFAULT_COST)
                .map_err(|e| AppError::Internal(e.to_string()))?,
        )
    } else {
        None
    };

    let updated = queries::update_user_profile(
        &state.db,
        user_id,
        body.email.as_deref(),
        new_hash.as_deref(),
    )
    .await?
    .ok_or(AppError::NotFound)?;

    Ok(Json(MeResponse {
        id: updated.id,
        email: updated.email,
        role: updated.role,
        created_at: updated.created_at.to_string(),
    }))
}
