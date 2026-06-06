'use client';

import { useState, useEffect } from 'react';
import { Box, Typography, alpha } from '@/lib/mui-tailwind/material';
import { CheckCircle as CheckCircleIcon } from '@/lib/mui-tailwind/icons';
import { UserPresenceState } from '@/lib/services/presence';
import { storage } from '@/lib/appwrite/client';

const RING_COLORS = ['#6366F1', '#34D399', '#D8B4FE', '#FBBF24', '#F472B6'];
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

// Thread-safe in-memory cache for user profiles fetched from the server SDK
const profileCache = new Map<string, any>();

export function IdentityAvatar({
  src,
  alt,
  fallback,
  verified,
  pro,
  size = 40,
  verifiedSize = 16,
  borderRadius = '50%',
  isPreview = false,
  status,
  sx,
  fileId,
  isAvatar = true,
  // Added properties for privileged fetching and granular fallback matching
  userId,
  isPublic,
  isGuest,
  displayName,
  username,
  accountName,
  email,
}: {
  src?: string | null;
  alt?: string;
  fallback?: string;
  verified?: boolean;
  pro?: boolean;
  size?: number;
  verifiedSize?: number;
  borderRadius?: string | number;
  isPreview?: boolean;
  status?: UserPresenceState;
  sx?: any;
  fileId?: string | null;
  isAvatar?: boolean;
  userId?: string | null;
  isPublic?: boolean | null;
  isGuest?: boolean | null;
  displayName?: string | null;
  username?: string | null;
  accountName?: string | null;
  email?: string | null;
}) {
  const [profileRecord, setProfileRecord] = useState<any>(null);
  const [resolvedSrc, setResolvedSrc] = useState<string | null>(src || null);
  const [imageError, setImageError] = useState(false);

  // 1. Fetch the user's profile status row securely using Server Action if userId is provided
  useEffect(() => {
    if (!userId) return;

    if (profileCache.has(userId)) {
      setProfileRecord(profileCache.get(userId));
      return;
    }

    let active = true;
    const fetchProfile = async () => {
      try {
        const { getGlobalProfileStatusSecure } = await import('@/lib/actions/secure-ops');
        const res = await getGlobalProfileStatusSecure(userId);
        if (res?.exists && res.profile) {
          if (active) {
            profileCache.set(userId, res.profile);
            setProfileRecord(res.profile);
          }
        } else {
          if (active) {
            profileCache.set(userId, null);
            setProfileRecord(null);
          }
        }
      } catch (err) {
        console.warn('[IdentityAvatar] Failed to fetch secure profile row:', err);
        if (active) {
          profileCache.set(userId, null);
          setProfileRecord(null);
        }
      }
    };

    fetchProfile();
    return () => { active = false; };
  }, [userId]);

  // 2. Resolve visibilities dynamically using the fetched profile row
  const resolvedIsAvatar = profileRecord ? profileRecord.isAvatar : isAvatar;
  const resolvedIsPublic = profileRecord ? profileRecord.isPublic : isPublic;
  const resolvedIsGuest = profileRecord ? profileRecord.isGuest : isGuest;

  // Conditions for fetching the profile picture: isAvatar is null or true,
  // AND either isPublic or isGuest is null or true.
  const isAvatarSatisfied = resolvedIsAvatar === null || resolvedIsAvatar === undefined || resolvedIsAvatar === true;
  const isPublicOrGuestSatisfied = resolvedIsPublic === null || resolvedIsPublic === undefined || resolvedIsPublic === true ||
                                    resolvedIsGuest === null || resolvedIsGuest === undefined || resolvedIsGuest === true;
  
  const canFetchAvatar = isAvatarSatisfied && isPublicOrGuestSatisfied;

  // 3. Retrieve the secure profile picture preview URL asynchronously
  useEffect(() => {
    if (src) {
      setResolvedSrc(src);
      setImageError(false);
      return;
    }

    const targetFileId = profileRecord?.avatar || fileId;
    if (!targetFileId) {
      setResolvedSrc(null);
      return;
    }

    if (!canFetchAvatar) {
      setResolvedSrc(null);
      return;
    }

    let active = true;
    const loadPreview = async () => {
      try {
        const { fetchProfilePreview } = await import('@/lib/profile-preview');
        const url = await fetchProfilePreview(targetFileId, size * 2, size * 2);
        if (active) {
          setResolvedSrc(url);
          setImageError(false);
        }
      } catch (err) {
        console.warn('[IdentityAvatar] Failed to generate privileged file preview:', err);
        if (active) {
          setResolvedSrc(null);
        }
      }
    };

    loadPreview();
    return () => { active = false; };
  }, [profileRecord?.avatar, fileId, src, canFetchAvatar, size]);

  // 4. Compute initials using the exact requested priority:
  // (1) Display Name -> (2) Username -> (3) Account Name -> (4) Email -> fallback -> alt -> 'U'
  const resolvedDisplayName = profileRecord?.displayName || displayName || null;
  const resolvedUsername = profileRecord?.username || username || null;
  const resolvedAccountName = accountName || null;
  const resolvedEmail = email || null;

  let initial = 'U';
  if (resolvedDisplayName && resolvedDisplayName.trim()) {
    initial = resolvedDisplayName.trim().charAt(0).toUpperCase();
  } else if (resolvedUsername && resolvedUsername.trim()) {
    initial = resolvedUsername.trim().replace(/^@/, '').charAt(0).toUpperCase();
  } else if (resolvedAccountName && resolvedAccountName.trim()) {
    initial = resolvedAccountName.trim().charAt(0).toUpperCase();
  } else if (resolvedEmail && resolvedEmail.trim()) {
    initial = resolvedEmail.trim().charAt(0).toUpperCase();
  } else if (fallback) {
    initial = fallback.charAt(0).toUpperCase();
  } else if (alt) {
    initial = alt.charAt(0).toUpperCase();
  }

  const getStatusColor = (s: UserPresenceState) => {
      switch (s) {
          case 'online': return '#10B981';
          case 'away': return '#F59E0B';
          case 'busy': return '#EC4899';
          default: return 'transparent';
      }
  };

  const avatar = (
    <Box
      sx={{
        width: size,
        height: size,
        borderRadius,
        position: 'relative',
        display: 'grid',
        placeItems: 'center',
        ...(isPreview
          ? {
              border: '2px dotted rgba(99, 102, 241, 0.5)',
              backgroundColor: 'rgba(99, 102, 241, 0.05)',
              padding: '2px',
            }
          : pro
          ? {
              padding: '2px',
              backgroundImage: RING_GRADIENT,
              boxShadow: '0 0 0 1px rgba(255,255,255,0.04), 0 0 18px rgba(99,102,241,0.18)',
            }
          : {
              padding: '0px',
            }),
        ...(sx || {}),
      }}
    >
      {resolvedSrc && !imageError ? (
        <Box
          component="img"
          src={resolvedSrc}
          alt={alt || ''}
          onError={() => setImageError(true)}
          sx={{
            width: '100%',
            height: '100%',
            borderRadius: `calc(${typeof borderRadius === 'number' ? `${borderRadius}px` : borderRadius} - 2px)`,
            objectFit: 'cover',
            display: 'block',
          }}
        />
      ) : (
        <Box
          sx={{
            width: '100%',
            height: '100%',
            borderRadius: `calc(${typeof borderRadius === 'number' ? `${borderRadius}px` : borderRadius} - 2px)`,
            bgcolor: alpha('#6366F1', 0.12),
            color: '#6366F1',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            fontWeight: 900,
            fontSize: `${Math.max(11, size / 3)}px`,
          }}
        >
          {initial}
        </Box>
      )}
      {status && status !== 'offline' && (
          <Box 
              sx={{
                  position: 'absolute',
                  right: -1,
                  bottom: -1,
                  width: Math.max(10, size / 4),
                  height: Math.max(10, size / 4),
                  borderRadius: '50%',
                  bgcolor: getStatusColor(status),
                  border: '2px solid #161412',
                  zIndex: 3
              }}
          />
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

  if (!pro) return avatar;

  return avatar;
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
