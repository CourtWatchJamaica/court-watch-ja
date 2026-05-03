// Scrapes the Court of Appeal cause-and-hearing-lists page, downloads new PDFs,
// and upserts sittings.
// URL: https://www.courtofappeal.gov.jm/content/cause-and-hearing-lists
//
// Mirrors court_lists.rs but targets the Court of Appeal website.
// PDFs are served from the no-www origin (courtofappeal.gov.jm).
// On any HTTP or network error the run() function logs a warning and returns Ok(0) —
// the CoA court-lists page may not always be available.
use chrono::NaiveDate;
use sqlx::PgPool;
use std::path::Path;
use tracing::{info, warn};

use super::{
    court_lists::{
        date_from_text, date_from_url, extract_pdf_links, extract_text_safe, normalize_ocr_text,
        sanitize_filename,
    },
    pdf as pdf_parser,
    ScraperState,
};
use crate::{db::queries, utils::pdf as pdf_utils};

const COURT_LISTS_URL: &str =
    "https://www.courtofappeal.gov.jm/content/cause-and-hearing-lists";
/// PDFs are served from the no-www origin; relative links must use this base.
const BASE_URL: &str = "https://courtofappeal.gov.jm";
const COURT_DIVISION: &str = "Court of Appeal";

pub async fn run(
    pool: &PgPool,
    state: &mut ScraperState,
    client: &reqwest::Client,
    pdf_dir: &str,
) -> anyhow::Result<usize> {
    info!("[CoA Hearings] Fetching court lists index: {COURT_LISTS_URL}");

    let html = match client.get(COURT_LISTS_URL).send().await {
        Ok(r) if r.status().is_success() => match r.text().await {
            Ok(t) => t,
            Err(e) => {
                warn!("[CoA Hearings] Failed to read court-lists response body: {e} — skipping");
                return Ok(0);
            }
        },
        Ok(r) => {
            warn!(
                "[CoA Hearings] Court-lists page returned status {} — skipping",
                r.status()
            );
            return Ok(0);
        }
        Err(e) => {
            warn!("[CoA Hearings] Network error fetching court-lists page: {e} — skipping");
            return Ok(0);
        }
    };

    let pdf_links = extract_pdf_links(&html);
    let link_count = pdf_links.len();

    if link_count == 0 {
        warn!(
            "[CoA Hearings] No PDF links found on court-lists page ({COURT_LISTS_URL}). \
             The page may have changed structure or be temporarily empty."
        );
        return Ok(0);
    }
    info!("[CoA Hearings] Found {link_count} PDF links on court-lists page");

    let mut total_new_sittings: usize = 0;
    let mut processed_count: usize = 0;
    let mut skipped_count: usize = 0;

    for link in pdf_links {
        let absolute_url = if link.starts_with("http") {
            link.clone()
        } else {
            format!("{BASE_URL}{link}")
        };

        if state.appeal_pdf_already_processed(&absolute_url) {
            info!("[CoA Hearings] Skipping already-processed PDF: {absolute_url}");
            skipped_count += 1;
            continue;
        }

        match process_one_pdf(pool, client, pdf_dir, &absolute_url).await {
            Ok(inserted) => {
                processed_count += 1;
                if inserted > 0 {
                    total_new_sittings += inserted;
                    state.mark_appeal_pdf_processed(absolute_url);
                } else {
                    info!(
                        "[CoA Hearings] 0 new sittings from {absolute_url} — not marking as processed"
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

async fn process_one_pdf(
    pool: &PgPool,
    client: &reqwest::Client,
    pdf_dir: &str,
    absolute_url: &str,
) -> anyhow::Result<usize> {
    let filename = sanitize_filename(absolute_url);
    info!("[CoA Hearings] Downloading: {filename}");

    let bytes = pdf_utils::download_pdf(client, absolute_url).await?;

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

        if let (Some(ref cn), Some(event_date), Some(ref et)) =
            (&entry.case_number, entry.event_date, &entry.event_type)
        {
            match queries::sitting_exists(pool, cn, event_date, et).await {
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
            Ok(_) => inserted += 1,
            Err(e) => warn!("[CoA Hearings] Failed to upsert sitting: {e}"),
        }
    }

    info!(
        "[CoA Hearings] {filename}: {entry_count} entries parsed, {inserted} new sittings upserted"
    );

    Ok(inserted)
}
