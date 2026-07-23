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
  onUpdate?: (updatedFields?: { isPublic: boolean; isGuest: boolean }) => void;
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
      ...(isActive ? {
        submenu: [
          {
            label: 'Confirm Stop Sharing',
            icon: <ShieldAlert size={16} className="text-red-500" />,
            variant: 'destructive' as const,
            onClick: async () => {
              try {
                const res = await toggleResourcePublicGuest({
                  resourceType,
                  resourceId,
                  mode: 'private',
                  projectId
                });
                if (res.success) {
                  showSuccess('Sharing stopped.');
                  onUpdate?.({ isPublic: false, isGuest: false });
                }
              } catch (err: any) {
                showError('Failed to stop sharing: ' + err.message);
              }
            }
          },
          {
            label: 'Access Settings',
            icon: <Share2 size={16} />,
            onClick: () => {
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
        ]
      } : {
        onClick: async () => {
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
              onUpdate?.({ isPublic: true, isGuest: true });
            }
          } catch (err: any) {
            showError('Failed to publish: ' + err.message);
          }
        }
      })
    }
  ];
}
