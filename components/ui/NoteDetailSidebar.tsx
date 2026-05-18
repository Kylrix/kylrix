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
  OpenInNew as OpenIcon,
  PushPin as PinIcon,
  PushPinOutlined as PinOutlinedIcon,
  ArrowBack as BackIcon,
  Link as LinkIcon,
  Lock as LockIcon,
  LockOpen as UnlockIcon,
  Public as PublicIcon,
  Refresh as RefreshIcon,
  Close as CloseIcon,
  Share as ShareIcon,
  AutoAwesome as ActionIcon,
  VideoCall as VideoCallIcon,
  PlaylistAddCheck as TaskIcon,
  EventNote as EventIcon,
  VpnKey as KeyIcon,
} from '@mui/icons-material';
import { useToast } from '@/components/ui/Toast';
import { useSudo } from '@/context/SudoContext';
import { useProUpgrade } from '@/context/ProUpgradeContext';
import { useDynamicSidebar } from '@/components/ui/DynamicSidebar';
import { useUnifiedDrawer } from '@/context/UnifiedDrawerContext';
import { IdentityAvatar } from '@/components/common/IdentityBadge';
import { useNotes } from '@/context/NotesContext';
import { useDrawerState } from '@/components/ui/DrawerStateContext';
import { ConfirmationDialog } from '@/components/ConfirmationDialog';
import { formatNoteCreatedDate, formatNoteUpdatedDate } from '@/lib/date-utils';
import { getTablesDbRowCached } from '@/lib/ecosystem/tablesdb-row-cache';
import { 
  updateNote, 
  listFlowTasks, 
  listFlowEvents, 
  listKeepCredentials, 
  Query, 
  realtime,
  toggleNoteVisibility, 
  rotatePublicNoteLink, 
  getShareableUrl, 
  getCurrentPublicNoteShareUrl, 
  getCurrentPublicNoteDecryptionKey, 
  getNotePublicState, 
  decryptPublicEncryptedNote, 
  createTaskFromNote 
} from '@/lib/appwrite';
import { APPWRITE_CONFIG } from '@/lib/appwrite/config';
import { formatFileSize } from '@/lib/utils';
import { useCallLauncher } from '@/context/CallLauncherContext';
import { ecosystemSecurity } from '@/lib/ecosystem/security';
import { useAutosave } from '@/hooks/useAutosave';

export interface NoteDetailSidebarProps {
  note: Notes;
  onUpdate: (updatedNote: Notes) => void;
  onDelete: (noteId: string) => void;
  onBack?: () => void;
  showExpandButton?: boolean;
  showHeaderDeleteButton?: boolean;
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
  const { promptSudo } = useSudo();
  const { setIsDrawerOpen } = useDrawerState();
  const { showSuccess, showError } = useToast();
  const { openProUpgrade } = useProUpgrade();
  const { closeSidebar } = useDynamicSidebar();
  const { openCallLauncher } = useCallLauncher();

  const { notes: allNotes, isPinned, pinNote, unpinNote } = useNotes();
  const [realtimeNote, setRealtimeNote] = useState<Notes | null>(null);
  const noteRef = useRef(note);
  const liveNote = useMemo(
    () => (realtimeNote?.$id === note.$id ? realtimeNote : allNotes.find((candidate) => candidate.$id === note.$id) || note),
    [allNotes, note, realtimeNote]
  );

  useEffect(() => {
    noteRef.current = note;
  }, [note]);

  useEffect(() => {
    setRealtimeNote(null);
  }, [note.$id]);
  
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

  const [isEditingTitle, setIsEditingTitle] = useState(false);
  const [isEditingContent, setIsEditingContent] = useState(false);
  const isEditing = isEditingTitle || isEditingContent;
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [showDoodleEditor, setShowDoodleEditor] = useState(false);
  
  const [title, setTitle] = useState(liveNote.title || '');
  const [content, setContent] = useState(liveNote.content || '');
  const [format, setFormat] = useState<'text' | 'doodle'>(liveNote.format as 'text' | 'doodle' || 'text');
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
  const [isRotating, setIsRotating] = useState(false);
  const [isCreatingTaskFromNote, setIsCreatingTaskFromNote] = useState(false);
  const [crossSuggestions, setCrossSuggestions] = useState<any[]>([]);
  const [isLoadingSuggestions, setIsLoadingSuggestions] = useState(false);
  const [isLocallyDecrypted, setIsLocallyDecrypted] = useState(false);

  // ENCRYPTION LOGIC
  const isT4Encrypted = (noteMeta?.isEncrypted === true || noteMeta?.isEncrypted === 'true') && noteMeta?.encryptionVersion === 'T4';
  const isEncryptedNote = isT4Encrypted && !noteMeta?.clientDecrypted && !isLocallyDecrypted;
  const isT4EncryptedPublicNote = isPublic && isT4Encrypted;

  // Sync local state with liveNote (crucial for auto-decryption healing)
  useEffect(() => {
    if (!isEditing) {
      setTitle(liveNote.title || '');
      setContent(liveNote.content || '');
      setTags(liveNote.tags?.join(', ') || '');
      setFormat(liveNote.format as 'text' | 'doodle' || 'text');
      setIsPublic(getNotePublicState(liveNote));
    }
  }, [liveNote, isEditing]);

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
            setFormat(decrypted.format as 'text' | 'doodle' || 'text');
            setIsLocallyDecrypted(true);
            setIsEditingContent(false);
            setIsEditingTitle(false);
            onUpdate(decrypted);
            showSuccess('Note decrypted', 'Content is now visible.');
          }
        } catch (err) {
          console.error('[NoteSidebar] Auto-decryption failed:', err);
        }
      };
      void healDecryption();
    }
  }, [isEncryptedNote, vaultUnlocked, liveNote, onUpdate, showSuccess]);

  // Sync drawer state
  useEffect(() => {
    setIsDrawerOpen(showRotateConfirm);
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
          () => listFlowTasks([Query.equal('$id', id)]).then(res => res.documents[0] || null))
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
          () => listFlowEvents([Query.equal('$id', id)]).then(res => res.documents[0] || null))
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
          () => listKeepCredentials([Query.equal('$id', id)]).then(res => res.documents[0] || null))
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
        const { getResourceCollaboratorsSecure } = await import('@/lib/actions/secure-ops');
        const { account } = await import('@/lib/appwrite');
        const { jwt } = await account.createJWT();
        const { collaborators } = await getResourceCollaboratorsSecure({ resourceId: liveNote.$id, resourceType: 'note', jwt });
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
        const res = await fetch(`/note/api/cross/suggest?sourceApp=note&sourceType=note&sourceId=${liveNote.$id}`);
        const data = await res.json();
        if (active) setCrossSuggestions(data?.suggestions || []);
      } finally { if (active) setIsLoadingSuggestions(false); }
    };
    fetchSuggest();
    return () => { active = false; };
  }, [liveNote.$id]);

  const { isAutosaving } = useAutosave({
    data: { title, content, format, tags, isPublic: liveNote.isPublic, metadata: liveNote.metadata },
    onSave: async (updatedData) => {
      const payload = {
        ...updatedData,
        tags: updatedData.tags.split(',').map((t: string) => t.trim()).filter(Boolean),
      };
      try {
        const result = await updateNote(liveNote.$id, payload);
        if (result) onUpdate(result);
      } catch (err) {
        console.error('Autosave failed:', err);
      }
    },
    enabled: isEditing,
  });

  // Handlers
  const handlePinToggle = async () => {
    const pinned = isPinned(liveNote.$id);
    try {
      if (pinned) await unpinNote(liveNote.$id);
      else await pinNote(liveNote.$id);
      showSuccess(pinned ? 'Note unpinned' : 'Note pinned');
    } catch (err: any) {
      if (err.message?.includes('limit reached')) {
        openProUpgrade('Pinned Notes');
        return;
      }
      showError('Failed to update pin');
    }
  };

  const handleTogglePublic = async () => {
    try {
      const updated = await toggleNoteVisibility(liveNote.$id);
      if (updated) {
        onUpdate(updated);
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
  };

  const rotateNoteLink = () => setShowRotateConfirm(true);

  const handleConfirmedRotate = async () => {
    setIsRotating(true);
    promptSudo({
      onSuccess: async () => {
        try {
          const updated = await rotatePublicNoteLink(liveNote.$id);
          if (updated) {
            onUpdate(updated);
            if (updated.decryptionKey) {
              const shareUrl = getShareableUrl(liveNote.$id, updated.decryptionKey);
              navigator.clipboard.writeText(shareUrl);
              showSuccess('Public link rotated', 'New link copied to clipboard.');
            }
            setShowRotateConfirm(false);
          }
        } catch (error: any) {
          showError('Rotate Failed', error.message || 'Failed to rotate link.');
        } finally {
          setIsRotating(false);
        }
      }
    });
  };

  const handleCopyShareLink = async () => {
    const url = await getCurrentPublicNoteShareUrl(liveNote.$id);
    if (url) {
      navigator.clipboard.writeText(url);
      showSuccess('Link copied to clipboard');
    } else {
      showError('Vault Locked', 'Unlock vault to copy link.');
    }
  };

  const handleDelete = () => {
    onDelete(liveNote.$id);
    setShowDeleteConfirm(false);
  };

  const handleCreateTaskFromNote = useCallback(async () => {
    setIsCreatingTaskFromNote(true);
    try {
      const task = await createTaskFromNote(liveNote);
      if (task) {
        onUpdate({ ...liveNote, linkedTaskId: task.$id });
        showSuccess('Goal created from note');
        setShowActionHub(false);
      }
    } catch (err) {
      showError('Failed to create goal');
    } finally {
      setIsCreatingTaskFromNote(false);
    }
  }, [liveNote, onUpdate, showSuccess, showError]);

  const handleOpenSharedNote = useCallback(async () => {
    if (!isPublic) {
      showError('Note is private', 'Make the note public before opening its shared link.');
      return;
    }

    const sharedUrl = isT4Encrypted
      ? await getCurrentPublicNoteShareUrl(liveNote.$id)
      : getShareableUrl(liveNote.$id);

    if (!sharedUrl) {
      showError('Shared link unavailable', 'Could not resolve the shared note URL.');
      return;
    }

    window.open(sharedUrl, '_blank', 'noopener,noreferrer');
  }, [isPublic, isT4Encrypted, liveNote.$id, showError]);

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

  const handleDoodleSave = (doodleData: string) => {
    setContent(doodleData);
    setFormat('doodle');
    setShowDoodleEditor(false);
  };

  const activateTitleEditing = () => {
    if (isEncryptedNote && !vaultUnlocked) {
        promptSudo();
        return;
    }
    setIsEditingTitle(true);
  };

  const activateContentEditing = () => {
    if (isEncryptedNote && !vaultUnlocked) {
        promptSudo();
        return;
    }
    setIsEditingContent(true);
  };

  const titleInputRef = useRef<HTMLInputElement>(null);
  const contentTextareaRef = useRef<HTMLTextAreaElement>(null);

  const displayTitle = isEncryptedNote ? '🔒 Encrypted Note' : (title || liveNote.title || 'Untitled note');
  const displayContent = isEncryptedNote ? '' : (content || liveNote.content || '');
  const displayFormat = isEncryptedNote ? 'text' : format;
  const displayTags = tags.split(',').map(t => t.trim()).filter(Boolean);

  const currentAttachments = useMemo(() => {
      if (liveNote.attachments && Array.isArray(liveNote.attachments)) {
          try {
              return liveNote.attachments.map((a: any) => typeof a === 'string' ? JSON.parse(a) : a);
          } catch { return []; }
      }
      return [];
  }, [liveNote.attachments]);

  return (
    <Box sx={{ p: { xs: 2, md: 2.5 }, display: 'flex', flexDirection: 'column', gap: 4, height: '100%', overflowY: 'auto', bgcolor: '#0A0908' }}>
      {/* Header */}
      <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 1.5 }}>
        <IconButton onClick={onBack || closeSidebar} sx={{ color: theme.palette.text.secondary }}><BackIcon /></IconButton>
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5 }}>
          <Tooltip title={isPublic ? 'Make Private' : 'Make Public'}>
            <IconButton
              onClick={handleTogglePublic}
              sx={{
                color: isPublic ? theme.palette.success.main : theme.palette.text.secondary,
                bgcolor: isPublic ? alpha(theme.palette.success.main, 0.12) : alpha(theme.palette.text.primary, 0.04),
                '&:hover': { bgcolor: isPublic ? alpha(theme.palette.success.main, 0.18) : alpha(theme.palette.text.primary, 0.08) }
              }}
            >
              {isPublic ? <PublicIcon fontSize="small" /> : <LockIcon fontSize="small" />}
            </IconButton>
          </Tooltip>
          <Tooltip title="Action hub"><IconButton onClick={() => setShowActionHub(true)} sx={{ color: theme.palette.primary.main, bgcolor: alpha(theme.palette.primary.main, 0.08) }}><ActionIcon fontSize="small" /></IconButton></Tooltip>
          <Tooltip title="Start huddle"><IconButton onClick={handleStartNoteHuddle} sx={{ color: theme.palette.primary.main, bgcolor: alpha(theme.palette.primary.main, 0.08) }}><VideoCallIcon fontSize="small" /></IconButton></Tooltip>
          {showExpandButton && isPublic && (
            <Tooltip title={isPublic ? 'Open shared note' : 'Make public to open shared link'}>
              <span>
                <IconButton
                  onClick={handleOpenSharedNote}
                  sx={{ color: theme.palette.text.secondary }}
                >
                  <LinkIcon fontSize="small" />
                </IconButton>
              </span>
            </Tooltip>
          )}
          <Tooltip title={isPinned(liveNote.$id) ? 'Unpin' : 'Pin'}><IconButton onClick={handlePinToggle} sx={{ color: isPinned(liveNote.$id) ? theme.palette.primary.main : theme.palette.text.secondary }}><PinIcon fontSize="small" /></IconButton></Tooltip>
          {isT4EncryptedPublicNote && <Tooltip title="Rotate link"><IconButton onClick={rotateNoteLink} sx={{ color: theme.palette.text.secondary }}><RefreshIcon fontSize="small" /></IconButton></Tooltip>}
          {showHeaderDeleteButton && <Tooltip title="Delete"><IconButton onClick={() => setShowDeleteConfirm(true)} sx={{ color: theme.palette.text.secondary, '&:hover': { color: theme.palette.error.main, bgcolor: alpha(theme.palette.error.main, 0.1) } }}><TrashIcon fontSize="small" /></IconButton></Tooltip>}
        </Box>
      </Box>

      {/* Title Card */}
      <Box sx={{ p: 2.5, borderRadius: '28px', bgcolor: '#161412', border: '1px solid #1C1A18', boxShadow: '0 12px 32px rgba(0,0,0,0.4)', transition: 'all 0.3s ease', '&:focus-within': { borderColor: theme.palette.secondary.main, transform: 'translateY(-2px)' } }}>
        <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 2, mb: 1 }}>
          <Typography variant="caption" sx={{ color: theme.palette.secondary.main, fontWeight: 900, textTransform: 'uppercase', letterSpacing: '0.1em' }}>Title</Typography>
        </Box>
        {isEditingTitle ? (
          <TextField fullWidth variant="standard" value={title} onChange={(e) => setTitle(e.target.value)} onBlur={() => setIsEditingTitle(false)} autoFocus InputProps={{ disableUnderline: true, sx: { fontSize: '1.4rem', fontWeight: 900, color: 'white', fontFamily: 'var(--font-clash)' } }} />
        ) : (
          <Typography variant="h5" onClick={activateTitleEditing} sx={{ cursor: isEncryptedNote && !vaultUnlocked ? 'pointer' : 'text', fontWeight: 900, fontFamily: 'var(--font-clash)' }}>{displayTitle}</Typography>
        )}
      </Box>

      {/* Content Card */}
      <Box sx={{ p: 2.5, borderRadius: '28px', bgcolor: '#161412', border: '1px solid #1C1A18', minHeight: { xs: 340, md: 460 }, height: { xs: 'clamp(340px, 46vh, 460px)', md: 'clamp(460px, 58vh, 760px)' }, boxShadow: '0 12px 32px rgba(0,0,0,0.4)', transition: 'all 0.3s ease', display: 'flex', flexDirection: 'column', overflow: 'hidden', '&:focus-within': { borderColor: theme.palette.primary.main, transform: 'translateY(-2px)' } }}>
        <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 2.5 }}>
          <Typography variant="caption" sx={{ color: theme.palette.primary.main, fontWeight: 900, textTransform: 'uppercase', letterSpacing: '0.1em' }}>Content</Typography>
          {isEditingContent && (
            <ToggleButtonGroup value={format} exclusive onChange={(_, v) => v && setFormat(v)} size="small" sx={{ height: 28, bgcolor: alpha('#fff', 0.04), borderRadius: '10px' }}>
              <ToggleButton value="text" sx={{ px: 2, py: 0, fontSize: '0.7rem', fontWeight: 800 }}>Text</ToggleButton>
              <ToggleButton value="doodle" sx={{ px: 2, py: 0, fontSize: '0.7rem', fontWeight: 800 }}>Doodle</ToggleButton>
            </ToggleButtonGroup>
          )}
        </Box>
        <Box sx={{ flex: 1, minHeight: 0, overflowY: 'auto', pr: 1 }}>
          {isEditingContent ? (
            format === 'text' ? (
              <TextField fullWidth multiline rows={14} variant="standard" value={content} onChange={(e) => setContent(e.target.value)} onBlur={() => setIsEditingContent(false)} autoFocus inputRef={contentTextareaRef} InputProps={{ disableUnderline: true, sx: { color: 'rgba(255,255,255,0.85)', fontSize: '1rem', lineHeight: 1.8 } }} />
            ) : (
              <Box onClick={() => setShowDoodleEditor(true)} sx={{ height: 200, border: '1px dashed rgba(255,255,255,0.1)', borderRadius: '18px', display: 'grid', placeItems: 'center', cursor: 'pointer', '&:hover': { bgcolor: alpha('#fff', 0.02) } }}><Typography variant="body2" sx={{ color: theme.palette.text.secondary }}>Open Sketchpad</Typography></Box>
            )
          ) : (
            <Box onClick={activateContentEditing} sx={{ cursor: isEncryptedNote && !vaultUnlocked ? 'pointer' : 'text', minHeight: '100%' }}>
               <NoteContentRenderer content={displayContent} format={displayFormat} emptyFallback={<Typography variant="body2" sx={{ fontStyle: 'italic', color: theme.palette.text.secondary }}>🔒 Encrypted note content</Typography>} onEditDoodle={displayFormat === 'doodle' ? activateContentEditing : undefined} />
            </Box>
          )}
        </Box>
      </Box>

      {/* Tags Section */}
      <Box sx={{ px: 1 }}>
        <Typography variant="caption" sx={{ color: theme.palette.primary.main, fontWeight: 900, textTransform: 'uppercase', display: 'block', mb: 1.5, letterSpacing: '0.1em' }}>Tags</Typography>
        <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 1 }}>
          {displayTags.length > 0 ? displayTags.map(tag => (
            <Chip key={tag} label={tag} size="small" sx={{ bgcolor: alpha(theme.palette.primary.main, 0.1), color: theme.palette.primary.main, fontWeight: 800, borderRadius: '8px', border: `1px solid ${alpha(theme.palette.primary.main, 0.2)}` }} />
          )) : <Typography variant="caption" sx={{ color: theme.palette.text.secondary }}>No tags assigned</Typography>}
        </Box>
      </Box>

      {/* Attachments Section */}
      <Box sx={{ px: 1 }}>
        <Typography variant="caption" sx={{ color: theme.palette.primary.main, fontWeight: 900, textTransform: 'uppercase', display: 'block', mb: 1.5, letterSpacing: '0.1em' }}>Attachments</Typography>
        {currentAttachments.length > 0 ? (
            <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1.25 }}>
                {currentAttachments.map((file: any) => (
                    <Box key={file.id} sx={{ p: 1.75, borderRadius: '18px', bgcolor: alpha('#fff', 0.03), border: `1px solid ${alpha('#fff', 0.06)}`, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5 }}>
                            <PaperClipIcon sx={{ color: theme.palette.text.secondary, fontSize: 18 }} />
                            <Box>
                                <Typography variant="body2" sx={{ fontWeight: 800 }}>{file.name}</Typography>
                                <Typography variant="caption" sx={{ color: theme.palette.text.secondary }}>{formatFileSize(file.size)}</Typography>
                            </Box>
                        </Box>
                        <IconButton size="small" onClick={() => window.open(`/api/notes/${liveNote.$id}/attachments/${file.id}`, '_blank')} sx={{ color: theme.palette.primary.main }}><OpenIcon fontSize="small" /></IconButton>
                    </Box>
                ))}
            </Box>
        ) : (
            <Typography variant="caption" sx={{ color: theme.palette.text.secondary, fontStyle: 'italic' }}>No attachments</Typography>
        )}
      </Box>

      {/* Linked Ecosystem Content */}
      <Box sx={{ display: 'flex', flexDirection: 'column', gap: 4, px: 1 }}>
        {[
          { label: 'Goals', items: linkedTasks, loading: isLoadingTasks, icon: <TaskIcon sx={{ fontSize: 18 }} />, color: '#10B981', link: (id: string) => `/flow?taskId=${id}` },
          { label: 'Events', items: linkedEvents, loading: isLoadingEvents, icon: <EventIcon sx={{ fontSize: 18 }} />, color: '#6366F1', link: (id: string) => `/flow/events?eventId=${id}` },
          { label: 'Secrets', items: linkedSecrets, loading: isLoadingSecrets, icon: <KeyIcon sx={{ fontSize: 18 }} />, color: '#F59E0B', link: (id: string) => `/vault?id=${id}` },
        ].map(section => (
          <Box key={section.label}>
            <Typography variant="caption" sx={{ color: section.color, fontWeight: 900, textTransform: 'uppercase', display: 'block', mb: 1.5, letterSpacing: '0.1em' }}>Linked {section.label}</Typography>
            {section.loading ? (
                <CircularProgress size={20} sx={{ color: section.color, ml: 1 }} />
            ) : section.items.length > 0 ? (
                <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1.25 }}>
                {section.items.map((item: any) => (
                    <Box key={item.$id} sx={{ p: 1.75, borderRadius: '18px', bgcolor: alpha(section.color, 0.04), border: `1px solid ${alpha(section.color, 0.12)}`, display: 'flex', justifyContent: 'space-between', alignItems: 'center', '&:hover': { bgcolor: alpha(section.color, 0.08) } }}>
                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5 }}>{section.icon}<Typography variant="body2" sx={{ fontWeight: 800 }}>{item.title || item.name}</Typography></Box>
                    <IconButton size="small" onClick={() => window.open(section.link(item.$id), '_blank')} sx={{ color: section.color }}><OpenIcon fontSize="small" /></IconButton>
                    </Box>
                ))}
                </Box>
            ) : (
                <Typography variant="caption" sx={{ color: theme.palette.text.secondary, fontStyle: 'italic' }}>No linked {section.label.toLowerCase()}</Typography>
            )}
          </Box>
        ))}

        {/* Collaborators */}
        <Box>
            <Typography variant="caption" sx={{ color: theme.palette.secondary.main, fontWeight: 900, textTransform: 'uppercase', display: 'block', mb: 1.5, letterSpacing: '0.1em' }}>Collaborators</Typography>
            {isLoadingCollaborators ? (
                <CircularProgress size={20} sx={{ color: theme.palette.secondary.main, ml: 1 }} />
            ) : collaboratorProfiles.length > 0 ? (
                <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1.25 }}>
                {collaboratorProfiles.map((p: any) => (
                    <Box key={p.$id || p.userId} sx={{ p: 1.5, borderRadius: '18px', bgcolor: alpha('#fff', 0.03), border: `1px solid ${alpha('#fff', 0.06)}`, display: 'flex', alignItems: 'center', gap: 1.5, cursor: 'pointer', transition: 'all 0.2s ease', '&:hover': { bgcolor: alpha('#fff', 0.05) } }} onClick={() => openUnified('share-note', { noteId: liveNote.$id, noteTitle: liveNote.title, initialCollaborator: p })}>
                    <IdentityAvatar fileId={p.avatar} alt={p.username} fallback={p.username?.[0]?.toUpperCase()} size={34} verified={p.tier === 'admin' || p.verified} />
                    <Box sx={{ flex: 1, minWidth: 0 }}>
                        <Typography variant="body2" sx={{ fontWeight: 800, noWrap: true }}>{p.displayName || p.username}</Typography>
                        <Typography variant="caption" sx={{ color: 'rgba(255,255,255,0.5)', display: 'block' }}>@{p.username}</Typography>
                    </Box>
                    <Typography variant="caption" sx={{ px: 1, py: 0.25, borderRadius: '6px', bgcolor: alpha(theme.palette.primary.main, 0.1), color: theme.palette.primary.main, fontWeight: 900, fontSize: '10px' }}>{p.permissionLevel || 'Viewer'}</Typography>
                    </Box>
                ))}
                </Box>
            ) : (
                <Typography variant="caption" sx={{ color: theme.palette.text.secondary, fontStyle: 'italic' }}>No collaborators found</Typography>
            )}
        </Box>
      </Box>

      {/* Metadata */}
      <Box sx={{ mt: 4, pt: 3, borderTop: `1px solid ${alpha('#fff', 0.05)}` }}>
        <Typography variant="caption" sx={{ color: 'rgba(255,255,255,0.4)', display: 'block' }}>Created {formatNoteCreatedDate(liveNote)}</Typography>
        <Typography variant="caption" sx={{ color: 'rgba(255,255,255,0.4)', display: 'block' }}>Updated {formatNoteUpdatedDate(liveNote)}</Typography>
      </Box>

      {/* Action Hub Drawer */}
      <Drawer anchor="top" open={showActionHub} onClose={() => setShowActionHub(false)} PaperProps={{ sx: { borderBottomLeftRadius: '32px', borderBottomRightRadius: '32px', bgcolor: '#161412', border: '1px solid #1C1A18', backgroundImage: 'none', p: 3.5 } }}>
        <Box sx={{ display: 'flex', flexDirection: 'column', gap: 3.5 }}>
          <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <Typography variant="h6" sx={{ fontWeight: 900, color: theme.palette.primary.main }}>Action Hub</Typography>
            <IconButton onClick={() => setShowActionHub(false)} sx={{ color: 'rgba(255,255,255,0.6)' }}><CloseIcon /></IconButton>
          </Box>
          <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 1.5 }}>
            <Button
              variant="outlined"
              startIcon={isPublic ? <LockIcon /> : <UnlockIcon />}
              onClick={() => { setShowActionHub(false); void handleTogglePublic(); }}
              sx={{ borderRadius: '14px', fontWeight: 800, color: 'white', borderColor: 'rgba(255,255,255,0.1)' }}
            >
              {isPublic ? 'Make Private' : 'Make Public'}
            </Button>
            <Button variant="contained" startIcon={<TaskIcon />} onClick={handleCreateTaskFromNote} disabled={isCreatingTaskFromNote} sx={{ borderRadius: '14px', fontWeight: 900, bgcolor: theme.palette.primary.main }}>Create Goal</Button>
            <Button variant="outlined" startIcon={<LockIcon />} onClick={() => { setShowActionHub(false); rotateNoteLink(); }} disabled={!isPublic} sx={{ borderRadius: '14px', fontWeight: 800, color: 'white', borderColor: 'rgba(255,255,255,0.1)' }}>Rotate Link</Button>
          </Box>
          <Box>
            <Typography variant="caption" sx={{ color: 'rgba(255,255,255,0.4)', fontWeight: 900, textTransform: 'uppercase', mb: 2, display: 'block' }}>Suggestions</Typography>
            {isLoadingSuggestions ? <CircularProgress size={16} /> : crossSuggestions.length > 0 ? (
                <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1 }}>
                    {crossSuggestions.map(s => (
                        <Box key={s.id} sx={{ p: 1.5, bgcolor: alpha(theme.palette.primary.main, 0.05), borderRadius: '12px', mb: 1, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                            <Box><Typography variant="body2" sx={{ fontWeight: 800 }}>{s.label}</Typography><Typography variant="caption" sx={{ color: 'rgba(255,255,255,0.5)' }}>{s.description}</Typography></Box>
                            <Button size="small" onClick={() => window.open(`https://kylrix.space/integrations?action=${s.id}`, '_blank')}>USE</Button>
                        </Box>
                    ))}
                </Box>
            ) : (
                <Typography variant="caption" sx={{ color: theme.palette.text.secondary, fontStyle: 'italic' }}>No suggestions available</Typography>
            )}
          </Box>
        </Box>
      </Drawer>

      <ConfirmationDialog open={showRotateConfirm} title="Rotate public link?" message="The previous link will become permanently invalid. Anyone with the old link will lose access." confirmLabel={isRotating ? "Rotating..." : "Rotate Link"} isDestructive={true} isLoading={isRotating} onClose={() => setShowRotateConfirm(false)} onConfirm={handleConfirmedRotate} />
      
      <Dialog open={showDeleteConfirm} onClose={() => setShowDeleteConfirm(false)} PaperProps={{ sx: { borderRadius: '32px', bgcolor: '#161412', border: '1px solid #1C1A18', backgroundImage: 'none', p: 2 } }}>
        <DialogTitle sx={{ fontWeight: 900, color: '#FF453A' }}>Delete Note</DialogTitle>
        <DialogContent><Typography sx={{ color: 'rgba(255, 255, 255, 0.7)' }}>Are you sure you want to delete this note? This action is permanent.</Typography></DialogContent>
        <DialogActions sx={{ p: 3, gap: 2, flexDirection: 'column' }}>
          <Button variant="contained" fullWidth onClick={handleDelete} sx={{ borderRadius: '14px', bgcolor: '#FF453A' }}>Delete Permanently</Button>
          <Button variant="outlined" fullWidth onClick={() => setShowDeleteConfirm(false)} sx={{ borderRadius: '14px', color: 'white' }}>Cancel</Button>
        </DialogActions>
      </Dialog>

      {showDoodleEditor && <DoodleCanvas initialData={format === 'doodle' ? content : ''} onSave={handleDoodleSave} onClose={() => setShowDoodleEditor(false)} />}
    </Box>
  );
}
