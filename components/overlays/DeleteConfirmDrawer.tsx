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
    <div className="p-6 md:p-8 text-white font-satoshi flex flex-col gap-6 relative select-none max-h-[60vh] overflow-y-auto scrollbar-thin">
      {/* Red Spotlight Ambient Gradient */}
      <div 
        className="absolute top-0 left-0 right-0 h-36 pointer-events-none opacity-20"
        style={{ backgroundImage: 'radial-gradient(circle at top, rgba(239, 68, 68, 0.25) 0%, transparent 70%)' }}
      />

      {/* Header */}
      <div className="flex justify-between items-center relative z-10 shrink-0">
        <div className="flex items-center gap-3">
          <div className="p-2.5 rounded-xl bg-red-500/10 border border-red-500/20 text-red-500 shadow-[0_0_12px_rgba(239,68,68,0.2)]">
            <AlertTriangle size={20} />
          </div>
          <div>
            <h3 className="font-extrabold text-lg text-white font-clash tracking-tight">
              Confirm Deletion
            </h3>
            <p className="text-[10px] text-white/45 font-bold uppercase tracking-wider font-clash mt-0.5">
              Destructive Action
            </p>
          </div>
        </div>
        <button 
          onClick={close} 
          className="p-1.5 text-white/50 hover:text-white transition rounded-lg hover:bg-white/5 border border-white/5"
        >
          <X size={18} />
        </button>
      </div>

      {/* Content description */}
      <div className="flex flex-col gap-2 relative z-10">
        <h4 className="font-extrabold text-sm text-white/90 leading-tight font-satoshi">
          {data.title}
        </h4>
        <p className="text-xs text-white/40 leading-relaxed font-satoshi">
          {data.description || `This action is permanent and cannot be undone. All data associated with ${data.resourceName || 'this resource'} will be wiped from the ecosystem.`}
        </p>
      </div>

      {/* Project Deletion options */}
      {data.isProject && (
        <div className="flex flex-col gap-3 relative z-10">
          <span className="text-[10px] font-black text-white/35 tracking-wider uppercase block font-clash">
            Choose Deletion Mode
          </span>
          <div className="flex flex-col gap-2.5">
            {[
              {
                value: 'detach',
                title: 'Detach resources untouched (Safe)',
                desc: 'Keep all associated notes, tasks, and credentials intact. Only unlink and delete the project wrapper.',
                color: '#10B981',
                bgActive: 'bg-[#10B981]/5',
                borderActive: 'border-[#10B981]/30'
              },
              {
                value: 'created_within',
                title: 'Delete project-created resources only',
                desc: 'Delete only resources that were created directly inside this project workspace. External linked resources remain untouched.',
                color: '#F59E0B',
                bgActive: 'bg-[#F59E0B]/5',
                borderActive: 'border-[#F59E0B]/30'
              },
              {
                value: 'all',
                title: 'Delete all cascading resources (Dangerous)',
                desc: 'Permanently wipe all linked resources and their sub-objects (including comment reactions, chats, and physical voice notes).',
                color: '#EF4444',
                bgActive: 'bg-[#EF4444]/5',
                borderActive: 'border-[#EF4444]/30'
              }
            ].map((option) => {
              const selected = deleteMode === option.value;
              return (
                <button
                  type="button"
                  key={option.value}
                  onClick={() => setDeleteMode(option.value as any)}
                  className={`p-4 rounded-2xl border text-left transition duration-200 flex flex-col gap-1.5 w-full cursor-pointer hover:translate-y-[-1px] ${
                    selected 
                      ? `${option.bgActive} ${option.borderActive}` 
                      : 'bg-[#0B0A09] border-white/5 hover:border-white/10'
                  }`}
                  style={selected ? { boxShadow: `0 0 12px ${option.color}15` } : undefined}
                >
                  <div className="flex items-center justify-between w-full">
                    <span 
                      style={{ color: selected ? option.color : undefined }}
                      className="font-extrabold text-xs text-white font-satoshi"
                    >
                      {option.title}
                    </span>
                    <div 
                      style={{ borderColor: selected ? option.color : undefined, backgroundColor: selected ? option.color : undefined }}
                      className="w-4 h-4 rounded-full border border-white/30 flex items-center justify-center transition-colors shrink-0"
                    >
                      {selected && <div className="w-1.5 h-1.5 rounded-full bg-black" />}
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
      <div className="flex flex-col gap-3 mt-4 relative z-10 shrink-0">
        <button
          onClick={handleConfirm}
          disabled={loading}
          className="w-full py-4 rounded-2xl font-extrabold text-sm bg-red-500 hover:bg-red-600 text-white disabled:opacity-50 transition duration-200 cursor-pointer shadow-[0_8px_16px_rgba(239,68,68,0.15)] flex items-center justify-center gap-2 hover:scale-[1.01]"
        >
          {loading ? (
            <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
          ) : (
            <>
              <Trash2 size={16} />
              <span>{data.confirmLabel || 'Delete Permanently'}</span>
            </>
          )}
        </button>
        <button
          onClick={close}
          disabled={loading}
          className="w-full py-3.5 rounded-xl font-bold text-xs text-white/45 hover:text-white transition duration-200 hover:bg-white/5"
        >
          Cancel
        </button>
      </div>
    </div>
  );
}
