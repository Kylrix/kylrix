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
  const session = await getPublicAgentSessionSecure(id).catch(() => null);
  // Relative — lets Next inject the hashed opengraph-image-* URL (absolute
  // `/opengraph-image` is stolen by app/[alias]/[[...slug]] on this host).
  const previewImage = `/agents/session/${id}/opengraph-image?v=${encodeURIComponent(
    session?.updatedAt || id
  )}`;

  if (!session) {
    return buildOgMetadata({
      title: 'Shared chat · Kylrix',
      description: 'This shared chat is not available.',
      imageUrl: previewImage,
    });
  }

  return buildOgMetadata({
    title: `${session.title} · Shared chat`,
    description: 'A shared conversation with Kylie on Kylrix.',
    imageUrl: previewImage,
  });
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
