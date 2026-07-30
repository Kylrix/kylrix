import { ImageResponse } from 'next/og';
import { FormsServerService } from '@/lib/services/server/forms';
import { renderKylrixShareCard } from '@/lib/og/share-card';

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
    renderKylrixShareCard({
      productLabel: 'Kylrix Flow',
      eyebrow: 'Shared form',
      title,
      description,
      accent: 'emerald',
      chips: labels.length > 0 ? labels : ['Secure response form'],
      ownerName: 'Kylrix Flow',
    }),
    size
  );
}
