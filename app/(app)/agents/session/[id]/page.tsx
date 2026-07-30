import type { Metadata } from 'next';
import { getPublicAgentSessionSecure } from '@/lib/actions/agentic';
import {
  PublicAgentSessionView,
  PublicAgentUnavailable,
} from '@/components/agentic/PublicAgentShareViews';

export const dynamic = 'force-dynamic';

export async function generateMetadata({
  params,
}: {
  params: Promise<{ id: string }>;
}): Promise<Metadata> {
  const { id } = await params;
  const session = await getPublicAgentSessionSecure(id);
  const fallbackImage = 'https://kylrix.space/logo_social.png';

  if (!session) {
    return {
      title: 'Shared chat · Kylrix',
      description: 'This shared chat is not available.',
      openGraph: {
        title: 'Shared chat · Kylrix',
        description: 'This shared chat is not available.',
        images: [{ url: fallbackImage, width: 1200, height: 630 }],
      },
    };
  }

  const title = `${session.title} · Shared chat`;
  const description = 'A shared conversation with Kylie on Kylrix.';

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
