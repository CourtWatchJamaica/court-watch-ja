mod api;
mod config;
mod db;
mod middleware;
mod scraper;
mod utils;

use std::sync::Arc;

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

    // Run any pending migrations
    sqlx::migrate!("./migrations").run(&pool).await?;
    info!("Migrations applied");

    // ── App state ─────────────────────────────────────────────────────────
    let state = AppState {
        db: pool.clone(),
        config: config.clone(),
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

    // ── Listen ────────────────────────────────────────────────────────────
    let addr = format!("0.0.0.0:{}", config.port);
    let listener = tokio::net::TcpListener::bind(&addr).await?;
    info!("Listening on {addr}");
    axum::serve(listener, app).await?;

    Ok(())
}
