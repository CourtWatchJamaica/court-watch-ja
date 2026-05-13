import {
  ActivityLogRow,
  AdminUser,
  CourtSitting,
  Judge,
  JudgeConnection,
  Judgment,
  Notification,
  ParishCaseDetail,
  ParishCourtCase,
  ParishSummary,
  ScraperStatus,
  SystemConfigEntry,
  User,
  UserCase,
} from "./types";

const BASE_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:3001/api";

async function request<T>(path: string, options: RequestInit = {}): Promise<T> {
  const token =
    typeof window !== "undefined" ? localStorage.getItem("token") : null;
  const headers: HeadersInit = {
    "Content-Type": "application/json",
    ...(token && { Authorization: `Bearer ${token}` }),
    ...options.headers,
  };

  try {
    const res = await fetch(`${BASE_URL}${path}`, { ...options, headers });

    if (res.status === 401) {
      if (typeof window !== "undefined") {
        const hadToken = !!localStorage.getItem("token");
        localStorage.removeItem("token");
        // Only hard-redirect when a token existed (session expired) and we're
        // not already on an auth page — prevents the infinite reload loop that
        // occurs when unauthenticated calls fire from root-layout providers.
        if (hadToken && !window.location.pathname.startsWith("/auth/")) {
          window.location.href = "/auth/login";
        }
      }
      throw new Error("Unauthorized");
    }

    if (!res.ok) {
      const error = await res.json().catch(() => null);
      throw new Error(error?.error || error?.message || `Request failed: ${res.status}`);
    }

    return res.json();
  } catch (error) {
    if (error instanceof Error) throw error;
    throw new Error("Network error");
  }
}

export interface CourtStats {
  court: string;
  total_judgments: number;
  sittings_this_week: number;
  total_sittings: number;
  active_judges: number;
}

export const apiClient = {
  // ── Auth ────────────────────────────────────────────────────────────────
  async signup(email: string, password: string): Promise<{ token: string }> {
    return request("/auth/signup", {
      method: "POST",
      body: JSON.stringify({ email, password }),
    });
  },

  async login(email: string, password: string): Promise<{ token: string }> {
    return request("/auth/login", {
      method: "POST",
      body: JSON.stringify({ email, password }),
    });
  },

  async getMe(): Promise<User> {
    return request("/auth/me");
  },

  // ── Profile ─────────────────────────────────────────────────────────────
  async updateProfile(body: {
    display_name?: string | null;
    email?: string;
    current_password?: string;
    new_password?: string;
  }): Promise<User> {
    return request("/user/profile", {
      method: "PUT",
      body: JSON.stringify(body),
    });
  },

  // ── Judgments ───────────────────────────────────────────────────────────
  async getJudgments(
    q?: string,
    court?: string,
    judge?: string,
    page?: number,
    limit?: number,
  ): Promise<{ judgments: Judgment[]; total: number }> {
    const params = new URLSearchParams();
    if (q) params.set("q", q);
    if (court) params.set("court", court);
    if (judge) params.set("judge", judge);
    if (page != null) params.set("page", String(page));
    if (limit != null) params.set("limit", String(limit));
    const qs = params.toString();
    return request(`/judgments${qs ? `?${qs}` : ""}`);
  },

  async getJudgment(id: string): Promise<{ judgment: Judgment }> {
    return request(`/judgments/${id}`);
  },

  // ── Court Sittings ──────────────────────────────────────────────────────
  async getCourtSittings(opts?: {
    q?: string;
    court?: string;
    date_from?: string;
    date_to?: string;
    judge?: string;
    page?: number;
    limit?: number;
  }): Promise<{ sittings: CourtSitting[]; total: number }> {
    const params = new URLSearchParams();
    if (opts?.q) params.set("q", opts.q);
    if (opts?.court) params.set("court", opts.court);
    if (opts?.date_from) params.set("date_from", opts.date_from);
    if (opts?.date_to) params.set("date_to", opts.date_to);
    if (opts?.judge) params.set("judge", opts.judge);
    if (opts?.page != null) params.set("page", String(opts.page));
    if (opts?.limit != null) params.set("limit", String(opts.limit));
    const qs = params.toString();
    return request(`/court-sittings${qs ? `?${qs}` : ""}`);
  },

  async getCourtSitting(id: number): Promise<{ sitting: CourtSitting }> {
    return request(`/court-sittings/${id}`);
  },

  // ── Court Stats ─────────────────────────────────────────────────────────
  async getCourtStats(court: string): Promise<CourtStats> {
    return request(`/court-stats?court=${encodeURIComponent(court)}`);
  },

  // ── Judges ──────────────────────────────────────────────────────────────
  async getJudges(): Promise<{ judges: Judge[] }> {
    return request("/judges");
  },

  async getJudge(id: string): Promise<{ judge: Judge; judgments: Judgment[] }> {
    return request(`/judges/${id}`);
  },

  async getJudgeConnections(): Promise<{ connections: JudgeConnection[] }> {
    return request("/judge-connections");
  },

  // ── User Cases ──────────────────────────────────────────────────────────
  async getUserCases(): Promise<{ cases: UserCase[] }> {
    return request("/user/cases");
  },

  async addUserCase(
    case_id: number,
    case_type: "judgment" | "sitting" = "judgment",
  ): Promise<{ success: boolean }> {
    return request("/user/cases", {
      method: "POST",
      body: JSON.stringify({ case_id, case_type }),
    });
  },

  async addUserCaseByNumber(
    case_number: string,
    case_type: "judgment" | "sitting" = "judgment",
  ): Promise<{ success: boolean }> {
    return request("/user/cases", {
      method: "POST",
      body: JSON.stringify({ case_number, case_type }),
    });
  },

  async removeUserCase(
    case_id: number,
    case_type: "judgment" | "sitting" = "judgment",
  ): Promise<{ success: boolean }> {
    return request(`/user/cases/${case_id}?case_type=${case_type}`, {
      method: "DELETE",
    });
  },

  async removeUserCaseByRow(rowId: number): Promise<{ success: boolean }> {
    return request(`/user/cases/row/${rowId}`, { method: "DELETE" });
  },

  async updateCaseSettings(
    rowId: number,
    settings: {
      notify_immediately: boolean;
      notify_day_before: boolean;
      notify_morning_of: boolean;
    },
  ): Promise<unknown> {
    return request(`/user/cases/${rowId}/settings`, {
      method: "PUT",
      body: JSON.stringify(settings),
    });
  },

  // ── Notifications ───────────────────────────────────────────────────────
  async getNotifications(): Promise<{ notifications: Notification[] }> {
    return request("/notifications");
  },

  async getNotificationsUnreadCount(): Promise<{ count: number }> {
    return request("/notifications/unread-count");
  },

  async markAllNotificationsRead(): Promise<{ updated: number }> {
    return request("/notifications/mark-read", { method: "POST" });
  },

  async markNotificationRead(id: number): Promise<{ marked: boolean }> {
    return request(`/notifications/${id}/mark-read`, { method: "POST" });
  },

  async updatePreferences(
    email_notifications: boolean,
    push_notifications: boolean,
  ): Promise<{ success: boolean }> {
    return request("/user/preferences", {
      method: "PUT",
      body: JSON.stringify({ email_notifications, push_notifications }),
    });
  },

  // ── Admin: Users ────────────────────────────────────────────────────────
  async adminListUsers(): Promise<{ users: AdminUser[] }> {
    return request("/admin/users");
  },

  async adminSetUserRole(
    userId: number,
    role: "user" | "admin" | "super_admin",
  ): Promise<AdminUser> {
    return request(`/admin/users/${userId}/role`, {
      method: "PUT",
      body: JSON.stringify({ role }),
    });
  },

  async adminDeleteUser(userId: number): Promise<{ deleted: boolean }> {
    return request(`/admin/users/${userId}`, { method: "DELETE" });
  },

  // ── Admin: Config ────────────────────────────────────────────────────────
  async adminGetConfig(): Promise<{ config: SystemConfigEntry[] }> {
    return request("/admin/config");
  },

  async adminSetConfig(key: string, value: string): Promise<{ key: string; value: string }> {
    return request(`/admin/config/${encodeURIComponent(key)}`, {
      method: "PUT",
      body: JSON.stringify({ value }),
    });
  },

  // ── Admin: Scraper ───────────────────────────────────────────────────────
  async adminGetScraperState(): Promise<ScraperStatus> {
    return request("/admin/scraper/state");
  },

  async adminTriggerScraper(): Promise<{ started: boolean; message: string }> {
    return request("/admin/scraper/trigger", { method: "POST" });
  },

  async adminDeepScrape(): Promise<{ started: boolean; message: string }> {
    return request("/admin/deep-scrape", { method: "POST" });
  },

  async adminRemoveSkippedPdf(url: string): Promise<{ removed: boolean }> {
    return request("/admin/scraper/skipped", {
      method: "DELETE",
      body: JSON.stringify({ url }),
    });
  },

  async adminSkipPdf(url: string): Promise<{ skipped: boolean }> {
    return request("/admin/scraper/skip", {
      method: "POST",
      body: JSON.stringify({ url }),
    });
  },

  // ── Admin: Data — Judgments ──────────────────────────────────────────────
  async adminGetStats(): Promise<{ pending_notifications: number; last_scrape_at: string | null }> {
    return request("/admin/stats");
  },

  async getMaintenanceStatus(): Promise<{ maintenance_mode: boolean }> {
    return request("/maintenance/status");
  },

  async adminSetMaintenance(enabled: boolean): Promise<{ maintenance_mode: boolean }> {
    return request("/admin/maintenance", {
      method: "POST",
      body: JSON.stringify({ enabled }),
    });
  },

  async adminListJudgments(
    page = 1,
    limit = 50,
    search?: string,
    court?: string,
  ): Promise<{ judgments: Judgment[]; total: number }> {
    const params = new URLSearchParams({ page: String(page), limit: String(limit) });
    if (search) params.set("search", search);
    if (court) params.set("court", court);
    return request(`/admin/data/judgments?${params}`);
  },

  async adminUpdateJudgment(
    id: number,
    data: Partial<Pick<Judgment, "title" | "judge_name" | "court" | "date" | "summary_text">>,
  ): Promise<{ judgment: Judgment }> {
    return request(`/admin/data/judgments/${id}`, {
      method: "PUT",
      body: JSON.stringify(data),
    });
  },

  async adminDeleteJudgment(id: number): Promise<{ deleted: boolean }> {
    return request(`/admin/data/judgments/${id}`, { method: "DELETE" });
  },

  // ── Admin: Data — Sittings ───────────────────────────────────────────────
  async adminListSittings(
    page = 1,
    limit = 50,
    search?: string,
    division?: string,
  ): Promise<{ sittings: CourtSitting[]; total: number }> {
    const params = new URLSearchParams({ page: String(page), limit: String(limit) });
    if (search) params.set("search", search);
    if (division) params.set("division", division);
    return request(`/admin/data/sittings?${params}`);
  },

  async adminUpdateSitting(
    id: number,
    data: Partial<Pick<CourtSitting, "title" | "judge_name" | "event_date" | "event_time">>,
  ): Promise<{ sitting: CourtSitting }> {
    return request(`/admin/data/sittings/${id}`, {
      method: "PUT",
      body: JSON.stringify(data),
    });
  },

  async adminDeleteSitting(id: number): Promise<{ deleted: boolean }> {
    return request(`/admin/data/sittings/${id}`, { method: "DELETE" });
  },

  // ── Admin: Logs ──────────────────────────────────────────────────────────
  async adminGetActivityLog(): Promise<{ activity: ActivityLogRow[] }> {
    return request("/admin/logs");
  },

  // ── Admin: Create Data ───────────────────────────────────────────────────
  async adminCreateJudgment(data: {
    case_number: string;
    title?: string;
    judge_name?: string;
    court?: string;
    date?: string;
    pdf_url?: string;
    summary_text?: string;
  }): Promise<{ judgment: Judgment }> {
    return request("/admin/data/judgments", {
      method: "POST",
      body: JSON.stringify(data),
    });
  },

  async adminCreateSitting(data: {
    case_number?: string;
    title?: string;
    judge_name?: string;
    court_division?: string;
    event_type?: string;
    event_date?: string;
    event_time?: string;
    lawyers?: string;
    pdf_source_url?: string;
  }): Promise<{ sitting: CourtSitting }> {
    return request("/admin/data/sittings", {
      method: "POST",
      body: JSON.stringify(data),
    });
  },

  // ── Parish Court Cases ────────────────────────────────────────────────────
  async getParishCases(opts?: {
    parish?: string;
    q?: string;
    category?: string;
    page?: number;
    limit?: number;
  }): Promise<{ cases: ParishCourtCase[]; total: number }> {
    const params = new URLSearchParams();
    if (opts?.parish) params.set("parish", opts.parish);
    if (opts?.q) params.set("q", opts.q);
    if (opts?.category) params.set("category", opts.category);
    if (opts?.page) params.set("page", String(opts.page));
    if (opts?.limit) params.set("limit", String(opts.limit));
    const qs = params.toString();
    return request(`/parish-cases${qs ? `?${qs}` : ""}`);
  },

  async getParishCase(id: number): Promise<ParishCaseDetail> {
    return request(`/parish-cases/${id}`);
  },

  async getParishSummary(): Promise<{ summary: ParishSummary[] }> {
    return request("/parish-summary");
  },

  // ── Admin: Announce ───────────────────────────────────────────────────────
  async adminAnnounce(title: string, message: string, promo = false): Promise<{ sent: boolean; user_count: number }> {
    return request("/admin/announce", {
      method: "POST",
      body: JSON.stringify({ title, message, promo }),
    });
  },

  // ── Admin: Upload PDF ─────────────────────────────────────────────────────
  async adminUploadPdf(
    filename: string,
    content: string,
    doc_type: string,
    court: string,
  ): Promise<{ extracted: number; message: string }> {
    return request("/admin/upload-pdf", {
      method: "POST",
      body: JSON.stringify({ filename, content, doc_type, court }),
    });
  },
};
