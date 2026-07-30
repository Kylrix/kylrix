import type { Metadata } from 'next';
import { getPublicGoalDataSecure } from '@/lib/actions/secure-ops';
import { buildOgMetadata } from '@/lib/og/share-card';

export async function generateMetadata({
  params,
}: {
  params: Promise<{ id: string }>;
}): Promise<Metadata> {
  const { id } = await params;
  try {
    const goal = await getPublicGoalDataSecure(id);

    if (!goal) {
      return {
        title: 'Goal Not Found | Kylrix Flow',
        description: 'This goal is private or does not exist.',
      };
    }

    const title = `${goal.title} | Shared Goal`;
    const description = goal.description || `Status: ${goal.status} · Priority: ${goal.priority}`;
    const previewImage = `/flow/goal/${id}/opengraph-image?v=${encodeURIComponent(
      goal.updatedAt || id
    )}`;

    return buildOgMetadata({ title, description, imageUrl: previewImage });
  } catch (e) {
    return {
      title: 'Shared Goal | Kylrix Flow',
      description: 'Collaborate on tasks, milestones, and high-velocity goals.',
    };
  }
}

export default function GoalPreviewLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return <>{children}</>;
}
