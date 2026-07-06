'use client';

import React, { useState } from 'react';
import { useNostrIdentity } from '@/hooks/useNostrIdentity';
import { useNostrFeed } from '@/hooks/useNostrFeed';
import { MomentComposer } from '../social/MomentComposer';
import { Lock, Sparkles } from 'lucide-react';
import toast from 'react-hot-toast';

interface MomentComposerDrawerProps {
  onClose: () => void;
}

export function MomentComposerDrawer({ onClose }: MomentComposerDrawerProps) {
  const { identity, isVaultLocked, unlockAndLoad } = useNostrIdentity();
  const { publishPost, filterTags } = useNostrFeed();
  const [publishing, setPublishing] = useState(false);

  const handlePublish = async (text: string) => {
    setPublishing(true);
    const success = await publishPost(text);
    setPublishing(false);
    if (success) {
      toast.success('Post published successfully to Nostr!');
      onClose();
    }
    return success;
  };

  return (
    <div className="w-full bg-[#0B0A09] text-white p-6 font-satoshi flex flex-col gap-5 rounded-t-3xl border-t border-white/5 max-h-[85vh] overflow-y-auto">
      <div className="flex items-center justify-between border-b border-white/5 pb-3">
        <h3 className="text-sm font-black uppercase tracking-widest text-[#F59E0B] flex items-center gap-1.5">
          <Sparkles size={16} />
          Create sovereign post
        </h3>
        <button onClick={onClose} className="text-xs text-white/40 hover:text-white transition-all">
          Cancel
        </button>
      </div>

      {isVaultLocked ? (
        <div className="flex flex-col items-center justify-center p-8 text-center bg-[#161412] border border-white/5 rounded-2xl gap-4">
          <Lock size={24} className="text-white/40" />
          <div>
            <h4 className="text-xs font-bold text-white/80 mb-1">Vault Is Encrypted</h4>
            <p className="text-[10px] text-white/40">Unlock your vault to sign this post securely with your key.</p>
          </div>
          <button
            onClick={unlockAndLoad}
            className="px-4 py-2 bg-[#F59E0B]/10 hover:bg-[#F59E0B]/20 border border-[#F59E0B]/20 text-[#F59E0B] font-bold text-xs rounded-xl transition-all"
          >
            Unlock Vault
          </button>
        </div>
      ) : !identity ? (
        <div className="p-8 text-center bg-[#161412] border border-white/5 rounded-2xl flex items-center justify-center gap-3">
          <span className="animate-spin inline-block w-4 h-4 border-2 border-[#F59E0B] border-t-transparent rounded-full" />
          <span className="text-xs text-white/40 font-mono">Deriving sovereign key...</span>
        </div>
      ) : (
        <MomentComposer
          publishing={publishing}
          onPublish={handlePublish}
          filterTags={filterTags}
          className="border-none p-0 bg-transparent shadow-none"
        />
      )}
    </div>
  );
}
