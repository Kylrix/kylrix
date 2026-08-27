'use client';

import React, { useState, useEffect, useCallback } from 'react';
import { 
  X, 
  Bot, 
  Sparkles, 
  Send, 
  Check, 
  Copy, 
  Lock, 
  RefreshCw,
  Key,
  Plus,
  Trash2,
  Terminal,
  ShieldCheck,
  AlertCircle,
  ArrowLeft
} from 'lucide-react';
import { SYSTEM_AGENTS, type SystemAgentDefinition } from '@/lib/agentic/system-agents';
import type { AgentRecord } from '@/lib/services/agentic';
import type { PatPublic } from '@/lib/services/pats';
import { createPat, listPats, revokePat } from '@/lib/actions/client-ops';
import { LocalEngine } from '@/lib/services/LocalEngine';
import { toast } from 'react-hot-toast';

export type AgentDrawerMode = 
  | { type: 'preview_system'; agent: SystemAgentDefinition }
  | { type: 'create_custom'; onCreated?: (created: any) => void }
  | { type: 'edit_custom'; agent: AgentRecord; onSaved?: () => void }
  | { type: 'select_default'; activeAgentId: string; onSelectDefault: (id: string) => void; customAgents: AgentRecord[] }
  | { type: 'manage_provisioning_keys' };

interface AgenticDrawerProps {
  mode: AgentDrawerMode;
  onClose: () => void;
}

export function AgenticSettingsDrawer({ mode, onClose }: AgenticDrawerProps) {
  const [copiedPrompt, setCopiedPrompt] = useState(false);

  // Custom Agent Creation Form State
  const [name, setName] = useState<string>(
    mode.type === 'edit_custom' ? (JSON.parse(mode.agent.config || '{}').name || '') : ''
  );
  const [role, setRole] = useState<string>(
    mode.type === 'edit_custom' ? (JSON.parse(mode.agent.config || '{}').role || '') : ''
  );
  const [prompt, setPrompt] = useState<string>(
    mode.type === 'edit_custom' ? (JSON.parse(mode.agent.config || '{}').goal || '') : ''
  );
  const [framework, setFramework] = useState<'kylrix' | 'openclaw' | 'hermes'>('kylrix');
  const [saving, setSaving] = useState(false);

  // Meta-Agent Chat Bar for recursive generation
  const [metaInput, setMetaInput] = useState<string>('');
  const [metaThinking, setMetaThinking] = useState(false);
  const [metaSuggestions, setMetaSuggestions] = useState<string[]>([]);

  // ── Agentic PATs State (under each agent) ──
  const [agentPats, setAgentPats] = useState<PatPublic[]>([]);
  const [loadingAgentPats, setLoadingAgentPats] = useState(false);
  const [newAgentPatName, setNewAgentPatName] = useState('');
  const [creatingAgentPat, setCreatingAgentPat] = useState(false);
  const [newlyCreatedToken, setNewlyCreatedToken] = useState<string | null>(null);
  const [copiedToken, setCopiedToken] = useState(false);

  // ── Provisioning Keys State ──
  const [apkList, setApkList] = useState<PatPublic[]>([]);
  const [loadingApk, setLoadingApk] = useState(false);
  const [isCreatingApkKey, setIsCreatingApkKey] = useState(false);
  const [newApkName, setNewApkName] = useState('');
  const [creatingApk, setCreatingApk] = useState(false);
  const [newlyCreatedApk, setNewlyCreatedApk] = useState<string | null>(null);
  const [copiedApk, setCopiedApk] = useState(false);

  // Load Agentic PATs for current custom agent with LocalEngine caching
  const loadAgentPats = useCallback(async () => {
    if (mode.type !== 'edit_custom') return;
    const cacheKey = `agent_pats_${mode.agent.$id}`;
    const cached = await LocalEngine.cacheGet<PatPublic[]>(cacheKey);
    if (cached && Array.isArray(cached)) {
      setAgentPats(cached);
      setLoadingAgentPats(false);
    } else {
      setLoadingAgentPats(true);
    }
    try {
      const res = await listPats({ category: 'agentic_pat', agentId: mode.agent.$id });
      if (res?.success) {
        const fresh = (res.data || []) as PatPublic[];
        setAgentPats(fresh);
        void LocalEngine.cacheSet(cacheKey, fresh);
      }
    } catch {
      if (!cached) setAgentPats([]);
    } finally {
      setLoadingAgentPats(false);
    }
  }, [mode]);

  // Load Provisioning Keys with LocalEngine instant caching
  const loadApkList = useCallback(async () => {
    if (mode.type !== 'manage_provisioning_keys') return;
    const cached = await LocalEngine.cacheGet<PatPublic[]>('apk_list_cache');
    if (cached && Array.isArray(cached)) {
      setApkList(cached);
      setLoadingApk(false);
    } else {
      setLoadingApk(true);
    }
    try {
      const res = await listPats({ category: 'agent_provisioning_key' });
      if (res?.success) {
        const fresh = (res.data || []) as PatPublic[];
        setApkList(fresh);
        void LocalEngine.cacheSet('apk_list_cache', fresh);
      }
    } catch {
      if (!cached) setApkList([]);
    } finally {
      setLoadingApk(false);
    }
  }, [mode]);

  useEffect(() => {
    if (mode.type === 'edit_custom') {
      void loadAgentPats();
    } else if (mode.type === 'manage_provisioning_keys') {
      void loadApkList();
    }
  }, [mode, loadAgentPats, loadApkList]);

  const handleCopyPrompt = (text: string) => {
    void navigator.clipboard.writeText(text);
    setCopiedPrompt(true);
    toast.success('System prompt copied to clipboard');
    setTimeout(() => setCopiedPrompt(false), 2000);
  };

  const handleMetaGenerate = async () => {
    if (!metaInput.trim()) return;
    setMetaThinking(true);
    const userGoal = metaInput.trim();
    setMetaInput('');

    setTimeout(() => {
      setName((prev: string) => prev || `${userGoal.slice(0, 16)} Assistant`);
      setRole((prev: string) => prev || `Specialized agent for ${userGoal}`);
      setPrompt(
        (prev: string) =>
          prev ||
          `You are a specialized agent in the Kylrix ecosystem focused on: ${userGoal}.\n\n` +
          `Guidelines:\n` +
          `- Provide step-by-step reasoning and concise answers.\n` +
          `- Act strictly within user-approved tool permissions.\n` +
          `- Format output using clean markdown and bullet points.`
      );
      setMetaSuggestions([
        'Add strict tool confirmation safeguards',
        'Set domain boundary to local notes & tasks only',
        'Enable fast concise tone',
      ]);
      setMetaThinking(false);
      toast.success('Agent draft generated by Meta Crafter');
    }, 600);
  };

  const handleSaveCustomAgent = async () => {
    if (!name.trim()) {
      toast.error('Agent name is required');
      return;
    }
    setSaving(true);
    try {
      const { AgenticService } = await import('@/lib/services/agentic');
      const { account } = await import('@/lib/appwrite/client');
      const user = await account.get().catch(() => null);
      if (!user?.$id) throw new Error('Sign in required');

      if (mode.type === 'create_custom') {
        const created = await AgenticService.createMyAgent({
          userId: user.$id,
          name: name.trim(),
          goal: prompt.trim() || undefined,
          framework,
        });
        toast.success(`${name} created successfully!`);
        mode.onCreated?.(created);
      } else if (mode.type === 'edit_custom') {
        const { tablesDB } = await import('@/lib/appwrite/client');
        const { APPWRITE_CONFIG } = await import('@/lib/appwrite/config');
        await tablesDB.updateRow(
          APPWRITE_CONFIG.DATABASES.FLOW,
          APPWRITE_CONFIG.TABLES.FLOW.AGENTS,
          mode.agent.$id,
          {
            config: JSON.stringify({
              name: name.trim(),
              role: role.trim(),
              goal: prompt.trim(),
              framework,
            }),
          }
        );
        toast.success('Agent updated');
        mode.onSaved?.();
      }
      onClose();
    } catch (err: any) {
      toast.error(err?.message || 'Failed to save agent');
    } finally {
      setSaving(false);
    }
  };

  // Create Agentic PAT under custom agent
  const handleCreateAgentPat = async () => {
    if (mode.type !== 'edit_custom') return;
    const tokenName = (newAgentPatName.trim() || `${name || 'Agent'} Token`).slice(0, 128);
    setCreatingAgentPat(true);
    try {
      const defaultAgentScopes = [
        'workspaces:read',
        'workspaces:write',
        'notes:read',
        'notes:write',
        'goals:read',
        'goals:write',
        'chats:read',
        'chats:write',
        'agents:read',
        'agents:write',
      ];
      const res = await createPat({
        name: `${tokenName} (Agentic PAT)`,
        scopes: defaultAgentScopes,
        keyCategory: 'agentic_pat',
        agentId: mode.agent.$id,
      });
      if (res?.token) {
        setNewlyCreatedToken(res.token);
        setNewAgentPatName('');
        toast.success('Agentic PAT created');
        void loadAgentPats();
      }
    } catch (err: any) {
      toast.error(err?.message || 'Failed to create agent token');
    } finally {
      setCreatingAgentPat(false);
    }
  };

  // Revoke Agentic PAT
  const handleRevokeAgentPat = async (patId: string) => {
    if (!confirm('Revoke this Agentic token? The agent will lose access.')) return;
    try {
      setAgentPats((prev) => {
        const next = prev.filter((p) => p.id !== patId);
        if (mode.type === 'edit_custom') {
          void LocalEngine.cacheSet(`agent_pats_${mode.agent.$id}`, next);
        }
        return next;
      });
      await revokePat(patId);
      toast.success('Token revoked');
    } catch (err: any) {
      toast.error(err?.message || 'Failed to revoke token');
      void loadAgentPats();
    }
  };

  // Create Agent Provisioning Key
  const handleCreateApk = async () => {
    const keyName = newApkName.trim().slice(0, 128);
    if (!keyName) {
      toast.error('Please enter a name for the provisioning key');
      return;
    }
    setCreatingApk(true);
    try {
      const res = await createPat({
        name: keyName,
        scopes: ['agents:provision'],
        keyCategory: 'agent_provisioning_key',
      });
      if (res?.token) {
        setNewlyCreatedApk(res.token);
        setNewApkName('');
        setIsCreatingApkKey(false);
        toast.success('Agent Provisioning Key created');
        void loadApkList();
      }
    } catch (err: any) {
      toast.error(err?.message || 'Failed to mint provisioning key');
    } finally {
      setCreatingApk(false);
    }
  };

  // Revoke Agent Provisioning Key
  const handleRevokeApk = async (patId: string) => {
    if (!confirm('Revoke this Agent Provisioning Key? CLI agents will no longer be able to use it.')) return;
    try {
      setApkList((prev) => {
        const next = prev.filter((p) => p.id !== patId);
        void LocalEngine.cacheSet('apk_list_cache', next);
        return next;
      });
      await revokePat(patId);
      toast.success('Key revoked');
    } catch (err: any) {
      toast.error(err?.message || 'Failed to revoke key');
      void loadApkList();
    }
  };

  return (
    <div className="flex h-full min-h-0 flex-col bg-[#161412] text-white font-satoshi">
      {/* Top Header */}
      <div className="flex items-center justify-between border-b border-white/[0.06] bg-[#161412] px-5 py-3.5 shrink-0">
        <div className="flex items-center gap-3">
          {mode.type === 'manage_provisioning_keys' && isCreatingApkKey && !newlyCreatedApk ? (
            <button
              type="button"
              onClick={() => {
                setIsCreatingApkKey(false);
                setNewApkName('');
              }}
              className="inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-xl bg-white/5 hover:bg-white/10 text-white/80 hover:text-white font-bold text-xs transition-colors cursor-pointer"
              title="Back to Keys"
            >
              <ArrowLeft size={14} />
              <span>Back</span>
            </button>
          ) : (
            <div className="h-8 w-8 rounded-lg bg-[#0A0908] border border-white/[0.06] grid place-items-center text-[#F59E0B]">
              {mode.type === 'manage_provisioning_keys' ? <Key size={16} /> : <Bot size={16} />}
            </div>
          )}
          <div>
            <p className="text-[10px] font-bold uppercase tracking-wider text-white/40 font-mono m-0">
              {mode.type === 'preview_system' && 'Internal System Agent'}
              {mode.type === 'create_custom' && 'Agent Crafter'}
              {mode.type === 'edit_custom' && 'Edit Custom Agent'}
              {mode.type === 'select_default' && 'Select Default Partner'}
              {mode.type === 'manage_provisioning_keys' && (isCreatingApkKey ? 'Mint Provisioning Key' : 'Security Keys')}
            </p>
            <h2 className="text-sm font-black font-clash text-white m-0 leading-tight mt-0.5">
              {mode.type === 'preview_system' && mode.agent.name}
              {mode.type === 'create_custom' && 'Create Custom Agent'}
              {mode.type === 'edit_custom' && name}
              {mode.type === 'select_default' && 'Active Agent Partner'}
              {mode.type === 'manage_provisioning_keys' && (isCreatingApkKey ? 'New Provisioning Key' : 'Agent Provisioning Keys')}
            </h2>
          </div>
        </div>
        <button
          type="button"
          onClick={onClose}
          className="p-1.5 rounded-lg text-white/40 hover:text-white hover:bg-white/5 transition-colors cursor-pointer"
          title="Close"
        >
          <X size={18} />
        </button>
      </div>

      {/* Main Drawer Body */}
      <div className="flex-1 overflow-y-auto px-5 py-5 space-y-6 min-h-0">
        {/* MODE 1: Preview System Agent (Kylie, Sidekick, Flow Architect, Meta Crafter) */}
        {mode.type === 'preview_system' && (
          <div className="space-y-6">
            {/* Identity Banner */}
            <div className="p-4 rounded-2xl bg-[#161412] border border-white/[0.06] flex items-center gap-3.5">
              <div className="w-12 h-12 rounded-xl bg-[#0A0908] border border-white/[0.06] text-2xl grid place-items-center shrink-0">
                {mode.agent.avatar}
              </div>
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-2">
                  <h3 className="text-base font-bold font-clash text-white m-0 truncate">
                    {mode.agent.name}
                  </h3>
                  <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-emerald-500/10 text-emerald-400 font-bold">
                    {mode.agent.badge}
                  </span>
                </div>
                <p className="text-xs text-white/50 m-0 mt-0.5">{mode.agent.role}</p>
              </div>
            </div>

            {/* Description */}
            <div className="p-3.5 rounded-xl bg-[#161412] border border-white/[0.06]">
              <p className="text-xs text-white/70 leading-relaxed m-0">{mode.agent.description}</p>
            </div>

            {/* Capabilities */}
            <div className="space-y-2.5">
              <h4 className="text-xs font-bold text-white/40 uppercase tracking-wider font-mono m-0">
                Capabilities & Scope
              </h4>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                {mode.agent.capabilities.map((cap) => (
                  <div
                    key={cap}
                    className="p-2.5 rounded-xl bg-[#161412] border border-white/[0.04] flex items-center gap-2 text-xs font-bold text-white/80"
                  >
                    <span className="w-1.5 h-1.5 rounded-full bg-[#F59E0B] shrink-0" />
                    <span className="truncate">{cap}</span>
                  </div>
                ))}
              </div>
            </div>

            {/* Live System Prompt (Read-only) */}
            <div className="space-y-2.5">
              <div className="flex items-center justify-between">
                <h4 className="text-xs font-bold text-white/40 uppercase tracking-wider font-mono m-0 flex items-center gap-1.5">
                  <Lock size={12} className="text-emerald-400" /> Immutable Core Prompt
                </h4>
                <button
                  type="button"
                  onClick={() => handleCopyPrompt(mode.agent.systemPrompt)}
                  className="inline-flex items-center gap-1 text-[11px] font-bold text-[#F59E0B] hover:text-[#F59E0B]/80 font-mono cursor-pointer"
                >
                  {copiedPrompt ? <Check size={11} /> : <Copy size={11} />}
                  <span>{copiedPrompt ? 'Copied' : 'Copy Prompt'}</span>
                </button>
              </div>
              <div className="p-3.5 rounded-xl bg-[#0A0908] border border-white/[0.06] font-mono text-xs text-white/75 leading-relaxed whitespace-pre-wrap select-all max-h-[300px] overflow-y-auto">
                {mode.agent.systemPrompt}
              </div>
            </div>
          </div>
        )}

        {/* MODE 2 & 3: Create or Edit Custom Agent */}
        {(mode.type === 'create_custom' || mode.type === 'edit_custom') && (
          <div className="space-y-6">
            {/* Meta-Agent Recursive Prompt Crafter */}
            <div className="p-4 rounded-2xl bg-[#161412] border border-white/[0.08] space-y-3 relative overflow-hidden">
              <div className="flex items-center gap-2">
                <Sparkles size={14} className="text-[#F59E0B]" />
                <span className="text-xs font-black font-clash text-white">Meta-Agent Crafter</span>
                <span className="text-[10px] font-mono px-1.5 py-0.5 rounded bg-[#F59E0B]/10 text-[#F59E0B] font-bold">
                  AI Generator
                </span>
              </div>
              <p className="text-xs text-white/45 m-0 leading-relaxed">
                Describe the task in plain English. Meta Crafter will write the persona and prompt rules.
              </p>

              <div className="flex gap-2">
                <input
                  value={metaInput}
                  onChange={(e) => setMetaInput(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') {
                      e.preventDefault();
                      void handleMetaGenerate();
                    }
                  }}
                  placeholder="e.g. Smart code reviewer for Solana escrow contracts..."
                  className="flex-1 h-9 rounded-xl bg-[#0A0908] border border-white/[0.06] px-3 text-xs text-white placeholder:text-white/30 focus:outline-none focus:border-[#F59E0B]/40"
                />
                <button
                  type="button"
                  onClick={handleMetaGenerate}
                  disabled={metaThinking || !metaInput.trim()}
                  className="h-9 px-3.5 rounded-xl bg-[#F59E0B] text-black text-xs font-extrabold flex items-center gap-1.5 disabled:opacity-40 cursor-pointer"
                >
                  {metaThinking ? <RefreshCw size={12} className="animate-spin" /> : <Send size={12} />}
                  <span>Generate</span>
                </button>
              </div>

              {metaSuggestions.length > 0 && (
                <div className="flex flex-wrap gap-1.5 pt-1">
                  {metaSuggestions.map((sug) => (
                    <button
                      key={sug}
                      type="button"
                      onClick={() => setPrompt((p) => `${p}\n- ${sug}`)}
                      className="text-[10px] font-mono px-2 py-0.5 rounded-full bg-[#0A0908] border border-white/[0.06] text-white/60 hover:text-white hover:border-[#F59E0B]/40 transition-colors cursor-pointer"
                    >
                      + {sug}
                    </button>
                  ))}
                </div>
              )}
            </div>

            {/* Name & Framework Inputs */}
            <div className="space-y-4">
              <div>
                <label className="text-xs font-bold text-white/60 uppercase tracking-wider font-mono block mb-1.5">
                  Agent Name
                </label>
                <input
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="e.g. Audit Co-Pilot"
                  className="w-full h-10 rounded-xl bg-[#161412] border border-white/[0.06] px-3 text-sm text-white placeholder:text-white/30 focus:outline-none focus:border-[#F59E0B]/40"
                />
              </div>

              <div>
                <label className="text-xs font-bold text-white/60 uppercase tracking-wider font-mono block mb-1.5">
                  Role / Description
                </label>
                <input
                  value={role}
                  onChange={(e) => setRole(e.target.value)}
                  placeholder="e.g. Audits code changes and verifies state transitions"
                  className="w-full h-10 rounded-xl bg-[#161412] border border-white/[0.06] px-3 text-sm text-white placeholder:text-white/30 focus:outline-none focus:border-[#F59E0B]/40"
                />
              </div>

              <div>
                <label className="text-xs font-bold text-white/60 uppercase tracking-wider font-mono block mb-1.5">
                  Runtime Architecture
                </label>
                <div className="grid grid-cols-3 gap-2">
                  {[
                    { id: 'kylrix', label: 'Kylrix Native' },
                    { id: 'openclaw', label: 'OpenClaw' },
                    { id: 'hermes', label: 'Hermes' },
                  ].map((fw) => (
                    <button
                      key={fw.id}
                      type="button"
                      onClick={() => setFramework(fw.id as any)}
                      className={`p-2.5 rounded-xl border text-xs font-bold transition-all cursor-pointer ${
                        framework === fw.id
                          ? 'bg-[#1C1A18] border-[#F59E0B] text-white'
                          : 'bg-[#161412] border-white/[0.06] text-white/40 hover:text-white'
                      }`}
                    >
                      {fw.label}
                    </button>
                  ))}
                </div>
              </div>

              {/* System Prompt instructions */}
              <div>
                <label className="text-xs font-bold text-white/60 uppercase tracking-wider font-mono block mb-1.5">
                  System Instructions & Prompt
                </label>
                <textarea
                  value={prompt}
                  onChange={(e) => setPrompt(e.target.value)}
                  rows={6}
                  placeholder="Define your agent's persona, operational boundaries, and response rules..."
                  className="w-full rounded-xl bg-[#0A0908] border border-white/[0.06] p-3 text-xs font-mono text-white placeholder:text-white/30 focus:outline-none focus:border-[#F59E0B]/40 leading-relaxed"
                />
              </div>
            </div>

            {/* ── Section: Agentic PATs under this Custom Agent ── */}
            {mode.type === 'edit_custom' && (
              <div className="pt-4 border-t border-white/[0.06] space-y-4">
                <div className="flex items-center justify-between">
                  <div>
                    <h4 className="text-xs font-bold text-white uppercase tracking-wider font-mono m-0 flex items-center gap-1.5">
                      <Key size={13} className="text-[#10B981]" />
                      <span>Agentic PATs (Operational Tokens)</span>
                    </h4>
                    <p className="text-[11px] text-white/40 m-0 mt-0.5">
                      Scoped tokens starting with <code className="text-emerald-400 font-mono">kyl_apat_</code> used exclusively by this agent.
                    </p>
                  </div>
                </div>

                {/* Newly Minted Token Banner */}
                {newlyCreatedToken && (
                  <div className="p-4 rounded-2xl bg-emerald-950/30 border border-emerald-500/30 space-y-2.5">
                    <div className="flex items-center justify-between">
                      <span className="text-xs font-bold text-emerald-400 flex items-center gap-1.5 font-mono">
                        <Check size={13} /> Token Generated (Shown Once)
                      </span>
                      <button
                        type="button"
                        onClick={async () => {
                          await navigator.clipboard.writeText(newlyCreatedToken);
                          setCopiedToken(true);
                          toast.success('Agentic PAT copied');
                          setTimeout(() => setCopiedToken(false), 2000);
                        }}
                        className="inline-flex items-center gap-1 text-[11px] font-bold text-emerald-400 hover:text-white cursor-pointer"
                      >
                        {copiedToken ? <Check size={12} /> : <Copy size={12} />}
                        <span>{copiedToken ? 'Copied' : 'Copy'}</span>
                      </button>
                    </div>
                    <code className="block text-[11px] font-mono text-white bg-black/50 border border-white/10 p-2.5 rounded-xl break-all select-all">
                      {newlyCreatedToken}
                    </code>
                    <p className="text-[10px] text-emerald-400/80 m-0">
                      Copy this token now. It will not be shown again.
                    </p>
                  </div>
                )}

                {/* Create Agentic PAT Input */}
                <div className="p-3.5 rounded-2xl bg-[#161412] border border-white/[0.06] space-y-2.5">
                  <div className="flex gap-2">
                    <input
                      value={newAgentPatName}
                      onChange={(e) => setNewAgentPatName(e.target.value)}
                      placeholder="e.g. Prod Runner PAT"
                      className="flex-1 h-9 rounded-xl bg-[#0A0908] border border-white/[0.06] px-3 text-xs text-white placeholder:text-white/30 focus:outline-none focus:border-[#10B981]/40"
                    />
                    <button
                      type="button"
                      onClick={handleCreateAgentPat}
                      disabled={creatingAgentPat}
                      className="h-9 px-3.5 rounded-xl bg-[#10B981] hover:bg-[#059669] text-black font-extrabold text-xs flex items-center gap-1.5 transition-colors cursor-pointer disabled:opacity-40"
                    >
                      {creatingAgentPat ? <RefreshCw size={12} className="animate-spin" /> : <Plus size={12} />}
                      <span>Mint Token</span>
                    </button>
                  </div>
                </div>

                {/* Active Agentic Tokens List */}
                <div className="space-y-2">
                  {loadingAgentPats ? (
                    <div className="p-4 rounded-xl bg-[#161412] text-xs text-white/40 flex items-center justify-center">
                      <RefreshCw size={13} className="animate-spin mr-2" /> Loading tokens...
                    </div>
                  ) : agentPats.length === 0 ? (
                    <div className="p-4 rounded-xl bg-[#161412] text-center text-xs text-white/35">
                      No operational tokens minted for this agent yet.
                    </div>
                  ) : (
                    agentPats.map((pat) => (
                      <div
                        key={pat.id}
                        className="p-3 rounded-xl bg-[#161412] border border-white/[0.04] flex items-center justify-between gap-3"
                      >
                        <div className="min-w-0 flex-1">
                          <div className="flex items-center gap-2">
                            <span className="text-xs font-bold text-white truncate">{pat.name}</span>
                            <span className="text-[9px] font-mono px-1.5 py-0.2 rounded bg-emerald-500/10 text-emerald-400 font-bold">
                              kyl_apat_{pat.tokenPrefix}…
                            </span>
                          </div>
                          <p className="text-[10px] text-white/30 font-mono m-0 mt-0.5">
                            Active • Created {pat.createdAt ? new Date(pat.createdAt).toLocaleDateString() : 'recently'}
                          </p>
                        </div>
                        <button
                          type="button"
                          onClick={() => handleRevokeAgentPat(pat.id)}
                          className="p-1.5 rounded-lg text-white/30 hover:text-red-400 hover:bg-white/[0.04] transition-colors cursor-pointer"
                          title="Revoke Token"
                        >
                          <Trash2 size={13} />
                        </button>
                      </div>
                    ))
                  )}
                </div>
              </div>
            )}
          </div>
        )}

        {/* MODE 4: Select Active Default Agent (Kylie vs Custom Agents ONLY) */}
        {mode.type === 'select_default' && (
          <div className="space-y-4">
            <div className="p-3.5 rounded-xl bg-[#161412] border border-white/[0.06]">
              <p className="text-xs text-white/70 leading-relaxed m-0">
                Kylie is the default ecosystem agent. You can replace Kylie with any user-defined custom agent you created.
              </p>
            </div>

            <div className="space-y-2.5">
              {/* Kylie (Default Internal Core) */}
              <div
                onClick={() => {
                  mode.onSelectDefault('kylie');
                  toast.success('Default agent set to Kylie');
                  onClose();
                }}
                className={`p-4 rounded-2xl border transition-all cursor-pointer flex items-center justify-between ${
                  mode.activeAgentId === 'kylie' || !mode.activeAgentId
                    ? 'bg-[#1C1A18] border-[#F59E0B]'
                    : 'bg-[#161412] border-white/[0.06] hover:border-white/15'
                }`}
              >
                <div className="flex items-center gap-3.5">
                  <div className="w-10 h-10 rounded-xl bg-[#0A0908] border border-white/[0.06] text-xl grid place-items-center shrink-0">
                    ✨
                  </div>
                  <div>
                    <div className="flex items-center gap-2">
                      <h4 className="text-sm font-bold text-white m-0">Kylie</h4>
                      <span className="text-[9px] font-mono px-1.5 py-0.2 rounded bg-emerald-500/10 text-emerald-400 font-bold">
                        Internal Core
                      </span>
                    </div>
                    <p className="text-xs text-white/40 m-0 mt-0.5">Primary workspace companion</p>
                  </div>
                </div>
                {(mode.activeAgentId === 'kylie' || !mode.activeAgentId) && (
                  <span className="h-6 w-6 rounded-full bg-[#F59E0B] text-black grid place-items-center">
                    <Check size={14} strokeWidth={3} />
                  </span>
                )}
              </div>

              {/* Custom User Agents ONLY */}
              {mode.customAgents.length > 0 && (
                <div className="pt-2">
                  <p className="text-[10px] font-bold uppercase tracking-wider text-white/40 font-mono mb-2">
                    Your Custom Agents
                  </p>
                  <div className="space-y-2">
                    {mode.customAgents.map((ca) => {
                      const cfg = JSON.parse(ca.config || '{}');
                      const isSelected = mode.activeAgentId === ca.$id;
                      return (
                        <div
                          key={ca.$id}
                          onClick={() => {
                            mode.onSelectDefault(ca.$id);
                            toast.success(`Default agent set to ${cfg.name || 'Custom Agent'}`);
                            onClose();
                          }}
                          className={`p-4 rounded-2xl border transition-all cursor-pointer flex items-center justify-between ${
                            isSelected
                              ? 'bg-[#1C1A18] border-[#F59E0B]'
                              : 'bg-[#161412] border-white/[0.06] hover:border-white/15'
                          }`}
                        >
                          <div className="flex items-center gap-3.5">
                            <div className="w-10 h-10 rounded-xl bg-[#0A0908] border border-white/[0.06] text-lg grid place-items-center text-[#6366F1] shrink-0 font-bold">
                              <Bot size={18} />
                            </div>
                            <div>
                              <div className="flex items-center gap-2">
                                <h4 className="text-sm font-bold text-white m-0">{cfg.name || 'Custom Agent'}</h4>
                                <span className="text-[9px] font-mono px-1.5 py-0.2 rounded bg-[#6366F1]/10 text-[#818cf8] font-bold">
                                  {cfg.framework || 'kylrix'}
                                </span>
                              </div>
                              <p className="text-xs text-white/40 m-0 mt-0.5">{cfg.role || 'Custom user partner'}</p>
                            </div>
                          </div>
                          {isSelected && (
                            <span className="h-6 w-6 rounded-full bg-[#F59E0B] text-black grid place-items-center">
                              <Check size={14} strokeWidth={3} />
                            </span>
                          )}
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}
            </div>
          </div>
        )}

        {/* MODE 5: Manage Agent Provisioning Keys (kyl_apk_...) */}
        {mode.type === 'manage_provisioning_keys' && (
          <div className="space-y-6">
            {/* STATE 1: Newly Created APK Banner (Shown Once) */}
            {newlyCreatedApk ? (
              <div className="space-y-4">
                <div className="p-4 rounded-2xl bg-[#6366F1]/10 border border-[#6366F1]/30 space-y-3">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-bold text-[#818cf8] flex items-center gap-1.5 font-mono">
                      <Check size={13} /> Provisioning Key Generated (Shown Once)
                    </span>
                    <button
                      type="button"
                      onClick={async () => {
                        await navigator.clipboard.writeText(newlyCreatedApk);
                        setCopiedApk(true);
                        toast.success('Provisioning key copied');
                        setTimeout(() => setCopiedApk(false), 2000);
                      }}
                      className="inline-flex items-center gap-1 text-[11px] font-bold text-[#818cf8] hover:text-white cursor-pointer"
                    >
                      {copiedApk ? <Check size={12} /> : <Copy size={12} />}
                      <span>{copiedApk ? 'Copied' : 'Copy Key'}</span>
                    </button>
                  </div>
                  <code className="block text-[11px] font-mono text-white bg-black/50 border border-white/10 p-3 rounded-xl break-all select-all">
                    {newlyCreatedApk}
                  </code>
                  <p className="text-xs text-white/60 m-0 leading-relaxed">
                    Copy and export this key as <code className="text-[#818cf8] font-mono">KYLRIX_AGENT_KEY</code> in your agent terminal. It will not be shown again.
                  </p>
                </div>
              </div>
            ) : isCreatingApkKey ? (
              /* STATE 2: Dedicated Key Name Selection & Creation Form */
              <div className="space-y-4">
                <div className="p-4 rounded-2xl bg-[#0A0908] border border-white/[0.06] space-y-3">
                  <div>
                    <label className="text-xs font-bold text-white uppercase tracking-wider font-mono block mb-1">
                      Key Name / Environment <span className="text-[#6366F1]">*</span>
                    </label>
                    <p className="text-xs text-white/50 m-0 mb-3">
                      Assign a clear label to identify which external agent or device will use this key.
                    </p>
                    <input
                      value={newApkName}
                      onChange={(e) => setNewApkName(e.target.value)}
                      placeholder="e.g. Cursor Local Agent, CI Pipeline, Home Server"
                      autoFocus
                      className="w-full h-11 rounded-xl bg-[#161412] border border-white/[0.08] px-3.5 text-xs text-white placeholder:text-white/30 focus:outline-none focus:border-[#6366F1] transition-colors"
                      onKeyDown={(e) => {
                        if (e.key === 'Enter' && newApkName.trim()) {
                          e.preventDefault();
                          void handleCreateApk();
                        }
                      }}
                    />
                  </div>
                </div>

                <div className="p-4 rounded-2xl bg-[#0A0908] border border-white/[0.06] space-y-2">
                  <div className="flex items-center gap-2 text-white font-bold text-xs">
                    <ShieldCheck size={15} className="text-[#6366F1]" />
                    <span>Granted Scope & Permissions</span>
                  </div>
                  <div className="flex items-center gap-2 pt-1">
                    <span className="text-[11px] font-mono px-2.5 py-1 rounded-lg bg-[#6366F1]/10 border border-[#6366F1]/20 text-[#818cf8] font-bold">
                      agents:provision
                    </span>
                  </div>
                  <p className="text-xs text-white/40 m-0 pt-1 leading-relaxed">
                    Zero-trust root permission. Allows external agent daemons to authenticate, declare identities, and request scoped runtime session PATs. Does not grant direct access to your notes or vault.
                  </p>
                </div>
              </div>
            ) : (
              /* STATE 3: Active Keys List & Zero-Trust Architecture Info */
              <div className="space-y-6">
                <div className="p-4 rounded-2xl bg-[#0A0908] border border-white/[0.06] space-y-2">
                  <div className="flex items-center gap-2 text-white font-bold text-xs">
                    <ShieldCheck size={15} className="text-[#6366F1]" />
                    <span>Zero-Trust Provisioning Architecture</span>
                  </div>
                  <p className="text-xs text-white/50 m-0 leading-relaxed">
                    Agent Provisioning Keys (<code className="text-[#818cf8] font-mono">kyl_apk_…</code>) only have permission to register agent identities and mint scoped Agentic PATs. They cannot access your notes or vault.
                  </p>
                </div>

                {/* Active Provisioning Keys List */}
                <div className="space-y-2.5">
                  <h4 className="text-xs font-bold text-white/40 uppercase tracking-wider font-mono m-0">
                    Active Provisioning Keys
                  </h4>

                  {loadingApk ? (
                    <div className="p-6 rounded-2xl bg-[#0A0908] border border-white/5 flex items-center justify-center text-white/40 text-xs">
                      <RefreshCw size={14} className="animate-spin mr-2" /> Loading keys...
                    </div>
                  ) : apkList.length === 0 ? (
                    <div className="p-6 rounded-2xl bg-[#0A0908] border border-white/5 text-center text-xs text-white/40">
                      No active provisioning keys. Click below to generate one.
                    </div>
                  ) : (
                    apkList.map((apk) => (
                      <div
                        key={apk.id}
                        className="p-4 rounded-2xl bg-[#0A0908] border border-white/[0.06] flex items-center justify-between gap-3"
                      >
                        <div className="min-w-0 flex-1">
                          <div className="flex items-center gap-2">
                            <h4 className="text-xs font-bold text-white truncate m-0">{apk.name}</h4>
                            <span className="text-[9px] font-mono px-1.5 py-0.2 rounded bg-[#6366F1]/10 text-[#818cf8] font-bold">
                              kyl_apk_{apk.tokenPrefix}…
                            </span>
                          </div>
                          <p className="text-[10px] text-white/30 font-mono m-0 mt-0.5">
                            Scope: agents:provision • Created {apk.createdAt ? new Date(apk.createdAt).toLocaleDateString() : 'recently'}
                          </p>
                        </div>
                        <button
                          type="button"
                          onClick={() => handleRevokeApk(apk.id)}
                          className="p-2 rounded-lg text-white/30 hover:text-red-400 hover:bg-white/[0.04] transition-colors cursor-pointer"
                          title="Revoke Key"
                        >
                          <Trash2 size={14} />
                        </button>
                      </div>
                    ))
                  )}
                </div>
              </div>
            )}
          </div>
        )}
      </div>

      {/* Fixed Non-Scrolling Bottom Action Bars */}
      {(mode.type === 'create_custom' || mode.type === 'edit_custom') && (
        <div className="shrink-0 border-t border-white/[0.06] bg-[#161412] px-5 py-3 md:py-3.5 z-10 flex items-center gap-2">
          <button
            type="button"
            onClick={onClose}
            className="px-4 h-10 rounded-xl bg-white/5 hover:bg-white/10 text-white/60 hover:text-white font-bold text-xs transition-colors cursor-pointer"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={handleSaveCustomAgent}
            disabled={saving || !name.trim()}
            className="flex-1 h-10 rounded-xl bg-[#F59E0B] text-black text-xs font-extrabold flex items-center justify-center gap-2 hover:bg-[#F59E0B]/90 transition-colors disabled:opacity-40 cursor-pointer shadow-lg shadow-[#F59E0B]/10"
          >
            {saving ? <RefreshCw size={14} className="animate-spin" /> : <Check size={14} />}
            <span>{mode.type === 'create_custom' ? 'Mint Custom Agent' : 'Save Agent Details'}</span>
          </button>
        </div>
      )}

      {mode.type === 'manage_provisioning_keys' && (
        <div className="shrink-0 border-t border-white/[0.06] bg-[#161412] px-5 py-3 md:py-3.5 z-10">
          {newlyCreatedApk ? (
            <div className="flex items-center justify-between gap-3">
              <button
                type="button"
                onClick={async () => {
                  await navigator.clipboard.writeText(newlyCreatedApk);
                  setCopiedApk(true);
                  toast.success('Provisioning key copied');
                  setTimeout(() => setCopiedApk(false), 2000);
                }}
                className="px-4 h-10 rounded-xl bg-white/10 hover:bg-white/15 text-white font-bold text-xs flex items-center gap-1.5 transition-colors cursor-pointer"
              >
                {copiedApk ? <Check size={14} /> : <Copy size={14} />}
                <span>{copiedApk ? 'Copied Key' : 'Copy Key'}</span>
              </button>
              <button
                type="button"
                onClick={() => {
                  setNewlyCreatedApk(null);
                  setIsCreatingApkKey(false);
                  setNewApkName('');
                }}
                className="px-6 h-10 rounded-xl bg-[#6366F1] hover:bg-[#5254E8] text-white font-extrabold text-xs transition-colors cursor-pointer ml-auto"
              >
                Done
              </button>
            </div>
          ) : isCreatingApkKey ? (
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => {
                  setIsCreatingApkKey(false);
                  setNewApkName('');
                }}
                className="px-4 h-10 rounded-xl bg-white/5 hover:bg-white/10 text-white/60 hover:text-white font-bold text-xs transition-colors cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleCreateApk}
                disabled={creatingApk || !newApkName.trim()}
                className="flex-1 h-10 rounded-xl bg-[#6366F1] hover:bg-[#5254E8] text-white font-extrabold text-xs flex items-center justify-center gap-2 transition-colors cursor-pointer disabled:opacity-40 shadow-lg shadow-[#6366F1]/10"
              >
                {creatingApk ? <RefreshCw size={13} className="animate-spin" /> : <Plus size={13} />}
                <span>Generate Key</span>
              </button>
            </div>
          ) : (
            <button
              type="button"
              onClick={() => {
                setIsCreatingApkKey(true);
                setNewApkName('');
              }}
              className="w-full h-10 rounded-xl bg-[#6366F1] hover:bg-[#5254E8] text-white font-extrabold text-xs flex items-center justify-center gap-2 transition-colors cursor-pointer shadow-lg shadow-[#6366F1]/10"
            >
              <Plus size={14} />
              <span>Generate Provisioning Key</span>
            </button>
          )}
        </div>
      )}
    </div>
  );
}
