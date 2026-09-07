"use client";

import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { ID } from 'appwrite';
import { 

export function CreateNoteFormView(bag: any) {
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
    alreadyExistsInNote,
    appendTag,
    applyContentDraft,
    applyPersistSnapshot,
    audioChunksRef,
    autoTitleTimerRef,
    autosaveFields,
    available,
    bucketId,
    cancelled,
    candidateNote,
    candidateNoteRef,
    cardTitle,
    checkMobile,
    childKind,
    composeCloseHandledRef,
    composeHasContentRef,
    composerKind,
    content,
    contentRef,
    controlledIsExpanded,
    createdToastShown,
    curContent,
    curIsGuest,
    curIsManuallyEdited,
    curIsPublic,
    curTags,
    curTitle,
    currentTag,
    cursor,
    draftId,
    durationIntervalRef,
    editor,
    editorStateRef,
    el,
    end,
    ensureLiveDraftId,
    ephemeralId,
    existing,
    existingId,
    existingMatch,
    existingTags,
    fallbackTitle,
    file,
    fileUploadRef,
    finalDraft,
    finalTag,
    flushLiveNote,
    flushLiveNoteDraft,
    flushLiveNoteDraftRef,
    genTitle,
    generated,
    generatedTitle,
    ghostSuggestion,
    handleClose,
    handleContentChange,
    handleMorphToDetail,
    hasAnnouncedCreateRef,
    hasAnnouncedDraftRef,
    hasAnyDraft,
    hasBootstrappedDraftRef,
    hasContent,
    href,
    hydrate,
    id,
    initialContent,
    input,
    insertObjectBlock,
    insertTextAtCursor,
    insertion,
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
    liveGuestState,
    livePublicState,
    localIsExpanded,
    localNote,
    lower,
    matchedGoals,
    mediaRecorderRef,
    migrateDraftId,
    mobile,
    needsLeadingBreak,
    needsTrailingBreak,
    next,
    nextContent,
    nextValue,
    normalizedTags,
    noteId,
    noteKind,
    now,
    onClose,
    onNoteCreated,
    onPickFile,
    onRegisterClose,
    onToggleExpand,
    openPro,
    pasteTimerRef,
    payload,
    pendingBlockDelete,
    persistedIsGuest,
    persistedIsPublic,
    previewTitle,
    proceed,
    query,
    recordingDuration,
    recordingTimerRef,
    relation,
    removeTag,
    res,
    resolvedNoteId,
    resolvedTitleInput,
    resolves,
    saveComposerNote,
    saved,
    scheduleLiveNoteSync,
    selected,
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
    shell,
    shouldCreate,
    snapshot,
    start,
    suggestions,
    syncTimerRef,
    tagSet,
    tags,
    textarea,
    title,
    toggleExpand,
    toggleRecording,
    unlocked,
    uploaded,
    url
  } = bag as any;
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
                setTitle(val);
                setIsTitleManuallyEdited(true);
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
              onKeyDown={(e) => {
                if (
                  (e.key === 'ArrowRight' || e.key === 'Tab') &&
                  ghostSuggestion &&
                  e.currentTarget.selectionStart === e.currentTarget.value.length
                ) {
                  e.preventDefault();
                  acceptGhost();
                  return;
                }
                handleAgentKeyDown(e);
                handleAutoKeyDown(e);
              }}
              onPaste={(_e) => {
                isPastedRef.current = true;
                if (pasteTimerRef.current) clearTimeout(pasteTimerRef.current);
                pasteTimerRef.current = setTimeout(() => {
                  isPastedRef.current = false;
                }, 2000);
              }}
              className="w-full flex-1 min-h-[180px] resize-none bg-transparent text-white placeholder-white/25 border-0 focus:outline-none p-2 text-base leading-relaxed scrollbar-thin font-satoshi"
            />
            <TypeIntelGhostLayer
              draft={content}
              suggestion={ghostSuggestion}
              enabled={Boolean(ghostSuggestion) || createWithAgent}
              showWand={createWithAgent}
              busy={agentBusy}
              accent={agentAccent}
              onAccept={acceptGhost}
              onTakeover={() => void runTakeover()}
              className="p-2 text-base leading-relaxed font-satoshi"
            />

            <TypeIntelToggle
              enabled={createWithAgent}
              onToggle={persistAgent}
              locked={!isPro}
              onLockedAttempt={openPro}
              accent={agentAccent}
              learningStatus={learningStatus}
              learningLabel={learningLabel}
              busy={agentBusy}
              className="mt-1.5"
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
