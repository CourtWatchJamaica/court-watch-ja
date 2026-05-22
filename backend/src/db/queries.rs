use chrono::{NaiveDate, NaiveDateTime, NaiveTime};
use sqlx::PgPool;

use super::models::*;

// Explicit column lists — omit `search_vector` (tsvector, not decodable by sqlx).
const J: &str =
    "id, case_number, title, judge_name, court, date, pdf_url, local_pdf_path, summary_text, created_at, updated_at, source_url, tags";
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

pub async fn create_user(pool: &PgPool, email: &str, password_hash: &str, display_name: Option<&str>) -> sqlx::Result<User> {
    sqlx::query_as::<_, User>(
        "INSERT INTO users (email, password_hash, display_name) VALUES ($1, $2, $3)
         RETURNING id, email, password_hash, role, display_name, created_at, email_verified",
    )
    .bind(email)
    .bind(password_hash)
    .bind(display_name)
    .fetch_one(pool)
    .await
}

pub async fn find_user_by_email(pool: &PgPool, email: &str) -> sqlx::Result<Option<User>> {
    sqlx::query_as::<_, User>(
        "SELECT id, email, password_hash, role, display_name, created_at, email_verified FROM users WHERE email = $1",
    )
    .bind(email)
    .fetch_optional(pool)
    .await
}

pub async fn get_user_by_id(pool: &PgPool, id: i32) -> sqlx::Result<Option<User>> {
    sqlx::query_as::<_, User>(
        "SELECT id, email, password_hash, role, display_name, created_at, email_verified FROM users WHERE id = $1",
    )
    .bind(id)
    .fetch_optional(pool)
    .await
}

// ── Admin: User management ─────────────────────────────────────────────────

pub async fn admin_list_users(pool: &PgPool) -> sqlx::Result<Vec<User>> {
    sqlx::query_as::<_, User>(
        "SELECT id, email, password_hash, role, display_name, created_at, email_verified FROM users ORDER BY created_at DESC",
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
         RETURNING id, email, password_hash, role, display_name, created_at, email_verified",
    )
    .bind(role)
    .bind(user_id)
    .fetch_optional(pool)
    .await
}

pub async fn admin_delete_user(pool: &PgPool, user_id: i32) -> sqlx::Result<bool> {
    let mut tx = pool.begin().await?;

    // Remove related rows in dependency order before deleting the user.
    // user_case_settings cascades from user_cases, so no explicit delete needed.
    sqlx::query("DELETE FROM notifications WHERE user_id = $1")
        .bind(user_id)
        .execute(&mut *tx)
        .await?;
    sqlx::query("DELETE FROM user_cases WHERE user_id = $1")
        .bind(user_id)
        .execute(&mut *tx)
        .await?;
    sqlx::query("DELETE FROM verification_tokens WHERE user_id = $1")
        .bind(user_id)
        .execute(&mut *tx)
        .await?;

    let result = sqlx::query("DELETE FROM users WHERE id = $1")
        .bind(user_id)
        .execute(&mut *tx)
        .await?;

    tx.commit().await?;
    Ok(result.rows_affected() > 0)
}

pub async fn update_user_profile(
    pool: &PgPool,
    user_id: i32,
    display_name: Option<&str>,       // SET directly — None clears the field
    new_email: Option<&str>,
    new_password_hash: Option<&str>,
) -> sqlx::Result<Option<User>> {
    sqlx::query_as::<_, User>(
        "UPDATE users
         SET display_name  = $2,
             email         = COALESCE($3, email),
             password_hash = COALESCE($4, password_hash)
         WHERE id = $1
         RETURNING id, email, password_hash, role, display_name, created_at, email_verified",
    )
    .bind(user_id)
    .bind(display_name)
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
    tag: Option<&str>,           // comma-separated tags; OR logic
    date_from: Option<NaiveDate>,
    date_to: Option<NaiveDate>,
    case_number: Option<&str>,
) -> sqlx::Result<(Vec<Judgment>, i64)> {
    use sqlx::QueryBuilder;

    let offset = (page - 1).max(0) * limit;
    let tags: Vec<String> = tag
        .map(|t| t.split(',').map(|s| s.trim().to_string()).filter(|s| !s.is_empty()).collect())
        .unwrap_or_default();
    let has_fts = query.map_or(false, |q| !q.trim().is_empty());
    // Court constraint is bypassed when a judge or tag filter is active.
    // When active but no specific court is chosen, all courts are returned
    // and the ORDER BY applies court priority instead.
    let use_court = judge.is_none() && tags.is_empty();

    // ── COUNT ──────────────────────────────────────────────────────────────
    let mut cq: QueryBuilder<sqlx::Postgres> =
        QueryBuilder::new("SELECT COUNT(*) FROM judgments WHERE 1=1");
    if has_fts {
        cq.push(" AND search_vector @@ websearch_to_tsquery('english', ");
        cq.push_bind(query.unwrap().trim());
        cq.push(")");
    }
    if use_court {
        if let Some(c) = court {
            cq.push(" AND court = ");
            cq.push_bind(c);
        }
    }
    if let Some(j) = judge {
        cq.push(" AND judge_name IS NOT NULL AND ");
        cq.push_bind(j);
        cq.push(" = ANY(ARRAY(SELECT TRIM(p) FROM unnest(string_to_array(judge_name, ',')) p))");
    }
    if !tags.is_empty() {
        cq.push(" AND tags && ");
        cq.push_bind(tags.clone());
    }
    if let Some(df) = date_from {
        cq.push(" AND date >= ");
        cq.push_bind(df);
    }
    if let Some(dt) = date_to {
        cq.push(" AND date <= ");
        cq.push_bind(dt);
    }
    if let Some(cn) = case_number.filter(|s| !s.is_empty()) {
        cq.push(" AND case_number ILIKE ");
        cq.push_bind(format!("%{cn}%"));
    }
    let total: i64 = cq.build_query_scalar().fetch_one(pool).await?;

    // ── DATA ───────────────────────────────────────────────────────────────
    let mut dq: QueryBuilder<sqlx::Postgres> = if has_fts {
        let q = query.unwrap().trim();
        let mut qb = QueryBuilder::new(format!(
            "SELECT {J}, ts_headline('english', \
             COALESCE(title,'') || ' ' || COALESCE(summary_text,''), \
             websearch_to_tsquery('english', "
        ));
        qb.push_bind(q);
        qb.push("), 'StartSel=[[, StopSel=]], MaxWords=15, MinWords=5') AS snippet \
              FROM judgments WHERE 1=1");
        qb
    } else {
        QueryBuilder::new(format!("SELECT {J} FROM judgments WHERE 1=1"))
    };

    if has_fts {
        dq.push(" AND search_vector @@ websearch_to_tsquery('english', ");
        dq.push_bind(query.unwrap().trim());
        dq.push(")");
    }
    if use_court {
        if let Some(c) = court {
            dq.push(" AND court = ");
            dq.push_bind(c);
        }
    }
    if let Some(j) = judge {
        dq.push(" AND judge_name IS NOT NULL AND ");
        dq.push_bind(j);
        dq.push(" = ANY(ARRAY(SELECT TRIM(p) FROM unnest(string_to_array(judge_name, ',')) p))");
    }
    if !tags.is_empty() {
        dq.push(" AND tags && ");
        dq.push_bind(tags);
    }
    if let Some(df) = date_from {
        dq.push(" AND date >= ");
        dq.push_bind(df);
    }
    if let Some(dt) = date_to {
        dq.push(" AND date <= ");
        dq.push_bind(dt);
    }
    if let Some(cn) = case_number.filter(|s| !s.is_empty()) {
        dq.push(" AND case_number ILIKE ");
        dq.push_bind(format!("%{cn}%"));
    }

    if has_fts {
        dq.push(" ORDER BY ts_rank(search_vector, websearch_to_tsquery('english', ");
        dq.push_bind(query.unwrap().trim());
        dq.push(")) DESC, date DESC NULLS LAST");
    } else if use_court && court.is_none() {
        dq.push(
            " ORDER BY CASE court \
               WHEN 'Supreme Court'  THEN 1 \
               WHEN 'Court of Appeal' THEN 2 \
               WHEN 'Parish Court'   THEN 3 \
               ELSE 4 \
             END, date DESC NULLS LAST, created_at DESC",
        );
    } else {
        dq.push(" ORDER BY date DESC NULLS LAST, created_at DESC");
    }
    dq.push(" LIMIT ");
    dq.push_bind(limit);
    dq.push(" OFFSET ");
    dq.push_bind(offset);

    let rows = dq.build_query_as::<Judgment>().fetch_all(pool).await?;
    Ok((rows, total))
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
    source_url: Option<&str>,
    tags: Vec<String>,
) -> sqlx::Result<Judgment> {
    let sql = format!(
        "INSERT INTO judgments
           (case_number, title, judge_name, court, date, pdf_url, local_pdf_path, summary_text, source_url, tags, updated_at)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, NOW())
         ON CONFLICT (case_number) DO UPDATE SET
           title          = COALESCE(EXCLUDED.title, judgments.title),
           judge_name     = COALESCE(EXCLUDED.judge_name, judgments.judge_name),
           court          = COALESCE(EXCLUDED.court, judgments.court),
           date           = COALESCE(EXCLUDED.date, judgments.date),
           pdf_url        = COALESCE(EXCLUDED.pdf_url, judgments.pdf_url),
           local_pdf_path = COALESCE(EXCLUDED.local_pdf_path, judgments.local_pdf_path),
           summary_text   = COALESCE(EXCLUDED.summary_text, judgments.summary_text),
           source_url     = COALESCE(EXCLUDED.source_url, judgments.source_url),
           tags           = CASE WHEN array_length(EXCLUDED.tags, 1) > 0 THEN EXCLUDED.tags ELSE judgments.tags END,
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
        .bind(source_url)
        .bind(tags)
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

/// Persist a freshly-verified PDF URL and its source detail-page URL so that
/// subsequent calls to the original-pdf endpoint return instantly from the DB.
pub async fn cache_judgment_pdf_url(
    pool: &PgPool,
    id: i32,
    pdf_url: &str,
    source_url: &str,
) -> sqlx::Result<()> {
    sqlx::query(
        "UPDATE judgments
         SET pdf_url = $1, source_url = $2, updated_at = NOW()
         WHERE id = $3",
    )
    .bind(pdf_url)
    .bind(source_url)
    .bind(id)
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

/// Clear pdf_url and local_pdf_path when the downloaded content doesn't match the case.
pub async fn nullify_judgment_pdf(pool: &PgPool, id: i32) -> sqlx::Result<()> {
    sqlx::query(
        "UPDATE judgments SET pdf_url = NULL, local_pdf_path = NULL, updated_at = NOW() WHERE id = $1",
    )
    .bind(id)
    .execute(pool)
    .await?;
    Ok(())
}

/// All judgments that have both a pdf_url and a local copy on disk.
/// Used by the one-time mismatch cleanup.
pub async fn judgments_with_local_pdf(pool: &PgPool) -> sqlx::Result<Vec<Judgment>> {
    let sql = format!(
        "SELECT {J} FROM judgments WHERE local_pdf_path IS NOT NULL AND pdf_url IS NOT NULL"
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

pub async fn autocomplete_judges(pool: &PgPool, q: &str) -> sqlx::Result<Vec<String>> {
    let pattern = format!("%{}%", q.trim());
    sqlx::query_scalar(
        "SELECT name FROM judges WHERE name ILIKE $1 ORDER BY name LIMIT 10",
    )
    .bind(pattern)
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
        "SELECT uc.id, uc.user_id, uc.case_id, uc.case_type, uc.case_number,
                uc.last_event_date, uc.last_event_time, uc.created_at,
                ucs.notify_immediately, ucs.notify_day_before, ucs.notify_morning_of
         FROM user_cases uc
         LEFT JOIN user_case_settings ucs ON ucs.user_case_id = uc.id
         WHERE uc.user_id = $1
         ORDER BY uc.created_at DESC",
    )
    .bind(user_id)
    .fetch_all(pool)
    .await
}

/// Insert a tracking entry by case ID.  Returns the new row, or `RowNotFound`
/// when the conflict index fires (already tracked — treat as success).
pub async fn add_user_case(
    pool: &PgPool,
    user_id: i32,
    case_id: i32,
    case_type: &str,
) -> sqlx::Result<UserCase> {
    sqlx::query_as::<_, UserCase>(
        "INSERT INTO user_cases (user_id, case_id, case_type)
         VALUES ($1, $2, $3)
         ON CONFLICT DO NOTHING
         RETURNING id, user_id, case_id, case_type, case_number,
                   last_event_date, last_event_time, created_at,
                   NULL::boolean AS notify_immediately,
                   NULL::boolean AS notify_day_before,
                   NULL::boolean AS notify_morning_of",
    )
    .bind(user_id)
    .bind(case_id)
    .bind(case_type)
    .fetch_one(pool)
    .await
}

/// Insert a tracking entry by case number (no known case_id yet).
pub async fn add_user_case_by_number(
    pool: &PgPool,
    user_id: i32,
    case_number: &str,
    case_type: &str,
) -> sqlx::Result<UserCase> {
    sqlx::query_as::<_, UserCase>(
        "INSERT INTO user_cases (user_id, case_number, case_type)
         VALUES ($1, $2, $3)
         ON CONFLICT DO NOTHING
         RETURNING id, user_id, case_id, case_type, case_number,
                   last_event_date, last_event_time, created_at,
                   NULL::boolean AS notify_immediately,
                   NULL::boolean AS notify_day_before,
                   NULL::boolean AS notify_morning_of",
    )
    .bind(user_id)
    .bind(case_number)
    .bind(case_type)
    .fetch_one(pool)
    .await
}

/// Returns `true` if the case_number exists in either `court_sittings` or
/// `judgments`.  Used to reject free-text tracking requests for unknown cases.
pub async fn case_number_exists(pool: &PgPool, case_number: &str) -> sqlx::Result<bool> {
    sqlx::query_scalar(
        r#"SELECT EXISTS (
               SELECT 1 FROM court_sittings WHERE case_number = $1
               UNION
               SELECT 1 FROM judgments       WHERE case_number = $1
           )"#,
    )
    .bind(case_number)
    .fetch_one(pool)
    .await
}

/// Returns `true` if the user already has a `user_cases` row for this
/// case_number (tracked by case_number directly).
pub async fn user_tracks_case_number(
    pool: &PgPool,
    user_id: i32,
    case_number: &str,
) -> sqlx::Result<bool> {
    sqlx::query_scalar(
        "SELECT EXISTS (SELECT 1 FROM user_cases WHERE user_id = $1 AND case_number = $2)",
    )
    .bind(user_id)
    .bind(case_number)
    .fetch_one(pool)
    .await
}

/// Delete by the tracked-case's ID (used by the tracking context for ID-based entries).
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

/// Delete by the user_cases row ID (safe for both ID-based and case_number-based entries).
pub async fn remove_user_case_by_row(
    pool: &PgPool,
    user_id: i32,
    row_id: i32,
) -> sqlx::Result<u64> {
    let result = sqlx::query(
        "DELETE FROM user_cases WHERE id = $1 AND user_id = $2",
    )
    .bind(row_id)
    .bind(user_id)
    .execute(pool)
    .await?;
    Ok(result.rows_affected())
}

// ── User Case Settings ──────────────────────────────────────────────────────

pub async fn upsert_user_case_settings(
    pool: &PgPool,
    user_case_id: i32,
    notify_immediately: bool,
    notify_day_before: bool,
    notify_morning_of: bool,
) -> sqlx::Result<UserCaseSettings> {
    sqlx::query_as::<_, UserCaseSettings>(
        "INSERT INTO user_case_settings
           (user_case_id, notify_immediately, notify_day_before, notify_morning_of, updated_at)
         VALUES ($1, $2, $3, $4, NOW())
         ON CONFLICT (user_case_id) DO UPDATE SET
           notify_immediately = EXCLUDED.notify_immediately,
           notify_day_before  = EXCLUDED.notify_day_before,
           notify_morning_of  = EXCLUDED.notify_morning_of,
           updated_at         = NOW()
         RETURNING id, user_case_id, notify_immediately, notify_day_before, notify_morning_of",
    )
    .bind(user_case_id)
    .bind(notify_immediately)
    .bind(notify_day_before)
    .bind(notify_morning_of)
    .fetch_one(pool)
    .await
}

// ── Notifications ──────────────────────────────────────────────────────────

pub async fn get_notifications(pool: &PgPool, user_id: i32) -> sqlx::Result<Vec<Notification>> {
    sqlx::query_as::<_, Notification>(
        r#"SELECT n.id, n.user_id, n.case_id, n."type", n.sent_at, n.read_at,
                  n.archived_at, n.title, n.message, n.link, n.severity,
                  COALESCE(cs.case_number, j.case_number) AS case_number
           FROM notifications n
           LEFT JOIN court_sittings cs
                  ON cs.id = n.case_id
                 AND n.type IN ('sitting_changed','case_listed','sitting_reminder_1d','sitting_reminder_morning')
           LEFT JOIN judgments j
                  ON j.id = n.case_id
                 AND n.type IN ('new_judgment','case_available')
           WHERE n.user_id = $1
             AND n.archived_at IS NULL
           ORDER BY n.sent_at DESC
           LIMIT 100"#,
    )
    .bind(user_id)
    .fetch_all(pool)
    .await
}

pub async fn archive_notification(
    pool: &PgPool,
    notification_id: i32,
    user_id: i32,
) -> sqlx::Result<bool> {
    let result = sqlx::query(
        "UPDATE notifications SET archived_at = NOW()
         WHERE id = $1 AND user_id = $2 AND archived_at IS NULL",
    )
    .bind(notification_id)
    .bind(user_id)
    .execute(pool)
    .await?;
    Ok(result.rows_affected() > 0)
}

pub async fn create_welcome_notification(pool: &PgPool, user_id: i32) -> sqlx::Result<()> {
    sqlx::query(
        r#"INSERT INTO notifications (user_id, case_id, type, title, message, severity)
           SELECT $1, NULL, 'welcome',
                  'Welcome to CourtWatch JA!',
                  'You now have access to Jamaica''s most comprehensive court tracker. Let us show you around.',
                  'info'
           WHERE NOT EXISTS (
               SELECT 1 FROM notifications WHERE user_id = $1 AND type = 'welcome'
           )"#,
    )
    .bind(user_id)
    .execute(pool)
    .await?;
    Ok(())
}

pub async fn get_unread_notification_count(pool: &PgPool, user_id: i32) -> sqlx::Result<i64> {
    sqlx::query_scalar(
        "SELECT COUNT(*) FROM notifications WHERE user_id = $1 AND read_at IS NULL AND archived_at IS NULL",
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
    query: Option<&str>,
    date_from: Option<NaiveDate>,
    date_to: Option<NaiveDate>,
    court: Option<&str>,
    judge: Option<&str>,
    case_number: Option<&str>,
    page: i64,
    limit: i64,
) -> sqlx::Result<(Vec<CourtSitting>, i64)> {
    use sqlx::QueryBuilder;

    let offset = (page - 1).max(0) * limit;
    let has_fts = query.map_or(false, |q| !q.trim().is_empty());

    // ── COUNT ──────────────────────────────────────────────────────────────
    let mut cq: QueryBuilder<sqlx::Postgres> =
        QueryBuilder::new("SELECT COUNT(*) FROM court_sittings WHERE 1=1");
    if has_fts {
        cq.push(" AND search_vector @@ websearch_to_tsquery('english', ");
        cq.push_bind(query.unwrap().trim());
        cq.push(")");
    }
    if let Some(c) = court {
        cq.push(format!(" AND {}", sitting_court_filter(c)));
    }
    if let Some(j) = judge {
        cq.push(" AND judge_name IS NOT NULL AND ");
        cq.push_bind(j);
        cq.push(" = ANY(ARRAY(SELECT TRIM(p) FROM unnest(string_to_array(judge_name, ',')) p))");
    }
    if let Some(df) = date_from {
        cq.push(" AND event_date >= ");
        cq.push_bind(df);
    }
    if let Some(dt) = date_to {
        cq.push(" AND event_date <= ");
        cq.push_bind(dt);
    }
    if let Some(cn) = case_number.filter(|s| !s.is_empty()) {
        cq.push(" AND case_number ILIKE ");
        cq.push_bind(format!("%{cn}%"));
    }
    let total: i64 = cq.build_query_scalar().fetch_one(pool).await?;

    // ── DATA ───────────────────────────────────────────────────────────────
    let mut dq: QueryBuilder<sqlx::Postgres> = if has_fts {
        let q = query.unwrap().trim();
        let mut qb = QueryBuilder::new(format!(
            "SELECT {S}, ts_headline('english', \
             COALESCE(title,'') || ' ' || COALESCE(case_number,'') || ' ' || COALESCE(judge_name,''), \
             websearch_to_tsquery('english', "
        ));
        qb.push_bind(q);
        qb.push("), 'StartSel=[[, StopSel=]], MaxWords=15, MinWords=5') AS snippet \
              FROM court_sittings WHERE 1=1");
        qb
    } else {
        QueryBuilder::new(format!("SELECT {S} FROM court_sittings WHERE 1=1"))
    };

    if has_fts {
        dq.push(" AND search_vector @@ websearch_to_tsquery('english', ");
        dq.push_bind(query.unwrap().trim());
        dq.push(")");
    }
    if let Some(c) = court {
        dq.push(format!(" AND {}", sitting_court_filter(c)));
    }
    if let Some(j) = judge {
        dq.push(" AND judge_name IS NOT NULL AND ");
        dq.push_bind(j);
        dq.push(" = ANY(ARRAY(SELECT TRIM(p) FROM unnest(string_to_array(judge_name, ',')) p))");
    }
    if let Some(df) = date_from {
        dq.push(" AND event_date >= ");
        dq.push_bind(df);
    }
    if let Some(dt) = date_to {
        dq.push(" AND event_date <= ");
        dq.push_bind(dt);
    }
    if let Some(cn) = case_number.filter(|s| !s.is_empty()) {
        dq.push(" AND case_number ILIKE ");
        dq.push_bind(format!("%{cn}%"));
    }

    if has_fts {
        dq.push(" ORDER BY ts_rank(search_vector, websearch_to_tsquery('english', ");
        dq.push_bind(query.unwrap().trim());
        dq.push(")) DESC, event_date ASC NULLS LAST");
    } else if court.is_none() {
        dq.push(
            " ORDER BY CASE \
               WHEN court_division ILIKE '%Appeal%'  THEN 2 \
               WHEN court_division ILIKE '%Parish%'  THEN 3 \
               ELSE 1 \
             END, event_date ASC, event_time NULLS LAST",
        );
    } else {
        dq.push(" ORDER BY event_date ASC, event_time NULLS LAST");
    }
    dq.push(" LIMIT ");
    dq.push_bind(limit);
    dq.push(" OFFSET ");
    dq.push_bind(offset);

    let rows = dq.build_query_as::<CourtSitting>().fetch_all(pool).await?;
    Ok((rows, total))
}


pub async fn get_today_sittings(pool: &PgPool) -> sqlx::Result<Vec<CourtSitting>> {
    let sql = format!(
        "SELECT {S} FROM court_sittings
         WHERE event_date = CURRENT_DATE ORDER BY event_time NULLS LAST"
    );
    sqlx::query_as::<_, CourtSitting>(&sql).fetch_all(pool).await
}

/// Insert a sitting, skipping silently if the natural-key unique index fires.
/// Returns `Some(row)` on a real insert, `None` if already present.
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
) -> sqlx::Result<Option<CourtSitting>> {
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
        .fetch_optional(pool)
        .await
}

/// Returns `true` if a sitting with the same natural key already exists.
/// Uses `IS NOT DISTINCT FROM` so NULL event_type / event_time match correctly.
pub async fn sitting_exists(
    pool: &PgPool,
    case_number: &str,
    event_date: NaiveDate,
    event_type: Option<&str>,
) -> sqlx::Result<bool> {
    sqlx::query_scalar(
        "SELECT EXISTS (
             SELECT 1 FROM court_sittings
             WHERE case_number = $1
               AND event_date  = $2
               AND event_type  IS NOT DISTINCT FROM $3
         )",
    )
    .bind(case_number)
    .bind(event_date)
    .bind(event_type)
    .fetch_one(pool)
    .await
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

    // ── Sitting reminders — 1 day before ─────────────────────────────────
    #[derive(sqlx::FromRow)]
    struct ReminderPair {
        user_id: i32,
        case_id: i32,
    }

    let day_before: Vec<ReminderPair> = match sqlx::query_as(
        "SELECT uc.user_id, uc.case_id
         FROM user_cases uc
         JOIN court_sittings cs ON cs.id = uc.case_id
         WHERE uc.case_type = 'sitting'
           AND uc.case_id IS NOT NULL
           AND cs.event_date = CURRENT_DATE + 1
           AND NOT EXISTS (
               SELECT 1 FROM notifications n
               WHERE n.user_id = uc.user_id
                 AND n.case_id = uc.case_id
                 AND n.type = 'sitting_reminder_1d'
                 AND n.sent_at::date = CURRENT_DATE
           )",
    )
    .fetch_all(pool)
    .await
    {
        Ok(rows) => rows,
        Err(e) => {
            tracing::warn!("[Notifications] sitting_reminder_1d query failed: {e}");
            return;
        }
    };

    for row in &day_before {
        if let Err(e) = sqlx::query(
            "INSERT INTO notifications (user_id, case_id, type) VALUES ($1, $2, 'sitting_reminder_1d')",
        )
        .bind(row.user_id)
        .bind(row.case_id)
        .execute(pool)
        .await
        {
            tracing::warn!(
                "[Notifications] failed to insert sitting_reminder_1d for user {}: {e}",
                row.user_id
            );
        }
    }
    if !day_before.is_empty() {
        tracing::info!(
            "[Notifications] {} sitting_reminder_1d notification(s) inserted",
            day_before.len()
        );
    }

    // ── Sitting reminders — morning of ───────────────────────────────────
    let morning_of: Vec<ReminderPair> = match sqlx::query_as(
        "SELECT uc.user_id, uc.case_id
         FROM user_cases uc
         JOIN court_sittings cs ON cs.id = uc.case_id
         WHERE uc.case_type = 'sitting'
           AND uc.case_id IS NOT NULL
           AND cs.event_date = CURRENT_DATE
           AND NOT EXISTS (
               SELECT 1 FROM notifications n
               WHERE n.user_id = uc.user_id
                 AND n.case_id = uc.case_id
                 AND n.type = 'sitting_reminder_morning'
                 AND n.sent_at::date = CURRENT_DATE
           )",
    )
    .fetch_all(pool)
    .await
    {
        Ok(rows) => rows,
        Err(e) => {
            tracing::warn!("[Notifications] sitting_reminder_morning query failed: {e}");
            return;
        }
    };

    for row in &morning_of {
        if let Err(e) = sqlx::query(
            "INSERT INTO notifications (user_id, case_id, type) VALUES ($1, $2, 'sitting_reminder_morning')",
        )
        .bind(row.user_id)
        .bind(row.case_id)
        .execute(pool)
        .await
        {
            tracing::warn!(
                "[Notifications] failed to insert sitting_reminder_morning for user {}: {e}",
                row.user_id
            );
        }
    }
    if !morning_of.is_empty() {
        tracing::info!(
            "[Notifications] {} sitting_reminder_morning notification(s) inserted",
            morning_of.len()
        );
    }

    // ── Case listed — case_number-only tracked entries now have a sitting ─
    #[derive(sqlx::FromRow)]
    struct CaseListed {
        user_id: i32,
        uc_id: i32,
        sitting_id: i32,
    }

    let listed: Vec<CaseListed> = match sqlx::query_as(
        "SELECT uc.user_id, uc.id AS uc_id, cs.id AS sitting_id
         FROM user_cases uc
         JOIN court_sittings cs ON cs.case_number = uc.case_number
         WHERE uc.case_id IS NULL
           AND uc.case_number IS NOT NULL
           AND NOT EXISTS (
               SELECT 1 FROM notifications n
               WHERE n.user_id = uc.user_id
                 AND n.case_id = cs.id
                 AND n.type = 'case_listed'
           )",
    )
    .fetch_all(pool)
    .await
    {
        Ok(rows) => rows,
        Err(e) => {
            tracing::warn!("[Notifications] case_listed query failed: {e}");
            return;
        }
    };

    for row in &listed {
        if let Err(e) = sqlx::query(
            "INSERT INTO notifications (user_id, case_id, type) VALUES ($1, $2, 'case_listed')",
        )
        .bind(row.user_id)
        .bind(row.sitting_id)
        .execute(pool)
        .await
        {
            tracing::warn!(
                "[Notifications] failed to insert case_listed for user {}: {e}",
                row.user_id
            );
            continue;
        }
        // Upgrade the case_number-only entry to a real case_id so it stops matching.
        let _ = sqlx::query(
            "UPDATE user_cases SET case_id = $1 WHERE id = $2",
        )
        .bind(row.sitting_id)
        .bind(row.uc_id)
        .execute(pool)
        .await;
    }
    if !listed.is_empty() {
        tracing::info!(
            "[Notifications] {} case_listed notification(s) inserted",
            listed.len()
        );
    }

    // ── Case available — pending entries matched to a judgment ────────────
    #[derive(sqlx::FromRow)]
    struct CaseAvailable {
        user_id: i32,
        uc_id: i32,
        judgment_id: i32,
        email: String,
        j_title: Option<String>,
        case_number: Option<String>,
    }

    let available: Vec<CaseAvailable> = match sqlx::query_as(
        "SELECT uc.user_id,
                uc.id          AS uc_id,
                j.id           AS judgment_id,
                u.email,
                j.title        AS j_title,
                uc.case_number
         FROM user_cases uc
         JOIN judgments j ON j.case_number = uc.case_number
         JOIN users u ON u.id = uc.user_id
         WHERE uc.case_id IS NULL
           AND uc.case_number IS NOT NULL
           AND NOT EXISTS (
               SELECT 1 FROM notifications n
               WHERE n.user_id = uc.user_id
                 AND n.case_id = j.id
                 AND n.type = 'case_available'
           )",
    )
    .fetch_all(pool)
    .await
    {
        Ok(rows) => rows,
        Err(e) => {
            tracing::warn!("[Notifications] case_available query failed: {e}");
            return;
        }
    };

    for row in &available {
        let notif_title = row
            .j_title
            .as_deref()
            .unwrap_or("Case Available");
        if let Err(e) = sqlx::query(
            "INSERT INTO notifications (user_id, case_id, type, title, message)
             VALUES ($1, $2, 'case_available', $3, 'Your tracked case has been published as a judgment.')",
        )
        .bind(row.user_id)
        .bind(row.judgment_id)
        .bind(notif_title)
        .execute(pool)
        .await
        {
            tracing::warn!(
                "[Notifications] failed to insert case_available for user {}: {e}",
                row.user_id
            );
            continue;
        }
        let _ = sqlx::query(
            "UPDATE user_cases SET case_id = $1, case_type = 'judgment' WHERE id = $2",
        )
        .bind(row.judgment_id)
        .bind(row.uc_id)
        .execute(pool)
        .await;

        tracing::info!(
            "[Email stub] case_available → user_id={} email={} case_number={} judgment_id={}",
            row.user_id,
            row.email,
            row.case_number.as_deref().unwrap_or(""),
            row.judgment_id
        );
    }
    if !available.is_empty() {
        tracing::info!(
            "[Notifications] {} case_available notification(s) inserted",
            available.len()
        );
    }
}

// ── OAuth user ────────────────────────────────────────────────────────────

/// Find an existing user by email or create a new one for an OAuth sign-in.
/// OAuth users are assigned an unguessable password hash so they can never
/// log in via the password flow.
/// Returns `(user, is_new)`. `is_new` is `true` only when the account was
/// created by this call — callers use it to gate one-time actions like a
/// welcome email.
pub async fn find_or_create_oauth_user(
    pool: &PgPool,
    email: &str,
    display_name: Option<&str>,
) -> sqlx::Result<(User, bool)> {
    // Fast path: existing user
    if let Some(u) = find_user_by_email(pool, email).await? {
        return Ok((u, false));
    }

    // Create; ON CONFLICT DO NOTHING guards against a race.
    let maybe = sqlx::query_as::<_, User>(
        "INSERT INTO users (email, password_hash, display_name, email_verified)
         VALUES ($1, '$oauth$no_password', $2, TRUE)
         ON CONFLICT (email) DO NOTHING
         RETURNING id, email, password_hash, role, display_name, created_at, email_verified",
    )
    .bind(email)
    .bind(display_name)
    .fetch_optional(pool)
    .await?;

    if let Some(u) = maybe {
        return Ok((u, true));
    }

    // ON CONFLICT fired — another request beat us; just fetch.
    let u = find_user_by_email(pool, email)
        .await?
        .ok_or(sqlx::Error::RowNotFound)?;
    Ok((u, false))
}

// ── Email verification ─────────────────────────────────────────────────────

pub async fn create_verification_token(
    pool: &PgPool,
    user_id: i32,
    token: &str,
    expires_at: chrono::NaiveDateTime,
) -> sqlx::Result<()> {
    sqlx::query(
        "INSERT INTO verification_tokens (token, user_id, expires_at) VALUES ($1, $2, $3)",
    )
    .bind(token)
    .bind(user_id)
    .bind(expires_at)
    .execute(pool)
    .await?;
    Ok(())
}

pub async fn delete_verification_tokens_for_user(pool: &PgPool, user_id: i32) -> sqlx::Result<()> {
    sqlx::query(
        "DELETE FROM verification_tokens WHERE user_id = $1 AND token_type = 'email_verification'",
    )
    .bind(user_id)
    .execute(pool)
    .await?;
    Ok(())
}

/// Atomically deletes the token if valid and not expired, returning its user_id.
pub async fn consume_verification_token(
    pool: &PgPool,
    token: &str,
) -> sqlx::Result<Option<i32>> {
    sqlx::query_scalar(
        "DELETE FROM verification_tokens
         WHERE token = $1 AND token_type = 'email_verification' AND expires_at > NOW()
         RETURNING user_id",
    )
    .bind(token)
    .fetch_optional(pool)
    .await
}

/// Creates a password-change token, replacing any existing one for this user.
pub async fn create_password_change_token(
    pool: &PgPool,
    user_id: i32,
    token: &str,
    pending_hash: &str,
    expires_at: chrono::NaiveDateTime,
) -> sqlx::Result<()> {
    sqlx::query(
        "DELETE FROM verification_tokens WHERE user_id = $1 AND token_type = 'password_change'",
    )
    .bind(user_id)
    .execute(pool)
    .await?;

    sqlx::query(
        "INSERT INTO verification_tokens (token, user_id, expires_at, token_type, pending_password_hash)
         VALUES ($1, $2, $3, 'password_change', $4)",
    )
    .bind(token)
    .bind(user_id)
    .bind(expires_at)
    .bind(pending_hash)
    .execute(pool)
    .await?;
    Ok(())
}

/// Atomically consumes a password-change token, returning (user_id, pending_hash).
pub async fn consume_password_change_token(
    pool: &PgPool,
    token: &str,
) -> sqlx::Result<Option<(i32, String)>> {
    let row: Option<(i32, Option<String>)> = sqlx::query_as(
        "DELETE FROM verification_tokens
         WHERE token = $1 AND token_type = 'password_change' AND expires_at > NOW()
         RETURNING user_id, pending_password_hash",
    )
    .bind(token)
    .fetch_optional(pool)
    .await?;
    Ok(row.and_then(|(uid, hash)| hash.map(|h| (uid, h))))
}

pub async fn update_user_password(
    pool: &PgPool,
    user_id: i32,
    password_hash: &str,
) -> sqlx::Result<()> {
    sqlx::query("UPDATE users SET password_hash = $1 WHERE id = $2")
        .bind(password_hash)
        .bind(user_id)
        .execute(pool)
        .await?;
    Ok(())
}

pub async fn mark_email_verified(pool: &PgPool, user_id: i32) -> sqlx::Result<()> {
    sqlx::query("UPDATE users SET email_verified = TRUE WHERE id = $1")
        .bind(user_id)
        .execute(pool)
        .await?;
    Ok(())
}

// ── Docket ─────────────────────────────────────────────────────────────────

/// Returns all cases a user is tracking, enriched with next-sitting metadata
/// and unread notification count.  No new tables — purely derived from
/// user_cases + court_sittings + judgments + notifications.
pub async fn get_docket_list(pool: &PgPool, user_id: i32) -> sqlx::Result<Vec<DocketListItem>> {
    sqlx::query_as::<_, DocketListItem>(
        r#"SELECT
               uc.id                                                          AS user_case_id,
               COALESCE(uc.case_number, j.case_number, cs_src.case_number)   AS case_number,
               uc.created_at                                                  AS tracked_at,
               ns.event_date                                                  AS next_event_date,
               ns.event_type                                                  AS next_event_type,
               ns.court_division                                              AS next_court_division,
               COALESCE(unread.cnt, 0)::BIGINT                                AS unread_count
           FROM user_cases uc
           LEFT JOIN judgments j
                  ON j.id = uc.case_id
                 AND uc.case_type = 'judgment'
                 AND uc.case_number IS NULL
           LEFT JOIN court_sittings cs_src
                  ON cs_src.id = uc.case_id
                 AND uc.case_type = 'sitting'
                 AND uc.case_number IS NULL
           LEFT JOIN LATERAL (
               SELECT event_date, event_type, court_division
               FROM court_sittings
               WHERE case_number = COALESCE(uc.case_number, j.case_number, cs_src.case_number)
                 AND event_date >= CURRENT_DATE
               ORDER BY event_date ASC
               LIMIT 1
           ) ns ON TRUE
           LEFT JOIN LATERAL (
               SELECT COUNT(*)::BIGINT AS cnt
               FROM notifications n
               LEFT JOIN court_sittings cs2
                      ON cs2.id = n.case_id
                     AND n.type IN ('sitting_changed','case_listed','sitting_reminder_1d','sitting_reminder_morning')
               LEFT JOIN judgments j2
                      ON j2.id = n.case_id
                     AND n.type IN ('new_judgment','case_available')
               WHERE n.user_id = $1
                 AND n.read_at IS NULL
                 AND n.archived_at IS NULL
                 AND COALESCE(cs2.case_number, j2.case_number)
                       = COALESCE(uc.case_number, j.case_number, cs_src.case_number)
           ) unread ON TRUE
           WHERE uc.user_id = $1
             AND COALESCE(uc.case_number, j.case_number, cs_src.case_number) IS NOT NULL
           ORDER BY uc.created_at DESC"#,
    )
    .bind(user_id)
    .fetch_all(pool)
    .await
}

/// Returns the `user_cases.id` for a given user + resolved case_number, or
/// `None` if the user is not tracking that case.  Used as a permission gate.
pub async fn get_user_case_id_for_case(
    pool: &PgPool,
    user_id: i32,
    case_number: &str,
) -> sqlx::Result<Option<i32>> {
    sqlx::query_scalar(
        r#"SELECT uc.id
           FROM user_cases uc
           LEFT JOIN judgments j
                  ON j.id = uc.case_id
                 AND uc.case_type = 'judgment'
                 AND uc.case_number IS NULL
           LEFT JOIN court_sittings cs
                  ON cs.id = uc.case_id
                 AND uc.case_type = 'sitting'
                 AND uc.case_number IS NULL
           WHERE uc.user_id = $1
             AND COALESCE(uc.case_number, j.case_number, cs.case_number) = $2
           LIMIT 1"#,
    )
    .bind(user_id)
    .bind(case_number)
    .fetch_optional(pool)
    .await
}

/// Returns all court sittings for a given case_number, chronologically.
pub async fn get_sittings_for_case(
    pool: &PgPool,
    case_number: &str,
) -> sqlx::Result<Vec<CourtSitting>> {
    let sql = format!(
        "SELECT {S} FROM court_sittings WHERE case_number = $1 \
         ORDER BY event_date ASC NULLS LAST, event_time ASC NULLS LAST"
    );
    sqlx::query_as::<_, CourtSitting>(&sql)
        .bind(case_number)
        .fetch_all(pool)
        .await
}

// ── Email notification dispatch ────────────────────────────────────────────

#[derive(sqlx::FromRow)]
pub struct PendingEmailRow {
    pub email: String,
    pub notification_type: String,
    pub title: Option<String>,
    pub message: Option<String>,
    /// Resolved from court_sittings or judgments depending on notification type.
    pub case_number: Option<String>,
    pub event_date: Option<chrono::NaiveDate>,
    pub event_type: Option<String>,
    pub court_division: Option<String>,
}

/// Returns notifications inserted in the last 15 minutes that should trigger
/// an outbound email.  Called once per scraper run immediately after
/// `check_notifications` populates the table.
pub async fn recent_notifications_for_email(
    pool: &PgPool,
) -> sqlx::Result<Vec<PendingEmailRow>> {
    sqlx::query_as::<_, PendingEmailRow>(
        r#"SELECT u.email,
                  n.type        AS notification_type,
                  n.title,
                  n.message,
                  COALESCE(cs.case_number, j.case_number) AS case_number,
                  cs.event_date,
                  cs.event_type,
                  cs.court_division
           FROM   notifications n
           JOIN   users u ON u.id = n.user_id
           LEFT JOIN court_sittings cs
                  ON cs.id = n.case_id
                 AND n.type IN ('case_listed', 'sitting_reminder_1d', 'sitting_reminder_morning')
           LEFT JOIN judgments j
                  ON j.id = n.case_id
                 AND n.type IN ('case_available')
           WHERE  n.sent_at > NOW() - INTERVAL '15 minutes'
             AND  n.type IN (
                    'case_available',
                    'case_listed',
                    'sitting_reminder_1d',
                    'sitting_reminder_morning'
                  )"#,
    )
    .fetch_all(pool)
    .await
}

// ── Legal News ─────────────────────────────────────────────────────────────

pub async fn upsert_legal_news(
    pool: &PgPool,
    title: &str,
    description: Option<&str>,
    source: &str,
    url: &str,
    published_at: Option<chrono::NaiveDateTime>,
    category: &str,
) -> sqlx::Result<()> {
    sqlx::query(
        "INSERT INTO legal_news (title, description, source, url, published_at, category)
         VALUES ($1, $2, $3, $4, $5, $6)
         ON CONFLICT (url) DO NOTHING",
    )
    .bind(title)
    .bind(description)
    .bind(source)
    .bind(url)
    .bind(published_at)
    .bind(category)
    .execute(pool)
    .await?;
    Ok(())
}

pub async fn list_legal_news(
    pool: &PgPool,
    category: Option<&str>,
    limit: i64,
) -> sqlx::Result<Vec<LegalNews>> {
    if let Some(cat) = category {
        sqlx::query_as::<_, LegalNews>(
            "SELECT id, title, description, source, url, published_at, category, created_at
             FROM legal_news
             WHERE category = $1
             ORDER BY COALESCE(published_at, created_at) DESC
             LIMIT $2",
        )
        .bind(cat)
        .bind(limit)
        .fetch_all(pool)
        .await
    } else {
        sqlx::query_as::<_, LegalNews>(
            "SELECT id, title, description, source, url, published_at, category, created_at
             FROM legal_news
             ORDER BY COALESCE(published_at, created_at) DESC
             LIMIT $1",
        )
        .bind(limit)
        .fetch_all(pool)
        .await
    }
}

// ── Parish Court Cases ─────────────────────────────────────────────────────

const PC: &str = "id, parish, accused_name, offence, status, week_of, pdf_source_url, created_at, COALESCE(case_type, 'criminal') AS case_type";

/// Return the raw SQL ILIKE fragment for a given category, or `""` if unknown.
/// The strings are all hardcoded constants — no user input reaches the SQL.
fn parish_category_clause(category: &str) -> &'static str {
    match category.to_lowercase().trim() {
        "violent" => "offence ILIKE ANY(ARRAY[\
            '%murder%','%manslaughter%','%assault%','%wounding%',\
            '%robbery%','%rape%','%sexual%','%grievous%',\
            '%gun%','%firearm%','%ammunition%','%shooting%',\
            '%stabbing%','%arson%','%abduction%','%threat%'])",
        "drugs" => "offence ILIKE ANY(ARRAY[\
            '%ganja%','%cannabis%','%cocaine%','%crack%',\
            '%dangerous drug%','%controlled substance%',\
            '%drug trafficking%','%traffick%','%cultivation%'])",
        "property" => "offence ILIKE ANY(ARRAY[\
            '%larceny%','%praedial%','%theft%','%stealing%',\
            '%receiving stolen%','%burglary%','%housebreaking%',\
            '%fraud%','%forgery%','%obtaining%','%false pretence%',\
            '%malicious%','%damage%','%embezzlement%','%counterfeit%',\
            '%identity%','%access device%'])",
        "other" => "NOT offence ILIKE ANY(ARRAY[\
            '%murder%','%manslaughter%','%assault%','%wounding%',\
            '%robbery%','%rape%','%sexual%','%grievous%',\
            '%gun%','%firearm%','%shooting%','%stabbing%','%arson%',\
            '%ganja%','%cannabis%','%cocaine%','%drug%','%traffick%',\
            '%larceny%','%theft%','%burglary%','%housebreaking%',\
            '%fraud%','%forgery%','%obtaining%','%malicious%'])",
        _ => "",
    }
}

pub async fn list_parish_cases(
    pool: &PgPool,
    parish: Option<&str>,
    q: Option<&str>,
    category: Option<&str>,
    page: i64,
    limit: i64,
) -> sqlx::Result<(Vec<ParishCourtCase>, i64)> {
    use sqlx::QueryBuilder;

    let offset = (page - 1).max(0) * limit;
    let search_pattern = q.map(|s| format!("%{}%", s.to_lowercase()));
    let cat_clause = category.map(parish_category_clause).unwrap_or("");

    // Build shared WHERE fragment via a helper closure that applies conditions
    // to whichever QueryBuilder is passed in.
    macro_rules! apply_filters {
        ($qb:expr) => {{
            if let Some(p) = parish {
                $qb.push(" AND parish = ");
                $qb.push_bind(p);
            }
            if let Some(ref pat) = search_pattern {
                $qb.push(" AND (LOWER(accused_name) LIKE ");
                $qb.push_bind(pat.clone());
                $qb.push(" OR LOWER(offence) LIKE ");
                $qb.push_bind(pat.clone());
                if parish.is_none() {
                    $qb.push(" OR LOWER(parish) LIKE ");
                    $qb.push_bind(pat.clone());
                }
                $qb.push(")");
            }
            if !cat_clause.is_empty() {
                $qb.push(format!(" AND {cat_clause}"));
            }
        }};
    }

    // ── Count ─────────────────────────────────────────────────────────────────
    let mut cq: QueryBuilder<sqlx::Postgres> =
        QueryBuilder::new("SELECT COUNT(*) FROM parish_court_cases WHERE 1=1");
    apply_filters!(cq);
    let total: i64 = cq.build_query_scalar().fetch_one(pool).await?;

    // ── Data ──────────────────────────────────────────────────────────────────
    let mut dq: QueryBuilder<sqlx::Postgres> =
        QueryBuilder::new(format!("SELECT {PC} FROM parish_court_cases WHERE 1=1"));
    apply_filters!(dq);
    dq.push(" ORDER BY week_of DESC NULLS LAST, id DESC LIMIT ");
    dq.push_bind(limit);
    dq.push(" OFFSET ");
    dq.push_bind(offset);

    let rows = dq.build_query_as::<ParishCourtCase>().fetch_all(pool).await?;
    Ok((rows, total))
}

/// Count court_sittings rows for `court` (using the same filter as list_court_sittings)
/// where event_date >= today.  Used to detect when no upcoming sittings exist for a court.
pub async fn count_upcoming_sittings_for_court(pool: &PgPool, court: &str) -> sqlx::Result<i64> {
    let filter = sitting_court_filter(court);
    let sql = format!(
        "SELECT COUNT(*) FROM court_sittings WHERE event_date >= CURRENT_DATE AND {filter}"
    );
    sqlx::query_scalar(&sql).fetch_one(pool).await
}

/// Returns parish_court_cases where week_of >= `week_from`, optionally filtered by parish.
pub async fn list_parish_cases_from_week(
    pool: &PgPool,
    week_from: NaiveDate,
    parish: Option<&str>,
    limit: i64,
) -> sqlx::Result<(Vec<ParishCourtCase>, i64)> {
    use sqlx::QueryBuilder;

    let mut cq: QueryBuilder<sqlx::Postgres> =
        QueryBuilder::new("SELECT COUNT(*) FROM parish_court_cases WHERE week_of >= ");
    cq.push_bind(week_from);
    if let Some(p) = parish {
        cq.push(" AND parish = ");
        cq.push_bind(p);
    }
    let total: i64 = cq.build_query_scalar().fetch_one(pool).await?;

    let mut dq: QueryBuilder<sqlx::Postgres> = QueryBuilder::new(format!(
        "SELECT {PC} FROM parish_court_cases WHERE week_of >= "
    ));
    dq.push_bind(week_from);
    if let Some(p) = parish {
        dq.push(" AND parish = ");
        dq.push_bind(p);
    }
    dq.push(" ORDER BY week_of ASC, parish, id LIMIT ");
    dq.push_bind(limit);

    let rows = dq.build_query_as::<ParishCourtCase>().fetch_all(pool).await?;
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
    case_type: &str,
) -> sqlx::Result<()> {
    sqlx::query(
        "INSERT INTO parish_court_cases
             (parish, accused_name, offence, status, week_of, pdf_source_url, case_type)
         VALUES ($1, $2, $3, $4, $5, $6, $7)
         ON CONFLICT (
             parish,
             COALESCE(accused_name,   ''),
             COALESCE(offence,        ''),
             COALESCE(week_of,        '1970-01-01'::date),
             COALESCE(pdf_source_url, '')
         ) DO NOTHING",
    )
    .bind(parish)
    .bind(accused_name)
    .bind(offence)
    .bind(status)
    .bind(week_of)
    .bind(pdf_source_url)
    .bind(case_type)
    .execute(pool)
    .await?;
    Ok(())
}

// ── Case lookup ────────────────────────────────────────────────────────────────

pub async fn case_lookup(
    pool: &PgPool,
    case_number: &str,
) -> sqlx::Result<(Vec<CaseLookupJudgmentRow>, Vec<CaseLookupSittingRow>)> {
    let pattern = format!("%{}%", case_number.to_uppercase());

    let judgments = sqlx::query_as::<_, CaseLookupJudgmentRow>(
        "SELECT id, case_number, title, date, court
         FROM judgments
         WHERE UPPER(case_number) LIKE $1
         ORDER BY date DESC NULLS LAST
         LIMIT 5",
    )
    .bind(&pattern)
    .fetch_all(pool)
    .await?;

    let sittings = sqlx::query_as::<_, CaseLookupSittingRow>(
        "SELECT id, case_number, title, event_date, court_division
         FROM court_sittings
         WHERE UPPER(case_number) LIKE $1
         ORDER BY event_date DESC NULLS LAST
         LIMIT 5",
    )
    .bind(&pattern)
    .fetch_all(pool)
    .await?;

    Ok((judgments, sittings))
}

// ── Public preview (no auth) ───────────────────────────────────────────────

pub async fn get_preview_judgments(pool: &PgPool) -> sqlx::Result<Vec<Judgment>> {
    sqlx::query_as::<_, Judgment>(
        "SELECT id, case_number, title, judge_name, court, date, pdf_url, local_pdf_path, \
         summary_text, created_at, updated_at, source_url, tags \
         FROM judgments WHERE title IS NOT NULL \
         ORDER BY date DESC NULLS LAST, id DESC LIMIT 3",
    )
    .fetch_all(pool)
    .await
}

pub async fn get_preview_sittings(pool: &PgPool) -> sqlx::Result<Vec<CourtSitting>> {
    // Prefer upcoming court sittings; fill any remaining slots from parish court cases.
    let cs: Vec<CourtSitting> = sqlx::query_as(
        &format!(
            "SELECT {S} FROM court_sittings \
             WHERE event_date >= CURRENT_DATE ORDER BY event_date ASC, id ASC LIMIT 3"
        ),
    )
    .fetch_all(pool)
    .await?;

    if cs.len() >= 3 {
        return Ok(cs);
    }

    let remaining = (3 - cs.len() as i64).max(0);
    let parish_rows = sqlx::query(
        "SELECT id, parish, status, week_of, pdf_source_url, accused_name, created_at \
         FROM parish_court_cases \
         WHERE week_of >= date_trunc('week', CURRENT_DATE) \
         ORDER BY week_of ASC, id ASC LIMIT $1",
    )
    .bind(remaining)
    .fetch_all(pool)
    .await?;

    let mut result = cs;
    for row in parish_rows {
        use sqlx::Row;
        let created_at: Option<NaiveDateTime> = row.try_get("created_at").ok();
        result.push(CourtSitting {
            id:             row.get("id"),
            case_number:    None,
            title:          Some(format!("{} Parish Court", row.get::<String, _>("parish"))),
            judge_name:     None,
            court_division: Some("Parish Court".to_string()),
            event_type:     row.get("status"),
            event_date:     row.get("week_of"),
            event_time:     None,
            lawyers:        row.get("accused_name"),
            pdf_source_url: row.get("pdf_source_url"),
            created_at:     created_at.unwrap_or_else(|| chrono::Utc::now().naive_utc()),
            snippet:        None,
        });
    }
    Ok(result)
}

// ── Promos ────────────────────────────────────────────────────────────────────

fn parse_dt(s: &str) -> Option<NaiveDateTime> {
    NaiveDateTime::parse_from_str(s, "%Y-%m-%dT%H:%M:%S")
        .or_else(|_| NaiveDateTime::parse_from_str(s, "%Y-%m-%dT%H:%M"))
        .ok()
}

pub async fn get_active_promo(pool: &PgPool, user_id: Option<i32>) -> sqlx::Result<Option<Promo>> {
    sqlx::query_as::<_, Promo>(
        r#"SELECT id, title, message, url, url_text, display_frequency, starts_at, ends_at, enabled, created_at
           FROM promos
           WHERE enabled = true
             AND (starts_at IS NULL OR starts_at <= NOW())
             AND (ends_at IS NULL OR ends_at >= NOW())
             AND (
               $1::INT IS NULL
               OR display_frequency = 'every_session'
               OR NOT EXISTS (
                 SELECT 1 FROM promo_dismissals pd
                 WHERE pd.promo_id = promos.id
                   AND pd.user_id = $1
                   AND (
                     (display_frequency = 'once')
                     OR (display_frequency = 'daily' AND pd.dismissed_at >= date_trunc('day', NOW()))
                     OR (display_frequency = 'weekly' AND pd.dismissed_at >= NOW() - INTERVAL '7 days')
                   )
               )
             )
           ORDER BY created_at DESC
           LIMIT 1"#,
    )
    .bind(user_id)
    .fetch_optional(pool)
    .await
}

pub async fn dismiss_promo(pool: &PgPool, user_id: i32, promo_id: i32) -> sqlx::Result<()> {
    sqlx::query(
        "INSERT INTO promo_dismissals (user_id, promo_id, dismissed_at)
         VALUES ($1, $2, NOW())
         ON CONFLICT (user_id, promo_id) DO UPDATE SET dismissed_at = NOW()",
    )
    .bind(user_id)
    .bind(promo_id)
    .execute(pool)
    .await?;
    Ok(())
}

pub async fn admin_list_promos(pool: &PgPool) -> sqlx::Result<Vec<Promo>> {
    sqlx::query_as::<_, Promo>(
        "SELECT id, title, message, url, url_text, display_frequency, starts_at, ends_at, enabled, created_at
         FROM promos ORDER BY created_at DESC",
    )
    .fetch_all(pool)
    .await
}

pub struct PromoInput<'a> {
    pub title: &'a str,
    pub message: &'a str,
    pub url: Option<&'a str>,
    pub url_text: Option<&'a str>,
    pub display_frequency: &'a str,
    pub starts_at: Option<NaiveDateTime>,
    pub ends_at: Option<NaiveDateTime>,
    pub enabled: bool,
}

pub async fn admin_create_promo(pool: &PgPool, input: PromoInput<'_>) -> sqlx::Result<Promo> {
    sqlx::query_as::<_, Promo>(
        "INSERT INTO promos (title, message, url, url_text, display_frequency, starts_at, ends_at, enabled)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
         RETURNING id, title, message, url, url_text, display_frequency, starts_at, ends_at, enabled, created_at",
    )
    .bind(input.title)
    .bind(input.message)
    .bind(input.url)
    .bind(input.url_text)
    .bind(input.display_frequency)
    .bind(input.starts_at)
    .bind(input.ends_at)
    .bind(input.enabled)
    .fetch_one(pool)
    .await
}

pub async fn admin_update_promo(pool: &PgPool, id: i32, input: PromoInput<'_>) -> sqlx::Result<Option<Promo>> {
    sqlx::query_as::<_, Promo>(
        "UPDATE promos SET title=$1, message=$2, url=$3, url_text=$4, display_frequency=$5,
         starts_at=$6, ends_at=$7, enabled=$8
         WHERE id=$9
         RETURNING id, title, message, url, url_text, display_frequency, starts_at, ends_at, enabled, created_at",
    )
    .bind(input.title)
    .bind(input.message)
    .bind(input.url)
    .bind(input.url_text)
    .bind(input.display_frequency)
    .bind(input.starts_at)
    .bind(input.ends_at)
    .bind(input.enabled)
    .bind(id)
    .fetch_optional(pool)
    .await
}

pub async fn admin_delete_promo(pool: &PgPool, id: i32) -> sqlx::Result<bool> {
    let res = sqlx::query("DELETE FROM promos WHERE id = $1")
        .bind(id)
        .execute(pool)
        .await?;
    Ok(res.rows_affected() > 0)
}

pub fn parse_promo_dt(s: &str) -> Option<NaiveDateTime> {
    parse_dt(s)
}

// ── Admin Logs ─────────────────────────────────────────────────────────────

pub async fn log_admin_action(
    pool: &PgPool,
    admin_user_id: i32,
    action: &str,
    target_type: Option<&str>,
    target_id: Option<i32>,
    details: Option<serde_json::Value>,
    ip_address: Option<&str>,
) -> sqlx::Result<()> {
    sqlx::query(
        "INSERT INTO admin_logs (admin_user_id, action, target_type, target_id, details, ip_address)
         VALUES ($1, $2, $3, $4, $5, $6)",
    )
    .bind(admin_user_id)
    .bind(action)
    .bind(target_type)
    .bind(target_id)
    .bind(details)
    .bind(ip_address)
    .execute(pool)
    .await?;
    Ok(())
}

pub struct AdminLogFilter<'a> {
    pub page: i64,
    pub limit: i64,
    pub from: Option<&'a str>,
    pub to: Option<&'a str>,
    pub admin_user_id: Option<i32>,
    pub action: Option<&'a str>,
}

pub async fn admin_get_logs(
    pool: &PgPool,
    f: AdminLogFilter<'_>,
) -> sqlx::Result<(Vec<AdminLogRow>, i64)> {
    let offset = (f.page - 1) * f.limit;
    let from_dt = f.from.and_then(|s| chrono::DateTime::parse_from_rfc3339(s).ok().map(|d| d.with_timezone(&chrono::Utc)));
    let to_dt = f.to.and_then(|s| chrono::DateTime::parse_from_rfc3339(s).ok().map(|d| d.with_timezone(&chrono::Utc)));

    let rows = sqlx::query_as::<_, AdminLogRow>(
        "SELECT al.id, al.admin_user_id, u.email AS admin_email,
                al.action, al.target_type, al.target_id, al.details, al.ip_address, al.created_at
         FROM admin_logs al
         JOIN users u ON u.id = al.admin_user_id
         WHERE ($1::TIMESTAMPTZ IS NULL OR al.created_at >= $1)
           AND ($2::TIMESTAMPTZ IS NULL OR al.created_at <= $2)
           AND ($3::INTEGER  IS NULL OR al.admin_user_id = $3)
           AND ($4::TEXT     IS NULL OR al.action = $4)
         ORDER BY al.created_at DESC
         LIMIT $5 OFFSET $6",
    )
    .bind(from_dt)
    .bind(to_dt)
    .bind(f.admin_user_id)
    .bind(f.action)
    .bind(f.limit)
    .bind(offset)
    .fetch_all(pool)
    .await?;

    let total: i64 = sqlx::query_scalar(
        "SELECT COUNT(*) FROM admin_logs al
         WHERE ($1::TIMESTAMPTZ IS NULL OR al.created_at >= $1)
           AND ($2::TIMESTAMPTZ IS NULL OR al.created_at <= $2)
           AND ($3::INTEGER  IS NULL OR al.admin_user_id = $3)
           AND ($4::TEXT     IS NULL OR al.action = $4)",
    )
    .bind(from_dt)
    .bind(to_dt)
    .bind(f.admin_user_id)
    .bind(f.action)
    .fetch_one(pool)
    .await?;

    Ok((rows, total))
}

// ── Admin: Dashboard Stats ─────────────────────────────────────────────────

pub async fn admin_get_dashboard_stats(pool: &PgPool) -> sqlx::Result<AdminDashboardStats> {
    let user_count: i64 = sqlx::query_scalar("SELECT COUNT(*) FROM users")
        .fetch_one(pool)
        .await?;

    let active_trackers: i64 = sqlx::query_scalar(
        "SELECT COUNT(DISTINCT user_id) FROM user_cases",
    )
    .fetch_one(pool)
    .await?;

    let emails_sent_this_month: i64 = sqlx::query_scalar(
        "SELECT COUNT(*) FROM notifications WHERE sent_at >= date_trunc('month', NOW())",
    )
    .fetch_one(pool)
    .await?;

    let today = chrono::Utc::now().date_naive();
    let upcoming_sittings: i64 = sqlx::query_scalar(
        "SELECT COUNT(*) FROM court_sittings WHERE event_date >= $1",
    )
    .bind(today)
    .fetch_one(pool)
    .await?;

    let pending_notifications: i64 = sqlx::query_scalar(
        "SELECT COUNT(*) FROM notifications WHERE read_at IS NULL AND archived_at IS NULL",
    )
    .fetch_one(pool)
    .await?;

    let judgment_count: i64 = sqlx::query_scalar("SELECT COUNT(*) FROM judgments")
        .fetch_one(pool)
        .await?;

    let sittings_count: i64 = sqlx::query_scalar("SELECT COUNT(*) FROM court_sittings")
        .fetch_one(pool)
        .await?;

    Ok(AdminDashboardStats {
        user_count,
        active_trackers,
        emails_sent_this_month,
        upcoming_sittings,
        pending_notifications,
        last_scrape_at: None,
        judgment_count,
        sittings_count,
    })
}

pub async fn admin_users_per_week(pool: &PgPool) -> sqlx::Result<Vec<WeeklyCount>> {
    sqlx::query_as::<_, WeeklyCount>(
        "SELECT to_char(date_trunc('week', created_at), 'YYYY-MM-DD') AS week,
                COUNT(*) AS count
         FROM users
         WHERE created_at >= NOW() - INTERVAL '8 weeks'
         GROUP BY 1
         ORDER BY 1 ASC",
    )
    .fetch_all(pool)
    .await
}

pub async fn admin_emails_per_day(pool: &PgPool) -> sqlx::Result<Vec<DailyCount>> {
    sqlx::query_as::<_, DailyCount>(
        "SELECT to_char(date_trunc('day', sent_at), 'YYYY-MM-DD') AS day,
                COUNT(*) AS count
         FROM notifications
         WHERE sent_at >= NOW() - INTERVAL '14 days'
         GROUP BY 1
         ORDER BY 1 ASC",
    )
    .fetch_all(pool)
    .await
}

// ── Admin: Users (filtered + paginated) ────────────────────────────────────

pub async fn admin_list_users_filtered(
    pool: &PgPool,
    q: Option<&str>,
    role: Option<&str>,
    page: i64,
    limit: i64,
) -> sqlx::Result<(Vec<AdminUserRow>, i64)> {
    let offset = (page - 1) * limit;
    let search = q.map(|s| format!("%{}%", s.to_lowercase()));

    let rows = sqlx::query_as::<_, AdminUserRow>(
        "SELECT u.id, u.email, u.display_name, u.role, u.created_at, u.email_verified,
                COUNT(uc.id) AS case_count
         FROM users u
         LEFT JOIN user_cases uc ON uc.user_id = u.id
         WHERE ($1::TEXT IS NULL OR LOWER(u.email) LIKE $1 OR LOWER(COALESCE(u.display_name,'')) LIKE $1)
           AND ($2::TEXT IS NULL OR u.role = $2)
         GROUP BY u.id
         ORDER BY u.created_at DESC
         LIMIT $3 OFFSET $4",
    )
    .bind(&search)
    .bind(role)
    .bind(limit)
    .bind(offset)
    .fetch_all(pool)
    .await?;

    let total: i64 = sqlx::query_scalar(
        "SELECT COUNT(*) FROM users u
         WHERE ($1::TEXT IS NULL OR LOWER(u.email) LIKE $1 OR LOWER(COALESCE(u.display_name,'')) LIKE $1)
           AND ($2::TEXT IS NULL OR u.role = $2)",
    )
    .bind(&search)
    .bind(role)
    .fetch_one(pool)
    .await?;

    Ok((rows, total))
}

pub async fn admin_get_user_detail(
    pool: &PgPool,
    user_id: i32,
) -> sqlx::Result<Option<AdminUserDetail>> {
    let user = sqlx::query_as::<_, User>(
        "SELECT id, email, password_hash, role, display_name, created_at, email_verified
         FROM users WHERE id = $1",
    )
    .bind(user_id)
    .fetch_optional(pool)
    .await?;

    let user = match user {
        Some(u) => u,
        None => return Ok(None),
    };

    let tracked_cases = sqlx::query_as::<_, TrackedCaseSummary>(
        "SELECT id, case_number, case_type, created_at FROM user_cases
         WHERE user_id = $1 ORDER BY created_at DESC",
    )
    .bind(user_id)
    .fetch_all(pool)
    .await?;

    let recent_notifications = sqlx::query_as::<_, RecentNotifSummary>(
        "SELECT id, type, sent_at, title FROM notifications
         WHERE user_id = $1 ORDER BY sent_at DESC LIMIT 5",
    )
    .bind(user_id)
    .fetch_all(pool)
    .await?;

    Ok(Some(AdminUserDetail {
        id: user.id,
        email: user.email,
        display_name: user.display_name,
        role: user.role,
        created_at: user.created_at,
        email_verified: user.email_verified,
        tracked_cases,
        recent_notifications,
    }))
}
