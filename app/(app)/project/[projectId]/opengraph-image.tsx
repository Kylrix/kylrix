import { ImageResponse } from 'next/og';
import { getProjectInviteDetailsSecure } from '@/lib/actions/secure-ops';
import { UsersService } from '@/lib/services/users';

export const alt = 'Kylrix Project Workspace';
export const size = { width: 1200, height: 630 };
export const contentType = 'image/png';
export const runtime = 'nodejs';

export default async function ProjectOGImage(props: { params: Promise<{ projectId: string }> }) {
  const params = await props.params;
  const projectId = params.projectId;

  let projectTitle = 'Project Workspace';
  let projectDesc = 'Join this secure project workspace on Kylrix.';
  let isPublic = false;
  let ownerName = 'Project Owner';
  let ownerAvatar: string | null = null;
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
            ownerAvatar = ownerProfile.avatar || ownerProfile.profilePicId || null;
          }
        } catch {}
      }
    }
  } catch {
    isPrivateError = true;
  }

  // Draw a premium OpenBricks 3.0 workspace card
  return new ImageResponse(
    (
      <div
        style={{
          width: '100%',
          height: '100%',
          display: 'flex',
          flexDirection: 'column',
          justifyContent: 'space-between',
          padding: '60px 70px',
          background: '#0A0908',
          boxSizing: 'border-box',
          fontFamily: 'system-ui, -apple-system, sans-serif',
          position: 'relative',
          overflow: 'hidden',
        }}
      >
        {/* Glow ambient background spotlight */}
        <div
          style={{
            position: 'absolute',
            top: -150,
            right: -150,
            width: 500,
            height: 500,
            borderRadius: '50%',
            background: 'radial-gradient(circle, rgba(99, 102, 241, 0.12) 0%, transparent 70%)',
            pointerEvents: 'none',
          }}
        />

        {/* Brand Command Line Indicator */}
        <div
          style={{
            position: 'absolute',
            left: 0,
            top: 0,
            right: 0,
            height: 6,
            background: 'linear-gradient(90deg, #6366F1 0%, #818CF8 50%, #4F46E5 100%)',
          }}
        />

        {/* Top Header Row */}
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            width: '100%',
          }}
        >
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: 12,
            }}
          >
            {/* Minimalist Grid Logo */}
            <div
              style={{
                width: 32,
                height: 32,
                borderRadius: 8,
                background: '#161412',
                border: '1px solid rgba(99, 102, 241, 0.25)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
              }}
            >
              <div style={{ width: 14, height: 14, background: '#6366F1', borderRadius: 3 }} />
            </div>
            <span
              style={{
                fontSize: 20,
                fontWeight: 900,
                color: '#fff',
                letterSpacing: '-0.02em',
              }}
            >
              KYLRIX
            </span>
          </div>

          {/* Visibility pill */}
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              padding: '6px 14px',
              borderRadius: 30,
              background: isPublic ? 'rgba(16, 185, 129, 0.1)' : 'rgba(245, 158, 11, 0.1)',
              border: `1px solid ${isPublic ? 'rgba(16, 185, 129, 0.2)' : 'rgba(245, 158, 11, 0.2)'}`,
            }}
          >
            <span
              style={{
                fontSize: 14,
                fontWeight: 800,
                color: isPublic ? '#10B981' : '#F59E0B',
                textTransform: 'uppercase',
                letterSpacing: '0.06em',
              }}
            >
              {isPublic ? 'Public Workspace' : 'Private Secure'}
            </span>
          </div>
        </div>

        {/* Main Details Body */}
        <div
          style={{
            display: 'flex',
            flexDirection: 'column',
            gap: 16,
            marginTop: 40,
            marginBottom: 40,
            maxWidth: '90%',
          }}
        >
          <h1
            style={{
              fontSize: 54,
              fontWeight: 900,
              color: '#FFFFFF',
              margin: 0,
              padding: 0,
              letterSpacing: '-0.03em',
              lineHeight: 1.15,
            }}
          >
            {isPrivateError ? 'Secure Workspace Invitation' : projectTitle}
          </h1>

          <p
            style={{
              fontSize: 22,
              fontWeight: 500,
              color: 'rgba(255, 255, 255, 0.5)',
              margin: 0,
              padding: 0,
              lineHeight: 1.5,
              display: '-webkit-box',
              overflow: 'hidden',
            }}
          >
            {isPrivateError ? 'You have been invited to a private project on Kylrix. Sign in to view and accept access.' : projectDesc}
          </p>
        </div>

        {/* Footer Meta Row */}
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            width: '100%',
            paddingTop: 30,
            borderTop: '1px solid rgba(255, 255, 255, 0.05)',
          }}
        >
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: 12,
            }}
          >
            {/* Avatar or Placeholder */}
            <div
              style={{
                width: 44,
                height: 44,
                borderRadius: '50%',
                background: '#161412',
                border: '1px solid rgba(255,255,255,0.08)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                color: '#818CF8',
                fontSize: 18,
                fontWeight: 900,
              }}
            >
              {ownerName.replace(/^@/, '').slice(0, 1).toUpperCase()}
            </div>
            <div
              style={{
                display: 'flex',
                flexDirection: 'column',
              }}
            >
              <span style={{ fontSize: 13, fontWeight: 800, color: 'rgba(255, 255, 255, 0.4)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                Created By
              </span>
              <span style={{ fontSize: 16, fontWeight: 700, color: '#fff' }}>
                {ownerName}
              </span>
            </div>
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
            <span style={{ fontSize: 15, fontWeight: 800, color: '#818CF8', letterSpacing: '0.05em' }}>
              kylrix.space
            </span>
          </div>
        </div>
      </div>
    ),
    size
  );
}
