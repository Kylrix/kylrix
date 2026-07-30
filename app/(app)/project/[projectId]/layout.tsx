import { Metadata } from 'next';
import { getProjectInviteDetailsSecure } from '@/lib/actions/secure-ops';
import { buildOgMetadata } from '@/lib/og/share-card';

export async function generateMetadata(
  props: { params: Promise<{ projectId: string }> }
): Promise<Metadata> {
  const params = await props.params;
  const projectId = params.projectId;

  try {
    // We fetch details using secure API logic. Since this is loaded by external link scrapers,
    // we fetch with no JWT. If it is private, it will return an auth exception which we catch cleanly.
    const details = await getProjectInviteDetailsSecure(projectId).catch(() => null);

    if (!details || !details.project) {
      return {
        title: 'Project Invitation | Kylrix',
        description: 'You have been invited to collaborate on a secure workspace. Sign in to view and accept access.',
      };
    }

    const { title, summary, visibility } = details.project;
    const isPublic = visibility === 'public';
    const desc = summary || `Collaborate on the project workspace "${title}" on Kylrix.`;

    return buildOgMetadata({
      title: `${title} | Project Invitation`,
      description: desc,
      imageUrl: `/project/${projectId}/opengraph-image`,
    });
  } catch (e) {
    return {
      title: 'Project Workspace | Kylrix',
      description: 'Collaborate on secure workspaces, goals, and shared notes on Kylrix.',
    };
  }
}

export default function ProjectInviteLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return <>{children}</>;
}
