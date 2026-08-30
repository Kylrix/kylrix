'use client';

import React, { useCallback, useEffect, useState } from 'react';
import { Copy, KeyRound, BookOpen, AppWindow, Plus } from 'lucide-react';
import Link from 'next/link';
import toast from 'react-hot-toast';
import {
  KYLRIX_SKILLS_INSTALL,
  KYLRIX_API_SKILL_INSTALL,
  KYLRIX_OAUTH2_SKILL_INSTALL,
  KYLRIX_AGENTS_SKILL_INSTALL,
} from '@/lib/api/public';
import { listPats, revokePat } from '@/lib/actions/client-ops';
import { account } from '@/lib/appwrite/client';
import { listMyApps, type OauthApp } from '@/lib/oauth2/apps';
import { CreatePatDrawer } from '@/components/settings/CreatePatDrawer';
import { CreateOAuthAppDrawer } from '@/components/settings/CreateOAuthAppDrawer';
import { ManageOAuthAppDrawer } from '@/components/settings/ManageOAuthAppDrawer';
import { useUnifiedDrawer } from '@/context/UnifiedDrawerContext';
import { useSubscription } from '@/context/subscription/SubscriptionContext';
import { useProUpgrade } from '@/context/ProUpgradeContext';

type PatItem = {
  id: string;
  name: string;
  tokenPrefix: string;
  scopes: string[];
  status: string;
  category?: string;
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
  const { open: openDrawer } = useUnifiedDrawer();
  const { currentTier } = useSubscription();
  const { openProUpgrade } = useProUpgrade();
  const isTeams = currentTier === 'TEAMS' || currentTier === 'ORG' || currentTier === 'LIFETIME';

  const [developerMode, setDeveloperMode] = useState(false);
  const [pats, setPats] = useState<PatItem[]>([]);
  const [apps, setApps] = useState<OauthApp[]>([]);
  const [loadingPats, setLoadingPats] = useState(true);
  const [loadingApps, setLoadingApps] = useState(true);
  const [patDrawerOpen, setPatDrawerOpen] = useState(false);
  const [oauthDrawerOpen, setOauthDrawerOpen] = useState(false);
  const [manageAppId, setManageAppId] = useState<string | null>(null);

  const handleOpenOauthSetup = () => {
    if (!isTeams) {
      openProUpgrade('Sign in with Kylrix (OAuth 2.1 Provider)');
      return;
    }
    setOauthDrawerOpen(true);
  };

  const refreshPats = useCallback(async () => {
    setLoadingPats(true);
    try {
      const prefs = await account.getPrefs().catch(() => ({} as any));
      setDeveloperMode(!!(prefs as any)?.developerMode);
      const res = await listPats({ isWorkspace: false });
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
    } catch (err: any) {
      setApps([]);
      if (err?.message) {
        console.error('[Developers OAuth apps]', err);
        toast.error(err.message);
      }
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

  const confirmRevokePat = (pat: PatItem) => {
    openDrawer('delete-confirm', {
      title: `Revoke “${pat.name}”?`,
      description:
        'This personal access token will stop working immediately. Anything using it will lose access.',
      confirmLabel: 'Revoke token',
      resourceName: pat.name,
      onConfirm: async () => {
        await revokePat(pat.id);
        toast.success('Token revoked');
        await refreshPats();
      },
    });
  };

  const activePats = pats.filter((p) => p.status === 'active').length;

  return (
    <div className="space-y-4 pb-24 max-w-3xl font-satoshi">
      <h2 className="text-xl font-black font-clash text-white tracking-tight">Developers</h2>

      <Section title="Agent skills">
        <SkillRow
          title="Kylrix skills bundle (MCP + REST + agents)"
          install={KYLRIX_SKILLS_INSTALL}
          docsHref="/docs/integrations"
          docsLabel="Integrations"
        />
        <SkillRow
          title="HTTP API only"
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
        <SkillRow
          title="Autonomous agents only"
          install={KYLRIX_AGENTS_SKILL_INSTALL}
          docsHref="/docs/agents"
          docsLabel="Agent docs"
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
              className="flex flex-col gap-2.5 rounded-2xl bg-[#0A0908] border border-white/[0.05] p-3.5"
            >
              <div className="flex items-center gap-3 min-w-0">
                <div className="p-2 rounded-xl bg-[#161412] border border-white/[0.06] text-[#6366F1] shrink-0">
                  <KeyRound size={16} />
                </div>
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-bold text-white truncate">{pat.name}</p>
                  <p className="text-[11px] text-white/40 font-mono truncate">
                    {pat.category === 'agent_provisioning_key' ? 'kyl_apk_' : pat.category === 'agentic_pat' ? 'kyl_apat_' : pat.category === 'workspace_pat' ? 'kyl_wpat_' : 'kyl_pat_'}{pat.tokenPrefix}_… · {pat.status}
                    {pat.scopes?.length ? ` · ${pat.scopes.length} perms` : ''}
                  </p>
                </div>
              </div>
              {pat.status === 'active' && (
                <div className="flex flex-wrap gap-2">
                  <button
                    type="button"
                    onClick={() => confirmRevokePat(pat)}
                    className="px-3 py-2 rounded-xl text-[11px] font-extrabold bg-[#161412] border border-red-500/25 text-red-300 cursor-pointer"
                  >
                    Revoke token
                  </button>
                </div>
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
            onClick={handleOpenOauthSetup}
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
              onClick={handleOpenOauthSetup}
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
              className="flex flex-col gap-2.5 rounded-2xl bg-[#0A0908] border border-white/[0.05] p-3.5"
            >
              <div className="flex items-center gap-3 min-w-0">
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
                    {app.$id} · {app.type === 'public' ? 'public (PKCE)' : 'server (secret)'} ·{' '}
                    {(app.redirectUris || []).length} redirect
                    {(app.redirectUris || []).length === 1 ? '' : 's'}
                  </p>
                  {(app.redirectUris || []).length === 0 ? (
                    <p className="text-[11px] text-amber-300/90 mt-0.5">
                      No redirect URLs saved — Manage → add one or authorize will fail
                    </p>
                  ) : null}
                </div>
              </div>
              <div className="flex flex-wrap gap-2">
                <button
                  type="button"
                  onClick={() => setManageAppId(app.$id)}
                  className="px-3 py-2 rounded-xl text-[11px] font-extrabold bg-[#6366F1] text-white cursor-pointer"
                >
                  Manage
                </button>
              </div>
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
      {manageAppId && (
        <ManageOAuthAppDrawer
          open={!!manageAppId}
          appId={manageAppId}
          onClose={() => setManageAppId(null)}
          onChanged={() => void refreshApps()}
        />
      )}
    </div>
  );
}
