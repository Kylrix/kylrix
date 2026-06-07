"use client";

import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { 
  Check, 
  ArrowUpRight, 
  Mic, 
  Square, 
  FileText, 
  PenTool, 
  Lock, 
  Globe, 
  ChevronUp, 
  ChevronDown, 
  X, 
  Tag, 
  Plus
} from 'lucide-react';
import { StorageService } from '@/lib/services/storage';
import { buildAutoTitleFromContent } from '@/constants/noteTitle';
import { useOverlay } from '@/components/ui/OverlayContext';
import { useToast } from '@/components/ui/Toast';
import { getNote, getNotePublicState, toggleNoteVisibility } from '@/lib/appwrite';
import { createNote, updateNote } from '@/lib/actions/client-ops';
import type { Notes } from '@/types/appwrite';
import DoodleCanvas from '@/components/DoodleCanvas';
import { useNotes } from '@/context/NotesContext';
import { useDataNexus } from '@/context/DataNexusContext';
import { ecosystemSecurity } from '@/lib/ecosystem/security';
import { useSudo } from '@/context/SudoContext';
import { useSection } from '@/context/SectionContext';

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
  onClose?: () => void;
  isExpanded?: boolean;
  onToggleExpand?: () => void;
}

const normalizeTags = (tags: string[] = []) => Array.from(new Set(tags.map((tag) => tag.trim()).filter(Boolean)));

export default function CreateNoteForm({
  onNoteCreated,
  initialContent,
  initialFormat = 'text',
  noteKind = 'note',
  noteId,
  onClose,
  isExpanded: controlledIsExpanded,
  onToggleExpand,
}: CreateNoteFormProps) {
  const { setActiveDetail } = useSection();
  const { closeOverlay } = useOverlay();
  const { showSuccess, showError } = useToast();
  const { notes: allNotes, upsertNote } = useNotes();
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
  const [isTagDropdownOpen, setIsTagDropdownOpen] = useState(false);
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
  const isPastedRef = useRef(false);
  const pasteTimerRef = useRef<NodeJS.Timeout | null>(null);

  const [isRecording, setIsRecording] = useState(false);
  const [recordingDuration, setRecordingDuration] = useState(0);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const audioChunksRef = useRef<Blob[]>([]);
  const recordingTimerRef = useRef<NodeJS.Timeout | null>(null);
  const durationIntervalRef = useRef<NodeJS.Timeout | null>(null);

  const [isMobile, setIsMobile] = useState(false);
  const [localIsExpanded, setLocalIsExpanded] = useState(true);
  const isExpanded = controlledIsExpanded !== undefined ? controlledIsExpanded : localIsExpanded;
  const toggleExpand = onToggleExpand || (() => setLocalIsExpanded(prev => !prev));

  useEffect(() => {
    const checkMobile = () => {
      const mobile = window.innerWidth < 768;
      setIsMobile(mobile);
      if (controlledIsExpanded === undefined) {
        setLocalIsExpanded(!mobile);
      }
    };
    checkMobile();
    window.addEventListener('resize', checkMobile);
    return () => window.removeEventListener('resize', checkMobile);
  }, [controlledIsExpanded]);

  useEffect(() => {
    return () => {
      if (recordingTimerRef.current) clearTimeout(recordingTimerRef.current);
      if (durationIntervalRef.current) clearInterval(durationIntervalRef.current);
    };
  }, []);

  const toggleRecording = async () => {
    if (isRecording) {
      if (mediaRecorderRef.current && mediaRecorderRef.current.state !== 'inactive') {
        mediaRecorderRef.current.stop();
      }
      setIsRecording(false);
    } else {
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
            setIsSaving(true);
            const uploaded = await StorageService.uploadFile(audioFile, 'voice');
            insertTextAtCursor(` [voice:${uploaded.$id}] `);
            showSuccess('Voice note recorded', 'Inserted into your note content.');
          } catch (error) {
            console.error('Failed to upload voice note:', error);
            showError('Recording failed', 'Could not save voice note.');
          } finally {
            setIsSaving(false);
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
        }, 120000); // 120 seconds limit (2 minutes)

      } catch (err) {
        console.error("Failed to start recording:", err);
        showError('Permission denied', 'Microphone access is required to record voice notes.');
      }
    }
  };

  const insertTextAtCursor = (text: string) => {
    const textarea = contentRef.current;
    if (textarea) {
      const start = textarea.selectionStart;
      const end = textarea.selectionEnd;
      const nextContent = content.substring(0, start) + text + content.substring(end);
      setContent(nextContent);
      setTimeout(() => {
        textarea.focus();
        textarea.setSelectionRange(start + text.length, start + text.length);
      }, 50);
    } else {
      setContent(prev => prev + text);
    }
  };

  // Load draft on mount
  useEffect(() => {
    if (typeof window === 'undefined' || noteId) {
      setIsHydrated(true);
      return;
    }
    const raw = localStorage.getItem('kylrix:draft:note');
    if (raw) {
      try {
        const draft = JSON.parse(raw);
        if (draft.title) setTitle(draft.title);
        if (draft.content) setContent(draft.content);
        if (draft.tags) setTags(draft.tags);
        if (draft.format) setFormat(draft.format);
        if (draft.format === 'doodle') setShowDoodleEditor(true);
        setIsTitleManuallyEdited(draft.isTitleManuallyEdited || false);
      } catch (e) {
        console.error('Failed to parse draft', e);
      }
    }
    setIsHydrated(true);
  }, [noteId]);

  // Save draft on change
  useEffect(() => {
    if (typeof window === 'undefined' || !isHydrated || resolvedNoteId || noteId) return;
    const draft = {
      title,
      content,
      tags,
      format,
      isTitleManuallyEdited
    };
    if (title.trim() || content.trim() || tags.length > 0) {
      localStorage.setItem('kylrix:draft:note', JSON.stringify(draft));
    } else {
      localStorage.removeItem('kylrix:draft:note');
    }
  }, [title, content, tags, format, isTitleManuallyEdited, resolvedNoteId, noteId, isHydrated]);

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
      (note.tags || []).forEach((tag: string) => {
        const cleaned = tag.trim();
        if (cleaned) tagSet.add(cleaned);
      });
    });
    return Array.from(tagSet);
  }, [allNotes]);

  const filteredExistingTags = useMemo(() => {
    const available = existingTags.filter((t) => !tags.includes(t));
    if (!currentTag.trim()) return available;
    const query = currentTag.toLowerCase().trim();
    return available.filter((t) => t.toLowerCase().includes(query));
  }, [existingTags, tags, currentTag]);

  const snapshot = useMemo(() => JSON.stringify({
    title: title.trim(),
    content: content.trim(),
    format,
    tags: normalizeTags(tags),
    composerKind,
    isPublic,
    hasPaywall,
    paywallAmount: typeof paywallAmount === 'number' ? paywallAmount : parseFloat(paywallAmount as any) || 0,
    resolvedNoteId: resolvedNoteId || null,
  }), [title, content, format, tags, composerKind, isPublic, hasPaywall, paywallAmount, resolvedNoteId]);

  const isDirty = snapshot !== lastSavedSnapshot;

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
          isPublic: cachedPublic,
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
          isPublic: loadedPublic,
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

  const syncNoteInMemory = useCallback((nextTitle: string, nextContent: string, nextTags: string[], nextFormat: 'text' | 'doodle') => {
    if (!resolvedNoteId) return;
    const existing = (allNotes || []).find(n => n.$id === resolvedNoteId);
    if (existing) {
      upsertNote({
        ...existing,
        title: nextTitle.trim(),
        content: nextContent.trim(),
        tags: nextTags,
        format: nextFormat,
      });
    }
  }, [resolvedNoteId, allNotes, upsertNote]);

  // Instant in-memory sync to note card while typing
  useEffect(() => {
    if (!resolvedNoteId) return;
    
    const existing = (allNotes || []).find(n => n.$id === resolvedNoteId);
    if (!existing) return;
    
    const hasDiff = existing.title !== title.trim() ||
                    existing.content !== content.trim() ||
                    existing.format !== format ||
                    JSON.stringify(existing.tags) !== JSON.stringify(tags);
                    
    if (hasDiff) {
      syncNoteInMemory(title, content, tags, format);
    }
  }, [resolvedNoteId, title, content, format, tags, allNotes, syncNoteInMemory]);

  const appendTag = useCallback((tag: string) => {
    const next = tag.trim();
    if (!next) return;
    const existingMatch = existingTags.find(
      (et) => et.toLowerCase() === next.toLowerCase()
    );
    const finalTag = existingMatch || next;
    setTags((prev) => normalizeTags([...prev, finalTag]));
    setCurrentTag('');
  }, [existingTags]);

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
            isPublic: persistedIsPublic,
            title: generatedTitle,
          })) as Notes;
          upsertNote(saved);
        } else {
          saved = (await createNote({
            ...payload,
            isPublic: false,
            title: generatedTitle,
          })) as Notes;
          setResolvedNoteId(saved.$id);
          if (typeof window !== 'undefined') {
            localStorage.removeItem('kylrix:draft:note');
          }
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

  const handleMorphToDetail = useCallback(async () => {
    try {
      const saved = await persist(false);
      if (saved && saved.$id) {
        setActiveDetail({ type: 'note', id: saved.$id });
      }
      if (onClose) {
        onClose();
      } else {
        closeOverlay();
      }
    } catch (err) {
      console.error('Failed to morph note to detail', err);
    }
  }, [persist, setActiveDetail, closeOverlay, onClose]);

  const handleClose = useCallback(async () => {
    const shouldPersist = Boolean((resolvedNoteId && isDirty) || (!resolvedNoteId && (title.trim() || content.trim())));
    if (shouldPersist) {
      try {
        await persist(false);
      } catch {
        return;
      }
    }
    if (onClose) {
      onClose();
    } else {
      closeOverlay();
    }
  }, [closeOverlay, content, isDirty, onClose, persist, resolvedNoteId, title]);

  const handlePaste = useCallback(() => {
    isPastedRef.current = true;
    if (pasteTimerRef.current) clearTimeout(pasteTimerRef.current);
    pasteTimerRef.current = setTimeout(() => {
      isPastedRef.current = false;
    }, 2000); // 2s protection window for formatting after paste
  }, []);

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

      <div
        onContextMenu={(event) => event.preventDefault()}
        className="w-full h-full min-h-0 flex flex-col bg-[#161412] text-white"
      >
        {/* Header */}
        <div className="px-2 py-1.5 flex items-center justify-between border-b border-white/5 sticky top-0 z-20 backdrop-blur-md bg-[#161412]/95 shrink-0">
          <div className="flex items-center gap-1.5 min-w-0">
            <div className="w-7 h-7 rounded-lg flex items-center justify-center bg-pink-500/10 border border-pink-500/20 text-pink-500 shrink-0 animate-in fade-in zoom-in-90 duration-200">
              {format === 'doodle' ? <PenTool className="w-3.5 h-3.5 animate-in fade-in duration-200" /> : <FileText className="w-3.5 h-3.5 animate-in fade-in duration-200" />}
            </div>
            <div className="min-w-0 flex flex-col">
              <span className="font-extrabold text-sm font-mono tracking-tight text-white leading-tight">
                {resolvedNoteId 
                  ? (composerKind === 'project' ? 'Edit Project' : 'Edit Note') 
                  : (composerKind === 'project' ? 'New Project' : 'New Note')
                }
              </span>
              <div className="flex items-center gap-1.5 mt-0.5 select-none">
                <span className={`w-1.5 h-1.5 rounded-full ${
                  (!isDirty && !isSaving) 
                    ? 'bg-emerald-500 shadow-[0_0_8px_rgba(16,185,129,0.5)]' 
                    : 'bg-white/20'
                }`} />
                <span className={`text-xs font-mono font-bold uppercase tracking-wider ${
                  (!isDirty && !isSaving) 
                    ? 'text-emerald-400 font-extrabold' 
                    : 'text-white/40'
                }`}>
                  Autosave
                </span>
              </div>
            </div>
          </div>

          <div className="flex items-center gap-1.5 shrink-0">
            {/* Format toggle: Text vs Doodle */}
            <div className="flex items-center bg-black/40 border border-white/5 rounded-xl p-0.5 mr-1 text-xs font-mono shrink-0">
              <button
                type="button"
                onClick={() => {
                  setFormat('text');
                  setShowDoodleEditor(false);
                }}
                className={`px-2 py-0.5 rounded-lg transition-colors font-bold ${format === 'text' ? 'bg-pink-500/20 text-pink-400 font-extrabold' : 'text-white/50 hover:text-white'}`}
              >
                Text
              </button>
              <button
                type="button"
                onClick={() => {
                  setFormat('doodle');
                  setShowDoodleEditor(true);
                }}
                className={`px-2 py-0.5 rounded-lg transition-colors font-bold ${format === 'doodle' ? 'bg-pink-500/20 text-pink-400 font-extrabold' : 'text-white/50 hover:text-white'}`}
              >
                Doodle
              </button>
            </div>

            {(content.trim().length > 0 || title.trim().length > 0) && (
              <button 
                type="button"
                onClick={handleMorphToDetail} 
                className="p-1.5 rounded-lg text-amber-500 hover:text-white hover:bg-white/5 border border-transparent hover:border-white/5 transition-all shrink-0"
                title="Go Full Detail"
              >
                <ArrowUpRight className="w-3.5 h-3.5" />
              </button>
            )}

            {isMobile && (
              <button 
                type="button"
                onClick={toggleExpand} 
                className="p-1.5 rounded-lg text-white/60 hover:text-white hover:bg-white/5 border border-transparent hover:border-white/5 transition-all shrink-0"
              >
                {isExpanded ? <ChevronDown className="w-3.5 h-3.5" /> : <ChevronUp className="w-3.5 h-3.5" />}
              </button>
            )}

            <button 
              type="button"
              onClick={handleClose} 
              className="p-1.5 rounded-lg text-[#10B981] hover:bg-[#10B981]/10 border border-transparent hover:border-[#10B981]/10 transition-all font-bold shrink-0"
              title="Save and Close"
            >
              <Check className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>

        {/* Content Body */}
        <div className="flex-1 overflow-y-auto p-2 flex flex-col gap-2 min-h-0 scrollbar-thin">
          {(content.trim().length >= 5 || isTitleManuallyEdited) && (
            <input
              type="text"
              value={title}
              onChange={(event) => {
                const val = event.target.value;
                setTitle(val);
                setIsTitleManuallyEdited(true);
                syncNoteInMemory(val, content, tags, format);
              }}
              placeholder="Title"
              className="w-full bg-white/[0.02] text-white placeholder-white/20 border border-white/5 focus:border-pink-500/30 rounded-xl px-3 py-2 text-xl font-black focus:outline-none transition-all font-space-grotesk shrink-0"
            />
          )}

          {format === 'text' ? (
            <textarea
              ref={contentRef}
              rows={isExpanded ? 12 : 6}
              value={content}
              onPaste={handlePaste}
              onChange={(event) => {
                const val = event.target.value;
                setContent(val);
                syncNoteInMemory(title, val, tags, format);
              }}
              onKeyDown={(event) => {
                // High-speed capture protocol: Enter in 60% state triggers save & exit
                // Protection: Do not exit if user just pasted content (formatting window)
                if (event.key === 'Enter' && !event.shiftKey && !isExpanded && !isPastedRef.current) {
                  event.preventDefault();
                  handleClose();
                }
              }}
              placeholder="Write your note..."
              className="w-full flex-1 min-h-[160px] resize-none bg-white/[0.03] text-white placeholder-white/20 border border-white/[0.06] hover:border-white/10 focus:border-pink-500/30 rounded-xl px-3 py-2 text-lg focus:outline-none transition-all scrollbar-thin"
            />
          ) : (
            <div className="p-3.5 rounded-xl border border-white/10 bg-white/[0.03] flex flex-col gap-3.5">
              {content ? (
                <div className="min-h-[100px] max-h-[240px] overflow-y-auto whitespace-pre-wrap font-sans text-white/80 text-sm leading-relaxed border-b border-white/5 pb-3 scrollbar-thin">
                  <div className="flex items-center gap-2 text-pink-400 font-mono text-xs mb-2">
                    <PenTool className="w-4 h-4" />
                    <span>Doodle Sketch Saved</span>
                  </div>
                  <p className="text-white/40 text-xs italic">Open the drawing canvas to view or edit the full sketch.</p>
                </div>
              ) : (
                <p className="text-sm text-white/40 italic min-h-[100px] flex items-center justify-center border-b border-white/5 pb-3">
                  No sketch created yet. Open the canvas to start drawing.
                </p>
              )}
              <div className="flex gap-2.5 flex-wrap">
                <button
                  type="button"
                  onClick={() => {
                    setShowDoodleEditor(true);
                    setFormat('doodle');
                  }}
                  className="px-3.5 py-2 rounded-xl bg-pink-500 hover:bg-pink-600 text-black font-extrabold text-xs font-mono transition shadow-[0_4px_14px_rgba(236,72,153,0.2)]"
                >
                  {content ? 'Edit sketch' : 'Create sketch'}
                </button>
                <button
                  type="button"
                  onClick={() => setFormat('text')}
                  className="px-3.5 py-2 rounded-xl border border-white/10 text-white/70 hover:text-white hover:bg-white/5 font-extrabold text-xs font-mono transition"
                >
                  Switch to text
                </button>
              </div>
            </div>
          )}

          <div className="text-[10px] text-white/30 font-mono select-none mt-auto pt-1">
            Right click is handled here so copy, cut, paste, and shortcuts stay local.
          </div>
        </div>

        {/* Bottom Toolbar */}
        <div className="px-2.5 py-1.5 border-t border-white/5 bg-[#161412] flex flex-col gap-1.5 shrink-0">
          {/* Tags section */}
          <div className="flex flex-col gap-1">
            <div className="flex items-center gap-1.5">
              <Tag className="w-3.5 h-3.5 text-white/40" />
              <span className="text-xs font-mono text-white/40 uppercase tracking-wider">Tags</span>
            </div>
            
            <div className="flex flex-wrap gap-1.5 items-center">
              {tags.map((tag) => (
                <span
                  key={tag}
                  className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-pink-500/10 border border-pink-500/20 text-pink-400 font-mono text-xs animate-in zoom-in-95 duration-150"
                >
                  <span>{tag}</span>
                  <button
                    type="button"
                    onClick={() => removeTag(tag)}
                    className="hover:text-red-400 transition-colors"
                  >
                    <X className="w-2.5 h-2.5" />
                  </button>
                </span>
              ))}
              
              {/* Mini Tag Input */}
              <div className="relative flex items-center">
                <input
                  type="text"
                  value={currentTag}
                  onChange={(e) => {
                    setCurrentTag(e.target.value);
                    setIsTagDropdownOpen(true);
                  }}
                  onFocus={() => setIsTagDropdownOpen(true)}
                  onKeyDown={handleTagKeyDown}
                  placeholder="Add tag..."
                  className="bg-black/30 border border-white/5 focus:border-pink-500/30 rounded-lg px-2.5 py-1 text-xs font-mono text-white placeholder-white/20 focus:outline-none transition-all w-32"
                />
                {currentTag.trim() && (
                  <button
                    type="button"
                    onClick={() => appendTag(currentTag)}
                    className="absolute right-2 p-0.5 text-pink-400 hover:text-white rounded"
                  >
                    <Plus className="w-3.5 h-3.5" />
                  </button>
                )}

                {/* Pop up tags list (Search + Scroll dropdown) */}
                {isTagDropdownOpen && (
                  <>
                    <div 
                      className="fixed inset-0 z-40" 
                      onClick={() => setIsTagDropdownOpen(false)}
                    />
                    <div className="absolute bottom-full mb-2 left-0 w-48 max-h-48 overflow-y-auto bg-[#0F0D0C] border border-white/10 rounded-xl shadow-2xl p-1 z-50 flex flex-col gap-0.5 scrollbar-thin animate-in fade-in slide-in-from-bottom-2 duration-150">
                      <div className="px-2 py-1 text-[10px] font-mono text-white/40 border-b border-white/5 uppercase tracking-wider mb-1">
                        Select Existing Tag
                      </div>
                      {filteredExistingTags.length > 0 ? (
                        filteredExistingTags.map((t) => (
                          <button
                            key={t}
                            type="button"
                            onClick={() => {
                              appendTag(t);
                              setIsTagDropdownOpen(false);
                            }}
                            className="w-full text-left px-2 py-1 rounded-lg hover:bg-pink-500/10 hover:text-pink-400 text-white/80 font-mono text-xs transition-colors flex items-center justify-between"
                          >
                            <span>{t}</span>
                            <Plus className="w-2.5 h-2.5 opacity-40" />
                          </button>
                        ))
                      ) : (
                        <div className="px-2 py-1.5 text-xs font-mono text-white/30 italic">
                          No matching tags
                        </div>
                      )}
                    </div>
                  </>
                )}
              </div>
            </div>
          </div>

          {/* Visibility and Voice controls */}
          <div className="flex items-center justify-between border-t border-white/5 pt-2">
            {/* Public vs Private toggle */}
            <div className="flex items-center gap-1 bg-black/40 border border-white/5 rounded-xl p-0.5 text-xs font-mono">
              <button
                type="button"
                onClick={async () => {
                  setIsPublic(false);
                }}
                className={`flex items-center gap-1 px-2 py-1 rounded-lg transition-colors font-bold ${!isPublic ? 'bg-white/10 text-white font-extrabold' : 'text-white/40 hover:text-white'}`}
              >
                <Lock className="w-2.5 h-2.5" />
                <span>Private</span>
              </button>
              <button
                type="button"
                onClick={async () => {
                  if (!ecosystemSecurity.status.isUnlocked) {
                    const unlocked = await promptSudo();
                    if (!unlocked) {
                      showError('Vault Locked', 'Unlock MasterPass before enabling public sharing.');
                      return;
                    }
                  }
                  setIsPublic(true);
                }}
                className={`flex items-center gap-1 px-2 py-1 rounded-lg transition-colors font-bold ${isPublic ? 'bg-pink-500/20 text-pink-400 font-extrabold' : 'text-white/40 hover:text-white'}`}
              >
                <Globe className="w-2.5 h-2.5" />
                <span>Public</span>
              </button>
            </div>

            {/* Voice Recorder & Info */}
            <div className="flex items-center gap-2">
              {format === 'text' && (
                <button
                  type="button"
                  onClick={toggleRecording}
                  className={`h-8 px-3 rounded-lg flex items-center justify-center gap-1.5 font-mono text-xs font-bold transition-all select-none border ${
                    isRecording 
                      ? 'bg-red-500/20 border-red-500/30 text-red-400 animate-pulse' 
                      : 'bg-black/40 border-white/5 text-white/60 hover:text-white hover:bg-white/5'
                  }`}
                  title={isRecording ? "Click to Stop & Insert" : "Record Voice Note"}
                >
                  {isRecording ? (
                    <>
                      <Square className="w-2.5 h-2.5 fill-current" />
                      <span>{Math.floor(recordingDuration / 60)}:{(recordingDuration % 60 < 10 ? '0' : '') + (recordingDuration % 60)}</span>
                    </>
                  ) : (
                    <>
                      <Mic className="w-3 h-3" />
                      <span>Record</span>
                    </>
                  )}
                </button>
              )}
            </div>
          </div>
        </div>
      </div>
    </>
  );
}
