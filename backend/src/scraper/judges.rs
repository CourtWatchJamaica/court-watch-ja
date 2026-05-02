/// Scrapes the current judges list from the Supreme Court website.
///
/// URL: https://supremecourt.gov.jm/content/current-judges
/// Structure: free-form text block; judge names preceded by "The Honourable" / "The Hon." / "Justice".
use regex::Regex;
use scraper::{Html, Selector};
use sqlx::PgPool;
use tracing::{info, warn};

use crate::db::queries;

const JUDGES_URL: &str = "https://supremecourt.gov.jm/content/current-judges";

pub async fn run(pool: &PgPool, client: &reqwest::Client) -> anyhow::Result<()> {
    info!("Scraping judges list from {JUDGES_URL}");

    let html = client
        .get(JUDGES_URL)
        .send()
        .await?
        .error_for_status()?
        .text()
        .await?;

    let names = extract_judge_names(&html);
    info!("Found {} judge names", names.len());

    for name in names {
        match queries::upsert_judge(pool, &name, Some("Supreme Court")).await {
            Ok(_) => info!("Upserted judge: {name}"),
            Err(e) => warn!("Failed to upsert judge '{name}': {e}"),
        }
    }

    Ok(())
}

fn extract_judge_names(html: &str) -> Vec<String> {
    let doc = Html::parse_document(html);

    // Pull all text from the main content area
    let content_sel = Selector::parse("main, article, .view-content, .field--name-body").unwrap();
    let mut full_text = String::new();

    for el in doc.select(&content_sel) {
        for chunk in el.text() {
            full_text.push_str(chunk);
            full_text.push('\n');
        }
    }

    if full_text.is_empty() {
        // Fall-back: entire body text
        let body_sel = Selector::parse("body").unwrap();
        if let Some(body) = doc.select(&body_sel).next() {
            full_text = body.text().collect::<Vec<_>>().join("\n");
        }
    }

    extract_names_from_text(&full_text)
}

fn extract_names_from_text(text: &str) -> Vec<String> {
    // Patterns:
    //   "The Honourable Justice Jane Doe"
    //   "The Hon. Mr. Justice John Smith"
    //   "Justice Mary Brown"
    //   "Hon. Justice [Name]"
    let re = Regex::new(
        r"(?i)(The\s+Honou?rable\s+(?:Mr\.\s*|Ms\.\s*|Mrs\.\s*)?Justice|The\s+Hon\.\s+(?:Mr\.\s*|Ms\.\s*|Mrs\.\s*)?Justice|Justice|Hon\.\s+Justice)\s+([A-Z][a-zA-Z\-']+(?:\s+[A-Z][a-zA-Z\-']+)*)",
    )
    .unwrap();

    let mut names = Vec::new();
    for cap in re.captures_iter(text) {
        let name = cap[2].trim().to_string();
        if name.split_whitespace().count() >= 2 && !names.contains(&name) {
            names.push(name);
        }
    }
    names
}
