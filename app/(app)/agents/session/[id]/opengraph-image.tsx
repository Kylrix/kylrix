import { ImageResponse } from 'next/og';
import { getPublicAgentSessionSecure } from '@/lib/actions/agentic';
import { renderKylrixShareCard } from '@/lib/og/share-card';
import { resolveOwnerForOg } from '@/lib/og/resolve-avatar';

export const runtime = 'nodejs';
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
      ]}),
    size
  );
}
