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
    pub created_at: NaiveDateTime,
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
}

#[derive(Debug, Clone, Serialize, Deserialize, sqlx::FromRow)]
pub struct UserCase {
    pub id: i32,
    pub user_id: i32,
    pub case_id: i32,
    pub created_at: NaiveDateTime,
}

#[derive(Debug, Clone, Serialize, Deserialize, sqlx::FromRow)]
pub struct Notification {
    pub id: i32,
    pub user_id: i32,
    pub case_id: i32,
    #[sqlx(rename = "type")]
    #[serde(rename = "type")]
    pub notification_type: String,
    pub sent_at: NaiveDateTime,
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
}
