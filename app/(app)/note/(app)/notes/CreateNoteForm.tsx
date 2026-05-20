"use client";

import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  Box,
  Button,
  IconButton,
  Paper,
  Stack,
  TextField,
  ToggleButton,
  ToggleButtonGroup,
  Typography,
  alpha,
  useMediaQuery,
  useTheme,
} from '@mui/material';
import {
  Description as DescriptionIcon,
  ExpandLess as ExpandLessIcon,
  ExpandMore as ExpandMoreIcon,
  DragHandle as DragHandleIcon,
  Lock as PrivateIcon,
  Public as PublicIcon,
  Brush as PencilIcon,
} from '@mui/icons-material';
import { Check } from 'lucide-react';
import { buildAutoTitleFromContent } from '@/constants/noteTitle';
import { useOverlay } from '@/components/ui/OverlayContext';
import { useToast } from '@/components/ui/Toast';
import { createNote, getNote, getNotePublicState, toggleNoteVisibility, updateNote } from '@/lib/appwrite';
import type { Notes } from '@/types/appwrite';
import DoodleCanvas from '@/components/DoodleCanvas';
import { useNotes } from '@/context/NotesContext';
import { useDataNexus } from '@/context/DataNexusContext';
import { ecosystemSecurity } from '@/lib/ecosystem/security';
import { useSudo } from '@/context/SudoContext';

interface CreateNoteFormProps {
  onNoteCreated: (note: Notes) => void;
  initialContent?: {
    title?: string;
    content?: string;
    tags?: string[];
  };
  initialFormat?: 'text' | 'doodle';
  noteKind?: 'note' | 'project';
  noteId?: string;
}

const normalizeTags = (tags: string[] = []) => Array.from(new Set(tags.map((tag) => tag.trim()).filter(Boolean)));

export default function CreateNoteForm({
  onNoteCreated,
  initialContent,
  initialFormat = 'text',
  noteKind = 'note',
  noteId,
}: CreateNoteFormProps) {
  const theme = useTheme();
  const isMobile = useMediaQuery(theme.breakpoints.down('md'));
  const { closeOverlay } = useOverlay();
  const { showSuccess, showError } = useToast();
  const { notes: allNotes } = useNotes();
  const { fetchOptimized, getCachedData, setCachedData } = useDataNexus();
  const { promptSudo } = useSudo();
  const hasMasterKey = ecosystemSecurity.status.hasKey;

  const [title, setTitle] = useState(initialContent?.title || '');
  const [content, setContent] = useState(initialContent?.content || '');
  const [format, setFormat] = useState<'text' | 'doodle'>(initialFormat);
  const [tags, setTags] = useState<string[]>(normalizeTags(initialContent?.tags || []));
  const [isPublic, setIsPublic] = useState(false);
  const [isTitleManuallyEdited, setIsTitleManuallyEdited] = useState(false);
  const [currentTag, setCurrentTag] = useState('');
  const [isExpanded, setIsExpanded] = useState(!isMobile);
  const [isSaving, setIsSaving] = useState(false);
  const [showDoodleEditor, setShowDoodleEditor] = useState(initialFormat === 'doodle');
  const [resolvedNoteId, setResolvedNoteId] = useState<string | undefined>(noteId);
  const [persistedIsPublic, setPersistedIsPublic] = useState(false);
  const [isHydrated, setIsHydrated] = useState(false);
  const [lastSavedSnapshot, setLastSavedSnapshot] = useState('');
  const [hasPaywall, setHasPaywall] = useState(false);
  const [paywallAmount, setPaywallAmount] = useState<number | ''>(0);
  const [composerKind, setComposerKind] = useState<'note' | 'project'>(noteKind);
  const contentRef = useRef<HTMLTextAreaElement | null>(null);
  const createdToastShown = useRef(false);
  const persistInFlightRef = useRef<Promise<Notes | null> | null>(null);

  // Seamless auto-title logic
  useEffect(() => {
    if (isTitleManuallyEdited) return;

    const generatedTitle = buildAutoTitleFromContent(content);
    if (content.trim()) {
      if (generatedTitle !== title) {
        setTitle(generatedTitle);
      }
    } else {
      setTitle('');
    }
  }, [content, isTitleManuallyEdited, title]);

  const existingTags = useMemo(() => {
    const tagSet = new Set<string>();
    (Array.isArray(allNotes) ? allNotes : []).forEach((note) => {
      (note.tags || []).forEach((tag) => {
        const cleaned = tag.trim();
        if (cleaned) tagSet.add(cleaned);
      });
    });
    return Array.from(tagSet).slice(0, 24);
  }, [allNotes]);

  const snapshot = useMemo(() => JSON.stringify({
    title: title.trim(),
    content: content.trim(),
    format,
    tags: normalizeTags(tags),
    isPublic,
    composerKind,
    hasPaywall,
    paywallAmount,
    resolvedNoteId: resolvedNoteId || null,
  }), [title, content, format, tags, isPublic, composerKind, hasPaywall, paywallAmount, resolvedNoteId]);

  const isDirty = snapshot !== lastSavedSnapshot;

  useEffect(() => {
    if (!isMobile) setIsExpanded(true);
  }, [isMobile]);

  useEffect(() => {
    let cancelled = false;

    const hydrate = async () => {
      if (!noteId) {
        setIsHydrated(true);
        return;
      }

      const cacheKey = `note_${noteId}`;
      const cached = getCachedData<Notes>(cacheKey);
      if (cached && !cancelled) {
        const nextComposerKind = (cached as any).kind === 'project' ? 'project' : noteKind;
        setResolvedNoteId(cached.$id);
        setTitle(cached.title || '');
        setContent(cached.content || '');
        setFormat((cached.format as 'text' | 'doodle') || initialFormat);
        setTags(normalizeTags(cached.tags || []));
        setComposerKind(nextComposerKind);
        const cachedPublic = getNotePublicState(cached as Notes);
        setIsPublic(cachedPublic);
        setPersistedIsPublic(cachedPublic);
        const paywall = (cached as any).metadata?.paywall;
        setHasPaywall(!!paywall?.enabled);
        setPaywallAmount(paywall?.amount || 0);
        setLastSavedSnapshot(JSON.stringify({
          title: cached.title || '',
          content: cached.content || '',
          format: (cached.format as 'text' | 'doodle') || 'text',
          tags: normalizeTags(cached.tags || []),
          composerKind: nextComposerKind,
          isPublic: !!cached.isPublic,
          hasPaywall: !!paywall?.enabled,
          paywallAmount: paywall?.amount || 0,
          resolvedNoteId: cached.$id,
        }));
      }

      try {
        const loaded = await fetchOptimized(cacheKey, () => getNote(noteId));
        if (cancelled || !loaded) return;
        const nextComposerKind = (loaded as any).kind === 'project' ? 'project' : noteKind;
        setResolvedNoteId(loaded.$id);
        setTitle(loaded.title || '');
        setContent(loaded.content || '');
        setFormat((loaded.format as 'text' | 'doodle') || initialFormat);
        setTags(normalizeTags(loaded.tags || []));
        setComposerKind(nextComposerKind);
        const loadedPublic = getNotePublicState(loaded as Notes);
        setIsPublic(loadedPublic);
        setPersistedIsPublic(loadedPublic);
        const paywall = (loaded as any).metadata?.paywall;
        setHasPaywall(!!paywall?.enabled);
        setPaywallAmount(paywall?.amount || 0);
        setLastSavedSnapshot(JSON.stringify({
          title: loaded.title || '',
          content: loaded.content || '',
          format: (loaded.format as 'text' | 'doodle') || 'text',
          tags: normalizeTags(loaded.tags || []),
          composerKind: nextComposerKind,
          isPublic: !!loaded.isPublic,
          hasPaywall: !!paywall?.enabled,
          paywallAmount: paywall?.amount || 0,
          resolvedNoteId: loaded.$id,
        }));
      } catch (error) {
        console.error('Failed to load note for composer', error);
      } finally {
        if (!cancelled) setIsHydrated(true);
      }
    };

    hydrate();
    return () => {
      cancelled = true;
    };
  }, [fetchOptimized, getCachedData, initialFormat, noteId, noteKind]);

  useEffect(() => {
    if (!isHydrated) return;
    if (!isDirty) return;
    if (!resolvedNoteId && !(title.trim() || content.trim())) return;

    const timer = window.setTimeout(() => {
      void persist(false);
    }, 750);

    return () => window.clearTimeout(timer);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [snapshot, isHydrated, isDirty]);

  const appendTag = useCallback((tag: string) => {
    const next = tag.trim();
    if (!next) return;
    setTags((prev) => normalizeTags([...prev, next]));
    setCurrentTag('');
  }, []);

  const removeTag = useCallback((tag: string) => {
    setTags((prev) => prev.filter((candidate) => candidate !== tag));
  }, []);

  const wrapSelection = useCallback((before: string, after = before) => {
    const input = contentRef.current;
    if (!input) return;

    const start = input.selectionStart ?? content.length;
    const end = input.selectionEnd ?? content.length;
    const selected = content.slice(start, end) || 'text';
    const nextValue = `${content.slice(0, start)}${before}${selected}${after}${content.slice(end)}`;
    const cursor = start + before.length + selected.length + after.length;
    setContent(nextValue);
    window.requestAnimationFrame(() => {
      input.focus();
      input.setSelectionRange(cursor, cursor);
    });
  }, [content]);

  const persist = useCallback(async (showToast = true) => {
    if (persistInFlightRef.current) {
      return persistInFlightRef.current;
    }

    const runPersist = (async () => {
    const normalizedTags = normalizeTags(tags);
    const payload = {
      title: title.trim(),
      content: content.trim(),
      format,
      tags: normalizedTags,
      kind: composerKind,
      isPublic,
      metadata: JSON.stringify({
        paywall: hasPaywall && paywallAmount ? {
          enabled: true,
          amount: typeof paywallAmount === 'number' ? paywallAmount : parseFloat(paywallAmount as any) || 0,
          currency: 'USD',
        } : {
          enabled: false,
          amount: 0,
          currency: 'USD',
        },
      }),
    };

    const hasMeaningfulContent = Boolean(payload.title || payload.content || (resolvedNoteId && payload.tags.length));
    if (!resolvedNoteId && !hasMeaningfulContent) {
      return null;
    }

    setIsSaving(true);
    try {
      let saved: Notes;
      const generatedTitle = payload.title || (
        format === 'doodle'
          ? `${composerKind === 'project' ? 'Project sketch' : 'Sketch'} ${new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}`
          : buildAutoTitleFromContent(payload.content) || (composerKind === 'project' ? 'Untitled Project' : 'Untitled Thought')
      );

      if (resolvedNoteId) {
        saved = (await updateNote(resolvedNoteId, {
          ...payload,
          // Public/private transitions must go through secure toggle flow.
          isPublic: persistedIsPublic,
          title: generatedTitle,
        })) as Notes;
      } else {
        saved = (await createNote({
          ...payload,
          // New notes always start private, then securely toggle if requested.
          isPublic: false,
          title: generatedTitle,
        })) as Notes;
        setResolvedNoteId(saved.$id);
        onNoteCreated(saved);
        if (showToast && !createdToastShown.current) {
          createdToastShown.current = true;
          showSuccess('Note saved', 'Your note has been created.');
        }
      }

      if (saved?.$id) {
        if (isPublic !== persistedIsPublic) {
          const applySecureVisibility = async (): Promise<Notes> => {
            try {
              const toggled = await toggleNoteVisibility(saved.$id);
              if (!toggled) throw new Error('Failed to update note visibility.');
              return toggled as Notes;
            } catch (error: any) {
              if (error?.message === 'VAULT_LOCKED') {
                const unlocked = await promptSudo();
                if (!unlocked) {
                  throw new Error('Vault unlock required to make this note public.');
                }
                const retried = await toggleNoteVisibility(saved.$id);
                if (!retried) throw new Error('Failed to update note visibility.');
                return retried as Notes;
              }
              throw error;
            }
          };

          saved = await applySecureVisibility();
          onNoteCreated(saved);
          showSuccess(
            getNotePublicState(saved) ? 'Note is now Public' : 'Note is now Private',
            getNotePublicState(saved)
              ? 'Encrypted sharing is enabled for this note.'
              : 'This note is now private.'
          );
        }

        const livePublicState = getNotePublicState(saved);
        setPersistedIsPublic(livePublicState);
        setIsPublic(livePublicState);
        setCachedData(`note_${saved.$id}`, saved);
        const paywall = (saved as any).metadata?.paywall;
        setLastSavedSnapshot(JSON.stringify({
          title: saved.title || '',
          content: saved.content || '',
          format: (saved.format as 'text' | 'doodle') || format,
          tags: normalizeTags((saved.tags || []) as string[]),
          composerKind,
          isPublic: livePublicState,
          hasPaywall: !!paywall?.enabled,
          paywallAmount: paywall?.amount || 0,
          resolvedNoteId: saved.$id,
        }));
      }

      return saved || null;
    } catch (error: any) {
      console.error('Failed to persist note:', error);
      if (showToast) {
        showError('Could not save note', error?.message || 'Please try again.');
      }
      throw error;
    } finally {
      setIsSaving(false);
    }
    })();

    persistInFlightRef.current = runPersist;
    try {
      return await runPersist;
    } finally {
      persistInFlightRef.current = null;
    }
  }, [composerKind, content, format, hasPaywall, isPublic, onNoteCreated, paywallAmount, persistedIsPublic, promptSudo, resolvedNoteId, setCachedData, showError, showSuccess, tags, title]);

  const handleClose = useCallback(async () => {
    const shouldPersist = Boolean((resolvedNoteId && isDirty) || (!resolvedNoteId && (title.trim() || content.trim())));
    if (shouldPersist) {
      try {
        await persist(false);
      } catch {
        return;
      }
    }
    closeOverlay();
  }, [closeOverlay, content, isDirty, persist, resolvedNoteId, title]);

  const handleTagKeyDown = useCallback((event: React.KeyboardEvent<HTMLInputElement>) => {
    if (event.key === 'Enter') {
      event.preventDefault();
      appendTag(currentTag);
    }
  }, [appendTag, currentTag]);

  return (
    <>
      {showDoodleEditor && (
        <DoodleCanvas
          initialData={format === 'doodle' ? content : ''}
          onSave={(doodleData) => {
            setContent(doodleData);
            setFormat('doodle');
            setShowDoodleEditor(false);
          }}
          onClose={() => setShowDoodleEditor(false)}
        />
      )}

      <Box
        onContextMenu={(event) => event.preventDefault()}
        sx={{
          width: '100%',
          height: '100%',
          minHeight: 0,
          display: 'flex',
          flexDirection: 'column',
          bgcolor: '#161412',
          color: 'white',
        }}
      >
        <Box
          sx={{
            px: 2,
            py: 1.5,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            borderBottom: '1px solid rgba(255,255,255,0.06)',
            position: 'sticky',
            top: 0,
            zIndex: 2,
            backdropFilter: 'blur(18px)',
            bgcolor: 'rgba(22, 20, 18, 0.95)',
          }}
        >
          <Box sx={{ display: 'flex', justifyContent: 'center', py: 1 }}>
            <DragHandleIcon sx={{ fontSize: 20, color: 'rgba(255,255,255,0.3)' }} />
          </Box>
          <Stack direction="row" spacing={1.5} alignItems="center">
            <Box
              sx={{
                width: 40,
                height: 40,
                borderRadius: '14px',
                display: 'grid',
                placeItems: 'center',
                bgcolor: alpha('#EC4899', 0.12),
                border: '1px solid rgba(236,72,153,0.2)',
              }}
            >
              {format === 'doodle' ? <PencilIcon sx={{ color: '#EC4899' }} /> : <DescriptionIcon sx={{ color: '#EC4899' }} />}
            </Box>
            <Box>
              <Typography sx={{ fontWeight: 900, letterSpacing: '-0.03em' }}>
                {resolvedNoteId ? (composerKind === 'project' ? 'Edit project' : 'Edit note') : (composerKind === 'project' ? 'New project' : 'New note')}
              </Typography>
              <Typography variant="caption" sx={{ color: 'rgba(255,255,255,0.5)' }}>
                {isSaving ? 'Saving…' : isDirty ? 'Unsaved changes' : 'Autosaves on close'}
              </Typography>
            </Box>
          </Stack>

          <Stack direction="row" spacing={0.5} alignItems="center">
            <ToggleButtonGroup
              value={isPublic}
              exclusive
              size="small"
              onChange={async (_, value) => {
                if (value === null) return;
                if (value === true && !ecosystemSecurity.status.isUnlocked) {
                  const unlocked = await promptSudo();
                  if (!unlocked) {
                    setIsPublic(false);
                    showError('Vault Locked', 'Unlock MasterPass before enabling public sharing.');
                    return;
                  }
                }
                setIsPublic(value);
              }}
              sx={{
                bgcolor: 'rgba(255,255,255,0.04)',
                borderRadius: '14px',
                '& .MuiToggleButton-root': {
                  border: 'none',
                  color: 'rgba(255,255,255,0.55)',
                  px: 1.5,
                  '&.Mui-selected': {
                    bgcolor: 'rgba(236,72,153,0.16)',
                    color: 'white',
                  }
                }
              }}
            >
              <ToggleButton value={false}><PrivateIcon fontSize="small" /></ToggleButton>
              <ToggleButton value={true}><PublicIcon fontSize="small" /></ToggleButton>
            </ToggleButtonGroup>

            <IconButton onClick={() => setIsExpanded((prev) => !prev)} sx={{ color: 'rgba(255,255,255,0.7)' }}>
              {isExpanded ? <ExpandLessIcon /> : <ExpandMoreIcon />}
            </IconButton>

            <IconButton onClick={handleClose} sx={{ color: 'rgba(255,255,255,0.7)' }}>
              <Check size={20} />
            </IconButton>
          </Stack>
        </Box>

        <Box sx={{ px: 2, py: 2, overflowY: 'auto', minHeight: 0, flex: 1 }}>
          <Stack spacing={2.25}>
            {(content.trim().length >= 5 || isTitleManuallyEdited) && (
              <TextField
                fullWidth
                value={title}
                onChange={(event) => {
                  setTitle(event.target.value);
                  setIsTitleManuallyEdited(true);
                }}
                placeholder="Title"
                variant="standard"
                InputProps={{
                  disableUnderline: true,
                  sx: {
                    fontSize: '1.4rem',
                    fontWeight: 900,
                    color: 'white',
                    '& input::placeholder': { color: 'rgba(255,255,255,0.22)', opacity: 1 },
                  }
                }}
                sx={{
                  bgcolor: 'rgba(255,255,255,0.02)',
                  borderRadius: '18px',
                  px: 2,
                  py: 1.5,
                  border: '1px solid rgba(255,255,255,0.05)',
                }}
              />
            )}

            {format === 'text' ? (
              <>
                <TextField
                  multiline
                  minRows={isExpanded ? 14 : 8}
                  fullWidth
                  value={content}
                  onChange={(event) => setContent(event.target.value)}
                  placeholder="Write your note..."
                  inputRef={contentRef}
                  sx={{
                    '& .MuiOutlinedInput-root': {
                      borderRadius: '22px',
                      bgcolor: 'rgba(255,255,255,0.03)',
                      border: '1px solid rgba(255,255,255,0.06)',
                    }
                  }}
                />
              </>
            ) : (
              <Paper
                variant="outlined"
                sx={{
                  p: 2,
                  borderRadius: '22px',
                  borderColor: 'rgba(255,255,255,0.08)',
                  bgcolor: 'rgba(255,255,255,0.03)',
                }}
              >
                {content ? (
                  <Typography sx={{ whiteSpace: 'pre-wrap', minHeight: 120 }}>
                    {content.slice(0, 300)}
                  </Typography>
                ) : (
                  <Typography sx={{ color: 'rgba(255,255,255,0.45)' }}>
                    No doodle yet. Open the canvas to sketch.
                  </Typography>
                )}
                <Stack direction="row" spacing={1.5} sx={{ mt: 2 }} flexWrap="wrap">
                  <Button variant="contained" onClick={() => { setShowDoodleEditor(true); setFormat('doodle'); }} sx={{ bgcolor: '#EC4899', color: 'black', fontWeight: 800 }}>
                    {content ? 'Edit doodle' : 'Create doodle'}
                  </Button>
                  <Button variant="outlined" onClick={() => setFormat('text')} sx={{ color: 'white', borderColor: 'rgba(255,255,255,0.1)' }}>
                    Switch to text
                  </Button>
                </Stack>
              </Paper>
            )}

            <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 2, flexWrap: 'wrap' }}>
              <Typography variant="caption" sx={{ color: 'rgba(255,255,255,0.45)' }}>
                Right click is handled here so copy, cut, paste, and shortcuts stay local.
              </Typography>
            </Box>
          </Stack>
        </Box>
      </Box>
    </>
  );
}
