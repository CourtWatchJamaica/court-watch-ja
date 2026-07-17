use chrono::NaiveDate;
use std::env;

#[derive(Clone, Debug)]
pub struct Config {
    pub database_url: String,
    pub jwt_secret: String,
    pub port: u16,
    pub judgment_cutoff_date: NaiveDate,
    pub scraper_state_path: String,
    pub pdf_dir: String,
    pub resend_api_key: Option<String>,
    /// Shared secret between the Next.js server (NextAuth) and this backend.
    /// The /api/auth/oauth endpoint is disabled when unset.
    pub oauth_exchange_secret: Option<String>,
    /// Trust the X-Forwarded-For header for client IPs (set when deployed
    /// behind a reverse proxy / load balancer that appends the real client IP).
    pub trust_proxy: bool,
}

/// The old hardcoded fallback — explicitly rejected so a deployment that
/// still has it in its environment fails loudly instead of running forgeable.
const LEGACY_DEFAULT_SECRET: &str = "change_me_in_production_secret_key_32chars";

impl Config {
    pub fn from_env() -> anyhow::Result<Self> {
        dotenvy::dotenv().ok();

        let jwt_secret = env::var("JWT_SECRET").unwrap_or_default();
        if jwt_secret.trim().is_empty() {
            anyhow::bail!(
                "JWT_SECRET is not set. Refusing to start: without it, anyone could forge \
                 login tokens. Generate one with `openssl rand -hex 32` and set it in the \
                 environment (or backend/.env)."
            );
        }
        if jwt_secret == LEGACY_DEFAULT_SECRET {
            anyhow::bail!(
                "JWT_SECRET is set to the old publicly-known default value. Refusing to \
                 start. Generate a new secret with `openssl rand -hex 32`. Note: rotating \
                 the secret signs out all users."
            );
        }
        if jwt_secret.len() < 32 {
            anyhow::bail!(
                "JWT_SECRET is too short ({} chars, minimum 32). Generate one with \
                 `openssl rand -hex 32`.",
                jwt_secret.len()
            );
        }

        let resend_api_key = env::var("RESEND_API_KEY").ok();
        if resend_api_key.is_none() {
            tracing::warn!("[Config] RESEND_API_KEY is not set — transactional emails will be DISABLED");
        }
        let resend_domain = env::var("RESEND_DOMAIN").ok();
        if resend_domain.as_deref().map(|d| d.trim().is_empty()).unwrap_or(true) {
            tracing::warn!("[Config] RESEND_DOMAIN is not set — emails will fall back to @resend.dev (dev-only sender, won't reach real users)");
        }

        let oauth_exchange_secret = env::var("OAUTH_EXCHANGE_SECRET")
            .ok()
            .filter(|s| !s.trim().is_empty());
        if oauth_exchange_secret.is_none() {
            tracing::warn!(
                "[Config] OAUTH_EXCHANGE_SECRET is not set — OAuth sign-in is DISABLED. \
                 Set the same value here and in the frontend to enable Google/Apple login."
            );
        }

        let trust_proxy = env::var("TRUST_PROXY")
            .map(|v| matches!(v.trim(), "1" | "true" | "TRUE" | "yes"))
            .unwrap_or(false);

        let judgment_cutoff_date =
            env::var("JUDGMENT_CUTOFF_DATE").unwrap_or_else(|_| "2026-01-01".to_string());
        let cutoff = NaiveDate::parse_from_str(&judgment_cutoff_date, "%Y-%m-%d")
            .unwrap_or_else(|_| NaiveDate::from_ymd_opt(2026, 1, 1).unwrap());

        Ok(Self {
            database_url: env::var("DATABASE_URL").unwrap_or_else(|_| {
                "postgres://postgres:postgres@localhost/jamaican_law".to_string()
            }),
            jwt_secret,
            port: env::var("PORT")
                .unwrap_or_else(|_| "3001".to_string())
                .parse()
                .unwrap_or(3001),
            judgment_cutoff_date: cutoff,
            scraper_state_path: env::var("SCRAPER_STATE_PATH")
                .unwrap_or_else(|_| "./scraper_state.json".to_string()),
            pdf_dir: env::var("PDF_DIR").unwrap_or_else(|_| "./pdfs".to_string()),
            resend_api_key,
            oauth_exchange_secret,
            trust_proxy,
        })
    }
}
