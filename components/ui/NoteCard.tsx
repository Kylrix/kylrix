"use client";

import * as React from 'react';
import { Drawer, Box, Typography } from '@/lib/openbricks/primitives';
import { 
  Pin as PinIcon, 
  Paperclip as AttachFileIcon, 
  Link as LinkIcon, 
  MoreHorizontal as MoreHorizIcon,
  Trash2 as TrashIcon,
  Copy as DuplicateIcon,
  Share2 as ShareIcon,
  Lock as PrivateIcon,
  Globe as PublicIcon,
  RefreshCw as RefreshIcon,
  Tag as LocalOfferIcon,
  FileText as SummarizeIcon,
  CheckSquare as GrammarIcon,
  PlusSquare as TodoIcon,
  Calendar,
  Unlock,
  ShieldCheck,
  Globe,
  Sparkles
} from 'lucide-react';

import { useContextMenu } from './ContextMenuContext';
import { useDynamicSidebar } from '@/components/ui/DynamicSidebar';
import { NoteDetailSidebar } from './NoteDetailSidebar';
import { useNotes } from '@/context/NotesContext';
import { SyncStatusDot } from '@/components/ui/SyncStatusDot';
import type { Notes } from '@/types/appwrite';
import { sidebarIgnoreProps } from '@/constants/sidebar';
import { useUnifiedDrawer } from '@/context/UnifiedDrawerContext';
import { useSection } from '@/context/SectionContext';
import { ShareLockButton } from '../share/ShareLockButton';
import { useAccessControlMenuItems } from '../share/AccessControlMenuItems';

import { resolveNoteCardTitle } from '@/constants/noteTitle';
import { toggleNoteVisibility, rotatePublicNoteLink, createTaskFromNote, getShareableUrl, getCurrentPublicNoteShareUrl, getNotePublicState, lockNote, unlockNote } from '@/lib/appwrite';
import { createNote, updateNote } from '@/lib/actions/client-ops';
import { useToast } from './Toast';
import { useSudo } from '@/context/SudoContext';
import { useProUpgrade } from '@/context/ProUpgradeContext';
import { useAuth } from '@/context/auth/AuthContext';
import { hasPaidKylrixPlan } from '@/lib/utils';
import { generateAIAction } from '@/lib/ai-actions';
import { useDrawerState } from '@/components/ui/DrawerStateContext';

interface NoteCardProps {
  note: Notes;
  onUpdate?: (updatedNote: Notes) => void;
  onDelete?: (noteId: string) => void;
  onNoteSelect?: (note: Notes) => void;
}

const NoteCard: React.FC<NoteCardProps> = React.memo(({ note, onUpdate, onDelete, onNoteSelect }) => {
  const [mounted, setMounted] = React.useState(false);
  const [isPaywallDialogOpen, setIsPaywallDialogOpen] = React.useState(false);
  const [isAIProcessing, setIsAIProcessing] = React.useState(false);
  const [isMenuDrawerOpen, setIsMenuDrawerOpen] = React.useState(false);
  const [isExpanded, setIsExpanded] = React.useState(false);
  const [hasOverflow, setHasOverflow] = React.useState(false);
  const contentWrapperRef = React.useRef<HTMLDivElement>(null);

  React.useEffect(() => {
    if (isMenuDrawerOpen) {
      const timer = setTimeout(() => {
        if (contentWrapperRef.current) {
          const hasScroll = contentWrapperRef.current.scrollHeight > contentWrapperRef.current.clientHeight;
          setHasOverflow(hasScroll);
        }
      }, 100);
      return () => clearTimeout(timer);
    } else {
      setIsExpanded(false);
      setHasOverflow(false);
    }
  }, [isMenuDrawerOpen]);
  
  const { openMenu } = useContextMenu();
  const { openSidebar } = useDynamicSidebar();
  const { isPinned, pinNote, unpinNote, upsertNote, notes: contextNotes } = useNotes();
  const liveNote = React.useMemo(
    () => contextNotes?.find((candidate) => candidate.$id === note.$id) || note,
    [contextNotes, note],
  );
  const { user } = useAuth();
  const { setActiveDetail } = useSection();
  
  // Decouple from frequent state changes in UnifiedDrawerContext
  const unifiedDrawer = useUnifiedDrawer();
  const openShare = React.useCallback(() => unifiedDrawer.open('share-note', { noteId: note.$id, noteTitle: note.title }), [unifiedDrawer, note.$id, note.title]);
  const openDelete = React.useCallback(() => unifiedDrawer.open('delete-confirm', { 
    title: `Delete "${note.title}"?`,
    resourceName: 'this note',
    confirmLabel: 'Delete Note',
    onConfirm: async () => onDelete?.(note.$id) 
  }), [unifiedDrawer, note.title, note.$id, onDelete]);
  
  const { promptSudo } = useSudo();
  const { openProUpgrade } = useProUpgrade();
  const { setIsDrawerOpen } = useDrawerState();

  React.useEffect(() => {
    setIsDrawerOpen(isMenuDrawerOpen);
    return () => setIsDrawerOpen(false);
  }, [isMenuDrawerOpen, setIsDrawerOpen]);
  const { showSuccess, showError, showInfo } = useToast();

  React.useEffect(() => setMounted(true), []);

  const isPublic = getNotePublicState(liveNote);
  const isPro = hasPaidKylrixPlan(user);
  const noteMeta = React.useMemo(() => {
    try {
      return JSON.parse(note.metadata || '{}');
    } catch {
      return {};
    }
  }, [note.metadata]);
  const isLockedT5 = (!!note.dek || (noteMeta?.encryptionVersion === 'T5' && !!noteMeta?.dek)) && !noteMeta?.clientDecrypted;
  const isEncryptedNote = (noteMeta?.encryptionVersion === 'T4' || isLockedT5) && !noteMeta?.clientDecrypted;
  const pinned = isPinned(note.$id);

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

  const handleDuplicate = async () => {
    try {
      const { $id: _id, $createdAt: _ca, $updatedAt: _ua, $permissions: _p, $databaseId: _db, $tableId: _coll, ...rest } = note as any;
      const duplicatedNote = await createNote({
        ...rest,
        title: `${note.title} (Copy)`,
      });
      upsertNote(duplicatedNote as Notes);
      showSuccess('Note duplicated');
    } catch (err: any) {
      showError(err.message || 'Failed to duplicate note');
    }
  };

  const handleTogglePublic = async () => {
    const handleToggle = async () => {
      try {
        const updated = await toggleNoteVisibility(note.$id);
        if (updated) {
          upsertNote(updated);
          showSuccess(updated.isPublic ? 'Note made public' : 'Note made private');
          if (updated.isPublic) {
            const shareUrl = getShareableUrl(note.$id, updated.decryptionKey);
            navigator.clipboard.writeText(shareUrl);
            if (updated.decryptionKey) {
              showSuccess('Link Copied', 'Encrypted public link is on your clipboard.');
            } else {
              showSuccess('Link Copied', 'Public link is on your clipboard.');
            }
          }
        } else {
          throw new Error('Failed to update visibility');
        }
      } catch (err: any) {
        if (err.message === 'VAULT_LOCKED') {
          showError('Vault Locked', "Unlock vault to update this note's public state.");
          const unlocked = await promptSudo();
          if (unlocked) handleToggle();
        } else {
          showError(err.message || 'Failed to update visibility');
        }
      }
    };
    handleToggle();
  };

  const handleCopyShareLink = async (e?: React.MouseEvent) => {
    if (e) e.stopPropagation();
    const shareUrl = isPublic ? await getCurrentPublicNoteShareUrl(note.$id) : null;
    if (isPublic && !shareUrl) {
      showError('Vault Locked', 'Unlock vault to copy the current public link.');
      return;
    }
    const finalUrl = shareUrl || getShareableUrl(note.$id);
    navigator.clipboard.writeText(finalUrl);
    showSuccess('Share link copied to clipboard');
  };

  const handleLockToggle = async () => {
    const handleToggle = async () => {
      try {
        const isLocked = !!note.dek || (noteMeta?.encryptionVersion === 'T5' && !!noteMeta?.dek);
        const updated = isLocked ? await unlockNote(note.$id) : await lockNote(note.$id);
        if (updated) {
          upsertNote(updated);
          showSuccess(isLocked ? 'Note unlocked' : 'Note locked');
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

  const handleRotatePublicLink = async () => {
    const handleRotate = async () => {
      try {
        const updated = await rotatePublicNoteLink(note.$id);
        if (updated) {
          upsertNote(updated);
          if (updated.decryptionKey) {
            const shareUrl = getShareableUrl(note.$id, updated.decryptionKey);
            navigator.clipboard.writeText(shareUrl);
            showSuccess('Public link rotated', 'New public link copied to clipboard.');
          } else {
            showSuccess('Public link rotated');
          }
        }
      } catch (err: any) {
        if (err.message === 'VAULT_LOCKED') {
          showError('Vault Locked', 'Unlock vault to rotate the public link.');
          const unlocked = await promptSudo();
          if (unlocked) handleRotate();
        } else {
          showError(err.message || 'Failed to rotate public link');
        }
      }
    };
    handleRotate();
  };

  const handleRightClick = (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    openMenu({
      x: e.clientX,
      y: e.clientY,
      items: contextMenuItems,
      appType: 'note',
    });
  };

  const handleClick = () => {
    if (onNoteSelect) {
      onNoteSelect(note);
      return;
    }
    setActiveDetail({ type: 'note', id: note.$id, data: note });
  };

  const accessControlItems = useAccessControlMenuItems({
    resourceType: 'note',
    resourceId: note.$id,
    isPublic: !!note.isPublic,
    isGuest: !!note.isGuest,
    resourceTitle: note.title || 'Untitled Note',
    onUpdate: (updatedFields?: { isPublic: boolean; isGuest: boolean }) => {
      const updated = updatedFields ? { ...note, ...updatedFields } : note;
      upsertNote(updated);
      onUpdate?.(updated);
    }
  });

  const useMemo = React.useMemo; const contextMenuItems = useMemo(() => [
    { label: pinned ? 'Unpin' : 'Pin', icon: <PinIcon size={16} className={pinned ? 'rotate-45 text-[#EC4899]' : ''} />, onClick: () => { handlePinToggle(); } },
    ...accessControlItems,
    { label: isLockedT5 ? 'Unlock' : 'Lock', icon: isLockedT5 ? <Unlock size={16} /> : <PrivateIcon size={16} />, onClick: () => { handleLockToggle(); } },
    { label: 'Add Paywall', icon: <LocalOfferIcon size={16} className="text-[#EC4899]" />, onClick: () => { setIsPaywallDialogOpen(true); } },
    ...(isPro ? [
      { 
        label: 'Kylie Assist', 
        icon: <Sparkles size={16} className="text-[#A855F7]" />, 
        submenu: [
            { label: 'Summarize', icon: <SummarizeIcon size={16} className="text-[#A855F7]" />, onClick: () => { handleAIAction('summarize'); } },
            { label: 'Fix Grammar', icon: <GrammarIcon size={16} className="text-[#A855F7]" />, onClick: () => { handleAIAction('grammar'); } },
        ]
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
      submenu: [
        {
          label: 'Confirm Delete',
          icon: <TrashIcon size={16} className="text-red-500" />,
          variant: 'destructive' as const,
          onClick: openDelete
        }
      ]
    }
  ], [pinned, accessControlItems, isPro, handlePinToggle, isLockedT5, handleLockToggle, setIsPaywallDialogOpen, handleAIAction, handleCreateTodo, openShare, openDelete]);

  const cardTitle = React.useMemo(
    () => (isLockedT5 ? '🔒 Locked Note' : isEncryptedNote ? '🔒 Encrypted note' : resolveNoteCardTitle(liveNote.title, liveNote.content) || 'Untitled Note'),
    [isEncryptedNote, isLockedT5, liveNote.content, liveNote.title],
  );

  return (
    <>
      {!mounted ? (
        <div className="h-[200px]" />
      ) : (
        <div
          {...sidebarIgnoreProps}
          onClick={handleClick}
          onContextMenu={handleRightClick}
          className="relative flex flex-col justify-between p-6 w-full min-h-[196px] rounded-[28px] bg-[#161412] border border-[#34322F] hover:border-[#EC4899]/40 hover:bg-[#1C1A18] transition-all duration-300 ease-out cursor-pointer overflow-hidden group select-none max-w-full"
        >
          {/* Top Section */}
          <div className="flex items-start gap-4 flex-1 min-w-0 w-full">

            {/* Grouped Copy Column */}
            <div className="flex-1 min-w-0 flex flex-col gap-2.5">
              {/* Header Row */}
              <div className="flex items-center gap-2 flex-wrap">
                {pinned && (
                  <PinIcon size={14} className="text-[#EC4899] fill-[#EC4899] rotate-45 flex-shrink-0" />
                )}
                <h3 className="text-white text-base font-black tracking-tight leading-tight truncate flex-1 min-w-0 font-mono">
                  {cardTitle}
                </h3>
              </div>

              {/* Summary / Content Preview */}
              <div className="text-sm text-white/50 font-medium leading-relaxed mt-2 overflow-hidden">
                <p className="line-clamp-2 break-words select-text">
                  {isEncryptedNote 
                    ? (isLockedT5 ? '🔒 Locked Note' : '🔒 Encrypted note') 
                    : note.format === 'doodle'
                      ? 'Sketch note (no longer supported)'
                      : (liveNote.content || '').replace(/\[voice:[a-zA-Z0-9_-]+\]/g, '🎙️ Voice Note')
                  }
                </p>
              </div>
            </div>

            {/* Top-Right Inline Actions (Pin, Lock/Link) */}
            <div className="flex items-center gap-0.5 flex-shrink-0">
              <button
                onClick={handlePinToggle}
                className={`p-1.5 rounded-lg transition-all duration-200 ${pinned ? 'text-[#EC4899] bg-[#EC4899]/5' : 'text-white/20 hover:text-[#EC4899] hover:bg-[#EC4899]/5'}`}
                title={pinned ? 'Unpin' : 'Pin'}
              >
                <PinIcon size={16} className={pinned ? 'fill-[#EC4899]' : ''} />
              </button>

              <ShareLockButton 
                resourceType="note"
                resourceId={note.$id}
                isPublic={getNotePublicState(liveNote)}
                isGuest={!!liveNote.isGuest}
                accentColor="#EC4899"
                onPublished={({ isPublic, isGuest }) => {
                  const updated = { ...note, isPublic, isGuest };
                  upsertNote(updated);
                  onUpdate?.(updated);
                }}
                canPublish={!isEncryptedNote}
                blockReason="Unlock vault to share encrypted notes"
              />
            </div>

          </div>

          {/* Bottom Action Bar */}
          <div className="flex items-center justify-between mt-3 pt-3 border-t border-white/4 flex-shrink-0 select-none">
            {/* Sync Status Dot */}
            <div className="flex items-center gap-1.5">
              <SyncStatusDot noteId={note.$id} />
            </div>

            {/* Attachments / Tag Badges */}
            <div className="flex items-center gap-1.5 overflow-hidden max-w-[60%] justify-end">
              {note.attachments && note.attachments.length > 0 && (
                <span className="flex-shrink-0 bg-[#6366F1]/10 text-[#818CF8] text-[9px] font-black font-mono px-2 py-0.5 rounded border border-[#6366F1]/20 flex items-center gap-1">
                  <AttachFileIcon size={10} />
                  {note.attachments.length}
                </span>
              )}
              {note.tags && note.tags.slice(0, 2).map((tag: string, index: number) => (
                <span
                  key={index}
                  className="text-[9px] font-black font-mono uppercase tracking-wider bg-white/3 text-white/40 border border-white/8 px-2 py-0.5 rounded"
                >
                  {tag}
                </span>
              ))}
            </div>
          </div>

        </div>
      )}


    </>
  );
});

NoteCard.displayName = 'NoteCard';

export default NoteCard;
