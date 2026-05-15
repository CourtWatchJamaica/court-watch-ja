/// Scrapes the Supreme Court of Jamaica judgments listing pages.
///
/// URL pattern: https://supremecourt.gov.jm/content/judgments?page=N
/// Table columns: Case Number | Title | Presiding Judge | Date
///
/// Rules:
///   - Stop if a judgment date is before `cutoff_date`.
///   - Scrape at most `max_pages` listing pages per run.
///   - 2-second delay between listing pages.
///   - 3-second delay between detail page requests.
use chrono::NaiveDate;
use scraper::{Html, Selector};
use sqlx::PgPool;
use std::time::Duration;
use tokio::time::sleep;
use tracing::{info, warn};

use super::{judgment_detail, tags, ScraperState};
use crate::db::queries;

const BASE_URL: &str = "https://supremecourt.gov.jm";
const LISTING_URL: &str = "https://supremecourt.gov.jm/content/judgments";
const MAX_PAGES_PER_RUN: u32 = 100;

#[derive(Debug)]
pub struct JudgmentRow {
    pub case_number: String,
    pub title: Option<String>,
    pub judge_name: Option<String>,
    pub date: Option<NaiveDate>,
    pub detail_url: Option<String>,
}

pub async fn run(
    pool: &PgPool,
    state: &mut ScraperState,
    cutoff: NaiveDate,
    client: &reqwest::Client,
) -> anyhow::Result<()> {
    let start_page = state.next_judgment_page;
    let end_page = start_page + MAX_PAGES_PER_RUN;

    for page in start_page..end_page {
        let url = format!("{LISTING_URL}?page={page}");
        info!("Judgments listing page {page}: {url}");

        let html = match client.get(&url).send().await {
            Ok(r) if r.status().is_success() => r.text().await?,
            Ok(r) => {
                warn!("Listing page {page} returned status {}", r.status());
                state.next_judgment_page = page + 1;
                break;
            }
            Err(e) => {
                warn!("Request error on page {page}: {e}");
                break;
            }
        };

        let rows = parse_listing_page(&html);
        if rows.is_empty() {
            info!("No rows found on page {page} — stopping.");
            state.next_judgment_page = page + 1;
            break;
        }

        let mut hit_cutoff = false;

        for row in rows {
            // Stop if date is before cutoff
            if let Some(d) = row.date {
                if d < cutoff {
                    info!("Hit cutoff date ({d} < {cutoff}). Stopping scraper.");
                    hit_cutoff = true;
                    break;
                }
            }

            // Resolve detail URL to an absolute source URL; warn if missing.
            let source_url = match row.detail_url.as_ref() {
                Some(d) => {
                    let full = if d.starts_with("http") {
                        d.clone()
                    } else {
                        format!("{BASE_URL}{d}")
                    };
                    info!(
                        "SC listing pg {page} — {} → detail: {full}",
                        row.case_number
                    );
                    Some(full)
                }
                None => {
                    warn!(
                        "SC listing pg {page} — {} has no detail URL (title cell had no link); skipping PDF fetch",
                        row.case_number
                    );
                    None
                }
            };

            // Fetch the detail page independently for each judgment row.
            let (pdf_url, summary) = if let Some(ref full_url) = source_url {
                sleep(Duration::from_secs(3)).await;

                match judgment_detail::fetch(client, full_url, &row.case_number).await {
                    Ok(detail) => {
                        if detail.pdf_url.is_none() {
                            warn!(
                                "SC {} — detail page returned no PDF URL ({})",
                                row.case_number, full_url
                            );
                        }
                        (detail.pdf_url, detail.summary_text)
                    }
                    Err(e) => {
                        warn!("Detail fetch failed for {} ({}): {e}", row.case_number, full_url);
                        (None, None)
                    }
                }
            } else {
                (None, None)
            };

            // Upsert judge
            if let Some(judge_name) = &row.judge_name {
                if let Err(e) =
                    queries::upsert_judge(pool, judge_name, Some("Supreme Court")).await
                {
                    warn!("Failed to upsert judge {judge_name}: {e}");
                }
            }

            // Upsert judgment
            let judgment_tags = tags::detect_tags(row.title.as_deref(), summary.as_deref());
            if let Err(e) = queries::upsert_judgment(
                pool,
                &row.case_number,
                row.title.as_deref(),
                row.judge_name.as_deref(),
                Some("Supreme Court"),
                row.date,
                pdf_url.as_deref(),
                None,
                summary.as_deref(),
                source_url.as_deref(),
                judgment_tags,
            )
            .await
            {
                warn!("Failed to upsert judgment {}: {e}", row.case_number);
            } else {
                info!("Upserted judgment: {}", row.case_number);
            }
        }

        state.next_judgment_page = page + 1;

        if hit_cutoff {
            break;
        }

        // Polite delay between listing pages
        sleep(Duration::from_secs(2)).await;
    }

    Ok(())
}

/// Parse the judgments table from an HTML listing page.
pub fn parse_listing_page(html: &str) -> Vec<JudgmentRow> {
    let doc = Html::parse_document(html);

    // Try common Drupal Views table selectors
    let row_sel = Selector::parse("table tbody tr, .view-content .views-row").unwrap();
    let td_sel = Selector::parse("td").unwrap();
    let a_sel = Selector::parse("a").unwrap();

    let mut rows = Vec::new();

    for tr in doc.select(&row_sel) {
        let cells: Vec<_> = tr.select(&td_sel).collect();

        // Expect at least 3 cells: case_number, title, judge, [date]
        if cells.len() < 3 {
            continue;
        }

        let case_number = cells[0].text().collect::<String>().trim().to_string();
        if case_number.is_empty() {
            continue;
        }

        // Title cell may contain a link to the detail page
        let title_cell = &cells[1];
        let title = title_cell.text().collect::<String>().trim().to_string();
        let detail_url = title_cell
            .select(&a_sel)
            .next()
            .and_then(|a| a.value().attr("href").map(str::to_string));

        let judge_name = cells
            .get(2)
            .map(|c| c.text().collect::<String>().trim().to_string())
            .filter(|s| !s.is_empty());

        let date = cells.get(3).and_then(|c| {
            let s = c.text().collect::<String>();
            parse_date(s.trim())
        });

        rows.push(JudgmentRow {
            case_number,
            title: if title.is_empty() { None } else { Some(title) },
            judge_name,
            date,
            detail_url,
        });
    }

    rows
}

pub fn parse_date(s: &str) -> Option<NaiveDate> {
    // Try common formats used by Jamaican courts
    for fmt in &["%d/%m/%Y", "%Y-%m-%d", "%B %d, %Y", "%d %B %Y", "%d-%m-%Y"] {
        if let Ok(d) = NaiveDate::parse_from_str(s, fmt) {
            return Some(d);
        }
    }
    None
}
