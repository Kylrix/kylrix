'use client';

import React from 'react';
import { Share2, ShieldAlert, Send } from 'lucide-react';
import { useUnifiedDrawer } from '@/context/UnifiedDrawerContext';
import { PublicResourceType } from '@/lib/share/resource-types';
import { useToast } from '@/hooks/useToast';

interface AccessControlMenuItemsProps {
  resourceType: PublicResourceType;
  resourceId: string;
  isPublic: boolean;
  isGuest: boolean;
  resourceTitle?: string;
  kind?: string;
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
  kind,
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
                // Instant toggle via LocalEngine — local optimistic, surpasses direct UI→Appwrite
                const { LocalEngine } = await import('@/lib/services/LocalEngine');
                const cacheKey = `share:${resourceType}:${resourceId}`;
                await LocalEngine.instantWrite(cacheKey, { isPublic: false, isGuest: false }, async (_jwt) => {
                  const { toggleResourcePublicGuest } = await import('@/lib/actions/client-ops');
                  return toggleResourcePublicGuest({ resourceType, resourceId, mode: 'make_private', projectId });
                }).then((res: any) => {
                  if (res?.success !== false) { showSuccess('Sharing stopped.'); onUpdate?.({ isPublic: false, isGuest: false }); }
                });
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
            const { LocalEngine } = await import('@/lib/services/LocalEngine');
            const cacheKey = `share:${resourceType}:${resourceId}`;
            await LocalEngine.instantWrite(cacheKey, { isPublic: true, isGuest: true }, async () => {
              const { toggleResourcePublicGuest } = await import('@/lib/actions/client-ops');
              return toggleResourcePublicGuest({ resourceType, resourceId, mode: 'publish', projectId });
            }).then(async (res: any) => {
              if (res?.success !== false) {
                try { await copyShareUrl(); showSuccess('Published & Link copied'); } catch { showSuccess('Published'); }
                onUpdate?.({ isPublic: true, isGuest: true });
              }
            });
          } catch (err: any) {
            showError('Failed to publish: ' + err.message);
          }
        }
      })
    },
    {
      label: 'Send',
      icon: <Send size={16} className="text-[#F59E0B]" />,
      onClick: () => {
        openUnified('ecosystem-send', {
          resourceType,
          resourceId,
          resourceTitle: resourceTitle || 'Item',
          kind: kind || resourceType,
          isPublic,
          isGuest,
          projectId,
          resolveShareUrl,
          onUpdate,
        });
      },
    },
  ];
}
