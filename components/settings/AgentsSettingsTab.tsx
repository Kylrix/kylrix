'use client';

import React, { useState, useEffect, useCallback } from 'react';
import { 
  Bot, 
  Sparkles, 
  Plus, 
  Key, 
  Radio, 
  RefreshCw, 
  ChevronRight, 
  Lock, 
  Trash2, 
  Check, 
  Copy, 
  Terminal, 
  BookOpen,
  ShieldCheck,
  Zap
} from 'lucide-react';
import Link from 'next/link';
import { useAuth } from '@/lib/auth';
import { toast } from 'react-hot-toast';
import { BYOKManager } from '@/lib/ai/byok';
import { AgenticService, type AgentRecord } from '@/lib/services/agentic';
import { SYSTEM_AGENTS } from '@/lib/agentic/system-agents';
import { KYLRIX_AGENTS_SKILL_INSTALL } from '@/lib/api/public';
import { LocalEngine } from '@/lib/services/LocalEngine';
import { AgenticSettingsDrawer, type AgentDrawerMode } from './AgenticSettingsDrawer';
import { useDynamicSidebar } from '@/components/ui/DynamicSidebar';
import { useOverlay } from '@/components/ui/OverlayContext';

export function AgentsSettingsTab() {
  const { user } = useAuth();
  const { openSidebar, closeSidebar } = useDynamicSidebar();
  const { openOverlay, closeOverlay } = useOverlay();

  // Custom User Agents
  const [customAgents, setCustomAgents] = useState<AgentRecord[]>([]);
  const [loadingAgents, setLoadingAgents] = useState(true);

  // Default Agent Setting (Kylie or Custom Agent)
  const [defaultAgentId, setDefaultAgentId] = useState<string>('kylie');

  // Custom Provider / BYOK State
  const [byokKeyInput, setByokKeyInput] = useState('');
  const [hasByok, setHasByok] = useState(false);
  const [_byokLoading, setByokLoading] = useState(true);
  const [byokSaving, setByokSaving] = useState(false);
  const [showByokInput, setShowByokInput] = useState(false);

  // Compute Balance State
  const [computeState, setComputeState] = useState<{
    balance: number;
    maxBalance: number;
    tier: string;
    percent: number;
  } | null>(null);
  const [loadingCompute, setLoadingCompute] = useState(true);

  // Drawer helper (Desktop Right Sidebar / Mobile Bottom Sheet)
  const openAgentDrawer = useCallback((mode: AgentDrawerMode) => {
    const isDesktop = typeof window !== 'undefined' && window.innerWidth >= 768;
    const close = isDesktop ? closeSidebar : closeOverlay;
    const content = (
      <AgenticSettingsDrawer
        mode={mode}
        onClose={close}
      />
    );
    if (isDesktop) {
      openSidebar(content, 'agent-settings-drawer', { hideHeader: true });
    } else {
      openOverlay(content);
    }
  }, [openSidebar, closeSidebar, openOverlay, closeOverlay]);

  // Load custom agents with LocalEngine
  const loadAgents = useCallback(async () => {
    if (!user?.$id) {
      setLoadingAgents(false);
      return;
    }
    const cacheKey = `custom_agents_${user.$id}`;
    const cached = await LocalEngine.cacheGet<AgentRecord[]>(cacheKey);
    if (cached && Array.isArray(cached)) {
      setCustomAgents(cached);
      setLoadingAgents(false);
    } else {
      setLoadingAgents(true);
    }
    try {
      const list = await AgenticService.listMyAgents(user.$id, true);
      setCustomAgents(list);
      void LocalEngine.cacheSet(cacheKey, list);
    } catch {
      if (!cached) setCustomAgents([]);
    } finally {
      setLoadingAgents(false);
    }
  }, [user?.$id]);

  useEffect(() => {
    loadAgents();
  }, [loadAgents]);

  // Load default agent choice from LocalEngine
  useEffect(() => {
    void LocalEngine.cacheGet<string>('kylrix_default_agent_id').then((saved) => {
      if (saved) setDefaultAgentId(saved);
    });
  }, []);

  const handleSelectDefaultAgent = (id: string) => {
    setDefaultAgentId(id);
    void LocalEngine.cacheSet('kylrix_default_agent_id', id);
  };

  // Check BYOK Key
  useEffect(() => {
    if (!user?.$id) {
      setByokLoading(false);
      return;
    }
    setByokLoading(true);
    BYOKManager.hasKey(user.$id, 'gemini')
      .then((present) => {
        setHasByok(present);
        setByokLoading(false);
      })
      .catch(() => setByokLoading(false));
  }, [user?.$id]);

  const handleSaveByok = async () => {
    if (!user?.$id || !byokKeyInput.trim()) {
      toast.error('Enter a valid Gemini API key');
      return;
    }
    setByokSaving(true);
    try {
      await BYOKManager.saveKey(user.$id, 'gemini', byokKeyInput.trim());
      toast.success('Custom Gemini key saved');
      setHasByok(true);
      setByokKeyInput('');
      setShowByokInput(false);
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : 'Could not save key');
    } finally {
      setByokSaving(false);
    }
  };

  const handleDeleteByok = async () => {
    if (!user?.$id) return;
    setByokSaving(true);
    try {
      await BYOKManager.deleteKey(user.$id, 'gemini');
      toast.success('Custom key removed');
      setHasByok(false);
      setByokKeyInput('');
      setShowByokInput(false);
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : 'Could not remove key');
    } finally {
      setByokSaving(false);
    }
  };

  const handleDeleteCustomAgent = async (e: React.MouseEvent, agentId: string, name: string) => {
    e.stopPropagation();
    if (!confirm(`Delete custom agent "${name}"?`)) return;
    try {
      const { tablesDB } = await import('@/lib/appwrite/client');
      const { APPWRITE_CONFIG } = await import('@/lib/appwrite/config');
      await tablesDB.deleteRow(
        APPWRITE_CONFIG.DATABASES.FLOW,
        APPWRITE_CONFIG.TABLES.FLOW.AGENTS,
        agentId
      );
      toast.success('Agent deleted');
      setCustomAgents((prev) => prev.filter((a) => a.$id !== agentId));
      if (defaultAgentId === agentId) {
        handleSelectDefaultAgent('kylie');
      }
    } catch {
      toast.error('Failed to delete agent');
    }
  };

  // Fetch compute credits
  const loadComputeBalance = useCallback(async () => {
    try {
      setLoadingCompute(true);
      const { getComputeBalanceAction } = await import('@/lib/actions/ai');
      const { account } = await import('@/lib/appwrite/client');
      const jwt = await account.createJWT().then((r) => r.jwt).catch(() => undefined);
      const res = await getComputeBalanceAction(jwt);
      if (res) {
        setComputeState(res);
      }
    } catch {
      // Non-blocking fail-safe
    } finally {
      setLoadingCompute(false);
    }
  }, []);

  useEffect(() => {
    if (user?.$id) {
      void loadComputeBalance();
    }
  }, [user?.$id, loadComputeBalance]);

  // Find active default agent display info (Kylie vs Custom agent)
  const activeCustomAgent = customAgents.find((a) => a.$id === defaultAgentId);
  const activeDefaultName = activeCustomAgent
    ? JSON.parse(activeCustomAgent.config || '{}').name || 'Custom Agent'
    : 'Kylie';
  const activeDefaultRole = activeCustomAgent
    ? JSON.parse(activeCustomAgent.config || '{}').role || 'Custom user partner'
    : 'Primary Ecosystem Partner';
  const isCustomDefault = !!activeCustomAgent;

  return (
    <div className="space-y-6 font-satoshi">
      {/* ── Section 1: Default Agent Partner & Quick Launchbar ── */}
      <div className="p-6 bg-[#161412] border border-white/5 rounded-[28px] shadow-2xl space-y-4">
        <div className="flex items-center justify-between gap-4 flex-wrap">
          <div className="flex items-center gap-3.5 min-w-0">
            <div className="w-12 h-12 rounded-2xl bg-[#F59E0B]/12 border border-[#F59E0B]/25 text-[#F59E0B] flex items-center justify-center text-xl shrink-0">
              {isCustomDefault ? '🤖' : '✨'}
            </div>
            <div className="min-w-0">
              <div className="flex items-center gap-2">
                <h3 className="text-white font-black text-base font-clash m-0 truncate">
                  {activeDefaultName}
                </h3>
                <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-[#F59E0B]/10 text-[#F59E0B] font-bold">
                  Active Default
                </span>
              </div>
              <p className="text-white/40 text-xs font-semibold m-0 mt-0.5 truncate">
                {activeDefaultRole}
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2 flex-wrap">
            <button
              type="button"
              onClick={() =>
                openAgentDrawer({
                  type: 'select_default',
                  activeAgentId: defaultAgentId,
                  onSelectDefault: handleSelectDefaultAgent,
                  customAgents,
                })
              }
              className="h-9 px-3.5 rounded-xl bg-white/[0.06] hover:bg-white/[0.12] border border-white/10 text-white font-extrabold text-xs flex items-center gap-1.5 transition-all cursor-pointer"
            >
              <Radio size={13} className="text-[#F59E0B]" />
              <span>Switch Partner</span>
            </button>

            <button
              type="button"
              onClick={() =>
                openAgentDrawer({
                  type: 'create_custom',
                  onCreated: () => void loadAgents(),
                })
              }
              className="h-9 px-3.5 rounded-xl bg-[#6366F1] hover:bg-[#5254E8] text-white font-extrabold text-xs flex items-center gap-1.5 transition-all cursor-pointer shadow-md"
            >
              <Plus size={13} />
              <span>New Agent</span>
            </button>

            <button
              type="button"
              onClick={() => openAgentDrawer({ type: 'manage_provisioning_keys' })}
              className="h-9 px-3.5 rounded-xl bg-[#161412] hover:bg-white/[0.06] border border-white/10 text-white/90 font-extrabold text-xs flex items-center gap-1.5 transition-all cursor-pointer"
            >
              <Key size={13} className="text-[#818cf8]" />
              <span>Provisioning Keys</span>
            </button>
          </div>
        </div>
      </div>

      {/* ── Section 2: Custom User Agents (with Agentic PATs) ── */}
      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <div>
            <h3 className="text-white font-black text-lg tracking-tight leading-tight flex items-center gap-2 font-mono m-0">
              <Sparkles size={18} className="text-[#6366F1]" />
              <span>Custom & Autonomous Agents</span>
            </h3>
            <p className="text-white/40 text-xs font-semibold mt-0.5 m-0">
              User-defined personas, instructions, and dedicated runtime tokens.
            </p>
          </div>

          <button
            type="button"
            onClick={() =>
              openAgentDrawer({
                type: 'create_custom',
                onCreated: () => void loadAgents(),
              })
            }
            className="h-8 px-3 rounded-xl bg-white/[0.04] hover:bg-white/[0.08] border border-white/10 text-white/80 font-bold text-xs flex items-center gap-1 transition-all cursor-pointer"
          >
            <Plus size={12} />
            <span>Create</span>
          </button>
        </div>

        {loadingAgents ? (
          <div className="p-8 rounded-[24px] bg-[#161412] border border-white/5 flex items-center justify-center text-white/40 text-xs">
            <RefreshCw size={14} className="animate-spin mr-2" /> Loading custom agents...
          </div>
        ) : customAgents.length === 0 ? (
          <div className="p-6 rounded-[24px] bg-[#161412] border border-white/5 flex flex-col items-center justify-center text-center gap-2.5">
            <div className="w-10 h-10 rounded-2xl bg-white/[0.03] border border-white/5 grid place-items-center text-white/30">
              <Bot size={20} />
            </div>
            <div>
              <h4 className="text-sm font-bold text-white m-0">No Custom Agents Yet</h4>
              <p className="text-xs text-white/40 max-w-sm mt-0.5 m-0">
                Use the Meta Crafter to quickly build specialized agents with their own Agentic PATs.
              </p>
            </div>
            <button
              type="button"
              onClick={() =>
                openAgentDrawer({
                  type: 'create_custom',
                  onCreated: () => void loadAgents(),
                })
              }
              className="mt-1 h-8 px-3.5 rounded-xl bg-white/[0.06] hover:bg-white/[0.12] border border-white/10 text-white font-bold text-xs flex items-center gap-1.5 transition-all cursor-pointer"
            >
              <Plus size={13} />
              <span>Create Custom Agent</span>
            </button>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3.5">
            {customAgents.map((ca) => {
              const cfg = JSON.parse(ca.config || '{}');
              const isSelected = defaultAgentId === ca.$id;
              return (
                <div
                  key={ca.$id}
                  onClick={() =>
                    openAgentDrawer({
                      type: 'edit_custom',
                      agent: ca,
                      onSaved: () => void loadAgents(),
                    })
                  }
                  className="p-4 bg-[#161412] border border-white/5 hover:border-white/15 hover:bg-[#1C1A18] rounded-[24px] shadow-xl flex flex-col justify-between gap-3.5 transition-all duration-300 cursor-pointer group"
                >
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex items-center gap-3 min-w-0">
                      <div className="w-10 h-10 rounded-xl bg-[#0A0908] border border-white/[0.06] flex items-center justify-center text-[#6366F1] shrink-0 font-bold">
                        <Bot size={18} />
                      </div>
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-2">
                          <h4 className="text-white font-bold text-sm font-clash m-0 truncate group-hover:text-[#6366F1] transition-colors">
                            {cfg.name || 'Custom Agent'}
                          </h4>
                          <span className="text-[9px] font-mono px-1.5 py-0.2 rounded bg-[#6366F1]/10 text-[#818cf8] font-bold">
                            {cfg.framework || 'kylrix'}
                          </span>
                        </div>
                        <p className="text-white/40 text-xs mt-0.5 m-0 line-clamp-1">
                          {cfg.role || cfg.goal || 'Custom instructions defined'}
                        </p>
                      </div>
                    </div>

                    <div className="flex items-center gap-1 shrink-0">
                      {isSelected && (
                        <span className="text-[9px] font-mono font-bold px-2 py-0.5 rounded bg-[#F59E0B]/15 text-[#F59E0B]">
                          Default
                        </span>
                      )}
                      <button
                        type="button"
                        onClick={(e) => handleDeleteCustomAgent(e, ca.$id, cfg.name || 'Agent')}
                        className="p-1.5 rounded-lg text-white/30 hover:text-red-400 hover:bg-white/[0.04] transition-colors cursor-pointer"
                      >
                        <Trash2 size={13} />
                      </button>
                    </div>
                  </div>

                  <div className="flex items-center justify-between text-xs font-mono text-white/50 border-t border-white/[0.04] pt-2.5">
                    <span className="flex items-center gap-1">
                      <Key size={11} className="text-emerald-400" /> Manage Agentic PATs
                    </span>
                    <span className="text-[#6366F1] font-bold group-hover:underline flex items-center gap-0.5">
                      Configure <ChevronRight size={12} />
                    </span>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* ── Section 3: Internal System Agents (Compact Specialist Catalog) ── */}
      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <div>
            <h3 className="text-white font-black text-lg tracking-tight leading-tight flex items-center gap-2 font-mono m-0">
              <Bot size={18} className="text-[#F59E0B]" />
              <span>Internal System Agents</span>
            </h3>
            <p className="text-white/40 text-xs font-semibold mt-0.5 m-0">
              Kylie is the default ecosystem core. Other agents are specialized task utilities.
            </p>
          </div>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
          {SYSTEM_AGENTS.map((agent) => {
            const isKylie = agent.id === 'kylie';
            return (
              <div
                key={agent.id}
                onClick={() =>
                  openAgentDrawer({
                    type: 'preview_system',
                    agent,
                  })
                }
                className="p-3.5 bg-[#161412] border border-white/5 hover:border-white/15 hover:bg-[#1C1A18] rounded-[20px] shadow-lg flex flex-col justify-between gap-2.5 transition-all duration-200 cursor-pointer group"
              >
                <div className="flex items-center gap-2.5 min-w-0">
                  <div className="w-8 h-8 rounded-xl bg-[#0A0908] border border-white/[0.06] flex items-center justify-center text-sm shrink-0">
                    {agent.avatar}
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-1.5">
                      <h4 className="text-white font-bold text-xs font-clash m-0 truncate group-hover:text-[#F59E0B] transition-colors">
                        {agent.name}
                      </h4>
                      {isKylie && (
                        <span className="text-[8px] font-mono px-1 py-0.2 rounded bg-[#F59E0B]/15 text-[#F59E0B] font-bold">
                          Core
                        </span>
                      )}
                    </div>
                    <p className="text-white/40 text-[11px] m-0 truncate">{agent.role}</p>
                  </div>
                </div>

                <div className="flex items-center justify-between text-[11px] font-mono text-white/40 border-t border-white/[0.04] pt-2">
                  <span className="flex items-center gap-1 text-[10px]">
                    <Lock size={10} className="text-emerald-400" /> Live Prompt
                  </span>
                  <span className="text-[#F59E0B] font-bold group-hover:underline text-[10px]">Inspect →</span>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* ── Section 4: Agent Provisioning Keys & CLI Integration ── */}
      <div className="p-6 bg-[#161412] border border-white/5 rounded-[28px] shadow-2xl space-y-4">
        <div className="flex items-center justify-between gap-4 flex-wrap">
          <div className="flex items-center gap-3.5">
            <div className="w-12 h-12 rounded-2xl bg-[#6366F1]/12 border border-[#6366F1]/25 text-[#6366F1] flex items-center justify-center shrink-0">
              <Terminal size={22} />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="text-white font-black text-base font-clash m-0">Agent Provisioning & CLI Skill</h3>
                <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-[#6366F1]/10 text-[#818CF8] font-bold">
                  Zero-Trust
                </span>
              </div>
              <p className="text-white/40 text-xs font-semibold m-0 mt-0.5">
                Manage root keys (<code className="text-[#818CF8] font-mono">kyl_apk_…</code>) for automated external agents and CLI subagents.
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => openAgentDrawer({ type: 'manage_provisioning_keys' })}
              className="h-9 px-3.5 rounded-xl bg-[#6366F1] hover:bg-[#5254E8] text-white font-extrabold text-xs flex items-center gap-1.5 transition-all cursor-pointer"
            >
              <Key size={13} />
              <span>Manage Keys</span>
            </button>

            <Link
              href="/docs/agents"
              className="h-9 px-3 rounded-xl bg-white/[0.04] hover:bg-white/[0.08] border border-white/10 text-white/70 hover:text-white text-xs font-bold flex items-center gap-1 transition-all"
            >
              <BookOpen size={13} />
              <span>Docs</span>
            </Link>
          </div>
        </div>

        {/* Quick Skill Install Box */}
        <div className="p-3.5 rounded-2xl bg-[#0A0908] border border-white/[0.06] flex items-center gap-2">
          <code className="flex-1 min-w-0 text-[11px] font-mono text-white/70 bg-[#161412] border border-white/[0.06] rounded-xl px-3 py-2 truncate select-all">
            {KYLRIX_AGENTS_SKILL_INSTALL}
          </code>
          <button
            type="button"
            onClick={async () => {
              try {
                await navigator.clipboard.writeText(KYLRIX_AGENTS_SKILL_INSTALL);
                toast.success('Install command copied');
              } catch {
                toast.success(KYLRIX_AGENTS_SKILL_INSTALL);
              }
            }}
            className="inline-flex items-center gap-1 px-3 py-2 rounded-xl text-xs font-extrabold bg-white/[0.06] hover:bg-white/[0.12] text-white cursor-pointer shrink-0 transition-colors"
          >
            <Copy size={12} />
            <span>Copy</span>
          </button>
        </div>
      </div>

      {/* ── Section 5: Live AI Compute Allocation & BYOK ── */}
      <div className="p-6 bg-[#161412] border border-white/5 rounded-[28px] shadow-2xl space-y-4">
        <div className="flex items-center justify-between gap-4 flex-wrap">
          <div className="flex items-center gap-3.5">
            <div className="w-12 h-12 rounded-2xl bg-[#10B981]/12 border border-[#10B981]/25 text-[#10B981] flex items-center justify-center shrink-0">
              <Zap size={22} />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="text-white font-black text-base font-clash m-0">Compute Credits & BYOK</h3>
                <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-[#10B981]/10 text-[#10B981] font-bold uppercase tracking-wider">
                  {hasByok ? 'BYOK Unlimited' : `${computeState?.tier || 'Pro'} Active`}
                </span>
              </div>
              <p className="text-white/40 text-xs font-semibold m-0 mt-0.5">
                Dynamic token pool for in-app assistant responses, summaries, and meta-prompts.
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            {hasByok && !showByokInput && (
              <button
                type="button"
                onClick={handleDeleteByok}
                disabled={byokSaving}
                className="h-9 px-3 rounded-xl bg-red-500/10 hover:bg-red-500/20 border border-red-500/20 text-red-400 font-bold text-xs flex items-center gap-1 transition-all cursor-pointer"
              >
                <Trash2 size={13} />
                <span>Remove BYOK</span>
              </button>
            )}
            <button
              type="button"
              onClick={() => setShowByokInput((prev) => !prev)}
              className="h-9 px-3.5 rounded-xl bg-white/[0.06] hover:bg-white/[0.12] border border-white/10 text-white font-extrabold text-xs flex items-center gap-1.5 transition-all cursor-pointer"
            >
              <Key size={13} className="text-[#10B981]" />
              <span>{showByokInput ? 'Cancel' : hasByok ? 'Change Gemini Key' : 'Configure BYOK Key'}</span>
            </button>
          </div>
        </div>

        {/* BYOK Input Drawer / Box */}
        {showByokInput && (
          <div className="p-4 rounded-2xl bg-[#0A0908] border border-white/[0.06] space-y-3">
            <label className="text-xs font-bold text-white/60 uppercase tracking-wider font-mono block">
              Google Gemini API Key
            </label>
            <div className="flex flex-col sm:flex-row gap-2">
              <input
                type="password"
                value={byokKeyInput}
                onChange={(e) => setByokKeyInput(e.target.value)}
                placeholder="AIzaSy..."
                className="flex-1 h-10 rounded-xl bg-[#161412] border border-white/[0.06] px-3 text-xs font-mono text-white placeholder:text-white/30 focus:outline-none focus:border-[#10B981]/40"
              />
              <button
                type="button"
                onClick={handleSaveByok}
                disabled={byokSaving || !byokKeyInput.trim()}
                className="h-10 px-5 rounded-xl bg-[#10B981] hover:bg-[#059669] text-black font-bold text-xs flex items-center justify-center gap-1.5 transition-all disabled:opacity-40 cursor-pointer"
              >
                {byokSaving ? <RefreshCw size={14} className="animate-spin" /> : <Check size={14} />}
                <span>Save Key</span>
              </button>
            </div>
          </div>
        )}

        {/* Progress Bar */}
        <div className="p-4 rounded-2xl bg-[#0A0908] border border-white/[0.06] space-y-2.5">
          <div className="flex items-center justify-between text-xs font-mono">
            <span className="text-white/60">
              {hasByok ? 'Compute Mode: Dedicated Private API Key' : 'Daily Available Pool:'}
            </span>
            <span className="text-white font-bold">
              {hasByok
                ? '∞ (Unthrottled BYOK)'
                : `${(computeState?.balance ?? 100000).toLocaleString()} / ${(computeState?.maxBalance ?? 100000).toLocaleString()} Tokens (${Math.round(computeState?.percent ?? 100)}%)`}
            </span>
          </div>

          <div className="w-full h-2 rounded-full bg-white/[0.06] overflow-hidden">
            <div
              className={`h-full transition-all duration-500 rounded-full ${
                hasByok
                  ? 'w-full bg-[#10B981]'
                  : (computeState?.percent ?? 100) > 30
                  ? 'bg-[#10B981]'
                  : (computeState?.percent ?? 100) > 10
                  ? 'bg-amber-500'
                  : 'bg-red-500'
              }`}
              style={{ width: hasByok ? '100%' : `${computeState?.percent ?? 100}%` }}
            />
          </div>
        </div>
      </div>
    </div>
  );
}
