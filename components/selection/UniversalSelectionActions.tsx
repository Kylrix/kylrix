'use client';

import React, { useState } from 'react';
import {
  Trash2,
  FolderInput,
  Pin,
  X,
  Folder,
} from 'lucide-react';
import { useSelection } from '@/context/SelectionContext';
import { useWorkspace, type WorkspaceItem } from '@/context/WorkspaceContext';
import { useNotes } from '@/context/NotesContext';
import { useTask } from '@/context/TaskContext';
import { useEvents } from '@/context/EventsContext';
import { useResourcePins } from '@/context/ResourcePinContext';
import { useAuth } from '@/context/auth/AuthContext';
import { useUnifiedDrawer } from '@/context/UnifiedDrawerContext';
import { useSudo } from '@/context/SudoContext';
import toast from 'react-hot-toast';

export function UniversalSelectionActions() {
  const { isSelectMode, activeKind, selectedIds, exitSelectMode, clearSelection } = useSelection();
  const { workspaces } = useWorkspace();
  const { removeNote, pinNote, unpinNote, isPinned: checkNotePinned } = useNotes();
  const { deleteTask, togglePinTask } = useTask();
  const { removeEvent } = useEvents();
  const { togglePin } = useResourcePins();
  const { user } = useAuth();
  const { open: openUnified } = useUnifiedDrawer();
  const { requestSudo } = useSudo();

  const [showWorkspacePicker, setShowWorkspacePicker] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);

  if (!isSelectMode) return null;

  const count = selectedIds.length;
  const kindLabel = activeKind === 'credential' ? 'secret' : activeKind || 'item';

  const handleDeleteSelected = async () => {
    if (count === 0) return;

    const performDelete = async () => {
      setIsProcessing(true);
      toast.loading(`Deleting ${count} ${kindLabel}(s)...`, { id: 'bulk-delete' });
      try {
        const { autonomicSyncEngine } = await import('@/lib/services/sync-engine');
        const { getRxDB } = await import('@/lib/webrtc/RxDBManager');
        const db = await getRxDB().catch(() => null);

        for (const id of selectedIds) {
          autonomicSyncEngine.cancelPending(id);
          if (db) {
            db.cache.findOne(`goal_${id}`).remove().catch(() => {});
            db.cache.findOne(`note_${id}`).remove().catch(() => {});
            db.notes.findOne(id).remove().catch(() => {});
          }

          if (activeKind === 'note') {
            removeNote(id);
            try {
              const { deleteNote } = await import('@/lib/actions/client-ops');
              await deleteNote(id).catch(() => null);
            } catch {}
          } else if (activeKind === 'goal' || activeKind === 'task') {
            deleteTask(id);
            try {
              const { tasks } = await import('@/lib/kylrixflow');
              await tasks.delete(id).catch(() => null);
            } catch {}
          } else if (activeKind === 'event') {
            removeEvent(id);
            try {
              const { events } = await import('@/lib/kylrixflow');
              await events.delete(id).catch(() => null);
            } catch {}
          } else if (activeKind === 'credential') {
            try {
              const { deleteCredential } = await import('@/lib/appwrite');
              await deleteCredential(id).catch(() => null);
            } catch {}
          } else if (activeKind === 'totp') {
            try {
              const { deleteTotp } = await import('@/lib/appwrite');
              await deleteTotp(id).catch(() => null);
            } catch {}
          }
        }

        toast.success(`Deleted ${count} ${kindLabel}(s)!`, { id: 'bulk-delete' });
        exitSelectMode();
      } catch (err: any) {
        toast.error(`Delete failed: ${err.message}`, { id: 'bulk-delete' });
      } finally {
        setIsProcessing(false);
      }
    };

    if (activeKind === 'credential' || activeKind === 'totp') {
      requestSudo({
        onSuccess: () => {
          openUnified('delete-confirm', {
            title: `Delete ${count} ${kindLabel}(s)?`,
            description: `This will permanently remove ${count} ${kindLabel}(s) from your vault.`,
            confirmLabel: `Delete (${count})`,
            onConfirm: performDelete,
          });
        },
      });
    } else {
      openUnified('delete-confirm', {
        title: `Delete ${count} ${kindLabel}(s)?`,
        description: `This will remove ${count} ${kindLabel}(s) from your active view.`,
        confirmLabel: `Delete (${count})`,
        onConfirm: performDelete,
      });
    }
  };

  const handleMoveToWorkspace = async (workspace: WorkspaceItem) => {
    if (count === 0) return;
    setIsProcessing(true);
    toast.loading(`Moving ${count} ${kindLabel}(s) to ${workspace.title}...`, { id: 'bulk-move' });
    try {
      const { attachObjectToProject } = await import('@/lib/projects/object-attachment');
      for (const id of selectedIds) {
        await attachObjectToProject({
          projectId: workspace.id,
          entityKind: activeKind || 'note',
          entityId: id,
        }).catch(() => null);
      }
      toast.success(`Moved ${count} items to ${workspace.title}!`, { id: 'bulk-move' });
      setShowWorkspacePicker(false);
      exitSelectMode();
    } catch (err: any) {
      toast.error(`Move failed: ${err.message}`, { id: 'bulk-move' });
    } finally {
      setIsProcessing(false);
    }
  };

  const handleTogglePinSelected = async () => {
    if (count === 0) return;
    setIsProcessing(true);
    toast.loading(`Pinning / unpinning ${count} item(s)...`, { id: 'bulk-pin' });
    try {
      for (const id of selectedIds) {
        if (activeKind === 'note') {
          const isPin = checkNotePinned(id);
          if (isPin) await unpinNote(id).catch(() => {});
          else await pinNote(id).catch(() => {});
        } else if (activeKind === 'goal' || activeKind === 'task') {
          await togglePinTask(id).catch(() => {});
        } else if (activeKind === 'event') {
          await togglePin({
            resourceType: 'event',
            resourceId: id,
            ownerId: user?.$id || 'guest',
            rowIsPinned: false,
            setOwnerRowPin: async () => {},
          }).catch(() => {});
        }
      }
      toast.success(`Updated pins for ${count} item(s)`, { id: 'bulk-pin' });
      exitSelectMode();
    } catch (err: any) {
      toast.error(`Pin update failed: ${err.message}`, { id: 'bulk-pin' });
    } finally {
      setIsProcessing(false);
    }
  };

  return (
    <div className="w-full h-full min-h-0 bg-[#161412] text-white p-3.5 sm:p-4 flex flex-col gap-2.5 overflow-y-auto font-satoshi">
      {/* Header */}
      <div className="flex flex-col gap-1 shrink-0 border-b border-white/5 pb-2">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <span className="w-2 h-2 rounded-full bg-[#10B981] animate-pulse" />
            <p className="text-[10px] font-black uppercase tracking-[0.16em] text-[#10B981]">
              Select Mode Active
            </p>
          </div>
          <button
            type="button"
            onClick={exitSelectMode}
            className="text-xs font-bold text-[#9B9691] hover:text-white px-2 py-0.5 rounded-lg hover:bg-white/5 cursor-pointer flex items-center gap-1"
          >
            <X size={14} />
            Done
          </button>
        </div>
        <h4 className="text-sm font-extrabold text-white truncate max-w-full font-clash leading-tight">
          {count === 0
            ? `Select ${kindLabel}s...`
            : `${count} ${kindLabel}${count === 1 ? '' : 's'} selected`}
        </h4>
      </div>

      {/* Action list */}
      <div className="flex flex-col gap-1.5">
        <button
          type="button"
          disabled={count === 0 || isProcessing}
          onClick={handleDeleteSelected}
          className={`w-full flex items-center justify-between gap-3 px-3 py-2.5 rounded-xl text-xs sm:text-sm font-semibold transition-all duration-150 text-left border cursor-pointer ${
            count === 0
              ? 'opacity-40 bg-[#161412] border-[#1C1A18] text-[#9B9691] cursor-not-allowed'
              : 'bg-red-500/10 border-red-500/20 text-[#FF453A] hover:bg-red-500/20'
          }`}
        >
          <div className="flex items-center gap-2.5 min-w-0 flex-1">
            <div className="p-1.5 rounded-lg bg-[#0A0908] border border-red-500/20 text-[#FF453A] shrink-0">
              <Trash2 size={15} />
            </div>
            <span className="whitespace-normal leading-snug break-words">
              Delete Selected ({count})
            </span>
          </div>
        </button>

        <button
          type="button"
          disabled={count === 0 || isProcessing}
          onClick={() => setShowWorkspacePicker(!showWorkspacePicker)}
          className={`w-full flex items-center justify-between gap-3 px-3 py-2.5 rounded-xl text-xs sm:text-sm font-semibold transition-all duration-150 text-left border cursor-pointer ${
            count === 0
              ? 'opacity-40 bg-[#161412] border-[#1C1A18] text-[#9B9691] cursor-not-allowed'
              : 'bg-[#161412] border-[#1C1A18] text-[#F5F2ED] hover:border-[#6366F1] hover:text-white'
          }`}
        >
          <div className="flex items-center gap-2.5 min-w-0 flex-1">
            <div className="p-1.5 rounded-lg bg-[#0A0908] border border-[#1C1A18] text-[#6366F1] shrink-0">
              <FolderInput size={15} />
            </div>
            <span className="whitespace-normal leading-snug break-words">Move to Workspace...</span>
          </div>
        </button>

        {showWorkspacePicker && (
          <div className="p-2.5 bg-[#0A0908] border border-[#1C1A18] rounded-xl flex flex-col gap-1.5 animate-in fade-in-50 duration-150">
            <p className="text-[9px] font-black uppercase tracking-wider text-[#9B9691] px-1">
              Select Destination
            </p>
            {workspaces.map((ws) => (
              <button
                key={ws.id}
                type="button"
                onClick={() => void handleMoveToWorkspace(ws)}
                className="w-full flex items-center gap-2 p-2 rounded-lg bg-[#161412] border border-[#1C1A18] hover:border-[#6366F1] text-xs font-bold text-white text-left transition-colors cursor-pointer"
              >
                <Folder size={13} className="text-[#6366F1]" />
                <span className="truncate flex-1">{ws.title}</span>
              </button>
            ))}
          </div>
        )}

        <button
          type="button"
          disabled={count === 0 || isProcessing}
          onClick={handleTogglePinSelected}
          className={`w-full flex items-center justify-between gap-3 px-3 py-2.5 rounded-xl text-xs sm:text-sm font-semibold transition-all duration-150 text-left border cursor-pointer ${
            count === 0
              ? 'opacity-40 bg-[#161412] border-[#1C1A18] text-[#9B9691] cursor-not-allowed'
              : 'bg-[#161412] border-[#1C1A18] text-[#F5F2ED] hover:border-[#F59E0B] hover:text-white'
          }`}
        >
          <div className="flex items-center gap-2.5 min-w-0 flex-1">
            <div className="p-1.5 rounded-lg bg-[#0A0908] border border-[#1C1A18] text-[#F59E0B] shrink-0">
              <Pin size={15} />
            </div>
            <span className="whitespace-normal leading-snug break-words">Pin / Unpin Selected</span>
          </div>
        </button>

        <button
          type="button"
          onClick={clearSelection}
          className="w-full flex items-center justify-center gap-1.5 py-2 text-xs font-bold text-[#9B9691] hover:text-white transition-colors cursor-pointer mt-1"
        >
          Clear Selection
        </button>
      </div>
    </div>
  );
}
