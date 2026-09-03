'use client';

import React, { useCallback, useMemo } from 'react';
import { ObjectDetailHost } from '@/components/objects/ObjectDetailHost';
import { PostViewClient } from '@/app/(app)/connect/post/[id]/PostViewClient';
import { useDynamicSidebar } from '@/components/ui/DynamicSidebar';
import { useOverlay } from '@/components/ui/OverlayContext';
import type { MomentSource } from '@/lib/connect/moment-engagement';
import type { UnifiedObjectDetailModel } from '@/lib/objects/types';

type Props = {
  momentId: string;
  source: MomentSource;
  onClose?: () => void;
  embedded?: boolean;
  /** Optional preview payload for title chrome */
  preview?: { authorName?: string; authorAvatar?: string; content?: string };
};

function toDetailModel(
  momentId: string,
  source: MomentSource,
  preview?: Props['preview'],
): UnifiedObjectDetailModel {
  return {
    kind: 'moment',
    id: momentId,
    title: preview?.authorName || (source === 'nostr' ? 'Nostr post' : 'Moment'),
    subtitle: preview?.content?.slice(0, 80) || undefined,
    accent: '#F59E0B',
    status: source,
  };
}

/** Moment object detail — mobile fullscreen overlay / desktop right sidebar. */
export function MomentObjectDetail({
  momentId,
  source,
  onClose,
  embedded = false,
  preview,
}: Props) {
  const { closeSidebar } = useDynamicSidebar();
  const { closeOverlay } = useOverlay();

  const item = useMemo(
    () => toDetailModel(momentId, source, preview),
    [momentId, source, preview],
  );

  const handleClose = useCallback(() => {
    onClose?.();
    closeSidebar();
    closeOverlay();
  }, [onClose, closeSidebar, closeOverlay]);

  const routeId = source === 'nostr' ? `nostr_${momentId}` : momentId;

  return (
    <ObjectDetailHost item={item} open onClose={handleClose} embedded={embedded} chrome="panel">
      <PostViewClient id={routeId} onBack={handleClose} preview={preview} />
    </ObjectDetailHost>
  );
}

MomentObjectDetail.displayName = 'MomentObjectDetail';

export function openMomentObjectDetail(opts: {
  momentId: string;
  source: MomentSource;
  preview?: Props['preview'];
  openSidebar?: (content: React.ReactNode, key?: string, options?: { hideHeader?: boolean }) => void;
  openOverlay?: (content: React.ReactNode) => void;
  closeSidebar?: () => void;
  closeOverlay?: () => void;
}) {
  if (typeof window !== 'undefined') {
    window.dispatchEvent(
      new CustomEvent('kylrix:open-moment-detail', {
        detail: {
          momentId: opts.momentId,
          source: opts.source,
          preview: opts.preview,
        },
      }),
    );
  }

  const isDesktop = typeof window !== 'undefined' && window.innerWidth >= 900;
  const node = (
    <MomentObjectDetail
      momentId={opts.momentId}
      source={opts.source}
      embedded
      preview={opts.preview}
      onClose={isDesktop ? (opts.closeSidebar || opts.closeOverlay) : (opts.closeOverlay || opts.closeSidebar)}
    />
  );
  if (isDesktop && opts.openSidebar) {
    opts.openSidebar(node, opts.momentId, { hideHeader: true });
  } else if (opts.openOverlay) {
    opts.openOverlay(node);
  }
}
