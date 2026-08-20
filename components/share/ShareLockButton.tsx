'use client';

import React, { useState } from 'react';
import { Share2, Loader2 } from 'lucide-react';
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
 * Ruthless Instant Sharing: One-tap unblocked share button.
 * Immediately copies share link and proactively syncs state in background.
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
  getCustomShareUrl
}: ShareLockButtonProps) {
  const [loading, setLoading] = useState(false);
  const { showSuccess, showError } = useToast();
  const { open } = useUnifiedDrawer();
  const { user } = useAuth();

  const handleToggle = async (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();

    if (loading) return;

    // 1. If not authenticated, prompt contextual login drawer
    if (!user?.$id) {
      const friendlyName = resourceTitle ? `"${resourceTitle}"` : resourceType;
      open('login', {
        title: `Share ${resourceType.charAt(0).toUpperCase() + resourceType.slice(1)}`,
        subtitle: `Create an account or log in to share ${friendlyName} with others.`,
        objectKind: resourceType,
      });
      return;
    }

    // 2. Check hard blockages if any
    if (!canPublish && !isPublic) {
      showError('Cannot share: ' + (blockReason || 'This resource cannot be shared publicly.'));
      return;
    }

    setLoading(true);
    try {
      if (getCustomShareUrl) {
        const customUrl = await getCustomShareUrl();
        await navigator.clipboard.writeText(customUrl).catch(() => {});
        showSuccess('Share link copied');
        onPublished?.({ isPublic: true, isGuest: true, publicUrl: customUrl });
        return;
      }

      // Universal Instant Share: Instant unblocked copy + prioritized sync
      const result = await executeInstantShare(resourceType, resourceId, {
        dek,
        isPublic,
        isGuest,
        resourceTitle,
        projectId,
        openLoginDrawer: (ctx) => open('login', ctx),
        openMasterpassPrompt: () => open('masterpass'),
      });

      if (result.requiresAuth) {
        return;
      }

      if (result.requiresMasterpass) {
        showError('Unlock your vault to copy decrypted link');
        return;
      }

      if (result.copied) {
        showSuccess('Link copied to clipboard');
      } else {
        showSuccess('Share link ready: ' + result.url);
      }

      onPublished?.({
        isPublic: true,
        isGuest: true,
        publicUrl: result.url,
      });
    } catch (err: any) {
      showError('Could not share: ' + (err?.message || 'Try again in a moment.'));
    } finally {
      setLoading(false);
    }
  };

  const isActive = isPublic || isGuest;
  const tip = !canPublish && !isActive
    ? (blockReason || 'Cannot share')
    : isActive
      ? 'Copy public link'
      : 'Share publicly';

  return (
    <IconButton
      onClick={handleToggle}
      disabled={loading}
      title={tip}
      aria-label={tip}
      sx={{
        width: 32,
        height: 32,
        color: isPublic && isGuest 
          ? accentColor 
          : isPublic 
            ? `color-mix(in srgb, ${accentColor} 50%, transparent)` 
            : 'rgba(255, 255, 255, 0.15)',
        transition: 'all 0.3s cubic-bezier(0.16, 1, 0.3, 1)',
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
      {loading ? (
        <Loader2 size={14} className="animate-spin" />
      ) : (
        <Share2 size={14} />
      )}
    </IconButton>
  );
}
