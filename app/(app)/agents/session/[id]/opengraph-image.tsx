import { ImageResponse } from 'next/og';
import { getPublicAgentSessionSecure } from '@/lib/actions/agentic';
import { renderKylrixShareCard } from '@/lib/og/share-card';

export const runtime = 'nodejs';
export const size = { width: 1200, height: 630 };
export const contentType = 'image/png';

export default async function Image({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const session = await getPublicAgentSessionSecure(id).catch(() => null);

  return new ImageResponse(
    renderKylrixShareCard({
      productLabel: 'Kylrix Agents',
      eyebrow: 'Shared chat',
      title: session?.title || 'Shared chat with Kylie',
      description: 'A shared conversation with Kylie on Kylrix.',
      accent: 'violet',
      ownerName: 'Kylie',
      chips: ['Agent share', session?.messages?.length ? `${session.messages.length} messages` : 'Public transcript'],
    }),
    size
  );
}
