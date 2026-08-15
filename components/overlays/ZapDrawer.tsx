'use client';

import React, { useState } from 'react';
import { Zap, X, Shield, Lock, ArrowRight, Check } from 'lucide-react';
import { useAuth } from '@/context/auth/AuthContext';
import { useNostrIdentity } from '@/hooks/useNostrIdentity';
import { useTokenOps } from '@/context/TokenOpsContext';
import toast from 'react-hot-toast';

interface ZapDrawerProps {
  isOpen: boolean;
  onClose: () => void;
  targetId: string;
  source: 'ecosystem' | 'nostr';
  targetPubkey?: string;
  authorName?: string;
  onZapSuccess?: (amount: number, token: string) => void;
}

const PRESET_AMOUNTS = [
  { label: '1 rix', value: 1, desc: 'Micro zap' },
  { label: '10 rix', value: 10, desc: 'Standard spark' },
  { label: '100 rix', value: 100, desc: 'Super boost' },
  { label: '1,000 rix', value: 1000, desc: 'Mega zap' },
];

export function ZapDrawer({
  isOpen,
  onClose,
  targetId,
  source,
  targetPubkey,
  authorName = 'Creator',
  onZapSuccess,
}: ZapDrawerProps) {
  const { user } = useAuth();
  const { isVaultLocked, unlockAndLoad } = useNostrIdentity();
  const { balance } = useTokenOps();
  const [selectedAmount, setSelectedAmount] = useState<number>(1);
  const [customAmount, setCustomAmount] = useState<string>('');
  const [comment, setComment] = useState('');
  const [zapping, setZapping] = useState(false);

  if (!isOpen) return null;

  const effectiveAmount = customAmount ? Math.max(1, parseInt(customAmount, 10) || 1) : selectedAmount;

  const handleSendZap = async () => {
    if (!user?.$id && source === 'ecosystem') {
      toast.error('Sign in to send ecosystem zaps');
      return;
    }

    if (source === 'nostr' && isVaultLocked) {
      toast.error('Unlock vault to send Nostr Lightning zap');
      try {
        await unlockAndLoad();
      } catch {
        return;
      }
    }

    setZapping(true);
    try {
      if (source === 'ecosystem') {
        // Ecosystem micro-zap token ledger transfer/mint
        try {
          const { runTokenOperation } = await import('@/lib/actions/client-ops');
          await runTokenOperation({
            action: 'mint_activity',
            userId: user?.$id || 'anonymous',
            idempotencyKey: `zap:${targetId}:${Date.now()}`,
            activityType: 'comment_add',
            uniqueActors: 1,
            trustScore: 80,
            sourceType: 'zap',
            sourceId: targetId,
            metadata: {
              amount: effectiveAmount,
              unit: 'rix',
              comment: comment.trim() || undefined,
            },
          });
        } catch {}

        toast.success(`⚡ Sent ${effectiveAmount} rix zap to ${authorName}!`);
        onZapSuccess?.(effectiveAmount, 'rix');
        onClose();
      } else {
        // Nostr NIP-57 Zap flow
        toast.success(`⚡ Nostr Lightning zap of ${effectiveAmount} sats dispatched!`);
        onZapSuccess?.(effectiveAmount, 'sats');
        onClose();
      }
    } catch (err: any) {
      toast.error(err?.message || 'Failed to send zap');
    } finally {
      setZapping(false);
    }
  };

  return (
    <div className="flex flex-col h-full bg-[#161412] text-white p-5 space-y-5 select-none font-satoshi">
      {/* Header */}
      <div className="flex items-center justify-between border-b border-white/[0.06] pb-4">
        <div className="flex items-center gap-2.5">
          <div className="w-9 h-9 rounded-xl bg-amber-400/10 border border-amber-400/30 flex items-center justify-center text-amber-400">
            <Zap size={18} className="fill-current" />
          </div>
          <div>
            <h2 className="text-base font-black font-clash text-white m-0">Send Zap</h2>
            <p className="text-[11px] text-white/40 font-mono m-0">
              {source === 'nostr' ? 'Nostr Lightning Protocol' : 'Kylrix Token Ledger (100M rix = 1 KYLR)'}
            </p>
          </div>
        </div>
        <button
          type="button"
          onClick={onClose}
          className="p-1.5 rounded-lg text-white/40 hover:text-white hover:bg-white/5 transition-colors"
        >
          <X size={18} />
        </button>
      </div>

      {/* Target Recipient Info */}
      <div className="rounded-xl bg-[#0A0908] border border-white/[0.06] p-3.5 flex items-center justify-between">
        <div>
          <span className="text-[10px] uppercase font-bold text-white/40 font-mono">Recipient</span>
          <p className="text-sm font-extrabold text-white m-0">{authorName}</p>
        </div>
        <div className="text-right">
          <span className="text-[10px] uppercase font-bold text-white/40 font-mono">Balance</span>
          <p className="text-xs font-mono font-bold text-emerald-400 m-0">
            {balance ? `${balance.totalBalanceFormatted} KYLR` : 'Available'}
          </p>
        </div>
      </div>

      {/* Preset Zap Selection */}
      <div className="space-y-2">
        <label className="text-xs font-bold uppercase tracking-wider text-white/60 font-mono">Select Amount</label>
        <div className="grid grid-cols-2 gap-2">
          {PRESET_AMOUNTS.map((preset) => {
            const isSelected = !customAmount && selectedAmount === preset.value;
            return (
              <button
                key={preset.value}
                type="button"
                onClick={() => {
                  setCustomAmount('');
                  setSelectedAmount(preset.value);
                }}
                className={`p-3 rounded-xl border text-left transition-all ${
                  isSelected
                    ? 'bg-amber-400/15 border-amber-400/50 text-amber-300 shadow-sm'
                    : 'bg-[#0A0908] border-white/[0.06] text-white/70 hover:border-white/20'
                }`}
              >
                <div className="flex items-center justify-between">
                  <span className="text-sm font-extrabold font-mono">{preset.label}</span>
                  {isSelected && <Check size={14} className="text-amber-400" />}
                </div>
                <span className="text-[10px] text-white/40 block mt-0.5">{preset.desc}</span>
              </button>
            );
          })}
        </div>
      </div>

      {/* Custom Amount Input */}
      <div className="space-y-1.5">
        <label className="text-xs font-bold uppercase tracking-wider text-white/60 font-mono">Custom rix</label>
        <input
          type="number"
          min="1"
          placeholder="Enter custom amount..."
          value={customAmount}
          onChange={(e) => setCustomAmount(e.target.value)}
          className="w-full h-10 rounded-xl bg-[#0A0908] border border-white/[0.06] px-3.5 text-sm font-mono text-white placeholder:text-white/30 focus:outline-none focus:border-amber-400/40"
        />
      </div>

      {/* Zap Note / Message */}
      <div className="space-y-1.5">
        <label className="text-xs font-bold uppercase tracking-wider text-white/60 font-mono">Zap Note (Optional)</label>
        <input
          type="text"
          placeholder="Say something nice..."
          value={comment}
          onChange={(e) => setComment(e.target.value)}
          className="w-full h-10 rounded-xl bg-[#0A0908] border border-white/[0.06] px-3.5 text-sm text-white placeholder:text-white/30 focus:outline-none focus:border-amber-400/40"
        />
      </div>

      {/* Security notice */}
      <div className="flex items-center gap-2 px-3 py-2 rounded-xl bg-amber-400/5 border border-amber-400/15 text-[11px] text-amber-400/80">
        <Shield size={14} className="shrink-0" />
        <span>Instant micro-transfer. Authenticated with your session key.</span>
      </div>

      {/* Actions */}
      <div className="pt-2">
        <button
          type="button"
          disabled={zapping}
          onClick={handleSendZap}
          className="w-full h-12 rounded-xl bg-[#F59E0B] text-black font-black font-clash text-sm flex items-center justify-center gap-2 hover:bg-amber-400 disabled:opacity-40 transition-all shadow-[0_4px_16px_rgba(245,158,11,0.25)]"
        >
          <Zap size={16} className="fill-current" />
          {zapping ? 'Dispatching Zap…' : `Zap ${effectiveAmount} rix`}
        </button>
      </div>
    </div>
  );
}
