'use client';

import React, { useCallback, useEffect, useState } from 'react';
import {
  Copy,
  KeyRound,
  Trash2,
  BookOpen,
  AppWindow,
  Plus,
} from 'lucide-react';
import Link from 'next/link';
import toast from 'react-hot-toast';
import {
  KYLRIX_API_SKILL_INSTALL,
  KYLRIX_OAUTH2_SKILL_INSTALL,
} from '@/lib/api/public';
import { listPats, revokePat } from '@/lib/actions/client-ops';
import { account } from '@/lib/appwrite/client';
import {
  deleteApp,
  deleteAppTokens,
  listMyApps,
  type OauthApp,
} from '@/lib/oauth2/apps';
import { CreatePatDrawer } from '@/components/settings/CreatePatDrawer';
import { CreateOAuthAppDrawer } from '@/components/settings/CreateOAuthAppDrawer';

type PatItem = {
  id: string;
  name: string;
  tokenPrefix: string;
  scopes: string[];
  status: string;
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

function SkillRow({
  title,
  install,
  docsHref,
  docsLabel,
}: {
  title: string;
  install: string;
  docsHref: string;
  docsLabel: string;
}) {
  const copy = async () => {
    try {
      await navigator.clipboard.writeText(install);
      toast.success('Copied');
    } catch {
      toast.success(install);
    }
  };

  return (
    <div className="rounded-2xl bg-[#0A0908] border border-white/[0.05] p-3.5 space-y-2.5">
      <div className="flex items-center justify-between gap-2">
        <p className="text-sm font-bold text-white">{title}</p>
        <Link
          href={docsHref}
          className="inline-flex items-center gap-1 text-[10px] font-extrabold uppercase tracking-wider text-[#A5B4FC] hover:text-white shrink-0"
        >
          <BookOpen size={12} />
          {docsLabel}
        </Link>
      </div>
      <div className="flex items-center gap-2">
        <code className="flex-1 min-w-0 text-[11px] font-mono text-white/70 bg-[#161412] border border-white/[0.06] rounded-xl px-3 py-2.5 break-all select-all">
          {install}
        </code>
        <button
          type="button"
          onClick={() => void copy()}
          className="inline-flex items-center gap-1.5 px-3 py-2.5 rounded-xl text-xs font-extrabold bg-[#6366F1] text-white cursor-pointer shrink-0"
        >
          <Copy size={14} />
          Copy
        </button>
      </div>
    </div>
  );
}

export function DevelopersTab() {
  const [developerMode, setDeveloperMode] = useState(false);
  const [pats, setPats] = useState<PatItem[]>([]);
  const [apps, setApps] = useState<OauthApp[]>([]);
  const [loadingPats, setLoadingPats] = useState(true);
  const [loadingApps, setLoadingApps] = useState(true);
  const [patDrawerOpen, setPatDrawerOpen] = useState(false);
  const [oauthDrawerOpen, setOauthDrawerOpen] = useState(false);

  const refreshPats = useCallback(async () => {
    setLoadingPats(true);
    try {
      const prefs = await account.getPrefs().catch(() => ({} as any));
      setDeveloperMode(!!(prefs as any)?.developerMode);
      const res = await listPats();
      if (res?.success) setPats((res.data || []) as PatItem[]);
    } catch (err: any) {
      toast.error(err?.message || 'Failed to load tokens');
    } finally {
      setLoadingPats(false);
    }
  }, []);

  const refreshApps = useCallback(async () => {
    setLoadingApps(true);
    try {
      const user = await account.get();
      setApps(await listMyApps(user.$id));
    } catch {
      setApps([]);
    } finally {
      setLoadingApps(false);
    }
  }, []);

  useEffect(() => {
    void refreshPats();
    void refreshApps();
  }, [refreshPats, refreshApps]);

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

  const copy = async (text: string) => {
    try {
      await navigator.clipboard.writeText(text);
      toast.success('Copied');
    } catch {
      toast.success(text);
    }
  };

  const handleRevokePat = async (id: string) => {
    try {
      await revokePat(id);
      toast.success('Revoked');
      await refreshPats();
    } catch (err: any) {
      toast.error(err?.message || 'Revoke failed');
    }
  };

  const handleDeleteApp = async (appId: string) => {
    try {
      await deleteApp(appId);
      toast.success('App deleted');
      await refreshApps();
    } catch (err: any) {
      toast.error(err?.message || 'Delete failed');
    }
  };

  const handleRevokeAppTokens = async (appId: string) => {
    try {
      await deleteAppTokens(appId);
      toast.success('All tokens revoked');
    } catch (err: any) {
      toast.error(err?.message || 'Revoke failed');
    }
  };

  const activePats = pats.filter((p) => p.status === 'active').length;

  return (
    <div className="space-y-4 pb-24 max-w-3xl font-satoshi">
      <h2 className="text-xl font-black font-clash text-white tracking-tight">Developers</h2>

      <Section title="Agent skills">
        <SkillRow
          title="HTTP API (CLI & scripts)"
          install={KYLRIX_API_SKILL_INSTALL}
          docsHref="/docs/api"
          docsLabel="API docs"
        />
        <SkillRow
          title="Sign in with Kylrix (OAuth)"
          install={KYLRIX_OAUTH2_SKILL_INSTALL}
          docsHref="/docs/oauth2"
          docsLabel="OAuth docs"
        />
      </Section>

      <Section
        title="Personal access tokens"
        action={
          <button
            type="button"
            onClick={() => setPatDrawerOpen(true)}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-[10px] font-extrabold uppercase tracking-wider bg-[#6366F1] text-white cursor-pointer"
          >
            <Plus size={12} strokeWidth={3} />
            Set up
          </button>
        }
      >
        <div className="flex items-center justify-between gap-2 px-0.5">
          <p className="text-[11px] text-white/40">
            For scripts and agents that call the HTTP API
          </p>
          <span className="text-[10px] font-extrabold text-white/30 uppercase tracking-wider shrink-0">
            {activePats} active
          </span>
        </div>

        {loadingPats ? (
          <p className="text-xs text-white/40 px-1">Loading…</p>
        ) : pats.length === 0 ? (
          <div className="rounded-2xl bg-[#0A0908] border border-white/[0.05] px-4 py-7 text-center space-y-3">
            <div className="mx-auto w-fit p-3 rounded-2xl bg-[#161412] border border-white/[0.06] text-[#6366F1]">
              <KeyRound size={20} />
            </div>
            <p className="text-sm font-bold text-white/50">No tokens yet</p>
            <button
              type="button"
              onClick={() => setPatDrawerOpen(true)}
              className="inline-flex items-center gap-1.5 px-4 py-2.5 rounded-xl text-xs font-extrabold bg-[#6366F1] text-white cursor-pointer"
            >
              <Plus size={14} strokeWidth={3} />
              Set up token
            </button>
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
                  onClick={() => void handleRevokePat(pat.id)}
                  className="p-2 rounded-lg bg-[#161412] border border-red-500/20 text-red-400 cursor-pointer shrink-0"
                >
                  <Trash2 size={14} />
                </button>
              )}
            </div>
          ))
        )}
      </Section>

      <Section
        title="Sign in with Kylrix"
        action={
          <button
            type="button"
            onClick={() => setOauthDrawerOpen(true)}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-[10px] font-extrabold uppercase tracking-wider bg-[#6366F1] text-white cursor-pointer"
          >
            <Plus size={12} strokeWidth={3} />
            Set up
          </button>
        }
      >
        <p className="text-[11px] text-white/40 px-0.5">
          OAuth apps for third-party Sign in with Kylrix
        </p>

        {loadingApps ? (
          <p className="text-xs text-white/40 px-1">Loading…</p>
        ) : apps.length === 0 ? (
          <div className="rounded-2xl bg-[#0A0908] border border-white/[0.05] px-4 py-7 text-center space-y-3">
            <div className="mx-auto w-fit p-3 rounded-2xl bg-[#161412] border border-white/[0.06] text-[#6366F1]">
              <AppWindow size={20} />
            </div>
            <p className="text-sm font-bold text-white/50">No OAuth apps yet</p>
            <button
              type="button"
              onClick={() => setOauthDrawerOpen(true)}
              className="inline-flex items-center gap-1.5 px-4 py-2.5 rounded-xl text-xs font-extrabold bg-[#6366F1] text-white cursor-pointer"
            >
              <Plus size={14} strokeWidth={3} />
              Set up app
            </button>
          </div>
        ) : (
          apps.map((app) => (
            <div
              key={app.$id}
              className="flex items-center gap-3 rounded-2xl bg-[#0A0908] border border-white/[0.05] p-3.5"
            >
              <div className="p-2 rounded-xl bg-[#161412] border border-white/[0.06] text-[#6366F1] shrink-0 overflow-hidden">
                {app.logoUri ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={app.logoUri} alt="" className="h-4 w-4 object-cover rounded" />
                ) : (
                  <AppWindow size={16} />
                )}
              </div>
              <div className="min-w-0 flex-1">
                <p className="text-sm font-bold text-white truncate">{app.name}</p>
                <p className="text-[11px] text-white/40 font-mono truncate">
                  {app.$id} · {app.type || 'confidential'}
                </p>
              </div>
              <button
                type="button"
                title="Copy client id"
                onClick={() => void copy(app.$id)}
                className="p-2 rounded-lg bg-[#161412] border border-white/[0.08] text-white/70 cursor-pointer shrink-0"
              >
                <Copy size={14} />
              </button>
              <button
                type="button"
                title="Revoke all tokens"
                onClick={() => void handleRevokeAppTokens(app.$id)}
                className="p-2 rounded-lg bg-[#161412] border border-white/[0.08] text-amber-300/80 cursor-pointer shrink-0"
              >
                <KeyRound size={14} />
              </button>
              <button
                type="button"
                title="Delete app"
                onClick={() => void handleDeleteApp(app.$id)}
                className="p-2 rounded-lg bg-[#161412] border border-red-500/20 text-red-400 cursor-pointer shrink-0"
              >
                <Trash2 size={14} />
              </button>
            </div>
          ))
        )}
      </Section>

      <Section title="Developer mode">
        <div className="flex items-center justify-between gap-3 rounded-2xl bg-[#0A0908] border border-white/[0.05] px-3.5 py-3.5">
          <div className="min-w-0">
            <p className="text-sm font-bold text-white">Developer mode</p>
            <p className="text-[11px] text-white/40">Advanced tooling and demo helpers</p>
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

      {patDrawerOpen && (
        <CreatePatDrawer
          open={patDrawerOpen}
          onClose={() => setPatDrawerOpen(false)}
          onCreated={() => void refreshPats()}
        />
      )}
      {oauthDrawerOpen && (
        <CreateOAuthAppDrawer
          open={oauthDrawerOpen}
          onClose={() => setOauthDrawerOpen(false)}
          onCreated={() => void refreshApps()}
        />
      )}
    </div>
  );
}
