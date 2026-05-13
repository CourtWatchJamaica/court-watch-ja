export interface User {
  id: number;
  email: string;
  role: "user" | "admin" | "super_admin";
  display_name?: string | null;
  password_hash?: never;
  created_at: string;
}

export interface AdminUser {
  id: number;
  email: string;
  role: "user" | "admin" | "super_admin";
  created_at: string;
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
}

export interface UserCase {
  id: number;
  user_id: number;
  case_id: number;
  case_type: "judgment" | "sitting";
  /** Last known sitting date — used by the notification engine to detect changes. */
  last_event_date?: string | null;
  last_event_time?: string | null;
  created_at: string;
}

export interface JudgeConnection {
  judge_a_id: number;
  judge_b_id: number;
}

export interface Notification {
  id: number;
  user_id: number;
  case_id: number | null;
  type: string;
  sent_at: string;
  read_at: string | null;
  title?: string | null;
  message?: string | null;
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
}

export interface ParishSummary {
  name: string;
  total_cases: number;
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
