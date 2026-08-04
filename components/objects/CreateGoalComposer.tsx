'use client';

import React, { useCallback, useEffect, useRef, useState } from 'react';
import { ID } from 'appwrite';
import { Calendar, Check, ChevronDown, ChevronUp, Target } from 'lucide-react';
import { buildAutoTitleFromContent, resolveNoteCardTitle } from '@/constants/noteTitle';
import { useTask } from '@/context/TaskContext';
import { useAuth } from '@/lib/auth';
import { SyncStatusDot, SyncStatusLabel } from '@/components/ui/SyncStatusDot';
import { goalPendingKey } from '@/lib/sync/goal-keys';
import { PRIORITY_COLORS } from '@/components/objects/ObjectCardMeta';
import type { Priority, Task } from '@/types';
import { autonomicSyncEngine } from '@/lib/services/sync-engine';
import { useDynamicSidebar } from '@/components/ui/DynamicSidebar';
import {
  EventDateTimePickerSurface,
  EventDateTimePickerDrawer,
} from '@/components/events/drawers/EventDateTimePickerDrawer';

const PRIORITIES: Priority[] = ['urgent', 'high', 'medium', 'low'];

type Props = {
  onClose?: () => void;
  onRegisterClose?: (close: (() => void) | null) => void;
  isExpanded?: boolean;
  onToggleExpand?: () => void;
  onGoalCreated?: (task: Task) => void;
  initialContent?: {
    title?: string;
    content?: string;
    priority?: Priority;
    dueDate?: string;
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
  const { pushLiveGoal, selectedProjectId, userId, deleteTask } = useTask();
  const { user } = useAuth();
  const ownerId = user?.$id || userId || 'guest';
  const { openSidebar } = useDynamicSidebar();

  const [content, setContent] = useState(initialContent?.content || '');
  const [title, setTitle] = useState(initialContent?.title || '');
  const [isTitleManuallyEdited, setIsTitleManuallyEdited] = useState(Boolean(initialContent?.title));
  const [priority, setPriority] = useState<Priority>(initialContent?.priority || 'medium');
  const [dueDate, setDueDate] = useState(initialContent?.dueDate || '');
  const [showMobileDatePicker, setShowMobileDatePicker] = useState(false);
  const [resolvedId, setResolvedId] = useState<string | undefined>();
  const [localExpanded, setLocalExpanded] = useState(false);
  const [isMobile, setIsMobile] = useState(false);
  const isExpanded = controlledExpanded !== undefined ? controlledExpanded : localExpanded;
  const toggleExpand = onToggleExpand || (() => setLocalExpanded((v) => !v));
  const liveIdRef = useRef<string | undefined>(undefined);
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

  useEffect(() => {
    if (isTitleManuallyEdited) return;
    const generated = buildAutoTitleFromContent(content);
    setTitle(content.trim() ? generated : '');
  }, [content, isTitleManuallyEdited]);

  const ensureId = useCallback(() => {
    const existing = resolvedId || liveIdRef.current;
    if (existing) return existing;
    const id = ID.unique();
    liveIdRef.current = id;
    setResolvedId(id);
    return id;
  }, [resolvedId]);

  const buildLive = useCallback(
    (nextContent: string, nextTitle?: string, nextPriority?: Priority, nextDue?: string): Task => {
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
        projectId: selectedProjectId || 'inbox',
        labels: [],
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
    [dueDate, ensureId, isTitleManuallyEdited, ownerId, priority, selectedProjectId, title],
  );

  const pushLive = useCallback(
    (task: Task) => {
      if (typeof pushLiveGoal === 'function') {
        pushLiveGoal(task);
        autonomicSyncEngine.nudge();
      }
      if (!announcedRef.current && (task.title?.trim() || task.description?.trim())) {
        announcedRef.current = true;
        onGoalCreated?.(task);
      }
    },
    [onGoalCreated, pushLiveGoal],
  );

  const handleContentChange = useCallback(
    (next: string) => {
      setContent(next);
      const generated = isTitleManuallyEdited ? title : buildAutoTitleFromContent(next);
      if (!isTitleManuallyEdited) setTitle(generated);
      pushLive(buildLive(next, generated));

      if (contentRef.current) {
        contentRef.current.style.height = 'auto';
        contentRef.current.style.height = `${Math.max(76, Math.min(contentRef.current.scrollHeight, 360))}px`;
      }
    },
    [buildLive, isTitleManuallyEdited, pushLive, title],
  );

  const handleClose = useCallback(() => {
    const id = liveIdRef.current || resolvedId;
    const hasContent = Boolean(content.trim() || title.trim());
    if (!hasContent && id) {
      if (typeof deleteTask === 'function') {
        void deleteTask(id);
      }
      autonomicSyncEngine.ack(goalPendingKey(id));
    } else if (hasContent) {
      pushLive(buildLive(content, title));
      autonomicSyncEngine.nudge();
    }
    onClose?.();
  }, [buildLive, content, deleteTask, onClose, pushLive, resolvedId, title]);

  const handleOpenDatePicker = useCallback(() => {
    const isDesktopWindow = typeof window !== 'undefined' && window.innerWidth >= 900;
    const initialStart = dueDate ? new Date(`${dueDate}T12:00:00`) : new Date();
    const initialEnd = new Date(initialStart.getTime() + 3600000);

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
                initialContent={{ title, content, priority, dueDate: dateStr }}
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
                initialContent={{ title, content, priority, dueDate }}
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
  }, [dueDate, content, title, priority, buildLive, pushLive, openSidebar, onClose, onGoalCreated, controlledExpanded]);

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
      <div className="px-4 py-3 flex items-center justify-between border-b border-white/5 sticky top-0 z-20 bg-[#161412] shrink-0">
        <div className="flex items-center gap-2.5 min-w-0">
          <div className="w-8 h-8 rounded-xl flex items-center justify-center bg-[#A855F7]/10 border border-[#A855F7]/25 text-[#A855F7] shrink-0">
            <Target className="w-4 h-4" />
          </div>
          <div className="min-w-0 flex flex-col">
            <span className="font-extrabold text-sm font-clash tracking-tight text-white leading-tight">
              Create New Goal
            </span>
            <div className="flex items-center gap-1.5 mt-0.5 select-none">
              <SyncStatusDot resourceId={resourceId} />
              <SyncStatusLabel resourceId={resourceId} />
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
              pushLive(buildLive(content, e.target.value));
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
        </div>
      </div>

      {showMobileDatePicker && (
        <EventDateTimePickerDrawer
          open={showMobileDatePicker}
          startTime={dueDate ? new Date(`${dueDate}T12:00:00`) : new Date()}
          endTime={dueDate ? new Date(`${dueDate}T13:00:00`) : new Date(Date.now() + 3600000)}
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
