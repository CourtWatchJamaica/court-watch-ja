/// Fetches a single judgment detail page and extracts structured data.
///
/// The Supreme Court website uses Drupal field divs:
///   .field--name-field-case-number .field__item  → case number
///   .field--name-field-presiding-judge .field__item → judge name
///   .field--name-field-date-of-delivery .field__item → date
///   .field--name-field-pdf-link a[href]          → PDF URL
///   .field--name-body .field__item               → summary text
use scraper::{Html, Selector};

#[derive(Debug, Default)]
pub struct JudgmentDetail {
    pub pdf_url: Option<String>,
    pub summary_text: Option<String>,
}

pub async fn fetch(client: &reqwest::Client, url: &str) -> anyhow::Result<JudgmentDetail> {
    let html = client.get(url).send().await?.error_for_status()?.text().await?;
    Ok(parse_detail_page(&html))
}

fn parse_detail_page(html: &str) -> JudgmentDetail {
    let doc = Html::parse_document(html);
    let mut detail = JudgmentDetail::default();

    // PDF link — try multiple common Drupal field patterns
    for sel_str in &[
        ".field--name-field-pdf-link a",
        ".field--name-field-attachment a",
        "a[href$='.pdf']",
        ".file a",
    ] {
        if let Ok(sel) = Selector::parse(sel_str) {
            if let Some(a) = doc.select(&sel).next() {
                if let Some(href) = a.value().attr("href") {
                    detail.pdf_url = Some(href.to_string());
                    break;
                }
            }
        }
    }

    // Summary / body text — pull from the body field or first substantial paragraph
    for sel_str in &[
        ".field--name-body .field__item",
        ".field--name-field-summary .field__item",
        "article .field__item",
    ] {
        if let Ok(sel) = Selector::parse(sel_str) {
            if let Some(el) = doc.select(&sel).next() {
                let text: String = el.text().collect::<Vec<_>>().join(" ");
                let trimmed = text.trim().to_string();
                if !trimmed.is_empty() {
                    detail.summary_text = Some(trimmed);
                    break;
                }
            }
        }
    }

    detail
}
