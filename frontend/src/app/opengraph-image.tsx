import { ImageResponse } from "next/og";

export const runtime = "edge";
export const alt = "CourtWatch JA — Jamaican Legal Case Tracker";
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

export default function Image() {
  return new ImageResponse(
    (
      <div
        style={{
          background: "#080810",
          width: "100%",
          height: "100%",
          display: "flex",
          flexDirection: "column",
          alignItems: "flex-start",
          justifyContent: "center",
          padding: "72px 80px",
          position: "relative",
        }}
      >
        {/* Brand row */}
        <div
          style={{
            display: "flex",
            alignItems: "center",
            gap: 14,
            marginBottom: 40,
          }}
        >
          <span style={{ fontSize: 30 }}>⚖️</span>
          <span
            style={{
              fontSize: 26,
              fontWeight: 700,
              color: "#ffffff",
              letterSpacing: -0.5,
            }}
          >
            CourtWatch JA
          </span>
        </div>

        {/* Headline */}
        <h1
          style={{
            fontSize: 66,
            fontWeight: 700,
            color: "#ffffff",
            letterSpacing: -1.5,
            lineHeight: 1.1,
            margin: "0 0 24px",
            maxWidth: 900,
          }}
        >
          Track Jamaican court cases as they happen.
        </h1>

        {/* Sub-headline */}
        <p
          style={{
            fontSize: 24,
            color: "rgba(255,255,255,0.55)",
            margin: "0 0 48px",
            maxWidth: 760,
            lineHeight: 1.45,
          }}
        >
          Search judgments, browse court lists, and get notified when your case
          is listed. Free to use.
        </p>

        {/* Courts */}
        <div
          style={{
            display: "flex",
            gap: 10,
            fontSize: 17,
            color: "rgba(255,255,255,0.5)",
          }}
        >
          <span>Supreme Court</span>
          <span>·</span>
          <span>Court of Appeal</span>
          <span>·</span>
          <span>Parish Court</span>
        </div>

        {/* Jamaican flag stripe */}
        <div
          style={{
            position: "absolute",
            bottom: 0,
            left: 0,
            right: 0,
            height: 6,
            display: "flex",
          }}
        >
          <div style={{ flex: 1, background: "#111111" }} />
          <div style={{ flex: 1, background: "#009B3A" }} />
          <div style={{ flex: 1, background: "#FED100" }} />
        </div>
      </div>
    ),
    { ...size },
  );
}
