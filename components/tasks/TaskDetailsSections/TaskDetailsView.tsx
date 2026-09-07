'use client';

import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { Priority, TaskStatus, TaskCollaborator, CollaboratorPermission } from '@/types';
import { Query } from 'appwrite';
import { notes as noteApi } from '@/lib/kylrixflow';
import { 

export function TaskDetailsView(bag: any) {
  const {
    _isLoadingAssignees,
    _isSearchingNotes,
    _linkedNoteTitles,
    _noteResults,
    _setIsEditingDescription,
    _setNoteQuery,
    _setTaskCollaboratorRows,
    _taskCollaboratorRows,
    _taskParticipantProfiles,
    active,
    childSubtasks,
    completedSubtasks,
    current,
    currentTask,
    discussionNoteId,
    editDescription,
    editTitle,
    fetchAssigneeProfiles,
    found,
    foundProject,
    handleAddSubtask,
    handleClose,
    handleInitDiscussion,
    handlePriorityChange,
    handleSaveEditTitle,
    handleSendMessage,
    handleStartEditTitle,
    handleStatusChange,
    huddleLoading,
    huddleMessageEndRef,
    huddleMessages,
    huddleSending,
    isEditingDescription,
    isEditingTitle,
    isExportOpen,
    isPaid,
    isPriorityOpen,
    isStatusOpen,
    isTagSelectorOpen,
    known,
    knownNames,
    loadDiscussionComments,
    loadLinkedNotes,
    matchedWorkspace,
    newComment,
    newSubtask,
    nextDescription,
    nextTitle,
    note,
    noteQuery,
    onBack,
    orphans,
    rawInput,
    requirePaidMilestones,
    res,
    searchNotes,
    setEditDescription,
    setEditTitle,
    setHuddleLoading,
    setHuddleMessages,
    setHuddleSending,
    setIsEditingTitle,
    setIsExportOpen,
    setIsLoadingAssignees,
    setIsPriorityOpen,
    setIsSearchingNotes,
    setIsStatusOpen,
    setIsTagSelectorOpen,
    setLinkedNoteTitles,
    setNewComment,
    setNewSubtask,
    setNoteResults,
    setShowProjectLinker,
    setTaskParticipantProfiles,
    showProjectLinker,
    subtaskProgress,
    task,
    taskId,
    taskLabels,
    timer,
    title,
    unsub
  } = bag as any;
  return (
    <div className="flex flex-col h-full bg-[#161412] text-white font-satoshi relative overflow-hidden">
      {/* Ambient radial gradient spotlight */}
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_50%_-20%,rgba(168,85,247,0.12),transparent_60%)] pointer-events-none" />

      {/* Header - Sticky/Fixed at Top */}
      <div className="relative z-20 flex flex-col gap-3 p-5 md:p-6 border-b border-white/[0.08] bg-[#161412] shrink-0">
        {/* Row 1: chrome only — back + actions (title is not on this line) */}
        <div className="flex items-center justify-between gap-3">
          {onBack ? (
            <button
              type="button"
              onClick={onBack}
              className="p-2 text-white hover:text-white rounded-xl hover:bg-white/5 transition-colors shrink-0"
            >
              <ArrowLeft className="w-5 h-5" />
            </button>
          ) : (
            <button
              type="button"
              onClick={handleClose}
              className="p-2 text-white hover:text-white rounded-xl hover:bg-white/5 transition-colors shrink-0 md:hidden"
            >
              <ArrowLeft className="w-5 h-5" />
            </button>
          )}

          <div className="flex items-center gap-1.5 shrink-0 ml-auto flex-wrap">
            {/* Copyable Goal ID & Workspace ID Badges */}
            {task?.id && (
              <button
                type="button"
                onClick={() => {
                  void navigator.clipboard.writeText(task.id);
                  showSuccess('Copied Goal ID', task.id);
                }}
                className="px-2 py-0.5 rounded-md bg-white/[0.04] hover:bg-white/[0.08] border border-white/10 text-[11px] font-mono text-white/70 hover:text-white transition-colors flex items-center gap-1 cursor-pointer"
                title="Click to copy Goal ID"
              >
                <span className="text-white/40 select-none">ID:</span>
                <span className="truncate max-w-[90px]">{task.id}</span>
              </button>
            )}

            {task?.projectId && (
              <button
                type="button"
                onClick={() => {
                  void navigator.clipboard.writeText(task.projectId!);
                  showSuccess('Copied Workspace ID', task.projectId!);
                }}
                className="px-2 py-0.5 rounded-md bg-indigo-500/10 hover:bg-indigo-500/20 border border-indigo-500/20 text-[11px] font-mono text-indigo-300 hover:text-indigo-200 transition-colors flex items-center gap-1 cursor-pointer"
                title="Click to copy Workspace ID"
              >
                <span className="text-indigo-400/50 select-none">WS:</span>
                <span className="truncate max-w-[90px]">{task.projectId}</span>
              </button>
            )}
            <button
              type="button"
              onClick={async () => {
                await completeTask(task.id);
              }}
              className={`p-2 rounded-xl transition-all cursor-pointer ${
                task.status === 'done'
                  ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/30 hover:bg-emerald-500/30'
                  : 'text-[#9B9691] hover:text-emerald-400 hover:bg-white/5'
              }`}
              title={task.status === 'done' ? 'Mark as Incomplete' : 'Mark as Done'}
            >
              <Check className="w-4 h-4" strokeWidth={task.status === 'done' ? 3 : 2} />
            </button>
            <button
              type="button"
              onClick={() => setShowProjectLinker(true)}
              className="p-2 text-[#A855F7] hover:text-white rounded-xl bg-[#A855F7]/10 hover:bg-[#A855F7]/20 transition-all"
              title="Link Workspace"
            >
              <Sparkles className="w-4 h-4" />
            </button>
            <ShareLockButton
              resourceType="goal"
              resourceId={task.id}
              isPublic={!!task.isPublic}
              isGuest={!!task.isGuest}
              resourceTitle={task.title}
              dek={task.dek}
              accentColor="#A855F7"
              onPublished={({ isPublic, isGuest }) => {
                updateTask(task.id, { isPublic, isGuest });
              }}
            />
            <button
              type="button"
              onClick={handleStartEditTitle}
              className="p-2 text-[#9B9691] hover:text-white rounded-xl hover:bg-white/5 transition-all"
              title="Edit Title"
            >
              <Edit3 className="w-4 h-4" />
            </button>
            <div className="relative inline-block">
              <button
                type="button"
                onClick={() => setIsExportOpen(!isExportOpen)}
                className="p-2 text-[#9B9691] hover:text-white rounded-xl hover:bg-white/5 transition-all"
                title="Export Goal"
              >
                <FileText className="w-4 h-4" />
              </button>
              {isExportOpen && (
                <>
                  <div className="fixed inset-0 z-40 bg-transparent" onClick={() => setIsExportOpen(false)} />
                  <div className="absolute right-0 mt-1 w-44 rounded-2xl bg-[#161412] border border-[#34322F] shadow-2xl p-1 z-50 font-satoshi flex flex-col gap-0.5">
                    <button
                      type="button"
                      onClick={() => {
                        setIsExportOpen(false);
                        exportToMarkdown(task.title, task.description || '');
                      }}
                      className="w-full text-left px-3 py-2 text-xs font-bold rounded-xl transition-colors text-[#F5F2ED] hover:bg-white/5"
                    >
                      Export as Markdown
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        setIsExportOpen(false);
                        exportToPDF(task.title, task.description || '');
                      }}
                      className="w-full text-left px-3 py-2 text-xs font-bold rounded-xl transition-colors text-[#F5F2ED] hover:bg-white/5"
                    >
                      Export as PDF
                    </button>
                  </div>
                </>
              )}
            </div>

            <button
              type="button"
              onClick={() => {
                openUnified('delete-confirm', {
                  title: 'Delete Goal?',
                  description: `Are you sure you want to permanently delete "${task.title}"?`,
                  onConfirm: async () => {
                    await deleteTask(task.id);
                    handleClose();
                  }
                });
              }}
              className="p-2 text-[#9B9691] hover:text-red-400 rounded-xl hover:bg-white/5 transition-all"
              title="Delete Goal"
            >
              <Trash2 className="w-4 h-4" />
            </button>
            {!onBack && (
              <button
                type="button"
                onClick={handleClose}
                className="p-2 text-[#9B9691] hover:text-white rounded-xl hover:bg-white/5 transition-all"
                title="Close"
              >
                <X className="w-4 h-4" />
              </button>
            )}
          </div>
        </div>

        {/* Row 2: full-bleed title — free of back/action chrome */}
        <div className="w-full min-w-0 flex flex-col gap-1">
          {isEditingTitle ? (
            <input
              type="text"
              value={editTitle}
              onChange={(e) => setEditTitle(e.target.value)}
              onBlur={handleSaveEditTitle}
              onKeyDown={(e) => e.key === 'Enter' && handleSaveEditTitle()}
              autoFocus
              className="w-full min-w-0 bg-transparent border-0 outline-none text-base md:text-lg font-extrabold font-clash text-white tracking-tight uppercase border-b border-white/10 focus:border-[#A855F7] transition-all py-0.5"
            />
          ) : (
            <h2
              onClick={handleStartEditTitle}
              className="w-full min-w-0 text-base md:text-lg font-extrabold font-clash text-[#A855F7] tracking-tight uppercase break-words [overflow-wrap:anywhere] cursor-pointer hover:text-[#b975ff] transition-colors"
            >
              {task.title}
            </h2>
          )}
          <div className="flex items-center gap-1.5 shrink-0">
            <SyncStatusDot resourceId={goalPendingKey(task.id)} kind="goal" />
            <SyncStatusLabel resourceId={goalPendingKey(task.id)} kind="goal" />
          </div>
        </div>

        {/* Row 3: Status & Priority Dropdowns */}
        <div className="flex items-center gap-2.5">
          {/* Status Dropdown */}
          <div className="relative">
            <button
              type="button"
              onClick={() => {
                setIsStatusOpen(!isStatusOpen);
                setIsPriorityOpen(false);
              }}
              className="flex items-center gap-1.5 px-3 py-1.5 bg-[#1C1A18] border border-[#34322F] text-[10px] font-bold text-[#F5F2ED] rounded-xl hover:border-white/20 transition-colors uppercase tracking-wider font-mono"
            >
              <span className="w-1.5 h-1.5 rounded-full bg-[#A855F7]" />
              <span>Status: {statusLabels[task.status]}</span>
            </button>
            {isStatusOpen && (
              <>
                <div className="fixed inset-0 z-40 bg-transparent" onClick={() => setIsStatusOpen(false)} />
                <div className="absolute left-0 mt-1 w-44 rounded-2xl bg-[#161412] border border-[#34322F] shadow-2xl p-1 z-50 font-satoshi flex flex-col gap-0.5">
                  {Object.entries(statusLabels).map(([status, label]) => (
                    <button
                      key={status}
                      type="button"
                      onClick={() => handleStatusChange(status as TaskStatus)}
                      className={`w-full text-left px-3 py-2 text-xs font-bold rounded-xl transition-colors ${
                        task.status === status
                          ? 'bg-[#A855F7] text-[#0A0908]'
                          : 'text-[#F5F2ED] hover:bg-white/5'
                      }`}
                    >
                      {label}
                    </button>
                  ))}
                </div>
              </>
            )}
          </div>

          {/* Priority Dropdown */}
          <div className="relative">
            <button
              type="button"
              onClick={() => {
                setIsPriorityOpen(!isPriorityOpen);
                setIsStatusOpen(false);
              }}
              className="flex items-center gap-1.5 px-3 py-1.5 bg-[#1C1A18] border border-[#34322F] text-[10px] font-bold rounded-xl hover:border-white/20 transition-colors uppercase tracking-wider font-mono"
              style={{ color: priorityColors[task.priority] }}
            >
              <Flag className="w-3.5 h-3.5" style={{ color: priorityColors[task.priority] }} />
              <span>Priority: {task.priority}</span>
            </button>
            {isPriorityOpen && (
              <>
                <div className="fixed inset-0 z-40 bg-transparent" onClick={() => setIsPriorityOpen(false)} />
                <div className="absolute left-0 mt-1 w-44 rounded-2xl bg-[#161412] border border-[#34322F] shadow-2xl p-1 z-50 font-satoshi flex flex-col gap-0.5">
                  {(['low', 'medium', 'high', 'urgent'] as Priority[]).map((p) => (
                    <button
                      key={p}
                      type="button"
                      onClick={() => handlePriorityChange(p)}
                      className={`w-full text-left px-3 py-2 text-xs font-bold rounded-xl transition-colors flex items-center gap-2 ${
                        task.priority === p
                          ? 'bg-[#A855F7] text-[#0A0908]'
                          : 'text-[#F5F2ED] hover:bg-white/5'
                      }`}
                    >
                      <Flag className="w-3 h-3" style={{ color: priorityColors[p] }} />
                      <span>{p.toUpperCase()}</span>
                    </button>
                  ))}
                </div>
              </>
            )}
          </div>
        </div>
      </div>

      {/* Content Area - Scrollable */}
      <div className="relative z-10 flex-1 overflow-y-auto p-5 md:p-6 space-y-6 scrollbar-thin">
        {/* Objective Details Box */}
        <div className="p-5 rounded-[28px] bg-[#000000] border border-white/[0.08] shadow-[0_12px_32px_rgba(0,0,0,0.4)] flex flex-col">
          <div className="flex items-center justify-between mb-2.5">
            <span className="text-[10px] font-black text-[#A855F7] uppercase tracking-wider font-mono">Objective details</span>
            {task.description && !isEditingDescription && (
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  navigator.clipboard.writeText(task.description || '');
                  showSuccess('Copied', 'Objective details copied to clipboard');
                }}
                className="p-1.5 rounded-lg text-white/70 hover:text-white hover:bg-white/5 transition-colors"
                title="Copy details"
              >
                <Copy className="w-3.5 h-3.5" />
              </button>
            )}
          </div>
          <div className="min-h-[120px] w-full">
            <KylrixWYSIWYGEditor
              value={editDescription}
              onChange={(nextVal) => setEditDescription(nextVal)}
              parentId={task.id}
              parentKind="task"
              placeholder="Provide detailed parameters, voice notes, or attached objects for this goal..."
              minHeight="120px"
              className="w-full"
            />
          </div>
        </div>

        {/* Milestones Box */}
        {!task.parentTaskId && (
          <div className="p-5 rounded-[28px] bg-[#000000] border border-white/[0.08] shadow-[0_12px_32px_rgba(0,0,0,0.4)]">
            <div className="flex items-center justify-between mb-2">
              <span className="text-[10px] font-black text-[#A855F7] uppercase tracking-wider font-mono">Milestones</span>
              <span className="text-xs font-bold text-white font-mono">{completedSubtasks} / {task.subtasks.length}</span>
            </div>
            <div className="w-full h-1 bg-white/10 rounded-full mb-4 overflow-hidden">
              <div className="h-full bg-[#A855F7] transition-all duration-500" style={{ width: `${subtaskProgress}%` }} />
            </div>

            <div className="space-y-2 max-h-[180px] overflow-y-auto pr-1">
              {task.subtasks.length === 0 ? (
                <div className="text-xs text-white opacity-50 italic py-2">No milestones yet.</div>
              ) : (
                task.subtasks.map((subtask) => (
                  <div key={subtask.id} className="flex items-start gap-3 py-1 group">
                    <input
                      type="checkbox"
                      checked={subtask.completed}
                      onChange={() => toggleSubtask(task.id, subtask.id)}
                      className="w-4 h-4 mt-0.5 rounded border-[#34322F] bg-transparent text-[#A855F7] focus:ring-0 focus:ring-offset-0 focus:outline-none cursor-pointer shrink-0"
                    />
                    <span 
                      onClick={() => openUnified('milestone-details', { taskId: subtask.id })}
                      className={`text-sm flex-1 min-w-0 break-words [overflow-wrap:anywhere] hover:underline cursor-pointer ${
                        subtask.completed ? 'text-[#9B9691] line-through' : 'text-[#F5F2ED]'
                      }`}
                    >
                      {subtask.title}
                    </span>
                    <button
                      type="button"
                      onClick={() => deleteSubtask(task.id, subtask.id)}
                      className="text-[#9B9691] hover:text-red-400 p-1 rounded transition-colors opacity-0 group-hover:opacity-100"
                    >
                      <X className="w-3.5 h-3.5" />
                    </button>
                  </div>
                ))
              )}
            </div>

            {/* Add Milestone Bar */}
            <div className="flex gap-2 mt-4 p-1 bg-white/[0.02] rounded-xl border border-white/5 items-center">
              <input
                type="text"
                placeholder={isPaid ? 'Add milestone...' : 'Milestones — Pro / Teams'}
                value={newSubtask}
                onChange={(e) => setNewSubtask(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key !== 'Enter') return;
                  e.preventDefault();
                  void handleAddSubtask();
                }}
                className="w-full bg-transparent border-0 outline-none px-3 py-1.5 text-xs text-[#F5F2ED] focus:ring-0 focus:outline-none font-satoshi"
              />
            </div>
          </div>
        )}

        {/* Actionable Meta Grid */}
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-4 px-1">
          <div>
            <span className="text-[10px] font-black text-[#A855F7] uppercase tracking-wider mb-1.5 block font-mono">Workspace Domain</span>
            <div className="flex items-center gap-2">
              <div className="w-2.5 h-2.5 rounded-full bg-[#6366F1]" />
              <span className="text-sm font-bold text-[#F5F2ED]">{matchedWorkspace}</span>
            </div>
          </div>
          <div>
            <button
              type="button"
              onClick={() => {
                setIsPriorityOpen(!isPriorityOpen);
                setIsStatusOpen(false);
              }}
              className="flex flex-col items-start gap-1 w-full text-left bg-transparent border-0 outline-none p-0 cursor-pointer group"
            >
              <span className="text-[10px] font-black text-[#A855F7] group-hover:text-[#b975ff] transition-colors uppercase tracking-wider block font-mono">Urgency Level</span>
              <div className="flex items-center gap-2 text-[#F5F2ED]">
                <Flag className="w-4 h-4" style={{ color: priorityColors[task.priority] }} />
                <span className="text-sm font-bold capitalize group-hover:underline" style={{ color: priorityColors[task.priority] }}>{task.priority}</span>
              </div>
            </button>
          </div>
          <div>
            <div className="flex items-center justify-between mb-1.5">
              <span className="text-[10px] font-black text-[#A855F7] uppercase tracking-wider block font-mono">Target Deadline</span>
              {task.dueDate ? (
                <button
                  type="button"
                  onClick={() => updateTask(task.id, { dueDate: null })}
                  className="text-[10px] font-mono font-bold uppercase tracking-wider text-red-400/80 hover:text-red-300 transition-colors"
                >
                  Clear
                </button>
              ) : null}
            </div>
            <div className="flex items-center gap-2">
              <div className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-xl bg-white/[0.04] border border-white/10 hover:border-[#A855F7]/30 transition-all">
                <Calendar className="w-3.5 h-3.5 text-[#A855F7] shrink-0" />
                <input
                  type="date"
                  value={toLocalDateInputString(task.dueDate)}
                  onChange={(e) => {
                    const val = e.target.value;
                    if (!val) {
                      updateTask(task.id, { dueDate: null });
                    } else {
                      const d = new Date(val);
                      if (task.dueDate) {
                        const existingDate = new Date(task.dueDate);
                        d.setHours(existingDate.getHours(), existingDate.getMinutes(), 0, 0);
                      } else {
                        d.setHours(12, 0, 0, 0);
                      }
                      updateTask(task.id, { dueDate: d });
                    }
                  }}
                  className="bg-transparent border-0 outline-none text-xs font-bold text-[#F5F2ED] focus:ring-0 p-0 cursor-pointer [color-scheme:dark]"
                />
              </div>
              <div className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-xl bg-white/[0.04] border border-white/10 hover:border-[#A855F7]/30 transition-all">
                <Clock className="w-3.5 h-3.5 text-[#A855F7] shrink-0" />
                <input
                  type="time"
                  disabled={!task.dueDate}
                  value={(() => {
                    if (!task.dueDate) return '';
                    const d = new Date(task.dueDate);
                    const hh = String(d.getHours()).padStart(2, '0');
                    const mm = String(d.getMinutes()).padStart(2, '0');
                    return `${hh}:${mm}`;
                  })()}
                  onChange={(e) => {
                    if (!task.dueDate) return;
                    const val = e.target.value;
                    const d = new Date(task.dueDate);
                    if (!val) {
                      d.setHours(12, 0, 0, 0);
                    } else {
                      const [hours, minutes] = val.split(':').map(Number);
                      d.setHours(hours, minutes, 0, 0);
                    }
                    updateTask(task.id, { dueDate: d });
                  }}
                  className="bg-transparent border-0 outline-none text-xs font-bold text-[#F5F2ED] focus:ring-0 p-0 cursor-pointer disabled:opacity-30 disabled:cursor-not-allowed [color-scheme:dark]"
                />
              </div>
            </div>
          </div>
        </div>

        {/* Tags Section */}
        <div className="px-1">
          <div className="flex items-center justify-between mb-2">
            <span className="text-[10px] font-black text-[#A855F7] uppercase tracking-wider block font-mono">Ecosystem Tags</span>
            <button
              type="button"
              onClick={() => setIsTagSelectorOpen(true)}
              className="p-1 text-[#A855F7] hover:text-white rounded-lg hover:bg-[#A855F7]/10 transition-colors flex shrink-0"
              title="Edit Tags"
            >
              <Plus size={14} strokeWidth={3} />
            </button>
          </div>
          {taskLabels.length > 0 ? (
            <div className="flex flex-wrap gap-2">
              {Array.from(new Map(taskLabels.map((l) => [l.name, l])).values()).map((label, idx) => (
                <div 
                  key={`${label.name}-${idx}`}
                  className="flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-white/[0.03] border border-white/5 text-[11px] font-bold text-white/60"
                >
                  <TagIcon size={10} style={{ color: label.color || '#9B9691' }} />
                  <span>{label.name}</span>
                </div>
              ))}
            </div>
          ) : (
            <div className="text-xs text-white/20 italic">No tags associated with this goal. Click + to add tags.</div>
          )}
        </div>

        {/* Discussion Section — goals only; milestones hide this */}
        {!task.parentTaskId && (
        <div className="p-5 rounded-[28px] bg-[#0A0908] border border-white/5 shadow-[0_12px_32px_rgba(0,0,0,0.4)]">
          <div className="flex justify-between items-center mb-4">
            <div className="flex items-center gap-2">
                <MessageSquare className="w-3.5 h-3.5 text-[#A855F7]" />
                <span className="text-[10px] font-black text-[#A855F7] uppercase tracking-wider font-mono">Goal Discussion</span>
            </div>
            {discussionNoteId && (
                <div className="flex items-center gap-1.5 text-[9px] font-black text-[#10B981] uppercase tracking-[0.15em] font-mono">
                    <Activity size={10} className="animate-pulse" />
                    <span>Live Secure Channel</span>
                </div>
            )}
          </div>

          {!discussionNoteId ? (
            <div className="py-6 text-center">
              <Globe className="w-6 h-6 text-white/10 mx-auto mb-3" />
              <button
                type="button"
                onClick={handleInitDiscussion}
                disabled={huddleLoading}
                className="px-5 py-2.5 bg-[#A855F7] text-[#0A0908] font-black text-[11px] uppercase tracking-widest rounded-xl shadow-[0_8px_20px_-8px_rgba(168,85,247,0.4)] hover:bg-[#9333EA] hover:translate-y-[-1px] transition-all duration-200 font-satoshi flex items-center gap-2 mx-auto"
              >
                {huddleLoading ? <RefreshCw size={14} className="animate-spin" /> : <Plus size={14} strokeWidth={3} />}
                <span>Start Discussion</span>
              </button>
            </div>
          ) : (
            <div className="flex flex-col gap-3">
              {huddleLoading && !huddleMessages.length ? (
                <div className="flex items-center justify-center py-6">
                  <div className="w-6 h-6 border-2 border-[#A855F7] border-t-transparent rounded-full animate-spin" />
                </div>
              ) : (
                <div className="space-y-4 max-h-[300px] overflow-y-auto pr-1 scrollbar-thin">
                  {huddleMessages.length === 0 ? (
                    <div className="text-[11px] text-white/20 font-black uppercase tracking-widest py-8 text-center flex flex-col gap-2">
                        <MessageSquare size={20} className="mx-auto opacity-10" />
                        No parameters defined yet.
                    </div>
                  ) : (
                    huddleMessages.map((msg) => {
                      const isOutgoing = msg.senderId === user?.$id;
                      return (
                        <div key={msg.id} className={`flex flex-col gap-1.5 ${isOutgoing ? 'items-end' : 'items-start'}`}>
                           <div className={`flex items-center gap-2 ${isOutgoing ? 'flex-row-reverse' : 'flex-row'}`}>
                                <IdentityAvatar
                                    fileId={msg.senderAvatar}
                                    alt={msg.senderName}
                                    fallback={msg.senderName.slice(0, 1).toUpperCase()}
                                    size={20}
                                    borderRadius="50%"
                                />
                                <span className="text-[10px] font-black text-white/30 font-mono uppercase tracking-wider">{msg.senderName}</span>
                           </div>
                           <div 
                             className={`px-3.5 py-2 rounded-2xl text-[13px] leading-relaxed max-w-[90%] border shadow-sm transition-all hover:shadow-md ${
                               isOutgoing
                                 ? 'bg-[#000000] border-white/[0.08] border-right-[3px] border-r-[#A855F7] text-white font-medium'
                                 : 'bg-[#000000] border-white/[0.08] border-left-[3px] border-l-[#A855F7]/50 text-white'
                             }`}
                           >
                             {msg.content}
                           </div>
                        </div>
                      );
                    })
                  )}
                  <div ref={huddleMessageEndRef} />
                </div>
              )}

              <form onSubmit={handleSendMessage} className="flex gap-2 mt-2 p-1.5 bg-[#000000] rounded-2xl border border-white/[0.08] items-center focus-within:border-[#A855F7]/40 transition-all">
                <input
                  type="text"
                  placeholder="Message the team..."
                  value={newComment}
                  onChange={(e) => setNewComment(e.target.value)}
                  className="w-full bg-transparent border-0 outline-none px-3 py-1.5 text-[13px] text-white font-medium placeholder:text-white/30 focus:ring-0 focus:outline-none"
                />
                <button
                  type="submit"
                  disabled={huddleSending || !newComment.trim()}
                  className={`p-2 rounded-xl transition-all shrink-0 ${
                      newComment.trim() 
                        ? 'bg-[#A855F7] text-[#0A0908] shadow-[0_4px_12px_-4px_rgba(168,85,247,0.4)]' 
                        : 'text-white/10'
                  }`}
                >
                  {huddleSending ? (
                    <RefreshCw className="animate-spin w-4 h-4" />
                  ) : (
                    <Send className="w-4 h-4" strokeWidth={2.5} />
                  )}
                </button>
              </form>
            </div>
          )}
        </div>
        )}

        {/* Metadata */}
        <div className="pt-4 border-t border-white/5">
          <span className="text-[10px] text-white/30 font-mono block">Created {formatNoteCreatedDate(task as any)}</span>
        </div>
      </div>

      {/* Project Linker Modal Integration */}
      {showProjectLinker && (
        <ProjectLinker
          open={showProjectLinker}
          onClose={() => setShowProjectLinker(false)}
          entityId={taskId}
          entityKind="goal"
          onLinked={async () => {
            // refresh projects list inside context or parent if needed
          }}
        />
      )}

      {/* Ecosystem Tags Selection Drawer */}
      {isTagSelectorOpen && (
        <Drawer
          anchor="bottom"
          open={isTagSelectorOpen}
          onClose={() => setIsTagSelectorOpen(false)}
          ModalProps={{ keepMounted: false, disablePortal: true }}
          sx={{
            zIndex: 15000,
            '& .ob-drawer-panel': {
              bgcolor: '#000000',
              backgroundImage: 'none',
              borderTop: '1px solid rgba(255, 255, 255, 0.1)',
              maxHeight: '60vh',
              width: '100%',
              p: 3}}}
        >
          <Stack direction="row" alignItems="center" justifyContent="between" sx={{ mb: 3 }}>
            <Stack direction="row" alignItems="center" spacing={1.5}>
              <TagIcon size={20} color="#A855F7" />
              <Typography sx={{ color: '#FFFFFF', fontWeight: 900, fontSize: '1.1rem', fontFamily: 'var(--font-clash)', letterSpacing: '-0.02em', textTransform: 'uppercase' }}>
                Select Tags
              </Typography>
            </Stack>
            <IconButton
              onClick={() => setIsTagSelectorOpen(false)}
              sx={{
                color: '#FFFFFF',
                bgcolor: '#161412',
                border: '1px solid rgba(255, 255, 255, 0.08)',
                '&:hover': { bgcolor: '#201D1A' }}}
            >
              <X size={18} />
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
                        setIsTagSelectorOpen(true);
                      } 
                    });
                  }}
                  sx={{ 
                    borderRadius: '12px', 
                    bgcolor: alpha('#A855F7', 0.1),
                    border: `1px dashed ${alpha('#A855F7', 0.3)}`,
                    py: 1.5,
                    '&:hover': { bgcolor: alpha('#A855F7', 0.15) }
                  }}
                >
                  <Plus size={18} color="#A855F7" style={{ marginRight: '12px' }} />
                  <ListItemText 
                    primary="Create New Tag" 
                    primaryTypographyProps={{ sx: { color: '#A855F7', fontWeight: 800, fontSize: '0.9rem' } }}
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
                  const tagLower = (tag.name || '').trim().toLowerCase();
                  const isSelected = (task.labels || []).some((l) => l.toLowerCase().trim() === tagLower);
                  const color = (tag as any).color || '#9B9691';

                  return (
                    <ListItem key={tag.$id} disablePadding sx={{ mb: 0.5 }}>
                      <ListItemButton 
                        onClick={async () => {
                          let nextLabels = [...(task.labels || [])];
                          if (!isSelected && tag.name) {
                            nextLabels.push(tag.name.trim());
                          } else if (isSelected && tag.name) {
                            nextLabels = nextLabels.filter((n) => n.toLowerCase().trim() !== tagLower);
                          }
                          await updateTask(task.id, { labels: nextLabels });
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
      )}
    </div>
  );
}
