"use client";

import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { ID } from 'appwrite';
import { 
  Check, 
  ArrowLeft,
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
} from 'lucide-react';
import { Drawer, Box, Typography } from '@/lib/openbricks/primitives';
import { StorageService } from '@/lib/services/storage';
import { buildAutoTitleFromContent, resolveNoteCardTitle } from '@/constants/noteTitle';
import { pickNoteAutosavePayload } from '@/lib/appwrite/note';
import { useOverlay } from '@/components/ui/OverlayContext';
import { useToast } from '@/components/ui/Toast';
import { useUnifiedFileDrawer } from '@/context/UnifiedFileDrawerContext';
import { getNote, getNotePublicState, toggleNoteVisibility } from '@/lib/appwrite';
import { createNote, updateNote, attachObject } from '@/lib/actions/client-ops';
import type { Notes } from '@/types/appwrite';
import { APPWRITE_CONFIG } from '@/lib/appwrite/config';
import { serializeObjectBlock, parseObjectBlocks } from '@/lib/note-object-secondary';
import type { ParsedObjectBlock } from '@/lib/note-object-secondary';
import { useNotes } from '@/context/NotesContext';
import { BareMetalInput } from '@/components/ui/BareMetalInput';
import { useDataNexus } from '@/context/DataNexusContext';
import { useWorkspace } from '@/context/WorkspaceContext';
import { ecosystemSecurity } from '@/lib/ecosystem/security';
import { useSudo } from '@/context/SudoContext';
import { useSection } from '@/context/SectionContext';
import { useTask } from '@/context/TaskContext';
import ProjectAddObjectModal from '@/components/projects/ProjectAddObjectModal';

import { useUnifiedDrawer } from '@/context/UnifiedDrawerContext';
import { useProUpgrade } from '@/context/ProUpgradeContext';
import { hasPaidKylrixPlan } from '@/lib/utils';
import { useAuth } from '@/lib/auth';
import { isEphemeralComposeNoteId, isUnpersistedComposeDraft, markNotePersistedRemote, shouldCreateComposeNote, withNotePersistLock, isAlreadyExistsAppwriteError } from '@/lib/notes/compose-draft-registry';
import { isValidAppwriteRowId } from '@/lib/utils/resource-ids';
import { autonomicSyncEngine } from '@/lib/services/sync-engine';
import { SyncStatusDot, SyncStatusLabel } from '@/components/ui/SyncStatusDot';

interface CreateNoteFormProps {
  onNoteCreated?: (note: Notes) => void;
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
  /** Parent can invoke the composer's save-and-close handler (e.g. drawer backdrop / header check). */
  onRegisterClose?: (close: (() => void) | null) => void;
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
  onRegisterClose,
  isExpanded: controlledIsExpanded,
  onToggleExpand,
}: CreateNoteFormProps) {
  const { closeOverlay } = useOverlay();
  const { showSuccess, showError } = useToast();
  const { notes: allNotes, pushLiveNote, removeNote, registerComposeSession, unregisterComposeSession, migrateDraftNoteId } = useNotes();
  const { fetchOptimized, getCachedData, setCachedData } = useDataNexus();
  const { promptSudo } = useSudo();
  const { setActiveDetail } = useSection();
  const { open: openUnified } = useUnifiedDrawer();
  const { user } = useAuth();
  const { activeWorkspace, attachEntityToActiveWorkspace } = useWorkspace();
  const { openProUpgrade } = useProUpgrade();
  const { openFileDrawer } = useUnifiedFileDrawer();

  const [title, setTitle] = useState(initialContent?.title || '');
  const [content, setContent] = useState(initialContent?.content || '');
  const [tags, setTags] = useState<string[]>(normalizeTags(initialContent?.tags || []));
  const [isPublic, setIsPublic] = useState(initialContent?.isPublic || false);
  const [isGuest, setIsGuest] = useState(initialContent?.isGuest || false);
  const [isArticle, setIsArticle] = useState(false);
  const [isContextDrawerOpen, setIsContextDrawerOpen] = useState(false);
  const [isTitleManuallyEdited, setIsTitleManuallyEdited] = useState(false);
  const [currentTag, setCurrentTag] = useState('');
  const [_isTagDropdownOpen, _setIsTagDropdownOpen] = useState(false);
  const [resolvedNoteId, setResolvedNoteId] = useState<string | undefined>(noteId);
  const [persistedIsPublic, setPersistedIsPublic] = useState(initialContent?.isPublic || false);
  const [persistedIsGuest, setPersistedIsGuest] = useState(initialContent?.isGuest || false);
  const [isHydrated, setIsHydrated] = useState(false);
  const [lastSavedSnapshot, setLastSavedSnapshot] = useState('');
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
  const hasBootstrappedDraftRef = useRef(false);
  const composeHasContentRef = useRef(false);
  const composeCloseHandledRef = useRef(false);
  const editorStateRef = useRef({
    title,
    content,
    tags,
    isPublic,
    isGuest,
    composerKind,
  });
  // Keep ref in sync without causing rerenders — flushLiveNote reads this SoT
  useEffect(() => { editorStateRef.current.title = title; }, [title]);
  useEffect(() => { editorStateRef.current.content = content; }, [content]);
  useEffect(() => { editorStateRef.current.tags = tags; }, [tags]);
  useEffect(() => { editorStateRef.current.isPublic = isPublic; }, [isPublic]);
  useEffect(() => { editorStateRef.current.isGuest = isGuest; }, [isGuest]);
  useEffect(() => { editorStateRef.current.composerKind = composerKind; }, [composerKind]);
  const isPastedRef = useRef(false);
  const pasteTimerRef = useRef<NodeJS.Timeout | null>(null);

  const [isRecording, setIsRecording] = useState(false);
  const [_isUploadingVoice, setIsUploadingVoice] = useState(false);
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
  const [_isAttachingFile, setIsAttachingFile] = useState(false);
  const [_isCheckingUrl, setIsCheckingUrl] = useState(false);
  const [pendingBlockDelete, setPendingBlockDelete] = useState<ParsedObjectBlock | null>(null);
  const fileUploadRef = useRef<HTMLInputElement | null>(null);
  // Debounced live-copy sync (mirrors CreateGoalComposer.scheduleLiveGoalSync — 250ms)
  // Keeps typing snappy: React state updates instantly, RxDB/DataNexus/NotesContext fanout debounced.
  const syncTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const ensureLiveDraftId = useCallback(() => {
    const existingId = resolvedNoteId || liveDraftIdRef.current;
    if (existingId) return existingId;
    const noteId = ID.unique();
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
        metadata: { mimeType: file.type, fileName: file.name },
      }));
      showSuccess('File attached', file.name);
    } catch (err: any) {
      showError('Attach failed', err?.message || 'Could not upload file.');
    } finally {
      setIsAttachingFile(false);
    }
  }, [ensureLiveDraftId, insertObjectBlock, showSuccess, showError]);

  // Paste URL → HEAD-check → objects table → insert block
  const _attachUrl = useCallback(async () => {
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

  // Debounced live-copy flush (segregated manifest pattern: lightweight UI state immediate, heavy RxDB/DataNexus debounced)
  const flushLiveNote = useCallback(() => {
    let draftId = resolvedNoteId || liveDraftIdRef.current;
    if (!draftId) {
      draftId = ID.unique();
      liveDraftIdRef.current = draftId;
      registerComposeSession(draftId);
      setResolvedNoteId(draftId);
      hasBootstrappedDraftRef.current = true;
    }
    const curTitle = editorStateRef.current.title;
    const curContent = editorStateRef.current.content;
    const curTags = editorStateRef.current.tags as string[];
    const curIsPublic = editorStateRef.current.isPublic;
    const curIsGuest = editorStateRef.current.isGuest;
    const curIsManuallyEdited = isTitleManuallyEdited;
    const genTitle = curIsManuallyEdited ? curTitle : buildAutoTitleFromContent(curContent);
    const previewTitle = resolveNoteCardTitle(curIsManuallyEdited ? curTitle : genTitle, curContent) || genTitle || 'Untitled Thought';
    const draftNote: Notes = {
      $id: draftId,
      title: previewTitle,
      content: curContent,
      tags: normalizeTags(curTags),
      format: 'text',
      isPublic: curIsPublic,
      isGuest: curIsGuest,
      projectId: activeWorkspace && !activeWorkspace.isPersonal ? activeWorkspace.id : undefined,
      isWorkspace: Boolean(activeWorkspace && !activeWorkspace.isPersonal),
      userId: user?.$id || '',
      $createdAt: new Date().toISOString(),
      $updatedAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    } as unknown as Notes;
    pushLiveNote(draftNote);
    setCachedData(`note_${draftId}`, draftNote);
  }, [activeWorkspace, isTitleManuallyEdited, pushLiveNote, registerComposeSession, resolvedNoteId, setCachedData, user?.$id]);

  const scheduleLiveNoteSync = useCallback(() => {
    if (syncTimerRef.current) clearTimeout(syncTimerRef.current);
    syncTimerRef.current = setTimeout(() => flushLiveNote(), 800);
  }, [flushLiveNote]);

  const autoTitleTimerRef = useRef<NodeJS.Timeout | null>(null);

  // Realtime input — flow.realtime-input-rxdb-sync: direct onInput interception, sync ref + LocalEngine
  const handleContentChange = useCallback((nextValue: string) => {
    // 1) Synchronous ref update — instant SoT for flushLiveNote
    editorStateRef.current.content = nextValue;

    // 2) Non-blocking React state update
    const { startTransition } = React as any;
    const upd = () => setContent(nextValue);
    if (typeof startTransition === 'function') startTransition(upd); else upd();

    // 3) Debounced auto-title derivation so typing is never blocked
    if (!isTitleManuallyEdited) {
      if (autoTitleTimerRef.current) clearTimeout(autoTitleTimerRef.current);
      autoTitleTimerRef.current = setTimeout(() => {
        const generated = nextValue.trim() ? buildAutoTitleFromContent(nextValue) : '';
        editorStateRef.current.title = generated;
        if (typeof startTransition === 'function') {
          startTransition(() => setTitle(generated));
        } else {
          setTitle(generated);
        }
      }, 150);
    }

    scheduleLiveNoteSync();
  }, [isTitleManuallyEdited, scheduleLiveNoteSync]);

  const insertTextAtCursor = (text: string) => {
    const textarea = contentRef.current;
    if (textarea) {
      const start = textarea.selectionStart || 0;
      const end = textarea.selectionEnd || 0;
      const nextContent = content.substring(0, start) + text + content.substring(end);
      handleContentChange(nextContent);
      setTimeout(() => {
        textarea.focus();
        textarea.setSelectionRange(start + text.length, start + text.length);
      }, 50);
    } else {
      handleContentChange(content + text);
    }
  };

  const existingTags = useMemo(() => {
    const tagSet = new Set<string>();
    for (const t of ecosystemTags.map(t => t.name).filter(Boolean) as string[]) tagSet.add(t);
    // Fallback to local notes tags when ecosystemTags empty — LocalEngine/RxDB is SoT per note.shared-cache
    try {
      const { notes: ctxNotes } = { notes: allNotes } as any;
      for (const n of (ctxNotes as Notes[]) || []) {
        for (const tag of (n.tags as string[]) || []) if (tag?.trim()) tagSet.add(tag.trim());
      }
    } catch {}
    // Also include locally cached tags from DataNexus/RxDB if still empty
    if (tagSet.size === 0) {
      try {
        // best-effort sync read from cache already hydrated in NotesContext; no network fetch
        for (const n of (allNotesRef.current as Notes[]) || []) {
          for (const tag of (n.tags as string[]) || []) if (tag?.trim()) tagSet.add(tag.trim());
        }
      } catch {}
    }
    return Array.from(tagSet);
  }, [ecosystemTags, allNotes]);

  const _filteredExistingTags = useMemo(() => {
    const available = existingTags.filter((t) => !tags.includes(t));
    if (!currentTag.trim()) return available;
    const query = currentTag.toLowerCase().trim();
    return available.filter((t) => t.toLowerCase().includes(query));
  }, [existingTags, tags, currentTag]);

  // Exclude auto-derived title from dirty tracking: when the user hasn't manually
  // edited the title, `title` is auto-set by the auto-title effect on every content
  // change. Including it in the snapshot causes isDirty=true after just the first
  // character, which fires the autosave with only that one character.
  const snapshot = useMemo(() => JSON.stringify({
    title: isTitleManuallyEdited ? title.trim() : '',
    content: content.trim(),
    format: 'text',
    tags: normalizeTags(tags),
    composerKind,
    isPublic,
    isGuest,
    resolvedNoteId: resolvedNoteId || null,
  }), [isTitleManuallyEdited, title, content, tags, composerKind, isPublic, isGuest, resolvedNoteId]);

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
        setLastSavedSnapshot(JSON.stringify({
          title: (cached as any).isTitleManuallyEdited || isTitleManuallyEdited ? (cached.title || '').trim() : '',
          content: cached.content || '',
          format: 'text',
          tags: normalizeTags(cached.tags || []),
          composerKind: nextComposerKind,
          isPublic: cachedPublic,
          isGuest: cachedGuest,
          isArticle: cachedArticle,
          resolvedNoteId: cached.$id,
        }));
      }

      try {
        let loaded = null;
        try {
          loaded = await fetchOptimized(cacheKey, () => getNote(noteId));
        } catch (err) {
          console.warn('[CreateNoteForm] Safe bypass: note not found in remote Appwrite database during hydration:', err);
        }
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
        setLastSavedSnapshot(JSON.stringify({
          title: (loaded as any).isTitleManuallyEdited || isTitleManuallyEdited ? (loaded.title || '').trim() : '',
          content: loaded.content || '',
          format: 'text',
          tags: normalizeTags(loaded.tags || []),
          composerKind: nextComposerKind,
          isPublic: loadedPublic,
          isGuest: loadedGuest,
          isArticle: loadedArticle,
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
    composeHasContentRef.current = Boolean(title.trim() || content.trim() || tags.length);
    editorStateRef.current = { title, content, tags, isPublic, isGuest, composerKind };
  }, [title, content, tags, isPublic, isGuest, composerKind]);

  // Local-first: allocate a real Appwrite ID when typing content starts.
  useEffect(() => {
    if (!isHydrated || noteId || hasBootstrappedDraftRef.current) return;
    if (resolvedNoteId || liveDraftIdRef.current) {
      hasBootstrappedDraftRef.current = true;
      return;
    }

    const hasContent = Boolean(title.trim() || content.trim() || tags.length);
    if (!hasContent) return;

    hasBootstrappedDraftRef.current = true;
    const id = ID.unique();
    liveDraftIdRef.current = id;
    setResolvedNoteId(id);
    registerComposeSession(id);

    const now = new Date().toISOString();
    const previewTitle = resolveNoteCardTitle(
      isTitleManuallyEdited ? title : null,
      content,
    ) || '';

    const shell = {
      $id: id,
      title: previewTitle,
      content: content,
      tags: tags,
      format: 'text' as const,
      userId: user?.$id || '',
      isPublic,
      isGuest,
      projectId: activeWorkspace && !activeWorkspace.isPersonal ? activeWorkspace.id : undefined,
      isWorkspace: Boolean(activeWorkspace && !activeWorkspace.isPersonal),
      ...(composerKind === 'project' ? { kind: 'project' as const } : {}),
      $createdAt: now,
      $updatedAt: now,
      updatedAt: now,
    } as unknown as Notes;

    if (activeWorkspace && !activeWorkspace.isPersonal && id) {
      void attachEntityToActiveWorkspace('note', id);
    }

    pushLiveNote(shell);
    setCachedData(`note_${id}`, shell);
    setLastSavedSnapshot(JSON.stringify({
      // Match the snapshot formula: only use title when manually edited,
      // otherwise '' so that the auto-title effect never makes isDirty=true.
      title: isTitleManuallyEdited ? title.trim() : '',
      content: content.trim(),
      format: 'text',
      tags: normalizeTags(tags),
      composerKind,
      isPublic,
      isGuest,
      resolvedNoteId: id,
    }));

    if (!hasAnnouncedDraftRef.current) {
      hasAnnouncedDraftRef.current = true;
      onNoteCreated?.(shell);
    }
  }, [
    composerKind,
    isGuest,
    isHydrated,
    isPublic,
    noteId,
    onNoteCreated,
    pushLiveNote,
    registerComposeSession,
    resolvedNoteId,
    setCachedData,
    user?.$id,
    title,
    content,
    tags,
  ]);

  const candidateNote = useMemo((): Notes | null => {
    const noteId = resolvedNoteId || liveDraftIdRef.current;
    if (!isHydrated || !noteId) return null;

    const existing = allNotesRef.current.find((candidate) => candidate.$id === noteId);
    const normalizedTags = normalizeTags(tags);
    const fallbackTitle = '';
    // When auto-title is active (title not manually edited), derive card title directly from
    // the current `content` state instead of the stale `title` state (which lags one render
    // behind content due to the auto-title effect). This eliminates the card preview lag.
    const previewTitle = resolveNoteCardTitle(
      isTitleManuallyEdited ? title : null,
      content,
    ) || fallbackTitle;
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
      title: previewTitle,
      content,
      tags: normalizedTags,
      format: 'text',
      isPublic,
      isGuest,
    };
  }, [title, content, tags, resolvedNoteId, isHydrated, isPublic, isGuest, composerKind, user?.$id, isTitleManuallyEdited]);

  const candidateNoteRef = useRef<Notes | null>(null);
  candidateNoteRef.current = candidateNote;

  const flushLiveNoteDraft = useCallback((): Notes | null => {
    const noteId = resolvedNoteId || liveDraftIdRef.current;
    if (!noteId || !isHydrated) return null;

    const editor = editorStateRef.current;
    const hasAnyDraft = Boolean(editor.title.trim() || editor.content.trim() || editor.tags.length);
    if (!hasAnyDraft) return null;

    const fallbackTitle = '';
    const draftNote: Notes = {
      ...(candidateNoteRef.current || ({} as Notes)),
      $id: noteId,
      title: resolveNoteCardTitle(editor.title, editor.content) || fallbackTitle,
      content: editor.content,
      tags: normalizeTags(editor.tags),
      format: 'text',
      userId: user?.$id || candidateNoteRef.current?.userId || '',
      isPublic: editor.isPublic,
      isGuest: editor.isGuest,
      $updatedAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };
    pushLiveNote(draftNote);
    setCachedData(`note_${noteId}`, draftNote);
    return draftNote;
  }, [isHydrated, pushLiveNote, resolvedNoteId, setCachedData, user?.$id]);

  const flushLiveNoteDraftRef = useRef(flushLiveNoteDraft);
  flushLiveNoteDraftRef.current = flushLiveNoteDraft;

  // Mirror editor state to the card — debounced like Goal (single path, no per-keystroke fanout).
  // handleContentChange already schedules flush; this handles title/tags/toggle changes.
  useEffect(() => {
    const hasContent = Boolean(title.trim() || content.trim() || tags.length);
    if (!hasContent) return;
    // Avoid double-scheduling when handleContentChange already queued a flush for content.
    // For non-content changes (title, tags, isPublic/isGuest) we still need a debounced push.
    scheduleLiveNoteSync();
  }, [title, tags, isPublic, isGuest, scheduleLiveNoteSync]);

  // Ensure pending debounced write flushes before close/unmount (metadata segregation: manifest + content isolated per drafts skill)
  useEffect(() => {
    return () => {
      if (syncTimerRef.current) {
        clearTimeout(syncTimerRef.current);
        syncTimerRef.current = null;
        flushLiveNote();
      }
    };
  }, [flushLiveNote]);

  useEffect(() => {
    return () => {
      flushLiveNoteDraftRef.current();
      const draftId = liveDraftIdRef.current;
      if (!draftId || !isUnpersistedComposeDraft(draftId)) return;
      if (composeHasContentRef.current) return;
      removeNote(draftId);
      unregisterComposeSession(draftId);
      autonomicSyncEngine.ack(draftId);
    };
  }, [removeNote, unregisterComposeSession]);

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

  const suggestions = useMemo(() => {
    if (content.trim().length <= 4) return [];
    const lower = content.toLowerCase();
    const matchedGoals = (ecosystemTags as any[]).filter(g => g.name && lower.includes(g.name.toLowerCase()));
    const list: { type: string; label: string; action: () => void }[] = [];

    if (matchedGoals.length > 0) {
      matchedGoals.forEach(g => {
        if (!tags.includes(g.name)) {
          list.push({
            type: 'tag',
            label: `Add tag: ${g.name.toUpperCase()}`,
            action: () => appendTag(g.name)
          });
        }
      });
    }

    if (lower.startsWith('create a note') || lower.includes('summarize') || lower.includes('goal')) {
      list.push({
        type: 'prompt',
        label: '💡 Execute with Smart System',
        action: () => {
          if (onClose) onClose();
          closeOverlay();
          window.dispatchEvent(new CustomEvent('kylrix:open-agentic-drawer', {
            detail: { prompt: content, autoRun: true }
          }));
        }
      });
    }
    return list;
  }, [content, ecosystemTags, tags, appendTag, onClose, closeOverlay]);

  const _wrapSelection = useCallback((before: string, after = before) => {
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
    setLastSavedSnapshot(JSON.stringify({
      title: isTitleManuallyEdited ? (source.title || '').trim() : '',
      content: (source.content || '').trim(),
      format: 'text',
      tags: normalizeTags((source.tags || []) as string[]),
      composerKind,
      isPublic: livePublicState,
      isGuest: liveGuestState,
      resolvedNoteId: saved.$id,
    }));
  }, [composerKind, isTitleManuallyEdited]);

  const migrateDraftId = useCallback((savedId: string, ephemeralId: string | undefined) => {
    if (savedId) registerComposeSession(savedId);
    if (ephemeralId && ephemeralId !== savedId) {
      migrateDraftNoteId(ephemeralId, savedId);
      unregisterComposeSession(ephemeralId);
    }
    if (savedId) {
      markNotePersistedRemote(savedId);
      unregisterComposeSession(savedId);
    }
    liveDraftIdRef.current = savedId;
    setResolvedNoteId(savedId);
  }, [registerComposeSession, unregisterComposeSession, migrateDraftNoteId]);

  const saveComposerNote = useCallback(async (source: Notes): Promise<Notes> => {
    if (!source.$id) {
      throw new Error('Missing note id for save');
    }

    return withNotePersistLock(source.$id, async () => {
    const normalizedTags = normalizeTags((source.tags || []) as string[]);
    const autosaveFields = pickNoteAutosavePayload({
      title: isTitleManuallyEdited ? (source.title || title) : '',
      content: source.content || '',
      format: 'text',
      tags: normalizedTags,
    });
    const generatedTitle = autosaveFields.title || (
      composerKind === 'project' ? 'Untitled Project' : 'Untitled Thought'
    );

    const payload = {
      title: generatedTitle,
      content: source.content || '',
      format: 'text' as const,
      tags: normalizedTags,
      kind: composerKind,
      isPublic,
      isGuest,
      article: isArticle,
      isWorkspace: Boolean(activeWorkspace && !activeWorkspace.isPersonal),
      projectId: activeWorkspace && !activeWorkspace.isPersonal ? activeWorkspace.id : undefined,
      metadata: JSON.stringify({}),
    };

    if (!user?.$id) {
      const id = isEphemeralComposeNoteId(source.$id) ? `thread-${crypto.randomUUID()}` : source.$id;
      const saved = {
        $id: id,
        $createdAt: source.$createdAt || new Date().toISOString(),
        $updatedAt: new Date().toISOString(),
        title: generatedTitle,
        content: payload.content,
        format: 'text',
        tags: payload.tags,
        userId: 'guest',
        isPublic: false,
        isGuest: false,
      } as Notes;

      migrateDraftId(id, source.$id);
      if (!hasAnnouncedCreateRef.current) {
        hasAnnouncedCreateRef.current = true;
        onNoteCreated?.(saved);
      }
      applyPersistSnapshot(saved, source);
      pushLiveNote(saved, { pending: true });
      setCachedData(`note_${id}`, saved);
      return saved;
    }

    if (!user?.$id) {
      const fallbackTitle = '';
      const cardTitle = resolveNoteCardTitle(source.title || title, source.content) || fallbackTitle;
      const localNote = {
        $id: source.$id,
        $createdAt: new Date().toISOString(),
        $updatedAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
        title: cardTitle,
        content: source.content || '',
        format: 'text',
        tags: normalizedTags,
        userId: '',
        isPublic: false,
        isGuest: false,
        metadata: '{}',
      } as unknown as Notes;

      pushLiveNote(localNote, { pending: true });
      setCachedData(`note_${source.$id}`, localNote);
      autonomicSyncEngine.markPending(source.$id, localNote.updatedAt, localNote);
      if (!hasAnnouncedCreateRef.current) {
        hasAnnouncedCreateRef.current = true;
        onNoteCreated?.(localNote);
      }
      return localNote;
    }

    let saved: Notes;
    const shouldCreate = shouldCreateComposeNote(source.$id);

    try {
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
          $id: isValidAppwriteRowId(source.$id) ? source.$id : undefined,
          isPublic: payload.isPublic,
          isGuest: payload.isGuest,
          title: generatedTitle,
        })) as Notes;
        markNotePersistedRemote(saved.$id);
        if (saved?.$id && activeWorkspace && !activeWorkspace.isPersonal) {
          await attachEntityToActiveWorkspace('note', saved.$id);
        }
        migrateDraftId(saved.$id, ephemeralId);
        if (typeof window !== 'undefined') {
          localStorage.removeItem('kylrix:draft:note');
        }
        if (!hasAnnouncedCreateRef.current) {
          hasAnnouncedCreateRef.current = true;
          onNoteCreated?.(saved);
        }
      }
    } catch (error) {
      if (shouldCreate && isAlreadyExistsAppwriteError(error)) {
        markNotePersistedRemote(source.$id);
        saved = (await updateNote(source.$id, {
          ...payload,
          isPublic: persistedIsPublic,
          isGuest: persistedIsGuest,
          title: generatedTitle,
        })) as Notes;
      } else {
        throw error;
      }
    }

    markNotePersistedRemote(saved.$id);

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

    const fallbackTitle = '';
    const resolvedTitleInput = generatedTitle || source.title || title;
    const cardTitle = resolveNoteCardTitle(resolvedTitleInput, source.content) || generatedTitle || fallbackTitle;
    const localNote: Notes = {
      ...saved,
      title: cardTitle,
      content: source.content || saved.content || '',
      tags: normalizedTags,
      isWorkspace: Boolean(activeWorkspace && !activeWorkspace.isPersonal),
      projectId: activeWorkspace && !activeWorkspace.isPersonal ? activeWorkspace.id : (saved as any).projectId,
      $updatedAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    } as unknown as Notes;
    // Already on Appwrite — hydrate live copy without re-amber; ack any draft queue entry.
    pushLiveNote(localNote, { pending: false });
    autonomicSyncEngine.ack(saved.$id, localNote.updatedAt);
    setCachedData(`note_${saved.$id}`, localNote);

    return saved;
    });
  }, [
    applyPersistSnapshot,
    composerKind,
    isArticle,
    isGuest,
    isPublic,
    isTitleManuallyEdited,
    migrateDraftId,
    onNoteCreated,
    persistedIsGuest,
    persistedIsPublic,
    promptSudo,
    pushLiveNote,
    setCachedData,
    showSuccess,
    title,
    user?.$id,
  ]);

  const [_isSaving, setIsSaving] = useState(false);

  const _persist = useCallback(async (showToast = true) => {
    const finalDraft = flushLiveNoteDraft();
    if (!finalDraft?.$id) return null;
    setIsSaving(true);
    try {
      const saved = await saveComposerNote(finalDraft);
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
    } finally {
      setIsSaving(false);
    }
  }, [flushLiveNoteDraft, saveComposerNote, showError, showSuccess]);

  useEffect(() => {
    return () => {
      if (composeCloseHandledRef.current) return;
      const finalDraft = flushLiveNoteDraftRef.current();
      if (!finalDraft?.$id) return;
      const editor = editorStateRef.current;
      const hasAnyDraft = Boolean(editor.title.trim() || editor.content.trim() || editor.tags.length);
      if (!hasAnyDraft) return;
      void saveComposerNote(finalDraft).catch((e) => console.error('Failed to persist draft on unmount', e));
    };
  }, [saveComposerNote]);

  const handleMorphToDetail = useCallback(() => {
    const noteId = resolvedNoteId || liveDraftIdRef.current;
    if (noteId) {
      setActiveDetail({ type: 'note', id: noteId });
    }
    const finalDraft = flushLiveNoteDraft();
    if (finalDraft) {
      void saveComposerNote(finalDraft).catch(() => {});
    }
    if (onClose) {
      onClose();
    } else {
      closeOverlay();
    }
  }, [flushLiveNoteDraft, saveComposerNote, setActiveDetail, closeOverlay, onClose, resolvedNoteId]);

  const handleClose = useCallback(() => {
    composeCloseHandledRef.current = true;
    const finalDraft = flushLiveNoteDraft();
    if (finalDraft) {
      if (!hasAnnouncedDraftRef.current && !hasAnnouncedCreateRef.current) {
        hasAnnouncedDraftRef.current = true;
        onNoteCreated?.(finalDraft);
      }
      void saveComposerNote(finalDraft).catch(() => {});
    } else {
      const draftId = liveDraftIdRef.current || resolvedNoteId;
      if (draftId && isUnpersistedComposeDraft(draftId)) {
        removeNote(draftId);
        unregisterComposeSession(draftId);
        autonomicSyncEngine.ack(draftId);
        liveDraftIdRef.current = undefined;
        setResolvedNoteId(undefined);
        setLastSavedSnapshot('');
      } else if (isDirty) {
        void saveComposerNote(finalDraft || (candidateNoteRef.current as Notes)).catch(() => {});
      }
    }
    if (typeof window !== 'undefined') {
      localStorage.removeItem('kylrix:draft:note');
    }
    if (onClose) {
      onClose();
    } else {
      closeOverlay();
    }
  }, [closeOverlay, flushLiveNoteDraft, isDirty, onClose, onNoteCreated, removeNote, resolvedNoteId, unregisterComposeSession, saveComposerNote]);

  useEffect(() => {
    onRegisterClose?.(handleClose);
    return () => onRegisterClose?.(null);
  }, [handleClose, onRegisterClose]);

  const _handlePaste = useCallback(() => {
    isPastedRef.current = true;
    if (pasteTimerRef.current) clearTimeout(pasteTimerRef.current);
    pasteTimerRef.current = setTimeout(() => {
      isPastedRef.current = false;
    }, 2000); // 2s protection window for formatting after paste
  }, []);

  const _handleTagKeyDown = useCallback((event: React.KeyboardEvent<HTMLInputElement>) => {
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
        <div className="px-2 py-1.5 flex items-center justify-between border-b border-white/5 sticky top-0 z-20 bg-[#161412]/95 shrink-0">
          <div className="flex items-center gap-1.5 min-w-0">
            <button
              type="button"
              onClick={handleClose}
              className="p-1.5 rounded-xl text-white/50 hover:text-white hover:bg-white/10 border border-transparent hover:border-white/10 transition-all shrink-0 cursor-pointer"
              title="Back / Close"
            >
              <ArrowLeft className="w-4 h-4" />
            </button>
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
                <SyncStatusDot noteId={resolvedNoteId} kind="note" />
                <SyncStatusLabel noteId={resolvedNoteId} kind="note" />
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
        <div className="flex-1 overflow-y-auto overscroll-contain p-2 flex flex-col gap-2 min-h-0 scrollbar-thin">
          {(content.trim().length > 0 || isTitleManuallyEdited) && (
            <BareMetalInput
              key="create-title-stable"
              value={title}
              enableLocalEngine={false}
              onValueChange={(val) => {
                editorStateRef.current.title = val;
                const { startTransition } = React as any;
                const upd = () => { setTitle(val); setIsTitleManuallyEdited(true); };
                if (typeof startTransition === 'function') startTransition(upd); else upd();
                scheduleLiveNoteSync();
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
            className="w-full flex-1 flex flex-col relative"
          >
            <BareMetalInput
              as="textarea"
              forwardedRef={contentRef}
              defaultValue={initialContent?.content || ''}
              value={content}
              rows={4}
              placeholder="Write your idea..."
              autoFocus
              enableLocalEngine={false}
              onValueChange={handleContentChange}
              onPaste={(e) => {
                isPastedRef.current = true;
                if (pasteTimerRef.current) clearTimeout(pasteTimerRef.current);
                pasteTimerRef.current = setTimeout(() => {
                  isPastedRef.current = false;
                }, 2000);
              }}
              className="w-full flex-1 min-h-[180px] resize-none bg-transparent text-white placeholder-white/25 border-0 focus:outline-none p-2 text-base leading-relaxed scrollbar-thin font-satoshi"
            />

            {/* Offline fast suggestion system matching goals or tags as user types */}
            {suggestions.length > 0 && (
              <div className="absolute bottom-2 left-2 right-2 z-10 flex flex-wrap gap-1.5 p-2 bg-[#0B0A09]/95 border border-white/10 rounded-xl max-h-[80px] overflow-y-auto">
                {suggestions.map((s, idx) => (
                  <button
                    key={idx}
                    type="button"
                    onClick={s.action}
                    className="px-2.5 py-1 rounded-lg bg-pink-500/10 border border-pink-500/20 hover:bg-pink-500/20 text-pink-400 font-mono text-[10px] font-black uppercase tracking-wider transition-colors cursor-pointer"
                  >
                    {s.label}
                  </button>
                ))}
              </div>
            )}
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
                openUnified('tags');
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
                  } catch (_err) {
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
                  openFileDrawer({
                    title: 'Attach Object or Media',
                    onSelectFile: (file) => {
                      const block = file.fileUrl?.startsWith('[[kylrix-object:')
                        ? file.fileUrl
                        : serializeObjectBlock({
                            childId: file.$id,
                            childKind: file.mimeType?.startsWith('image/') ? 'image' : 'file',
                            bucketId: file.bucketId,
                            label: file.name,
                            appTheme: 'idea',
                            metadata: { mimeType: file.mimeType, fileName: file.name, fileUrl: file.fileUrl },
                          });
                      insertObjectBlock(block);
                    },
                  });
                }}
                className="w-full flex items-center gap-3 px-4 py-3 rounded-xl bg-white/[0.02] border border-pink-500/40 text-sm font-bold text-pink-300 hover:bg-pink-500/10 transition-all text-left cursor-pointer"
              >
                <Plus className="w-5 h-5 text-pink-400" />
                <span>Attach object…</span>
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

        {/* Protected-block delete confirmation — portal to body so it appears above note detail */}
        {pendingBlockDelete && (
          <Drawer
            anchor="bottom"
            open={Boolean(pendingBlockDelete)}
            onClose={() => setPendingBlockDelete(null)}
            ModalProps={{ keepMounted: false, disablePortal: false }}
            slotProps={{ backdrop: { sx: { bgcolor: 'rgba(0,0,0,0.5)', backdropFilter: 'blur(4px)' } } } as any}
            PaperProps={{ sx: { bgcolor: '#161412', borderTop: '1px solid #34322F', borderTopLeftRadius: '24px', borderTopRightRadius: '24px', p: 2, zIndex: 1400 } as any }}
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
