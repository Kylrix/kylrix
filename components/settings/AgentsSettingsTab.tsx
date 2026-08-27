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
import { AgentActionDrawer } from './AgentActionDrawer';
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

  // Selected Agent for Action Drawer
  const [selectedAgentForAction, setSelectedAgentForAction] = useState<any | null>(null);

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
  const [_loadingCompute, setLoadingCompute] = useState(true);

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

  const handleDeleteCustomAgent = async (e?: React.MouseEvent, agentId?: string, name?: string) => {
    e?.stopPropagation();
    const id = agentId || selectedAgentForAction?.$id || selectedAgentForAction?.id;
    const agentName = name || selectedAgentForAction?.name || 'Agent';
    if (!id) return;
    if (!confirm(`Delete custom agent "${agentName}"?`)) return;
    try {
      const { tablesDB } = await import('@/lib/appwrite/client');
      const { APPWRITE_CONFIG } = await import('@/lib/appwrite/config');
      await tablesDB.deleteRow(
        APPWRITE_CONFIG.DATABASES.FLOW,
        APPWRITE_CONFIG.TABLES.FLOW.AGENTS,
        id
      );

      // Clean up agent profile in background
      try {
        await tablesDB.deleteRow(
          APPWRITE_CONFIG.DATABASES.CHAT,
          APPWRITE_CONFIG.TABLES.CHAT.PROFILES,
          `agent_${id}`
        );
      } catch {}

      toast.success('Agent deleted');
      setCustomAgents((prev) => prev.filter((a) => a.$id !== id));
      if (defaultAgentId === id) {
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
                  onClick={() => setSelectedAgentForAction(ca)}
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
                      <Key size={11} className="text-emerald-400" /> View Profile & Keys
                    </span>
                    <span className="text-[#6366F1] font-bold group-hover:underline flex items-center gap-0.5">
                      Actions <ChevronRight size={12} />
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

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3.5">
          {SYSTEM_AGENTS.map((agent) => {
            const isKylie = agent.id === 'kylie';
            return (
              <div
                key={agent.id}
                onClick={() => setSelectedAgentForAction(agent)}
                className="p-4 bg-[#161412] border border-white/5 hover:border-white/15 hover:bg-[#1C1A18] rounded-[22px] shadow-lg flex flex-col justify-between gap-3 transition-all cursor-pointer group"
              >
                <div className="flex items-center gap-3 min-w-0">
                  <div className="w-10 h-10 rounded-xl bg-[#F59E0B]/10 text-[#F59E0B] flex items-center justify-center text-lg shrink-0">
                    {agent.avatar}
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-1.5">
                      <h4 className="text-white font-bold text-xs font-clash m-0 truncate group-hover:text-[#F59E0B] transition-colors">
                        {agent.name}
                      </h4>
                      {isKylie && (
                        <span className="text-[8px] font-mono px-1.5 py-0.2 rounded bg-[#F59E0B]/15 text-[#F59E0B] font-bold">
                          Core
                        </span>
                      )}
                    </div>
                    <p className="text-white/40 text-[11px] m-0 mt-0.5 truncate">{agent.role}</p>
                  </div>
                </div>

                <div className="flex items-center justify-between text-[11px] font-mono text-[#F59E0B] border-t border-white/[0.04] pt-2">
                  <span>Inspect & Prompt</span>
                  <ChevronRight size={12} />
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* ── Section 4: Condensed Security, CLI & Compute Control Tiles ── */}
      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <div>
            <h3 className="text-white font-black text-lg tracking-tight leading-tight flex items-center gap-2 font-mono m-0">
              <Terminal size={18} className="text-[#818CF8]" />
              <span>Integrations & Compute</span>
            </h3>
            <p className="text-white/40 text-xs font-semibold mt-0.5 m-0">
              Provisioning keys, terminal skill contracts, and LLM compute settings.
            </p>
          </div>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3.5">
          {/* Tile 1: Provisioning Keys */}
          <div
            onClick={() => openAgentDrawer({ type: 'manage_provisioning_keys' })}
            className="p-4 bg-[#161412] border border-white/5 hover:border-white/15 hover:bg-[#1C1A18] rounded-[22px] shadow-lg flex flex-col justify-between gap-3 transition-all cursor-pointer group"
          >
            <div className="flex items-center gap-3 min-w-0">
              <div className="w-10 h-10 rounded-xl bg-[#6366F1]/10 text-[#818CF8] flex items-center justify-center shrink-0">
                <Key size={18} />
              </div>
              <div className="min-w-0 flex-1">
                <h4 className="text-white font-bold text-xs font-clash m-0 truncate group-hover:text-[#818CF8] transition-colors">
                  Provisioning Keys (APK)
                </h4>
                <p className="text-white/40 text-[11px] m-0 mt-0.5 truncate">Root keys for CLI subagents</p>
              </div>
            </div>
            <div className="flex items-center justify-between text-[11px] font-mono text-[#818CF8] border-t border-white/[0.04] pt-2">
              <span>Manage Keys</span>
              <ChevronRight size={12} />
            </div>
          </div>

          {/* Tile 2: CLI Skill Integration */}
          <div
            onClick={() => openAgentDrawer({ type: 'manage_cli_skill' })}
            className="p-4 bg-[#161412] border border-white/5 hover:border-white/15 hover:bg-[#1C1A18] rounded-[22px] shadow-lg flex flex-col justify-between gap-3 transition-all cursor-pointer group"
          >
            <div className="flex items-center gap-3 min-w-0">
              <div className="w-10 h-10 rounded-xl bg-white/5 text-white/70 flex items-center justify-center shrink-0">
                <Terminal size={18} />
              </div>
              <div className="min-w-0 flex-1">
                <h4 className="text-white font-bold text-xs font-clash m-0 truncate group-hover:text-white transition-colors">
                  Agent Skill & CLI
                </h4>
                <p className="text-white/40 text-[11px] m-0 mt-0.5 truncate">npx skills add kylrix/agents</p>
              </div>
            </div>
            <div className="flex items-center justify-between text-[11px] font-mono text-white/50 border-t border-white/[0.04] pt-2">
              <span>View Terminal Setup</span>
              <ChevronRight size={12} />
            </div>
          </div>

          {/* Tile 3: Compute & BYOK */}
          <div
            onClick={() =>
              openAgentDrawer({
                type: 'manage_byok',
                hasByok,
                computeState,
                onSaveByok: async (k) => {
                  await BYOKManager.saveKey(user!.$id, 'gemini', k);
                  setHasByok(true);
                  toast.success('Gemini key saved');
                },
                onDeleteByok: async () => {
                  await BYOKManager.deleteKey(user!.$id, 'gemini');
                  setHasByok(false);
                  toast.success('Gemini key removed');
                },
              })
            }
            className="p-4 bg-[#161412] border border-white/5 hover:border-white/15 hover:bg-[#1C1A18] rounded-[22px] shadow-lg flex flex-col justify-between gap-3 transition-all cursor-pointer group"
          >
            <div className="flex items-center gap-3 min-w-0">
              <div className="w-10 h-10 rounded-xl bg-emerald-500/10 text-emerald-400 flex items-center justify-center shrink-0">
                <Zap size={18} />
              </div>
              <div className="min-w-0 flex-1">
                <h4 className="text-white font-bold text-xs font-clash m-0 truncate group-hover:text-emerald-400 transition-colors">
                  Compute & BYOK
                </h4>
                <p className="text-white/40 text-[11px] m-0 mt-0.5 truncate">
                  {hasByok ? 'BYOK Active (Unlimited)' : 'Shared Daily Pool'}
                </p>
              </div>
            </div>
            <div className="flex items-center justify-between text-[11px] font-mono text-emerald-400 border-t border-white/[0.04] pt-2">
              <span>Configure Gemini Key</span>
              <ChevronRight size={12} />
            </div>
          </div>
        </div>
      </div>

      {/* Agent Actions & Profile Drawer */}
      {selectedAgentForAction && (
        <AgentActionDrawer
          open={Boolean(selectedAgentForAction)}
          onClose={() => setSelectedAgentForAction(null)}
          agent={selectedAgentForAction}
          isDefault={defaultAgentId === (selectedAgentForAction.$id || selectedAgentForAction.id)}
          onSelectDefault={(id) => handleSelectDefaultAgent(id)}
          onEdit={(agent) => {
            openAgentDrawer({
              type: 'edit_custom',
              agent,
              onSaved: () => void loadAgents(),
            });
          }}
          onManageKeys={(agent) => {
            openAgentDrawer({
              type: 'edit_custom',
              agent,
              onSaved: () => void loadAgents(),
            });
          }}
          onDelete={(agentId, name) => {
            handleDeleteCustomAgent(undefined, agentId, name);
          }}
        />
      )}
    </div>
  );
}
