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
import { serializeObjectBlock } from '@/lib/note-object-secondary';
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
import { useTypeIntelligence, useTypeIntelEnabled } from '@/hooks/useTypeIntelligence';
import { TypeIntelToggle, TypeIntelGhostLayer } from '@/components/agentic/TypeIntelBar';
import { useContextualAutocomplete } from '@/lib/contextual-engine';
import { hydrate as hydrate_ext } from './CreateNoteFormSections/hydrate';
import { toggleRecording as toggleRecording_ext } from './CreateNoteFormSections/toggleRecording';
import { CreateNoteFormView } from './CreateNoteFormSections/CreateNoteFormView';
import { insertTextAtCursor as insertTextAtCursor_ext } from './CreateNoteFormSections/insertTextAtCursor';
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
  const isPro = hasPaidKylrixPlan(user);
  const { enabled: createWithAgent, persist: persistAgent } = useTypeIntelEnabled('note');
  const openPro = useCallback(() => openProUpgrade('Kylie Assist'), [openProUpgrade]);
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
  const toggleRecording = (..._args: any[]) => toggleRecording_ext({ _attachUrl, _filteredExistingTags, _handlePaste, _handleTagKeyDown, _isAttachingFile, _isCheckingUrl, _isSaving, _isTagDropdownOpen, _isUploadingVoice, _persist, _setIsTagDropdownOpen, _wrapSelection, acceptGhost, allNotesRef, appendTag, applyContentDraft, applyPersistSnapshot, audioChunksRef, autoTitleTimerRef, candidateNote, candidateNoteRef, composeCloseHandledRef, composeHasContentRef, composerKind, content, contentRef, createdToastShown, currentTag, durationIntervalRef, editorStateRef, ensureLiveDraftId, existingTags, fileUploadRef, flushLiveNote, flushLiveNoteDraft, flushLiveNoteDraftRef, ghostSuggestion, handleClose, handleContentChange, handleMorphToDetail, hasAnnouncedCreateRef, hasAnnouncedDraftRef, hasBootstrappedDraftRef, hydrate, insertObjectBlock, insertTextAtCursor, isArticle, isAttachDrawerOpen, isContextDrawerOpen, isDirty, isExpanded, isGuest, isHydrated, isMobile, isPastedRef, isPro, isPublic, isRecording, isTitleManuallyEdited, lastSavedSnapshot, liveDraftIdRef, localIsExpanded, mediaRecorderRef, migrateDraftId, onPickFile, openPro, pasteTimerRef, pendingBlockDelete, persistedIsGuest, persistedIsPublic, recordingDuration, recordingTimerRef, removeTag, resolvedNoteId, saveComposerNote, scheduleLiveNoteSync, setComposerKind, setContent, setCurrentTag, setIsArticle, setIsAttachDrawerOpen, setIsAttachingFile, setIsCheckingUrl, setIsContextDrawerOpen, setIsGuest, setIsHydrated, setIsMobile, setIsPublic, setIsRecording, setIsSaving, setIsTitleManuallyEdited, setIsUploadingVoice, setLastSavedSnapshot, setLocalIsExpanded, setPendingBlockDelete, setPersistedIsGuest, setPersistedIsPublic, setRecordingDuration, setResolvedNoteId, setTags, setTitle, snapshot, suggestions, syncTimerRef, tags, title, toggleExpand, toggleRecording });
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
  const _attachUrl = useCallback(async () => {
    const href = window.prompt('Paste a URL to attach:');
    if (!href || !href.trim()) return;
    const url = href.trim();
    const noteId = ensureLiveDraftId();
    if (!noteId) return;
    setIsCheckingUrl(true);
    try {
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
  const handleContentChange = useCallback((nextValue: string) => {
    editorStateRef.current.content = nextValue;
    setContent(nextValue);
    if (!isTitleManuallyEdited) {
      if (autoTitleTimerRef.current) clearTimeout(autoTitleTimerRef.current);
      autoTitleTimerRef.current = setTimeout(() => {
        const generated = nextValue.trim() ? buildAutoTitleFromContent(nextValue) : '';
        editorStateRef.current.title = generated;
        setTitle(generated);
      }, 280);
    }
    scheduleLiveNoteSync();
  }, [isTitleManuallyEdited, scheduleLiveNoteSync]);
  /** Agent accept/takeover must update BareMetal DOM while focused (external value sync is blocked). */
  const applyContentDraft = useCallback(
    (nextValue: string) => {
      const el = contentRef.current;
      if (el && el.value !== nextValue) {
        el.value = nextValue;
      }
      handleContentChange(nextValue);
    },
    [handleContentChange],
  );
  const {
    learningStatus,
    learningLabel,
    suggestion: agentSuggestion,
    busy: agentBusy,
    acceptSuggestion,
    runTakeover,
    handleKeyDown: handleAgentKeyDown,
    accent: agentAccent,
  } = useTypeIntelligence({
    kind: 'note',
    userId: user?.$id,
    displayName: user?.name || user?.email || undefined,
    draft: content,
    enabled: createWithAgent,
    isPro,
    onOpenPro: openPro,
    setDraft: applyContentDraft,
  });
  const {
    inlineSuffix,
    handleKeyDown: handleAutoKeyDown,
  } = useContextualAutocomplete(content, {
    niche: 'productivity',
    activeObjectId: resolvedNoteId,
    tags,
    onAccept: (completedText) => applyContentDraft(completedText),
  });
  const ghostSuggestion =
    createWithAgent && agentSuggestion
      ? agentSuggestion
      : inlineSuffix || '';
  const acceptGhost = useCallback(() => {
    if (createWithAgent && agentSuggestion) {
      acceptSuggestion();
      return;
    }
    if (inlineSuffix) {
      applyContentDraft(content + inlineSuffix);
    }
  }, [createWithAgent, agentSuggestion, acceptSuggestion, inlineSuffix, applyContentDraft, content]);
  const insertTextAtCursor = (..._args: any[]) => insertTextAtCursor_ext({ _attachUrl, _filteredExistingTags, _handlePaste, _handleTagKeyDown, _isAttachingFile, _isCheckingUrl, _isSaving, _isTagDropdownOpen, _isUploadingVoice, _persist, _setIsTagDropdownOpen, _wrapSelection, acceptGhost, allNotesRef, appendTag, applyContentDraft, applyPersistSnapshot, audioChunksRef, autoTitleTimerRef, candidateNote, candidateNoteRef, composeCloseHandledRef, composeHasContentRef, composerKind, content, contentRef, createdToastShown, currentTag, durationIntervalRef, editorStateRef, ensureLiveDraftId, existingTags, fileUploadRef, flushLiveNote, flushLiveNoteDraft, flushLiveNoteDraftRef, ghostSuggestion, handleClose, handleContentChange, handleMorphToDetail, hasAnnouncedCreateRef, hasAnnouncedDraftRef, hasBootstrappedDraftRef, insertObjectBlock, insertTextAtCursor, isArticle, isAttachDrawerOpen, isContextDrawerOpen, isDirty, isExpanded, isGuest, isHydrated, isMobile, isPastedRef, isPro, isPublic, isRecording, isTitleManuallyEdited, lastSavedSnapshot, liveDraftIdRef, localIsExpanded, mediaRecorderRef, migrateDraftId, onPickFile, openPro, pasteTimerRef, pendingBlockDelete, persistedIsGuest, persistedIsPublic, recordingDuration, recordingTimerRef, removeTag, resolvedNoteId, saveComposerNote, scheduleLiveNoteSync, setComposerKind, setContent, setCurrentTag, setIsArticle, setIsAttachDrawerOpen, setIsAttachingFile, setIsCheckingUrl, setIsContextDrawerOpen, setIsGuest, setIsHydrated, setIsMobile, setIsPublic, setIsRecording, setIsSaving, setIsTitleManuallyEdited, setIsUploadingVoice, setLastSavedSnapshot, setLocalIsExpanded, setPendingBlockDelete, setPersistedIsGuest, setPersistedIsPublic, setRecordingDuration, setResolvedNoteId, setTags, setTitle, snapshot, suggestions, syncTimerRef, tags, title, toggleExpand, toggleRecording });
  const existingTags = useMemo(() => {
    const tagSet = new Set<string>();
    for (const t of ecosystemTags.map(t => t.name).filter(Boolean) as string[]) tagSet.add(t);
    try {
      const { notes: ctxNotes } = { notes: allNotes } as any;
      for (const n of (ctxNotes as Notes[]) || []) {
        for (const tag of (n.tags as string[]) || []) if (tag?.trim()) tagSet.add(tag.trim());
      }
    } catch {}
    if (tagSet.size === 0) {
      try {
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
    const hydrate = (..._args: any[]) => hydrate_ext({ _attachUrl, _filteredExistingTags, _handlePaste, _handleTagKeyDown, _isAttachingFile, _isCheckingUrl, _isSaving, _isTagDropdownOpen, _isUploadingVoice, _persist, _setIsTagDropdownOpen, _wrapSelection, acceptGhost, allNotesRef, appendTag, applyContentDraft, applyPersistSnapshot, audioChunksRef, autoTitleTimerRef, candidateNote, candidateNoteRef, composeCloseHandledRef, composeHasContentRef, composerKind, content, contentRef, createdToastShown, currentTag, durationIntervalRef, editorStateRef, ensureLiveDraftId, existingTags, fileUploadRef, flushLiveNote, flushLiveNoteDraft, flushLiveNoteDraftRef, ghostSuggestion, handleClose, handleContentChange, handleMorphToDetail, hasAnnouncedCreateRef, hasAnnouncedDraftRef, hasBootstrappedDraftRef, hydrate, insertObjectBlock, insertTextAtCursor, isArticle, isAttachDrawerOpen, isContextDrawerOpen, isDirty, isExpanded, isGuest, isHydrated, isMobile, isPastedRef, isPro, isPublic, isRecording, isTitleManuallyEdited, lastSavedSnapshot, liveDraftIdRef, localIsExpanded, mediaRecorderRef, migrateDraftId, onPickFile, openPro, pasteTimerRef, pendingBlockDelete, persistedIsGuest, persistedIsPublic, recordingDuration, recordingTimerRef, removeTag, resolvedNoteId, saveComposerNote, scheduleLiveNoteSync, setComposerKind, setContent, setCurrentTag, setIsArticle, setIsAttachDrawerOpen, setIsAttachingFile, setIsCheckingUrl, setIsContextDrawerOpen, setIsGuest, setIsHydrated, setIsMobile, setIsPublic, setIsRecording, setIsSaving, setIsTitleManuallyEdited, setIsUploadingVoice, setLastSavedSnapshot, setLocalIsExpanded, setPendingBlockDelete, setPersistedIsGuest, setPersistedIsPublic, setRecordingDuration, setResolvedNoteId, setTags, setTitle, snapshot, suggestions, syncTimerRef, tags, title, toggleExpand, toggleRecording });
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
  useEffect(() => {
    const hasContent = Boolean(title.trim() || content.trim() || tags.length);
    if (!hasContent) return;
    scheduleLiveNoteSync();
  }, [title, tags, isPublic, isGuest, scheduleLiveNoteSync]);
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
  return <CreateNoteFormView {...({ _attachUrl, _filteredExistingTags, _handlePaste, _handleTagKeyDown, _isAttachingFile, _isCheckingUrl, _isSaving, _isTagDropdownOpen, _isUploadingVoice, _persist, _setIsTagDropdownOpen, _wrapSelection, acceptGhost, allNotesRef, alreadyExistsInNote, appendTag, applyContentDraft, applyPersistSnapshot, audioChunksRef, autoTitleTimerRef, autosaveFields, available, bucketId, cancelled, candidateNote, candidateNoteRef, cardTitle, checkMobile, childKind, composeCloseHandledRef, composeHasContentRef, composerKind, content, contentRef, controlledIsExpanded, createdToastShown, curContent, curIsGuest, curIsManuallyEdited, curIsPublic, curTags, curTitle, currentTag, cursor, draftId, durationIntervalRef, editor, editorStateRef, el, end, ensureLiveDraftId, ephemeralId, existing, existingId, existingMatch, existingTags, fallbackTitle, file, fileUploadRef, finalDraft, finalTag, flushLiveNote, flushLiveNoteDraft, flushLiveNoteDraftRef, genTitle, generated, generatedTitle, ghostSuggestion, handleClose, handleContentChange, handleMorphToDetail, hasAnnouncedCreateRef, hasAnnouncedDraftRef, hasAnyDraft, hasBootstrappedDraftRef, hasContent, href, hydrate, id, initialContent, input, insertObjectBlock, insertTextAtCursor, insertion, isArticle, isAttachDrawerOpen, isContextDrawerOpen, isDirty, isExpanded, isGuest, isHydrated, isMobile, isPastedRef, isPro, isPublic, isRecording, isTitleManuallyEdited, lastSavedSnapshot, liveDraftIdRef, liveGuestState, livePublicState, localIsExpanded, localNote, lower, matchedGoals, mediaRecorderRef, migrateDraftId, mobile, needsLeadingBreak, needsTrailingBreak, next, nextContent, nextValue, normalizedTags, noteId, noteKind, now, onClose, onNoteCreated, onPickFile, onRegisterClose, onToggleExpand, openPro, pasteTimerRef, payload, pendingBlockDelete, persistedIsGuest, persistedIsPublic, previewTitle, proceed, query, recordingDuration, recordingTimerRef, relation, removeTag, res, resolvedNoteId, resolvedTitleInput, resolves, saveComposerNote, saved, scheduleLiveNoteSync, selected, setComposerKind, setContent, setCurrentTag, setIsArticle, setIsAttachDrawerOpen, setIsAttachingFile, setIsCheckingUrl, setIsContextDrawerOpen, setIsGuest, setIsHydrated, setIsMobile, setIsPublic, setIsRecording, setIsSaving, setIsTitleManuallyEdited, setIsUploadingVoice, setLastSavedSnapshot, setLocalIsExpanded, setPendingBlockDelete, setPersistedIsGuest, setPersistedIsPublic, setRecordingDuration, setResolvedNoteId, setTags, setTitle, shell, shouldCreate, snapshot, start, suggestions, syncTimerRef, tagSet, tags, textarea, title, toggleExpand, toggleRecording, unlocked, uploaded, url })} />;
}
