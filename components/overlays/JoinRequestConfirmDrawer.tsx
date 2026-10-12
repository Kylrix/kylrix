'use client';

import React, { useState } from 'react';
import { UserCheck, UserX, X, Check } from 'lucide-react';
import { useUnifiedDrawer } from '@/context/UnifiedDrawerContext';

export interface JoinRequestConfirmData {
  action: 'grant' | 'deny';
  requesterName: string;
  requesterEmail?: string;
  projectName: string;
  onConfirm: (role?: 'viewer' | 'editor' | 'admin') => Promise<void> | void;
}

export function JoinRequestConfirmDrawer() {
  const { drawerData, close } = useUnifiedDrawer();
  const [loading, setLoading] = useState(false);
  const [role, setRole] = useState<'viewer' | 'editor' | 'admin'>('viewer');

  const data = drawerData as JoinRequestConfirmData;

  if (!data) return null;

  const isGrant = data.action === 'grant';

  const handleConfirm = async () => {
    setLoading(true);
    try {
      await data.onConfirm(isGrant ? role : undefined);
      close();
    } catch (err) {
      console.error('[JoinRequestConfirm] Action failed:', err);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="p-6 md:p-8 text-white font-satoshi flex flex-col gap-6 relative select-none">
      {/* Spotlight Ambient Gradient */}
      <div 
        className="absolute top-0 left-0 right-0 h-36 pointer-events-none opacity-20"
        style={{ 
          backgroundImage: isGrant 
            ? 'radial-gradient(circle at top, rgba(16, 185, 129, 0.25) 0%, transparent 70%)' 
            : 'radial-gradient(circle at top, rgba(239, 68, 68, 0.25) 0%, transparent 70%)' 
        }}
      />

      {/* Header */}
      <div className="flex justify-between items-center relative z-10 shrink-0">
        <div className="flex items-center gap-3">
          {isGrant ? (
            <div className="p-2.5 rounded-xl bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 shadow-[0_0_12px_rgba(16,185,129,0.2)]">
              <UserCheck size={20} />
            </div>
          ) : (
            <div className="p-2.5 rounded-xl bg-red-500/10 border border-red-500/20 text-red-500 shadow-[0_0_12px_rgba(239,68,68,0.2)]">
              <UserX size={20} />
            </div>
          )}
          <div>
            <h3 className="font-extrabold text-lg text-white font-clash tracking-tight">
              {isGrant ? 'Approve Access Request' : 'Deny Access Request'}
            </h3>
            <p className="text-[10px] text-white/45 font-bold uppercase tracking-wider font-clash mt-0.5">
              {isGrant ? 'Grant Access' : 'Declining Request'}
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
          {isGrant 
            ? `Grant access to ${data.requesterName} for project "${data.projectName}"?`
            : `Deny access to ${data.requesterName} for project "${data.projectName}"?`
          }
        </h4>
        <p className="text-xs text-white/40 leading-relaxed font-satoshi">
          {isGrant 
            ? `This will add ${data.requesterName} to the project collaborators. They will be notified and granted view or edit access depending on the role selected.`
            : `This will reject ${data.requesterName}'s request to join the project. The request row will be updated to declined and they will not be able to send join requests again.`
          }
        </p>
      </div>

      {/* Role Picker (Only for Grant) */}
      {isGrant && (
        <div className="flex flex-col gap-3 relative z-10">
          <span className="text-[10px] font-black text-white/35 tracking-wider uppercase block font-clash">
            Assign Collaboration Role
          </span>
          <div className="flex flex-col gap-2.5">
            {[
              {
                value: 'viewer',
                title: 'Viewer',
                desc: 'Read-only access to notes, tasks, events, and linked resources.',
                color: '#10B981',
                bgActive: 'bg-[#10B981]/5',
                borderActive: 'border-[#10B981]/30'
              },
              {
                value: 'editor',
                title: 'Editor',
                desc: 'Full read and write access. Can modify notes, create tasks, and manage project boards.',
                color: '#6366F1',
                bgActive: 'bg-[#6366F1]/5',
                borderActive: 'border-[#6366F1]/30'
              },
              {
                value: 'admin',
                title: 'Admin',
                desc: 'Full administrative access. Can manage collaborators, change project visibility, and delete the project.',
                color: '#F59E0B',
                bgActive: 'bg-[#F59E0B]/5',
                borderActive: 'border-[#F59E0B]/30'
              }
            ].map((option) => {
              const selected = role === option.value;
              return (
                <button
                  type="button"
                  key={option.value}
                  onClick={() => setRole(option.value as any)}
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
                      {selected && <Check size={10} className="text-black stroke-[4]" />}
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

      {/* Actions */}
      <div className="mt-auto pt-4 flex-shrink-0 flex gap-3 relative z-10">
        <button
          type="button"
          onClick={close}
          className="flex-1 py-3 rounded-xl border border-white/5 hover:bg-white/5 text-white/70 hover:text-white text-xs font-black transition cursor-pointer"
        >
          Cancel
        </button>
        <button
          type="button"
          onClick={handleConfirm}
          disabled={loading}
          className={`flex-1 py-3 rounded-xl text-xs font-black transition cursor-pointer ${
            isGrant 
              ? 'bg-[#10B981] hover:bg-[#10B981]/80 text-black font-black' 
              : 'bg-red-600 hover:bg-red-700 text-white font-black'
          }`}
        >
          {loading ? (
            <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin mx-auto" />
          ) : (
            <span>{isGrant ? 'Approve & Grant' : 'Confirm Deny'}</span>
          )}
        </button>
      </div>
    </div>
  );
}
