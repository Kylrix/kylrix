'use client';

import React from 'react';
import { Lock, ArrowRight } from 'lucide-react';
import { useWorkspace } from '@/context/WorkspaceContext';
import { useAuth } from '@/context/auth/AuthContext';

export interface WorkspaceReadOnlyNoticeProps {
  objectName?: string;
  onClose?: () => void;
  onSwitchedToPersonal?: () => void;
}

export function WorkspaceReadOnlyNotice({
  objectName = 'item',
  onClose,
  onSwitchedToPersonal,
}: WorkspaceReadOnlyNoticeProps) {
  const { activeWorkspace, setActiveWorkspaceId } = useWorkspace();
  const { user } = useAuth();

  const workspaceTitle = activeWorkspace?.title || 'this workspace';
  const ownerName = (activeWorkspace as any)?.ownerName || (activeWorkspace?.ownerId ? 'the workspace owner' : 'the owner');

  const handleSwitch = () => {
    if (user?.$id) {
      setActiveWorkspaceId(user.$id);
    }
    if (onSwitchedToPersonal) {
      onSwitchedToPersonal();
    } else if (onClose) {
      onClose();
    }
  };

  return (
    <div className="flex flex-col items-center justify-center p-6 text-center max-w-md mx-auto space-y-5 animate-in fade-in zoom-in-95 duration-200">
      <div className="w-14 h-14 rounded-3xl bg-[#F59E0B]/10 border border-[#F59E0B]/25 flex items-center justify-center text-[#F59E0B] shrink-0 shadow-[0_4px_16px_rgba(245,158,11,0.15)]">
        <Lock size={26} />
      </div>

      <div className="space-y-2">
        <h3 className="text-lg font-black font-clash text-white tracking-tight">
          Cannot Create {objectName.charAt(0).toUpperCase() + objectName.slice(1)}
        </h3>
        <p className="text-xs text-white/60 font-semibold font-satoshi leading-relaxed">
          You have view-only permissions in <span className="text-white font-bold">&quot;{workspaceTitle}&quot;</span>.
          Please ask {ownerName} for edit access, or switch to your personal workspace to create.
        </p>
      </div>

      <div className="flex flex-col sm:flex-row gap-2.5 w-full pt-2">
        <button
          type="button"
          onClick={handleSwitch}
          className="flex-1 inline-flex items-center justify-center gap-2 py-2.5 px-4 rounded-xl text-xs font-bold bg-[#6366F1] hover:bg-[#5254D8] text-white font-satoshi transition-all shadow-[0_4px_16px_rgba(99,102,241,0.25)] active:scale-[0.98] cursor-pointer"
        >
          <span>Switch to Personal</span>
          <ArrowRight size={14} />
        </button>

        {onClose && (
          <button
            type="button"
            onClick={onClose}
            className="py-2.5 px-4 rounded-xl text-xs font-bold bg-white/[0.05] hover:bg-white/[0.08] text-white/70 hover:text-white font-satoshi border border-white/[0.06] transition-all active:scale-[0.98] cursor-pointer"
          >
            Dismiss
          </button>
        )}
      </div>
    </div>
  );
}
