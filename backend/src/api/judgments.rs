use axum::{
    extract::{Path, Query, State},
    Json,
};
use serde::{Deserialize, Serialize};

use crate::{
    api::{court_slug_to_name, errors::AppError},
    db::{models::Judgment, queries},
    scraper::{appeal_court, judgment_detail, judgments as judgments_scraper},
    AppState,
};

// ── Case Lookup ──────────────────────────────────────────────────────────────

#[derive(Deserialize)]
pub struct LookupParams {
    pub case_number: String,
}

#[derive(Serialize)]
pub struct LookupJudgmentItem {
    pub id: i32,
    pub case_number: String,
    pub title: Option<String>,
    pub date: Option<String>,
    pub court: Option<String>,
}

#[derive(Serialize)]
pub struct LookupSittingItem {
    pub id: i32,
    pub case_number: Option<String>,
    pub title: Option<String>,
    pub event_date: Option<String>,
    pub court: Option<String>,
}

#[derive(Serialize)]
pub struct CaseLookupResponse {
    pub found: bool,
    pub judgments: Vec<LookupJudgmentItem>,
    pub sittings: Vec<LookupSittingItem>,
    pub has_upcoming: bool,
    pub has_past: bool,
}

pub async fn case_lookup(
    State(state): State<AppState>,
    Query(params): Query<LookupParams>,
) -> Result<Json<CaseLookupResponse>, AppError> {
    let (j_rows, s_rows) = queries::case_lookup(&state.db, &params.case_number).await?;

    let today = chrono::Local::now().date_naive();
    let has_upcoming = s_rows.iter().any(|s| s.event_date.map(|d| d >= today).unwrap_or(false));
    let has_past = s_rows.iter().any(|s| s.event_date.map(|d| d < today).unwrap_or(false));
    let found = !j_rows.is_empty() || !s_rows.is_empty();

    let judgments = j_rows
        .into_iter()
        .map(|j| LookupJudgmentItem {
            id: j.id,
            case_number: j.case_number,
            title: j.title,
            date: j.date.map(|d| d.to_string()),
            court: j.court,
        })
        .collect();

    let sittings = s_rows
        .into_iter()
        .map(|s| LookupSittingItem {
            id: s.id,
            case_number: s.case_number,
            title: s.title,
            event_date: s.event_date.map(|d| d.to_string()),
            court: s.court_division,
        })
        .collect();

    Ok(Json(CaseLookupResponse { found, judgments, sittings, has_upcoming, has_past }))
}

#[derive(Deserialize)]
pub struct ListParams {
    pub q: Option<String>,
    pub page: Option<i64>,
    pub limit: Option<i64>,
    pub court: Option<String>,
    pub judge: Option<String>,
    pub tag: Option<String>,
}

#[derive(Serialize)]
pub struct JudgmentsResponse {
    pub judgments: Vec<Judgment>,
    pub total: i64,
}

#[derive(Serialize)]
pub struct JudgmentResponse {
    pub judgment: Judgment,
}

pub async fn list_judgments(
    State(state): State<AppState>,
    Query(params): Query<ListParams>,
) -> Result<Json<JudgmentsResponse>, AppError> {
    let page = params.page.unwrap_or(1).max(1);
    let limit = params.limit.unwrap_or(10).clamp(1, 100);
    let q = params.q.as_deref();
    let court = params.court.as_deref().map(court_slug_to_name);
    let judge = params.judge.as_deref();

    let tag = params.tag.as_deref();
    let (judgments, total) = queries::list_judgments(&state.db, q, page, limit, court, judge, tag).await?;
    Ok(Json(JudgmentsResponse { judgments, total }))
}

pub async fn get_judgment(
    State(state): State<AppState>,
    Path(id): Path<i32>,
) -> Result<Json<JudgmentResponse>, AppError> {
    let judgment = queries::get_judgment_by_id(&state.db, id)
        .await?
        .ok_or(AppError::NotFound)?;
    Ok(Json(JudgmentResponse { judgment }))
}

// ── Original PDF URL (live-verified, with listing-search fallback) ───────────

#[derive(Serialize)]
pub struct OriginalPdfResponse {
    pub url: Option<String>,
}

const SC_LISTING_BASE: &str = "https://supremecourt.gov.jm/content/judgments";
const SC_BASE: &str = "https://supremecourt.gov.jm";
const COA_BASE: &str = "https://www.courtofappeal.gov.jm";
const COA_CIVIL_LISTING: &str =
    "https://www.courtofappeal.gov.jm/index.php/civil-judgments-endorsement-and-memoranda";
const COA_CRIMINAL_LISTING: &str =
    "https://www.courtofappeal.gov.jm/index.php/criminal-judgments";

/// Resolves a stored pdf_url (which may be a relative path) to an absolute URL.
fn resolve_pdf_url(pdf_url: &str, court: Option<&str>) -> String {
    if pdf_url.starts_with("http") {
        return pdf_url.to_string();
    }
    let domain = if court
        .map(|c| c.to_lowercase().contains("appeal"))
        .unwrap_or(false)
    {
        "https://courtofappeal.gov.jm"
    } else {
        "https://supremecourt.gov.jm"
    };
    format!("{domain}{pdf_url}")
}

/// Normalise a case number for fuzzy matching: lowercase, keep only alphanumerics.
fn norm_case(s: &str) -> String {
    s.chars()
        .filter(|c| c.is_alphanumeric())
        .collect::<String>()
        .to_lowercase()
}

fn case_numbers_match(db_num: &str, listing_num: &str) -> bool {
    let a = norm_case(db_num);
    let b = norm_case(listing_num);
    a == b || a.contains(&b) || b.contains(&a)
}

/// Fetch raw HTML, returning `Err` on network or non-2xx response.
async fn fetch_html(client: &reqwest::Client, url: &str) -> Result<String, reqwest::Error> {
    client
        .get(url)
        .send()
        .await?
        .error_for_status()?
        .text()
        .await
}

/// Search the court's public listing pages for the detail page URL matching
/// `case_number`.  Returns the fully-qualified detail page URL, or `None`.
///
/// SC:  scans pages 0–4 of the judgments listing (newest-first).
/// CoA: tries the civil listing, then the criminal listing.
async fn find_source_url_from_listing(
    client: &reqwest::Client,
    case_number: &str,
    is_coa: bool,
) -> Option<String> {
    if is_coa {
        for listing in &[COA_CIVIL_LISTING, COA_CRIMINAL_LISTING] {
            if let Ok(html) = fetch_html(client, listing).await {
                if let Some(detail) = appeal_court::parse_coa_listing_page(&html)
                    .into_iter()
                    .find(|r| case_numbers_match(&r.case_number, case_number))
                    .and_then(|r| r.detail_url)
                {
                    let full = if detail.starts_with("http") {
                        detail
                    } else {
                        format!("{COA_BASE}{detail}")
                    };
                    return Some(full);
                }
            }
        }
    } else {
        for page in 0..5u32 {
            let url = format!("{SC_LISTING_BASE}?page={page}");
            match fetch_html(client, &url).await {
                Ok(html) => {
                    let rows = judgments_scraper::parse_listing_page(&html);
                    if rows.is_empty() {
                        break; // no more pages
                    }
                    if let Some(detail) = rows
                        .into_iter()
                        .find(|r| case_numbers_match(&r.case_number, case_number))
                        .and_then(|r| r.detail_url)
                    {
                        let full = if detail.starts_with("http") {
                            detail
                        } else {
                            format!("{SC_BASE}{detail}")
                        };
                        return Some(full);
                    }
                }
                Err(_) => break,
            }
        }
    }
    None
}

/// GET /api/judgments/:id/original-pdf
///
/// 1. Uses `source_url` if stored, otherwise searches the court's listing pages.
/// 2. Fetches the detail page and extracts the current PDF link.
/// 3. Verifies the PDF is reachable via a server-side HEAD request.
/// 4. Caches `pdf_url` + `source_url` back to the DB when they were missing.
/// Returns `{ url: null }` if the PDF cannot be located or verified.
pub async fn get_original_pdf_url(
    State(state): State<AppState>,
    Path(id): Path<i32>,
) -> Result<Json<OriginalPdfResponse>, AppError> {
    let judgment = queries::get_judgment_by_id(&state.db, id)
        .await?
        .ok_or(AppError::NotFound)?;

    let is_coa = judgment
        .court
        .as_deref()
        .map(|c| c.to_lowercase().contains("appeal"))
        .unwrap_or(false);

    let client = reqwest::Client::builder()
        .timeout(std::time::Duration::from_secs(10))
        .user_agent("CourtWatch-JA/1.0")
        .build()
        .map_err(|e| AppError::Internal(e.to_string()))?;

    // ── Step 1: Resolve the detail page URL ───────────────────────────────
    let source_was_stored = judgment.source_url.is_some();
    let detail_page_url: Option<String> = if source_was_stored {
        judgment.source_url.clone()
    } else {
        find_source_url_from_listing(&client, &judgment.case_number, is_coa).await
    };

    // ── Step 2: Extract the PDF link from the detail page ─────────────────
    let pdf_candidate: Option<String> = if let Some(ref source) = detail_page_url {
        match judgment_detail::fetch(&client, source, &judgment.case_number).await {
            Ok(detail) => detail.pdf_url,
            // Detail fetch failed — fall back to stored pdf_url if present.
            Err(_) => judgment
                .pdf_url
                .as_ref()
                .map(|u| resolve_pdf_url(u, judgment.court.as_deref())),
        }
    } else {
        // No detail page found — try the stored pdf_url as a last resort.
        judgment
            .pdf_url
            .as_ref()
            .map(|u| resolve_pdf_url(u, judgment.court.as_deref()))
    };

    let Some(pdf_url) = pdf_candidate else {
        return Ok(Json(OriginalPdfResponse { url: None }));
    };

    // ── Step 3: Verify reachability via HEAD ──────────────────────────────
    let accessible = matches!(
        client.head(&pdf_url).send().await,
        Ok(r) if r.status().is_success() || r.status().is_redirection()
    );
    if !accessible {
        return Ok(Json(OriginalPdfResponse { url: None }));
    }

    // ── Step 4: Cache the verified result so future requests are instant ──
    if !source_was_stored {
        if let Some(ref source) = detail_page_url {
            let _ = queries::cache_judgment_pdf_url(&state.db, id, &pdf_url, source).await;
        }
    }

    Ok(Json(OriginalPdfResponse { url: Some(pdf_url) }))
}
