use axum::{
    extract::{Path, Query, State},
    Json,
};
use chrono::NaiveDate;
use serde::Deserialize;
use serde_json::{json, Value};

use crate::{db::queries, AppState};

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
                Ok((cases, total)) => Json(json!({ "cases": cases, "total": total })),
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
        Ok((cases, total)) => Json(json!({ "cases": cases, "total": total })),
        Err(e) => {
            tracing::error!("list_parish_cases error: {e}");
            Json(json!({ "cases": [], "total": 0 }))
        }
    }
}

// ── Offence categorisation (mirrors frontend logic) ───────────────────────────

fn categorise(offence: Option<&str>) -> &'static str {
    let Some(o) = offence else { return "other" };
    let o = o.to_lowercase();
    if ["murder", "manslaughter", "assault", "wounding", "robbery", "rape",
        "sexual", "grievous", "gun", "firearm", "shooting", "stabbing", "arson"]
        .iter()
        .any(|k| o.contains(k))
    {
        return "violent";
    }
    if ["ganja", "cannabis", "cocaine", "drug", "possession of prohib", "traffick", "dangerous drug"]
        .iter()
        .any(|k| o.contains(k))
    {
        return "drugs";
    }
    if ["larceny", "theft", "burglary", "housebreaking", "fraud", "forgery",
        "obtaining", "malicious", "damage", "possession of sto"]
        .iter()
        .any(|k| o.contains(k))
    {
        return "property";
    }
    "other"
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
            };

            let all_charges = match &case.accused_name {
                Some(name) => {
                    queries::list_all_charges_for_accused(&state.db, name)
                        .await
                        .unwrap_or_else(|_| vec![case.clone()])
                }
                None => vec![case.clone()],
            };

            let total_count = all_charges.len() as i64;

            let mut violent: u32 = 0;
            let mut property: u32 = 0;
            let mut drugs: u32 = 0;
            let mut other: u32 = 0;
            for c in &all_charges {
                match categorise(c.offence.as_deref()) {
                    "violent" => violent += 1,
                    "property" => property += 1,
                    "drugs" => drugs += 1,
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
