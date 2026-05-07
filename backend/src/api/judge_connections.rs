use axum::{extract::State, Json};
use serde::Serialize;

use crate::{api::errors::AppError, db::{models::JudgeConnection, queries}, AppState};

#[derive(Serialize)]
pub struct JudgeConnectionsResponse {
    pub connections: Vec<JudgeConnection>,
}

pub async fn list_judge_connections(
    State(state): State<AppState>,
) -> Result<Json<JudgeConnectionsResponse>, AppError> {
    let connections = queries::list_judge_connections(&state.db).await?;
    Ok(Json(JudgeConnectionsResponse { connections }))
}
