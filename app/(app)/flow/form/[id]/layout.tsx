import type { Metadata } from "next";
import { FormsServerService } from "@/lib/services/server/forms";

const DEFAULT_DESCRIPTION = "Secure, shareable Kylrix Flow forms.";

function summarizeFields(schema: string | null | undefined): string {
  try {
    const fields = JSON.parse(schema || "[]");
    if (!Array.isArray(fields)) {
      return DEFAULT_DESCRIPTION;
    }

    const labels = fields
      .slice(0, 3)
      .map((field: { label?: string }) => field?.label?.trim())
      .filter(Boolean);

    if (labels.length === 0) {
      return DEFAULT_DESCRIPTION;
    }

    return `Fields: ${labels.join(", ")}`;
  } catch {
    return DEFAULT_DESCRIPTION;
  }
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ id: string }>;
}): Promise<Metadata> {
  const { id } = await params;
  const form = await FormsServerService.getFormPublic(id);

  if (!form) {
    return {
      title: "Form not found | Kylrix Flow",
      description: DEFAULT_DESCRIPTION,
    };
  }

  const description = form.description?.trim() || summarizeFields(form.schema);
  const previewImage = `/form/${id}/opengraph-image?v=${encodeURIComponent(
    form.$updatedAt || id
  )}`;

  return {
    title: `${form.title} | Kylrix Flow`,
    description,
    openGraph: {
      title: form.title,
      description,
      type: "website",
      images: [
        {
          url: previewImage,
          width: 1200,
          height: 630,
          alt: `${form.title} preview`,
        },
      ],
    },
    twitter: {
      card: "summary_large_image",
      title: form.title,
      description,
      images: [previewImage],
    },
  };
}

export default function FormPreviewLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return children;
}
