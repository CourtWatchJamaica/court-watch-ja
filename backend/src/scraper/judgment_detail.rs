/// Fetches a single judgment detail page and extracts structured data.
///
/// The Supreme Court website uses Drupal field divs:
///   .field--name-field-case-number .field__item  → case number
///   .field--name-field-presiding-judge .field__item → judge name
///   .field--name-field-date-of-delivery .field__item → date
///   .field--name-field-pdf-link a[href]          → PDF URL
///   .field--name-body .field__item               → summary text
///
/// For Court of Appeal detail pages the presiding judge may not be in a
/// dedicated Drupal field; we fall back to a "CORAM: …" pattern in the body.
use scraper::{Html, Selector};

#[derive(Debug, Default)]
pub struct JudgmentDetail {
    pub pdf_url: Option<String>,
    pub summary_text: Option<String>,
    /// Presiding judge name(s).  Populated from a Drupal field when present;
    /// otherwise extracted from a "CORAM: …" line in the judgment body.
    pub judge_name: Option<String>,
}

pub async fn fetch(
    client: &reqwest::Client,
    url: &str,
    case_number: &str,
) -> anyhow::Result<JudgmentDetail> {
    let html = client.get(url).send().await?.error_for_status()?.text().await?;
    let is_coa = url.contains("courtofappeal");

    let parsed = parse_page(&html, is_coa);

    let pdf_url = if parsed.pdf_candidates.is_empty() {
        tracing::warn!("detail: no PDF links on {url} for case {case_number}");
        None
    } else {
        let verified = find_verified_pdf(client, &parsed.pdf_candidates, case_number).await;
        if verified.is_none() {
            tracing::warn!(
                "detail: no PDF candidate matched case {case_number} on {url} — leaving pdf_url=NULL"
            );
        }
        verified
    };

    Ok(JudgmentDetail {
        pdf_url,
        summary_text: parsed.summary_text,
        judge_name: parsed.judge_name,
    })
}

// ── Internal page parser ──────────────────────────────────────────────────────

struct ParsedPage {
    pdf_candidates: Vec<String>,
    summary_text: Option<String>,
    judge_name: Option<String>,
}

fn parse_page(html: &str, is_coa: bool) -> ParsedPage {
    let doc = Html::parse_document(html);

    // Collect ALL PDF hrefs, deduplicated, resolving to absolute URLs.
    //
    // Selector priority (most-specific first):
    //   1. span.file--mime-application-pdf a  — SC Drupal file renderer; only matches
    //      the actual judgment attachment, never sidebar/nav PDFs.
    //   2. span.file--application-pdf a       — same element, alternate class name.
    //   3. .field--name-field-pdf-link a      — CoA Drupal content-field pattern.
    //   4. .field--name-field-attachment a    — another CoA field variant.
    //   5. a[href$='.pdf']                    — broad fallback; also matches nav PDFs.
    let mut seen = std::collections::HashSet::<String>::new();
    let mut pdf_candidates = Vec::new();
    for sel_str in &[
        "span.file--mime-application-pdf a",
        "span.file--application-pdf a",
        ".field--name-field-pdf-link a",
        ".field--name-field-attachment a",
        "a[href$='.pdf']",
    ] {
        if let Ok(sel) = Selector::parse(sel_str) {
            for a in doc.select(&sel) {
                if let Some(href) = a.value().attr("href") {
                    let resolved = if is_coa {
                        normalize_coa_url(href)
                    } else if href.starts_with("http") {
                        href.to_string()
                    } else {
                        format!("https://supremecourt.gov.jm{href}")
                    };
                    if seen.insert(resolved.clone()) {
                        pdf_candidates.push(resolved);
                    }
                }
            }
        }
    }

    // Summary / body text
    let mut summary_text = None;
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
                    summary_text = Some(trimmed);
                    break;
                }
            }
        }
    }

    // Presiding judge — try Drupal field selectors (SC + CoA variants)
    let mut judge_name = None;
    'judge: for sel_str in &[
        ".field--name-field-presiding-judge .field__item",
        ".field--name-field-coram .field__item",
        ".field--name-field-bench .field__item",
        ".field--name-field-judge .field__item",
    ] {
        if let Ok(sel) = Selector::parse(sel_str) {
            if let Some(el) = doc.select(&sel).next() {
                let text = el.text().collect::<String>().trim().to_string();
                if !text.is_empty() && text.len() < 300 {
                    judge_name = Some(text);
                    break 'judge;
                }
            }
        }
    }
    // Fallback: "CORAM: …" pattern in the judgment body (common on CoA pages)
    if judge_name.is_none() {
        if let Some(ref body) = summary_text {
            judge_name = extract_coram_from_text(body);
        }
    }

    ParsedPage { pdf_candidates, summary_text, judge_name }
}

/// Download each PDF candidate and return the first whose text contains `case_number`.
///
/// Fallback strategy (in priority order):
///   1. Positively verified: PDF text contains the case number.
///   2. First successfully-downloaded candidate if no candidate verifies — a
///      wrong-PDF warning in the logs is better than a silent NULL.  Because the
///      candidate list is ordered with the most-specific selector first (the
///      actual judgment attachment span), the first downloaded candidate is
///      almost always the correct judgment PDF even when verification fails.
async fn find_verified_pdf(
    client: &reqwest::Client,
    candidates: &[String],
    case_number: &str,
) -> Option<String> {
    use crate::utils::pdf as pdf_utils;

    // First candidate that downloads successfully (set before text extraction).
    let mut first_downloaded: Option<String> = None;

    for url in candidates {
        if !url.starts_with("http") {
            continue;
        }
        let bytes = match pdf_utils::download_pdf(client, url).await {
            Ok(b) => b,
            Err(e) => {
                tracing::warn!("detail: failed to fetch PDF candidate {url}: {e}");
                continue;
            }
        };

        // Record the first candidate that downloads, regardless of what happens next.
        if first_downloaded.is_none() {
            first_downloaded = Some(url.clone());
        }

        let text_opt = pdf_utils::extract_text_from_bytes(&bytes)
            .ok()
            .filter(|t| !t.trim().is_empty())
            .or_else(|| pdf_utils::extract_text_ocr(&bytes));

        let Some(text) = text_opt else {
            tracing::warn!("detail: no text extracted from PDF candidate {url}");
            continue;
        };

        if pdf_utils::pdf_contains_case_number(&text, case_number) {
            return Some(url.clone());
        }

        tracing::warn!(
            "detail: PDF {url} does not contain case number {case_number} — trying next"
        );
    }

    // No positive match — fall back to the first downloaded candidate.
    if let Some(ref fallback) = first_downloaded {
        tracing::warn!(
            "detail: no verified PDF for {case_number} — using first downloaded as fallback: {fallback}"
        );
    }
    first_downloaded
}

// ── CoA URL normalisation ─────────────────────────────────────────────────────

/// Normalise Court of Appeal PDF URLs.
/// Removes /index.php path prefix and rewrites to the canonical non-www origin.
fn normalize_coa_url(u: &str) -> String {
    const PDF_BASE: &str = "https://courtofappeal.gov.jm";
    if u.starts_with("http") {
        u.replace("https://www.courtofappeal.gov.jm/index.php", PDF_BASE)
            .replace("http://www.courtofappeal.gov.jm/index.php", PDF_BASE)
            .replace("https://www.courtofappeal.gov.jm", PDF_BASE)
    } else {
        let path = u.strip_prefix("/index.php").unwrap_or(u);
        format!("{PDF_BASE}{path}")
    }
}

// ── CORAM extraction (public — used by runner.rs for judge backfill) ──────────

/// Extract judge names from arbitrary text (HTML body or PDF text).
///
/// Jamaican CoA PDFs use a `BEFORE:` header (not `CORAM:`), followed by
/// `THE HON [MRS/MR/MISS] JUSTICE <Name> JA` lines.  This function tries
/// that pattern first, then falls back to `CORAM:`, then a broad scan.
///
/// Returns a comma-separated string of cleaned judge names, or `None`.
pub fn extract_coram_from_text(text: &str) -> Option<String> {
    // 1. BEFORE: — actual format used in Jamaican CoA PDFs
    if let Some(after) = find_keyword(text, "BEFORE:") {
        let names = collect_hon_lines(after);
        if !names.is_empty() {
            return Some(names.join(", "));
        }
    }

    // 2. CORAM: — used on some older / SC documents
    if let Some(after) = find_keyword(text, "CORAM:") {
        let names = collect_hon_lines(after);
        if !names.is_empty() {
            return Some(names.join(", "));
        }
    }

    // 3. Broad scan of the entire text for consecutive THE HON JUSTICE lines.
    let names = collect_hon_lines(text);
    if !names.is_empty() {
        return Some(names.join(", "));
    }

    None
}

/// Find a keyword case-insensitively and return the text that follows it.
fn find_keyword<'a>(text: &'a str, keyword: &str) -> Option<&'a str> {
    let lower = text.to_lowercase();
    let kw = keyword.to_lowercase();
    let pos = lower.find(&kw)?;
    Some(&text[pos + keyword.len()..])
}

/// Scan lines for `THE HON … JUSTICE <Name>` patterns, stopping at the first
/// blank line that follows the names, or at any non-matching non-blank line.
fn collect_hon_lines(text: &str) -> Vec<String> {
    let mut names = Vec::new();

    for line in text.lines().take(25) {
        let trimmed = line.trim();

        if trimmed.is_empty() {
            if names.is_empty() {
                continue; // blank before first name — OK
            } else {
                break; // blank after names — done
            }
        }

        let upper = trimmed.to_uppercase();
        // Strip inline "BEFORE:" prefix (handles "BEFORE: THE HON MR JUSTICE…")
        let check = upper
            .trim_start_matches("BEFORE:")
            .trim()
            .to_string();

        if check.starts_with("THE HON") {
            if let Some(name) = clean_hon_line(&check) {
                names.push(name);
            }
        } else if !names.is_empty() {
            break; // non-blank, non-HON line after names → stop
        }
        // if names is still empty and line doesn't match, keep scanning
    }

    names
}

/// Strip the title prefix from an uppercase judge line and return a
/// title-cased name string, e.g. `"THE HON MRS JUSTICE DUNBAR GREEN JA"`
/// → `"Dunbar Green JA"`.
fn clean_hon_line(upper_line: &str) -> Option<String> {
    const PREFIXES: &[&str] = &[
        "THE HONOURABLE MRS JUSTICE ",
        "THE HONOURABLE MR JUSTICE ",
        "THE HONOURABLE MISS JUSTICE ",
        "THE HONOURABLE MS JUSTICE ",
        "THE HONOURABLE DR JUSTICE ",
        "THE HONOURABLE JUSTICE ",
        "THE HON MRS JUSTICE ",
        "THE HON MR JUSTICE ",
        "THE HON MISS JUSTICE ",
        "THE HON MS JUSTICE ",
        "THE HON DR JUSTICE ",
        "THE HON JUSTICE ",
        "THE HON MRS DR JUSTICE ",
        "THE HON MR DR JUSTICE ",
        "THE HON ",
    ];

    let name_upper = PREFIXES
        .iter()
        .find_map(|p| upper_line.strip_prefix(p))
        .unwrap_or(upper_line)
        .trim();

    if name_upper.len() < 2 {
        return None;
    }

    let titled = title_case_judge(name_upper);
    if titled.trim().is_empty() {
        None
    } else {
        Some(titled)
    }
}

/// Title-case a judge name string, keeping known uppercase suffixes intact.
///
/// `"DUNBAR GREEN JA"` → `"Dunbar Green JA"`
/// `"G FRASER JA (AG)"` → `"G Fraser JA (AG)"`
fn title_case_judge(s: &str) -> String {
    const KEEP_UPPER: &[&str] = &[
        "JA", "P", "AG", "JSC", "CCJ", "CJ", "JCJ", "DPP", "QC", "KC",
    ];

    s.split_whitespace()
        .map(|word| {
            // Parenthesized suffixes like (AG)
            if word.len() >= 3 && word.starts_with('(') && word.ends_with(')') {
                let inner = &word[1..word.len() - 1];
                if KEEP_UPPER.contains(&inner) {
                    return word.to_string();
                }
            }
            if KEEP_UPPER.contains(&word) {
                return word.to_string();
            }
            let mut chars = word.chars();
            match chars.next() {
                None => String::new(),
                Some(first) => {
                    first.to_uppercase().collect::<String>()
                        + &chars.as_str().to_lowercase()
                }
            }
        })
        .collect::<Vec<_>>()
        .join(" ")
}
