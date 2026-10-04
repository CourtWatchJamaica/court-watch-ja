import { NextRequest, NextResponse } from "next/server";
import {
  BACKEND_URL,
  SESSION_COOKIE,
  clearSessionCookie,
  roleFromJwt,
  setSessionCookie,
} from "@/lib/session-server";

export const dynamic = "force-dynamic";

// Same-origin gateway to the Rust backend. It attaches the session cookie as
// a Bearer token, so the browser never handles the JWT. Responses that carry
// a new token (login, verify-email, credential changes) have it moved into the
// httpOnly cookie and stripped from the body.

const TOKEN_ISSUING = new Set([
  "auth/login",
  "auth/verify-email",
  "auth/confirm-password-change",
  "user/profile",
]);

const FORWARD_RESPONSE_HEADERS = [
  "content-type",
  "content-disposition",
  "retry-after",
  "cache-control",
];

async function handle(
  req: NextRequest,
  ctx: { params: Promise<{ path: string[] }> },
) {
  const { path } = await ctx.params;
  const joined = path.join("/");

  // CSRF defence in depth (cookie is also SameSite=Lax): reject cross-origin
  // state-changing requests.
  if (!["GET", "HEAD", "OPTIONS"].includes(req.method)) {
    const origin = req.headers.get("origin");
    if (!origin || origin !== req.nextUrl.origin) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }
  }

  const token = req.cookies.get(SESSION_COOKIE)?.value;
  const headers = new Headers();
  const ct = req.headers.get("content-type");
  if (ct) headers.set("content-type", ct);
  headers.set("accept", req.headers.get("accept") ?? "application/json");
  // Never trust a client-supplied Authorization header.
  if (token) headers.set("authorization", `Bearer ${token}`);

  // The backend rate-limits per client IP; tell it the real one (vs. this
  // server's IP). It only honours this when PROXY_SECRET matches.
  const proxySecret = process.env.PROXY_SECRET;
  if (proxySecret) {
    const ip =
      req.headers.get("x-vercel-forwarded-for") ??
      req.headers.get("cf-connecting-ip") ??
      req.headers.get("x-forwarded-for")?.split(",")[0]?.trim();
    if (ip) {
      headers.set("x-client-ip", ip);
      headers.set("x-proxy-secret", proxySecret);
    }
  }

  const hasBody = !["GET", "HEAD"].includes(req.method);
  let upstream: Response;
  try {
    upstream = await fetch(
      `${BACKEND_URL}/${joined}${req.nextUrl.search}`,
      {
        method: req.method,
        headers,
        body: hasBody ? await req.arrayBuffer() : undefined,
        cache: "no-store",
        redirect: "manual",
      },
    );
  } catch {
    return NextResponse.json({ error: "Backend unavailable" }, { status: 502 });
  }

  const out = new Headers();
  for (const h of FORWARD_RESPONSE_HEADERS) {
    const v = upstream.headers.get(h);
    if (v) out.set(h, v);
  }

  // Token-issuing endpoints: capture the JWT into the cookie.
  if (TOKEN_ISSUING.has(joined) && upstream.ok) {
    const data = await upstream.json().catch(() => null);
    if (data && typeof data.token === "string") {
      const { token: newToken, ...rest } = data;
      const res = NextResponse.json({
        ...rest,
        session: true,
        role: roleFromJwt(newToken),
      });
      setSessionCookie(res, newToken);
      return res;
    }
    return NextResponse.json(data, { status: upstream.status });
  }

  const res = new NextResponse(upstream.body, {
    status: upstream.status,
    headers: out,
  });
  if (upstream.status === 401 && token) clearSessionCookie(res);
  return res;
}

export {
  handle as GET,
  handle as POST,
  handle as PUT,
  handle as PATCH,
  handle as DELETE,
};
