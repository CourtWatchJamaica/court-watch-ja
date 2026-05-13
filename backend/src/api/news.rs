use axum::{extract::{Query, State}, Json};
use serde::Deserialize;
use serde_json::{json, Value};

use crate::{api::errors::AppError, db::queries, AppState};

#[derive(Deserialize)]
pub struct NewsQuery {
    pub category: Option<String>,
    #[serde(default = "default_limit")]
    pub limit: i64,
}

fn default_limit() -> i64 {
    20
}

pub async fn list_news(
    State(state): State<AppState>,
    Query(params): Query<NewsQuery>,
) -> Result<Json<Value>, AppError> {
    let news = queries::list_legal_news(
        &state.db,
        params.category.as_deref(),
        params.limit.min(100),
    )
    .await?;
    Ok(Json(json!({ "news": news })))
}
