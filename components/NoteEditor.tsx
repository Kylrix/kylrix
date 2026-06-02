'use client';

import React, { useState, useEffect } from 'react';
import { 
  Box, 
  Typography, 
  Paper, 
  Stack, 
  Alert,
  Skeleton,
  Chip,
  alpha,
  useTheme,
  TextField,
  Button,
  CircularProgress
} from '@/lib/mui-tailwind/material';
import { Save as SaveIcon, Update as UpdateIcon } from '@/lib/mui-tailwind/icons';
import AttachmentsManager from '@/components/AttachmentsManager';
import NoteContent from '@/components/NoteContent';
import { IdentityAvatar } from './IdentityBadge';
import { formatFileSize } from '@/lib/utils';
import { getNote, getNotePublicState, toggleNoteVisibility } from '@/lib/appwrite';
import { createNote, updateNote } from '@/lib/actions/client-ops';
import { useDataNexus } from '@/context/DataNexusContext';
import { useSudo } from '@/context/SudoContext';
import { ecosystemSecurity } from '@/lib/ecosystem/security';
import { usePresence } from '@/components/providers/PresenceProvider';
import { APPWRITE_CONFIG } from '@/lib/appwrite/config';
import { useCollaborativeNote } from '@/hooks/useCollaborativeNote';

interface AttachmentMeta { id: string; name: string; size: number; mime: string | null; }

const AttachmentChips: React.FC<{ noteId: string }> = ({ noteId }) => {
  const [attachments, setAttachments] = React.useState<AttachmentMeta[]>([]);
  const [loaded, setLoaded] = React.useState(false);
  const [_theme, _setTheme] = React.useState(useTheme());
  const theme = _theme;
  void theme;

  React.useEffect(() => {
    let cancelled = false;
    (async () => {
      if (!noteId) return;
      try {
        const res = await fetch(`/api/notes/${noteId}/attachments`);
        if (!res.ok) return;
        const j = await res.json();
        if (!cancelled) setAttachments(Array.isArray(j.attachments)? j.attachments: []);
      } catch {}
      finally { if (!cancelled) setLoaded(true); }
    })();
    return () => { cancelled = true; };
  }, [noteId]);

  if (!noteId) return null;
  if (!loaded) {
    return (
      <Stack direction="row" spacing={1} sx={{ mt: 2 }}>
        {Array.from({length:3}).map((_,i)=>(
          <Skeleton key={i} variant="rounded" width={80} height={24} sx={{ borderRadius: 12, bgcolor: '#1C1A18' }} />
        ))}
      </Stack>
    );
  }
  if (attachments.length === 0) return null;
  return (
    <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 1, mt: 2 }}>
      {attachments.map(a => (
        <Chip
          key={a.id}
          label={truncate(a.name, 18)}
          component="a"
          href={`/notes/${noteId}/${a.id}`}
          clickable
          size="small"
          sx={{
            bgcolor: alpha('#EC4899', 0.1),
            color: '#EC4899',
            border: `1px solid ${alpha('#EC4899', 0.2)}`,
            fontSize: '11px',
            fontWeight: 700,
            fontFamily: 'Satoshi, sans-serif',
            '&:hover': { bgcolor: alpha('#EC4899', 0.2) }
          }}
          title={`${a.name} • ${formatFileSize(a.size)}${a.mime? ' • '+a.mime:''}`}
        />
      ))}
    </Box>
  );
};

function truncate(s: string, n: number){ return s.length>n? s.slice(0,n-1)+'…': s; }

interface NoteEditorProps {
  initialContent?: string;
  initialTitle?: string;
  initialFormat?: 'text' | 'doodle';
  noteId?: string; // existing note id if editing
  onSave?: (note: any) => void; // called after create or update
  onNoteCreated?: (note: any) => void; // called only on first creation
}

export default function NoteEditor({ 
  initialContent = '', 
  initialTitle = '',
  initialFormat = 'text',
  noteId: externalNoteId,
  onSave,
  onNoteCreated
}: NoteEditorProps) {
  const { note: collabNote, updateNote: collabUpdate } = useCollaborativeNote(externalNoteId);
  const [title, setTitle] = useState(initialTitle);
  const [content, setContent] = useState(initialContent);
  const [format, setFormat] = useState<'text' | 'doodle'>(initialFormat);
  
  // Sync state with collab note
  useEffect(() => {
    if (collabNote) {
        setTitle(collabNote.title);
        setContent(collabNote.content);
    }
  }, [collabNote]);

  const handleContentChange = (newContent: string) => {
    setContent(newContent);
    if (externalNoteId) {
        collabUpdate({ content: newContent });
    }
  };

  const handleTitleChange = (newTitle: string) => {
    setTitle(newTitle);
    if (externalNoteId) {
        collabUpdate({ title: newTitle });
    }
  };

  const [isPublic, setIsPublic] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [internalNoteId, setInternalNoteId] = useState<string | undefined>(externalNoteId);
  const [persistedIsPublic, setPersistedIsPublic] = useState(false);
  const effectiveNoteId = internalNoteId || externalNoteId;
  const { fetchOptimized, setCachedData, getCachedData } = useDataNexus();
  const { promptSudo } = useSudo();
  const { joinResource, resourcePresence } = usePresence();

  useEffect(() => {
      if (effectiveNoteId) {
          return joinResource(
              APPWRITE_CONFIG.DATABASES.NOTE,
              APPWRITE_CONFIG.TABLES.NOTE.NOTES,
              effectiveNoteId
          );
      }
  }, [effectiveNoteId, joinResource]);

  useEffect(() => {
    if (externalNoteId && externalNoteId !== internalNoteId) {
      setInternalNoteId(externalNoteId);
    }
  }, [externalNoteId, internalNoteId]);

  const handleSave = async () => {
    if (!title.trim() && !content.trim()) return;
    try {
      setIsSaving(true);
      setError(null);
      let saved: any;
      if (effectiveNoteId) {
        saved = await updateNote(effectiveNoteId, { 
          title: title.trim(), 
          content: content.trim(),
          format,
          // Visibility transitions are handled via secure toggle.
          isPublic: persistedIsPublic
        });
      } else {
        saved = await createNote({ 
          title: title.trim(), 
          content: content.trim(), 
          format,
          // New notes are created private, then securely toggled if needed.
          isPublic: false,
          tags: [] 
        });
        const newId = saved?.$id || saved?.id;
        setInternalNoteId(newId);
        onNoteCreated?.(saved);
      }

      if (saved?.$id && isPublic !== persistedIsPublic) {
        const applySecureVisibility = async () => {
          try {
            const toggled = await toggleNoteVisibility(saved.$id);
            if (!toggled) throw new Error('Failed to update note visibility.');
            return toggled;
          } catch (toggleError: any) {
            if (toggleError?.message === 'VAULT_LOCKED') {
              const unlocked = await promptSudo();
              if (!unlocked) throw new Error('Vault unlock required to make this note public.');
              const retried = await toggleNoteVisibility(saved.$id);
              if (!retried) throw new Error('Failed to update note visibility.');
              return retried;
            }
            throw toggleError;
          }
        };
        saved = await applySecureVisibility();
      }

      const livePublicState = getNotePublicState(saved);
      setPersistedIsPublic(livePublicState);
      setIsPublic(livePublicState);
      if (saved?.$id) setCachedData(`note_${saved.$id}`, saved);
      onSave?.(saved);
    } catch (err: any) {
      setError(err?.message || 'Failed to save note');
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <Paper
      elevation={0}
      sx={{
        p: { xs: 2, md: 4 },
        bgcolor: '#161412',
        border: '1px solid #1C1A18',
        borderRadius: '32px',
        backgroundImage: 'none',
        boxShadow: '0 24px 48px rgba(0,0,0,0.4), inset 0 1px 0 rgba(255, 255, 255, 0.05), inset 0 -1px 0 rgba(0, 0, 0, 0.4)'
      }}
    >
      <Stack spacing={4}>
        <TextField
          fullWidth
          placeholder="Note Title"
          variant="standard"
          value={title}
          onChange={ (e) => handleTitleChange(e.target.value)}
          disabled={isSaving}
          InputProps={{
            disableUnderline: true,
            sx: { 
              fontSize: { xs: '1.5rem', md: '2rem' }, 
              fontWeight: 900, 
              color: 'white',
              fontFamily: 'Clash Display, sans-serif',
              letterSpacing: '-0.03em',
              '& input::placeholder': {
                color: 'rgba(255, 255, 255, 0.2)',
                opacity: 1
              }
            }
          }}
        />

        <NoteContent
          format={format}
          content={content}
          onChange={handleContentChange}
          onFormatChange={setFormat}
          disabled={isSaving}
        />

        {effectiveNoteId && (
          <Box sx={{ 
            p: 3, 
            bgcolor: '#0A0908', 
            borderRadius: '24px',
            border: '1px solid #1C1A18',
            boxShadow: 'inset 0 1px 0 rgba(255, 255, 255, 0.02)'
          }}>
            <AttachmentsManager noteId={effectiveNoteId} />
            <AttachmentChips noteId={effectiveNoteId} />
          </Box>
        )}

        {!effectiveNoteId && (
          <Box sx={{ 
            p: 2, 
            bgcolor: alpha('#EC4899', 0.05), 
            borderRadius: '16px',
            border: '1px solid',
            borderColor: alpha('#EC4899', 0.1),
            textAlign: 'center'
          }}>
            <Typography variant="caption" sx={{ color: '#EC4899', fontWeight: 700, fontFamily: 'Satoshi, sans-serif', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
              Save the note to enable attachments.
            </Typography>
          </Box>
        )}

        <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 2, flexWrap: 'wrap' }}>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5, bgcolor: '#0A0908', px: 2, py: 1, borderRadius: '14px', border: '1px solid #1C1A18', boxShadow: 'inset 0 1px 0 rgba(255, 255, 255, 0.02)' }}>
            <Typography variant="caption" sx={{ fontWeight: 800, color: 'rgba(255, 255, 255, 0.4)', textTransform: 'uppercase', fontFamily: 'Satoshi, sans-serif' }}>
              Visibility:
            </Typography>
            <Box sx={{ display: 'flex', gap: 0.5 }}>
              <Button
                size="small"
                onClick={() => setIsPublic(false)}
                sx={{
                  minWidth: '70px',
                  borderRadius: '10px',
                  fontSize: '0.7rem',
                  fontWeight: 900,
                  fontFamily: 'Satoshi, sans-serif',
                  py: 0.5,
                  bgcolor: !isPublic ? '#1C1A18' : 'transparent',
                  color: !isPublic ? 'white' : 'rgba(255, 255, 255, 0.3)',
                  border: !isPublic ? '1px solid #2C2A28' : '1px solid transparent',
                  '&:hover': { bgcolor: '#2C2A28' }
                }}
              >
                Private
              </Button>
              <Button
                size="small"
                onClick={async () => {
                  if (!ecosystemSecurity.status.isUnlocked) {
                    const unlocked = await promptSudo();
                    if (!unlocked) {
                      setError('Unlock MasterPass before enabling public sharing.');
                      return;
                    }
                  }
                  setIsPublic(true);
                }}
                sx={{
                  minWidth: '70px',
                  borderRadius: '10px',
                  fontSize: '0.7rem',
                  fontWeight: 900,
                  fontFamily: 'Satoshi, sans-serif',
                  py: 0.5,
                  bgcolor: isPublic ? alpha('#EC4899', 0.2) : 'transparent',
                  color: isPublic ? '#EC4899' : 'rgba(255, 255, 255, 0.3)',
                  border: isPublic ? `1px solid ${alpha('#EC4899', 0.3)}` : '1px solid transparent',
                  '&:hover': { bgcolor: alpha('#EC4899', 0.3) }
                }}
              >
                Public
                </Button>
                </Box>

                {/* Collaborator HUD */}
                {effectiveNoteId && resourcePresence[effectiveNoteId]?.length > 0 && (
                <Stack direction="row" spacing={-1} sx={{ ml: 2 }}>
                    {resourcePresence[effectiveNoteId].map((p) => (
                        <IdentityAvatar 
                            key={p.userId}
                            size={24}
                            status={p.state}
                            sx={{ border: '2px solid #161412' }}
                        />
                    ))}
                </Stack>
                )}
                </Box>
          <Button
            variant="contained"
            onClick={handleSave}
            disabled={isSaving || !title.trim()}
            startIcon={isSaving ? <CircularProgress size={20} color="inherit" /> : (effectiveNoteId ? <UpdateIcon /> : <SaveIcon />)}
            sx={{
              bgcolor: '#EC4899',
              color: '#000',
              fontWeight: 900,
              fontFamily: 'Satoshi, sans-serif',
              px: 4,
              py: 1.5,
              borderRadius: '14px',
              textTransform: 'none',
              fontSize: '1rem',
              boxShadow: `0 8px 24px ${alpha('#EC4899', 0.2)}, inset 0 1px 0 rgba(255, 255, 255, 0.2)`,
              '&:hover': {
                bgcolor: '#F062AD',
                transform: 'translateY(-2px)',
                boxShadow: `0 12px 32px ${alpha('#EC4899', 0.4)}, inset 0 1px 0 rgba(255, 255, 255, 0.2)`
              },
              '&.Mui-disabled': {
                bgcolor: '#1C1A18',
                color: 'rgba(255, 255, 255, 0.1)',
                border: '1px solid #2C2A28'
              },
              transition: 'all 0.3s cubic-bezier(0.4, 0, 0.2, 1)'
            }}
          >
            {effectiveNoteId ? 'Update Note' : 'Save & Enable Attachments'}
          </Button>
        </Box>

        {error && (
          <Alert 
            severity="error" 
            sx={{ 
              borderRadius: '16px',
              bgcolor: alpha('#FF3B30', 0.1),
              color: '#FF3B30',
              border: '1px solid',
              borderColor: alpha('#FF3B30', 0.2),
              '& .MuiAlert-icon': { color: '#FF3B30' }
            }}
          >
            {error}
          </Alert>
        )}
      </Stack>
    </Paper>
  );
}


