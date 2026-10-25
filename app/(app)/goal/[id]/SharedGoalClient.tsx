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
          className="inline-flex items-center justify-center rounded-xl bg-[#6366F1] px-4 py-2 text-sm font-semibold text-white hover:bg-[#5254E8] transition-colors"
        >
          Open Flow
        </Link>
      </div>
    </div>
  );
}

export default function SharedGoalClient({
  goalId,
  goal,
  dekFragment,
}: {
  goalId?: string;
  goal: PublicGoal | null;
  dekFragment?: string;
}) {
  const [currentGoal, setCurrentGoal] = useState<PublicGoal | null>(goal);
  const [view, setView] = useState<PublicGoal | null>(goal);
  const [error, setError] = useState<string | null>(null);
  const [accessDenied, setAccessDenied] = useState<boolean>(false);

  // ── Offline substrate & remote sync ────────────────────────────────────────
  useEffect(() => {
    let active = true;
    if (!goalId) return;

    void (async () => {
      try {
        const { SharedOfflineSubstrate } = await import('@/lib/share/shared-offline-substrate');
        const { getCurrentUserSnapshot } = await import('@/lib/data');
        const currentUser = getCurrentUserSnapshot();

        await SharedOfflineSubstrate.syncSharedRoute<PublicGoal>({
          kind: 'goal',
          id: goalId,
          currentUserId: currentUser?.$id,
          initialData: goal,
          onLocalHit: (cachedGoal) => {
            if (active) {
              setCurrentGoal(cachedGoal);
            }
          },
          fetchRemote: async () => {
            const { getSharedGoalData } = await import('@/lib/actions/client-ops');
            return (await getSharedGoalData(goalId)) as PublicGoal;
          },
          onRemoteSuccess: (freshGoal) => {
            if (active) {
              setCurrentGoal(freshGoal);
              setAccessDenied(false);
            }
          },
          onAccessRevoked: () => {
            if (active) {
              setAccessDenied(true);
              setCurrentGoal(null);
              setView(null);
            }
          },
        });
      } catch {
        if (!currentGoal && !goal && active) {
          setAccessDenied(true);
        }
      }
    })();

    return () => {
      active = false;
    };
  }, [goalId, goal]);

  // ── Live Realtime Subscription ─────────────────────────────────────────────
  useEffect(() => {
    if (!goalId) return;
    let unsub: any;

    void (async () => {
      try {
        const { realtime } = await import('@/lib/data');
        const { SharedOfflineSubstrate } = await import('@/lib/share/shared-offline-substrate');

        const channels = [
          `tasks:${goalId}`,
          `goals:${goalId}`,
          `doc:${goalId}`,
          `row:${goalId}`,
          'tasks',
          'goals',
          `databases.turso.collections.tasks.documents.${goalId}`,
        ];

        unsub = realtime.subscribe(channels, async (response: any) => {
          const payload = response.payload;
          const targetId = payload?.$id || payload?.id;
          if (targetId && targetId !== goalId) return;

          const isDelete = response.events?.some((e: string) => e.endsWith('.delete'));

          if (isDelete || payload?.isTrash || payload?.isDeleted) {
            setAccessDenied(true);
            setCurrentGoal(null);
            setView(null);
            void SharedOfflineSubstrate.evictShared('goal', goalId);
            return;
          }

          // Trigger fresh remote fetch to ensure complete goal details
          try {
            const { getSharedGoalData } = await import('@/lib/actions/client-ops');
            const fresh = (await getSharedGoalData(goalId)) as PublicGoal;
            if (fresh) {
              setCurrentGoal(fresh);
              setAccessDenied(false);
              void SharedOfflineSubstrate.saveShared('goal', goalId, fresh);
            }
          } catch {
            if (payload) {
              const updatedGoal: PublicGoal = {
                id: payload.id || payload.$id || goalId,
                title: payload.title || '',
                description: payload.description ?? null,
                status: payload.status || 'todo',
                priority: payload.priority || 'medium',
                dueDate: payload.dueDate ?? null,
                locked: payload.isLocked || payload.locked,
              };
              setCurrentGoal(updatedGoal);
              setAccessDenied(false);
              void SharedOfflineSubstrate.saveShared('goal', goalId, updatedGoal);
            }
          }
        });
      } catch {}
    })();

    return () => {
      if (typeof unsub === 'function') unsub();
      else if (unsub?.unsubscribe) unsub.unsubscribe();
    };
  }, [goalId]);

  // ── Decryption & View State ────────────────────────────────────────────────
  useEffect(() => {
    let cancelled = false;
    const target = currentGoal || goal;
    async function run() {
      if (!target) return;
      if (!target.locked) {
        setView(target);
        return;
      }
      if (!dekFragment) {
        setError('This goal is locked. Open the full share link that includes the key.');
        setView({
          ...target,
          title: 'Locked goal',
          description: null,
        });
        return;
      }
      try {
        const dek = await importDek(dekFragment);
        const title = await decryptWithDek(target.title, dek);
        const description = target.description
          ? await decryptWithDek(target.description, dek)
          : null;
        if (!cancelled) {
          setView({ ...target, title, description, locked: false });
          setError(null);
        }
      } catch (err: any) {
        if (!cancelled) {
          setError(err?.message || 'Could not unlock this goal with the provided key.');
          setView({ ...target, title: 'Locked goal', description: null });
        }
      }
    }
    void run();
    return () => {
      cancelled = true;
    };
  }, [currentGoal, goal, dekFragment]);

  if (accessDenied || (!currentGoal && !goal && !view)) return <AccessUnavailable />;
  if (!view) return null;

  const priorityColor = PRIORITY_COLORS[String(view.priority)] || PRIORITY_COLORS.medium;
  const statusLabel = STATUS_LABELS[String(view.status)] || String(view.status);

  return (
    <div className="min-h-[70vh] bg-[#0A0908] text-white">
      <div className="mx-auto max-w-3xl px-6 py-10">
        <SharedWorkspaceBar objectType="goal" />
        <p className="font-mono text-[10px] uppercase tracking-[0.2em] text-[#6366F1] mb-3">
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
