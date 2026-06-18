"use client";

import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { 
  Check, 
  ArrowUpRight, 
  Mic, 
  Square, 
  FileText, 
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
import { getNote, getNotePublicState, toggleNoteVisibility, getAllTags } from '@/lib/appwrite';
import { createNote, updateNote } from '@/lib/actions/client-ops';
import type { Notes } from '@/types/appwrite';
import { useNotes } from '@/context/NotesContext';
import { useDataNexus } from '@/context/DataNexusContext';
import { ecosystemSecurity } from '@/lib/ecosystem/security';
import { useSudo } from '@/context/SudoContext';
import { useSection } from '@/context/SectionContext';

import { useRouter } from 'next/navigation';
import { useUnifiedDrawer } from '@/context/UnifiedDrawerContext';
import { useProUpgrade } from '@/context/ProUpgradeContext';
import { hasPaidKylrixPlan } from '@/lib/utils';
import { useAuth } from '@/lib/auth';

interface CreateNoteFormProps {
  onNoteCreated: (note: Notes) => void;
  initialContent?: {
    title?: string;
    content?: string;
    tags?: string[];
    isPublic?: boolean;
    isGuest?: boolean;
  };
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
  noteKind = 'note',
  noteId,
  onClose,
  isExpanded: controlledIsExpanded,
  onToggleExpand,
}: CreateNoteFormProps) {
  const { closeOverlay } = useOverlay();
  const { showSuccess, showError } = useToast();
  const { notes: allNotes, upsertNote } = useNotes();
  const { fetchOptimized, getCachedData, setCachedData } = useDataNexus();
  const { promptSudo } = useSudo();
  const { setActiveDetail } = useSection();
  const router = useRouter();
  const { open: openUnified } = useUnifiedDrawer();
  const { user } = useAuth();
  const { openProUpgrade } = useProUpgrade();
  const hasMasterKey = ecosystemSecurity.status.hasKey;

  const [title, setTitle] = useState(initialContent?.title || '');
  const [content, setContent] = useState(initialContent?.content || '');
  const [tags, setTags] = useState<string[]>(normalizeTags(initialContent?.tags || []));
  const [isPublic, setIsPublic] = useState(initialContent?.isPublic || false);
  const [isGuest, setIsGuest] = useState(initialContent?.isGuest || false);
  const [isTitleManuallyEdited, setIsTitleManuallyEdited] = useState(false);
  const [currentTag, setCurrentTag] = useState('');
  const [isTagDropdownOpen, setIsTagDropdownOpen] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [resolvedNoteId, setResolvedNoteId] = useState<string | undefined>(noteId);
  const [persistedIsPublic, setPersistedIsPublic] = useState(initialContent?.isPublic || false);
  const [persistedIsGuest, setPersistedIsGuest] = useState(initialContent?.isGuest || false);
  const [isHydrated, setIsHydrated] = useState(false);
  const [lastSavedSnapshot, setLastSavedSnapshot] = useState('');
  const [hasPaywall, setHasPaywall] = useState(false);
  const [paywallAmount, setPaywallAmount] = useState<number | ''>(0);
  const [composerKind, setComposerKind] = useState<'note' | 'project'>(noteKind);
  const { ecosystemTags, refreshEcosystemTags } = useTask();
  const contentRef = useRef<HTMLTextAreaElement | null>(null);

  useEffect(() => {
    void refreshEcosystemTags();
  }, [refreshEcosystemTags]);

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
      isTitleManuallyEdited
    };
    if (title.trim() || content.trim() || tags.length > 0) {
      localStorage.setItem('kylrix:draft:note', JSON.stringify(draft));
    } else {
      localStorage.removeItem('kylrix:draft:note');
    }
  }, [title, content, tags, isTitleManuallyEdited, resolvedNoteId, noteId, isHydrated]);

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
    const tagSet = new Set<string>(ecosystemTags.map(t => t.name).filter(Boolean) as string[]);
    (Array.isArray(allNotes) ? allNotes : []).forEach((note) => {
      (note.tags || []).forEach((tag: string) => {
        const cleaned = tag.trim();
        if (cleaned) tagSet.add(cleaned);
      });
    });
    return Array.from(tagSet);
  }, [allNotes, ecosystemTags]);

  const filteredExistingTags = useMemo(() => {
    const available = existingTags.filter((t) => !tags.includes(t));
    if (!currentTag.trim()) return available;
    const query = currentTag.toLowerCase().trim();
    return available.filter((t) => t.toLowerCase().includes(query));
  }, [existingTags, tags, currentTag]);

  const snapshot = useMemo(() => JSON.stringify({
    title: title.trim(),
    content: content.trim(),
    format: 'text',
    tags: normalizeTags(tags),
    composerKind,
    isPublic,
    isGuest,
    hasPaywall,
    paywallAmount: typeof paywallAmount === 'number' ? paywallAmount : parseFloat(paywallAmount as any) || 0,
    resolvedNoteId: resolvedNoteId || null,
  }), [title, content, tags, composerKind, isPublic, isGuest, hasPaywall, paywallAmount, resolvedNoteId]);

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
        setTags(normalizeTags(cached.tags || []));
        setComposerKind(nextComposerKind);
        const cachedPublic = getNotePublicState(cached as Notes);
        const cachedGuest = !!(cached as any).isGuest;
        setIsPublic(cachedPublic);
        setPersistedIsPublic(cachedPublic);
        setIsGuest(cachedGuest);
        setPersistedIsGuest(cachedGuest);
        const paywall = (cached as any).metadata?.paywall;
        setHasPaywall(!!paywall?.enabled);
        setPaywallAmount(paywall?.amount || 0);
        setLastSavedSnapshot(JSON.stringify({
          title: cached.title || '',
          content: cached.content || '',
          format: 'text',
          tags: normalizeTags(cached.tags || []),
          composerKind: nextComposerKind,
          isPublic: cachedPublic,
          isGuest: cachedGuest,
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
        setTags(normalizeTags(loaded.tags || []));
        setComposerKind(nextComposerKind);
        const loadedPublic = getNotePublicState(loaded as Notes);
        const loadedGuest = !!(loaded as any).isGuest;
        setIsPublic(loadedPublic);
        setPersistedIsPublic(loadedPublic);
        setIsGuest(loadedGuest);
        setPersistedIsGuest(loadedGuest);
        const paywall = (loaded as any).metadata?.paywall;
        setHasPaywall(!!paywall?.enabled);
        setPaywallAmount(paywall?.amount || 0);
        setLastSavedSnapshot(JSON.stringify({
          title: loaded.title || '',
          content: loaded.content || '',
          format: 'text',
          tags: normalizeTags(loaded.tags || []),
          composerKind: nextComposerKind,
          isPublic: loadedPublic,
          isGuest: loadedGuest,
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
  }, [fetchOptimized, getCachedData, noteId, noteKind]);

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

  const syncNoteInMemory = useCallback((nextTitle: string, nextContent: string, nextTags: string[]) => {
    if (!resolvedNoteId) return;
    const existing = (allNotes || []).find(n => n.$id === resolvedNoteId);
    if (existing) {
      upsertNote({
        ...existing,
        title: nextTitle.trim(),
        content: nextContent.trim(),
        tags: nextTags,
        format: 'text',
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
                    JSON.stringify(existing.tags) !== JSON.stringify(tags);
                    
    if (hasDiff) {
      syncNoteInMemory(title, content, tags);
    }
  }, [resolvedNoteId, title, content, tags, allNotes, syncNoteInMemory]);

  const appendTag = useCallback((tag: string) => {
    const next = tag.trim();
    if (!next) return;
    
    // Strict Case-Insensitive Integrity Check
    const alreadyExistsInNote = tags.some(t => t.toLowerCase() === next.toLowerCase());
    if (alreadyExistsInNote) {
        setCurrentTag('');
        return;
    }

    const existingMatch = existingTags.find(
      (et) => et.toLowerCase() === next.toLowerCase()
    );
    const finalTag = existingMatch || next;
    setTags((prev) => [...prev, finalTag]);
    setCurrentTag('');
  }, [existingTags, tags]);

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
        format: 'text' as const,
        tags: normalizedTags,
        kind: composerKind,
        isPublic,
        isGuest,
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
          buildAutoTitleFromContent(payload.content) || (composerKind === 'project' ? 'Untitled Project' : 'Untitled Thought')
        );

        if (resolvedNoteId) {
          saved = (await updateNote(resolvedNoteId, {
            ...payload,
            isPublic: persistedIsPublic,
            isGuest: persistedIsGuest,
            title: generatedTitle,
          })) as Notes;
          upsertNote(saved);
        } else {
          saved = (await createNote({
            ...payload,
            isPublic: payload.isPublic,
            isGuest: payload.isGuest,
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
          const liveGuestState = !!(saved as any).isGuest;
          setPersistedIsPublic(livePublicState);
          setIsPublic(livePublicState);
          setPersistedIsGuest(liveGuestState);
          setIsGuest(liveGuestState);
          setCachedData(`note_${saved.$id}`, saved);
          const paywall = (saved as any).metadata?.paywall;
          setLastSavedSnapshot(JSON.stringify({
            title: saved.title || '',
            content: saved.content || '',
            format: 'text',
            tags: normalizeTags((saved.tags || []) as string[]),
            composerKind,
            isPublic: livePublicState,
            isGuest: liveGuestState,
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
  }, [composerKind, content, hasPaywall, isPublic, isGuest, persistedIsGuest, onNoteCreated, paywallAmount, persistedIsPublic, promptSudo, resolvedNoteId, setCachedData, showError, showSuccess, tags, title]);

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
      <div
        onContextMenu={(event) => event.preventDefault()}
        className="w-full h-full min-h-0 flex flex-col bg-[#161412] text-white"
      >
        {/* Header */}
        <div className="px-2 py-1.5 flex items-center justify-between border-b border-white/5 sticky top-0 z-20 backdrop-blur-md bg-[#161412]/95 shrink-0">
          <div className="flex items-center gap-1.5 min-w-0">
            <div className="w-7 h-7 rounded-lg flex items-center justify-center bg-pink-500/10 border border-pink-500/20 text-pink-500 shrink-0 animate-in fade-in zoom-in-90 duration-200">
              <FileText className="w-3.5 h-3.5 animate-in fade-in duration-200" />
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
                syncNoteInMemory(val, content, tags);
              }}
              placeholder="Title"
              className="w-full bg-white/[0.02] text-white placeholder-white/20 border border-white/5 focus:border-pink-500/30 rounded-xl px-3 py-2 text-xl font-black focus:outline-none transition-all font-space-grotesk shrink-0"
            />
          )}

          <textarea
            ref={contentRef}
            rows={isExpanded ? 12 : 6}
            value={content}
            onPaste={handlePaste}
            onChange={(event) => {
              const val = event.target.value;
              setContent(val);
              syncNoteInMemory(title, val, tags);
            }}
            onKeyDown={(event) => {
              if (event.key === 'Enter' && !event.shiftKey && !isExpanded && !isPastedRef.current) {
                event.preventDefault();
                handleClose();
              }
            }}
            placeholder="Write your note..."
            className="w-full flex-1 min-h-[160px] resize-none bg-white/[0.03] text-white placeholder-white/20 border border-white/[0.06] hover:border-white/10 focus:border-pink-500/30 rounded-xl px-3 py-2 text-lg focus:outline-none transition-all scrollbar-thin"
          />

          <div className="text-[10px] text-white/30 font-mono select-none mt-auto pt-1">
            Right click is handled here so copy, cut, paste, and shortcuts stay local.
          </div>
        </div>

        {/* Bottom Toolbar */}
        <div className="px-2.5 py-1.5 border-t border-white/5 bg-[#161412] flex flex-col gap-1.5 shrink-0">
          {/* Tags section */}
          <div className="flex flex-col gap-2">
            <div 
              className="flex items-center gap-1.5 cursor-pointer hover:opacity-80 active:opacity-60 transition-opacity w-fit"
              onClick={() => {
                if (onClose) onClose();
                closeOverlay();
                router.push('/tags');
              }}
            >
              <Tag className="w-3.5 h-3.5 text-white/40" />
              <span className="text-[10px] font-mono font-bold text-white/40 uppercase tracking-wider">Tags</span>
            </div>
            
            <div className="flex flex-wrap gap-1.5 items-center">
              {tags.map((tagName) => {
                const tag = (ecosystemTags as any[]).find(t => t.name === tagName);
                const color = tag?.color || '#6366F1';
                return (
                  <span
                    key={tagName}
                    onClick={() => removeTag(tagName)}
                    className="inline-flex items-center gap-1.5 px-2.5 py-1 bg-[#1C1A18] text-[10px] font-extrabold font-mono rounded-lg border cursor-pointer hover:bg-[#2C2A28] transition-colors animate-in zoom-in-95 duration-150"
                    style={{ color: color, borderColor: `${color}40` }}
                  >
                    {tagName.toUpperCase()}
                    <X className="w-2.5 h-2.5" />
                  </span>
                );
              })}
            </div>
            
            <button
              type="button"
              onClick={() => {
                openUnified('tag-selector', {
                  selectedTags: tags,
                  onSelect: (tagName: string) => {
                    appendTag(tagName);
                  }
                });
              }}
              className="w-full flex items-center justify-between bg-[#0A0908] border border-white/5 rounded-xl px-3 py-2 text-[10px] font-bold text-white/40 uppercase tracking-wider hover:border-pink-500/30 hover:text-pink-400 transition-all cursor-pointer"
            >
              <span>{tags.length > 0 ? 'Add more tags...' : 'Add tags to this note...'}</span>
              <ArrowUpRight size={14} className="opacity-40" />
            </button>
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
            </div>
          </div>
        </div>
      </div>
  );
}
