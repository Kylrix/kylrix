'use client';

import React, { useState, useEffect, useMemo, useRef, useCallback } from 'react';
import { Notes } from '@/types/appwrite';

import NoteContentRenderer from '@/components/NoteContentRenderer';
import { VoiceNotePlayer } from '@/components/LinkRenderer';

import {
  Mic,
  Square,
  FolderKanban,
  Trash2 as TrashIcon,
  Paperclip as PaperClipIcon,
  ExternalLink as OpenIcon,
  Pin as PinIcon,
  ArrowLeft as BackIcon,
  Link2 as LinkIcon,
  Lock as LockIcon,
  Unlock as UnlockIcon,
  Globe as PublicIcon,
  RefreshCw as RefreshIcon,
  X as CloseIcon,
  Sparkles as ActionIcon,
  Video as VideoCallIcon,
  CheckSquare as TaskIcon,
  Calendar as EventIcon,
  Key as KeyIcon,
  Copy as CopyIcon,
  Tag as TagIcon,
  Plus,
  Clipboard,
  MoreVertical,
  Bold,
  Italic,
  Heading1,
  Code2,
  Info
} from 'lucide-react';

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
import { useProUpgrade } from '@/context/ProUpgradeContext';
import { useDynamicSidebar } from '@/components/ui/DynamicSidebar';
import { useUnifiedDrawer } from '@/context/UnifiedDrawerContext';
import { exportToMarkdown, exportToPDF, exportToDOCX } from '@/lib/utils/export';
import { useAuth } from '@/lib/auth';
import { hasPaidKylrixPlan } from '@/lib/utils';
import { IdentityAvatar } from '@/components/common/IdentityBadge';
import { useNotes } from '@/context/NotesContext';
import { isEphemeralComposeNoteId } from '@/lib/notes/compose-draft-registry';
import { useDataNexus } from '@/context/DataNexusContext';
import { useSection } from '@/context/SectionContext';
import { useDrawerState } from '@/components/ui/DrawerStateContext';
import { ConfirmationDialog } from '@/components/ConfirmationDialog';
import { formatNoteCreatedDate, formatNoteUpdatedDate } from '@/lib/date-utils';
import { getTablesDbRowCached } from '@/lib/ecosystem/tablesdb-row-cache';
import { 
  getNote,
  listFlowTasks, 
  listFlowEvents, 
  listKeepCredentials, 
  Query, 
  realtime,
  toggleNoteVisibility, 
  rotatePublicNoteLink, 
  getShareableUrl, 
  getCurrentPublicNoteShareUrl, 
  getNotePublicState, 
  decryptPublicEncryptedNote, 
  createTaskFromNote 
} from '@/lib/appwrite';
import { APPWRITE_CONFIG } from '@/lib/appwrite/config';
import { formatFileSize } from '@/lib/utils';
import { StorageService } from '@/lib/services/storage';
import { useCallLauncher } from '@/context/CallLauncherContext';
import { ShareLockButton } from '@/components/share/ShareLockButton';
import { ecosystemSecurity } from '@/lib/ecosystem/security';
import { useAutosave } from '@/hooks/useAutosave';
import { resolveResourceOwnerId, isValidAppwriteRowId } from '@/lib/utils/resource-ids';
import { pickNoteAutosavePayload } from '@/lib/appwrite/note';
import { attachObject } from '@/lib/actions/client-ops';
import ProjectLinker from '@/components/projects/ProjectLinker';
import ProjectAddObjectModal from '@/components/projects/ProjectAddObjectModal';
import {
  applyMarkdownWrap,
  getRemovedObjectBlocks,
  parseObjectBlocks,
  serializeObjectBlock,
  type ParsedObjectBlock,
} from '@/lib/note-object-secondary';
import { storage } from '@/lib/appwrite/client';

export type NoteAccessRole = 'owner' | 'write-collab' | 'read-collab' | 'guest' | 'public';

export interface NoteDetailSidebarProps {
  note: Notes;
  onUpdate: (updatedNote: Notes) => void;
  onDelete: (noteId: string) => void;
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
  onBack,
  layout = 'drawer',
  showExpandButton = true,
  showHeaderDeleteButton = true,
  isLoading = false,
  readOnly = false,
  accessRole,
}: NoteDetailSidebarProps) {
  const successColor = '#10B981';
  const { open: openUnified } = useUnifiedDrawer();
  const { openProUpgrade } = useProUpgrade();
  const { user } = useAuth();
  const { promptSudo } = useSudo();
  const { setIsDrawerOpen } = useDrawerState();
  const { showSuccess, showError } = useToast();
  const { closeSidebar } = useDynamicSidebar();
  const { openCallLauncher } = useCallLauncher();
  const [isTagSelectorOpen, setIsTagSelectorOpen] = useState(false);
  const { ecosystemTags, refreshEcosystemTags } = useTask();
  const { persistScrollPosition, getScrollPosition } = useSection();
  const scrollContainerRef = useRef<HTMLDivElement>(null);

  const { setCachedData } = useDataNexus();
  const { notes: allNotes, isPinned, pinNote, unpinNote, pushLiveNote } = useNotes();
  const isPinnedFunc = useMemo(() => typeof isPinned === 'function' ? isPinned : () => false, [isPinned]);
  const pinNoteFunc = useMemo(() => typeof pinNote === 'function' ? pinNote : async () => {}, [pinNote]);
  const unpinNoteFunc = useMemo(() => typeof unpinNote === 'function' ? unpinNote : async () => {}, [unpinNote]);
  const [realtimeNote, setRealtimeNote] = useState<Notes | null>(null);
  const noteRef = useRef(note);
  const allNotesRef = useRef<Notes[]>([]);
  const liveNote = useMemo(
    () => (realtimeNote?.$id === note.$id ? realtimeNote : (allNotes || []).find((candidate: any) => candidate.$id === note.$id) || note),
    [allNotes, note, realtimeNote]
  );

  useEffect(() => {
    allNotesRef.current = Array.isArray(allNotes) ? allNotes : [];
  }, [allNotes]);

  useEffect(() => {
    if (scrollContainerRef.current && liveNote?.$id) {
      const saved = getScrollPosition(`note_detail:${liveNote.$id}`);
      scrollContainerRef.current.scrollTop = saved;
    }
  }, [liveNote?.$id, getScrollPosition]);

  const updateLocalAndParentNote = useCallback((updated: Notes) => {
    onUpdate(updated);
    setRealtimeNote(updated);
  }, [onUpdate]);

  useEffect(() => {
    noteRef.current = note;
  }, [note]);

  // Fetch note fully on mount/change
  useEffect(() => {
    if (liveNote?.$id) {
      void refreshEcosystemTags();
    }
  }, [liveNote?.$id, refreshEcosystemTags]);

  useEffect(() => {
    if (note.$id && isEphemeralComposeNoteId(note.$id)) {
      const fromContext = allNotesRef.current.find((candidate) => candidate.$id === note.$id);
      if (fromContext && !isDirtyRef.current) {
        updateLocalAndParentNote(fromContext);
      }
      return;
    }

    setRealtimeNote(null);
    let active = true;
    const fetchFullNote = async () => {
      try {
        const contextNote = allNotesRef.current.find((candidate) => candidate.$id === note.$id);
        const full = await getNote(note.$id);
        if (active && full) {
          let resolved = full as Notes;
          const meta = (() => {
            try { return JSON.parse(full.metadata || '{}'); } catch { return {}; }
          })();
          const isT4 = (meta?.isEncrypted === true || meta?.isEncrypted === 'true') && (meta?.encryptionVersion === 'T4' || meta?.encryptionVersion === 'T5') || !!full.dek;
          if (isT4 && ecosystemSecurity.status.isUnlocked && !meta?.clientDecrypted) {
            const decrypted = await decryptPublicEncryptedNote(full);
            if (decrypted) resolved = decrypted;
          }
          if (contextNote) {
            const contextContent = contextNote.content || '';
            const resolvedContent = resolved.content || '';
            if (contextContent.length > resolvedContent.length || contextContent !== resolvedContent) {
              resolved = {
                ...resolved,
                title: contextNote.title ?? resolved.title,
                content: contextNote.content,
                tags: contextNote.tags ?? resolved.tags,
              };
            }
          }
          if (!isDirtyRef.current) {
            updateLocalAndParentNote(resolved);
          }
        }
      } catch (err) {
        console.error('Failed to fetch full note:', err);
      }
    };
    fetchFullNote();
    return () => { active = false; };
  }, [note.$id, updateLocalAndParentNote]);
  
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

  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);

  const [isDirty, setIsDirty] = useState(false);
  const isDirtyRef = useRef(false);
  const loadedNoteIdRef = useRef<string | null>(null);
  const lastAppliedServerTsRef = useRef('');
  const markDirty = useCallback(() => {
    isDirtyRef.current = true;
    setIsDirty(true);
  }, []);
  
  const [title, setTitle] = useState(liveNote.title || '');
  const [content, setContent] = useState(liveNote.content || '');
  const [tags, setTags] = useState(liveNote.tags?.join(', ') || '');
  const [isPublic, setIsPublic] = useState(getNotePublicState(liveNote));

  const [isLoadingCollaborators, setIsLoadingCollaborators] = useState(false);
  const [collaboratorProfiles, setCollaboratorProfiles] = useState<any[]>([]);
  const [isLoadingTasks, setIsLoadingTasks] = useState(false);
  const [linkedTasks, setLinkedTasks] = useState<any[]>([]);
  const [isLoadingEvents, setIsLoadingEvents] = useState(false);
  const [linkedEvents, setLinkedEvents] = useState<any[]>([]);
  const [isLoadingSecrets, setIsLoadingSecrets] = useState(false);
  const [linkedSecrets, setLinkedSecrets] = useState<any[]>([]);

  const [showActionHub, setShowActionHub] = useState(false);
  const [showRotateConfirm, setShowRotateConfirm] = useState(false);
  const [showProjectLinker, setShowProjectLinker] = useState(false);
  const [isRotating, setIsRotating] = useState(false);
  const [isCreatingTaskFromNote, setIsCreatingTaskFromNote] = useState(false);
  const [crossSuggestions, setCrossSuggestions] = useState<any[]>([]);
  const [isLoadingSuggestions, setIsLoadingSuggestions] = useState(false);
  const [isLocallyDecrypted, setIsLocallyDecrypted] = useState(false);
  const [attachedObjects, setAttachedObjects] = useState<any[]>([]);

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
  const isT4Encrypted = useMemo(() => (noteMeta?.isEncrypted === true || noteMeta?.isEncrypted === 'true') && (noteMeta?.encryptionVersion === 'T4' || noteMeta?.encryptionVersion === 'T5') || !!liveNote.dek, [noteMeta, liveNote.dek]);
  const isEncryptedNote = useMemo(() => isT4Encrypted && !noteMeta?.clientDecrypted && !isLocallyDecrypted, [isT4Encrypted, noteMeta, isLocallyDecrypted]);
  const isT4EncryptedPublicNote = useMemo(() => isPublic && isT4Encrypted, [isPublic, isT4Encrypted]);
  const shouldMaskEncrypted = useMemo(() => isEncryptedNote && !vaultUnlocked, [isEncryptedNote, vaultUnlocked]);

  // Sync local fields from server only when switching notes or when not dirty.
  useEffect(() => {
    const noteId = liveNote.$id;
    if (!noteId) return;

    const serverTs = String(liveNote.updatedAt || liveNote.$updatedAt || '');

    if (loadedNoteIdRef.current !== noteId) {
      loadedNoteIdRef.current = noteId;
      isDirtyRef.current = false;
      lastAppliedServerTsRef.current = serverTs;
      setTitle(liveNote.title || '');
      setContent(liveNote.content || '');
      setTags(liveNote.tags?.join(', ') || '');
      setIsPublic(getNotePublicState(liveNote));
      return;
    }

    if (isDirtyRef.current) return;
    lastAppliedServerTsRef.current = serverTs;
    setTitle(liveNote.title || '');
    setContent(liveNote.content || '');
    setTags(liveNote.tags?.join(', ') || '');
    setIsPublic(getNotePublicState(liveNote));
  }, [liveNote]);



  // Automatically heal T4 encrypted state if vault is unlocked
  useEffect(() => {
    if (isEncryptedNote && vaultUnlocked) {
      const healDecryption = async () => {
        try {
          const decrypted = await decryptPublicEncryptedNote(liveNote);
          if (decrypted) {
            setTitle(decrypted.title || '');
            setContent(decrypted.content || '');
            setTags(decrypted.tags?.join(', ') || '');
            setIsLocallyDecrypted(true);
            isDirtyRef.current = false;
            lastAppliedServerTsRef.current = String(decrypted.updatedAt || decrypted.$updatedAt || '');
            updateLocalAndParentNote(decrypted);
            showSuccess('Note decrypted', 'Content is now visible.');
          }
        } catch (err) {
          console.error('[NoteSidebar] Auto-decryption failed:', err);
        }
      };
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
  const linkedTaskIds = useMemo(() => liveNote.linkedTaskIds || (liveNote.linkedTaskId ? [liveNote.linkedTaskId] : []), [liveNote]);
  const linkedEventIds = useMemo(() => liveNote.linkedEventIds || (liveNote.linkedEventId ? [liveNote.linkedEventId] : []), [liveNote]);
  const linkedCredentialIds = useMemo(() => liveNote.linkedCredentialIds || (liveNote.linkedCredentialId ? [liveNote.linkedCredentialId] : []), [liveNote]);

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

  const hasCollaborators = useMemo(() => {
    return collaboratorProfiles.length > 0;
  }, [collaboratorProfiles]);

  useEffect(() => {
    if (!liveNote.$id) return;
    if (isLoadingCollaborators) return;
    if (!hasCollaborators) {
      setRealtimeNote(null);
      return;
    }

    const channel = `databases.${APPWRITE_CONFIG.DATABASES.NOTE}.collections.${APPWRITE_CONFIG.TABLES.NOTE.NOTES}.documents.${liveNote.$id}`;
    const unsubscribe = realtime.subscribe(channel, (response) => {
      const payload = response.payload as Notes;
      if (!payload?.$id) return;

      const isCreate = response.events.some((event) => event.includes('.create'));
      const isUpdate = response.events.some((event) => event.includes('.update'));
      const isDelete = response.events.some((event) => event.includes('.delete'));

      if (isDelete) {
        setRealtimeNote(null);
        return;
      }

      if (!isCreate && !isUpdate) return;

      setRealtimeNote((current) => {
        if (isDirtyRef.current) return current;
        const base = current || noteRef.current;
        return base ? { ...base, ...payload } : payload;
      });
    });

    return () => {
      if (typeof unsubscribe === 'function') {
        (unsubscribe as any)();
      } else if (unsubscribe && typeof (unsubscribe as any).unsubscribe === 'function') {
        (unsubscribe as any).unsubscribe();
      }
    };
  }, [liveNote.$id, hasCollaborators, isLoadingCollaborators]);

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

  const candidateNote = useMemo<Notes>(() => ({
    ...liveNote,
    title,
    content,
    format: liveNote.format || 'markdown',
    tags: tags.split(',').map((t: string) => t.trim()).filter(Boolean),
  }), [liveNote, title, content, tags]);

  const candidateNoteRef = useRef(candidateNote);
  candidateNoteRef.current = candidateNote;

  const canEditNote = Boolean(liveNote.$id) && !shouldMaskEncrypted && !isLoading && !readOnly;

  const { isSaving: isAutosaving, forceSave } = useAutosave(candidateNote, {
    onSave: (savedNote: Notes) => {
      if (candidateNoteRef.current.content === savedNote.content && candidateNoteRef.current.title === savedNote.title) {
        isDirtyRef.current = false;
        setIsDirty(false);
      }
      lastAppliedServerTsRef.current = String(savedNote.updatedAt || savedNote.$updatedAt || '');
      updateLocalAndParentNote(savedNote);
    },
    onError: () => {
      showError('Save failed', 'Your changes are still on screen. We will retry automatically.');
    },
    enabled: canEditNote && isDirty && !readOnly,
    isDirty: isDirty,
  });

  useEffect(() => {
    return () => {
      if (!isDirtyRef.current || !candidateNoteRef.current.$id || shouldMaskEncrypted) return;
      void forceSave(candidateNoteRef.current);
    };
  }, [forceSave, shouldMaskEncrypted]);

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
    setShowDeleteConfirm(false);
  }, [onDelete, liveNote.$id]);

  const handleBackClick = useCallback(async () => {
    if (isDirtyRef.current && liveNote.$id && !shouldMaskEncrypted) {
      await forceSave(candidateNote);
    }

    if (onBack) {
      onBack();
    } else {
      closeSidebar();
    }
  }, [onBack, closeSidebar, liveNote.$id, shouldMaskEncrypted, forceSave, candidateNote]);

  const handleDismiss = useCallback(async () => {
    if (isDirtyRef.current && liveNote.$id && !shouldMaskEncrypted) {
      await forceSave(candidateNote);
    }
    closeSidebar();
  }, [closeSidebar, liveNote.$id, shouldMaskEncrypted, forceSave, candidateNote]);

  const handleCreateTaskFromNote = useCallback(async () => {
    setIsCreatingTaskFromNote(true);
    try {
      const task = await createTaskFromNote(liveNote as any);
      if (task) {
        updateLocalAndParentNote({ ...liveNote, linkedTaskId: task.$id } as any);
        showSuccess('Goal created from note');
        setShowActionHub(false);
      }
    } catch (err) {
      showError('Failed to create goal');
    } finally {
      setIsCreatingTaskFromNote(false);
    }
  }, [liveNote, updateLocalAndParentNote, showSuccess, showError, createTaskFromNote]);

  const handleStartNoteHuddle = useCallback(() => {
    const ownerId = liveNote.userId;
    const collaborators = Array.isArray(liveNote.collaborators) 
        ? liveNote.collaborators.map((c: any) => typeof c === 'string' ? c : c.userId || c.id)
        : [];
    const participantIds = Array.from(new Set([ownerId, ...collaborators].filter(Boolean)));

    openCallLauncher({
      source: 'note',
      noteId: liveNote.$id,
      participantIds,
      title: liveNote.title ? `Huddle: ${liveNote.title}` : 'Note Huddle',
    });
  }, [liveNote, openCallLauncher]);

  const contentTextareaRef = useRef<HTMLTextAreaElement>(null);
  const [isContextDrawerOpen, setIsContextDrawerOpen] = useState(false);
  const [isAttachObjectPickerOpen, setIsAttachObjectPickerOpen] = useState(false);
  const [isObjectPermissionInfoOpen, setIsObjectPermissionInfoOpen] = useState(false);
  const [pendingBlockDelete, setPendingBlockDelete] = useState<ParsedObjectBlock | null>(null);
  const [isAttachingObject, setIsAttachingObject] = useState(false);
  const objectUploadInputRef = useRef<HTMLInputElement | null>(null);
  const [contentMode, setContentMode] = useState<'edit' | 'preview'>(readOnly ? 'preview' : 'edit');
  // Allow attachment when: not readOnly AND (no role set = own-notes drawer context, OR explicitly owner/write-collab).
  // accessRole is only set by IdeaPageClient for shared/public note views — undefined means user is in their own notes.
  const canAttachSecondaryObject = !readOnly && (!accessRole || accessRole === 'owner' || accessRole === 'write-collab');
  const previousContentRef = useRef(content);

  // Force preview mode when readOnly
  useEffect(() => {
    if (readOnly) setContentMode('preview');
  }, [readOnly]);
  const isPageLayout = layout === 'page';

  useEffect(() => {
    setIsDrawerOpen(isContextDrawerOpen);
    return () => setIsDrawerOpen(false);
  }, [isContextDrawerOpen, setIsDrawerOpen]);

  useEffect(() => {
    setIsDrawerOpen(isObjectPermissionInfoOpen);
    return () => setIsDrawerOpen(false);
  }, [isObjectPermissionInfoOpen, setIsDrawerOpen]);

  const displayTags = useMemo(() => tags.split(',').map((t: string) => t.trim()).filter(Boolean), [tags]);

  const currentAttachments = useMemo(() => {
      if (liveNote.attachments && Array.isArray(liveNote.attachments)) {
          try {
              return liveNote.attachments.map((a: any) => typeof a === 'string' ? JSON.parse(a) : a);
          } catch { return []; }
      }
      return [];
  }, [liveNote.attachments]);

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

  const insertTextAtCursor = useCallback(async (text: string) => {
    const textarea = contentTextareaRef.current;
    let nextContent = content;
    if (textarea) {
      const start = textarea.selectionStart;
      const end = textarea.selectionEnd;
      nextContent = content.substring(0, start) + text + content.substring(end);
      setContent(nextContent);
      markDirty();

      setTimeout(() => {
        textarea.focus();
        textarea.setSelectionRange(start + text.length, start + text.length);
      }, 50);
    } else {
      nextContent = content + text;
      setContent(nextContent);
      markDirty();
    }

    try {
      const { updateNote: apiUpdateNote } = await import('@/lib/actions/client-ops');
      const saved = await apiUpdateNote(
        liveNote.$id,
        pickNoteAutosavePayload({
          content: nextContent,
          title,
          format: liveNote.format || 'markdown',
          tags: tags.split(',').map((t: string) => t.trim()).filter(Boolean),
        })
      );
      if (saved) {
        isDirtyRef.current = false;
        lastAppliedServerTsRef.current = String(saved.updatedAt || saved.$updatedAt || '');
        updateLocalAndParentNote(saved as Notes);
      }
    } catch (err) {
      console.error('Failed to run immediate save on voice note insert:', err);
    }
  }, [content, liveNote.$id, updateLocalAndParentNote, title, tags, markDirty]);

  const replaceContentWithSave = useCallback(async (nextContent: string) => {
    setContent(nextContent);
    markDirty();
    try {
      const { updateNote: apiUpdateNote } = await import('@/lib/actions/client-ops');
      const saved = await apiUpdateNote(
        liveNote.$id,
        pickNoteAutosavePayload({
          content: nextContent,
          title,
          format: liveNote.format || 'markdown',
          tags: tags.split(',').map((t: string) => t.trim()).filter(Boolean),
        })
      );
      if (saved) {
        isDirtyRef.current = false;
        lastAppliedServerTsRef.current = String(saved.updatedAt || saved.$updatedAt || '');
        updateLocalAndParentNote(saved as Notes);
      }
    } catch (err) {
      console.error('Failed to save content update:', err);
    }
  }, [liveNote.$id, title, liveNote.format, tags, markDirty, updateLocalAndParentNote]);

  const insertObjectBlockAtCursor = useCallback(async (block: string) => {
    const textarea = contentTextareaRef.current;
    const start = textarea ? textarea.selectionStart : content.length;
    const end = textarea ? textarea.selectionEnd : content.length;
    const needsLeadingBreak = start > 0 && !content.slice(Math.max(0, start - 2), start).includes('\n\n');
    const needsTrailingBreak = end < content.length && !content.slice(end, Math.min(content.length, end + 2)).includes('\n\n');
    const insertion = `${needsLeadingBreak ? '\n\n' : ''}${block}${needsTrailingBreak ? '\n\n' : '\n'}`;
    const nextContent = content.substring(0, start) + insertion + content.substring(end);
    await replaceContentWithSave(nextContent);
    if (textarea) {
      setTimeout(() => {
        textarea.focus();
        const cursor = start + insertion.length;
        textarea.setSelectionRange(cursor, cursor);
      }, 50);
    }
  }, [content, replaceContentWithSave]);

  const attachExternalLink = useCallback(async () => {
    if (!canAttachSecondaryObject) {
      showError('No access', 'Only owners and write collaborators can attach objects.');
      return;
    }
    const href = window.prompt('Paste a URL to attach');
    if (!href) return;
    setIsAttachingObject(true);
    try {
      await attachObject({
        parentId: liveNote.$id,
        parentKind: 'note',
        childId: href,
        childKind: 'link',
        metadata: { href, insertLine: getCursorLineNumber() },
      });
      await insertObjectBlockAtCursor(serializeObjectBlock({
        childId: href,
        childKind: 'link',
        href,
        line: getCursorLineNumber(),
        appTheme: 'idea',
      }));
      const { getObjectsByParent } = await import('@/lib/actions/client-ops');
      setAttachedObjects(await getObjectsByParent(liveNote.$id, 'note'));
      showSuccess('Link attached');
    } catch (err: any) {
      showError('Attach failed', err?.message || 'Unable to attach link.');
    } finally {
      setIsAttachingObject(false);
      setIsContextDrawerOpen(false);
    }
  }, [canAttachSecondaryObject, showError, liveNote.$id, getCursorLineNumber, insertObjectBlockAtCursor, showSuccess]);

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
      call: 'call',
    };
    const childKind = kindToChildKind[payload.kind] || 'note';
    const theme = childKind === 'vault' || childKind === 'totp' ? 'vault' : childKind === 'task' || childKind === 'event' || childKind === 'form' ? 'flow' : 'idea';
    await attachObject({
      parentId: liveNote.$id,
      parentKind: 'note',
      childId: payload.entityId,
      childKind,
      metadata: { insertLine: getCursorLineNumber(), sourceKind: payload.kind },
    });
    await insertObjectBlockAtCursor(serializeObjectBlock({
      childId: payload.entityId,
      childKind: childKind as any,
      line: getCursorLineNumber(),
      appTheme: theme as any,
      label: payload.item?.title || payload.item?.name || payload.item?.issuer || payload.item?.caption || undefined,
    }));
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
        metadata: { bucketId, fileName: file.name, mimeType: file.type, size: file.size, insertLine: getCursorLineNumber() },
      });
      await insertObjectBlockAtCursor(serializeObjectBlock({
        objectId: relation?.$id,
        childId: uploaded.$id,
        childKind,
        bucketId,
        label: file.name,
        line: getCursorLineNumber(),
        appTheme: 'idea',
        metadata: { mimeType: file.type, fileName: file.name },
      }));
      const { getObjectsByParent } = await import('@/lib/actions/client-ops');
      setAttachedObjects(await getObjectsByParent(liveNote.$id, 'note'));
      showSuccess('Attachment added');
    } catch (err: any) {
      showError('Attach failed', err?.message || 'Unable to upload and attach file.');
    } finally {
      setIsAttachingObject(false);
      setIsContextDrawerOpen(false);
    }
  }, [canAttachSecondaryObject, showError, liveNote.$id, getCursorLineNumber, insertObjectBlockAtCursor, showSuccess]);

  const applyInlineFormatting = useCallback((left: string, right = left) => {
    const textarea = contentTextareaRef.current;
    if (!textarea) return;
    const start = textarea.selectionStart;
    const end = textarea.selectionEnd;
    const { next, cursorStart, cursorEnd } = applyMarkdownWrap(content, start, end, left, right);
    setContent(next);
    markDirty();
    setTimeout(() => {
      textarea.focus();
      textarea.setSelectionRange(cursorStart, cursorEnd);
    }, 0);
  }, [content, markDirty]);

  const onEditorKeyDown = useCallback((event: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (event.key !== 'Backspace' && event.key !== 'Delete') return;
    const textarea = event.currentTarget;
    const start = textarea.selectionStart;
    const end = textarea.selectionEnd;
    const hit = parseObjectBlocks(content).find((block) => (
      (end > block.start && start < block.end)
      || (event.key === 'Backspace' && start === end && start > block.start && start <= block.end)
      || (event.key === 'Delete' && start === end && start >= block.start && start < block.end)
    ));
    if (!hit) return;
    event.preventDefault();
    setPendingBlockDelete(hit);
  }, [content]);

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
            childId: block.payload.childId,
          });
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
  return (
    <div
      className={`note-detail-sidebar-root flex flex-col bg-[#0A0908] overflow-hidden text-white w-full ${
        isPageLayout ? 'min-h-0' : 'h-full bg-[#161412]'
      }`}
    >
      {/* Header */}
      <div
        className={`flex flex-col gap-3 border-b border-white/5 bg-[#0A0908] shrink-0 ${
          isPageLayout ? 'px-4 md:px-5 pt-1 pb-3' : 'p-4 pb-3'
        }`}
      >
        {/* Row 1: Back + title */}
        <div className="flex items-center justify-between gap-3 min-w-0">
          <div className="flex items-center gap-2.5 flex-1 min-w-0">
            <button
              type="button"
              onClick={handleBackClick}
              className="w-9 h-9 rounded-xl flex items-center justify-center text-white/55 hover:text-white hover:bg-white/[0.05] border border-white/5 flex-shrink-0 transition-colors"
              aria-label="Back to ideas"
            >
              <BackIcon className="w-4 h-4" />
            </button>

            {isEncryptedNote ? (
              <button
                type="button"
                onClick={() => !vaultUnlocked && promptSudo()}
                className="min-w-0 flex-1 text-left"
              >
                <span className="text-[#6366F1] font-extrabold font-clash text-lg leading-tight truncate block">
                  {vaultUnlocked ? 'Decrypting secure note…' : 'Locked note'}
                </span>
              </button>
            ) : readOnly ? (
              <span className="w-full min-w-0 text-[#6366F1] font-extrabold text-lg font-clash tracking-tight leading-tight truncate block">
                {title || 'Untitled note'}
              </span>
            ) : (
              <input
                type="text"
                value={title}
                onChange={(e) => {
                  const nextTitle = e.target.value;
                  setTitle(nextTitle);
                  markDirty();

                  if (liveNote.$id) {
                    const draftNote: Notes = {
                      ...liveNote,
                      title: nextTitle,
                      content,
                      tags: tags.split(',').map((t: string) => t.trim()).filter(Boolean),
                      updatedAt: new Date().toISOString(),
                      $updatedAt: new Date().toISOString(),
                    };
                    pushLiveNote(draftNote);
                    void setCachedData(`note_${liveNote.$id}`, draftNote);
                    onUpdate(draftNote);
                  }
                }}
                className="w-full min-w-0 bg-transparent text-[#6366F1] font-extrabold text-lg font-clash tracking-tight leading-tight border-none focus:outline-none placeholder:text-white/25"
                placeholder="Untitled note"
              />
            )}
          </div>

          {!onBack && !isPageLayout && (
            <button
              type="button"
              onClick={handleDismiss}
              className="w-9 h-9 rounded-xl flex items-center justify-center text-white/55 hover:text-white hover:bg-white/[0.05] border border-white/5 hidden sm:inline-flex shrink-0 transition-colors"
              title="Close"
            >
              <CloseIcon className="w-4 h-4" />
            </button>
          )}
        </div>

        {/* Row 2: Action Buttons Row */}
        <div className="flex items-center gap-1.5 flex-wrap">
          {/* Public/Private visibility status toggle — only for owner */}
          {!readOnly && (
            <ShareLockButton 
              resourceType="note"
              resourceId={note.$id}
              isPublic={!!isPublic}
              isGuest={!!(note as any).isGuest}
              accentColor={isPublic ? '#10B981' : '#A855F7'}
              onPublished={({ isPublic, isGuest }) => {
                  const updated = { ...note, isPublic, isGuest };
                  onUpdate(updated);
              }}
              canPublish={true}
            />
          )}

          {/* Action Hub — only for editors */}
          {!readOnly && (
            <button 
              type="button"
              onClick={() => setShowActionHub(true)} 
              className="p-1.5 rounded-lg bg-pink-500/15 border border-pink-500/25 text-pink-400 hover:bg-pink-500/25 transition-colors flex items-center justify-center"
              title="Action Hub"
            >
              <ActionIcon className="w-4 h-4" />
            </button>
          )}

          {/* Start Huddle */}
          <button 
            type="button"
            onClick={handleStartNoteHuddle} 
            className="p-1.5 rounded-lg bg-indigo-500/15 border border-indigo-500/25 text-indigo-400 hover:bg-indigo-500/25 transition-colors flex items-center justify-center"
            title="Start Huddle"
          >
            <VideoCallIcon className="w-4 h-4" />
          </button>

          {/* Voice recorder — only for editors */}
          {!readOnly && !shouldMaskEncrypted && (
            <button 
              type="button"
              onClick={toggleRecording} 
              className={`p-1.5 rounded-lg transition-all flex items-center justify-center border voice-recorder-btn ${
                isRecording 
                  ? 'bg-red-500/15 border-red-500/25 text-red-400 animate-pulse' 
                  : 'bg-white/5 border-white/5 text-white/60 hover:text-white hover:bg-white/10'
              }`}
              title={isRecording ? `Stop (${Math.floor(recordingDuration / 60)}:${(recordingDuration % 60 < 10 ? '0' : '') + (recordingDuration % 60)}) & Insert` : "Record Voice Note"}
            >
              {isRecording ? <Square className="w-4 h-4 fill-red-500 text-red-500" /> : <Mic className="w-4 h-4" />}
            </button>
          )}

          {/* Copy link — available to all (share link reading) */}
          {showExpandButton && isPublic && (
            <button
              type="button"
              onClick={handleCopyShareLink}
              className="p-1.5 rounded-lg bg-white/5 border border-white/5 text-white/60 hover:text-white hover:bg-white/10 transition-colors flex items-center justify-center"
              title="Copy Share Link"
            >
              <LinkIcon className="w-4 h-4" />
            </button>
          )}

          {/* Pin — only for editors */}
          {!readOnly && (
            <button 
              type="button"
              onClick={handlePinToggle} 
              className={`p-1.5 rounded-lg transition-colors flex items-center justify-center border ${
                isPinnedFunc(liveNote.$id) 
                  ? 'bg-indigo-500/15 border-indigo-500/25 text-indigo-400 hover:bg-indigo-500/25' 
                  : 'bg-white/5 border-white/5 text-white/60 hover:text-white hover:bg-white/10'
              }`}
              title={isPinnedFunc(liveNote.$id) ? 'Unpin' : 'Pin'}
            >
              <PinIcon className="w-4 h-4" />
            </button>
          )}

          {/* More actions — always available for export / details */}
          <button 
            type="button"
            onClick={() => setIsContextDrawerOpen(true)} 
            className="p-1.5 rounded-lg bg-white/5 border border-white/5 text-white/60 hover:text-white hover:bg-white/10 transition-colors flex items-center justify-center"
            title="More Actions"
          >
            <MoreVertical className="w-4 h-4" />
          </button>

          {/* Read-only badge */}
          {readOnly && (
            <span className="ml-1 px-2 py-0.5 rounded-full bg-white/5 border border-white/8 text-[10px] font-black text-white/40 tracking-wider uppercase">
              Read only
            </span>
          )}

          {/* Header Delete — only for owner */}
          {!readOnly && showHeaderDeleteButton && (
            <button 
              type="button"
              onClick={() => setShowDeleteConfirm(true)} 
              className="p-1.5 rounded-lg bg-white/5 border border-white/5 text-white/60 hover:text-red-400 hover:bg-red-500/10 hover:border-red-500/20 transition-colors flex items-center justify-center ml-auto"
              title="Delete"
            >
              <TrashIcon className="w-4 h-4" />
            </button>
          )}
        </div>
      </div>

      {/* Content Scroll Area */}
      <div
        ref={scrollContainerRef}
        onScroll={(e) => {
          if (liveNote?.$id) {
            persistScrollPosition(`note_detail:${liveNote.$id}`, e.currentTarget.scrollTop);
          }
        }}
        className={`flex-1 overflow-y-auto flex flex-col gap-5 scrollbar-thin ${
          isPageLayout ? 'px-4 md:px-5 py-4' : 'p-4 gap-4'
        }`}
      >
        {/* Editor / preview */}
        <div className="flex flex-col rounded-[24px] bg-[#161412] border border-white/5 overflow-hidden flex-shrink-0">
          <div className="flex flex-wrap items-center justify-between gap-3 px-4 md:px-5 pt-4 pb-3 border-b border-white/5">
            <div className="min-w-0 flex flex-col gap-0.5">
              <span className="text-[10px] font-black uppercase tracking-[0.14em] text-[#6366F1] font-clash">
                Content
              </span>
              {isAutosaving && (
                <span className="text-[10px] font-semibold text-[#9B9691]">Saving…</span>
              )}
            </div>

            <div className="flex items-center gap-2 flex-shrink-0">
              {/* Write/Preview switcher — hidden in readOnly mode */}
              {!shouldMaskEncrypted && !readOnly && (
                <div className="flex rounded-xl border border-white/8 bg-[#0B0A09] p-0.5">
                  <button
                    type="button"
                    onClick={() => setContentMode('edit')}
                    className={`px-3 py-1.5 rounded-[10px] text-[11px] font-extrabold transition-colors ${
                      contentMode === 'edit'
                        ? 'bg-[#6366F1] text-white'
                        : 'text-[#9B9691] hover:text-white'
                    }`}
                  >
                    Write
                  </button>
                  <button
                    type="button"
                    onClick={() => setContentMode('preview')}
                    className={`px-3 py-1.5 rounded-[10px] text-[11px] font-extrabold transition-colors ${
                      contentMode === 'preview'
                        ? 'bg-[#6366F1] text-white'
                        : 'text-[#9B9691] hover:text-white'
                    }`}
                  >
                    Preview
                  </button>
                </div>
              )}

              {/* Copy button — always visible */}
              {!shouldMaskEncrypted && content && (
                <button
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation();
                    navigator.clipboard.writeText(content);
                    showSuccess('Copied', 'Note content copied to clipboard');
                  }}
                  className="w-8 h-8 rounded-lg flex items-center justify-center bg-[#0B0A09] border border-white/8 text-white/55 hover:text-white hover:bg-white/[0.04] transition-colors"
                  title="Copy content"
                >
                  <CopyIcon className="w-3.5 h-3.5" />
                </button>
              )}

              {/* Voice recorder in content area — editors only */}
              {!readOnly && !shouldMaskEncrypted && contentMode === 'edit' && (
                <div className="flex flex-wrap items-center gap-1.5">
                  <button type="button" onClick={() => applyInlineFormatting('**')} className="h-8 px-2 rounded-lg border border-white/8 text-[#9B9691] hover:text-white bg-[#0B0A09]"><Bold className="w-3 h-3" /></button>
                  <button type="button" onClick={() => applyInlineFormatting('*')} className="h-8 px-2 rounded-lg border border-white/8 text-[#9B9691] hover:text-white bg-[#0B0A09]"><Italic className="w-3 h-3" /></button>
                  <button type="button" onClick={() => applyInlineFormatting('# ', '')} className="h-8 px-2 rounded-lg border border-white/8 text-[#9B9691] hover:text-white bg-[#0B0A09]"><Heading1 className="w-3 h-3" /></button>
                  <button type="button" onClick={() => applyInlineFormatting('`')} className="h-8 px-2 rounded-lg border border-white/8 text-[#9B9691] hover:text-white bg-[#0B0A09]"><Code2 className="w-3 h-3" /></button>
                  <button
                    type="button"
                    onClick={toggleRecording}
                    className={`h-8 px-2.5 rounded-lg flex items-center gap-1.5 text-[11px] font-extrabold border transition-colors voice-recorder-btn ${
                      isRecording
                        ? 'bg-red-500/10 border-red-500/25 text-red-400 animate-pulse'
                        : 'bg-[#0B0A09] border-white/8 text-[#9B9691] hover:text-white'
                    }`}
                    title={isRecording ? 'Stop and insert' : 'Record voice'}
                  >
                    {isRecording ? (
                      <Square className="w-3 h-3 fill-red-500 text-red-500" />
                    ) : (
                      <Mic className="w-3 h-3" />
                    )}
                    <span className="hidden sm:inline">
                      {isRecording
                        ? `${Math.floor(recordingDuration / 60)}:${(recordingDuration % 60 < 10 ? '0' : '') + (recordingDuration % 60)}`
                        : 'Voice'}
                    </span>
                  </button>
                </div>
              )}
            </div>
          </div>

          <div className="px-4 md:px-5 py-4 md:py-5 min-h-[280px]">
            {isEncryptedNote ? (
              <button
                type="button"
                onClick={() => !vaultUnlocked && promptSudo()}
                className="min-h-[200px] w-full text-left"
              >
                <p className="text-[#9B9691] text-sm font-semibold leading-relaxed">
                  {vaultUnlocked
                    ? 'Decrypting secure note, please wait…'
                    : 'Secure content hidden. Unlock your vault to view and edit this note.'}
                </p>
              </button>
            ) : liveNote.format === 'doodle' ? (
              <NoteContentRenderer content={content} format="doodle" primaryNoteId={liveNote.$id} />
            ) : (
              <>
                <div
                  className={`note-markdown-preview min-h-[240px] ${contentMode !== 'preview' ? 'hidden' : ''}`}
                  aria-hidden={contentMode !== 'preview'}
                >
                  {content.trim() ? (
                    <NoteContentRenderer
                      content={content}
                      format={liveNote.format || 'markdown'}
                      primaryNoteId={liveNote.$id}
                    />
                  ) : (
                    <p className="text-[#9B9691] text-sm font-semibold italic leading-relaxed">
                      Nothing to preview yet. Switch to Write and add markdown.
                    </p>
                  )}
                </div>
                <div
                  className={contentMode === 'preview' ? 'hidden' : 'w-full flex flex-col min-h-[240px]'}
                  aria-hidden={contentMode === 'preview'}
                  onContextMenu={(event) => {
                    event.preventDefault();
                    event.stopPropagation();
                    setIsContextDrawerOpen(true);
                  }}
                >
                  <textarea
                    value={content}
                    onChange={(e) => {
                      const nextContent = e.target.value;
                      setContent(nextContent);
                      markDirty();

                      if (liveNote.$id) {
                        const draftNote: Notes = {
                          ...liveNote,
                          title,
                          content: nextContent,
                          tags: tags.split(',').map((t: string) => t.trim()).filter(Boolean),
                          updatedAt: new Date().toISOString(),
                          $updatedAt: new Date().toISOString(),
                        };
                        pushLiveNote(draftNote);
                        void setCachedData(`note_${liveNote.$id}`, draftNote);
                        onUpdate(draftNote);
                      }
                    }}
                    ref={contentTextareaRef}
                    onKeyDown={onEditorKeyDown}
                    className="w-full min-h-[320px] bg-transparent text-white/92 text-[15px] leading-[1.75] border-none focus:outline-none resize-y scrollbar-thin placeholder:text-[#9B9691]/45 font-satoshi"
                    placeholder="Write in markdown — headings, lists, links, and voice tags are supported."
                    spellCheck
                  />
                </div>
              </>
            )}

            {!shouldMaskEncrypted && (
              <div className="flex justify-between items-center mt-3 pt-3 border-t border-white/5 text-[10px] text-[#9B9691] font-semibold select-none">
                <span>{liveNote.article ? 'Article' : 'Note'} · Markdown</span>
                <span>{content.length.toLocaleString()} characters</span>
              </div>
            )}
          </div>
        </div>

        {/* Tags */}
        <div className="shrink-0">
          <div className="flex items-center justify-between mb-2.5">
            <span className="text-[10px] font-black uppercase tracking-[0.14em] text-[#6366F1] font-clash">Tags</span>
            {!readOnly && (
              <button
                type="button"
                onClick={() => setIsTagSelectorOpen(true)}
                className="w-7 h-7 rounded-lg hover:bg-white/[0.04] text-[#6366F1]/60 hover:text-[#6366F1] transition-colors flex items-center justify-center"
                title="Edit tags"
              >
                <Plus size={14} />
              </button>
            )}
          </div>
          <div className="flex flex-wrap gap-2">
            {displayTags.length > 0 ? (
              displayTags.map((tag: string) => (
                <span
                  key={tag}
                  className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-[#6366F1]/10 border border-[#6366F1]/20 text-[#6366F1] text-xs font-extrabold"
                >
                  {tag}
                  {!readOnly && (
                    <button
                      type="button"
                      onClick={() => {
                        const newTags = displayTags.filter((t) => t !== tag);
                        setTags(newTags.join(', '));
                        markDirty();
                      }}
                      className="hover:text-white"
                    >
                      <CloseIcon size={10} />
                    </button>
                  )}
                </span>
              ))
            ) : (
              <span className="text-[#9B9691] text-xs font-semibold leading-relaxed">No tags yet</span>
            )}
          </div>
        </div>

        {/* Attachments */}
        <div className="shrink-0">
          <div className="flex items-center gap-2 mb-2.5">
            <span className="text-[10px] font-black uppercase tracking-[0.14em] text-[#6366F1] font-clash block">
              Attachments
            </span>
            <button
              type="button"
              onClick={() => setIsObjectPermissionInfoOpen(true)}
              className="w-5 h-5 rounded-md flex items-center justify-center text-white/45 hover:text-white hover:bg-white/5 transition-colors"
              title="Attachment permission info"
              aria-label="Attachment permission info"
            >
              <Info className="w-3.5 h-3.5" />
            </button>
          </div>
          {currentAttachments.length > 0 ? (
            <div className="flex flex-col gap-2">
              {currentAttachments.map((file: any) => (
                <div
                  key={file.id}
                  className="p-3.5 rounded-[16px] bg-[#161412] border border-white/5 flex items-center gap-3 min-w-0"
                >
                  <PaperClipIcon className="w-4 h-4 text-white/40 flex-shrink-0" />
                  <div className="min-w-0 flex-1 flex flex-col gap-0.5">
                    <span className="text-sm font-extrabold text-white leading-tight truncate">{file.name}</span>
                    <span className="text-[11px] font-semibold text-[#9B9691] leading-snug">
                      {formatFileSize(file.size)}
                    </span>
                  </div>
                  <button
                    type="button"
                    onClick={() => window.open(`/api/notes/${liveNote.$id}/attachments/${file.id}`, '_blank')}
                    className="w-8 h-8 rounded-lg text-[#6366F1] hover:text-white hover:bg-white/[0.04] flex items-center justify-center flex-shrink-0"
                  >
                    <OpenIcon className="w-4 h-4" />
                  </button>
                </div>
              ))}
            </div>
          ) : (
            <span className="text-[#9B9691] text-xs font-semibold leading-relaxed">No attachments</span>
          )}
        </div>

        {/* Voice Notes */}
        <div className="shrink-0">
          <span className="text-[10px] font-black uppercase tracking-[0.14em] text-pink-400 font-clash block mb-2.5">
            Voice notes
          </span>
          {attachedObjects.filter((obj) => obj.childKind === 'voice').length > 0 ? (
            <div className="flex flex-col gap-2">
              {attachedObjects
                .filter((obj) => obj.childKind === 'voice')
                .map((obj) => (
                  <div
                    key={obj.$id}
                    className="p-3.5 rounded-[16px] bg-[#161412] border border-white/5 flex flex-col gap-2"
                  >
                    <div className="flex items-center justify-between gap-2">
                      <span className="text-[11px] font-semibold text-[#9B9691]">
                        Line {obj.metadata ? JSON.parse(obj.metadata).insertLine || 1 : 1}
                      </span>
                      <button
                        type="button"
                        onClick={async () => {
                          try {
                            const { detachObject } = await import('@/lib/actions/client-ops');
                            await detachObject(obj.$id);
                            setAttachedObjects((prev) => prev.filter((o) => o.$id !== obj.$id));
                            showSuccess('Voice note removed');
                          } catch (err: unknown) {
                            showError('Failed to remove', err instanceof Error ? err.message : 'Error');
                          }
                        }}
                        className="text-[11px] font-bold text-red-400 hover:text-red-300"
                      >
                        Remove
                      </button>
                    </div>
                    <VoiceNotePlayer fileId={obj.childId} />
                  </div>
                ))}
            </div>
          ) : (
            <span className="text-[#9B9691] text-xs font-semibold leading-relaxed">No voice notes</span>
          )}
        </div>

        {/* Linked sections */}
        <div className="flex flex-col gap-5">
          {[
            {
              label: 'Goals',
              items: linkedTasks,
              loading: isLoadingTasks,
              icon: <TaskIcon className="w-4 h-4" />,
              color: 'text-emerald-400',
              borderHover: 'hover:bg-emerald-500/5',
              iconColor: '#10B981',
              link: (id: string) => `/flow?taskId=${id}`,
            },
            {
              label: 'Events',
              items: linkedEvents,
              loading: isLoadingEvents,
              icon: <EventIcon className="w-4 h-4" />,
              color: 'text-indigo-400',
              borderHover: 'hover:bg-indigo-500/5',
              iconColor: '#6366F1',
              link: (id: string) => `/flow/events?eventId=${id}`,
            },
            {
              label: 'Secrets',
              items: linkedSecrets,
              loading: isLoadingSecrets,
              icon: <KeyIcon className="w-4 h-4" />,
              color: 'text-amber-400',
              borderHover: 'hover:bg-amber-500/5',
              iconColor: '#F59E0B',
              link: (id: string) => `/vault?id=${id}`,
            },
          ].map((section) => (
            <div key={section.label} className="shrink-0">
              <span className={`text-[10px] font-black uppercase tracking-[0.14em] font-clash block mb-2.5 ${section.color}`}>
                Linked {section.label}
              </span>
              {section.loading ? (
                <div className="text-xs text-[#9B9691] font-semibold flex items-center gap-2">
                  <div className="w-3 h-3 border border-current border-t-transparent rounded-full animate-spin" />
                  <span>Loading…</span>
                </div>
              ) : section.items.length > 0 ? (
                <div className="flex flex-col gap-2">
                  {section.items.map((item: any) => (
                    <div
                      key={item.$id}
                      className={`p-3.5 rounded-[16px] bg-[#161412] border border-white/5 flex items-center gap-3 min-w-0 transition-colors ${section.borderHover}`}
                    >
                      <span style={{ color: section.iconColor }} className="flex-shrink-0">
                        {section.icon}
                      </span>
                      <span className="min-w-0 flex-1 text-sm font-extrabold text-white leading-tight truncate">
                        {item.title || item.name}
                      </span>
                      <button
                        type="button"
                        onClick={() => window.open(section.link(item.$id), '_blank')}
                        className="w-8 h-8 rounded-lg hover:bg-white/[0.04] flex items-center justify-center flex-shrink-0"
                        style={{ color: section.iconColor }}
                      >
                        <OpenIcon className="w-4 h-4" />
                      </button>
                    </div>
                  ))}
                </div>
              ) : (
                <span className="text-[#9B9691] text-xs font-semibold leading-relaxed">
                  No linked {section.label.toLowerCase()}
                </span>
              )}
            </div>
          ))}

          {/* Collaborators */}
          <div className="shrink-0">
            <span className="text-[10px] font-black uppercase tracking-[0.14em] text-pink-400 font-clash block mb-2.5">
              Collaborators
            </span>
            {isLoadingCollaborators ? (
              <div className="text-xs text-[#9B9691] font-semibold flex items-center gap-2">
                <div className="w-3.5 h-3.5 border border-pink-500 border-t-transparent rounded-full animate-spin" />
                <span>Loading…</span>
              </div>
            ) : collaboratorProfiles.length > 0 ? (
              <div className="flex flex-col gap-2">
                {collaboratorProfiles.map((p: any) => (
                  <button
                    key={p.$id || p.userId}
                    type="button"
                    onClick={() =>
                      openUnified('share-note', {
                        noteId: liveNote.$id,
                        noteTitle: liveNote.title,
                        initialCollaborator: p,
                      })
                    }
                    className="w-full p-3 rounded-[16px] bg-[#161412] border border-white/5 flex items-center gap-3 hover:bg-white/[0.02] transition-colors text-left min-w-0"
                  >
                    <IdentityAvatar
                      fileId={p.avatar}
                      alt={p.username}
                      fallback={p.username?.[0]?.toUpperCase()}
                      size={34}
                      verified={p.tier === 'admin' || p.verified}
                    />
                    <div className="min-w-0 flex-1 flex flex-col gap-0.5">
                      <span className="text-sm font-extrabold text-white leading-tight truncate">
                        {p.displayName || p.username}
                      </span>
                      <span className="text-[11px] font-semibold text-[#9B9691] leading-snug truncate">
                        @{p.username}
                      </span>
                    </div>
                    <span className="text-[10px] font-black uppercase tracking-wider px-2 py-1 rounded-md bg-pink-500/10 text-pink-400 flex-shrink-0">
                      {p.permissionLevel || 'Viewer'}
                    </span>
                  </button>
                ))}
              </div>
            ) : (
              <span className="text-[#9B9691] text-xs font-semibold leading-relaxed">No collaborators</span>
            )}
          </div>
        </div>

        {/* Timestamps */}
        <div className="pt-3 border-t border-white/5 text-[11px] font-semibold text-[#9B9691] flex flex-col gap-1 shrink-0">
          <span>Created {formatNoteCreatedDate(liveNote)}</span>
          <span>Updated {formatNoteUpdatedDate(liveNote)}</span>
        </div>
      </div>

      {/* Action Hub overlay */}
      {showActionHub && (
        <div className="fixed inset-0 z-[1500] flex items-start justify-center bg-black/60 backdrop-blur-sm animate-in fade-in duration-200" onClick={() => setShowActionHub(false)}>
          <div className="w-full max-w-lg rounded-b-[24px] bg-[#161412] border-b border-white/5 p-5 shadow-2xl flex flex-col gap-4 animate-in slide-in-from-top-1/3 duration-200" onClick={e => e.stopPropagation()}>
            <div className="flex justify-between items-center">
              <h3 className="font-extrabold font-space-grotesk text-indigo-400 text-sm uppercase tracking-wide">Action Hub</h3>
              <button type="button" onClick={() => setShowActionHub(false)} className="p-1.5 text-white/60 hover:text-white rounded-lg hover:bg-white/5"><CloseIcon className="w-4 h-4" /></button>
            </div>
            
            <div className="flex flex-wrap gap-2">
              <button
                type="button"
                onClick={() => { setShowActionHub(false); void handleTogglePublic(); }}
                className="flex items-center gap-2 px-3 py-2 rounded-xl border border-white/10 text-xs font-mono font-bold text-white hover:bg-white/5 hover:text-white transition-colors"
              >
                {isPublic ? <LockIcon className="w-4 h-4" /> : <UnlockIcon className="w-4 h-4" />}
                <span>{isPublic ? 'Make Private' : 'Make Public'}</span>
              </button>

              <button 
                type="button"
                onClick={handleCreateTaskFromNote} 
                disabled={isCreatingTaskFromNote} 
                className="flex items-center gap-2 px-3 py-2 rounded-xl bg-indigo-600 text-black font-extrabold text-xs font-mono uppercase transition-colors hover:bg-indigo-500 disabled:opacity-50"
              >
                <TaskIcon className="w-4 h-4 text-black" />
                <span>Create Goal</span>
              </button>

              <button 
                type="button"
                onClick={() => { setShowActionHub(false); setShowProjectLinker(true); }} 
                className="flex items-center gap-2 px-3 py-2 rounded-xl border border-white/10 text-xs font-mono font-bold text-white hover:bg-white/5 hover:text-white transition-colors"
              >
                <FolderKanban className="w-4 h-4" />
                <span>Add to Project</span>
              </button>

              <button 
                type="button"
                onClick={() => { setShowActionHub(false); rotateNoteLink(); }} 
                disabled={!isPublic} 
                className="flex items-center gap-2 px-3 py-2 rounded-xl border border-white/10 text-xs font-mono font-bold text-white hover:bg-white/5 hover:text-white transition-colors disabled:opacity-40"
              >
                <LockIcon className="w-4 h-4" />
                <span>Rotate Link</span>
              </button>
            </div>

            <div className="border-t border-white/5 pt-3">
              <span className="text-xs font-mono font-bold tracking-wider text-white/45 uppercase block mb-2.5">Suggestions</span>
              {isLoadingSuggestions ? (
                <div className="px-2 py-1 text-xs text-white/40 font-mono flex items-center gap-2">
                  <div className="w-3.5 h-3.5 border border-indigo-500 border-t-transparent rounded-full animate-spin"></div>
                  <span>Loading suggestions...</span>
                </div>
              ) : crossSuggestions.length > 0 ? (
                <div className="flex flex-col gap-2">
                  {crossSuggestions.map(s => (
                    <div key={s.id} className="p-3 bg-indigo-500/5 border border-indigo-500/10 rounded-xl flex justify-between items-center">
                      <div>
                        <span className="text-xs font-bold text-white/85 block">{s.label}</span>
                        <span className="text-xs font-sans text-white/40 block mt-0.5">{s.description}</span>
                      </div>
                      <button type="button" onClick={() => window.open(`https://kylrix.space/integrations?action=${s.id}`, '_blank')} className="px-2.5 py-1 bg-indigo-500 hover:bg-indigo-400 text-black font-extrabold text-xs font-mono rounded-lg transition-colors">
                        USE
                      </button>
                    </div>
                  ))}
                </div>
              ) : (
                <span className="text-xs font-mono text-white/30 italic">No suggestions available</span>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Delete Dialog */}
      {showDeleteConfirm && (
        <div className="fixed inset-0 z-[1500] flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-in fade-in duration-200">
          <div className="w-full max-w-sm rounded-[24px] bg-[#161412] border border-white/5 p-5 shadow-2xl flex flex-col gap-4 animate-in zoom-in-95 duration-200">
            <h3 className="font-extrabold font-space-grotesk text-[#FF453A] text-lg uppercase tracking-wide">Delete Note</h3>
            <p className="text-xs text-white/60 font-sans leading-relaxed">
              Are you sure you want to delete this note? This action is permanent and cannot be undone.
            </p>
            <div className="flex flex-col gap-2 mt-2">
              <button 
                type="button"
                onClick={handleDelete} 
                className="w-full py-2.5 rounded-xl bg-[#FF453A] hover:bg-[#FF453A]/90 text-white font-extrabold text-xs font-mono uppercase transition-colors"
              >
                Delete Permanently
              </button>
              <button 
                type="button"
                onClick={() => setShowDeleteConfirm(false)} 
                className="w-full py-2.5 rounded-xl border border-white/10 text-white/80 hover:text-white hover:bg-white/5 font-extrabold text-xs font-mono uppercase transition-colors"
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}

      <ConfirmationDialog 
        open={showRotateConfirm} 
        title="Rotate public link?" 
        message="The previous link will become permanently invalid. Anyone with the old link will lose access." 
        confirmLabel={isRotating ? "Rotating..." : "Rotate Link"} 
        isDestructive={true} 
        isLoading={isRotating} 
        onClose={() => setShowRotateConfirm(false)} 
        onConfirm={handleConfirmedRotate} 
      />
      
      <ProjectLinker 
        open={showProjectLinker} 
        onClose={() => setShowProjectLinker(false)} 
        entityId={liveNote.$id} 
        entityKind="note" 
      />

      {/* Tag Selector Sub-Drawer */}
      <Drawer
        anchor="bottom"
        open={isTagSelectorOpen}
        onClose={() => setIsTagSelectorOpen(false)}
        ModalProps={{ keepMounted: false, disableScrollLock: false }}
        sx={{
          zIndex: 2000,
          '& .ob-drawer-panel': {
            bgcolor: '#161412',
            borderTopLeftRadius: '24px',
            borderTopRightRadius: '24px',
            border: '1px solid #34322F',
            borderBottom: 0,
            pb: 'max(24px, env(safe-area-inset-bottom))',
            pt: 2,
            px: { xs: 2.25, sm: 2.75 },
            maxWidth: '600px',
            mx: 'auto',
          }
        }}
      >
        <Stack direction="row" alignItems="center" justifyContent="space-between" sx={{ mb: 3 }}>
          <Stack direction="row" spacing={1.5} alignItems="center">
            <TagIcon size={20} color="#6366F1" />
            <Typography sx={{ color: '#fff', fontWeight: 900, fontSize: '1.1rem', fontFamily: 'var(--font-clash)', letterSpacing: '-0.02em' }}>
              Select Tags
            </Typography>
          </Stack>
          <IconButton
            onClick={() => setIsTagSelectorOpen(false)}
            sx={{
              color: '#E8E6E3',
              bgcolor: '#0A0908',
              border: '1px solid #34322F',
              '&:hover': { bgcolor: '#1C1A18' },
            }}
          >
            <CloseIcon size={18} />
          </IconButton>
        </Stack>

        <Box sx={{ maxHeight: '40dvh', overflowY: 'auto', pr: 0.5 }}>
          <List sx={{ py: 0 }}>
            <ListItem disablePadding sx={{ mb: 1 }}>
              <ListItemButton 
                onClick={() => {
                  setIsTagSelectorOpen(false);
                  openUnified('new-tag', { 
                    onSuccess: async () => {
                      await refreshEcosystemTags();
                    } 
                    // @ts-ignore
                  });
                }}
                sx={{ 
                  borderRadius: '12px', 
                  bgcolor: alpha('#6366F1', 0.1),
                  border: `1px dashed ${alpha('#6366F1', 0.3)}`,
                  py: 1.5,
                  '&:hover': { bgcolor: alpha('#6366F1', 0.15) }
                }}
              >
                <Plus size={18} color="#6366F1" style={{ marginRight: '12px' }} />
                <ListItemText 
                  primary="Create New Tag" 
                  primaryTypographyProps={{ sx: { color: '#6366F1', fontWeight: 800, fontSize: '0.9rem' } }}
                />
              </ListItemButton>
            </ListItem>

            {ecosystemTags.map((tag) => {
              const currentTagsArray = tags.split(',').map((t: string) => t.trim()).filter(Boolean);
              const isSelected = currentTagsArray.includes(tag.name || '');
              const color = (tag as any).color || '#9B9691';

              return (
                <ListItem key={tag.$id} disablePadding sx={{ mb: 0.5 }}>
                  <ListItemButton 
                    onClick={() => {
                      let nextTagsArray = [...currentTagsArray];
                      if (!isSelected && tag.name) {
                        nextTagsArray.push(tag.name);
                      } else if (isSelected && tag.name) {
                        nextTagsArray = nextTagsArray.filter(n => n !== tag.name);
                      }
                      setTags(nextTagsArray.join(', '));
                      markDirty();
                      setIsTagSelectorOpen(false);
                    }}
                    sx={{ 
                      borderRadius: '12px', 
                      py: 1.5,
                      border: '1px solid transparent',
                      borderColor: isSelected ? color : 'transparent',
                      bgcolor: isSelected ? alpha(color, 0.1) : 'transparent',
                      '&:hover': { bgcolor: '#1C1A18' }
                    }}
                  >
                    <Box 
                      sx={{ 
                        width: 12, 
                        height: 12, 
                        borderRadius: '4px', 
                        bgcolor: color, 
                        mr: 2,
                        boxShadow: `0 0 10px ${alpha(color, 0.4)}`
                      }} 
                    />
                    <ListItemText 
                      primary={(tag.name || '').toUpperCase()} 
                      primaryTypographyProps={{ 
                        sx: { 
                          color: isSelected ? 'white' : '#9B9691', 
                          fontWeight: 900, 
                          fontSize: '0.8rem',
                          fontFamily: 'var(--font-mono)',
                          letterSpacing: '0.05em'
                        } 
                      }}
                    />
                    {isSelected && (
                      <Typography sx={{ color: color, fontWeight: 900, fontSize: '0.7rem', opacity: 0.8 }}>
                        SELECTED
                      </Typography>
                    )}
                  </ListItemButton>
                </ListItem>
              );
            })}
          </List>
        </Box>
      </Drawer>

      {isContextDrawerOpen && (
        <Drawer
          anchor="bottom"
          open={isContextDrawerOpen}
          onClose={() => setIsContextDrawerOpen(false)}
          PaperProps={{
            sx: {
              position: 'fixed !important',
              bottom: '0 !important',
              left: '0 !important',
              right: '0 !important',
              borderTopLeftRadius: '24px',
              borderTopRightRadius: '24px',
              bgcolor: '#161412',
              borderTop: '1px solid #34322F',
              backgroundImage: 'none',
              maxWidth: 720,
              width: '100%',
              mx: 'auto',
              p: 2,
              pb: 4,
              pointerEvents: 'auto',
            }
          }}
          ModalProps={{
            keepMounted: false,
            disableScrollLock: false,
            disablePortal: true,
          }}
        >
          <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1.5, pointerEvents: 'auto' }}>
            <Box sx={{ width: 40, height: 4, borderRadius: 2, bgcolor: '#3D3A36', mx: 'auto', mb: 1 }} aria-hidden />
            <Typography sx={{ fontSize: '0.9rem', fontWeight: 900, color: 'rgba(255,255,255,0.4)', textTransform: 'uppercase', tracking: '0.05em', fontFamily: 'var(--font-mono)', mb: 1, textAlign: 'center' }}>
              Text Actions
            </Typography>

            <button
              type="button"
              onClick={() => {
                navigator.clipboard.writeText(content);
                showSuccess('Copied', 'Entire note content copied to clipboard.');
                setIsContextDrawerOpen(false);
              }}
              className="w-full flex items-center gap-3 px-4 py-3 rounded-xl bg-white/[0.02] border border-white/5 text-sm font-bold text-white hover:bg-white/5 transition-all text-left cursor-pointer"
            >
              <CopyIcon className="w-5 h-5 text-pink-500" />
              <span>Copy All Content</span>
            </button>

            <button
              type="button"
              onClick={() => {
                setIsContextDrawerOpen(false);
                setTimeout(() => {
                  const textarea = contentTextareaRef.current;
                  if (textarea) {
                    textarea.focus();
                    textarea.select();
                  }
                }, 100);
              }}
              className="w-full flex items-center gap-3 px-4 py-3 rounded-xl bg-white/[0.02] border border-white/5 text-sm font-bold text-white hover:bg-white/5 transition-all text-left cursor-pointer"
            >
              <TaskIcon className="w-5 h-5 text-purple-500" />
              <span>Select All</span>
            </button>

            <button
              type="button"
              onClick={async () => {
                setIsContextDrawerOpen(false);
                try {
                  const text = await navigator.clipboard.readText();
                  const textarea = contentTextareaRef.current;
                  if (textarea) {
                    const start = textarea.selectionStart;
                    const end = textarea.selectionEnd;
                    if (start === 0 && end === textarea.value.length) {
                      setContent(text);
                      markDirty();
                    } else {
                      const nextContent = content.substring(0, start) + text + content.substring(end);
                      setContent(nextContent);
                      markDirty();
                      setTimeout(() => {
                        textarea.focus();
                        textarea.setSelectionRange(start + text.length, start + text.length);
                      }, 50);
                    }
                    showSuccess('Pasted', 'Text pasted from clipboard.');
                  }
                } catch (err) {
                  showError('Paste Failed', 'Could not read from clipboard.');
                }
              }}
              className="w-full flex items-center gap-3 px-4 py-3 rounded-xl bg-white/[0.02] border border-white/5 text-sm font-bold text-white hover:bg-white/5 transition-all text-left cursor-pointer"
            >
              <Clipboard className="w-5 h-5 text-emerald-500" />
              <span>Paste Clipboard</span>
            </button>

            <>
              <button
                type="button"
                onClick={() => {
                  setIsContextDrawerOpen(false);
                  setIsAttachObjectPickerOpen(true);
                }}
                className="w-full flex items-center gap-3 px-4 py-3 rounded-xl bg-white/[0.02] border border-pink-500/40 text-sm font-bold text-pink-300 hover:bg-pink-500/10 transition-all text-left cursor-pointer"
              >
                <Plus className="w-5 h-5 text-pink-400" />
                <span>Attach object</span>
              </button>
              <button
                type="button"
                onClick={() => { if (!canAttachSecondaryObject) return; objectUploadInputRef.current?.click(); }}
                className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl bg-white/[0.02] border border-white/5 text-sm font-bold text-white hover:bg-white/5 transition-all text-left cursor-pointer${isAttachingObject ? ' opacity-60 pointer-events-none' : ''}`}
              >
                <PaperClipIcon className="w-5 h-5 text-indigo-400" />
                <span>{isAttachingObject ? 'Uploading…' : 'Upload file or image'}</span>
              </button>
              <button
                type="button"
                onClick={() => { void attachExternalLink(); }}
                className="w-full flex items-center gap-3 px-4 py-3 rounded-xl bg-white/[0.02] border border-white/5 text-sm font-bold text-white hover:bg-white/5 transition-all text-left cursor-pointer"
              >
                <LinkIcon className="w-5 h-5 text-cyan-400" />
                <span>Attach link</span>
              </button>
            </>

            <div className="h-px bg-white/5 my-3" />
            <div className="flex flex-col gap-2">
              <span className="text-[10px] font-black text-white/30 tracking-wider uppercase px-4 pt-1 font-mono">Export Document</span>
              <button
                type="button"
                onClick={() => {
                  setIsContextDrawerOpen(false);
                  exportToMarkdown(liveNote.title || 'Note', content || '');
                }}
                className="w-full flex items-center gap-3 px-4 py-3 rounded-xl bg-white/[0.02] border border-white/5 text-sm font-bold text-white hover:bg-white/5 transition-all text-left cursor-pointer"
              >
                <span>Export as Markdown (.md)</span>
              </button>
              <button
                type="button"
                onClick={() => {
                  setIsContextDrawerOpen(false);
                  exportToPDF(liveNote.title || 'Note', content || '');
                }}
                className="w-full flex items-center gap-3 px-4 py-3 rounded-xl bg-white/[0.02] border border-white/5 text-sm font-bold text-white hover:bg-white/5 transition-all text-left cursor-pointer"
              >
                <span>Export as PDF (.pdf)</span>
              </button>
              <button
                type="button"
                onClick={() => {
                  setIsContextDrawerOpen(false);
                  exportToDOCX(liveNote.title || 'Note', content || '');
                }}
                className="w-full flex items-center gap-3 px-4 py-3 rounded-xl bg-white/[0.02] border border-white/5 text-sm font-bold text-white hover:bg-white/5 transition-all text-left cursor-pointer"
              >
                <span>Export as Word (.doc)</span>
              </button>
            </div>
          </Box>
        </Drawer>
      )}

      <ProjectAddObjectModal
        open={isAttachObjectPickerOpen}
        onClose={() => setIsAttachObjectPickerOpen(false)}
        mode="resource"
        title="Attach object"
        onAttachResource={attachPickedObject}
        initialTab={0}
      />

      {pendingBlockDelete && (
        <Drawer
          anchor="bottom"
          open={Boolean(pendingBlockDelete)}
          onClose={() => setPendingBlockDelete(null)}
          ModalProps={{ keepMounted: false, disablePortal: true }}
          PaperProps={{ sx: { bgcolor: '#161412', borderTop: '1px solid #34322F', borderTopLeftRadius: '24px', borderTopRightRadius: '24px', p: 2 } }}
        >
          <div className="space-y-3">
            <p className="text-sm font-bold text-white">Remove this {pendingBlockDelete.payload.childKind} object?</p>
            <p className="text-xs text-white/60">This removes the object block from markdown and detaches the relation row.</p>
            <div className="flex items-center gap-2">
              <button type="button" className="h-9 px-3 rounded-lg border border-white/10 text-white/80" onClick={() => setPendingBlockDelete(null)}>Cancel</button>
              <button
                type="button"
                className="h-9 px-3 rounded-lg bg-red-500/15 border border-red-500/35 text-red-300"
                onClick={async () => {
                  const block = pendingBlockDelete;
                  if (!block) return;
                  const next = content.slice(0, block.start) + content.slice(block.end);
                  await replaceContentWithSave(next);
                  try {
                    const { detachObjectByRelation, getObjectsByParent } = await import('@/lib/actions/client-ops');
                    await detachObjectByRelation({ parentId: liveNote.$id, childId: block.payload.childId });
                    setAttachedObjects(await getObjectsByParent(liveNote.$id, 'note'));
                  } catch {}
                  setPendingBlockDelete(null);
                }}
              >
                Remove
              </button>
            </div>
          </div>
        </Drawer>
      )}

      {isObjectPermissionInfoOpen && (
        <Drawer
          anchor="bottom"
          open={isObjectPermissionInfoOpen}
          onClose={() => setIsObjectPermissionInfoOpen(false)}
          ModalProps={{ keepMounted: false, disablePortal: true }}
          PaperProps={{ sx: { bgcolor: '#161412', borderTop: '1px solid #34322F', borderTopLeftRadius: '24px', borderTopRightRadius: '24px', p: 2.25 } }}
        >
          <div className="space-y-2.5">
            <p className="text-sm font-black text-white">Attached object permissions</p>
            <p className="text-xs text-white/70 leading-relaxed">
              Every secondary object attached to this note keeps the permission system of its own primary object.
              If someone cannot access that primary object, they will see no access here too.
            </p>
            <p className="text-xs text-white/55 leading-relaxed">
              Projects are the only place with granular overrides. Notes do not override attached object permissions.
            </p>
            <div className="pt-1">
              <button
                type="button"
                className="h-9 px-3 rounded-lg border border-white/10 text-white/80 hover:text-white hover:bg-white/5"
                onClick={() => setIsObjectPermissionInfoOpen(false)}
              >
                Close
              </button>
            </div>
          </div>
        </Drawer>
      )}

      <input
        ref={objectUploadInputRef}
        type="file"
        className="hidden"
        onChange={onPickExternalFile}
      />

    </div>
  );
}
