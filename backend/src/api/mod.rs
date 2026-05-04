pub mod admin;
pub mod auth;
pub mod court_sittings;
pub mod court_stats;
pub mod errors;
pub mod judgments;
pub mod judges;
pub mod notifications;
pub mod tracking;

pub fn court_slug_to_name(slug: &str) -> &'static str {
    if slug.eq_ignore_ascii_case("court-of-appeal")
        || slug.eq_ignore_ascii_case("court of appeal")
    {
        "Court of Appeal"
    } else if slug.eq_ignore_ascii_case("parish-court")
        || slug.eq_ignore_ascii_case("parish court")
    {
        "Parish Court"
    } else {
        "Supreme Court"
    }
}

use axum::{
    middleware,
    routing::{delete, get, post, put},
    Router,
};

use crate::{
    middleware::auth::{require_admin, require_auth, require_super_admin},
    AppState,
};

pub fn router(state: AppState) -> Router {
    // ── Public ────────────────────────────────────────────────────────────
    let public = Router::new()
        .route("/api/auth/signup", post(auth::signup))
        .route("/api/auth/login", post(auth::login));

    // ── Protected (any authenticated user) ───────────────────────────────
    let protected = Router::new()
        .route("/api/auth/me", get(auth::me))
        .route("/api/judgments", get(judgments::list_judgments))
        .route("/api/judgments/:id", get(judgments::get_judgment))
        .route("/api/judges", get(judges::list_judges))
        .route("/api/judges/:id", get(judges::get_judge))
        .route("/api/user/cases", get(tracking::get_user_cases))
        .route("/api/user/cases", post(tracking::add_user_case))
        .route("/api/user/cases/:case_id", delete(tracking::remove_user_case))
        .route("/api/notifications", get(notifications::get_notifications))
        .route("/api/notifications/unread-count", get(notifications::get_unread_count))
        .route("/api/notifications/mark-read", post(notifications::mark_all_read))
        .route("/api/notifications/:id/mark-read", post(notifications::mark_one_read))
        .route("/api/user/preferences", put(notifications::update_preferences))
        .route("/api/court-sittings", get(court_sittings::list_sittings))
        .route("/api/court-sittings/today", get(court_sittings::today_sittings))
        .route("/api/court-sittings/:id", get(court_sittings::get_sitting))
        .route("/api/court-stats", get(court_stats::get_court_stats))
        .layer(middleware::from_fn_with_state(state.clone(), require_auth));

    // ── Admin (admin + super_admin) ───────────────────────────────────────
    // Layers run outermost-first: require_auth decodes JWT & inserts Claims,
    // then require_admin checks the role.
    let admin_routes = Router::new()
        .route("/api/admin/users", get(admin::list_users))
        .route("/api/admin/config", get(admin::get_config))
        .route("/api/admin/config/:key", put(admin::set_config))
        .route("/api/admin/scraper/state", get(admin::get_scraper_state))
        .route("/api/admin/scraper/trigger", post(admin::trigger_scraper))
        .route("/api/admin/scraper/skipped", delete(admin::remove_skipped_pdf))
        .route("/api/admin/scraper/skip", post(admin::skip_pdf))
        .route("/api/admin/data/judgments", get(admin::list_judgments))
        .route("/api/admin/data/judgments", post(admin::create_judgment))
        .route("/api/admin/data/judgments/:id", put(admin::update_judgment))
        .route("/api/admin/data/judgments/:id", delete(admin::delete_judgment))
        .route("/api/admin/data/sittings", get(admin::list_sittings))
        .route("/api/admin/data/sittings", post(admin::create_sitting))
        .route("/api/admin/data/sittings/:id", put(admin::update_sitting))
        .route("/api/admin/data/sittings/:id", delete(admin::delete_sitting))
        .route("/api/admin/logs", get(admin::get_activity_log))
        .route("/api/admin/announce", post(admin::announce))
        .route("/api/admin/upload-pdf", post(admin::upload_pdf))
        .layer(middleware::from_fn(require_admin))
        .layer(middleware::from_fn_with_state(state.clone(), require_auth));

    // ── Super-admin only (user role management) ───────────────────────────
    let super_admin_routes = Router::new()
        .route("/api/admin/users/:id/role", put(admin::set_user_role))
        .route("/api/admin/users/:id", delete(admin::delete_user))
        .layer(middleware::from_fn(require_super_admin))
        .layer(middleware::from_fn_with_state(state.clone(), require_auth));

    public
        .merge(protected)
        .merge(admin_routes)
        .merge(super_admin_routes)
        .with_state(state)
}
