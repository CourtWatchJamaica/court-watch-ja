// Required system packages for OCR: poppler-utils (pdftoppm), tesseract-ocr (tesseract)
//
// Scrapes the court lists page, downloads new PDFs, and upserts sittings.
// URL: https://supremecourt.gov.jm/content/court-lists
use chrono::NaiveDate;
use regex::Regex;
use scraper::{Html, Selector};
use sha2::{Digest, Sha256};
use sqlx::PgPool;
use std::path::Path;
use tracing::{error, info, warn};

use super::{discovery, pdf as pdf_parser, ScraperState};
use crate::{db::queries, utils::pdf as pdf_utils};

const COURT_LISTS_URL: &str = "https://supremecourt.gov.jm/content/court-lists";
const BASE_URL: &str = "https://supremecourt.gov.jm";

pub async fn run(
    pool: &PgPool,
    state: &mut ScraperState,
    client: &reqwest::Client,
    pdf_dir: &str,
) -> anyhow::Result<()> {
    // Remove stale processed_pdf_urls — entries where 0 court_sittings reference
    // the URL, meaning the previous import failed silently (e.g. old parse bug).
    let stale: Vec<String> = {
        let mut s = Vec::new();
        for url in &state.processed_pdf_urls {
            match queries::count_sittings_by_source_url(pool, url).await {
                Ok(0) => s.push(url.clone()),
                Ok(_) => {}
                Err(e) => warn!("DB count failed for {url}: {e}"),
            }
        }
        s
    };
    if !stale.is_empty() {
        info!("Removing {} stale processed-URL entries (0 sittings in DB)", stale.len());
        for url in &stale {
            state.clear_pdf_hash(url);
        }
        state.processed_pdf_urls.retain(|u| !stale.contains(u));
    }

    info!("Fetching court lists index: {COURT_LISTS_URL}");
    let html = client
        .get(COURT_LISTS_URL)
        .send()
        .await?
        .error_for_status()?
        .text()
        .await?;

    let outcome = discovery::discover_pdf_links(&html, client).await;
    let pdf_links = outcome.links;
    info!(
        "Found {} PDF link(s) on court-lists page (layer {}, confidence: {})",
        pdf_links.len(),
        outcome.layer,
        outcome.confidence
    );

    if pdf_links.is_empty() {
        state.consecutive_zero_pdf_runs += 1;
        if state.consecutive_zero_pdf_runs >= 2 {
            error!(
                "[ALERT] Supreme Court court-lists scraper found 0 PDF links for {} consecutive \
                 run(s) — website structure may have changed. Snippet: {}",
                state.consecutive_zero_pdf_runs,
                outcome.html_snippet.as_deref().unwrap_or("(none)")
            );
        }
        return Ok(());
    }
    state.consecutive_zero_pdf_runs = 0;

    let mut total_new_cases: usize = 0;
    let today = chrono::Utc::now().date_naive();

    for link in pdf_links {
        let absolute_url = if link.starts_with("http") {
            link.clone()
        } else {
            format!("{BASE_URL}{link}")
        };

        let already_processed = state.pdf_already_processed(&absolute_url);

        // Fast-path: skip old PDFs (>14 days) that were already processed.
        // Recent PDFs are always re-downloaded to detect in-place updates.
        if already_processed {
            let is_recent = date_from_url(&absolute_url)
                .map(|d| (today - d).num_days() <= 14)
                .unwrap_or(true); // treat no-date URLs as recent (safer)
            if !is_recent {
                info!("Skipping already-processed old PDF: {absolute_url}");
                continue;
            }
        }

        let bytes = match pdf_utils::download_pdf(client, &absolute_url).await {
            Ok(b) => b,
            Err(e) => {
                warn!("Skipping {absolute_url}: {e}");
                continue;
            }
        };

        // Hash-based change detection for already-processed recent PDFs.
        // The court often publishes addenda by updating the same URL in-place.
        let current_hash = compute_pdf_hash(&bytes);
        if already_processed {
            if state.get_pdf_hash(&absolute_url) == Some(current_hash.as_str()) {
                info!("Skipping unchanged PDF: {absolute_url}");
                continue;
            }
            info!("PDF content changed — re-processing: {absolute_url}");
            state.processed_pdf_urls.retain(|u| u != &absolute_url);
        }

        match process_pdf_bytes(pool, pdf_dir, &absolute_url, bytes).await {
            Ok(inserted) => {
                total_new_cases += inserted;
                // Always store the hash so future runs can detect changes.
                state.set_pdf_hash(absolute_url.clone(), current_hash);
                if inserted > 0 {
                    info!("Inserted {inserted} new sittings from {absolute_url}");
                    state.mark_pdf_processed(absolute_url);
                } else {
                    info!("0 new sittings from {absolute_url} — hash recorded, not marking as processed");
                }
            }
            Err(e) => {
                warn!("Skipping {absolute_url} due to error: {e}");
            }
        }
    }

    info!("Court-lists scraper complete. Total new sittings this run: {total_new_cases}");
    Ok(())
}

/// Compute a SHA-256 fingerprint of PDF bytes for change detection.
pub fn compute_pdf_hash(bytes: &[u8]) -> String {
    let mut h = Sha256::new();
    h.update(bytes);
    format!("{:x}", h.finalize())
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
        warn!("Failed to save PDF to disk: {e}");
    }

    let raw_text = extract_text_safe(&bytes, absolute_url);

    if raw_text.trim().is_empty() {
        warn!("No extractable text from {absolute_url}, skipping");
        return Ok(0);
    }

    let preview: String = raw_text.chars().take(2000).collect();
    info!("=== OCR TEXT PREVIEW [{absolute_url}] ===\n{preview}\n=== END PREVIEW ===");

    let text = normalize_ocr_text(&raw_text);

    let event_date = date_from_url(absolute_url).or_else(|| date_from_text(&text));
    let entries = pdf_parser::parse_court_list_text(&text, event_date);
    info!("Parsed {} sitting entries from {absolute_url}", entries.len());

    let mut inserted: usize = 0;

    for entry in entries {
        if entry.case_number.is_none() && entry.title.is_none() {
            continue;
        }

        if let (Some(ref cn), Some(event_date), Some(ref et)) =
            (&entry.case_number, entry.event_date, &entry.event_type)
        {
            match queries::sitting_exists(pool, cn, event_date, et).await {
                Ok(true) => continue,
                Ok(false) => {}
                Err(e) => warn!("DB check failed: {e}"),
            }
        }

        match queries::upsert_court_sitting(
            pool,
            entry.case_number.as_deref(),
            entry.title.as_deref(),
            entry.judge_name.as_deref(),
            entry.division.as_deref().or(Some("Civil")),
            entry.event_type.as_deref(),
            entry.event_date,
            entry.event_time,
            entry.lawyers.as_deref(),
            Some(absolute_url),
        )
        .await
        {
            Ok(_) => inserted += 1,
            Err(e) => warn!("Failed to upsert sitting: {e}"),
        }
    }

    Ok(inserted)
}

/// Pre-process OCR output to fix common artefacts before the regex parser runs.
pub fn normalize_ocr_text(text: &str) -> String {
    // Collapse spaced-out commercial case numbers:
    //   "SU 2022 CD 00537"  →  "SU2022CD00537"
    //   "SU2022 CD 00537"   →  "SU2022CD00537"
    let re_spaced_com = Regex::new(
        r"([A-Z]{1,4})\s{1,3}(\d{4})\s{1,3}([A-Z]{1,4})\s{1,3}(\d{3,6})"
    )
    .unwrap();
    let pass1 = re_spaced_com.replace_all(text, |caps: &regex::Captures| {
        format!("{}{}{}{}", &caps[1], &caps[2], &caps[3], &caps[4])
    });

    // Collapse spaced civil case numbers: "2024 / HCV / 00123" → "2024/HCV/00123"
    let re_spaced_civ =
        Regex::new(r"(\d{4})\s*/\s*([A-Z]+)\s*/\s*(\d+)").unwrap();
    let pass2 = re_spaced_civ.replace_all(&pass1, |caps: &regex::Captures| {
        format!("{}/{}/{}", &caps[1], &caps[2], &caps[3])
    });

    // Collapse OCR-spaced legacy case numbers: "2016 HCV 05029" → "2016HCV05029"
    let re_spaced_legacy =
        Regex::new(r"\b(\d{4})\s{1,3}([A-Z]{2,4})\s{1,3}(\d{4,6})\b").unwrap();
    let pass2 = re_spaced_legacy.replace_all(&pass2, |caps: &regex::Captures| {
        format!("{}{}{}", &caps[1], &caps[2], &caps[3])
    });

    // Replace curly / smart quotes with straight ones.
    let pass3 = pass2
        .replace('\u{2018}', "'")
        .replace('\u{2019}', "'")
        .replace('\u{201C}', "\"")
        .replace('\u{201D}', "\"");

    // Collapse runs of blank lines to a single blank line.
    let re_blanks = Regex::new(r"\n{3,}").unwrap();
    re_blanks.replace_all(&pass3, "\n\n").into_owned()
}

/// Try pdf-extract → OCR (pdftoppm + tesseract) → raw UTF-8 fallback.
/// All char operations use iterators — never byte-indexed slices.
pub fn extract_text_safe(bytes: &[u8], url: &str) -> String {
    match pdf_utils::extract_text_from_bytes(bytes) {
        Ok(t) if !t.trim().is_empty() => return t,
        Ok(_) => info!("pdf-extract returned empty text for {url}, trying OCR"),
        Err(e) => info!("pdf-extract failed for {url} ({e}), trying OCR"),
    }

    if let Some(t) = pdf_utils::extract_text_ocr(bytes) {
        if !t.trim().is_empty() {
            info!("OCR succeeded for {url}");
            return t;
        }
    }
    info!("OCR produced no text for {url}, falling back to raw UTF-8");

    String::from_utf8_lossy(bytes)
        .chars()
        .filter(|&c| c == '\n' || c == '\r' || c == '\t' || !c.is_control())
        .collect()
}

pub fn extract_pdf_links(html: &str) -> Vec<String> {
    let doc = Html::parse_document(html);
    let sel = Selector::parse("a[href]").unwrap();
    let mut links = Vec::new();

    for a in doc.select(&sel) {
        if let Some(href) = a.value().attr("href") {
            let lower_href = href.to_lowercase();
            let link_text = a.text().collect::<String>().to_lowercase();
            // Match by URL pattern OR by link text (catches addenda and amended lists
            // even when the filename doesn't contain "addendum").
            if lower_href.ends_with(".pdf")
                || lower_href.contains("court-list")
                || link_text.contains("addendum")
                || link_text.contains("amended")
                || link_text.contains("court list")
            {
                links.push(href.to_string());
            }
        }
    }

    links.dedup();
    links
}

pub fn sanitize_filename(url: &str) -> String {
    url.split('/')
        .last()
        .unwrap_or("court_list.pdf")
        .replace(|c: char| !c.is_alphanumeric() && c != '.' && c != '-' && c != '_', "_")
}

pub fn date_from_url(url: &str) -> Option<NaiveDate> {
    let re_iso = Regex::new(r"(\d{4}-\d{2}-\d{2})").unwrap();
    if let Some(cap) = re_iso.captures(url) {
        return NaiveDate::parse_from_str(&cap[1], "%Y-%m-%d").ok();
    }
    let re_compact = Regex::new(r"(\d{2})(\d{2})(\d{4})").unwrap();
    if let Some(cap) = re_compact.captures(url) {
        return NaiveDate::parse_from_str(
            &format!("{}-{}-{}", &cap[3], &cap[2], &cap[1]),
            "%Y-%m-%d",
        )
        .ok();
    }
    None
}

pub fn date_from_text(text: &str) -> Option<NaiveDate> {
    // Use char-safe take — never byte-index.
    let head: String = text.chars().take(1500).collect();

    // Regex to strip ordinal suffixes ("4TH" → "4", "1ST" → "1") before chrono parsing.
    let re_strip = Regex::new(r"(?i)(\d)(st|nd|rd|th)\b").unwrap();

    // Pass 1: keyword-prefixed date — allow ordinal suffix attached to the day digit
    // ("SITTING 4TH MAY 2026", "WEEK COMMENCING 1ST JUNE 2026").
    let re = Regex::new(
        r"(?i)(?:week\s+commencing|for\s+the\s+week|dated?|sitting)\s+:?\s*(\d{1,2}(?:st|nd|rd|th)?\s+\w+\s+\d{4}|\w+\s+\d{1,2}(?:st|nd|rd|th)?,?\s+\d{4})",
    )
    .unwrap();
    if let Some(cap) = re.captures(&head) {
        let clean = re_strip.replace_all(&cap[1], "$1");
        for fmt in &["%d %B %Y", "%d %b %Y", "%B %d, %Y", "%B %d %Y"] {
            if let Ok(d) = NaiveDate::parse_from_str(clean.trim(), fmt) {
                return Some(d);
            }
        }
    }

    // Pass 2: bare ordinal date anywhere in the header — CoA PDFs use this format
    // without a keyword prefix ("4TH MAY 2026", "MONDAY 4TH MAY 2026").
    let re_ord = Regex::new(
        r"(?i)\b(\d{1,2})(?:st|nd|rd|th)\s+([A-Za-z]+)\s+(\d{4})\b",
    )
    .unwrap();
    if let Some(cap) = re_ord.captures(&head) {
        let plain = format!("{} {} {}", &cap[1], &cap[2], &cap[3]);
        for fmt in &["%d %B %Y", "%d %b %Y"] {
            if let Ok(d) = NaiveDate::parse_from_str(&plain, fmt) {
                return Some(d);
            }
        }
    }

    None
}
