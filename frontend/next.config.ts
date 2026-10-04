import type { NextConfig } from "next";

// Security headers. CSP starts in report-only mode: Next.js inline scripts and
// the 3D/map components need to be audited (nonces) before enforcing it.
const securityHeaders = [
  {
    key: "Content-Security-Policy-Report-Only",
    value:
      "default-src 'self'; img-src 'self' data: blob: https:; style-src 'self' 'unsafe-inline'; " +
      "script-src 'self' 'unsafe-inline'; connect-src 'self' https:; " +
      "frame-ancestors 'none'; base-uri 'self'; form-action 'self'; object-src 'none'",
  },
  { key: "X-Frame-Options", value: "DENY" },
  { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
  { key: "Permissions-Policy", value: "camera=(), microphone=(), geolocation=()" },
  { key: "Strict-Transport-Security", value: "max-age=31536000; includeSubDomains" },
];

const nextConfig: NextConfig = {
  allowedDevOrigins: ["192.168.8.217"],
  async headers() {
    return [{ source: "/(.*)", headers: securityHeaders }];
  },
};

export default nextConfig;
