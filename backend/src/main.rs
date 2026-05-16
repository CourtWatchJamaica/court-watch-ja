mod api;
mod config;
mod db;
mod middleware;
mod notifications;
mod scraper;
mod utils;

use std::collections::HashMap;
use std::net::SocketAddr;
use std::sync::{atomic::AtomicBool, Arc, Mutex};
use std::time::Instant;

use axum::http::{HeaderValue, Method};
use sqlx::PgPool;
use tower_http::{cors::CorsLayer, trace::TraceLayer};
use tracing::info;
use tracing_subscriber::{layer::SubscriberExt, util::SubscriberInitExt, EnvFilter};

use config::Config;

/// Shared application state injected into every handler.
#[derive(Clone)]
pub struct AppState {
    pub db: PgPool,
    pub config: Arc<Config>,
    /// Set to true while a manual (admin-triggered) scraper run is in progress.
    pub scraper_running: Arc<AtomicBool>,
    /// When true, non-admin users see the maintenance page.
    pub maintenance_mode: Arc<AtomicBool>,
    /// Per-IP request timestamps for auth endpoint rate limiting (5 req / 60 s).
    pub rate_limiter: Arc<Mutex<HashMap<String, Vec<Instant>>>>,
}

/// Updates `_sqlx_migrations` checksums to match the current local files.
/// Handles the case where a migration file was reformatted or recreated after
/// already being applied to the database, which would otherwise cause sqlx to
/// refuse to run with a checksum mismatch error.
async fn sync_migration_checksums(pool: &PgPool) {
    let migrator = sqlx::migrate!("./migrations");
    for migration in migrator.iter() {
        match sqlx::query(
            "UPDATE _sqlx_migrations SET checksum = $1 WHERE version = $2",
        )
        .bind(migration.checksum.as_ref())
        .bind(migration.version)
        .execute(pool)
        .await
        {
            Ok(r) if r.rows_affected() > 0 => {
                tracing::info!(
                    "[Migrate] Resynced checksum for migration {}",
                    migration.version
                );
            }
            Ok(_) => {} // not yet applied — migrate!() will handle it
            Err(e) => tracing::warn!(
                "[Migrate] Checksum sync failed for {}: {e}",
                migration.version
            ),
        }
    }
}

#[tokio::main]
async fn main() -> anyhow::Result<()> {
    // ── Logging ───────────────────────────────────────────────────────────
    tracing_subscriber::registry()
        .with(EnvFilter::try_from_default_env().unwrap_or_else(|_| "info".into()))
        .with(tracing_subscriber::fmt::layer())
        .init();

    // ── Config ────────────────────────────────────────────────────────────
    let config = Arc::new(Config::from_env()?);
    info!("CourtWatch JA backend starting on port {}", config.port);

    // ── Database ──────────────────────────────────────────────────────────
    let pool = db::connection::create_pool(&config.database_url).await?;
    info!("Database connected");

    // Resync checksums for any migration file whose content changed after
    // being applied (e.g. reformatted during a merge).  The UPDATE is a
    // no-op for migrations that haven't been applied yet.
    sync_migration_checksums(&pool).await;

    // Run any pending migrations
    sqlx::migrate!("./migrations").run(&pool).await?;
    info!("Migrations applied");

    // Seed system_config from env so the env var acts as the initial source of truth.
    // Subsequent runtime changes go to the DB; the .env file is never written at runtime.
    if let Ok(cutoff_str) = std::env::var("JUDGMENT_CUTOFF_DATE") {
        if let Err(e) =
            db::queries::set_system_config(&pool, "judgment_cutoff_date", &cutoff_str).await
        {
            tracing::warn!("Failed to seed judgment_cutoff_date from env: {e}");
        } else {
            info!("judgment_cutoff_date seeded from env: {cutoff_str}");
        }
    }

    // Bootstrap super_admin from ADMIN_EMAIL env var on every startup.
    // Safe to run repeatedly — only upgrades the role if not already super_admin.
    if let Ok(admin_email) = std::env::var("ADMIN_EMAIL") {
        match db::queries::bootstrap_admin(&pool, &admin_email).await {
            Ok(_) => info!("Admin bootstrapped: {admin_email}"),
            Err(e) => tracing::warn!("Admin bootstrap failed: {e}"),
        }
    }

    // Extract judge names from CoA PDFs that are already on disk (fast, no network I/O).
    // Must run before seed_judges_from_judgments so the newly extracted names are included.
    if let Err(e) = scraper::runner::backfill_coa_judge_names(&pool).await {
        tracing::warn!("Startup CoA judge backfill failed: {e}");
    }

    // Sync judges table from judgments on every startup (idempotent – ON CONFLICT DO NOTHING).
    // Runs after the backfill so CoA judge names extracted above are captured.
    match db::queries::seed_judges_from_judgments(&pool).await {
        Ok(n) => info!("Judge sync complete ({n} new row(s))"),
        Err(e) => tracing::warn!("Judge seed failed: {e}"),
    }

    // ── App state ─────────────────────────────────────────────────────────
    let rate_limiter: Arc<Mutex<HashMap<String, Vec<Instant>>>> =
        Arc::new(Mutex::new(HashMap::new()));

    // Clean up stale rate-limit entries every 5 minutes.
    {
        let rl = rate_limiter.clone();
        tokio::spawn(async move {
            let mut ticker = tokio::time::interval(std::time::Duration::from_secs(300));
            loop {
                ticker.tick().await;
                let mut map = rl.lock().unwrap();
                let now = Instant::now();
                let window = std::time::Duration::from_secs(60);
                map.retain(|_, v| {
                    v.retain(|&t| now.duration_since(t) < window);
                    !v.is_empty()
                });
            }
        });
    }

    let state = AppState {
        db: pool.clone(),
        config: config.clone(),
        scraper_running: Arc::new(AtomicBool::new(false)),
        maintenance_mode: Arc::new(AtomicBool::new(false)),
        rate_limiter,
    };

    // ── CORS ──────────────────────────────────────────────────────────────
    let cors = CorsLayer::new()
        .allow_origin(
            std::env::var("FRONTEND_URL")
                .unwrap_or_else(|_| "http://localhost:3000".into())
                .parse::<HeaderValue>()
                .unwrap_or_else(|_| "http://localhost:3000".parse().unwrap()),
        )
        .allow_methods([
            Method::GET,
            Method::POST,
            Method::PUT,
            Method::DELETE,
            Method::OPTIONS,
        ])
        .allow_headers(tower_http::cors::Any);

    // ── Router ────────────────────────────────────────────────────────────
    let app = api::router(state)
        .layer(TraceLayer::new_for_http())
        .layer(cors);

    // ── Startup catch-up check → then cron scheduler ─────────────────────
    // Both run in a background task so the HTTP server is immediately ready.
    // The scheduler only activates after the catch-up check finishes.
    {
        let pool_bg = pool.clone();
        let config_bg = config.clone();
        tokio::spawn(async move {
            if let Err(e) = scraper::runner::run_catchup_check(&pool_bg, &config_bg).await {
                tracing::error!("Startup catch-up check failed: {e}");
            }
            if let Err(e) = scraper::runner::start(pool_bg, config_bg).await {
                tracing::error!("Scheduler failed to start: {e}");
            }
        });
    }

    // ── Startup RSS news fetch ─────────────────────────────────────────────
    // Runs once in the background immediately on boot; daily cron handles
    // subsequent fetches.  ON CONFLICT DO NOTHING makes this safe to repeat.
    {
        let pool_bg = pool.clone();
        tokio::spawn(async move {
            if let Err(e) = scraper::news::run(&pool_bg).await {
                tracing::warn!("Startup RSS news fetch failed: {e}");
            }
        });
    }

    // ── Listen ────────────────────────────────────────────────────────────
    let addr = format!("0.0.0.0:{}", config.port);
    let listener = tokio::net::TcpListener::bind(&addr).await?;
    info!("Listening on {addr}");
    axum::serve(
        listener,
        app.into_make_service_with_connect_info::<SocketAddr>(),
    )
    .await?;

    Ok(())
}
