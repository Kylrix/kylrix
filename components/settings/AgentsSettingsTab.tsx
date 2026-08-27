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
      <div className="p-6 bg-[#161412] border border-white/10 rounded-[28px] shadow-2xl space-y-4">
        <div className="flex items-center justify-between gap-4 flex-wrap">
          <div className="flex items-center gap-3.5 min-w-0">
            <div className="w-12 h-12 rounded-2xl bg-[#F59E0B]/12 border border-[#F59E0B]/30 text-[#F59E0B] flex items-center justify-center text-xl shrink-0">
              {isCustomDefault ? '🤖' : '✨'}
            </div>
            <div className="min-w-0">
              <div className="flex items-center gap-2">
                <h3 className="text-white font-black text-base font-clash m-0 truncate">
                  {activeDefaultName}
                </h3>
                <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-[#F59E0B]/15 text-[#F59E0B] font-bold border border-[#F59E0B]/20">
                  Active Default
                </span>
              </div>
              <p className="text-white/50 text-xs font-semibold m-0 mt-0.5 truncate">
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

      {/* ── Section 2: Agent Ecosystem Catalogs & Controls (Canonical OpenBricks 4.0 Gateway Grid) ── */}
      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <div>
            <h3 className="text-white font-black text-lg tracking-tight leading-tight flex items-center gap-2 font-mono m-0">
              <Sparkles size={18} className="text-[#6366F1]" />
              <span>Agents & Integrations</span>
            </h3>
            <p className="text-white/40 text-xs font-semibold mt-0.5 m-0">
              Autonomous personas, system specialists, terminal skills, and LLM compute.
            </p>
          </div>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3.5">
          {/* Card 1: Custom Autonomous Agents */}
          <div
            onClick={() =>
              openAgentDrawer({
                type: 'list_custom',
                customAgents,
                defaultAgentId,
                onSelectAgent: (ca) => setSelectedAgentForAction(ca),
                onCreateAgent: () =>
                  openAgentDrawer({
                    type: 'create_custom',
                    onCreated: () => void loadAgents(),
                  }),
                onDeleteAgent: (id, name) => handleDeleteCustomAgent(undefined, id, name),
              })
            }
            className="p-4 bg-[#161412] border border-white/10 hover:border-[#6366F1]/40 hover:bg-[#1C1A18] rounded-[22px] shadow-xl flex flex-col justify-between gap-3.5 transition-all duration-200 cursor-pointer group"
          >
            <div className="flex items-center gap-3 min-w-0">
              <div className="w-10 h-10 rounded-xl bg-[#6366F1]/10 text-[#818CF8] flex items-center justify-center shrink-0 border border-[#6366F1]/20">
                <Bot size={18} />
              </div>
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-1.5 flex-wrap">
                  <h4 className="text-white font-bold text-xs font-clash m-0 truncate group-hover:text-[#818CF8] transition-colors">
                    Custom Agents
                  </h4>
                  <span className="text-[9px] font-mono px-1.5 py-0.2 rounded bg-[#6366F1]/15 text-[#818cf8] font-bold border border-[#6366F1]/20">
                    {customAgents.length} Active
                  </span>
                </div>
                <p className="text-white/40 text-[11px] m-0 mt-0.5 truncate">
                  {customAgents.length > 0
                    ? `${customAgents.length} autonomous agent${customAgents.length > 1 ? 's' : ''} configured`
                    : 'Build custom subagents with PATs'}
                </p>
              </div>
            </div>
            <div className="flex items-center justify-between text-[11px] font-mono text-[#818CF8] border-t border-white/10 pt-2">
              <span>View & Manage Catalog</span>
              <ChevronRight size={12} />
            </div>
          </div>

          {/* Card 2: Internal System Specialists */}
          <div
            onClick={() =>
              openAgentDrawer({
                type: 'list_system',
                onSelectAgent: (sa) => setSelectedAgentForAction(sa),
              })
            }
            className="p-4 bg-[#161412] border border-white/10 hover:border-[#F59E0B]/40 hover:bg-[#1C1A18] rounded-[22px] shadow-xl flex flex-col justify-between gap-3.5 transition-all duration-200 cursor-pointer group"
          >
            <div className="flex items-center gap-3 min-w-0">
              <div className="w-10 h-10 rounded-xl bg-[#F59E0B]/10 text-[#F59E0B] flex items-center justify-center text-lg shrink-0 border border-[#F59E0B]/20">
                ✨
              </div>
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-1.5 flex-wrap">
                  <h4 className="text-white font-bold text-xs font-clash m-0 truncate group-hover:text-[#F59E0B] transition-colors">
                    System Specialists
                  </h4>
                  <span className="text-[9px] font-mono px-1.5 py-0.2 rounded bg-[#F59E0B]/15 text-[#F59E0B] font-bold border border-[#F59E0B]/20">
                    {SYSTEM_AGENTS.length} Core
                  </span>
                </div>
                <p className="text-white/40 text-[11px] m-0 mt-0.5 truncate">
                  Kylie, Sidekick, Flow, Meta Crafter
                </p>
              </div>
            </div>
            <div className="flex items-center justify-between text-[11px] font-mono text-[#F59E0B] border-t border-white/10 pt-2">
              <span>Inspect Personas & Prompts</span>
              <ChevronRight size={12} />
            </div>
          </div>

          {/* Card 3: Provisioning Keys (APK) */}
          <div
            onClick={() => openAgentDrawer({ type: 'manage_provisioning_keys' })}
            className="p-4 bg-[#161412] border border-white/10 hover:border-[#6366F1]/40 hover:bg-[#1C1A18] rounded-[22px] shadow-xl flex flex-col justify-between gap-3.5 transition-all duration-200 cursor-pointer group"
          >
            <div className="flex items-center gap-3 min-w-0">
              <div className="w-10 h-10 rounded-xl bg-[#6366F1]/10 text-[#818CF8] flex items-center justify-center shrink-0 border border-[#6366F1]/20">
                <Key size={18} />
              </div>
              <div className="min-w-0 flex-1">
                <h4 className="text-white font-bold text-xs font-clash m-0 truncate group-hover:text-[#818CF8] transition-colors">
                  Provisioning Keys (APK)
                </h4>
                <p className="text-white/40 text-[11px] m-0 mt-0.5 truncate">Root keys for CLI subagents</p>
              </div>
            </div>
            <div className="flex items-center justify-between text-[11px] font-mono text-[#818CF8] border-t border-white/10 pt-2">
              <span>Manage Security Keys</span>
              <ChevronRight size={12} />
            </div>
          </div>

          {/* Card 4: CLI Skill Integration */}
          <div
            onClick={() => openAgentDrawer({ type: 'manage_cli_skill' })}
            className="p-4 bg-[#161412] border border-white/10 hover:border-white/25 hover:bg-[#1C1A18] rounded-[22px] shadow-xl flex flex-col justify-between gap-3.5 transition-all duration-200 cursor-pointer group"
          >
            <div className="flex items-center gap-3 min-w-0">
              <div className="w-10 h-10 rounded-xl bg-white/5 text-white/70 flex items-center justify-center shrink-0 border border-white/10">
                <Terminal size={18} />
              </div>
              <div className="min-w-0 flex-1">
                <h4 className="text-white font-bold text-xs font-clash m-0 truncate group-hover:text-white transition-colors">
                  Agent Skill & CLI
                </h4>
                <p className="text-white/40 text-[11px] m-0 mt-0.5 truncate">npx skills add kylrix/agents</p>
              </div>
            </div>
            <div className="flex items-center justify-between text-[11px] font-mono text-white/50 border-t border-white/10 pt-2">
              <span>View Terminal Setup</span>
              <ChevronRight size={12} />
            </div>
          </div>

          {/* Card 5: Compute & BYOK */}
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
            className="p-4 bg-[#161412] border border-white/10 hover:border-emerald-500/40 hover:bg-[#1C1A18] rounded-[22px] shadow-xl flex flex-col justify-between gap-3.5 transition-all duration-200 cursor-pointer group"
          >
            <div className="flex items-center gap-3 min-w-0">
              <div className="w-10 h-10 rounded-xl bg-emerald-500/10 text-emerald-400 flex items-center justify-center shrink-0 border border-emerald-500/20">
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
            <div className="flex items-center justify-between text-[11px] font-mono text-emerald-400 border-t border-white/10 pt-2">
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
