"use client";

import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { ID } from 'appwrite';
import { 

export function hydrate(bag: any) {
  const {
  _attachUrl,
  _filteredExistingTags,
  _handlePaste,
  _handleTagKeyDown,
  _isAttachingFile,
  _isCheckingUrl,
  _isSaving,
  _isTagDropdownOpen,
  _isUploadingVoice,
  _persist,
  _setIsTagDropdownOpen,
  _wrapSelection,
  acceptGhost,
  allNotesRef,
  appendTag,
  applyContentDraft,
  applyPersistSnapshot,
  audioChunksRef,
  autoTitleTimerRef,
  candidateNote,
  candidateNoteRef,
  composeCloseHandledRef,
  composeHasContentRef,
  composerKind,
  content,
  contentRef,
  createdToastShown,
  currentTag,
  durationIntervalRef,
  editorStateRef,
  ensureLiveDraftId,
  existingTags,
  fileUploadRef,
  flushLiveNote,
  flushLiveNoteDraft,
  flushLiveNoteDraftRef,
  ghostSuggestion,
  handleClose,
  handleContentChange,
  handleMorphToDetail,
  hasAnnouncedCreateRef,
  hasAnnouncedDraftRef,
  hasBootstrappedDraftRef,
  hydrate,
  insertObjectBlock,
  insertTextAtCursor,
  isArticle,
  isAttachDrawerOpen,
  isContextDrawerOpen,
  isDirty,
  isExpanded,
  isGuest,
  isHydrated,
  isMobile,
  isPastedRef,
  isPro,
  isPublic,
  isRecording,
  isTitleManuallyEdited,
  lastSavedSnapshot,
  liveDraftIdRef,
  localIsExpanded,
  mediaRecorderRef,
  migrateDraftId,
  onPickFile,
  openPro,
  pasteTimerRef,
  pendingBlockDelete,
  persistedIsGuest,
  persistedIsPublic,
  recordingDuration,
  recordingTimerRef,
  removeTag,
  resolvedNoteId,
  saveComposerNote,
  scheduleLiveNoteSync,
  setComposerKind,
  setContent,
  setCurrentTag,
  setIsArticle,
  setIsAttachDrawerOpen,
  setIsAttachingFile,
  setIsCheckingUrl,
  setIsContextDrawerOpen,
  setIsGuest,
  setIsHydrated,
  setIsMobile,
  setIsPublic,
  setIsRecording,
  setIsSaving,
  setIsTitleManuallyEdited,
  setIsUploadingVoice,
  setLastSavedSnapshot,
  setLocalIsExpanded,
  setPendingBlockDelete,
  setPersistedIsGuest,
  setPersistedIsPublic,
  setRecordingDuration,
  setResolvedNoteId,
  setTags,
  setTitle,
  snapshot,
  suggestions,
  syncTimerRef,
  tags,
  title,
  toggleExpand,
  toggleRecording
  } = bag as any;

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
}
