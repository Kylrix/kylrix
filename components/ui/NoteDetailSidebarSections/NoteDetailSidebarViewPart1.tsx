'use client';

import React, { useState, useEffect, useMemo, useRef, useCallback } from 'react';
import { Notes } from '@/types/appwrite';

import { AgenticDiffViewer } from '@/components/agentic/AgenticDiffViewer';
import { KylrixWYSIWYGEditor } from '@/components/editor/KylrixWYSIWYGEditor';

import {

export function NoteDetailSidebarViewPart1(bag: any) {
  const {
    _attachedObjects,
    _hasCollaborators,
    _isAttachingObject,
    _isLoading,
    _isLoadingEvents,
    _isLoadingSecrets,
    _isLoadingTasks,
    _linkedEvents,
    _linkedSecrets,
    _linkedTasks,
    _setIsPublic,
    accessRole,
    active,
    allNotesRef,
    attachPickedObject,
    audioBlob,
    audioChunksRef,
    audioFile,
    awaitingLocalCopy,
    beforeCursor,
    block,
    bucketId,
    canAttachSecondaryObject,
    channel,
    childKind,
    closeContextActions,
    collaboratorProfiles,
    content,
    contentTextareaRef,
    crossSuggestions,
    cur,
    cursor,
    data,
    decrypted,
    displayTags,
    durationIntervalRef,
    end,
    exists,
    fetchCollaborators,
    fetchEvents,
    fetchObjects,
    fetchSecrets,
    fetchSuggest,
    fetchTasks,
    file,
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
    hasSeedBody,
    healDecryption,
    inContext,
    insertObjectBlockAtCursor,
    insertion,
    isAttachObjectPickerOpen,
    isContextDrawerOpen,
    isCreatingTaskFromNote,
    isDesktop,
    isDirty,
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
    lastEdit,
    layout,
    line,
    linkedCredentialIds,
    linkedEventIds,
    linkedTaskIds,
    liveNote,
    liveNoteRef,
    m,
    mediaRecorder,
    mediaRecorderRef,
    needsLeadingBreak,
    needsTrailingBreak,
    next,
    nextContent,
    normalizedTags,
    note,
    noteId,
    noteLinks,
    noteMeta,
    noteRef,
    objectUploadInputRef,
    on,
    onBack,
    onClose,
    onDelete,
    onPickExternalFile,
    onUpdate,
    options,
    pendingBlockDelete,
    pendingSelRef,
    pinNoteFunc,
    pinned,
    previous,
    previousContentRef,
    raw,
    readOnly,
    recordingDuration,
    recordingTimerRef,
    relation,
    remoteNewer,
    removedBlocks,
    renderContextActionsContent,
    replaceContentWithSave,
    resolved,
    rotateNoteLink,
    rows,
    saved,
    scrollContainerRef,
    seed,
    selectionStart,
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
    shareUrl,
    shouldMaskEncrypted,
    showActionHub,
    showExpandButton,
    showHeaderDeleteButton,
    showProjectLinker,
    showRotateConfirm,
    start,
    stream,
    tags,
    task,
    text,
    textarea,
    theme,
    title,
    titleActive,
    toggleRecording,
    unlocked,
    unpinNoteFunc,
    unsub,
    updateLocalAndParentNote,
    updated,
    uploaded,
    url,
    userId,
    value,
    vaultUnlocked
  } = bag as any;
  return (
    <>
    <div
      className={`note-detail-sidebar-root flex flex-col text-white w-full ${
        isPageLayout
          ? 'min-h-screen overflow-visible bg-[#000000]'
          : 'h-full overflow-hidden bg-[#161412]'
      }`}
    >
      {/* Header */}
      <div
        className={`flex flex-col gap-3 border-b-2 border-white/20 bg-[#161412] shrink-0 ${
          isPageLayout ? 'px-4 md:px-5 pt-1 pb-3' : 'p-4 pb-3'
        }`}
      >
        {/* Row 1: Back + title */}
        <div className="flex items-center justify-between gap-3 min-w-0">
          <div className="flex items-center gap-2.5 flex-1 min-w-0">
            <button
              type="button"
              onClick={handleBackClick}
              className="w-9 h-9 rounded-xl flex items-center justify-center text-white/55 hover:text-white hover:bg-white/[0.05] border border-white/5 flex-shrink-0 transition-colors"
              aria-label="Back to ideas"
            >
              <BackIcon className="w-4 h-4" />
            </button>

            {isEncryptedNote ? (
              <button
                type="button"
                onClick={() => !vaultUnlocked && promptSudo()}
                className="min-w-0 flex-1 text-left"
              >
                <span className="text-[#6366F1] font-extrabold font-clash text-lg leading-tight truncate block">
                  {vaultUnlocked ? 'Decrypting secure note…' : 'Locked note'}
                </span>
              </button>
            ) : readOnly ? (
              <span className="w-full min-w-0 text-[#6366F1] font-extrabold text-lg font-clash tracking-tight leading-tight truncate block">
                {title || 'Untitled note'}
              </span>
            ) : (
              <BareMetalInput
                key={`title-${liveNote.$id}`}
                defaultValue={title}
                value={title}
                onValueChange={handleTitleChange}
                enableLocalEngine={false}
                className="w-full min-w-0 bg-transparent text-[#6366F1] font-extrabold text-lg font-clash tracking-tight leading-tight border-none focus:outline-none placeholder:text-white/25"
                placeholder="Untitled note"
                aria-label="Note title"
              />
            )}
          </div>

          {!onBack && !isPageLayout && (
            <button
              type="button"
              onClick={handleDismiss}
              className="w-9 h-9 rounded-xl flex items-center justify-center text-white/55 hover:text-white hover:bg-white/[0.05] border border-white/5 hidden sm:inline-flex shrink-0 transition-colors"
              title="Close"
            >
              <CloseIcon className="w-4 h-4" />
            </button>
          )}
        </div>

        {/* Row 2: Action Buttons Row */}
        <div className="flex items-center gap-1.5 flex-wrap">
          {/* Copyable Object ID & Workspace ID Badges */}
          {liveNote?.$id && (
            <button
              type="button"
              onClick={() => {
                void navigator.clipboard.writeText(liveNote.$id);
                showSuccess('Copied Object ID', liveNote.$id);
              }}
              className="px-2 py-0.5 rounded-md bg-white/[0.04] hover:bg-white/[0.08] border border-white/10 text-[11px] font-mono text-white/70 hover:text-white transition-colors flex items-center gap-1 cursor-pointer"
              title="Click to copy Object ID"
            >
              <span className="text-white/40 select-none">ID:</span>
              <span className="truncate max-w-[100px]">{liveNote.$id}</span>
            </button>
          )}

          {activeWorkspace && !activeWorkspace.isPersonal && (
            <button
              type="button"
              onClick={() => {
                void navigator.clipboard.writeText(activeWorkspace.id);
                showSuccess('Copied Workspace ID', activeWorkspace.id);
              }}
              className="px-2 py-0.5 rounded-md bg-indigo-500/10 hover:bg-indigo-500/20 border border-indigo-500/20 text-[11px] font-mono text-indigo-300 hover:text-indigo-200 transition-colors flex items-center gap-1 cursor-pointer"
              title="Click to copy Workspace ID"
            >
              <span className="text-indigo-400/50 select-none">WS:</span>
              <span className="truncate max-w-[100px]">{activeWorkspace.id}</span>
            </button>
          )}
          {/* Public/Private visibility status toggle — only for owner */}
          {!readOnly && (
            <ShareLockButton 
              resourceType="note"
              resourceId={note.$id}
              isPublic={!!isPublic}
              isGuest={!!(note as any).isGuest}
              accentColor={isPublic ? '#10B981' : '#A855F7'}
              onPublished={({ isPublic, isGuest }) => {
                  const updated = { ...note, isPublic, isGuest };
                  onUpdate(updated);
              }}
              canPublish={true}
            />
          )}

          {/* Action Hub — only for editors */}
          {!readOnly && (
            <button 
              type="button"
              onClick={() => setShowActionHub(true)} 
              className="p-1.5 rounded-lg bg-pink-500/15 border border-pink-500/25 text-pink-400 hover:bg-pink-500/25 transition-colors flex items-center justify-center"
              title="Action Hub"
            >
              <ActionIcon className="w-4 h-4" />
            </button>
          )}

          {/* Agentic Diff Badge indicator when object has agentic edits */}
          {liveNote && (liveNote as any).agenticDiffs && (liveNote as any).agenticDiffs.length > 0 ? (
            <div className="w-full mt-2">
              <AgenticDiffViewer changes={(liveNote as any).agenticDiffs} />
            </div>
          ) : null}

          {/* Voice recorder — only for editors */}
          {!readOnly && !shouldMaskEncrypted && (
            <button 
              type="button"
              onClick={toggleRecording} 
              className={`p-1.5 rounded-lg transition-all flex items-center justify-center border voice-recorder-btn ${
                isRecording 
                  ? 'bg-red-500/15 border-red-500/25 text-red-400 animate-pulse' 
                  : 'bg-white/5 border-white/5 text-white/60 hover:text-white hover:bg-white/10'
              }`}
              title={isRecording ? `Stop (${Math.floor(recordingDuration / 60)}:${(recordingDuration % 60 < 10 ? '0' : '') + (recordingDuration % 60)}) & Insert` : "Record Voice Note"}
            >
              {isRecording ? <Square className="w-4 h-4 fill-red-500 text-red-500" /> : <Mic className="w-4 h-4" />}
            </button>
          )}

          {/* Copy link — available to all (share link reading) */}
          {showExpandButton && isPublic && (
            <button
              type="button"
              onClick={handleCopyShareLink}
              className="p-1.5 rounded-lg bg-white/5 border border-white/5 text-white/60 hover:text-white hover:bg-white/10 transition-colors flex items-center justify-center"
              title="Copy Share Link"
            >
              <LinkIcon className="w-4 h-4" />
            </button>
          )}

          {/* Pin — only for editors */}
          {!readOnly && (
            <button 
              type="button"
              onClick={handlePinToggle} 
              className={`p-1.5 rounded-lg transition-colors flex items-center justify-center border ${
                isPinnedFunc(liveNote.$id) 
                  ? 'bg-indigo-500/15 border-indigo-500/25 text-indigo-400 hover:bg-indigo-500/25' 
                  : 'bg-white/5 border-white/5 text-white/60 hover:text-white hover:bg-white/10'
              }`}
              title={isPinnedFunc(liveNote.$id) ? 'Unpin' : 'Pin'}
            >
              <PinIcon className="w-4 h-4" />
            </button>
          )}

          {/* More actions — always available for export / details */}
          <button 
            type="button"
            onClick={() => {
              if (isDesktop) {
                openNativeSidebar(renderContextActionsContent(), 'note-context-actions', { hideHeader: true });
              } else {
                setIsContextDrawerOpen(true);
              }
            }} 
            className="p-1.5 rounded-lg bg-white/5 border border-white/5 text-white/60 hover:text-white hover:bg-white/10 transition-colors flex items-center justify-center"
            title="More Actions"
          >
            <MoreVertical className="w-4 h-4" />
          </button>

          {/* Read-only badge */}
          {readOnly && (
            <span className="ml-1 px-2 py-0.5 rounded-full bg-white/5 border border-white/8 text-[10px] font-black text-white/40 tracking-wider uppercase">
              Read only
            </span>
          )}

          {/* Header Delete — only for owner */}
          {!readOnly && showHeaderDeleteButton && (
            <button 
              type="button"
              onClick={() => openUnified('delete-confirm', {
                title: `Delete "${title || 'Untitled'}"?`,
                description: 'Are you sure you want to delete this idea? This action is permanent and cannot be undone.',
                resourceName: 'this idea',
                confirmLabel: 'Delete Idea',
                onConfirm: async () => { await handleDelete(); },
              })}
              className="p-1.5 rounded-lg bg-white/5 border border-white/5 text-white/60 hover:text-red-400 hover:bg-red-500/10 hover:border-red-500/20 transition-colors flex items-center justify-center ml-auto"
              title="Delete"
            >
              <TrashIcon className="w-4 h-4" />
            </button>
          )}
        </div>
      </div>

      {/* Content Scroll Area — stable, isolated scroll; local-copy-first, no jitter on attachment/preview loads */}
      <div
        ref={scrollContainerRef}
        onScroll={(e) => {
          if (liveNote?.$id) {
            persistScrollPosition(`note_detail:${liveNote.$id}`, e.currentTarget.scrollTop);
          }
        }}
        style={{ overflowAnchor: 'none' } as React.CSSProperties}
        className={`flex flex-col gap-5 ${
          isPageLayout
            ? 'flex-1 overflow-visible px-4 md:px-5 py-4'
            : 'flex-1 min-h-0 overflow-y-auto scrollbar-thin overscroll-contain p-4 gap-4'
        }`}
      >
        {/* Unified WYSIWYG Editor */}
        <div className="flex flex-col rounded-[24px] bg-[#000000] border-2 border-white/20 overflow-hidden flex-shrink-0">
          <div className="flex flex-wrap items-center justify-between gap-3 px-4 md:px-5 pt-4 pb-3 border-b border-white/5">
            <div className="min-w-0 flex flex-col gap-0.5">
              <span className="text-[10px] font-black uppercase tracking-[0.14em] text-[#6366F1] font-clash">
                Content
              </span>
              {!readOnly && (
                <div className="flex items-center gap-1.5 mt-0.5">
                  <SyncStatusDot noteId={liveNote.$id} kind="note" row={liveNote as unknown as Record<string, unknown>} />
                  <SyncStatusLabel noteId={liveNote.$id} kind="note" row={liveNote as unknown as Record<string, unknown>} />
                </div>
              )}
            </div>

            <div className="flex items-center gap-2 flex-shrink-0">
              {/* Copy button — always visible */}
              {!shouldMaskEncrypted && content && (
                <button
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation();
                    navigator.clipboard.writeText(content);
                    showSuccess('Copied', 'Note content copied to clipboard');
                  }}
                  className="w-8 h-8 rounded-lg flex items-center justify-center bg-[#0B0A09] border border-white/8 text-white/55 hover:text-white hover:bg-white/[0.04] transition-colors cursor-pointer"
                  title="Copy content"
                >
                  <CopyIcon className="w-3.5 h-3.5" />
                </button>
              )}
            </div>
          </div>

          <div className="px-4 md:px-5 py-4 md:py-5 min-h-[280px]">
            {isEncryptedNote ? (
              <button
                type="button"
                onClick={() => !vaultUnlocked && promptSudo()}
                className="min-h-[200px] w-full text-left cursor-pointer"
              >
                <p className="text-[#9B9691] text-sm font-semibold leading-relaxed">
                  {vaultUnlocked
                    ? 'Decrypting secure note, please wait…'
                    : 'Secure content hidden. Unlock your vault to view and edit this note.'}
                </p>
              </button>
            ) : (
              <KylrixWYSIWYGEditor
                value={content}
                onChange={handleContentChange}
                parentId={liveNote.$id}
                parentKind="note"
                readOnly={readOnly || shouldMaskEncrypted}
                placeholder="Write in markdown — headings, lists, links, voice notes, and attachments are rendered live."
                minHeight="280px"
              />
            )}

            {!shouldMaskEncrypted && (
              <div className="flex justify-between items-center mt-3 pt-3 border-t border-white/5 text-[10px] text-[#9B9691] font-semibold select-none">
                <span>{liveNote.article ? 'Article' : 'Note'} · Live Markdown</span>
                <span>{content.length.toLocaleString()} characters</span>
              </div>
            )}
          </div>
        </div>

        {/* Tags */}
        <div className="shrink-0">
          <div className="flex items-center justify-between mb-2.5">
            <span className="text-[10px] font-black uppercase tracking-[0.14em] text-[#6366F1] font-clash">Tags</span>
            {!readOnly && (
              <button
                type="button"
                onClick={() => setIsTagSelectorOpen(true)}
                className="w-7 h-7 rounded-lg hover:bg-white/[0.04] text-[#6366F1]/60 hover:text-[#6366F1] transition-colors flex items-center justify-center"
                title="Edit tags"
              >
                <Plus size={14} />
              </button>
            )}
          </div>
          <div className="flex flex-wrap gap-2">
            {displayTags.length > 0 ? (
              displayTags.map((tag: string) => (
                <span
                  key={tag}
                  className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-[#6366F1]/10 border border-[#6366F1]/20 text-[#6366F1] text-xs font-extrabold"
                >
                  {tag}
                  {!readOnly && (
                    <button
                      type="button"
                      onClick={() => {
                        const newTags = displayTags.filter((t) => t !== tag);
                        handleTagsChange(newTags.join(', '));
                      }}
                      className="hover:text-white"
                    >
                      <CloseIcon size={10} />
                    </button>
                  )}
                </span>
              ))
            ) : (
              <span className="text-[#9B9691] text-xs font-semibold leading-relaxed">No tags yet</span>
            )}
          </div>
        </div>

        {/* Collaborators */}
        <div className="shrink-0 min-h-[44px]">
          <span className="text-[10px] font-black uppercase tracking-[0.14em] text-pink-400 font-clash block mb-2.5">
            Collaborators
          </span>
          {isLoadingCollaborators ? (
            <div className="h-[44px] text-xs text-[#9B9691] font-semibold flex items-center gap-2">
              <div className="w-3.5 h-3.5 border border-pink-500 border-t-transparent rounded-full animate-spin" />
              <span>Loading…</span>
            </div>
          ) : collaboratorProfiles.length > 0 ? (
            <div className="flex flex-col gap-2">
              {collaboratorProfiles.map((p: any) => (
                <button
                  key={p.$id || p.userId}
                  type="button"
                  onClick={() =>
                    openUnified('share-note', {
                      noteId: liveNote.$id,
                      noteTitle: liveNote.title,
                      initialCollaborator: p})
                  }
                  className="w-full p-3 rounded-[16px] bg-[#161412] border border-white/5 flex items-center gap-3 hover:bg-white/[0.02] transition-colors text-left min-w-0"
                >
                  <IdentityAvatar
                    fileId={p.avatar}
                    alt={p.username}
                    fallback={p.username?.[0]?.toUpperCase()}
                    size={34}
                    verified={p.tier === 'admin' || p.verified}
                  />
                  <div className="min-w-0 flex-1 flex flex-col gap-0.5">
                    <span className="text-sm font-extrabold text-white leading-tight truncate">
                      {p.displayName || p.username}
                    </span>
                    <span className="text-[11px] font-semibold text-[#9B9691] leading-snug truncate">
                      @{p.username}
                    </span>
                  </div>
                  <span className="text-[10px] font-black uppercase tracking-wider px-2 py-1 rounded-md bg-pink-500/10 text-pink-400 flex-shrink-0">
                    {p.permissionLevel || 'Viewer'}
                  </span>
                </button>
              ))}
            </div>
          ) : (
            <span className="text-[#9B9691] text-xs font-semibold leading-relaxed">No collaborators</span>
          )}
        </div>

        {/* Timestamps */}
        <div className="pt-3 border-t border-white/5 text-[11px] font-semibold text-[#9B9691] flex flex-col gap-1 shrink-0">
          <span>Created {formatNoteCreatedDate(liveNote)}</span>
          <span>Updated {formatNoteUpdatedDate(liveNote)}</span>
        </div>
      </div>

      {/* Action Hub overlay */}
      {showActionHub && (
        <div className="fixed inset-0 z-[11050] flex items-start justify-center bg-black/70 animate-in fade-in duration-200" onClick={() => setShowActionHub(false)}>
          <div className="w-full max-w-lg md:max-w-[420px] md:ml-auto md:mr-0 md:h-full md:rounded-none rounded-b-[24px] bg-[#161412] border-b md:border-b-0 md:border-l border-white/5 p-5 shadow-2xl flex flex-col gap-4 animate-in slide-in-from-top-1/3 md:slide-in-from-right duration-200" onClick={e => e.stopPropagation()}>
            <div className="flex justify-between items-center">
              <h3 className="font-extrabold font-space-grotesk text-indigo-400 text-sm uppercase tracking-wide">Action Hub</h3>
              <button type="button" onClick={() => setShowActionHub(false)} className="p-1.5 text-white/60 hover:text-white rounded-lg hover:bg-white/5"><CloseIcon className="w-4 h-4" /></button>
            </div>
            
            <div className="flex flex-wrap gap-2">
              <button
                type="button"
                onClick={() => { setShowActionHub(false); void handleTogglePublic(); }}
                className="flex items-center gap-2 px-3 py-2 rounded-xl border border-white/10 text-xs font-mono font-bold text-white hover:bg-white/5 hover:text-white transition-colors"
              >
                {isPublic ? <LockIcon className="w-4 h-4" /> : <UnlockIcon className="w-4 h-4" />}
                <span>{isPublic ? 'Make Private' : 'Make Public'}</span>
              </button>

              <button 
                type="button"
                onClick={handleCreateTaskFromNote} 
                disabled={isCreatingTaskFromNote} 
                className="flex items-center gap-2 px-3 py-2 rounded-xl bg-indigo-600 text-black font-extrabold text-xs font-mono uppercase transition-colors hover:bg-indigo-500 disabled:opacity-50"
              >
                <TaskIcon className="w-4 h-4 text-black" />
                <span>Create Goal</span>
              </button>
    </>
  );
}
