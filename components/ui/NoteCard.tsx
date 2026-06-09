"use client";

import React, { useState, useEffect, useRef, useCallback } from 'react';
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
  Globe
} from 'lucide-react';

import { useContextMenu } from './ContextMenuContext';
import { useDynamicSidebar } from '@/components/ui/DynamicSidebar';
import { NoteDetailSidebar } from './NoteDetailSidebar';
import { useNotes } from '@/context/NotesContext';
import type { Notes } from '@/types/appwrite';
import { DoodleStroke } from '@/types/notes';
import { sidebarIgnoreProps } from '@/constants/sidebar';
import { useUnifiedDrawer } from '@/context/UnifiedDrawerContext';
import { useSection } from '@/context/SectionContext';
import { ShareLockButton } from '../share/ShareLockButton';
import { useAccessControlMenuItems } from '../share/AccessControlMenuItems';

import { toggleNoteVisibility, rotatePublicNoteLink, createTaskFromNote, getShareableUrl, getCurrentPublicNoteShareUrl, getNotePublicState } from '@/lib/appwrite';
import { createNote, updateNote } from '@/lib/actions/client-ops';
import { useToast } from './Toast';
import { useSudo } from '@/context/SudoContext';
import { useProUpgrade } from '@/context/ProUpgradeContext';
import { useAuth } from '@/context/auth/AuthContext';
import { hasPaidKylrixPlan } from '@/lib/utils';
import { generateAIAction } from '@/lib/ai-actions';

interface NoteCardProps {
  note: Notes;
  onUpdate?: (updatedNote: Notes) => void;
  onDelete?: (noteId: string) => void;
  onNoteSelect?: (note: Notes) => void;
}

const NoteCard: React.FC<NoteCardProps> = React.memo(({ note, onUpdate, onDelete, onNoteSelect }) => {
  const [mounted, setMounted] = useState(false);
  const [isPaywallDialogOpen, setIsPaywallDialogOpen] = useState(false);
  const [isAIProcessing, setIsAIProcessing] = useState(false);
  
  const { openMenu } = useContextMenu();
  const { openSidebar } = useDynamicSidebar();
  const { isPinned, pinNote, unpinNote, upsertNote } = useNotes();
  const { user } = useAuth();
  const { setActiveDetail } = useSection();
  
  // Decouple from frequent state changes in UnifiedDrawerContext
  const unifiedDrawer = useUnifiedDrawer();
  const openShare = useCallback(() => unifiedDrawer.open('share-note', { noteId: note.$id, noteTitle: note.title }), [unifiedDrawer, note.$id, note.title]);
  const openDelete = useCallback(() => unifiedDrawer.open('delete-confirm', { 
    title: `Delete "${note.title}"?`,
    resourceName: 'this note',
    confirmLabel: 'Delete Note',
    onConfirm: async () => onDelete?.(note.$id) 
  }), [unifiedDrawer, note.title, note.$id, onDelete]);
  
  const { promptSudo } = useSudo();
  const { openProUpgrade } = useProUpgrade();
  const { showSuccess, showError, showInfo } = useToast();
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => setMounted(true), []);

  const isPublic = getNotePublicState(note);
  const isPro = hasPaidKylrixPlan(user);
  const noteMeta = (() => {
    try {
      return JSON.parse(note.metadata || '{}');
    } catch {
      return {};
    }
  })();
  const isEncryptedNote = !!noteMeta?.isEncrypted && noteMeta?.encryptionVersion === 'T4' && !noteMeta?.clientDecrypted;
  const pinned = isPinned(note.$id);

  const handleAIAction = async (action: 'summarize' | 'grammar' | 'expand') => {
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
      showSuccess(`Note ${action}d successfully`);
    } catch (err: any) {
      showError(err.message || `Failed to ${action} note`);
    } finally {
      setIsAIProcessing(false);
    }
  };

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

  // Render doodle preview on canvas
  useEffect(() => {
    if (note.format !== 'doodle' || !note.content || !canvasRef.current) return;

    try {
      const strokes: DoodleStroke[] = JSON.parse(note.content);
      const canvas = canvasRef.current;
      const ctx = canvas.getContext('2d');
      if (!ctx) return;

      ctx.clearRect(0, 0, canvas.width, canvas.height);

      strokes.forEach((stroke) => {
        if (stroke.points.length < 2) return;
        ctx.strokeStyle = stroke.color;
        ctx.lineWidth = stroke.size;
        ctx.lineCap = 'round';
        ctx.lineJoin = 'round';
        ctx.globalAlpha = stroke.opacity ?? 1;
        ctx.beginPath();
        ctx.moveTo(stroke.points[0][0], stroke.points[0][1]);
        for (let i = 1; i < stroke.points.length; i++) {
          ctx.lineTo(stroke.points[i][0], stroke.points[i][1]);
        }
        ctx.stroke();
        ctx.globalAlpha = 1;
      });
    } catch {
      console.error('Failed to render doodle preview');
    }
  }, [note.format, note.content]);

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
    onUpdate: () => {
      onUpdate?.(note);
    }
  });

  const contextMenuItems = React.useMemo(() => [
    { label: pinned ? 'Unpin' : 'Pin', icon: <PinIcon size={16} className={pinned ? 'rotate-45 text-[#EC4899]' : ''} />, onClick: () => { handlePinToggle(); } },
    ...accessControlItems,
    { label: 'Duplicate', icon: <DuplicateIcon size={16} />, onClick: () => { handleDuplicate(); } },
    { label: 'Add Paywall', icon: <LocalOfferIcon size={16} className="text-[#EC4899]" />, onClick: () => { setIsPaywallDialogOpen(true); } },
    ...(isPro ? [
      { label: 'AI Summarize', icon: <SummarizeIcon size={16} className="text-[#6366F1]" />, onClick: () => { handleAIAction('summarize'); } },
      { label: 'AI Fix Grammar', icon: <GrammarIcon size={16} className="text-[#6366F1]" />, onClick: () => { handleAIAction('grammar'); } },
      { label: 'Convert To Todo', icon: <TodoIcon size={16} className="text-[#6366F1]" />, onClick: () => { handleCreateTodo(); } }
    ] : []),
    { label: 'Share with...', icon: <ShareIcon size={16} />, onClick: openShare },
    { label: 'Delete', icon: <TrashIcon size={16} className="text-red-500" />, onClick: openDelete, variant: 'destructive' as const }
  ], [pinned, accessControlItems, isPro, handlePinToggle, handleDuplicate, setIsPaywallDialogOpen, handleAIAction, handleCreateTodo, openShare, openDelete]);

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
                  {isEncryptedNote ? '🔒 Encrypted note' : note.title || 'Untitled Note'}
                </h3>
              </div>

              {/* Summary / Content Preview */}
              <div className="text-sm text-white/50 font-medium leading-relaxed mt-2 overflow-hidden">
                {note.format === 'doodle' ? (
                  <div className="w-full h-[64px] rounded-xl border border-white/5 bg-white/[0.02] overflow-hidden relative">
                    <canvas
                      ref={canvasRef}
                      width={300}
                      height={200}
                      className="w-full h-full block object-contain"
                    />
                  </div>
                ) : (
                  <p className="line-clamp-2 break-words select-text">
                    {isEncryptedNote 
                      ? '🔒 Encrypted note' 
                      : (note.content || '').replace(/\[voice:[a-zA-Z0-9_-]+\]/g, '🎙️ Voice Note')
                    }
                  </p>
                )}
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
                isPublic={!!note.isPublic}
                isGuest={!!note.isGuest}
                accentColor="#EC4899"
                onPublished={() => onUpdate?.(note)}
                canPublish={!isEncryptedNote}
                blockReason="Unlock vault to share encrypted notes"
              />
            </div>

          </div>

          {/* Bottom Action Bar */}
          <div className="flex items-center justify-end mt-3 pt-3 border-t border-white/4 flex-shrink-0 select-none">

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
