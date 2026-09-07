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
  ArrowLeft,
  ChevronRight
} from 'lucide-react';
import { SYSTEM_AGENTS, type SystemAgentDefinition } from '@/lib/agentic/system-agents';
import type { AgentRecord } from '@/lib/services/agentic';
import type { PatPublic } from '@/lib/services/pats';
import { createPat, listPats, revokePat } from '@/lib/actions/client-ops';
import { LocalEngine } from '@/lib/services/LocalEngine';
import { toast } from 'react-hot-toast';
import { KYLRIX_SKILLS_INSTALL } from '@/lib/api/public';
import { handleSaveCustomAgent as handleSaveCustomAgent_ext } from './AgenticSettingsDrawerSections/handleSaveCustomAgent';
import { handleCreateAgentPat as handleCreateAgentPat_ext } from './AgenticSettingsDrawerSections/handleCreateAgentPat';
import { AgenticSettingsDrawerView } from './AgenticSettingsDrawerSections/AgenticSettingsDrawerView';



export type AgentDrawerMode = 
  | { type: 'list_custom'; customAgents: AgentRecord[]; defaultAgentId: string; onSelectAgent: (agent: any) => void; onCreateAgent: () => void; onDeleteAgent?: (id: string, name: string) => void }
  | { type: 'list_system'; onSelectAgent: (agent: SystemAgentDefinition) => void }
  | { type: 'preview_system'; agent: SystemAgentDefinition }
  | { type: 'create_custom'; onCreated?: (created: any) => void }
  | { type: 'edit_custom'; agent: AgentRecord; onSaved?: () => void }
  | { type: 'select_default'; activeAgentId: string; onSelectDefault: (id: string) => void; customAgents: AgentRecord[] }
  | { type: 'manage_provisioning_keys' }
  | { type: 'manage_byok'; hasByok: boolean; computeState: any; onSaveByok: (key: string) => Promise<void>; onDeleteByok: () => Promise<void> }
  | { type: 'manage_cli_skill' };

interface AgenticDrawerProps {
  mode: AgentDrawerMode;
  onClose: () => void;
}

export function AgenticSettingsDrawer({ mode, onClose }: AgenticDrawerProps) {
  const [copiedPrompt, setCopiedPrompt] = useState(false);
  const [byokInput, setByokInput] = useState('');
  const [savingByok, setSavingByok] = useState(false);

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
          `You are an autonomous engineering subagent in Kylrix tasked with: ${userGoal}.\n\nDirectives:\n1. Work within the designated agentic workspace.\n2. Execute tasks safely and communicate status clearly.\n3. Respect encryption boundaries and user permissions.`
      );
      setMetaSuggestions([
        `Add strict rate-limiting instructions`,
        `Add structured markdown output guidelines`,
        `Attach E2EE vault encryption toolset`,
      ]);
      setMetaThinking(false);
    }, 600);
  };

  const handleSaveCustomAgent = (..._args: any[]) => handleSaveCustomAgent_ext({ agentPats, apkList, byokInput, copiedApk, copiedPrompt, copiedToken, creatingAgentPat, creatingApk, framework, handleCopyPrompt, handleCreateAgentPat, handleCreateApk, handleMetaGenerate, handleRevokeAgentPat, handleRevokeApk, handleSaveCustomAgent, isCreatingApkKey, loadAgentPats, loadApkList, loadingAgentPats, loadingApk, metaInput, metaSuggestions, metaThinking, name, newAgentPatName, newApkName, newlyCreatedApk, newlyCreatedToken, prompt, role, saving, savingByok, setAgentPats, setApkList, setByokInput, setCopiedApk, setCopiedPrompt, setCopiedToken, setCreatingAgentPat, setCreatingApk, setFramework, setIsCreatingApkKey, setLoadingAgentPats, setLoadingApk, setMetaInput, setMetaSuggestions, setMetaThinking, setName, setNewAgentPatName, setNewApkName, setNewlyCreatedApk, setNewlyCreatedToken, setPrompt, setRole, setSaving, setSavingByok });

  // Create Agentic PAT under custom agent
  const handleCreateAgentPat = (..._args: any[]) => handleCreateAgentPat_ext({ agentPats, apkList, byokInput, copiedApk, copiedPrompt, copiedToken, creatingAgentPat, creatingApk, framework, handleCopyPrompt, handleCreateAgentPat, handleCreateApk, handleMetaGenerate, handleRevokeAgentPat, handleRevokeApk, handleSaveCustomAgent, isCreatingApkKey, loadAgentPats, loadApkList, loadingAgentPats, loadingApk, metaInput, metaSuggestions, metaThinking, name, newAgentPatName, newApkName, newlyCreatedApk, newlyCreatedToken, prompt, role, saving, savingByok, setAgentPats, setApkList, setByokInput, setCopiedApk, setCopiedPrompt, setCopiedToken, setCreatingAgentPat, setCreatingApk, setFramework, setIsCreatingApkKey, setLoadingAgentPats, setLoadingApk, setMetaInput, setMetaSuggestions, setMetaThinking, setName, setNewAgentPatName, setNewApkName, setNewlyCreatedApk, setNewlyCreatedToken, setPrompt, setRole, setSaving, setSavingByok });

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

  return <AgenticSettingsDrawerView {...({ agentPats, apkList, byokInput, cacheKey, cached, copiedApk, copiedPrompt, copiedToken, creatingAgentPat, creatingApk, framework, fresh, handleCopyPrompt, handleCreateAgentPat, handleCreateApk, handleMetaGenerate, handleRevokeAgentPat, handleRevokeApk, handleSaveCustomAgent, isCreatingApkKey, keyName, loadAgentPats, loadApkList, loadingAgentPats, loadingApk, metaInput, metaSuggestions, metaThinking, mode, name, newAgentPatName, newApkName, newlyCreatedApk, newlyCreatedToken, next, onClose, prompt, res, role, saving, savingByok, setAgentPats, setApkList, setByokInput, setCopiedApk, setCopiedPrompt, setCopiedToken, setCreatingAgentPat, setCreatingApk, setFramework, setIsCreatingApkKey, setLoadingAgentPats, setLoadingApk, setMetaInput, setMetaSuggestions, setMetaThinking, setName, setNewAgentPatName, setNewApkName, setNewlyCreatedApk, setNewlyCreatedToken, setPrompt, setRole, setSaving, setSavingByok, userGoal })} />;
}
