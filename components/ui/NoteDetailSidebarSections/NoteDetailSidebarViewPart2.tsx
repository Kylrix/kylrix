'use client';

import React, { useState, useEffect, useMemo, useRef, useCallback } from 'react';
import { Notes } from '@/types/appwrite';

import { AgenticDiffViewer } from '@/components/agentic/AgenticDiffViewer';
import { KylrixWYSIWYGEditor } from '@/components/editor/KylrixWYSIWYGEditor';

import {

export function NoteDetailSidebarViewPart2(bag: any) {
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

              <button 
                type="button"
                onClick={() => { setShowActionHub(false); setShowProjectLinker(true); }} 
                className="flex items-center gap-2 px-3 py-2 rounded-xl border border-white/10 text-xs font-mono font-bold text-white hover:bg-white/5 hover:text-white transition-colors"
              >
                <FolderKanban className="w-4 h-4" />
                <span>Add to Workspace</span>
              </button>

              <button
                type="button"
                onClick={handleAddToProject}
                className="flex items-center gap-2 px-3 py-2 rounded-xl border border-white/10 text-xs font-mono font-bold text-white hover:bg-white/5 hover:text-white transition-colors"
              >
                <FolderKanban className="w-4 h-4" />
                <span>Add to Project</span>
              </button>

              <button 
                type="button"
                onClick={() => { setShowActionHub(false); rotateNoteLink(); }} 
                disabled={!isPublic} 
                className="flex items-center gap-2 px-3 py-2 rounded-xl border border-white/10 text-xs font-mono font-bold text-white hover:bg-white/5 hover:text-white transition-colors disabled:opacity-40"
              >
                <LockIcon className="w-4 h-4" />
                <span>Rotate Link</span>
              </button>
            </div>

            <div className="border-t border-white/5 pt-3">
              <span className="text-xs font-mono font-bold tracking-wider text-white/45 uppercase block mb-2.5">Suggestions</span>
              {isLoadingSuggestions ? (
                <div className="px-2 py-1 text-xs text-white/40 font-mono flex items-center gap-2">
                  <div className="w-3.5 h-3.5 border border-indigo-500 border-t-transparent rounded-full animate-spin"></div>
                  <span>Loading suggestions...</span>
                </div>
              ) : crossSuggestions.length > 0 ? (
                <div className="flex flex-col gap-2">
                  {crossSuggestions.map(s => (
                    <div key={s.id} className="p-3 bg-indigo-500/5 border border-indigo-500/10 rounded-xl flex justify-between items-center">
                      <div>
                        <span className="text-xs font-bold text-white/85 block">{s.label}</span>
                        <span className="text-xs font-sans text-white/40 block mt-0.5">{s.description}</span>
                      </div>
                      <button type="button" onClick={() => window.open(`https://kylrix.space/integrations?action=${s.id}`, '_blank')} className="px-2.5 py-1 bg-indigo-500 hover:bg-indigo-400 text-black font-extrabold text-xs font-mono rounded-lg transition-colors">
                        USE
                      </button>
                    </div>
                  ))}
                </div>
              ) : (
                <span className="text-xs font-mono text-white/30 italic">No suggestions available</span>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Delete uses unified chrome: bottom drawer on mobile, right sidebar on desktop (ui.chrome-surfaces) — local fixed modal retired */}

      <ConfirmationDialog 
        open={showRotateConfirm} 
        title="Rotate public link?" 
        message="The previous link will become permanently invalid. Anyone with the old link will lose access." 
        confirmLabel={isRotating ? "Rotating..." : "Rotate Link"} 
        isDestructive={true} 
        isLoading={isRotating} 
        onClose={() => setShowRotateConfirm(false)} 
        onConfirm={handleConfirmedRotate} 
      />
      
      <ProjectLinker 
        open={showProjectLinker} 
        onClose={() => setShowProjectLinker(false)} 
        entityId={liveNote.$id} 
        entityKind="note" 
      />

      {/* Tag Selector Sub-Drawer */}
      <Drawer
        anchor="bottom"
        open={isTagSelectorOpen}
        onClose={() => setIsTagSelectorOpen(false)}
        disablePortal={false}
        keepMounted={false}
        ModalProps={{ keepMounted: false, disableScrollLock: false }}
        sx={{
          zIndex: 11000,
          '& .ob-drawer-panel': {
            bgcolor: '#161412',
            borderTopLeftRadius: '24px',
            borderTopRightRadius: '24px',
            border: '1px solid #34322F',
            borderBottom: 0,
            pb: 'max(24px, env(safe-area-inset-bottom))',
            pt: 2,
            px: { xs: 2.25, sm: 2.75 },
            maxWidth: '600px',
            mx: 'auto'}
        }}
      >
        <Stack direction="row" alignItems="center" justifyContent="space-between" sx={{ mb: 3 }}>
          <Stack direction="row" spacing={1.5} alignItems="center">
            <TagIcon size={20} color="#6366F1" />
            <Typography sx={{ color: '#fff', fontWeight: 900, fontSize: '1.1rem', fontFamily: 'var(--font-clash)', letterSpacing: '-0.02em' }}>
              Select Tags
            </Typography>
          </Stack>
          <IconButton
            onClick={() => setIsTagSelectorOpen(false)}
            sx={{
              color: '#E8E6E3',
              bgcolor: '#0A0908',
              border: '1px solid #34322F',
              '&:hover': { bgcolor: '#1C1A18' }}}
          >
            <CloseIcon size={18} />
          </IconButton>
        </Stack>

        <Box sx={{ maxHeight: '40dvh', overflowY: 'auto', pr: 0.5 }}>
          <List sx={{ py: 0 }}>
            <ListItem disablePadding sx={{ mb: 1 }}>
              <ListItemButton 
                onClick={() => {
                  setIsTagSelectorOpen(false);
                  openUnified('new-tag', { 
                    onSuccess: async () => {
                      await refreshEcosystemTags();
                    } 
                    // @ts-ignore
                  });
                }}
                sx={{ 
                  borderRadius: '12px', 
                  bgcolor: alpha('#6366F1', 0.1),
                  border: `1px dashed ${alpha('#6366F1', 0.3)}`,
                  py: 1.5,
                  '&:hover': { bgcolor: alpha('#6366F1', 0.15) }
                }}
              >
                <Plus size={18} color="#6366F1" style={{ marginRight: '12px' }} />
                <ListItemText 
                  primary="Create New Tag" 
                  primaryTypographyProps={{ sx: { color: '#6366F1', fontWeight: 800, fontSize: '0.9rem' } }}
                />
              </ListItemButton>
            </ListItem>

            {(() => {
              const seenLower = new Set<string>();
              const uniqueTags = (ecosystemTags || []).filter((tag) => {
                const key = String(tag.name || '').trim().toLowerCase();
                if (!key || seenLower.has(key)) return false;
                seenLower.add(key);
                return true;
              });

              return uniqueTags.map((tag) => {
                const currentTagsArray = tags.split(',').map((t: string) => t.trim()).filter(Boolean);
                const tagLower = (tag.name || '').trim().toLowerCase();
                const isSelected = currentTagsArray.some((t) => t.toLowerCase() === tagLower);
                const color = (tag as any).color || '#9B9691';

                return (
                  <ListItem key={tag.$id} disablePadding sx={{ mb: 0.5 }}>
                    <ListItemButton 
                      onClick={() => {
                        let nextTagsArray = [...currentTagsArray];
                        if (!isSelected && tag.name) {
                          nextTagsArray.push(tag.name.trim());
                        } else if (isSelected && tag.name) {
                          nextTagsArray = nextTagsArray.filter((n) => n.toLowerCase() !== tagLower);
                        }
                        setTags(nextTagsArray.join(', '));
                        setIsTagSelectorOpen(false);
                      }}
                    sx={{ 
                      borderRadius: '12px', 
                      py: 1.5,
                      border: '1px solid transparent',
                      borderColor: isSelected ? color : 'transparent',
                      bgcolor: isSelected ? alpha(color, 0.1) : 'transparent',
                      '&:hover': { bgcolor: '#1C1A18' }
                    }}
                  >
                    <Box 
                      sx={{ 
                        width: 12, 
                        height: 12, 
                        borderRadius: '4px', 
                        bgcolor: color, 
                        mr: 2,
                        boxShadow: `0 0 10px ${alpha(color, 0.4)}`
                      }} 
                    />
                    <ListItemText 
                      primary={(tag.name || '').toUpperCase()} 
                      primaryTypographyProps={{ 
                        sx: { 
                          color: isSelected ? 'white' : '#9B9691', 
                          fontWeight: 900, 
                          fontSize: '0.8rem',
                          fontFamily: 'var(--font-mono)',
                          letterSpacing: '0.05em'
                        } 
                      }}
                    />
                    {isSelected && (
                      <Typography sx={{ color: color, fontWeight: 900, fontSize: '0.7rem', opacity: 0.8 }}>
                        SELECTED
                      </Typography>
                    )}
                  </ListItemButton>
                </ListItem>
              );
            })
          })()}
          </List>
        </Box>
      </Drawer>

      {!isDesktop && isContextDrawerOpen && (
        <Drawer
          anchor="bottom"
          open={isContextDrawerOpen}
          onClose={closeContextActions}
          disablePortal={false}
          keepMounted={false}
          sx={{ zIndex: 11000 }}
          PaperProps={{
            sx: {
              position: 'fixed !important',
              bottom: '0 !important',
              left: '0 !important',
              right: '0 !important',
              borderTopLeftRadius: '24px',
              borderTopRightRadius: '24px',
              bgcolor: '#161412',
              borderTop: '1px solid rgba(255, 255, 255, 0.08)',
              backgroundImage: 'none',
              maxWidth: 580,
              width: '100%',
              maxHeight: '60vh',
              mx: 'auto',
              p: 0,
              overflow: 'hidden',
              pointerEvents: 'auto',
            },
          }}
          ModalProps={{
            keepMounted: false,
            disableScrollLock: false,
          }}
        >
          {renderContextActionsContent()}
        </Drawer>
      )}

      {isExportDrawerOpen && (
        <Drawer
          anchor="bottom"
          open={isExportDrawerOpen}
          onClose={() => setIsExportDrawerOpen(false)}
          disablePortal={false}
          keepMounted={false}
          sx={{ zIndex: 11000 }}
          PaperProps={{
            sx: {
              position: 'fixed !important',
              bottom: '0 !important',
              left: '0 !important',
              right: '0 !important',
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
              pointerEvents: 'auto'}
          }}
          ModalProps={{
            keepMounted: false,
            disableScrollLock: false}}
        >
          <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1.5, pointerEvents: 'auto' }}>
            <Box sx={{ width: 40, height: 4, borderRadius: 2, bgcolor: '#3D3A36', mx: 'auto', mb: 1 }} aria-hidden />
            <Typography sx={{ fontSize: '0.9rem', fontWeight: 900, color: 'rgba(255,255,255,0.4)', textTransform: 'uppercase', tracking: '0.05em', fontFamily: 'var(--font-mono)', mb: 1, textAlign: 'center' }}>
              Export
            </Typography>
            <button
              type="button"
              onClick={() => {
                setIsExportDrawerOpen(false);
                exportToMarkdown(liveNote.title || 'Note', content || '');
              }}
              className="w-full flex items-center gap-3 px-4 py-3 rounded-xl bg-white/[0.02] border border-white/5 text-sm font-bold text-white hover:bg-white/5 transition-all text-left cursor-pointer"
            >
              <span>Markdown (.md)</span>
            </button>
            <button
              type="button"
              onClick={() => {
                setIsExportDrawerOpen(false);
                exportToPDF(liveNote.title || 'Note', content || '');
              }}
              className="w-full flex items-center gap-3 px-4 py-3 rounded-xl bg-white/[0.02] border border-white/5 text-sm font-bold text-white hover:bg-white/5 transition-all text-left cursor-pointer"
            >
              <span>PDF (.pdf)</span>
            </button>
            <button
              type="button"
              onClick={() => {
                setIsExportDrawerOpen(false);
                exportToDOCX(liveNote.title || 'Note', content || '');
              }}
              className="w-full flex items-center gap-3 px-4 py-3 rounded-xl bg-white/[0.02] border border-white/5 text-sm font-bold text-white hover:bg-white/5 transition-all text-left cursor-pointer"
            >
              <span>Word (.doc)</span>
            </button>
          </Box>
        </Drawer>
      )}

      <ProjectAddObjectModal
        open={isAttachObjectPickerOpen}
        onClose={() => setIsAttachObjectPickerOpen(false)}
        mode="resource"
        title="Attach object"
        onAttachResource={attachPickedObject}
        initialTab={0}
      />

      {pendingBlockDelete && (
        <Drawer
          anchor={isDesktop ? 'right' : 'bottom'}
          open={Boolean(pendingBlockDelete)}
          onClose={() => setPendingBlockDelete(null)}
          ModalProps={{ keepMounted: false, disablePortal: false }}
          slotProps={{ backdrop: { sx: { bgcolor: 'rgba(0,0,0,0.5)', backdropFilter: 'blur(4px)' } } } as any}
          PaperProps={{ sx: isDesktop ? { bgcolor: '#161412', borderLeft: '1px solid #34322F', width: 420, maxWidth: '92vw', height: '100%', p: 2.5, zIndex: 1400 } as any : { bgcolor: '#161412', borderTop: '1px solid #34322F', borderTopLeftRadius: '24px', borderTopRightRadius: '24px', p: 2, zIndex: 1400 } as any }}
        >
          <div className="space-y-3">
            <p className="text-sm font-bold text-white">Remove this {pendingBlockDelete.payload.childKind} object?</p>
            <p className="text-xs text-white/60">This removes the object block from markdown and detaches the relation row.</p>
            <div className="flex items-center gap-2">
              <button type="button" className="h-9 px-3 rounded-lg border border-white/10 text-white/80" onClick={() => setPendingBlockDelete(null)}>Cancel</button>
              <button
                type="button"
                className="h-9 px-3 rounded-lg bg-red-500/15 border border-red-500/35 text-red-300"
                onClick={async () => {
                  const block = pendingBlockDelete;
                  if (!block) return;
                  const next = content.slice(0, block.start) + content.slice(block.end);
                  await replaceContentWithSave(next);
                  try {
                    const { detachObjectByRelation, getObjectsByParent } = await import('@/lib/actions/client-ops');
                    await detachObjectByRelation({ parentId: liveNote.$id, childId: block.payload.childId });
                    setAttachedObjects(await getObjectsByParent(liveNote.$id, 'note'));
                  } catch {}
                  setPendingBlockDelete(null);
                }}
              >
                Remove
              </button>
            </div>
          </div>
        </Drawer>
      )}

      {isObjectPermissionInfoOpen && (
        <Drawer
          anchor="bottom"
          open={isObjectPermissionInfoOpen}
          onClose={() => setIsObjectPermissionInfoOpen(false)}
          ModalProps={{ keepMounted: false, disablePortal: true }}
          PaperProps={{ sx: { bgcolor: '#161412', borderTop: '1px solid #34322F', borderTopLeftRadius: '24px', borderTopRightRadius: '24px', p: 2.25 } }}
        >
          <div className="space-y-2.5">
            <p className="text-sm font-black text-white">Attached object permissions</p>
            <p className="text-xs text-white/70 leading-relaxed">
              Every secondary object attached to this note keeps the permission system of its own primary object.
              If someone cannot access that primary object, they will see no access here too.
            </p>
            <p className="text-xs text-white/55 leading-relaxed">
              Projects are the only place with granular overrides. Notes do not override attached object permissions.
            </p>
            <div className="pt-1">
              <button
                type="button"
                className="h-9 px-3 rounded-lg border border-white/10 text-white/80 hover:text-white hover:bg-white/5"
                onClick={() => setIsObjectPermissionInfoOpen(false)}
              >
                Close
              </button>
            </div>
          </div>
        </Drawer>
      )}

      <input
        ref={objectUploadInputRef}
        type="file"
        className="hidden"
        onChange={onPickExternalFile}
      />

    </div>
  );
    </>
  );
}
