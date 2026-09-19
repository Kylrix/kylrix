'use client';

import React, { useState, useCallback } from 'react';
import { Layers, FolderKanban, Check, Sparkles, User, ArrowRightLeft, X } from 'lucide-react';
import { useUnifiedDrawer } from '@/context/UnifiedDrawerContext';
import { useWorkspace, type WorkspaceItem } from '@/context/WorkspaceContext';
import { useAuth } from '@/context/auth/AuthContext';
import { useToast } from '@/components/ui/Toast';
import { useTask } from '@/context/TaskContext';
import { useNotes } from '@/context/NotesContext';
import { attachObjectToProject } from '@/lib/projects/object-attachment';
import { getRxDB } from '@/lib/webrtc/RxDBManager';
import { LocalEngine } from '@/lib/services/LocalEngine';

type MoveToWorkspaceData = {
  entityKind?: string;
  entityId?: string;
  entityTitle?: string;
  currentWorkspaceId?: string;
  resourceType?: string;
  resourceId?: string;
  resourceTitle?: string;
  noteId?: string;
  noteTitle?: string;
  taskId?: string;
  taskTitle?: string;
};

export function MoveToWorkspaceDrawer() {
  const { activeContent, drawerData, close } = useUnifiedDrawer();
  const { workspaces, activeWorkspace, setEntityPersonalWorkspaceState } = useWorkspace();
  const { user } = useAuth();
  const { showSuccess, showError } = useToast();
  const { updateTask, tasks } = useTask();
  const { upsertNote, notes } = useNotes();
  const [movingId, setMovingId] = useState<string | null>(null);

  const isOpen = activeContent === 'move-to-workspace';
  if (!isOpen) return null;

  const data = (drawerData || {}) as MoveToWorkspaceData;
  const rawKind = (data.entityKind || data.resourceType || 'item').toLowerCase();
  const entityKind =
    rawKind === 'task' ? 'goal' : rawKind === 'idea' ? 'note' : rawKind === 'password' || rawKind === 'credential' ? 'secret' : rawKind;
  const entityId = data.entityId || data.resourceId || data.noteId || data.taskId || '';
  const entityTitle = data.entityTitle || data.resourceTitle || data.noteTitle || data.taskTitle || 'Item';
  const currentWorkspaceId = data.currentWorkspaceId || activeWorkspace?.id || user?.$id || 'guest';

  const handleSelectWorkspace = async (targetWs: WorkspaceItem) => {
    if (!entityId || movingId) return;
    setMovingId(targetWs.id);

    try {
      const uid = user?.$id || 'guest';
      const isPersonalTarget = targetWs.isPersonal || targetWs.id === uid || targetWs.id === 'personal' || targetWs.id === 'guest';
      const targetWorkspaceId = isPersonalTarget ? uid : targetWs.id;

      // 1. Clean local RxDB swap (0ms substrate update)
      const db = await getRxDB().catch(() => null);

      if (entityKind === 'goal' || entityKind === 'task') {
        if (db?.tasks) {
          const doc = await db.tasks.findOne(entityId).exec().catch(() => null);
          if (doc) {
            await doc.patch({
              projectId: isPersonalTarget ? 'inbox' : targetWorkspaceId,
              updatedAt: new Date().toISOString(),
            }).catch(() => {});
          }
        }
        // Update TaskContext in memory
        updateTask(entityId, {
          projectId: isPersonalTarget ? 'inbox' : targetWorkspaceId,
          isWorkspace: !isPersonalTarget,
        } as any);

        // Update LocalEngine caches
        const taskCacheKey = `f_goals_list_${uid}`;
        const cachedGoals = await LocalEngine.cacheGet<any[]>(taskCacheKey).catch(() => null);
        if (Array.isArray(cachedGoals)) {
          const updated = cachedGoals.map((t) =>
            t.id === entityId || t.$id === entityId
              ? { ...t, projectId: isPersonalTarget ? 'inbox' : targetWorkspaceId, isWorkspace: !isPersonalTarget }
              : t
          );
          await LocalEngine.cacheSet(taskCacheKey, updated);
        }
      } else if (entityKind === 'note' || entityKind === 'idea') {
        if (db?.notes) {
          const doc = await db.notes.findOne(entityId).exec().catch(() => null);
          if (doc) {
            try {
              const meta = JSON.parse(doc.metadata || '{}');
              meta.projectId = isPersonalTarget ? null : targetWorkspaceId;
              meta.isWorkspace = !isPersonalTarget;
              await doc.patch({
                metadata: JSON.stringify(meta),
                updatedAt: new Date().toISOString(),
              }).catch(() => {});
            } catch {}
          }
        }
        // Update NotesContext in memory
        const liveNote = notes?.find((n) => n.$id === entityId);
        if (liveNote) {
          upsertNote({
            ...liveNote,
            projectId: isPersonalTarget ? undefined : targetWorkspaceId,
            isWorkspace: !isPersonalTarget,
          } as any);
        }

        // Update LocalEngine caches
        const ideaCacheKey = `f_ideas_${uid}`;
        const cachedIdeas = await LocalEngine.cacheGet<any>(ideaCacheKey).catch(() => null);
        if (cachedIdeas?.rows && Array.isArray(cachedIdeas.rows)) {
          const updatedRows = cachedIdeas.rows.map((n: any) =>
            n.$id === entityId
              ? { ...n, projectId: isPersonalTarget ? undefined : targetWorkspaceId, isWorkspace: !isPersonalTarget }
              : n
          );
          await LocalEngine.cacheSet(ideaCacheKey, { ...cachedIdeas, rows: updatedRows });
        }
      }

      // 2. Perform background attachment or personal state update
      if (!isPersonalTarget) {
        await attachObjectToProject({
          projectId: targetWorkspaceId,
          entityKind,
          entityId,
        });
      } else {
        await setEntityPersonalWorkspaceState(entityKind, entityId, true);
      }

      // 3. Dispatch events to notify UI components cleanly
      if (typeof window !== 'undefined') {
        window.dispatchEvent(
          new CustomEvent('kylrix:workspace-changed', {
            detail: { workspaceId: targetWorkspaceId, entityKind, entityId },
          })
        );
        window.dispatchEvent(
          new CustomEvent('kylrix:nexus:update', {
            detail: { key: `local:${entityKind}:${entityId}`, data: { id: entityId, projectId: targetWorkspaceId } },
          })
        );
      }

      showSuccess(`Moved "${entityTitle}" to ${targetWs.title}`);
      close();
    } catch (err: any) {
      showError(err?.message || 'Failed to move object to workspace');
    } finally {
      setMovingId(null);
    }
  };

  return (
    <div className="p-6 pb-8 max-h-[75dvh] overflow-y-auto bg-[#161412] text-white font-satoshi">
      {/* Header */}
      <div className="flex items-center justify-between pb-3 mb-4 border-b border-white/10">
        <div className="flex items-center gap-3">
          <div className="p-2 rounded-xl bg-[#6366F1]/15 border border-[#6366F1]/30 text-[#818CF8]">
            <ArrowRightLeft size={18} />
          </div>
          <div>
            <h3 className="text-base font-black text-white font-clash leading-tight">
              Move to Workspace
            </h3>
            <span className="text-[11px] font-mono text-white/50 uppercase tracking-wider block mt-0.5">
              Select Destination Workspace
            </span>
          </div>
        </div>
        <button
          type="button"
          onClick={close}
          className="p-1.5 rounded-xl bg-[#0A0908] border border-white/10 text-white/50 hover:text-white transition-colors cursor-pointer"
        >
          <X size={16} />
        </button>
      </div>

      <p className="text-xs text-white/60 mb-4">
        Choose target workspace for <strong className="text-white font-bold">&ldquo;{entityTitle}&rdquo;</strong>. The object will instantly swap to the selected workspace.
      </p>

      {/* Workspaces List */}
      <div className="flex flex-col gap-2">
        {workspaces.map((w) => {
          const isCurrent = currentWorkspaceId === w.id || (w.isPersonal && (currentWorkspaceId === 'personal' || currentWorkspaceId === user?.$id));
          const isSelected = movingId === w.id;

          return (
            <button
              key={w.id}
              type="button"
              disabled={Boolean(movingId)}
              onClick={() => handleSelectWorkspace(w)}
              className={`w-full flex items-center justify-between p-3.5 rounded-2xl border text-left transition-all duration-150 cursor-pointer ${
                isCurrent
                  ? 'bg-[#6366F1]/15 border-[#6366F1]/40 text-white'
                  : 'bg-[#0A0908] border-white/10 hover:border-[#6366F1]/50 hover:bg-[#161412] text-[#F5F2ED]'
              }`}
            >
              <div className="flex items-center gap-3 min-w-0 flex-1">
                <div className={`p-2 rounded-xl border shrink-0 ${
                  w.isPersonal
                    ? 'bg-amber-500/10 border-amber-500/20 text-amber-400'
                    : w.isAgentic
                      ? 'bg-purple-500/10 border-purple-500/20 text-purple-400'
                      : 'bg-indigo-500/10 border-indigo-500/20 text-indigo-400'
                }`}>
                  {w.isPersonal ? <User size={16} /> : w.isAgentic ? <Sparkles size={16} /> : <FolderKanban size={16} />}
                </div>

                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2">
                    <span className="font-extrabold text-sm text-white truncate font-clash">
                      {w.title}
                    </span>
                    {isCurrent && (
                      <span className="text-[10px] font-mono uppercase px-2 py-0.5 rounded-md bg-[#6366F1]/20 border border-[#6366F1]/40 text-[#818CF8] font-bold">
                        Current
                      </span>
                    )}
                  </div>
                  <span className="text-xs text-white/50 block truncate mt-0.5 font-satoshi">
                    {w.isPersonal
                      ? 'Default personal workspace'
                      : w.isAgentic
                        ? 'Agent workspace'
                        : w.isShared
                          ? 'Shared workspace'
                          : 'Custom workspace'}
                  </span>
                </div>
              </div>

              {isSelected ? (
                <div className="p-1 rounded-lg bg-emerald-500/20 text-emerald-400 border border-emerald-500/40">
                  <Check size={16} />
                </div>
              ) : isCurrent ? (
                <div className="w-2.5 h-2.5 rounded-full bg-[#818CF8] shadow-[0_0_8px_#818CF8]" />
              ) : null}
            </button>
          );
        })}
      </div>
    </div>
  );
}
