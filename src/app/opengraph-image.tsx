import { ImageResponse } from "next/og";
import { SITE_NAME } from "@/lib/seo";

export const runtime = "edge";
export const alt = "The Park — Trading Card Game";
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

export default function OgImage() {
  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          flexDirection: "column",
          justifyContent: "space-between",
          background: "linear-gradient(145deg, #1E2424 0%, #2a3232 45%, #1E2424 100%)",
          padding: "64px",
          fontFamily: "system-ui, sans-serif",
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: 16 }}>
          <div
            style={{
              width: 56,
              height: 56,
              borderRadius: 12,
              background: "#D6004F",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              color: "#FBF4F6",
              fontSize: 28,
              fontWeight: 900,
            }}
          >
            P
          </div>
          <span style={{ color: "#FBF4F6", fontSize: 28, fontWeight: 700, letterSpacing: 2 }}>駐車場</span>
        </div>

        <div>
          <div
            style={{
              fontSize: 72,
              fontWeight: 900,
              color: "#FBF4F6",
              lineHeight: 1,
              textTransform: "uppercase",
              letterSpacing: -1,
            }}
          >
            {SITE_NAME}
          </div>
          <div style={{ marginTop: 20, fontSize: 30, color: "#E8B23A", fontWeight: 700 }}>
            Trading Card Game · Drift / JDM
          </div>
          <div style={{ marginTop: 16, fontSize: 22, color: "#c8b8bc", maxWidth: 720, lineHeight: 1.4 }}>
            Collection, marketplace communautaire & boutique officielle
          </div>
        </div>

        <div style={{ display: "flex", gap: 12 }}>
          {["Collection", "Marketplace", "Boutique"].map((label) => (
            <div
              key={label}
              style={{
                padding: "10px 18px",
                borderRadius: 8,
                border: "2px solid #D6004F",
                color: "#FBF4F6",
                fontSize: 16,
                fontWeight: 700,
              }}
            >
              {label}
            </div>
          ))}
        </div>
      </div>
    ),
    { ...size },
  );
}
