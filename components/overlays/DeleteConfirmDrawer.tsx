'use client';

import React, { useState } from 'react';
import { Trash2, AlertTriangle, X } from 'lucide-react';
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
    <div className="p-5 md:p-6 text-white font-satoshi flex flex-col gap-5 relative select-none max-h-[60vh] overflow-y-auto scrollbar-thin">
      {/* Red Spotlight Ambient Gradient */}
      <div 
        className="absolute top-0 left-0 right-0 h-36 pointer-events-none opacity-15"
        style={{ backgroundImage: 'radial-gradient(circle at top, rgba(239, 68, 68, 0.2) 0%, transparent 70%)' }}
      />

      {/* Header */}
      <div className="flex justify-between items-center relative z-10 shrink-0">
        <div className="flex items-center gap-3">
          <div className="p-2 rounded-xl bg-red-500/10 border border-red-500/20 text-red-400">
            <AlertTriangle size={18} />
          </div>
          <div>
            <h3 className="font-bold text-base text-white font-clash tracking-tight">
              Confirm Deletion
            </h3>
            <p className="text-[10px] text-white/40 font-bold uppercase tracking-wider font-clash mt-0.5">
              Destructive Action
            </p>
          </div>
        </div>

        <button 
          onClick={close}
          className="p-1.5 text-white/40 hover:text-white hover:bg-white/5 rounded-xl transition duration-150"
        >
          <X size={18} />
        </button>
      </div>

      {/* Message Description */}
      <div className="relative z-10 space-y-2">
        <p className="text-xs text-white/70 font-satoshi leading-relaxed">
          {data.description || `Are you sure you want to delete ${data.resourceName || 'this item'}? This action cannot be undone.`}
        </p>
      </div>

      {/* Project Selective Delete Options */}
      {data.isProject && (
        <div className="relative z-10 flex flex-col gap-2">
          <label className="text-[11px] font-bold text-white/50 uppercase tracking-wider font-clash">
            Deletion Scope
          </label>
          
          <div className="flex flex-col gap-2">
            {[
              {
                id: 'detach',
                title: 'Keep Linked Items (Unlink Only)',
                desc: 'Removes the workspace row, but leaves associated notes, forms, and goals untouched.'
              },
              {
                id: 'created_within',
                title: 'Delete Created Items Only',
                desc: 'Purges notes/tasks created directly inside this workspace. Pre-existing linked items remain intact.'
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
                  className={`text-left p-3.5 rounded-xl border transition-all duration-150 flex flex-col gap-1 cursor-pointer ${
                    isSelected 
                      ? 'bg-red-500/10 border-red-500/40 text-white' 
                      : 'bg-white/[0.02] border-white/5 text-white/60 hover:border-white/15'
                  }`}
                >
                  <div className="flex items-center justify-between">
                    <span className="font-bold text-xs font-clash text-white">{option.title}</span>
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

      {/* Buttons */}
      <div className="flex flex-col gap-2 mt-2 relative z-10 shrink-0">
        <button
          onClick={handleConfirm}
          disabled={loading}
          className="w-full py-3 rounded-xl font-bold text-xs bg-red-500 hover:bg-red-600 text-white disabled:opacity-50 transition duration-150 cursor-pointer flex items-center justify-center gap-2"
        >
          {loading ? (
            <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
          ) : (
            <>
              <Trash2 size={15} />
              <span>{data.confirmLabel || 'Delete Permanently'}</span>
            </>
          )}
        </button>
        <button
          onClick={close}
          disabled={loading}
          className="w-full py-2.5 rounded-xl font-bold text-xs text-white/40 hover:text-white transition duration-150 hover:bg-white/5"
        >
          Cancel
        </button>
      </div>
    </div>
  );
}
