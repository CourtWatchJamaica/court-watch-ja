use std::net::SocketAddr;
use std::time::Instant;

use axum::{
    extract::{ConnectInfo, Query, State},
    http::HeaderMap,
    Extension, Json,
};
use serde::{Deserialize, Serialize};
use uuid::Uuid;

use crate::{
    api::errors::AppError,
    db::queries,
    utils::jwt,
    AppState,
};

fn check_rate_limit(state: &AppState, ip: &str) -> Result<(), AppError> {
    const LIMIT: usize = 5;
    const WINDOW: std::time::Duration = std::time::Duration::from_secs(60);
    let mut map = state.rate_limiter.lock().unwrap();
    let now = Instant::now();
    let timestamps = map.entry(ip.to_string()).or_default();
    timestamps.retain(|&t| now.duration_since(t) < WINDOW);
    if timestamps.len() >= LIMIT {
        return Err(AppError::TooManyRequests);
    }
    timestamps.push(now);
    Ok(())
}

fn client_ip(headers: &HeaderMap, addr: &SocketAddr) -> String {
    headers
        .get("x-forwarded-for")
        .and_then(|v| v.to_str().ok())
        .and_then(|s| s.split(',').next())
        .map(|s| s.trim().to_string())
        .filter(|s| !s.is_empty())
        .unwrap_or_else(|| addr.ip().to_string())
}

#[derive(Deserialize)]
pub struct AuthRequest {
    pub email: String,
    pub password: String,
    pub display_name: Option<String>,
}

#[derive(Serialize)]
pub struct AuthResponse {
    pub token: String,
}

#[derive(Serialize)]
pub struct SignupResponse {
    pub message: String,
}

#[derive(Serialize)]
pub struct MeResponse {
    pub id: i32,
    pub email: String,
    pub role: String,
    pub display_name: Option<String>,
    pub created_at: String,
    pub email_verified: bool,
}

#[derive(Deserialize)]
pub struct VerifyTokenQuery {
    pub token: String,
}

pub async fn signup(
    State(state): State<AppState>,
    ConnectInfo(addr): ConnectInfo<SocketAddr>,
    headers: HeaderMap,
    Json(body): Json<AuthRequest>,
) -> Result<Json<SignupResponse>, AppError> {
    check_rate_limit(&state, &client_ip(&headers, &addr))?;
    if body.email.is_empty() || body.password.is_empty() {
        return Err(AppError::BadRequest("Email and password are required".into()));
    }
    if body.password.len() < 8 {
        return Err(AppError::BadRequest("Password must be at least 8 characters".into()));
    }

    let hash = bcrypt::hash(&body.password, bcrypt::DEFAULT_COST)
        .map_err(|e| AppError::Internal(e.to_string()))?;

    let display_name = body.display_name.as_deref().and_then(|s| {
        let t = s.trim();
        if t.is_empty() { None } else { Some(t) }
    });

    let user = match queries::create_user(&state.db, &body.email, &hash, display_name).await {
        Ok(u) => u,
        Err(sqlx::Error::Database(ref dbe)) if dbe.constraint() == Some("users_email_key") => {
            // User already exists — allow resend only for unverified accounts.
            let existing = queries::find_user_by_email(&state.db, &body.email)
                .await?
                .ok_or_else(|| AppError::Internal("User lookup failed".into()))?;
            if existing.email_verified {
                return Err(AppError::BadRequest("Email already registered".into()));
            }
            // Require correct password to prevent abuse of the resend path.
            let valid = bcrypt::verify(&body.password, &existing.password_hash)
                .map_err(|e| AppError::Internal(e.to_string()))?;
            if !valid {
                return Err(AppError::BadRequest("Email already registered".into()));
            }
            existing
        }
        Err(e) => return Err(AppError::Sqlx(e)),
    };

    // Replace any existing token and issue a fresh 24-hour one.
    queries::delete_verification_tokens_for_user(&state.db, user.id).await?;
    let raw_token = Uuid::new_v4().to_string();
    let expires_at = chrono::Utc::now().naive_utc() + chrono::Duration::hours(24);
    queries::create_verification_token(&state.db, user.id, &raw_token, expires_at).await?;

    if let Some(ref api_key) = state.config.resend_api_key {
        let client = reqwest::Client::new();
        let key = api_key.clone();
        let to = body.email.clone();
        let token = raw_token.clone();
        tokio::spawn(async move {
            let app_url = std::env::var("APP_URL")
                .unwrap_or_else(|_| "https://courtwatchjamaica.com".into());
            let app_url = app_url.trim_end_matches('/');
            let verify_url = format!("{app_url}/verify-email?token={token}");
            let subject = "Verify your CourtWatch JA email";
            let html = format!(
                r#"<p>Thank you for signing up to <strong>CourtWatch JA</strong>.</p>
<p>Click the link below to verify your email address:</p>
<p><a href="{verify_url}">Verify Email Address</a></p>
<p>This link expires in 24 hours. If you did not create an account, please ignore this email.</p>"#
            );
            if let Err(e) =
                crate::notifications::email::send_email(
                    &client,
                    &key,
                    crate::notifications::email::EmailSender::Auth,
                    &to,
                    subject,
                    &html,
                )
                .await
            {
                tracing::error!("[Signup] Verification email FAILED for {to}: {e}");
            }
        });
    }

    Ok(Json(SignupResponse {
        message: "Check your inbox to verify your email.".into(),
    }))
}

pub async fn login(
    State(state): State<AppState>,
    ConnectInfo(addr): ConnectInfo<SocketAddr>,
    headers: HeaderMap,
    Json(body): Json<AuthRequest>,
) -> Result<Json<AuthResponse>, AppError> {
    check_rate_limit(&state, &client_ip(&headers, &addr))?;
    let user = queries::find_user_by_email(&state.db, &body.email)
        .await?
        .ok_or(AppError::Unauthorized)?;

    let valid = bcrypt::verify(&body.password, &user.password_hash)
        .map_err(|e| AppError::Internal(e.to_string()))?;

    if !valid {
        return Err(AppError::Unauthorized);
    }

    if !user.email_verified {
        return Err(AppError::EmailNotVerified);
    }

    let token = jwt::encode_token(user.id, &user.email, &user.role, &state.config.jwt_secret)?;
    Ok(Json(AuthResponse { token }))
}

pub async fn verify_email(
    State(state): State<AppState>,
    Query(params): Query<VerifyTokenQuery>,
) -> Result<Json<AuthResponse>, AppError> {
    let user_id = queries::consume_verification_token(&state.db, &params.token)
        .await?
        .ok_or_else(|| AppError::BadRequest("Invalid or expired verification token".into()))?;

    queries::mark_email_verified(&state.db, user_id).await?;
    let _ = queries::create_welcome_notification(&state.db, user_id).await;

    let user = queries::get_user_by_id(&state.db, user_id)
        .await?
        .ok_or(AppError::NotFound)?;

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
        display_name: user.display_name,
        created_at: user.created_at.to_string(),
        email_verified: user.email_verified,
    }))
}

#[derive(Deserialize)]
pub struct UpdateProfileRequest {
    pub display_name: Option<String>,  // no password required; None = absent, Some("") = clear
    pub email: Option<String>,
    pub current_password: Option<String>, // required only when email / new_password is set
    pub new_password: Option<String>,
}

// ── OAuth sign-in ─────────────────────────────────────────────────────────────

#[derive(Deserialize)]
pub struct OAuthRequest {
    pub provider: String,
    pub email: String,
    pub name: Option<String>,
}

pub async fn oauth_login(
    State(state): State<AppState>,
    Json(body): Json<OAuthRequest>,
) -> Result<Json<AuthResponse>, AppError> {
    if body.email.is_empty() {
        return Err(AppError::BadRequest("Email is required".into()));
    }

    let (user, is_new) = queries::find_or_create_oauth_user(
        &state.db,
        &body.email,
        body.name.as_deref(),
    )
    .await
    .map_err(AppError::Sqlx)?;

    let _ = queries::create_welcome_notification(&state.db, user.id).await;

    if is_new {
        if let Some(ref api_key) = state.config.resend_api_key {
            let client = reqwest::Client::new();
            let key = api_key.clone();
            let to = user.email.clone();
            let name = user.display_name.clone();
            tokio::spawn(async move {
                if let Err(e) = crate::notifications::email::send_welcome_email(
                    &client,
                    &key,
                    &to,
                    name.as_deref(),
                )
                .await
                {
                    tracing::error!("[OAuth] Welcome email FAILED for {to}: {e}");
                }
            });
        }
    }

    let token = jwt::encode_token(user.id, &user.email, &user.role, &state.config.jwt_secret)?;
    Ok(Json(AuthResponse { token }))
}

// ── Password-change via email verification ────────────────────────────────────

#[derive(Deserialize)]
pub struct RequestPasswordChangeRequest {
    pub current_password: String,
    pub new_password: String,
}

#[derive(Deserialize)]
pub struct ConfirmPasswordChangeRequest {
    pub token: String,
}

pub async fn request_password_change(
    State(state): State<AppState>,
    Extension(user_id): Extension<i32>,
    Json(body): Json<RequestPasswordChangeRequest>,
) -> Result<Json<SignupResponse>, AppError> {
    if body.current_password.is_empty() {
        return Err(AppError::BadRequest("Current password is required".into()));
    }
    if body.new_password.len() < 8 {
        return Err(AppError::BadRequest(
            "New password must be at least 8 characters".into(),
        ));
    }

    let user = queries::get_user_by_id(&state.db, user_id)
        .await?
        .ok_or(AppError::NotFound)?;

    let valid = bcrypt::verify(&body.current_password, &user.password_hash)
        .map_err(|e| AppError::Internal(e.to_string()))?;
    if !valid {
        return Err(AppError::BadRequest("Current password is incorrect".into()));
    }

    let pending_hash = bcrypt::hash(&body.new_password, bcrypt::DEFAULT_COST)
        .map_err(|e| AppError::Internal(e.to_string()))?;

    let raw_token = Uuid::new_v4().to_string();
    let expires_at = chrono::Utc::now().naive_utc() + chrono::Duration::minutes(15);
    queries::create_password_change_token(
        &state.db,
        user_id,
        &raw_token,
        &pending_hash,
        expires_at,
    )
    .await?;

    if let Some(ref api_key) = state.config.resend_api_key {
        let client = reqwest::Client::new();
        let key = api_key.clone();
        let email = user.email.clone();
        let token = raw_token.clone();
        tokio::spawn(async move {
            let app_url = std::env::var("APP_URL")
                .unwrap_or_else(|_| "https://courtwatchjamaica.com".into());
            let app_url = app_url.trim_end_matches('/');
            let confirm_url = format!("{app_url}/verify-password-change?token={token}");
            let subject = "Confirm your CourtWatch JA password change";
            let html = format!(
                r#"<p>We received a request to change the password on your CourtWatch JA account.</p>
<p>Click the link below to confirm. This link expires in <strong>15 minutes</strong>.</p>
<p><a href="{confirm_url}">Confirm Password Change</a></p>
<p>If you did not request this change, you can safely ignore this email — your password will not be changed.</p>"#
            );
            if let Err(e) = crate::notifications::email::send_email(
                &client,
                &key,
                crate::notifications::email::EmailSender::Auth,
                &email,
                subject,
                &html,
            )
            .await
            {
                tracing::error!("[PasswordChange] Email FAILED for {email}: {e}");
            }
        });
    }

    Ok(Json(SignupResponse {
        message: "Check your email. We sent a verification link to confirm this password change."
            .into(),
    }))
}

pub async fn confirm_password_change(
    State(state): State<AppState>,
    Json(body): Json<ConfirmPasswordChangeRequest>,
) -> Result<Json<SignupResponse>, AppError> {
    if body.token.is_empty() {
        return Err(AppError::BadRequest("Token is required".into()));
    }

    let (user_id, pending_hash) =
        queries::consume_password_change_token(&state.db, &body.token)
            .await?
            .ok_or_else(|| AppError::BadRequest("Invalid or expired token".into()))?;

    queries::update_user_password(&state.db, user_id, &pending_hash).await?;

    Ok(Json(SignupResponse {
        message: "Password updated successfully.".into(),
    }))
}

// ── Forgot-password / reset ────────────────────────────────────────────────────

#[derive(Deserialize)]
pub struct ForgotPasswordRequest {
    pub email: String,
}

#[derive(Deserialize)]
pub struct ResetPasswordRequest {
    pub token: String,
    pub new_password: String,
}

pub async fn forgot_password(
    State(state): State<AppState>,
    ConnectInfo(addr): ConnectInfo<SocketAddr>,
    headers: HeaderMap,
    Json(body): Json<ForgotPasswordRequest>,
) -> Result<Json<SignupResponse>, AppError> {
    // Separate rate-limit bucket from login/signup
    check_rate_limit(&state, &format!("fp:{}", client_ip(&headers, &addr)))?;

    if body.email.is_empty() {
        return Err(AppError::BadRequest("Email is required".into()));
    }

    // Always return success to prevent email enumeration.
    if let Ok(Some(user)) = queries::find_user_by_email(&state.db, &body.email).await {
        let raw_token = Uuid::new_v4().to_string();
        let expires_at = chrono::Utc::now().naive_utc() + chrono::Duration::hours(1);

        if queries::create_password_reset_token(&state.db, user.id, &raw_token, expires_at)
            .await
            .is_ok()
        {
            if let Some(ref api_key) = state.config.resend_api_key {
                let client = reqwest::Client::new();
                let key = api_key.clone();
                let email = user.email.clone();
                let token = raw_token.clone();
                tokio::spawn(async move {
                    let app_url = std::env::var("APP_URL")
                        .unwrap_or_else(|_| "https://courtwatchjamaica.com".into());
                    let app_url = app_url.trim_end_matches('/');
                    let reset_url = format!("{app_url}/reset-password?token={token}");
                    let subject = "Reset your CourtWatch JA password";
                    let html = format!(
                        r#"<p>We received a request to reset the password for your CourtWatch JA account.</p>
<p>Click the link below to set a new password. This link expires in <strong>1 hour</strong>.</p>
<p><a href="{reset_url}">Reset Password</a></p>
<p>If you did not request this, you can safely ignore this email — your password will not be changed.</p>"#
                    );
                    if let Err(e) = crate::notifications::email::send_email(
                        &client,
                        &key,
                        crate::notifications::email::EmailSender::Auth,
                        &email,
                        subject,
                        &html,
                    )
                    .await
                    {
                        tracing::error!("[ForgotPassword] Email FAILED for {email}: {e}");
                    }
                });
            }
        }
    }

    Ok(Json(SignupResponse {
        message:
            "If an account with that email exists, you will receive a password reset link shortly."
                .into(),
    }))
}

pub async fn reset_password(
    State(state): State<AppState>,
    ConnectInfo(addr): ConnectInfo<SocketAddr>,
    headers: HeaderMap,
    Json(body): Json<ResetPasswordRequest>,
) -> Result<Json<SignupResponse>, AppError> {
    check_rate_limit(&state, &client_ip(&headers, &addr))?;

    if body.token.is_empty() {
        return Err(AppError::BadRequest("Token is required".into()));
    }
    if body.new_password.len() < 8 {
        return Err(AppError::BadRequest(
            "Password must be at least 8 characters".into(),
        ));
    }

    let user_id = queries::consume_password_reset_token(&state.db, &body.token)
        .await?
        .ok_or_else(|| AppError::BadRequest("Invalid or expired reset link".into()))?;

    let hash = bcrypt::hash(&body.new_password, bcrypt::DEFAULT_COST)
        .map_err(|e| AppError::Internal(e.to_string()))?;

    queries::update_user_password(&state.db, user_id, &hash).await?;

    Ok(Json(SignupResponse {
        message: "Password reset successfully. You can now sign in with your new password.".into(),
    }))
}

// ── Self-service account deletion ─────────────────────────────────────────────

pub async fn delete_own_account(
    State(state): State<AppState>,
    Extension(user_id): Extension<i32>,
) -> Result<Json<SignupResponse>, AppError> {
    let deleted = queries::admin_delete_user(&state.db, user_id).await?;
    if !deleted {
        return Err(AppError::NotFound);
    }
    Ok(Json(SignupResponse {
        message: "Account deleted.".into(),
    }))
}

// ── Profile ───────────────────────────────────────────────────────────────────

pub async fn update_profile(
    State(state): State<AppState>,
    Extension(user_id): Extension<i32>,
    Json(body): Json<UpdateProfileRequest>,
) -> Result<Json<MeResponse>, AppError> {
    if body.display_name.is_none() && body.email.is_none() && body.new_password.is_none() {
        return Err(AppError::BadRequest("No changes provided".into()));
    }

    let user = queries::get_user_by_id(&state.db, user_id)
        .await?
        .ok_or(AppError::NotFound)?;

    // Password verification is required only for credential changes.
    let new_hash = if body.email.is_some() || body.new_password.is_some() {
        let cp = body.current_password.as_deref().unwrap_or("");
        if cp.is_empty() {
            return Err(AppError::BadRequest("Current password is required".into()));
        }
        let valid = bcrypt::verify(cp, &user.password_hash)
            .map_err(|e| AppError::Internal(e.to_string()))?;
        if !valid {
            return Err(AppError::BadRequest("Current password is incorrect".into()));
        }
        if let Some(ref pw) = body.new_password {
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
        }
    } else {
        None
    };

    let final_display_name: Option<String> = match body.display_name {
        Some(ref s) => {
            let t = s.trim();
            if t.is_empty() { None } else { Some(t.to_string()) }
        }
        None => user.display_name.clone(),
    };

    let updated = queries::update_user_profile(
        &state.db,
        user_id,
        final_display_name.as_deref(),
        body.email.as_deref(),
        new_hash.as_deref(),
    )
    .await?
    .ok_or(AppError::NotFound)?;

    Ok(Json(MeResponse {
        id: updated.id,
        email: updated.email,
        role: updated.role,
        display_name: updated.display_name,
        created_at: updated.created_at.to_string(),
        email_verified: updated.email_verified,
    }))
}
