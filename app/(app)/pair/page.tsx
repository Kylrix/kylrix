'use client';

import React, { useState, useEffect, useCallback, Suspense } from 'react';
import { useSearchParams, useRouter } from 'next/navigation';
import { ShieldCheck, ShieldAlert, CheckCircle2, Loader2, ArrowRight, Laptop, Key } from 'lucide-react';
import { account } from '@/lib/appwrite/client';
import toast from 'react-hot-toast';

export default function PairPage() {
  return (
    <Suspense
      fallback={
        <div className="min-h-screen bg-[#000000] text-white flex items-center justify-center font-mono text-sm">
          <Loader2 className="animate-spin text-[#6366F1]" size={24} />
        </div>
      }
    >
      <PairContent />
    </Suspense>
  );
}

function PairContent() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const initialCode = searchParams.get('code') || '';

  const [code, setCode] = useState(initialCode);
  const [loading, setLoading] = useState(false);
  const [deciding, setDeciding] = useState(false);
  const [currentUser, setCurrentUser] = useState<any>(null);
  const [session, setSession] = useState<{
    id: string;
    clientName: string;
    clientType: string;
    requestedScopes: string[];
    status: string;
  } | null>(null);
  const [decisionDone, setDecisionDone] = useState<'approved' | 'denied' | null>(null);

  useEffect(() => {
    account.get().then(setCurrentUser).catch(() => setCurrentUser(null));
  }, []);

  const lookupCode = useCallback(async (codeToLookup: string) => {
    const clean = codeToLookup.trim().toUpperCase();
    if (!clean) return;

    setLoading(true);
    try {
      const res = await fetch(`/api/v1/pairing/verify?code=${encodeURIComponent(clean)}`, {
        headers: { Accept: 'application/json' },
      });
      const json = await res.json();
      if (json.ok && json.data?.found && json.data?.session) {
        setSession(json.data.session);
      } else {
        setSession(null);
        toast.error('Pairing code not found or expired.');
      }
    } catch {
      toast.error('Failed to verify pairing code.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (initialCode) {
      lookupCode(initialCode);
    }
  }, [initialCode, lookupCode]);

  const handleDecide = async (action: 'approve' | 'deny') => {
    if (!currentUser) {
      toast.error('Please sign in to authorize this client.');
      router.push(`/auth/login?redirect=${encodeURIComponent(window.location.href)}`);
      return;
    }

    setDeciding(true);
    try {
      const res = await fetch('/api/v1/pairing/approve', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
        body: JSON.stringify({
          userCode: code.trim().toUpperCase(),
          action,
        }),
      });

      const json = await res.json();
      if (json.ok && json.data?.ok) {
        setDecisionDone(action === 'approve' ? 'approved' : 'denied');
        if (action === 'approve') {
          toast.success('Client authorized successfully! You can return to your terminal or app.');
        } else {
          toast.success('Pairing request denied.');
        }
      } else {
        toast.error(json?.error?.message || 'Failed to authorize.');
      }
    } catch (err: any) {
      toast.error(err.message || 'Authorization failed.');
    } finally {
      setDeciding(false);
    }
  };

  return (
    <div className="min-h-screen bg-[#000000] text-white flex flex-col items-center justify-center p-4 selection:bg-[#6366F1]/30">
      <div className="w-full max-w-md bg-[#161412] border-2 border-white/20 rounded-[28px] p-6 md:p-8 shadow-2xl space-y-6">
        {/* Header */}
        <div className="text-center space-y-2">
          <div className="w-14 h-14 rounded-2xl bg-[#6366F1]/10 text-[#6366F1] border-2 border-[#6366F1]/30 flex items-center justify-center mx-auto shadow-lg">
            <Key size={26} />
          </div>
          <h1 className="text-xl font-black font-mono tracking-tight text-white">
            Authorize Client Pairing
          </h1>
          <p className="text-xs text-white/60 font-sans">
            Connect a first-party CLI, self-hosted node, or mobile companion to your Kylrix account.
          </p>
        </div>

        {decisionDone ? (
          <div className="text-center py-6 space-y-3">
            {decisionDone === 'approved' ? (
              <>
                <CheckCircle2 size={48} className="text-emerald-400 mx-auto animate-bounce" />
                <h2 className="text-lg font-black font-mono text-emerald-300">Device Authorized!</h2>
                <p className="text-xs text-white/60 font-sans">
                  The client has received its user-scoped punch token and is now connected. You can close this window.
                </p>
              </>
            ) : (
              <>
                <ShieldAlert size={48} className="text-red-400 mx-auto" />
                <h2 className="text-lg font-black font-mono text-red-300">Pairing Denied</h2>
                <p className="text-xs text-white/60 font-sans">
                  The client was not authorized to access your account.
                </p>
              </>
            )}
          </div>
        ) : !session ? (
          <form
            onSubmit={(e) => {
              e.preventDefault();
              lookupCode(code);
            }}
            className="space-y-4"
          >
            <div>
              <label className="text-xs font-bold text-white/70 block mb-1.5 font-mono">
                Enter 8-Character Pairing Code
              </label>
              <input
                type="text"
                value={code}
                onChange={(e) => setCode(e.target.value.toUpperCase())}
                placeholder="KYL-XXXX"
                maxLength={8}
                className="w-full bg-[#000000] border-2 border-white/20 focus:border-[#6366F1] rounded-2xl px-4 py-3 text-center text-xl font-mono tracking-widest text-white uppercase outline-none transition-colors"
              />
              <p className="text-[10px] text-white/40 mt-1.5 text-center">
                Displayed in your terminal CLI, self-hosted sync drawer, or app screen.
              </p>
            </div>

            <button
              type="submit"
              disabled={loading || !code.trim()}
              className="w-full py-3 rounded-xl bg-[#6366F1] hover:bg-[#5254E8] text-white font-extrabold text-xs flex items-center justify-center gap-2 transition-all disabled:opacity-40 cursor-pointer border-2 border-[#6366F1] shadow-md"
            >
              {loading ? <Loader2 className="animate-spin" size={16} /> : <ArrowRight size={16} />}
              <span>{loading ? 'Verifying Code...' : 'Continue'}</span>
            </button>
          </form>
        ) : (
          <div className="space-y-5">
            {/* Client Card */}
            <div className="bg-[#000000] border-2 border-white/15 rounded-2xl p-4 flex items-center gap-3.5">
              <div className="w-10 h-10 rounded-xl bg-purple-500/10 text-purple-400 border border-purple-500/30 flex items-center justify-center shrink-0">
                <Laptop size={20} />
              </div>
              <div className="min-w-0 flex-1">
                <h3 className="text-sm font-black font-mono text-white truncate">
                  {session.clientName}
                </h3>
                <p className="text-[11px] text-white/50 font-sans capitalize">
                  Type: {session.clientType.replace(/_/g, ' ')}
                </p>
              </div>
              <span className="px-2.5 py-1 rounded-lg bg-emerald-500/10 border border-emerald-500/30 text-emerald-400 text-[10px] font-mono font-bold">
                {session.status}
              </span>
            </div>

            {/* Scopes Requested */}
            <div className="space-y-2">
              <span className="text-[11px] font-bold text-white/70 block font-mono">
                Requested Capabilities:
              </span>
              <div className="bg-[#000000] border border-white/10 rounded-xl p-3 flex flex-wrap gap-1.5 max-h-32 overflow-y-auto">
                {session.requestedScopes.map((scope) => (
                  <span
                    key={scope}
                    className="text-[10px] font-mono px-2 py-0.5 rounded bg-white/5 border border-white/10 text-white/80"
                  >
                    {scope}
                  </span>
                ))}
              </div>
            </div>

            {/* Current Account Indicator */}
            {currentUser && (
              <div className="text-[11px] font-mono text-white/50 text-center bg-white/5 p-2 rounded-lg border border-white/10">
                Authorizing as <strong className="text-white">{currentUser.email || currentUser.name || currentUser.$id}</strong>
              </div>
            )}

            {/* Action Buttons */}
            <div className="flex items-center gap-3 pt-2">
              <button
                type="button"
                onClick={() => handleDecide('deny')}
                disabled={deciding}
                className="flex-1 py-2.5 rounded-xl border-2 border-red-500/40 hover:border-red-500/60 bg-red-500/10 text-red-300 font-extrabold text-xs transition-all disabled:opacity-40 cursor-pointer text-center"
              >
                Deny
              </button>
              <button
                type="button"
                onClick={() => handleDecide('approve')}
                disabled={deciding}
                className="flex-1 py-2.5 rounded-xl bg-[#6366F1] hover:bg-[#5254E8] text-white font-black text-xs transition-all disabled:opacity-40 cursor-pointer border-2 border-[#6366F1] shadow-lg text-center flex items-center justify-center gap-1.5"
              >
                {deciding ? <Loader2 className="animate-spin" size={14} /> : <ShieldCheck size={14} />}
                <span>{deciding ? 'Authorizing...' : 'Authorize'}</span>
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
