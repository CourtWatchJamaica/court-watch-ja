use chrono::{NaiveDate, NaiveTime};
use sqlx::PgPool;

use super::models::*;

// ── Users ──────────────────────────────────────────────────────────────────

pub async fn create_user(pool: &PgPool, email: &str, password_hash: &str) -> sqlx::Result<User> {
    sqlx::query_as::<_, User>(
        "INSERT INTO users (email, password_hash) VALUES ($1, $2)
         RETURNING id, email, password_hash, created_at",
    )
    .bind(email)
    .bind(password_hash)
    .fetch_one(pool)
    .await
}

pub async fn find_user_by_email(pool: &PgPool, email: &str) -> sqlx::Result<Option<User>> {
    sqlx::query_as::<_, User>(
        "SELECT id, email, password_hash, created_at FROM users WHERE email = $1",
    )
    .bind(email)
    .fetch_optional(pool)
    .await
}

// ── Judgments ──────────────────────────────────────────────────────────────

pub async fn list_judgments(
    pool: &PgPool,
    query: Option<&str>,
    page: i64,
    limit: i64,
    court: Option<&str>,
) -> sqlx::Result<(Vec<Judgment>, i64)> {
    let offset = (page - 1).max(0) * limit;
    let effective_court = court.unwrap_or("Supreme Court");

    if let Some(q) = query.filter(|q| !q.is_empty()) {
        let pattern = format!("%{}%", q);
        let rows = sqlx::query_as::<_, Judgment>(
            "SELECT * FROM judgments
             WHERE (title ILIKE $1 OR case_number ILIKE $1 OR judge_name ILIKE $1 OR court ILIKE $1)
               AND court = $2
             ORDER BY date DESC NULLS LAST, created_at DESC
             LIMIT $3 OFFSET $4",
        )
        .bind(&pattern)
        .bind(effective_court)
        .bind(limit)
        .bind(offset)
        .fetch_all(pool)
        .await?;

        let total: i64 = sqlx::query_scalar(
            "SELECT COUNT(*) FROM judgments
             WHERE (title ILIKE $1 OR case_number ILIKE $1 OR judge_name ILIKE $1 OR court ILIKE $1)
               AND court = $2",
        )
        .bind(&pattern)
        .bind(effective_court)
        .fetch_one(pool)
        .await?;

        Ok((rows, total))
    } else {
        let rows = sqlx::query_as::<_, Judgment>(
            "SELECT * FROM judgments
             WHERE court = $1
             ORDER BY date DESC NULLS LAST, created_at DESC
             LIMIT $2 OFFSET $3",
        )
        .bind(effective_court)
        .bind(limit)
        .bind(offset)
        .fetch_all(pool)
        .await?;

        let total: i64 = sqlx::query_scalar(
            "SELECT COUNT(*) FROM judgments WHERE court = $1",
        )
        .bind(effective_court)
        .fetch_one(pool)
        .await?;

        Ok((rows, total))
    }
}

pub async fn get_judgment_by_id(pool: &PgPool, id: i32) -> sqlx::Result<Option<Judgment>> {
    sqlx::query_as::<_, Judgment>("SELECT * FROM judgments WHERE id = $1")
        .bind(id)
        .fetch_optional(pool)
        .await
}

#[allow(dead_code)]
pub async fn get_judgment_by_case_number(
    pool: &PgPool,
    case_number: &str,
) -> sqlx::Result<Option<Judgment>> {
    sqlx::query_as::<_, Judgment>("SELECT * FROM judgments WHERE case_number = $1")
        .bind(case_number)
        .fetch_optional(pool)
        .await
}

pub async fn upsert_judgment(
    pool: &PgPool,
    case_number: &str,
    title: Option<&str>,
    judge_name: Option<&str>,
    court: Option<&str>,
    date: Option<NaiveDate>,
    pdf_url: Option<&str>,
    local_pdf_path: Option<&str>,
    summary_text: Option<&str>,
) -> sqlx::Result<Judgment> {
    sqlx::query_as::<_, Judgment>(
        "INSERT INTO judgments (case_number, title, judge_name, court, date, pdf_url, local_pdf_path, summary_text, updated_at)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, NOW())
         ON CONFLICT (case_number) DO UPDATE SET
           title          = COALESCE(EXCLUDED.title, judgments.title),
           judge_name     = COALESCE(EXCLUDED.judge_name, judgments.judge_name),
           court          = COALESCE(EXCLUDED.court, judgments.court),
           date           = COALESCE(EXCLUDED.date, judgments.date),
           pdf_url        = COALESCE(EXCLUDED.pdf_url, judgments.pdf_url),
           local_pdf_path = COALESCE(EXCLUDED.local_pdf_path, judgments.local_pdf_path),
           summary_text   = COALESCE(EXCLUDED.summary_text, judgments.summary_text),
           updated_at     = NOW()
         RETURNING *",
    )
    .bind(case_number)
    .bind(title)
    .bind(judge_name)
    .bind(court)
    .bind(date)
    .bind(pdf_url)
    .bind(local_pdf_path)
    .bind(summary_text)
    .fetch_one(pool)
    .await
}

pub async fn set_local_pdf_path(
    pool: &PgPool,
    judgment_id: i32,
    path: &str,
) -> sqlx::Result<()> {
    sqlx::query(
        "UPDATE judgments SET local_pdf_path = $1, updated_at = NOW() WHERE id = $2",
    )
    .bind(path)
    .bind(judgment_id)
    .execute(pool)
    .await?;
    Ok(())
}

pub async fn judgments_needing_pdf(pool: &PgPool) -> sqlx::Result<Vec<Judgment>> {
    sqlx::query_as::<_, Judgment>(
        "SELECT * FROM judgments WHERE pdf_url IS NOT NULL AND local_pdf_path IS NULL",
    )
    .fetch_all(pool)
    .await
}

// ── Judges ─────────────────────────────────────────────────────────────────

pub async fn list_judges(pool: &PgPool, court: Option<&str>) -> sqlx::Result<Vec<JudgeWithCount>> {
    if let Some(c) = court {
        sqlx::query_as::<_, JudgeWithCount>(
            "SELECT j.id, j.name, j.court, COUNT(jm.id) AS total_cases
             FROM judges j
             LEFT JOIN judgments jm ON jm.judge_name = j.name
             WHERE j.court = $1
             GROUP BY j.id, j.name, j.court
             ORDER BY j.name",
        )
        .bind(c)
        .fetch_all(pool)
        .await
    } else {
        sqlx::query_as::<_, JudgeWithCount>(
            "SELECT j.id, j.name, j.court,
                    COUNT(jm.id) AS total_cases
             FROM judges j
             LEFT JOIN judgments jm ON jm.judge_name = j.name
             GROUP BY j.id, j.name, j.court
             ORDER BY j.name",
        )
        .fetch_all(pool)
        .await
    }
}

pub async fn get_judge_by_id(pool: &PgPool, id: i32) -> sqlx::Result<Option<Judge>> {
    sqlx::query_as::<_, Judge>("SELECT * FROM judges WHERE id = $1")
        .bind(id)
        .fetch_optional(pool)
        .await
}

pub async fn get_judgments_by_judge(pool: &PgPool, judge_name: &str) -> sqlx::Result<Vec<Judgment>> {
    sqlx::query_as::<_, Judgment>(
        "SELECT * FROM judgments WHERE judge_name = $1 ORDER BY date DESC NULLS LAST",
    )
    .bind(judge_name)
    .fetch_all(pool)
    .await
}

pub async fn upsert_judge(pool: &PgPool, name: &str, court: Option<&str>) -> sqlx::Result<Judge> {
    sqlx::query_as::<_, Judge>(
        "INSERT INTO judges (name, court, updated_at)
         VALUES ($1, $2, NOW())
         ON CONFLICT (name) DO UPDATE SET
           court      = COALESCE(EXCLUDED.court, judges.court),
           updated_at = NOW()
         RETURNING *",
    )
    .bind(name)
    .bind(court)
    .fetch_one(pool)
    .await
}

// ── User Cases ─────────────────────────────────────────────────────────────

pub async fn get_user_cases(pool: &PgPool, user_id: i32) -> sqlx::Result<Vec<UserCase>> {
    sqlx::query_as::<_, UserCase>(
        "SELECT * FROM user_cases WHERE user_id = $1 ORDER BY created_at DESC",
    )
    .bind(user_id)
    .fetch_all(pool)
    .await
}

/// Insert a tracking entry.  Returns the new row, or `RowNotFound` when
/// `ON CONFLICT DO NOTHING` fires (already tracked — treat as success).
pub async fn add_user_case(
    pool: &PgPool,
    user_id: i32,
    case_id: i32,
    case_type: &str,
) -> sqlx::Result<UserCase> {
    sqlx::query_as::<_, UserCase>(
        "INSERT INTO user_cases (user_id, case_id, case_type)
         VALUES ($1, $2, $3)
         ON CONFLICT (user_id, case_id, case_type) DO NOTHING
         RETURNING *",
    )
    .bind(user_id)
    .bind(case_id)
    .bind(case_type)
    .fetch_one(pool)
    .await
}

pub async fn remove_user_case(
    pool: &PgPool,
    user_id: i32,
    case_id: i32,
    case_type: &str,
) -> sqlx::Result<u64> {
    let result = sqlx::query(
        "DELETE FROM user_cases WHERE user_id = $1 AND case_id = $2 AND case_type = $3",
    )
    .bind(user_id)
    .bind(case_id)
    .bind(case_type)
    .execute(pool)
    .await?;
    Ok(result.rows_affected())
}

// ── Notifications ──────────────────────────────────────────────────────────

pub async fn get_notifications(pool: &PgPool, user_id: i32) -> sqlx::Result<Vec<Notification>> {
    sqlx::query_as::<_, Notification>(
        r#"SELECT id, user_id, case_id, "type", sent_at FROM notifications WHERE user_id = $1 ORDER BY sent_at DESC"#,
    )
    .bind(user_id)
    .fetch_all(pool)
    .await
}

// ── Court Sittings ─────────────────────────────────────────────────────────

/// Returns a SQL fragment (no parameter bindings) that filters court_sittings
/// by court based on the court_division column.
///
/// This is safe to interpolate directly into SQL because the input is always
/// one of three known internal court name strings — never raw user input.
fn sitting_court_filter(court: &str) -> &'static str {
    match court {
        "Court of Appeal" => "court_division ILIKE '%Appeal%'",
        "Parish Court" => "court_division ILIKE '%Parish%'",
        _ => "(court_division NOT ILIKE '%Appeal%' AND court_division NOT ILIKE '%Parish%')",
    }
}

pub async fn list_court_sittings(
    pool: &PgPool,
    date_from: Option<NaiveDate>,
    date_to: Option<NaiveDate>,
    court: Option<&str>,
) -> sqlx::Result<Vec<CourtSitting>> {
    let court_filter = court.map(sitting_court_filter);

    match (date_from, date_to, court_filter) {
        (Some(from), Some(to), Some(filter)) => {
            let sql = format!(
                "SELECT * FROM court_sittings
                 WHERE event_date BETWEEN $1 AND $2 AND {filter}
                 ORDER BY event_date, event_time NULLS LAST"
            );
            sqlx::query_as::<_, CourtSitting>(&sql)
                .bind(from)
                .bind(to)
                .fetch_all(pool)
                .await
        }
        (Some(from), Some(to), None) => {
            sqlx::query_as::<_, CourtSitting>(
                "SELECT * FROM court_sittings
                 WHERE event_date BETWEEN $1 AND $2
                 ORDER BY event_date, event_time NULLS LAST",
            )
            .bind(from)
            .bind(to)
            .fetch_all(pool)
            .await
        }
        (Some(from), None, Some(filter)) => {
            let sql = format!(
                "SELECT * FROM court_sittings
                 WHERE event_date >= $1 AND {filter}
                 ORDER BY event_date, event_time NULLS LAST"
            );
            sqlx::query_as::<_, CourtSitting>(&sql)
                .bind(from)
                .fetch_all(pool)
                .await
        }
        (Some(from), None, None) => {
            sqlx::query_as::<_, CourtSitting>(
                "SELECT * FROM court_sittings WHERE event_date >= $1 ORDER BY event_date, event_time NULLS LAST",
            )
            .bind(from)
            .fetch_all(pool)
            .await
        }
        (None, Some(to), Some(filter)) => {
            let sql = format!(
                "SELECT * FROM court_sittings
                 WHERE event_date <= $1 AND {filter}
                 ORDER BY event_date, event_time NULLS LAST"
            );
            sqlx::query_as::<_, CourtSitting>(&sql)
                .bind(to)
                .fetch_all(pool)
                .await
        }
        (None, Some(to), None) => {
            sqlx::query_as::<_, CourtSitting>(
                "SELECT * FROM court_sittings WHERE event_date <= $1 ORDER BY event_date, event_time NULLS LAST",
            )
            .bind(to)
            .fetch_all(pool)
            .await
        }
        (None, None, Some(filter)) => {
            let sql = format!(
                "SELECT * FROM court_sittings
                 WHERE {filter}
                 ORDER BY event_date, event_time NULLS LAST"
            );
            sqlx::query_as::<_, CourtSitting>(&sql)
                .fetch_all(pool)
                .await
        }
        (None, None, None) => {
            sqlx::query_as::<_, CourtSitting>(
                "SELECT * FROM court_sittings ORDER BY event_date, event_time NULLS LAST",
            )
            .fetch_all(pool)
            .await
        }
    }
}

pub async fn get_today_sittings(pool: &PgPool) -> sqlx::Result<Vec<CourtSitting>> {
    sqlx::query_as::<_, CourtSitting>(
        "SELECT * FROM court_sittings WHERE event_date = CURRENT_DATE ORDER BY event_time NULLS LAST",
    )
    .fetch_all(pool)
    .await
}

pub async fn upsert_court_sitting(
    pool: &PgPool,
    case_number: Option<&str>,
    title: Option<&str>,
    judge_name: Option<&str>,
    court_division: Option<&str>,
    event_type: Option<&str>,
    event_date: Option<NaiveDate>,
    event_time: Option<NaiveTime>,
    lawyers: Option<&str>,
    pdf_source_url: Option<&str>,
) -> sqlx::Result<CourtSitting> {
    sqlx::query_as::<_, CourtSitting>(
        "INSERT INTO court_sittings
           (case_number, title, judge_name, court_division, event_type, event_date, event_time, lawyers, pdf_source_url)
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9)
         ON CONFLICT DO NOTHING
         RETURNING *",
    )
    .bind(case_number)
    .bind(title)
    .bind(judge_name)
    .bind(court_division)
    .bind(event_type)
    .bind(event_date)
    .bind(event_time)
    .bind(lawyers)
    .bind(pdf_source_url)
    .fetch_one(pool)
    .await
}

pub async fn sitting_exists(
    pool: &PgPool,
    case_number: &str,
    event_date: NaiveDate,
    event_type: &str,
) -> sqlx::Result<bool> {
    let count: i64 = sqlx::query_scalar(
        "SELECT COUNT(*) FROM court_sittings
         WHERE case_number = $1 AND event_date = $2 AND event_type = $3",
    )
    .bind(case_number)
    .bind(event_date)
    .bind(event_type)
    .fetch_one(pool)
    .await?;
    Ok(count > 0)
}

// ── Catch-up helpers ───────────────────────────────────────────────────────

/// Returns the most recent judgment delivery date for a specific court.
pub async fn most_recent_judgment_date_by_court(
    pool: &PgPool,
    court: &str,
) -> sqlx::Result<Option<NaiveDate>> {
    sqlx::query_scalar("SELECT MAX(date) FROM judgments WHERE court = $1")
        .bind(court)
        .fetch_one(pool)
        .await
}

/// Returns the most recent court sitting event date, or None if the table is empty.
pub async fn most_recent_sitting_date(pool: &PgPool) -> sqlx::Result<Option<NaiveDate>> {
    sqlx::query_scalar("SELECT MAX(event_date) FROM court_sittings")
        .fetch_one(pool)
        .await
}

/// Returns the most recent court sitting event date for a specific court.
///
/// Uses `sitting_court_filter` to map court names to the court_division column.
pub async fn most_recent_sitting_date_by_court(
    pool: &PgPool,
    court: &str,
) -> sqlx::Result<Option<NaiveDate>> {
    let filter = sitting_court_filter(court);
    let sql = format!("SELECT MAX(event_date) FROM court_sittings WHERE {filter}");
    sqlx::query_scalar(&sql).fetch_one(pool).await
}

/// Returns the number of court_sittings rows that came from a given PDF URL.
pub async fn count_sittings_by_source_url(pool: &PgPool, url: &str) -> sqlx::Result<i64> {
    sqlx::query_scalar("SELECT COUNT(*) FROM court_sittings WHERE pdf_source_url = $1")
        .bind(url)
        .fetch_one(pool)
        .await
}

/// Full-text search across court_sittings by case number, title, or judge name.
pub async fn search_court_sittings(
    pool: &PgPool,
    q: &str,
    court: Option<&str>,
) -> sqlx::Result<Vec<CourtSitting>> {
    let pattern = format!("%{q}%");

    if let Some(c) = court {
        let filter = sitting_court_filter(c);
        let sql = format!(
            "SELECT * FROM court_sittings
             WHERE (case_number ILIKE $1 OR title ILIKE $1 OR judge_name ILIKE $1)
               AND {filter}
             ORDER BY event_date DESC NULLS LAST, event_time NULLS LAST
             LIMIT 100"
        );
        sqlx::query_as::<_, CourtSitting>(&sql)
            .bind(pattern)
            .fetch_all(pool)
            .await
    } else {
        sqlx::query_as::<_, CourtSitting>(
            "SELECT * FROM court_sittings
             WHERE case_number ILIKE $1
                OR title      ILIKE $1
                OR judge_name ILIKE $1
             ORDER BY event_date DESC NULLS LAST, event_time NULLS LAST
             LIMIT 100",
        )
        .bind(pattern)
        .fetch_all(pool)
        .await
    }
}

// ── Court Stats ────────────────────────────────────────────────────────────

pub async fn get_court_stats(pool: &PgPool, court: &str) -> sqlx::Result<CourtStats> {
    let total_judgments: i64 =
        sqlx::query_scalar("SELECT COUNT(*) FROM judgments WHERE court = $1")
            .bind(court)
            .fetch_one(pool)
            .await?;

    let active_judges: i64 =
        sqlx::query_scalar("SELECT COUNT(*) FROM judges WHERE court = $1")
            .bind(court)
            .fetch_one(pool)
            .await?;

    let filter = sitting_court_filter(court);
    let sittings_sql = format!("SELECT COUNT(*) FROM court_sittings WHERE {filter}");
    let total_sittings: i64 = sqlx::query_scalar(&sittings_sql)
        .fetch_one(pool)
        .await?;

    Ok(CourtStats {
        court: court.to_string(),
        total_judgments,
        total_sittings,
        active_judges,
    })
}

// ── Notification engine ────────────────────────────────────────────────────

/// Called in a background task after every scraper run.
///
/// Judgment notifications: any judgment created in the last 48 h that a user
/// is tracking and hasn't been notified about yet.
///
/// Sitting notifications: any tracked sitting whose event_date or event_time
/// differs from the last known values stored in user_cases.  After notifying,
/// the stored values are updated so the same change isn't re-reported.
pub async fn check_notifications(pool: &PgPool) {
    // ── Judgment notifications ────────────────────────────────────────────
    #[derive(sqlx::FromRow)]
    struct JudgmentPair {
        user_id: i32,
        case_id: i32,
    }

    let judgment_pairs: Vec<JudgmentPair> = match sqlx::query_as(
        "SELECT uc.user_id, uc.case_id
         FROM user_cases uc
         JOIN judgments j ON j.id = uc.case_id
         WHERE uc.case_type = 'judgment'
           AND j.created_at > NOW() - INTERVAL '48 hours'
           AND NOT EXISTS (
               SELECT 1 FROM notifications n
               WHERE n.user_id = uc.user_id
                 AND n.case_id = uc.case_id
                 AND n.type = 'new_judgment'
           )",
    )
    .fetch_all(pool)
    .await
    {
        Ok(rows) => rows,
        Err(e) => {
            tracing::warn!("[Notifications] judgment query failed: {e}");
            return;
        }
    };

    for row in &judgment_pairs {
        if let Err(e) = sqlx::query(
            "INSERT INTO notifications (user_id, case_id, type) VALUES ($1, $2, 'new_judgment')",
        )
        .bind(row.user_id)
        .bind(row.case_id)
        .execute(pool)
        .await
        {
            tracing::warn!(
                "[Notifications] failed to insert new_judgment for user {}: {e}",
                row.user_id
            );
        }
    }

    if !judgment_pairs.is_empty() {
        tracing::info!(
            "[Notifications] {} new_judgment notification(s) inserted",
            judgment_pairs.len()
        );
    }

    // ── Sitting change notifications ──────────────────────────────────────
    #[derive(sqlx::FromRow)]
    struct SittingChange {
        uc_id: i32,
        user_id: i32,
        case_id: i32,
        event_date: Option<NaiveDate>,
        event_time: Option<NaiveTime>,
    }

    let changed: Vec<SittingChange> = match sqlx::query_as(
        "SELECT uc.id          AS uc_id,
                uc.user_id,
                uc.case_id,
                cs.event_date,
                cs.event_time
         FROM user_cases uc
         JOIN court_sittings cs ON cs.id = uc.case_id
         WHERE uc.case_type = 'sitting'
           AND (uc.last_event_date IS DISTINCT FROM cs.event_date
                OR uc.last_event_time IS DISTINCT FROM cs.event_time)",
    )
    .fetch_all(pool)
    .await
    {
        Ok(rows) => rows,
        Err(e) => {
            tracing::warn!("[Notifications] sitting query failed: {e}");
            return;
        }
    };

    for row in &changed {
        if let Err(e) = sqlx::query(
            "INSERT INTO notifications (user_id, case_id, type) VALUES ($1, $2, 'sitting_changed')",
        )
        .bind(row.user_id)
        .bind(row.case_id)
        .execute(pool)
        .await
        {
            tracing::warn!(
                "[Notifications] failed to insert sitting_changed for user {}: {e}",
                row.user_id
            );
            continue;
        }

        // Update stored last-known values so the next run doesn't re-notify.
        if let Err(e) = sqlx::query(
            "UPDATE user_cases SET last_event_date = $1, last_event_time = $2 WHERE id = $3",
        )
        .bind(row.event_date)
        .bind(row.event_time)
        .bind(row.uc_id)
        .execute(pool)
        .await
        {
            tracing::warn!("[Notifications] failed to update last_event for uc_id {}: {e}", row.uc_id);
        }
    }

    if !changed.is_empty() {
        tracing::info!(
            "[Notifications] {} sitting_changed notification(s) inserted",
            changed.len()
        );
    }
}
