'use client';

import React, { useCallback, useEffect, useRef, useState } from 'react';
import { ID } from 'appwrite';
import { Check, ChevronDown, ChevronUp, Target } from 'lucide-react';
import { buildAutoTitleFromContent, resolveNoteCardTitle } from '@/constants/noteTitle';
import { useTask } from '@/context/TaskContext';
import { useAuth } from '@/lib/auth';
import { SyncStatusDot, SyncStatusLabel } from '@/components/ui/SyncStatusDot';
import { goalPendingKey } from '@/lib/sync/goal-keys';
import { PRIORITY_COLORS } from '@/components/objects/ObjectCardMeta';
import type { Priority, Task } from '@/types';
import { autonomicSyncEngine } from '@/lib/services/sync-engine';

const PRIORITIES: Priority[] = ['urgent', 'high', 'medium', 'low'];

type Props = {
  onClose?: () => void;
  onRegisterClose?: (close: (() => void) | null) => void;
  isExpanded?: boolean;
  onToggleExpand?: () => void;
  onGoalCreated?: (task: Task) => void;
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
}: Props) {
  const { pushLiveGoal, selectedProjectId, userId, deleteTask } = useTask();
  const { user } = useAuth();
  const ownerId = user?.$id || userId || 'guest';

  const [content, setContent] = useState('');
  const [title, setTitle] = useState('');
  const [isTitleManuallyEdited, setIsTitleManuallyEdited] = useState(false);
  const [priority, setPriority] = useState<Priority>('medium');
  const [dueDate, setDueDate] = useState('');
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

  useEffect(() => {
    onRegisterClose?.(handleClose);
    return () => onRegisterClose?.(null);
  }, [handleClose, onRegisterClose]);

  const resourceId = resolvedId ? goalPendingKey(resolvedId) : null;

  return (
    <div
      onContextMenu={(e) => e.preventDefault()}
      className="w-full h-full min-h-0 flex flex-col bg-[#161412] text-white"
    >
      <div className="px-2 py-1.5 flex items-center justify-between border-b border-white/5 sticky top-0 z-20 bg-[#161412]/95 shrink-0">
        <div className="flex items-center gap-1.5 min-w-0">
          <div className="w-7 h-7 rounded-lg flex items-center justify-center bg-[#A855F7]/10 border border-[#A855F7]/20 text-[#A855F7] shrink-0">
            <Target className="w-3.5 h-3.5" />
          </div>
          <div className="min-w-0 flex flex-col">
            <span className="font-extrabold text-sm font-mono tracking-tight text-white leading-tight">
              New Goal
            </span>
            <div className="flex items-center gap-1.5 mt-0.5 select-none">
              <SyncStatusDot resourceId={resourceId} />
              <SyncStatusLabel resourceId={resourceId} />
            </div>
          </div>
        </div>

        <div className="flex items-center gap-1.5 shrink-0">
          {isMobile ? (
            <button
              type="button"
              onClick={toggleExpand}
              className="p-1.5 rounded-lg text-white/60 hover:text-white hover:bg-white/5 border border-transparent hover:border-white/5 transition-all shrink-0"
            >
              {isExpanded ? <ChevronDown className="w-3.5 h-3.5" /> : <ChevronUp className="w-3.5 h-3.5" />}
            </button>
          ) : null}
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

      <div className="flex-1 overflow-y-auto p-2 flex flex-col gap-2 min-h-0 scrollbar-thin">
        {(content.trim().length >= 5 || isTitleManuallyEdited) && (
          <input
            type="text"
            value={title}
            onChange={(e) => {
              setTitle(e.target.value);
              setIsTitleManuallyEdited(true);
              pushLive(buildLive(content, e.target.value));
            }}
            placeholder="Title"
            className="w-full bg-white/[0.02] text-white placeholder-white/20 border border-white/5 focus:border-[#A855F7]/30 rounded-xl px-3 py-2 text-xl font-black focus:outline-none transition-all font-clash shrink-0"
          />
        )}

        <textarea
          ref={contentRef}
          rows={isExpanded ? 12 : 6}
          value={content}
          onPaste={() => {
            isPastedRef.current = true;
            if (pasteTimerRef.current) clearTimeout(pasteTimerRef.current);
            pasteTimerRef.current = setTimeout(() => {
              isPastedRef.current = false;
            }, 2000);
          }}
          onChange={(e) => handleContentChange(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter' && !e.shiftKey && !isExpanded && !isPastedRef.current) {
              e.preventDefault();
              handleClose();
            }
          }}
          placeholder="Write your goal..."
          autoFocus
          className="w-full h-full min-h-[160px] resize-none bg-white/[0.03] text-white placeholder-white/20 border border-white/[0.06] hover:border-white/10 focus:border-[#A855F7]/30 rounded-xl px-3 py-2 text-lg focus:outline-none transition-all scrollbar-thin"
        />
      </div>

      <div className="px-2.5 py-1.5 border-t border-white/5 bg-[#161412] flex flex-col gap-2 shrink-0">
        <div className="flex flex-wrap gap-1.5">
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
                className="px-2.5 py-1 rounded-lg text-[10px] font-black font-mono uppercase tracking-wider border transition-colors"
                style={{
                  color,
                  borderColor: active ? `${color}66` : `${color}28`,
                  backgroundColor: active ? `${color}22` : `${color}0d`,
                }}
              >
                {p}
              </button>
            );
          })}
        </div>
        <label className="flex items-center gap-2 text-[10px] font-mono uppercase tracking-wider text-white/40">
          Due
          <input
            type="date"
            value={dueDate}
            onChange={(e) => {
              setDueDate(e.target.value);
              pushLive(buildLive(content, title, priority, e.target.value));
            }}
            className="flex-1 rounded-lg border border-white/5 bg-black/40 px-2 py-1.5 text-white text-xs font-satoshi normal-case tracking-normal"
          />
        </label>
      </div>
    </div>
  );
}
