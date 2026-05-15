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
}

impl Config {
    pub fn from_env() -> anyhow::Result<Self> {
        dotenvy::dotenv().ok();

        let judgment_cutoff_date =
            env::var("JUDGMENT_CUTOFF_DATE").unwrap_or_else(|_| "2026-01-01".to_string());
        let cutoff = NaiveDate::parse_from_str(&judgment_cutoff_date, "%Y-%m-%d")
            .unwrap_or_else(|_| NaiveDate::from_ymd_opt(2026, 1, 1).unwrap());

        Ok(Self {
            database_url: env::var("DATABASE_URL").unwrap_or_else(|_| {
                "postgres://postgres:postgres@localhost/jamaican_law".to_string()
            }),
            jwt_secret: env::var("JWT_SECRET")
                .unwrap_or_else(|_| "change_me_in_production_secret_key_32chars".to_string()),
            port: env::var("PORT")
                .unwrap_or_else(|_| "3001".to_string())
                .parse()
                .unwrap_or(3001),
            judgment_cutoff_date: cutoff,
            scraper_state_path: env::var("SCRAPER_STATE_PATH")
                .unwrap_or_else(|_| "./scraper_state.json".to_string()),
            pdf_dir: env::var("PDF_DIR").unwrap_or_else(|_| "./pdfs".to_string()),
            resend_api_key: env::var("RESEND_API_KEY").ok(),
        })
    }
}
