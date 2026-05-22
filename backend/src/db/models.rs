use chrono::{NaiveDate, NaiveDateTime, NaiveTime};
use serde::{Deserialize, Serialize};

// All `created_at` / `updated_at` / `sent_at` columns are declared as
// `TIMESTAMP` (no time zone) in every table.  sqlx maps TIMESTAMP ↔
// NaiveDateTime.  Using DateTime<Utc> (TIMESTAMPTZ) caused the type-mismatch
// error at runtime.

#[derive(Debug, Clone, Serialize, Deserialize, sqlx::FromRow)]
pub struct User {
    pub id: i32,
    pub email: String,
    #[serde(skip_serializing)]
    pub password_hash: String,
    pub role: String,
    pub display_name: Option<String>,
    pub created_at: NaiveDateTime,
    pub email_verified: bool,
}

#[derive(Debug, Clone, Serialize, Deserialize, sqlx::FromRow)]
pub struct Judge {
    pub id: i32,
    pub name: String,
    pub court: Option<String>,
    pub created_at: NaiveDateTime,
    pub updated_at: NaiveDateTime,
}

#[derive(Debug, Clone, Serialize, Deserialize, sqlx::FromRow)]
pub struct JudgeWithCount {
    pub id: i32,
    pub name: String,
    pub court: Option<String>,
    pub total_cases: i64,
}

#[derive(Debug, Clone, Serialize, Deserialize, sqlx::FromRow)]
pub struct JudgeConnection {
    pub judge_a_id: i32,
    pub judge_b_id: i32,
    pub count: i64,
}

#[derive(Debug, Clone, Serialize, Deserialize, sqlx::FromRow)]
pub struct Judgment {
    pub id: i32,
    pub case_number: String,
    pub title: Option<String>,
    pub judge_name: Option<String>,
    pub court: Option<String>,
    pub date: Option<NaiveDate>,
    pub pdf_url: Option<String>,
    pub local_pdf_path: Option<String>,
    pub summary_text: Option<String>,
    pub created_at: NaiveDateTime,
    pub updated_at: NaiveDateTime,
    /// Populated only by FTS queries via ts_headline; None otherwise.
    #[sqlx(default)]
    pub snippet: Option<String>,
    /// URL of the court's own detail page for this judgment (stored at scrape time).
    #[sqlx(default)]
    pub source_url: Option<String>,
    /// Taxonomy tags (e.g. ["tax_law"]).
    #[sqlx(default)]
    pub tags: Vec<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize, sqlx::FromRow)]
pub struct UserCase {
    pub id: i32,
    pub user_id: i32,
    pub case_id: Option<i32>,
    pub case_type: String,
    pub case_number: Option<String>,
    pub last_event_date: Option<NaiveDate>,
    pub last_event_time: Option<NaiveTime>,
    pub created_at: NaiveDateTime,
    /// Joined from user_case_settings — null when no preference row exists yet.
    #[sqlx(default)]
    pub notify_immediately: Option<bool>,
    #[sqlx(default)]
    pub notify_day_before: Option<bool>,
    #[sqlx(default)]
    pub notify_morning_of: Option<bool>,
}

#[derive(Debug, Clone, Serialize, Deserialize, sqlx::FromRow)]
pub struct UserCaseSettings {
    pub id: i32,
    pub user_case_id: i32,
    pub notify_immediately: bool,
    pub notify_day_before: bool,
    pub notify_morning_of: bool,
}

#[derive(Debug, Clone, Serialize, Deserialize, sqlx::FromRow)]
pub struct Notification {
    pub id: i32,
    pub user_id: i32,
    pub case_id: Option<i32>,
    #[sqlx(rename = "type")]
    #[serde(rename = "type")]
    pub notification_type: String,
    pub sent_at: NaiveDateTime,
    pub read_at: Option<NaiveDateTime>,
    #[sqlx(default)]
    pub archived_at: Option<NaiveDateTime>,
    #[sqlx(default)]
    pub title: Option<String>,
    #[sqlx(default)]
    pub message: Option<String>,
    #[sqlx(default)]
    pub link: Option<String>,
    #[sqlx(default)]
    pub severity: Option<String>,
    /// Resolved via JOIN with court_sittings or judgments — present only when
    /// fetched through get_notifications.
    #[sqlx(default)]
    pub case_number: Option<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize, sqlx::FromRow)]
pub struct CourtSitting {
    pub id: i32,
    pub case_number: Option<String>,
    pub title: Option<String>,
    pub judge_name: Option<String>,
    pub court_division: Option<String>,
    pub event_type: Option<String>,
    pub event_date: Option<NaiveDate>,
    pub event_time: Option<NaiveTime>,
    pub lawyers: Option<String>,
    pub pdf_source_url: Option<String>,
    pub created_at: NaiveDateTime,
    /// Populated only by FTS queries via ts_headline; None otherwise.
    #[sqlx(default)]
    pub snippet: Option<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct CourtStats {
    pub court: String,
    pub total_judgments: i64,
    /// Sittings whose event_date falls within the next 7 days (today inclusive).
    pub sittings_this_week: i64,
    pub total_sittings: i64,
    pub active_judges: i64,
}

#[derive(Debug, Clone, Serialize, sqlx::FromRow)]
pub struct ActivityLogRow {
    pub id: i32,
    pub email: String,
    pub case_id: Option<i32>,
    pub notification_type: String,
    pub sent_at: NaiveDateTime,
}

#[derive(Debug, Clone, Serialize, Deserialize, sqlx::FromRow)]
pub struct ParishCourtCase {
    pub id: i32,
    pub parish: String,
    pub accused_name: Option<String>,
    pub offence: Option<String>,
    pub status: Option<String>,
    pub week_of: Option<NaiveDate>,
    pub pdf_source_url: Option<String>,
    pub created_at: NaiveDateTime,
    #[sqlx(default)]
    pub case_type: String,
}

#[derive(Debug, Clone, Serialize, Deserialize, sqlx::FromRow)]
pub struct ParishSummary {
    pub name: String,
    pub total_cases: i64,
}

#[derive(Debug, Clone, Serialize, Deserialize, sqlx::FromRow)]
pub struct Promo {
    pub id: i32,
    pub title: String,
    pub message: String,
    pub url: Option<String>,
    pub url_text: Option<String>,
    pub display_frequency: String,
    pub starts_at: Option<NaiveDateTime>,
    pub ends_at: Option<NaiveDateTime>,
    pub enabled: bool,
    pub created_at: NaiveDateTime,
}

// ── Case-lookup projections (used only by the /case-lookup handler) ──────────

#[derive(Debug, Clone, Serialize, sqlx::FromRow)]
pub struct CaseLookupJudgmentRow {
    pub id: i32,
    pub case_number: String,
    pub title: Option<String>,
    pub date: Option<NaiveDate>,
    pub court: Option<String>,
}

#[derive(Debug, Clone, Serialize, sqlx::FromRow)]
pub struct CaseLookupSittingRow {
    pub id: i32,
    pub case_number: Option<String>,
    pub title: Option<String>,
    pub event_date: Option<NaiveDate>,
    pub court_division: Option<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize, sqlx::FromRow)]
pub struct LegalNews {
    pub id: i32,
    pub title: String,
    pub description: Option<String>,
    pub source: String,
    pub url: String,
    pub published_at: Option<NaiveDateTime>,
    pub category: String,
    pub created_at: NaiveDateTime,
}
