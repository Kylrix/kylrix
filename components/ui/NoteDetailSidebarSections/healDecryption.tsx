'use client';

import React, { useState, useEffect, useMemo, useRef, useCallback } from 'react';
import { Notes } from '@/types/appwrite';

import { AgenticDiffViewer } from '@/components/agentic/AgenticDiffViewer';
import { KylrixWYSIWYGEditor } from '@/components/editor/KylrixWYSIWYGEditor';

import {

export function healDecryption(bag: any) {
  const {
  _attachedObjects,
  _hasCollaborators,
  _isAttachingObject,
  _isLoadingEvents,
  _isLoadingSecrets,
  _isLoadingTasks,
  _linkedEvents,
  _linkedSecrets,
  _linkedTasks,
  _setIsPublic,
  allNotesRef,
  attachPickedObject,
  audioChunksRef,
  awaitingLocalCopy,
  canAttachSecondaryObject,
  closeContextActions,
  collaboratorProfiles,
  content,
  contentTextareaRef,
  crossSuggestions,
  displayTags,
  durationIntervalRef,
  getCursorLineNumber,
  handleAddToProject,
  handleBackClick,
  handleConfirmedRotate,
  handleContentChange,
  handleCopyShareLink,
  handleCreateTaskFromNote,
  handleDelete,
  handleDismiss,
  handlePinToggle,
  handleTagsChange,
  handleTitleChange,
  handleTogglePublic,
  hasRestoredScrollRef,
  healDecryption,
  insertObjectBlockAtCursor,
  isAttachObjectPickerOpen,
  isContextDrawerOpen,
  isCreatingTaskFromNote,
  isDesktop,
  isEncryptedNote,
  isExportDrawerOpen,
  isLoadingCollaborators,
  isLoadingSuggestions,
  isLocallyDecrypted,
  isObjectPermissionInfoOpen,
  isPageLayout,
  isPinnedFunc,
  isPublic,
  isRecording,
  isRotating,
  isT4Encrypted,
  isTagSelectorOpen,
  linkedCredentialIds,
  linkedEventIds,
  linkedTaskIds,
  liveNote,
  liveNoteRef,
  mediaRecorderRef,
  noteLinks,
  noteMeta,
  noteRef,
  objectUploadInputRef,
  onPickExternalFile,
  pendingBlockDelete,
  pendingSelRef,
  pinNoteFunc,
  previousContentRef,
  recordingDuration,
  recordingTimerRef,
  renderContextActionsContent,
  replaceContentWithSave,
  rotateNoteLink,
  scrollContainerRef,
  setAttachedObjects,
  setCollaboratorProfiles,
  setContent,
  setCrossSuggestions,
  setIsAttachObjectPickerOpen,
  setIsAttachingObject,
  setIsContextDrawerOpen,
  setIsCreatingTaskFromNote,
  setIsDesktop,
  setIsExportDrawerOpen,
  setIsLoadingCollaborators,
  setIsLoadingEvents,
  setIsLoadingSecrets,
  setIsLoadingSuggestions,
  setIsLoadingTasks,
  setIsLocallyDecrypted,
  setIsObjectPermissionInfoOpen,
  setIsRecording,
  setIsRotating,
  setIsTagSelectorOpen,
  setLinkedEvents,
  setLinkedSecrets,
  setLinkedTasks,
  setPendingBlockDelete,
  setRecordingDuration,
  setShowActionHub,
  setShowProjectLinker,
  setShowRotateConfirm,
  setTags,
  setTitle,
  setVaultUnlocked,
  shouldMaskEncrypted,
  showActionHub,
  showProjectLinker,
  showRotateConfirm,
  tags,
  title,
  toggleRecording,
  unpinNoteFunc,
  updateLocalAndParentNote,
  vaultUnlocked
  } = bag as any;

        try {
          const decrypted = await decryptPublicEncryptedNote(liveNote);
          if (decrypted) {
            setTitle(decrypted.title || '');
            setContent(decrypted.content || '');
            setTags(decrypted.tags?.join(', ') || '');
            setIsLocallyDecrypted(true);
            updateLocalAndParentNote(decrypted);
            showSuccess('Note decrypted', 'Content is now visible.');
          }
        } catch (err) {
          console.error('[NoteSidebar] Auto-decryption failed:', err);
        }
}
