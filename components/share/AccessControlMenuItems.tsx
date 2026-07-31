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
  /** When set (e.g. vault/locked objects), clipboard uses DEK-in-URI share links. */
  resolveShareUrl?: () => Promise<string>;
  onUpdate?: (updatedFields?: { isPublic: boolean; isGuest: boolean }) => void;
}

export function useAccessControlMenuItems({
  resourceType,
  resourceId,
  isPublic,
  isGuest,
  resourceTitle,
  projectId,
  resolveShareUrl,
  onUpdate
}: AccessControlMenuItemsProps) {
  const { open: openUnified } = useUnifiedDrawer();
  const { showSuccess, showError } = useToast();

  const isActive = isPublic || isGuest;

  const copyShareUrl = async () => {
    if (resolveShareUrl) {
      const url = await resolveShareUrl();
      await navigator.clipboard.writeText(url);
      return;
    }
    const { buildPublicResourceUrl } = await import('@/lib/share/public-url');
    const publicUrl = buildPublicResourceUrl(resourceType, resourceId, { projectId });
    await navigator.clipboard.writeText(publicUrl);
  };

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
                  mode: 'make_private',
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
            label: 'Copy Public Link',
            icon: <Share2 size={16} className="text-emerald-500" />,
            onClick: async () => {
              try {
                await copyShareUrl();
                showSuccess('Link copied');
              } catch (err: any) {
                showError('Failed to copy link: ' + err.message);
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
              try {
                await copyShareUrl();
                showSuccess('Published & Link copied');
              } catch {
                showSuccess('Published');
              }
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
