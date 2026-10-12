import { ImageResponse } from 'next/og';
import { getPublicAgentSessionSecure } from '@/lib/actions/agentic';
import { renderKylrixShareCard } from '@/lib/og/share-card';
import { resolveOwnerForOg } from '@/lib/og/resolve-avatar';

export const runtime = 'nodejs';
export const revalidate = 86400;
export const size = { width: 1200, height: 630 };
export const contentType = 'image/png';
export const alt = 'Shared Kylie chat';

export default async function Image({
  params}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const session = await getPublicAgentSessionSecure(id).catch(() => null);
  const owner = await resolveOwnerForOg(session?.userId);

  let firstMedia: string | null = null;
  if (Array.isArray(session?.messages)) {
    for (const msg of session.messages) {
      const match = /!\[.*?\]\((https?:\/\/[^\s\)]+)\)/i.exec(String(msg?.content || ''));
      if (match && match[1]) {
        try {
          const res = await fetch(match[1]);
          if (res.ok) {
            const ct = res.headers.get('content-type') || 'image/png';
            firstMedia = `data:${ct};base64,${Buffer.from(await res.arrayBuffer()).toString('base64')}`;
            break;
          }
        } catch {}
      }
    }
  }

  return new ImageResponse(
    renderKylrixShareCard({
      productLabel: 'Kylrix Agents',
      eyebrow: 'Shared chat',
      title: session?.title || 'Chat with Kylie',
      description: 'A shared conversation on Kylrix.',
      accent: 'violet',
      ownerName: owner.ownerName,
      ownerAvatarDataUrl: owner.ownerAvatarDataUrl,
      chips: [
        'Agent',
        session?.messages?.length ? `${session.messages.length} msgs` : 'Public',
      ],
      cardType: 'object',
      objectIcon: 'agent',
      objectColor: '#818CF8',
      mediaDataUrl: firstMedia,
    }),
    size
  );
}
