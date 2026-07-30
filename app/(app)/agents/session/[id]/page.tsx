import type { Metadata } from 'next';
import { getPublicAgentSessionSecure } from '@/lib/actions/agentic';
import {
  PublicAgentSessionView,
  PublicAgentUnavailable,
} from '@/components/agentic/PublicAgentShareViews';
import { buildOgMetadata } from '@/lib/og/share-card';

export const dynamic = 'force-dynamic';

export async function generateMetadata({
  params,
}: {
  params: Promise<{ id: string }>;
}): Promise<Metadata> {
  const { id } = await params;
  const session = await getPublicAgentSessionSecure(id);
  const previewImage = `https://kylrix.space/agents/session/${id}/opengraph-image`;

  if (!session) {
    return buildOgMetadata({
      title: 'Shared chat · Kylrix',
      description: 'This shared chat is not available.',
      imageUrl: previewImage,
    });
  }

  const title = `${session.title} · Shared chat`;
  const description = 'A shared conversation with Kylie on Kylrix.';

  return buildOgMetadata({ title, description, imageUrl: previewImage });
}

export default async function PublicAgentSessionPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const session = await getPublicAgentSessionSecure(id);

  if (!session) {
    return <PublicAgentUnavailable kind="session" />;
  }

  return (
    <PublicAgentSessionView
      title={session.title}
      messages={session.messages}
      updatedAt={session.updatedAt}
    />
  );
}
