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
  Plus,
  Clipboard,
  CheckSquare,
  Copy,
  Paperclip,
  Link as LinkIcon,
} from 'lucide-react';
import { Drawer, Box, Typography } from '@/lib/openbricks/primitives';
import { StorageService } from '@/lib/services/storage';
import { buildAutoTitleFromContent, resolveNoteCardTitle } from '@/constants/noteTitle';
import { useOverlay } from '@/components/ui/OverlayContext';
import { useToast } from '@/components/ui/Toast';
import { getNote, getNotePublicState, toggleNoteVisibility, getAllTags } from '@/lib/appwrite';
import { createNote, updateNote, attachObject } from '@/lib/actions/client-ops';
import type { Notes } from '@/types/appwrite';
import { APPWRITE_CONFIG } from '@/lib/appwrite/config';
import { serializeObjectBlock, parseObjectBlocks } from '@/lib/note-object-secondary';
import type { ParsedObjectBlock } from '@/lib/note-object-secondary';
import { useNotes } from '@/context/NotesContext';
import { useDataNexus } from '@/context/DataNexusContext';
import { ecosystemSecurity } from '@/lib/ecosystem/security';
import { useSudo } from '@/context/SudoContext';
import { useSection } from '@/context/SectionContext';
import { useTask } from '@/context/TaskContext';
import ProjectAddObjectModal from '@/components/projects/ProjectAddObjectModal';

import { useRouter } from 'next/navigation';
import { useUnifiedDrawer } from '@/context/UnifiedDrawerContext';
import { useProUpgrade } from '@/context/ProUpgradeContext';
import { hasPaidKylrixPlan } from '@/lib/utils';
import { useAuth } from '@/lib/auth';
import { useAutosave } from '@/hooks/useAutosave';

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

function isLiveDraftNoteId(noteId?: string | null): boolean {
  return Boolean(noteId?.startsWith('live-'));
}

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
  const { notes: allNotes, pushLiveNote, removeNote, registerComposeSession, unregisterComposeSession } = useNotes();
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
  const [isArticle, setIsArticle] = useState(false);
  const [isContextDrawerOpen, setIsContextDrawerOpen] = useState(false);
  const [isTitleManuallyEdited, setIsTitleManuallyEdited] = useState(false);
  const [currentTag, setCurrentTag] = useState('');
  const [isTagDropdownOpen, setIsTagDropdownOpen] = useState(false);
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
  const hasAnnouncedDraftRef = useRef(false);
  const liveDraftIdRef = useRef<string | undefined>(noteId);
  const allNotesRef = useRef<Notes[]>([]);
  const hasAnnouncedCreateRef = useRef(false);
  const isPastedRef = useRef(false);
  const pasteTimerRef = useRef<NodeJS.Timeout | null>(null);
  const pushLiveNoteTimerRef = useRef<NodeJS.Timeout | null>(null);

  const [isRecording, setIsRecording] = useState(false);
  const [isUploadingVoice, setIsUploadingVoice] = useState(false);
  const [recordingDuration, setRecordingDuration] = useState(0);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const audioChunksRef = useRef<Blob[]>([]);
  const recordingTimerRef = useRef<NodeJS.Timeout | null>(null);
  const durationIntervalRef = useRef<NodeJS.Timeout | null>(null);

  const [isMobile, setIsMobile] = useState(false);
  const [localIsExpanded, setLocalIsExpanded] = useState(true);
  const isExpanded = controlledIsExpanded !== undefined ? controlledIsExpanded : localIsExpanded;
  const toggleExpand = onToggleExpand || (() => setLocalIsExpanded(prev => !prev));
  const [isAttachDrawerOpen, setIsAttachDrawerOpen] = useState(false);
  const [isAttachingFile, setIsAttachingFile] = useState(false);
  const [isCheckingUrl, setIsCheckingUrl] = useState(false);
  const [pendingBlockDelete, setPendingBlockDelete] = useState<ParsedObjectBlock | null>(null);
  const fileUploadRef = useRef<HTMLInputElement | null>(null);

  const ensureLiveDraftId = useCallback(() => {
    const existingId = resolvedNoteId || liveDraftIdRef.current;
    if (existingId) return existingId;
    const noteId = `live-${crypto.randomUUID()}`;
    liveDraftIdRef.current = noteId;
    registerComposeSession(noteId);
    setResolvedNoteId(noteId);
    return noteId;
  }, [registerComposeSession, resolvedNoteId]);

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
            setIsUploadingVoice(true);
            const uploaded = await StorageService.uploadFile(audioFile, 'voice');
            insertTextAtCursor(` [voice:${uploaded.$id}] `);
            showSuccess('Voice note recorded', 'Inserted into your note content.');
          } catch (error) {
            console.error('Failed to upload voice note:', error);
            showError('Recording failed', 'Could not save voice note.');
          } finally {
            setIsUploadingVoice(false);
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
  };

  // Insert [[kylrix-object:...]] block into textarea at cursor with surrounding blank lines
  const insertObjectBlock = useCallback((block: string) => {
    const textarea = contentRef.current;
    const start = textarea ? textarea.selectionStart : content.length;
    const end = textarea ? textarea.selectionEnd : content.length;
    const needsLeadingBreak = start > 0 && !content.slice(Math.max(0, start - 2), start).includes('\n\n');
    const needsTrailingBreak = end < content.length && !content.slice(end, Math.min(content.length, end + 2)).includes('\n\n');
    const insertion = `${needsLeadingBreak ? '\n\n' : ''}${block}${needsTrailingBreak ? '\n\n' : '\n'}`;
    const next = content.substring(0, start) + insertion + content.substring(end);
    setContent(next);
    if (textarea) {
      setTimeout(() => {
        textarea.focus();
        const cursor = start + insertion.length;
        textarea.setSelectionRange(cursor, cursor);
      }, 50);
    }
  }, [content]);

  // Upload file → objects table → insert block
  const onPickFile = useCallback(async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    e.target.value = '';
    const noteId = ensureLiveDraftId();
    if (!noteId) return;
    setIsAttachingFile(true);
    try {
      const bucketId = APPWRITE_CONFIG.BUCKETS.GENERAL_STORAGE;
      const uploaded = await StorageService.uploadFile(file, bucketId);
      const childKind = file.type.startsWith('image/') ? 'image' : 'file';
      const relation = await attachObject({
        parentId: noteId,
        parentKind: 'note',
        childId: uploaded.$id,
        childKind,
        metadata: { bucketId, fileName: file.name, mimeType: file.type, size: file.size },
      });
      insertObjectBlock(serializeObjectBlock({
        objectId: relation?.$id,
        childId: uploaded.$id,
        childKind,
        bucketId,
        label: file.name,
        appTheme: 'idea',
      }));
      showSuccess('File attached', file.name);
    } catch (err: any) {
      showError('Attach failed', err?.message || 'Could not upload file.');
    } finally {
      setIsAttachingFile(false);
    }
  }, [ensureLiveDraftId, insertObjectBlock, showSuccess, showError]);

  // Paste URL → HEAD-check → objects table → insert block
  const attachUrl = useCallback(async () => {
    const href = window.prompt('Paste a URL to attach:');
    if (!href || !href.trim()) return;
    const url = href.trim();
    const noteId = ensureLiveDraftId();
    if (!noteId) return;
    setIsCheckingUrl(true);
    try {
      // Best-effort HEAD check (may be blocked by CORS — still insert if it fails)
      let resolves = true;
      try {
        const res = await fetch(url, { method: 'HEAD', mode: 'no-cors' });
        resolves = res.type === 'opaque' || res.ok;
      } catch {
        resolves = false;
      }
      if (!resolves) {
        const proceed = window.confirm(`The URL could not be verified:\n${url}\n\nAttach anyway?`);
        if (!proceed) return;
      }
      await attachObject({
        parentId: noteId,
        parentKind: 'note',
        childId: url,
        childKind: 'link',
        metadata: { href: url },
      });
      insertObjectBlock(serializeObjectBlock({
        childId: url,
        childKind: 'link',
        href: url,
        label: url,
        appTheme: 'idea',
      }));
      showSuccess('Link attached');
    } catch (err: any) {
      showError('Attach failed', err?.message || 'Unable to attach link.');
    } finally {
      setIsCheckingUrl(false);
      setIsContextDrawerOpen(false);
    }
  }, [ensureLiveDraftId, insertObjectBlock, showSuccess, showError]);

  // Protected-block content change interceptor
  // When a keystroke or paste would mutate inside a [[kylrix-object:...]] block, intercept and show confirm.
  const handleContentChange = useCallback((nextValue: string) => {
    const blocks = parseObjectBlocks(content);
    const changed = blocks.find(b => {
      const prevBlock = content.slice(b.start, b.end);
      const nextBlock = nextValue.slice(b.start, b.start + prevBlock.length);
      return prevBlock !== nextBlock;
    });
    if (changed) {
      setPendingBlockDelete(changed);
      return; // Reject the mutation — show confirm drawer instead
    }
    setContent(nextValue);
  }, [content]);

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

  // Clear draft on unmount if the note has been saved
  useEffect(() => {
    return () => {
      if (resolvedNoteId && typeof window !== 'undefined') {
        localStorage.removeItem('kylrix:draft:note');
      }
    };
  }, [resolvedNoteId]);

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
        const cachedArticle = !!(cached as any).article;
        setIsPublic(cachedPublic);
        setPersistedIsPublic(cachedPublic);
        setIsGuest(cachedGuest);
        setPersistedIsGuest(cachedGuest);
        setIsArticle(cachedArticle);
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
          isArticle: cachedArticle,
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
        const loadedArticle = !!(loaded as any).article;
        setIsPublic(loadedPublic);
        setPersistedIsPublic(loadedPublic);
        setIsGuest(loadedGuest);
        setPersistedIsGuest(loadedGuest);
        setIsArticle(loadedArticle);
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
          isArticle: loadedArticle,
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
    allNotesRef.current = Array.isArray(allNotes) ? allNotes : [];
  }, [allNotes]);

  useEffect(() => {
    if (!isHydrated) return;
    const hasDraftContent = Boolean(title || content || tags.length);
    if (!hasDraftContent) return;
    if (resolvedNoteId || liveDraftIdRef.current) return;

    const noteId = `live-${crypto.randomUUID()}`;
    liveDraftIdRef.current = noteId;
    registerComposeSession(noteId);
    setResolvedNoteId(noteId);
  }, [title, content, tags, isHydrated, resolvedNoteId, registerComposeSession]);

  useEffect(() => {
    if (title || content || tags.length) return;
    hasAnnouncedDraftRef.current = false;
    hasAnnouncedCreateRef.current = false;

    const noteId = liveDraftIdRef.current;
    if (!noteId || !isLiveDraftNoteId(noteId)) return;

    removeNote(noteId);
    unregisterComposeSession(noteId);
    liveDraftIdRef.current = undefined;
    setResolvedNoteId(undefined);
    setLastSavedSnapshot('');
  }, [title, content, tags, removeNote, unregisterComposeSession]);

  const candidateNote = useMemo((): Notes | null => {
    const noteId = resolvedNoteId || liveDraftIdRef.current;
    if (!isHydrated || !noteId) return null;
    if (!title && !content && !tags.length) return null;

    const existing = allNotesRef.current.find((candidate) => candidate.$id === noteId);
    const normalizedTags = normalizeTags(tags);
    return {
      ...(existing || {
        $id: noteId,
        format: 'text',
        userId: user?.$id || '',
        isPublic,
        isGuest,
        $createdAt: new Date().toISOString(),
      } as Notes),
      $id: noteId,
      title: resolveNoteCardTitle(title, content),
      content,
      tags: normalizedTags,
      format: 'text',
      isPublic,
      isGuest,
    };
  }, [title, content, tags, resolvedNoteId, isHydrated, isPublic, isGuest, user?.$id]);

  const candidateNoteRef = useRef<Notes | null>(null);
  candidateNoteRef.current = candidateNote;

  // Mirror note detail: card always reflects editor keystrokes; server save is separate.
  // Debounced to 80ms to batch rapid keystrokes into a single push, preventing
  // partial-content truncation from multiple concurrent writes to card state.
  useEffect(() => {
    if (!candidateNote?.$id) return;
    registerComposeSession(candidateNote.$id);

    if (pushLiveNoteTimerRef.current) clearTimeout(pushLiveNoteTimerRef.current);
    pushLiveNoteTimerRef.current = setTimeout(() => {
      const draftNote: Notes = {
        ...candidateNote,
        $updatedAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      };
      pushLiveNote(draftNote);
      setCachedData(`note_${candidateNote.$id}`, draftNote);
    }, 80);

    return () => {
      if (pushLiveNoteTimerRef.current) clearTimeout(pushLiveNoteTimerRef.current);
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [candidateNote?.$id, candidateNote?.title, candidateNote?.content, candidateNote?.tags, candidateNote?.isPublic]);

  useEffect(() => {
    return () => {
      const noteId = liveDraftIdRef.current || resolvedNoteId;
      if (noteId) unregisterComposeSession(noteId);
    };
  }, [resolvedNoteId, unregisterComposeSession]);

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

  const applyPersistSnapshot = useCallback((saved: Notes, source: Notes) => {
    const livePublicState = getNotePublicState(saved);
    const liveGuestState = !!(saved as any).isGuest;
    setPersistedIsPublic(livePublicState);
    setIsPublic(livePublicState);
    setPersistedIsGuest(liveGuestState);
    setIsGuest(liveGuestState);
    const paywall = (() => {
      try { return JSON.parse(saved.metadata || '{}')?.paywall; } catch { return undefined; }
    })();
    setLastSavedSnapshot(JSON.stringify({
      title: (source.title || '').trim(),
      content: (source.content || '').trim(),
      format: 'text',
      tags: normalizeTags((source.tags || []) as string[]),
      composerKind,
      isPublic: livePublicState,
      isGuest: liveGuestState,
      hasPaywall: !!paywall?.enabled,
      paywallAmount: paywall?.amount || 0,
      resolvedNoteId: saved.$id,
    }));
  }, [composerKind]);

  const migrateDraftId = useCallback((savedId: string, ephemeralId: string | undefined) => {
    if (!ephemeralId || !isLiveDraftNoteId(ephemeralId) || ephemeralId === savedId) {
      if (savedId) registerComposeSession(savedId);
      liveDraftIdRef.current = savedId;
      setResolvedNoteId(savedId);
      return;
    }
    removeNote(ephemeralId);
    unregisterComposeSession(ephemeralId);
    registerComposeSession(savedId);
    liveDraftIdRef.current = savedId;
    setResolvedNoteId(savedId);
  }, [registerComposeSession, removeNote, unregisterComposeSession]);

  const saveComposerNote = useCallback(async (source: Notes): Promise<Notes> => {
    if (!source.$id) {
      throw new Error('Missing note id for save');
    }

    const normalizedTags = normalizeTags((source.tags || []) as string[]);
    const payload = {
      title: (source.title || '').trim(),
      content: source.content || '',
      format: 'text' as const,
      tags: normalizedTags,
      kind: composerKind,
      isPublic,
      isGuest,
      article: isArticle,
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

    const generatedTitle = payload.title || (
      buildAutoTitleFromContent(payload.content.trim()) || (composerKind === 'project' ? 'Untitled Project' : 'Untitled Thought')
    );

    if (!user?.$id) {
      const secret = localStorage.getItem('kylrix_ghost_secret_v2') || crypto.randomUUID();
      const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString();
      const deletionSecret = crypto.randomUUID();
      const { sha256HexUtf8 } = await import('@/lib/crypto/sha256-hex');
      const creatorDeletionProofHash = await sha256HexUtf8(deletionSecret);
      const { encryptGhostData } = await import('@/lib/encryption/ghost-crypto');
      const { encrypted: encTitle, key: noteKey } = await encryptGhostData(generatedTitle);
      const { encrypted: encContent } = await encryptGhostData(payload.content, noteKey);
      const id = source.$id.startsWith('live-') ? `ghost-${crypto.randomUUID()}` : source.$id;

      const saved = {
        $id: id,
        $createdAt: new Date().toISOString(),
        $updatedAt: new Date().toISOString(),
        title: generatedTitle,
        content: payload.content,
        format: 'text',
        tags: payload.tags,
        userId: 'ghost',
        isPublic: false,
        isGuest: false,
        metadata: JSON.stringify({
          isGhost: true,
          ghostSecret: secret,
          expiresAt,
          isEncrypted: true,
          creatorDeletionProofHash,
          send_object: { kind: 'note' },
        }),
      } as Notes;

      const historyRaw = localStorage.getItem('kylrix_ghost_notes_v2');
      let history = historyRaw ? JSON.parse(historyRaw) : [];
      if (!Array.isArray(history)) history = [];
      const existingIndex = history.findIndex((n: any) => n.id === id);
      const newRef = {
        id,
        title: encTitle,
        content: encContent,
        metadata: saved.metadata,
        createdAt: new Date().toISOString(),
        expiresAt,
        decryptionKey: noteKey,
        deletionSecret,
      };
      if (existingIndex !== -1) history[existingIndex] = newRef;
      else history.unshift(newRef);
      localStorage.setItem('kylrix_ghost_notes_v2', JSON.stringify(history));
      migrateDraftId(id, source.$id);
      if (!hasAnnouncedCreateRef.current) {
        hasAnnouncedCreateRef.current = true;
        onNoteCreated(saved);
      }
      applyPersistSnapshot(saved, source);
      return saved;
    }

    let saved: Notes;
    const shouldCreate = isLiveDraftNoteId(source.$id);

    if (!shouldCreate) {
      saved = (await updateNote(source.$id, {
        ...payload,
        isPublic: persistedIsPublic,
        isGuest: persistedIsGuest,
        title: generatedTitle,
      })) as Notes;
    } else {
      const ephemeralId = source.$id;
      saved = (await createNote({
        ...payload,
        isPublic: payload.isPublic,
        isGuest: payload.isGuest,
        title: generatedTitle,
      })) as Notes;
      migrateDraftId(saved.$id, ephemeralId);
      if (typeof window !== 'undefined') {
        localStorage.removeItem('kylrix:draft:note');
      }
      if (!hasAnnouncedCreateRef.current) {
        hasAnnouncedCreateRef.current = true;
        onNoteCreated(saved);
      }
    }

    if (isPublic !== persistedIsPublic) {
      try {
        saved = (await toggleNoteVisibility(saved.$id)) as Notes;
      } catch (error: any) {
        if (error?.message === 'VAULT_LOCKED') {
          const unlocked = await promptSudo();
          if (!unlocked) throw new Error('Vault unlock required to make this note public.');
          saved = (await toggleNoteVisibility(saved.$id)) as Notes;
        } else {
          throw error;
        }
      }
      showSuccess(
        getNotePublicState(saved) ? 'Idea is now Public' : 'Idea is now Private',
        getNotePublicState(saved)
          ? 'Encrypted sharing is enabled for this idea.'
          : 'This idea is now private.'
      );
    }

    applyPersistSnapshot(saved, source);
    return saved;
  }, [
    applyPersistSnapshot,
    composerKind,
    hasPaywall,
    isArticle,
    isGuest,
    isPublic,
    migrateDraftId,
    onNoteCreated,
    paywallAmount,
    persistedIsGuest,
    persistedIsPublic,
    promptSudo,
    showSuccess,
    user?.$id,
  ]);

  const { isSaving: isAutosaving, forceSave } = useAutosave(candidateNote, {
    enabled: Boolean(candidateNote?.$id) && isDirty,
    isDirty,
    debounceMs: 500,
    save: saveComposerNote,
    onSave: () => {
      if (!createdToastShown.current) {
        createdToastShown.current = true;
        showSuccess('Idea saved', 'Your idea has been saved.');
      }
    },
    onError: () => {
      showError('Could not save idea', 'Your changes are still on screen.');
    },
  });

  const persist = useCallback(async (showToast = true) => {
    if (!candidateNoteRef.current?.$id) return null;
    try {
      const saved = await saveComposerNote(candidateNoteRef.current);
      if (showToast && !createdToastShown.current) {
        createdToastShown.current = true;
        showSuccess('Idea saved', 'Your idea has been saved.');
      }
      return saved;
    } catch (error) {
      console.error('Failed to persist note:', error);
      if (showToast) {
        showError('Could not save idea', (error as Error)?.message || 'Please try again.');
      }
      throw error;
    }
  }, [saveComposerNote, showError, showSuccess]);

  useEffect(() => {
    return () => {
      if (!isDirty || !candidateNoteRef.current?.$id) return;
      void forceSave(candidateNoteRef.current);
    };
  }, [forceSave, isDirty]);

  const isSaving = isAutosaving || isUploadingVoice;

  const handleMorphToDetail = useCallback(() => {
    const noteId = resolvedNoteId || liveDraftIdRef.current;
    if (noteId) {
      setActiveDetail({ type: 'note', id: noteId });
    }
    if (candidateNoteRef.current) {
      void forceSave(candidateNoteRef.current);
    }
    if (onClose) {
      onClose();
    } else {
      closeOverlay();
    }
  }, [forceSave, setActiveDetail, closeOverlay, onClose, resolvedNoteId]);

  const handleClose = useCallback(() => {
    const hasAnyDraft = Boolean(title.trim() || content.trim() || tags.length);
    if (hasAnyDraft) {
      const noteId = ensureLiveDraftId();
      const finalDraft: Notes = {
        ...(candidateNoteRef.current || ({} as Notes)),
        $id: noteId,
        title: resolveNoteCardTitle(title, content),
        content,
        tags: normalizeTags(tags),
        format: 'text',
        isPublic,
        isGuest,
        $updatedAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      };
      pushLiveNote(finalDraft);
      setCachedData(`note_${noteId}`, finalDraft);
      if (!hasAnnouncedDraftRef.current) {
        hasAnnouncedDraftRef.current = true;
        onNoteCreated(finalDraft);
      }
      void forceSave(finalDraft);
    } else if (isDirty && candidateNoteRef.current?.$id) {
      void forceSave(candidateNoteRef.current);
    }
    if (typeof window !== 'undefined') {
      localStorage.removeItem('kylrix:draft:note');
    }
    if (onClose) {
      onClose();
    } else {
      closeOverlay();
    }
  }, [closeOverlay, content, ensureLiveDraftId, forceSave, isDirty, isGuest, isPublic, onClose, onNoteCreated, pushLiveNote, setCachedData, tags, title]);

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
                  ? (composerKind === 'project' ? 'Edit Project' : 'Edit Idea') 
                  : (composerKind === 'project' ? 'New Project' : 'New Idea')
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
                <span className="text-[10px] font-mono text-white/40 border-l border-white/10 pl-2">
                   {content.length}/{isArticle ? '655,300,000' : '65,535'}
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
              }}
              placeholder="Title"
              className="w-full bg-white/[0.02] text-white placeholder-white/20 border border-white/5 focus:border-pink-500/30 rounded-xl px-3 py-2 text-xl font-black focus:outline-none transition-all font-space-grotesk shrink-0"
            />
          )}

          <div
            onContextMenu={(event) => {
              event.preventDefault();
              event.stopPropagation();
              setIsContextDrawerOpen(true);
            }}
            className="w-full flex-1 flex flex-col"
          >
            <textarea
              ref={contentRef}
              rows={isExpanded ? 12 : 6}
              value={content}
              maxLength={isArticle ? 655300000 : 65535}
              onPaste={handlePaste}
              onChange={(event) => {
                handleContentChange(event.target.value);
              }}
              onKeyDown={(event) => {
                if (event.key === 'Enter' && !event.shiftKey && !isExpanded && !isPastedRef.current) {
                  event.preventDefault();
                  handleClose();
                }
              }}
              placeholder="Write your idea..."
              className="w-full h-full min-h-[160px] resize-none bg-white/[0.03] text-white placeholder-white/20 border border-white/[0.06] hover:border-white/10 focus:border-pink-500/30 rounded-xl px-3 py-2 text-lg focus:outline-none transition-all scrollbar-thin"
            />
          </div>

          <div className="text-[10px] text-white/30 font-mono select-none mt-auto pt-1">
            Right click is handled here so copy, cut, paste, and shortcuts stay local.
          </div>
        </div>

        {/* Bottom Toolbar */}
        <div className="px-2.5 py-1.5 border-t border-white/5 bg-[#161412] flex flex-col gap-2.5 shrink-0">
          {/* Visibility and Voice controls */}
          <div className="flex items-center justify-between pb-2 border-b border-white/5">
            {/* Public vs Private toggle */}
            <div className="flex items-center gap-1 bg-black/40 border border-white/5 rounded-xl p-0.5 text-xs font-mono">
              <button
                type="button"
                onClick={async () => {
                  setIsPublic(false);
                }}
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg transition-colors font-bold ${!isPublic ? 'bg-white/10 text-white font-extrabold' : 'text-white/40 hover:text-white'}`}
                title="Private"
              >
                <Lock className="w-5 h-5" />
                {!isMobile && <span>Private</span>}
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
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg transition-colors font-bold ${isPublic ? 'bg-pink-500/20 text-pink-400 font-extrabold' : 'text-white/40 hover:text-white'}`}
                title="Public"
              >
                <Globe className="w-5 h-5" />
                {!isMobile && <span>Public</span>}
              </button>
            </div>

            {/* Article Toggle */}
            <div className="flex items-center gap-1 bg-black/40 border border-white/5 rounded-xl p-0.5 text-xs font-mono">
              <button
                type="button"
                onClick={() => {
                  if (!hasPaidKylrixPlan(user)) {
                    openProUpgrade('Article Mode');
                    return;
                  }
                  setIsArticle(!isArticle);
                }}
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg transition-colors font-bold ${isArticle ? 'bg-[#6366F1]/20 text-[#6366F1] font-extrabold' : 'text-white/40 hover:text-white'}`}
                title="Article Toggle"
              >
                <FileText className="w-5 h-5" />
                {!isMobile && <span>Article</span>}
              </button>
            </div>

            {/* Voice Recorder & Info */}
            <div className="flex items-center gap-2">
              <button
                  type="button"
                  onClick={toggleRecording}
                  className={`h-9 px-3 rounded-lg flex items-center justify-center gap-1.5 font-mono text-xs font-bold transition-all select-none border ${
                    isRecording 
                      ? 'bg-red-500/20 border-red-500/30 text-red-400 animate-pulse' 
                      : 'bg-black/40 border-white/5 text-white/60 hover:text-white hover:bg-white/5'
                  }`}
                  title={isRecording ? "Click to Stop & Insert" : "Record Voice Idea"}
                >
                  {isRecording ? (
                    <>
                      <Square className="w-4 h-4 fill-current" />
                      <span>{Math.floor(recordingDuration / 60)}:{(recordingDuration % 60 < 10 ? '0' : '') + (recordingDuration % 60)}</span>
                    </>
                  ) : (
                    <>
                      <Mic className="w-5 h-5" />
                      {!isMobile && <span>Record</span>}
                    </>
                  )}
                </button>
            </div>
          </div>

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
              <span>{tags.length > 0 ? 'Add more tags...' : 'Add tags to this idea...'}</span>
              <ArrowUpRight size={14} className="opacity-40" />
            </button>
          </div>
        </div>

        {isContextDrawerOpen && (
          <Drawer
            anchor="bottom"
            open={isContextDrawerOpen}
            onClose={() => setIsContextDrawerOpen(false)}
            PaperProps={{
              sx: {
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
                  showSuccess('Copied', 'Entire idea content copied to clipboard.');
                  setIsContextDrawerOpen(false);
                }}
                className="w-full flex items-center gap-3 px-4 py-3 rounded-xl bg-white/[0.02] border border-white/5 text-sm font-bold text-white hover:bg-white/5 transition-all text-left cursor-pointer"
              >
                <Copy className="w-5 h-5 text-pink-500" />
                <span>Copy All Content</span>
              </button>

              <button
                type="button"
                onClick={() => {
                  setIsContextDrawerOpen(false);
                  setTimeout(() => {
                    const textarea = contentRef.current;
                    if (textarea) {
                      textarea.focus();
                      textarea.select();
                    }
                  }, 100);
                }}
                className="w-full flex items-center gap-3 px-4 py-3 rounded-xl bg-white/[0.02] border border-white/5 text-sm font-bold text-white hover:bg-white/5 transition-all text-left cursor-pointer"
              >
                <CheckSquare className="w-5 h-5 text-purple-500" />
                <span>Select All</span>
              </button>

              <button
                type="button"
                onClick={async () => {
                  setIsContextDrawerOpen(false);
                  try {
                    const text = await navigator.clipboard.readText();
                    const textarea = contentRef.current;
                    if (textarea) {
                      const start = textarea.selectionStart;
                      const end = textarea.selectionEnd;
                      if (start === 0 && end === textarea.value.length) {
                        setContent(text);
                      } else {
                        const nextContent = content.substring(0, start) + text + content.substring(end);
                        setContent(nextContent);
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

              <button
                type="button"
                onClick={() => {
                  setIsContextDrawerOpen(false);
                  ensureLiveDraftId();
                  setIsAttachDrawerOpen(true);
                }}
                className="w-full flex items-center gap-3 px-4 py-3 rounded-xl bg-white/[0.02] border border-pink-500/40 text-sm font-bold text-pink-300 hover:bg-pink-500/10 transition-all text-left cursor-pointer"
              >
                <Plus className="w-5 h-5 text-pink-400" />
                <span>Attach object…</span>
              </button>

              {/* Upload file */}
              <button
                type="button"
                disabled={isAttachingFile}
                onClick={() => {
                  setIsContextDrawerOpen(false);
                  ensureLiveDraftId();
                  fileUploadRef.current?.click();
                }}
                className="w-full flex items-center gap-3 px-4 py-3 rounded-xl bg-white/[0.02] border border-white/5 text-sm font-bold text-white hover:bg-white/5 transition-all text-left cursor-pointer disabled:opacity-60"
              >
                <Paperclip className="w-5 h-5 text-indigo-400" />
                <span>{isAttachingFile ? 'Uploading…' : 'Upload file or image'}</span>
              </button>

              {/* Paste URL */}
              <button
                type="button"
                disabled={isCheckingUrl}
                onClick={() => { void attachUrl(); }}
                className="w-full flex items-center gap-3 px-4 py-3 rounded-xl bg-white/[0.02] border border-white/5 text-sm font-bold text-white hover:bg-white/5 transition-all text-left cursor-pointer disabled:opacity-60"
              >
                <LinkIcon className="w-5 h-5 text-cyan-400" />
                <span>{isCheckingUrl ? 'Checking…' : 'Paste URL'}</span>
              </button>
            </Box>
          </Drawer>
        )}

        {isAttachDrawerOpen && (
          <ProjectAddObjectModal
            open={isAttachDrawerOpen}
            onClose={() => setIsAttachDrawerOpen(false)}
            mode="resource"
            title="Attach to Idea"
            onAttachResource={async (payload) => {
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
              const theme =
                childKind === 'vault' || childKind === 'totp'
                  ? 'vault'
                  : childKind === 'task' || childKind === 'event' || childKind === 'form'
                    ? 'flow'
                    : 'idea';
              insertObjectBlock(serializeObjectBlock({
                childId: payload.entityId,
                childKind: childKind as any,
                appTheme: theme,
                label: payload.item?.title || payload.item?.name || payload.item?.issuer || payload.item?.caption || undefined,
              }));
            }}
          />
        )}

        {/* Protected-block delete confirmation */}
        {pendingBlockDelete && (
          <Drawer
            anchor="bottom"
            open={Boolean(pendingBlockDelete)}
            onClose={() => setPendingBlockDelete(null)}
            ModalProps={{ keepMounted: false, disablePortal: true }}
            PaperProps={{ sx: { bgcolor: '#161412', borderTop: '1px solid #34322F', borderTopLeftRadius: '24px', borderTopRightRadius: '24px', p: 2 } }}
          >
            <div className="space-y-3">
              <p className="text-sm font-bold text-white">Remove this {pendingBlockDelete.payload.childKind} attachment?</p>
              <p className="text-xs text-white/60">This removes the object block from content and detaches the relation. This cannot be undone.</p>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  className="h-9 px-3 rounded-lg border border-white/10 text-white/80 text-sm font-bold"
                  onClick={() => setPendingBlockDelete(null)}
                >
                  Cancel
                </button>
                <button
                  type="button"
                  className="h-9 px-3 rounded-lg bg-red-500/20 border border-red-500/30 text-red-400 text-sm font-bold hover:bg-red-500/30 transition-colors"
                  onClick={() => {
                    const block = pendingBlockDelete;
                    const next = content.slice(0, block.start) + content.slice(block.end);
                    setContent(next.replace(/\n{3,}/g, '\n\n'));
                    setPendingBlockDelete(null);
                  }}
                >
                  Remove
                </button>
              </div>
            </div>
          </Drawer>
        )}

        {/* Hidden file input for upload */}
        <input
          ref={fileUploadRef}
          type="file"
          accept="image/*,video/*,audio/*,.pdf,.doc,.docx,.xls,.xlsx,.csv,.txt,.zip"
          className="hidden"
          onChange={onPickFile}
        />
      </div>
  );
}
