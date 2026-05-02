export interface User {
  id: number;
  email: string;
  password_hash?: never;
  created_at: string;
}

export interface Judge {
  id: number;
  name: string;
  court: string | null;
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
}

export interface UserCase {
  id: number;
  user_id: number;
  case_id: number;
  created_at: string;
}

export interface Notification {
  id: number;
  user_id: number;
  case_id: number;
  type: string;
  sent_at: string;
}
