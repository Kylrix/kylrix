import { ImageResponse } from 'next/og';
import { NextRequest } from 'next/server';

export const runtime = "edge";
export const size = {
  width: 1200,
  height: 630,
};
export const contentType = "image/png";

const sectionMetadata: Record<string, { title: string; description: string }> = {
  scope: {
    title: "1. Scope: Cloud vs Self-Hosted",
    description: "Overview of data boundaries on hosted cloud environments compared to isolated self-hosted deployments."
  },
  collection: {
    title: "2. What We Collect (Hosted Cloud)",
    description: "Account credentials, stored notes, diagnostic crash logs, and anonymized user tokens."
  },
  use: {
    title: "3. How We Use Data",
    description: "Authentication sync, database recovery procedures, and secure backend routing logistics."
  },
  diagnostics: {
    title: "4. Diagnostics & Stability Metrics",
    description: "System stability monitoring, error tracking, and optional smart context recording settings."
  },
  security: {
    title: "5. Security & Encryption",
    description: "Encryption implementations, secure transit protocols, and client-side password responsibilities."
  },
  "third-party": {
    title: "6. Third-Party Services & Infrastructure",
    description: "Subprocessors, payment gateways, messaging relays, and push notification transport layers."
  },
  retention: {
    title: "7. Retention, Export & Deletion",
    description: "Irreversible document purging, backup scheduling, and public data portability utilities."
  },
  choices: {
    title: "8. Your Choices & Rights",
    description: "Data access queries, correction tools, deletion request paths, and regional options."
  },
  warranty: {
    title: "9. No Warranty; Limitation of Liability",
    description: "Warranties disclaimer regarding privacy outcomes, and liability cap references."
  },
  updates: {
    title: "10. Children & Policy Updates",
    description: "Age restrictions (13+), changes notification schedule, and re-affirmation terms."
  }
};

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const sectionId = searchParams.get('section') || '';
  const meta = sectionMetadata[sectionId] || {
    title: "Privacy Policy",
    description: "Details regarding user data, diagnostics telemetry, and cloud boundaries."
  };

  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          flexDirection: "column",
          justifyContent: "space-between",
          padding: "56px",
          background: "linear-gradient(135deg, #0A0908 0%, #161412 55%, #1C1A18 100%)",
          color: "#F5F3EF",
          fontFamily: "Arial, Helvetica, sans-serif",
          position: "relative",
        }}
      >
        <div
          style={{
            position: "absolute",
            inset: "24px",
            border: "1px solid rgba(255,255,255,0.06)",
            borderRadius: "36px",
          }}
        />

        <div
          style={{
            display: "flex",
            alignItems: "center",
            gap: "14px",
            zIndex: 1,
          }}
        >
          <div
            style={{
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              width: "48px",
              height: "48px",
              position: "relative",
            }}
          >
            <svg width="48" height="48" viewBox="0 0 100 100" fill="none">
              <line x1="15" y1="30" x2="50" y2="10" stroke="#6366F1" strokeWidth="6" strokeLinecap="round" />
              <line x1="50" y1="10" x2="85" y2="30" stroke="#10B981" strokeWidth="6" strokeLinecap="round" />
              <line x1="15" y1="30" x2="50" y2="90" stroke="#EC4899" strokeWidth="6" strokeLinecap="round" />
              <line x1="85" y1="30" x2="50" y2="90" stroke="#A855F7" strokeWidth="6" strokeLinecap="round" />
            </svg>
          </div>
          <span
            style={{
              fontSize: "20px",
              fontWeight: 800,
              color: "#fff",
              letterSpacing: "0.15em",
            }}
          >
            KYLRIX LEGAL
          </span>
        </div>

        <div
          style={{
            display: "flex",
            flexDirection: "column",
            gap: "18px",
            zIndex: 1,
            marginBottom: "20px",
          }}
        >
          <span
            style={{
              fontSize: "13px",
              fontWeight: 900,
              color: "#6366F1",
              textTransform: "uppercase",
              letterSpacing: "0.2em",
            }}
          >
            Privacy Policy Clause
          </span>
          <span
            style={{
              fontSize: "38px",
              fontWeight: 900,
              color: "#fff",
              letterSpacing: "-0.02em",
              lineHeight: 1.1,
            }}
          >
            {meta.title}
          </span>
          <span
            style={{
              fontSize: "18px",
              color: "rgba(255,255,255,0.6)",
              lineHeight: 1.5,
              maxWidth: "800px",
            }}
          >
            {meta.description}
          </span>
        </div>

        <div
          style={{
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
            zIndex: 1,
          }}
        >
          <span
            style={{
              fontSize: "12px",
              color: "rgba(255,255,255,0.3)",
              fontWeight: 600,
              letterSpacing: "0.05em",
            }}
          >
            By using Kylrix (cloud or self-hosted) you agree to these terms.
          </span>
          <span
            style={{
              fontSize: "12px",
              color: "#6366F1",
              fontWeight: 700,
            }}
          >
            kylrix.space
          </span>
        </div>
      </div>
    ),
    {
      width: 1200,
      height: 630,
    }
  );
}
