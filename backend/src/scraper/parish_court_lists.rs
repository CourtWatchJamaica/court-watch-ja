// Scrapes the Parish Court weekly court-lists page, downloads new PDFs,
// and upserts sittings.
//
// Two-level structure:
//   Level 1 — https://parishcourt.gov.jm/courtlist
//             Contains links to individual parish court sub-pages (/content/…)
//   Level 2 — each parish sub-page contains links to the actual weekly PDF files
//
// On any HTTP or network error, the affected page or PDF is skipped with a
// warning; run() always returns Ok(total_new_sittings).
use chrono::NaiveDate;
use scraper::{Html, Selector};
use sqlx::PgPool;
use std::path::Path;
use std::time::Duration;
use tokio::time::sleep;
use tracing::{info, warn};

use super::{
    court_lists::{
        date_from_text, date_from_url, extract_text_safe, normalize_ocr_text, sanitize_filename,
    },
    pdf as pdf_parser,
    ScraperState,
};
use crate::{db::queries, utils::pdf as pdf_utils};

const COURT_LISTS_URL: &str = "https://parishcourt.gov.jm/courtlist";
const BASE_URL: &str = "https://parishcourt.gov.jm";
const COURT_DIVISION: &str = "Parish Court";

pub async fn run(
    pool: &PgPool,
    state: &mut ScraperState,
    client: &reqwest::Client,
    pdf_dir: &str,
) -> anyhow::Result<usize> {
    info!("[Parish Hearings] Fetching court-lists index: {COURT_LISTS_URL}");

    let index_html = match fetch_page(client, COURT_LISTS_URL).await {
        Some(h) => h,
        None => {
            warn!("[Parish Hearings] Could not fetch index page — skipping");
            return Ok(0);
        }
    };

    let parish_page_urls = extract_parish_page_links(&index_html);
    info!(
        "[Parish Hearings] Found {} parish sub-page link(s)",
        parish_page_urls.len()
    );

    if parish_page_urls.is_empty() {
        warn!(
            "[Parish Hearings] No /content/ links found on {COURT_LISTS_URL}. \
             The page structure may have changed."
        );
        return Ok(0);
    }

    let mut total_found: usize = 0;
    let mut total_skipped: usize = 0;
    let mut total_processed: usize = 0;
    let mut total_new_sittings: usize = 0;

    for parish_url in parish_page_urls {
        sleep(Duration::from_secs(2)).await;

        info!("[Parish Hearings] Fetching parish page: {parish_url}");
        let parish_html = match fetch_page(client, &parish_url).await {
            Some(h) => h,
            None => {
                warn!("[Parish Hearings] Could not fetch {parish_url} — skipping");
                continue;
            }
        };

        let pdf_links = extract_pdf_links_from_page(&parish_html);
        info!(
            "[Parish Hearings] Found {} PDF link(s) on {parish_url}",
            pdf_links.len()
        );

        for link in pdf_links {
            let absolute_url = if link.starts_with("http") {
                link.clone()
            } else {
                format!("{BASE_URL}{link}")
            };

            total_found += 1;

            if state.parish_pdf_already_processed(&absolute_url) {
                info!("[Parish Hearings] Skipping already-processed PDF: {absolute_url}");
                total_skipped += 1;
                continue;
            }

            sleep(Duration::from_secs(3)).await;

            match process_one_pdf(pool, client, pdf_dir, &absolute_url).await {
                Ok(inserted) => {
                    total_processed += 1;
                    if inserted > 0 {
                        total_new_sittings += inserted;
                        state.mark_parish_pdf_processed(absolute_url);
                    } else {
                        info!(
                            "[Parish Hearings] 0 new sittings from {absolute_url} \
                             — not marking as processed"
                        );
                    }
                }
                Err(e) => {
                    warn!("[Parish Hearings] Skipping {absolute_url} due to error: {e}");
                }
            }
        }
    }

    info!(
        "[Parish Hearings] PDFs found: {total_found}, already processed: {total_skipped}, \
         newly processed: {total_processed}. New sittings: {total_new_sittings}"
    );
    Ok(total_new_sittings)
}

// ── Page fetcher ──────────────────────────────────────────────────────────────

async fn fetch_page(client: &reqwest::Client, url: &str) -> Option<String> {
    match client.get(url).send().await {
        Ok(r) if r.status().is_success() => match r.text().await {
            Ok(t) => Some(t),
            Err(e) => {
                warn!("[Parish Hearings] Failed to read response body from {url}: {e}");
                None
            }
        },
        Ok(r) => {
            warn!(
                "[Parish Hearings] {url} returned status {} — skipping",
                r.status()
            );
            None
        }
        Err(e) => {
            warn!("[Parish Hearings] Network error for {url}: {e}");
            None
        }
    }
}

// ── Link extractors ───────────────────────────────────────────────────────────

/// Extract parish sub-page links from the index page.
/// Keeps only absolute or relative hrefs that contain `/content/` and belong
/// to the parishcourt.gov.jm domain (or are root-relative paths).
fn extract_parish_page_links(html: &str) -> Vec<String> {
    let doc = Html::parse_document(html);
    let sel = Selector::parse("a[href]").unwrap();
    let mut links: Vec<String> = Vec::new();

    for a in doc.select(&sel) {
        let href = match a.value().attr("href") {
            Some(h) => h,
            None => continue,
        };

        let is_content_link = href.contains("/content/");
        let is_same_domain = href.starts_with("https://parishcourt.gov.jm")
            || href.starts_with("http://parishcourt.gov.jm")
            || href.starts_with('/');

        if !is_content_link || !is_same_domain {
            continue;
        }

        // Skip anything that looks like a judgment listing rather than a court list.
        let lower = href.to_lowercase();
        if lower.contains("judgment") {
            continue;
        }

        let absolute = if href.starts_with("http") {
            href.to_string()
        } else {
            format!("{BASE_URL}{href}")
        };

        if !links.contains(&absolute) {
            links.push(absolute);
        }
    }

    links
}

/// Substrings in the link text or filename that mark a non-court-list PDF to skip.
const SKIP_SIGNALS: &[&str] = &[
    "strategic", "business plan", "businessplan",
    "judicature", "sentencing", "guideline",
    "protocol", "proc.", "proc-",
    "annual report", "annualreport",
    "handbook", "manual", "policy",
];

/// Extract PDF links from a parish sub-page.
/// Keeps only hrefs whose path ends with `.pdf` AND whose link text / filename
/// does not match any skip-signal keyword (strategic plans, procedure docs, etc.).
fn extract_pdf_links_from_page(html: &str) -> Vec<String> {
    let doc = Html::parse_document(html);
    let sel = Selector::parse("a[href]").unwrap();
    let mut links: Vec<String> = Vec::new();

    for a in doc.select(&sel) {
        let href = match a.value().attr("href") {
            Some(h) => h,
            None => continue,
        };

        // Strip query string / fragment before checking extension.
        let path_part = href.split('?').next().unwrap_or(href);
        let path_part = path_part.split('#').next().unwrap_or(path_part);

        if !path_part.to_lowercase().ends_with(".pdf") {
            continue;
        }

        // Build a combined string from link text + filename for keyword matching.
        let link_text = a.text().collect::<String>().to_lowercase();
        let filename = path_part
            .split('/')
            .last()
            .unwrap_or("")
            .to_lowercase();
        let combined = format!("{link_text} {filename}");

        if SKIP_SIGNALS.iter().any(|s| combined.contains(s)) {
            warn!("[Parish Hearings] Skipping non-sitting PDF: {href}");
            continue;
        }

        if !links.contains(&href.to_string()) {
            links.push(href.to_string());
        }
    }

    links
}

// ── PDF processor ─────────────────────────────────────────────────────────────

async fn process_one_pdf(
    pool: &PgPool,
    client: &reqwest::Client,
    pdf_dir: &str,
    absolute_url: &str,
) -> anyhow::Result<usize> {
    let filename = sanitize_filename(absolute_url);
    info!("[Parish Hearings] Downloading: {filename}");

    let bytes = pdf_utils::download_pdf(client, absolute_url).await?;

    let save_path = Path::new(pdf_dir).join(&filename);
    tokio::fs::create_dir_all(pdf_dir).await.ok();
    if let Err(e) = tokio::fs::write(&save_path, &bytes).await {
        warn!("[Parish Hearings] Failed to save PDF to disk: {e}");
    }

    let raw_text = extract_text_safe(&bytes, absolute_url);

    if raw_text.trim().is_empty() {
        warn!("[Parish Hearings] No extractable text from {filename}, skipping");
        return Ok(0);
    }

    let preview: String = raw_text.chars().take(2000).collect();
    info!(
        "[Parish Hearings] === OCR TEXT PREVIEW [{filename}] ===\n{preview}\n=== END PREVIEW ==="
    );

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
                Err(e) => warn!("[Parish Hearings] DB check failed: {e}"),
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
            Err(e) => warn!("[Parish Hearings] Failed to upsert sitting: {e}"),
        }
    }

    info!(
        "[Parish Hearings] {filename}: {entry_count} entries parsed, \
         {inserted} new sittings upserted"
    );

    Ok(inserted)
}
