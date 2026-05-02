import { CourtSitting, Judge, Judgment, Notification, UserCase } from "./types";

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
        localStorage.removeItem("token");
        window.location.href = "/auth/login";
      }
      throw new Error("Unauthorized");
    }

    if (!res.ok) {
      const error = await res.json().catch(() => null);
      throw new Error(error?.message || `Request failed: ${res.status}`);
    }

    return res.json();
  } catch (error) {
    if (error instanceof Error) throw error;
    throw new Error("Network error");
  }
}

export const apiClient = {
  // Auth
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

  // Judgments
  async getJudgments(q?: string): Promise<{ judgments: Judgment[] }> {
    const query = q ? `?q=${encodeURIComponent(q)}` : "";
    return request(`/judgments${query}`);
  },

  async getJudgment(id: string): Promise<{ judgment: Judgment }> {
    return request(`/judgments/${id}`);
  },

  // Court Sittings
  async getCourtSittings(q?: string): Promise<{ sittings: CourtSitting[] }> {
    const query = q ? `?q=${encodeURIComponent(q)}` : "";
    return request(`/court-sittings${query}`);
  },

  // Judges
  async getJudges(): Promise<{ judges: Judge[] }> {
    return request("/judges");
  },

  async getJudge(id: string): Promise<{ judge: Judge; judgments: Judgment[] }> {
    return request(`/judges/${id}`);
  },

  // User Cases
  async getUserCases(): Promise<{ cases: UserCase[] }> {
    return request("/user/cases");
  },

  async addUserCase(case_id: number): Promise<{ success: boolean }> {
    return request("/user/cases", {
      method: "POST",
      body: JSON.stringify({ case_id }),
    });
  },

  async removeUserCase(case_id: number): Promise<{ success: boolean }> {
    return request(`/user/cases/${case_id}`, {
      method: "DELETE",
    });
  },

  // Notifications
  async getNotifications(): Promise<{ notifications: Notification[] }> {
    return request("/notifications");
  },

  // User Preferences
  async updatePreferences(
    email_notifications: boolean,
    push_notifications: boolean,
  ): Promise<{ success: boolean }> {
    return request("/user/preferences", {
      method: "PUT",
      body: JSON.stringify({ email_notifications, push_notifications }),
    });
  },
};
