import { ImageResponse } from 'next/og';
import { NextRequest } from 'next/server';

export const runtime = "edge";
export const size = {
  width: 1200,
  height: 630,
};
export const contentType = "image/png";

const sectionMetadata: Record<string, { title: string; description: string }> = {
  acceptance: {
    title: "1. Acceptance of Terms",
    description: "Legal consent and agreement required to use Kylrix cloud or self-hosted instances."
  },
  "provided-as-is": {
    title: "2. Provided As-Is Warranty Waiver",
    description: "Kylrix is provided strictly without warranty. Self-hosted instances are operated at your own risk."
  },
  liability: {
    title: "3. Limitation of Liability",
    description: "Limiting direct, indirect, and aggregate damages to fifty dollars ($50) or actual amounts paid."
  },
  "open-source": {
    title: "4. Open Source Licensing",
    description: "Source code auditing, forking, and distributions are governed by open source licenses."
  },
  "cloud-vs-selfhosted": {
    title: "5. Cloud Service & Self-Hosting",
    description: "Differentiation between hosted cloud operations and isolated self-hosted deployments."
  },
  responsibilities: {
    title: "6. User Responsibilities",
    description: "Requirements for credential security, backup management, and lawful usage of the software."
  },
  suspension: {
    title: "7. Account Suspension Policy",
    description: "Conditions for hosted service termination, resource limits, and service modifications."
  },
  disputes: {
    title: "8. Governing Law & Dispute Resolution",
    description: "Legal jurisdiction, venue guidelines, and courts governing terms interpretation."
  },
  changes: {
    title: "9. Changes to Terms",
    description: "Procedure for terms modification updates and continued usage consent."
  }
};

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const sectionId = searchParams.get('section') || '';
  const meta = sectionMetadata[sectionId] || {
    title: "Terms of Service",
    description: "System Integrity, Sovereign Infrastructure Agreement, and Legal Disclaimers."
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
            Terms of Service Clause
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
