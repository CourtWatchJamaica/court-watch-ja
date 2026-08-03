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
    // The unfiltered listing is newest-first (new judgments are prepended at
    // page 0), so a page cursor that only ever advances forward eventually
    // walks past the site's shallow "recent" window and finds nothing but
    // empty pages forever after — it can never see new judgments again, since
    // those appear at the front, not the tail. Always restart from page 0;
    // the cutoff-date stop below and the already-known-row skip inside the
    // loop keep each run's work bounded to what's actually new.
    state.next_judgment_page = 0;
    let start_page = 0;
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

            // Skip judgments already fully captured (row exists with a pdf_url) —
            // restarting at page 0 every run means the same front pages are
            // walked repeatedly, so this keeps runs fast instead of re-fetching
            // every detail page every time.
            let already_have: Option<(Option<String>,)> = sqlx::query_as(
                "SELECT pdf_url FROM judgments WHERE case_number = $1",
            )
            .bind(&row.case_number)
            .fetch_optional(pool)
            .await?;
            if matches!(already_have, Some((Some(_),))) {
                continue;
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

/// Drupal taxonomy term id for each judgment year on the live site's
/// exposed filter (`?tid=N`).  Extracted from /content/judgments 2026-07-27.
/// The unfiltered listing only shows the most recent ~9 pages, so the year
/// filter is the only way to reach the historical archive (back to 1962).
const YEAR_TIDS: &[(i32, u32)] = &[
    (1962, 149), (1963, 148), (1964, 147), (1965, 146), (1966, 145),
    (1967, 144), (1968, 143), (1969, 142), (1970, 141), (1971, 140),
    (1972, 139), (1973, 138), (1974, 137), (1975, 136), (1976, 135),
    (1977, 134), (1978, 133), (1979, 132), (1980, 131), (1981, 130),
    (1982, 129), (1983, 128), (1984, 127), (1985, 126), (1986, 125),
    (1987, 124), (1988, 123), (1989, 100), (1990, 99), (1991, 98),
    (1992, 97), (1993, 96), (1994, 95), (1995, 94), (1996, 93),
    (1997, 92), (1998, 91), (1999, 90), (2000, 1), (2001, 2),
    (2002, 3), (2003, 4), (2004, 5), (2005, 6), (2006, 7),
    (2007, 8), (2008, 9), (2009, 10), (2010, 11), (2011, 12),
    (2012, 13), (2013, 14), (2014, 15), (2015, 16), (2016, 17),
    (2017, 18), (2018, 19), (2019, 20), (2020, 21), (2021, 190),
    (2022, 235), (2023, 264), (2024, 269), (2025, 279), (2026, 280),
];

/// One-off archive backfill: walks the year-filtered judgments listing
/// (`?tid=<year term>&page=N`) for every year in `[start_year, end_year]`,
/// ingesting rows through the same detail-fetch + upsert path as `run`.
/// Judgments already in the DB with a pdf_url are skipped without hitting
/// the detail page, so re-runs are cheap and resumable.
///
/// Returns (rows_upserted, rows_skipped).
pub async fn backfill_year_archive(
    pool: &PgPool,
    client: &reqwest::Client,
    start_year: i32,
    end_year: i32,
) -> anyhow::Result<(usize, usize)> {
    let mut upserted = 0usize;
    let mut skipped = 0usize;

    for &(year, tid) in YEAR_TIDS {
        if year < start_year || year > end_year {
            continue;
        }
        let mut page = 0u32;
        loop {
            let url = format!("{LISTING_URL}?tid={tid}&page={page}");
            info!("[Judgment backfill] {year} page {page}: {url}");

            let html = match client.get(&url).send().await {
                Ok(r) if r.status().is_success() => r.text().await?,
                Ok(r) => {
                    warn!("[Judgment backfill] {year} page {page} returned {}; moving to next year", r.status());
                    break;
                }
                Err(e) => {
                    warn!("[Judgment backfill] {year} page {page} request error: {e}; retrying once in 30s");
                    sleep(Duration::from_secs(30)).await;
                    match client.get(&url).send().await {
                        Ok(r) if r.status().is_success() => r.text().await?,
                        _ => {
                            warn!("[Judgment backfill] {year} page {page} failed twice; moving to next year");
                            break;
                        }
                    }
                }
            };

            let rows = parse_listing_page(&html);
            if rows.is_empty() {
                break;
            }

            for row in rows {
                let have: Option<(Option<String>,)> = sqlx::query_as(
                    "SELECT pdf_url FROM judgments WHERE case_number = $1",
                )
                .bind(&row.case_number)
                .fetch_optional(pool)
                .await?;
                if matches!(have, Some((Some(_),))) {
                    skipped += 1;
                    continue;
                }

                let source_url = row.detail_url.as_ref().map(|d| {
                    if d.starts_with("http") {
                        d.clone()
                    } else {
                        format!("{BASE_URL}{d}")
                    }
                });

                let (pdf_url, summary, detail_judge) = if let Some(ref full_url) = source_url {
                    sleep(Duration::from_secs(3)).await;
                    match judgment_detail::fetch(client, full_url, &row.case_number).await {
                        Ok(detail) => (detail.pdf_url, detail.summary_text, detail.judge_name),
                        Err(e) => {
                            warn!("[Judgment backfill] Detail fetch failed for {} ({full_url}): {e}", row.case_number);
                            (None, None, None)
                        }
                    }
                } else {
                    warn!("[Judgment backfill] {} has no detail URL; upserting metadata only", row.case_number);
                    (None, None, None)
                };

                let judge_name = row.judge_name.clone().or(detail_judge);
                if let Some(ref j) = judge_name {
                    if let Err(e) = queries::upsert_judge(pool, j, Some("Supreme Court")).await {
                        warn!("[Judgment backfill] Failed to upsert judge {j}: {e}");
                    }
                }

                let judgment_tags = tags::detect_tags(row.title.as_deref(), summary.as_deref());
                match queries::upsert_judgment(
                    pool,
                    &row.case_number,
                    row.title.as_deref(),
                    judge_name.as_deref(),
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
                    Ok(_) => {
                        upserted += 1;
                        info!("[Judgment backfill] Upserted {} ({year})", row.case_number);
                    }
                    Err(e) => warn!("[Judgment backfill] Failed to upsert {}: {e}", row.case_number),
                }
            }

            page += 1;
            sleep(Duration::from_secs(2)).await;
        }
        info!("[Judgment backfill] Year {year} done ({upserted} upserted, {skipped} skipped so far)");
    }

    Ok((upserted, skipped))
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
