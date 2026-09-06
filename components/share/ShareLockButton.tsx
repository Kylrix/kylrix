'use client';

import React, { useState } from 'react';
import { Share2 } from 'lucide-react';
import { PublicResourceType } from '@/lib/share/resource-types';
import { useToast } from '@/hooks/useToast';
import { IconButton } from '@/lib/openbricks/primitives';
import { executeInstantShare } from '@/lib/share/instant-share';
import { useUnifiedDrawer } from '@/context/UnifiedDrawerContext';
import { useAuth } from '@/context/auth/AuthContext';

interface ShareLockButtonProps {
  resourceType: PublicResourceType;
  resourceId: string;
  isPublic: boolean;
  isGuest: boolean;
  accentColor?: string;
  projectId?: string;
  resourceTitle?: string;
  dek?: string | null;
  onPublished?: (result: { isPublic: boolean; isGuest: boolean; publicUrl: string }) => void;
  canPublish?: boolean;
  blockReason?: string;
  getCustomShareUrl?: () => Promise<string>;
}

/**
 * One-tap share: awaits remote isPublic+isGuest confirm before updating UI.
 */
export function ShareLockButton({
  resourceType,
  resourceId,
  isPublic,
  isGuest,
  accentColor = '#6366F1',
  projectId,
  resourceTitle,
  dek,
  onPublished,
  canPublish = true,
  blockReason,
  getCustomShareUrl: _getCustomShareUrl
}: ShareLockButtonProps) {
  const { showError } = useToast();
  const { open } = useUnifiedDrawer();
  const { user } = useAuth();
  const [busy, setBusy] = useState(false);

  const handleToggle = async (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (busy) return;

    if (!user?.$id) {
      const friendlyName = resourceTitle ? `"${resourceTitle}"` : resourceType;
      open('login', {
        title: `Share ${resourceType.charAt(0).toUpperCase() + resourceType.slice(1)}`,
        subtitle: `Create an account or log in to share ${friendlyName} with others.`,
        objectKind: resourceType,
      });
      return;
    }

    if (!canPublish && !isPublic) {
      showError('Cannot share: ' + (blockReason || 'This resource cannot be shared publicly.'));
      return;
    }

    setBusy(true);
    try {
      const res = await executeInstantShare(resourceType, resourceId, {
        dek,
        isPublic,
        isGuest,
        resourceTitle,
        projectId,
      });

      if (!res.success || !res.published) {
        showError(res.error || 'Sharing did not save. Try again.');
        return;
      }

      onPublished?.({
        isPublic: true,
        isGuest: true,
        publicUrl: res.url || '',
      });

      open('share-context', {
        resourceType,
        resourceId,
        resourceTitle,
        isPublic: true,
        isGuest: true,
        dek,
        projectId,
        accentColor,
      });
    } catch (err: any) {
      showError(err?.message || 'Sharing did not save. Try again.');
    } finally {
      setBusy(false);
    }
  };

  const isActive = isPublic || isGuest;
  const tip = busy
    ? 'Confirming share…'
    : !canPublish && !isActive
      ? (blockReason || 'Cannot share')
      : isActive
        ? 'Copy public link'
        : 'Share publicly';

  return (
    <IconButton
      onClick={handleToggle}
      title={tip}
      aria-label={tip}
      disabled={busy}
      sx={{
        width: 32,
        height: 32,
        color: isPublic && isGuest 
          ? accentColor 
          : isPublic 
            ? `color-mix(in srgb, ${accentColor} 50%, transparent)` 
            : 'rgba(255, 255, 255, 0.15)',
        transition: 'all 0.3s cubic-bezier(0.16, 1, 0.3, 1)',
        opacity: busy ? 0.5 : 1,
        '&:hover': {
          color: isPublic && isGuest 
            ? accentColor 
            : isPublic 
              ? `color-mix(in srgb, ${accentColor} 70%, transparent)` 
              : 'white',
          bgcolor: 'rgba(255, 255, 255, 0.05)',
          transform: 'scale(1.1)'},
        '&.ob-disabled': {
           color: 'rgba(255, 255, 255, 0.1)'}
      }}
    >
      <Share2 size={14} />
    </IconButton>
  );
}
