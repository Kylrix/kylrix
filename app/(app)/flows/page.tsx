'use client';

import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  Download,
  Layers,
  Plus,
  Trash2,
  Workflow,
} from 'lucide-react';
import { useLocalContext } from '@/lib/context-engine';
import {
  listWorkflowsAction,
  listDiscoverFlowsAction,
  deleteWorkflowAction,
} from '@/lib/actions/workflows';
import { useFAB } from '@/context/FABContext';
import {
  useNativeSidebarApiOptional,
  NATIVE_SIDEBAR_WIDTHS,
} from '@/context/RightRailContext';
import { useOverlay } from '@/components/ui/OverlayContext';
import { FlowDetailDrawer, VerifiedMark } from '@/components/flows/FlowDetailDrawer';
import { PromptDrawer } from '@/components/flows/PromptDrawer';
import { CreateFlowDrawer } from '@/components/flows/CreateFlowDrawer';
import { BUILTIN_FLOWS } from '@/lib/flows/builtins';
import type { DiscoverFlow, FlowPublisher } from '@/lib/flows/types';
import {
  installFlowLocal,
  isFlowInstalled,
  listInstalledFlowIds,
  uninstallFlowLocal,
} from '@/lib/flows/installed';
import { installFlow } from '@/lib/actions/client-ops';
import { buildPublicResourceUrl } from '@/lib/share/public-url';
import toast from 'react-hot-toast';
import { autonomicSyncEngine } from '@/lib/services/sync-engine';
import { useDrawerState } from '@/components/ui/DrawerStateContext';
import {
  FlowInstallConfirmDrawer,
  isFlowConfirmPromptEnabled,
} from '@/components/flows/FlowInstallConfirmDrawer';
import { HangoutTabTrigger } from '@/components/hangout/HangoutTabTrigger';



type Tab = 'discover' | 'installed';

function communityPublisher(wf: any): FlowPublisher {
  const meta = wf.metadata;
  let handle = '@user';
  let verified: FlowPublisher['verified'] = null;
  try {
    const parsed = typeof meta === 'string' ? JSON.parse(meta) : meta;
    if (parsed?.publisherHandle) handle = String(parsed.publisherHandle);
    if (parsed?.verified === 'ecosystem' || parsed?.verified === true) verified = 'ecosystem';
    if (parsed?.verified === 'kylrix') verified = 'kylrix';
  } catch {}
  return { handle, verified };
}

function FlowRow({
  flow,
  trailing,
  onOpen,
  recentlyUpdated,
}: {
  flow: DiscoverFlow;
  trailing?: React.ReactNode;
  onOpen: () => void;
  recentlyUpdated?: boolean;
}) {
  return (
    <div className="rounded-2xl bg-[#0A0908] border border-white/[0.05] overflow-hidden h-full">
      <div className="flex items-center gap-3 p-3.5">
        <button
          type="button"
          onClick={onOpen}
          className="flex items-center gap-3 min-w-0 flex-1 text-left cursor-pointer"
        >
          <div className="p-2 rounded-xl bg-[#161412] border border-white/[0.06] text-[#A855F7] shrink-0">
            <Layers size={16} />
          </div>
          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-2 min-w-0">
              <p className="text-sm font-bold text-white truncate">{flow.name}</p>
              {recentlyUpdated && (
                <span className="shrink-0 text-[9px] font-black uppercase tracking-wider px-1.5 py-0.5 rounded-full bg-emerald-500/15 text-emerald-400 border border-emerald-500/25 animate-pulse">
                  Updated
                </span>
              )}
            </div>
            <div className="flex items-center gap-1.5 mt-0.5 min-w-0">
              <span className="text-[11px] font-bold text-white/40 truncate">
                {flow.publisher.handle}
              </span>
              <VerifiedMark kind={flow.publisher.verified} />
              <span className="text-[11px] text-white/25 truncate">
                · {flow.steps.length} steps
              </span>
            </div>
          </div>
        </button>
        {trailing}
      </div>
    </div>
  );
}

export default function FlowsPage() {
  const { setConfiguration, resetConfiguration } = useFAB();
  const native = useNativeSidebarApiOptional();
  const { openOverlay, closeOverlay } = useOverlay();
  const { setIsDrawerOpen } = useDrawerState();
  const [confirmFlow, setConfirmFlow] = useState<DiscoverFlow | null>(null);
  const [showCreate, setShowCreate] = useState(false);
  const [promptFlow, setPromptFlow] = useState<DiscoverFlow | null>(null);

  useEffect(() => {
    setIsDrawerOpen(!!confirmFlow || !!showCreate || !!promptFlow);
    return () => setIsDrawerOpen(false);
  }, [confirmFlow, showCreate, promptFlow, setIsDrawerOpen]);

  const {
    savedWorkflows,
    updateWorkflow,
    clearSavedWorkflows,
  } = useLocalContext();

  const [tab, setTab] = useState<Tab>('discover');
  const [installedIds, setInstalledIds] = useState<string[]>([]);
  const [recentlyUpdatedIds, setRecentlyUpdatedIds] = useState<Set<string>>(new Set());
  const [community, setCommunity] = useState<any[]>([]);
  const [isDesktop, setIsDesktop] = useState(false);

  useEffect(() => {
    setInstalledIds(listInstalledFlowIds());
    autonomicSyncEngine.requestObjectFreshness('flows', undefined, (synced) => {
      setInstalledIds(synced);
    });
    const handleFlowsChanged = () => setInstalledIds(listInstalledFlowIds());
    window.addEventListener('kylrix:flows-changed', handleFlowsChanged);
    const handleFlowsUpdated = (e: Event) => {
      const ids = Object.keys((e as CustomEvent).detail?.updates ?? {});
      if (!ids.length) return;
      setRecentlyUpdatedIds((prev) => new Set([...prev, ...ids]));
      setTimeout(() => {
        setRecentlyUpdatedIds((prev) => {
          const next = new Set(prev);
          ids.forEach((id) => next.delete(id));
          return next;
        });
      }, 8000);
    };
    window.addEventListener('kylrix:flows-updated', handleFlowsUpdated);
    const check = () => setIsDesktop(window.innerWidth >= 1024);
    check();
    window.addEventListener('resize', check);
    return () => {
      window.removeEventListener('kylrix:flows-changed', handleFlowsChanged);
      window.removeEventListener('kylrix:flows-updated', handleFlowsUpdated);
      window.removeEventListener('resize', check);
    };
  }, []);

  useEffect(() => {
    const syncDb = async () => {
      const [mine, disco] = await Promise.all([
        listWorkflowsAction(),
        listDiscoverFlowsAction(),
      ]);
      if (mine.success && mine.data) {
        mine.data.forEach((wf) => updateWorkflow(wf.id, wf));
      }
      if (disco.success && disco.data) {
        setCommunity(disco.data);
      }
    };
    void syncDb();
  }, [updateWorkflow]);

  const openCreateDrawer = useCallback(() => {
    const panel = <CreateFlowDrawer onClose={() => { native?.close('flow-create'); closeOverlay(); setShowCreate(false); }} onCreated={(wf)=>{ updateWorkflow(wf.id, wf as any); setInstalledIds(installFlowLocal(wf.id)); setTab('installed'); }} />;
    if (isDesktop && native) {
      native.open(panel, { key:'flow-create', width: NATIVE_SIDEBAR_WIDTHS.detail, title: 'Create Flow' });
    } else {
      openOverlay(panel);
    }
    setShowCreate(true);
  }, [isDesktop, native, openOverlay, closeOverlay, updateWorkflow]);

  useEffect(() => {
    if (isDesktop) {
      resetConfiguration();
      return;
    }
    setConfiguration({
      isVisible: true,
      mainColor: '#A855F7',
      mainIcon: <Plus size={32} strokeWidth={3} />,
      onMainClick: openCreateDrawer,
      suppressWorkflow: true,
      actions: [],
    });
    return () => resetConfiguration();
  }, [setConfiguration, resetConfiguration, openCreateDrawer, isDesktop]);

  const yours = useMemo(() => Object.values(savedWorkflows), [savedWorkflows]);

  const PREINSTALLED_IDS = ['kylrix-sidekick', 'kylrix-custom-agent'] as const;
  // legacy alias still treated as pre-installed
  const _preInstalledCheck = (id: string) => (PREINSTALLED_IDS as readonly string[]).includes(id) || id === 'kylrix-custom-prompt';

  const discoverList: DiscoverFlow[] = useMemo(() => {
    const builtins = BUILTIN_FLOWS.map((f: any) => ({
      ...f,
      installed: f.preInstalled ? true : (installedIds.includes(f.id) || isFlowInstalled(f.id)),
      preInstalled: !!f.preInstalled,
    }));
    const seen = new Set(builtins.map((b) => b.id));
    const fromCommunity: DiscoverFlow[] = community
      .filter((wf) => wf.isPublic && !seen.has(wf.id) && !BUILTIN_FLOWS.some((b) => b.id === wf.id))
      .map((wf) => ({
        ...wf,
        publisher: communityPublisher(wf),
        source: 'community' as const,
        installed: installedIds.includes(wf.id),
      }));
    return [...builtins, ...fromCommunity];
  }, [community, installedIds]);

  const installedList: DiscoverFlow[] = useMemo(() => {
    const byId = new Map<string, DiscoverFlow>();
    yours.forEach((wf) => {
      byId.set(wf.id, {
        ...wf,
        publisher: { handle: '@you', verified: null },
        source: 'yours',
        installed: true,
      } as any);
    });
    installedIds.forEach((id) => {
      if (byId.has(id)) return;
      const builtin = BUILTIN_FLOWS.find((b) => b.id === id);
      if (builtin) {
        byId.set(id, { ...builtin, installed: true } as any);
        return;
      }
      const pub = community.find((c) => c.id === id);
      if (pub) {
        byId.set(id, {
          ...pub,
          publisher: communityPublisher(pub),
          source: 'community',
          installed: true,
        } as any);
        return;
      }
      byId.set(id, {
        id,
        name: id,
        description: 'Installed Flow',
        niche: 'workspace',
        steps: [],
        isPublic: true,
        isAnonymized: true,
        createdAt: new Date().toISOString(),
        publisher: { handle: '@community', verified: 'ecosystem' },
        source: 'community',
        installed: true,
      } as any);
    });
    BUILTIN_FLOWS.forEach((b: any) => {
      if (b.preInstalled && !byId.has(b.id)) {
        byId.set(b.id, { ...b, installed: true, preInstalled: true } as any);
      }
    });
    return Array.from(byId.values());
  }, [yours, installedIds, community]);

  const closeDetail = useCallback(() => {
    native?.close(`flow-detail`);
    native?.close(`flow-prompt`);
    closeOverlay();
    setPromptFlow(null);
  }, [native, closeOverlay]);

  const handleInstall = useCallback(async (id: string) => {
    try {
      const res = await installFlow({ flowId: id, scope: { type: 'user' } });
      if (!res?.success) {
        toast.error('Install failed');
        return;
      }
      setInstalledIds(installFlowLocal(id));
      if (id === 'kylrix-math-mode') {
        toast.success('Math Mode on — try $E=mc^2$, ```solve, ```chart, or ```graph in a note');
      } else {
        toast.success(res.created ? 'Installed' : 'Already installed');
      }
    } catch (err: any) {
      toast.error(err?.message || 'Install failed');
    }
  }, []);

  const handleUninstall = useCallback(async (flow: DiscoverFlow) => {
    if ((flow as any).preInstalled) {
      toast('Pre-installed — cannot remove');
      return;
    }
    if (flow.source === 'yours') {
      await deleteWorkflowAction(flow.id);
      const nextSaved = { ...savedWorkflows };
      delete nextSaved[flow.id];
      clearSavedWorkflows();
      Object.values(nextSaved).forEach((wf) => updateWorkflow(wf.id, wf));
    }
    setInstalledIds(uninstallFlowLocal(flow.id));
    toast.success('Removed');
  }, [savedWorkflows, updateWorkflow, clearSavedWorkflows]);

  const triggerInstallWithConfirmation = useCallback((flow: DiscoverFlow) => {
    if ((flow as any).preInstalled) return;
    if (!isFlowConfirmPromptEnabled()) {
      void handleInstall(flow.id);
      return;
    }
    setConfirmFlow(flow);
  }, [handleInstall]);

  const openPrompt = useCallback((flow: DiscoverFlow) => {
    const panel = <PromptDrawer flow={flow} onClose={closeDetail} />;
    if (isDesktop && native) {
      native.open(panel, { key:'flow-prompt', width: NATIVE_SIDEBAR_WIDTHS.detail, title: flow.name });
    } else {
      openOverlay(panel);
    }
    setPromptFlow(flow);
  }, [isDesktop, native, openOverlay, closeDetail]);

  const openDetail = useCallback(
    (flow: DiscoverFlow, isOwner: boolean) => {
      // Custom Agent flows open the prompt drawer directly
      if (flow.id === 'kylrix-custom-agent' || flow.id === 'kylrix-sidekick') {
        // Still open detail but with prompt tab? Spec: directly open prompt system for custom agent
        // For sidekick also show prompt drawer (prompt template), but keep detail for sidekick? We'll route custom-agent to PromptDrawer, sidekick to detail+prompt reachable.
        if (flow.id === 'kylrix-custom-agent') {
          openPrompt(flow);
          return;
        }
      }
      const isInst = installedIds.includes(flow.id) || isOwner || !!(flow as any).preInstalled;
      const panel = (
        <FlowDetailDrawer
          flow={flow}
          publisher={flow.publisher}
          isOwner={isOwner}
          isInstalled={isInst}
          onClose={closeDetail}
          onInstall={() => triggerInstallWithConfirmation(flow)}
          onUninstall={() => void handleUninstall(flow)}
          onOpenPrompt={() => openPrompt(flow)}
          onChanged={(next) => {
            updateWorkflow(next.id, next);
            if (next.isPublic) {
              setCommunity((prev) => {
                const rest = prev.filter((p) => p.id !== next.id);
                return [next, ...rest];
              });
            } else {
              setCommunity((prev) => prev.filter((p) => p.id !== next.id));
            }
          }}
        />
      );
      if (isDesktop && native) {
        native.open(panel, {
          key: 'flow-detail',
          width: NATIVE_SIDEBAR_WIDTHS.detail,
          title: flow.name,
        });
      } else {
        openOverlay(panel);
      }
    },
    [isDesktop, native, openOverlay, closeDetail, updateWorkflow, installedIds, triggerInstallWithConfirmation, handleUninstall, openPrompt]
  );

  const handleShareCopy = async (id: string) => {
    const url = buildPublicResourceUrl('flow', id);
    try {
      await navigator.clipboard.writeText(url);
      toast.success('Link copied');
    } catch {
      toast.success(url);
    }
  };

  const [drafts, setDrafts] = useState<import('@/lib/services/flow-drafts').FlowDraft[]>([]);

  const refreshDrafts = useCallback(async () => {
    try {
      const { FlowDraftsService } = await import('@/lib/services/flow-drafts');
      const list = await FlowDraftsService.listDrafts();
      setDrafts(list);
    } catch {}
  }, []);

  useEffect(() => {
    void refreshDrafts();
    const iv = setInterval(() => { void refreshDrafts(); }, 1500);
    const onVis = () => { if (document.visibilityState === 'visible') void refreshDrafts(); };
    document.addEventListener('visibilitychange', onVis);
    window.addEventListener('focus', onVis);
    return () => { clearInterval(iv); document.removeEventListener('visibilitychange', onVis); window.removeEventListener('focus', onVis); };
  }, [refreshDrafts]);

  const handleResumeDraft = useCallback(async (draft: import('@/lib/services/flow-drafts').FlowDraft) => {
    const panel = <CreateFlowDrawer draftId={draft.id} initialDraft={draft} onClose={() => { native?.close('flow-create'); closeOverlay(); setShowCreate(false); void refreshDrafts(); }} onCreated={(wf)=>{ updateWorkflow(wf.id, wf as any); setInstalledIds(installFlowLocal(wf.id)); setTab('installed'); void refreshDrafts(); }} />;
    if (isDesktop && native) native.open(panel, { key:'flow-create', width: NATIVE_SIDEBAR_WIDTHS.detail, title: draft.title || 'Draft' });
    else openOverlay(panel);
    setShowCreate(true);
  }, [isDesktop, native, openOverlay, closeOverlay, updateWorkflow, refreshDrafts]);

  const handleDeleteDraft = useCallback(async (id: string) => {
    const { FlowDraftsService } = await import('@/lib/services/flow-drafts');
    await FlowDraftsService.clearDraft(id);
    void refreshDrafts();
    toast.success('Draft removed');
  }, [refreshDrafts]);

  // Render flows page

  const list = tab === 'discover' ? discoverList : installedList;

  return (
    <>
    <div className="flex-1 min-h-screen pointer-events-auto font-satoshi text-white">
      <div className="w-full max-w-[880px] lg:max-w-[1100px] xl:max-w-[1200px] mx-auto p-4 md:p-6 lg:p-8 space-y-5">
        <div className="flex items-end justify-between gap-4">
          <h1 className="font-clash text-2xl md:text-3xl font-semibold tracking-tight text-white">
            Flows
          </h1>
          <button
            type="button"
            onClick={openCreateDrawer}
            className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl text-xs font-extrabold cursor-pointer transition-colors bg-[#A855F7] text-white hover:bg-[#9333EA]"
          >
            <Plus size={14} strokeWidth={3} />
            New
          </button>
        </div>

        <div className="flex items-center justify-between gap-4 w-full">
          <div className="flex items-center gap-1.5 p-1 rounded-2xl bg-[#161412] border border-white/[0.06] w-fit">
            {(
              [
                { id: 'discover', label: 'Discover', count: discoverList.length },
                { id: 'installed', label: 'Installed', count: installedList.length },
              ] as const
            ).map((f) => {
              const active = tab === f.id;
              return (
                <button
                  key={f.id}
                  type="button"
                  onClick={() => setTab(f.id)}
                  className={`px-4 py-2 rounded-xl text-xs font-extrabold transition-colors cursor-pointer ${
                    active
                      ? 'bg-[#A855F7] text-white'
                      : 'text-white/45 hover:text-white hover:bg-white/[0.04]'
                  }`}
                >
                  {f.label}
                  <span className={`ml-1.5 ${active ? 'text-white/70' : 'text-white/25'}`}>
                    {f.count}
                  </span>
                </button>
              );
            })}
          </div>

          <div className="flex items-center gap-2">
            <HangoutTabTrigger />
          </div>
        </div>

        {drafts.length > 0 && (
          <section className="rounded-[22px] bg-[#161412] border border-white/[0.06] p-5 space-y-3">
            <div className="flex items-center justify-between">
              <h3 className="text-[11px] font-extrabold uppercase tracking-wider text-white/55">Drafts</h3>
              <span className="text-[10px] font-bold text-white/30">{drafts.length}</span>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-3">
              {drafts.map((d) => (
                <div key={d.id} className="rounded-2xl bg-[#0A0908] border border-white/[0.05] p-3.5 flex items-center gap-3">
                  <div className="p-2 rounded-xl bg-[#161412] border border-white/[0.06] text-white/40 shrink-0">
                    <Workflow size={16} />
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-bold text-white truncate">{d.title || 'Untitled'}</p>
                    <p className="text-[11px] text-white/35 truncate">{d.niche} · {d.steps.length} steps{d.ready ? ' · ready' : ''}</p>
                  </div>
                  <div className="flex items-center gap-1.5 shrink-0">
                    <button type="button" onClick={() => void handleResumeDraft(d)} className="px-3 py-1.5 rounded-lg bg-[#A855F7] text-white text-[11px] font-extrabold cursor-pointer">Resume</button>
                    <button type="button" onClick={() => void handleDeleteDraft(d.id)} className="p-2 rounded-lg bg-[#161412] border border-white/[0.06] text-white/40 hover:text-white cursor-pointer"><Trash2 size={14} /></button>
                  </div>
                </div>
              ))}
            </div>
          </section>
        )}

        <section className="rounded-[22px] bg-[#161412] border border-white/[0.06] p-5 space-y-4">
          <h3 className="text-[11px] font-extrabold uppercase tracking-wider text-white/55">
            {tab === 'discover' ? 'Discover' : 'Installed'}
          </h3>

          {list.length === 0 ? (
            <div className="rounded-2xl bg-[#0A0908] border border-white/[0.05] px-4 py-10 text-center space-y-4">
              <div className="mx-auto w-fit p-3 rounded-2xl bg-[#161412] border border-white/[0.06] text-[#A855F7]">
                <Workflow size={22} />
              </div>
              <p className="text-sm font-bold text-white/50">
                {tab === 'discover' ? 'Nothing to discover yet' : 'No flows installed'}
              </p>
              {tab === 'installed' && (
                <button
                  type="button"
                  onClick={() => setTab('discover')}
                  className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl text-xs font-extrabold bg-[#161412] border border-white/[0.08] text-white cursor-pointer"
                >
                  Browse Discover
                </button>
              )}
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-3 items-stretch">
              {list.map((flow) => {
              const isOwner = flow.source === 'yours';
              const installed = installedIds.includes(flow.id) || isOwner || !!(flow as any).preInstalled;
              const pre = !!(flow as any).preInstalled;
              return (
                <FlowRow
                  key={flow.id}
                  flow={flow}
                  onOpen={() => openDetail(flow, isOwner)}
                  recentlyUpdated={recentlyUpdatedIds.has(flow.id)}
                  trailing={
                    <div className="flex items-center gap-1.5 shrink-0">
                      {tab === 'discover' && !installed && !pre && (
                        <button
                          type="button"
                          title="Install"
                          onClick={() => triggerInstallWithConfirmation(flow)}
                          className="p-2 rounded-lg bg-[#161412] border border-white/[0.06] text-[#A855F7] hover:bg-[#1C1A18] cursor-pointer"
                        >
                          <Download size={14} />
                        </button>
                      )}
                      {tab === 'installed' && !pre && (
                        <>
                          <button
                            type="button"
                            title="Share link"
                            onClick={() => void handleShareCopy(flow.id)}
                            className="px-2.5 py-2 rounded-lg bg-[#161412] border border-white/[0.06] text-[10px] font-extrabold uppercase tracking-wider text-white/50 hover:text-white cursor-pointer"
                          >
                            Share
                          </button>
                          <button
                            type="button"
                            title="Remove"
                            onClick={() => void handleUninstall(flow)}
                            className="p-2 rounded-lg bg-[#161412] border border-red-500/20 text-red-400 cursor-pointer"
                          >
                            <Trash2 size={14} />
                          </button>
                        </>
                      )}
                      {pre && tab === 'installed' && (
                        <button
                          type="button"
                          title="Share link"
                          onClick={() => void handleShareCopy(flow.id)}
                          className="px-2.5 py-2 rounded-lg bg-[#161412] border border-white/[0.06] text-[10px] font-extrabold uppercase tracking-wider text-white/40 hover:text-white cursor-pointer"
                        >
                          Share
                        </button>
                      )}
                    </div>
                  }
                />
              );
            })}
            </div>
          )}
        </section>
      </div>
    </div>

    {confirmFlow && (
      <FlowInstallConfirmDrawer
        flow={confirmFlow}
        onConfirm={() => void handleInstall(confirmFlow.id)}
        onClose={() => setConfirmFlow(null)}
      />
    )}
    </>
  );
}
