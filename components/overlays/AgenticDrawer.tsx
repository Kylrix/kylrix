'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  Bot,
  Play,
  Plug,
  Plus,
  X,
  ChevronRight,
  ArrowLeft,
  Check,
  Power,
  AlertCircle,
  RefreshCw,
  ChevronDown,
  ChevronUp,
  Send,
  Sparkles,
} from 'lucide-react';

import { useAgenticDrawer } from '@/context/AgenticDrawerContext';
import { useAuth } from '@/context/auth/AuthContext';
import { AgenticService } from '@/lib/services/agentic';
import { runMyAgent, executeInstantRequestAction } from '@/lib/actions/agentic';
import { useProUpgrade } from '@/context/ProUpgradeContext';
import { hasPaidKylrixPlan } from '@/lib/utils';
import { account } from '@/lib/appwrite';

type AgentFramework = 'kylrix' | 'openclaw' | 'hermes';

type AgentStatus = 'idle' | 'working';

interface AgentRow {
  $id: string;
  ownerId: string;
  parentId?: string | null;
  publicKey?: string | null;
  config?: string;
  status?: string;
  $updatedAt?: string;
}

const frameworks: Array<{ id: AgentFramework; title: string; comingSoon?: boolean }> = [
  { id: 'kylrix', title: 'Kylrix Internal' },
  { id: 'openclaw', title: 'OpenClaw', comingSoon: true },
  { id: 'hermes', title: 'Hermes', comingSoon: true }
];

function formatUpdatedAgo(value?: string): string {
  if (!value) return 'Just now';
  const ts = new Date(value).getTime();
  if (!Number.isFinite(ts)) return 'updated just now';
  const deltaMs = Date.now() - ts;
  if (deltaMs < 60_000) return 'updated just now';
  const mins = Math.floor(deltaMs / 60_000);
  if (mins < 60) return `updated ${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `updated ${hrs}h ago`;
  const days = Math.floor(hrs / 24);
  return `updated ${days}d ago`;
}

interface DrawerShellProps {
  isOpen: boolean;
  onClose: () => void;
  isDesktop: boolean;
  isExpanded?: boolean;
  setIsExpanded?: (val: boolean) => void;
  zIndexClass: string;
  children: React.ReactNode;
  showDragHandle?: boolean;
}

function DrawerShell({
  isOpen,
  onClose,
  isDesktop,
  isExpanded = false,
  setIsExpanded,
  zIndexClass,
  children,
  showDragHandle = true
}: DrawerShellProps) {
  if (!isOpen) return null;

  const isFullscreen = !isDesktop && isExpanded;

  return (
    <>
      {/* Backdrop */}
      <div
        className={`fixed inset-0 bg-black/60 backdrop-blur-sm transition-opacity duration-300 ${isFullscreen ? 'z-[10000]' : zIndexClass}`}
        onClick={onClose}
      />
      {/* Drawer Body */}
      <div
        className={`fixed bg-[#161412] border-[#34322F] shadow-2xl flex flex-col overflow-hidden transition-all duration-300 ${
          isFullscreen
            ? 'z-[10001] inset-0 h-[100dvh] max-h-[100dvh] w-full rounded-none border-0'
            : isDesktop
              ? `${zIndexClass} top-[88px] right-0 h-[calc(100vh-88px)] w-[460px] border-l border-t rounded-tl-[24px]`
              : `${zIndexClass} bottom-0 left-0 right-0 h-[60dvh] border-t rounded-t-[24px]`
        }`}
      >
        {/* Mobile Drag Handle */}
        {!isDesktop && showDragHandle && !isFullscreen && (
          <div
            className="flex justify-center py-3 cursor-pointer select-none"
            onClick={onClose}
          >
            <div className="w-10 h-1 rounded bg-[#3D3A36]" />
          </div>
        )}
        <div className="flex-1 flex flex-col min-h-0">
          {children}
        </div>
      </div>
    </>
  );
}

export function AgenticDrawer() {
  const { isOpen, closeAgenticDrawer } = useAgenticDrawer();
  const { user } = useAuth();
  const { openProUpgrade } = useProUpgrade();
  const isPro = hasPaidKylrixPlan(user);

  const [isExpanded, setIsExpanded] = useState(false);
  const [isDesktop, setIsDesktop] = useState(false);

  // Nested Overlay State Controllers
  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [isFrameworkOpen, setIsFrameworkOpen] = useState(false);
  const [selectedAgentId, setSelectedAgentId] = useState<string | null>(null);

  const [framework, setFramework] = useState<AgentFramework>('kylrix');
  const [agentName, setAgentName] = useState('');
  const [agentGoal, setAgentGoal] = useState('');
  const [agents, setAgents] = useState<AgentRow[]>([]);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [updatingAgentId, setUpdatingAgentId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  // Instant command states
  const [instantPrompt, setInstantPrompt] = useState('');
  const [instantResponse, setInstantResponse] = useState<string | null>(null);
  const [executingInstant, setExecutingInstant] = useState(false);
  const [instantError, setInstantError] = useState<string | null>(null);

  useEffect(() => {
    const handleResize = () => {
      setIsDesktop(window.innerWidth >= 768);
    };
    handleResize();
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  useEffect(() => {
    if (!isOpen) {
      setIsCreateOpen(false);
      setIsFrameworkOpen(false);
      setSelectedAgentId(null);
      setFramework('kylrix');
      setAgentName('');
      setAgentGoal('');
      setError(null);
      setIsExpanded(false);
      setInstantPrompt('');
      setInstantResponse(null);
      setInstantError(null);
    }
  }, [isOpen]);

  const fetchAgents = useCallback(async () => {
    if (!user?.$id) {
      setAgents([]);
      return;
    }
    setLoading(true);
    setError(null);
    try {
      const rows = await AgenticService.listMyAgents(user.$id);
      setAgents(rows as unknown as AgentRow[]);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to load agents.');
    } finally {
      setLoading(false);
    }
  }, [user?.$id]);

  useEffect(() => {
    if (!isOpen || !user?.$id) return;
    void fetchAgents();
  }, [fetchAgents, isOpen, user?.$id]);

  const createAgent = useCallback(async () => {
    if (!user?.$id || !agentName.trim()) return;

    if (!isPro) {
      openProUpgrade('Create AI Agent');
      return;
    }

    setSaving(true);
    setError(null);
    try {
      await AgenticService.createMyAgent({
        userId: user.$id,
        name: agentName.trim(),
        goal: agentGoal.trim(),
        framework,
      });
      setAgentName('');
      setAgentGoal('');
      setIsCreateOpen(false);
      await fetchAgents();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not create agent.');
    } finally {
      setSaving(false);
    }
  }, [agentGoal, agentName, fetchAgents, framework, isPro, openProUpgrade, user?.$id]);

  const setAgentStatus = useCallback(async (agent: AgentRow, status: AgentStatus) => {
    if (!user?.$id) return;
    setUpdatingAgentId(agent.$id);
    setError(null);
    try {
      await AgenticService.setMyAgentStatus(user.$id, agent.$id, status);
      setAgents((prev) => prev.map((entry) => (entry.$id === agent.$id ? { ...entry, status } : entry)));
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not update agent status.');
    } finally {
      setUpdatingAgentId(null);
    }
  }, [user?.$id]);

  const runAgentNow = useCallback(async (agent: AgentRow) => {
    if (!user?.$id) return;

    if (!isPro) {
      openProUpgrade('Run AI Agent');
      return;
    }

    setUpdatingAgentId(agent.$id);
    setError(null);
    try {
      await AgenticService.setMyAgentStatus(user.$id, agent.$id, 'working');
      setAgents((prev) => prev.map((entry) => (entry.$id === agent.$id ? { ...entry, status: 'working' } : entry)));
      await runMyAgent(agent.$id);
      await fetchAgents();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not run agent.');
      await fetchAgents();
    } finally {
      setUpdatingAgentId(null);
    }
  }, [fetchAgents, isPro, openProUpgrade, user?.$id]);

  const parsedAgents = useMemo(() => {
    return agents.map((agent) => {
      let config: { name?: string; goal?: string; framework?: string; lastSummary?: string | null; lastError?: string | null } = {};
      try {
        config = JSON.parse(agent.config || '{}');
      } catch {
        config = {};
      }
      return {
        ...agent,
        name: config.name || `Agent ${agent.$id.slice(0, 6)}`,
        goal: config.goal || 'No goal defined yet.',
        framework: (config.framework as AgentFramework) || 'kylrix',
        status: agent.status === 'working' ? 'working' : 'idle',
        lastSummary: config.lastSummary || null,
        lastError: config.lastError || null,
      };
    });
  }, [agents]);

  const selectedAgent = useMemo(() => {
    return parsedAgents.find((a) => a.$id === selectedAgentId) || null;
  }, [parsedAgents, selectedAgentId]);

  const runSummary = useMemo(() => {
    const working = parsedAgents.filter((a) => a.status === 'working').length;
    return {
      total: parsedAgents.length,
      working,
      idle: Math.max(parsedAgents.length - working, 0),
    };
  }, [parsedAgents]);

  return (
    <>
      <DrawerShell
        isOpen={isOpen}
        onClose={closeAgenticDrawer}
        isDesktop={isDesktop}
        isExpanded={isExpanded}
        setIsExpanded={setIsExpanded}
        zIndexClass="z-[1300]"
      >
        <div className="px-5 md:px-7 pb-6 pt-3 md:pt-6 flex-1 flex flex-col min-h-0 font-satoshi">
          {/* Header */}
          <div className="flex items-center justify-between mb-6 flex-shrink-0">
            <div className="flex items-center gap-3.5">
              <div className="w-10 h-10 rounded-xl flex items-center justify-center bg-[#0A0908] border border-[#34322F]">
                <Bot size={20} className="text-[#6366F1]" strokeWidth={2} />
              </div>
              <div className="flex flex-col">
                <h2 className="text-white font-extrabold text-base font-clash tracking-tight leading-none">
                  Smart Systems
                </h2>
                <span className="text-[#9B9691] text-xs font-semibold mt-1">
                  Automate work with secure AI assistants
                </span>
              </div>
            </div>
            <div className="flex items-center gap-1.5">
              {!isDesktop && (
                <button
                  type="button"
                  onClick={() => setIsExpanded(!isExpanded)}
                  aria-label={isExpanded ? 'Scale down' : 'Scale up'}
                  className="p-1.5 text-[#E8E6E3] bg-[#0A0908] border border-[#34322F] rounded-lg hover:bg-[#1C1A18] transition"
                >
                  {isExpanded ? <ChevronDown size={16} /> : <ChevronUp size={16} />}
                </button>
              )}
              <button
                type="button"
                onClick={closeAgenticDrawer}
                aria-label="Close"
                className="p-1.5 text-[#E8E6E3] bg-[#0A0908] border border-[#34322F] rounded-lg hover:bg-[#1C1A18] transition"
              >
                <X size={16} />
              </button>
            </div>
          </div>

          {/* Stats Bar */}
          <div className="mb-4 p-4 rounded-2xl bg-[#0B0A09] border border-white/5 flex-shrink-0">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <span className={`w-2 h-2 rounded-full ${runSummary.working > 0 ? 'bg-[#F59E0B]' : 'bg-[#10B981]'}`} />
                <span className="text-white text-xs font-black">
                  {runSummary.total} Active Systems
                </span>
              </div>
              <span className="text-[#9B9691] text-[11px] font-bold">
                {runSummary.working} Active · {runSummary.idle} Inactive
              </span>
            </div>
          </div>

          {/* Instant System Command Box (OpenBricks 3.0 Refinement) */}
          <div className="mb-5 flex flex-shrink-0 flex-col gap-3.5 p-5 rounded-2xl bg-[#0B0A09] border border-white/5 relative overflow-hidden group transition-all duration-300 hover:border-[#6366F1]/30">
            {/* Top Spotlight Ambient Gradient */}
            <div className="absolute top-0 right-0 w-24 h-24 bg-radial-gradient from-[#6366F1]/5 to-transparent rounded-full blur-2xl pointer-events-none group-hover:from-[#6366F1]/10 transition-all duration-300" />
            
            <div className="flex items-center gap-2 relative z-10">
              <Sparkles size={13} className="text-[#6366F1] animate-pulse" />
              <span className="text-white text-xs font-black uppercase tracking-wider font-clash">
                Instant System Request
              </span>
              {!isPro && (
                <span className="ml-auto text-[9px] font-black uppercase tracking-widest px-1.5 py-0.5 rounded bg-amber-500/10 border border-amber-500/20 text-amber-500">
                  PRO
                </span>
              )}
            </div>

            <form
              onSubmit={async (e) => {
                e.preventDefault();
                if (!instantPrompt.trim()) return;
                
                if (!isPro) {
                  openProUpgrade('Instant System Request');
                  return;
                }

                setExecutingInstant(true);
                setInstantError(null);
                setInstantResponse(null);
                try {
                  const jwt = await account.createJWT().then((res: any) => res?.jwt || '').catch(() => undefined);
                  const res = await executeInstantRequestAction(instantPrompt.trim(), jwt);
                  if (res.success) {
                    setInstantResponse(res.response);
                  }
                } catch (err: any) {
                  setInstantError(err.message || 'Execution failed.');
                } finally {
                  setExecutingInstant(false);
                }
              }}
              className="relative flex items-center gap-2 z-10"
            >
              <input
                type="text"
                value={instantPrompt}
                onChange={(e) => setInstantPrompt(e.target.value)}
                placeholder="Ask the system to summarize, analyze, or draft..."
                disabled={executingInstant}
                className="w-full pl-3.5 pr-12 py-3 rounded-xl bg-[#161412] border border-white/5 text-xs text-white font-semibold placeholder:text-[#9B9691]/40 focus:outline-none focus:border-[#6366F1]/50 focus:shadow-[0_0_12px_rgba(99,102,241,0.15)] transition-all duration-300 disabled:opacity-50"
              />
              <button
                type="submit"
                disabled={executingInstant || !instantPrompt.trim()}
                className="absolute right-1.5 p-2 rounded-lg text-white hover:text-white/80 bg-[#6366F1] hover:bg-[#575CF0] disabled:bg-white/5 disabled:text-[#9B9691]/40 transition-all duration-300 cursor-pointer"
              >
                {executingInstant ? (
                  <RefreshCw size={12} className="animate-spin" />
                ) : (
                  <Send size={12} />
                )}
              </button>
            </form>

            {/* Instant Error */}
            {instantError && (
              <div className="mt-1 flex items-center gap-2 text-[10px] text-red-400 relative z-10">
                <AlertCircle size={12} className="flex-shrink-0" />
                <span className="font-semibold">{instantError}</span>
              </div>
            )}

            {/* Instant Response Panel */}
            {instantResponse && (
              <div className="mt-1 p-3.5 rounded-xl bg-[#161412] border border-white/5 max-h-[160px] overflow-y-auto relative z-10">
                <div className="flex justify-between items-center mb-2">
                  <span className="text-[10px] text-[#9B9691] font-bold uppercase tracking-wider">System Output</span>
                  <button
                    type="button"
                    onClick={() => setInstantResponse(null)}
                    className="text-[10px] text-[#6366F1] hover:text-[#575CF0] font-bold transition-colors cursor-pointer"
                  >
                    Clear
                  </button>
                </div>
                <p className="text-white/95 text-xs font-mono whitespace-pre-wrap leading-relaxed">
                  {instantResponse}
                </p>
              </div>
            )}
          </div>

          {/* Main List */}
          <div className="flex-1 min-h-0 flex flex-col gap-4">
            {error && <span className="text-[#FCA5A5] text-xs px-1">{error}</span>}

            <div className="overflow-y-auto pr-1 flex-1 flex flex-col gap-2.5">
              {loading ? (
                <div className="py-12 flex items-center justify-center">
                  <RefreshCw className="w-6 h-6 text-[#6366F1] animate-spin" />
                </div>
              ) : parsedAgents.length === 0 ? (
                <div className="p-6 rounded-2xl bg-[#0B0A09] border border-white/5 text-center">
                  <h3 className="text-white font-extrabold text-sm mb-1">
                    No Smart Systems
                  </h3>
                  <p className="text-[#9B9691] text-xs leading-relaxed">
                    Initialize your first background assistant to automate routine operations.
                  </p>
                </div>
              ) : (
                parsedAgents.map((agent) => {
                  const isWorking = agent.status === 'working';
                  return (
                    <div
                      key={agent.$id}
                      onClick={() => setSelectedAgentId(agent.$id)}
                      className="p-4 rounded-2xl bg-[#0B0A09] border border-white/5 cursor-pointer transition hover:bg-[#1C1A18] hover:-translate-y-0.5 hover:shadow-[0_8px_10px_-8px_rgba(0,0,0,1)]"
                    >
                      <div className="flex items-center justify-between gap-4">
                        <div className="min-w-0 flex-1 flex flex-col gap-1">
                          <h4 className="text-white font-extrabold text-[13px] font-clash truncate">
                            {agent.name}
                          </h4>
                          <div className="flex items-center gap-1.5 text-xs text-[#9B9691] font-semibold">
                            <span>
                              {agent.framework === 'kylrix' ? 'Kylrix Internal' : agent.framework}
                            </span>
                            <span className="w-1 h-1 rounded-full bg-[#5D5A56]" />
                            <span className="text-[10px] font-normal text-white/35">
                              {formatUpdatedAgo(agent.$updatedAt)}
                            </span>
                          </div>
                        </div>

                        <div className="flex items-center gap-3 flex-shrink-0">
                          <span
                            className={`px-3 py-1 rounded-full text-[10px] font-black tracking-wider uppercase border ${
                              isWorking
                                ? 'bg-[#6366F1]/15 border-[#6366F1]/30 text-[#6366F1]'
                                : 'bg-[#10B981]/15 border-[#10B981]/30 text-[#10B981]'
                            }`}
                          >
                            {agent.status}
                          </span>
                          <ChevronRight size={16} className="text-[#9B9691]" />
                        </div>
                      </div>
                    </div>
                  );
                })
              )}
            </div>

            {/* Bottom Initialize Action Button */}
            <div className="mt-auto pt-4 flex-shrink-0">
              <button
                type="button"
                onClick={() => setIsCreateOpen(true)}
                className="w-full flex items-center justify-center gap-2 py-3.5 rounded-xl font-extrabold text-sm bg-[#6366F1] text-white hover:bg-[#575CF0] transition shadow-none cursor-pointer"
              >
                <Plus size={18} />
                <span>Initialize Smart System</span>
              </button>
            </div>
          </div>
        </div>
      </DrawerShell>

      {/* NESTED OVERLAY 1: Initialize/Create Assistant Drawer */}
      {isCreateOpen && (
        <DrawerShell
          isOpen={isCreateOpen}
          onClose={() => setIsCreateOpen(false)}
          isDesktop={isDesktop}
          isExpanded={isExpanded}
          setIsExpanded={setIsExpanded}
          zIndexClass="z-[1400]"
        >
          <div className="px-5 md:px-7 pb-6 pt-3 md:pt-6 flex-1 flex flex-col min-h-0 font-satoshi">
            {/* Header */}
            <div className="flex items-center justify-between mb-6 flex-shrink-0">
              <div className="flex items-center gap-3.5">
                <button
                  type="button"
                  onClick={() => setIsCreateOpen(false)}
                  aria-label="Back"
                  className="p-1.5 text-[#E8E6E3] bg-[#0A0908] border border-[#34322F] rounded-lg hover:bg-[#1C1A18] transition"
                >
                  <ArrowLeft size={16} />
                </button>
                <h3 className="text-white font-extrabold text-base font-clash tracking-tight">
                  Initialize System
                </h3>
              </div>
              {!isDesktop && (
                <button
                  type="button"
                  onClick={() => setIsExpanded(!isExpanded)}
                  aria-label={isExpanded ? 'Scale down' : 'Scale up'}
                  className="p-1.5 text-[#E8E6E3] bg-[#0A0908] border border-[#34322F] rounded-lg hover:bg-[#1C1A18] transition"
                >
                  {isExpanded ? <ChevronDown size={16} /> : <ChevronUp size={16} />}
                </button>
              )}
            </div>

            {/* Main Form Scroll Area */}
            <div className="flex-1 overflow-y-auto pr-1 flex flex-col gap-5 min-h-0">
              <div className="flex flex-col gap-1.5">
                <label className="text-xs font-bold text-[#9B9691] tracking-wider uppercase font-clash">
                  System Name
                </label>
                <input
                  type="text"
                  value={agentName}
                  onChange={(event) => setAgentName(event.target.value)}
                  placeholder="e.g., Workflow Manager"
                  className="w-full px-4 py-3 rounded-xl bg-[#0A0908] border border-[#34322F] text-sm text-white font-semibold placeholder:text-[#9B9691]/40 focus:outline-none focus:border-[#6366F1] transition"
                />
              </div>

              <div className="flex flex-col gap-1.5">
                <label className="text-xs font-bold text-[#9B9691] tracking-wider uppercase font-clash">
                  Goal / Instructions
                </label>
                <textarea
                  value={agentGoal}
                  onChange={(event) => setAgentGoal(event.target.value)}
                  placeholder="e.g., Triage overdue tasks and notify team members..."
                  rows={4}
                  className="w-full px-4 py-3 rounded-xl bg-[#0A0908] border border-[#34322F] text-sm text-white font-semibold placeholder:text-[#9B9691]/40 focus:outline-none focus:border-[#6366F1] transition resize-none leading-relaxed"
                />
              </div>

              {/* Framework Selector Trigger */}
              <div
                onClick={() => setIsFrameworkOpen(true)}
                className="p-4 rounded-xl bg-[#0A0908] border border-[#34322F] cursor-pointer hover:bg-[#1C1A18] transition"
              >
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <Plug size={18} className="text-[#6366F1]" />
                    <div className="flex flex-col">
                      <span className="text-[#9B9691] text-[10px] font-bold uppercase tracking-wider">
                        Runtime Environment
                      </span>
                      <span className="text-white text-sm font-extrabold mt-0.5">
                        {framework === 'kylrix' ? 'Kylrix Internal' : framework}
                      </span>
                    </div>
                  </div>
                  <ChevronRight size={16} className="text-[#9B9691]" />
                </div>
              </div>

              <p className="text-[#9B9691] text-[11px] leading-relaxed px-1">
                Smart systems run locally using in-process tasks. They cannot connect to arbitrary external websites or leak internal files.
              </p>
            </div>

            {/* Action Footer */}
            <div className="mt-auto pt-4 flex-shrink-0">
              <button
                type="button"
                onClick={async () => {
                  await createAgent();
                }}
                disabled={saving || !agentName.trim() || !user?.$id}
                className="w-full flex items-center justify-center gap-2 py-3.5 rounded-xl font-extrabold text-sm bg-[#6366F1] hover:bg-[#575CF0] text-white disabled:bg-white/5 disabled:text-[#9B9691] transition cursor-pointer"
              >
                {saving ? (
                  <RefreshCw className="w-5 h-5 animate-spin" />
                ) : (
                  'Ready'
                )}
              </button>
            </div>
          </div>
        </DrawerShell>
      )}

      {/* NESTED OVERLAY 2: Select Runtime Framework Drawer */}
      {isFrameworkOpen && (
        <DrawerShell
          isOpen={isFrameworkOpen}
          onClose={() => setIsFrameworkOpen(false)}
          isDesktop={isDesktop}
          isExpanded={isExpanded}
          setIsExpanded={setIsExpanded}
          zIndexClass="z-[1500]"
        >
          <div className="px-5 md:px-7 pb-6 pt-3 md:pt-6 flex-1 flex flex-col min-h-0 font-satoshi">
            {/* Header */}
            <div className="flex items-center gap-3.5 mb-6 flex-shrink-0">
              <button
                type="button"
                onClick={() => setIsFrameworkOpen(false)}
                aria-label="Back"
                className="p-1.5 text-[#E8E6E3] bg-[#0A0908] border border-[#34322F] rounded-lg hover:bg-[#1C1A18] transition"
              >
                <ArrowLeft size={16} />
              </button>
              <h3 className="text-white font-extrabold text-base font-clash tracking-tight">
                Select Runtime
              </h3>
            </div>

            {/* Main List */}
            <div className="flex-1 overflow-y-auto pr-1 flex flex-col gap-3">
              {frameworks.map((item) => {
                const selected = item.id === framework;
                const disabled = Boolean(item.comingSoon);
                return (
                  <div
                    key={item.id}
                    onClick={() => {
                      if (!disabled) {
                        setFramework(item.id);
                        setIsFrameworkOpen(false);
                      }
                    }}
                    className={`p-4 rounded-2xl bg-[#0A0908] border transition ${
                      selected ? 'border-[#6366F1]' : 'border-[#34322F]'
                    } ${disabled ? 'opacity-50 cursor-default' : 'cursor-pointer hover:bg-[#1C1A18]'}`}
                  >
                    <div className="flex items-center justify-between">
                      <span className={`font-clash font-extrabold text-sm ${disabled ? 'text-[#9B9691]' : 'text-white'}`}>
                        {item.title}{item.comingSoon ? ' (Coming soon)' : ''}
                      </span>
                      {selected && <Check size={16} className="text-[#6366F1]" />}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </DrawerShell>
      )}

      {/* NESTED OVERLAY 3: Agent Details System Panel Drawer */}
      {selectedAgent && (
        <DrawerShell
          isOpen={Boolean(selectedAgent)}
          onClose={() => setSelectedAgentId(null)}
          isDesktop={isDesktop}
          isExpanded={isExpanded}
          setIsExpanded={setIsExpanded}
          zIndexClass="z-[1400]"
        >
          <div className="px-5 md:px-7 pb-6 pt-3 md:pt-6 flex-1 flex flex-col min-h-0 font-satoshi">
            {/* Header */}
            <div className="flex items-center gap-3.5 mb-6 flex-shrink-0">
              <button
                type="button"
                onClick={() => setSelectedAgentId(null)}
                aria-label="Back"
                className="p-1.5 text-[#E8E6E3] bg-[#0A0908] border border-[#34322F] rounded-lg hover:bg-[#1C1A18] transition"
              >
                <ArrowLeft size={16} />
              </button>
              <h3 className="text-white font-extrabold text-base font-clash tracking-tight">
                System Panel
              </h3>
            </div>

            {/* Main Details Panel */}
            <div className="flex-1 overflow-y-auto pr-1 flex flex-col gap-6 min-h-0">
              {/* Name and State Card */}
              <div className="p-4 rounded-2xl bg-[#0A0908] border border-[#34322F]">
                <h4 className="text-white font-black text-lg font-clash mb-3 leading-snug">
                  {selectedAgent.name}
                </h4>
                <div className="flex items-center gap-3">
                  <span
                    className={`px-3 py-1 rounded-full text-[10px] font-black tracking-wider uppercase border ${
                      selectedAgent.status === 'working'
                        ? 'bg-[#6366F1]/15 border-[#6366F1]/30 text-[#6366F1]'
                        : 'bg-[#10B981]/15 border-[#10B981]/30 text-[#10B981]'
                    }`}
                  >
                    {selectedAgent.status}
                  </span>
                  <span className="text-[#9B9691] text-xs font-semibold">
                    {selectedAgent.framework === 'kylrix' ? 'Kylrix Internal' : selectedAgent.framework}
                  </span>
                </div>
              </div>

              {/* Goal Description Card */}
              <div className="flex flex-col gap-1.5">
                <h5 className="text-[#9B9691] text-[10px] font-bold uppercase tracking-wider px-1">
                  Objective Goal
                </h5>
                <div className="p-4 rounded-xl bg-[#0A0908] border border-[#34322F]">
                  <p className="text-white/85 text-xs leading-relaxed">
                    {selectedAgent.goal}
                  </p>
                </div>
              </div>

              {/* Logs & Run Summaries Card */}
              {(selectedAgent.lastSummary || selectedAgent.lastError) && (
                <div className="flex flex-col gap-1.5">
                  <h5 className="text-[#9B9691] text-[10px] font-bold uppercase tracking-wider px-1">
                    System Logs / Activity
                  </h5>
                  <div className="p-4 rounded-xl bg-[#0A0908] border border-[#34322F]">
                    {selectedAgent.lastError ? (
                      <div className="flex gap-2.5 items-start">
                        <AlertCircle size={16} className="text-[#EF4444] mt-0.5 flex-shrink-0" />
                        <span className="text-[#FCA5A5] text-[11px] font-mono leading-relaxed break-all">
                          Error: {selectedAgent.lastError}
                        </span>
                      </div>
                    ) : (
                      <div className="flex gap-2.5 items-start">
                        <RefreshCw size={16} className="text-[#10B981] mt-0.5 flex-shrink-0" />
                        <span className="text-white/70 text-[11px] font-mono leading-relaxed">
                          {selectedAgent.lastSummary}
                        </span>
                      </div>
                    )}
                  </div>
                </div>
              )}
            </div>

            {/* Action Footer */}
            <div className="mt-auto pt-4 flex-shrink-0">
              {selectedAgent.status === 'working' ? (
                <button
                  type="button"
                  disabled={updatingAgentId === selectedAgent.$id}
                  onClick={async () => {
                    await setAgentStatus(selectedAgent, 'idle');
                  }}
                  className="w-full flex items-center justify-center gap-2 py-3.5 rounded-xl font-extrabold text-sm bg-[#EF4444] hover:bg-[#DC2626] text-white disabled:opacity-50 transition cursor-pointer"
                >
                  <Power size={16} />
                  <span>Deactivate / Set Idle</span>
                </button>
              ) : (
                <button
                  type="button"
                  disabled={updatingAgentId === selectedAgent.$id}
                  onClick={async () => {
                    await runAgentNow(selectedAgent);
                  }}
                  className="w-full flex items-center justify-center gap-2 py-3.5 rounded-xl font-extrabold text-sm bg-[#10B981] hover:bg-[#059669] text-white disabled:opacity-50 transition cursor-pointer"
                >
                  <Play size={16} />
                  <span>Run Agent Now</span>
                </button>
              )}
            </div>
          </div>
        </DrawerShell>
      )}
    </>
  );
}
