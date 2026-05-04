import { ImageResponse } from "next/og";
import { FormsServerService } from "@/lib/services/server/forms";

export const runtime = "edge";
export const size = {
  width: 1200,
  height: 630,
};
export const contentType = "image/png";

function getFieldLabels(schema: string | null | undefined): string[] {
  try {
    const fields = JSON.parse(schema || "[]");
    if (!Array.isArray(fields)) {
      return [];
    }

    return fields
      .slice(0, 3)
      .map((field: { label?: string }) => field?.label?.trim())
      .filter((label): label is string => Boolean(label));
  } catch {
    return [];
  }
}

function getPreviewDescription(
  description: string | null | undefined,
  labels: string[]
): string {
  if (description?.trim()) {
    return description.trim();
  }

  if (labels.length > 0) {
    return `Fields: ${labels.join(", ")}`;
  }

  return "Secure, shareable Kylrix Flow forms.";
}

export default async function Image({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const form = await FormsServerService.getFormPublic(id);

  const title = form?.title?.trim() || "Kylrix Flow";
  const labels = getFieldLabels(form?.schema);
  const description = getPreviewDescription(form?.description, labels);

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
          background:
            "linear-gradient(135deg, #0A0908 0%, #161412 55%, #1C1A18 100%)",
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
              width: "18px",
              height: "18px",
              borderRadius: "999px",
              background: "#6366F1",
              boxShadow: "0 0 24px rgba(99, 102, 241, 0.45)",
            }}
          />
          <div
            style={{
              fontSize: "26px",
              fontWeight: 700,
              letterSpacing: "0.08em",
              textTransform: "uppercase",
              color: "rgba(245, 243, 239, 0.72)",
            }}
          >
            Kylrix Flow
          </div>
        </div>

        <div
          style={{
            display: "flex",
            flexDirection: "column",
            gap: "22px",
            zIndex: 1,
            maxWidth: "980px",
          }}
        >
          <div
            style={{
              display: "inline-flex",
              alignItems: "center",
              width: "fit-content",
              padding: "10px 18px",
              borderRadius: "999px",
              background: "rgba(99, 102, 241, 0.12)",
              border: "1px solid rgba(99, 102, 241, 0.25)",
              color: "#A5B4FC",
              fontSize: "22px",
              fontWeight: 700,
            }}
          >
            Shared Form
          </div>

          <div
            style={{
              fontSize: "72px",
              lineHeight: 1.02,
              fontWeight: 800,
              letterSpacing: "-0.05em",
            }}
          >
            {title}
          </div>

          <div
            style={{
              fontSize: "28px",
              lineHeight: 1.35,
              color: "rgba(245, 243, 239, 0.78)",
              maxWidth: "880px",
            }}
          >
            {description}
          </div>
        </div>

        <div
          style={{
            display: "flex",
            gap: "14px",
            flexWrap: "wrap",
            zIndex: 1,
          }}
        >
          {labels.length > 0 ? (
            labels.map((label) => (
              <div
                key={label}
                style={{
                  padding: "12px 18px",
                  borderRadius: "999px",
                  background: "rgba(255,255,255,0.04)",
                  border: "1px solid rgba(255,255,255,0.08)",
                  color: "#F5F3EF",
                  fontSize: "22px",
                  fontWeight: 600,
                }}
              >
                {label}
              </div>
            ))
          ) : (
            <div
              style={{
                padding: "12px 18px",
                borderRadius: "999px",
                background: "rgba(255,255,255,0.04)",
                border: "1px solid rgba(255,255,255,0.08)",
                color: "#F5F3EF",
                fontSize: "22px",
                fontWeight: 600,
              }}
            >
              Secure response form
            </div>
          )}
        </div>
      </div>
    ),
    size
  );
}
