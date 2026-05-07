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

    // Presiding judge — try Drupal field selectors (SC + CoA variants)
    'judge: for sel_str in &[
        ".field--name-field-presiding-judge .field__item",
        ".field--name-field-coram .field__item",
        ".field--name-field-bench .field__item",
        ".field--name-field-judge .field__item",
    ] {
        if let Ok(sel) = Selector::parse(sel_str) {
            if let Some(el) = doc.select(&sel).next() {
                let text = el.text().collect::<String>().trim().to_string();
                // Guard: non-empty, not a blob of body prose
                if !text.is_empty() && text.len() < 300 {
                    detail.judge_name = Some(text);
                    break 'judge;
                }
            }
        }
    }

    // Fallback: "CORAM: …" pattern in the judgment body (common on CoA pages)
    if detail.judge_name.is_none() {
        if let Some(ref body) = detail.summary_text {
            detail.judge_name = extract_coram_from_text(body);
        }
    }

    detail
}

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
    // collect_hon_lines only reads the first 25 lines it encounters, so this
    // is fast even on large PDFs. We scan the full text (not a fixed byte
    // prefix) because "NOTICE TO PARTIES" documents place the BEFORE: block
    // well past the first 3 000 bytes.
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
