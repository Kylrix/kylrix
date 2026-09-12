import { ImageResponse } from 'next/og';
import { FormsServerService } from '@/lib/services/server/forms';
import { renderKylrixShareCard } from '@/lib/og/share-card';

export const runtime = 'nodejs';
export const size = { width: 1200, height: 630 };
export const contentType = 'image/png';

export default async function FormOGImage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const form = await FormsServerService.getFormPublic(id).catch(() => null);

  let title = 'Kylrix Form';
  let description = 'Secure, shareable Kylrix Flow form.';
  let fieldCount = 0;

  if (form) {
    title = form.title || 'Untitled Form';
    if (form.description?.trim()) {
      description = form.description.trim();
    }
    try {
      const fields = JSON.parse(form.schema || '[]');
      if (Array.isArray(fields)) {
        fieldCount = fields.length;
        if (!form.description?.trim() && fields.length > 0) {
          const labels = fields
            .slice(0, 3)
            .map((f: { label?: string }) => f?.label?.trim())
            .filter(Boolean);
          if (labels.length > 0) {
            description = `Fields: ${labels.join(', ')}`;
          }
        }
      }
    } catch {}
  }

  const chips = fieldCount > 0 ? [`${fieldCount} Field${fieldCount > 1 ? 's' : ''}`, 'Interactive'] : ['Interactive'];

  return new ImageResponse(
    renderKylrixShareCard({
      productLabel: 'Kylrix Form',
      eyebrow: 'Shared Form',
      title,
      description,
      accent: 'emerald',
      ownerName: 'Kylrix Flow',
      chips,
    }),
    { ...size }
  );
}
