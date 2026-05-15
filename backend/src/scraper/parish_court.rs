/// Scrapes the Parish Court of Jamaica judgments listing pages.
///
/// URL pattern: https://parishcourt.gov.jm/content/judgments?page=N
/// Graceful no-op if the site is unavailable.
///
/// Rules:
///   - Stop if a judgment date is before `cutoff_date`.
///   - Scrape at most MAX_PAGES_PER_RUN listing pages per run.
///   - 2-second delay between listing pages.
///   - 3-second delay between detail page requests.
///   - Stops on MAX_CONSECUTIVE_EMPTY consecutive zero-row pages and rolls back the
///     page counter to the first empty page so the next run retries it.
use chrono::NaiveDate;
use sqlx::PgPool;
use std::time::Duration;
use tokio::time::sleep;
use tracing::{info, warn};

use super::{judgment_detail, judgments, ScraperState};
use crate::db::queries;

const BASE_URL: &str = "https://parishcourt.gov.jm";
const LISTING_URL: &str = "https://parishcourt.gov.jm/content/judgments";
const COURT_NAME: &str = "Parish Court";
const MAX_PAGES_PER_RUN: u32 = 100;
/// Stop after this many back-to-back zero-row pages and roll back the page counter.
const MAX_CONSECUTIVE_EMPTY: u32 = 2;

pub async fn run(
    pool: &PgPool,
    state: &mut ScraperState,
    cutoff: NaiveDate,
    client: &reqwest::Client,
) -> anyhow::Result<()> {
    let start_page = state.next_parish_page;
    let end_page = start_page + MAX_PAGES_PER_RUN;

    info!("[Parish] Starting judgment scraper from page {start_page}");

    let mut total_upserted: usize = 0;
    let mut consecutive_empty: u32 = 0;
    let mut empty_streak_start: Option<u32> = None;

    for page in start_page..end_page {
        let url = format!("{LISTING_URL}?page={page}");
        info!("[Parish] fetching listing page {page}: {url}");

        let html = match client.get(&url).send().await {
            Ok(r) if r.status().is_success() => match r.text().await {
                Ok(t) => t,
                Err(e) => {
                    warn!("[Parish] failed to read page {page} body: {e}");
                    state.next_parish_page = page + 1;
                    break;
                }
            },
            Ok(r) => {
                warn!(
                    "[Parish] listing page unavailable — skipping (status {})",
                    r.status()
                );
                return Ok(());
            }
            Err(e) => {
                warn!("[Parish] listing page unavailable — skipping ({e})");
                return Ok(());
            }
        };

        let rows = judgments::parse_listing_page(&html);
        let page_count = rows.len();

        // ── Zero-row page handling ────────────────────────────────────────
        if page_count == 0 {
            consecutive_empty += 1;
            if empty_streak_start.is_none() {
                empty_streak_start = Some(page);
            }
            warn!(
                "[Parish] page {page} returned 0 cases (url: {url}) — \
                 consecutive empty count: {consecutive_empty}"
            );

            if consecutive_empty >= MAX_CONSECUTIVE_EMPTY {
                let resume = empty_streak_start.unwrap_or(page);
                warn!(
                    "[Parish] {consecutive_empty} consecutive empty pages ending at page {page}. \
                     Stopping. Next run will resume from page {resume}."
                );
                state.next_parish_page = resume;
                break;
            }

            // Single empty page — advance and retry next page.
            state.next_parish_page = page + 1;
            sleep(Duration::from_secs(2)).await;
            continue;
        }

        // ── Non-empty page ────────────────────────────────────────────────
        if consecutive_empty > 0 {
            info!(
                "[Parish] page {page}: {page_count} cases found \
                 (recovering after {consecutive_empty} empty page(s))"
            );
        } else {
            info!("[Parish] page {page}: {page_count} cases found");
        }
        consecutive_empty = 0;
        empty_streak_start = None;

        let mut hit_cutoff = false;
        let mut page_upserted: usize = 0;

        for row in rows {
            // Stop if date is before cutoff
            if let Some(d) = row.date {
                if d < cutoff {
                    info!(
                        "[Parish] hit cutoff date ({d} < {cutoff}) on page {page}. Stopping."
                    );
                    hit_cutoff = true;
                    break;
                }
            }

            // Resolve detail URL to an absolute source URL
            let source_url = row.detail_url.as_ref().map(|d| {
                if d.starts_with("http") { d.clone() } else { format!("{BASE_URL}{d}") }
            });

            // Fetch detail page (if we have a URL)
            let (pdf_url, summary) = if let Some(ref full_url) = source_url {
                sleep(Duration::from_secs(3)).await;

                match judgment_detail::fetch(client, full_url, &row.case_number).await {
                    Ok(detail) => (detail.pdf_url, detail.summary_text),
                    Err(e) => {
                        warn!("[Parish] detail fetch failed for {}: {e}", row.case_number);
                        (None, None)
                    }
                }
            } else {
                (None, None)
            };

            // Resolve relative PDF URLs to absolute
            let pdf_url = pdf_url.map(|url| {
                if url.starts_with("http") {
                    url
                } else {
                    format!("{BASE_URL}{url}")
                }
            });

            // Upsert judge
            if let Some(judge_name) = &row.judge_name {
                if let Err(e) =
                    queries::upsert_judge(pool, judge_name, Some(COURT_NAME)).await
                {
                    warn!("[Parish] failed to upsert judge {judge_name}: {e}");
                }
            }

            // Upsert judgment
            match queries::upsert_judgment(
                pool,
                &row.case_number,
                row.title.as_deref(),
                row.judge_name.as_deref(),
                Some(COURT_NAME),
                row.date,
                pdf_url.as_deref(),
                None,
                summary.as_deref(),
                source_url.as_deref(),
                vec![],
            )
            .await
            {
                Ok(_) => {
                    page_upserted += 1;
                    info!("[Parish] upserted judgment: {}", row.case_number);
                }
                Err(e) => {
                    warn!("[Parish] failed to upsert {}: {e}", row.case_number);
                }
            }
        }

        total_upserted += page_upserted;
        info!(
            "[Parish] page {page} done — {page_upserted} upserted \
             (running total: {total_upserted})"
        );

        state.next_parish_page = page + 1;

        if hit_cutoff {
            break;
        }

        // Polite delay between listing pages
        sleep(Duration::from_secs(2)).await;
    }

    info!(
        "[Parish] Run complete — pages scanned: {}, total upserted: {total_upserted}",
        state.next_parish_page.saturating_sub(start_page)
    );
    Ok(())
}
