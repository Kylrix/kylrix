'use client';

import React, { useState } from 'react';
import { Share2, Loader2 } from 'lucide-react';
import { toggleResourcePublicGuest } from '@/lib/actions/client-ops';
import { buildPublicResourceUrl } from '@/lib/share/public-url';
import { PublicResourceType } from '@/lib/share/resource-types';
import { useToast } from '@/hooks/useToast';
import { Tooltip, IconButton } from '@/lib/openbricks/primitives';

interface ShareLockButtonProps {
  resourceType: PublicResourceType;
  resourceId: string;
  isPublic: boolean;
  isGuest: boolean;
  accentColor?: string;
  projectId?: string;
  onPublished?: (result: { isPublic: boolean; isGuest: boolean; publicUrl: string }) => void;
  canPublish?: boolean;
  blockReason?: string;
  getCustomShareUrl?: () => Promise<string>;
}

/**
 * Ruthless Sharing: One-tap publish button using a unified share icon.
 */
export function ShareLockButton({
  resourceType,
  resourceId,
  isPublic,
  isGuest,
  accentColor = '#6366F1',
  projectId,
  onPublished,
  canPublish = true,
  blockReason,
  getCustomShareUrl
}: ShareLockButtonProps) {
  const [loading, setLoading] = useState(false);
  const { showSuccess, showError } = useToast();

  const copyPublicUrl = async (url: string) => {
    try {
      await navigator.clipboard.writeText(url);
      return true;
    } catch {
      return false;
    }
  };

  const errorMessage = (err: unknown, fallback: string) =>
    err instanceof Error && err.message ? err.message : fallback;

  const getClipboardUrl = async () => {
    if (getCustomShareUrl) {
      return await getCustomShareUrl();
    }
    return buildPublicResourceUrl(resourceType, resourceId, { projectId });
  };

  const handleToggle = async (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();

    if (loading) return;
    
    // 1. Check blockages (e.g. TOTP or encrypted notes)
    if (!canPublish && !isPublic) {
      showError('Cannot share: ' + (blockReason || 'This resource cannot be shared publicly.'));
      return;
    }

    // 2. If already public, just re-copy link (no accidental unpublish)
    if (isPublic || isGuest) {
      setLoading(true);
      try {
        const publicUrl = await getClipboardUrl();
        const copied = await copyPublicUrl(publicUrl);
        if (copied) {
          showSuccess('Link copied');
        } else {
          showSuccess('Public link ready: ' + publicUrl);
        }
      } catch (err: unknown) {
        showError('Could not copy link: ' + errorMessage(err, 'Try again in a moment.'));
      } finally {
        setLoading(false);
      }
      return;
    }

    // 3. Publish to web — save first, copy second (clipboard must not fail the publish)
    setLoading(true);
    try {
      const res = await toggleResourcePublicGuest({
        resourceType,
        resourceId,
        mode: 'publish',
        projectId
      });
      if (!res?.success) {
        showError('Could not publish: Sharing settings were not saved. Try again.');
        return;
      }

      const publicUrl = await getClipboardUrl();

      onPublished?.({
        isPublic: !!res.isPublic,
        isGuest: !!res.isGuest,
        publicUrl,
      });

      const copied = await copyPublicUrl(publicUrl);
      if (copied) {
        showSuccess('Published & Link copied');
      } else {
        showSuccess('Published: ' + publicUrl);
      }
    } catch (err: unknown) {
      showError('Could not publish: ' + errorMessage(err, 'Sharing settings were not saved.'));
    } finally {
      setLoading(false);
    }
  };

  const isActive = isPublic || isGuest;

  return (
    <Tooltip 
      title={!canPublish && !isActive ? blockReason || 'Cannot share' : isActive ? 'Copy public link' : 'Publish to web'}
      placement="top"
    >
      <IconButton
        onClick={handleToggle}
        disabled={loading}
        sx={{
          width: 32,
          height: 32,
          color: isActive ? accentColor : 'rgba(255, 255, 255, 0.15)',
          transition: 'all 0.3s cubic-bezier(0.16, 1, 0.3, 1)',
          '&:hover': {
            color: isActive ? accentColor : 'white',
            bgcolor: 'rgba(255, 255, 255, 0.05)',
            transform: 'scale(1.1)',
          },
          '&.ob-disabled': {
             color: 'rgba(255, 255, 255, 0.1)',
          }
        }}
      >
        {loading ? (
          <Loader2 size={14} className="animate-spin" />
        ) : (
          <Share2 size={14} />
        )}
      </IconButton>
    </Tooltip>
  );
}
