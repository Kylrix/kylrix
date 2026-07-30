import { ImageResponse } from 'next/og';
import { getProjectInviteDetailsSecure } from '@/lib/actions/secure-ops';
import { UsersService } from '@/lib/services/users';
import { APPWRITE_CONFIG } from '@/lib/appwrite/config';
import { renderKylrixShareCard } from '@/lib/og/share-card';

export const alt = 'Kylrix Project Workspace';
export const size = { width: 1200, height: 630 };
export const contentType = 'image/png';
export const runtime = 'nodejs';

async function resolveProfileAvatarDataUrl(fileId: string | null | undefined): Promise<string | null> {
  if (!fileId) return null;
  try {
    const { storage } = await import('@/lib/appwrite-admin').then((mod) => mod.createSystemClient());
    const fileBuffer = await storage.getFilePreview(APPWRITE_CONFIG.BUCKETS.PROFILE_PICTURES, fileId, 128, 128);
    return `data:image/png;base64,${Buffer.from(fileBuffer).toString('base64')}`;
  } catch {
    return null;
  }
}

export default async function ProjectOGImage(props: { params: Promise<{ projectId: string }> }) {
  const params = await props.params;
  const projectId = params.projectId;

  let projectTitle = 'Project Workspace';
  let projectDesc = 'Join this secure project workspace on Kylrix.';
  let isPublic = false;
  let ownerName = 'Project Owner';
  let ownerAvatarDataUrl: string | null = null;
  let isPrivateError = false;

  try {
    const details = await getProjectInviteDetailsSecure(projectId).catch(() => {
      isPrivateError = true;
      return null;
    });

    if (details?.project) {
      projectTitle = details.project.title || projectTitle;
      projectDesc = details.project.summary || 'Collaborate, track goals, and share notes securely.';
      isPublic = details.project.visibility === 'public';

      if (details.project.ownerId) {
        try {
          const ownerProfile = await UsersService.getProfileById(details.project.ownerId);
          if (ownerProfile) {
            ownerName = ownerProfile.displayName || ownerProfile.name || ownerProfile.username || ownerName;
            ownerAvatarDataUrl = await resolveProfileAvatarDataUrl(
              ownerProfile.avatar || ownerProfile.profilePicId || null
            );
          }
        } catch {}
      }
    }
  } catch {
    isPrivateError = true;
  }

  // Draw a premium OpenBricks 3.0 workspace card
  return new ImageResponse(
    renderKylrixShareCard({
      productLabel: 'Kylrix Workspaces',
      eyebrow: isPrivateError ? 'Secure workspace invitation' : isPublic ? 'Public workspace' : 'Private workspace',
      title: isPrivateError ? 'Secure Workspace Invitation' : projectTitle,
      description: isPrivateError
        ? 'You have been invited to a private project on Kylrix. Sign in to view and accept access.'
        : projectDesc,
      accent: isPublic ? 'emerald' : 'indigo',
      ownerLabel: 'Created by',
      ownerName,
      ownerAvatarDataUrl,
      chips: [isPublic ? 'Public workspace' : 'Private secure'],
    }),
    size
  );
}
