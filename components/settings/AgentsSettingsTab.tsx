'use client';

import React, { useState, useEffect, useCallback } from 'react';
import { 
  Bot, 
  Plus, 
  Key, 
  Radio, 
  ChevronRight, 
  Terminal, 
  Zap
} from 'lucide-react';
import { useAuth } from '@/lib/auth';
import { toast } from 'react-hot-toast';
import { BYOKManager } from '@/lib/ai/byok';
import { AgenticService, type AgentRecord } from '@/lib/services/agentic';
import { SYSTEM_AGENTS } from '@/lib/agentic/system-agents';
import { LocalEngine } from '@/lib/services/LocalEngine';
import { AgenticSettingsDrawer, type AgentDrawerMode } from './AgenticSettingsDrawer';
import { AgentActionDrawer } from './AgentActionDrawer';
import { useDynamicSidebar } from '@/components/ui/DynamicSidebar';
import { useOverlay } from '@/components/ui/OverlayContext';

export function AgentsSettingsTab() {
  const { user } = useAuth();
  const { openSidebar, closeSidebar } = useDynamicSidebar();
  const { openOverlay, closeOverlay } = useOverlay();

  const [customAgents, setCustomAgents] = useState<AgentRecord[]>([]);
  const [_loadingAgents, setLoadingAgents] = useState(true);
  const [defaultAgentId, setDefaultAgentId] = useState<string>('kylie');
  const [selectedAgentForAction, setSelectedAgentForAction] = useState<any | null>(null);
  const [hasByok, setHasByok] = useState(false);
  const [_byokLoading, setByokLoading] = useState(true);
  const [computeState, setComputeState] = useState<{
    balance: number;
    maxBalance: number;
    tier: string;
    percent: number;
  } | null>(null);
  const [_loadingCompute, setLoadingCompute] = useState(true);

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

  useEffect(() => {
    void LocalEngine.cacheGet<string>('kylrix_default_agent_id').then((saved) => {
      if (saved) setDefaultAgentId(saved);
    });
  }, []);

  const handleSelectDefaultAgent = (id: string) => {
    setDefaultAgentId(id);
    void LocalEngine.cacheSet('kylrix_default_agent_id', id);
  };

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
      // Non-blocking
    } finally {
      setLoadingCompute(false);
    }
  }, []);

  useEffect(() => {
    if (user?.$id) {
      void loadComputeBalance();
    }
  }, [user?.$id, loadComputeBalance]);

  const activeCustomAgent = customAgents.find((a) => a.$id === defaultAgentId);
  const activeDefaultName = activeCustomAgent
    ? JSON.parse(activeCustomAgent.config || '{}').name || 'Custom Agent'
    : 'Kylie';
  const activeDefaultRole = activeCustomAgent
    ? JSON.parse(activeCustomAgent.config || '{}').role || 'Custom assistant'
    : 'Default assistant';
  const isCustomDefault = !!activeCustomAgent;

  return (
    <div className="space-y-6 font-satoshi">
      {/* Agent keys */}
      <div className="p-6 bg-[#161412] border border-white/10 rounded-[28px] shadow-2xl space-y-4">
        <div className="flex items-start justify-between gap-4 flex-wrap">
          <div className="min-w-0 space-y-1">
            <div className="flex items-center gap-2">
              <Key size={16} className="text-[#818cf8] shrink-0" />
              <h3 className="text-white font-black text-base font-clash m-0">Agent keys</h3>
            </div>
            <p className="text-white/50 text-sm m-0 max-w-xl leading-relaxed">
              For autonomous agents that run in their own workspace. The agent uses this key once to provision itself and mint its own token.
            </p>
            <p className="text-white/35 text-xs m-0">
              For IDE tools or scripts on <span className="text-white/50">your</span> workspace, use a PAT in Developers instead.
            </p>
          </div>
          <button
            type="button"
            onClick={() => openAgentDrawer({ type: 'manage_provisioning_keys' })}
            className="h-10 px-4 rounded-xl bg-[#6366F1] hover:bg-[#5254E8] text-white font-extrabold text-xs flex items-center gap-1.5 transition-all cursor-pointer shadow-md shrink-0"
          >
            <Plus size={13} />
            <span>Mint agent key</span>
          </button>
        </div>
      </div>

      {/* Default assistant */}
      <div className="p-5 bg-[#161412] border border-white/10 rounded-[22px] space-y-3">
        <p className="text-[10px] font-bold uppercase tracking-wider text-white/40 font-mono m-0">Default assistant</p>
        <div className="flex items-center justify-between gap-4 flex-wrap">
          <div className="flex items-center gap-3 min-w-0">
            <div className="w-10 h-10 rounded-xl bg-[#F59E0B]/12 border border-[#F59E0B]/30 text-[#F59E0B] flex items-center justify-center text-lg shrink-0">
              {isCustomDefault ? '🤖' : '✨'}
            </div>
            <div className="min-w-0">
              <h4 className="text-white font-bold text-sm m-0 truncate">{activeDefaultName}</h4>
              <p className="text-white/40 text-xs m-0 mt-0.5 truncate">{activeDefaultRole}</p>
            </div>
          </div>
          <div className="flex items-center gap-2">
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
              className="h-9 px-3 rounded-xl bg-white/[0.06] hover:bg-white/[0.12] border border-white/10 text-white font-bold text-xs flex items-center gap-1.5 transition-all cursor-pointer"
            >
              <Radio size={13} />
              <span>Change</span>
            </button>
            <button
              type="button"
              onClick={() =>
                openAgentDrawer({
                  type: 'create_custom',
                  onCreated: () => void loadAgents(),
                })
              }
              className="h-9 px-3 rounded-xl bg-white/[0.06] hover:bg-white/[0.12] border border-white/10 text-white font-bold text-xs flex items-center gap-1.5 transition-all cursor-pointer"
            >
              <Plus size={13} />
              <span>New agent</span>
            </button>
          </div>
        </div>
      </div>

      {/* More */}
      <div className="space-y-3">
        <h3 className="text-white/40 text-xs font-bold uppercase tracking-wider font-mono m-0">More</h3>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
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
            className="p-4 bg-[#161412] border border-white/10 hover:border-[#6366F1]/40 hover:bg-[#1C1A18] rounded-[22px] flex items-center justify-between gap-3 transition-all cursor-pointer group"
          >
            <div className="flex items-center gap-3 min-w-0">
              <div className="w-9 h-9 rounded-xl bg-[#6366F1]/10 text-[#818CF8] flex items-center justify-center shrink-0 border border-[#6366F1]/20">
                <Bot size={16} />
              </div>
              <div className="min-w-0">
                <h4 className="text-white font-bold text-xs m-0">Custom agents</h4>
                <p className="text-white/40 text-[11px] m-0">{customAgents.length} configured</p>
              </div>
            </div>
            <ChevronRight size={14} className="text-white/30 group-hover:text-[#818CF8]" />
          </div>

          <div
            onClick={() =>
              openAgentDrawer({
                type: 'list_system',
                onSelectAgent: (sa) => setSelectedAgentForAction(sa),
              })
            }
            className="p-4 bg-[#161412] border border-white/10 hover:border-[#F59E0B]/40 hover:bg-[#1C1A18] rounded-[22px] flex items-center justify-between gap-3 transition-all cursor-pointer group"
          >
            <div className="flex items-center gap-3 min-w-0">
              <div className="w-9 h-9 rounded-xl bg-[#F59E0B]/10 text-[#F59E0B] flex items-center justify-center shrink-0 border border-[#F59E0B]/20">
                ✨
              </div>
              <div className="min-w-0">
                <h4 className="text-white font-bold text-xs m-0">Built-in agents</h4>
                <p className="text-white/40 text-[11px] m-0">{SYSTEM_AGENTS.length} included</p>
              </div>
            </div>
            <ChevronRight size={14} className="text-white/30 group-hover:text-[#F59E0B]" />
          </div>

          <div
            onClick={() => openAgentDrawer({ type: 'manage_cli_skill' })}
            className="p-4 bg-[#161412] border border-white/10 hover:border-white/25 hover:bg-[#1C1A18] rounded-[22px] flex items-center justify-between gap-3 transition-all cursor-pointer group"
          >
            <div className="flex items-center gap-3 min-w-0">
              <div className="w-9 h-9 rounded-xl bg-white/5 text-white/70 flex items-center justify-center shrink-0 border border-white/10">
                <Terminal size={16} />
              </div>
              <div className="min-w-0">
                <h4 className="text-white font-bold text-xs m-0">Terminal setup</h4>
                <p className="text-white/40 text-[11px] m-0">Skills & env exports</p>
              </div>
            </div>
            <ChevronRight size={14} className="text-white/30 group-hover:text-white/60" />
          </div>

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
            className="p-4 bg-[#161412] border border-white/10 hover:border-emerald-500/40 hover:bg-[#1C1A18] rounded-[22px] flex items-center justify-between gap-3 transition-all cursor-pointer group"
          >
            <div className="flex items-center gap-3 min-w-0">
              <div className="w-9 h-9 rounded-xl bg-emerald-500/10 text-emerald-400 flex items-center justify-center shrink-0 border border-emerald-500/20">
                <Zap size={16} />
              </div>
              <div className="min-w-0">
                <h4 className="text-white font-bold text-xs m-0">Gemini API key</h4>
                <p className="text-white/40 text-[11px] m-0">{hasByok ? 'Private key active' : 'Shared daily pool'}</p>
              </div>
            </div>
            <ChevronRight size={14} className="text-white/30 group-hover:text-emerald-400" />
          </div>
        </div>
      </div>

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
