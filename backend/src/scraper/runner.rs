/// Scheduler — runs scrapers on Mon / Wed / Fri at 06:00 UTC.
/// Judgment + court-list scrapers: Mon, Wed, Fri.
/// Judges scraper: Monday only (once per week is sufficient).
use chrono::{Duration, NaiveDate, Utc};
use sqlx::PgPool;
use std::sync::Arc;
use tokio_cron_scheduler::{Job, JobScheduler};
use tracing::{error, info, warn};

use super::{
    appeal_court, appeal_court_lists, court_lists, judges, judgments, parish_court,
    parish_court_judges, ScraperState, MAX_PDF_FAILURES,
};
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

    // ── Daily RSS news feed at 08:00 UTC ─────────────────────────────────
    {
        let pool = pool.clone();
        let job = Job::new_async("0 0 8 * * *", move |_uuid, _lock| {
            let pool = pool.clone();
            Box::pin(async move {
                info!("[News] Daily RSS scrape starting");
                if let Err(e) = super::news::run(&pool).await {
                    error!("[News] RSS scrape failed: {e}");
                }
            })
        })?;
        sched.add(job).await?;
    }

    sched.start().await?;
    info!("Cron scheduler started — judgments+courts scraped Mon/Wed/Fri 06:00 UTC, news daily 08:00 UTC");
    Ok(())
}

/// Called once at startup, before the cron scheduler activates.
///
/// Checks whether any of the judgment or court_sittings tables are stale
/// (empty, or most-recent date > 7 days ago) and immediately runs the
/// relevant scraper(s) if so.  If all tables are current, this is a no-op.
pub async fn run_catchup_check(pool: &PgPool, config: &Config) -> anyhow::Result<()> {
    let today = Utc::now().date_naive();
    let stale_threshold = Duration::days(7);
    // Judges scrapers and CoA backfill are throttled: at most once per 12 h in catchup.
    // This prevents a boot-loop when a scraper produces 0 valid results (e.g. the
    // Parish Court protocol page has no judge names after cleanup).
    let throttle = Duration::hours(12);

    // ── Load ScraperState early — needed for throttle checks ─────────────────
    let mut state = ScraperState::load(&config.scraper_state_path).await;

    // ── Stale court-list PDF eviction ────────────────────────────────────────
    // Returns (sc_cleared, coa_cleared) — non-zero values force the corresponding
    // court-lists scraper to run even if the staleness date check says it's current.
    let (sc_evicted, coa_evicted) = evict_stale_court_list_pdfs(pool, &mut state).await;
    if sc_evicted + coa_evicted > 0 {
        state.save(&config.scraper_state_path).await.ok();
    }

    // ── Supreme Court judgments ──────────────────────────────────────────────
    let sc_judgment_date = queries::most_recent_judgment_date_by_court(pool, "Supreme Court")
        .await
        .ok()
        .flatten();
    let sc_judgments_stale = sc_judgment_date
        .map(|d| today - d > stale_threshold)
        .unwrap_or(true);

    // ── Court of Appeal judgments ────────────────────────────────────────────
    let coa_judgment_date = queries::most_recent_judgment_date_by_court(pool, "Court of Appeal")
        .await
        .ok()
        .flatten();
    let coa_judgments_stale = coa_judgment_date
        .map(|d| today - d > stale_threshold)
        .unwrap_or(true);

    // ── Parish Court judgments ───────────────────────────────────────────────
    let parish_judgment_date = queries::most_recent_judgment_date_by_court(pool, "Parish Court")
        .await
        .ok()
        .flatten();
    let parish_judgments_stale = parish_judgment_date
        .map(|d| today - d > stale_threshold)
        .unwrap_or(true);

    // ── Supreme Court sittings ───────────────────────────────────────────────
    let sc_sitting_date = queries::most_recent_sitting_date(pool).await.ok().flatten();
    // Force re-run if eviction cleared URLs above, or if any expected SC division
    // is still missing — bypasses the stale-date check so scrapers can never be
    // gated out while a division has zero rows.
    let criminal_count = queries::count_sittings_by_division(pool, "Criminal")
        .await
        .ok()
        .unwrap_or(0);
    let sc_division_missing = criminal_count == 0;
    if sc_division_missing {
        info!("Forcing SC scraper — Criminal division still empty");
    }
    let sc_sittings_stale = sc_sitting_date
        .map(|d| today - d > stale_threshold)
        .unwrap_or(true)
        || sc_evicted > 0
        || sc_division_missing;

    // ── Court of Appeal sittings ─────────────────────────────────────────────
    let coa_sitting_date = queries::most_recent_sitting_date_by_court(pool, "Court of Appeal")
        .await
        .ok()
        .flatten();
    // Force re-run if CoA has no sittings at all — the date check can pass
    // when Civil rows exist (stored under the wrong division) while the CoA
    // scraper has never successfully populated 'Court of Appeal' rows.
    let coa_total = queries::count_sittings_for_court(pool, "Court of Appeal")
        .await
        .ok()
        .unwrap_or(0);
    let coa_empty = coa_total == 0;
    if coa_empty {
        info!("Forcing CoA scraper — no Court of Appeal sittings yet");
    }
    let coa_sittings_stale = coa_sitting_date
        .map(|d| today - d > stale_threshold)
        .unwrap_or(true)
        || coa_evicted > 0
        || coa_empty;

    // ── Parish Court sittings ────────────────────────────────────────────────
    let parish_sitting_date = queries::most_recent_sitting_date_by_court(pool, "Parish Court")
        .await
        .ok()
        .flatten();
    let parish_sittings_stale = parish_sitting_date
        .map(|d| today - d > stale_threshold)
        .unwrap_or(true);

    // ── Parish Court cases — always run when table is empty ─────────────────
    let parish_cases_count: i64 =
        sqlx::query_scalar("SELECT COUNT(*) FROM parish_court_cases")
            .fetch_one(pool)
            .await
            .unwrap_or(0);
    let parish_cases_empty = parish_cases_count == 0;

    // ── Judge-count checks (throttled) ───────────────────────────────────────
    let coa_judge_count: i64 =
        sqlx::query_scalar("SELECT COUNT(*) FROM judges WHERE court = 'Court of Appeal'")
            .fetch_one(pool)
            .await
            .unwrap_or(0);
    // Only trigger if count is 0 AND we haven't attempted recently.
    let coa_judges_missing = coa_judge_count == 0
        && state
            .last_appeal_judges_scraped_at
            .map(|t| Utc::now() - t > throttle)
            .unwrap_or(true);

    // ── CoA judge-name backfill (throttled) ──────────────────────────────────
    // Triggers when CoA judgments have NULL judge_name; re-runs the CoA scraper so
    // the updated judgment_detail extractor can fill them in.  Throttled so a
    // scraper that finds no names doesn't re-run on every boot.
    let coa_null_judge_count: i64 = sqlx::query_scalar(
        "SELECT COUNT(*) FROM judgments WHERE court = 'Court of Appeal' AND judge_name IS NULL",
    )
    .fetch_one(pool)
    .await
    .unwrap_or(0);
    let coa_needs_judge_backfill = coa_null_judge_count > 0
        && state
            .last_coa_judge_backfill_at
            .map(|t| Utc::now() - t > throttle)
            .unwrap_or(true);

    // ── CoA PDF backfill — runs BEFORE the early-return, no throttle ─────────
    // Separate from `coa_needs_judge_backfill`: this only reads already-downloaded
    // local PDFs (no network I/O) so it is safe to run on every startup.
    // The scraper-staleness check may still return early, but we must never skip
    // this when local PDFs exist with missing judge names.
    let coa_pdf_backfill_count: i64 = sqlx::query_scalar(
        "SELECT COUNT(*) FROM judgments
         WHERE court = 'Court of Appeal'
           AND judge_name    IS NULL
           AND local_pdf_path IS NOT NULL",
    )
    .fetch_one(pool)
    .await
    .unwrap_or(0);

    if coa_pdf_backfill_count > 0 {
        info!(
            "[CoA] {} judgment(s) have a local PDF but no judge name — running PDF backfill",
            coa_pdf_backfill_count
        );
        if let Err(e) = backfill_coa_judge_names(pool).await {
            error!("[CoA] PDF backfill error: {e}");
        }
        match queries::seed_judges_from_judgments(pool).await {
            Ok(n) if n > 0 => info!("Judge sync complete ({n} new row(s))"),
            Ok(_) => {}
            Err(e) => warn!("Judge seed failed after CoA PDF backfill: {e}"),
        }
    }

    if !sc_judgments_stale
        && !coa_judgments_stale
        && !parish_judgments_stale
        && !sc_sittings_stale
        && !coa_sittings_stale
        && !parish_sittings_stale
        && !coa_judges_missing
        && !coa_needs_judge_backfill
        && !parish_cases_empty
    {
        info!(
            "Catch-up check: all courts current. \
             SC judgments ({:?}), CoA judgments ({:?}), Parish judgments ({:?}), \
             SC sittings ({:?}), CoA sittings ({:?}), Parish sittings ({:?}).",
            sc_judgment_date,
            coa_judgment_date,
            parish_judgment_date,
            sc_sitting_date,
            coa_sitting_date,
            parish_sitting_date,
        );
        return Ok(());
    }

    info!(
        "Catch-up check triggered — \
         sc_judgments_stale={sc_judgments_stale} (last={sc_judgment_date:?}), \
         coa_judgments_stale={coa_judgments_stale} (last={coa_judgment_date:?}), \
         coa_needs_judge_backfill={coa_needs_judge_backfill} ({coa_null_judge_count} NULL), \
         parish_judgments_stale={parish_judgments_stale} (last={parish_judgment_date:?}), \
         sc_sittings_stale={sc_sittings_stale} (last={sc_sitting_date:?}), \
         coa_sittings_stale={coa_sittings_stale} (last={coa_sitting_date:?}), \
         parish_sittings_stale={parish_sittings_stale} (last={parish_sitting_date:?})\
        "
    );

    let cutoff = load_cutoff_from_db(pool, config).await;
    let client = super::http_client()?;

    if sc_judgments_stale {
        info!(
            "Catch-up: running Supreme Court judgment scraper from page {}",
            state.next_judgment_page
        );
        if let Err(e) = judgments::run(pool, &mut state, cutoff, &client).await {
            error!("Catch-up SC judgment scraper error: {e}");
        }
        state.save(&config.scraper_state_path).await.ok();

        if let Err(e) = download_pending_pdfs(pool, config, &client, &mut state).await {
            error!("Catch-up SC PDF download error: {e}");
        }
        state.save(&config.scraper_state_path).await.ok();
    }

    if coa_judgments_stale || coa_needs_judge_backfill {
        info!(
            "Catch-up: running Court of Appeal judgment scraper \
             (civil pg {}, criminal pg {}, null_judge_backfill={})",
            state.next_appeal_page, state.next_appeal_criminal_page, coa_needs_judge_backfill
        );
        if let Err(e) = appeal_court::run(pool, &mut state, cutoff, &client).await {
            error!("Catch-up CoA judgment scraper error: {e}");
        }
        if coa_needs_judge_backfill {
            state.last_coa_judge_backfill_at = Some(Utc::now());
        }
        state.save(&config.scraper_state_path).await.ok();

        if let Err(e) = download_pending_pdfs(pool, config, &client, &mut state).await {
            error!("Catch-up CoA PDF download error: {e}");
        }
        state.save(&config.scraper_state_path).await.ok();

        // Backfill judge names for CoA PDFs already on disk (including newly downloaded ones).
        if let Err(e) = backfill_coa_judge_names(pool).await {
            error!("Catch-up CoA judge name backfill error: {e}");
        }
        match queries::seed_judges_from_judgments(pool).await {
            Ok(n) if n > 0 => info!("Judge sync complete ({n} new row(s))"),
            Ok(_) => {}
            Err(e) => warn!("Judge seed failed after CoA catch-up backfill: {e}"),
        }
    }

    if parish_judgments_stale {
        info!(
            "Catch-up: running Parish Court judgment scraper from page {}",
            state.next_parish_page
        );
        if let Err(e) = parish_court::run(pool, &mut state, cutoff, &client).await {
            error!("Catch-up Parish judgment scraper error: {e}");
        }
        state.save(&config.scraper_state_path).await.ok();
    }

    if sc_sittings_stale {
        info!("Catch-up: running Supreme Court court-lists scraper");
        if let Err(e) = court_lists::run(pool, &mut state, &client, &config.pdf_dir).await {
            error!("Catch-up SC court-lists scraper error: {e}");
        }
        state.save(&config.scraper_state_path).await.ok();
    }

    if coa_sittings_stale {
        info!("Catch-up: running Court of Appeal court-lists scraper");
        if let Err(e) = appeal_court_lists::run(pool, &mut state, &client, &config.pdf_dir).await {
            error!("Catch-up CoA court-lists scraper error: {e}");
        }
        state.save(&config.scraper_state_path).await.ok();
    }

    if coa_judges_missing {
        info!("Catch-up: Court of Appeal has 0 judges — running CoA judges scraper");
        if let Err(e) = appeal_court::run_judges(pool, &client).await {
            error!("Catch-up CoA judges scraper error: {e}");
        }
        state.last_appeal_judges_scraped_at = Some(Utc::now());
        state.save(&config.scraper_state_path).await.ok();
    }

    if parish_judgments_stale || parish_sittings_stale || parish_cases_empty {
        info!(
            "Catch-up: running Parish Court case scraper \
             (parish_cases_empty={parish_cases_empty})"
        );
        if let Err(e) =
            parish_court_judges::run(pool, &mut state, cutoff, &client, &config.pdf_dir).await
        {
            error!("Catch-up Parish case scraper error: {e}");
        }
        state.save(&config.scraper_state_path).await.ok();
    }

    // Remove any non-judge entries that scrapers may have introduced this run.
    match queries::cleanup_judges_table(pool).await {
        Ok(n) if n > 0 => info!("Judge cleanup: removed {n} non-judge row(s)"),
        Ok(_) => {}
        Err(e) => warn!("Judge cleanup failed: {e}"),
    }

    info!("Catch-up check complete.");
    Ok(())
}

/// One complete scraper run (all scrapers for all courts).
pub async fn run_all(pool: &PgPool, config: &Config) -> anyhow::Result<()> {
    // Read the cutoff date from the DB so admin changes take effect without a restart.
    let cutoff = load_cutoff_from_db(pool, config).await;
    info!("Scraper cutoff date: {cutoff}");

    let client = super::http_client()?;

    let mut state = ScraperState::load(&config.scraper_state_path).await;

    // Log permanently-skipped PDFs so operators can investigate or clear them.
    if !state.pdf_skipped.is_empty() {
        warn!(
            "{} PDF(s) permanently skipped (>{MAX_PDF_FAILURES} failures): {}",
            state.pdf_skipped.len(),
            state.pdf_skipped.join(", ")
        );
    }

    // 1. Supreme Court judgment listing scraper
    info!(
        "-- Starting Supreme Court judgment scraper (page {})",
        state.next_judgment_page
    );
    if let Err(e) = judgments::run(pool, &mut state, cutoff, &client).await {
        error!("SC judgment scraper error: {e}");
    }
    state.save(&config.scraper_state_path).await.ok();

    // 2. PDF download for Supreme Court judgments that have a pdf_url but no local copy
    if let Err(e) = download_pending_pdfs(pool, config, &client, &mut state).await {
        error!("PDF download step error: {e}");
    }
    state.save(&config.scraper_state_path).await.ok();

    // 3. Supreme Court court lists (PDFs)
    // Clear stale processed-URL entries for any PDFs whose DB rows are all 'Civil'
    // or where the Court of Appeal has zero rows (nuclear CoA reset).
    let (sc_evicted, coa_evicted) = evict_stale_court_list_pdfs(pool, &mut state).await;
    if sc_evicted + coa_evicted > 0 {
        info!(
            "  Stale eviction: {sc_evicted} SC + {coa_evicted} CoA URL(s) cleared before court-lists run"
        );
        state.save(&config.scraper_state_path).await.ok();
    }

    info!("-- Starting Supreme Court court-lists scraper");
    if let Err(e) = court_lists::run(pool, &mut state, &client, &config.pdf_dir).await {
        error!("SC court-lists scraper error: {e}");
    }
    state.save(&config.scraper_state_path).await.ok();

    // 4. Supreme Court judges — only if we haven't scraped in the last 6 days
    let should_scrape_sc_judges = state
        .last_judges_scraped_at
        .map(|t| Utc::now() - t > Duration::days(6))
        .unwrap_or(true);

    if should_scrape_sc_judges {
        info!("-- Starting Supreme Court judges scraper");
        if let Err(e) = judges::run(pool, &client).await {
            error!("SC judges scraper error: {e}");
        } else {
            state.last_judges_scraped_at = Some(Utc::now());
            state.save(&config.scraper_state_path).await.ok();
        }
    }

    // 5. Court of Appeal judgment listing scraper (civil + criminal)
    info!(
        "-- Starting Court of Appeal judgment scraper (civil pg {}, criminal pg {})",
        state.next_appeal_page, state.next_appeal_criminal_page
    );
    let (coa_civil, coa_criminal) = match appeal_court::run(pool, &mut state, cutoff, &client).await
    {
        Ok(counts) => counts,
        Err(e) => {
            error!("[CoA] Judgment scraper error: {e}");
            (0, 0)
        }
    };
    state.save(&config.scraper_state_path).await.ok();

    // 6. PDF downloads for Court of Appeal judgments
    if let Err(e) = download_pending_pdfs(pool, config, &client, &mut state).await {
        error!("[CoA] PDF download step error: {e}");
    }
    state.save(&config.scraper_state_path).await.ok();

    // 6b. Backfill judge names for CoA PDFs already on disk
    if let Err(e) = backfill_coa_judge_names(pool).await {
        error!("[CoA] Judge name backfill error: {e}");
    }
    match queries::seed_judges_from_judgments(pool).await {
        Ok(n) if n > 0 => info!("Judge sync complete ({n} new row(s))"),
        Ok(_) => {}
        Err(e) => warn!("Judge seed failed after CoA backfill: {e}"),
    }

    // 7. Court of Appeal court lists (PDFs)
    info!("-- Starting Court of Appeal court-lists scraper");
    let coa_hearings =
        match appeal_court_lists::run(pool, &mut state, &client, &config.pdf_dir).await {
            Ok(n) => n,
            Err(e) => {
                error!("[CoA] Court-lists scraper error: {e}");
                0
            }
        };
    state.save(&config.scraper_state_path).await.ok();

    info!(
        "[CoA] Civil judgments: {coa_civil} | Criminal judgments: {coa_criminal} | \
         Hearing sittings: {coa_hearings}"
    );

    // 8. Court of Appeal judges — only if we haven't scraped in the last 6 days
    let should_scrape_coa_judges = state
        .last_appeal_judges_scraped_at
        .map(|t| Utc::now() - t > Duration::days(6))
        .unwrap_or(true);

    if should_scrape_coa_judges {
        info!("-- Starting Court of Appeal judges scraper");
        if let Err(e) = appeal_court::run_judges(pool, &client).await {
            error!("[CoA] Judges scraper error: {e}");
        } else {
            state.last_appeal_judges_scraped_at = Some(Utc::now());
            state.save(&config.scraper_state_path).await.ok();
        }
    }

    // 9. Parish Court case scraper (replaces defunct parish judges scraper)
    info!("-- Starting Parish Court case scraper");
    if let Err(e) =
        parish_court_judges::run(pool, &mut state, cutoff, &client, &config.pdf_dir).await
    {
        error!("[Parish] Case scraper error: {e}");
    }
    state.save(&config.scraper_state_path).await.ok();

    // 10. Parish Court judgment scraper — graceful no-op if site unavailable
    info!(
        "-- Starting Parish Court judgment scraper (page {})",
        state.next_parish_page
    );
    if let Err(e) = parish_court::run(pool, &mut state, cutoff, &client).await {
        error!("[Parish] Judgment scraper error: {e}");
    }
    state.save(&config.scraper_state_path).await.ok();

    // Remove any non-judge entries introduced by scrapers this run.
    match queries::cleanup_judges_table(pool).await {
        Ok(n) if n > 0 => info!("Judge cleanup: removed {n} non-judge row(s)"),
        Ok(_) => {}
        Err(e) => warn!("Judge cleanup failed: {e}"),
    }

    // Spawn notification check non-blocking — scraper run is considered complete
    // regardless of how long the notification queries take.
    {
        let pool_n = pool.clone();
        tokio::spawn(async move {
            crate::db::queries::check_notifications(&pool_n).await;
        });
    }

    info!("=== Scheduled scrape complete ===");
    Ok(())
}

// ── Helpers ───────────────────────────────────────────────────────────────────

/// Read the judgment cutoff date from `system_config`, falling back to the
/// value baked into `Config` if the DB row is absent or unparseable.
async fn load_cutoff_from_db(pool: &PgPool, config: &Config) -> NaiveDate {
    match queries::get_system_config(pool, "judgment_cutoff_date").await {
        Ok(Some(s)) => {
            NaiveDate::parse_from_str(&s, "%Y-%m-%d").unwrap_or(config.judgment_cutoff_date)
        }
        Ok(None) => {
            warn!("judgment_cutoff_date not found in system_config; using config default");
            config.judgment_cutoff_date
        }
        Err(e) => {
            warn!("Failed to read judgment_cutoff_date from DB: {e}; using config default");
            config.judgment_cutoff_date
        }
    }
}

/// Read already-downloaded CoA PDFs and fill in any missing judge names.
///
/// Pure local I/O — no network requests.  Safe to call on every startup as a
/// fast no-op when all judge names are already populated.
pub async fn backfill_coa_judge_names(pool: &PgPool) -> anyhow::Result<()> {
    use crate::{db::queries, utils::pdf as pdf_utils};

    let pending = queries::coa_judgments_needing_judge_name(pool).await?;
    if pending.is_empty() {
        info!("[CoA] Backfill: no judgments need judge names — skipping");
        return Ok(());
    }
    info!("[CoA] Backfilling judge names for {} judgment(s) with local PDFs", pending.len());

    let mut extracted = 0usize;
    let mut no_text = 0usize;
    let mut no_match = 0usize;

    for judgment in pending {
        let Some(ref path) = judgment.local_pdf_path else { continue };
        let bytes = match tokio::fs::read(path).await {
            Ok(b) => b,
            Err(e) => {
                warn!("[CoA] {} — could not read PDF {path}: {e}", judgment.case_number);
                no_text += 1;
                continue;
            }
        };

        // Try pdftotext first; fall back to OCR.
        let pdftotext = pdf_utils::extract_text_from_bytes(&bytes)
            .ok()
            .filter(|t| !t.trim().is_empty());
        let used_ocr = pdftotext.is_none();
        let text_opt = pdftotext.or_else(|| pdf_utils::extract_text_ocr(&bytes));

        let Some(ref text) = text_opt else {
            warn!(
                "[CoA] {} — no text extracted (method={})",
                judgment.case_number,
                if used_ocr { "ocr(failed)" } else { "pdftotext(failed)" }
            );
            no_text += 1;
            continue;
        };

        let coram = super::judgment_detail::extract_coram_from_text(text);

        if coram.is_none() {
            // Log the first 300 chars so we can diagnose the pattern mismatch.
            let preview: String = text.chars().take(300).collect();
            let preview_clean = preview.replace('\n', "↵").replace('\r', "");
            warn!(
                "[CoA] {} — no judge match (method={}, text[..300]: {})",
                judgment.case_number,
                if used_ocr { "ocr" } else { "pdftotext" },
                preview_clean
            );
            no_match += 1;
            continue;
        }

        let coram = coram.unwrap();
        match queries::set_judgment_judge_name(pool, judgment.id, &coram).await {
            Ok(_) => {
                info!(
                    "[CoA] {} — backfilled '{}' (method={})",
                    judgment.case_number,
                    coram,
                    if used_ocr { "ocr" } else { "pdftotext" }
                );
                extracted += 1;
            }
            Err(e) => {
                error!(
                    "[CoA] {} — failed to write judge_name: {e}",
                    judgment.case_number
                );
            }
        }
    }

    info!(
        "[CoA] Backfill complete — extracted={extracted}, no_text={no_text}, no_match={no_match}"
    );
    Ok(())
}

async fn download_pending_pdfs(
    pool: &PgPool,
    config: &Config,
    client: &reqwest::Client,
    state: &mut ScraperState,
) -> anyhow::Result<()> {
    use crate::{db::queries, utils::pdf as pdf_utils};
    use std::path::Path;

    let pending = queries::judgments_needing_pdf(pool).await?;
    info!("Downloading PDFs for {} judgment(s)", pending.len());

    for judgment in pending {
        let Some(pdf_url) = &judgment.pdf_url else {
            continue;
        };

        let full_url = match judgment.court.as_deref() {
            Some("Court of Appeal") => {
                // Re-normalise every time: rows written before the scraper fix
                // may have the wrong www / /index.php origin stored in the DB.
                super::appeal_court::normalize_coa_pdf_url_for_download(pdf_url)
            }
            _ => {
                let base_url = match judgment.court.as_deref() {
                    Some("Parish Court") => "https://parishcourt.gov.jm",
                    _ => "https://supremecourt.gov.jm",
                };
                if pdf_url.starts_with("http") {
                    pdf_url.clone()
                } else {
                    format!("{base_url}{pdf_url}")
                }
            }
        };

        // Skip PDFs that have permanently failed.
        if state.is_pdf_skipped(&full_url) {
            info!("Skipping permanently-failed PDF: {full_url}");
            continue;
        }

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
                    state.clear_pdf_failure(&full_url);
                }

                // For CoA judgments with no judge name yet, extract CORAM from the PDF text.
                if judgment.court.as_deref() == Some("Court of Appeal")
                    && judgment.judge_name.is_none()
                {
                    let text_opt = pdf_utils::extract_text_from_bytes(&bytes)
                        .ok()
                        .filter(|t| !t.trim().is_empty())
                        .or_else(|| pdf_utils::extract_text_ocr(&bytes));
                    if let Some(coram) = text_opt
                        .as_deref()
                        .and_then(super::judgment_detail::extract_coram_from_text)
                    {
                        match queries::set_judgment_judge_name(pool, judgment.id, &coram).await {
                            Ok(_) => info!("[CoA] Extracted judge from PDF: {coram}"),
                            Err(e) => error!("[CoA] Failed to set judge_name for {}: {e}", judgment.case_number),
                        }
                    }
                }
            }
            Err(e) => {
                let permanently_skipped = state.record_pdf_failure(full_url.clone());
                if permanently_skipped {
                    error!(
                        "PDF permanently skipped after {MAX_PDF_FAILURES} failures: {} ({full_url}) — {e}",
                        judgment.case_number
                    );
                } else {
                    error!(
                        "Failed to download PDF for {} ({full_url}): {e}",
                        judgment.case_number
                    );
                }
            }
        }

        tokio::time::sleep(std::time::Duration::from_secs(3)).await;
    }

    Ok(())
}

/// Checks DB state and clears processed-PDF entries that need re-scraping.
///
/// Three passes for Supreme Court:
/// 1. **Nuclear per-division**: count = 0 → evict every keyword-matching SC URL.
/// 2. **Aggressive Civil sweep**: when *any* SC division is missing, evict every
///    processed SC URL that still has Civil rows — catches PDFs whose filenames
///    contain no division keyword (e.g. a combined cause list named by date only).
/// 3. **All-Civil fallback**: any SC URL where *all* rows are Civil (run always).
///
/// For Court of Appeal: nuclear when count = 0 (regardless of whether the
/// processed list is empty), plus a domain-wide Civil sweep to delete rows from
/// URLs that have already been dropped from the processed list.  When count > 0
/// the per-URL Civil check runs as a secondary sweep.
///
/// `sitting_exists` checks (case_number, event_date, event_type) without a
/// division filter, so stale Civil rows must be deleted *before* eviction or
/// they silently block re-insertion of correctly-divided rows.
///
/// Returns `(sc_cleared, coa_cleared)`.
async fn evict_stale_court_list_pdfs(
    pool: &PgPool,
    state: &mut ScraperState,
) -> (usize, usize) {
    // Expected SC divisions and the filename keywords that identify their PDFs.
    const SC_DIVISIONS: &[(&str, &[&str])] = &[
        ("Criminal",   &["criminal"]),
        ("Gun Court",  &["gun"]),
        ("Commercial", &["commercial"]),
        ("Family",     &["family"]),
    ];

    let mut sc_to_evict: std::collections::HashSet<String> = Default::default();
    let mut any_sc_division_missing = false;

    // ── Pass 1: nuclear per-division ─────────────────────────────────────────
    for (division, keywords) in SC_DIVISIONS {
        let count = match queries::count_sittings_by_division(pool, division).await {
            Ok(n) => n,
            Err(e) => { warn!("Division count check failed for {division}: {e}"); continue; }
        };
        if count > 0 { continue; }

        any_sc_division_missing = true;

        let mut evicted = 0usize;
        for url in state
            .processed_pdf_urls
            .iter()
            .filter(|u| u.contains("supremecourt.gov.jm"))
            .filter(|u| {
                let lower = u.to_lowercase();
                keywords.iter().any(|kw| lower.contains(kw))
            })
            .cloned()
            .collect::<Vec<_>>()
        {
            match queries::delete_civil_sittings_for_url(pool, &url).await {
                Ok(n) => {
                    info!(
                        "  Deleted {n} Civil row(s) from {} (missing: {division})",
                        url.rsplit('/').next().unwrap_or(&url)
                    );
                    sc_to_evict.insert(url);
                    evicted += 1;
                }
                Err(e) => warn!("  Failed to delete Civil rows for {url}: {e}"),
            }
        }
        info!("Eviction: {division} — cleared {evicted} URL(s)");
    }

    // ── Pass 2: aggressive Civil sweep when any division is missing ───────────
    // When a SC division has zero rows, any processed SC URL with Civil rows is a
    // candidate — the PDF may contain that division's entries under the wrong label,
    // even if its filename doesn't include the division keyword.
    if any_sc_division_missing {
        let mut extra = 0usize;
        for url in state
            .processed_pdf_urls
            .iter()
            .filter(|u| u.contains("supremecourt.gov.jm"))
            .cloned()
            .collect::<Vec<_>>()
        {
            if sc_to_evict.contains(&url) { continue; }
            match queries::has_any_civil_sittings_for_url(pool, &url).await {
                Ok(true) => {
                    if let Err(e) = queries::delete_civil_sittings_for_url(pool, &url).await {
                        warn!("  Failed to delete Civil rows for {url}: {e}");
                    }
                    sc_to_evict.insert(url);
                    extra += 1;
                }
                Ok(false) => {}
                Err(e) => warn!("DB check failed for {url}: {e}"),
            }
        }
        if extra > 0 {
            info!("Eviction: SC — cleared {extra} additional URL(s) with Civil rows (no-keyword sweep)");
        }
    }

    // ── Pass 3: all-Civil fallback ────────────────────────────────────────────
    for url in state
        .processed_pdf_urls
        .iter()
        .filter(|u| u.contains("supremecourt.gov.jm"))
        .cloned()
        .collect::<Vec<_>>()
    {
        if sc_to_evict.contains(&url) { continue; }
        match queries::has_only_civil_sittings_for_url(pool, &url).await {
            Ok(true) => {
                if let Err(e) = queries::delete_civil_sittings_for_url(pool, &url).await {
                    warn!("Failed to delete stale Civil rows for {url}: {e}");
                }
                sc_to_evict.insert(url);
            }
            Ok(false) => {}
            Err(e) => warn!("DB check failed for {url}: {e}"),
        }
    }

    if !sc_to_evict.is_empty() {
        state.processed_pdf_urls.retain(|u| !sc_to_evict.contains(u));
    }
    let sc_cleared = sc_to_evict.len();

    // ── CoA eviction ─────────────────────────────────────────────────────────
    let coa_cleared = match queries::count_sittings_for_court(pool, "Court of Appeal").await {
        Ok(0) => {
            // Nuclear: drain the processed list (even if already empty) and
            // do a domain-wide sweep to delete Civil rows from URLs that may
            // have been dropped from the list in a prior run.
            let urls: Vec<String> = state.processed_appeal_pdf_urls.drain(..).collect();
            for url in &urls {
                if let Err(e) = queries::delete_civil_sittings_for_url(pool, url).await {
                    warn!("  Failed to delete CoA Civil rows for {url}: {e}");
                }
            }
            match queries::delete_civil_sittings_for_domain(pool, "courtofappeal.gov.jm").await {
                Ok(n) if n > 0 => info!("Eviction: CoA — domain sweep deleted {n} stale Civil row(s)"),
                Ok(_) => {}
                Err(e) => warn!("CoA domain sweep failed: {e}"),
            }
            if urls.is_empty() {
                info!("Eviction: No CoA URLs found in processed list (already clean)");
                0
            } else {
                info!("Eviction: CoA — nuclear cleared all {} URL(s)", urls.len());
                urls.len()
            }
        }
        Ok(_) => {
            // CoA count > 0: per-URL Civil check for any URL stored before the fix.
            let mut coa_cleared = 0usize;
            for url in state
                .processed_appeal_pdf_urls
                .iter()
                .filter(|u| u.contains("courtofappeal.gov.jm"))
                .cloned()
                .collect::<Vec<_>>()
            {
                match queries::has_any_civil_sittings_for_url(pool, &url).await {
                    Ok(true) => {
                        if let Err(e) = queries::delete_civil_sittings_for_url(pool, &url).await {
                            warn!("  Failed to delete stale CoA Civil rows for {url}: {e}");
                        }
                        state.processed_appeal_pdf_urls.retain(|u2| u2 != &url);
                        coa_cleared += 1;
                    }
                    Ok(false) => {}
                    Err(e) => warn!("DB check failed for {url}: {e}"),
                }
            }
            if coa_cleared > 0 {
                info!("Eviction: CoA — evicting {coa_cleared} URL(s) with Civil sittings");
            }
            coa_cleared
        }
        Err(e) => { warn!("CoA sitting count failed: {e}"); 0 }
    };

    if sc_cleared + coa_cleared > 0 {
        info!(
            "Stale eviction complete: {sc_cleared} SC + {coa_cleared} CoA URL(s) cleared; \
             will be re-downloaded on next court-lists run."
        );
    }
    (sc_cleared, coa_cleared)
}
