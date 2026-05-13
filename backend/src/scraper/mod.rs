pub mod appeal_court;
pub mod news;
pub mod appeal_court_lists;
pub mod court_lists;
pub mod judgment_detail;
pub mod judgments;
pub mod judges;
pub mod parish_court;
pub mod parish_court_judges;
pub mod parish_court_lists;
pub mod pdf;
pub mod runner;

use chrono::{DateTime, Utc};
use serde::{Deserialize, Serialize};
use std::collections::HashMap;
use std::path::Path;
use tokio::fs;

/// Persisted between runs so we can resume from where we left off.
#[derive(Debug, Clone, Serialize, Deserialize, Default)]
pub struct ScraperState {
    /// The next judgment listing page to scrape (0-indexed).
    pub next_judgment_page: u32,
    /// Court-list PDF URLs we have already processed.
    pub processed_pdf_urls: Vec<String>,
    /// When we last scraped the judges directory.
    pub last_judges_scraped_at: Option<DateTime<Utc>>,

    // ── Court of Appeal ──────────────────────────────────────────────────────
    /// Next Court of Appeal **civil** judgment listing page (0-indexed).
    #[serde(default)]
    pub next_appeal_page: u32,
    /// Next Court of Appeal **criminal** judgment listing page (0-indexed).
    #[serde(default)]
    pub next_appeal_criminal_page: u32,
    /// Court of Appeal court-list PDF URLs we have already processed.
    #[serde(default)]
    pub processed_appeal_pdf_urls: Vec<String>,
    /// When we last scraped the Court of Appeal judges directory.
    #[serde(default)]
    pub last_appeal_judges_scraped_at: Option<DateTime<Utc>>,

    // ── Parish Court ─────────────────────────────────────────────────────────
    /// The next Parish Court judgment listing page to scrape (0-indexed).
    #[serde(default)]
    pub next_parish_page: u32,
    /// Parish Court court-list PDF URLs we have already processed.
    #[serde(default)]
    pub processed_parish_pdf_urls: Vec<String>,
    /// When we last scraped the Parish Court judges directory.
    #[serde(default)]
    pub last_parish_judges_scraped_at: Option<DateTime<Utc>>,

    // ── PDF download failure tracking (1e) ───────────────────────────────────
    /// Counts how many times each judgment PDF URL has failed to download.
    #[serde(default)]
    pub pdf_download_failures: HashMap<String, u32>,
    /// PDF URLs permanently skipped because they exceeded MAX_PDF_FAILURES.
    #[serde(default)]
    pub pdf_skipped: Vec<String>,

    // ── CoA judge-name backfill timestamp ────────────────────────────────────
    /// When we last ran the CoA judgment scraper specifically to backfill NULL
    /// judge_name fields.  Used to throttle re-runs (max once per 12 h).
    #[serde(default)]
    pub last_coa_judge_backfill_at: Option<DateTime<Utc>>,

    // ── Parish Court case-list PDFs ───────────────────────────────────────────
    /// PDF URLs from parish case lists we have already parsed into parish_court_cases.
    #[serde(default)]
    pub processed_parish_case_pdf_urls: Vec<String>,

}

impl ScraperState {
    pub async fn load(path: &str) -> Self {
        match fs::read_to_string(path).await {
            Ok(s) => serde_json::from_str(&s).unwrap_or_default(),
            Err(_) => Self::default(),
        }
    }

    pub async fn save(&self, path: &str) -> anyhow::Result<()> {
        if let Some(parent) = Path::new(path).parent() {
            fs::create_dir_all(parent).await.ok();
        }
        let json = serde_json::to_string_pretty(self)?;
        fs::write(path, json).await?;
        Ok(())
    }

    pub fn mark_pdf_processed(&mut self, url: String) {
        if !self.processed_pdf_urls.contains(&url) {
            self.processed_pdf_urls.push(url);
        }
    }

    pub fn pdf_already_processed(&self, url: &str) -> bool {
        self.processed_pdf_urls.iter().any(|u| u == url)
    }

    pub fn mark_appeal_pdf_processed(&mut self, url: String) {
        if !self.processed_appeal_pdf_urls.contains(&url) {
            self.processed_appeal_pdf_urls.push(url);
        }
    }

    pub fn appeal_pdf_already_processed(&self, url: &str) -> bool {
        self.processed_appeal_pdf_urls.iter().any(|u| u == url)
    }

    pub fn mark_parish_pdf_processed(&mut self, url: String) {
        if !self.processed_parish_pdf_urls.contains(&url) {
            self.processed_parish_pdf_urls.push(url);
        }
    }

    pub fn parish_pdf_already_processed(&self, url: &str) -> bool {
        self.processed_parish_pdf_urls.iter().any(|u| u == url)
    }

    pub fn mark_parish_case_pdf_processed(&mut self, url: String) {
        if !self.processed_parish_case_pdf_urls.contains(&url) {
            self.processed_parish_case_pdf_urls.push(url);
        }
    }

    pub fn parish_case_pdf_already_processed(&self, url: &str) -> bool {
        self.processed_parish_case_pdf_urls.iter().any(|u| u == url)
    }

    // ── PDF failure helpers ───────────────────────────────────────────────────

    pub fn is_pdf_skipped(&self, url: &str) -> bool {
        self.pdf_skipped.iter().any(|u| u == url)
    }

    /// Record a failed download attempt.  Returns `true` if the URL has now
    /// reached `MAX_PDF_FAILURES` and should be permanently skipped.
    pub fn record_pdf_failure(&mut self, url: String) -> bool {
        let count = self.pdf_download_failures.entry(url.clone()).or_insert(0);
        *count += 1;
        if *count >= MAX_PDF_FAILURES {
            if !self.pdf_skipped.contains(&url) {
                self.pdf_skipped.push(url);
            }
            return true;
        }
        false
    }

    /// Clear the failure counter for a URL that downloaded successfully.
    pub fn clear_pdf_failure(&mut self, url: &str) {
        self.pdf_download_failures.remove(url);
    }

    /// Permanently skip a URL — add to skip list and clear any failure counter.
    pub fn skip_pdf_permanently(&mut self, url: &str) {
        self.pdf_download_failures.remove(url);
        if !self.pdf_skipped.iter().any(|u| u == url) {
            self.pdf_skipped.push(url.to_string());
        }
    }
}

/// A PDF URL is permanently skipped once it has failed this many times.
pub const MAX_PDF_FAILURES: u32 = 3;

/// Shared HTTP client with polite headers.
pub fn http_client() -> anyhow::Result<reqwest::Client> {
    Ok(reqwest::Client::builder()
        .user_agent("CourtWatchJA/1.0 (legal research aggregator; contact@courtwatch.jm)")
        .timeout(std::time::Duration::from_secs(30))
        .build()?)
}
