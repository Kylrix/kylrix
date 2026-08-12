'use client';

import React, { useState } from 'react';
import { AlertTriangle, Trash2, X } from 'lucide-react';
import { useUnifiedDrawer } from '@/context/UnifiedDrawerContext';

export interface DeleteConfirmData {
  title: string;
  description?: string;
  confirmLabel?: string;
  onConfirm: (deleteMode?: 'detach' | 'created_within' | 'all') => Promise<void> | void;
  resourceName?: string;
  isProject?: boolean;
}

export function DeleteConfirmDrawer() {
  const { drawerData, close } = useUnifiedDrawer();
  const [loading, setLoading] = useState(false);
  const [deleteMode, setDeleteMode] = useState<'detach' | 'created_within' | 'all'>('detach');

  const data = drawerData as DeleteConfirmData;

  if (!data) return null;

  const handleConfirm = async () => {
    setLoading(true);
    try {
      if (data.isProject) {
        await data.onConfirm(deleteMode);
      } else {
        await data.onConfirm();
      }
      close();
    } catch (err) {
      console.error('[DeleteConfirm] Action failed:', err);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="flex flex-col bg-[#161412] text-white">
      {/* Handle / Header Bar (Matching SudoModal MasterPass header) */}
      <div className="relative px-5 pt-3 pb-2 flex-shrink-0 bg-[#161412]">
        <div className="flex justify-center mb-3">
          <div className="rounded-full bg-white/10" style={{ width: 44, height: 5 }} />
        </div>
        <div className="flex items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-red-500/10 border border-red-500/20 text-red-400 flex items-center justify-center shrink-0">
              <AlertTriangle className="w-5 h-5 stroke-[2.5]" />
            </div>
            <div className="min-w-0">
              <h3 className="font-clash font-black text-white text-lg tracking-tight leading-tight truncate">
                {data.title || 'Confirm Deletion'}
              </h3>
              <p className="text-xs text-white/40 font-semibold font-satoshi mt-0.5">
                Destructive Action
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={close}
            className="w-8 h-8 rounded-full flex items-center justify-center text-white/40 hover:text-white hover:bg-white/5 transition-all"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
      </div>

      <div className="h-px bg-white/8 w-full my-1" />

      {/* Content Area */}
      <div className="px-5 py-4 flex-1 overflow-y-auto bg-[#161412] space-y-4">
        <p className="text-xs text-white/60 font-semibold font-satoshi leading-relaxed">
          {data.description || `Are you sure you want to permanently delete ${data.resourceName || 'this resource'}? This action cannot be undone.`}
        </p>

        {data.isProject && (
          <div className="space-y-2">
            <span className="text-[10px] text-white/40 font-bold tracking-wider uppercase block">
              DELETION SCOPE
            </span>
            <div className="space-y-2">
              {[
                {
                  id: 'detach',
                  title: 'Keep Linked Items (Unlink Only)',
                  desc: 'Removes the workspace row, leaving linked notes, forms, and goals intact.'
                },
                {
                  id: 'created_within',
                  title: 'Delete Workspace-Created Items Only',
                  desc: 'Purges notes/tasks created directly inside this workspace. Pre-existing linked items remain untouched.'
                },
                {
                  id: 'all',
                  title: 'Nuclear Wipe (Delete Everything)',
                  desc: 'Permanently destroys the workspace AND all linked notes, forms, goals, and thread histories.'
                }
              ].map((option) => {
                const isSelected = deleteMode === option.id;
                return (
                  <button
                    key={option.id}
                    type="button"
                    onClick={() => setDeleteMode(option.id as any)}
                    className={`w-full text-left p-3.5 rounded-xl border transition-all duration-150 flex flex-col gap-1 cursor-pointer ${
                      isSelected
                        ? 'bg-red-500/10 border-red-500/40 text-white'
                        : 'bg-white/[0.03] border-white/10 text-white/60 hover:border-white/20'
                    }`}
                  >
                    <div className="flex items-center justify-between">
                      <span className="font-extrabold text-xs font-clash text-white">{option.title}</span>
                      <div className={`w-4 h-4 rounded-full border flex items-center justify-center ${isSelected ? 'border-red-400 bg-red-500' : 'border-white/20'}`}>
                        {isSelected && <div className="w-1.5 h-1.5 rounded-full bg-white" />}
                      </div>
                    </div>
                    <p className="text-[10px] text-white/40 leading-relaxed font-satoshi">
                      {option.desc}
                    </p>
                  </button>
                );
              })}
            </div>
          </div>
        )}
      </div>

      {/* Footer Actions (Matching SudoModal MasterPass buttons) */}
      <div className="px-5 pb-[calc(1rem+env(safe-area-inset-bottom))] pt-3 border-t border-white/5 bg-[#161412] flex flex-col gap-2">
        <button
          type="button"
          onClick={handleConfirm}
          disabled={loading}
          className="w-full min-h-[46px] flex items-center justify-center gap-2 rounded-xl text-white font-extrabold text-sm bg-red-500 hover:bg-red-600 transition-all cursor-pointer disabled:opacity-50"
        >
          {loading ? (
            <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white" />
          ) : (
            <>
              <Trash2 className="w-4 h-4" />
              <span>{data.confirmLabel || 'Delete Permanently'}</span>
            </>
          )}
        </button>
        <button
          type="button"
          onClick={close}
          disabled={loading}
          className="w-full py-2.5 rounded-xl font-bold text-xs text-white/40 hover:text-white transition duration-150 hover:bg-white/5 cursor-pointer"
        >
          Cancel
        </button>
      </div>
    </div>
  );
}
