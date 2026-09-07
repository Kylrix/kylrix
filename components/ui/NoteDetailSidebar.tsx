'use client';

import React, { useState, useEffect, useMemo, useRef, useCallback } from 'react';
import { Notes } from '@/types/appwrite';

import { AgenticDiffViewer } from '@/components/agentic/AgenticDiffViewer';
import { KylrixWYSIWYGEditor } from '@/components/editor/KylrixWYSIWYGEditor';

import {
  Mic,
  Square,
  FolderKanban,
  Trash2 as TrashIcon,
  ExternalLink as OpenIcon,
  Pin as PinIcon,
  EyeOff as EyeOffIcon,
  ArrowLeft as BackIcon,
  Link2 as LinkIcon,
  Lock as LockIcon,
  Unlock as UnlockIcon,
  X as CloseIcon,
  Sparkles as ActionIcon,
  CheckSquare as TaskIcon,
  Copy as CopyIcon,
  Tag as TagIcon,
  Plus,
  Clipboard,
  MoreVertical,
  Zap,
} from 'lucide-react';
import { useUnifiedFileDrawer } from '@/context/UnifiedFileDrawerContext';
import { autonomicSyncEngine } from '@/lib/services/sync-engine';

import { 
  Drawer, 
  Box, 
  Typography, 
  Stack, 
  IconButton, 
  List, 
  ListItem, 
  ListItemButton, 
  ListItemText,
  alpha 
} from '@/lib/openbricks/primitives';
import { useTask } from '@/context/TaskContext';
import { useToast } from '@/components/ui/Toast';
import { useSudo } from '@/context/SudoContext';
import { useInstantNoteInput } from '@/lib/note/useInstantNoteInput';
import { BareMetalInput } from '@/components/ui/BareMetalInput';
import { useProUpgrade } from '@/context/ProUpgradeContext';
import { useDynamicSidebar } from '@/components/ui/DynamicSidebar';
import { useOverlay } from '@/components/ui/OverlayContext';
import { useUnifiedDrawer } from '@/context/UnifiedDrawerContext';
import { exportToMarkdown, exportToPDF, exportToDOCX } from '@/lib/utils/export';
import { useAuth } from '@/lib/auth';
import { hasPaidKylrixPlan, getUserSubscriptionTier } from '@/lib/utils';
import { userCanUseProjects } from '@/lib/projects/feature-gate-client';
import { IdentityAvatar } from '@/components/common/IdentityBadge';
import { useNotes } from '@/context/NotesContext';
import { useWorkspace } from '@/context/WorkspaceContext';
import { isEphemeralComposeNoteId } from '@/lib/notes/compose-draft-registry';
import { useDataNexus } from '@/context/DataNexusContext';
import { useSection } from '@/context/SectionContext';
import { useDrawerState } from '@/components/ui/DrawerStateContext';
import { ConfirmationDialog } from '@/components/ConfirmationDialog';
import { formatNoteCreatedDate, formatNoteUpdatedDate } from '@/lib/date-utils';
import { getTablesDbRowCached } from '@/lib/ecosystem/tablesdb-row-cache';
import { 
  listFlowTasks, 
  listFlowEvents, 
  listKeepCredentials, 
  Query, 
  toggleNoteVisibility, 
  rotatePublicNoteLink, 
  getShareableUrl, 
  getCurrentPublicNoteShareUrl, 
  getNotePublicState, 
  decryptPublicEncryptedNote, 
  createTaskFromNote 
} from '@/lib/appwrite';
import { APPWRITE_CONFIG } from '@/lib/appwrite/config';
import { StorageService } from '@/lib/services/storage';
import { ShareLockButton } from '@/components/share/ShareLockButton';
import { ecosystemSecurity } from '@/lib/ecosystem/security';
import { isValidAppwriteRowId } from '@/lib/utils/resource-ids';
import { attachObject } from '@/lib/actions/client-ops';
import ProjectLinker from '@/components/projects/ProjectLinker';
import ProjectAddObjectModal from '@/components/projects/ProjectAddObjectModal';
import { SyncStatusDot, SyncStatusLabel } from '@/components/ui/SyncStatusDot';
import {
  getRemovedObjectBlocks,
  serializeObjectBlock,
  type ParsedObjectBlock} from '@/lib/note-object-secondary';
import { storage } from '@/lib/appwrite/client';
import { NoteDetailSidebarView } from './NoteDetailSidebarSections/NoteDetailSidebarView';
import { healDecryption as healDecryption_ext } from './NoteDetailSidebarSections/healDecryption';
import { renderContextActionsContent as renderContextActionsContent_ext } from './NoteDetailSidebarSections/renderContextActionsContent';




export type NoteAccessRole = 'owner' | 'write-collab' | 'read-collab' | 'guest' | 'public';

export interface NoteDetailSidebarProps {
  note: Notes;
  onUpdate: (updatedNote: Notes) => void;
  onDelete: (noteId: string) => void;
  onClose?: () => void;
  onBack?: () => void;
  layout?: 'page' | 'drawer';
  showExpandButton?: boolean;
  showHeaderDeleteButton?: boolean;
  isLoading?: boolean;
  /** When true, hides all write/edit/delete controls and forces preview mode */
  readOnly?: boolean;
  /** The resolved access role for this viewer */
  accessRole?: NoteAccessRole;
}

export function NoteDetailSidebar({
  note,
  onUpdate,
  onDelete,
  onClose,
  onBack,
  layout = 'drawer',
  showExpandButton = true,
  showHeaderDeleteButton = true,
  isLoading: _isLoading = false,
  readOnly = false,
  accessRole}: NoteDetailSidebarProps) {
  const { open: openUnified } = useUnifiedDrawer();
  const { openProUpgrade } = useProUpgrade();
  const { user } = useAuth();
  const { promptSudo } = useSudo();
  const { setIsDrawerOpen } = useDrawerState();
  const { showSuccess, showError } = useToast();
  const { closeSidebar } = useDynamicSidebar();
  const { closeOverlay } = useOverlay();
  const [isTagSelectorOpen, setIsTagSelectorOpen] = useState(false);
  const { ecosystemTags, refreshEcosystemTags } = useTask();
  const { persistScrollPosition, getScrollPosition } = useSection();
  const scrollContainerRef = useRef<HTMLDivElement>(null);

  const { setCachedData } = useDataNexus();
  const { activeWorkspace } = useWorkspace();
  const { notes: allNotes, isPinned, pinNote, unpinNote, pushLiveNote, registerComposeSession } = useNotes();
  const isPinnedFunc = useMemo(() => typeof isPinned === 'function' ? isPinned : () => false, [isPinned]);
  const pinNoteFunc = useMemo(() => typeof pinNote === 'function' ? pinNote : async () => {}, [pinNote]);
  const unpinNoteFunc = useMemo(() => typeof unpinNote === 'function' ? unpinNote : async () => {}, [unpinNote]);
  const noteRef = useRef(note);
  const allNotesRef = useRef<Notes[]>([]);
  /** Single source of truth: NotesContext local copy; prop is only a fallback seed. */
  const liveNote = useMemo(
    () => (allNotes || []).find((candidate: any) => candidate.$id === note.$id) || note,
    [allNotes, note]
  );
  const awaitingLocalCopy = useMemo(() => {
    if (!note?.$id || isEphemeralComposeNoteId(note.$id)) return false;
    const inContext = (allNotes || []).some((candidate) => candidate.$id === note.$id);
    if (inContext) return false;
    // Prop may already carry a seed (card / idea page). Only wait when we truly have an empty stub.
    const hasSeedBody = Boolean(String(note.title || '').trim() || String(note.content || '').trim());
    return !hasSeedBody;
  }, [allNotes, note]);

  useEffect(() => {
    allNotesRef.current = Array.isArray(allNotes) ? allNotes : [];
  }, [allNotes]);

  // Realtime: detail view subscribes via LocalEngine — creator edits pull instantly while user looks at it
  useEffect(() => {
    if (!note?.$id || readOnly) return;
    if ((note as any).isTrash === true || (note as any).isDeleted === true) {
      onDelete?.(note.$id);
      onClose?.();
      return;
    }
    let unsub: (() => void) | null = null;
    void (async () => {
      const { LocalEngine } = await import('@/lib/services/LocalEngine');
      const channel = `databases.${APPWRITE_CONFIG.DATABASE_ID}.collections.${APPWRITE_CONFIG.TABLES.NOTES}.documents.${note.$id}`;
      unsub = await LocalEngine.subscribeRealtime(channel, (payload: any) => {
        if (payload?.$id === note.$id) {
          if (payload.isTrash === true || payload.isDeleted === true) {
            onDelete?.(payload.$id);
            onClose?.();
            return;
          }
          updateLocalAndParentNote(payload as Notes);
          try {
            autonomicSyncEngine.markConfirmed(payload.$id);
          } catch {}
        }
      });
    })();
    return () => { try { unsub?.(); } catch {} };
  }, [note?.$id, readOnly, onUpdate, onDelete, onClose]);

  // Restore scroll once per note id — not on every liveNote update to avoid jitter
  const hasRestoredScrollRef = useRef<string | null>(null);
  useEffect(() => {
    if (!scrollContainerRef.current || !liveNote?.$id) return;
    if (hasRestoredScrollRef.current === liveNote.$id) return;
    hasRestoredScrollRef.current = liveNote.$id;
    const saved = getScrollPosition(`note_detail:${liveNote.$id}`);
    // Use rAF to avoid layout thrash during initial mount; do not re-apply on content/attachment re-renders
    requestAnimationFrame(() => {
      if (scrollContainerRef.current) scrollContainerRef.current.scrollTop = saved;
    });
  }, [liveNote?.$id, getScrollPosition]);

  const updateLocalAndParentNote = useCallback((updated: Notes) => {
    if (updated?.$id) {
      pushLiveNote(updated, { pending: false });
      void setCachedData(`note_${updated.$id}`, updated);
    }
    onUpdate(updated);
  }, [onUpdate, pushLiveNote, setCachedData]);

  useEffect(() => {
    noteRef.current = note;
  }, [note]);

  const { markDirty, getLastEditAt, resetEditClock } = useInstantNoteInput(liveNote.$id, readOnly);

  // Seed local copy once per id when sync has not delivered it yet (no network in detail).
  useEffect(() => {
    const seed = noteRef.current;
    if (!seed?.$id || isEphemeralComposeNoteId(seed.$id)) return;
    const exists = allNotesRef.current.some((candidate) => candidate.$id === seed.$id);
    if (!exists) {
      pushLiveNote(seed, { pending: false });
      void setCachedData(`note_${seed.$id}`, seed);
    }
  }, [note.$id, pushLiveNote, setCachedData]);

  useEffect(() => {
    if (liveNote?.$id) {
      void refreshEcosystemTags();
      autonomicSyncEngine.requestObjectFreshness('note', liveNote.$id, (refreshed) => {
        // Guarded freshness: never clobber local dirty typing (pending queue is SoT)
        const lastEdit = getLastEditAt();
        const isDirty = Date.now() - lastEdit < 2500;
        const remoteNewer = new Date(refreshed.$updatedAt || refreshed.updatedAt || 0).getTime() > new Date(liveNoteRef.current.$updatedAt || liveNoteRef.current.updatedAt || 0).getTime();
        if (isDirty) return;
        if (!remoteNewer) return;
        // Only update if not currently focused typing
        if (typeof document !== 'undefined' && document.hasFocus() && (document.activeElement?.tagName === 'INPUT' || document.activeElement?.tagName === 'TEXTAREA')) {
          // Defer to next blur
          return;
        }
        resetEditClock();
        updateLocalAndParentNote(refreshed);
      });
    }
  }, [liveNote?.$id, refreshEcosystemTags, updateLocalAndParentNote, getLastEditAt, resetEditClock]);
  
  const noteMeta = useMemo(() => {
    try {
      return JSON.parse(liveNote.metadata || '{}');
    } catch {
      return {};
    }
  }, [liveNote.metadata]);

  // REACTIVE VAULT STATUS
  const [vaultUnlocked, setVaultUnlocked] = useState(ecosystemSecurity.status.isUnlocked);
  useEffect(() => {
    return ecosystemSecurity.onStatusChange((s) => setVaultUnlocked(s.isUnlocked));
  }, []);

  const { openFileDrawer } = useUnifiedFileDrawer();

  const liveNoteRef = useRef(liveNote);
  liveNoteRef.current = liveNote;

  const [title, setTitle] = useState(liveNote.title || '');
  const [content, setContent] = useState(liveNote.content || '');
  const [tags, setTags] = useState(liveNote.tags?.join(', ') || '');
  const [isPublic, _setIsPublic] = useState(getNotePublicState(liveNote));

  // Guarded sync from liveNote -> local fields: never clobber dirty typing or focused textarea (cursor)
  useEffect(() => {
    const isDirty = Date.now() - getLastEditAt() < 2000;
    if (isDirty) return;
    // Never clobber while user is typing — preserves cursor/selection
    const active = typeof document !== 'undefined' ? document.activeElement : null;
    if (active === contentTextareaRef.current) return;
    if (active && (active.tagName === 'INPUT' || active.tagName === 'TEXTAREA')) {
      // Also guard title tag input focus
      const titleActive = active.getAttribute?.('placeholder') === 'Untitled note';
      if (titleActive) return;
    }
    setTitle(liveNote.title || '');
    setContent(liveNote.content || '');
    setTags(liveNote.tags?.join(', ') || '');
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [liveNote.$id, liveNote.tags, liveNote.title, liveNote.content]);

  // Hardcore instant handlers — flow.realtime-input-rxdb-sync (direct interception, no useEffect queue)
  const handleTitleChange = useCallback((next: string) => {
    if (readOnly) return;
    setTitle(next);
    const noteId = liveNoteRef.current?.$id;
    if (!noteId) return;
    registerComposeSession(noteId);
    const draft: Notes = { ...liveNoteRef.current, title: next, $updatedAt: new Date().toISOString(), updatedAt: new Date().toISOString() } as Notes;
    markDirty(draft);
    onUpdate(draft);
  }, [readOnly, registerComposeSession, markDirty, onUpdate]);

  const pendingSelRef = useRef<{ start: number; end: number } | null>(null);
  // Bare-metal content handler — no useLayoutEffect cursor restore needed for typing (uncontrolled DOM is SoT)
  const handleContentChange = useCallback((next: string) => {
    if (readOnly) return;
    setContent(next);
    const noteId = liveNoteRef.current?.$id;
    if (!noteId) return;
    registerComposeSession(noteId);
    const draft: Notes = { ...liveNoteRef.current, content: next, $updatedAt: new Date().toISOString(), updatedAt: new Date().toISOString() } as Notes;
    markDirty(draft);
    onUpdate(draft);
  }, [readOnly, registerComposeSession, markDirty, onUpdate]);

  const handleTagsChange = useCallback((nextRaw: string) => {
    if (readOnly) return;
    setTags(nextRaw);
    const noteId = liveNoteRef.current?.$id;
    if (!noteId) return;
    registerComposeSession(noteId);
    const normalizedTags = nextRaw.split(',').map((t: string) => t.trim()).filter(Boolean);
    const draft: Notes = { ...liveNoteRef.current, tags: normalizedTags as any, $updatedAt: new Date().toISOString(), updatedAt: new Date().toISOString() } as Notes;
    markDirty(draft);
    onUpdate(draft);
  }, [readOnly, registerComposeSession, markDirty, onUpdate]);

  const [isLoadingCollaborators, setIsLoadingCollaborators] = useState(false);
  const [collaboratorProfiles, setCollaboratorProfiles] = useState<any[]>([]);
  const [_isLoadingTasks, setIsLoadingTasks] = useState(false);
  const [_linkedTasks, setLinkedTasks] = useState<any[]>([]);
  const [_isLoadingEvents, setIsLoadingEvents] = useState(false);
  const [_linkedEvents, setLinkedEvents] = useState<any[]>([]);
  const [_isLoadingSecrets, setIsLoadingSecrets] = useState(false);
  const [_linkedSecrets, setLinkedSecrets] = useState<any[]>([]);

  const [showActionHub, setShowActionHub] = useState(false);
  const [showRotateConfirm, setShowRotateConfirm] = useState(false);
  const [showProjectLinker, setShowProjectLinker] = useState(false);
  const [isRotating, setIsRotating] = useState(false);
  const [isCreatingTaskFromNote, setIsCreatingTaskFromNote] = useState(false);
  const [crossSuggestions, setCrossSuggestions] = useState<any[]>([]);
  const [isLoadingSuggestions, setIsLoadingSuggestions] = useState(false);
  const [isLocallyDecrypted, setIsLocallyDecrypted] = useState(false);
  const [_attachedObjects, setAttachedObjects] = useState<any[]>([]);

  const [isRecording, setIsRecording] = useState(false);
  const [recordingDuration, setRecordingDuration] = useState(0);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const audioChunksRef = useRef<Blob[]>([]);
  const recordingTimerRef = useRef<NodeJS.Timeout | null>(null);
  const durationIntervalRef = useRef<NodeJS.Timeout | null>(null);

  useEffect(() => {
    return () => {
      if (recordingTimerRef.current) clearTimeout(recordingTimerRef.current);
      if (durationIntervalRef.current) clearInterval(durationIntervalRef.current);
    };
  }, []);

  // ENCRYPTION LOGIC
  const isT4Encrypted = useMemo(
    () =>
      !!liveNote.dek ||
      ((noteMeta?.isEncrypted === true || noteMeta?.isEncrypted === 'true') &&
        noteMeta?.encryptionVersion === 'T4'),
    [noteMeta, liveNote.dek],
  );
  const isEncryptedNote = useMemo(() => isT4Encrypted && !noteMeta?.clientDecrypted && !isLocallyDecrypted, [isT4Encrypted, noteMeta, isLocallyDecrypted]);
  const shouldMaskEncrypted = useMemo(() => isEncryptedNote && !vaultUnlocked, [isEncryptedNote, vaultUnlocked]);



  // Automatically heal T4 encrypted state if vault is unlocked
  useEffect(() => {
    if (isEncryptedNote && vaultUnlocked) {
      const healDecryption = (..._args: any[]) => healDecryption_ext({ _attachedObjects, _hasCollaborators, _isAttachingObject, _isLoadingEvents, _isLoadingSecrets, _isLoadingTasks, _linkedEvents, _linkedSecrets, _linkedTasks, _setIsPublic, allNotesRef, attachPickedObject, audioChunksRef, awaitingLocalCopy, canAttachSecondaryObject, closeContextActions, collaboratorProfiles, content, contentTextareaRef, crossSuggestions, displayTags, durationIntervalRef, getCursorLineNumber, handleAddToProject, handleBackClick, handleConfirmedRotate, handleContentChange, handleCopyShareLink, handleCreateTaskFromNote, handleDelete, handleDismiss, handlePinToggle, handleTagsChange, handleTitleChange, handleTogglePublic, hasRestoredScrollRef, healDecryption, insertObjectBlockAtCursor, isAttachObjectPickerOpen, isContextDrawerOpen, isCreatingTaskFromNote, isDesktop, isEncryptedNote, isExportDrawerOpen, isLoadingCollaborators, isLoadingSuggestions, isLocallyDecrypted, isObjectPermissionInfoOpen, isPageLayout, isPinnedFunc, isPublic, isRecording, isRotating, isT4Encrypted, isTagSelectorOpen, linkedCredentialIds, linkedEventIds, linkedTaskIds, liveNote, liveNoteRef, mediaRecorderRef, noteLinks, noteMeta, noteRef, objectUploadInputRef, onPickExternalFile, pendingBlockDelete, pendingSelRef, pinNoteFunc, previousContentRef, recordingDuration, recordingTimerRef, renderContextActionsContent, replaceContentWithSave, rotateNoteLink, scrollContainerRef, setAttachedObjects, setCollaboratorProfiles, setContent, setCrossSuggestions, setIsAttachObjectPickerOpen, setIsAttachingObject, setIsContextDrawerOpen, setIsCreatingTaskFromNote, setIsDesktop, setIsExportDrawerOpen, setIsLoadingCollaborators, setIsLoadingEvents, setIsLoadingSecrets, setIsLoadingSuggestions, setIsLoadingTasks, setIsLocallyDecrypted, setIsObjectPermissionInfoOpen, setIsRecording, setIsRotating, setIsTagSelectorOpen, setLinkedEvents, setLinkedSecrets, setLinkedTasks, setPendingBlockDelete, setRecordingDuration, setShowActionHub, setShowProjectLinker, setShowRotateConfirm, setTags, setTitle, setVaultUnlocked, shouldMaskEncrypted, showActionHub, showProjectLinker, showRotateConfirm, tags, title, toggleRecording, unpinNoteFunc, updateLocalAndParentNote, vaultUnlocked });
      void healDecryption();
    }
  }, [isEncryptedNote, vaultUnlocked, liveNote, updateLocalAndParentNote, showSuccess]);

  // Sync drawer state
  useEffect(() => {
    setIsDrawerOpen(showRotateConfirm);
    return () => setIsDrawerOpen(false);
  }, [showRotateConfirm, setIsDrawerOpen]);

  // Automatically prompt for vault unlock if opening an encrypted note
  useEffect(() => {
    if (isEncryptedNote && !vaultUnlocked) {
      promptSudo();
    }
  }, [isEncryptedNote, vaultUnlocked, promptSudo]);

  // Linked Content Effects
  const noteLinks = liveNote as Notes & {
    linkedTaskIds?: string[] | null;
    linkedTaskId?: string | null;
    linkedEventIds?: string[] | null;
    linkedEventId?: string | null;
    linkedCredentialIds?: string[] | null;
    linkedCredentialId?: string | null;
  };
  const linkedTaskIds = useMemo(() => noteLinks.linkedTaskIds || (noteLinks.linkedTaskId ? [noteLinks.linkedTaskId] : []), [noteLinks]);
  const linkedEventIds = useMemo(() => noteLinks.linkedEventIds || (noteLinks.linkedEventId ? [noteLinks.linkedEventId] : []), [noteLinks]);
  const linkedCredentialIds = useMemo(() => noteLinks.linkedCredentialIds || (noteLinks.linkedCredentialId ? [noteLinks.linkedCredentialId] : []), [noteLinks]);

  useEffect(() => {
    const fetchTasks = async () => {
      if (!linkedTaskIds.length) { setLinkedTasks([]); return; }
      setIsLoadingTasks(true);
      try {
        const resolved = await Promise.all(linkedTaskIds.map((id: string) => 
          getTablesDbRowCached({ databaseId: APPWRITE_CONFIG.DATABASES.KYLRIXFLOW, tableId: 'tasks', rowId: id },
          () => listFlowTasks([Query.equal('$id', id)]).then(res => res.rows[0] || null))
        ));
        setLinkedTasks(resolved.filter(Boolean));
      } finally { setIsLoadingTasks(false); }
    };
    fetchTasks();
  }, [linkedTaskIds]);

  useEffect(() => {
    const fetchEvents = async () => {
      if (!linkedEventIds.length) { setLinkedEvents([]); return; }
      setIsLoadingEvents(true);
      try {
        const resolved = await Promise.all(linkedEventIds.map((id: string) => 
          getTablesDbRowCached({ databaseId: APPWRITE_CONFIG.DATABASES.KYLRIXFLOW, tableId: 'events', rowId: id },
          () => listFlowEvents([Query.equal('$id', id)]).then(res => res.rows[0] || null))
        ));
        setLinkedEvents(resolved.filter(Boolean));
      } finally { setIsLoadingEvents(false); }
    };
    fetchEvents();
  }, [linkedEventIds]);

  useEffect(() => {
    const fetchSecrets = async () => {
      if (!linkedCredentialIds.length) { setLinkedSecrets([]); return; }
      setIsLoadingSecrets(true);
      try {
        const resolved = await Promise.all(linkedCredentialIds.map((id: string) => 
          getTablesDbRowCached({ databaseId: APPWRITE_CONFIG.DATABASES.VAULT, tableId: 'credentials', rowId: id },
          () => listKeepCredentials([Query.equal('$id', id)]).then(res => res.rows[0] || null))
        ));
        setLinkedSecrets(resolved.filter(Boolean));
      } finally { setIsLoadingSecrets(false); }
    };
    fetchSecrets();
  }, [linkedCredentialIds]);

  useEffect(() => {
    let active = true;
    const fetchCollaborators = async () => {
      if (!liveNote.$id || !isValidAppwriteRowId(liveNote.$id)) return;
      setIsLoadingCollaborators(true);
      try {
        const { getResourceCollaborators } = await import('@/lib/actions/client-ops');
        const { collaborators } = await getResourceCollaborators({ resourceId: liveNote.$id, resourceType: 'note' });
        if (active) setCollaboratorProfiles(collaborators);
      } catch (err) {
        console.error('Failed to fetch collaborators:', err);
      } finally {
        if (active) setIsLoadingCollaborators(false);
      }
    };
    fetchCollaborators();
    return () => { active = false; };
  }, [liveNote.$id]);

  useEffect(() => {
    let active = true;
    const fetchObjects = async () => {
      if (!liveNote.$id) return;
      try {
        const { getObjectsByParent } = await import('@/lib/actions/client-ops');
        const rows = await getObjectsByParent(liveNote.$id, 'note');
        if (active) setAttachedObjects(rows);
      } catch (err) {
        console.warn('[NoteDetailSidebar] Failed to load attached objects:', err);
      }
    };
    fetchObjects();
    return () => { active = false; };
  }, [liveNote.$id]);

  const getCursorLineNumber = useCallback(() => {
    const textarea = contentTextareaRef.current;
    if (!textarea) return 1;
    const value = textarea.value;
    const selectionStart = textarea.selectionStart;
    const beforeCursor = value.substring(0, selectionStart);
    return beforeCursor.split('\n').length;
  }, []);

  // hasCollaborators kept for external consumers if needed (no longer gates realtime)
  const _hasCollaborators = useMemo(() => collaboratorProfiles.length > 0, [collaboratorProfiles]);



  useEffect(() => {
    let active = true;
    const fetchSuggest = async () => {
      if (!liveNote.$id) return;
      setIsLoadingSuggestions(true);
      try {
        const { getCrossSuggestions } = await import('@/lib/actions/client-ops');
        const data = await getCrossSuggestions({
          sourceApp: 'note',
          sourceType: 'note',
          sourceId: liveNote.$id
        });
        if (active) setCrossSuggestions(data?.suggestions || []);
      } finally { if (active) setIsLoadingSuggestions(false); }
    };
    fetchSuggest();
    return () => { active = false; };
  }, [liveNote.$id]);

  // Handlers
  const handlePinToggle = useCallback(async () => {
    const pinned = isPinnedFunc(liveNote.$id);
    try {
      if (pinned) await unpinNoteFunc(liveNote.$id);
      else await pinNoteFunc(liveNote.$id);
      showSuccess(pinned ? 'Note unpinned' : 'Note pinned');
    } catch (err: any) {
      if (err.message?.includes('limit reached')) {
        openProUpgrade('Pinned Notes');
        return;
      }
      showError('Failed to update pin');
    }
  }, [isPinnedFunc, liveNote.$id, unpinNoteFunc, pinNoteFunc, showSuccess, openProUpgrade, showError]);

  const handleTogglePublic = useCallback(async () => {
    try {
      const updated = await toggleNoteVisibility(liveNote.$id);
      if (updated) {
        updateLocalAndParentNote(updated);
        showSuccess(updated.isPublic ? 'Note is now Public' : 'Note is now Private');
      }
    } catch (err: any) {
      if (err.message === 'VAULT_LOCKED') {
        showError('Vault Locked', 'Unlock vault to change visibility.');
        const unlocked = await promptSudo();
        if (unlocked) handleTogglePublic();
      } else {
        showError('Failed to update visibility');
      }
    }
  }, [liveNote.$id, toggleNoteVisibility, updateLocalAndParentNote, showSuccess, showError, promptSudo]);

  const rotateNoteLink = useCallback(() => setShowRotateConfirm(true), []);

  const handleConfirmedRotate = useCallback(async () => {
    setIsRotating(true);
    try {
      const unlocked = await promptSudo("unlock");
      if (unlocked) {
        const updated = await rotatePublicNoteLink(liveNote.$id);
        if (updated) {
          updateLocalAndParentNote(updated);
          if (updated.decryptionKey) {
            const shareUrl = getShareableUrl(liveNote.$id, updated.decryptionKey);
            navigator.clipboard.writeText(shareUrl);
            showSuccess('Public link rotated', 'New link copied to clipboard.');
          }
          setShowRotateConfirm(false);
        }
      }
    } catch (error: any) {
      showError('Rotate Failed', error.message || 'Failed to rotate link.');
    } finally {
      setIsRotating(false);
    }
  }, [promptSudo, liveNote.$id, rotatePublicNoteLink, updateLocalAndParentNote, getShareableUrl, showSuccess, showError]);

  const handleCopyShareLink = useCallback(async () => {
    if (!isPublic) {
      showError('Note is private', 'Make the note public before copying its link.');
      return;
    }

    const url = isT4Encrypted
      ? await getCurrentPublicNoteShareUrl(liveNote.$id, liveNote as any)
      : getShareableUrl(liveNote.$id);

    if (url) {
      await navigator.clipboard.writeText(url);
      showSuccess('Link copied to clipboard');
    } else {
      showError('Shared link unavailable', 'Could not resolve the shared note URL.');
    }
  }, [isPublic, isT4Encrypted, liveNote.$id, liveNote, getCurrentPublicNoteShareUrl, getShareableUrl, showSuccess, showError]);

  const handleDelete = useCallback(() => {
    onDelete(liveNote.$id);
    closeSidebar();
    closeOverlay();
  }, [onDelete, liveNote.$id, closeSidebar, closeOverlay]);

  const { setActiveDetail } = useSection();

  const handleBackClick = useCallback(() => {
    // Create persists on close; detail keeps compose session registered — sync engine flushes.
    if (onBack) {
      onBack();
    }
    closeSidebar();
    closeOverlay();
    setActiveDetail(null);
  }, [onBack, closeSidebar, closeOverlay, setActiveDetail]);

  const handleDismiss = useCallback(() => {
    closeSidebar();
  }, [closeSidebar]);

  const handleCreateTaskFromNote = useCallback(async () => {
    setIsCreatingTaskFromNote(true);
    try {
      const task = await createTaskFromNote(liveNote as any);
      if (task) {
        updateLocalAndParentNote({ ...liveNote, linkedTaskId: task.$id } as any);
        showSuccess('Goal created from note');
        setShowActionHub(false);
      }
    } catch (_err) {
      showError('Failed to create goal');
    } finally {
      setIsCreatingTaskFromNote(false);
    }
  }, [liveNote, updateLocalAndParentNote, showSuccess, showError, createTaskFromNote]);

  const handleAddToProject = useCallback(() => {
    setShowActionHub(false);
    if (!activeWorkspace || activeWorkspace.isPersonal) {
      showError('Switch to a workspace first');
      return;
    }
    if (!userCanUseProjects(getUserSubscriptionTier(user))) {
      openProUpgrade('Projects');
      return;
    }
    openUnified('add-to-project', {
      entityKind: 'note',
      entityId: liveNote.$id,
      entityTitle: liveNote.title || 'Note',
      workspaceId: activeWorkspace.id,
    });
  }, [activeWorkspace, user, liveNote, openUnified, openProUpgrade, showError]);

  const contentTextareaRef = useRef<HTMLTextAreaElement>(null);
  const [isContextDrawerOpen, setIsContextDrawerOpen] = useState(false);
  const [isDesktop, setIsDesktop] = useState(false);
  useEffect(() => {
    if (typeof window === 'undefined') return;
    const m = window.matchMedia('(min-width: 768px)');
    const on = () => setIsDesktop(m.matches);
    on();
    m.addEventListener('change', on);
    return () => m.removeEventListener('change', on);
  }, []);
  const { openSidebar: openNativeSidebar, closeSidebar: closeNativeSidebar } = useDynamicSidebar();
  const closeContextActions = useCallback(() => {
    setIsContextDrawerOpen(false);
    // Desktop context was stacked on the native right rail — pop it without closing the note.
    if (isDesktop) closeNativeSidebar();
  }, [isDesktop, closeNativeSidebar]);
  const [isExportDrawerOpen, setIsExportDrawerOpen] = useState(false);
  const [isAttachObjectPickerOpen, setIsAttachObjectPickerOpen] = useState(false);
  const [isObjectPermissionInfoOpen, setIsObjectPermissionInfoOpen] = useState(false);
  const [pendingBlockDelete, setPendingBlockDelete] = useState<ParsedObjectBlock | null>(null);
  const [_isAttachingObject, setIsAttachingObject] = useState(false);
  const objectUploadInputRef = useRef<HTMLInputElement | null>(null);
  // Allow attachment when: not readOnly AND (no role set = own-notes drawer context, OR explicitly owner/write-collab).
  // accessRole is only set by IdeaPageClient for shared/public note views — undefined means user is in their own notes.
  const canAttachSecondaryObject = !readOnly && (!accessRole || accessRole === 'owner' || accessRole === 'write-collab');
  const previousContentRef = useRef(content);
  const isPageLayout = layout === 'page';

  const renderContextActionsContent = useCallback((..._args: any[]) => renderContextActionsContent_ext({ _attachedObjects, _hasCollaborators, _isAttachingObject, _isLoadingEvents, _isLoadingSecrets, _isLoadingTasks, _linkedEvents, _linkedSecrets, _linkedTasks, _setIsPublic, allNotesRef, attachPickedObject, audioChunksRef, awaitingLocalCopy, canAttachSecondaryObject, closeContextActions, collaboratorProfiles, content, contentTextareaRef, crossSuggestions, displayTags, durationIntervalRef, getCursorLineNumber, handleAddToProject, handleBackClick, handleConfirmedRotate, handleContentChange, handleCopyShareLink, handleCreateTaskFromNote, handleDelete, handleDismiss, handlePinToggle, handleTagsChange, handleTitleChange, handleTogglePublic, hasRestoredScrollRef, insertObjectBlockAtCursor, isAttachObjectPickerOpen, isContextDrawerOpen, isCreatingTaskFromNote, isDesktop, isEncryptedNote, isExportDrawerOpen, isLoadingCollaborators, isLoadingSuggestions, isLocallyDecrypted, isObjectPermissionInfoOpen, isPageLayout, isPinnedFunc, isPublic, isRecording, isRotating, isT4Encrypted, isTagSelectorOpen, linkedCredentialIds, linkedEventIds, linkedTaskIds, liveNote, liveNoteRef, mediaRecorderRef, noteLinks, noteMeta, noteRef, objectUploadInputRef, onPickExternalFile, pendingBlockDelete, pendingSelRef, pinNoteFunc, previousContentRef, recordingDuration, recordingTimerRef, renderContextActionsContent, replaceContentWithSave, rotateNoteLink, scrollContainerRef, setAttachedObjects, setCollaboratorProfiles, setContent, setCrossSuggestions, setIsAttachObjectPickerOpen, setIsAttachingObject, setIsContextDrawerOpen, setIsCreatingTaskFromNote, setIsDesktop, setIsExportDrawerOpen, setIsLoadingCollaborators, setIsLoadingEvents, setIsLoadingSecrets, setIsLoadingSuggestions, setIsLoadingTasks, setIsLocallyDecrypted, setIsObjectPermissionInfoOpen, setIsRecording, setIsRotating, setIsTagSelectorOpen, setLinkedEvents, setLinkedSecrets, setLinkedTasks, setPendingBlockDelete, setRecordingDuration, setShowActionHub, setShowProjectLinker, setShowRotateConfirm, setTags, setTitle, setVaultUnlocked, shouldMaskEncrypted, showActionHub, showProjectLinker, showRotateConfirm, tags, title, toggleRecording, unpinNoteFunc, updateLocalAndParentNote, vaultUnlocked }, ..._args), [content, liveNote, note, canAttachSecondaryObject, openFileDrawer, openUnified, showSuccess, showError, closeContextActions]);

  useEffect(() => {
    // Mobile bottom drawer only — desktop opens native right rail directly from the More button.
    if (isDesktop) return;
    setIsDrawerOpen(isContextDrawerOpen);
    return () => setIsDrawerOpen(false);
  }, [isContextDrawerOpen, setIsDrawerOpen, isDesktop]);

  useEffect(() => {
    setIsDrawerOpen(isObjectPermissionInfoOpen);
    return () => setIsDrawerOpen(false);
  }, [isObjectPermissionInfoOpen, setIsDrawerOpen]);

  const displayTags = useMemo(() => tags.split(',').map((t: string) => t.trim()).filter(Boolean), [tags]);


  const toggleRecording = useCallback(async () => {
    if (isRecording) {
      if (mediaRecorderRef.current && mediaRecorderRef.current.state !== 'inactive') {
        mediaRecorderRef.current.stop();
      }
      setIsRecording(false);
    } else {
      if (!hasPaidKylrixPlan(user)) {
        openProUpgrade('Voice recording');
        return;
      }
      try {
        const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
        let options = { audioBitsPerSecond: 16000 };
        if (MediaRecorder.isTypeSupported('audio/webm;codecs=opus')) {
          (options as any).mimeType = 'audio/webm;codecs=opus';
        } else if (MediaRecorder.isTypeSupported('audio/ogg;codecs=opus')) {
          (options as any).mimeType = 'audio/ogg;codecs=opus';
        }

        const mediaRecorder = new MediaRecorder(stream, options);
        mediaRecorderRef.current = mediaRecorder;
        audioChunksRef.current = [];

        mediaRecorder.ondataavailable = (e) => {
          if (e.data.size > 0) {
            audioChunksRef.current.push(e.data);
          }
        };

        mediaRecorder.onstop = async () => {
          if (recordingTimerRef.current) clearTimeout(recordingTimerRef.current);
          if (durationIntervalRef.current) clearInterval(durationIntervalRef.current);

          const audioBlob = new Blob(audioChunksRef.current, { type: 'audio/webm' });
          const audioFile = new File([audioBlob], `voice_note_${Date.now()}.webm`, { type: 'audio/webm' });

          stream.getTracks().forEach(track => track.stop());

          try {
            const uploaded = await StorageService.uploadFile(audioFile, 'voice');
            
            // AUTHORITATIVE SYNC: Wire into objects table to prevent zombie attachments
            try {
              const line = getCursorLineNumber();
              await attachObject({
                parentId: liveNote.$id,
                parentKind: 'note',
                childId: uploaded.$id,
                childKind: 'voice',
                metadata: {
                  filename: audioFile.name,
                  mimeType: audioFile.type,
                  size: audioFile.size,
                  duration: recordingDuration,
                  insertLine: line
                }
              });
              // Refresh local objects list
              const { getObjectsByParent } = await import('@/lib/actions/client-ops');
              const rows = await getObjectsByParent(liveNote.$id, 'note');
              setAttachedObjects(rows);
              showSuccess('Voice note recorded', 'Attached to this note.');
            } catch (attachErr: any) {
              console.warn('[NoteDetailSidebar] Failed to register attachment in objects table:', attachErr);
              showError('Recording limit reached', attachErr.message || 'Could not attach voice note.');
            }
          } catch (error) {
            console.error('Failed to upload voice note:', error);
            showError('Recording failed', 'Could not save voice note.');
          }
        };

        mediaRecorder.start();
        setIsRecording(true);
        setRecordingDuration(0);

        durationIntervalRef.current = setInterval(() => {
          setRecordingDuration(prev => prev + 1);
        }, 1000);

        // Audio length limit removed for Pro/Teams users.

      } catch (err) {
        console.error("Failed to start recording:", err);
        showError('Permission denied', 'Microphone access is required to record voice notes.');
      }
    }
  }, [isRecording, showSuccess, showError]);


  const replaceContentWithSave = useCallback(async (nextContent: string) => {
    handleContentChange(nextContent);
  }, [handleContentChange]);

  const insertObjectBlockAtCursor = useCallback(async (block: string) => {
    const textarea = contentTextareaRef.current;
    const start = textarea ? textarea.selectionStart : content.length;
    const end = textarea ? textarea.selectionEnd : content.length;
    const needsLeadingBreak = start > 0 && !content.slice(Math.max(0, start - 2), start).includes('\n\n');
    const needsTrailingBreak = end < content.length && !content.slice(end, Math.min(content.length, end + 2)).includes('\n\n');
    const insertion = `${needsLeadingBreak ? '\n\n' : ''}${block}${needsTrailingBreak ? '\n\n' : '\n'}`;
    const nextContent = content.substring(0, start) + insertion + content.substring(end);
    const cursor = start + insertion.length;
    pendingSelRef.current = { start: cursor, end: cursor };
    await replaceContentWithSave(nextContent);
    if (textarea) {
      requestAnimationFrame(() => {
        try { textarea.focus(); textarea.setSelectionRange(cursor, cursor); } catch {}
      });
    }
  }, [content, replaceContentWithSave]);


  const attachPickedObject = useCallback(async (payload: { kind: string; entityId: string; item: any }) => {
    if (!canAttachSecondaryObject) {
      showError('No access', 'Only owners and write collaborators can attach objects.');
      return;
    }
    const kindToChildKind: Record<string, 'note' | 'task' | 'vault' | 'form' | 'event' | 'tag' | 'totp' | 'moment' | 'call'> = {
      note: 'note',
      goal: 'task',
      password: 'vault',
      form: 'form',
      event: 'event',
      tag: 'tag',
      totp: 'totp',
      moment: 'moment',
      call: 'call'};
    const childKind = kindToChildKind[payload.kind] || 'note';
    const theme = childKind === 'vault' || childKind === 'totp' ? 'vault' : childKind === 'task' || childKind === 'event' || childKind === 'form' ? 'flow' : 'idea';
    await attachObject({
      parentId: liveNote.$id,
      parentKind: 'note',
      childId: payload.entityId,
      childKind,
      metadata: { insertLine: getCursorLineNumber(), sourceKind: payload.kind }});
    await insertObjectBlockAtCursor(serializeObjectBlock({
      childId: payload.entityId,
      childKind: childKind as any,
      line: getCursorLineNumber(),
      appTheme: theme as any,
      label: payload.item?.title || payload.item?.name || payload.item?.issuer || payload.item?.caption || undefined}));
    const { getObjectsByParent } = await import('@/lib/actions/client-ops');
    setAttachedObjects(await getObjectsByParent(liveNote.$id, 'note'));
  }, [canAttachSecondaryObject, showError, liveNote.$id, getCursorLineNumber, insertObjectBlockAtCursor]);

  const onPickExternalFile = useCallback(async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;
    event.target.value = '';
    if (!canAttachSecondaryObject) {
      showError('No access', 'Only owners and write collaborators can attach objects.');
      return;
    }
    setIsAttachingObject(true);
    try {
      const bucketId = APPWRITE_CONFIG.BUCKETS.GENERAL_STORAGE;
      const uploaded = await StorageService.uploadFile(file, bucketId);
      const childKind = file.type.startsWith('image/') ? 'image' : 'file';
      const relation = await attachObject({
        parentId: liveNote.$id,
        parentKind: 'note',
        childId: uploaded.$id,
        childKind,
        metadata: { bucketId, fileName: file.name, mimeType: file.type, size: file.size, insertLine: getCursorLineNumber() }});
      await insertObjectBlockAtCursor(serializeObjectBlock({
        objectId: relation?.$id,
        childId: uploaded.$id,
        childKind,
        bucketId,
        label: file.name,
        line: getCursorLineNumber(),
        appTheme: 'idea',
        metadata: { mimeType: file.type, fileName: file.name }}));
      const { getObjectsByParent } = await import('@/lib/actions/client-ops');
      setAttachedObjects(await getObjectsByParent(liveNote.$id, 'note'));
      showSuccess('Attachment added');
    } catch (err: any) {
      showError('Attach failed', err?.message || 'Unable to upload and attach file.');
    } finally {
      setIsAttachingObject(false);
      closeContextActions();
    }
  }, [canAttachSecondaryObject, showError, liveNote.$id, getCursorLineNumber, insertObjectBlockAtCursor, showSuccess, closeContextActions]);

  useEffect(() => {
    const previous = previousContentRef.current;
    if (previous === content) return;
    previousContentRef.current = content;
    const removedBlocks = getRemovedObjectBlocks(previous, content);
    if (!removedBlocks.length) return;

    void (async () => {
      try {
        const { detachObjectByRelation } = await import('@/lib/actions/client-ops');
        for (const block of removedBlocks) {
          await detachObjectByRelation({
            parentId: liveNote.$id,
            childId: block.payload.childId});
          if (block.payload.childKind === 'file' || block.payload.childKind === 'image') {
            const bucketId = block.payload.bucketId || APPWRITE_CONFIG.BUCKETS.GENERAL_STORAGE;
            try {
              await storage.deleteFile(bucketId, block.payload.childId);
            } catch {
              // Ignore delete races; relation cleanup is authoritative.
            }
          }
        }
        const { getObjectsByParent } = await import('@/lib/actions/client-ops');
        setAttachedObjects(await getObjectsByParent(liveNote.$id, 'note'));
      } catch (err) {
        console.warn('Failed object reconciliation after markdown update:', err);
      }
    })();
  }, [content, liveNote.$id]);

  // --- RENDER ---
  if (awaitingLocalCopy) {
    return (
      <div
        className={`note-detail-sidebar-root flex flex-col overflow-hidden text-white w-full ${
          isPageLayout ? 'min-h-0 bg-[#000000]' : 'h-full bg-[#161412]'
        }`}
      >
        <div className="flex-1 flex flex-col gap-3 p-5 animate-pulse">
          <div className="h-8 w-2/3 rounded-xl bg-white/[0.06]" />
          <div className="h-4 w-full rounded-lg bg-white/[0.04]" />
          <div className="h-4 w-5/6 rounded-lg bg-white/[0.04]" />
          <div className="h-4 w-4/6 rounded-lg bg-white/[0.04]" />
          <p className="mt-4 text-[#9B9691] text-xs font-semibold">Waiting for local copy…</p>
        </div>
      </div>
    );
  }

  return <NoteDetailSidebarView {...({ _attachedObjects, _hasCollaborators, _isAttachingObject, _isLoading, _isLoadingEvents, _isLoadingSecrets, _isLoadingTasks, _linkedEvents, _linkedSecrets, _linkedTasks, _setIsPublic, accessRole, active, allNotesRef, attachPickedObject, audioBlob, audioChunksRef, audioFile, awaitingLocalCopy, beforeCursor, block, bucketId, canAttachSecondaryObject, channel, childKind, closeContextActions, collaboratorProfiles, content, contentTextareaRef, crossSuggestions, cur, cursor, data, decrypted, displayTags, durationIntervalRef, end, exists, fetchCollaborators, fetchEvents, fetchObjects, fetchSecrets, fetchSuggest, fetchTasks, file, getCursorLineNumber, handleAddToProject, handleBackClick, handleConfirmedRotate, handleContentChange, handleCopyShareLink, handleCreateTaskFromNote, handleDelete, handleDismiss, handlePinToggle, handleTagsChange, handleTitleChange, handleTogglePublic, hasRestoredScrollRef, hasSeedBody, healDecryption, inContext, insertObjectBlockAtCursor, insertion, isAttachObjectPickerOpen, isContextDrawerOpen, isCreatingTaskFromNote, isDesktop, isDirty, isEncryptedNote, isExportDrawerOpen, isLoadingCollaborators, isLoadingSuggestions, isLocallyDecrypted, isObjectPermissionInfoOpen, isPageLayout, isPinnedFunc, isPublic, isRecording, isRotating, isT4Encrypted, isTagSelectorOpen, lastEdit, layout, line, linkedCredentialIds, linkedEventIds, linkedTaskIds, liveNote, liveNoteRef, m, mediaRecorder, mediaRecorderRef, needsLeadingBreak, needsTrailingBreak, next, nextContent, normalizedTags, note, noteId, noteLinks, noteMeta, noteRef, objectUploadInputRef, on, onBack, onClose, onDelete, onPickExternalFile, onUpdate, options, pendingBlockDelete, pendingSelRef, pinNoteFunc, pinned, previous, previousContentRef, raw, readOnly, recordingDuration, recordingTimerRef, relation, remoteNewer, removedBlocks, renderContextActionsContent, replaceContentWithSave, resolved, rotateNoteLink, rows, saved, scrollContainerRef, seed, selectionStart, setAttachedObjects, setCollaboratorProfiles, setContent, setCrossSuggestions, setIsAttachObjectPickerOpen, setIsAttachingObject, setIsContextDrawerOpen, setIsCreatingTaskFromNote, setIsDesktop, setIsExportDrawerOpen, setIsLoadingCollaborators, setIsLoadingEvents, setIsLoadingSecrets, setIsLoadingSuggestions, setIsLoadingTasks, setIsLocallyDecrypted, setIsObjectPermissionInfoOpen, setIsRecording, setIsRotating, setIsTagSelectorOpen, setLinkedEvents, setLinkedSecrets, setLinkedTasks, setPendingBlockDelete, setRecordingDuration, setShowActionHub, setShowProjectLinker, setShowRotateConfirm, setTags, setTitle, setVaultUnlocked, shareUrl, shouldMaskEncrypted, showActionHub, showExpandButton, showHeaderDeleteButton, showProjectLinker, showRotateConfirm, start, stream, tags, task, text, textarea, theme, title, titleActive, toggleRecording, unlocked, unpinNoteFunc, unsub, updateLocalAndParentNote, updated, uploaded, url, userId, value, vaultUnlocked })} />;
}
