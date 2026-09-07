"use client";

import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { ID } from 'appwrite';
import { 

export function toggleRecording(bag: any) {
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
}
