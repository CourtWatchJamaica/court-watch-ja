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
          background: "linear-gradient(135deg, #0a0a0a 0%, #1a1a2e 55%, #0d2818 100%)",
          width: "100%",
          height: "100%",
          display: "flex",
          flexDirection: "column",
          alignItems: "flex-start",
          justifyContent: "center",
          padding: "72px 80px",
          fontFamily: "system-ui, sans-serif",
          position: "relative",
          overflow: "hidden",
        }}
      >
        {/* Background glow blobs */}
        <div
          style={{
            position: "absolute",
            top: -120,
            right: -80,
            width: 480,
            height: 480,
            borderRadius: "50%",
            background: "#FED100",
            opacity: 0.06,
            filter: "blur(80px)",
          }}
        />
        <div
          style={{
            position: "absolute",
            bottom: -100,
            left: -60,
            width: 360,
            height: 360,
            borderRadius: "50%",
            background: "#009B3A",
            opacity: 0.1,
            filter: "blur(60px)",
          }}
        />

        {/* Brand row */}
        <div style={{ display: "flex", alignItems: "center", gap: 16, marginBottom: 36 }}>
          <div
            style={{
              width: 60,
              height: 60,
              borderRadius: 14,
              background: "linear-gradient(135deg, #009B3A, #006B3F)",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              fontSize: 32,
              boxShadow: "0 0 24px rgba(0,155,58,0.4)",
            }}
          >
            ⚖️
          </div>
          <span
            style={{
              fontSize: 26,
              fontWeight: 700,
              color: "#FED100",
              letterSpacing: -0.5,
            }}
          >
            CourtWatch JA
          </span>
        </div>

        {/* Headline */}
        <h1
          style={{
            fontSize: 68,
            fontWeight: 800,
            color: "#ffffff",
            letterSpacing: -2,
            lineHeight: 1.05,
            margin: "0 0 20px",
            maxWidth: 880,
          }}
        >
          Jamaican Legal{" "}
          <span style={{ color: "#009B3A" }}>Case Tracker</span>
        </h1>

        {/* Sub-headline */}
        <p
          style={{
            fontSize: 24,
            color: "rgba(255,255,255,0.45)",
            margin: "0 0 52px",
            maxWidth: 720,
            lineHeight: 1.45,
          }}
        >
          Track court judgments, monitor cases, and follow live decisions from Jamaica&apos;s courts.
        </p>

        {/* Court badges */}
        <div style={{ display: "flex", gap: 12 }}>
          {[
            { label: "Supreme Court", color: "#009B3A" },
            { label: "Court of Appeal", color: "#FED100" },
            { label: "Parish Court", color: "#CD7F32" },
          ].map(({ label, color }) => (
            <div
              key={label}
              style={{
                background: `${color}18`,
                border: `1px solid ${color}55`,
                borderRadius: 999,
                padding: "10px 22px",
                color,
                fontSize: 15,
                fontWeight: 600,
              }}
            >
              {label}
            </div>
          ))}
        </div>

        {/* Bottom accent bar */}
        <div
          style={{
            position: "absolute",
            bottom: 0,
            left: 0,
            right: 0,
            height: 5,
            background: "linear-gradient(to right, #009B3A, #FED100, #009B3A)",
          }}
        />
      </div>
    ),
    { ...size },
  );
}
