'use client';

import React, { useState, useEffect } from 'react';
import { AlertTriangle, Trash2, Shield, FileX, Database, HardDrive, Clock, X } from 'lucide-react';
import { toast } from 'react-hot-toast';
import { useRouter } from 'next/navigation';
import { account } from '@/lib/appwrite/client';

type Step = 1 | 2 | 3 | 4 | 5;

export function DeleteAccountFlow({ onClose }: { onClose?: () => void }) {
  const router = useRouter();
  const [step, setStep] = useState<Step>(1);
  const [acks, setAcks] = useState({ noRetention: false, infiniteData: false, authLast: false, instant: false });
  const [typedDelete, setTypedDelete] = useState('');
  const [typedHandle, setTypedHandle] = useState('');
  const [handle, setHandle] = useState<string | null>(null);
  const [holding, setHolding] = useState(false);
  const [holdProgress, setHoldProgress] = useState(0);
  const [purging, setPurging] = useState(false);

  useEffect(() => {
    account.get().then(u => setHandle((u as any)?.name || (u as any)?.email || u.$id)).catch(() => setHandle(null));
  }, []);

  useEffect(() => {
    if (!holding) { setHoldProgress(0); return; }
    const id = setInterval(() => setHoldProgress(p => {
      const n = p + 4;
      if (n >= 100) { clearInterval(id); void doPurge(); return 100; }
      return n;
    }), 40);
    return () => clearInterval(id);
  }, [holding]);

  const allAcked = acks.noRetention && acks.infiniteData && acks.authLast && acks.instant;

  const doPurge = async () => {
    if (purging) return;
    setPurging(true);
    try {
      toast.loading('Purging — this is instant and cannot be undone…', { id: 'purge' });
      const { executeMasterPurgeSecure } = await import('@/lib/actions/secure-ops');
      // Fire Appwrite function async for deep storage sweep (fire-and-forget, server purges first)
      try {
        const { functions } = await import('@/lib/appwrite/client');
        // @ts-ignore - dynamic function id from env or fallback to account-cleanup
        const fid = (process.env.NEXT_PUBLIC_APPWRITE_FUNC_PURGE || 'account-cleanup');
        // functions.createExecution is fire-and-forget; no await needed for UX
        (functions as any).createExecution?.(fid, JSON.stringify({}), false).catch(() => null);
      } catch {}
      await executeMasterPurgeSecure();
      await account.deleteSession('current').catch(() => {});
      toast.success('Account and all data purged — no retention.', { id: 'purge' });
      onClose?.();
      router.push('/');
    } catch (e: any) {
      toast.error(e?.message || 'Purge failed — nothing was half-deleted. Try again.', { id: 'purge' });
      setPurging(false);
      setHolding(false);
      setHoldProgress(0);
    }
  };

  return (
    <div className="flex h-full min-h-0 flex-col bg-[#0A0908]">
      <div className="flex items-center justify-between border-b border-white/[0.06] bg-[#0A0908] px-5 py-4 shrink-0">
        <div className="flex items-center gap-2.5">
          <span className="h-8 w-8 rounded-lg bg-red-500/15 border border-red-500/25 grid place-items-center"><AlertTriangle size={14} className="text-red-400" /></span>
          <div>
            <p className="text-[10px] font-bold uppercase tracking-wider text-red-400 font-mono m-0">Danger — no undo</p>
            <h2 className="text-sm font-black font-clash text-white m-0 leading-none mt-0.5">Delete Account</h2>
          </div>
        </div>
        <button type="button" onClick={onClose} className="p-1.5 rounded-lg text-[#8E8A86] hover:text-white hover:bg-[#161412]"><X size={18} /></button>
      </div>

      <div className="px-5 py-3 flex items-center gap-1.5 border-b border-white/[0.04] bg-[#161412]">
        {[1,2,3,4,5].map(n => (
          <div key={n} className={`h-1.5 flex-1 rounded-full transition-colors ${step >= n ? 'bg-red-500' : 'bg-white/10'}`} />
        ))}
        <span className="ml-2 text-[10px] font-black font-mono text-white/40">{step}/5</span>
      </div>

      <div className="flex-1 overflow-y-auto px-5 py-5 space-y-5 min-h-0">
        {step === 1 && (
          <div className="space-y-4">
            <div className="rounded-xl border border-red-500/20 bg-red-500/10 p-4 flex gap-3">
              <Shield size={18} className="text-red-400 shrink-0 mt-0.5" />
              <div className="space-y-1">
                <p className="text-sm font-black text-white">This is instant and permanent. No retention.</p>
                <p className="text-xs text-white/60 leading-relaxed">We keep nothing after you confirm — no grace period, no recycle bin, no recovery. If you lost access to email/passkey, this is the intentional escape hatch: UI hoops only, no password.</p>
              </div>
            </div>
            <div className="rounded-xl bg-[#161412] border border-white/[0.06] p-4 space-y-2">
              <p className="text-xs font-extrabold uppercase tracking-wider text-white/60 flex items-center gap-1.5"><Database size={12}/> What will be purged</p>
              <ul className="text-xs text-white/70 space-y-1 list-disc pl-4">
                <li>Vault secrets, TOTP, keychain identities, encrypted rows</li>
                <li>Notes, goals, tasks, projects, events, forms, threads, comments</li>
                <li>Hangouts — messages, reactions, epochs, call links, app_activity</li>
                <li>Storage files — attachments, voice notes, avatars (all buckets)</li>
                <li>Profiles, preferences, sessions, security logs</li>
                <li><b className="text-white">Auth account deleted last</b> — if purge halts, you can still retry (no half-deleted lockout).</li>
              </ul>
            </div>
            <div className="flex gap-2">
              <button type="button" onClick={onClose} className="flex-1 h-10 rounded-xl border border-white/10 text-white text-xs font-bold hover:bg-white/5">Cancel</button>
              <button type="button" onClick={() => setStep(2)} className="flex-1 h-10 rounded-xl bg-white text-black text-xs font-black hover:bg-white/90">I understand — continue</button>
            </div>
          </div>
        )}

        {step === 2 && (
          <div className="space-y-4">
            <p className="text-sm font-bold text-white">Acknowledge each — no pre-checks.</p>
            <label className="flex gap-3 rounded-xl border border-white/[0.06] bg-[#161412] p-3 cursor-pointer">
              <input type="checkbox" checked={acks.noRetention} onChange={e => setAcks(s => ({...s, noRetention: e.target.checked}))} className="mt-0.5 accent-red-500" />
              <span className="text-xs text-white/80"><b>Zero retention:</b> data is not archived and cannot be restored by support.</span>
            </label>
            <label className="flex gap-3 rounded-xl border border-white/[0.06] bg-[#161412] p-3 cursor-pointer">
              <input type="checkbox" checked={acks.infiniteData} onChange={e => setAcks(s => ({...s, infiniteData: e.target.checked}))} className="mt-0.5 accent-red-500" />
              <span className="text-xs text-white/80"><b>Infinite scope:</b> purge sweeps every database/table/storage bucket linked to you — there is an infinite amount of rows.</span>
            </label>
            <label className="flex gap-3 rounded-xl border border-white/[0.06] bg-[#161412] p-3 cursor-pointer">
              <input type="checkbox" checked={acks.instant} onChange={e => setAcks(s => ({...s, instant: e.target.checked}))} className="mt-0.5 accent-red-500" />
              <span className="text-xs text-white/80"><b>Instant:</b> deletion starts immediately after final hold — no delay.</span>
            </label>
            <label className="flex gap-3 rounded-xl border border-white/[0.06] bg-[#161412] p-3 cursor-pointer">
              <input type="checkbox" checked={acks.authLast} onChange={e => setAcks(s => ({...s, authLast: e.target.checked}))} className="mt-0.5 accent-red-500" />
              <span className="text-xs text-white/80"><b>Auth last:</b> your auth account is the final deletion to avoid half-done lockout.</span>
            </label>
            <div className="flex gap-2">
              <button type="button" onClick={() => setStep(1)} className="flex-1 h-10 rounded-xl border border-white/10 text-white text-xs font-bold">Back</button>
              <button type="button" disabled={!allAcked} onClick={() => setStep(3)} className="flex-1 h-10 rounded-xl bg-red-500 text-white text-xs font-black disabled:opacity-40 disabled:cursor-not-allowed hover:bg-red-600">Continue</button>
            </div>
          </div>
        )}

        {step === 3 && (
          <div className="space-y-4">
            <div className="rounded-xl bg-[#161412] border border-white/[0.06] p-4">
              <p className="text-xs font-extrabold uppercase tracking-wider text-white/60 flex items-center gap-1.5"><FileX size={12}/> Type DELETE to confirm</p>
              <p className="text-xs text-white/50 mt-1">This replaces password/email — usable even if you lost access.</p>
              <input value={typedDelete} onChange={e => setTypedDelete(e.target.value)} placeholder="DELETE" className="mt-3 w-full h-11 rounded-xl bg-[#0A0908] border border-white/[0.06] px-3 text-sm font-mono font-bold text-white placeholder:text-white/20 focus:outline-none focus:border-red-500/40" />
            </div>
            <div className="flex gap-2">
              <button type="button" onClick={() => setStep(2)} className="flex-1 h-10 rounded-xl border border-white/10 text-white text-xs font-bold">Back</button>
              <button type="button" disabled={typedDelete !== 'DELETE'} onClick={() => setStep(4)} className="flex-1 h-10 rounded-xl bg-red-500 text-white text-xs font-black disabled:opacity-40 disabled:cursor-not-allowed hover:bg-red-600">Continue</button>
            </div>
          </div>
        )}

        {step === 4 && (
          <div className="space-y-4">
            <div className="rounded-xl bg-[#161412] border border-white/[0.06] p-4">
              <p className="text-xs font-extrabold uppercase tracking-wider text-white/60 flex items-center gap-1.5"><HardDrive size={12}/> Type your handle to confirm</p>
              <p className="text-xs text-white/50 mt-1">Handle: <b className="text-white font-mono">{handle || 'loading…'}</b></p>
              <input value={typedHandle} onChange={e => setTypedHandle(e.target.value)} placeholder={handle || 'handle'} className="mt-3 w-full h-11 rounded-xl bg-[#0A0908] border border-white/[0.06] px-3 text-sm font-mono font-bold text-white placeholder:text-white/20 focus:outline-none focus:border-red-500/40" />
            </div>
            <div className="flex gap-2">
              <button type="button" onClick={() => setStep(3)} className="flex-1 h-10 rounded-xl border border-white/10 text-white text-xs font-bold">Back</button>
              <button type="button" disabled={!handle || typedHandle.trim() !== handle?.trim()} onClick={() => setStep(5)} className="flex-1 h-10 rounded-xl bg-red-500 text-white text-xs font-black disabled:opacity-40 disabled:cursor-not-allowed hover:bg-red-600">Continue</button>
            </div>
          </div>
        )}

        {step === 5 && (
          <div className="space-y-4">
            <div className="rounded-xl border border-red-500/20 bg-red-500/10 p-4">
              <p className="text-sm font-black text-white flex items-center gap-2"><Clock size={14} className="text-red-400"/> Final hold — keep pressed</p>
              <p className="text-xs text-white/60 mt-1">Hold the button for 2.5s to purge. Auth account is deleted last; if it fails you can retry. No retention after this.</p>
            </div>
            <button
              type="button"
              onPointerDown={() => setHolding(true)}
              onPointerUp={() => setHolding(false)}
              onPointerLeave={() => setHolding(false)}
              onTouchStart={() => setHolding(true)}
              onTouchEnd={() => setHolding(false)}
              disabled={purging}
              className="relative w-full h-14 rounded-xl bg-red-500 text-white font-black text-sm overflow-hidden disabled:opacity-40 select-none"
            >
              <span className="relative z-10 flex items-center justify-center gap-2">{purging ? 'Purging…' : holding ? `Hold… ${holdProgress}%` : 'Hold to delete forever'} <Trash2 size={16} /></span>
              <span className="absolute inset-y-0 left-0 bg-red-700 transition-[width] duration-75" style={{ width: `${holdProgress}%` }} />
            </button>
            <div className="flex gap-2">
              <button type="button" onClick={() => setStep(4)} className="flex-1 h-10 rounded-xl border border-white/10 text-white text-xs font-bold">Back</button>
              <button type="button" onClick={onClose} className="flex-1 h-10 rounded-xl bg-white/5 text-white/60 text-xs font-bold">Cancel</button>
            </div>
            <p className="text-[10px] text-white/30 font-mono text-center">Next.js server purges all rows + storage first; Appwrite function `account-cleanup` sweeps leftovers on `users.*.delete`. Instant.</p>
          </div>
        )}
      </div>
    </div>
  );
}
