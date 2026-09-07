'use client';

import React, { useState, useEffect, useMemo, useRef, useCallback } from 'react';
import { Notes } from '@/types/appwrite';

import { AgenticDiffViewer } from '@/components/agentic/AgenticDiffViewer';
import { KylrixWYSIWYGEditor } from '@/components/editor/KylrixWYSIWYGEditor';

import {

export function renderContextActionsContent(bag: any) {
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
return ((
    <div className="flex flex-col gap-3 p-5 md:p-6 bg-[#161412] text-white select-none max-h-[60vh] md:max-h-none md:h-full overflow-y-auto">
      {/* Mobile drawer handle only */}
      <div className="w-10 h-1 rounded-full bg-white/15 mx-auto mb-2 md:hidden" aria-hidden />

      {/* Header */}
      <div className="flex items-center justify-between pb-2.5 border-b border-white/5">
        <div className="flex items-center gap-2">
          <ActionIcon className="w-4 h-4 text-[#6366F1]" />
          <span className="text-[11px] font-black uppercase tracking-[0.14em] text-[#6366F1] font-clash">
            Text Actions
          </span>
        </div>
        <button
          type="button"
          onClick={closeContextActions}
          className="w-7 h-7 rounded-lg hover:bg-white/[0.06] text-white/40 hover:text-white transition-colors flex items-center justify-center cursor-pointer"
        >
          <CloseIcon size={14} />
        </button>
      </div>

      {/* Actions List */}
      <div className="flex flex-col gap-2.5 pt-1">
        {/* Zap Idea */}
        <button
          type="button"
          onClick={() => {
            closeContextActions();
            openUnified('zap', {
              targetId: liveNote.$id,
              source: 'ecosystem',
              targetKind: 'note',
              targetOwnerId: (liveNote as any).userId || (note as any).userId,
              authorName: (liveNote as any).userName || (liveNote as any).title || 'Creator',
            });
          }}
          className="w-full flex items-center gap-3.5 p-3.5 rounded-2xl bg-[#0A0908] border border-amber-400/20 hover:border-amber-400/40 hover:bg-amber-400/5 transition-all text-left cursor-pointer group"
        >
          <div className="w-9 h-9 rounded-xl bg-amber-400/10 border border-amber-400/20 flex items-center justify-center text-amber-400 group-hover:scale-105 transition-transform shrink-0">
            <Zap size={18} className="fill-current" />
          </div>
          <div className="flex flex-col min-w-0">
            <span className="text-sm font-bold text-amber-300">Zap Idea (Send rix)</span>
            <span className="text-[11px] font-semibold text-amber-400/60">Tip creator with instant tokens</span>
          </div>
        </button>

        {/* Copy All Content */}
        <button
          type="button"
          onClick={() => {
            navigator.clipboard.writeText(content);
            showSuccess('Copied', 'Entire note content copied to clipboard.');
            closeContextActions();
          }}
          className="w-full flex items-center gap-3.5 p-3.5 rounded-2xl bg-[#0A0908] border border-white/5 hover:border-white/10 hover:bg-white/[0.03] transition-all text-left cursor-pointer group"
        >
          <div className="w-9 h-9 rounded-xl bg-pink-500/10 border border-pink-500/20 flex items-center justify-center text-pink-400 group-hover:scale-105 transition-transform shrink-0">
            <CopyIcon size={18} />
          </div>
          <div className="flex flex-col min-w-0">
            <span className="text-sm font-bold text-white group-hover:text-pink-300 transition-colors">Copy All Content</span>
            <span className="text-[11px] font-semibold text-[#9B9691]">Copy markdown body to clipboard</span>
          </div>
        </button>

        {/* Select All */}
        <button
          type="button"
          onClick={() => {
            closeContextActions();
            setTimeout(() => {
              const textarea = contentTextareaRef.current;
              if (textarea) {
                textarea.focus();
                textarea.select();
              }
            }, 100);
          }}
          className="w-full flex items-center gap-3.5 p-3.5 rounded-2xl bg-[#0A0908] border border-white/5 hover:border-white/10 hover:bg-white/[0.03] transition-all text-left cursor-pointer group"
        >
          <div className="w-9 h-9 rounded-xl bg-purple-500/10 border border-purple-500/20 flex items-center justify-center text-purple-400 group-hover:scale-105 transition-transform shrink-0">
            <TaskIcon size={18} />
          </div>
          <div className="flex flex-col min-w-0">
            <span className="text-sm font-bold text-white group-hover:text-purple-300 transition-colors">Select All</span>
            <span className="text-[11px] font-semibold text-[#9B9691]">Highlight entire editor buffer</span>
          </div>
        </button>

        {/* Paste Clipboard */}
        <button
          type="button"
          onClick={async () => {
            closeContextActions();
            try {
              const text = await navigator.clipboard.readText();
              const textarea = contentTextareaRef.current;
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
          className="w-full flex items-center gap-3.5 p-3.5 rounded-2xl bg-[#0A0908] border border-white/5 hover:border-white/10 hover:bg-white/[0.03] transition-all text-left cursor-pointer group"
        >
          <div className="w-9 h-9 rounded-xl bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-center text-emerald-400 group-hover:scale-105 transition-transform shrink-0">
            <Clipboard size={18} />
          </div>
          <div className="flex flex-col min-w-0">
            <span className="text-sm font-bold text-white group-hover:text-emerald-300 transition-colors">Paste Clipboard</span>
            <span className="text-[11px] font-semibold text-[#9B9691]">Insert text at current cursor</span>
          </div>
        </button>

        {/* Attach Object or Media */}
        {canAttachSecondaryObject && (
          <button
            type="button"
            onClick={() => {
              closeContextActions();
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
                  insertObjectBlockAtCursor(block);
                },
              });
            }}
            className="w-full flex items-center gap-3.5 p-3.5 rounded-2xl bg-[#0A0908] border border-[#6366F1]/20 hover:border-[#6366F1]/40 hover:bg-[#6366F1]/5 transition-all text-left cursor-pointer group"
          >
            <div className="w-9 h-9 rounded-xl bg-[#6366F1]/10 border border-[#6366F1]/20 flex items-center justify-center text-[#6366F1] group-hover:scale-105 transition-transform shrink-0">
              <Plus size={18} />
            </div>
            <div className="flex flex-col min-w-0">
              <span className="text-sm font-bold text-white group-hover:text-[#6366F1] transition-colors">Attach Object</span>
              <span className="text-[11px] font-semibold text-[#9B9691]">Link media, files, or ecosystem items</span>
            </div>
          </button>
        )}

        {/* Disable/Enable Previews */}
        <button
          type="button"
          onClick={async () => {
            const { LocalEngine } = await import('@/lib/services/LocalEngine');
            const userId = (liveNote as any).userId || (note as any).userId || 'guest';
            try {
              const { getDisablePreviews, setDisablePreviews } = await import('@/lib/link-preview/settings');
              const cur = await getDisablePreviews(userId);
              await setDisablePreviews(userId, !cur);
              showSuccess(
                cur ? 'Previews enabled' : 'Previews disabled',
                cur ? 'External link previews will show again.' : 'External previews hidden. Kylrix previews still show.'
              );
            } catch {
              const raw = await LocalEngine.cacheGet<boolean>('kylrix_disable_link_previews').catch(() => null);
              const next = !raw;
              await LocalEngine.cacheSet('kylrix_disable_link_previews', next);
              (window as any).__KylrixDisableLinkPreviews = next;
            }
            closeContextActions();
          }}
          className="w-full flex items-center gap-3.5 p-3.5 rounded-2xl bg-[#0A0908] border border-white/5 hover:border-white/10 hover:bg-white/[0.03] transition-all text-left cursor-pointer group"
        >
          <div className="w-9 h-9 rounded-xl bg-slate-500/10 border border-slate-500/20 flex items-center justify-center text-slate-400 group-hover:scale-105 transition-transform shrink-0">
            <EyeOffIcon size={18} />
          </div>
          <div className="flex flex-col min-w-0">
            <span className="text-sm font-bold text-white group-hover:text-slate-300 transition-colors">Toggle Previews</span>
            <span className="text-[11px] font-semibold text-[#9B9691]">Show or hide external web preview cards</span>
          </div>
        </button>

        {/* Export Document */}
        <button
          type="button"
          onClick={() => {
            closeContextActions();
            setIsExportDrawerOpen(true);
          }}
          className="w-full flex items-center gap-3.5 p-3.5 rounded-2xl bg-[#0A0908] border border-white/5 hover:border-white/10 hover:bg-white/[0.03] transition-all text-left cursor-pointer group"
        >
          <div className="w-9 h-9 rounded-xl bg-amber-400/10 border border-amber-400/20 flex items-center justify-center text-amber-400 group-hover:scale-105 transition-transform shrink-0">
            <OpenIcon size={18} />
          </div>
          <div className="flex flex-col min-w-0">
            <span className="text-sm font-bold text-white group-hover:text-amber-300 transition-colors">Export Note</span>
            <span className="text-[11px] font-semibold text-[#9B9691]">Download or share markdown file</span>
          </div>
        </button>
      </div>
    </div>
  ));
}
