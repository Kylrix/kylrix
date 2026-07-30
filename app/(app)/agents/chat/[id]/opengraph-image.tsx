import { ImageResponse } from 'next/og';
import { getPublicAgentConversationSecure } from '@/lib/actions/agentic';
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
  const payload = await getPublicAgentConversationSecure(id).catch(() => null);

  return new ImageResponse(
    renderKylrixShareCard({
      productLabel: 'Kylrix Agents',
      eyebrow: payload?.message?.role === 'assistant' ? 'Shared Kylie reply' : 'Shared prompt',
      title: payload?.message?.role === 'assistant' ? 'Kylie response' : 'Builder prompt',
      description:
        String(payload?.message?.content || 'A shared message from a chat with Kylie.')
          .replace(/\s+/g, ' ')
          .trim() || 'A shared message from a chat with Kylie.',
      accent: 'violet',
      ownerName: 'Kylie',
      chips: ['Agent share', payload?.message?.role === 'assistant' ? 'Assistant reply' : 'User prompt'],
    }),
    size
  );
}
