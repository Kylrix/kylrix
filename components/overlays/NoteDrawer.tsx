'use client';

import { useUnifiedDrawer } from '@/context/UnifiedDrawerContext';
import { useDynamicSidebar } from '@/components/ui/DynamicSidebar';
import { useOverlay } from '@/components/ui/OverlayContext';
import { useWorkspace } from '@/context/WorkspaceContext';
import { WorkspaceReadOnlyNotice } from '@/components/projects/WorkspaceReadOnlyNotice';
import CreateNoteForm from '@/app/(app)/app/(app)/notes/CreateNoteForm';

/**
 * Unified note create — mirrors TaskDialog exactly:
 * - Desktop (≥768px): mounts directly into the native right sidebar (no Drawer backdrop)
 * - Mobile (<768px):  mounts directly into the overlay stack (no ObjectCreateDrawer / Drawer)
 * Returns null — the shell is provided by DynamicSidebar / OverlayContext.
 */
export function NoteDrawer() {
  const { activeContent, close, drawerData } = useUnifiedDrawer();
  const { openSidebar, closeSidebar } = useDynamicSidebar();
  const { openOverlay, closeOverlay } = useOverlay();
  const { activeWorkspace } = useWorkspace();

  const isWorkspaceReadOnly = Boolean(
    activeWorkspace &&
      !activeWorkspace.isPersonal &&
      activeWorkspace.isShared &&
      activeWorkspace.role !== 'owner' &&
      activeWorkspace.role !== 'editor' &&
      activeWorkspace.role !== 'admin'
  );

  const isOpen = activeContent === 'note';

  const isPublic = Boolean(drawerData?.isPublic);
  const isGuest = Boolean(drawerData?.isGuest);

  const handleClose = useCallback(() => {
    close();
    closeSidebar();
    closeOverlay();
  }, [close, closeSidebar, closeOverlay]);

  useEffect(() => {
    if (!isOpen) return;

    const isDesktop = typeof window !== 'undefined' && window.innerWidth >= 768;

    const composer = isWorkspaceReadOnly ? (
      <div className="h-full min-h-0 flex flex-col justify-center bg-[#161412] p-4">
        <WorkspaceReadOnlyNotice
          objectName="idea"
          onClose={handleClose}
          onSwitchedToPersonal={handleClose}
        />
      </div>
    ) : (
      <CreateNoteForm
        initialContent={{ isPublic, isGuest }}
        onNoteCreated={drawerData?.onCreated}
        isExpanded={true}
        onClose={handleClose}
      />
    );

    if (isDesktop) {
      openSidebar(composer, 'create-note', { hideHeader: true });
    } else {
      openOverlay(composer);
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isOpen, isWorkspaceReadOnly]);

  return null;
}
