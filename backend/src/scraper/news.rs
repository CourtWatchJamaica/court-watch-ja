/// RSS news scraper — fetches Jamaican news feeds, filters by crime/court
/// keywords, and upserts matching articles into the `legal_news` table.
use anyhow::Result;
use chrono::{DateTime, NaiveDateTime};
use sqlx::PgPool;
use tracing::{info, warn};

use crate::db::queries;

// ── Feed registry ─────────────────────────────────────────────────────────

const FEEDS: &[(&str, &str)] = &[
    ("Jamaica Gleaner", "https://www.jamaica-gleaner.com/feed/rss.xml"),
    ("Jamaica Gleaner", "https://www.jamaica-gleaner.com/feed/news.xml"),
    ("Jamaica Observer", "https://www.jamaicaobserver.com/feed/"),
    ("Loop Jamaica", "https://jamaica.loopnews.com/feed"),
    ("RJR News", "http://rjrnewsonline.com/feed"),
];

// ── Keyword lists ─────────────────────────────────────────────────────────

const CRIME_KEYWORDS: &[&str] = &[
    "murder",
    "shooting",
    "robbery",
    "rape",
    "convicted",
    "sentenced",
    "arrested",
    "gang",
    " drug ",
    "cocaine",
    "firearm",
    "police",
    "jcf",
    "charged",
    "guilty",
    "acquitted",
    "fraud",
    "burglary",
    "larceny",
    "wounding",
    "assault",
    "indecent",
    "killed",
    "slain",
    " gun",
    "ammunition",
    "abduction",
    "carnal abuse",
    "sexual",
    "illegal",
    "extradition",
    "manslaughter",
    "homicide",
    "stabbed",
    "machete",
    " bomb",
    "threat",
    "conspiracy",
    "forgery",
    "uttering",
    "counterfeit",
    "identity theft",
    "lottery scamming",
];

const COURT_KEYWORDS: &[&str] = &[
    "judgment",
    "ruling",
    "appeal",
    "dismissed",
    "upheld",
    "overturned",
    "supreme court",
    "court of appeal",
    "parish court",
    "ordered",
    "awarded",
    "damages",
    "constitutional",
    "struck out",
    "chief justice",
    "judicial",
    "hearing",
    " trial",
    "mention",
    "sentencing",
    " bail",
    " plea",
    "defence",
    "prosecution",
    "verdict",
    " justice",
    "puisne judge",
    "master in chambers",
    "director of public prosecutions",
    "general legal council",
    "court of appeal judge",
    "parish court judge",
    "resident magistrate",
    "plea bargain",
    "committal",
    "habeas corpus",
    "judicial review",
    "constitutional motion",
];

// ── Helpers ───────────────────────────────────────────────────────────────

struct RssItem {
    title: String,
    description: Option<String>,
    url: Option<String>,
    published_at: Option<NaiveDateTime>,
}

/// Strip HTML tags from a string for plain-text keyword matching.
fn strip_html(html: &str) -> String {
    let mut out = String::with_capacity(html.len());
    let mut in_tag = false;
    for ch in html.chars() {
        match ch {
            '<' => in_tag = true,
            '>' => {
                in_tag = false;
                out.push(' ');
            }
            c if !in_tag => out.push(c),
            _ => {}
        }
    }
    out
}

/// Validate that the response looks like XML/RSS before paying the parse cost.
fn looks_like_xml(text: &str) -> bool {
    let t = text.trim_start();
    t.starts_with("<?xml") || t.starts_with("<rss") || t.starts_with("<feed")
}

/// Return "judgment" (court news) or "crime", or None if no keywords match.
/// Court news takes priority when an article matches both.
fn categorize(title: &str, description: Option<&str>) -> Option<&'static str> {
    let combined = format!(
        " {} {} ",
        title.to_lowercase(),
        description
            .map(strip_html)
            .unwrap_or_default()
            .to_lowercase()
    );
    let is_court = COURT_KEYWORDS.iter().any(|kw| combined.contains(kw));
    let is_crime = CRIME_KEYWORDS.iter().any(|kw| combined.contains(kw));
    match (is_crime, is_court) {
        (_, true) => Some("judgment"),
        (true, false) => Some("crime"),
        _ => None,
    }
}

/// Parse RFC 2822 or RFC 3339 date strings into a NaiveDateTime (UTC).
fn parse_pub_date(s: &str) -> Option<NaiveDateTime> {
    DateTime::parse_from_rfc2822(s.trim())
        .ok()
        .map(|dt| dt.naive_utc())
        .or_else(|| {
            DateTime::parse_from_rfc3339(s.trim())
                .ok()
                .map(|dt| dt.naive_utc())
        })
}

/// Return the concatenated text children of the first child of `node` whose
/// tag name equals `tag`.  Handles CDATA sections transparently.
fn child_text(node: roxmltree::Node<'_, '_>, tag: &str) -> Option<String> {
    let child = node.children().find(|n| n.has_tag_name(tag))?;
    let text: String = child
        .children()
        .filter(|c| c.is_text())
        .filter_map(|c| c.text())
        .collect();
    let trimmed = text.trim().to_string();
    if trimmed.is_empty() {
        None
    } else {
        Some(trimmed)
    }
}

/// Parse RSS 2.0 `<item>` and Atom `<entry>` nodes from an already-parsed doc.
fn extract_items(doc: &roxmltree::Document<'_>) -> Vec<RssItem> {
    doc.descendants()
        .filter(|n| n.has_tag_name("item") || n.has_tag_name("entry"))
        .map(|node| {
            let title = child_text(node, "title").unwrap_or_default();
            let description = child_text(node, "description")
                .or_else(|| child_text(node, "summary"))
                .or_else(|| child_text(node, "content"));
            // RSS 2.0: <link>URL</link>  |  Atom: <link href="URL"/>
            let url = child_text(node, "link").or_else(|| {
                node.children()
                    .find(|n| n.has_tag_name("link"))
                    .and_then(|n| n.attribute("href"))
                    .map(String::from)
            });
            let published_at = child_text(node, "pubDate")
                .or_else(|| child_text(node, "published"))
                .or_else(|| child_text(node, "updated"))
                .and_then(|s| parse_pub_date(&s));
            RssItem {
                title,
                description,
                url,
                published_at,
            }
        })
        .collect()
}

// ── Per-feed logic ────────────────────────────────────────────────────────

async fn fetch_and_store(
    client: &reqwest::Client,
    source: &str,
    feed_url: &str,
    pool: &PgPool,
) -> Result<usize> {
    let resp = client
        .get(feed_url)
        .timeout(std::time::Duration::from_secs(15))
        .send()
        .await
        .map_err(|e| anyhow::anyhow!("request failed: {e}"))?;

    let status = resp.status();
    if !status.is_success() {
        return Err(anyhow::anyhow!("HTTP {status}"));
    }

    let text = resp
        .text()
        .await
        .map_err(|e| anyhow::anyhow!("failed to read body: {e}"))?;

    if !looks_like_xml(&text) {
        return Err(anyhow::anyhow!(
            "response is not valid XML/RSS (first 80 chars: {:?})",
            text.chars().take(80).collect::<String>()
        ));
    }

    let doc = roxmltree::Document::parse(&text)
        .map_err(|e| anyhow::anyhow!("XML parse error: {e}"))?;

    let items = extract_items(&doc);
    let mut stored = 0usize;

    for item in items {
        if item.title.is_empty() {
            continue;
        }
        let url = match item.url.as_deref() {
            Some(u) if u.starts_with("http") => u.to_string(),
            _ => continue,
        };
        let category = match categorize(&item.title, item.description.as_deref()) {
            Some(c) => c,
            None => continue,
        };
        let desc = item.description.as_deref().map(|d| {
            let plain = strip_html(d);
            let t = plain.trim();
            if t.len() > 500 {
                t[..500].to_string()
            } else {
                t.to_string()
            }
        });
        match queries::upsert_legal_news(
            pool,
            &item.title,
            desc.as_deref(),
            source,
            &url,
            item.published_at,
            category,
        )
        .await
        {
            Ok(_) => stored += 1,
            Err(e) => warn!("[News] DB insert failed for '{url}': {e}"),
        }
    }

    Ok(stored)
}

// ── Public entry point ────────────────────────────────────────────────────

pub async fn run(pool: &PgPool) -> Result<()> {
    let client = super::http_client()?;

    for (source, feed_url) in FEEDS {
        match fetch_and_store(&client, source, feed_url, pool).await {
            Ok(n) => info!("[News] {} ({}) → {} article(s) stored", source, feed_url, n),
            Err(e) => warn!("[News] {} ({}) failed: {}", source, feed_url, e),
        }
    }

    Ok(())
}
