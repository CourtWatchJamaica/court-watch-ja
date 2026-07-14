import {
  ActivityLogRow,
  AdminDashboardStats,
  AdminLog,
  AdminUser,
  AdminUserDetail,
  AdminUserRow,
  CaseLookupResult,
  CourtSitting,
  DocketDetail,
  DocketListItem,
  Judge,
  JudgeConnection,
  Judgment,
  LegalNewsItem,
  Notification,
  ParishCaseDetail,
  ParishCourtCase,
  ParishSummary,
  Promo,
  ScraperStatus,
  ServiceAlert,
  SystemConfigEntry,
  User,
  UserCase,
} from "./types";

const BASE_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:3001/api";

export class ApiError extends Error {
  status: number;
  data: Record<string, unknown>;
  constructor(message: string, status: number, data: Record<string, unknown>) {
    super(message);
    this.name = "ApiError";
    this.status = status;
    this.data = data;
  }
}

async function request<T>(path: string, options: RequestInit = {}): Promise<T> {
  const token =
    typeof window !== "undefined" ? localStorage.getItem("token") : null;
  const headers: HeadersInit = {
    "Content-Type": "application/json",
    ...(token && { Authorization: `Bearer ${token}` }),
    ...(BASE_URL.includes("ngrok-free.app") && { "ngrok-skip-browser-warning": "true" }),
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
      throw new ApiError(
        error?.error || error?.message || `Request failed: ${res.status}`,
        res.status,
        error || {}
      );
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
  async signup(email: string, password: string, displayName?: string): Promise<{ message: string }> {
    return request<{ message: string }>("/auth/signup", {
      method: "POST",
      body: JSON.stringify({ email, password, display_name: displayName || null }),
    });
  },

  async verifyEmail(token: string): Promise<{ token: string }> {
    return request<{ token: string }>(
      `/auth/verify-email?token=${encodeURIComponent(token)}`
    );
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

  async deleteAccount(): Promise<{ message: string }> {
    return request("/user/account", { method: "DELETE" });
  },

  async requestPasswordChange(
    current_password: string,
    new_password: string,
  ): Promise<{ message: string }> {
    return request("/auth/request-password-change", {
      method: "POST",
      body: JSON.stringify({ current_password, new_password }),
    });
  },

  async confirmPasswordChange(token: string): Promise<{ message: string }> {
    return request("/auth/confirm-password-change", {
      method: "POST",
      body: JSON.stringify({ token }),
    });
  },

  async forgotPassword(email: string): Promise<{ message: string }> {
    return request("/auth/forgot-password", {
      method: "POST",
      body: JSON.stringify({ email }),
    });
  },

  async resetPassword(token: string, new_password: string): Promise<{ message: string }> {
    return request("/auth/reset-password", {
      method: "POST",
      body: JSON.stringify({ token, new_password }),
    });
  },

  // ── Judgments ───────────────────────────────────────────────────────────
  async getJudgments(opts?: {
    q?: string;
    court?: string;
    judge?: string;
    page?: number;
    limit?: number;
    tag?: string;
    date_from?: string;
    date_to?: string;
    case_number?: string;
  }): Promise<{ judgments: Judgment[]; total: number }> {
    const params = new URLSearchParams();
    if (opts?.q) params.set("q", opts.q);
    if (opts?.court) params.set("court", opts.court);
    if (opts?.judge) params.set("judge", opts.judge);
    if (opts?.page != null) params.set("page", String(opts.page));
    if (opts?.limit != null) params.set("limit", String(opts.limit));
    if (opts?.tag) params.set("tag", opts.tag);
    if (opts?.date_from) params.set("date_from", opts.date_from);
    if (opts?.date_to) params.set("date_to", opts.date_to);
    if (opts?.case_number) params.set("case_number", opts.case_number);
    const qs = params.toString();
    return request(`/judgments${qs ? `?${qs}` : ""}`);
  },

  async getJudgment(id: string): Promise<{ judgment: Judgment }> {
    return request(`/judgments/${id}`);
  },

  async getOriginalPdfUrl(id: number): Promise<{ url: string | null }> {
    return request(`/judgments/${id}/original-pdf`);
  },

  // ── Court Sittings ──────────────────────────────────────────────────────
  async getJudgesAutocomplete(q: string): Promise<{ names: string[] }> {
    return request(`/judges/autocomplete?q=${encodeURIComponent(q)}`);
  },

  async getCourtSittings(opts?: {
    q?: string;
    court?: string;
    date_from?: string;
    date_to?: string;
    judge?: string;
    case_number?: string;
    page?: number;
    limit?: number;
  }): Promise<{ sittings: CourtSitting[]; total: number }> {
    const params = new URLSearchParams();
    if (opts?.q) params.set("q", opts.q);
    if (opts?.court) params.set("court", opts.court);
    if (opts?.date_from) params.set("date_from", opts.date_from);
    if (opts?.date_to) params.set("date_to", opts.date_to);
    if (opts?.judge) params.set("judge", opts.judge);
    if (opts?.case_number) params.set("case_number", opts.case_number);
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

  async getDocketList(): Promise<DocketListItem[]> {
    return request("/docket");
  },

  async getDocketDetail(caseNumber: string): Promise<DocketDetail> {
    return request(`/docket/${caseNumber}`);
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

  async archiveNotification(id: number): Promise<{ archived: boolean }> {
    return request(`/notifications/${id}`, { method: "DELETE" });
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

  async adminListUsersFiltered(opts?: {
    q?: string;
    role?: string;
    page?: number;
    limit?: number;
  }): Promise<{ users: AdminUserRow[]; total: number; page: number; limit: number }> {
    const params = new URLSearchParams();
    if (opts?.q) params.set("q", opts.q);
    if (opts?.role) params.set("role", opts.role);
    if (opts?.page) params.set("page", String(opts.page));
    if (opts?.limit) params.set("limit", String(opts.limit));
    return request(`/admin/users?${params}`);
  },

  async adminGetUserDetail(userId: number): Promise<{ user: AdminUserDetail }> {
    return request(`/admin/users/${userId}/detail`);
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

  async adminGetStats(): Promise<AdminDashboardStats> {
    return request("/admin/stats");
  },

  async adminGetAuditLogs(opts?: {
    page?: number;
    limit?: number;
    from?: string;
    to?: string;
    admin_user_id?: number;
    action?: string;
  }): Promise<{ logs: AdminLog[]; total: number; page: number; limit: number }> {
    const params = new URLSearchParams();
    if (opts?.page) params.set("page", String(opts.page));
    if (opts?.limit) params.set("limit", String(opts.limit));
    if (opts?.from) params.set("from", opts.from);
    if (opts?.to) params.set("to", opts.to);
    if (opts?.admin_user_id) params.set("admin_user_id", String(opts.admin_user_id));
    if (opts?.action) params.set("action", opts.action);
    return request(`/admin/logs/audit?${params}`);
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
    date_from?: string;
  }): Promise<{ cases: ParishCourtCase[]; total: number }> {
    const params = new URLSearchParams();
    if (opts?.parish) params.set("parish", opts.parish);
    if (opts?.q) params.set("q", opts.q);
    if (opts?.category) params.set("category", opts.category);
    if (opts?.page) params.set("page", String(opts.page));
    if (opts?.limit) params.set("limit", String(opts.limit));
    if (opts?.date_from) params.set("date_from", opts.date_from);
    const qs = params.toString();
    return request(`/parish-cases${qs ? `?${qs}` : ""}`);
  },

  async getParishCase(id: number): Promise<ParishCaseDetail> {
    return request(`/parish-cases/${id}`);
  },

  async getParishSummary(): Promise<{ summary: ParishSummary[] }> {
    return request("/parish-summary");
  },

  // ── Case Lookup ───────────────────────────────────────────────────────────
  async caseLookup(caseNumber: string): Promise<CaseLookupResult> {
    return request(`/case-lookup?case_number=${encodeURIComponent(caseNumber)}`);
  },

  // ── Legal News ────────────────────────────────────────────────────────────
  async getLegalNews(opts?: {
    category?: string;
    limit?: number;
  }): Promise<{ news: LegalNewsItem[] }> {
    const params = new URLSearchParams();
    if (opts?.category) params.set("category", opts.category);
    if (opts?.limit != null) params.set("limit", String(opts.limit));
    const qs = params.toString();
    return request(`/legal-news${qs ? `?${qs}` : ""}`);
  },

  // ── Service Alert ────────────────────────────────────────────────────────
  async getServiceAlert(): Promise<{ alert: ServiceAlert | null }> {
    return request("/service-alert");
  },

  async adminSetServiceAlert(data: {
    title?: string;
    message?: string;
    severity?: string;
    enabled?: boolean;
  }): Promise<{ alert: ServiceAlert | null }> {
    return request("/admin/service-alert", {
      method: "POST",
      body: JSON.stringify(data),
    });
  },

  // ── Promos ────────────────────────────────────────────────────────────────
  async getActivePromo(): Promise<{ promo: Promo | null }> {
    return request("/promo/active");
  },

  async dismissPromo(promo_id: number): Promise<{ dismissed: boolean }> {
    return request("/promo/dismiss", {
      method: "POST",
      body: JSON.stringify({ promo_id }),
    });
  },

  // ── Admin: Promos ─────────────────────────────────────────────────────────
  async adminListPromos(): Promise<{ promos: Promo[] }> {
    return request("/admin/promos");
  },

  async adminCreatePromo(data: {
    title: string;
    message: string;
    url?: string;
    url_text?: string;
    display_frequency?: string;
    starts_at?: string;
    ends_at?: string;
    enabled?: boolean;
  }): Promise<{ promo: Promo }> {
    return request("/admin/promos", {
      method: "POST",
      body: JSON.stringify(data),
    });
  },

  async adminUpdatePromo(
    id: number,
    data: {
      title: string;
      message: string;
      url?: string;
      url_text?: string;
      display_frequency?: string;
      starts_at?: string;
      ends_at?: string;
      enabled?: boolean;
    },
  ): Promise<{ promo: Promo }> {
    return request(`/admin/promos/${id}`, {
      method: "PUT",
      body: JSON.stringify(data),
    });
  },

  async adminDeletePromo(id: number): Promise<{ deleted: boolean }> {
    return request(`/admin/promos/${id}`, { method: "DELETE" });
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

  // Returns { blob, filename } — caller triggers the browser download.
  async adminDownloadBackup(): Promise<{ blob: Blob; filename: string; retryAfterSecs?: number }> {
    const token =
      typeof window !== "undefined" ? localStorage.getItem("token") : null;
    const apiBase = process.env.NEXT_PUBLIC_API_URL || "http://localhost:3001/api";
    const res = await fetch(`${apiBase}/admin/backup`, {
      headers: {
        ...(token && { Authorization: `Bearer ${token}` }),
      },
    });

    if (res.status === 429) {
      const body = await res.json().catch(() => ({}));
      return {
        blob: new Blob(),
        filename: "",
        retryAfterSecs: body.retry_after_secs ?? 900,
      };
    }

    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      throw new Error(err.error || `Backup request failed: ${res.status}`);
    }

    const disposition = res.headers.get("content-disposition") ?? "";
    const match = disposition.match(/filename="([^"]+)"/);
    const filename = match?.[1] ?? `courtwatch_backup_${new Date().toISOString().slice(0, 10)}.sql`;
    const blob = await res.blob();
    return { blob, filename };
  },

  async getCaseHistory(caseNumber: string): Promise<{
    case_number: string;
    judgment: import("./types").Judgment | null;
    sittings: import("./types").CourtSitting[];
  }> {
    const apiBase = process.env.NEXT_PUBLIC_API_URL || "http://localhost:3001/api";
    const res = await fetch(
      `${apiBase}/public/case-history/${encodeURIComponent(caseNumber)}`,
    );
    if (!res.ok) throw Object.assign(new Error("Not found"), { status: res.status });
    return res.json();
  },
};
// force rebuild
