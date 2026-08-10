'use client';

import React, { useState } from 'react';
import { Download, Trash2, Zap, Key, Users, Shield, X, Info, Copy } from 'lucide-react';
import toast from 'react-hot-toast';
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

  const [showNuclearConfirm, setShowNuclearConfirm] = useState(false);

  return (
    <div className="flex h-full min-h-0 flex-col bg-[#0F0E0D] text-white font-satoshi overflow-hidden">
      {/* Top Header */}
      <div className="flex items-center justify-between border-b border-white/8 bg-[#151311] px-5 py-3.5 shrink-0">
        <div className="min-w-0">
          <p className="text-[10px] font-extrabold uppercase tracking-wider text-white/40 font-mono m-0">
            {isSelf ? 'Personal' : conversation?.type === 'group' ? 'Group Hangout' : 'Chat'}
          </p>
          <h2 className="text-sm font-black font-clash text-white m-0 mt-0.5 truncate max-w-[260px]">
            {conversation?.name || 'Settings'}
          </h2>
        </div>
        <button
          type="button"
          onClick={onClose}
          className="p-1.5 rounded-lg text-white/40 hover:text-white hover:bg-white/5 transition-all"
        >
          <X size={18} />
        </button>
      </div>

      <div className="flex-1 overflow-y-auto p-4 space-y-3.5 min-h-0">
        {/* Banner Card */}
        <div className="rounded-2xl bg-[#181614] border border-white/8 p-3.5">
          <p className="text-xs text-white/70 font-satoshi leading-relaxed m-0">
            Manage options for this hangout. Nuclear wiping deletes all conversation records, messages, attachments, members, and keys permanently.
          </p>
        </div>

        {/* Action List */}
        <div className="space-y-2">
          <button
            type="button"
            onClick={() => { void onExport(); onClose?.(); }}
            className="w-full flex items-center gap-3 rounded-2xl bg-[#181614] border border-white/8 px-4 py-3 text-left hover:bg-white/5 transition-all"
          >
            <span className="h-9 w-9 rounded-xl bg-white/5 border border-white/8 grid place-items-center shrink-0">
              <Download size={16} className="text-white" />
            </span>
            <span className="min-w-0 flex-1">
              <span className="text-xs font-bold text-white block">Export Chat</span>
              <span className="text-[11px] text-white/40 block">Download JSON transcript</span>
            </span>
          </button>

          <button
            type="button"
            onClick={() => { onClearMe(); }}
            className="w-full flex items-center gap-3 rounded-2xl bg-[#181614] border border-white/8 px-4 py-3 text-left hover:bg-white/5 transition-all"
          >
            <span className="h-9 w-9 rounded-xl bg-white/5 border border-white/8 grid place-items-center shrink-0">
              <Trash2 size={16} className="text-white/70" />
            </span>
            <span className="min-w-0 flex-1">
              <span className="text-xs font-bold text-white block">Clear Chat Messages</span>
              <span className="text-[11px] text-white/40 block">Purge messages for me or everyone</span>
            </span>
          </button>

          <button
            type="button"
            onClick={() => setShowNuclearConfirm(true)}
            className="w-full flex items-center gap-3 rounded-2xl bg-[#241212] border border-[#ff4d4d]/30 px-4 py-3 text-left hover:bg-[#2F1717] transition-all"
          >
            <span className="h-9 w-9 rounded-xl bg-[#ff4d4d]/15 border border-[#ff4d4d]/30 grid place-items-center shrink-0">
              <Zap size={16} className="text-[#ff4d4d]" />
            </span>
            <span className="min-w-0 flex-1">
              <span className="text-xs font-extrabold text-[#ff4d4d] block">Nuclear Wipe</span>
              <span className="text-[11px] text-white/40 block">Permanently delete hangout & all data</span>
            </span>
          </button>

          <button
            type="button"
            onClick={handleViewKeys}
            className="w-full flex items-center gap-3 rounded-2xl bg-[#181614] border border-white/8 px-4 py-3 text-left hover:bg-white/5 transition-all"
          >
            <span className="h-9 w-9 rounded-xl bg-[#F59E0B]/10 border border-[#F59E0B]/20 grid place-items-center shrink-0">
              <Key size={16} className="text-[#F59E0B]" />
            </span>
            <span className="min-w-0 flex-1">
              <span className="text-xs font-bold text-white block">View Security Keys</span>
              <span className="text-[11px] text-white/40 block">Encryption key state & verification</span>
            </span>
          </button>
        </div>

        {showKeys && keysDetail ? (
          <div className="rounded-2xl bg-[#151311] border border-[#F59E0B]/30 p-3.5 space-y-2">
            <div className="flex items-start gap-2.5">
              <Shield size={15} className="text-[#F59E0B] mt-0.5 shrink-0" />
              <p className="text-xs text-white/80 whitespace-pre-wrap break-words flex-1 leading-relaxed m-0 font-mono">
                {keysDetail}
              </p>
            </div>
            <button
              type="button"
              onClick={() => setShowKeys(false)}
              className="text-xs font-extrabold text-[#F59E0B] hover:underline"
            >
              Hide
            </button>
          </div>
        ) : null}

        {/* Details Card */}
        <div className="rounded-2xl bg-[#181614] border border-white/8 p-3.5 space-y-2">
          <h3 className="text-xs font-extrabold uppercase tracking-wider text-white/50 flex items-center gap-1.5 font-clash">
            <Info size={13} /> Hangout Metadata
          </h3>
          <div className="space-y-1.5 text-xs font-mono text-white/60">
            <div className="flex items-center justify-between gap-2">
              <span className="text-white/30">ID</span>
              <div className="flex items-center gap-1.5 min-w-0">
                <span className="truncate max-w-[180px] text-white/80">{conversationId}</span>
                <button
                  type="button"
                  onClick={() => {
                    navigator.clipboard.writeText(conversationId);
                    toast.success('Hangout ID copied');
                  }}
                  className="p-1 rounded bg-white/5 hover:bg-white/10 text-white/40 hover:text-white transition-all"
                  title="Copy Hangout ID"
                >
                  <Copy size={11} />
                </button>
              </div>
            </div>
            <div className="flex justify-between">
              <span className="text-white/30">Messages</span>
              <span className="text-white/80">{messages.length}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-white/30">Type</span>
              <span className="text-white/80">{conversation?.type || 'thread'}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-white/30">Security</span>
              <span className={conversation?.isEncrypted ? 'text-emerald-400 font-bold' : 'text-white/50'}>
                {conversation?.isEncrypted ? 'End-to-End Encrypted' : 'Standard'}
              </span>
            </div>
          </div>
        </div>

        {conversation?.type === 'group' ? (
          <div className="rounded-2xl bg-[#181614] border border-white/8 p-3.5">
            <h3 className="text-xs font-extrabold uppercase tracking-wider text-white/50 flex items-center gap-1.5 font-clash">
              <Users size={13} /> Participants
            </h3>
            <p className="text-xs text-white/60 mt-2 font-mono">
              {(conversation?.participants || []).slice(0, 8).join(', ') || 'No participants list'}
            </p>
          </div>
        ) : null}
      </div>

      {/* Confirmation Modal overlay for Nuclear Wipe */}
      {showNuclearConfirm ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-xs">
          <div className="w-full max-w-sm rounded-2xl bg-[#151311] border border-[#ff4d4d]/30 p-5 space-y-4 shadow-2xl">
            <div className="flex items-center gap-3">
              <div className="h-10 w-10 rounded-xl bg-[#ff4d4d]/15 border border-[#ff4d4d]/30 grid place-items-center shrink-0">
                <Zap size={20} className="text-[#ff4d4d]" />
              </div>
              <div>
                <h3 className="text-base font-black text-white font-clash m-0">Confirm Nuclear Wipe</h3>
                <p className="text-xs text-white/50 m-0">This action cannot be undone.</p>
              </div>
            </div>

            <p className="text-xs text-white/80 leading-relaxed font-satoshi m-0">
              Are you sure you want to permanently wipe this conversation? Every message, attachment, member record, and encryption key will be recursively deleted.
            </p>

            <div className="grid grid-cols-2 gap-2 pt-2">
              <button
                type="button"
                onClick={() => setShowNuclearConfirm(false)}
                className="h-9 rounded-xl bg-white/5 hover:bg-white/10 border border-white/8 text-white font-bold text-xs transition-all"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={() => {
                  setShowNuclearConfirm(false);
                  onNuclear();
                  onClose?.();
                }}
                className="h-9 rounded-xl bg-[#ff4d4d] hover:bg-[#e63939] text-white font-extrabold text-xs transition-all shadow-lg"
              >
                Wipe Permanently
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}
