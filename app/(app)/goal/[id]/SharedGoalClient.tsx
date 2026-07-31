'use client';

import React, { useEffect, useState } from 'react';
import Link from 'next/link';
import { Flag, Calendar, Lock, AlertTriangle } from 'lucide-react';
import { SharedWorkspaceBar } from '@/components/common/SharedWorkspaceBar';
import { ecosystemSecurity } from '@/lib/ecosystem/security';

type PublicGoal = {
  id: string;
  title: string;
  description: string | null;
  status: string;
  priority: string;
  dueDate: string | null;
  locked?: boolean;
};

const STATUS_LABELS: Record<string, string> = {
  todo: 'To do',
  'in-progress': 'In progress',
  done: 'Completed',
  blocked: 'Blocked',
  cancelled: 'Cancelled',
};

const PRIORITY_COLORS: Record<string, string> = {
  low: '#A1A1AA',
  medium: '#14B8A6',
  high: '#F59E0B',
  urgent: '#EF4444',
};

const DEK_IV_SIZE = 16;

async function importDek(dekBase64Safe: string): Promise<CryptoKey> {
  const base64 = dekBase64Safe.replace(/-/g, '+').replace(/_/g, '/');
  const pad = (4 - (base64.length % 4)) % 4;
  const rawString = atob(base64 + '='.repeat(pad));
  const raw = Uint8Array.from(rawString, (c) => c.charCodeAt(0));
  return crypto.subtle.importKey('raw', raw, { name: 'AES-GCM', length: 256 }, false, ['decrypt']);
}

async function decryptWithDek(ciphertext: string, dek: CryptoKey): Promise<string> {
  try {
    return await ecosystemSecurity.decryptWithKey(ciphertext, dek);
  } catch {
    try {
      const buf = Uint8Array.from(atob(ciphertext), (c) => c.charCodeAt(0));
      const iv = buf.slice(0, DEK_IV_SIZE);
      const data = buf.slice(DEK_IV_SIZE);
      const plain = await crypto.subtle.decrypt({ name: 'AES-GCM', iv }, dek, data);
      return new TextDecoder().decode(plain);
    } catch {
      return '[Could not decrypt]';
    }
  }
}

function AccessUnavailable() {
  return (
    <div className="min-h-[70vh] flex items-center justify-center bg-[#0A0908] px-6 py-16">
      <div className="max-w-md text-center space-y-4">
        <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl bg-[#1C1A18] border border-[#2C2A28]">
          <Lock className="h-6 w-6 text-[#9B9691]" />
        </div>
        <h1 className="text-xl font-bold text-white font-clash">This goal is not available</h1>
        <p className="text-sm text-[#9B9691] leading-relaxed">
          The link may be wrong, or the owner has not shared this goal publicly.
        </p>
        <Link
          href="/goals"
          className="inline-flex items-center justify-center rounded-xl bg-[#A855F7] px-4 py-2 text-sm font-semibold text-white hover:bg-[#9333EA] transition-colors"
        >
          Open Flow
        </Link>
      </div>
    </div>
  );
}

export default function SharedGoalClient({
  goal,
  dekFragment,
}: {
  goal: PublicGoal | null;
  dekFragment?: string;
}) {
  const [view, setView] = useState<PublicGoal | null>(goal);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    async function run() {
      if (!goal) return;
      if (!goal.locked) {
        setView(goal);
        return;
      }
      if (!dekFragment) {
        setError('This goal is locked. Open the full share link that includes the key.');
        setView({
          ...goal,
          title: 'Locked goal',
          description: null,
        });
        return;
      }
      try {
        const dek = await importDek(dekFragment);
        const title = await decryptWithDek(goal.title, dek);
        const description = goal.description
          ? await decryptWithDek(goal.description, dek)
          : null;
        if (!cancelled) {
          setView({ ...goal, title, description, locked: false });
          setError(null);
        }
      } catch (err: any) {
        if (!cancelled) {
          setError(err?.message || 'Could not unlock this goal with the provided key.');
          setView({ ...goal, title: 'Locked goal', description: null });
        }
      }
    }
    void run();
    return () => {
      cancelled = true;
    };
  }, [goal, dekFragment]);

  if (!goal) return <AccessUnavailable />;
  if (!view) return null;

  const priorityColor = PRIORITY_COLORS[String(view.priority)] || PRIORITY_COLORS.medium;
  const statusLabel = STATUS_LABELS[String(view.status)] || String(view.status);

  return (
    <div className="min-h-[70vh] bg-[#0A0908] text-white">
      <div className="mx-auto max-w-3xl px-6 py-10">
        <SharedWorkspaceBar objectType="goal" />
        <p className="font-mono text-[10px] uppercase tracking-[0.2em] text-[#A855F7] mb-3">
          Shared goal
        </p>
        {error ? (
          <div className="mb-4 flex items-start gap-2 rounded-xl border border-amber-500/30 bg-amber-500/10 px-3 py-2 text-sm text-amber-200">
            <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
            <span>{error}</span>
          </div>
        ) : null}
        <h1 className="text-2xl sm:text-3xl font-bold font-clash break-words mb-4">
          {view.title}
        </h1>

        <div className="flex flex-wrap gap-2 mb-6">
          <span className="inline-flex items-center gap-1.5 rounded-lg border border-[#2C2A28] bg-[#1C1A18] px-2.5 py-1 text-[10px] font-mono font-bold uppercase tracking-wider text-[#9B9691]">
            {statusLabel}
          </span>
          <span
            className="inline-flex items-center gap-1.5 rounded-lg border border-[#2C2A28] bg-[#1C1A18] px-2.5 py-1 text-[10px] font-mono font-bold uppercase tracking-wider"
            style={{ color: priorityColor }}
          >
            <Flag className="h-3 w-3" />
            {String(view.priority)}
          </span>
          {view.dueDate && (
            <span className="inline-flex items-center gap-1.5 rounded-lg border border-[#2C2A28] bg-[#1C1A18] px-2.5 py-1 text-[10px] font-mono font-bold uppercase tracking-wider text-[#9B9691]">
              <Calendar className="h-3 w-3" />
              {new Date(view.dueDate).toLocaleDateString()}
            </span>
          )}
        </div>

        {view.description ? (
          <div className="rounded-2xl border border-[#2C2A28] bg-[#141210] p-5">
            <p className="text-sm sm:text-base text-[#D4D1CC] leading-relaxed whitespace-pre-wrap break-words">
              {view.description}
            </p>
          </div>
        ) : (
          <p className="text-sm text-[#9B9691]">No description was added to this goal.</p>
        )}

        <p className="mt-8 text-xs text-[#6B6762]">
          Read-only view. Sign in to collaborate if you were invited.
        </p>
      </div>
    </div>
  );
}
