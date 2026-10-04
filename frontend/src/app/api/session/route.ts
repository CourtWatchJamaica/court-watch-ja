import { NextRequest, NextResponse } from "next/server";
import { SESSION_COOKIE, clearSessionCookie } from "@/lib/session-server";

export const dynamic = "force-dynamic";

// GET: is there a session cookie? (the cookie itself is never exposed)
export async function GET(req: NextRequest) {
  return NextResponse.json(
    { authenticated: !!req.cookies.get(SESSION_COOKIE)?.value },
    { headers: { "Cache-Control": "no-store" } },
  );
}

// DELETE: log out — clears the httpOnly cookie.
export async function DELETE(req: NextRequest) {
  const origin = req.headers.get("origin");
  if (origin && origin !== req.nextUrl.origin) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }
  const res = NextResponse.json({ ok: true });
  clearSessionCookie(res);
  return res;
}
