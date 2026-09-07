'use client';

import React, { useEffect, useMemo, useState } from 'react';
import { Zap, X, Shield, Check, Globe, Coins } from 'lucide-react';
import { useAuth } from '@/context/auth/AuthContext';
import { useNostrIdentity } from '@/hooks/useNostrIdentity';
import { useSudo } from '@/context/SudoContext';
import { isConfirmBeforeZapEnabled } from '@/components/settings/ZapSecuritySettings';
import toast from 'react-hot-toast';

export type ZapRail = 'ecosystem' | 'nostr';

interface ZapDrawerProps {
  isOpen: boolean;
  onClose: () => void;
  /** Primary target id (legacy). Prefer ecosystemTargetId / nostrTargetId when dual. */
  targetId: string;
  source: ZapRail;
  /** When both rails exist (dual-posted moment), user picks which to zap. */
  availableSources?: ZapRail[];
  ecosystemTargetId?: string;
  nostrTargetId?: string;
  targetKind?: 'note' | 'moment' | 'goal' | 'event' | 'form' | 'flow' | 'chat';
  targetOwnerId?: string;
  targetPubkey?: string;
  authorName?: string;
  onZapSuccess?: (amount: number, token: string, rail: ZapRail) => void;
}

const PRESET_AMOUNTS = [
  { label: '1', value: 1, desc: 'Micro zap' },
  { label: '10', value: 10, desc: 'Standard spark' },
  { label: '100', value: 100, desc: 'Super boost' },
  { label: '1,000', value: 1000, desc: 'Mega zap' },
];

function toMicro(amountRix: number): string {
  return String(BigInt(Math.max(1, Math.floor(amountRix))) * 1_000_000n);
}

export function ZapDrawer({
  isOpen,
  onClose,
  targetId,
  source,
  availableSources,
  ecosystemTargetId,
  nostrTargetId,
  targetKind = 'moment',
  targetOwnerId,
  targetPubkey,
  authorName = 'Creator',
  onZapSuccess,
}: ZapDrawerProps) {
  const { user } = useAuth();
  const { identity, isVaultLocked, unlockAndLoad } = useNostrIdentity();
  const { promptSudo, isUnlocked } = useSudo();
  const rails = useMemo<ZapRail[]>(() => {
    const fromProp = (availableSources || []).filter(Boolean) as ZapRail[];
    if (fromProp.length) return Array.from(new Set(fromProp));
    return [source || 'ecosystem'];
  }, [availableSources, source]);

  const needsPicker = rails.length > 1;
  const [rail, setRail] = useState<ZapRail>(rails.includes(source) ? source : rails[0]);
  const [selectedAmount, setSelectedAmount] = useState<number>(1);
  const [customAmount, setCustomAmount] = useState<string>('');
  const [comment, setComment] = useState('');
  const [zapping, setZapping] = useState(false);

  useEffect(() => {
    if (!rails.includes(rail)) setRail(rails[0]);
  }, [rails, rail]);

  if (!isOpen) return null;

  const effectiveAmount = customAmount
    ? Math.max(1, parseInt(customAmount, 10) || 1)
    : selectedAmount;
  const unit = rail === 'nostr' ? 'sats' : 'rix';

  const ensureVaultReady = async (): Promise<boolean> => {
    const confirmEveryTime = isConfirmBeforeZapEnabled();
    // Cosmetic confirm while unlocked when safeguard is on; real unlock when locked.
    if (!isUnlocked || isVaultLocked || confirmEveryTime) {
      if (isVaultLocked || !isUnlocked) {
        try {
          await unlockAndLoad();
        } catch {}
      }
      const ok = await promptSudo('unlock', confirmEveryTime || !isUnlocked);
      if (!ok) return false;
    }
    return true;
  };

  const resolveTargets = () => {
    const ecoId = ecosystemTargetId || (rail === 'ecosystem' ? targetId : undefined);
    const nostrId = nostrTargetId || (rail === 'nostr' ? targetId : undefined);
    return { ecoId, nostrId };
  };

  const handleSendZap = async () => {
    const vaultOk = await ensureVaultReady();
    if (!vaultOk) {
      toast.error('Vault confirmation needed to zap');
      return;
    }

    const { ecoId, nostrId } = resolveTargets();

    if (rail === 'ecosystem') {
      if (!user?.$id) {
        toast.error('Sign in to send a Kylrix zap');
        return;
      }
      if (!ecoId) {
        toast.error('Missing Kylrix moment to zap');
        return;
      }
    } else {
      if (!targetPubkey && !nostrId) {
        toast.error('Missing Nostr recipient for this zap');
        return;
      }
    }

    setZapping(true);
    try {
      if (rail === 'ecosystem') {
        const { runTokenOperation } = await import('@/lib/actions/client-ops');
        const res = await runTokenOperation({
          action: 'zap',
          fromUserId: user?.$id,
          targetKind,
          targetId: ecoId!,
          targetOwnerId: targetOwnerId || user?.$id,
          amountMicro: toMicro(effectiveAmount),
          idempotencyKey: `zap:${targetKind}:${ecoId}:${Date.now()}`,
          comment: comment.trim() || undefined,
        });

        if (res && (res as any).accepted === false) {
          throw new Error((res as any).reason || 'Zap could not be settled');
        }

        toast.success(`Sent ${effectiveAmount} rix to ${authorName}`);
        onZapSuccess?.(effectiveAmount, 'rix', 'ecosystem');
        onClose();
      } else {
        const { sendNostrZap } = await import('@/lib/nostr/zap');
        const { normalizePrivateKeyBytes } = await import('@/lib/nostr/crypto');
        const recipientPubkey = targetPubkey || '';
        if (!recipientPubkey) {
          throw new Error('No Nostr profile key for this author');
        }
        const priv = identity?.privateKeyBytes
          ? normalizePrivateKeyBytes(identity.privateKeyBytes)
          : null;

        const res = await sendNostrZap({
          recipientPubkey,
          eventId: nostrId,
          amountSats: effectiveAmount,
          comment: comment.trim() || undefined,
          privateKeyBytes: priv,
        });

        if (!res.success) throw new Error(res.error || 'Nostr zap failed');
        if (res.paid) {
          toast.success(`Zapped ${effectiveAmount} sats to ${authorName}`);
        } else {
          toast.success(res.error || `Invoice ready — ${effectiveAmount} sats`);
        }
        onZapSuccess?.(effectiveAmount, 'sats', 'nostr');
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
      <div className="flex items-center justify-between border-b border-white/[0.06] pb-4">
        <div className="flex items-center gap-2.5">
          <div className="w-9 h-9 rounded-xl bg-amber-400/10 border border-amber-400/30 flex items-center justify-center text-amber-400">
            <Zap size={18} className="fill-current" />
          </div>
          <div>
            <h2 className="text-base font-black font-clash text-white m-0">Send Zap</h2>
            <p className="text-[11px] text-white/40 font-mono m-0">
              {rail === 'nostr' ? 'Nostr Lightning' : 'Kylrix token ledger'}
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

      {needsPicker ? (
        <div className="space-y-2">
          <label className="text-xs font-bold uppercase tracking-wider text-white/60 font-mono">
            This post is on both — zap with
          </label>
          <div className="grid grid-cols-2 gap-2">
            <button
              type="button"
              onClick={() => setRail('ecosystem')}
              className={`p-3 rounded-xl border text-left transition-all ${
                rail === 'ecosystem'
                  ? 'bg-emerald-400/15 border-emerald-400/50 text-emerald-200'
                  : 'bg-[#0A0908] border-white/[0.06] text-white/70 hover:border-white/20'
              }`}
            >
              <div className="flex items-center gap-2">
                <Coins size={14} />
                <span className="text-sm font-extrabold">Kylrix</span>
              </div>
              <span className="text-[10px] text-white/40 block mt-0.5">rix → their Kylrix profile</span>
            </button>
            <button
              type="button"
              onClick={() => setRail('nostr')}
              className={`p-3 rounded-xl border text-left transition-all ${
                rail === 'nostr'
                  ? 'bg-amber-400/15 border-amber-400/50 text-amber-200'
                  : 'bg-[#0A0908] border-white/[0.06] text-white/70 hover:border-white/20'
              }`}
            >
              <div className="flex items-center gap-2">
                <Globe size={14} />
                <span className="text-sm font-extrabold">Nostr</span>
              </div>
              <span className="text-[10px] text-white/40 block mt-0.5">sats → their Lightning</span>
            </button>
          </div>
        </div>
      ) : null}

      <div className="rounded-xl bg-[#0A0908] border border-white/[0.06] p-3.5 flex items-center justify-between">
        <div>
          <span className="text-[10px] uppercase font-bold text-white/40 font-mono">Recipient</span>
          <p className="text-sm font-extrabold text-white m-0">{authorName}</p>
        </div>
        <div className="text-right">
          <span className="text-[10px] uppercase font-bold text-white/40 font-mono">Rail</span>
          <p className="text-xs font-mono font-bold text-emerald-400 m-0">
            {rail === 'nostr' ? 'Lightning' : 'rix ledger'}
          </p>
        </div>
      </div>

      <div className="space-y-2">
        <label className="text-xs font-bold uppercase tracking-wider text-white/60 font-mono">
          Amount ({unit})
        </label>
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
                  <span className="text-sm font-extrabold font-mono">
                    {preset.label} {unit}
                  </span>
                  {isSelected && <Check size={14} className="text-amber-400" />}
                </div>
                <span className="text-[10px] text-white/40 block mt-0.5">{preset.desc}</span>
              </button>
            );
          })}
        </div>
      </div>

      <div className="space-y-1.5">
        <label className="text-xs font-bold uppercase tracking-wider text-white/60 font-mono">
          Custom {unit}
        </label>
        <input
          type="number"
          min="1"
          placeholder={`Enter custom ${unit}…`}
          value={customAmount}
          onChange={(e) => setCustomAmount(e.target.value)}
          className="w-full h-10 rounded-xl bg-[#0A0908] border border-white/[0.06] px-3.5 text-sm font-mono text-white placeholder:text-white/30 focus:outline-none focus:border-amber-400/40"
        />
      </div>

      <div className="space-y-1.5">
        <label className="text-xs font-bold uppercase tracking-wider text-white/60 font-mono">
          Zap note (optional)
        </label>
        <input
          type="text"
          placeholder="Say something nice…"
          value={comment}
          onChange={(e) => setComment(e.target.value)}
          className="w-full h-10 rounded-xl bg-[#0A0908] border border-white/[0.06] px-3.5 text-sm text-white placeholder:text-white/30 focus:outline-none focus:border-amber-400/40"
        />
      </div>

      <div className="flex items-center gap-2 px-3 py-2 rounded-xl bg-amber-400/5 border border-amber-400/15 text-[11px] text-amber-400/80">
        <Shield size={14} className="shrink-0" />
        <span>
          {isConfirmBeforeZapEnabled()
            ? 'Vault confirm before every zap (you can turn this off in settings).'
            : 'Vault confirm only when the vault is locked.'}
        </span>
      </div>

      <div className="pt-2">
        <button
          type="button"
          disabled={zapping}
          onClick={() => void handleSendZap()}
          className="w-full h-12 rounded-xl bg-[#F59E0B] text-black font-black font-clash text-sm flex items-center justify-center gap-2 hover:bg-amber-400 disabled:opacity-40 transition-all shadow-[0_4px_16px_rgba(245,158,11,0.25)]"
        >
          <Zap size={16} className="fill-current" />
          {zapping ? 'Sending…' : `Zap ${effectiveAmount} ${unit}`}
        </button>
      </div>
    </div>
  );
}
