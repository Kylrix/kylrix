'use client';


import React, { useState, useEffect, useMemo, useRef, useCallback } from 'react';
import { Notes } from '@/types/appwrite';
import dynamic from 'next/dynamic';

const DoodleCanvas = dynamic(() => import('@/components/DoodleCanvas'), { ssr: false });
const NoteContentDisplay = dynamic(() => import('@/components/NoteContentDisplay'), { ssr: false });
const NoteContentRenderer = dynamic(() => import('@/components/NoteContentRenderer'), { ssr: false });

import {
  Box,
  Typography,
  Button,
  IconButton,
  TextField,
  ToggleButtonGroup,
  ToggleButton,
  Chip,
  Tooltip,
  Drawer,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  CircularProgress,
  useTheme,
  alpha
} from '@mui/material';
import {
  Delete as TrashIcon,
  ContentCopy as ClipboardDocumentIcon,
  AttachFile as PaperClipIcon,
  OpenInNew as ArrowTopRightOnSquareIcon,
  PushPin as PinIcon,
  PushPinOutlined as PinOutlinedIcon,
  ArrowBack as BackIcon,
  Link as LinkIcon,
  Lock as LockIcon,
  Refresh as RefreshIcon
} from '@mui/icons-material';
import { useToast } from '@/components/ui/Toast';
import { useRouter } from 'next/navigation';
import { useSudo } from '@/context/SudoContext';
import { useProUpgrade } from '@/context/ProUpgradeContext';
import { useDynamicSidebar } from '@/components/ui/DynamicSidebar';
import { useUnifiedDrawer } from '@/context/UnifiedDrawerContext';
import { IdentityAvatar } from '@/components/common/IdentityBadge';
import { useNotes } from '@/context/NotesContext';
import { formatNoteCreatedDate, formatNoteUpdatedDate } from '@/lib/date-utils';
import { getTablesDbRowCached } from '@/lib/ecosystem/tablesdb-row-cache';
import { updateNote, listFlowTasks, listFlowEvents, listKeepCredentials, Query, toggleNoteVisibility, rotatePublicNoteLink, getShareableUrl, getCurrentPublicNoteShareUrl, getCurrentPublicNoteDecryptionKey, getNotePublicState, decryptPublicEncryptedNote, createTaskFromNote } from '@/lib/appwrite';
import { APPWRITE_CONFIG } from '@/lib/appwrite/config';
import { formatFileSize } from '@/lib/utils';
import {
  PlaylistAddCheck as TaskIcon,
  VideoCall as VideoCallIcon,
  OpenInNew as OpenIcon,
  Event as EventIcon,
  VpnKey as KeyIcon,
  RocketLaunch as ActionIcon,
  Close as CloseIcon,
  Share as ShareIcon,
} from '@mui/icons-material';
import { useAutosave } from '@/hooks/useAutosave';
import { ecosystemSecurity } from '@/lib/ecosystem/security';
import { useCallLauncher } from '@/context/CallLauncherContext';

interface NoteDetailSidebarProps {
  note: Notes;
  onUpdate: (updatedNote: Notes) => void;
  onDelete: (noteId: string) => void;
  onBack?: () => void;
  showExpandButton?: boolean;
  showHeaderDeleteButton?: boolean;
}

const shallowArrayEqual = (a?: string[] | null, b?: string[] | null) => {

  if (!a && !b) return true;
  if (!a || !b) return false;
  if (a.length !== b.length) return false;
  for (let i = 0; i < a.length; i += 1) {
    if (a[i] !== b[i]) return false;
  }
  return true;
};

async function importUrlSafeAesKey(keyBase64: string): Promise<CryptoKey> {
  const normalized = keyBase64.replace(/-/g, '+').replace(/_/g, '/');
  const padded = normalized.padEnd(Math.ceil(normalized.length / 4) * 4, '=');
  const raw = Uint8Array.from(atob(padded), (char) => char.charCodeAt(0));
  return crypto.subtle.importKey(
    'raw',
    raw,
    { name: 'AES-GCM', length: 256 },
    true,
    ['encrypt', 'decrypt']
  );
}

export function NoteDetailSidebar({
  note,
  onUpdate,
  onDelete,
  onBack,
  showExpandButton = true,
  showHeaderDeleteButton = true,
}: NoteDetailSidebarProps) {

  const theme = useTheme();
  const { open: openUnified } = useUnifiedDrawer();
  const { notes: allNotes, isPinned, pinNote, unpinNote } = useNotes();
  const liveNote = useMemo(
    () => allNotes.find((candidate) => candidate.$id === note.$id) || note,
    [allNotes, note]
  );
  const noteMeta = useMemo(() => {
    try {
      return JSON.parse(liveNote.metadata || '{}');
    } catch {
      return {};
    }
  }, [liveNote.metadata]);

  const [isEditingTitle, setIsEditingTitle] = useState(false);
  const [isEditingContent, setIsEditingContent] = useState(false);
  const isEditing = isEditingTitle || isEditingContent;
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [showDoodleEditor, setShowDoodleEditor] = useState(false);
  const [title, setTitle] = useState(liveNote.title);
  const [content, setContent] = useState(liveNote.content);
  const [format, setFormat] = useState<'text' | 'doodle'>(liveNote.format as 'text' | 'doodle' || 'text');
  const [tags, setTags] = useState(liveNote.tags?.join(', ') || '');
  const [isPublic, setIsPublic] = useState(getNotePublicState(liveNote));
  const [lastT4Key, setLastT4Key] = useState<string | null>(null);
  const [isUploadingAttachment, setIsUploadingAttachment] = useState(false);
  const [attachmentErrors, setAttachmentErrors] = useState<string[]>([]);
  const [currentAttachments, setCurrentAttachments] = useState<any[]>([]);
  const [linkedTasks, setLinkedTasks] = useState<any[]>([]);
  const [linkedEvents, setLinkedEvents] = useState<any[]>([]);
  const [linkedSecrets, setLinkedSecrets] = useState<any[]>([]);
  const [isLoadingTasks, setIsLoadingTasks] = useState(false);
  const [isLoadingEvents, setIsLoadingEvents] = useState(false);
  const [isLoadingSecrets, setIsLoadingSecrets] = useState(false);
  const [collaboratorProfiles, setCollaboratorProfiles] = useState<any[]>([]);
  const [isLoadingCollaborators, setIsLoadingCollaborators] = useState(false);
  const [showActionHub, setShowActionHub] = useState(false);
  const [pendingHubAction, setPendingHubAction] = useState<null | 'rotate'>(null);
  const [isCreatingTaskFromNote, setIsCreatingTaskFromNote] = useState(false);
  const [crossSuggestions, setCrossSuggestions] = useState<Array<{ id: string; label: string; description: string }>>([]);
  const [isLoadingSuggestions, setIsLoadingSuggestions] = useState(false);
  const titleInputRef = useRef<HTMLInputElement>(null);
  const isT4Encrypted = (noteMeta?.isEncrypted === true || noteMeta?.isEncrypted === 'true') && noteMeta?.encryptionVersion === 'T4';
  const isEncryptedNote = isT4Encrypted && !noteMeta?.clientDecrypted;
  const isT4EncryptedPublicNote = !!isPublic && isT4Encrypted;
  const isLegacyPublicNote = !!isPublic && !isT4EncryptedPublicNote;
  
  const linkedTaskIds = useMemo(() => (liveNote as any).linkedTaskIds || ((liveNote as any).linkedTaskId ? [(liveNote as any).linkedTaskId] : []), [liveNote]);
  const linkedEventIds = useMemo(() => (liveNote as any).linkedEventIds || ((liveNote as any).linkedEventId ? [(liveNote as any).linkedEventId] : []), [liveNote]);
  const linkedCredentialIds = useMemo(() => (liveNote as any).linkedCredentialIds || ((liveNote as any).linkedCredentialId ? [(liveNote as any).linkedCredentialId] : []), [liveNote]);

  // Fetch linked tasks from Kylrix Flow
  useEffect(() => {
    const fetchLinkedTasks = async () => {
      if (!linkedTaskIds || linkedTaskIds.length === 0) {
        setLinkedTasks([]);
        return;
      }

      setIsLoadingTasks(true);
      try {
        const resolved = await Promise.all(linkedTaskIds.map((id: string) => 
          getTablesDbRowCached(
            { databaseId: APPWRITE_CONFIG.DATABASES.KYLRIXFLOW, tableId: 'tasks', rowId: id },
            () => listFlowTasks([Query.equal('$id', id)]).then(res => res.documents[0] || null)
          )
        ));
        setLinkedTasks(resolved.filter(Boolean));
      } catch (err: any) {
        console.error('Failed to fetch linked tasks:', err);
      } finally {
        setIsLoadingTasks(false);
      }
    };

    fetchLinkedTasks();
  }, [linkedTaskIds]);

  // Fetch linked events from Kylrix Flow
  useEffect(() => {
    const fetchLinkedEvents = async () => {
      if (!linkedEventIds || linkedEventIds.length === 0) {
        setLinkedEvents([]);
        return;
      }

      setIsLoadingEvents(true);
      try {
        const resolved = await Promise.all(linkedEventIds.map((id: string) => 
          getTablesDbRowCached(
            { databaseId: APPWRITE_CONFIG.DATABASES.KYLRIXFLOW, tableId: 'events', rowId: id },
            () => listFlowEvents([Query.equal('$id', id)]).then(res => res.documents[0] || null)
          )
        ));
        setLinkedEvents(resolved.filter(Boolean));
      } catch (err: any) {
        console.error('Failed to fetch linked events:', err);
      } finally {
        setIsLoadingEvents(false);
      }
    };

    fetchLinkedEvents();
  }, [linkedEventIds]);

  // Fetch linked secrets from Kylrix Vault
  useEffect(() => {
    const fetchLinkedSecrets = async () => {
      if (!linkedCredentialIds || linkedCredentialIds.length === 0) {
        setLinkedSecrets([]);
        return;
      }

      setIsLoadingSecrets(true);
      try {
        const resolved = await Promise.all(linkedCredentialIds.map((id: string) => 
          getTablesDbRowCached(
            { databaseId: APPWRITE_CONFIG.DATABASES.VAULT, tableId: 'credentials', rowId: id },
            () => listKeepCredentials([Query.equal('$id', id)]).then(res => res.documents[0] || null)
          )
        ));
        setLinkedSecrets(resolved.filter(Boolean));
      } catch (err: any) {
        console.error('Failed to fetch linked secrets:', err);
      } finally {
        setIsLoadingSecrets(false);
      }
    };

    fetchLinkedSecrets();
  }, [linkedCredentialIds]);

  // Fetch hydrated collaborator profiles (Non-blocking background fetch)
  useEffect(() => {
    let active = true;
    const fetchCollaboratorProfiles = async () => {
      if (!liveNote.$id) return;
      
      // Defer slightly to allow sidebar mount animation to complete smoothly
      await new Promise(resolve => setTimeout(resolve, 400));
      if (!active) return;

      setIsLoadingCollaborators(true);
      try {
        const { getResourceCollaboratorsSecure } = await import('@/lib/actions/secure-ops');
        const { account } = await import('@/lib/appwrite');
        const { jwt } = await account.createJWT();
        
        if (!active) return;
        const { collaborators } = await getResourceCollaboratorsSecure({
            resourceId: liveNote.$id,
            resourceType: 'note',
            jwt: jwt
        });
        if (active) setCollaboratorProfiles(collaborators);
      } catch (err) {
        console.error('Failed to fetch collaborator profiles:', err);
      } finally {
        if (active) setIsLoadingCollaborators(false);
      }
    };

    fetchCollaboratorProfiles();
    return () => { active = false; };
  }, [liveNote.$id]);

  const contentTextareaRef = useRef<HTMLTextAreaElement>(null);
  const titleContainerRef = useRef<HTMLDivElement>(null);
  const contentContainerRef = useRef<HTMLDivElement>(null);
  const titleIdleTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const contentIdleTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const wasEditingRef = useRef(isEditing);
  const prevNoteIdRef = useRef(liveNote.$id);
  const hasPromptedEncryptedOpenRef = useRef(false);

  const { showSuccess, showError } = useToast();
  const { promptSudo } = useSudo();
  const { openProUpgrade } = useProUpgrade();
  const router = useRouter();
  const { closeSidebar } = useDynamicSidebar();
  const { openCallLauncher } = useCallLauncher();

  const pinned = isPinned(liveNote.$id);

  const handlePinToggle = async () => {
    try {
      if (pinned) {
        await unpinNote(liveNote.$id);
        showSuccess('Note unpinned');
      } else {
        await pinNote(liveNote.$id);
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

  const handleOpenFullPage = () => {
    if (!liveNote.$id) return;
    closeSidebar();
    router.push(`/notes/${liveNote.$id}`);
  };

  useEffect(() => {
    if (liveNote.attachments && Array.isArray(liveNote.attachments)) {
      try {
        const parsed = liveNote.attachments.map((a: any) => (typeof a === 'string' ? JSON.parse(a) : a));
        setCurrentAttachments(parsed);
      } catch (err: any) {
        console.error('Error parsing attachments:', err);
        setCurrentAttachments([]);
      }
    } else {
      setCurrentAttachments([]);
    }
  }, [liveNote.$id, liveNote.attachments]);

  useEffect(() => {
    if (!isT4EncryptedPublicNote || lastT4Key) return;

    let cancelled = false;
    const loadKey = async () => {
      const key = await getCurrentPublicNoteDecryptionKey(liveNote.$id);
      if (!cancelled && key) {
        setLastT4Key(key);
      }
    };

    loadKey();
    return () => {
      cancelled = true;
    };
  }, [isT4EncryptedPublicNote, lastT4Key, liveNote.$id]);

  useEffect(() => {
    if (!isT4EncryptedPublicNote || noteMeta.clientDecrypted || lastT4Key) return;
    if (hasPromptedEncryptedOpenRef.current) return;

    let cancelled = false;
    const openEncryptedNote = async () => {
      if (!ecosystemSecurity.status.isUnlocked) {
        hasPromptedEncryptedOpenRef.current = true;
        const unlocked = await promptSudo();
        if (!unlocked) {
          hasPromptedEncryptedOpenRef.current = false;
          return;
        }
      }

      const decrypted = await decryptPublicEncryptedNote(liveNote);
      if (cancelled || !decrypted) return;

      setTitle(decrypted.title || '');
      setContent(decrypted.content || '');
      setIsPublic(getNotePublicState(decrypted));
      onUpdate(decrypted);
      hasPromptedEncryptedOpenRef.current = false;
    };

    void openEncryptedNote();
    return () => {
      cancelled = true;
    };
  }, [isT4EncryptedPublicNote, noteMeta.clientDecrypted, lastT4Key, liveNote, promptSudo, onUpdate]);

  useEffect(() => {
    if (isEditing) return;
    prevNoteIdRef.current = liveNote.$id;
    const sync = async () => {
      if (isT4EncryptedPublicNote && lastT4Key) {
        try {
          const key = await importUrlSafeAesKey(lastT4Key);
          const decryptedTitle = await ecosystemSecurity.decryptWithKey(noteMeta.encryptedTitle || liveNote.title || '', key);
          const decryptedContent = await ecosystemSecurity.decryptWithKey(liveNote.content || '', key);
          setTitle(decryptedTitle);
          setContent(decryptedContent);
          return;
        } catch (error) {
          console.error('Failed to decrypt public note for editing:', error);
        }
      }

      setTitle(liveNote.title || '');
      setContent(liveNote.content || '');
    };

    sync();
    setFormat((liveNote.format as 'text' | 'doodle') || 'text');
    setTags((liveNote.tags || []).join(', '));
    setIsPublic(getNotePublicState(liveNote));
    setIsEditingTitle(false);
    setIsEditingContent(false);
  }, [liveNote, liveNote.$id, liveNote.title, liveNote.content, liveNote.format, liveNote.tags, liveNote.isPublic, noteMeta, lastT4Key, isT4EncryptedPublicNote, isEditing]);

  const normalizedTags = useMemo(() => {
    return tags
      .split(',')
      .map((tag) => tag.trim())
      .filter(Boolean);
  }, [tags]);

  const displayTitle = isEncryptedNote ? '🔒 Encrypted Note' : (title || liveNote.title || 'Untitled note');
  const displayContent = isEncryptedNote ? '' : (content || liveNote.content || '');
  const displayFormat = format;
  const displayTags = normalizedTags.length > 0 ? normalizedTags : (liveNote.tags || []);
  const canEditNoteContent = !isT4EncryptedPublicNote || !!lastT4Key;

  const resetTitleIdleTimer = () => {
    if (titleIdleTimer.current) {
      clearTimeout(titleIdleTimer.current);
    }
    titleIdleTimer.current = setTimeout(() => setIsEditingTitle(false), 15000);
  };

  const resetContentIdleTimer = () => {
    if (contentIdleTimer.current) {
      clearTimeout(contentIdleTimer.current);
    }
    contentIdleTimer.current = setTimeout(() => setIsEditingContent(false), 15000);
  };

  useEffect(() => {
    if (!isEditingTitle && titleIdleTimer.current) {
      clearTimeout(titleIdleTimer.current);
      titleIdleTimer.current = null;
    }
  }, [isEditingTitle]);

  useEffect(() => {
    if (!isEditingContent && contentIdleTimer.current) {
      clearTimeout(contentIdleTimer.current);
      contentIdleTimer.current = null;
    }
  }, [isEditingContent]);

  useEffect(() => {
    if (isEditingTitle && titleInputRef.current) {
      titleInputRef.current.focus();
      titleInputRef.current.select();
      resetTitleIdleTimer();
    }
  }, [isEditingTitle]);

  useEffect(() => {
    if (isEditingContent && contentTextareaRef.current) {
      contentTextareaRef.current.focus();
      resetContentIdleTimer();
    }
  }, [isEditingContent]);

  useEffect(() => {
    const handleGlobalFocusOrClick = (event: FocusEvent | MouseEvent) => {
      const target = (event.target || document.activeElement) as Node | null;
      if (isEditingTitle && titleContainerRef.current && target && !titleContainerRef.current.contains(target)) {
        setIsEditingTitle(false);
      }
      if (isEditingContent && contentContainerRef.current && target && !contentContainerRef.current.contains(target)) {
        setIsEditingContent(false);
      }
    };

    document.addEventListener('focusin', handleGlobalFocusOrClick);
    document.addEventListener('mousedown', handleGlobalFocusOrClick);
    return () => {
      document.removeEventListener('focusin', handleGlobalFocusOrClick);
      document.removeEventListener('mousedown', handleGlobalFocusOrClick);
    };
  }, [isEditingTitle, isEditingContent]);

  const autosaveCandidate = useMemo<Notes>(() => ({
    ...liveNote,
    title: (title ?? '').trim(),
    content: (content ?? '').trim(),
    format,
    tags: normalizedTags,
  }), [liveNote, title, content, format, normalizedTags]);

  const saveNote = useCallback(async (candidate: Notes) => {
    if (!candidate.$id) return candidate;
    let metadata: any = candidate.metadata;
    if (metadata) {
      try {
        const parsed = typeof metadata === 'string' ? JSON.parse(metadata) : metadata;
        if (parsed && typeof parsed === 'object') {
          delete parsed.clientDecrypted;
          metadata = JSON.stringify(parsed);
        }
      } catch {
        metadata = candidate.metadata;
      }
    }
    const payload: Partial<Notes> = {
      title: candidate.title,
      content: candidate.content,
      format: candidate.format,
      tags: candidate.tags,
      isPublic: candidate.isPublic,
      status: candidate.status,
      parentNoteId: candidate.parentNoteId,
      comments: candidate.comments,
      extensions: candidate.extensions,
      collaborators: candidate.collaborators,
      metadata,
    };

    if (isT4EncryptedPublicNote || (candidate.isPublic && isT4Encrypted)) {
      if (!lastT4Key) {
        throw new Error('Missing public note key');
      }

      const key = await importUrlSafeAesKey(lastT4Key);
      const encryptedTitle = await ecosystemSecurity.encryptWithKey(candidate.title || '', key);
      const encryptedContent = await ecosystemSecurity.encryptWithKey(candidate.content || '', key);
      payload.title = '🔒 Encrypted Note';
      payload.content = encryptedContent;
      payload.metadata = JSON.stringify({
        ...noteMeta,
        isGhost: false,
        isEncrypted: true,
        encryptionVersion: 'T4',
        encryptedTitle,
      });
    }

    const saved = await updateNote(candidate.$id, payload);
    onUpdate(saved);
    return saved;
  }, [onUpdate, isT4EncryptedPublicNote, isT4Encrypted, lastT4Key, noteMeta]);

  const { isSaving: isAutosaving, forceSave } = useAutosave(autosaveCandidate, {
    enabled: !!liveNote.$id,
    debounceMs: 600,
    trigger: 'manual',
    save: saveNote,
    onSave: () => {
      // local state already updated via onUpdate
    },
    onError: (error) => {
      showError('Autosave failed', error?.message || 'Could not sync your note');
    },
  });

  useEffect(() => {
    if (wasEditingRef.current && !isEditing && autosaveCandidate.$id) {
      forceSave(autosaveCandidate);
    }
    wasEditingRef.current = isEditing;
  }, [isEditing, autosaveCandidate, forceSave]);

  useEffect(() => {
    if (!isEditing || !liveNote.$id) return;
    const trimmedTitle = (title ?? '').trim();
    const trimmedContent = (content ?? '').trim();
    const tagsMatch = shallowArrayEqual(liveNote.tags || [], normalizedTags);
    const matchesExisting =
      (liveNote.title || '') === trimmedTitle &&
      (liveNote.content || '') === trimmedContent &&
      (liveNote.format || 'text') === format &&
      tagsMatch;
    if (matchesExisting) return;

    onUpdate({
      ...liveNote,
      title: trimmedTitle,
      content: trimmedContent,
      format,
      tags: normalizedTags,
      updatedAt: new Date().toISOString(),
    });
  }, [isEditing, title, content, format, normalizedTags, liveNote, onUpdate]);

  const handleDoodleSave = (doodleData: string) => {
    setContent(doodleData);
    setShowDoodleEditor(false);
  };

  const activateTitleEditing = () => {
    if (!canEditNoteContent) {
      showError('Vault Locked', 'Unlock vault to edit this public note.');
      return;
    }
    setIsEditingTitle(true);
  };

  const activateContentEditing = () => {
    if (!canEditNoteContent) {
      showError('Vault Locked', 'Unlock vault to edit this public note.');
      return;
    }
    setIsEditingContent(true);
  };

  const handleAttachmentUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.currentTarget.files;
    if (!files || files.length === 0) return;

    setIsUploadingAttachment(true);
    setAttachmentErrors([]);
    const newErrors: string[] = [];

    try {
      for (let i = 0; i < files.length; i++) {
        const file = files[i];
        try {
          const formData = new FormData();
          formData.append('file', file);
          const res = await fetch(`/api/notes/${liveNote.$id}/attachments`, {
            method: 'POST',
            body: formData,
            credentials: 'include',
          });

          if (!res.ok) {
            let errorPayload: any = null;
            try {
              errorPayload = await res.json();
            } catch {
              try {
                errorPayload = { raw: await res.text() };
              } catch {
                errorPayload = { error: `HTTP ${res.status}: ${res.statusText}` };
              }
            }
            const msg = errorPayload?.error || errorPayload?.raw || `Upload failed (${res.status})`;
            newErrors.push(`${file.name}: ${msg}`);
          } else {
            const data = await res.json();
            if (data.attachment) {
              setCurrentAttachments((prev) => [...prev, data.attachment]);
              showSuccess('Attachment added', `${file.name} uploaded successfully`);
            }
          }
        } catch (err: any) {
          newErrors.push(`${file.name}: ${err?.message || 'Upload failed'}`);
        }
      }

      if (newErrors.length > 0) {
        setAttachmentErrors(newErrors);
      }
    } finally {
      setIsUploadingAttachment(false);
      if (e.currentTarget) {
        e.currentTarget.value = '';
      }
    }
  };

  const handleCopyShareLink = async () => {
    if (!isPublic) {
      showError('Private note', 'Make the note public first to copy a share link.');
      return;
    }

    if (isLegacyPublicNote) {
      navigator.clipboard.writeText(getShareableUrl(liveNote.$id));
      showSuccess('Share link copied to clipboard');
      return;
    }

    const shareUrl = await getCurrentPublicNoteShareUrl(liveNote.$id);
    if (!shareUrl) {
      showError('Vault Locked', 'Unlock vault to copy the current public link.');
      return;
    }
    navigator.clipboard.writeText(shareUrl);
    showSuccess('Share link copied to clipboard');
  };

  const handleRotatePublicLink = async (): Promise<boolean> => {
    const handleRotate = async (): Promise<boolean> => {
      try {
        const updated = await rotatePublicNoteLink(liveNote.$id);
        if (updated) {
          setIsPublic(!!updated.isPublic);
          setLastT4Key(updated.decryptionKey || null);
          onUpdate(updated);
          if (updated.decryptionKey) {
            const shareUrl = getShareableUrl(liveNote.$id, updated.decryptionKey);
            navigator.clipboard.writeText(shareUrl);
            showSuccess('Public link rotated', 'New public link copied to clipboard.');
          } else {
            showSuccess('Public link rotated');
          }
          return true;
        }
      } catch (err: any) {
        if (err.message === 'VAULT_LOCKED') {
          showError('Vault Locked', 'You must unlock your vault to rotate the public link.');
          const unlocked = await promptSudo();
          if (unlocked) return handleRotate();
        } else {
          showError('Rotate Failed', err.message || 'Failed to rotate public link.');
        }
      }
      return false;
    };

    return handleRotate();
  };

  const handleCancel = () => {
    setTitle(liveNote.title || '');
    setContent(liveNote.content || '');
    setFormat((liveNote.format as 'text' | 'doodle') || 'text');
    setTags((liveNote.tags || []).join(', '));
    setIsEditingTitle(false);
    setIsEditingContent(false);
  };

  const handleDelete = () => {
    onDelete(liveNote.$id || '');
    setShowDeleteConfirm(false);
  };

  const confirmRotateLink = async () => {
    setPendingHubAction(null);
    const rotated = await handleRotatePublicLink();
    if (rotated) setShowActionHub(false);
  };

  // Pre-fetch cross-app suggestions when note changes (Non-blocking)
  useEffect(() => {
    let active = true;
    const fetchCrossAppSuggestions = async () => {
      if (!liveNote.$id) return;
      
      // Defer slightly to avoid blocking the UI
      await new Promise(resolve => setTimeout(resolve, 600));
      if (!active) return;

      setIsLoadingSuggestions(true);
      try {
        const url = `/note/api/cross/suggest?sourceApp=note&sourceType=note&sourceId=${encodeURIComponent(liveNote.$id)}`;
        console.log('[Sidebar] Fetching suggestions:', url);
        const response = await fetch(url);
        
        if (!response.ok) {
            console.error('[Sidebar] API error:', response.status, response.statusText);
        }
        
        const data = await response.json().catch(() => null);
        console.log('[Sidebar] Suggestions received:', data);
        
        if (active) setCrossSuggestions(Array.isArray(data?.suggestions) ? data.suggestions : []);
      } catch (error: unknown) {
        console.error('Failed to load cross-app suggestions:', error);
        if (active) setCrossSuggestions([]);
      } finally {
        if (active) setIsLoadingSuggestions(false);
      }
    };

    fetchCrossAppSuggestions();
    return () => { active = false; };
  }, [liveNote.$id]);

  const handleCreateTaskFromNote = useCallback(async () => {
    setIsCreatingTaskFromNote(true);
    try {
      const task = await createTaskFromNote(liveNote);
      onUpdate({ ...liveNote, linkedTaskId: task.$id } as Notes);
      setShowActionHub(false);
      showSuccess('Task created from note');
    } catch (error: any) {
      if (error?.message === 'User not authenticated') {
        showError('Auth Required', 'Unlock your vault before creating a task from this note.');
        const unlocked = await promptSudo();
        if (unlocked) {
          await handleCreateTaskFromNote();
        }
        return;
      }
      showError('Create Task Failed', error?.message || 'Failed to create task from note.');
    } finally {
      setIsCreatingTaskFromNote(false);
    }
  }, [liveNote, onUpdate, promptSudo, showError, showSuccess]);

  const handleStartNoteHuddle = useCallback(() => {
    const ownerId = String((liveNote as any).userId || '').trim();
    const collaborators = Array.isArray((liveNote as any).collaborators)
      ? (liveNote as any).collaborators
          .map((entry: any) => {
            if (typeof entry === 'string') return entry;
            if (entry && typeof entry === 'object') return entry.userId || entry.id || '';
            return '';
          })
          .filter(Boolean)
      : [];
    const participantIds = Array.from(new Set([ownerId, ...collaborators].filter(Boolean)));

    openCallLauncher({
      source: 'note',
      noteId: liveNote.$id,
      participantIds,
      title: liveNote.title ? `Huddle: ${liveNote.title}` : 'Note Huddle',
    });
  }, [liveNote, openCallLauncher]);

  return (
    <Box sx={{ p: { xs: 2, md: 2.5 }, display: 'flex', flexDirection: 'column', gap: 3 }}>
      <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 1.5 }}>
        <IconButton
          onClick={onBack || closeSidebar}
          sx={{
            color: theme.palette.text.secondary,
            '&:hover': { color: theme.palette.primary.main, bgcolor: alpha(theme.palette.primary.main, 0.1) }
          }}
        >
          <BackIcon />
        </IconButton>

        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5 }}>
          <Tooltip title="Action hub">
            <IconButton
              onClick={() => setShowActionHub(true)}
              sx={{
                color: theme.palette.primary.main,
                bgcolor: alpha(theme.palette.primary.main, 0.08),
                '&:hover': { bgcolor: alpha(theme.palette.primary.main, 0.14) }
              }}
            >
              <ActionIcon fontSize="small" />
            </IconButton>
          </Tooltip>
          <Tooltip title="Start note huddle">
            <IconButton
              onClick={handleStartNoteHuddle}
              sx={{
                color: theme.palette.primary.main,
                bgcolor: alpha(theme.palette.primary.main, 0.08),
                '&:hover': { bgcolor: alpha(theme.palette.primary.main, 0.14) }
              }}
            >
              <VideoCallIcon fontSize="small" />
            </IconButton>
          </Tooltip>
          {showExpandButton && (
            <Tooltip title="Open full page">
              <IconButton
                onClick={(event) => {
                event.stopPropagation();
                  handleOpenFullPage();
                }}
                sx={{
                  display: { xs: 'none', md: 'inline-flex' },
                  color: theme.palette.text.secondary,
                  '&:hover': { color: theme.palette.primary.main, bgcolor: alpha(theme.palette.primary.main, 0.1) }
                }}
              >
                <ArrowTopRightOnSquareIcon fontSize="small" />
              </IconButton>
            </Tooltip>
          )}

          <Tooltip title={isPublic ? "Make private" : "Make public"}>
            <IconButton
              onClick={async () => {
                const handleToggle = async () => {
                  try {
                    const updated = await toggleNoteVisibility(liveNote.$id);
                    if (updated) {
                      setIsPublic(!!updated.isPublic);
                      setLastT4Key(updated.decryptionKey || null);
                      onUpdate(updated);
                      showSuccess(updated.isPublic ? 'Note is now Public' : 'Note is now Private');
                      if (updated.isPublic && updated.decryptionKey) {
                        const shareUrl = getShareableUrl(liveNote.$id, updated.decryptionKey);
                        navigator.clipboard.writeText(shareUrl);
                        showSuccess('Link Copied', 'Encrypted public link is on your clipboard.');
                      }
                    }
                  } catch (err: any) {
                    if (err.message === 'VAULT_LOCKED') {
          showError('Vault Locked', 'You must unlock your vault to update this note.');
                      const unlocked = await promptSudo();
                      if (unlocked) handleToggle();
                    } else {
                      showError('Toggle Failed', err.message || 'Failed to update visibility.');
                    }
                  }
                };
                handleToggle();
              }}
              sx={{
                color: isPublic ? theme.palette.primary.main : theme.palette.text.secondary,
                '&:hover': { color: theme.palette.primary.main, bgcolor: alpha(theme.palette.primary.main, 0.1) }
              }}
            >
              {isPublic ? <LinkIcon fontSize="small" /> : <LockIcon fontSize="small" />}
            </IconButton>
          </Tooltip>

          {isT4EncryptedPublicNote && (
            <Tooltip title="Change public link">
              <IconButton
                onClick={handleRotatePublicLink}
                sx={{
                  color: theme.palette.text.secondary,
                  '&:hover': { color: theme.palette.primary.main, bgcolor: alpha(theme.palette.primary.main, 0.1) }
                }}
              >
                <RefreshIcon fontSize="small" />
              </IconButton>
            </Tooltip>
          )}

          {isPublic && (
            <Tooltip title="Copy share link">
              <IconButton
                onClick={handleCopyShareLink}
                sx={{
                  color: theme.palette.text.secondary,
                  '&:hover': { color: theme.palette.primary.main, bgcolor: alpha(theme.palette.primary.main, 0.1) }
                }}
              >
                <ClipboardDocumentIcon fontSize="small" />
              </IconButton>
            </Tooltip>
          )}

          <Tooltip title={pinned ? "Unpin note" : "Pin note"}>
            <IconButton
              onClick={handlePinToggle}
              sx={{
                color: pinned ? theme.palette.secondary.main : theme.palette.text.secondary,
                '&:hover': { color: theme.palette.secondary.main, bgcolor: alpha(theme.palette.secondary.main, 0.1) }
              }}
            >
              {pinned ? <PinIcon fontSize="small" /> : <PinOutlinedIcon fontSize="small" />}
            </IconButton>
          </Tooltip>

          {showHeaderDeleteButton && (
            <Tooltip title="Delete note">
              <IconButton
                onClick={() => setShowDeleteConfirm(true)}
                sx={{
                  color: theme.palette.text.secondary,
                  '&:hover': { color: theme.palette.error.main, bgcolor: alpha(theme.palette.error.main, 0.1) }
                }}
              >
                <TrashIcon fontSize="small" />
              </IconButton>
            </Tooltip>
          )}
        </Box>
      </Box>

      <Box
        ref={titleContainerRef}
        sx={{
          borderRadius: '32px',
          border: '1px solid #1C1A18',
          bgcolor: '#161412',
          p: { xs: 2.25, md: 2.75 },
          transition: 'all 0.4s cubic-bezier(0.16, 1, 0.3, 1)',
          boxShadow: '0 24px 48px rgba(0, 0, 0, 0.4), inset 0 1px 0 rgba(255, 255, 255, 0.05), inset 0 -1px 0 rgba(0, 0, 0, 0.4)',
          '&:focus-within': {
            borderColor: '#EC4899',
            bgcolor: alpha('#EC4899', 0.05),
            transform: 'translateZ(20px) translateY(-4px)',
            boxShadow: `0 32px 64px ${alpha('#EC4899', 0.2)}, inset 0 1px 0 rgba(255, 255, 255, 0.05), inset 0 -1px 0 rgba(0, 0, 0, 0.4)`,
          }
        }}
      >
        <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', mb: 2 }}>
          <Typography
            variant="caption"
            sx={{
              color: theme.palette.secondary.main,
              fontWeight: 900,
              textTransform: 'uppercase',
              letterSpacing: '0.15em',
              fontFamily: 'var(--font-clash-display)'
            }}
          >
            Title
          </Typography>
          <Typography variant="caption" sx={{ color: theme.palette.text.secondary, fontWeight: 700, fontFamily: 'var(--font-satoshi)', opacity: 0.6 }}>
            Click to Edit
          </Typography>
        </Box>
        {isEditingTitle ? (
          <TextField
            fullWidth
            variant="standard"
            value={title || ''}
            onChange={(e) => {
              setTitle(e.target.value);
              resetTitleIdleTimer();
            }}
            inputRef={titleInputRef}
            InputProps={{
              disableUnderline: true,
              sx: {
                fontSize: { xs: '1.2rem', md: '1.5rem' },
                fontWeight: 900,
                color: theme.palette.text.primary,
                fontFamily: 'var(--font-clash-display)',
                letterSpacing: '-0.02em',
                lineHeight: 1.2,
                width: '100%',
                overflowWrap: 'anywhere',
              }
            }}
          />
        ) : (
          <Typography
            variant="h5"
            onClick={activateTitleEditing}
            sx={{
              fontWeight: 900,
              cursor: 'text',
              color: theme.palette.text.primary,
              fontFamily: 'var(--font-clash-display)',
              fontSize: { xs: '1.2rem', md: '1.5rem' },
              lineHeight: 1.2,
              letterSpacing: '-0.02em',
              overflowWrap: 'anywhere',
              wordBreak: 'break-word',
              transition: 'color 0.2s ease',
              '&:hover': {
                color: theme.palette.secondary.main
              }
            }}
          >
            {displayTitle}
          </Typography>
        )}
      </Box>

      <Box
        ref={contentContainerRef}
        sx={{
          borderRadius: '32px',
          border: '1px solid #1C1A18',
          bgcolor: '#161412',
          p: { xs: 2.25, md: 2.75 },
          transition: 'all 0.4s cubic-bezier(0.16, 1, 0.3, 1)',
          boxShadow: '0 24px 48px rgba(0, 0, 0, 0.4), inset 0 1px 0 rgba(255, 255, 255, 0.05), inset 0 -1px 0 rgba(0, 0, 0, 0.4)',
          '&:focus-within': {
            borderColor: '#EC4899',
            bgcolor: alpha('#EC4899', 0.05),
            transform: 'translateZ(20px) translateY(-4px)',
            boxShadow: `0 32px 64px ${alpha('#EC4899', 0.2)}, inset 0 1px 0 rgba(255, 255, 255, 0.05), inset 0 -1px 0 rgba(0, 0, 0, 0.4)`,
          }
        }}
      >
        <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', mb: 3 }}>
          <Typography
            variant="caption"
            sx={{
              color: theme.palette.primary.main,
              fontWeight: 900,
              textTransform: 'uppercase',
              letterSpacing: '0.15em',
              fontFamily: 'var(--font-clash-display)'
            }}
          >
            Content
          </Typography>
          <Typography variant="caption" sx={{ color: theme.palette.text.secondary, fontWeight: 700, fontFamily: 'var(--font-satoshi)', opacity: 0.6 }}>
            Rich Content Environment
          </Typography>
        </Box>

        {isEditingContent ? (
          <Box sx={{ display: 'flex', flexDirection: 'column', gap: 3 }}>
            <ToggleButtonGroup
              value={format}
              exclusive
              onChange={(_, newFormat) => newFormat && setFormat(newFormat)}
              fullWidth
              size="small"
              sx={{
                bgcolor: alpha(theme.palette.text.primary, 0.05),
                p: 0.5,
                borderRadius: '12px',
                '& .MuiToggleButton-root': {
                  border: 'none',
                  borderRadius: '8px',
                  color: theme.palette.text.secondary,
                  fontFamily: 'var(--font-clash)',
                  fontWeight: 700,
                  textTransform: 'uppercase',
                  letterSpacing: '0.05em',
                  '&.Mui-selected': {
                    bgcolor: theme.palette.primary.main,
                    color: theme.palette.primary.contrastText,
                    '&:hover': { bgcolor: theme.palette.primary.dark }
                  }
                }
              }}
            >
              <ToggleButton value="text">Text</ToggleButton>
              <ToggleButton value="doodle">Doodle</ToggleButton>
            </ToggleButtonGroup>

            {format === 'text' ? (
              <TextField
                fullWidth
                multiline
                rows={12}
                variant="standard"
                value={content || ''}
                onChange={(e) => {
                  setContent(e.target.value);
                  resetContentIdleTimer();
                }}
                inputRef={contentTextareaRef}
                InputProps={{
                  disableUnderline: true,
                  sx: {
                    fontSize: '0.9rem',
                    color: theme.palette.text.primary,
                    lineHeight: 1.7,
                    fontFamily: 'var(--font-satoshi)'
                  }
                }}
              />
            ) : (
              <Box>
                {content ? (
                  <Box sx={{ border: `1px solid ${theme.palette.divider}`, borderRadius: '16px', overflow: 'hidden' }}>
                    <NoteContentDisplay
                      content={content}
                      format="doodle"
                      onEditDoodle={() => setShowDoodleEditor(true)}
                    />
                  </Box>
                ) : (
                  <Button
                    fullWidth
                    variant="outlined"
                    onClick={() => setShowDoodleEditor(true)}
                    sx={{
                      height: 160,
                      borderStyle: 'dashed',
                      borderRadius: '16px',
                      borderColor: theme.palette.divider,
                      color: theme.palette.text.secondary,
                      fontFamily: 'var(--font-clash)',
                      fontWeight: 700,
                      '&:hover': {
                        borderColor: theme.palette.primary.main,
                        bgcolor: alpha(theme.palette.primary.main, 0.05),
                        color: theme.palette.primary.main
                      }
                    }}
                  >
                    Click to draw
                  </Button>
                )}
              </Box>
            )}
          </Box>
        ) : (
          <Box onClick={activateContentEditing} sx={{ cursor: 'text' }}>
            <NoteContentRenderer
              content={displayContent}
              format={displayFormat}
              emptyFallback={
                <Typography variant="body2" sx={{ fontStyle: 'italic', color: theme.palette.text.secondary }}>
                  🔒 Encrypted note
                </Typography>
              }
              onEditDoodle={displayFormat === 'doodle' ? activateContentEditing : undefined}
            />

            {displayFormat !== 'doodle' && displayContent && (
              <Box sx={{ pt: 3 }}>
                <Button
                  variant="outlined"
                  size="small"
                  startIcon={<ClipboardDocumentIcon />}
                  onClick={async (event) => {
                    event.stopPropagation();
                    try {
                      await navigator.clipboard.writeText(displayContent);
                      showSuccess('Copied', 'Content copied to clipboard');
                    } catch {
                      showError('Copy failed', 'Could not copy content to clipboard');
                    }
                  }}
                  sx={{
                    borderRadius: '10px',
                    borderColor: theme.palette.divider,
                    color: theme.palette.text.secondary,
                    fontFamily: 'var(--font-clash)',
                    fontWeight: 700,
                    textTransform: 'uppercase',
                    fontSize: '0.75rem',
                    '&:hover': {
                      borderColor: theme.palette.primary.main,
                      color: theme.palette.primary.main,
                      bgcolor: alpha(theme.palette.primary.main, 0.05)
                    }
                  }}
                >
                  Copy Content
                </Button>
              </Box>
            )}
          </Box>
        )}
      </Box>

      {/* Tags */}
      <Box>
        <Typography
          variant="caption"
          sx={{
            display: 'block',
            mb: 2,
            color: theme.palette.primary.main,
            fontWeight: 900,
            textTransform: 'uppercase',
            letterSpacing: '0.1em',
            fontFamily: 'var(--font-clash)'
          }}
        >
          Tags
        </Typography>
        {isEditing ? (
          <TextField
            fullWidth
            size="small"
            placeholder="Separate tags with commas"
            value={tags}
            onChange={ (e) => setTags(e.target.value)}
            sx={{
              '& .MuiOutlinedInput-root': {
                borderRadius: '12px',
                bgcolor: alpha(theme.palette.text.primary, 0.03),
                fontFamily: 'var(--font-satoshi)',
                '& fieldset': { borderColor: theme.palette.divider },
                '&:hover fieldset': { borderColor: alpha(theme.palette.text.primary, 0.2) },
                '&.Mui-focused fieldset': { borderColor: theme.palette.primary.main },
              }
            }}
          />
        ) : (
          <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 1 }}>
            {displayTags.map((tag: string, index: number) => (
              <Chip
                key={`${tag}-${index}`}
                label={tag}
                size="small"
                sx={{
                  bgcolor: alpha(theme.palette.primary.main, 0.1),
                  color: theme.palette.primary.main,
                  border: `1px solid ${alpha(theme.palette.primary.main, 0.2)}`,
                  fontWeight: 700,
                  fontFamily: 'var(--font-clash)',
                  textTransform: 'uppercase',
                  fontSize: '0.7rem',
                  borderRadius: '6px'
                }}
              />
            ))}
          </Box>
        )}
      </Box>

      {/* Attachments */}
      <Box>
        <Typography
          variant="caption"
          sx={{
            display: 'block',
            mb: 2,
            color: theme.palette.primary.main,
            fontWeight: 900,
            textTransform: 'uppercase',
            letterSpacing: '0.1em',
            fontFamily: 'var(--font-clash)'
          }}
        >
          Attachments
        </Typography>
        {isEditing && (
          <Box sx={{ mb: 2.5 }}>
            <input
              type="file"
              id="attachment-input"
              multiple
              onChange={handleAttachmentUpload}
              disabled={isUploadingAttachment}
              style={{ display: 'none' }}
            />
            <Button
              fullWidth
              variant="outlined"
              startIcon={isUploadingAttachment ? <CircularProgress size={16} sx={{ color: theme.palette.primary.main }} /> : <PaperClipIcon />}
              onClick={() => document.getElementById('attachment-input')?.click()}
              disabled={isUploadingAttachment}
              sx={{
                borderRadius: '12px',
                borderColor: theme.palette.divider,
                color: theme.palette.text.primary,
                fontFamily: 'var(--font-clash)',
                fontWeight: 700,
                textTransform: 'uppercase',
                '&:hover': {
                  borderColor: theme.palette.primary.main,
                  bgcolor: alpha(theme.palette.primary.main, 0.05)
                }
              }}
            >
              {isUploadingAttachment ? 'Uploading...' : 'Add Attachments'}
            </Button>
            {attachmentErrors.length > 0 && (
              <Box sx={{ mt: 1.5 }}>
                {attachmentErrors.map((err, i) => (
                  <Typography key={i} variant="caption" sx={{ display: 'block', color: theme.palette.error.main, bgcolor: alpha(theme.palette.error.main, 0.1), p: 1.5, borderRadius: '8px', mt: 1, fontFamily: 'var(--font-satoshi)' }}>
                    {err}
                  </Typography>
                ))}
              </Box>
            )}
          </Box>
        )}
        {currentAttachments.length > 0 ? (
          <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1.5, maxHeight: 240, overflow: 'auto' }}>
            {currentAttachments.map((a: any) => (
              <Box key={a.id} sx={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                gap: 2,
                p: 2,
                borderRadius: '16px',
                bgcolor: alpha(theme.palette.text.primary, 0.03),
                border: `1px solid ${theme.palette.divider}`,
                transition: 'all 0.2s ease',
                '&:hover': {
                  bgcolor: alpha(theme.palette.text.primary, 0.05),
                  borderColor: alpha(theme.palette.text.primary, 0.1)
                }
              }}>
                <Box sx={{ minWidth: 0 }}>
                  <Typography variant="body2" sx={{ fontWeight: 700, color: theme.palette.primary.main, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', fontFamily: 'var(--font-clash)' }}>
                    {a.name}
                  </Typography>
                  <Typography variant="caption" sx={{ color: theme.palette.text.secondary, fontFamily: 'var(--font-satoshi)' }}>
                    {formatFileSize(a.size)}{a.mime ? ` • ${a.mime}` : ''}
                  </Typography>
                </Box>
                <Button
                  size="small"
                  href={`/notes/${liveNote.$id}/${a.id}`}
                  sx={{
                    color: theme.palette.primary.main,
                    fontWeight: 800,
                    fontFamily: 'var(--font-clash)',
                    '&:hover': { bgcolor: alpha(theme.palette.primary.main, 0.1) }
                  }}
                >
                  OPEN
                </Button>
              </Box>
            ))}
          </Box>
        ) : (
          <Typography variant="body2" sx={{ fontStyle: 'italic', color: theme.palette.text.secondary, fontFamily: 'var(--font-satoshi)' }}>No attachments</Typography>
        )}
      </Box>

      {/* Linked Tasks */}
      <Box>
        <Typography
          variant="caption"
          sx={{
            display: 'block',
            mb: 2,
            color: theme.palette.primary.main,
            fontWeight: 900,
            textTransform: 'uppercase',
            letterSpacing: '0.1em',
            fontFamily: 'var(--font-clash)'
          }}
        >
          Linked Tasks (Flow)
        </Typography>
        {isLoadingTasks ? (
          <CircularProgress size={20} sx={{ color: theme.palette.primary.main, ml: 1 }} />
        ) : linkedTasks.length > 0 ? (
          <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1.5 }}>
            {linkedTasks.map((task) => (
              <Box key={task.$id} sx={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                gap: 2,
                p: 2,
                borderRadius: '16px',
                bgcolor: alpha(theme.palette.primary.main, 0.03),
                border: `1px solid ${alpha(theme.palette.primary.main, 0.1)}`,
                transition: 'all 0.2s ease',
                '&:hover': {
                  bgcolor: alpha(theme.palette.primary.main, 0.06),
                  borderColor: alpha(theme.palette.primary.main, 0.3)
                }
              }}>
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5, minWidth: 0 }}>
                  <TaskIcon sx={{ color: task.status === 'done' ? '#4CAF50' : theme.palette.primary.main, fontSize: 18 }} />
                  <Typography variant="body2" sx={{ fontWeight: 700, color: theme.palette.text.primary, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', fontFamily: 'var(--font-clash)' }}>
                    {task.title}
                  </Typography>
                </Box>
                <IconButton
                  size="small"
                  onClick={() => window.open(`/flow?taskId=${task.$id}`, '_blank')}
                  sx={{ color: theme.palette.primary.main }}
                >
                  <OpenIcon fontSize="small" />
                </IconButton>
              </Box>
            ))}
          </Box>
        ) : (
          <Typography variant="body2" sx={{ fontStyle: 'italic', color: theme.palette.text.secondary, fontFamily: 'var(--font-satoshi)' }}>No linked tasks</Typography>
        )}
      </Box>

      {/* Linked Events */}
      <Box>
        <Typography
          variant="caption"
          sx={{
            display: 'block',
            mb: 2,
            color: theme.palette.primary.main,
            fontWeight: 900,
            textTransform: 'uppercase',
            letterSpacing: '0.1em',
            fontFamily: 'var(--font-clash)'
          }}
        >
          Linked Events (Flow)
        </Typography>
        {isLoadingEvents ? (
          <CircularProgress size={20} sx={{ color: theme.palette.primary.main, ml: 1 }} />
        ) : linkedEvents.length > 0 ? (
          <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1.5 }}>
            {linkedEvents.map((event) => (
              <Box key={event.$id} sx={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                gap: 2,
                p: 2,
                borderRadius: '16px',
                bgcolor: alpha(theme.palette.primary.main, 0.03),
                border: `1px solid ${alpha(theme.palette.primary.main, 0.1)}`,
                transition: 'all 0.2s ease',
                '&:hover': {
                  bgcolor: alpha(theme.palette.primary.main, 0.06),
                  borderColor: alpha(theme.palette.primary.main, 0.3)
                }
              }}>
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5, minWidth: 0 }}>
                  <EventIcon sx={{ color: theme.palette.primary.main, fontSize: 18 }} />
                  <Typography variant="body2" sx={{ fontWeight: 700, color: theme.palette.text.primary, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', fontFamily: 'var(--font-clash)' }}>
                    {event.title}
                  </Typography>
                </Box>
                <IconButton
                  size="small"
                  onClick={() => window.open(`/flow/events?eventId=${event.$id}`, '_blank')}
                  sx={{ color: theme.palette.primary.main }}
                >
                  <OpenIcon fontSize="small" />
                </IconButton>
              </Box>
            ))}
          </Box>
        ) : (
          <Typography variant="body2" sx={{ fontStyle: 'italic', color: theme.palette.text.secondary, fontFamily: 'var(--font-satoshi)' }}>No linked events</Typography>
        )}
      </Box>

      {/* Linked Secrets */}
      <Box>
        <Typography
          variant="caption"
          sx={{
            display: 'block',
            mb: 2,
            color: theme.palette.primary.main,
            fontWeight: 900,
            textTransform: 'uppercase',
            letterSpacing: '0.1em',
            fontFamily: 'var(--font-clash)'
          }}
        >
          Linked Secrets (Keep)
        </Typography>
        {isLoadingSecrets ? (
          <CircularProgress size={20} sx={{ color: theme.palette.primary.main, ml: 1 }} />
        ) : linkedSecrets.length > 0 ? (
          <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1.5 }}>
            {linkedSecrets.map((secret) => (
              <Box key={secret.$id} sx={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                gap: 2,
                p: 2,
                borderRadius: '16px',
                bgcolor: alpha(theme.palette.primary.main, 0.03),
                border: `1px solid ${alpha(theme.palette.primary.main, 0.1)}`,
                transition: 'all 0.2s ease',
                '&:hover': {
                  bgcolor: alpha(theme.palette.primary.main, 0.06),
                  borderColor: alpha(theme.palette.primary.main, 0.3)
                }
              }}>
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5, minWidth: 0 }}>
                  <KeyIcon sx={{ color: theme.palette.primary.main, fontSize: 18 }} />
                  <Typography variant="body2" sx={{ fontWeight: 700, color: theme.palette.text.primary, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', fontFamily: 'var(--font-clash)' }}>
                    {secret.name}
                  </Typography>
                </Box>
                <IconButton
                  size="small"
                  onClick={() => window.open(`/vault?id=${secret.$id}`, '_blank')}
                  sx={{ color: theme.palette.primary.main }}
                >
                  <OpenIcon fontSize="small" />
                </IconButton>
              </Box>
            ))}
          </Box>
        ) : (
          <Typography variant="body2" sx={{ fontStyle: 'italic', color: theme.palette.text.secondary, fontFamily: 'var(--font-satoshi)' }}>No linked secrets</Typography>
        )}
      </Box>

      {/* Collaborators */}
      <Box>
        <Typography
          variant="caption"
          sx={{
            display: 'block',
            mb: 2,
            color: theme.palette.primary.main,
            fontWeight: 900,
            textTransform: 'uppercase',
            letterSpacing: '0.1em',
            fontFamily: 'var(--font-clash)'
          }}
        >
          Collaborators
        </Typography>
        {isLoadingCollaborators ? (
          <CircularProgress size={20} sx={{ color: theme.palette.primary.main, ml: 1 }} />
        ) : collaboratorProfiles.length > 0 ? (
          <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1.5 }}>
            {collaboratorProfiles.map((profile) => (
              <Box 
                key={profile.$id || profile.userId} 
                onClick={() => openUnified('share-note', { noteId: liveNote.$id, noteTitle: liveNote.title, initialCollaborator: profile })}
                sx={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: 1.5,
                    p: 1.5,
                    borderRadius: '16px',
                    bgcolor: alpha(theme.palette.text.primary, 0.03),
                    border: `1px solid ${theme.palette.divider}`,
                    cursor: 'pointer',
                    transition: 'all 0.2s ease',
                    '&:hover': {
                        bgcolor: alpha(theme.palette.text.primary, 0.06),
                        borderColor: alpha(theme.palette.text.primary, 0.2)
                    }
                }}
              >
                <IdentityAvatar
                  fileId={profile.avatar || profile.profilePicId || null}
                  alt={profile.displayName || profile.username}
                  fallback={(profile.displayName || profile.username || 'U').charAt(0).toUpperCase()}
                  size={32}
                  verified={profile.tier === 'admin' || profile.verified}
                />
                <Box sx={{ minWidth: 0, flex: 1 }}>
                  <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 1 }}>
                    <Typography variant="body2" sx={{ fontWeight: 700, color: theme.palette.text.primary, noWrap: true }}>
                        {profile.displayName || profile.username}
                    </Typography>
                    <Typography 
                        variant="caption" 
                        sx={{ 
                            px: 1, 
                            py: 0.25, 
                            borderRadius: '6px', 
                            bgcolor: alpha(theme.palette.primary.main, 0.08),
                            color: theme.palette.primary.main,
                            fontWeight: 800,
                            fontSize: '9px',
                            textTransform: 'uppercase',
                            letterSpacing: '0.05em'
                        }}
                    >
                        {profile.permissionLevel || 'Viewer'}
                    </Typography>
                  </Box>
                  <Typography variant="caption" sx={{ color: theme.palette.text.secondary, display: 'block' }}>
                    @{profile.username}
                  </Typography>
                </Box>
              </Box>
            ))}
          </Box>
        ) : (
          <Typography variant="body2" sx={{ fontStyle: 'italic', color: theme.palette.text.secondary, fontFamily: 'var(--font-satoshi)' }}>No collaborators</Typography>
        )}
      </Box>

      {/* Metadata */}
      <Box sx={{ pt: 4, borderTop: `1px solid ${theme.palette.divider}`, display: 'flex', flexDirection: 'column', gap: 1.5 }}>
        <Typography variant="caption" sx={{ color: theme.palette.text.secondary, fontFamily: 'var(--font-satoshi)' }}>
          Created: {formatNoteCreatedDate(liveNote)}
        </Typography>
        <Typography variant="caption" sx={{ color: theme.palette.text.secondary, fontFamily: 'var(--font-satoshi)' }}>
          Updated: {formatNoteUpdatedDate(liveNote)}
        </Typography>
      </Box>


      {/* Edit Actions */}
      {isEditing && (
        <Box sx={{ pt: 4, borderTop: `1px solid ${theme.palette.divider}`, display: 'flex', flexDirection: 'column', gap: 2.5 }}>
          <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <Typography variant="caption" sx={{ color: theme.palette.text.secondary, fontFamily: 'var(--font-satoshi)', fontWeight: 600 }}>
              {isAutosaving ? 'Syncing changes…' : 'All changes synced'}
            </Typography>
            {isAutosaving && <CircularProgress size={14} sx={{ color: theme.palette.primary.main }} />}
          </Box>
          <Button
            fullWidth
            variant="outlined"
            onClick={handleCancel}
            sx={{
              borderRadius: '12px',
              borderColor: theme.palette.divider,
              color: theme.palette.text.primary,
              fontFamily: 'var(--font-clash)',
              fontWeight: 700,
              textTransform: 'uppercase',
              '&:hover': {
                borderColor: alpha(theme.palette.text.primary, 0.3),
                bgcolor: alpha(theme.palette.text.primary, 0.05)
              }
            }}
          >
            Cancel Edits
          </Button>
        </Box>
      )}

      {/* Doodle Editor Modal */}
      {showDoodleEditor && (
        <DoodleCanvas
          initialData={(format === 'doodle' ? content : '') || ''}
          onSave={handleDoodleSave}
          onClose={() => setShowDoodleEditor(false)}
        />
      )}

      {/* Delete Confirmation Modal */}
      <Dialog
        open={showDeleteConfirm}
        onClose={() => setShowDeleteConfirm(false)}
          PaperProps={{
          sx: {
            borderRadius: '32px',
            bgcolor: '#161412',
            border: '1px solid #1C1A18',
            backgroundImage: 'none',
            p: 2,
            boxShadow: '0 24px 48px rgba(0, 0, 0, 0.6), inset 0 1px 0 rgba(255, 255, 255, 0.05)'
          }
        }}
      >
        <DialogTitle sx={{
          fontWeight: 900,
          fontSize: '1.75rem',
          fontFamily: '"Space Grotesk", sans-serif',
          color: '#FF453A',
          textTransform: 'uppercase',
          letterSpacing: '0.05em'
        }}>
          Delete Note
        </DialogTitle>
        <DialogContent>
          <Typography sx={{ color: 'rgba(255, 255, 255, 0.7)', fontFamily: 'var(--font-satoshi), sans-serif', lineHeight: 1.6 }}>
            Are you sure you want to delete &quot;{liveNote.title || 'this note'}&quot;? This action is permanent and cannot be undone.
          </Typography>
        </DialogContent>
        <DialogActions sx={{ p: 3, gap: 2, flexDirection: 'column' }}>
          <Button
            variant="contained"
            fullWidth
            onClick={handleDelete}
            sx={{
              borderRadius: '12px',
              bgcolor: '#FF453A',
              color: '#FFFFFF',
              fontWeight: 800,
              fontFamily: '"Space Grotesk", sans-serif',
              textTransform: 'uppercase',
              '&:hover': { bgcolor: '#D32F2F' }
            }}
          >
            Delete Permanently
          </Button>
          <Button
            variant="outlined"
            fullWidth
            onClick={() => setShowDeleteConfirm(false)}
            sx={{
              borderRadius: '12px',
              borderColor: 'rgba(255, 255, 255, 0.1)',
              color: '#FFFFFF',
              fontWeight: 700,
              fontFamily: '"Space Grotesk", sans-serif',
              textTransform: 'uppercase',
              '&:hover': { borderColor: 'rgba(255, 255, 255, 0.3)', bgcolor: 'rgba(255, 255, 255, 0.05)' }
            }}
          >
            Cancel
          </Button>
        </DialogActions>
      </Dialog>

      <Drawer
        anchor="top"
        open={showActionHub}
        onClose={() => setShowActionHub(false)}
        PaperProps={{
          sx: {
            borderBottomLeftRadius: '32px',
            borderBottomRightRadius: '32px',
            bgcolor: '#161412',
            border: '1px solid #1C1A18',
            backgroundImage: 'none',
            boxShadow: '0 24px 48px rgba(0, 0, 0, 0.6), inset 0 -1px 0 rgba(255, 255, 255, 0.05)',
          }
        }}
      >
        <Box sx={{ p: 3, display: 'flex', flexDirection: 'column', gap: 2.5 }}>
          <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 2 }}>
            <Box>
              <Typography variant="caption" sx={{ color: theme.palette.primary.main, fontWeight: 900, textTransform: 'uppercase', letterSpacing: '0.15em' }}>
                Action Hub
              </Typography>
              <Typography variant="body2" sx={{ color: theme.palette.text.secondary, fontFamily: 'var(--font-satoshi)' }}>
                Keep this note in one tab and branch out only when needed.
              </Typography>
            </Box>
            <IconButton onClick={() => setShowActionHub(false)} sx={{ color: theme.palette.text.secondary }}>
              <CloseIcon fontSize="small" />
            </IconButton>
          </Box>

          <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 1 }}>
            <Button
              variant="contained"
              startIcon={<TaskIcon />}
              disabled={isCreatingTaskFromNote}
              onClick={handleCreateTaskFromNote}
              sx={{
                borderRadius: '999px',
                bgcolor: theme.palette.primary.main,
                fontWeight: 800,
                textTransform: 'none',
                minWidth: 160,
              }}
            >
              {isCreatingTaskFromNote ? 'Creating...' : 'Create Flow Goal'}
            </Button>
            <Button
              variant="outlined"
              startIcon={<ShareIcon />}
              onClick={() => {
                handleCopyShareLink();
                setShowActionHub(false);
              }}
              sx={{
                borderRadius: '999px',
                borderColor: alpha(theme.palette.text.primary, 0.15),
                color: theme.palette.text.primary,
                fontWeight: 800,
                textTransform: 'none',
              }}
            >
              Copy Share Link
            </Button>
            <Button
              variant="outlined"
              startIcon={<LockIcon />}
              disabled={!isPublic}
              onClick={() => setPendingHubAction('rotate')}
              sx={{
                borderRadius: '999px',
                borderColor: alpha(theme.palette.text.primary, 0.15),
                color: theme.palette.text.primary,
                fontWeight: 800,
                textTransform: 'none',
                minWidth: 160,
              }}
            >
              {isPublic ? 'Rotate Link' : 'Private Note'}
            </Button>
            <Button
              variant="outlined"
              startIcon={<OpenIcon />}
              onClick={() => {
                router.push(`/flow?source=note&noteId=${encodeURIComponent(liveNote.$id)}`);
                setShowActionHub(false);
              }}
              sx={{
                borderRadius: '999px',
                borderColor: alpha(theme.palette.text.primary, 0.15),
                color: theme.palette.text.primary,
                fontWeight: 800,
                textTransform: 'none',
                minWidth: 160,
              }}
            >
              Open Flow
            </Button>
          </Box>

          <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1.5 }}>
            <Typography variant="caption" sx={{ color: theme.palette.text.secondary, fontWeight: 700, letterSpacing: '0.08em', textTransform: 'uppercase' }}>
              Cross-app suggestions
            </Typography>
            {isLoadingSuggestions ? (
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5, color: theme.palette.text.secondary }}>
                <CircularProgress size={18} sx={{ color: theme.palette.primary.main }} />
                <Typography variant="caption">Loading ideas…</Typography>
              </Box>
            ) : crossSuggestions.length > 0 ? (
              <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1, maxHeight: '32dvh', overflowY: 'auto', pr: 0.5 }}>
                {crossSuggestions.map((suggestion) => (
                  <Box
                    key={suggestion.id}
                    sx={{
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'space-between',
                      gap: 2,
                      p: 1.5,
                      borderRadius: '16px',
                      bgcolor: alpha(theme.palette.primary.main, 0.04),
                      border: `1px solid ${alpha(theme.palette.primary.main, 0.12)}`,
                    }}
                  >
                    <Box sx={{ minWidth: 0 }}>
                      <Typography variant="body2" sx={{ fontWeight: 800, color: theme.palette.text.primary }}>
                        {suggestion.label}
                      </Typography>
                      <Typography variant="caption" sx={{ color: theme.palette.text.secondary }}>
                        {suggestion.description}
                      </Typography>
                    </Box>
                    <Button
                      size="small"
                      variant="text"
                      onClick={() => {
                        window.open(`https://kylrix.space/integrations?source=note&action=${encodeURIComponent(suggestion.id)}`, '_blank', 'noopener,noreferrer');
                        setShowActionHub(false);
                      }}
                      sx={{ color: theme.palette.primary.main, fontWeight: 800 }}
                    >
                      Use
                    </Button>
                  </Box>
                ))}
              </Box>
            ) : (
              <Typography variant="body2" sx={{ color: theme.palette.text.secondary }}>
                No suggestions available right now.
              </Typography>
            )}
          </Box>

          {pendingHubAction === 'rotate' && (
            <Box
              sx={{
                p: 2,
                borderRadius: '20px',
                bgcolor: alpha(theme.palette.warning.main, 0.08),
                border: `1px solid ${alpha(theme.palette.warning.main, 0.2)}`,
                display: 'flex',
                flexDirection: 'column',
                gap: 1.5,
              }}
            >
              <Typography variant="body2" sx={{ color: theme.palette.text.primary, fontWeight: 700 }}>
                Rotate the public link? Anyone with the old link will lose access.
              </Typography>
              <Box sx={{ display: 'flex', gap: 1 }}>
                <Button
                  variant="contained"
                  color="warning"
                  onClick={confirmRotateLink}
                  sx={{ borderRadius: '999px', textTransform: 'none', fontWeight: 800 }}
                >
                  Confirm rotate
                </Button>
                <Button
                  variant="text"
                  onClick={() => setPendingHubAction(null)}
                  sx={{ borderRadius: '999px', textTransform: 'none', fontWeight: 800, color: theme.palette.text.secondary }}
                >
                  Cancel
                </Button>
              </Box>
            </Box>
          )}
        </Box>
      </Drawer>

    </Box>
  );
}
