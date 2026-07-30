import type { Metadata } from 'next';
import { getPublicAgentConversationSecure } from '@/lib/actions/agentic';
import {
  PublicAgentMessageView,
  PublicAgentUnavailable,
} from '@/components/agentic/PublicAgentShareViews';

export const dynamic = 'force-dynamic';

export async function generateMetadata({
  params,
}: {
  params: Promise<{ id: string }>;
}): Promise<Metadata> {
  const { id } = await params;
  const payload = await getPublicAgentConversationSecure(id);
  const fallbackImage = 'https://kylrix.space/logo_social.png';

  if (!payload) {
    return {
      title: 'Shared reply · Kylrix',
      description: 'This shared message is not available.',
      openGraph: {
        title: 'Shared reply · Kylrix',
        description: 'This shared message is not available.',
        images: [{ url: fallbackImage, width: 1200, height: 630 }],
      },
    };
  }

  const snippet = String(payload.message.content || '')
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, 120);
  const title =
    payload.message.role === 'assistant' ? 'Shared Kylie reply · Kylrix' : 'Shared prompt · Kylrix';
  const description = snippet || 'A shared message from a chat with Kylie.';

  return {
    title,
    description,
    openGraph: {
      title,
      description,
      images: [{ url: fallbackImage, width: 1200, height: 630 }],
    },
    twitter: {
      card: 'summary_large_image',
      title,
      description,
      images: [fallbackImage],
    },
  };
}

export default async function PublicAgentConversationPage({
  params,
}: {
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
