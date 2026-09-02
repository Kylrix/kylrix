'use client';

import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  Download,
  GitFork,
  Layers,
  Plus,
  Trash2,
  Workflow,
  X,
} from 'lucide-react';
import { useLocalContext } from '@/lib/context-engine';
import {
  listWorkflowsAction,
  listDiscoverFlowsAction,
  deleteWorkflowAction,
} from '@/lib/actions/workflows';
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
  listInstalledFlowIds,
  uninstallFlowLocal,
} from '@/lib/flows/installed';
import { installFlow } from '@/lib/actions/client-ops';
import toast from 'react-hot-toast';
import { autonomicSyncEngine } from '@/lib/services/sync-engine';
import {
  FlowInstallConfirmDrawer,
  isFlowConfirmPromptEnabled,
} from '@/components/flows/FlowInstallConfirmDrawer';

export interface FlowsDrawerProps {
  onClose?: () => void;
  initialTab?: 'discover' | 'installed';
}

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

export function FlowsDrawer({ onClose, initialTab = 'discover' }: FlowsDrawerProps) {
  const native = useNativeSidebarApiOptional();
  const { openOverlay, closeOverlay } = useOverlay();
  const [confirmFlow, setConfirmFlow] = useState<DiscoverFlow | null>(null);
  const [showCreate, setShowCreate] = useState(false);
  const [promptFlow, setPromptFlow] = useState<DiscoverFlow | null>(null);

  const {
    savedWorkflows,
    updateWorkflow,
    clearSavedWorkflows,
  } = useLocalContext();

  const [tab, setTab] = useState<Tab>(initialTab);
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
      }, 3000);
    };
    window.addEventListener('kylrix:flows-updated', handleFlowsUpdated);
    return () => {
      window.removeEventListener('kylrix:flows-changed', handleFlowsChanged);
      window.removeEventListener('kylrix:flows-updated', handleFlowsUpdated);
    };
  }, []);

  useEffect(() => {
    const update = () => setIsDesktop(window.innerWidth >= 900);
    update();
    window.addEventListener('resize', update);
    return () => window.removeEventListener('resize', update);
  }, []);

  // Handle ESC key to close
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && onClose && !confirmFlow && !showCreate && !promptFlow) {
        onClose();
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose, confirmFlow, showCreate, promptFlow]);

  const loadCommunity = useCallback(async () => {
    try {
      const res = await listDiscoverFlowsAction();
      setCommunity(res?.data || []);
    } catch {
      try {
        const res = await listWorkflowsAction();
        setCommunity(res?.data || []);
      } catch {}
    }
  }, []);

  useEffect(() => {
    loadCommunity();
  }, [loadCommunity]);

  const builtins: DiscoverFlow[] = useMemo(() => BUILTIN_FLOWS, []);

  const communityFlows: DiscoverFlow[] = useMemo(
    () =>
      community.map((wf) => ({
        id: wf.$id || wf.id,
        name: wf.name || wf.title || 'Untitled flow',
        description: wf.description || '',
        publisher: communityPublisher(wf),
        steps: Array.isArray(wf.steps) ? wf.steps : [],
        source: 'community' as const,
        niche: (wf.niche || 'workspace') as any,
        isPublic: wf.isPublic ?? true,
        isAnonymized: wf.isAnonymized ?? false,
        createdAt: wf.$createdAt || wf.createdAt || '',
        published: true,
      })),
    [community],
  );

  const allFlows: DiscoverFlow[] = useMemo(
    () => [...builtins, ...communityFlows],
    [builtins, communityFlows],
  );

  const installedList: DiscoverFlow[] = useMemo(
    () =>
      allFlows.filter(
        (f) =>
          installedIds.includes(f.id) ||
          f.source === 'yours' ||
          !!(f as any).preInstalled,
      ),
    [allFlows, installedIds],
  );

  const discoverList: DiscoverFlow[] = useMemo(
    () => allFlows.filter((f) => f.source !== 'yours'),
    [allFlows],
  );

  const list = tab === 'discover' ? discoverList : installedList;

  const performInstall = useCallback((flow: DiscoverFlow) => {
    installFlowLocal(flow.id);
    setInstalledIds((prev) => (prev.includes(flow.id) ? prev : [...prev, flow.id]));
    toast.success(`Installed "${flow.name}"`);
    installFlow({ flowId: flow.id }).catch(() => {});
  }, []);

  const openInstallConfirmation = useCallback(
    (flow: DiscoverFlow) => {
      if (!isFlowConfirmPromptEnabled()) {
        performInstall(flow);
        return;
      }
      setConfirmFlow(flow);
    },
    [performInstall],
  );

  const handleUninstall = useCallback((flow: DiscoverFlow) => {
    uninstallFlowLocal(flow.id);
    setInstalledIds((prev) => prev.filter((id) => id !== flow.id));
    toast.success(`Uninstalled "${flow.name}"`);
  }, []);

  const openDetail = useCallback(
    (flow: DiscoverFlow, isOwner: boolean) => {
      const isInstalled =
        installedIds.includes(flow.id) ||
        isOwner ||
        !!(flow as any).preInstalled;

      const node = (
        <FlowDetailDrawer
          flow={flow}
          isInstalled={isInstalled}
          isOwner={isOwner}
          onClose={() => {
            if (isDesktop && native) native.close('flow-detail');
            else closeOverlay();
          }}
          onInstall={() => {
            openInstallConfirmation(flow);
            if (isDesktop && native) native.close('flow-detail');
            else closeOverlay();
          }}
          onUninstall={() => {
            handleUninstall(flow);
            if (isDesktop && native) native.close('flow-detail');
            else closeOverlay();
          }}
          onOpenPrompt={() => {
            if (isDesktop && native) native.close('flow-detail');
            else closeOverlay();
            setPromptFlow(flow);
          }}
          onDeleteYours={
            isOwner
              ? async () => {
                  try {
                    await deleteWorkflowAction(flow.id);
                    uninstallFlowLocal(flow.id);
                    setInstalledIds((prev) => prev.filter((id) => id !== flow.id));
                    toast.success('Deleted flow');
                    loadCommunity();
                    if (isDesktop && native) native.close('flow-detail');
                    else closeOverlay();
                  } catch {
                    toast.error('Failed to delete');
                  }
                }
              : undefined
          }
        />
      );

      if (isDesktop && native) {
        native.open(node, {
          key: 'flow-detail',
          width: NATIVE_SIDEBAR_WIDTHS.default,
          title: flow.name,
        });
      } else {
        openOverlay(node);
      }
    },
    [
      installedIds,
      isDesktop,
      native,
      closeOverlay,
      openOverlay,
      openInstallConfirmation,
      handleUninstall,
      loadCommunity,
    ],
  );

  const drafts = useMemo(
    () => Object.values(savedWorkflows || {}),
    [savedWorkflows],
  );

  const handleDeleteDraft = async (id: string) => {
    const next = { ...savedWorkflows };
    delete next[id];
    clearSavedWorkflows();
    Object.values(next).forEach((w) => updateWorkflow(w.id, w));
    toast.success('Draft removed');
  };

  const handleResumeDraft = (_draft: any) => {
    setShowCreate(true);
  };

  return (
    <div className="fixed inset-0 z-50 flex flex-col w-full h-[100dvh] max-h-[100dvh] bg-[#000000] text-white overflow-hidden select-none animate-in fade-in duration-200">
      {/* Top Header Chrome */}
      <header className="flex items-center justify-between px-4 sm:px-6 py-3.5 border-b border-white/[0.08] bg-[#0A0908] shrink-0">
        <div className="flex items-center gap-2.5">
          <div className="w-8 h-8 rounded-xl bg-[#A855F7]/15 border border-[#A855F7]/30 flex items-center justify-center text-[#A855F7]">
            <GitFork size={16} />
          </div>
          <div>
            <h2 className="text-base font-black font-clash text-white tracking-tight m-0">
              Flows Hub
            </h2>
            <p className="text-[11px] font-mono text-white/40 m-0">
              Automations & executable pipelines
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => setShowCreate(true)}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-extrabold bg-[#A855F7] text-white hover:bg-[#9333ea] active:scale-95 transition-all shadow-[0_2px_10px_rgba(168,85,247,0.25)] cursor-pointer"
          >
            <Plus size={15} strokeWidth={2.5} />
            <span>Create Flow</span>
          </button>

          {onClose && (
            <button
              type="button"
              onClick={onClose}
              className="p-2 rounded-xl bg-[#161412] border border-white/[0.08] text-white/70 hover:text-white hover:bg-white/5 transition-colors cursor-pointer ml-1"
              title="Close Flows"
              aria-label="Close Flows"
            >
              <X size={18} />
            </button>
          )}
        </div>
      </header>

      {/* Main Flows Content Stream */}
      <main className="flex-1 overflow-y-auto px-4 sm:px-8 py-6 min-h-0 select-text max-w-[1440px] w-full mx-auto space-y-6">
        {/* Navigation Tab Bar */}
        <div className="flex items-center justify-between gap-3 flex-wrap">
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
        </div>

        {/* Saved Drafts */}
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
                    <p className="text-sm font-bold text-white truncate">{d.name || (d as any).title || 'Untitled'}</p>
                    <p className="text-[11px] text-white/35 truncate">{d.niche} · {d.steps.length} steps{(d as any).ready ? ' · ready' : ''}</p>
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

        {/* Flows Grid */}
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
                      installed ? (
                        <span className="shrink-0 text-[10px] font-extrabold uppercase tracking-wider px-2.5 py-1 rounded-lg bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
                          {pre ? 'Default' : 'Installed'}
                        </span>
                      ) : (
                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            openInstallConfirmation(flow);
                          }}
                          className="shrink-0 flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-[#A855F7] text-white text-xs font-extrabold hover:bg-[#9333ea] transition-all cursor-pointer"
                        >
                          <Download size={13} strokeWidth={2.5} />
                          <span>Install</span>
                        </button>
                      )
                    }
                  />
                );
              })}
            </div>
          )}
        </section>
      </main>

      {/* Sub-Drawers */}
      {confirmFlow && (
        <FlowInstallConfirmDrawer
          flow={confirmFlow}
          onConfirm={() => {
            performInstall(confirmFlow);
            setConfirmFlow(null);
          }}
          onClose={() => setConfirmFlow(null)}
        />
      )}

      {showCreate && (
        <CreateFlowDrawer
          onClose={() => setShowCreate(false)}
          onCreated={(_wf) => {
            setShowCreate(false);
            loadCommunity();
          }}
        />
      )}

      {promptFlow && (
        <PromptDrawer
          flow={promptFlow}
          onClose={() => setPromptFlow(null)}
        />
      )}
    </div>
  );
}
