'use client';

import React from 'react';
import { Share2, ShieldAlert } from 'lucide-react';
import { useUnifiedDrawer } from '@/context/UnifiedDrawerContext';
import { PublicResourceType } from '@/lib/share/resource-types';
import { toggleResourcePublicGuest } from '@/lib/actions/client-ops';
import { useToast } from '@/hooks/useToast';

interface AccessControlMenuItemsProps {
  resourceType: PublicResourceType;
  resourceId: string;
  isPublic: boolean;
  isGuest: boolean;
  resourceTitle?: string;
  projectId?: string;
  onUpdate?: () => void;
}

export function useAccessControlMenuItems({
  resourceType,
  resourceId,
  isPublic,
  isGuest,
  resourceTitle,
  projectId,
  onUpdate
}: AccessControlMenuItemsProps) {
  const { open: openUnified } = useUnifiedDrawer();
  const { showSuccess, showError } = useToast();

  const isActive = isPublic || isGuest;

  return [
    {
      label: isActive ? 'Stop Sharing' : 'Share',
      icon: isActive ? <ShieldAlert size={16} className="text-red-500" /> : <Share2 size={16} />,
      onClick: async () => {
        if (!isActive) {
          try {
            const res = await toggleResourcePublicGuest({
              resourceType,
              resourceId,
              mode: 'publish',
              projectId
            });
            if (res.success) {
              showSuccess('Published & Link copied');
              try {
                const { buildPublicResourceUrl } = await import('@/lib/share/public-url');
                const publicUrl = buildPublicResourceUrl(resourceType, resourceId, { projectId });
                await navigator.clipboard.writeText(publicUrl);
              } catch {}
              onUpdate?.();
            }
          } catch (err: any) {
            showError('Failed to publish: ' + err.message);
          }
        } else {
          openUnified('access-control', {
            resourceType,
            resourceId,
            isPublic,
            isGuest,
            resourceTitle: resourceTitle || 'Item',
            projectId,
            onUpdate
          });
        }
      }
    }
  ];
}
