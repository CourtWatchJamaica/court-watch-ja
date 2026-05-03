// Required system packages for OCR: poppler-utils (pdftoppm), tesseract-ocr (tesseract)
//
// Scrapes the court lists page, downloads new PDFs, and upserts sittings.
// URL: https://supremecourt.gov.jm/content/court-lists
use chrono::NaiveDate;
use regex::Regex;
use scraper::{Html, Selector};
use sqlx::PgPool;
use std::path::Path;
use tracing::{info, warn};

use super::{pdf as pdf_parser, ScraperState};
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

    let pdf_links = extract_pdf_links(&html);
    info!("Found {} PDF links on court-lists page", pdf_links.len());

    let mut total_new_cases: usize = 0;

    for link in pdf_links {
        let absolute_url = if link.starts_with("http") {
            link.clone()
        } else {
            format!("{BASE_URL}{link}")
        };

        if state.pdf_already_processed(&absolute_url) {
            info!("Skipping already-processed PDF: {absolute_url}");
            continue;
        }

        match process_one_pdf(pool, client, pdf_dir, &absolute_url).await {
            Ok(inserted) => {
                total_new_cases += inserted;
                if inserted > 0 {
                    info!("Inserted {inserted} new sittings from {absolute_url}");
                    state.mark_pdf_processed(absolute_url);
                } else {
                    info!("0 new sittings from {absolute_url} — not marking as processed");
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

async fn process_one_pdf(
    pool: &PgPool,
    client: &reqwest::Client,
    pdf_dir: &str,
    absolute_url: &str,
) -> anyhow::Result<usize> {
    info!("Downloading court-list PDF: {absolute_url}");
    let bytes = pdf_utils::download_pdf(client, absolute_url).await?;

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

    // Debug: log first 2000 characters so we can see what OCR/pdf-extract produces
    // and tune the parser accordingly.
    let preview: String = raw_text.chars().take(2000).collect();
    info!("=== OCR TEXT PREVIEW [{absolute_url}] ===\n{preview}\n=== END PREVIEW ===");

    // Normalise common OCR artefacts before handing to the parser.
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
            Some("Civil"),
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
            let lower = href.to_lowercase();
            if lower.ends_with(".pdf") || lower.contains("court-list") {
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
    let re = Regex::new(
        r"(?i)(?:week\s+commencing|for\s+the\s+week|dated?|sitting)\s+:?\s*(\d{1,2}\s+\w+\s+\d{4}|\w+\s+\d{1,2},?\s+\d{4})",
    )
    .unwrap();
    // Use char-safe take — never byte-index.
    let head: String = text.chars().take(1500).collect();
    if let Some(cap) = re.captures(&head) {
        let s = &cap[1];
        for fmt in &["%d %B %Y", "%d %b %Y", "%B %d, %Y", "%B %d %Y"] {
            if let Ok(d) = NaiveDate::parse_from_str(s, fmt) {
                return Some(d);
            }
        }
    }
    None
}
