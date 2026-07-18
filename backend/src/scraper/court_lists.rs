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

/// Re-parses locally saved court-list PDFs with the current parser and inserts
/// any sittings the parser version that originally processed them missed.
///
/// Runs on every startup (spawned, non-blocking) and is idempotent:
/// - Only files that map back to a known court-list source URL are touched
///   (judgment PDFs share the same directory and must not be parsed as lists).
/// - A file is skipped when `pdf_ingest_state` records the same content hash
///   AND the current `PARSER_VERSION` — so after one full pass, subsequent
///   boots only hash the files and do no parsing.
/// - Inserts are deduplicated per (case_number, event_date) via
///   `sitting_exists_any_type`, so partially ingested lists are topped up
///   without duplicating rows created by an older parser.
///
/// Returns (files_reparsed, sittings_inserted).
pub async fn backfill_local_pdfs(
    pool: &PgPool,
    pdf_dir: &str,
    scraper_state_path: &str,
) -> anyhow::Result<(usize, usize)> {
    use std::collections::HashMap;

    // ── Map local filenames back to their original source URLs ────────────
    let mut url_by_file: HashMap<String, String> = HashMap::new();
    for url in queries::distinct_sitting_source_urls(pool).await? {
        url_by_file.insert(sanitize_filename(&url), url);
    }
    let state = super::ScraperState::load_from_db(pool, scraper_state_path).await;
    for url in state
        .processed_pdf_urls
        .iter()
        .chain(state.processed_appeal_pdf_urls.iter())
    {
        url_by_file
            .entry(sanitize_filename(url))
            .or_insert_with(|| url.clone());
    }

    let mut files_reparsed = 0usize;
    let mut total_inserted = 0usize;

    let mut dir = match tokio::fs::read_dir(pdf_dir).await {
        Ok(d) => d,
        Err(e) => {
            info!("[PDF backfill] No PDF directory at {pdf_dir} ({e}); nothing to do");
            return Ok((0, 0));
        }
    };

    while let Ok(Some(entry)) = dir.next_entry().await {
        let filename = entry.file_name().to_string_lossy().to_string();
        if !filename.to_lowercase().ends_with(".pdf") {
            continue;
        }
        // Unknown files are judgment PDFs or manual drops — never parse those
        // as court lists.
        let Some(source_url) = url_by_file.get(&filename) else {
            continue;
        };

        let bytes = match tokio::fs::read(entry.path()).await {
            Ok(b) => b,
            Err(e) => {
                warn!("[PDF backfill] Failed to read {filename}: {e}");
                continue;
            }
        };
        let hash = compute_pdf_hash(&bytes);

        match queries::get_pdf_ingest_state(pool, &filename).await {
            Ok(Some((h, v))) if h == hash && v == pdf_parser::PARSER_VERSION => continue,
            Ok(_) => {}
            Err(e) => {
                warn!("[PDF backfill] State lookup failed for {filename}: {e}");
                continue;
            }
        }

        let raw_text = extract_text_safe(&bytes, source_url);
        if raw_text.trim().is_empty() {
            // Record it so unparseable scans aren't re-attempted every boot.
            let _ = queries::upsert_pdf_ingest_state(
                pool, &filename, &hash, pdf_parser::PARSER_VERSION, 0,
            )
            .await;
            continue;
        }
        let text = normalize_ocr_text(&raw_text);
        let event_date = date_from_url(source_url).or_else(|| date_from_text(&text));
        let entries = pdf_parser::parse_court_list_text(&text, event_date);

        let is_appeal = source_url.contains("courtofappeal");
        let mut inserted = 0i64;
        for entry in entries {
            let (Some(cn), Some(date)) = (entry.case_number.as_deref(), entry.event_date)
            else {
                // Backfill is conservative: without a case number AND date we
                // cannot dedup reliably, so skip rather than risk duplicates.
                continue;
            };
            match queries::sitting_exists_any_type(pool, cn, date).await {
                Ok(true) => continue,
                Ok(false) => {}
                Err(e) => {
                    warn!("[PDF backfill] Dedup check failed for {cn}: {e}");
                    continue;
                }
            }
            let division = if is_appeal {
                Some("Court of Appeal")
            } else {
                entry.division.as_deref().or(Some("Civil"))
            };
            match queries::upsert_court_sitting(
                pool,
                Some(cn),
                entry.title.as_deref(),
                entry.judge_name.as_deref(),
                division,
                entry.event_type.as_deref(),
                entry.event_date,
                entry.event_time,
                entry.lawyers.as_deref(),
                Some(source_url),
            )
            .await
            {
                Ok(Some(_)) => inserted += 1,
                Ok(None) => {}
                Err(e) => warn!("[PDF backfill] Insert failed for {cn}: {e}"),
            }
        }

        if let Err(e) = queries::upsert_pdf_ingest_state(
            pool, &filename, &hash, pdf_parser::PARSER_VERSION, inserted,
        )
        .await
        {
            warn!("[PDF backfill] Failed to record state for {filename}: {e}");
        }

        files_reparsed += 1;
        total_inserted += inserted as usize;
        if inserted > 0 {
            info!("[PDF backfill] {filename}: recovered {inserted} sitting(s)");
        }
    }

    Ok((files_reparsed, total_inserted))
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

        if let (Some(ref cn), Some(event_date)) = (&entry.case_number, entry.event_date) {
            match queries::sitting_exists(pool, cn, event_date, entry.event_type.as_deref()).await {
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
            Ok(Some(_)) => inserted += 1,
            Ok(None) => {}
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
