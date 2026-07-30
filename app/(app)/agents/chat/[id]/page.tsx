import type { Metadata } from 'next';
import { getPublicAgentConversationSecure } from '@/lib/actions/agentic';
import {
  PublicAgentMessageView,
  PublicAgentUnavailable} from '@/components/agentic/PublicAgentShareViews';
import { buildOgMetadata } from '@/lib/og/share-card';

export const dynamic = 'force-dynamic';

export async function generateMetadata({
  params}: {
  params: Promise<{ id: string }>;
}): Promise<Metadata> {
  const { id } = await params;
  const payload = await getPublicAgentConversationSecure(id).catch(() => null);
  const previewImage = `/agents/chat/${id}/opengraph-image?v=${encodeURIComponent(
    payload?.updatedAt || id
  )}`;

  if (!payload) {
    return buildOgMetadata({
      title: 'Shared reply · Kylrix',
      description: 'This shared message is not available.',
      imageUrl: previewImage});
  }

  const snippet = String(payload.message.content || '')
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, 100);
  const title =
    payload.message.role === 'assistant' ? 'Shared Kylie reply · Kylrix' : 'Shared prompt · Kylrix';

  return buildOgMetadata({
    title,
    description: snippet || 'A shared message from a chat with Kylie.',
    imageUrl: previewImage});
}

export default async function PublicAgentConversationPage({
  params}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const payload = await getPublicAgentConversationSecure(id);

  if (!payload) {
    return <PublicAgentUnavailable kind="message" />;
  }

  return (
    <PublicAgentMessageView message={payload.message} sessionId={payload.sessionId} />
  );
}
