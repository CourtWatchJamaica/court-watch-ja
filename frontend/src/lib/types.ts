export interface User {
  id: number;
  email: string;
  role: "user" | "admin" | "super_admin";
  display_name?: string | null;
  password_hash?: never;
  created_at: string;
  email_verified: boolean;
}

export interface AdminUser {
  id: number;
  email: string;
  role: "user" | "admin" | "super_admin";
  created_at: string;
}

export interface AdminUserRow {
  id: number;
  email: string;
  display_name: string | null;
  role: "user" | "admin" | "super_admin";
  created_at: string;
  email_verified: boolean;
  case_count: number;
}

export interface TrackedCaseSummary {
  id: number;
  case_number: string | null;
  case_type: string;
  created_at: string;
}

export interface RecentNotifSummary {
  id: number;
  type: string;
  sent_at: string;
  title: string | null;
}

export interface AdminUserDetail {
  id: number;
  email: string;
  display_name: string | null;
  role: string;
  created_at: string;
  email_verified: boolean;
  tracked_cases: TrackedCaseSummary[];
  recent_notifications: RecentNotifSummary[];
}

export interface AdminLog {
  id: number;
  admin_user_id: number;
  admin_email: string;
  action: string;
  target_type: string | null;
  target_id: number | null;
  details: Record<string, unknown> | null;
  ip_address: string | null;
  created_at: string;
}

export interface WeeklyCount {
  week: string;
  count: number;
}

export interface DailyCount {
  day: string;
  count: number;
}

export interface AdminDashboardStats {
  user_count: number;
  active_trackers: number;
  emails_sent_this_month: number;
  upcoming_sittings: number;
  pending_notifications: number;
  last_scrape_at: string | null;
  judgment_count: number;
  sittings_count: number;
  users_per_week: WeeklyCount[];
  emails_per_day: DailyCount[];
}

export interface SystemConfigEntry {
  key: string;
  value: string;
  updated_at: string;
}

export interface ScraperStatus {
  is_running: boolean;
  processed_sc_count: number;
  processed_coa_count: number;
  processed_parish_count: number;
  last_sc_scraped: string | null;
  last_coa_scraped: string | null;
  next_judgment_page: number;
  next_appeal_page: number;
  next_parish_page: number;
  pdf_failures: Record<string, number>;
  pdf_skipped: string[];
  pdf_skipped_count: number;
}

export interface ActivityLogRow {
  id: number;
  email: string;
  case_id: number | null;
  notification_type: string;
  sent_at: string;
}

export interface Judge {
  id: number;
  name: string;
  court: string | null;
  /** Present when fetched from the list endpoint (JudgeWithCount). */
  total_cases?: number;
  created_at: string;
  updated_at: string;
}

export interface Judgment {
  id: number;
  case_number: string;
  title: string | null;
  judge_name: string | null;
  court: string | null;
  date: string | null;
  pdf_url: string | null;
  local_pdf_path: string | null;
  summary_text: string | null;
  created_at: string;
  updated_at: string;
  snippet?: string | null;
  source_url?: string | null;
  tags?: string[];
}

export interface CourtSitting {
  id: number;
  case_number: string | null;
  title: string | null;
  judge_name: string | null;
  court_division: string | null;
  event_type: string | null;
  event_date: string | null;   // "YYYY-MM-DD"
  event_time: string | null;   // "HH:MM:SS"
  lawyers: string | null;
  pdf_source_url: string | null;
  created_at: string;
  snippet?: string | null;
  /** Frontend-only: marks rows adapted from parish_court_cases. */
  _source?: "parish";
}

export interface UserCase {
  id: number;
  user_id: number;
  /** Null when the entry was tracked by case_number before a real case was matched. */
  case_id: number | null;
  case_type: "judgment" | "sitting" | "parish_court";
  case_number?: string | null;
  /** Notification preferences (null = use defaults). */
  notify_immediately?: boolean | null;
  notify_day_before?: boolean | null;
  notify_morning_of?: boolean | null;
  /** Last known sitting date — used by the notification engine to detect changes. */
  last_event_date?: string | null;
  last_event_time?: string | null;
  /** Last known parish_court_cases.status — used to detect status changes. */
  last_status?: string | null;
  created_at: string;
}

export interface JudgeConnection {
  judge_a_id: number;
  judge_b_id: number;
  /** Number of cases the two judges appeared on together. */
  count: number;
}

/** A judge who co-appeared on cases with another judge. */
export interface CoJudge {
  id: number;
  name: string;
  court: string | null;
  shared_cases: number;
}

export interface DocketListItem {
  user_case_id: number;
  case_number: string;
  next_event_date: string | null;
  next_event_type: string | null;
  next_court_division: string | null;
  unread_count: number;
  tracked_at: string;
}

export interface DocketDetail {
  case_number: string;
  user_case_id: number;
  judgment: Judgment | null;
  sittings: CourtSitting[];
}

export interface Notification {
  id: number;
  user_id: number;
  case_id: number | null;
  type: string;
  sent_at: string;
  read_at: string | null;
  archived_at?: string | null;
  case_number?: string | null;
  title?: string | null;
  message?: string | null;
  link?: string | null;
  severity?: string | null;
}

export interface ServiceAlert {
  title: string;
  message: string;
  severity: "info" | "warning" | "critical";
  enabled: boolean;
}

export interface ParishCourtCase {
  id: number;
  parish: string;
  accused_name: string | null;
  offence: string | null;
  status: string | null;
  week_of: string | null; // "YYYY-MM-DD"
  pdf_source_url: string | null;
  created_at: string;
  case_type: string; // "criminal" | "civil"
  category: "Violent" | "Property" | "Drugs" | "Other";
}

export interface ParishSummary {
  name: string;
  total_cases: number;
}

// ── Parish Court journalist analytics ──────────────────────────────────────

export interface OffenceLeaderboardRow {
  offence: string;
  count: number;
  category: "Violent" | "Property" | "Drugs" | "Other";
}

export interface ParishSpikeRow {
  parish: string;
  current_week: string;
  current_count: number;
  previous_week: string;
  previous_count: number;
  pct_change: number;
  is_spike: boolean;
}

export interface BacklogRow {
  accused_name: string;
  parish: string;
  offence: string;
  /** Number of distinct weekly cause lists this charge has appeared in. */
  appearance_count: number;
  total_appearances: number;
  first_seen: string | null;
  last_seen: string | null;
}

export interface ParishBacklogCount {
  parish: string;
  flagged_count: number;
}

export interface ParishAnalytics {
  leaderboard: OffenceLeaderboardRow[];
  spikes: ParishSpikeRow[];
  backlog: {
    top: BacklogRow[];
    by_parish: ParishBacklogCount[];
  };
}

export interface ParishCaseTallies {
  violent: number;
  property: number;
  drugs: number;
  other: number;
}

export interface ParishCaseDetail {
  case: ParishCourtCase;
  related: ParishCourtCase[];
  all_charges: ParishCourtCase[];
  total_count: number;
  offence_tallies: ParishCaseTallies;
}

export interface CaseLookupResult {
  found: boolean;
  judgments: Array<{
    id: number;
    case_number: string;
    title: string | null;
    date: string | null;
    court: string | null;
  }>;
  sittings: Array<{
    id: number;
    case_number: string | null;
    title: string | null;
    event_date: string | null;
    court: string | null;
  }>;
  has_upcoming: boolean;
  has_past: boolean;
}

export interface Promo {
  id: number;
  title: string;
  message: string;
  url: string | null;
  url_text: string | null;
  display_frequency: "once" | "daily" | "weekly" | "every_session";
  starts_at: string | null;
  ends_at: string | null;
  enabled: boolean;
  created_at: string;
}

export interface LegalNewsItem {
  id: number;
  title: string;
  description: string | null;
  source: string;
  url: string;
  published_at: string | null;
  category: string;
  created_at: string;
}

// ── Admin: Health / observability ──────────────────────────────────────────

export interface ScraperSourceHealth {
  source: string;
  total_rows: number;
  last_data_at: string | null;
  stale_after_days: number;
  stale: boolean;
  last_run_at: string | null;
  last_run_success: boolean | null;
  last_run_rows: number | null;
  last_run_error: string | null;
  consecutive_zero_runs: number;
}

export interface AdminEmailStats {
  sent_today: number;
  sent_7d: number;
  pending: number;
  retired_7d: number;
}

export interface DataQualityCheck {
  key: string;
  label: string;
  count: number;
}

export interface NotifDebugTracked {
  id: number;
  case_type: string;
  case_id: number | null;
  case_number: string | null;
  resolved_case_number: string | null;
  created_at: string;
  notify_immediately: boolean | null;
  notify_day_before: boolean | null;
  notify_morning_of: boolean | null;
}

export interface NotifDebugResult {
  found: boolean;
  user?: {
    id: number;
    email: string;
    role: string;
    email_verified: boolean;
    created_at: string;
  };
  tracked?: NotifDebugTracked[];
  matching_sittings?: {
    id: number;
    case_number: string | null;
    event_date: string | null;
    event_type: string | null;
    court_division: string | null;
  }[];
  matching_judgments?: {
    id: number;
    case_number: string;
    title: string | null;
    date: string | null;
  }[];
  notifications?: {
    id: number;
    type: string | null;
    case_id: number | null;
    resolved_case_number: string | null;
    sent_at: string | null;
    emailed_at: string | null;
    read_at: string | null;
  }[];
}
