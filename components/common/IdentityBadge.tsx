'use client';

import { Box, Typography, alpha } from '@mui/material';
import CheckCircleIcon from '@mui/icons-material/CheckCircle';

const RING_COLORS = ['#6366F1', '#EC4899', '#10B981', '#A855F7', '#F59E0B'];
const RING_GRADIENT = `conic-gradient(from 180deg, ${RING_COLORS.join(', ')}, #6366F1)`;
const THIRTY_DAYS = 30 * 24 * 60 * 60 * 1000;

export interface IdentitySignals {
  createdAt?: string | null;
  lastUsernameEdit?: string | null;
  profilePicId?: string | null;
  username?: string | null;
  bio?: string | null;
  tier?: string | null;
  publicKey?: string | null;
  emailVerified?: boolean | null;
}

export function computeIdentityFlags(signals: IdentitySignals) {
  const createdAt = signals.createdAt ? new Date(signals.createdAt).getTime() : NaN;
  const lastUsernameEdit = signals.lastUsernameEdit ? new Date(signals.lastUsernameEdit).getTime() : NaN;
  const hasAge = Number.isFinite(createdAt) ? Date.now() - createdAt >= THIRTY_DAYS : false;
  const hasStableUsername = !Number.isFinite(lastUsernameEdit) || Date.now() - lastUsernameEdit >= THIRTY_DAYS;
  const hasCoreProfile = Boolean(signals.username?.trim() && signals.bio?.trim() && signals.profilePicId);
  const verified = hasAge && hasStableUsername && hasCoreProfile;
  const pro = String(signals.tier || '').toUpperCase() === 'PRO';
  return { verified, pro };
}

import { useCachedProfilePreview } from '@/hooks/useCachedProfilePreview';
import { generatePattern } from '@/utils/patternGenerator';

export function IdentityAvatar({
  src,
  fileId,
  alt,
  fallback,
  verified,
  pro,
  size = 40,
  verifiedSize = 16,
  borderRadius = '50%',
  seed,
}: {
  src?: string | null;
  fileId?: string | null;
  alt?: string;
  fallback?: string;
  verified?: boolean;
  pro?: boolean;
  size?: number;
  verifiedSize?: number;
  borderRadius?: string | number;
  seed?: string;
}) {
  const previewUrl = useCachedProfilePreview(fileId || src, size, size);

  return (
    <Box
      sx={{
        width: size,
        height: size,
        borderRadius,
        position: 'relative',
        display: 'grid',
        placeItems: 'center',
        ...(pro
          ? {
              padding: '2px',
              background: RING_GRADIENT,
              boxShadow: '0 0 0 1px rgba(255,255,255,0.04), 0 0 18px rgba(99,102,241,0.18)',
            }
          : {
              padding: '0px',
            }),
      }}
    >
      <Box
        component="img"
        src={previewUrl || undefined}
        alt={alt || ''}
        sx={{
          width: '100%',
          height: '100%',
          borderRadius: `calc(${typeof borderRadius === 'number' ? `${borderRadius}px` : borderRadius} - 2px)`,
          objectFit: 'cover',
          display: previewUrl ? 'block' : 'none',
        }}
      />
      {!previewUrl && (
        <Box
          sx={{
            width: '100%',
            height: '100%',
            borderRadius: `calc(${typeof borderRadius === 'number' ? `${borderRadius}px` : borderRadius} - 2px)`,
            background: generatePattern(seed || fallback || alt || 'default'),
            color: '#fff',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            fontWeight: 900,
            fontSize: `${Math.max(11, size / 3)}px`,
            textShadow: '0 2px 4px rgba(0,0,0,0.2)',
          }}
        >
          {fallback || alt?.charAt(0).toUpperCase() || 'U'}
        </Box>
      )}
      {verified && (
        <Box
          sx={{
            position: 'absolute',
            right: -2,
            bottom: -2,
            width: verifiedSize,
            height: verifiedSize,
            borderRadius: '50%',
            bgcolor: '#0A0908',
            display: 'grid',
            placeItems: 'center',
            boxShadow: '0 0 0 2px rgba(10,9,8,1)',
          }}
        >
          <CheckCircleIcon sx={{ fontSize: verifiedSize, color: '#6366F1' }} />
        </Box>
      )}
    </Box>
  );
}

export function IdentityName({
  children,
  verified,
  sx,
}: {
  children: React.ReactNode;
  verified?: boolean;
  sx?: Record<string, unknown>;
}) {
  return (
    <Box sx={{ display: 'inline-flex', alignItems: 'center', gap: 0.75, ...(sx || {}) }}>
      <Typography component="span" sx={{ lineHeight: 1 }}>
        {children}
      </Typography>
      {verified && <CheckCircleIcon sx={{ fontSize: 16, color: '#6366F1', flexShrink: 0 }} />}
    </Box>
  );
}
