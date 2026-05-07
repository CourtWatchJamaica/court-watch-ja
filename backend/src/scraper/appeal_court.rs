/// Scrapes the Court of Appeal of Jamaica judgment listing pages.
///
/// Civil:    https://www.courtofappeal.gov.jm/index.php/civil-judgments-endorsement-and-memoranda
/// Criminal: https://www.courtofappeal.gov.jm/index.php/criminal-judgments
///
/// Pagination: the site does NOT use `?page=N` — all page numbers return the same
/// results.  The site exposes a Drupal Views year-filter dropdown (`field_year_target_id`).
/// We scrape that dropdown once per run to get the year → taxonomy-ID mapping, then
/// fetch one URL per applicable year (newest first, stopping when we pass cutoff_date).
///
/// Table columns: Citation/Appeal Number | Title (linked to detail) | Date of Delivery
/// No Presiding Judge column exists on listing pages; judge_name is always None.
///
/// PDF URL fix: CoA detail pages emit relative hrefs like
///   /index.php/sites/default/files/judgments/...
/// The correct download URL omits /index.php:
///   https://courtofappeal.gov.jm/sites/default/files/judgments/...
/// PDF_BASE_URL is "https://courtofappeal.gov.jm" (no www, no /index.php).
///
/// Navigation-item filter: rows whose case-number cell contains no digits and does
/// not start with '[', or that exactly match a known nav phrase, are silently dropped.
use chrono::{Datelike, NaiveDate};
use scraper::{Html, Selector};
use sqlx::PgPool;
use std::time::Duration;
use tokio::time::sleep;
use tracing::{info, warn};

use super::{judges, judgment_detail, judgments::JudgmentRow, ScraperState};
use crate::db::queries;

/// Base URL for page navigation (www, with /index.php routing).
const BASE_URL: &str = "https://www.courtofappeal.gov.jm";
/// Base URL for static file downloads — PDFs live on the non-www origin.
/// Never append /index.php before /sites/…
const PDF_BASE_URL: &str = "https://courtofappeal.gov.jm";

const CIVIL_LISTING_URL: &str =
    "https://www.courtofappeal.gov.jm/index.php/civil-judgments-endorsement-and-memoranda";
const CRIMINAL_LISTING_URL: &str = "https://www.courtofappeal.gov.jm/index.php/criminal-judgments";
const JUDGES_URL: &str = "https://www.courtofappeal.gov.jm/content/president-and-judges-appeal";
const COURT_NAME: &str = "Court of Appeal";

/// Known navigation-link phrases that appear in listing tables but are not cases.
/// Compared case-insensitively against the trimmed case-number cell.
const NAV_PHRASES: &[&str] = &[
    "more about the court",
    "court sittings",
    "contact us",
    "how to find us",
    "newsletters",
    "laws of jamaica",
    "home",
    "about",
    "search",
    "civil division",
    "criminal division",
    "judgments",
    "cause lists",
    "court lists",
    "annual reports",
    "practice directions",
];

/// Run the civil and criminal judgment scrapers.
///
/// Returns `(civil_upserted, criminal_upserted)` so the caller can log a
/// combined summary alongside the hearing-list count.
pub async fn run(
    pool: &PgPool,
    state: &mut ScraperState,
    cutoff: NaiveDate,
    client: &reqwest::Client,
) -> anyhow::Result<(usize, usize)> {
    // state.next_appeal_page / next_appeal_criminal_page are kept for backward
    // compatibility but unused: the CoA site ignores ?page=N entirely.
    let _ = (state.next_appeal_page, state.next_appeal_criminal_page);

    info!("[CoA] Starting civil judgment scraper (year-based)");
    let civil_total = scrape_listing(pool, cutoff, client, CIVIL_LISTING_URL, "[CoA Civil]").await;

    info!("[CoA] Starting criminal judgment scraper (year-based)");
    let criminal_total =
        scrape_listing(pool, cutoff, client, CRIMINAL_LISTING_URL, "[CoA Crim]").await;

    Ok((civil_total, criminal_total))
}

// ── Listing scraper ───────────────────────────────────────────────────────────

/// Iterate one listing (civil or criminal) using year-based pagination.
/// Returns total judgments successfully upserted this run.
async fn scrape_listing(
    pool: &PgPool,
    cutoff: NaiveDate,
    client: &reqwest::Client,
    listing_base_url: &str,
    log_prefix: &str,
) -> usize {
    let year_ids = fetch_year_ids(client, listing_base_url, log_prefix).await;

    if year_ids.is_empty() {
        warn!(
            "{log_prefix} year-filter dropdown not found — \
             pagination not supported, scraping default page only"
        );
        let (found, upserted) =
            scrape_one_url(pool, cutoff, client, listing_base_url, log_prefix, None).await;
        info!("{log_prefix} (fallback) {found} cases found, {upserted} upserted");
        return upserted;
    }

    let cutoff_year = cutoff.year();
    let applicable: Vec<(i32, String)> = year_ids
        .into_iter()
        .filter(|(y, _)| *y >= cutoff_year)
        .collect();

    if applicable.is_empty() {
        info!("{log_prefix} no years >= cutoff year {cutoff_year} in dropdown — nothing to scrape");
        return 0;
    }

    info!(
        "{log_prefix} year-based pagination: {} year(s) >= {cutoff_year}: {}",
        applicable.len(),
        applicable
            .iter()
            .map(|(y, _)| y.to_string())
            .collect::<Vec<_>>()
            .join(", ")
    );

    let mut total_upserted: usize = 0;

    for (year, tid) in &applicable {
        let url = format!("{listing_base_url}?field_year_target_id={tid}");
        let (found, upserted) =
            scrape_one_url(pool, cutoff, client, &url, log_prefix, Some(*year)).await;

        total_upserted += upserted;
        info!(
            "{log_prefix} year {year}: {found} cases found, {upserted} upserted \
             (running total: {total_upserted})"
        );

        sleep(Duration::from_secs(2)).await;
    }

    info!("{log_prefix} complete. Total upserted this run: {total_upserted}");
    total_upserted
}

/// Fetch one URL, parse judgment rows, apply filters, upsert.
/// Returns `(cases_found_on_page, cases_upserted)`.
async fn scrape_one_url(
    pool: &PgPool,
    cutoff: NaiveDate,
    client: &reqwest::Client,
    url: &str,
    log_prefix: &str,
    year_label: Option<i32>,
) -> (usize, usize) {
    let tag = year_label
        .map(|y| format!(" [year {y}]"))
        .unwrap_or_default();

    let html = match client.get(url).send().await {
        Ok(r) if r.status().is_success() => match r.text().await {
            Ok(t) => t,
            Err(e) => {
                warn!("{log_prefix}{tag} failed to read body from {url}: {e}");
                return (0, 0);
            }
        },
        Ok(r) => {
            warn!(
                "{log_prefix}{tag} {url} returned status {} — skipping",
                r.status()
            );
            return (0, 0);
        }
        Err(e) => {
            warn!("{log_prefix}{tag} request error for {url}: {e}");
            return (0, 0);
        }
    };

    let rows = parse_coa_listing_page(&html);
    let found = rows.len();

    if found == 0 {
        warn!("{log_prefix}{tag} 0 cases found at {url} — empty year or parse issue");
        return (0, 0);
    }

    let mut upserted: usize = 0;

    for row in rows {
        if let Some(d) = row.date {
            if d < cutoff {
                info!("{log_prefix}{tag} hit cutoff date ({d} < {cutoff}) — stopping");
                break;
            }
        }

        let (pdf_url, summary, detail_judge) = if let Some(ref detail_url) = row.detail_url {
            let full_url = if detail_url.starts_with("http") {
                detail_url.clone()
            } else {
                format!("{BASE_URL}{detail_url}")
            };
            sleep(Duration::from_secs(3)).await;
            match judgment_detail::fetch(client, &full_url).await {
                Ok(d) => (d.pdf_url, d.summary_text, d.judge_name),
                Err(e) => {
                    warn!(
                        "{log_prefix}{tag} detail fetch failed for {}: {e}",
                        row.case_number
                    );
                    (None, None, None)
                }
            }
        } else {
            (None, None, None)
        };

        let pdf_url = pdf_url.map(|u| normalize_coa_pdf_url(&u));

        match queries::upsert_judgment(
            pool,
            &row.case_number,
            row.title.as_deref(),
            detail_judge.as_deref(),
            Some(COURT_NAME),
            row.date,
            pdf_url.as_deref(),
            None,
            summary.as_deref(),
        )
        .await
        {
            Ok(_) => {
                upserted += 1;
                info!("{log_prefix}{tag} upserted: {}", row.case_number);
            }
            Err(e) => warn!(
                "{log_prefix}{tag} failed to upsert {}: {e}",
                row.case_number
            ),
        }
    }

    (found, upserted)
}

// ── Year-dropdown helper ──────────────────────────────────────────────────────

/// Fetch `listing_base_url` and parse the year → Drupal taxonomy-ID mapping from
/// `<select id="edit-field-year-target-id">` (or `select[name='field_year_target_id']`).
///
/// Returns a vec sorted newest-first.  Empty vec if the dropdown is absent.
async fn fetch_year_ids(
    client: &reqwest::Client,
    listing_base_url: &str,
    log_prefix: &str,
) -> Vec<(i32, String)> {
    let html = match client.get(listing_base_url).send().await {
        Ok(r) if r.status().is_success() => match r.text().await {
            Ok(t) => t,
            Err(e) => {
                warn!("{log_prefix} failed to read index page for year extraction: {e}");
                return Vec::new();
            }
        },
        Ok(r) => {
            warn!(
                "{log_prefix} index page returned {} while fetching year ids",
                r.status()
            );
            return Vec::new();
        }
        Err(e) => {
            warn!("{log_prefix} network error fetching index page for year ids: {e}");
            return Vec::new();
        }
    };

    let doc = Html::parse_document(&html);
    let sel = Selector::parse(
        "#edit-field-year-target-id option, \
         select[name='field_year_target_id'] option",
    )
    .unwrap();

    let mut years: Vec<(i32, String)> = doc
        .select(&sel)
        .filter_map(|opt| {
            let value = opt.value().attr("value")?.to_string();
            if value == "All" || value.is_empty() {
                return None;
            }
            let label = opt.text().collect::<String>();
            let year: i32 = label.trim().parse().ok()?;
            Some((year, value))
        })
        .collect();

    years.sort_by(|a, b| b.0.cmp(&a.0));

    if years.is_empty() {
        warn!("{log_prefix} year dropdown found but contained no valid options");
    } else {
        info!(
            "{log_prefix} year dropdown: {} entries ({} – {})",
            years.len(),
            years.last().map(|(y, _)| *y).unwrap_or(0),
            years.first().map(|(y, _)| *y).unwrap_or(0),
        );
    }

    years
}

// ── HTML parsing ─────────────────────────────────────────────────────────────

/// Parse a CoA judgment listing page.
///
/// The table has 3 columns:
///   [0] Citation / Appeal Number
///   [1] Title — anchor href points to /index.php/node/XXXX
///   [2] Date of Delivery  (e.g. "25 March, 2026")
///
/// Rows are dropped when the case-number cell has no digits and does not start
/// with '[', or matches a known navigation phrase.
fn parse_coa_listing_page(html: &str) -> Vec<JudgmentRow> {
    let doc = Html::parse_document(html);
    let row_sel = Selector::parse("table tbody tr").unwrap();
    let td_sel = Selector::parse("td").unwrap();
    let a_sel = Selector::parse("a").unwrap();

    let mut rows = Vec::new();

    for tr in doc.select(&row_sel) {
        let cells: Vec<_> = tr.select(&td_sel).collect();
        if cells.len() < 2 {
            continue;
        }

        let case_number = cells[0].text().collect::<String>().trim().to_string();
        if case_number.is_empty() {
            continue;
        }

        if !is_valid_case_number(&case_number) {
            info!("[CoA] skipping non-case row (no digits): {:?}", case_number);
            continue;
        }
        if is_nav_phrase(&case_number) {
            info!("[CoA] skipping nav-link row: {:?}", case_number);
            continue;
        }

        let title_cell = &cells[1];
        let title = title_cell.text().collect::<String>().trim().to_string();
        let detail_url = title_cell
            .select(&a_sel)
            .next()
            .and_then(|a| a.value().attr("href").map(str::to_string));

        let date = cells.get(2).and_then(|c| {
            let s = c.text().collect::<String>();
            parse_coa_date(s.trim())
        });

        rows.push(JudgmentRow {
            case_number,
            title: if title.is_empty() { None } else { Some(title) },
            judge_name: None,
            date,
            detail_url,
        });
    }

    rows
}

// ── Filtering helpers ─────────────────────────────────────────────────────────

/// True when `s` looks like a court case number:
///   - starts with '[' (neutral citation), OR
///   - contains at least one ASCII digit (all real citations do).
fn is_valid_case_number(s: &str) -> bool {
    s.starts_with('[') || s.chars().any(|c| c.is_ascii_digit())
}

/// True when `s` exactly matches a known site-navigation phrase (case-insensitive).
fn is_nav_phrase(s: &str) -> bool {
    let lower = s.trim().to_lowercase();
    NAV_PHRASES.iter().any(|&nav| lower == nav)
}

// ── Date parsing ──────────────────────────────────────────────────────────────

fn parse_coa_date(s: &str) -> Option<NaiveDate> {
    for fmt in &[
        "%d %B, %Y", // "25 March, 2026"
        "%d %B %Y",  // "25 March 2026"
        "%B %d, %Y", // "March 25, 2026"
        "%d/%m/%Y",
        "%Y-%m-%d",
    ] {
        if let Ok(d) = NaiveDate::parse_from_str(s, fmt) {
            return Some(d);
        }
    }
    None
}

// ── PDF URL normalisation ─────────────────────────────────────────────────────

/// Canonical CoA PDF URL — always `https://courtofappeal.gov.jm/sites/…`.
///
/// Detail pages may emit the href in any of these forms:
///   - relative:  `/index.php/sites/default/files/…`
///   - absolute:  `https://www.courtofappeal.gov.jm/index.php/sites/…`
///   - already correct: `https://courtofappeal.gov.jm/sites/…`
///
/// We normalise all three so the wrong origin / path prefix never reaches the DB.
pub fn normalize_coa_pdf_url_for_download(u: &str) -> String {
    normalize_coa_pdf_url(u)
}

fn normalize_coa_pdf_url(u: &str) -> String {
    if u.starts_with("http") {
        // Strip /index.php from path and rewrite to no-www origin.
        u.replace(
            "https://www.courtofappeal.gov.jm/index.php",
            "https://courtofappeal.gov.jm",
        )
        .replace(
            "http://www.courtofappeal.gov.jm/index.php",
            "https://courtofappeal.gov.jm",
        )
        .replace(
            "https://www.courtofappeal.gov.jm",
            "https://courtofappeal.gov.jm",
        )
    } else {
        let path = u.strip_prefix("/index.php").unwrap_or(u);
        format!("{PDF_BASE_URL}{path}")
    }
}

// ── Judges scraper ────────────────────────────────────────────────────────────

/// Scrapes the Court of Appeal judges list.
/// Graceful no-op on any non-success response.
pub async fn run_judges(pool: &PgPool, client: &reqwest::Client) -> anyhow::Result<()> {
    info!("[CoA] Scraping judges list from {JUDGES_URL}");

    let html = match client.get(JUDGES_URL).send().await {
        Ok(r) if r.status().is_success() => match r.text().await {
            Ok(t) => t,
            Err(e) => {
                warn!("[CoA] Failed to read judges response body: {e}");
                return Ok(());
            }
        },
        Ok(r) => {
            warn!(
                "[CoA] Judges page returned status {} — skipping",
                r.status()
            );
            return Ok(());
        }
        Err(e) => {
            warn!("[CoA] Network error fetching judges page: {e} — skipping");
            return Ok(());
        }
    };

    let names = judges::extract_judge_names(&html);
    info!("[CoA] Found {} judge names", names.len());

    for name in names {
        match queries::upsert_judge(pool, &name, Some(COURT_NAME)).await {
            Ok(_) => info!("[CoA] Upserted judge: {name}"),
            Err(e) => warn!("[CoA] Failed to upsert judge '{name}': {e}"),
        }
    }

    Ok(())
}
