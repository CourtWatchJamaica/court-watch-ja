/// Multi-layer PDF link discovery for the Supreme Court court-lists index page.
///
/// The court website is Drupal 10 with fully server-side rendering — all PDF links
/// are present in the static HTML response from the index page.  No JavaScript
/// execution is needed.  A realistic `reqwest` User-Agent is sufficient.
///
/// Four layers are tried in order, each progressively less specific:
///
/// | Layer | Strategy                          | Confidence |
/// |-------|-----------------------------------|------------|
/// | 1     | Drupal Views CSS selectors        | high       |
/// | 2     | Generic keyword-filtered PDF href | medium     |
/// | 3     | Raw HTML regex scan               | low        |
/// | 4     | Direct URL construction (HEAD probe) | fallback |
///
/// If layers 1-3 all fail, the scraper has likely encountered a website
/// structure change; Layer 4 constructs probable filenames from the current
/// week's Monday date and probes each with a HEAD request.
use chrono::Datelike;
use chrono::NaiveDate;
use regex::Regex;
use scraper::{Html, Selector};
use tracing::{error, info, warn};

const BASE_URL: &str = "https://supremecourt.gov.jm";
const COURTLIST_DIR: &str =
    "https://supremecourt.gov.jm/sites/default/files/courtlist/";

/// Result of a multi-layer discovery attempt.
#[derive(Debug, Clone)]
pub struct DiscoveryOutcome {
    /// Deduplicated, absolute PDF URLs.
    pub links: Vec<String>,
    /// Which layer succeeded (1–4), or 0 if all failed.
    pub layer: u8,
    /// Human-readable confidence tag.
    pub confidence: &'static str,
    /// Diagnostic page snippet — populated when confidence is low/fallback/none.
    pub html_snippet: Option<String>,
}

impl DiscoveryOutcome {
    fn with_links(links: Vec<String>, layer: u8, confidence: &'static str) -> Self {
        Self { links, layer, confidence, html_snippet: None }
    }
    fn failed(snippet: String) -> Self {
        Self { links: vec![], layer: 0, confidence: "none", html_snippet: Some(snippet) }
    }
}

/// Entry point: runs all four layers, stops at the first that returns at least
/// one PDF link, and logs which layer was used.
pub async fn discover_pdf_links(html: &str, client: &reqwest::Client) -> DiscoveryOutcome {
    // Layer 1 — confirmed Drupal Views DOM structure (high confidence)
    let links = layer1_drupal_views(html);
    if !links.is_empty() {
        info!(
            "[Discovery L1] Drupal Views selector: {} PDF link(s) — high confidence",
            links.len()
        );
        return DiscoveryOutcome::with_links(links, 1, "high");
    }
    warn!("[Discovery L1] Drupal Views yielded 0 links — trying Layer 2");

    // Layer 2 — generic keyword-filtered href scan (medium confidence)
    let links = layer2_pdf_href_keywords(html);
    if !links.is_empty() {
        info!(
            "[Discovery L2] Keyword href scan: {} PDF link(s) — medium confidence",
            links.len()
        );
        return DiscoveryOutcome::with_links(links, 2, "medium");
    }
    warn!("[Discovery L2] Keyword href yielded 0 links — trying Layer 3");

    // Layer 3 — raw HTML regex (immune to parser normalisation, low confidence)
    let links = layer3_raw_regex(html);
    if !links.is_empty() {
        info!(
            "[Discovery L3] Raw HTML regex: {} PDF link(s) — low confidence",
            links.len()
        );
        return DiscoveryOutcome::with_links(links, 3, "low");
    }
    warn!("[Discovery L3] Raw regex yielded 0 links — trying Layer 4 (URL construction)");

    // Compute diagnostic snippet once — used for Layer 4 and all-fail logging.
    let snippet = extract_html_snippet(html);

    // Layer 4 — construct probable filenames from current week's Monday (fallback)
    let links = layer4_week_pattern_probe(client).await;
    if !links.is_empty() {
        error!(
            "[ALERT] [Discovery L4] Court-lists index page structure may have changed — \
             fell back to direct URL construction ({} link(s) found). \
             The index page should be inspected manually. Snippet: {}",
            links.len(),
            snippet
        );
        return DiscoveryOutcome { links, layer: 4, confidence: "fallback", html_snippet: Some(snippet) };
    }

    error!(
        "[ALERT] ALL discovery layers failed — no PDF links found on the Supreme Court \
         court-lists page. The website structure has likely changed significantly. \
         Manual inspection required. Page snippet: {}",
        snippet
    );
    DiscoveryOutcome::failed(snippet)
}

// ── Layer implementations ─────────────────────────────────────────────────────

/// Layer 1: Drupal Views selectors.
///
/// Targets the confirmed HTML structure as of 2026-05:
/// ```html
/// <div class="views-row">
///   <div class="views-field views-field-title">
///     <span class="field-content">
///       <a href="https://supremecourt.gov.jm/sites/default/files/courtlist/….pdf"
///          target="target _blank">…
/// ```
fn layer1_drupal_views(html: &str) -> Vec<String> {
    let doc = Html::parse_document(html);

    // Primary: .views-field-title a — most precise
    let primary = Selector::parse(".views-field-title a[href]").unwrap();
    let mut links: Vec<String> = doc
        .select(&primary)
        .filter_map(|a| a.value().attr("href"))
        .filter(|h| {
            let l = h.to_lowercase();
            l.ends_with(".pdf") || l.contains("courtlist") || l.contains("court-list")
        })
        .map(|h| absolutize(h))
        .collect();

    // Secondary: any link inside .views-row — catches theme changes that rename
    // views-field-title to a different modifier class.
    if links.is_empty() {
        let fallback = Selector::parse(".views-row a[href]").unwrap();
        links = doc
            .select(&fallback)
            .filter_map(|a| a.value().attr("href"))
            .filter(|h| h.to_lowercase().ends_with(".pdf"))
            .map(|h| absolutize(h))
            .collect();
    }

    sorted_dedup(links)
}

/// Layer 2: Any `a[href$=".pdf"]` whose URL or link text contains court-list keywords.
fn layer2_pdf_href_keywords(html: &str) -> Vec<String> {
    let doc = Html::parse_document(html);
    let sel = Selector::parse("a[href]").unwrap();
    let mut links = Vec::new();

    for a in doc.select(&sel) {
        let Some(href) = a.value().attr("href") else { continue };
        let lower_href = href.to_lowercase();
        if !lower_href.ends_with(".pdf") {
            continue;
        }
        let lower_text = a.text().collect::<String>().to_lowercase();
        let href_matches = lower_href.contains("courtlist")
            || lower_href.contains("court-list")
            || lower_href.contains("week_of")
            || lower_href.contains("week-of")
            || lower_href.contains("division");
        let text_matches = lower_text.contains("court list")
            || lower_text.contains("week of")
            || lower_text.contains("addendum")
            || lower_text.contains("amended")
            || lower_text.contains("listings");
        if href_matches || text_matches {
            links.push(absolutize(href));
        }
    }

    sorted_dedup(links)
}

/// Layer 3: Raw regex scan of the HTML string — bypasses the HTML parser entirely
/// and will find links even inside `<script>` tags or malformed attributes.
fn layer3_raw_regex(html: &str) -> Vec<String> {
    let mut links = Vec::new();

    // Absolute URLs under any court-list path
    let re_abs = Regex::new(
        r#"href=["'](https?://[^"']*(?:courtlist|court-list)[^"']*\.pdf)["']"#,
    )
    .unwrap();
    for cap in re_abs.captures_iter(html) {
        if let Some(m) = cap.get(1) {
            links.push(m.as_str().to_string());
        }
    }

    // Relative paths served from /sites/default/files/
    let re_rel = Regex::new(
        r#"href=["'](/sites/default/files/(?:courtlist|court-list|publication)/[^"']+\.pdf)["']"#,
    )
    .unwrap();
    for cap in re_rel.captures_iter(html) {
        if let Some(m) = cap.get(1) {
            links.push(absolutize(m.as_str()));
        }
    }

    sorted_dedup(links)
}

/// Layer 4: Construct probable PDF filenames from the current week's Monday date
/// and send a HEAD request for each.  Used only when all other layers fail.
async fn layer4_week_pattern_probe(client: &reqwest::Client) -> Vec<String> {
    let today = chrono::Utc::now().date_naive();
    let monday = week_monday(today);
    let mon = month_name(monday.month());
    let day = monday.day();
    let yr = monday.year();

    // Try both padded and unpadded day variants (court uses inconsistent naming)
    let day_strs: Vec<String> = if day < 10 {
        vec![format!("{day}"), format!("{day:02}")]
    } else {
        vec![format!("{day}")]
    };

    let mut candidates = Vec::new();
    for d in &day_strs {
        candidates.extend_from_slice(&[
            format!("{COURTLIST_DIR}Civil_Division_Listings_for_the_Week_of_{mon}_{d}_{yr}.pdf"),
            format!("{COURTLIST_DIR}Addendum_Civil_Division_List_for_the_Week_of_{mon}_{d}_{yr}.pdf"),
            format!("{COURTLIST_DIR}Updated_Civil_Division_List_for_the_Week_of_{mon}_{d}_{yr}.pdf"),
            format!("{COURTLIST_DIR}Criminal_and_Gun_Court_Divisions_List_for_the_Week_of_{mon}_{d}_{yr}.pdf"),
            format!("{COURTLIST_DIR}Probate_and_Family_Court_List_Week_of_{mon}_{d}_{yr}.pdf"),
            format!(
                "{COURTLIST_DIR}Court_List_Commercial_Division_The_Week_of_{}_{d}_{yr}.pdf",
                mon.to_uppercase()
            ),
        ]);
    }
    candidates.dedup();

    let mut found = Vec::new();
    for url in &candidates {
        match client.head(url.as_str()).send().await {
            Ok(r) if r.status().is_success() => {
                info!("[Discovery L4] HEAD {} → {} (exists)", url, r.status());
                found.push(url.clone());
            }
            Ok(r) => info!("[Discovery L4] HEAD {} → {} (absent)", url, r.status()),
            Err(e) => warn!("[Discovery L4] HEAD {} failed: {e}", url),
        }
    }

    found
}

// ── Helpers ───────────────────────────────────────────────────────────────────

fn absolutize(href: &str) -> String {
    if href.starts_with("http") {
        href.to_string()
    } else {
        format!("{BASE_URL}{href}")
    }
}

fn sorted_dedup(mut v: Vec<String>) -> Vec<String> {
    v.sort();
    v.dedup();
    v
}

pub fn week_monday(d: NaiveDate) -> NaiveDate {
    let offset = d.weekday().num_days_from_monday() as i64;
    d - chrono::Duration::days(offset)
}

fn month_name(m: u32) -> &'static str {
    match m {
        1 => "January",
        2 => "February",
        3 => "March",
        4 => "April",
        5 => "May",
        6 => "June",
        7 => "July",
        8 => "August",
        9 => "September",
        10 => "October",
        11 => "November",
        12 => "December",
        _ => "Unknown",
    }
}

/// Extracts a short diagnostic text snippet from the most relevant content area.
fn extract_html_snippet(html: &str) -> String {
    let doc = Html::parse_document(html);
    for css in &[".art-content-layout", "main", "#content", "body"] {
        if let Ok(sel) = Selector::parse(css) {
            if let Some(el) = doc.select(&sel).next() {
                let words: String = el
                    .text()
                    .flat_map(|t| t.split_whitespace())
                    .take(60)
                    .collect::<Vec<_>>()
                    .join(" ");
                if !words.is_empty() {
                    return words.chars().take(400).collect();
                }
            }
        }
    }
    html.chars().take(400).collect()
}

// ── Tests ─────────────────────────────────────────────────────────────────────

#[cfg(test)]
mod tests {
    use super::*;

    // Confirmed Drupal 10 structure (layer 1 primary path)
    const L1_HTML: &str = r#"<!DOCTYPE html><html><body>
        <div class="views-row">
          <div class="views-field views-field-nothing"></div>
          <div class="views-field views-field-title">
            <span class="field-content">
              <a href="https://supremecourt.gov.jm/sites/default/files/courtlist/Civil_Division_Listings_for_the_Week_of_May_18_2026.pdf"
                 target="target _blank">
                Supreme Court Civil Division Court List for the week of May 18th, 2026
              </a>
            </span>
          </div>
        </div>
        <div class="views-row">
          <div class="views-field views-field-title">
            <span class="field-content">
              <a href="https://supremecourt.gov.jm/sites/default/files/courtlist/Addendum_Civil_Division_List_for_the_Week_of_May_18_2026.pdf">
                (Addendum) Supreme Court Civil Division Court List for the week of May 18th, 2026
              </a>
            </span>
          </div>
        </div>
        <a href="/sites/default/files/publication/NOTICE.pdf">Unrelated PDF</a>
    </body></html>"#;

    // Theme upgraded — views-field-title renamed but views-row still present (layer 1 secondary)
    const L1_FALLBACK_HTML: &str = r#"<!DOCTYPE html><html><body>
        <div class="views-row">
          <div class="views-field views-field-name">
            <a href="/sites/default/files/courtlist/Civil_Division_Listings_for_the_Week_of_May_18_2026.pdf">
              Civil Division Court List
            </a>
          </div>
        </div>
    </body></html>"#;

    // Completely different theme — no views classes; relies on href keywords (layer 2)
    const L2_HTML: &str = r#"<!DOCTYPE html><html><body>
        <section class="court-lists">
          <a href="/sites/default/files/courtlist/Civil_Division_Listings_for_the_Week_of_May_18_2026.pdf">
            Court list for the week of May 18, 2026
          </a>
          <a href="/sites/default/files/publication/Unrelated.pdf">Unrelated document</a>
          <a href="/sites/default/files/courtlist/Addendum_Civil_Division_List_for_the_Week_of_May_18_2026.pdf">
            Addendum
          </a>
        </section>
    </body></html>"#;

    // Links only visible via raw text / script injection (layer 3)
    const L3_HTML: &str = r#"<!DOCTYPE html><html><body>
        <p>Loading court lists…</p>
        <script>
          /* dynamically injected — but href still present in raw HTML */
          var pdf = 'href="/sites/default/files/courtlist/Civil_Division_Listings_for_the_Week_of_May_18_2026.pdf"';
        </script>
        <noscript>
          <a href="/sites/default/files/courtlist/Civil_Division_Listings_for_the_Week_of_May_18_2026.pdf">Civil Division</a>
        </noscript>
    </body></html>"#;

    // Nothing useful at all (all layers 1-3 should return empty)
    const EMPTY_HTML: &str =
        r#"<!DOCTYPE html><html><body><p>Site under maintenance.</p></body></html>"#;

    // ── Layer 1 ─────────────────────────────────────────────────────────────

    #[test]
    fn l1_primary_finds_views_field_title_links() {
        let links = layer1_drupal_views(L1_HTML);
        assert_eq!(links.len(), 2, "should find both Civil and Addendum PDFs via views-field-title");
        assert!(links.iter().any(|l| l.contains("Civil_Division_Listings")));
        assert!(links.iter().any(|l| l.contains("Addendum")));
    }

    #[test]
    fn l1_excludes_unrelated_pdfs() {
        let links = layer1_drupal_views(L1_HTML);
        assert!(
            !links.iter().any(|l| l.contains("NOTICE")),
            "publication/NOTICE.pdf should not be included"
        );
    }

    #[test]
    fn l1_secondary_falls_back_to_views_row() {
        let links = layer1_drupal_views(L1_FALLBACK_HTML);
        assert!(!links.is_empty(), ".views-row fallback should find the PDF link");
        assert!(links[0].contains("Civil_Division_Listings"));
    }

    #[test]
    fn l1_returns_empty_for_non_drupal_html() {
        let links = layer1_drupal_views(L2_HTML);
        assert!(links.is_empty(), "L2 HTML has no views classes — Layer 1 should return empty");
    }

    #[test]
    fn l1_returns_absolute_urls() {
        let links = layer1_drupal_views(L1_HTML);
        assert!(links.iter().all(|l| l.starts_with("https://")), "all links must be absolute");
    }

    // ── Layer 2 ─────────────────────────────────────────────────────────────

    #[test]
    fn l2_finds_court_list_keywords_in_href() {
        let links = layer2_pdf_href_keywords(L2_HTML);
        assert!(links.iter().any(|l| l.contains("Civil_Division_Listings")));
    }

    #[test]
    fn l2_finds_addendum_by_link_text() {
        let links = layer2_pdf_href_keywords(L2_HTML);
        assert!(links.iter().any(|l| l.contains("Addendum")));
    }

    #[test]
    fn l2_excludes_unrelated_publication_pdfs() {
        let links = layer2_pdf_href_keywords(L2_HTML);
        assert!(
            !links.iter().any(|l| l.contains("Unrelated")),
            "Unrelated.pdf must be excluded"
        );
    }

    #[test]
    fn l2_returns_absolute_urls() {
        let links = layer2_pdf_href_keywords(L2_HTML);
        assert!(links.iter().all(|l| l.starts_with("https://")));
    }

    #[test]
    fn l2_returns_empty_for_no_links_html() {
        assert!(layer2_pdf_href_keywords(EMPTY_HTML).is_empty());
    }

    // ── Layer 3 ─────────────────────────────────────────────────────────────

    #[test]
    fn l3_finds_links_embedded_in_script_tag() {
        let links = layer3_raw_regex(L3_HTML);
        assert!(!links.is_empty(), "Layer 3 raw regex should find the PDF in script text");
        assert!(links[0].contains("Civil_Division_Listings"));
    }

    #[test]
    fn l3_returns_absolute_urls() {
        let links = layer3_raw_regex(L3_HTML);
        assert!(links.iter().all(|l| l.starts_with("https://")));
    }

    #[test]
    fn l3_deduplicates_same_url_from_script_and_noscript() {
        // L3_HTML has the URL twice: once in script text, once in noscript anchor
        let links = layer3_raw_regex(L3_HTML);
        assert_eq!(links.len(), 1, "duplicate URL should be deduped");
    }

    #[test]
    fn l3_returns_empty_for_no_links_html() {
        assert!(layer3_raw_regex(EMPTY_HTML).is_empty());
    }

    // ── All layers empty ─────────────────────────────────────────────────────

    #[test]
    fn all_layers_empty_for_maintenance_page() {
        assert!(layer1_drupal_views(EMPTY_HTML).is_empty());
        assert!(layer2_pdf_href_keywords(EMPTY_HTML).is_empty());
        assert!(layer3_raw_regex(EMPTY_HTML).is_empty());
    }

    // ── week_monday helper ───────────────────────────────────────────────────

    #[test]
    fn week_monday_from_wednesday_returns_monday() {
        // May 20, 2026 is a Wednesday → Monday = May 18
        let d = NaiveDate::from_ymd_opt(2026, 5, 20).unwrap();
        assert_eq!(week_monday(d), NaiveDate::from_ymd_opt(2026, 5, 18).unwrap());
    }

    #[test]
    fn week_monday_from_monday_returns_same_day() {
        let d = NaiveDate::from_ymd_opt(2026, 5, 18).unwrap();
        assert_eq!(week_monday(d), d);
    }

    #[test]
    fn week_monday_from_sunday_returns_previous_monday() {
        // May 24, 2026 is a Sunday → Monday = May 18
        let d = NaiveDate::from_ymd_opt(2026, 5, 24).unwrap();
        assert_eq!(week_monday(d), NaiveDate::from_ymd_opt(2026, 5, 18).unwrap());
    }

    // ── dedup / sort ─────────────────────────────────────────────────────────

    #[test]
    fn sorted_dedup_removes_duplicates() {
        let v = vec!["b.pdf".to_string(), "a.pdf".to_string(), "b.pdf".to_string()];
        let r = sorted_dedup(v);
        assert_eq!(r, vec!["a.pdf", "b.pdf"]);
    }
}
