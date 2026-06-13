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
} from 'lucide-react';

import { useToast } from '@/components/ui/Toast';
import { useSudo } from '@/context/SudoContext';
import { useProUpgrade } from '@/context/ProUpgradeContext';
import { useDynamicSidebar } from '@/components/ui/DynamicSidebar';
import { useUnifiedDrawer } from '@/context/UnifiedDrawerContext';
import { useAuth } from '@/lib/auth';
import { hasPaidKylrixPlan } from '@/lib/utils';
import { IdentityAvatar } from '@/components/common/IdentityBadge';
import { useNotes } from '@/context/NotesContext';
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
import { pickNoteAutosavePayload } from '@/lib/appwrite/note';
import { attachObject } from '@/lib/actions/client-ops';
import ProjectLinker from '@/components/projects/ProjectLinker';

export interface NoteDetailSidebarProps {
  note: Notes;
  onUpdate: (updatedNote: Notes) => void;
  onDelete: (noteId: string) => void;
  onBack?: () => void;
  showExpandButton?: boolean;
  showHeaderDeleteButton?: boolean;
  isLoading?: boolean;
}

export function NoteDetailSidebar({
  note,
  onUpdate,
  onDelete,
  onBack,
  showExpandButton = true,
  showHeaderDeleteButton = true,
  isLoading = false,
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

  const { notes: allNotes, isPinned, pinNote, unpinNote } = useNotes();
  const isPinnedFunc = useMemo(() => typeof isPinned === 'function' ? isPinned : () => false, [isPinned]);
  const pinNoteFunc = useMemo(() => typeof pinNote === 'function' ? pinNote : async () => {}, [pinNote]);
  const unpinNoteFunc = useMemo(() => typeof unpinNote === 'function' ? unpinNote : async () => {}, [unpinNote]);
  const [realtimeNote, setRealtimeNote] = useState<Notes | null>(null);
  const noteRef = useRef(note);
  const liveNote = useMemo(
    () => (realtimeNote?.$id === note.$id ? realtimeNote : (allNotes || []).find((candidate: any) => candidate.$id === note.$id) || note),
    [allNotes, note, realtimeNote]
  );

  const updateLocalAndParentNote = useCallback((updated: Notes) => {
    onUpdate(updated);
    setRealtimeNote(updated);
  }, [onUpdate]);

  useEffect(() => {
    noteRef.current = note;
  }, [note]);

  // Fetch note fully on mount/change
  useEffect(() => {
    setRealtimeNote(null);
    let active = true;
    const fetchFullNote = async () => {
      try {
        const full = await getNote(note.$id);
        if (active && full) {
          let resolved = full as Notes;
          const meta = (() => {
            try { return JSON.parse(full.metadata || '{}'); } catch { return {}; }
          })();
          const isT4 = (meta?.isEncrypted === true || meta?.isEncrypted === 'true') && meta?.encryptionVersion === 'T4';
          if (isT4 && ecosystemSecurity.status.isUnlocked && !meta?.clientDecrypted) {
            const decrypted = await decryptPublicEncryptedNote(full);
            if (decrypted) resolved = decrypted;
          }
          updateLocalAndParentNote(resolved);
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

  const isDirtyRef = useRef(false);
  const loadedNoteIdRef = useRef<string | null>(null);
  const lastAppliedServerTsRef = useRef('');
  const markDirty = useCallback(() => {
    isDirtyRef.current = true;
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
  const isT4Encrypted = useMemo(() => (noteMeta?.isEncrypted === true || noteMeta?.isEncrypted === 'true') && noteMeta?.encryptionVersion === 'T4', [noteMeta]);
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
    if (!serverTs || serverTs === lastAppliedServerTsRef.current) return;

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
      const timer = setTimeout(() => {
        promptSudo();
      }, 800);
      return () => clearTimeout(timer);
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
      if (!liveNote.$id) return;
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
    format: 'text',
    tags: tags.split(',').map((t: string) => t.trim()).filter(Boolean),
  }), [liveNote, title, content, tags]);

  const candidateNoteRef = useRef(candidateNote);
  candidateNoteRef.current = candidateNote;

  const canEditNote = Boolean(liveNote.$id) && !shouldMaskEncrypted && !isLoading;

  const { isSaving: isAutosaving, forceSave } = useAutosave(candidateNote, {
    onSave: (savedNote: Notes) => {
      isDirtyRef.current = false;
      lastAppliedServerTsRef.current = String(savedNote.updatedAt || savedNote.$updatedAt || '');
      updateLocalAndParentNote(savedNote);
    },
    onError: () => {
      showError('Save failed', 'Your changes are still on screen. We will retry automatically.');
    },
    enabled: canEditNote,
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

        recordingTimerRef.current = setTimeout(() => {
          if (mediaRecorderRef.current && mediaRecorderRef.current.state !== 'inactive') {
            mediaRecorderRef.current.stop();
          }
          setIsRecording(false);
        }, 120000); // 2 minutes limit

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
          format: 'text',
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

  // --- RENDER ---
  return (
    <div className="note-detail-sidebar-root flex flex-col h-full bg-[#161412] overflow-hidden text-white w-full">
      {/* Header */}
      <div className="flex flex-col gap-3 p-4 pb-3 border-b border-white/5 bg-[#161412] shrink-0">
        {/* Row 1: Title and back buttons */}
        <div className="flex items-center justify-between gap-4">
          <div className="flex items-center gap-2 flex-1 min-w-0">
            {onBack ? (
              <button 
                type="button"
                onClick={handleBackClick} 
                className="p-1.5 text-white/50 hover:text-white hover:bg-white/5 rounded-lg transition-colors flex-shrink-0"
              >
                <BackIcon className="w-5 h-5" />
              </button>
            ) : (
              <button 
                type="button"
                onClick={handleBackClick} 
                className="p-1.5 text-white/50 hover:text-white hover:bg-white/5 rounded-lg transition-colors flex-shrink-0 sm:hidden"
              >
                <BackIcon className="w-5 h-5" />
              </button>
            )}
            
            {shouldMaskEncrypted ? (
              <h2
                onClick={() => promptSudo()}
                className="font-black font-space-grotesk text-[#6366F1] uppercase tracking-wide text-xl truncate flex-1 cursor-pointer"
              >
                Secure Note
              </h2>
            ) : (
              <input
                type="text"
                value={title}
                onChange={(e) => {
                  setTitle(e.target.value);
                  markDirty();
                }}
                className="w-full bg-transparent text-[#6366F1] font-black text-xl font-space-grotesk tracking-wide uppercase border-none focus:outline-none placeholder-white/20 flex-1 min-w-0"
                placeholder="Untitled note"
              />
            )}
          </div>

          {!onBack && (
            <button
              type="button"
              onClick={handleDismiss}
              className="p-1.5 text-white/50 hover:text-white hover:bg-white/5 rounded-lg transition-colors hidden sm:inline-flex shrink-0"
              title="Close"
            >
              <CloseIcon className="w-4 h-4" />
            </button>
          )}
        </div>

        {/* Row 2: Action Buttons Row */}
        <div className="flex items-center gap-1.5 flex-wrap">
          {/* Public/Private visibility status toggle */}
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

          {/* Action Hub */}
          <button 
            type="button"
            onClick={() => setShowActionHub(true)} 
            className="p-1.5 rounded-lg bg-pink-500/15 border border-pink-500/25 text-pink-400 hover:bg-pink-500/25 transition-colors flex items-center justify-center"
            title="Action Hub"
          >
            <ActionIcon className="w-4 h-4" />
          </button>

          {/* Start Huddle */}
          <button 
            type="button"
            onClick={handleStartNoteHuddle} 
            className="p-1.5 rounded-lg bg-indigo-500/15 border border-indigo-500/25 text-indigo-400 hover:bg-indigo-500/25 transition-colors flex items-center justify-center"
            title="Start Huddle"
          >
            <VideoCallIcon className="w-4 h-4" />
          </button>

          {/* Voice recorder top fallback bar button */}
          {!shouldMaskEncrypted && (
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

          {/* Copy link */}
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

          {/* Pin */}
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

          {/* Header Delete */}
          {showHeaderDeleteButton && (
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
      <div className="flex-1 overflow-y-auto p-4 flex flex-col gap-4 scrollbar-thin">
        {/* Editor Box */}
        <div className="flex flex-col p-4 rounded-[20px] bg-[#0A0908] border border-white/[0.04] shadow-[0_8px_24px_rgba(0,0,0,0.5)] focus-within:border-indigo-500/30 transition-all flex-shrink-0">
          <div className="flex justify-between items-center mb-3">
            <div className="flex items-center gap-2">
              <span className="text-xs font-mono font-bold tracking-wider text-indigo-400 uppercase">Content</span>
              {isAutosaving && (
                <span className="text-[10px] font-mono font-bold text-white/35 uppercase tracking-wider">Saving…</span>
              )}
            </div>
            
            <div className="flex items-center gap-2">
              {!shouldMaskEncrypted && content && (
                <button
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation();
                    navigator.clipboard.writeText(content);
                    showSuccess('Copied', 'Note content copied to clipboard');
                  }}
                  className="h-7 w-7 rounded-lg flex items-center justify-center transition-all bg-white/5 border border-white/5 text-white/60 hover:text-white hover:bg-white/10"
                  title="Copy content"
                >
                  <CopyIcon className="w-3.5 h-3.5" />
                </button>
              )}
              {!shouldMaskEncrypted && (
                <button
                  type="button"
                  onClick={toggleRecording}
                  className={`h-7 px-2 rounded-lg flex items-center justify-center gap-1.5 font-mono text-xs font-bold transition-all border voice-recorder-btn ${
                    isRecording 
                      ? 'bg-red-500/10 border-red-500/20 text-red-400 animate-pulse' 
                      : 'bg-white/5 border-white/5 text-white/60 hover:text-white hover:bg-white/10'
                  }`}
                  title={isRecording ? `Stop & Insert` : "Record Voice"}
                >
                  {isRecording ? <Square className="w-3 h-3 fill-red-500 text-red-500" /> : <Mic className="w-3 h-3" />}
                  <span>{isRecording ? `${Math.floor(recordingDuration / 60)}:${(recordingDuration % 60 < 10 ? '0' : '') + (recordingDuration % 60)}` : "Record Voice"}</span>
                </button>
              )}
            </div>
          </div>

          <div className="flex-1 min-h-[240px] overflow-y-auto pr-1">
            {shouldMaskEncrypted ? (
              <button
                type="button"
                onClick={() => promptSudo()}
                className="min-h-[200px] w-full text-left cursor-pointer"
              >
                <p className="text-xs italic font-bold text-white/40 leading-relaxed">
                  Secure content hidden. Unlock your secure space to view and edit this note.
                </p>
              </button>
            ) : liveNote.format === 'doodle' ? (
              <NoteContentRenderer content={content} format="doodle" />
            ) : (
              <textarea
                value={content}
                onChange={(e) => {
                  setContent(e.target.value);
                  markDirty();
                }}
                ref={contentTextareaRef}
                className="w-full min-h-[320px] bg-transparent text-white/90 text-lg leading-[1.75] border-none focus:outline-none resize-none scrollbar-thin focus:ring-0 focus:ring-offset-0 font-sans placeholder:text-white/25"
                placeholder="Write in Markdown — headings, lists, links, and voice tags are supported."
                spellCheck
              />
            )}
          </div>
        </div>

        {/* Tags */}
        <div className="px-1.5 shrink-0">
          <span className="text-xs font-mono font-bold tracking-wider text-indigo-400 uppercase block mb-2">Tags</span>
          <div className="flex flex-wrap gap-1.5">
            {displayTags.length > 0 ? displayTags.map((tag: string) => (
              <span key={tag} className="inline-flex px-2 py-0.5 rounded-lg bg-indigo-500/10 border border-indigo-500/20 text-indigo-400 font-mono text-xs font-bold">
                {tag}
              </span>
            )) : (
              <span className="text-xs font-mono text-white/30 italic">No tags assigned</span>
            )}
          </div>
        </div>

        {/* Attachments */}
        <div className="px-1.5 shrink-0">
          <span className="text-xs font-mono font-bold tracking-wider text-indigo-400 uppercase block mb-2">Attachments</span>
          {currentAttachments.length > 0 ? (
            <div className="flex flex-col gap-2">
              {currentAttachments.map((file: any) => (
                <div key={file.id} className="p-3 rounded-xl bg-[#0A0908] border border-white/[0.04] flex justify-between items-center">
                  <div className="flex items-center gap-3">
                    <PaperClipIcon className="w-4 h-4 text-white/40" />
                    <div className="flex flex-col">
                      <span className="text-xs font-bold text-white/80">{file.name}</span>
                      <span className="text-xs font-mono text-white/45">{formatFileSize(file.size)}</span>
                    </div>
                  </div>
                  <button type="button" onClick={() => window.open(`/api/notes/${liveNote.$id}/attachments/${file.id}`, '_blank')} className="p-1.5 text-indigo-400 hover:text-white hover:bg-white/5 rounded-lg transition-colors">
                    <OpenIcon className="w-4 h-4" />
                  </button>
                </div>
              ))}
            </div>
          ) : (
            <span className="text-xs font-mono text-white/30 italic">No attachments</span>
          )}
        </div>

        {/* Voice Notes */}
        <div className="px-1.5 shrink-0">
          <span className="text-xs font-mono font-bold tracking-wider text-pink-400 uppercase block mb-2">Voice Notes</span>
          {attachedObjects.filter(obj => obj.childKind === 'voice').length > 0 ? (
            <div className="flex flex-col gap-2">
              {attachedObjects.filter(obj => obj.childKind === 'voice').map((obj) => (
                <div key={obj.$id} className="p-3 rounded-xl bg-[#0A0908] border border-white/[0.04] flex flex-col gap-2">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-mono text-white/45">Line {obj.metadata ? JSON.parse(obj.metadata).insertLine || 1 : 1}</span>
                    <button 
                      type="button" 
                      onClick={async () => {
                        try {
                          const { detachObject } = await import('@/lib/actions/client-ops');
                          await detachObject(obj.$id);
                          setAttachedObjects(prev => prev.filter(o => o.$id !== obj.$id));
                          showSuccess('Voice note removed');
                        } catch (err: any) {
                          showError('Failed to remove', err.message);
                        }
                      }}
                      className="text-xs text-red-500 hover:text-red-400 hover:underline"
                    >
                      Delete
                    </button>
                  </div>
                  <VoiceNotePlayer fileId={obj.childId} />
                </div>
              ))}
            </div>
          ) : (
            <span className="text-xs font-mono text-white/30 italic">No voice notes</span>
          )}
        </div>

        {/* Linked sections */}
        <div className="flex flex-col gap-4 px-1.5">
          {[
            { label: 'Goals', items: linkedTasks, loading: isLoadingTasks, icon: <TaskIcon className="w-4 h-4" />, color: 'text-emerald-400', borderHover: 'hover:bg-emerald-500/5', iconColor: '#10B981', link: (id: string) => `/flow?taskId=${id}` },
            { label: 'Events', items: linkedEvents, loading: isLoadingEvents, icon: <EventIcon className="w-4 h-4" />, color: 'text-indigo-400', borderHover: 'hover:bg-indigo-500/5', iconColor: '#6366F1', link: (id: string) => `/flow/events?eventId=${id}` },
            { label: 'Secrets', items: linkedSecrets, loading: isLoadingSecrets, icon: <KeyIcon className="w-4 h-4" />, color: 'text-amber-400', borderHover: 'hover:bg-amber-500/5', iconColor: '#F59E0B', link: (id: string) => `/vault?id=${id}` }
          ].map(section => (
            <div key={section.label} className="shrink-0">
              <span className={`text-xs font-mono font-bold tracking-wider uppercase block mb-2 ${section.color}`}>
                Linked {section.label}
              </span>
              {section.loading ? (
                <div className="px-2 py-1 text-xs text-white/40 font-mono flex items-center gap-2">
                  <div className="w-3 h-3 border border-current border-t-transparent rounded-full animate-spin"></div>
                  <span>Loading...</span>
                </div>
              ) : section.items.length > 0 ? (
                <div className="flex flex-col gap-2">
                  {section.items.map((item: any) => (
                    <div key={item.$id} className={`p-3 rounded-xl bg-[#0A0908] border border-white/[0.04] flex justify-between items-center transition-colors ${section.borderHover}`}>
                      <div className="flex items-center gap-3">
                        <span style={{ color: section.iconColor }}>{section.icon}</span>
                        <span className="text-xs font-bold text-white/80">{item.title || item.name}</span>
                      </div>
                      <button type="button" onClick={() => window.open(section.link(item.$id), '_blank')} className="p-1.5 hover:bg-white/5 rounded-lg transition-colors" style={{ color: section.iconColor }}>
                        <OpenIcon className="w-4 h-4" />
                      </button>
                    </div>
                  ))}
                </div>
              ) : (
                <span className="text-xs font-mono text-white/30 italic">No linked {section.label.toLowerCase()}</span>
              )}
            </div>
          ))}

          {/* Collaborators */}
          <div className="shrink-0">
            <span className="text-xs font-mono font-bold tracking-wider text-pink-400 uppercase block mb-2">Collaborators</span>
            {isLoadingCollaborators ? (
              <div className="px-2 py-1 text-xs text-white/40 font-mono flex items-center gap-2">
                <div className="w-3.5 h-3.5 border border-pink-500 border-t-transparent rounded-full animate-spin"></div>
                <span>Loading...</span>
              </div>
            ) : collaboratorProfiles.length > 0 ? (
              <div className="flex flex-col gap-2">
                {collaboratorProfiles.map((p: any) => (
                  <div key={p.$id || p.userId} className="p-2.5 rounded-xl bg-[#0A0908] border border-white/[0.04] flex items-center gap-3 cursor-pointer hover:bg-white/[0.02] transition-colors" onClick={() => openUnified('share-note', { noteId: liveNote.$id, noteTitle: liveNote.title, initialCollaborator: p })}>
                    <IdentityAvatar fileId={p.avatar} alt={p.username} fallback={p.username?.[0]?.toUpperCase()} size={34} verified={p.tier === 'admin' || p.verified} />
                    <div className="flex-1 min-w-0">
                      <span className="text-xs font-bold text-white/80 block truncate">{p.displayName || p.username}</span>
                      <span className="text-xs font-mono text-white/45 block truncate">@{p.username}</span>
                    </div>
                    <span className="px-1.5 py-0.5 rounded text-xs font-mono font-bold bg-pink-500/10 text-pink-400">
                      {p.permissionLevel || 'Viewer'}
                    </span>
                  </div>
                ))}
              </div>
            ) : (
              <span className="text-xs font-mono text-white/30 italic">No collaborators found</span>
            )}
          </div>
        </div>

        {/* Timestamps */}
        <div className="mt-4 pt-3 border-t border-white/5 text-xs font-mono text-white/30 flex flex-col gap-0.5 shrink-0">
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

    </div>
  );
}
