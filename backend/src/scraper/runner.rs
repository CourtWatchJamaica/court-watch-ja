/// Scheduler — runs scrapers on Mon / Wed / Fri at 06:00 UTC.
/// Judgment + court-list scrapers: Mon, Wed, Fri.
/// Judges scraper: Monday only (once per week is sufficient).
use chrono::{Duration, Utc};
use sqlx::PgPool;
use std::sync::Arc;
use tokio_cron_scheduler::{Job, JobScheduler};
use tracing::{error, info};

use super::{court_lists, judgments, judges, ScraperState};
use crate::{config::Config, db::queries};

pub async fn start(pool: PgPool, config: Arc<Config>) -> anyhow::Result<()> {
    let sched = JobScheduler::new().await?;

    // ── Mon / Wed / Fri at 06:00 UTC ──────────────────────────────────────
    {
        let pool = pool.clone();
        let config = config.clone();

        let job = Job::new_async("0 0 6 * * Mon,Wed,Fri", move |_uuid, _lock| {
            let pool = pool.clone();
            let config = config.clone();
            Box::pin(async move {
                info!("=== Scheduled scrape starting ===");
                if let Err(e) = run_all(&pool, &config).await {
                    error!("Scraper run failed: {e}");
                }
            })
        })?;

        sched.add(job).await?;
    }

    sched.start().await?;
    info!("Cron scheduler started — judgments+courts scraped Mon/Wed/Fri 06:00 UTC, judges Mon 06:00 UTC");
    Ok(())
}

/// Called once at startup, before the cron scheduler activates.
///
/// Checks whether either the `judgments` or `court_sittings` table is stale
/// (empty, or most-recent date > 7 days ago) and immediately runs the
/// relevant scraper(s) if so.  If both tables are current, this is a no-op.
pub async fn run_catchup_check(pool: &PgPool, config: &Config) -> anyhow::Result<()> {
    let today = Utc::now().date_naive();
    let stale_threshold = Duration::days(7);

    // Query both tables — treat DB errors as "stale" so we always retry safely.
    let judgment_date = queries::most_recent_judgment_date(pool).await.ok().flatten();
    let sitting_date  = queries::most_recent_sitting_date(pool).await.ok().flatten();

    let judgments_stale = judgment_date
        .map(|d| today - d > stale_threshold)
        .unwrap_or(true); // None → table empty

    let sittings_stale = sitting_date
        .map(|d| today - d > stale_threshold)
        .unwrap_or(true);

    if !judgments_stale && !sittings_stale {
        info!(
            "Catch-up check: judgments current ({:?}), sittings current ({:?}). Skipping.",
            judgment_date, sitting_date
        );
        return Ok(());
    }

    info!(
        "Catch-up check triggered — judgments_stale={judgments_stale} (last={judgment_date:?}), \
         sittings_stale={sittings_stale} (last={sitting_date:?})"
    );

    let client    = super::http_client()?;
    let mut state = ScraperState::load(&config.scraper_state_path).await;

    if judgments_stale {
        info!("Catch-up: running judgment scraper from page {}", state.next_judgment_page);
        if let Err(e) = judgments::run(pool, &mut state, config.judgment_cutoff_date, &client).await {
            error!("Catch-up judgment scraper error: {e}");
        }
        state.save(&config.scraper_state_path).await.ok();

        if let Err(e) = download_pending_pdfs(pool, config, &client).await {
            error!("Catch-up PDF download error: {e}");
        }
    }

    if sittings_stale {
        info!("Catch-up: running court-lists scraper");
        if let Err(e) = court_lists::run(pool, &mut state, &client, &config.pdf_dir).await {
            error!("Catch-up court-lists scraper error: {e}");
        }
        state.save(&config.scraper_state_path).await.ok();
    }

    info!("Catch-up check complete.");
    Ok(())
}

/// One complete scraper run (all three scrapers).
pub async fn run_all(pool: &PgPool, config: &Config) -> anyhow::Result<()> {
    let client = super::http_client()?;

    let mut state = ScraperState::load(&config.scraper_state_path).await;

    // 1. Judgment listing scraper
    info!("-- Starting judgment scraper (page {})", state.next_judgment_page);
    if let Err(e) = judgments::run(pool, &mut state, config.judgment_cutoff_date, &client).await {
        error!("Judgment scraper error: {e}");
    }
    state.save(&config.scraper_state_path).await.ok();

    // 2. PDF download for judgments that have a pdf_url but no local copy
    if let Err(e) = download_pending_pdfs(pool, config, &client).await {
        error!("PDF download step error: {e}");
    }

    // 3. Court lists (PDFs)
    info!("-- Starting court-lists scraper");
    if let Err(e) =
        court_lists::run(pool, &mut state, &client, &config.pdf_dir).await
    {
        error!("Court-lists scraper error: {e}");
    }
    state.save(&config.scraper_state_path).await.ok();

    // 4. Judges list — only if we haven't scraped in the last 6 days
    let should_scrape_judges = state
        .last_judges_scraped_at
        .map(|t| Utc::now() - t > Duration::days(6))
        .unwrap_or(true);

    if should_scrape_judges {
        info!("-- Starting judges scraper");
        if let Err(e) = judges::run(pool, &client).await {
            error!("Judges scraper error: {e}");
        } else {
            state.last_judges_scraped_at = Some(Utc::now());
            state.save(&config.scraper_state_path).await.ok();
        }
    }

    info!("=== Scheduled scrape complete ===");
    Ok(())
}

async fn download_pending_pdfs(
    pool: &PgPool,
    config: &Config,
    client: &reqwest::Client,
) -> anyhow::Result<()> {
    use crate::{db::queries, utils::pdf as pdf_utils};
    use std::path::Path;

    let pending = queries::judgments_needing_pdf(pool).await?;
    info!("Downloading PDFs for {} judgments", pending.len());

    for judgment in pending {
        let Some(pdf_url) = &judgment.pdf_url else { continue };

        let full_url = if pdf_url.starts_with("http") {
            pdf_url.clone()
        } else {
            format!("https://supremecourt.gov.jm{pdf_url}")
        };

        let filename = format!("{}.pdf", judgment.case_number.replace('/', "_"));
        let dest = Path::new(&config.pdf_dir).join(&filename);

        tokio::fs::create_dir_all(&config.pdf_dir).await.ok();

        match pdf_utils::download_pdf(client, &full_url).await {
            Ok(bytes) => {
                if let Err(e) = tokio::fs::write(&dest, &bytes).await {
                    error!("Failed to write PDF {}: {e}", dest.display());
                    continue;
                }
                let path_str = dest.to_string_lossy().to_string();
                if let Err(e) = queries::set_local_pdf_path(pool, judgment.id, &path_str).await {
                    error!("Failed to update local_pdf_path for {}: {e}", judgment.id);
                } else {
                    info!("Saved PDF: {path_str}");
                }
            }
            Err(e) => error!("Failed to download PDF for {}: {e}", judgment.case_number),
        }

        tokio::time::sleep(std::time::Duration::from_secs(3)).await;
    }

    Ok(())
}
