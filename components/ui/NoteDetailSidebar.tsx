'use client';

import React, { useState, useEffect, useMemo, useRef, useCallback } from 'react';
import dynamic from 'next/dynamic';
import {
  Box,
  Typography,
  IconButton,
  Button,
  TextField,
  Chip,
  Tooltip,
  CircularProgress,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Drawer,
  alpha,
  useTheme,
  useMediaQuery,
  ToggleButtonGroup,
  ToggleButton,
} from '@mui/material';
import {
  Close as CloseIcon,
  Share as ShareIcon,
  PushPin as PinIcon,
  PushPinOutlined as PinOutlinedIcon,
  ArrowBack as BackIcon,
  Link as LinkIcon,
  Lock as LockIcon,
  Refresh as RefreshIcon,
  Delete as TrashIcon,
  ContentCopy as CopyIcon,
  OpenInNew as OpenIcon,
  VideoCall as VideoCallIcon,
  PlaylistAddCheck as TaskIcon,
  EventNote as EventIcon,
  VpnKey as KeyIcon,
  AttachFile as PaperClipIcon,
  AutoAwesome as ActionIcon,
} from '@mui/icons-material';
import { useToast } from '@/components/ui/Toast';
import { useRouter } from 'next/navigation';
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
import { Notes } from '@/types/appwrite';

const NoteContentRenderer = dynamic(() => import('@/components/NoteContentRenderer'), { ssr: false });
const DoodleCanvas = dynamic(() => import('@/components/DoodleCanvas'), { ssr: false });
const NoteContentDisplay = dynamic(() => import('@/components/NoteContentDisplay'), { ssr: false });

export interface NoteDetailSidebarProps {
  note: Notes;
  onBack?: () => void;
  onUpdate: (updated: Notes) => void;
  onDelete: (id: string) => void;
  showExpandButton?: boolean;
  showHeaderDeleteButton?: boolean;
}

export function NoteDetailSidebar({
  note,
  onBack,
  onUpdate,
  onDelete,
  showExpandButton = true,
  showHeaderDeleteButton = true,
}: NoteDetailSidebarProps) {
  const theme = useTheme();
  const isMobile = useMediaQuery(theme.breakpoints.down('md'));
  const { open: openUnified } = useUnifiedDrawer();
  const { promptSudo } = useSudo();
  const { setIsDrawerOpen } = useDrawerState();
  const { notes: allNotes, isPinned, pinNote, unpinNote } = useNotes();
  const { showSuccess, showError } = useToast();
  const { openProUpgrade } = useProUpgrade();
  const router = useRouter();
  const { closeSidebar } = useDynamicSidebar();
  const { openCallLauncher } = useCallLauncher();

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

  const [title, setTitle] = useState(liveNote.title || '');
  const [content, setContent] = useState(liveNote.content || '');
  const [format, setFormat] = useState<'text' | 'doodle'>((liveNote.format as 'text' | 'doodle') || 'text');
  const [tags, setTags] = useState((liveNote.tags || []).join(', '));
  const [isEditingTitle, setIsEditingTitle] = useState(false);
  const [isEditingContent, setIsEditingContent] = useState(false);
  const [isPublic, setIsPublic] = useState(getNotePublicState(liveNote));
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [showDoodleEditor, setShowDoodleEditor] = useState(false);
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
  const [showRotateConfirm, setShowRotateConfirm] = useState(false);
  const [isRotating, setIsRotating] = useState(false);
  const [isCreatingTaskFromNote, setIsCreatingTaskFromNote] = useState(false);
  const [crossSuggestions, setCrossSuggestions] = useState<Array<{ id: string; label: string; description: string }>>([]);
  const [isLoadingSuggestions, setIsLoadingSuggestions] = useState(false);
  const [lastT4Key, setLastT4Key] = useState<string | null>(null);
  
  const titleInputRef = useRef<HTMLInputElement>(null);
  const titleIdleTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const contentIdleTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const isEditing = isEditingTitle || isEditingContent;
  const isT4Encrypted = (noteMeta?.isEncrypted === true || noteMeta?.isEncrypted === 'true') && noteMeta?.encryptionVersion === 'T4';
  const isEncryptedNote = isT4Encrypted && !noteMeta?.clientDecrypted;
  const isT4EncryptedPublicNote = !!isPublic && isT4Encrypted;

  // Sync local state with note updates (especially after decryption)
  useEffect(() => {
    if (isEditing) return;
    setTitle(liveNote.title || '');
    setContent(liveNote.content || '');
    setTags((liveNote.tags || []).join(', '));
    setIsPublic(getNotePublicState(liveNote));
    setFormat((liveNote.format as 'text' | 'doodle') || 'text');
  }, [liveNote, isEditing]);

  // Automatically prompt for vault unlock if opening an encrypted note
  useEffect(() => {
    if (isEncryptedNote && !ecosystemSecurity.status.isUnlocked) {
      const timer = setTimeout(() => {
        promptSudo();
      }, 800);
      return () => clearTimeout(timer);
    }
  }, [isEncryptedNote, promptSudo]);

  // Decryption Healing
  const decryptedNote = useMemo(() => {
    if (isEncryptedNote && ecosystemSecurity.status.isUnlocked) return null;
    return liveNote;
  }, [liveNote, isEncryptedNote, ecosystemSecurity.status.isUnlocked]);

  useEffect(() => {
    if (!decryptedNote && isEncryptedNote && ecosystemSecurity.status.isUnlocked) {
      const heal = async () => {
        try {
          const decrypted = await decryptPublicEncryptedNote(liveNote);
          if (decrypted) {
            onUpdate(decrypted);
            showSuccess("Note decrypted", "Content is now visible.");
          }
        } catch (err) {
          console.error("[NoteSidebar] Decryption failed:", err);
        }
      };
      void heal();
    }
  }, [decryptedNote, isEncryptedNote, ecosystemSecurity.status.isUnlocked, liveNote, onUpdate, showSuccess]);

  // Sync drawer state with confirmation
  useEffect(() => {
    setIsDrawerOpen(showRotateConfirm);
  }, [showRotateConfirm, setIsDrawerOpen]);

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

  const pinned = isPinned(liveNote.$id);

  const handlePinToggle = async () => {
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

  const rotateNoteLink = () => {
    setShowRotateConfirm(true);
  };

  const handleConfirmedRotate = async () => {
    setIsRotating(true);
    promptSudo({
      onSuccess: async () => {
        try {
          const updated = await rotatePublicNoteLink(liveNote.$id);
          if (updated) {
            setIsPublic(!!updated.isPublic);
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

  const handleCancel = () => {
    setTitle(liveNote.title || '');
    setContent(liveNote.content || '');
    setIsEditingTitle(false);
    setIsEditingContent(false);
  };

  const handleDelete = () => {
    onDelete(liveNote.$id);
    setShowDeleteConfirm(false);
  };

  const handleOpenFullPage = () => {
    if (!liveNote.$id) return;
    closeSidebar();
    router.push(`/notes/${liveNote.$id}`);
  };

  const handleCreateTaskFromNote = useCallback(async () => {
    setIsCreatingTaskFromNote(true);
    try {
      const task = await createTaskFromNote(liveNote);
      if (task) {
        onUpdate({ ...liveNote, linkedTaskId: task.$id });
        showSuccess('Task created from note');
        setShowActionHub(false);
      }
    } catch (err) {
      showError('Failed to create task');
    } finally {
      setIsCreatingTaskFromNote(false);
    }
  }, [liveNote, onUpdate, showSuccess, showError]);

  const handleStartNoteHuddle = useCallback(() => {
    openCallLauncher({
      source: 'note',
      noteId: liveNote.$id,
      title: liveNote.title || 'Note Huddle',
      participantIds: [liveNote.userId, ...(liveNote.collaborators || [])].filter(Boolean),
    });
  }, [liveNote, openCallLauncher]);

  const linkedTaskIds = useMemo(() => (liveNote as any).linkedTaskIds || ((liveNote as any).linkedTaskId ? [(liveNote as any).linkedTaskId] : []), [liveNote]);
  const linkedEventIds = useMemo(() => (liveNote as any).linkedEventIds || ((liveNote as any).linkedEventId ? [(liveNote as any).linkedEventId] : []), [liveNote]);
  const linkedCredentialIds = useMemo(() => (liveNote as any).linkedCredentialIds || ((liveNote as any).linkedCredentialId ? [(liveNote as any).linkedCredentialId] : []), [liveNote]);

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

  const displayTags = useMemo(() => tags.split(',').map(t => t.trim()).filter(Boolean), [tags]);
  const displayTitle = isEncryptedNote ? '🔒 Encrypted Note' : (title || liveNote.title || 'Untitled note');
  const displayContent = isEncryptedNote ? '' : (content || liveNote.content || '');

  const resetTitleIdleTimer = () => {
    if (titleIdleTimer.current) clearTimeout(titleIdleTimer.current);
    titleIdleTimer.current = setTimeout(() => setIsEditingTitle(false), 15000);
  };

  const resetContentIdleTimer = () => {
    if (contentIdleTimer.current) clearTimeout(contentIdleTimer.current);
    contentIdleTimer.current = setTimeout(() => setIsEditingContent(false), 15000);
  };

  return (
    <Box sx={{ p: { xs: 2, md: 2.5 }, display: 'flex', flexDirection: 'column', gap: 3.5, height: '100%', overflowY: 'auto', bgcolor: '#0A0908' }}>
      {/* Header */}
      <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 1.5 }}>
        <IconButton onClick={onBack || closeSidebar} sx={{ color: theme.palette.text.secondary }}><BackIcon /></IconButton>
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5 }}>
          <Tooltip title="Action hub"><IconButton onClick={() => setShowActionHub(true)} sx={{ color: theme.palette.primary.main, bgcolor: alpha(theme.palette.primary.main, 0.08) }}><ActionIcon fontSize="small" /></IconButton></Tooltip>
          <Tooltip title="Start huddle"><IconButton onClick={handleStartNoteHuddle} sx={{ color: theme.palette.primary.main, bgcolor: alpha(theme.palette.primary.main, 0.08) }}><VideoCallIcon fontSize="small" /></IconButton></Tooltip>
          {showExpandButton && <Tooltip title="Full page"><IconButton onClick={handleOpenFullPage} sx={{ color: theme.palette.text.secondary }}><OpenIcon fontSize="small" /></IconButton></Tooltip>}
          <Tooltip title={pinned ? 'Unpin' : 'Pin'}><IconButton onClick={handlePinToggle} sx={{ color: pinned ? theme.palette.primary.main : theme.palette.text.secondary }}><PinIcon fontSize="small" /></IconButton></Tooltip>
          {isT4EncryptedPublicNote && <Tooltip title="Rotate link"><IconButton onClick={rotateNoteLink} sx={{ color: theme.palette.text.secondary }}><RefreshIcon fontSize="small" /></IconButton></Tooltip>}
          {showHeaderDeleteButton && <Tooltip title="Delete"><IconButton onClick={() => setShowDeleteConfirm(true)} sx={{ color: theme.palette.text.secondary, '&:hover': { color: theme.palette.error.main, bgcolor: alpha(theme.palette.error.main, 0.1) } }}><TrashIcon fontSize="small" /></IconButton></Tooltip>}
        </Box>
      </Box>

      {/* Title Card */}
      <Box sx={{ 
        p: 2.5, borderRadius: '28px', bgcolor: '#161412', border: '1px solid #1C1A18',
        boxShadow: '0 12px 32px rgba(0,0,0,0.4)', transition: 'all 0.3s ease',
        '&:focus-within': { borderColor: theme.palette.secondary.main, transform: 'translateY(-2px)' }
      }}>
        <Typography variant="caption" sx={{ color: theme.palette.secondary.main, fontWeight: 900, textTransform: 'uppercase', display: 'block', mb: 1, letterSpacing: '0.1em' }}>Title</Typography>
        {isEditingTitle ? (
          <TextField
            fullWidth
            variant="standard"
            value={title}
            onChange={(e) => { setTitle(e.target.value); resetTitleIdleTimer(); }}
            inputRef={titleInputRef}
            onBlur={() => setIsEditingTitle(false)}
            autoFocus
            InputProps={{ disableUnderline: true, sx: { fontSize: '1.4rem', fontWeight: 900, color: 'white', fontFamily: 'var(--font-clash)' } }}
          />
        ) : (
          <Typography variant="h5" onClick={() => setIsEditingTitle(true)} sx={{ cursor: 'text', fontWeight: 900, fontFamily: 'var(--font-clash)' }}>{displayTitle}</Typography>
        )}
      </Box>

      {/* Content Card */}
      <Box sx={{ 
        p: 2.5, borderRadius: '28px', bgcolor: '#161412', border: '1px solid #1C1A18', flex: 1, minHeight: 300,
        boxShadow: '0 12px 32px rgba(0,0,0,0.4)', transition: 'all 0.3s ease',
        '&:focus-within': { borderColor: theme.palette.primary.main, transform: 'translateY(-2px)' }
      }}>
        <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 2.5 }}>
          <Typography variant="caption" sx={{ color: theme.palette.primary.main, fontWeight: 900, textTransform: 'uppercase', letterSpacing: '0.1em' }}>Content</Typography>
          {isEditingContent && (
            <ToggleButtonGroup value={format} exclusive onChange={(_, v) => v && setFormat(v)} size="small" sx={{ height: 28, bgcolor: alpha('#fff', 0.04), borderRadius: '10px' }}>
              <ToggleButton value="text" sx={{ px: 2, py: 0, fontSize: '0.7rem', fontWeight: 800 }}>Text</ToggleButton>
              <ToggleButton value="doodle" sx={{ px: 2, py: 0, fontSize: '0.7rem', fontWeight: 800 }}>Doodle</ToggleButton>
            </ToggleButtonGroup>
          )}
        </Box>
        {isEditingContent ? (
          <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
            {format === 'text' ? (
              <TextField
                fullWidth
                multiline
                rows={14}
                variant="standard"
                value={content}
                onChange={(e) => { setContent(e.target.value); resetContentIdleTimer(); }}
                onBlur={() => setIsEditingContent(false)}
                autoFocus
                InputProps={{ disableUnderline: true, sx: { color: 'rgba(255,255,255,0.85)', fontSize: '1rem', lineHeight: 1.8 } }}
              />
            ) : (
              <Box onClick={() => setShowDoodleEditor(true)} sx={{ height: 200, border: '1px dashed rgba(255,255,255,0.1)', borderRadius: '18px', display: 'grid', placeItems: 'center', cursor: 'pointer', '&:hover': { bgcolor: alpha('#fff', 0.02) } }}>
                <Typography variant="body2" sx={{ color: theme.palette.text.secondary }}>Open Sketchpad</Typography>
              </Box>
            )}
          </Box>
        ) : (
          <Box onClick={() => setIsEditingContent(true)} sx={{ cursor: 'text' }}>
             <NoteContentRenderer content={displayContent} format={format} emptyFallback={<Typography variant="body2" sx={{ fontStyle: 'italic', color: theme.palette.text.secondary }}>🔒 Encrypted note content</Typography>} />
          </Box>
        )}
      </Box>

      {/* Tags Section */}
      <Box sx={{ px: 1 }}>
        <Typography variant="caption" sx={{ color: theme.palette.primary.main, fontWeight: 900, textTransform: 'uppercase', display: 'block', mb: 1.5, letterSpacing: '0.1em' }}>Tags</Typography>
        <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 1 }}>
          {displayTags.length > 0 ? displayTags.map(tag => (
            <Chip key={tag} label={tag} size="small" sx={{ bgcolor: alpha(theme.palette.primary.main, 0.1), color: theme.palette.primary.main, fontWeight: 800, borderRadius: '8px', border: `1px solid ${alpha(theme.palette.primary.main, 0.2)}` }} />
          )) : (
            <Typography variant="caption" sx={{ color: theme.palette.text.secondary, fontStyle: 'italic' }}>No tags assigned</Typography>
          )}
        </Box>
      </Box>

      {/* Linked Ecosystem Content */}
      <Box sx={{ display: 'flex', flexDirection: 'column', gap: 3, px: 1 }}>
        {[
          { label: 'Goals', items: linkedTasks, icon: <TaskIcon sx={{ fontSize: 18 }} />, color: '#10B981', link: (id: string) => `/flow?taskId=${id}` },
          { label: 'Events', items: linkedEvents, icon: <EventIcon sx={{ fontSize: 18 }} />, color: '#6366F1', link: (id: string) => `/flow/events?eventId=${id}` },
          { label: 'Secrets', items: linkedSecrets, icon: <KeyIcon sx={{ fontSize: 18 }} />, color: '#F59E0B', link: (id: string) => `/vault?id=${id}` },
        ].map(section => section.items.length > 0 && (
          <Box key={section.label}>
            <Typography variant="caption" sx={{ color: section.color, fontWeight: 900, textTransform: 'uppercase', display: 'block', mb: 1.5, letterSpacing: '0.1em' }}>Linked {section.label}</Typography>
            <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1.25 }}>
              {section.items.map((item: any) => (
                <Box key={item.$id} sx={{ p: 1.75, borderRadius: '18px', bgcolor: alpha(section.color, 0.04), border: `1px solid ${alpha(section.color, 0.12)}`, display: 'flex', justifyContent: 'space-between', alignItems: 'center', transition: 'all 0.2s ease', '&:hover': { bgcolor: alpha(section.color, 0.08), borderColor: alpha(section.color, 0.3) } }}>
                  <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5 }}>
                    <Box sx={{ color: section.color, display: 'flex' }}>{section.icon}</Box>
                    <Typography variant="body2" sx={{ fontWeight: 800, color: 'white' }}>{item.title || item.name}</Typography>
                  </Box>
                  <IconButton size="small" onClick={() => window.open(section.link(item.$id), '_blank')} sx={{ color: section.color }}><OpenIcon fontSize="small" /></IconButton>
                </Box>
              ))}
            </Box>
          </Box>
        ))}

        {/* Collaborators */}
        {collaboratorProfiles.length > 0 && (
          <Box>
            <Typography variant="caption" sx={{ color: theme.palette.secondary.main, fontWeight: 900, textTransform: 'uppercase', display: 'block', mb: 1.5, letterSpacing: '0.1em' }}>Collaborators</Typography>
            <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1.25 }}>
              {collaboratorProfiles.map((p: any) => (
                <Box key={p.$id || p.userId} sx={{ p: 1.5, borderRadius: '18px', bgcolor: alpha('#fff', 0.03), border: `1px solid ${alpha('#fff', 0.06)}`, display: 'flex', alignItems: 'center', gap: 1.5, cursor: 'pointer', transition: 'all 0.2s ease', '&:hover': { bgcolor: alpha('#fff', 0.05), borderColor: alpha('#fff', 0.15) } }} onClick={() => openUnified('share-note', { noteId: liveNote.$id, noteTitle: liveNote.title, initialCollaborator: p })}>
                  <IdentityAvatar fileId={p.avatar || p.profilePicId} alt={p.username} fallback={p.username?.[0]?.toUpperCase()} size={34} verified={p.tier === 'admin' || p.verified} />
                  <Box sx={{ flex: 1, minWidth: 0 }}>
                    <Typography variant="body2" sx={{ fontWeight: 800, color: 'white', noWrap: true }}>{p.displayName || p.username}</Typography>
                    <Typography variant="caption" sx={{ color: 'rgba(255,255,255,0.5)', display: 'block' }}>@{p.username}</Typography>
                  </Box>
                  <Typography variant="caption" sx={{ px: 1, py: 0.25, borderRadius: '6px', bgcolor: alpha(theme.palette.primary.main, 0.08), color: theme.palette.primary.main, fontWeight: 900, fontSize: '10px' }}>{p.permissionLevel || 'Viewer'}</Typography>
                </Box>
              ))}
            </Box>
          </Box>
        )}
      </Box>

      {/* Metadata Section */}
      <Box sx={{ mt: 4, pt: 3, borderTop: `1px solid ${alpha('#fff', 0.05)}`, display: 'flex', flexDirection: 'column', gap: 1 }}>
        <Typography variant="caption" sx={{ color: 'rgba(255,255,255,0.4)', fontWeight: 600 }}>Created {formatNoteCreatedDate(liveNote)}</Typography>
        <Typography variant="caption" sx={{ color: 'rgba(255,255,255,0.4)', fontWeight: 600 }}>Last sync {formatNoteUpdatedDate(liveNote)}</Typography>
      </Box>

      {/* Action Hub Drawer */}
      <Drawer
        anchor="top"
        open={showActionHub}
        onClose={() => setShowActionHub(false)}
        PaperProps={{ sx: { borderBottomLeftRadius: '32px', borderBottomRightRadius: '32px', bgcolor: '#161412', border: '1px solid #1C1A18', backgroundImage: 'none', p: 3.5, boxShadow: '0 24px 64px rgba(0,0,0,0.8)' } }}
      >
        <Box sx={{ display: 'flex', flexDirection: 'column', gap: 3.5 }}>
          <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <Box>
              <Typography variant="h6" sx={{ fontWeight: 900, color: theme.palette.primary.main, letterSpacing: '-0.02em' }}>Action Hub</Typography>
              <Typography variant="caption" sx={{ color: 'rgba(255,255,255,0.5)' }}>Ecosystem deep-links and suggestions</Typography>
            </Box>
            <IconButton onClick={() => setShowActionHub(false)} sx={{ color: 'rgba(255,255,255,0.6)' }}><CloseIcon /></IconButton>
          </Box>
          <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 1.5 }}>
            <Button variant="contained" startIcon={<TaskIcon />} onClick={handleCreateTaskFromNote} disabled={isCreatingTaskFromNote} sx={{ borderRadius: '14px', fontWeight: 900, px: 3, bgcolor: theme.palette.primary.main }}>Create Goal</Button>
            <Button variant="outlined" startIcon={<ShareIcon />} onClick={handleCopyShareLink} sx={{ borderRadius: '14px', fontWeight: 800, px: 2.5, color: 'white', borderColor: 'rgba(255,255,255,0.1)' }}>Copy Link</Button>
            <Button variant="outlined" startIcon={<LockIcon />} onClick={() => { setShowActionHub(false); rotateNoteLink(); }} disabled={!isPublic} sx={{ borderRadius: '14px', fontWeight: 800, px: 2.5, color: 'white', borderColor: 'rgba(255,255,255,0.1)' }}>Rotate Link</Button>
          </Box>
          <Box>
            <Typography variant="caption" sx={{ color: 'rgba(255,255,255,0.4)', fontWeight: 900, textTransform: 'uppercase', mb: 2, display: 'block', letterSpacing: '0.1em' }}>Intelligent Suggestions</Typography>
            {isLoadingSuggestions ? (
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 2, p: 2 }}>
                <CircularProgress size={18} thickness={6} />
                <Typography variant="body2" sx={{ color: 'rgba(255,255,255,0.6)' }}>Analyzing context...</Typography>
              </Box>
            ) : crossSuggestions.length > 0 ? (
              <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1.25 }}>
                {crossSuggestions.map(s => (
                  <Box key={s.id} sx={{ p: 2, bgcolor: alpha(theme.palette.primary.main, 0.05), borderRadius: '16px', border: `1px solid ${alpha(theme.palette.primary.main, 0.1)}`, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <Box sx={{ minWidth: 0, pr: 2 }}>
                      <Typography variant="body2" sx={{ fontWeight: 800, color: 'white' }}>{s.label}</Typography>
                      <Typography variant="caption" sx={{ color: 'rgba(255,255,255,0.5)' }}>{s.description}</Typography>
                    </Box>
                    <Button size="small" sx={{ fontWeight: 900, minWidth: 64 }} onClick={() => { window.open(`https://kylrix.space/integrations?noteId=${liveNote.$id}&action=${s.id}`, '_blank'); setShowActionHub(false); }}>USE</Button>
                  </Box>
                ))}
              </Box>
            ) : (
              <Typography variant="body2" sx={{ color: 'rgba(255,255,255,0.3)', fontStyle: 'italic', p: 1 }}>No suggestions available</Typography>
            )}
          </Box>
        </Box>
      </Drawer>

      {/* Confirmation Dialogs */}
      <ConfirmationDialog open={showRotateConfirm} title="Rotate public link?" message="The previous link will become permanently invalid. Anyone with the old link will lose access." confirmLabel={isRotating ? "Rotating..." : "Rotate Link"} isDestructive={true} isLoading={isRotating} onClose={() => setShowRotateConfirm(false)} onConfirm={handleConfirmedRotate} />
      
      <Dialog open={showDeleteConfirm} onClose={() => setShowDeleteConfirm(false)} PaperProps={{ sx: { borderRadius: '32px', bgcolor: '#161412', border: '1px solid #1C1A18', backgroundImage: 'none', p: 2, boxShadow: '0 32px 64px rgba(0,0,0,0.8)' } }}>
        <DialogTitle sx={{ fontWeight: 900, color: '#FF453A', fontSize: '1.5rem', fontFamily: 'var(--font-clash)' }}>Delete Note</DialogTitle>
        <DialogContent><Typography sx={{ color: 'rgba(255, 255, 255, 0.7)', fontSize: '1rem', lineHeight: 1.6 }}>Are you sure you want to delete &quot;{liveNote.title}&quot;? This action is permanent and cannot be undone.</Typography></DialogContent>
        <DialogActions sx={{ p: 3, gap: 2, flexDirection: 'column' }}>
          <Button variant="contained" fullWidth onClick={handleDelete} sx={{ borderRadius: '14px', bgcolor: '#FF453A', height: 48, fontWeight: 900 }}>Delete Permanently</Button>
          <Button variant="outlined" fullWidth onClick={() => setShowDeleteConfirm(false)} sx={{ borderRadius: '14px', color: 'white', height: 48, fontWeight: 800, borderColor: 'rgba(255,255,255,0.1)' }}>Cancel</Button>
        </DialogActions>
      </Dialog>

      {showDoodleEditor && (
        <DoodleCanvas initialData={(format === 'doodle' ? content : '') || ''} onSave={(d) => { setContent(d); setFormat('doodle'); setShowDoodleEditor(false); }} onClose={() => setShowDoodleEditor(false)} />
      )}
    </Box>
  );
}
