'use client';

import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  Download,
  Layers,
  Plus,
  Square,
  Trash2,
  Workflow,
} from 'lucide-react';
import { useLocalContext } from '@/lib/context-engine';
import { WorkflowChain } from '@/lib/workflow-engine';
import {
  saveWorkflowAction,
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

type Tab = 'discover' | 'installed';

function communityPublisher(wf: WorkflowChain & { metadata?: unknown }): FlowPublisher {
  const meta = wf.metadata;
  let handle = '@user';
  let verified: FlowPublisher['verified'] = null;
  try {
    const parsed = typeof meta === 'string' ? JSON.parse(meta) : meta;
    if (parsed?.publisherHandle) handle = String(parsed.publisherHandle);
    if (parsed?.verified === 'ecosystem' || parsed?.verified === true) verified = 'ecosystem';
    if (parsed?.verified === 'kylrix') verified = 'kylrix';
  } catch {
    /* ignore */
  }
  return { handle, verified };
}

function FlowRow({
  flow,
  trailing,
  onOpen,
}: {
  flow: DiscoverFlow;
  trailing?: React.ReactNode;
  onOpen: () => void;
}) {
  return (
    <div className="rounded-2xl bg-[#0A0908] border border-white/[0.05] overflow-hidden">
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
            <p className="text-sm font-bold text-white truncate">{flow.name}</p>
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

  // Signal the bottom navbar to hide when the confirm drawer is open
  useEffect(() => {
    setIsDrawerOpen(!!confirmFlow);
    return () => setIsDrawerOpen(false);
  }, [confirmFlow, setIsDrawerOpen]);
  const {
    isRecording,
    startRecording,
    stopRecording,
    savedWorkflows,
    updateWorkflow,
    clearSavedWorkflows,
  } = useLocalContext();

  const [tab, setTab] = useState<Tab>('discover');
  const [installedIds, setInstalledIds] = useState<string[]>([]);
  const [community, setCommunity] = useState<WorkflowChain[]>([]);
  const [isDesktop, setIsDesktop] = useState(false);

  useEffect(() => {
    setInstalledIds(listInstalledFlowIds());
    autonomicSyncEngine.requestObjectFreshness('flows', undefined, (synced) => {
      setInstalledIds(synced);
    });

    const handleFlowsChanged = () => {
      setInstalledIds(listInstalledFlowIds());
    };
    window.addEventListener('kylrix:flows-changed', handleFlowsChanged);

    const check = () => setIsDesktop(window.innerWidth >= 1024);
    check();
    window.addEventListener('resize', check);
    return () => {
      window.removeEventListener('kylrix:flows-changed', handleFlowsChanged);
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

  const handleRecordToggle = useCallback(() => {
    if (isRecording) {
      const wf = stopRecording('New flow', 'Recorded steps', 'workspace');
      if (wf) {
        void saveWorkflowAction(wf);
        setInstalledIds(installFlowLocal(wf.id));
        setTab('installed');
      }
      return;
    }
    startRecording();
  }, [isRecording, startRecording, stopRecording]);

  useEffect(() => {
    setConfiguration({
      isVisible: true,
      mainColor: isRecording ? '#EF4444' : '#A855F7',
      mainIcon: isRecording ? (
        <Square size={28} strokeWidth={3} fill="currentColor" />
      ) : (
        <Plus size={32} strokeWidth={3} />
      ),
      onMainClick: handleRecordToggle,
      suppressWorkflow: true,
      actions: [],
    });
    return () => resetConfiguration();
  }, [setConfiguration, resetConfiguration, isRecording, handleRecordToggle]);

  const yours = useMemo(() => Object.values(savedWorkflows), [savedWorkflows]);

  const discoverList: DiscoverFlow[] = useMemo(() => {
    const builtins = BUILTIN_FLOWS.map((f) => ({
      ...f,
      installed: installedIds.includes(f.id) || isFlowInstalled(f.id),
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
      });
    });

    installedIds.forEach((id) => {
      if (byId.has(id)) return;
      const builtin = BUILTIN_FLOWS.find((b) => b.id === id);
      if (builtin) {
        byId.set(id, { ...builtin, installed: true });
        return;
      }
      const pub = community.find((c) => c.id === id);
      if (pub) {
        byId.set(id, {
          ...pub,
          publisher: communityPublisher(pub),
          source: 'community',
          installed: true,
        });
        return;
      }

      // Installed remote flow not yet in discover list
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
      });
    });

    return Array.from(byId.values());
  }, [yours, installedIds, community]);

  const closeDetail = useCallback(() => {
    native?.close(`flow-detail`);
    closeOverlay();
  }, [native, closeOverlay]);

  const triggerInstallWithConfirmation = useCallback((flow: DiscoverFlow) => {
    if (!isFlowConfirmPromptEnabled()) {
      void handleInstall(flow.id);
      return;
    }
    setConfirmFlow(flow);
  }, []);

  const openDetail = useCallback(
    (flow: DiscoverFlow, isOwner: boolean) => {
      const isInst = installedIds.includes(flow.id) || isOwner;
      const panel = (
        <FlowDetailDrawer
          flow={flow}
          publisher={flow.publisher}
          isOwner={isOwner}
          isInstalled={isInst}
          onClose={closeDetail}
          onInstall={() => triggerInstallWithConfirmation(flow)}
          onUninstall={() => void handleUninstall(flow)}
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
    [isDesktop, native, openOverlay, closeDetail, updateWorkflow, installedIds, triggerInstallWithConfirmation]
  );

  const handleInstall = async (id: string) => {
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
  };

  const handleUninstall = async (flow: DiscoverFlow) => {
    if (flow.source === 'yours') {
      await deleteWorkflowAction(flow.id);
      const nextSaved = { ...savedWorkflows };
      delete nextSaved[flow.id];
      clearSavedWorkflows();
      Object.values(nextSaved).forEach((wf) => updateWorkflow(wf.id, wf));
    }
    setInstalledIds(uninstallFlowLocal(flow.id));
    toast.success('Removed');
  };

  const handleShareCopy = async (id: string) => {
    const url = buildPublicResourceUrl('flow', id);
    try {
      await navigator.clipboard.writeText(url);
      toast.success('Link copied');
    } catch {
      toast.success(url);
    }
  };

  const list = tab === 'discover' ? discoverList : installedList;

  return (
    <>
    <div className="flex-1 min-h-screen pointer-events-auto font-satoshi text-white">
      <div className="w-full max-w-[880px] mx-auto p-4 md:p-8 space-y-5">
        <div className="flex items-end justify-between gap-4">
          <h1 className="font-clash text-2xl md:text-3xl font-semibold tracking-tight text-white">
            Flows
          </h1>
          <button
            type="button"
            onClick={handleRecordToggle}
            className={`inline-flex items-center gap-2 px-4 py-2.5 rounded-xl text-xs font-extrabold cursor-pointer transition-colors ${
              isRecording
                ? 'bg-red-500 text-white hover:bg-red-600'
                : 'bg-[#A855F7] text-white hover:bg-[#9333EA]'
            }`}
          >
            {isRecording ? (
              <>
                <Square size={14} fill="currentColor" />
                Stop
              </>
            ) : (
              <>
                <Plus size={14} strokeWidth={3} />
                New
              </>
            )}
          </button>
        </div>

        {isRecording && (
          <div className="rounded-xl bg-[#161412] border border-red-500/25 px-4 py-3 flex items-center gap-3">
            <span className="relative flex h-2.5 w-2.5">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-red-400 opacity-60" />
              <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-red-500" />
            </span>
            <p className="text-xs font-bold text-white/70">Recording</p>
          </div>
        )}

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

        <section className="rounded-[22px] bg-[#161412] border border-white/[0.06] p-5 space-y-2.5">
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
            list.map((flow) => {
              const isOwner = flow.source === 'yours';
              const installed = installedIds.includes(flow.id) || isOwner;
              return (
                <FlowRow
                  key={flow.id}
                  flow={flow}
                  onOpen={() => openDetail(flow, isOwner)}
                  trailing={
                    <div className="flex items-center gap-1.5 shrink-0">
                      {tab === 'discover' && !installed && (
                        <button
                          type="button"
                          title="Install"
                          onClick={() => triggerInstallWithConfirmation(flow)}
                          className="p-2 rounded-lg bg-[#161412] border border-white/[0.06] text-[#A855F7] hover:bg-[#1C1A18] cursor-pointer"
                        >
                          <Download size={14} />
                        </button>
                      )}
                      {tab === 'installed' && (
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
                    </div>
                  }
                />
              );
            })
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
