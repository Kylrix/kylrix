'use client';

import React, { useCallback, useEffect, useState } from 'react';
import { Copy, KeyRound, Plus, Trash2, Code2, AppWindow, BookOpen } from 'lucide-react';
import Link from 'next/link';
import toast from 'react-hot-toast';
import { PAT_SCOPES, PAT_SCOPE_META, type PatScope } from '@/lib/api/scopes';
import { KYLRIX_API_SKILL_INSTALL } from '@/lib/api/public';
import { createPat, listPats, revokePat } from '@/lib/actions/client-ops';
import { account } from '@/lib/appwrite/client';

type PatItem = {
  id: string;
  name: string;
  tokenPrefix: string;
  scopes: string[];
  status: string;
  createdAt: string | null;
  lastUsedAt: string | null;
};

function Section({
  title,
  action,
  children,
}: {
  title: string;
  action?: React.ReactNode;
  children: React.ReactNode;
}) {
  return (
    <section className="rounded-[22px] bg-[#161412] border border-white/[0.06] p-5 space-y-3.5">
      <div className="flex items-center justify-between gap-3">
        <h3 className="text-[11px] font-extrabold uppercase tracking-wider text-white/55 font-satoshi">
          {title}
        </h3>
        {action}
      </div>
      <div className="space-y-2.5">{children}</div>
    </section>
  );
}

export function DevelopersTab() {
  const [developerMode, setDeveloperMode] = useState(false);
  const [pats, setPats] = useState<PatItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [creating, setCreating] = useState(false);
  const [name, setName] = useState('');
  const [selected, setSelected] = useState<PatScope[]>([
    'profile:read',
    'notes:read',
    'notes:write',
  ]);
  const [revealedToken, setRevealedToken] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    setLoading(true);
    try {
      const prefs = await account.getPrefs().catch(() => ({} as any));
      setDeveloperMode(!!(prefs as any)?.developerMode);
      const res = await listPats();
      if (res?.success) setPats((res.data || []) as PatItem[]);
    } catch (err: any) {
      toast.error(err?.message || 'Failed to load');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  const toggleDeveloperMode = async () => {
    try {
      const prefs = (await account.getPrefs().catch(() => ({}))) as Record<string, unknown>;
      const next = !developerMode;
      await account.updatePrefs({ ...prefs, developerMode: next });
      setDeveloperMode(next);
      toast.success(next ? 'Developer mode on' : 'Developer mode off');
    } catch (err: any) {
      toast.error(err?.message || 'Could not update');
    }
  };

  const toggleScope = (s: PatScope) => {
    setSelected((prev) =>
      prev.includes(s) ? prev.filter((x) => x !== s) : [...prev, s]
    );
  };

  const handleCreate = async () => {
    if (!name.trim()) {
      toast.error('Name required');
      return;
    }
    if (selected.length === 0) {
      toast.error('Pick at least one permission');
      return;
    }
    setCreating(true);
    try {
      const res = await createPat({ name: name.trim(), scopes: selected });
      setRevealedToken(res.token);
      setName('');
      try {
        await navigator.clipboard.writeText(res.token);
        toast.success('Token created and copied');
      } catch {
        toast.success('Token created — copy it now');
      }
      await refresh();
    } catch (err: any) {
      toast.error(err?.message || 'Create failed');
    } finally {
      setCreating(false);
    }
  };

  const handleRevoke = async (id: string) => {
    try {
      await revokePat(id);
      toast.success('Revoked');
      await refresh();
    } catch (err: any) {
      toast.error(err?.message || 'Revoke failed');
    }
  };

  const copy = async (text: string) => {
    try {
      await navigator.clipboard.writeText(text);
      toast.success('Copied');
    } catch {
      toast.success(text);
    }
  };

  return (
    <div className="space-y-4 pb-24 max-w-3xl font-satoshi">
      <div className="flex items-end justify-between gap-3">
        <h2 className="text-xl font-black font-clash text-white tracking-tight">Developers</h2>
        <Link
          href="/docs/api"
          className="inline-flex items-center gap-1.5 text-[11px] font-extrabold uppercase tracking-wider text-[#6366F1] hover:text-white"
        >
          <BookOpen size={14} />
          Docs
        </Link>
      </div>

      <Section title="Agent skill">
        <div className="rounded-2xl bg-[#0A0908] border border-white/[0.05] p-3.5 space-y-2.5">
          <p className="text-[11px] text-white/45">
            Install the Kylrix API skill in Claude Code, Cursor, and other agent tools.
          </p>
          <div className="flex items-center gap-2">
            <code className="flex-1 min-w-0 text-[11px] font-mono text-white/80 bg-[#161412] border border-white/[0.06] rounded-xl px-3 py-2.5 break-all select-all">
              {KYLRIX_API_SKILL_INSTALL}
            </code>
            <button
              type="button"
              onClick={() => void copy(KYLRIX_API_SKILL_INSTALL)}
              className="inline-flex items-center gap-1.5 px-3 py-2.5 rounded-xl text-xs font-extrabold bg-[#6366F1] text-white cursor-pointer shrink-0"
            >
              <Copy size={14} />
              Copy
            </button>
          </div>
        </div>
      </Section>

      <Section title="Developer mode">
        <div className="flex items-center justify-between gap-3 rounded-2xl bg-[#0A0908] border border-white/[0.05] px-3.5 py-3.5">
          <div className="min-w-0">
            <p className="text-sm font-bold text-white">Developer mode</p>
            <p className="text-[11px] text-white/40">Unlocks advanced tooling and demo helpers</p>
          </div>
          <button
            type="button"
            onClick={() => void toggleDeveloperMode()}
            className={`relative h-7 w-12 rounded-full border transition-colors cursor-pointer shrink-0 ${
              developerMode ? 'bg-[#6366F1] border-[#6366F1]' : 'bg-[#161412] border-white/15'
            }`}
            aria-pressed={developerMode}
          >
            <span
              className={`absolute top-0.5 h-5 w-5 rounded-full bg-white transition-transform ${
                developerMode ? 'left-6' : 'left-0.5'
              }`}
            />
          </button>
        </div>
      </Section>

      <Section
        title="Personal access tokens"
        action={
          <span className="text-[10px] font-extrabold text-white/30 uppercase tracking-wider">
            {pats.filter((p) => p.status === 'active').length} active
          </span>
        }
      >
        <div className="rounded-2xl bg-[#0A0908] border border-white/[0.05] p-3.5 space-y-3">
          <input
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="Token name"
            className="w-full rounded-xl bg-[#161412] border border-white/10 px-3 py-2.5 text-sm text-white outline-none focus:border-[#6366F1]"
          />
          <div className="flex flex-wrap gap-1.5">
            {PAT_SCOPES.map((s) => {
              const on = selected.includes(s);
              const meta = PAT_SCOPE_META[s];
              return (
                <button
                  key={s}
                  type="button"
                  onClick={() => toggleScope(s)}
                  className={`px-2.5 py-1.5 rounded-lg text-[10px] font-extrabold cursor-pointer border ${
                    on
                      ? meta.danger
                        ? 'bg-red-500/15 border-red-500/30 text-red-300'
                        : 'bg-[#6366F1]/20 border-[#6366F1]/40 text-[#A5B4FC]'
                      : 'bg-[#161412] border-white/[0.06] text-white/35'
                  }`}
                >
                  {meta.label}
                </button>
              );
            })}
          </div>
          <button
            type="button"
            disabled={creating}
            onClick={() => void handleCreate()}
            className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl text-xs font-extrabold bg-[#6366F1] text-white cursor-pointer disabled:opacity-40"
          >
            <Plus size={14} strokeWidth={3} />
            Create token
          </button>
        </div>

        {revealedToken && (
          <div className="rounded-2xl bg-[#0A0908] border border-amber-500/25 p-3.5 space-y-2">
            <p className="text-[11px] font-bold text-amber-400">
              Copied to clipboard. Store it safely — shown once.
            </p>
            <code className="block text-[11px] font-mono text-white/80 break-all select-all">
              {revealedToken}
            </code>
            <button
              type="button"
              onClick={() => void copy(revealedToken)}
              className="inline-flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-extrabold bg-[#161412] border border-white/[0.08] text-white cursor-pointer"
            >
              <Copy size={14} />
              Copy again
            </button>
          </div>
        )}

        {loading ? (
          <p className="text-xs text-white/40 px-1">Loading…</p>
        ) : pats.length === 0 ? (
          <div className="rounded-2xl bg-[#0A0908] border border-white/[0.05] px-4 py-8 text-center">
            <div className="mx-auto w-fit p-3 rounded-2xl bg-[#161412] border border-white/[0.06] text-[#6366F1] mb-3">
              <KeyRound size={20} />
            </div>
            <p className="text-sm font-bold text-white/50">No tokens yet</p>
          </div>
        ) : (
          pats.map((pat) => (
            <div
              key={pat.id}
              className="flex items-center gap-3 rounded-2xl bg-[#0A0908] border border-white/[0.05] p-3.5"
            >
              <div className="p-2 rounded-xl bg-[#161412] border border-white/[0.06] text-[#6366F1] shrink-0">
                <KeyRound size={16} />
              </div>
              <div className="min-w-0 flex-1">
                <p className="text-sm font-bold text-white truncate">{pat.name}</p>
                <p className="text-[11px] text-white/40 font-mono truncate">
                  kyl_pat_{pat.tokenPrefix}_… · {pat.status}
                  {pat.scopes?.length ? ` · ${pat.scopes.length} perms` : ''}
                </p>
              </div>
              {pat.status === 'active' && (
                <button
                  type="button"
                  title="Revoke"
                  onClick={() => void handleRevoke(pat.id)}
                  className="p-2 rounded-lg bg-[#161412] border border-red-500/20 text-red-400 cursor-pointer shrink-0"
                >
                  <Trash2 size={14} />
                </button>
              )}
            </div>
          ))
        )}
      </Section>

      <Section title="OAuth apps">
        <div className="rounded-2xl bg-[#0A0908] border border-white/[0.05] px-3.5 py-3.5 flex items-center gap-3">
          <div className="p-2 rounded-xl bg-[#161412] border border-white/[0.06] text-white/35">
            <AppWindow size={16} />
          </div>
          <div className="min-w-0 flex-1">
            <p className="text-sm font-bold text-white">Create OAuth app</p>
            <p className="text-[11px] text-white/40">Sign in with Kylrix for third-party apps</p>
          </div>
          <span className="text-[10px] font-extrabold uppercase tracking-wider text-white/30 shrink-0">
            Coming soon
          </span>
        </div>
      </Section>

      <Section title="Quick start">
        <div className="rounded-2xl bg-[#0A0908] border border-white/[0.05] p-3.5 space-y-2">
          <div className="flex items-center gap-2 text-[#6366F1]">
            <Code2 size={14} />
            <p className="text-[11px] font-extrabold uppercase tracking-wider">curl</p>
          </div>
          <pre className="text-[11px] font-mono text-white/55 whitespace-pre-wrap break-all">{`curl -X POST -H "Authorization: Bearer kyl_pat_…" \\
  -H "Content-Type: application/json" \\
  -d '{"title":"Hello","content":"From API"}' \\
  https://www.kylrix.space/api/v1/notes`}</pre>
        </div>
      </Section>
    </div>
  );
}
