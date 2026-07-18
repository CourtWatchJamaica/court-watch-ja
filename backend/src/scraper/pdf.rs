/// Parses court-list PDF text into structured sitting entries.
///
/// Handles two real-world formats found in Jamaican Supreme Court PDFs:
///
/// FORMAT A — Commercial Division (scanned image PDFs, OCR'd):
///   MONDAY 27TH APRIL 2026
///   COR: THE HONOURABLE MRS. JUSTICE S. JACKSON-HAISLEY
///   10:00 a.m.
///   SU2022CD00537    Morrison & Anor  v  National People's Coop Bank  Trial (part heard)
///   AND                                                                 Chambers of Simister Law:
///   SU2023CD00134                                                       Jerome D. Spencer
///   CONSOLIDATED (1 day)
///
/// FORMAT B — Civil Division (digital PDFs):
///   ACTION MATTERS
///   2024/HCV/00123
///   Smith v. Brown
///   Before: The Honourable Justice McDonald-Bishop
///   Counsel: Mr. Jones for Claimant
///   10:00 AM
use chrono::{NaiveDate, NaiveTime};
use regex::Regex;

/// Version of the court-list parsing logic.
///
/// Bump this whenever `parse_court_list_text` (or its helpers) is changed in a
/// way that could extract entries a previous version missed.  The startup
/// backfill re-parses every locally saved court-list PDF whose recorded
/// parser_version is older than this, so historical sittings dropped by an old
/// parser bug are recovered automatically — even after the source PDF has been
/// removed from the court website.
///
/// Version history:
///   1 — original parser (no legacy `2016HCV05029`-style case numbers).
///   2 — legacy year-first case numbers, Masters' matters, expanded sections.
pub const PARSER_VERSION: i32 = 2;

#[derive(Debug, Clone, Default)]
pub struct SittingEntry {
    pub case_number: Option<String>,
    pub title: Option<String>,
    pub judge_name: Option<String>,
    pub event_type: Option<String>,
    pub event_date: Option<NaiveDate>,
    pub event_time: Option<NaiveTime>,
    pub lawyers: Option<String>,
    pub division: Option<String>,
}

pub fn parse_court_list_text(text: &str, pdf_date: Option<NaiveDate>) -> Vec<SittingEntry> {
    // ── Regex compilation (once per call; each PDF is processed once) ─────────
    //
    // Commercial case number: SU2022CD00537
    //   Prefix 1-4 uppercase, 4-digit year, division 1-4 uppercase, 3-6 digit serial.
    //   OCR may insert spaces — normalize_ocr_text() collapses those before we get here,
    //   but keep some tolerance just in case.
    let re_case_com = Regex::new(
        r"(?-i)\b([A-Z]{1,4})(\d{4})([A-Z]{1,4})(\d{3,6})\b"
    )
    .unwrap();

    // Civil case number (slash format): 2024/HCV/00123
    let re_case_civ = Regex::new(r"\b(\d{4})/([A-Z]+)/(\d+[A-Z]?)\b").unwrap();

    // Legacy civil case number (year-first, no slashes): 2016HCV05029
    //   Used for pre-2019 HCV/FD/CD/M cases and all Master's court matters.
    //   Pattern: 4-digit year, 1-4 uppercase division letters, 4-6 digit serial.
    //   normalize_ocr_text() collapses any OCR spaces before we reach this check.
    let re_case_legacy = Regex::new(r"(?-i)\b(\d{4})([A-Z]{1,4})(\d{4,6})\b").unwrap();

    // Day-of-week date header: "MONDAY 27TH APRIL 2026" or "WEDNESDAY 29TH APRIL 2026"
    let re_day_header = Regex::new(
        r"(?i)\b(?:MON(?:DAY)?|TUE(?:SDAY)?|WED(?:NESDAY)?|THU(?:RSDAY)?|FRI(?:DAY)?|SAT(?:URDAY)?|SUN(?:DAY)?)[,.]?\s+(\d{1,2})(?:ST|ND|RD|TH)?[,.]?\s+(\w+)[,.]?\s+(\d{4})\b"
    )
    .unwrap();

    // COR: line (Commercial Division judge)
    let re_cor = Regex::new(r"(?i)^COR\s*:?\s*(.+)").unwrap();

    // Before: line (Civil/CoA Division judge)
    // Uses (.*) so a bare "BEFORE:" line (no name on same line) also matches —
    // the empty capture triggers before_pending mode to collect names from subsequent lines.
    let re_before = Regex::new(r"(?i)^Before\s*:\s*(.*)").unwrap();

    // Counsel / Attorney line
    let re_counsel = Regex::new(r"(?i)^(?:Counsel|Attorney)s?\s*:\s*(.+)").unwrap();

    // Time: "10:00 a.m.", "2:00 p.m.", "10.00 AM"
    let re_time = Regex::new(
        r"(?i)\b(\d{1,2})[:.]\s*(\d{2})\s*(a\.?\s*m\.?|p\.?\s*m\.?)"
    )
    .unwrap();

    // Section header (Format B) — expanded to cover more Jamaican court PDF headings.
    let re_section = Regex::new(
        r"(?i)^(ACTION MATTERS?|MOTIONS?|CHAMBERS? MATTERS?|VIDEO CONFERENCE|COMMERCIAL LIST\
|FIXED DATE CLAIMS?|PETITIONS?|JUDGMENT DELIVER(?:Y|IES)|ASSESSMENT OF DAMAGES?\
|PART[- ]HEARD(?:\s+TRIALS?)?|URGENT MATTERS?|WINDING[- ]UP(?:\s+MATTERS?)?\
|COMPANY MATTERS?|PROBATE MATTERS?|ADMIRALTY MATTERS?|TAXATION MATTERS?\
|FAMILY MATTERS?|BANKRUPTCY(?:\s+MATTERS?)?|INTERLOCUTORY(?:\s+APPLICATIONS?)?\
|RULE 42(?:\s+APPLICATIONS?)?)",
    )
    .unwrap();

    // ── State ─────────────────────────────────────────────────────────────────
    let mut entries: Vec<SittingEntry> = Vec::new();
    let mut current = SittingEntry { event_date: pdf_date, ..Default::default() };

    let mut current_date: Option<NaiveDate> = pdf_date;
    let mut current_judge: Option<String> = None;
    let mut current_time: Option<NaiveTime> = None;
    let mut current_section: Option<String> = None;
    let mut current_division: Option<String> = None;
    let mut skip_next_case = false; // true after "AND" — consolidated secondary case
    // CoA PDFs often have "BEFORE:" on its own line followed by judge names.
    // When true, the next "THE HON…" lines are collected as the current judge.
    let mut before_pending = false;

    for raw in text.lines() {
        let line = raw.trim();
        if line.is_empty() {
            continue;
        }

        // ── Division header — must come BEFORE noise filter because some
        //    division strings (e.g. "CIVIL DIVISION") were previously silenced
        //    as noise, preventing division tracking.
        if let Some(div) = detect_division_header(line) {
            flush(&mut current, &mut entries, &current_judge);
            current_division = Some(div.to_string());
            continue;
        }

        // ── Structural noise: skip lines that carry no sitting data ───────────
        if is_noise(line) {
            continue;
        }

        // ── BEFORE: on its own line — collect following judge-name lines ──────
        // CoA PDFs use "BEFORE:" alone then list "THE HON … JUSTICE …" on the next lines.
        if before_pending {
            let upper = line.to_uppercase();
            if upper.starts_with("THE HON") {
                current_judge = Some(clean_judge_name(line));
                continue; // keep before_pending — more judges may follow
            }
            before_pending = false; // non-judge line ends the block; fall through
        }

        // ── Day-header date: update context for all subsequent entries ────────
        if let Some(date) = try_parse_day_header(line, &re_day_header) {
            current_date = Some(date);
            continue;
        }

        // ── Format-B section header ───────────────────────────────────────────
        if re_section.is_match(line) {
            flush(&mut current, &mut entries, &current_judge);
            current_section = Some(normalize_section(line));
            continue;
        }

        // ── Judge — COR: (Commercial) ─────────────────────────────────────────
        if let Some(cap) = re_cor.captures(line) {
            // Guard: must actually start with COR (the regex anchors with ^)
            current_judge = Some(clean_judge_name(cap[1].trim()));
            continue;
        }

        // ── Judge — Before: (Civil/CoA) ──────────────────────────────────────
        if let Some(cap) = re_before.captures(line) {
            let captured = cap[1].trim();
            if captured.is_empty() {
                // "BEFORE:" alone — judge names appear on the following lines
                before_pending = true;
            } else {
                current_judge = Some(clean_judge_name(captured));
                before_pending = false;
            }
            continue;
        }

        // ── Time ──────────────────────────────────────────────────────────────
        if let Some(time) = try_parse_time(line, &re_time) {
            current_time = Some(time);
            continue;
        }

        // ── "AND" keyword → next case number is a consolidated secondary ──────
        if line.eq_ignore_ascii_case("AND") {
            skip_next_case = true;
            continue;
        }

        // ── Civil case number — slash format (checked first) ──────────────────
        if let Some(case_num) = try_extract_civil(line, &re_case_civ) {
            if skip_next_case {
                skip_next_case = false;
                continue;
            }
            flush(&mut current, &mut entries, &current_judge);
            current = new_entry(case_num, current_date, current_time, &current_judge, &current_section, &current_division);
            skip_next_case = false;
            continue;
        }

        // ── Legacy civil case number — year-first, no slashes ─────────────────
        // Handles pre-2019 HCV/FD/CD/M cases: 2016HCV05029, 2012M02155, etc.
        if let Some(case_num) = try_extract_legacy_civil(line, &re_case_legacy) {
            if skip_next_case {
                skip_next_case = false;
                continue;
            }
            flush(&mut current, &mut entries, &current_judge);
            current = new_entry(case_num, current_date, current_time, &current_judge, &current_section, &current_division);
            skip_next_case = false;
            continue;
        }

        // ── Commercial case number — SU-prefix format ─────────────────────────
        if let Some(case_num) = try_extract_commercial(line, &re_case_com) {
            if skip_next_case {
                skip_next_case = false;
                continue;
            }
            flush(&mut current, &mut entries, &current_judge);
            current = new_entry(case_num, current_date, current_time, &current_judge, &current_section, &current_division);
            skip_next_case = false;
            continue;
        }

        skip_next_case = false;

        // ── Counsel / Attorney line ───────────────────────────────────────────
        if let Some(cap) = re_counsel.captures(line) {
            current.lawyers = Some(cap[1].trim().to_string());
            continue;
        }

        // ── "v" / "vs" separator → title ─────────────────────────────────────
        if contains_versus(line) && current.title.is_none() {
            current.title = Some(clean_title(line));
            continue;
        }

        // ── Event type from keywords ──────────────────────────────────────────
        if let Some(evt) = detect_event_type(line) {
            if current.event_type.is_none() {
                current.event_type = Some(evt.to_string());
            }
            continue;
        }

        // ── Lawyer / firm / chambers lines ───────────────────────────────────
        if current.case_number.is_some() && looks_like_lawyers(line) {
            let lawyers = current.lawyers.get_or_insert_with(String::new);
            if !lawyers.is_empty() {
                lawyers.push_str("; ");
            }
            lawyers.push_str(line);
            continue;
        }

        // ── Fallback: first unparsed line after a case number may be the title
        if current.case_number.is_some() && current.title.is_none() && !line_is_directive(line) {
            current.title = Some(line.to_string());
        }
    }

    flush(&mut current, &mut entries, &current_judge);
    entries
}

// ── Helpers ───────────────────────────────────────────────────────────────────

fn new_entry(
    case_num: String,
    date: Option<NaiveDate>,
    time: Option<NaiveTime>,
    judge: &Option<String>,
    section: &Option<String>,
    division: &Option<String>,
) -> SittingEntry {
    SittingEntry {
        case_number: Some(case_num),
        event_date: date,
        event_time: time,
        judge_name: judge.clone(),
        event_type: section.clone(),
        division: division.clone(),
        ..Default::default()
    }
}

fn flush(current: &mut SittingEntry, entries: &mut Vec<SittingEntry>, fallback_judge: &Option<String>) {
    if current.case_number.is_some() || current.title.is_some() {
        if current.judge_name.is_none() {
            current.judge_name = fallback_judge.clone();
        }
        entries.push(std::mem::take(current));
    }
}

fn try_parse_day_header(line: &str, re: &Regex) -> Option<NaiveDate> {
    let cap = re.captures(line)?;
    // Strip ordinal suffix (ST/ND/RD/TH) already eaten by the regex non-capturing group;
    // cap[1] is the bare day digit(s).
    let day: u32 = cap[1].parse().ok()?;
    let month = parse_month(&cap[2])?;
    let year: i32 = cap[3].parse().ok()?;
    NaiveDate::from_ymd_opt(year, month, day)
}

fn parse_month(s: &str) -> Option<u32> {
    match s.to_uppercase().as_str() {
        "JANUARY" | "JAN" => Some(1),
        "FEBRUARY" | "FEB" => Some(2),
        "MARCH" | "MAR" => Some(3),
        "APRIL" | "APR" => Some(4),
        "MAY" => Some(5),
        "JUNE" | "JUN" => Some(6),
        "JULY" | "JUL" => Some(7),
        "AUGUST" | "AUG" => Some(8),
        "SEPTEMBER" | "SEP" | "SEPT" => Some(9),
        "OCTOBER" | "OCT" => Some(10),
        "NOVEMBER" | "NOV" => Some(11),
        "DECEMBER" | "DEC" => Some(12),
        _ => None,
    }
}

fn try_parse_time(line: &str, re: &Regex) -> Option<NaiveTime> {
    let cap = re.captures(line)?;
    let hour: u32 = cap[1].parse().ok()?;
    let min: u32 = cap[2].parse().ok()?;
    let meridiem = cap[3].replace(['.', ' '], "").to_uppercase();
    let hour24 = match meridiem.as_str() {
        "PM" if hour != 12 => hour + 12,
        "AM" if hour == 12 => 0,
        _ => hour,
    };
    NaiveTime::from_hms_opt(hour24, min, 0)
}

fn try_extract_civil(line: &str, re: &Regex) -> Option<String> {
    let cap = re.captures(line)?;
    Some(format!("{}/{}/{}", &cap[1], cap[2].to_uppercase(), &cap[3]))
}

/// Matches year-first no-slash case numbers: 2016HCV05029, 2012M02155, 2014FD00234.
/// Returns the case number as-is (no slashes added) to match how the SC website
/// stores and displays pre-2019 cases.
fn try_extract_legacy_civil(line: &str, re: &Regex) -> Option<String> {
    let cap = re.captures(line)?;
    let year: u32 = cap[1].parse().ok()?;
    if year < 2000 || year > 2035 {
        return None;
    }
    let div = cap[2].to_uppercase();
    // Exclude month name abbreviations (e.g. "2026MAY18" is a date, not a case number).
    if matches!(
        div.as_str(),
        "JAN" | "FEB" | "MAR" | "APR" | "MAY" | "JUN" | "JUL" | "AUG" | "SEP" | "OCT" | "NOV" | "DEC"
    ) {
        return None;
    }
    Some(format!("{year}{div}{}", &cap[3]))
}

fn try_extract_commercial(line: &str, re: &Regex) -> Option<String> {
    let cap = re.captures(line)?;
    let prefix = cap[1].to_uppercase();
    let year: u32 = cap[2].parse().ok()?;
    let div = cap[3].to_uppercase();
    let num_raw = &cap[4];

    // Sanity: reject false positives (e.g. "APRIL2026" has no division block)
    if year < 2000 || year > 2035 { return None; }
    if prefix.len() < 2 { return None; }
    if div.len() < 2 { return None; }

    // Fix OCR digit confusion in the serial number (O→0, I/l→1)
    let num: String = num_raw.chars().map(|c| match c {
        'O' | 'o' => '0',
        'I' | 'l' => '1',
        _ => c,
    }).collect();

    Some(format!("{prefix}{year}{div}{num}"))
}

fn is_noise(line: &str) -> bool {
    let upper = line.to_uppercase();
    // Document / page header boilerplate
    if upper.contains("SUPREME COURT OF JUDICATURE") { return true; }
    if upper.contains("COURT OF APPEAL") && upper.contains("JAMAICA") { return true; }
    // Per-page footer printed at the bottom of every page in Criminal/Gun Court PDFs:
    // "Supreme Court Listing for the week 18th,MAY 2026"
    if upper.starts_with("SUPREME COURT LISTING") { return true; }
    if upper.starts_with("LIST OF SITTINGS") { return true; }
    if upper.starts_with("CAUSE LIST") || upper.starts_with("COURT LIST") { return true; }
    if upper == "IN OPEN COURT" || upper == "IN CHAMBERS" { return true; }
    // Courtroom line (we don't use it; judge comes from COR:)
    if upper.starts_with("COURTROOM NO") { return true; }
    if upper.starts_with("CLERK") { return true; }
    // Consolidated/duration labels
    if upper == "CONSOLIDATED" { return true; }
    if upper.starts_with('(') && upper.ends_with(')') { return true; } // (1 day), (1 hr)
    // Page number lines: "PAGE 3", "- 3 -", lone digits
    if upper.starts_with("PAGE ") { return true; }
    if line.chars().all(|c| c.is_ascii_digit() || c == '-' || c == ' ') && line.len() <= 6 {
        return true;
    }
    // Week / schedule header lines
    if upper.starts_with("WEEK COMMENCING") { return true; }
    // Divider / rule lines
    if line.len() >= 3 && line.chars().all(|c| matches!(c, '-' | '=' | '_' | '*' | '~')) {
        return true;
    }
    // Very short lines (single characters, stray punctuation)
    if line.len() <= 2 { return true; }
    false
}

// Detects a division-level heading that scopes all subsequent case entries.
// Called BEFORE is_noise so these headers are captured rather than discarded.
fn detect_division_header(line: &str) -> Option<&'static str> {
    let upper = line.trim().to_uppercase();
    if upper == "CIVIL DIVISION" { return Some("Civil"); }
    if upper.starts_with("CRIMINAL DIVISION") { return Some("Criminal"); }
    if upper == "COMMERCIAL DIVISION" { return Some("Commercial"); }
    if upper.contains("PROBATE") && upper.contains("FAMILY") { return Some("Probate and Family"); }
    if upper == "PROBATE DIVISION" { return Some("Probate"); }
    if upper == "FAMILY DIVISION" { return Some("Family"); }
    if upper.contains("GUN COURT") { return Some("Gun Court"); }
    if upper == "DIVORCE DIVISION" { return Some("Divorce"); }
    if upper == "ADMIRALTY DIVISION" { return Some("Admiralty"); }
    if upper.contains("REVENUE COURT") { return Some("Revenue"); }
    if upper.contains("INTELLECTUAL PROPERTY") && upper.contains("DIVISION") {
        return Some("Intellectual Property");
    }
    if upper.contains("CONSTITUTIONAL") && upper.contains("DIVISION") {
        return Some("Constitutional");
    }
    // "COURT I - GANG MATTER" style courtroom headers appear within the Gun Court
    if upper.starts_with("COURT ") && upper.contains("GANG") { return Some("Gun Court"); }
    None
}

fn contains_versus(line: &str) -> bool {
    // " v " or " v. " covers most cases; also handle standalone "v" on its own line
    // and OCR variants like "V" (uppercase) or "vs".
    line.contains(" v ")
        || line.contains(" v. ")
        || line.contains(" vs ")
        || line.contains(" vs. ")
        || line.contains(" V ")
        || line.eq_ignore_ascii_case("v")
        || line.eq_ignore_ascii_case("v.")
}

fn clean_title(line: &str) -> String {
    // Collapse multiple spaces (common in OCR column output)
    line.split_whitespace().collect::<Vec<_>>().join(" ")
}

fn detect_event_type(line: &str) -> Option<&'static str> {
    let lower = line.to_lowercase();
    // More specific phrases first
    if lower.contains("part heard") { return Some("Trial (part heard)"); }
    if lower.contains("trial") { return Some("Trial"); }
    if lower.contains("committal") { return Some("Committal proceedings"); }
    if lower.contains("assessment of damages") { return Some("Assessment of damages"); }
    if lower.contains("assessment") { return Some("Assessment"); }
    if lower.contains("judgment delivery") || (lower.contains("judgment") && lower.contains("deliver")) {
        return Some("Judgment delivery");
    }
    if lower.contains("ruling") { return Some("Ruling"); }
    if lower.contains("appeal") { return Some("Appeal"); }
    if lower.contains("case management") { return Some("Case management conference"); }
    if lower.contains("conference") { return Some("Conference"); }
    if lower.contains("mention") { return Some("Mention"); }
    if lower.contains("application") { return Some("Application"); }
    if lower.contains("hearing") { return Some("Hearing"); }
    if lower.contains("review") { return Some("Review"); }
    if lower.contains("fixed date") { return Some("Fixed date claim"); }
    None
}

fn looks_like_lawyers(line: &str) -> bool {
    let lower = line.to_lowercase();
    lower.contains("chambers")
        || lower.contains("& associates")
        || lower.contains("& partners")
        || lower.contains("attorneys at law")
        || lower.contains("solicitors")
        || lower.contains("law firm")
        // A line with a colon not starting with a known keyword likely contains
        // firm names in "FirmName: AttorneyName" format.
        || (line.contains(':')
            && line.len() > 15
            && !line.to_uppercase().starts_with("COR")
            && !line.to_uppercase().starts_with("CLERK")
            && !line.to_uppercase().starts_with("COURTROOM")
            && !line.to_uppercase().starts_with("COUNSEL")
            && !line.to_uppercase().starts_with("ATTORNEY")
            && !line.to_uppercase().starts_with("BEFORE"))
}

fn clean_judge_name(raw: &str) -> String {
    // Strip titles in decreasing specificity so we don't leave fragments.
    // Dot variants cover SC documents; no-dot variants cover CoA documents.
    let upper = raw.to_uppercase();
    let prefixes = [
        "THE HONOURABLE MRS. JUSTICE ",
        "THE HONOURABLE MR. JUSTICE ",
        // No-dot variants found in Criminal/Gun Court PDFs
        "THE HONOURABLE MRS JUSTICE ",
        "THE HONOURABLE MR JUSTICE ",
        "THE HONOURABLE MS JUSTICE ",
        "THE HONOURABLE MISS JUSTICE ",
        "THE HONOURABLE MS. JUSTICE ",
        "THE HONOURABLE JUSTICE ",
        "THE HONOURABLE ",
        "THE HON. MRS. JUSTICE ",
        "THE HON. MR. JUSTICE ",
        "THE HON. MS. JUSTICE ",
        "THE HON. JUSTICE ",
        "THE HON. ",
        // No-dot variants used in Court of Appeal documents
        "THE HON MRS JUSTICE ",
        "THE HON MR JUSTICE ",
        "THE HON MISS JUSTICE ",
        "THE HON MS JUSTICE ",
        "THE HON DR JUSTICE ",
        "THE HON JUSTICE ",
        "THE HON ",
        "MRS. JUSTICE ",
        "MR. JUSTICE ",
        "MISS JUSTICE ",
        "MS. JUSTICE ",
        "JUSTICE ",
        "HON. JUSTICE ",
        "HON. ",
    ];
    for p in &prefixes {
        if upper.starts_with(p) {
            let name = normalize_name_case(raw[p.len()..].trim());
            return format!("Hon. Justice {name}");
        }
    }
    // Masters of the Supreme Court — different title, not "Justice"
    let master_prefixes = [
        "MASTER MISS ", "MASTER MRS. ", "MASTER MR. ", "MASTER MS. ", "MASTER ",
    ];
    for p in &master_prefixes {
        if upper.starts_with(p) {
            let name = normalize_name_case(raw[p.len()..].trim());
            return format!("Master {name}");
        }
    }
    format!("Hon. Justice {}", normalize_name_case(raw.trim()))
}

/// Convert a judge's name from ALL CAPS or mixed case to title case.
///
/// Handles hyphenated surnames ("JACKSON-HAISLEY" → "Jackson-Haisley") and
/// single-letter initials ("S." stays "S.").
fn normalize_name_case(name: &str) -> String {
    name.split_whitespace()
        .map(|word| {
            if word.contains('-') {
                word.split('-').map(capitalize_word).collect::<Vec<_>>().join("-")
            } else {
                capitalize_word(word)
            }
        })
        .collect::<Vec<_>>()
        .join(" ")
}

fn capitalize_word(word: &str) -> String {
    let mut chars = word.chars();
    match chars.next() {
        None => String::new(),
        Some(first) => first.to_uppercase().to_string() + &chars.as_str().to_lowercase(),
    }
}

fn normalize_section(s: &str) -> String {
    s.trim()
        .to_uppercase()
        .replace("MATTERS", "")
        .replace("LIST", "")
        .trim()
        .to_string()
}

fn line_is_directive(line: &str) -> bool {
    let lower = line.to_lowercase();
    lower.starts_with("before")
        || lower.starts_with("counsel")
        || lower.starts_with("attorney")
        || lower.starts_with("cor")
        || lower.starts_with("clerk")
        || lower.starts_with("at ")
        || lower.starts_with("time")
        || lower.starts_with("date")
        || lower.starts_with("court")
        || line.len() < 4
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn legacy_civil_case_numbers_are_parsed() {
        // Minimal PDF excerpt matching real Civil Division format
        let text = "ACTION MATTERS\n\
                    CIVIL: COURT NO. 14\n\
                    COR: THE HONOURABLE MRS. JUSTICE A. PETTIGREW-COLLINS\n\
                    CLERK: MISS T. GRIZZLE\n\
                    MONDAY, 18TH MAY, 2026\n\
                    2016HCV05029\n\
                    Ethiopian Zion Optic Church Vs Golden Grove Sugar Company Ltd & Anor\n\
                    Event: Defendant's application to set aside claim (Part heard)\n\
                    Wright Legal: DunnCox: Carol Davis\n\
                    COR: MASTER MISS R. HARRIS\n\
                    CLERK: MR. R. L. SMITH\n";

        let entries = parse_court_list_text(text, None);
        let case = entries.iter().find(|e| {
            e.case_number.as_deref() == Some("2016HCV05029")
        });
        assert!(case.is_some(), "2016HCV05029 should be parsed but was not found");
        let e = case.unwrap();
        assert!(e.title.as_deref().map(|t| t.contains("Ethiopian")).unwrap_or(false),
                "title should contain 'Ethiopian'");
    }

    #[test]
    fn masters_case_number_is_parsed() {
        let text = "ACTION MATTERS\n\
                    MONDAY, 18TH MAY, 2026\n\
                    COR: MASTER MISS R. HARRIS\n\
                    2012M02155\n\
                    Smith Vs Jones\n\
                    Event: Case management conference\n";

        let entries = parse_court_list_text(text, None);
        let case = entries.iter().find(|e| e.case_number.as_deref() == Some("2012M02155"));
        assert!(case.is_some(), "2012M02155 (Master's case) should be parsed");
    }

    #[test]
    fn master_judge_title_normalised() {
        assert_eq!(clean_judge_name("MASTER MISS R. HARRIS"), "Master R. Harris");
        assert_eq!(clean_judge_name("MASTER MR. B. SCOTT"), "Master B. Scott");
    }

    #[test]
    fn legacy_regex_does_not_match_month_names() {
        // "2026MAY18" should NOT be treated as a case number
        let re = Regex::new(r"(?-i)\b(\d{4})([A-Z]{1,4})(\d{4,6})\b").unwrap();
        let text = "18TH MAY 2026";
        // The regex might find sub-matches in non-line-isolated text; the real
        // filter is in try_extract_legacy_civil() which excludes month names.
        let result = try_extract_legacy_civil(text, &re);
        assert!(result.is_none(), "month name 'MAY' should be excluded");
    }

    #[test]
    fn su_prefix_cases_still_parsed() {
        let text = "ACTION MATTERS\n\
                    MONDAY, 18TH MAY, 2026\n\
                    COR: THE HONOURABLE MRS. JUSTICE S. WINT-BLAIR\n\
                    SU2022CV03927\n\
                    Myrlene Sinclair Vs Sophia Burke\n\
                    Event: Trial in court (3 days)\n";

        let entries = parse_court_list_text(text, None);
        let case = entries.iter().find(|e| e.case_number.as_deref() == Some("SU2022CV03927"));
        assert!(case.is_some(), "SU2022CV03927 should still be parsed");
    }
}
