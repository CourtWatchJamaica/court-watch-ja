// Scrapes the Court of Appeal cause-and-hearing-lists page, downloads new PDFs,
// and upserts sittings.
// URL: https://www.courtofappeal.gov.jm/content/cause-and-hearing-lists
//
// Mirrors court_lists.rs but targets the Court of Appeal website.
// PDFs are served from the no-www origin (courtofappeal.gov.jm).
// On any HTTP or network error the run() function logs a warning and returns Ok(0) —
// the CoA court-lists page may not always be available.
use chrono::NaiveDate;
use regex::Regex;
use sqlx::PgPool;
use std::path::Path;
use tracing::{info, warn};

use super::{
    court_lists::{
        compute_pdf_hash, date_from_text, date_from_url, extract_pdf_links, extract_text_safe,
        normalize_ocr_text, sanitize_filename,
    },
    pdf as pdf_parser,
    ScraperState,
};
use crate::{db::queries, utils::pdf as pdf_utils};

/// PDFs are served from the no-www origin; relative links must use this base.
const BASE_URL: &str = "https://courtofappeal.gov.jm";
/// Drupal Quick Tabs base — appending &page=N gives subsequent pages.
const COURT_LISTS_URL: &str =
    "https://courtofappeal.gov.jm/content/cause-and-hearing-lists?qt-cause_and_hearing_lists=1";
const COURT_DIVISION: &str = "Court of Appeal";

pub async fn run(
    pool: &PgPool,
    state: &mut ScraperState,
    client: &reqwest::Client,
    pdf_dir: &str,
) -> anyhow::Result<usize> {
    // Remove stale processed_appeal_pdf_urls — entries where 0 court_sittings reference
    // the URL (previous import failed silently, e.g. due to the old parse bug).
    let stale: Vec<String> = {
        let mut s = Vec::new();
        for url in &state.processed_appeal_pdf_urls {
            match queries::count_sittings_by_source_url(pool, url).await {
                Ok(0) => s.push(url.clone()),
                Ok(_) => {}
                Err(e) => warn!("[CoA Hearings] DB count failed for {url}: {e}"),
            }
        }
        s
    };
    if !stale.is_empty() {
        info!(
            "[CoA Hearings] Removing {} stale processed-URL entries (0 sittings in DB)",
            stale.len()
        );
        state.processed_appeal_pdf_urls.retain(|u| !stale.contains(u));
    }

    info!("[CoA Hearings] Fetching court lists index: {COURT_LISTS_URL}");

    let pdf_links = fetch_paginated_pdf_links(client).await;

    // Log breakdown by filename keyword for observability.
    let hearing_count = pdf_links
        .iter()
        .filter(|u| u.to_lowercase().contains("hearing"))
        .count();
    let cause_count = pdf_links
        .iter()
        .filter(|u| u.to_lowercase().contains("cause"))
        .count();
    info!("[CoA Hearings] Hearing List: found {hearing_count} PDF(s)");
    info!("[CoA Hearings] Cause List: found {cause_count} PDF(s)");

    let link_count = pdf_links.len();
    if link_count == 0 {
        warn!(
            "[CoA Hearings] No PDF links found on court-lists page ({COURT_LISTS_URL}). \
             The page may have changed structure or be temporarily empty."
        );
        return Ok(0);
    }
    info!("[CoA Hearings] Found {link_count} unique PDF link(s) across both list types");

    let mut total_new_sittings: usize = 0;
    let mut processed_count: usize = 0;
    let mut skipped_count: usize = 0;
    let today = chrono::Utc::now().date_naive();

    for link in pdf_links {
        let absolute_url = if link.starts_with("http") {
            link.clone()
        } else {
            format!("{BASE_URL}{link}")
        };

        let already_processed = state.appeal_pdf_already_processed(&absolute_url);

        // Fast-path: skip old PDFs (>14 days) that were already processed.
        if already_processed {
            let is_recent = date_from_url(&absolute_url)
                .map(|d| (today - d).num_days() <= 14)
                .unwrap_or(true);
            if !is_recent {
                info!("[CoA Hearings] Skipping already-processed old PDF: {absolute_url}");
                skipped_count += 1;
                continue;
            }
        }

        let bytes = match pdf_utils::download_pdf(client, &absolute_url).await {
            Ok(b) => b,
            Err(e) => {
                warn!("[CoA Hearings] Skipping {absolute_url}: {e}");
                continue;
            }
        };

        // Hash-based change detection for already-processed recent PDFs.
        let current_hash = compute_pdf_hash(&bytes);
        if already_processed {
            if state.get_pdf_hash(&absolute_url) == Some(current_hash.as_str()) {
                info!("[CoA Hearings] Skipping unchanged PDF: {absolute_url}");
                skipped_count += 1;
                continue;
            }
            info!("[CoA Hearings] PDF content changed — re-processing: {absolute_url}");
            state.processed_appeal_pdf_urls.retain(|u| u != &absolute_url);
        }

        match process_pdf_bytes(pool, pdf_dir, &absolute_url, bytes).await {
            Ok(inserted) => {
                processed_count += 1;
                state.set_pdf_hash(absolute_url.clone(), current_hash);
                if inserted > 0 {
                    total_new_sittings += inserted;
                    state.mark_appeal_pdf_processed(absolute_url);
                } else {
                    info!(
                        "[CoA Hearings] 0 new sittings from {absolute_url} — hash recorded, not marking as processed"
                    );
                }
            }
            Err(e) => {
                warn!("[CoA Hearings] Skipping {absolute_url} due to error: {e}");
            }
        }
    }

    info!(
        "[CoA Hearings] Court-lists scraper complete. \
         PDFs: {link_count} found, {skipped_count} already done, {processed_count} newly processed. \
         New sittings this run: {total_new_sittings}"
    );
    Ok(total_new_sittings)
}

/// Fetches all PDF links from the CoA cause-and-hearing-lists Quick Tab,
/// following `&page=N` pagination until no further pages exist.
/// Returns a deduplicated list of absolute PDF URLs.
async fn fetch_paginated_pdf_links(client: &reqwest::Client) -> Vec<String> {
    let re_page = Regex::new(r"[?&]page=(\d+)").unwrap();
    let mut all_links: Vec<String> = Vec::new();

    let page0_url = format!("{COURT_LISTS_URL}&page=0");
    let html0 = match fetch_listing_page(client, &page0_url).await {
        Some(h) => h,
        None => {
            warn!("[CoA Hearings] could not fetch listing page — skipping");
            return all_links;
        }
    };

    for link in extract_pdf_links(&html0) {
        let abs = absolutize(link);
        if !all_links.contains(&abs) {
            all_links.push(abs);
        }
    }

    let max_page: u32 = re_page
        .captures_iter(&html0)
        .filter_map(|c| c[1].parse::<u32>().ok())
        .max()
        .unwrap_or(0);

    for page in 1..=max_page {
        let url = format!("{COURT_LISTS_URL}&page={page}");
        let html = match fetch_listing_page(client, &url).await {
            Some(h) => h,
            None => {
                warn!("[CoA Hearings] could not fetch page {page} — stopping pagination");
                break;
            }
        };
        for link in extract_pdf_links(&html) {
            let abs = absolutize(link);
            if !all_links.contains(&abs) {
                all_links.push(abs);
            }
        }
    }

    all_links
}

/// Fetches a listing page HTML body, returning `None` on any HTTP or network error.
async fn fetch_listing_page(client: &reqwest::Client, url: &str) -> Option<String> {
    match client.get(url).send().await {
        Ok(r) if r.status().is_success() => r.text().await.ok(),
        Ok(r) => {
            warn!("[CoA Hearings] HTTP {} for {url}", r.status());
            None
        }
        Err(e) => {
            warn!("[CoA Hearings] Network error for {url}: {e}");
            None
        }
    }
}

/// Converts a relative PDF href to an absolute URL using the CoA base origin.
fn absolutize(link: String) -> String {
    if link.starts_with("http") {
        link
    } else {
        format!("{BASE_URL}{link}")
    }
}

async fn process_pdf_bytes(
    pool: &PgPool,
    pdf_dir: &str,
    absolute_url: &str,
    bytes: Vec<u8>,
) -> anyhow::Result<usize> {
    let filename = sanitize_filename(absolute_url);

    let save_path = Path::new(pdf_dir).join(&filename);
    tokio::fs::create_dir_all(pdf_dir).await.ok();
    if let Err(e) = tokio::fs::write(&save_path, &bytes).await {
        warn!("[CoA Hearings] Failed to save PDF to disk: {e}");
    }

    let raw_text = extract_text_safe(&bytes, absolute_url);

    if raw_text.trim().is_empty() {
        warn!("[CoA Hearings] No extractable text from {filename}, skipping");
        return Ok(0);
    }

    let preview: String = raw_text.chars().take(2000).collect();
    info!("[CoA Hearings] === OCR TEXT PREVIEW [{filename}] ===\n{preview}\n=== END PREVIEW ===");

    let text = normalize_ocr_text(&raw_text);

    let event_date: Option<NaiveDate> =
        date_from_url(absolute_url).or_else(|| date_from_text(&text));
    let entries = pdf_parser::parse_court_list_text(&text, event_date);
    let entry_count = entries.len();

    let mut inserted: usize = 0;

    for entry in entries {
        if entry.case_number.is_none() && entry.title.is_none() {
            continue;
        }

        if let (Some(ref cn), Some(event_date)) = (&entry.case_number, entry.event_date) {
            match queries::sitting_exists(pool, cn, event_date, entry.event_type.as_deref()).await {
                Ok(true) => continue,
                Ok(false) => {}
                Err(e) => warn!("[CoA Hearings] DB check failed: {e}"),
            }
        }

        match queries::upsert_court_sitting(
            pool,
            entry.case_number.as_deref(),
            entry.title.as_deref(),
            entry.judge_name.as_deref(),
            Some(COURT_DIVISION),
            entry.event_type.as_deref(),
            entry.event_date,
            entry.event_time,
            entry.lawyers.as_deref(),
            Some(absolute_url),
        )
        .await
        {
            Ok(Some(_)) => inserted += 1,
            Ok(None) => {}
            Err(e) => warn!("[CoA Hearings] Failed to upsert sitting: {e}"),
        }
    }

    info!(
        "[CoA Hearings] {filename}: {entry_count} entries parsed, {inserted} new sittings upserted"
    );

    Ok(inserted)
}
