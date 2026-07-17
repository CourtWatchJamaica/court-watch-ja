import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";

// Exchanges the NextAuth server session for a backend JWT.
//
// This runs on the Next.js server only. It reads the session from the
// NextAuth cookie (which the browser cannot forge — NextAuth verified the
// OAuth code exchange with Google/Apple using the server-side client secret)
// and forwards the verified email to the backend along with a shared secret
// that proves the request came from this server, not from a browser.
//
// The backend's /auth/oauth endpoint rejects any request without the secret,
// so it is impossible to mint a token for an arbitrary email from outside.

const BACKEND_URL =
  process.env.API_URL ||
  process.env.NEXT_PUBLIC_API_URL ||
  "http://localhost:3001/api";

export async function POST() {
  const secret = process.env.OAUTH_EXCHANGE_SECRET;
  if (!secret) {
    return NextResponse.json(
      { error: "OAuth exchange is not configured (OAUTH_EXCHANGE_SECRET missing)" },
      { status: 503 },
    );
  }

  const session = await auth();
  if (!session?.user?.email) {
    return NextResponse.json({ error: "Not signed in" }, { status: 401 });
  }

  const res = await fetch(`${BACKEND_URL}/auth/oauth`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "X-OAuth-Exchange-Secret": secret,
    },
    body: JSON.stringify({
      provider:
        (session as unknown as Record<string, unknown>).provider ?? "google",
      email: session.user.email,
      name: session.user.name ?? null,
    }),
    cache: "no-store",
  });

  if (!res.ok) {
    const detail = await res.text().catch(() => "");
    console.error(`[oauth-exchange] backend rejected exchange (${res.status}): ${detail}`);
    return NextResponse.json({ error: "Exchange failed" }, { status: 502 });
  }

  const data = (await res.json()) as { token?: string };
  if (!data.token) {
    return NextResponse.json({ error: "Exchange failed" }, { status: 502 });
  }

  return NextResponse.json({ token: data.token });
}
