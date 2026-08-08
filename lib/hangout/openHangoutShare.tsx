import { HangoutSharePanel } from '@/components/hangout/HangoutSharePanel';
import type { PublicResourceType } from '@/lib/share/resource-types';

export function openHangoutShare(opts: {
  id: string;
  title: string;
  kind: string;
  resourceType: PublicResourceType;
  isPublic?: boolean;
  isGuest?: boolean;
  openSidebar: (content: React.ReactNode, key?: string, options?: { hideHeader?: boolean }) => void;
  openOverlay: (content: React.ReactNode) => void;
  closeSidebar: () => void;
  closeOverlay: () => void;
}) {
  const isDesktop = typeof window !== 'undefined' && window.innerWidth >= 900;
  const node = (
    <HangoutSharePanel
      object={{
        id: opts.id,
        title: opts.title,
        kind: opts.kind,
        resourceType: opts.resourceType,
        isPublic: opts.isPublic,
        isGuest: opts.isGuest,
      }}
      onClose={isDesktop ? opts.closeSidebar : opts.closeOverlay}
    />
  );
  const key = `hangout-share-${opts.resourceType}-${opts.id}`;
  if (isDesktop) opts.openSidebar(node, key, { hideHeader: true });
  else opts.openOverlay(node);
}
