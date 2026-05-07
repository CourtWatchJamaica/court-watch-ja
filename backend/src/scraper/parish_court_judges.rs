/// Parish Court case-list scraper.
///
/// Fetches the Drupal taxonomy RSS feed for each parish and extracts PDF URLs
/// from the HTML-escaped <description> field of each <item>.  This is the only
/// data source; no HTML scraping, no seeds, no junk filtering.
use chrono::NaiveDate;
use regex::Regex;
use sqlx::PgPool;
use std::path::Path;
use std::time::Duration;
use tokio::time::sleep;
use tracing::{info, warn};

use super::ScraperState;
use crate::{db::queries, utils::pdf as pdf_utils};

/// One RSS feed per parish.  Term IDs discovered from each parish taxonomy page.
/// Kingston and St. Andrew share a "corporate area" page with no taxonomy RSS feed.
const PARISH_RSS_FEEDS: &[(&str, &str)] = &[
    ("Manchester",    "https://parishcourt.gov.jm/taxonomy/term/2/feed"),
    ("St. Elizabeth", "https://parishcourt.gov.jm/taxonomy/term/3/feed"),
    ("Westmoreland",  "https://parishcourt.gov.jm/taxonomy/term/4/feed"),
    ("Hanover",       "https://parishcourt.gov.jm/taxonomy/term/5/feed"),
    ("St. James",     "https://parishcourt.gov.jm/taxonomy/term/6/feed"),
    ("Trelawny",      "https://parishcourt.gov.jm/taxonomy/term/7/feed"),
    ("St. Ann",       "https://parishcourt.gov.jm/taxonomy/term/8/feed"),
    ("Portland",      "https://parishcourt.gov.jm/taxonomy/term/9/feed"),
    ("Clarendon",     "https://parishcourt.gov.jm/taxonomy/term/10/feed"),
    ("St. Thomas",    "https://parishcourt.gov.jm/taxonomy/term/12/feed"),
    ("St. Mary",      "https://parishcourt.gov.jm/taxonomy/term/16/feed"),
    ("St. Catherine", "https://parishcourt.gov.jm/taxonomy/term/17/feed"),
];

#[derive(Debug)]
struct ParsedRow {
    accused_name: Option<String>,
    offence: Option<String>,
    status: Option<String>,
}

pub async fn run(
    pool: &PgPool,
    state: &mut ScraperState,
    _cutoff: NaiveDate,
    client: &reqwest::Client,
    pdf_dir: &str,
) -> anyhow::Result<usize> {
    info!(
        "[Parish Cases] Starting RSS scrape ({} parish feeds)",
        PARISH_RSS_FEEDS.len()
    );

    let mut total_in_rss = 0usize;
    let mut total_downloaded = 0usize;
    let mut total_inserted = 0usize;

    for (parish, rss_url) in PARISH_RSS_FEEDS {
        sleep(Duration::from_secs(2)).await;
        info!("[Parish Cases] {parish} — fetching {rss_url}");

        let rss_xml = match fetch_text(client, rss_url).await {
            Some(x) => x,
            None => {
                warn!("[Parish Cases] {parish} — RSS fetch failed, skipping");
                continue;
            }
        };

        let pdf_urls = extract_pdf_urls_from_rss(&rss_xml);
        total_in_rss += pdf_urls.len();
        info!(
            "[Parish Cases] {parish} — {} PDF(s) in RSS",
            pdf_urls.len()
        );

        for pdf_url in &pdf_urls {
            if state.parish_case_pdf_already_processed(pdf_url) {
                continue;
            }

            let filename = sanitize_filename(pdf_url);
            info!("[Parish Cases] Downloading {parish} — {filename}");

            let bytes = match pdf_utils::download_pdf(client, pdf_url).await {
                Ok(b) => b,
                Err(e) => {
                    warn!("[Parish Cases] Download failed for {pdf_url}: {e}");
                    continue;
                }
            };

            total_downloaded += 1;

            tokio::fs::create_dir_all(pdf_dir).await.ok();
            let dest = Path::new(pdf_dir).join(&filename);
            if let Err(e) = tokio::fs::write(&dest, &bytes).await {
                warn!("[Parish Cases] Write failed {}: {e}", dest.display());
            }

            let raw_text = extract_text_safe(&bytes, pdf_url);
            if raw_text.trim().is_empty() {
                warn!("[Parish Cases] No text from {filename}");
                state.mark_parish_case_pdf_processed(pdf_url.clone());
                sleep(Duration::from_secs(1)).await;
                continue;
            }

            let preview: String = raw_text.chars().take(1000).collect();
            info!(
                "[Parish Cases] === OCR PREVIEW [{filename}] ===\n{preview}\n=== END ==="
            );

            let text = normalize_ocr_text(&raw_text);
            let rows = parse_case_rows(&text);
            let week_of = date_from_url(pdf_url);

            let mut new_cases = 0usize;
            for row in &rows {
                match queries::upsert_parish_case(
                    pool,
                    parish,
                    row.accused_name.as_deref(),
                    row.offence.as_deref(),
                    row.status.as_deref(),
                    week_of,
                    pdf_url,
                )
                .await
                {
                    Ok(_) => {
                        new_cases += 1;
                        total_inserted += 1;
                    }
                    Err(e) => warn!("[Parish Cases] DB upsert failed: {e}"),
                }
            }

            info!(
                "[Parish Cases] {parish} ({filename}) — {} row(s) parsed, \
                 {new_cases} cases upserted",
                rows.len()
            );

            state.mark_parish_case_pdf_processed(pdf_url.clone());
            sleep(Duration::from_secs(2)).await;
        }
    }

    info!(
        "[Parish Cases] RSS feed found {total_in_rss} PDFs. \
         Downloaded {total_downloaded} new PDFs, {total_inserted} cases upserted."
    );
    Ok(total_inserted)
}

// ── RSS ───────────────────────────────────────────────────────────────────────

/// Pull every `parishcourt.gov.jm/sites/default/files/…pdf` URL from RSS XML.
///
/// In the Drupal RSS feed, PDF URLs appear inside HTML-escaped `<description>`
/// content as `href=&quot;https://parishcourt.gov.jm/sites/default/files/…pdf&quot;`.
/// The character class `[^\s&<>"']` stops cleanly at the `&` of `&quot;`.
fn extract_pdf_urls_from_rss(xml: &str) -> Vec<String> {
    let re = Regex::new(
        r#"https://parishcourt\.gov\.jm/sites/default/files/[^\s&<>"']+\.pdf"#,
    )
    .expect("static regex");
    let mut seen = std::collections::HashSet::new();
    re.find_iter(xml)
        .map(|m| m.as_str().to_string())
        .filter(|u| seen.insert(u.clone()))
        .collect()
}

// ── HTTP ──────────────────────────────────────────────────────────────────────

async fn fetch_text(client: &reqwest::Client, url: &str) -> Option<String> {
    match client.get(url).send().await {
        Ok(r) if r.status().is_success() => match r.text().await {
            Ok(t) => Some(t),
            Err(e) => {
                warn!("[Parish Cases] Failed to read body from {url}: {e}");
                None
            }
        },
        Ok(r) => {
            warn!("[Parish Cases] {url} returned HTTP {} — skipping", r.status());
            None
        }
        Err(e) => {
            warn!("[Parish Cases] Network error for {url}: {e}");
            None
        }
    }
}

// ── Text extraction ───────────────────────────────────────────────────────────

fn extract_text_safe(bytes: &[u8], url: &str) -> String {
    use std::process::Command;

    let tmp_dir = std::env::temp_dir();
    let stem = sanitize_filename(url).replace(".pdf", "");
    let pdf_path = tmp_dir.join(format!("{stem}_pc.pdf"));

    if std::fs::write(&pdf_path, bytes).is_err() {
        return String::new();
    }
    let path_str = pdf_path.to_string_lossy().to_string();

    if let Ok(out) = Command::new("pdftotext")
        .args(["-layout", &path_str, "-"])
        .output()
    {
        if out.status.success() {
            let text = String::from_utf8_lossy(&out.stdout).to_string();
            if text.trim().len() > 50 {
                let _ = std::fs::remove_file(&pdf_path);
                return text;
            }
        }
    }

    let png_base = tmp_dir.join(format!("{stem}_pc_page"));
    let png_base_str = png_base.to_string_lossy().to_string();
    let _ = Command::new("pdftoppm")
        .args(["-r", "200", "-l", "5", &path_str, &png_base_str])
        .output();

    let mut ocr_text = String::new();
    for i in 1..=5 {
        let ppm = tmp_dir.join(format!("{stem}_pc_page-{i:04}.ppm"));
        if !ppm.exists() {
            break;
        }
        if let Ok(out) = Command::new("tesseract")
            .arg(ppm.to_string_lossy().as_ref())
            .arg("stdout")
            .args(["--oem", "1", "--psm", "6"])
            .output()
        {
            if out.status.success() {
                ocr_text.push_str(&String::from_utf8_lossy(&out.stdout));
                ocr_text.push('\n');
            }
        }
        let _ = std::fs::remove_file(&ppm);
    }

    let _ = std::fs::remove_file(&pdf_path);
    ocr_text
}

fn normalize_ocr_text(text: &str) -> String {
    text.lines()
        .map(|l| l.trim())
        .filter(|l| !l.is_empty())
        .collect::<Vec<_>>()
        .join("\n")
}

// ── Date helpers ──────────────────────────────────────────────────────────────

fn date_from_url(url: &str) -> Option<NaiveDate> {
    let decoded = percent_decode(url);
    let filename = decoded.split('/').last().unwrap_or("").to_lowercase();

    let iso = Regex::new(r"(\d{4}-\d{2}-\d{2})").unwrap();
    if let Some(cap) = iso.captures(&filename) {
        if let Ok(d) = NaiveDate::parse_from_str(&cap[1], "%Y-%m-%d") {
            return Some(d);
        }
    }

    let compact = Regex::new(r"(\d{4})(\d{2})(\d{2})").unwrap();
    if let Some(cap) = compact.captures(&filename) {
        let s = format!("{}-{}-{}", &cap[1], &cap[2], &cap[3]);
        if let Ok(d) = NaiveDate::parse_from_str(&s, "%Y-%m-%d") {
            return Some(d);
        }
    }

    let dmy = Regex::new(r"(\d{1,2})\.(\d{1,2})\.(\d{2,4})").unwrap();
    if let Some(cap) = dmy.captures(&filename) {
        let day: u32 = cap[1].parse().ok()?;
        let month: u32 = cap[2].parse().ok()?;
        let year_raw: i32 = cap[3].parse().ok()?;
        let year = if year_raw < 100 { 2000 + year_raw } else { year_raw };
        if let Some(d) = NaiveDate::from_ymd_opt(year, month, day) {
            return Some(d);
        }
    }

    let month_day = Regex::new(
        r"(?i)(jan|feb|mar|apr|may|jun|jul|aug|sep|oct|nov|dec)\w*[\s,]+(\d{1,2})(st|nd|rd|th)?[,\s]+(\d{4})",
    )
    .unwrap();
    if let Some(cap) = month_day.captures(&filename) {
        let month = month_abbr_to_num(&cap[1])?;
        let day: u32 = cap[2].parse().ok()?;
        let year: i32 = cap[4].parse().ok()?;
        if let Some(d) = NaiveDate::from_ymd_opt(year, month, day) {
            return Some(d);
        }
    }

    None
}

fn month_abbr_to_num(abbr: &str) -> Option<u32> {
    match abbr.to_lowercase().as_str() {
        "jan" => Some(1),  "feb" => Some(2),  "mar" => Some(3),
        "apr" => Some(4),  "may" => Some(5),  "jun" => Some(6),
        "jul" => Some(7),  "aug" => Some(8),  "sep" => Some(9),
        "oct" => Some(10), "nov" => Some(11), "dec" => Some(12),
        _ => None,
    }
}

fn percent_decode(s: &str) -> String {
    let mut out = String::with_capacity(s.len());
    let mut chars = s.chars().peekable();
    while let Some(c) = chars.next() {
        if c == '%' {
            let h1 = chars.next().unwrap_or('0');
            let h2 = chars.next().unwrap_or('0');
            if let Ok(byte) = u8::from_str_radix(&format!("{h1}{h2}"), 16) {
                out.push(byte as char);
                continue;
            }
        }
        out.push(c);
    }
    out
}

// ── Filename helper ───────────────────────────────────────────────────────────

fn sanitize_filename(url: &str) -> String {
    let raw = percent_decode(url.split('/').last().unwrap_or("parish_case.pdf"));
    raw.chars()
        .map(|c| {
            if c.is_alphanumeric() || c == '-' || c == '_' || c == '.' {
                c
            } else {
                '_'
            }
        })
        .collect()
}

// ── Case row parser ───────────────────────────────────────────────────────────

/// Parse accused / offence / status rows from OCR text.
///
/// Column boundaries are detected by runs of 3+ spaces/tabs.
/// Name regex accepts title-case and ALL-CAPS.
/// Status codes: 1-5 uppercase letters, optionally slash-separated (CPH, H/A, …).
fn parse_case_rows(text: &str) -> Vec<ParsedRow> {
    let col_sep = Regex::new(r"[ \t]{3,}").unwrap();
    let name_re = Regex::new(r"(?i)^[A-Za-z][A-Za-z'\-]+(,\s*|\s+)[A-Za-z]").unwrap();
    let status_re = Regex::new(r"^[A-Z]{1,5}(/[A-Z]{1,5})?$").unwrap();

    const SKIP_WORDS: &[&str] = &[
        "accused", "offence", "offenses", "status", "plaintiff", "defendant",
        "case no", "court list", "civil list", "criminal list", "matter",
        "division", "parish", "week of", "page ", "continued",
    ];

    let mut rows = Vec::new();

    for raw_line in text.lines() {
        let line = raw_line.trim();
        if line.len() < 5 {
            continue;
        }
        let lower = line.to_lowercase();
        if SKIP_WORDS.iter().any(|kw| lower.contains(kw)) {
            continue;
        }

        let cols: Vec<&str> = col_sep
            .split(line)
            .map(str::trim)
            .filter(|s| !s.is_empty())
            .collect();

        if cols.len() < 2 {
            continue;
        }

        let status_raw = cols[cols.len() - 1];
        if !status_re.is_match(status_raw) {
            continue;
        }

        let first = cols[0];
        if !name_re.is_match(first) {
            continue;
        }

        let (accused_name, offence) = if cols.len() >= 4 && name_re.is_match(cols[1]) {
            let matter = cols[2..cols.len() - 1].join(" ");
            (
                format!("{} v {}", title_case(first), title_case(cols[1])),
                matter,
            )
        } else if cols.len() >= 3 {
            (title_case(first), cols[1..cols.len() - 1].join(" "))
        } else {
            (title_case(first), String::new())
        };

        if accused_name.split_whitespace().count() < 2 {
            continue;
        }

        rows.push(ParsedRow {
            accused_name: Some(accused_name),
            offence: if offence.trim().is_empty() {
                None
            } else {
                Some(offence.trim().to_string())
            },
            status: Some(status_raw.to_string()),
        });
    }

    rows
}

fn title_case(s: &str) -> String {
    s.split_whitespace()
        .map(|word| {
            let (core, suffix) = if word.ends_with(',') {
                (&word[..word.len() - 1], ",")
            } else {
                (word, "")
            };
            let mut chars = core.chars();
            let titled = match chars.next() {
                None => String::new(),
                Some(f) => f.to_uppercase().collect::<String>() + &chars.as_str().to_lowercase(),
            };
            format!("{titled}{suffix}")
        })
        .collect::<Vec<_>>()
        .join(" ")
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn parses_title_case_criminal_rows() {
        let ocr = "\
Riley, Coleman                         Unlawful wounding                          M
Harrison, Micheal                      Unlawful wounding                          M
Henderson, Ackiem                      Resisting Arrest                           M
Smith, John Edward                     Assault occasioning actual bodily harm      H
Brown, Peter                           Larceny                                    CPH
";
        let rows = parse_case_rows(ocr);
        assert_eq!(rows.len(), 5, "expected 5 rows, got {}: {rows:?}", rows.len());
        assert_eq!(rows[0].accused_name.as_deref(), Some("Riley, Coleman"));
        assert_eq!(rows[0].offence.as_deref(), Some("Unlawful wounding"));
        assert_eq!(rows[0].status.as_deref(), Some("M"));
        assert_eq!(rows[3].offence.as_deref(), Some("Assault occasioning actual bodily harm"));
        assert_eq!(rows[4].status.as_deref(), Some("CPH"));
    }

    #[test]
    fn skips_header_lines() {
        let ocr = "\
ACCUSED                                OFFENCE                                    STATUS
Riley, Coleman                         Unlawful wounding                          M
COURT LIST - CIVIL DIVISION
";
        let rows = parse_case_rows(ocr);
        assert_eq!(rows.len(), 1);
    }

    #[test]
    fn parses_allcaps_names() {
        let ocr =
            "WILLIAMS, DWAYNE                       Ganja possession                           M\n";
        let rows = parse_case_rows(ocr);
        assert_eq!(rows.len(), 1);
        assert_eq!(rows[0].accused_name.as_deref(), Some("Williams, Dwayne"));
    }

    #[test]
    fn extracts_pdf_urls_from_rss() {
        let xml = r#"<description>&lt;a href=&quot;https://parishcourt.gov.jm/sites/default/files/Hanover%20Criminal%20Division%20158.pdf&quot; type=&quot;application/pdf&quot;&gt;Hanover Criminal Division 158.pdf&lt;/a&gt;</description>"#;
        let urls = extract_pdf_urls_from_rss(xml);
        assert_eq!(urls.len(), 1);
        assert!(urls[0].ends_with("Hanover%20Criminal%20Division%20158.pdf"));
    }

    #[test]
    fn deduplicates_rss_urls() {
        let url = "https://parishcourt.gov.jm/sites/default/files/Test.pdf";
        let xml = format!("{url} {url}");
        let urls = extract_pdf_urls_from_rss(&xml);
        assert_eq!(urls.len(), 1);
    }
}
