import { ImageResponse } from 'next/og';
import { getPublicAgentConversationSecure } from '@/lib/actions/agentic';
import { renderKylrixShareCard } from '@/lib/og/share-card';
import { resolveOwnerForOg } from '@/lib/og/resolve-avatar';

export const runtime = 'nodejs';
export const revalidate = 86400;
export const size = { width: 1200, height: 630 };
export const contentType = 'image/png';
export const alt = 'Shared Kylie message';

export default async function Image({
  params}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const payload = await getPublicAgentConversationSecure(id).catch(() => null);
  const owner = await resolveOwnerForOg(payload?.userId);
  const isAssistant = payload?.message?.role === 'assistant';
  const snippet = String(payload?.message?.content || '')
    .replace(/\s+/g, ' ')
    .trim();

  let firstMedia: string | null = null;
  const match = /!\[.*?\]\((https?:\/\/[^\s\)]+)\)/i.exec(String(payload?.message?.content || ''));
  if (match && match[1]) {
    try {
      const res = await fetch(match[1]);
      if (res.ok) {
        const ct = res.headers.get('content-type') || 'image/png';
        firstMedia = `data:${ct};base64,${Buffer.from(await res.arrayBuffer()).toString('base64')}`;
      }
    } catch {}
  }

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
      cardType: 'object',
      objectIcon: 'agent',
      objectColor: '#818CF8',
      mediaDataUrl: firstMedia,
    }),
    size
  );
}
