import { ImageResponse } from 'next/og';
import { getPublicGoalDataSecure } from '@/lib/actions/secure-ops';
import { renderKylrixShareCard } from '@/lib/og/share-card';

export const runtime = 'nodejs';
export const size = {
  width: 1200,
  height: 630,
};
export const contentType = 'image/png';

export default async function Image({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const goal = await getPublicGoalDataSecure(id);

  const title = goal?.title || 'Shared Goal';
  const description = goal?.description || 'Track deliverables, milestones, and automations.';
  const status = goal?.status || 'todo';
  const priority = goal?.priority || 'medium';

  return new ImageResponse(
    renderKylrixShareCard({
      productLabel: 'Kylrix Flow',
      eyebrow: 'Shared goal',
      title,
      description,
      accent: 'violet',
      chips: [status, `${priority} priority`, `Goal ID ${id.substring(0, 8)}`],
      ownerName: 'Kylrix Flow',
    }),
    {
      ...size,
    }
  );
}
