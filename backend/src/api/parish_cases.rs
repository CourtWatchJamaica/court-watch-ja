use axum::{
    body::Body,
    extract::{Path, Query, State},
    http::{header, StatusCode},
    response::Response,
    Json,
};
use chrono::NaiveDate;
use serde::Deserialize;
use serde_json::{json, Value};

use crate::{db::queries, utils::offence_category, AppState};

#[derive(Deserialize)]
pub struct CasesQuery {
    pub parish: Option<String>,
    pub q: Option<String>,
    pub page: Option<i64>,
    pub limit: Option<i64>,
    /// Filter by offence category: "Violent", "Property", "Drugs", or "Other".
    pub category: Option<String>,
    /// Filter: return only cases where week_of >= this date (YYYY-MM-DD).
    pub date_from: Option<String>,
}

pub async fn list_parish_cases(
    State(state): State<AppState>,
    Query(params): Query<CasesQuery>,
) -> Json<Value> {
    let page = params.page.unwrap_or(1).max(1);
    let limit = params.limit.unwrap_or(5000).clamp(1, 5000);

    // If date_from is provided, use the week-filtered query.
    if let Some(ref df) = params.date_from {
        if let Ok(week_from) = NaiveDate::parse_from_str(df, "%Y-%m-%d") {
            return match queries::list_parish_cases_from_week(
                &state.db,
                week_from,
                params.parish.as_deref(),
                limit,
            )
            .await
            {
                Ok((cases, total)) => {
                    let cases: Vec<_> = cases.into_iter().map(|c| c.with_category()).collect();
                    Json(json!({ "cases": cases, "total": total }))
                }
                Err(e) => {
                    tracing::error!("list_parish_cases_from_week error: {e}");
                    Json(json!({ "cases": [], "total": 0 }))
                }
            };
        }
    }

    match queries::list_parish_cases(
        &state.db,
        params.parish.as_deref(),
        params.q.as_deref(),
        params.category.as_deref(),
        page,
        limit,
    )
    .await
    {
        Ok((cases, total)) => {
            let cases: Vec<_> = cases.into_iter().map(|c| c.with_category()).collect();
            Json(json!({ "cases": cases, "total": total }))
        }
        Err(e) => {
            tracing::error!("list_parish_cases error: {e}");
            Json(json!({ "cases": [], "total": 0 }))
        }
    }
}

pub async fn get_parish_case_by_id(
    State(state): State<AppState>,
    Path(id): Path<i32>,
) -> Json<Value> {
    match queries::get_parish_case(&state.db, id).await {
        Ok(Some(case)) => {
            let related = match (&case.accused_name, case.week_of) {
                (Some(name), Some(week)) => {
                    queries::list_related_parish_charges(&state.db, id, name, &case.parish, week)
                        .await
                        .unwrap_or_default()
                }
                _ => vec![],
            }
            .into_iter()
            .map(|c| c.with_category())
            .collect::<Vec<_>>();

            let all_charges: Vec<_> = match &case.accused_name {
                Some(name) => {
                    queries::list_all_charges_for_accused(&state.db, name)
                        .await
                        .unwrap_or_else(|_| vec![case.clone()])
                }
                None => vec![case.clone()],
            }
            .into_iter()
            .map(|c| c.with_category())
            .collect();

            let case = case.with_category();
            let total_count = all_charges.len() as i64;

            let mut violent: u32 = 0;
            let mut property: u32 = 0;
            let mut drugs: u32 = 0;
            let mut other: u32 = 0;
            for c in &all_charges {
                match offence_category::Category::from_str_loose(&c.category) {
                    Some(offence_category::Category::Violent) => violent += 1,
                    Some(offence_category::Category::Property) => property += 1,
                    Some(offence_category::Category::Drugs) => drugs += 1,
                    _ => other += 1,
                }
            }

            Json(json!({
                "case": case,
                "related": related,
                "all_charges": all_charges,
                "total_count": total_count,
                "offence_tallies": {
                    "violent": violent,
                    "property": property,
                    "drugs": drugs,
                    "other": other
                }
            }))
        }
        Ok(None) => Json(json!({ "error": "Not found" })),
        Err(e) => {
            tracing::error!("get_parish_case error: {e}");
            Json(json!({ "error": "Internal error" }))
        }
    }
}

pub async fn parish_summary(State(state): State<AppState>) -> Json<Value> {
    match queries::parish_summary(&state.db).await {
        Ok(rows) => Json(json!({ "summary": rows })),
        Err(e) => {
            tracing::error!("parish_summary error: {e}");
            Json(json!({ "summary": [] }))
        }
    }
}

/// Escapes a field per RFC 4180: wrap in quotes and double any internal quotes
/// whenever the value contains a comma, quote, or newline.
fn csv_field(value: &str) -> String {
    if value.contains(['"', ',', '\n', '\r']) {
        format!("\"{}\"", value.replace('"', "\"\""))
    } else {
        value.to_string()
    }
}

const EXPORT_ROW_CAP: i64 = 5000;

/// Exports the current filtered case list as CSV — respects the same
/// parish/category/search filters as the cases feed, for researchers and
/// law students who want to cite or analyse a case set outside the app.
pub async fn export_parish_cases_csv(
    State(state): State<AppState>,
    Query(params): Query<CasesQuery>,
) -> Response<Body> {
    let (cases, _total) = match queries::list_parish_cases(
        &state.db,
        params.parish.as_deref(),
        params.q.as_deref(),
        params.category.as_deref(),
        1,
        EXPORT_ROW_CAP,
    )
    .await
    {
        Ok(r) => r,
        Err(e) => {
            tracing::error!("export_parish_cases_csv error: {e}");
            return Response::builder()
                .status(StatusCode::INTERNAL_SERVER_ERROR)
                .body(Body::from("Failed to export cases"))
                .unwrap();
        }
    };

    let mut csv = String::from(
        "Case ID,Parish,Accused Name,Offence,Category,Status Code,Status,Week Of,Case Type,Source PDF URL\n",
    );
    for c in cases {
        let c = c.with_category();
        let row = [
            c.id.to_string(),
            c.parish.clone(),
            c.accused_name.clone().unwrap_or_default(),
            c.offence.clone().unwrap_or_default(),
            c.category.clone(),
            c.status.clone().unwrap_or_default(),
            crate::db::models::parish_status_label(c.status.as_deref()),
            c.week_of.map(|d| d.to_string()).unwrap_or_default(),
            c.case_type.clone(),
            c.pdf_source_url.clone().unwrap_or_default(),
        ];
        csv.push_str(
            &row.iter()
                .map(|f| csv_field(f))
                .collect::<Vec<_>>()
                .join(","),
        );
        csv.push_str("\r\n");
    }

    let filename = format!(
        "courtwatch-parish-court-{}.csv",
        chrono::Local::now().format("%Y-%m-%d")
    );

    Response::builder()
        .status(StatusCode::OK)
        .header(header::CONTENT_TYPE, "text/csv; charset=utf-8")
        .header(
            header::CONTENT_DISPOSITION,
            format!("attachment; filename=\"{filename}\""),
        )
        .body(Body::from(csv))
        .unwrap()
}

#[derive(Deserialize)]
pub struct AnalyticsQuery {
    /// Scopes the offence leaderboard to a single parish; spikes and backlog
    /// are always computed across all parishes.
    pub parish: Option<String>,
}

/// Journalist-facing aggregates: most-charged offences, week-over-week case
/// volume spikes per parish, and a backlog/adjournment watchlist.
pub async fn parish_analytics(
    State(state): State<AppState>,
    Query(params): Query<AnalyticsQuery>,
) -> Json<Value> {
    let leaderboard = queries::parish_offence_leaderboard(&state.db, params.parish.as_deref(), 15)
        .await
        .unwrap_or_default()
        .into_iter()
        .map(|r| r.with_category())
        .collect::<Vec<_>>();

    let spikes = queries::parish_weekly_spikes(&state.db)
        .await
        .unwrap_or_default();

    // Spike threshold: flag a >=30% week-over-week jump, or any jump into
    // double digits from a low base (avoids "1 -> 2 cases" reading as a 100% spike
    // while still catching a small parish's caseload doubling for real).
    let spikes: Vec<Value> = spikes
        .into_iter()
        .map(|s| {
            let pct_change = if s.previous_count > 0 {
                ((s.current_count - s.previous_count) as f64 / s.previous_count as f64) * 100.0
            } else if s.current_count > 0 {
                100.0
            } else {
                0.0
            };
            let is_spike = s.current_count >= 5
                && (pct_change >= 30.0 || (s.previous_count == 0 && s.current_count >= 5));
            json!({
                "parish": s.parish,
                "current_week": s.current_week,
                "current_count": s.current_count,
                "previous_week": s.previous_week,
                "previous_count": s.previous_count,
                "pct_change": (pct_change * 10.0).round() / 10.0,
                "is_spike": is_spike,
            })
        })
        .collect();

    let (backlog_top, backlog_by_parish) = queries::parish_backlog(&state.db, 25)
        .await
        .unwrap_or_default();

    Json(json!({
        "leaderboard": leaderboard,
        "spikes": spikes,
        "backlog": {
            "top": backlog_top,
            "by_parish": backlog_by_parish,
        }
    }))
}
