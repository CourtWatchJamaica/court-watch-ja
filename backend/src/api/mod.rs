pub mod auth;
pub mod court_sittings;
pub mod court_stats;
pub mod errors;
pub mod judgments;
pub mod judges;
pub mod notifications;
pub mod tracking;

/// Map URL-slug or display-name court strings to the canonical DB value.
/// Accepts both "supreme-court" and "Supreme Court" forms.
/// Unknown values default to "Supreme Court".
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

use crate::{middleware::auth::require_auth, AppState};

pub fn router(state: AppState) -> Router {
    // Public routes
    let public = Router::new()
        .route("/api/auth/signup", post(auth::signup))
        .route("/api/auth/login",  post(auth::login));

    // Protected routes — require JWT
    let protected = Router::new()
        .route("/api/judgments",              get(judgments::list_judgments))
        .route("/api/judgments/:id",          get(judgments::get_judgment))
        .route("/api/judges",                 get(judges::list_judges))
        .route("/api/judges/:id",             get(judges::get_judge))
        .route("/api/user/cases",             get(tracking::get_user_cases))
        .route("/api/user/cases",             post(tracking::add_user_case))
        .route("/api/user/cases/:case_id",    delete(tracking::remove_user_case))
        .route("/api/notifications",          get(notifications::get_notifications))
        .route("/api/user/preferences",       put(notifications::update_preferences))
        .route("/api/court-sittings",         get(court_sittings::list_sittings))
        .route("/api/court-sittings/today",   get(court_sittings::today_sittings))
        .route("/api/court-stats",            get(court_stats::get_court_stats))
        .layer(middleware::from_fn_with_state(state.clone(), require_auth));

    public.merge(protected).with_state(state)
}
