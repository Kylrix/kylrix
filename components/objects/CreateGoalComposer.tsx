import React, { useCallback, useEffect, useRef, useState } from 'react';
import { ID } from 'appwrite';
import { ArrowLeft, Calendar, Check, ChevronDown, ChevronUp, Plus, Tag, Target, X } from 'lucide-react';
import { buildAutoTitleFromContent, resolveNoteCardTitle } from '@/constants/noteTitle';
import { useTask } from '@/context/TaskContext';
import { useAuth } from '@/lib/auth';
import { SyncStatusDot, SyncStatusLabel } from '@/components/ui/SyncStatusDot';
import { goalPendingKey } from '@/lib/sync/goal-keys';
import { PRIORITY_COLORS } from '@/components/objects/ObjectCardMeta';
import type { Priority, Task } from '@/types';
import { autonomicSyncEngine } from '@/lib/services/sync-engine';
import { useDynamicSidebar } from '@/components/ui/DynamicSidebar';
import { useUnifiedDrawer } from '@/context/UnifiedDrawerContext';
import {
  EventDateTimePickerSurface,
  EventDateTimePickerDrawer,
} from '@/components/events/drawers/EventDateTimePickerDrawer';

import { useDataNexus } from '@/context/DataNexusContext';
import { useWorkspace } from '@/context/WorkspaceContext';

const PRIORITIES: Priority[] = ['urgent', 'high', 'medium', 'low'];

type Props = {
  onClose?: () => void;
  onRegisterClose?: (close: (() => void) | null) => void;
  isExpanded?: boolean;
  onToggleExpand?: () => void;
  onGoalCreated?: (task: Task) => void;
  initialContent?: {
    id?: string;
    title?: string;
    content?: string;
    priority?: Priority;
    dueDate?: string;
    tags?: string[];
  };
};

/**
 * Goal create composer — same live-copy contract as CreateNoteForm:
 * keystroke → pushLiveGoal → SyncStatusDot; Check / Enter (minimized) closes.
 */
export function CreateGoalComposer({
  onClose,
  onRegisterClose,
  isExpanded: controlledExpanded,
  onToggleExpand,
  onGoalCreated,
  initialContent,
}: Props) {
  const { pushLiveGoal, selectedProjectId, userId, deleteTask, ecosystemTags, refreshEcosystemTags } = useTask();
  const { user } = useAuth();
  const { activeWorkspace, attachEntityToActiveWorkspace } = useWorkspace();
  const ownerId = user?.$id || userId || 'guest';
  const { openSidebar, closeSidebar } = useDynamicSidebar();
  const { open: openUnified } = useUnifiedDrawer();
  const { getCachedData, setCachedData } = useDataNexus();
  const draftKey = `kylrix_goal_compose_draft_${ownerId}`;

  const [content, setContent] = useState(initialContent?.content || '');
  const [title, setTitle] = useState(initialContent?.title || '');
  const [isTitleManuallyEdited, setIsTitleManuallyEdited] = useState(Boolean(initialContent?.title));
  const [priority, setPriority] = useState<Priority>(initialContent?.priority || 'medium');
  const [dueDate, setDueDate] = useState(initialContent?.dueDate || '');
  const [tags, setTags] = useState<string[]>(initialContent?.tags || []);
  const [isTagSelectorOpen, setIsTagSelectorOpen] = useState(false);
  const [showMobileDatePicker, setShowMobileDatePicker] = useState(false);
  const [resolvedId, setResolvedId] = useState<string | undefined>(initialContent?.id);
  const [draftHydrated, setDraftHydrated] = useState(false);
  const [localExpanded, setLocalExpanded] = useState(false);
  const [isMobile, setIsMobile] = useState(false);
  const isExpanded = controlledExpanded !== undefined ? controlledExpanded : localExpanded;
  const toggleExpand = onToggleExpand || (() => setLocalExpanded((v) => !v));
  const liveIdRef = useRef<string | undefined>(initialContent?.id);
  const announcedRef = useRef(false);
  const isPastedRef = useRef(false);
  const pasteTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const contentRef = useRef<HTMLTextAreaElement | null>(null);

  useEffect(() => {
    const check = () => setIsMobile(window.innerWidth < 768);
    check();
    window.addEventListener('resize', check);
    return () => window.removeEventListener('resize', check);
  }, []);

  // Hydrate draft memory from LocalEngine on mount
  useEffect(() => {
    if (draftHydrated) return;
    const cachedDraft = getCachedData<{
      id?: string;
      title?: string;
      content?: string;
      priority?: Priority;
      dueDate?: string;
    }>(draftKey);

    if (cachedDraft && (cachedDraft.content || cachedDraft.title || cachedDraft.dueDate)) {
      const targetId = initialContent?.id || cachedDraft.id;
      if (targetId) {
        liveIdRef.current = targetId;
        setResolvedId(targetId);
      }
      if (initialContent?.content === undefined && cachedDraft.content) setContent(cachedDraft.content);
      if (initialContent?.title === undefined && cachedDraft.title) {
        setTitle(cachedDraft.title);
        setIsTitleManuallyEdited(true);
      }
      if (initialContent?.priority === undefined && cachedDraft.priority) setPriority(cachedDraft.priority);
      if (initialContent?.dueDate === undefined && cachedDraft.dueDate) setDueDate(cachedDraft.dueDate);
    }
    setDraftHydrated(true);
  }, [draftHydrated, draftKey, getCachedData, initialContent]);

  useEffect(() => {
    if (initialContent?.id) {
      liveIdRef.current = initialContent.id;
      setResolvedId(initialContent.id);
    }
    if (initialContent?.dueDate !== undefined) {
      setDueDate(initialContent.dueDate);
    }
    if (initialContent?.content !== undefined) {
      setContent(initialContent.content);
    }
    if (initialContent?.title !== undefined) {
      setTitle(initialContent.title);
      if (initialContent.title) setIsTitleManuallyEdited(true);
    }
    if (initialContent?.priority !== undefined) {
      setPriority(initialContent.priority);
    }
  }, [initialContent?.id, initialContent?.dueDate, initialContent?.content, initialContent?.title, initialContent?.priority]);

  // Save active draft into LocalEngine
  useEffect(() => {
    if (!draftHydrated) return;
    const activeId = liveIdRef.current || resolvedId;
    const hasDraft = Boolean(content.trim() || title.trim() || dueDate.trim());
    if (hasDraft) {
      setCachedData(draftKey, {
        id: activeId,
        title,
        content,
        priority,
        dueDate,
      });
    }
  }, [content, title, priority, dueDate, resolvedId, draftKey, setCachedData, draftHydrated]);

  useEffect(() => {
    if (isTitleManuallyEdited) return;
    const generated = buildAutoTitleFromContent(content);
    setTitle(content.trim() ? generated : '');
  }, [content, isTitleManuallyEdited]);

  const ensureId = useCallback(() => {
    const existing = initialContent?.id || resolvedId || liveIdRef.current;
    if (existing) return existing;
    const id = ID.unique();
    liveIdRef.current = id;
    setResolvedId(id);
    return id;
  }, [initialContent?.id, resolvedId]);

  const appendTag = (tagName: string) => {
    if (!tagName || tags.includes(tagName)) return;
    const nextTags = [...tags, tagName];
    setTags(nextTags);
    pushLive(buildLive(content, title, priority, dueDate, nextTags));
  };

  const removeTag = (tagName: string) => {
    const nextTags = tags.filter((t) => t !== tagName);
    setTags(nextTags);
    pushLive(buildLive(content, title, priority, dueDate, nextTags));
  };

  const buildLive = useCallback(
    (nextContent: string, nextTitle?: string, nextPriority?: Priority, nextDue?: string, nextTags?: string[]): Task => {
      const id = ensureId();
      const previewTitle =
        resolveNoteCardTitle(
          isTitleManuallyEdited ? title : nextTitle ?? buildAutoTitleFromContent(nextContent),
          nextContent,
        ) ||
        (isTitleManuallyEdited ? title : nextTitle) ||
        'Untitled Goal';
      const due =
        (nextDue ?? dueDate) && String(nextDue ?? dueDate).trim()
          ? new Date(`${String(nextDue ?? dueDate).trim()}T12:00:00`)
          : undefined;

      return {
        id,
        title: previewTitle,
        description: nextContent,
        priority: nextPriority || priority,
        status: 'todo',
        projectId: activeWorkspace && !activeWorkspace.isPersonal ? activeWorkspace.id : (selectedProjectId || 'inbox'),
        isWorkspace: Boolean(activeWorkspace && !activeWorkspace.isPersonal),
        labels: nextTags !== undefined ? nextTags : tags,
        linkedNotes: [],
        subtasks: [],
        comments: [],
        attachments: [],
        reminders: [],
        timeEntries: [],
        assigneeIds: ownerId !== 'guest' ? [ownerId] : [],
        creatorId: ownerId,
        userId: ownerId,
        parentTaskId: null,
        dueDate: due && !Number.isNaN(due.getTime()) ? due : undefined,
        createdAt: new Date(),
        updatedAt: new Date(),
        position: 0,
        isArchived: false,
        isPinned: false,
        isPublic: false,
        isGuest: false,
      };
    },
    [activeWorkspace, dueDate, ensureId, isTitleManuallyEdited, ownerId, priority, selectedProjectId, tags, title],
  );

  const pushLive = useCallback(
    (task: Task) => {
      if (typeof pushLiveGoal === 'function') {
        pushLiveGoal(task);
        autonomicSyncEngine.nudge();
      }
    },
    [pushLiveGoal],
  );

  const syncTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const flushLiveGoal = useCallback(() => {
    if (syncTimerRef.current) {
      clearTimeout(syncTimerRef.current);
      syncTimerRef.current = null;
    }
    const hasContent = Boolean(content.trim() || title.trim());
    if (!hasContent) return;
    const task = buildLive(content, title, priority, dueDate);
    pushLive(task);
  }, [buildLive, content, dueDate, priority, pushLive, title]);

  const scheduleLiveGoalSync = useCallback(() => {
    if (syncTimerRef.current) clearTimeout(syncTimerRef.current);
    syncTimerRef.current = setTimeout(() => {
      flushLiveGoal();
    }, 250);
  }, [flushLiveGoal]);

  const handleContentChange = useCallback(
    (next: string) => {
      setContent(next);
      const generated = isTitleManuallyEdited ? title : buildAutoTitleFromContent(next);
      if (!isTitleManuallyEdited) setTitle(generated);

      if (contentRef.current) {
        contentRef.current.style.height = 'auto';
        contentRef.current.style.height = `${Math.max(76, Math.min(contentRef.current.scrollHeight, 360))}px`;
      }

      scheduleLiveGoalSync();
    },
    [isTitleManuallyEdited, scheduleLiveGoalSync, title],
  );

  const handleClose = useCallback(() => {
    if (syncTimerRef.current) clearTimeout(syncTimerRef.current);
    const id = liveIdRef.current || resolvedId;
    const hasContent = Boolean(content.trim() || title.trim());
    setCachedData(draftKey, null);
    if (!hasContent && id) {
      if (typeof deleteTask === 'function') {
        void deleteTask(id);
      }
      autonomicSyncEngine.ack(goalPendingKey(id));
    } else if (hasContent) {
      const task = buildLive(content, title, priority, dueDate);
      pushLiveGoal(task);
      autonomicSyncEngine.nudge();
      if (activeWorkspace && !activeWorkspace.isPersonal && id) {
        void attachEntityToActiveWorkspace('goal', id);
      }
      if (!announcedRef.current) {
        announcedRef.current = true;
        onGoalCreated?.(task);
      }
    }
    if (typeof onClose === 'function') {
      onClose();
    }
    closeSidebar();
  }, [activeWorkspace, attachEntityToActiveWorkspace, buildLive, closeSidebar, content, deleteTask, draftKey, dueDate, onClose, onGoalCreated, priority, pushLiveGoal, resolvedId, setCachedData, title]);

  useEffect(() => {
    return () => {
      if (syncTimerRef.current) clearTimeout(syncTimerRef.current);
    };
  }, []);

  const handleOpenDatePicker = useCallback(() => {
    const isDesktopWindow = typeof window !== 'undefined' && window.innerWidth >= 900;
    const initialStart = dueDate ? new Date(`${dueDate}T12:00:00`) : new Date();
    const initialEnd = new Date(initialStart.getTime() + 3600000);
    const activeId = ensureId();

    const applyDate = (start: Date) => {
      const y = start.getFullYear();
      const m = String(start.getMonth() + 1).padStart(2, '0');
      const d = String(start.getDate()).padStart(2, '0');
      const dateStr = `${y}-${m}-${d}`;
      setDueDate(dateStr);
      pushLive(buildLive(content, title, priority, dateStr));
      return dateStr;
    };

    if (isDesktopWindow) {
      openSidebar(
        <EventDateTimePickerSurface
          inline
          startTime={initialStart}
          endTime={initialEnd}
          onApply={(start) => {
            const dateStr = applyDate(start);
            openSidebar(
              <CreateGoalComposer
                onClose={onClose}
                onGoalCreated={onGoalCreated}
                isExpanded={controlledExpanded}
                initialContent={{ id: activeId, title, content, priority, dueDate: dateStr }}
              />,
              'create-goal',
              { hideHeader: true }
            );
          }}
          onClose={() => {
            openSidebar(
              <CreateGoalComposer
                onClose={onClose}
                onGoalCreated={onGoalCreated}
                isExpanded={controlledExpanded}
                initialContent={{ id: activeId, title, content, priority, dueDate }}
              />,
              'create-goal',
              { hideHeader: true }
            );
          }}
        />,
        'date-picker',
        { hideHeader: true }
      );
    } else {
      setShowMobileDatePicker(true);
    }
  }, [dueDate, content, title, priority, buildLive, pushLive, openSidebar, onClose, onGoalCreated, controlledExpanded, ensureId]);

  useEffect(() => {
    onRegisterClose?.(handleClose);
    return () => onRegisterClose?.(null);
  }, [handleClose, onRegisterClose]);

  const resourceId = resolvedId ? goalPendingKey(resolvedId) : null;

  return (
    <div
      onContextMenu={(e) => e.preventDefault()}
      className="w-full h-full min-h-0 flex flex-col bg-[#161412] text-white overscroll-contain"
    >
      {/* Header */}
      <div className="px-3 py-2.5 flex items-center justify-between border-b border-white/5 sticky top-0 z-20 bg-[#161412] shrink-0">
        <div className="flex items-center gap-2 min-w-0">
          <button
            type="button"
            onClick={handleClose}
            className="p-1.5 rounded-xl text-white/50 hover:text-white hover:bg-white/10 border border-transparent hover:border-white/10 transition-all shrink-0 cursor-pointer"
            title="Back / Close"
          >
            <ArrowLeft className="w-4 h-4" />
          </button>
          <div className="w-7 h-7 rounded-xl flex items-center justify-center bg-[#A855F7]/10 border border-[#A855F7]/25 text-[#A855F7] shrink-0">
            <Target className="w-3.5 h-3.5" />
          </div>
          <div className="min-w-0 flex flex-col">
            <span className="font-extrabold text-sm font-clash tracking-tight text-white leading-tight">
              Create Goal
            </span>
            <div className="flex items-center gap-1.5 mt-0.5 select-none">
              <SyncStatusDot resourceId={resourceId} kind="goal" />
              <SyncStatusLabel resourceId={resourceId} kind="goal" />
            </div>
          </div>
        </div>

        <div className="flex items-center gap-2 shrink-0">
          {isMobile ? (
            <button
              type="button"
              onClick={toggleExpand}
              className="p-2 rounded-xl text-white/60 hover:text-white hover:bg-white/5 border border-transparent hover:border-white/5 transition-all shrink-0"
            >
              {isExpanded ? <ChevronDown className="w-4 h-4" /> : <ChevronUp className="w-4 h-4" />}
            </button>
          ) : null}
          <button
            type="button"
            onClick={handleClose}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-[#10B981] text-white hover:bg-[#10B981]/90 shadow-[0_4px_12px_rgba(16,185,129,0.25)] transition-all text-xs font-bold shrink-0"
            title="Save and Close"
          >
            <Check className="w-3.5 h-3.5 stroke-[3]" />
            <span>Done</span>
          </button>
        </div>
      </div>

      {/* Main Body */}
      <div className="flex-1 overflow-y-auto overscroll-contain p-4 flex flex-col gap-4 min-h-0 scrollbar-thin">
        {/* Title Input */}
        <div className="flex flex-col gap-1 shrink-0">
          <label className="text-[10px] font-bold font-mono uppercase tracking-widest text-white/35">
            Goal Title
          </label>
          <input
            type="text"
            value={title}
            onChange={(e) => {
              setTitle(e.target.value);
              setIsTitleManuallyEdited(true);
              scheduleLiveGoalSync();
            }}
            placeholder="What do you want to accomplish?"
            className="w-full bg-transparent text-white placeholder-white/20 border-0 border-b border-white/10 focus:border-[#A855F7] px-0 py-1.5 text-lg font-bold font-clash focus:outline-none transition-colors"
          />
        </div>

        {/* Description Input */}
        <div className="shrink-0 flex flex-col gap-1">
          <label className="text-[10px] font-bold font-mono uppercase tracking-widest text-white/35">
            Description & Milestones
          </label>
          <textarea
            ref={contentRef}
            rows={3}
            value={content}
            onPaste={(e) => {
              isPastedRef.current = true;
              if (pasteTimerRef.current) clearTimeout(pasteTimerRef.current);
              pasteTimerRef.current = setTimeout(() => {
                isPastedRef.current = false;
              }, 2000);
              const pastedText = e.clipboardData.getData('text');
              if (pastedText) {
                setTimeout(() => {
                  const updated = contentRef.current?.value || content;
                  handleContentChange(updated);
                }, 10);
              }
            }}
            onChange={(e) => handleContentChange(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter' && !e.shiftKey && !isExpanded && !isPastedRef.current) {
                e.preventDefault();
                handleClose();
              }
            }}
            placeholder="Break down your goal, steps, or notes..."
            autoFocus
            style={{ minHeight: '76px', height: '76px' }}
            className="w-full resize-none bg-[#100F0E] text-white placeholder-white/25 border border-white/10 focus:border-[#A855F7]/40 rounded-2xl p-3.5 text-sm leading-relaxed focus:outline-none transition-all scrollbar-thin font-satoshi"
          />
        </div>

        {/* Metadata & Properties Card */}
        <div className="p-3.5 rounded-2xl bg-[#1C1A18] border border-white/5 flex flex-col gap-3.5 shrink-0">
          {/* Priority */}
          <div className="flex flex-col gap-2">
            <span className="text-[10px] font-bold font-mono uppercase tracking-widest text-white/40">
              Priority Level
            </span>
            <div className="grid grid-cols-4 gap-1.5">
              {PRIORITIES.map((p) => {
                const color = PRIORITY_COLORS[p];
                const active = priority === p;
                return (
                  <button
                    key={p}
                    type="button"
                    onClick={() => {
                      setPriority(p);
                      pushLive(buildLive(content, title, p));
                    }}
                    className="py-2 px-1 rounded-xl text-[10px] font-extrabold font-mono uppercase tracking-wider border transition-all text-center"
                    style={{
                      color: active ? '#FFFFFF' : color,
                      borderColor: active ? color : `${color}30`,
                      backgroundColor: active ? `${color}44` : `${color}0c`,
                    }}
                  >
                    {p}
                  </button>
                );
              })}
            </div>
          </div>

          {/* Target Due Date */}
          <div className="flex flex-col gap-1.5 border-t border-white/5 pt-3">
            <label className="text-[10px] font-bold font-mono uppercase tracking-widest text-white/40">
              Target Due Date
            </label>
            <button
              type="button"
              onClick={handleOpenDatePicker}
              className="w-full flex items-center justify-between rounded-xl border border-white/10 bg-black/40 px-3.5 py-2.5 text-white text-xs font-satoshi hover:border-[#A855F7]/40 hover:bg-white/[0.03] transition-all cursor-pointer group"
            >
              <div className="flex items-center gap-2.5 min-w-0">
                <Calendar className="w-4 h-4 text-[#A855F7] shrink-0" />
                <span className="font-bold text-sm font-satoshi truncate">
                  {dueDate
                    ? new Date(`${dueDate}T12:00:00`).toLocaleDateString('en-US', {
                        weekday: 'short',
                        month: 'short',
                        day: 'numeric',
                        year: 'numeric',
                      })
                    : 'Select target due date...'}
                </span>
              </div>
              <span className="text-[10px] font-mono font-bold uppercase tracking-wider text-[#A855F7] bg-[#A855F7]/10 px-2 py-0.5 rounded-md border border-[#A855F7]/20 group-hover:bg-[#A855F7]/20 transition-all">
                {dueDate ? 'Change' : 'Pick Date'}
              </span>
            </button>
          </div>

          {/* Tags Section */}
          <div className="flex flex-col gap-2 border-t border-white/5 pt-3">
            <div className="flex items-center justify-between">
              <span className="text-[10px] font-bold font-mono uppercase tracking-widest text-white/40">
                Tags & Categories
              </span>
              <button
                type="button"
                onClick={() => setIsTagSelectorOpen(true)}
                className="text-[10px] font-mono font-bold uppercase tracking-wider text-[#A855F7] hover:text-[#C084FC] flex items-center gap-1 cursor-pointer transition-colors"
              >
                <Plus size={12} />
                <span>Add Tag</span>
              </button>
            </div>

            {tags.length > 0 ? (
              <div className="flex flex-wrap gap-1.5 items-center">
                {tags.map((tagName) => {
                  const tag = (ecosystemTags as any[]).find((t) => t.name === tagName);
                  const color = tag?.color || '#A855F7';
                  return (
                    <span
                      key={tagName}
                      onClick={() => removeTag(tagName)}
                      className="inline-flex items-center gap-1.5 px-2.5 py-1 bg-[#100F0E] text-[10px] font-extrabold font-mono rounded-lg border cursor-pointer hover:bg-[#1C1A18] transition-colors"
                      style={{ color: color, borderColor: `${color}40` }}
                    >
                      {tagName.toUpperCase()}
                      <X className="w-2.5 h-2.5" />
                    </span>
                  );
                })}
              </div>
            ) : (
              <div
                onClick={() => setIsTagSelectorOpen(true)}
                className="w-full py-2 px-3 rounded-xl border border-dashed border-white/10 hover:border-[#A855F7]/30 text-white/30 hover:text-white/60 text-xs font-satoshi flex items-center gap-2 cursor-pointer transition-all"
              >
                <Tag size={13} className="text-[#A855F7]/60" />
                <span>No tags selected. Tap to add tags from local engine…</span>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Ecosystem Tags Selection Drawer */}
      {isTagSelectorOpen && (
        <div className="fixed inset-0 z-[15000] flex flex-col justify-end">
          <div
            className="fixed inset-0 bg-black/70 transition-opacity cursor-pointer"
            onClick={() => setIsTagSelectorOpen(false)}
          />
          <div className="relative z-[15001] bg-[#161412] border-t border-white/10 rounded-t-[28px] max-h-[60dvh] w-full p-5 flex flex-col overflow-hidden shadow-2xl animate-slide-up">
            <div className="flex items-center justify-between pb-3 border-b border-white/5 mb-3">
              <div className="flex items-center gap-2">
                <Tag size={18} className="text-[#A855F7]" />
                <span className="text-white font-black text-sm font-clash uppercase tracking-wider">
                  Select Tags
                </span>
              </div>
              <button
                type="button"
                onClick={() => setIsTagSelectorOpen(false)}
                className="w-8 h-8 rounded-lg flex items-center justify-center text-white/40 hover:text-white bg-white/5 transition-all"
              >
                <X size={16} />
              </button>
            </div>

            <div className="flex-1 overflow-y-auto flex flex-col gap-2 min-h-0">
              <button
                type="button"
                onClick={() => {
                  setIsTagSelectorOpen(false);
                  openUnified('new-tag', {
                    onSuccess: async () => {
                      await refreshEcosystemTags();
                      setIsTagSelectorOpen(true);
                    },
                  });
                }}
                className="w-full py-2.5 px-4 rounded-xl bg-[#A855F7]/10 border border-dashed border-[#A855F7]/30 hover:bg-[#A855F7]/20 text-[#C084FC] text-xs font-bold font-mono flex items-center gap-2 transition-all cursor-pointer"
              >
                <Plus size={16} />
                <span>CREATE NEW TAG</span>
              </button>

              {(ecosystemTags || []).map((tag) => {
                const isSelected = tags.includes(tag.name || '');
                const color = (tag as any).color || '#A855F7';
                return (
                  <button
                    key={tag.$id}
                    type="button"
                    onClick={() => {
                      if (isSelected) {
                        removeTag(tag.name || '');
                      } else {
                        appendTag(tag.name || '');
                      }
                    }}
                    className={`w-full flex items-center justify-between p-3 rounded-xl border transition-all cursor-pointer text-left ${
                      isSelected
                        ? 'bg-white/10 border-white/20'
                        : 'bg-white/[0.02] border-white/5 hover:bg-white/[0.06] hover:border-white/10'
                    }`}
                    style={isSelected ? { borderColor: `${color}60`, backgroundColor: `${color}15` } : undefined}
                  >
                    <div className="flex items-center gap-2.5">
                      <div
                        className="w-3 h-3 rounded-md shrink-0"
                        style={{ backgroundColor: color, boxShadow: `0 0 8px ${color}50` }}
                      />
                      <span className="text-white text-xs font-mono font-bold uppercase tracking-wider">
                        {tag.name}
                      </span>
                    </div>
                    {isSelected && (
                      <span
                        className="text-[10px] font-mono font-black uppercase tracking-wider px-2 py-0.5 rounded-md"
                        style={{ color, backgroundColor: `${color}20` }}
                      >
                        SELECTED
                      </span>
                    )}
                  </button>
                );
              })}
            </div>
          </div>
        </div>
      )}

      {showMobileDatePicker && (
        <EventDateTimePickerDrawer
          open={showMobileDatePicker}
          startTime={dueDate ? new Date(`${dueDate}T12:00:00`) : new Date()}
          endTime={dueDate ? new Date(`${dueDate}T13:00:00`) : new Date(new Date().getTime() + 3600000)}
          onApply={(start) => {
            const y = start.getFullYear();
            const m = String(start.getMonth() + 1).padStart(2, '0');
            const d = String(start.getDate()).padStart(2, '0');
            const dateStr = `${y}-${m}-${d}`;
            setDueDate(dateStr);
            pushLive(buildLive(content, title, priority, dateStr));
            setShowMobileDatePicker(false);
          }}
          onClose={() => setShowMobileDatePicker(false)}
        />
      )}
    </div>
  );
}
