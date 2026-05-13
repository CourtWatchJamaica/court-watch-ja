use axum::{http::StatusCode, response::{IntoResponse, Response}, Json};
use serde_json::json;
use thiserror::Error;

#[derive(Debug, Error)]
pub enum AppError {
    #[error("Not found")]
    NotFound,
    #[error("Unauthorized")]
    Unauthorized,
    #[error("Forbidden")]
    Forbidden,
    #[error("{0}")]
    BadRequest(String),
    #[error("{0}")]
    Internal(String),
    #[error("Too many requests")]
    TooManyRequests,
    #[error(transparent)]
    Sqlx(#[from] sqlx::Error),
    #[error(transparent)]
    Anyhow(#[from] anyhow::Error),
}

impl IntoResponse for AppError {
    fn into_response(self) -> Response {
        if let Self::TooManyRequests = self {
            let mut res = (
                StatusCode::TOO_MANY_REQUESTS,
                Json(json!({ "error": "Too many requests — retry after 60 seconds" })),
            )
                .into_response();
            res.headers_mut()
                .insert("retry-after", "60".parse().unwrap());
            return res;
        }

        let (status, message) = match &self {
            Self::NotFound => (StatusCode::NOT_FOUND, self.to_string()),
            Self::Unauthorized => (StatusCode::UNAUTHORIZED, self.to_string()),
            Self::Forbidden => (StatusCode::FORBIDDEN, self.to_string()),
            Self::BadRequest(m) => (StatusCode::BAD_REQUEST, m.clone()),
            Self::Internal(m) => (StatusCode::INTERNAL_SERVER_ERROR, m.clone()),
            Self::TooManyRequests => unreachable!(),
            Self::Sqlx(e) => {
                tracing::error!("Database error: {:?}", e);
                (StatusCode::INTERNAL_SERVER_ERROR, "Database error".into())
            }
            Self::Anyhow(e) => {
                tracing::error!("Internal error: {:?}", e);
                (StatusCode::INTERNAL_SERVER_ERROR, "Internal error".into())
            }
        };
        (status, Json(json!({ "error": message }))).into_response()
    }
}
