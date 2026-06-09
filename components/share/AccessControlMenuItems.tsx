'use client';

import React from 'react';
import { 
  Link, 
  ShieldX, 
  ShieldCheck, 
  Lock,
  Users,
  Settings2
} from 'lucide-react';
import { toggleResourcePublicGuest } from '@/lib/actions/client-ops';
import { buildPublicResourceUrl } from '@/lib/share/public-url';
import { PublicResourceType } from '@/lib/share/resource-types';
import { useToast } from '@/hooks/useToast';
import { useUnifiedDrawer } from '@/context/UnifiedDrawerContext';

interface AccessControlMenuItemsProps {
  resourceType: PublicResourceType;
  resourceId: string;
  isPublic: boolean;
  isGuest: boolean;
  resourceTitle?: string;
  projectId?: string;
  onUpdate?: () => void;
}

/**
 * Ruthless Sharing: Context menu items for public resources.
 * Provides granular control over guest access and unpublishing.
 */
export function useAccessControlMenuItems({
  resourceType,
  resourceId,
  isPublic,
  isGuest,
  resourceTitle,
  projectId,
  onUpdate
}: AccessControlMenuItemsProps) {
  const { showSuccess, showError } = useToast();
  const { open: openUnified } = useUnifiedDrawer();

  // Only show Access Control for public/guest resources
  if (!isPublic && !isGuest) return [];

  const handleCopyLink = async () => {
    try {
      const publicUrl = buildPublicResourceUrl(resourceType, resourceId, { projectId });
      await navigator.clipboard.writeText(publicUrl);
      showSuccess('Link copied', 'Anyone with the link can view');
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Try again in a moment.';
      showError('Could not copy link', message);
    }
  };

  const handleToggleGuest = async (enable: boolean) => {
    try {
      const res = await toggleResourcePublicGuest({
        resourceType,
        resourceId,
        mode: enable ? 'guest_on' : 'guest_off',
        projectId
      });
      if (res.success) {
        showSuccess(
          enable ? 'Guest access enabled' : 'Guest access disabled',
          enable ? 'Anyone with the link can view' : 'Only authenticated users can view'
        );
        if (onUpdate) onUpdate();
      }
    } catch (err: any) {
      showError('Failed to update access', err.message);
    }
  };

  const handleMakePrivate = async () => {
    // Open confirmation drawer first
    openUnified('delete-confirm', {
        title: 'Make Private?',
        description: 'This will invalidate all public links. Only you and explicitly invited collaborators will have access.',
        resourceName: resourceTitle || 'this resource',
        confirmLabel: 'Make Private',
        onConfirm: async () => {
            try {
                const res = await toggleResourcePublicGuest({
                    resourceType,
                    resourceId,
                    mode: 'make_private',
                    projectId
                });
                if (res.success) {
                    showSuccess('Resource is now private', 'All public links are invalidated');
                    if (onUpdate) onUpdate();
                }
            } catch (err: any) {
                showError('Failed to make private', err.message);
            }
        }
    });
  };

  return [
    {
      label: 'Access Control',
      icon: <Settings2 size={16} />,
      submenu: [
        {
          label: 'Copy public link',
          icon: <Link size={16} />,
          onClick: handleCopyLink
        },
        isGuest ? {
          label: 'Disable guest access',
          icon: <ShieldX size={16} />,
          onClick: () => handleToggleGuest(false)
        } : {
          label: 'Enable guest access',
          icon: <ShieldCheck size={16} />,
          onClick: () => handleToggleGuest(true)
        },
        {
          label: 'Manage collaborators',
          icon: <Users size={16} />,
          onClick: () => openUnified('share-note', { 
            noteId: resourceId, 
            resourceType, 
            noteTitle: resourceTitle,
            onUpdate 
          })
        },
        {
          label: 'Make private',
          icon: <Lock size={16} />,
          variant: 'destructive',
          onClick: handleMakePrivate
        }
      ]
    }
  ];
}
