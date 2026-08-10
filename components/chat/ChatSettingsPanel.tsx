'use client';

import React, { useState } from 'react';
import { Download, Trash2, Zap, Key, Users, Shield, X, Info } from 'lucide-react';
import { useAuth } from '@/lib/auth';
import { ecosystemSecurity } from '@/lib/ecosystem/security';

type Props = {
  conversation: any;
  conversationId: string;
  isSelf: boolean;
  messages: any[];
  onClose?: () => void;
  onExport: () => Promise<void> | void;
  onClearMe: () => void;
  onClearEveryone: () => void;
  onNuclear: () => void;
};

export function ChatSettingsPanel({ conversation, conversationId, isSelf, messages, onClose, onExport, onClearMe, onClearEveryone, onNuclear }: Props) {
  const { user } = useAuth();
  void onClearEveryone; void user;
  const [showKeys, setShowKeys] = useState(false);
  const [keysDetail, setKeysDetail] = useState<string | null>(null);

  const handleViewKeys = async () => {
    if (!conversation?.isEncrypted) {
      setKeysDetail('This hangout is not end-to-end encrypted.');
      setShowKeys(true);
      return;
    }
    try {
      const key = ecosystemSecurity.getConversationKey?.(conversationId) || null;
      if (key) {
        setKeysDetail('Encryption keys are stored locally and unlocked. Conversation key is available in memory. Key ID: ' + (conversationId.slice(0, 12)) + '…');
      } else if (!ecosystemSecurity.status.isUnlocked) {
        setKeysDetail('Vault is locked. Unlock to view keys. Keys are derived per-conversation and never leave your device.');
      } else {
        setKeysDetail('No transient key in memory. It will be re-derived on next message send. Conversation: ' + conversationId);
      }
      setShowKeys(true);
    } catch (e: any) {
      setKeysDetail(e?.message || 'Could not load keys.');
      setShowKeys(true);
    }
  };

  return (
    <div className="flex h-full min-h-0 flex-col bg-[#0A0908]">
      <div className="flex items-center justify-between border-b border-white/[0.06] bg-[#0A0908] px-5 py-4 shrink-0">
        <div className="min-w-0">
          <p className="text-[10px] font-bold uppercase tracking-wider text-white/40 font-mono m-0">Hangout settings</p>
          <h2 className="text-sm font-black font-clash text-white m-0 mt-1 truncate max-w-[260px]">{conversation?.name || 'Hangout'}</h2>
          <p className="text-xs text-white/40 font-satoshi m-0 truncate">{isSelf ? 'Personal' : conversation?.type === 'group' ? `${conversation?.participants?.length || 0} members` : 'Direct'} • {conversation?.isEncrypted ? 'End-to-end encrypted' : 'Not encrypted'}</p>
        </div>
        <button type="button" onClick={onClose} className="p-1.5 rounded-lg text-[#8E8A86] hover:text-white hover:bg-[#161412]"><X size={18} /></button>
      </div>

      <div className="flex-1 overflow-y-auto p-4 space-y-3 min-h-0">
        <div className="rounded-xl bg-[#161412] border border-white/[0.06] p-3">
          <p className="text-xs text-white/50 font-satoshi m-0">Manage this hangout. Nuclear wipe permanently deletes the conversation, messages, members, keys and reactions for everyone — no trace remains.</p>
        </div>

        <button type="button" onClick={() => { void onExport(); onClose?.(); }} className="w-full flex items-center gap-3 rounded-xl bg-[#161412] border border-white/[0.06] px-4 py-3 text-left hover:bg-[#1C1A18] hover:border-white/10 transition-colors">
          <span className="h-9 w-9 rounded-lg bg-white/[0.04] border border-white/[0.06] grid place-items-center shrink-0"><Download size={16} className="text-white" /></span>
          <span className="min-w-0 flex-1"><span className="text-sm font-bold text-white block">Export Chat</span><span className="text-xs text-white/40 block">Download JSON transcript</span></span>
        </button>

        <button type="button" onClick={() => { onClearMe(); }} className="w-full flex items-center gap-3 rounded-xl bg-[#161412] border border-white/[0.06] px-4 py-3 text-left hover:bg-[#1C1A18] transition-colors">
          <span className="h-9 w-9 rounded-lg bg-white/[0.04] border border-white/[0.06] grid place-items-center shrink-0"><Trash2 size={16} className="text-white/70" /></span>
          <span className="min-w-0 flex-1"><span className="text-sm font-bold text-white block">Clear All Chat</span><span className="text-xs text-white/40 block">Choose: for me / for everyone</span></span>
        </button>

        <button type="button" onClick={() => { onNuclear(); }} className="w-full flex items-center gap-3 rounded-xl bg-[#1C0F0F] border border-[#ff4d4d]/20 px-4 py-3 text-left hover:bg-[#2A1515] transition-colors">
          <span className="h-9 w-9 rounded-lg bg-[#ff4d4d]/15 border border-[#ff4d4d]/20 grid place-items-center shrink-0"><Zap size={16} className="text-[#ff4d4d]" /></span>
          <span className="min-w-0 flex-1"><span className="text-sm font-extrabold text-[#ff4d4d] block">Nuclear Wipe</span><span className="text-xs text-white/40 block">Delete conversation + messages + keys + reactions for everyone</span></span>
        </button>

        <button type="button" onClick={handleViewKeys} className="w-full flex items-center gap-3 rounded-xl bg-[#161412] border border-white/[0.06] px-4 py-3 text-left hover:bg-[#1C1A18] transition-colors">
          <span className="h-9 w-9 rounded-lg bg-[#F59E0B]/10 border border-[#F59E0B]/20 grid place-items-center shrink-0"><Key size={16} className="text-[#F59E0B]" /></span>
          <span className="min-w-0 flex-1"><span className="text-sm font-bold text-white block">View Keys</span><span className="text-xs text-white/40 block">Encryption details & key state</span></span>
        </button>

        {showKeys && keysDetail ? (
          <div className="rounded-xl bg-[#0A0908] border border-[#F59E0B]/20 p-3">
            <div className="flex items-start gap-2">
              <Shield size={14} className="text-[#F59E0B] mt-0.5 shrink-0" />
              <p className="text-xs text-white/70 whitespace-pre-wrap break-words flex-1">{keysDetail}</p>
            </div>
            <button type="button" onClick={() => setShowKeys(false)} className="mt-2 text-xs font-bold text-white/60 hover:text-white">Hide</button>
          </div>
        ) : null}

        <div className="rounded-xl bg-[#161412] border border-white/[0.06] p-3 space-y-2">
          <h3 className="text-xs font-extrabold uppercase tracking-wider text-white/60 flex items-center gap-1.5"><Info size={12} /> Details</h3>
          <div className="space-y-1 text-xs font-mono text-white/60">
            <div className="flex justify-between gap-2"><span className="text-white/30">ID</span><span className="truncate max-w-[180px] text-white/80">{conversationId}</span></div>
            <div className="flex justify-between"><span className="text-white/30">Messages</span><span className="text-white/80">{messages.length}</span></div>
            <div className="flex justify-between"><span className="text-white/30">Type</span><span className="text-white/80">{conversation?.type || 'thread'}</span></div>
            <div className="flex justify-between"><span className="text-white/30">Encrypted</span><span className={conversation?.isEncrypted ? 'text-emerald-400' : 'text-white/50'}>{conversation?.isEncrypted ? 'Yes' : 'No'}</span></div>
          </div>
        </div>

        {conversation?.type === 'group' ? (
          <div className="rounded-xl bg-[#161412] border border-white/[0.06] p-3">
            <h3 className="text-xs font-extrabold uppercase tracking-wider text-white/60 flex items-center gap-1.5"><Users size={12} /> Members</h3>
            <p className="text-xs text-white/40 mt-2">{(conversation?.participants || []).slice(0, 8).join(', ') || 'No participants list'}</p>
          </div>
        ) : null}
      </div>
    </div>
  );
}
