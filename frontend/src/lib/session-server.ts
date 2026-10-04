import "server-only";
import type { NextResponse } from "next/server";

// The backend JWT lives ONLY in this httpOnly cookie. Browser JavaScript can
// never read it, so an XSS bug can no longer steal the session token.
export const SESSION_COOKIE = "cwja_session";
const MAX_AGE_SECS = 7 * 24 * 60 * 60; // matches the backend JWT lifetime

export const BACKEND_URL =
  process.env.API_URL ||
  process.env.NEXT_PUBLIC_API_URL ||
  "http://localhost:3001/api";

export function setSessionCookie(res: NextResponse, token: string) {
  res.cookies.set(SESSION_COOKIE, token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: MAX_AGE_SECS,
  });
}

export function clearSessionCookie(res: NextResponse) {
  res.cookies.set(SESSION_COOKIE, "", {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: 0,
  });
}

/** Role claim from a backend-issued JWT, for UI hints only (never trusted for access). */
export function roleFromJwt(token: string): string | null {
  try {
    const b64 = token.split(".")[1].replace(/-/g, "+").replace(/_/g, "/");
    return JSON.parse(Buffer.from(b64, "base64").toString("utf8"))?.role ?? null;
  } catch {
    return null;
  }
}
