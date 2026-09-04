"use client";

import * as React from 'react';
import { 
  Pin as PinIcon, 
  Trash2 as TrashIcon,
  Share2 as ShareIcon,
  Lock as PrivateIcon,
  PlusSquare as TodoIcon,
  Unlock,
  Sparkles,
  CheckSquare
} from 'lucide-react';

import { useContextMenu } from './ContextMenuContext';
import { useDynamicSidebar } from '@/components/ui/DynamicSidebar';
import { useOverlay } from '@/components/ui/OverlayContext';
import { useNotes } from '@/context/NotesContext';
import type { Notes } from '@/types/appwrite';
import { useSelection } from '@/context/SelectionContext';
import { useUnifiedDrawer } from '@/context/UnifiedDrawerContext';
import { useSection } from '@/context/SectionContext';
import { ShareLockButton } from '../share/ShareLockButton';
import { useAccessControlMenuItems } from '../share/AccessControlMenuItems';
import { SidekickDrawer } from '@/components/agentic/SidekickDrawer';

import { resolveNoteCardTitle, isEncryptedCiphertext } from '@/constants/noteTitle';
import { createTaskFromNote, getNotePublicState, lockNote, unlockNote } from '@/lib/appwrite';
import { updateNote, deleteNote as deleteNoteAction } from '@/lib/actions/client-ops';
import { useToast } from './Toast';
import { useSudo } from '@/context/SudoContext';
import { useProUpgrade } from '@/context/ProUpgradeContext';
import { useAuth } from '@/context/auth/AuthContext';
import { hasPaidKylrixPlan } from '@/lib/utils';
import { generateAIAction } from '@/lib/ai-actions';
import { ObjectCard } from '@/components/objects/ObjectCard';
import { ObjectCardMeta } from '@/components/objects/ObjectCardMeta';
import { noteToCard } from '@/lib/objects/adapters';
import { sidebarIgnoreProps } from '@/constants/sidebar';
import { APPWRITE_CONFIG } from '@/lib/appwrite/config';

interface NoteCardProps {
  note: Notes;
  onUpdate?: (updatedNote: Notes) => void;
  onDelete?: (noteId: string) => void;
  onNoteSelect?: (note: Notes) => void;
}

const NoteCard: React.FC<NoteCardProps> = React.memo(({ note, onUpdate, onDelete, onNoteSelect }) => {
  const [mounted, setMounted] = React.useState(false);
  const [isAIProcessing, setIsAIProcessing] = React.useState(false);
  const [showSidekick, setShowSidekick] = React.useState(false);

  const { enterSelectMode } = useSelection();
  const contextMenu = useContextMenu();
  const openMenu = contextMenu?.openMenu;
  const { isPinned, pinNote, unpinNote, upsertNote, notes: contextNotes, removeNote } = useNotes();
  const liveNote = React.useMemo(
    () => contextNotes?.find((candidate) => candidate.$id === note.$id) || note,
    [contextNotes, note],
  );
  const { user } = useAuth();
  const { setActiveDetail } = useSection();
  const { openSidebar, closeSidebar } = useDynamicSidebar();
  const { openOverlay, closeOverlay } = useOverlay();
  
  // Decouple from frequent state changes in UnifiedDrawerContext
  const unifiedDrawer = useUnifiedDrawer();
  const openShare = React.useCallback(() => unifiedDrawer.open('share-note', { noteId: note.$id, noteTitle: note.title }), [unifiedDrawer, note.$id, note.title]);
  const openDelete = React.useCallback(() => unifiedDrawer.open('delete-confirm', { 
    title: `Move "${note.title || 'Untitled'}" to Trash?`,
    resourceName: 'this idea',
    confirmLabel: 'Move to Trash',
    onConfirm: async () => {
      // 1. Instant local removal — barred from showing up immediately
      removeNote(note.$id);
      if (onDelete) {
        onDelete(note.$id);
      }

      // 2. Immediate LocalEngine cache purge for ideas + instant addition to trash cache
      try {
        const uid = user?.$id || 'guest';
        const { LocalEngine } = await import('@/lib/services/LocalEngine');
        const cached = await LocalEngine.cacheGet<{ rows: any[] }>(`f_ideas_${uid}`);
        if (cached?.rows) {
          const updated = cached.rows.filter((r: any) => r.$id !== note.$id);
          await LocalEngine.cacheSet(`f_ideas_${uid}`, { rows: updated, total: updated.length });
        }

        // Add to local trash cache immediately so /trash reflects it with 0ms delay
        const trashCacheKey = `trash_all_${uid}`;
        const existingTrash = (await LocalEngine.cacheGet<any[]>(trashCacheKey)) || [];
        const { APPWRITE_CONFIG } = await import('@/lib/appwrite/config');
        const newTrashItem = {
          id: note.$id,
          title: note.title || 'Untitled Note',
          type: 'Note',
          deletedAt: new Date().toISOString(),
          databaseId: APPWRITE_CONFIG.DATABASES.NOTE,
          tableId: APPWRITE_CONFIG.TABLES.NOTE.NOTES,
          projectId: (note as any).projectId || undefined,
          isWorkspace: Boolean((note as any).isWorkspace || (note as any).projectId),
        };
        const updatedTrash = [newTrashItem, ...existingTrash.filter((t: any) => t.id !== note.$id)];
        await LocalEngine.cacheSet(trashCacheKey, updatedTrash);
        if (typeof window !== 'undefined') {
          window.dispatchEvent(new CustomEvent('kylrix:trash-updated', { detail: { item: newTrashItem } }));
        }
      } catch {}

      // 3. High-priority remote trash synchronization
      try {
        await deleteNoteAction(note.$id);
      } catch (err) {
        console.warn('[NoteCard] Remote trash sync failed:', err);
      }
    },
  }), [unifiedDrawer, note.title, note.$id, onDelete, removeNote, user?.$id]);

  const resolveNoteShareUrl = React.useCallback(async () => {
    if (note.dek) {
      const { getNoteShareUrlWithDek } = await import('@/lib/appwrite/goal-crypto');
      return getNoteShareUrlWithDek(note.$id, note.dek);
    }
    const { getCurrentPublicNoteShareUrl } = await import('@/lib/appwrite');
    const url = await getCurrentPublicNoteShareUrl(note.$id, note);
    if (url) return url;
    const { buildPublicResourceUrl } = await import('@/lib/share/public-url');
    return buildPublicResourceUrl('note', note.$id);
  }, [note]);
  
  const { promptSudo } = useSudo();
  const { openProUpgrade } = useProUpgrade();
  const { showSuccess, showError, showInfo } = useToast();

  React.useEffect(() => setMounted(true), []);

  const isPro = hasPaidKylrixPlan(user);
  const noteMeta = React.useMemo(() => {
    try {
      return JSON.parse(liveNote.metadata || note.metadata || '{}');
    } catch {
      return {};
    }
  }, [liveNote.metadata, note.metadata]);
  const isLocked = !!(liveNote.dek || note.dek || noteMeta?.dek) && !noteMeta?.clientDecrypted;
  const isEncryptedNote =
    (isLocked ||
      (noteMeta?.encryptionVersion === 'T4' && (!!noteMeta?.isEncrypted || noteMeta?.isEncrypted === 'true')) ||
      noteMeta?.isEncrypted === true ||
      noteMeta?.isEncrypted === 'true' ||
      liveNote.title === '🔒 Encrypted Note' ||
      note.title === '🔒 Encrypted Note' ||
      isEncryptedCiphertext(liveNote.content) ||
      isEncryptedCiphertext(liveNote.title)) &&
    !noteMeta?.clientDecrypted;
  const pinned = isPinned(note.$id);

  // Extract first image URL from note content, attachments, or object blocks
  const previewImageUrl = React.useMemo(() => {
    if (isEncryptedNote || !liveNote.content) return null;
    const content = liveNote.content;

    // 1. Check markdown image format: ![alt](url)
    const mdMatch = content.match(/!\[.*?\]\((.*?)\)/);
    if (mdMatch && mdMatch[1]) return mdMatch[1];

    // 2. Check HTML img tag src
    const htmlMatch = content.match(/<img\s+[^>]*src=["']([^"']+)["']/i);
    if (htmlMatch && htmlMatch[1]) return htmlMatch[1];

    // 3. Check kylrix-object JSON blocks
    const OBJECT_BLOCK_REGEX = /\[\[kylrix-object:(\{.*?\})\]\]/g;
    let objMatch;
    while ((objMatch = OBJECT_BLOCK_REGEX.exec(content)) !== null) {
      try {
        const payload = JSON.parse(objMatch[1]);
        if (payload.childKind === 'image' || payload.type === 'image') {
          const url = payload.metadata?.fileUrl || payload.src || payload.url;
          if (url) return url;
          if (payload.childId && payload.bucketId) {
            return `${APPWRITE_CONFIG.ENDPOINT}/storage/buckets/${payload.bucketId}/files/${payload.childId}/view?project=${APPWRITE_CONFIG.PROJECT_ID}`;
          }
        }
      } catch {}
    }

    // 4. Check attachments array for image mimeType or extensions
    if (Array.isArray(liveNote.attachments)) {
      for (const att of liveNote.attachments) {
        try {
          const parsed = typeof att === 'string' ? JSON.parse(att) : att;
          if (parsed?.mimeType?.startsWith('image/') || parsed?.name?.match(/\.(jpeg|jpg|gif|png|webp|svg)$/i)) {
            if (parsed.fileUrl) return parsed.fileUrl;
            if (parsed.$id && parsed.bucketId) {
              return `${APPWRITE_CONFIG.ENDPOINT}/storage/buckets/${parsed.bucketId}/files/${parsed.$id}/view?project=${APPWRITE_CONFIG.PROJECT_ID}`;
            }
          }
        } catch {}
      }
    }

    return null;
  }, [liveNote.content, liveNote.attachments, isEncryptedNote]);

  const handleAIAction = React.useCallback(async (action: 'summarize' | 'grammar' | 'expand') => {
    if (isAIProcessing) return;
    setIsAIProcessing(true);
    showInfo(`AI is ${action === 'grammar' ? 'fixing' : action + 'ing'} your note...`);
    try {
      const result = await generateAIAction(note, action);
      const updated = await updateNote(note.$id, {
        content: result,
        updatedAt: new Date().toISOString()
      });
      upsertNote(updated);
      showSuccess('Note updated successfully!');
    } catch (err: any) {
      showError('AI Action Failed', err.message);
    } finally {
      setIsAIProcessing(false);
    }
  }, [isAIProcessing, note, upsertNote]);


  const handleCreateTodo = async () => {
    if (isAIProcessing) return;
    setIsAIProcessing(true);
    showInfo('Converting note to task in Kylrix Flow...');
    try {
      await createTaskFromNote(note);
      showSuccess('Linked task created in Kylrix Flow');
    } catch (err: any) {
      showError(err.message || 'Failed to create task');
    } finally {
      setIsAIProcessing(false);
    }
  };

  const handlePinToggle = async (e?: React.MouseEvent) => {
    if (e) e.stopPropagation();
    try {
      if (pinned) {
        await unpinNote(note.$id);
        showSuccess('Note unpinned');
      } else {
        await pinNote(note.$id);
        showSuccess('Note pinned');
      }
    } catch (err: any) {
      const isLimitError = err.message?.includes('limit reached');
      if (isLimitError) {
        openProUpgrade('Pinned Notes');
        return;
      }
      showError(err.message || 'Failed to update pin status');
    }
  };

  const handleLockToggle = async () => {
    const handleToggle = async () => {
      try {
        const isLockedNow = !!note.dek;
        const updated = isLockedNow ? await unlockNote(note.$id) : await lockNote(note.$id);
        if (updated) {
          upsertNote(updated);
          showSuccess(isLockedNow ? 'Note unlocked' : 'Note locked');
        }
      } catch (err: any) {
        if (err.message === 'VAULT_LOCKED') {
          showError('Vault Locked', 'Unlock vault to change lock state.');
          const unlocked = await promptSudo();
          if (unlocked) handleToggle();
        } else {
          showError(err.message || 'Failed to toggle note lock');
        }
      }
    };
    handleToggle();
  };

  const handleRightClick = (e: React.MouseEvent | React.TouchEvent) => {
    e.preventDefault?.();
    e.stopPropagation?.();
    if (openMenu) {
      const clientX = 'clientX' in e ? e.clientX : 0;
      const clientY = 'clientY' in e ? e.clientY : 0;
      openMenu({
        x: clientX,
        y: clientY,
        items: contextMenuItems,
        appType: 'note',
        title: note.title || 'Untitled Idea',
      });
    }
  };

  const handleClick = () => {
    if (onNoteSelect) {
      onNoteSelect(note);
      return;
    }
    setActiveDetail({ type: 'note', id: note.$id, data: note });
    const isDesktop = typeof window !== 'undefined' && window.innerWidth >= 900;
    const NoteDetailSidebarComp = require('@/components/ui/NoteDetailSidebar').NoteDetailSidebar;
    if (isDesktop) {
      openSidebar(
        <NoteDetailSidebarComp note={liveNote} onClose={closeSidebar} />,
        note.$id,
        { hideHeader: true }
      );
    } else {
      openOverlay(
        <NoteDetailSidebarComp note={liveNote} onClose={closeOverlay} />
      );
    }
  };

  const accessControlItems = useAccessControlMenuItems({
    resourceType: 'note',
    resourceId: note.$id,
    isPublic: !!note.isPublic,
    isGuest: !!note.isGuest,
    resourceTitle: note.title || 'Untitled Note',
    resolveShareUrl: resolveNoteShareUrl,
    onUpdate: (updatedFields?: { isPublic: boolean; isGuest: boolean }) => {
      const updated = updatedFields ? { ...note, ...updatedFields } : note;
      upsertNote(updated);
      onUpdate?.(updated);
    }
  });

  const useMemo = React.useMemo; const contextMenuItems = useMemo(() => [
    { label: pinned ? 'Unpin' : 'Pin', icon: <PinIcon size={16} className={pinned ? 'rotate-45 text-[#EC4899]' : ''} />, onClick: () => { handlePinToggle(); } },
    {
      label: 'Select',
      icon: <CheckSquare size={16} className="text-[#10B981]" />,
      onClick: () => {
        enterSelectMode('note', note.$id);
      },
    },
    {
      label: 'Copy Public Link',
      icon: <ShareIcon size={16} className="text-emerald-500" />,
      onClick: async () => {
        try {
          if (!getNotePublicState(liveNote)) {
            const { toggleResourcePublicGuest } = await import('@/lib/actions/client-ops');
            const res = await toggleResourcePublicGuest({
              resourceType: 'note',
              resourceId: note.$id,
              mode: 'publish',
            });
            if (res?.success) {
              const updated = { ...note, isPublic: true, isGuest: true };
              upsertNote(updated);
              onUpdate?.(updated);
            }
          }
          const url = await resolveNoteShareUrl();
          await navigator.clipboard.writeText(url);
          showSuccess(isLocked ? 'Public link copied with key' : 'Public link copied');
        } catch (err: any) {
          showError(err?.message || 'Failed to copy share link');
        }
      },
    },
    ...accessControlItems,
    { label: isLocked ? 'Unlock' : 'Lock', icon: isLocked ? <Unlock size={16} /> : <PrivateIcon size={16} />, onClick: () => { handleLockToggle(); } },
    
    ...(isPro ? [
      { 
        label: 'Sidekick', 
        icon: <Sparkles size={16} className="text-[#A855F7]" />, 
        onClick: () => { setShowSidekick(true); },
      },
      {
        label: 'Integrate',
        icon: <TodoIcon size={16} className="text-[#3B82F6]" />,
        submenu: [
            { label: 'Convert to Goal', icon: <TodoIcon size={16} className="text-[#3B82F6]" />, onClick: () => { handleCreateTodo(); } },
        ]
      }
    ] : []),
    { label: 'Collaborators', icon: <ShareIcon size={16} />, onClick: openShare },
    { 
      label: 'Delete', 
      icon: <TrashIcon size={16} className="text-red-500" />, 
      variant: 'destructive' as const,
      onClick: openDelete,
    }
  ], [pinned, enterSelectMode, accessControlItems, isPro, handlePinToggle, isLocked, handleLockToggle, handleAIAction, handleCreateTodo, openShare, openDelete, liveNote, note, onUpdate, resolveNoteShareUrl, showError, showSuccess, upsertNote, openSidebar, openOverlay, closeSidebar, closeOverlay]);

  const cardTitle = React.useMemo(
    () => (isLocked ? 'Locked' : isEncryptedNote ? 'Encrypted' : resolveNoteCardTitle(liveNote.title, liveNote.content) || 'Untitled'),
    [isEncryptedNote, isLocked, liveNote.content, liveNote.title],
  );

  const previewText = React.useMemo(() => {
    if (isEncryptedNote) return isLocked ? 'Locked note' : 'Encrypted note';
    if (note.format === 'doodle') return 'Sketch note (no longer supported)';
    const cleaned = (liveNote.content || '')
      .replace(/\[\[kylrix-object:.*?\]\]/g, '')
      .replace(/!\[.*?\]\(.*?\)/g, '')
      .replace(/\[voice:[a-zA-Z0-9_-]+\]/g, 'Voice note')
      .trim();
    if (cleaned) return cleaned;
    if (previewImageUrl) return 'Image attached';
    return 'No preview';
  }, [isEncryptedNote, isLocked, liveNote.content, note.format, previewImageUrl]);

  const cardItem = React.useMemo(() => {
    const base = noteToCard({ ...liveNote, title: cardTitle });
    return {
      ...base,
      title: cardTitle,
      subtitle: previewText,
      isPinned: pinned,
    };
  }, [liveNote, cardTitle, previewText, pinned]);

  return (
    <>
      {!mounted ? (
        <div className="h-[168px]" />
      ) : (
        <div {...sidebarIgnoreProps} className="w-full max-w-full">
          <ObjectCard
            item={cardItem}
            onOpen={() => handleClick()}
            onContextMenu={handleRightClick}
            trailing={
              <>
                <button
                  type="button"
                  onClick={handlePinToggle}
                  className={`p-1.5 rounded-lg transition-all duration-200 ${
                    pinned
                      ? 'text-[#EC4899] bg-[#EC4899]/10'
                      : 'text-white/25 hover:text-[#EC4899] hover:bg-[#EC4899]/10'
                  }`}
                  title={pinned ? 'Unpin' : 'Pin'}
                  aria-label={pinned ? 'Unpin' : 'Pin'}
                >
                  <PinIcon size={15} className={pinned ? 'fill-[#EC4899]' : ''} />
                </button>
                <ShareLockButton
                  resourceType="note"
                  resourceId={note.$id}
                  isPublic={getNotePublicState(liveNote)}
                  isGuest={!!liveNote.isGuest}
                  resourceTitle={note.title ?? undefined}
                  dek={note.dek}
                  accentColor="#EC4899"
                  onPublished={({ isPublic, isGuest }) => {
                    const updated = { ...note, isPublic, isGuest };
                    upsertNote(updated);
                    onUpdate?.(updated);
                  }}
                  canPublish
                />
              </>
            }
            footer={
              <ObjectCardMeta
                tags={Array.isArray(note.tags) ? note.tags.filter(Boolean) as string[] : []}
                attachmentCount={note.attachments?.length || 0}
              />
            }
          >
            <div className="flex flex-col gap-3">
              <p className="text-white/55 font-satoshi text-sm font-medium leading-relaxed line-clamp-3 break-words m-0 select-text">
                {previewText}
              </p>
              {previewImageUrl && !isEncryptedNote ? (
                <div className="relative w-full h-24 sm:h-28 rounded-[14px] overflow-hidden border border-white/[0.06]">
                  <img
                    src={previewImageUrl}
                    alt=""
                    className="w-full h-full object-cover object-center opacity-90"
                    onError={(e) => {
                      (e.currentTarget.parentElement as HTMLElement).style.display = 'none';
                    }}
                  />
                </div>
              ) : null}
            </div>
          </ObjectCard>
        </div>
      )}
      <SidekickDrawer
        open={showSidekick}
        onClose={() => setShowSidekick(false)}
        target={showSidekick ? { type: 'note', id: note.$id, title: liveNote.title || cardTitle, content: liveNote.content || '' } : null}
      />
    </>
  );
});

NoteCard.displayName = 'NoteCard';

export default NoteCard;
