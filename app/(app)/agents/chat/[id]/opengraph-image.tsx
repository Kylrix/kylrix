import { ImageResponse } from 'next/og';
import { getPublicAgentConversationSecure } from '@/lib/actions/agentic';
import { renderKylrixShareCard } from '@/lib/og/share-card';
import { resolveOwnerForOg } from '@/lib/og/resolve-avatar';

export const runtime = 'nodejs';
export const size = { width: 1200, height: 630 };
export const contentType = 'image/png';
export const alt = 'Shared Kylie message';

export default async function Image({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const payload = await getPublicAgentConversationSecure(id).catch(() => null);
  const owner = await resolveOwnerForOg(payload?.userId);
  const isAssistant = payload?.message?.role === 'assistant';
  const snippet = String(payload?.message?.content || '')
    .replace(/\s+/g, ' ')
    .trim();

  return new ImageResponse(
    renderKylrixShareCard({
      productLabel: 'Kylrix Agents',
      eyebrow: isAssistant ? 'Kylie reply' : 'Prompt',
      title: isAssistant ? 'Kylie response' : 'Builder prompt',
      description: snippet || 'A shared message from a chat with Kylie.',
      accent: 'violet',
      ownerName: owner.ownerName,
      ownerAvatarDataUrl: owner.ownerAvatarDataUrl,
      chips: ['Agent', isAssistant ? 'Reply' : 'Prompt'],
    }),
    size
  );
}
