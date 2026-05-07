use chrono::{NaiveDate, NaiveTime};
use sqlx::PgPool;

use super::models::*;

// Explicit column lists — omit `search_vector` (tsvector, not decodable by sqlx).
const J: &str =
    "id, case_number, title, judge_name, court, date, pdf_url, local_pdf_path, summary_text, created_at, updated_at";
const S: &str =
    "id, case_number, title, judge_name, court_division, event_type, event_date, event_time, lawyers, pdf_source_url, created_at";

// ── System config ──────────────────────────────────────────────────────────

pub async fn get_system_config(pool: &PgPool, key: &str) -> sqlx::Result<Option<String>> {
    sqlx::query_scalar("SELECT value FROM system_config WHERE key = $1")
        .bind(key)
        .fetch_optional(pool)
        .await
}

pub async fn set_system_config(pool: &PgPool, key: &str, value: &str) -> sqlx::Result<()> {
    sqlx::query(
        "INSERT INTO system_config (key, value, updated_at)
         VALUES ($1, $2, NOW())
         ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value, updated_at = NOW()",
    )
    .bind(key)
    .bind(value)
    .execute(pool)
    .await?;
    Ok(())
}

// ── Users ──────────────────────────────────────────────────────────────────

pub async fn create_user(pool: &PgPool, email: &str, password_hash: &str) -> sqlx::Result<User> {
    sqlx::query_as::<_, User>(
        "INSERT INTO users (email, password_hash) VALUES ($1, $2)
         RETURNING id, email, password_hash, role, created_at",
    )
    .bind(email)
    .bind(password_hash)
    .fetch_one(pool)
    .await
}

pub async fn find_user_by_email(pool: &PgPool, email: &str) -> sqlx::Result<Option<User>> {
    sqlx::query_as::<_, User>(
        "SELECT id, email, password_hash, role, created_at FROM users WHERE email = $1",
    )
    .bind(email)
    .fetch_optional(pool)
    .await
}

pub async fn get_user_by_id(pool: &PgPool, id: i32) -> sqlx::Result<Option<User>> {
    sqlx::query_as::<_, User>(
        "SELECT id, email, password_hash, role, created_at FROM users WHERE id = $1",
    )
    .bind(id)
    .fetch_optional(pool)
    .await
}

// ── Admin: User management ─────────────────────────────────────────────────

pub async fn admin_list_users(pool: &PgPool) -> sqlx::Result<Vec<User>> {
    sqlx::query_as::<_, User>(
        "SELECT id, email, password_hash, role, created_at FROM users ORDER BY created_at DESC",
    )
    .fetch_all(pool)
    .await
}

pub async fn admin_set_user_role(
    pool: &PgPool,
    user_id: i32,
    role: &str,
) -> sqlx::Result<Option<User>> {
    sqlx::query_as::<_, User>(
        "UPDATE users SET role = $1 WHERE id = $2
         RETURNING id, email, password_hash, role, created_at",
    )
    .bind(role)
    .bind(user_id)
    .fetch_optional(pool)
    .await
}

pub async fn admin_delete_user(pool: &PgPool, user_id: i32) -> sqlx::Result<bool> {
    let result = sqlx::query("DELETE FROM users WHERE id = $1")
        .bind(user_id)
        .execute(pool)
        .await?;
    Ok(result.rows_affected() > 0)
}

pub async fn update_user_profile(
    pool: &PgPool,
    user_id: i32,
    new_email: Option<&str>,
    new_password_hash: Option<&str>,
) -> sqlx::Result<Option<User>> {
    sqlx::query_as::<_, User>(
        "UPDATE users
         SET email         = COALESCE($2, email),
             password_hash = COALESCE($3, password_hash)
         WHERE id = $1
         RETURNING id, email, password_hash, role, created_at",
    )
    .bind(user_id)
    .bind(new_email)
    .bind(new_password_hash)
    .fetch_optional(pool)
    .await
}

pub async fn bootstrap_admin(pool: &PgPool, email: &str) -> sqlx::Result<()> {
    sqlx::query(
        "UPDATE users SET role = 'super_admin' WHERE email = $1 AND role != 'super_admin'",
    )
    .bind(email)
    .execute(pool)
    .await?;
    Ok(())
}

// ── Admin: Config ──────────────────────────────────────────────────────────

#[derive(Debug, Clone, serde::Serialize, sqlx::FromRow)]
pub struct SystemConfigRow {
    pub key: String,
    pub value: String,
    pub updated_at: chrono::NaiveDateTime,
}

pub async fn admin_list_config(pool: &PgPool) -> sqlx::Result<Vec<SystemConfigRow>> {
    sqlx::query_as::<_, SystemConfigRow>(
        "SELECT key, value, updated_at FROM system_config ORDER BY key",
    )
    .fetch_all(pool)
    .await
}

// ── Admin: Judgments ───────────────────────────────────────────────────────

pub async fn admin_list_judgments(
    pool: &PgPool,
    page: i64,
    limit: i64,
) -> sqlx::Result<(Vec<Judgment>, i64)> {
    let offset = (page - 1).max(0) * limit;
    let sql = format!("SELECT {J} FROM judgments ORDER BY created_at DESC LIMIT $1 OFFSET $2");
    let rows = sqlx::query_as::<_, Judgment>(&sql)
        .bind(limit)
        .bind(offset)
        .fetch_all(pool)
        .await?;
    let total: i64 = sqlx::query_scalar("SELECT COUNT(*) FROM judgments")
        .fetch_one(pool)
        .await?;
    Ok((rows, total))
}

pub async fn admin_update_judgment(
    pool: &PgPool,
    id: i32,
    title: Option<&str>,
    judge_name: Option<&str>,
    court: Option<&str>,
    date: Option<chrono::NaiveDate>,
    summary_text: Option<&str>,
) -> sqlx::Result<Option<Judgment>> {
    let sql = format!(
        "UPDATE judgments
         SET title        = COALESCE($2, title),
             judge_name   = COALESCE($3, judge_name),
             court        = COALESCE($4, court),
             date         = COALESCE($5, date),
             summary_text = COALESCE($6, summary_text),
             updated_at   = NOW()
         WHERE id = $1
         RETURNING {J}"
    );
    sqlx::query_as::<_, Judgment>(&sql)
        .bind(id)
        .bind(title)
        .bind(judge_name)
        .bind(court)
        .bind(date)
        .bind(summary_text)
        .fetch_optional(pool)
        .await
}

pub async fn admin_delete_judgment(pool: &PgPool, id: i32) -> sqlx::Result<bool> {
    let result = sqlx::query("DELETE FROM judgments WHERE id = $1")
        .bind(id)
        .execute(pool)
        .await?;
    Ok(result.rows_affected() > 0)
}

// ── Admin: Sittings ────────────────────────────────────────────────────────

pub async fn admin_list_sittings(
    pool: &PgPool,
    page: i64,
    limit: i64,
) -> sqlx::Result<(Vec<CourtSitting>, i64)> {
    let offset = (page - 1).max(0) * limit;
    let sql = format!(
        "SELECT {S} FROM court_sittings ORDER BY event_date DESC NULLS LAST, created_at DESC
         LIMIT $1 OFFSET $2"
    );
    let rows = sqlx::query_as::<_, CourtSitting>(&sql)
        .bind(limit)
        .bind(offset)
        .fetch_all(pool)
        .await?;
    let total: i64 = sqlx::query_scalar("SELECT COUNT(*) FROM court_sittings")
        .fetch_one(pool)
        .await?;
    Ok((rows, total))
}

pub async fn admin_update_sitting(
    pool: &PgPool,
    id: i32,
    title: Option<&str>,
    judge_name: Option<&str>,
    event_date: Option<chrono::NaiveDate>,
    event_time: Option<chrono::NaiveTime>,
) -> sqlx::Result<Option<CourtSitting>> {
    let sql = format!(
        "UPDATE court_sittings
         SET title      = COALESCE($2, title),
             judge_name = COALESCE($3, judge_name),
             event_date = COALESCE($4, event_date),
             event_time = COALESCE($5, event_time)
         WHERE id = $1
         RETURNING {S}"
    );
    sqlx::query_as::<_, CourtSitting>(&sql)
        .bind(id)
        .bind(title)
        .bind(judge_name)
        .bind(event_date)
        .bind(event_time)
        .fetch_optional(pool)
        .await
}

pub async fn admin_delete_sitting(pool: &PgPool, id: i32) -> sqlx::Result<bool> {
    let result = sqlx::query("DELETE FROM court_sittings WHERE id = $1")
        .bind(id)
        .execute(pool)
        .await?;
    Ok(result.rows_affected() > 0)
}

// ── Admin: Activity log ────────────────────────────────────────────────────

pub use super::models::ActivityLogRow;

pub async fn admin_recent_activity(pool: &PgPool, limit: i64) -> sqlx::Result<Vec<ActivityLogRow>> {
    sqlx::query_as::<_, ActivityLogRow>(
        "SELECT n.id, u.email, n.case_id, n.type AS notification_type, n.sent_at
         FROM notifications n
         JOIN users u ON u.id = n.user_id
         ORDER BY n.sent_at DESC
         LIMIT $1",
    )
    .bind(limit)
    .fetch_all(pool)
    .await
}

// ── Admin: Create Judgment ─────────────────────────────────────────────────

pub async fn admin_create_judgment(
    pool: &PgPool,
    case_number: &str,
    title: Option<&str>,
    judge_name: Option<&str>,
    court: Option<&str>,
    date: Option<chrono::NaiveDate>,
    pdf_url: Option<&str>,
    summary_text: Option<&str>,
) -> sqlx::Result<Judgment> {
    let sql = format!(
        "INSERT INTO judgments (case_number, title, judge_name, court, date, pdf_url, summary_text)
         VALUES ($1, $2, $3, $4, $5, $6, $7)
         RETURNING {J}"
    );
    sqlx::query_as::<_, Judgment>(&sql)
        .bind(case_number)
        .bind(title)
        .bind(judge_name)
        .bind(court)
        .bind(date)
        .bind(pdf_url)
        .bind(summary_text)
        .fetch_one(pool)
        .await
}

// ── Admin: Create Sitting ──────────────────────────────────────────────────

pub async fn admin_create_sitting(
    pool: &PgPool,
    case_number: Option<&str>,
    title: Option<&str>,
    judge_name: Option<&str>,
    court_division: Option<&str>,
    event_type: Option<&str>,
    event_date: Option<chrono::NaiveDate>,
    event_time: Option<chrono::NaiveTime>,
    lawyers: Option<&str>,
    pdf_source_url: Option<&str>,
) -> sqlx::Result<CourtSitting> {
    let sql = format!(
        "INSERT INTO court_sittings
           (case_number, title, judge_name, court_division, event_type, event_date, event_time, lawyers, pdf_source_url)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
         RETURNING {S}"
    );
    sqlx::query_as::<_, CourtSitting>(&sql)
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

// ── Admin: Announce ────────────────────────────────────────────────────────

pub async fn admin_announce(
    pool: &PgPool,
    title: &str,
    message: &str,
) -> sqlx::Result<i64> {
    let result = sqlx::query(
        "INSERT INTO notifications (user_id, case_id, type, title, message, sent_at)
         SELECT id, NULL, 'announcement', $1, $2, NOW() FROM users",
    )
    .bind(title)
    .bind(message)
    .execute(pool)
    .await?;
    Ok(result.rows_affected() as i64)
}

// ── Judgments ──────────────────────────────────────────────────────────────

pub async fn list_judgments(
    pool: &PgPool,
    query: Option<&str>,
    page: i64,
    limit: i64,
    court: Option<&str>,
    judge: Option<&str>,
) -> sqlx::Result<(Vec<Judgment>, i64)> {
    let offset = (page - 1).max(0) * limit;

    // Judge-specific path: bypass court constraint, return that judge's judgments.
    // judge_name can be a comma-separated panel ("Harris JA, Brown JA, Jones JA"), so we
    // unnest the field and check whether the requested name appears in the list.
    // ANY(ARRAY(SELECT ...)) in a WHERE clause is safe with sqlx (no type-inference issue).
    if let Some(judge_name) = judge {
        let sql = format!(
            "SELECT {J} FROM judgments
             WHERE judge_name IS NOT NULL
               AND $1 = ANY(
                     ARRAY(SELECT TRIM(p)
                           FROM unnest(string_to_array(judge_name, ',')) p)
                   )
             ORDER BY date DESC NULLS LAST, created_at DESC
             LIMIT $2 OFFSET $3"
        );
        let rows = sqlx::query_as::<_, Judgment>(&sql)
            .bind(judge_name)
            .bind(limit)
            .bind(offset)
            .fetch_all(pool)
            .await?;
        let total: i64 = sqlx::query_scalar(
            "SELECT COUNT(*) FROM judgments
             WHERE judge_name IS NOT NULL
               AND $1 = ANY(
                     ARRAY(SELECT TRIM(p)
                           FROM unnest(string_to_array(judge_name, ',')) p)
                   )",
        )
        .bind(judge_name)
        .fetch_one(pool)
        .await?;
        return Ok((rows, total));
    }

    let effective_court = court.unwrap_or("Supreme Court");

    if let Some(q) = query.filter(|q| !q.is_empty()) {
        let sql = format!(
            "SELECT {J},
                    ts_headline('english',
                        COALESCE(title,'') || ' ' || COALESCE(summary_text,''),
                        websearch_to_tsquery('english', $1),
                        'StartSel=[[, StopSel=]], MaxWords=15, MinWords=5'
                    ) AS snippet
             FROM judgments
             WHERE search_vector @@ websearch_to_tsquery('english', $1) AND court = $2
             ORDER BY ts_rank(search_vector, websearch_to_tsquery('english', $1)) DESC,
                      date DESC NULLS LAST
             LIMIT $3 OFFSET $4"
        );
        let rows = sqlx::query_as::<_, Judgment>(&sql)
            .bind(q)
            .bind(effective_court)
            .bind(limit)
            .bind(offset)
            .fetch_all(pool)
            .await?;

        let total: i64 = sqlx::query_scalar(
            "SELECT COUNT(*) FROM judgments
             WHERE search_vector @@ websearch_to_tsquery('english', $1) AND court = $2",
        )
        .bind(q)
        .bind(effective_court)
        .fetch_one(pool)
        .await?;

        Ok((rows, total))
    } else {
        let sql = format!(
            "SELECT {J} FROM judgments
             WHERE court = $1
             ORDER BY date DESC NULLS LAST, created_at DESC
             LIMIT $2 OFFSET $3"
        );
        let rows = sqlx::query_as::<_, Judgment>(&sql)
            .bind(effective_court)
            .bind(limit)
            .bind(offset)
            .fetch_all(pool)
            .await?;

        let total: i64 =
            sqlx::query_scalar("SELECT COUNT(*) FROM judgments WHERE court = $1")
                .bind(effective_court)
                .fetch_one(pool)
                .await?;

        Ok((rows, total))
    }
}

pub async fn get_judgment_by_id(pool: &PgPool, id: i32) -> sqlx::Result<Option<Judgment>> {
    let sql = format!("SELECT {J} FROM judgments WHERE id = $1");
    sqlx::query_as::<_, Judgment>(&sql)
        .bind(id)
        .fetch_optional(pool)
        .await
}

#[allow(dead_code)]
pub async fn get_judgment_by_case_number(
    pool: &PgPool,
    case_number: &str,
) -> sqlx::Result<Option<Judgment>> {
    let sql = format!("SELECT {J} FROM judgments WHERE case_number = $1");
    sqlx::query_as::<_, Judgment>(&sql)
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
    let sql = format!(
        "INSERT INTO judgments
           (case_number, title, judge_name, court, date, pdf_url, local_pdf_path, summary_text, updated_at)
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
         RETURNING {J}"
    );
    sqlx::query_as::<_, Judgment>(&sql)
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
    let sql = format!(
        "SELECT {J} FROM judgments WHERE pdf_url IS NOT NULL AND local_pdf_path IS NULL"
    );
    sqlx::query_as::<_, Judgment>(&sql).fetch_all(pool).await
}

/// Set `judge_name` only when it is currently NULL — safe to call repeatedly.
pub async fn set_judgment_judge_name(
    pool: &PgPool,
    judgment_id: i32,
    judge_name: &str,
) -> sqlx::Result<()> {
    sqlx::query(
        "UPDATE judgments SET judge_name = $1, updated_at = NOW()
         WHERE id = $2 AND judge_name IS NULL",
    )
    .bind(judge_name)
    .bind(judgment_id)
    .execute(pool)
    .await?;
    Ok(())
}

/// CoA judgments that have a local PDF but no judge name yet.
pub async fn coa_judgments_needing_judge_name(pool: &PgPool) -> sqlx::Result<Vec<Judgment>> {
    let sql = format!(
        "SELECT {J} FROM judgments
         WHERE court = 'Court of Appeal'
           AND judge_name IS NULL
           AND local_pdf_path IS NOT NULL"
    );
    sqlx::query_as::<_, Judgment>(&sql).fetch_all(pool).await
}

// ── Judges ─────────────────────────────────────────────────────────────────

pub async fn list_judges(pool: &PgPool, court: Option<&str>) -> sqlx::Result<Vec<JudgeWithCount>> {
    // judgments.judge_name can be a comma-separated list ("Smith JA, Jones JA").
    // The CTE expands every judgment's judge_name into one row per individual name
    // using unnest(string_to_array(...)).  We then do a plain equality LEFT JOIN so
    // sqlx never sees a correlated ARRAY(SELECT ...) subquery in a JOIN condition
    // (which causes sqlx to return zero rows even though psql returns correct data).
    if let Some(c) = court {
        sqlx::query_as::<_, JudgeWithCount>(
            "WITH expanded AS (
                 SELECT jm.id AS judgment_id,
                        TRIM(jn.name) AS single_name
                 FROM   judgments jm
                 CROSS JOIN LATERAL
                        unnest(string_to_array(jm.judge_name, ',')) AS jn(name)
                 WHERE  jm.judge_name IS NOT NULL
                   AND  TRIM(jm.judge_name) <> ''
             )
             SELECT j.id, j.name, j.court,
                    COUNT(DISTINCT e.judgment_id) AS total_cases
             FROM   judges j
             LEFT JOIN expanded e ON e.single_name = TRIM(j.name)
             WHERE  j.court = $1
             GROUP BY j.id, j.name, j.court
             ORDER BY j.name",
        )
        .bind(c)
        .fetch_all(pool)
        .await
    } else {
        sqlx::query_as::<_, JudgeWithCount>(
            "WITH expanded AS (
                 SELECT jm.id AS judgment_id,
                        TRIM(jn.name) AS single_name
                 FROM   judgments jm
                 CROSS JOIN LATERAL
                        unnest(string_to_array(jm.judge_name, ',')) AS jn(name)
                 WHERE  jm.judge_name IS NOT NULL
                   AND  TRIM(jm.judge_name) <> ''
             )
             SELECT j.id, j.name, j.court,
                    COUNT(DISTINCT e.judgment_id) AS total_cases
             FROM   judges j
             LEFT JOIN expanded e ON e.single_name = TRIM(j.name)
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

pub async fn get_judgments_by_judge(
    pool: &PgPool,
    judge_name: &str,
) -> sqlx::Result<Vec<Judgment>> {
    // Match judgments where the judge appears anywhere in the comma-separated judge_name field.
    let sql = format!(
        "SELECT {J} FROM judgments
         WHERE judge_name IS NOT NULL
           AND $1 = ANY(
                 ARRAY(SELECT TRIM(p)
                       FROM unnest(string_to_array(judge_name, ',')) p)
               )
         ORDER BY date DESC NULLS LAST"
    );
    sqlx::query_as::<_, Judgment>(&sql)
        .bind(judge_name)
        .fetch_all(pool)
        .await
}

pub async fn upsert_judge(pool: &PgPool, name: &str, court: Option<&str>) -> sqlx::Result<Judge> {
    sqlx::query_as::<_, Judge>(
        "INSERT INTO judges (name, court, updated_at)
         VALUES ($1, $2, NOW())
         ON CONFLICT (name) DO UPDATE SET
           -- Keep the existing court if one is already set; only fill in a NULL.
           -- This prevents a less-specific scraper from overwriting a known assignment.
           court      = COALESCE(judges.court, EXCLUDED.court),
           updated_at = NOW()
         RETURNING *",
    )
    .bind(name)
    .bind(court)
    .fetch_one(pool)
    .await
}

/// Remove obviously non-judge entries that scrapers may introduce.
///
/// Safe to call repeatedly — matches only entries that cannot be real judge names:
///   • names with embedded newlines (multi-row scrape artefact)
///   • names with commas (multi-judge bench stored as single row)
///   • names longer than 60 characters (no real judge name is this long)
///   • names containing legal-document phrases that are never part of a name
pub async fn cleanup_judges_table(pool: &PgPool) -> sqlx::Result<u64> {
    let result = sqlx::query(
        "DELETE FROM judges WHERE
             name ~ E'\\n'
             OR name LIKE '%,%'
             OR name = 'Supreme Court'
             OR length(name) > 60
             OR name ~* '\\m(mode\\s+of|last\\s+updated|court\\s+judges|formal\\s+mode|\
                            puisne|date\\s+of\\s+appointment|in\\s+writing|\
                            your\\s+honou?r|dear\\s+chief|my\\s+lord)\\M'",
    )
    .execute(pool)
    .await?;
    Ok(result.rows_affected())
}

pub async fn seed_judges_from_judgments(pool: &PgPool) -> sqlx::Result<u64> {
    // ── Diagnostic: count distinct judge names per court in judgments ────────
    let sc_src: i64 = sqlx::query_scalar(
        "SELECT COUNT(DISTINCT TRIM(judge_name)) FROM judgments
         WHERE court = 'Supreme Court' AND judge_name IS NOT NULL AND TRIM(judge_name) <> ''",
    )
    .fetch_one(pool)
    .await
    .unwrap_or(0);

    let coa_src: i64 = sqlx::query_scalar(
        "SELECT COUNT(DISTINCT TRIM(judge_name)) FROM judgments
         WHERE court = 'Court of Appeal' AND judge_name IS NOT NULL AND TRIM(judge_name) <> ''",
    )
    .fetch_one(pool)
    .await
    .unwrap_or(0);

    let parish_src: i64 = sqlx::query_scalar(
        "SELECT COUNT(DISTINCT TRIM(judge_name)) FROM judgments
         WHERE court = 'Parish Court' AND judge_name IS NOT NULL AND TRIM(judge_name) <> ''",
    )
    .fetch_one(pool)
    .await
    .unwrap_or(0);

    tracing::info!(
        "Seed diagnostic — distinct judge_name values in judgments: \
         SC={sc_src}, CoA={coa_src}, Parish={parish_src}"
    );

    // ── Pre-insert cleanup: remove corrupted rows from previous bad runs ────
    cleanup_judges_table(pool).await.ok();

    // ── Single-pass upsert ───────────────────────────────────────────────────
    // DISTINCT ON (TRIM(clean_name)) + ORDER BY TRIM(clean_name), date DESC
    // deduplicates leading/trailing-whitespace variants before conflicting on
    // the unique name index.  DO UPDATE overwrites any previous wrong-court
    // assignment (fixes judges bulk-inserted as SC on an earlier run).
    let result = sqlx::query(
        "INSERT INTO judges (name, court, updated_at)
         SELECT DISTINCT ON (TRIM(clean_name))
             TRIM(clean_name) AS name,
             court,
             NOW()            AS updated_at
         FROM (
             SELECT
                 court,
                 date,
                 unnest(
                     string_to_array(
                         regexp_replace(COALESCE(judge_name, ''), ' and ', ',', 'ig'),
                         ','
                     )
                 ) AS clean_name
             FROM judgments
             WHERE judge_name IS NOT NULL AND TRIM(judge_name) <> ''
         ) expanded
         WHERE TRIM(clean_name) <> ''
         ORDER BY TRIM(clean_name), date DESC NULLS LAST
         ON CONFLICT (name) DO UPDATE SET
             court      = EXCLUDED.court,
             updated_at = NOW()",
    )
    .execute(pool)
    .await?;

    let rows = result.rows_affected();
    tracing::info!("Seed: {rows} judge row(s) upserted (inserts + court corrections)");

    // ── Post-insert confirmation ─────────────────────────────────────────────
    let sc_now: i64 = sqlx::query_scalar(
        "SELECT COUNT(*) FROM judges WHERE court = 'Supreme Court'",
    )
    .fetch_one(pool)
    .await
    .unwrap_or(0);

    let coa_now: i64 = sqlx::query_scalar(
        "SELECT COUNT(*) FROM judges WHERE court = 'Court of Appeal'",
    )
    .fetch_one(pool)
    .await
    .unwrap_or(0);

    let parish_now: i64 = sqlx::query_scalar(
        "SELECT COUNT(*) FROM judges WHERE court = 'Parish Court'",
    )
    .fetch_one(pool)
    .await
    .unwrap_or(0);

    tracing::info!(
        "Seed result — judges table: SC={sc_now}, CoA={coa_now}, Parish={parish_now}"
    );

    Ok(rows)
}

pub async fn list_judge_connections(pool: &PgPool) -> sqlx::Result<Vec<JudgeConnection>> {
    sqlx::query_as::<_, JudgeConnection>(
        "WITH jc AS (
             -- Expand each judgment's judge_name into individual judge IDs.
             -- Handles 'A and B', 'A, B', and 'A, B and C' formats.
             SELECT
                 jm.case_number,
                 j.id AS judge_id
             FROM judgments jm
             CROSS JOIN LATERAL unnest(
                 string_to_array(
                     regexp_replace(COALESCE(jm.judge_name, ''), ' and ', ',', 'ig'),
                     ','
                 )
             ) AS raw_name
             JOIN judges j ON j.name = TRIM(raw_name)
             WHERE jm.judge_name IS NOT NULL
               AND TRIM(jm.judge_name) <> ''
         ),
         case_pairs AS (
             -- Judges who co-appear on the same case_number.
             SELECT
                 LEAST(a.judge_id, b.judge_id)         AS judge_a_id,
                 GREATEST(a.judge_id, b.judge_id)      AS judge_b_id,
                 COUNT(DISTINCT a.case_number)::bigint  AS count
             FROM jc a
             JOIN jc b ON a.case_number = b.case_number AND a.judge_id < b.judge_id
             GROUP BY 1, 2
         ),
         court_pairs AS (
             -- Same-court pairs ensure visual connectivity when case co-authorship is sparse.
             SELECT
                 j1.id     AS judge_a_id,
                 j2.id     AS judge_b_id,
                 1::bigint AS count
             FROM judges j1
             JOIN judges j2 ON j1.court = j2.court AND j1.id < j2.id
             WHERE j1.court IS NOT NULL
         )
         SELECT judge_a_id, judge_b_id, MAX(count) AS count
         FROM (
             SELECT * FROM case_pairs
             UNION ALL
             SELECT * FROM court_pairs
         ) combined
         GROUP BY judge_a_id, judge_b_id
         ORDER BY judge_a_id, judge_b_id",
    )
    .fetch_all(pool)
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
        r#"SELECT id, user_id, case_id, "type", sent_at, read_at, title, message
           FROM notifications WHERE user_id = $1 ORDER BY sent_at DESC LIMIT 100"#,
    )
    .bind(user_id)
    .fetch_all(pool)
    .await
}

pub async fn get_unread_notification_count(pool: &PgPool, user_id: i32) -> sqlx::Result<i64> {
    sqlx::query_scalar(
        "SELECT COUNT(*) FROM notifications WHERE user_id = $1 AND read_at IS NULL",
    )
    .bind(user_id)
    .fetch_one(pool)
    .await
}

pub async fn mark_notifications_read(pool: &PgPool, user_id: i32) -> sqlx::Result<u64> {
    let result = sqlx::query(
        "UPDATE notifications SET read_at = NOW() WHERE user_id = $1 AND read_at IS NULL",
    )
    .bind(user_id)
    .execute(pool)
    .await?;
    Ok(result.rows_affected())
}

pub async fn mark_notification_read(
    pool: &PgPool,
    notification_id: i32,
    user_id: i32,
) -> sqlx::Result<bool> {
    let result = sqlx::query(
        "UPDATE notifications SET read_at = NOW()
         WHERE id = $1 AND user_id = $2 AND read_at IS NULL",
    )
    .bind(notification_id)
    .bind(user_id)
    .execute(pool)
    .await?;
    Ok(result.rows_affected() > 0)
}

// ── Court Sittings ─────────────────────────────────────────────────────────

/// Returns a SQL fragment (no parameter bindings) that filters court_sittings
/// by court based on the court_division column.
///
/// Safe to interpolate directly — input is always one of three known internal
/// strings, never raw user input.
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
    judge: Option<&str>,
) -> sqlx::Result<Vec<CourtSitting>> {
    // Judge-specific path: return all sittings for that judge without court constraint.
    // Use unnest to handle any future comma-separated judge_name values.
    if let Some(judge_name) = judge {
        let sql = format!(
            "SELECT {S} FROM court_sittings
             WHERE judge_name IS NOT NULL
               AND $1 = ANY(
                     ARRAY(SELECT TRIM(p)
                           FROM unnest(string_to_array(judge_name, ',')) p)
                   )
             ORDER BY event_date DESC NULLS LAST, event_time NULLS LAST"
        );
        return sqlx::query_as::<_, CourtSitting>(&sql)
            .bind(judge_name)
            .fetch_all(pool)
            .await;
    }

    let court_filter = court.map(sitting_court_filter);

    match (date_from, date_to, court_filter) {
        (Some(from), Some(to), Some(filter)) => {
            let sql = format!(
                "SELECT {S} FROM court_sittings
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
            let sql = format!(
                "SELECT {S} FROM court_sittings
                 WHERE event_date BETWEEN $1 AND $2
                 ORDER BY event_date, event_time NULLS LAST"
            );
            sqlx::query_as::<_, CourtSitting>(&sql)
                .bind(from)
                .bind(to)
                .fetch_all(pool)
                .await
        }
        (Some(from), None, Some(filter)) => {
            let sql = format!(
                "SELECT {S} FROM court_sittings
                 WHERE event_date >= $1 AND {filter}
                 ORDER BY event_date, event_time NULLS LAST"
            );
            sqlx::query_as::<_, CourtSitting>(&sql)
                .bind(from)
                .fetch_all(pool)
                .await
        }
        (Some(from), None, None) => {
            let sql = format!(
                "SELECT {S} FROM court_sittings
                 WHERE event_date >= $1
                 ORDER BY event_date, event_time NULLS LAST"
            );
            sqlx::query_as::<_, CourtSitting>(&sql)
                .bind(from)
                .fetch_all(pool)
                .await
        }
        (None, Some(to), Some(filter)) => {
            let sql = format!(
                "SELECT {S} FROM court_sittings
                 WHERE event_date <= $1 AND {filter}
                 ORDER BY event_date, event_time NULLS LAST"
            );
            sqlx::query_as::<_, CourtSitting>(&sql)
                .bind(to)
                .fetch_all(pool)
                .await
        }
        (None, Some(to), None) => {
            let sql = format!(
                "SELECT {S} FROM court_sittings
                 WHERE event_date <= $1
                 ORDER BY event_date, event_time NULLS LAST"
            );
            sqlx::query_as::<_, CourtSitting>(&sql)
                .bind(to)
                .fetch_all(pool)
                .await
        }
        (None, None, Some(filter)) => {
            let sql = format!(
                "SELECT {S} FROM court_sittings
                 WHERE event_date >= CURRENT_DATE AND {filter}
                 ORDER BY event_date, event_time NULLS LAST"
            );
            sqlx::query_as::<_, CourtSitting>(&sql)
                .fetch_all(pool)
                .await
        }
        (None, None, None) => {
            let sql = format!(
                "SELECT {S} FROM court_sittings
                 WHERE event_date >= CURRENT_DATE
                 ORDER BY event_date, event_time NULLS LAST"
            );
            sqlx::query_as::<_, CourtSitting>(&sql)
                .fetch_all(pool)
                .await
        }
    }
}

pub async fn get_today_sittings(pool: &PgPool) -> sqlx::Result<Vec<CourtSitting>> {
    let sql = format!(
        "SELECT {S} FROM court_sittings
         WHERE event_date = CURRENT_DATE ORDER BY event_time NULLS LAST"
    );
    sqlx::query_as::<_, CourtSitting>(&sql).fetch_all(pool).await
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
    let sql = format!(
        "INSERT INTO court_sittings
           (case_number, title, judge_name, court_division, event_type,
            event_date, event_time, lawyers, pdf_source_url)
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9)
         ON CONFLICT DO NOTHING
         RETURNING {S}"
    );
    sqlx::query_as::<_, CourtSitting>(&sql)
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

pub async fn most_recent_judgment_date_by_court(
    pool: &PgPool,
    court: &str,
) -> sqlx::Result<Option<NaiveDate>> {
    sqlx::query_scalar("SELECT MAX(date) FROM judgments WHERE court = $1")
        .bind(court)
        .fetch_one(pool)
        .await
}

pub async fn most_recent_sitting_date(pool: &PgPool) -> sqlx::Result<Option<NaiveDate>> {
    sqlx::query_scalar("SELECT MAX(event_date) FROM court_sittings")
        .fetch_one(pool)
        .await
}

pub async fn most_recent_sitting_date_by_court(
    pool: &PgPool,
    court: &str,
) -> sqlx::Result<Option<NaiveDate>> {
    let filter = sitting_court_filter(court);
    let sql = format!("SELECT MAX(event_date) FROM court_sittings WHERE {filter}");
    sqlx::query_scalar(&sql).fetch_one(pool).await
}

pub async fn count_sittings_by_source_url(pool: &PgPool, url: &str) -> sqlx::Result<i64> {
    sqlx::query_scalar("SELECT COUNT(*) FROM court_sittings WHERE pdf_source_url = $1")
        .bind(url)
        .fetch_one(pool)
        .await
}

/// Total rows in court_sittings for the given logical court, using the same
/// ILIKE filter as the rest of the queries layer.
pub async fn count_sittings_for_court(pool: &PgPool, court: &str) -> sqlx::Result<i64> {
    let filter = sitting_court_filter(court);
    let sql = format!("SELECT COUNT(*) FROM court_sittings WHERE {filter}");
    sqlx::query_scalar(&sql).fetch_one(pool).await
}

/// Exact-match count for a specific court_division value (e.g. "Criminal").
pub async fn count_sittings_by_division(pool: &PgPool, division: &str) -> sqlx::Result<i64> {
    sqlx::query_scalar("SELECT COUNT(*) FROM court_sittings WHERE court_division = $1")
        .bind(division)
        .fetch_one(pool)
        .await
}

/// Returns true if there is at least one 'Civil' row for this URL.
/// Unlike `has_only_civil_sittings_for_url`, this fires even when the URL has a
/// mix of Civil and non-Civil rows (e.g. a backfill migration fixed some entries
/// but left others as 'Civil').
pub async fn has_any_civil_sittings_for_url(pool: &PgPool, url: &str) -> sqlx::Result<bool> {
    let count: i64 = sqlx::query_scalar(
        "SELECT COUNT(*) FROM court_sittings \
         WHERE pdf_source_url = $1 AND court_division = 'Civil'",
    )
    .bind(url)
    .fetch_one(pool)
    .await?;
    Ok(count > 0)
}

/// Deletes all court_sittings rows that came from `url` and have
/// `court_division = 'Civil'`.  Called before re-scraping a URL whose
/// division was wrong on the previous parse run, so that `sitting_exists`
/// (which checks by case_number/event_date/event_type, not division) does
/// not treat the old wrong-division rows as already-processed duplicates.
pub async fn delete_civil_sittings_for_url(pool: &PgPool, url: &str) -> sqlx::Result<u64> {
    sqlx::query(
        "DELETE FROM court_sittings WHERE pdf_source_url = $1 AND court_division = 'Civil'",
    )
    .bind(url)
    .execute(pool)
    .await
    .map(|r| r.rows_affected())
}

/// Deletes ALL court_sittings rows that came from `url`, regardless of division.
/// Use before re-scraping a URL so that `sitting_exists` (which checks
/// case_number/event_date/event_type without a division filter) does not treat
/// previously-inserted rows as duplicates and silently skip re-insertion.
pub async fn delete_sittings_for_url(pool: &PgPool, url: &str) -> sqlx::Result<u64> {
    sqlx::query("DELETE FROM court_sittings WHERE pdf_source_url = $1")
        .bind(url)
        .execute(pool)
        .await
        .map(|r| r.rows_affected())
}

/// Deletes Civil sittings for every URL whose `pdf_source_url` contains `domain`.
/// Used as a domain-wide sweep when the processed-URL list is empty and we cannot
/// enumerate individual URLs (e.g. CoA nuclear eviction with an already-clear list).
pub async fn delete_civil_sittings_for_domain(pool: &PgPool, domain: &str) -> sqlx::Result<u64> {
    sqlx::query(
        "DELETE FROM court_sittings WHERE pdf_source_url ILIKE $1 AND court_division = 'Civil'",
    )
    .bind(format!("%{domain}%"))
    .execute(pool)
    .await
    .map(|r| r.rows_affected())
}

/// Returns true iff there is at least one court_sitting for this URL AND every
/// sitting has court_division = 'Civil' — indicating a PDF parsed before
/// detect_division_header() was implemented.
pub async fn has_only_civil_sittings_for_url(pool: &PgPool, url: &str) -> sqlx::Result<bool> {
    let (total, non_civil): (i64, i64) = sqlx::query_as(
        "SELECT COUNT(*), COUNT(*) FILTER (WHERE court_division <> 'Civil') \
         FROM court_sittings WHERE pdf_source_url = $1",
    )
    .bind(url)
    .fetch_one(pool)
    .await?;
    Ok(total > 0 && non_civil == 0)
}

/// Full-text search across court_sittings; returns ranked results with snippets.
pub async fn search_court_sittings(
    pool: &PgPool,
    q: &str,
    court: Option<&str>,
) -> sqlx::Result<Vec<CourtSitting>> {
    let snippet = "ts_headline('english',
        COALESCE(title,'') || ' ' || COALESCE(case_number,'') || ' ' || COALESCE(judge_name,''),
        websearch_to_tsquery('english', $1),
        'StartSel=[[, StopSel=]], MaxWords=15, MinWords=5'
    ) AS snippet";

    if let Some(c) = court {
        let filter = sitting_court_filter(c);
        let sql = format!(
            "SELECT {S}, {snippet}
             FROM court_sittings
             WHERE search_vector @@ websearch_to_tsquery('english', $1) AND {filter}
             ORDER BY ts_rank(search_vector, websearch_to_tsquery('english', $1)) DESC,
                      event_date DESC NULLS LAST
             LIMIT 100"
        );
        sqlx::query_as::<_, CourtSitting>(&sql)
            .bind(q)
            .fetch_all(pool)
            .await
    } else {
        let sql = format!(
            "SELECT {S}, {snippet}
             FROM court_sittings
             WHERE search_vector @@ websearch_to_tsquery('english', $1)
             ORDER BY ts_rank(search_vector, websearch_to_tsquery('english', $1)) DESC,
                      event_date DESC NULLS LAST
             LIMIT 100"
        );
        sqlx::query_as::<_, CourtSitting>(&sql)
            .bind(q)
            .fetch_all(pool)
            .await
    }
}

// ── Court Stats ────────────────────────────────────────────────────────────

pub async fn get_court_sitting_by_id(
    pool: &PgPool,
    id: i32,
) -> sqlx::Result<Option<CourtSitting>> {
    let sql = format!("SELECT {S} FROM court_sittings WHERE id = $1");
    sqlx::query_as::<_, CourtSitting>(&sql)
        .bind(id)
        .fetch_optional(pool)
        .await
}

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

    let total_sittings_sql = format!("SELECT COUNT(*) FROM court_sittings WHERE {filter}");
    let total_sittings: i64 = sqlx::query_scalar(&total_sittings_sql)
        .fetch_one(pool)
        .await?;

    let week_sql = format!(
        "SELECT COUNT(*) FROM court_sittings
         WHERE event_date >= CURRENT_DATE
           AND event_date <= CURRENT_DATE + INTERVAL '7 days'
           AND {filter}"
    );
    let sittings_this_week: i64 = sqlx::query_scalar(&week_sql)
        .fetch_one(pool)
        .await?;

    Ok(CourtStats {
        court: court.to_string(),
        total_judgments,
        sittings_this_week,
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

        if let Err(e) = sqlx::query(
            "UPDATE user_cases SET last_event_date = $1, last_event_time = $2 WHERE id = $3",
        )
        .bind(row.event_date)
        .bind(row.event_time)
        .bind(row.uc_id)
        .execute(pool)
        .await
        {
            tracing::warn!(
                "[Notifications] failed to update last_event for uc_id {}: {e}",
                row.uc_id
            );
        }
    }

    if !changed.is_empty() {
        tracing::info!(
            "[Notifications] {} sitting_changed notification(s) inserted",
            changed.len()
        );
    }
}

// ── Parish Court Cases ─────────────────────────────────────────────────────

const PC: &str = "id, parish, accused_name, offence, status, week_of, pdf_source_url, created_at";

pub async fn list_parish_cases(
    pool: &PgPool,
    parish: Option<&str>,
    q: Option<&str>,
    page: i64,
    limit: i64,
) -> sqlx::Result<(Vec<ParishCourtCase>, i64)> {
    let offset = (page - 1).max(0) * limit;

    let (rows, total) = match (parish, q) {
        (Some(p), Some(search)) => {
            let pattern = format!("%{}%", search.to_lowercase());
            let sql = format!(
                "SELECT {PC} FROM parish_court_cases
                 WHERE parish = $1
                   AND (LOWER(accused_name) LIKE $2 OR LOWER(offence) LIKE $2)
                 ORDER BY week_of DESC NULLS LAST, id DESC
                 LIMIT $3 OFFSET $4"
            );
            let rows = sqlx::query_as::<_, ParishCourtCase>(&sql)
                .bind(p)
                .bind(&pattern)
                .bind(limit)
                .bind(offset)
                .fetch_all(pool)
                .await?;
            let total: i64 = sqlx::query_scalar(
                "SELECT COUNT(*) FROM parish_court_cases
                 WHERE parish = $1 AND (LOWER(accused_name) LIKE $2 OR LOWER(offence) LIKE $2)",
            )
            .bind(p)
            .bind(&pattern)
            .fetch_one(pool)
            .await?;
            (rows, total)
        }
        (Some(p), None) => {
            let sql = format!(
                "SELECT {PC} FROM parish_court_cases
                 WHERE parish = $1
                 ORDER BY week_of DESC NULLS LAST, id DESC
                 LIMIT $2 OFFSET $3"
            );
            let rows = sqlx::query_as::<_, ParishCourtCase>(&sql)
                .bind(p)
                .bind(limit)
                .bind(offset)
                .fetch_all(pool)
                .await?;
            let total: i64 =
                sqlx::query_scalar("SELECT COUNT(*) FROM parish_court_cases WHERE parish = $1")
                    .bind(p)
                    .fetch_one(pool)
                    .await?;
            (rows, total)
        }
        (None, Some(search)) => {
            let pattern = format!("%{}%", search.to_lowercase());
            let sql = format!(
                "SELECT {PC} FROM parish_court_cases
                 WHERE LOWER(accused_name) LIKE $1 OR LOWER(offence) LIKE $1 OR LOWER(parish) LIKE $1
                 ORDER BY week_of DESC NULLS LAST, id DESC
                 LIMIT $2 OFFSET $3"
            );
            let rows = sqlx::query_as::<_, ParishCourtCase>(&sql)
                .bind(&pattern)
                .bind(limit)
                .bind(offset)
                .fetch_all(pool)
                .await?;
            let total: i64 = sqlx::query_scalar(
                "SELECT COUNT(*) FROM parish_court_cases
                 WHERE LOWER(accused_name) LIKE $1 OR LOWER(offence) LIKE $1 OR LOWER(parish) LIKE $1",
            )
            .bind(&pattern)
            .fetch_one(pool)
            .await?;
            (rows, total)
        }
        (None, None) => {
            let sql = format!(
                "SELECT {PC} FROM parish_court_cases
                 ORDER BY week_of DESC NULLS LAST, id DESC
                 LIMIT $1 OFFSET $2"
            );
            let rows = sqlx::query_as::<_, ParishCourtCase>(&sql)
                .bind(limit)
                .bind(offset)
                .fetch_all(pool)
                .await?;
            let total: i64 =
                sqlx::query_scalar("SELECT COUNT(*) FROM parish_court_cases")
                    .fetch_one(pool)
                    .await?;
            (rows, total)
        }
    };

    Ok((rows, total))
}

pub async fn parish_summary(pool: &PgPool) -> sqlx::Result<Vec<ParishSummary>> {
    sqlx::query_as::<_, ParishSummary>(
        "SELECT parish AS name, COUNT(*) AS total_cases
         FROM parish_court_cases
         GROUP BY parish
         ORDER BY parish",
    )
    .fetch_all(pool)
    .await
}

pub async fn list_all_charges_for_accused(
    pool: &PgPool,
    accused_name: &str,
) -> sqlx::Result<Vec<ParishCourtCase>> {
    sqlx::query_as::<_, ParishCourtCase>(&format!(
        "SELECT {PC} FROM parish_court_cases
         WHERE accused_name = $1
         ORDER BY week_of DESC NULLS LAST, parish, id"
    ))
    .bind(accused_name)
    .fetch_all(pool)
    .await
}

pub async fn get_parish_case(pool: &PgPool, id: i32) -> sqlx::Result<Option<ParishCourtCase>> {
    sqlx::query_as::<_, ParishCourtCase>(&format!(
        "SELECT {PC} FROM parish_court_cases WHERE id = $1"
    ))
    .bind(id)
    .fetch_optional(pool)
    .await
}

pub async fn list_related_parish_charges(
    pool: &PgPool,
    exclude_id: i32,
    accused_name: &str,
    parish: &str,
    week_of: NaiveDate,
) -> sqlx::Result<Vec<ParishCourtCase>> {
    sqlx::query_as::<_, ParishCourtCase>(&format!(
        "SELECT {PC} FROM parish_court_cases
         WHERE accused_name = $1 AND parish = $2 AND week_of = $3 AND id != $4
         ORDER BY id"
    ))
    .bind(accused_name)
    .bind(parish)
    .bind(week_of)
    .bind(exclude_id)
    .fetch_all(pool)
    .await
}

pub async fn upsert_parish_case(
    pool: &PgPool,
    parish: &str,
    accused_name: Option<&str>,
    offence: Option<&str>,
    status: Option<&str>,
    week_of: Option<NaiveDate>,
    pdf_source_url: &str,
) -> sqlx::Result<()> {
    sqlx::query(
        "INSERT INTO parish_court_cases
             (parish, accused_name, offence, status, week_of, pdf_source_url)
         VALUES ($1, $2, $3, $4, $5, $6)
         ON CONFLICT DO NOTHING",
    )
    .bind(parish)
    .bind(accused_name)
    .bind(offence)
    .bind(status)
    .bind(week_of)
    .bind(pdf_source_url)
    .execute(pool)
    .await?;
    Ok(())
}
