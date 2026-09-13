import { ImageResponse } from "next/og";

export const alt = "PrimeStone — Copy the world's best traders, automatically";
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

/** The image that appears when a PrimeStone link is shared or embedded. */
export default function OpengraphImage() {
  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          flexDirection: "column",
          justifyContent: "space-between",
          padding: "72px",
          background:
            "radial-gradient(1000px 600px at 15% -10%, rgba(0,223,164,0.28), transparent 60%), radial-gradient(900px 600px at 100% 110%, rgba(99,102,241,0.26), transparent 55%), #05070c",
          fontFamily: "sans-serif",
        }}
      >
        {/* Brand row */}
        <div style={{ display: "flex", alignItems: "center", gap: 20 }}>
          <div
            style={{
              width: 64,
              height: 64,
              borderRadius: 18,
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              background: "rgba(0,223,164,0.14)",
              border: "1px solid rgba(0,223,164,0.5)",
            }}
          >
            <svg width="40" height="40" viewBox="0 0 32 32" fill="none">
              <path
                d="M8 22 L13 14 L17.5 17 L24 9"
                fill="none"
                stroke="#2ff0bd"
                strokeWidth="3"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
              <circle cx="24" cy="9" r="3" fill="#2ff0bd" />
            </svg>
          </div>
          <div style={{ display: "flex", fontSize: 40, fontWeight: 700, color: "#fff" }}>
            <span>Prime</span>
            <span style={{ color: "#2ff0bd" }}>Stone</span>
          </div>
        </div>

        {/* Headline */}
        <div style={{ display: "flex", flexDirection: "column", gap: 24 }}>
          <div
            style={{
              display: "flex",
              flexWrap: "wrap",
              fontSize: 72,
              fontWeight: 800,
              color: "#fff",
              lineHeight: 1.05,
              letterSpacing: "-0.03em",
              maxWidth: 940,
            }}
          >
            <span>Copy the traders who&nbsp;</span>
            <span style={{ color: "#2ff0bd" }}>actually win.</span>
          </div>
          <div style={{ fontSize: 30, color: "#94a3b8", maxWidth: 860, lineHeight: 1.35 }}>
            Mirror verified, audited strategy providers straight into your account — with
            your own risk limits.
          </div>
        </div>

        {/* Footer row */}
        <div style={{ display: "flex", gap: 40, fontSize: 24, color: "#64748b" }}>
          <span style={{ color: "#00dfa4" }}>● Regulated by the FSC, Mauritius</span>
          <span>Segregated client funds</span>
          <span>M-Pesa · Card · Crypto</span>
        </div>
      </div>
    ),
    { ...size },
  );
}
