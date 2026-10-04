// Client-side session helpers.
//
// The real session token is an httpOnly cookie set by the Next.js server
// (see app/api/proxy and app/api/session) — JavaScript cannot read it.
// All we keep client-side is a NON-SECRET UI hint ("someone is logged in" and
// their role) so the navbar/guards can render without a round trip. The
// backend still authorises every request from the cookie.

const FLAG_KEY = "cwja_auth";

export function markLoggedIn(role?: string | null) {
  try {
    localStorage.setItem(FLAG_KEY, JSON.stringify({ role: role ?? null }));
  } catch {
    /* storage unavailable */
  }
}

export function clearSessionHint() {
  try {
    localStorage.removeItem(FLAG_KEY);
    localStorage.removeItem("token"); // legacy key from before the cookie migration
  } catch {
    /* storage unavailable */
  }
}

export function isLoggedIn(): boolean {
  try {
    return !!localStorage.getItem(FLAG_KEY);
  } catch {
    return false;
  }
}

export function getStoredRole(): string | null {
  try {
    const raw = localStorage.getItem(FLAG_KEY);
    return raw ? (JSON.parse(raw).role ?? null) : null;
  } catch {
    return null;
  }
}

/** Clears the httpOnly cookie server-side, then the UI hint. */
export async function logout(): Promise<void> {
  try {
    await fetch("/api/session", { method: "DELETE" });
  } catch {
    /* best effort */
  }
  clearSessionHint();
}
