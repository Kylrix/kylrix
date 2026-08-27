'use client';

import React, { useState, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { 
  X, 
  Bot, 
  Key, 
  MessageSquare, 
  Settings, 
  Trash2, 
  Copy, 
  Check, 
  Wallet, 
  Globe, 
  Radio, 
  ShieldCheck, 
  Plus,
  Maximize2, 
  Minimize2, 
  ArrowUpRight 
} from 'lucide-react';
import { AgentRecord } from '@/lib/services/agentic';
import { AgentIdentityService } from '@/lib/services/agent-identity';
import { useAgenticDrawer } from '@/context/AgenticDrawerContext';
import { useRouter } from 'next/navigation';
import { toast } from 'react-hot-toast';

interface AgentActionDrawerProps {
  open: boolean;
  onClose: () => void;
  agent: AgentRecord | any;
  isDefault?: boolean;
  onSelectDefault?: (id: string) => void;
  onEdit?: (agent: any) => void;
  onManageKeys?: (agent: any) => void;
  onDelete?: (agentId: string, name: string) => void;
}

export function AgentActionDrawer({
  open,
  onClose,
  agent,
  isDefault = false,
  onSelectDefault,
  onEdit,
  onManageKeys,
  onDelete,
}: AgentActionDrawerProps) {
  const router = useRouter();
  const { openAgenticDrawer } = useAgenticDrawer();
  const [profile, setProfile] = useState<any>(null);
  const [copiedKey, setCopiedKey] = useState<string | null>(null);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [mounted, setMounted] = useState(false);

  // Tokens state
  const [agentTokens, setAgentTokens] = useState<any[]>([]);
  const [loadingTokens, setLoadingTokens] = useState(false);
  const [isCreatingToken, setIsCreatingToken] = useState(false);
  const [newTokenName, setNewTokenName] = useState('');
  const [mintingToken, setMintingToken] = useState(false);
  const [newlyMintedToken, setNewlyMintedToken] = useState<string | null>(null);

  useEffect(() => {
    setMounted(true);
  }, []);

  const config = React.useMemo(() => {
    try {
      return typeof agent?.config === 'string' ? JSON.parse(agent.config) : agent?.config || {};
    } catch {
      return {};
    }
  }, [agent]);

  const agentName = config.name || agent?.name || 'Smart Agent';
  const agentRole = config.role || config.goal || agent?.description || 'Autonomous assistant partner';
  const agentFramework = config.framework || agent?.framework || 'kylrix';
  const agentId = agent?.$id || agent?.id || '';
  const agentUserId = agentId.startsWith('agent_') ? agentId : `agent_${agentId}`;
  const username = profile?.username || `ag_${agentName.toLowerCase().replace(/[^a-z0-9_]/g, '')}`;

  const loadTokens = React.useCallback(async () => {
    if (!agentId) return;
    setLoadingTokens(true);
    try {
      const { listPats } = await import('@/lib/actions/client-ops');
      const res = await listPats({ agentId });
      if (res?.success && Array.isArray(res.data)) {
        setAgentTokens(res.data);
      }
    } catch {
      setAgentTokens([]);
    } finally {
      setLoadingTokens(false);
    }
  }, [agentId]);

  useEffect(() => {
    if (!open || !agentId) return;
    let active = true;

    AgentIdentityService.getAgentProfile(agentId)
      .then((p) => {
        if (active) setProfile(p);
      })
      .catch(() => {});

    void loadTokens();

    return () => {
      active = false;
    };
  }, [open, agentId, loadTokens]);

  const handleMintToken = async () => {
    if (!newTokenName.trim() || !agentId) return;
    setMintingToken(true);
    try {
      const { createPat } = await import('@/lib/actions/client-ops');
      const res = await createPat({
        name: newTokenName.trim(),
        keyCategory: 'agentic_pat',
        agentId,
        scopes: ['notes:read', 'notes:write', 'vault:read', 'vault:write', 'goals:read', 'goals:write', 'workspaces:read', 'workspaces:write'],
        expiresAt: new Date(Date.now() + 365 * 86400000).toISOString(),
      });

      if (res?.token) {
        setNewlyMintedToken(res.token);
        setNewTokenName('');
        setIsCreatingToken(false);
        toast.success('Agentic PAT minted');
        void loadTokens();
      } else {
        toast.error('Could not create token');
      }
    } catch (err: any) {
      toast.error(err?.message || 'Failed to mint token');
    } finally {
      setMintingToken(false);
    }
  };

  const handleRevokeToken = async (patId: string) => {
    if (!confirm('Revoke this agent token?')) return;
    try {
      const { revokePat } = await import('@/lib/actions/client-ops');
      await revokePat(patId);
      toast.success('Token revoked');
      setAgentTokens((prev) => prev.filter((t: any) => (t.$id || t.id) !== patId));
    } catch {
      toast.error('Failed to revoke token');
    }
  };

  const copyToClipboard = (text: string, label: string, keyId: string) => {
    if (!text) return;
    navigator.clipboard.writeText(text);
    setCopiedKey(keyId);
    toast.success(`${label} copied`);
    setTimeout(() => setCopiedKey(null), 2000);
  };

  const handleStartChat = () => {
    onClose();
    openAgenticDrawer({
      prompt: `Hello ${agentName}, let's collaborate.`,
      autoRun: false,
    });
  };

  const handleViewProfile = () => {
    onClose();
    router.push(`/u/${username}`);
  };

  if (!open || !mounted || typeof document === 'undefined') return null;

  return createPortal(
    <>
      {/* Backdrop */}
      <div 
        className="fixed inset-0 bg-black/80 z-[99998] transition-opacity duration-200 cursor-default"
        onClick={onClose}
      />

      {/* Drawer Shell */}
      <div 
        className={
          isFullscreen
            ? "fixed inset-0 top-0 left-0 right-0 bottom-0 z-[99999] w-screen h-screen min-h-[100dvh] bg-[#161412] text-white flex flex-col select-none overflow-hidden"
            : "fixed bottom-0 left-0 right-0 h-[60dvh] max-h-[60dvh] min-h-[60dvh] md:top-0 md:bottom-0 md:right-0 md:left-auto md:w-[520px] md:h-full md:max-h-full bg-[#161412] border-t md:border-t-0 md:border-l border-white/[0.08] rounded-t-[28px] md:rounded-t-none z-[99999] text-white flex flex-col shadow-2xl overflow-hidden animate-slide-up select-none"
        }
      >
        {/* Header Controls */}
        <div className="px-4 py-2.5 flex items-center justify-between border-b border-white/[0.06] bg-[#161412] shrink-0">
          <div className="flex items-center gap-2">
            <span className="text-[10px] font-mono uppercase tracking-wider text-[#818cf8] font-bold">
              Agent Identity & Actions
            </span>
          </div>

          <div className="flex items-center gap-1">
            <button
              type="button"
              onClick={handleViewProfile}
              title="Open Public Profile (/u/...)"
              className="w-7 h-7 rounded-lg flex items-center justify-center text-white/50 hover:text-white hover:bg-white/5 transition-colors cursor-pointer"
            >
              <ArrowUpRight size={14} />
            </button>
            <button
              type="button"
              onClick={() => setIsFullscreen((prev) => !prev)}
              title={isFullscreen ? "Dock Drawer" : "Fullscreen"}
              className="w-7 h-7 rounded-lg flex items-center justify-center text-white/50 hover:text-white hover:bg-white/5 transition-colors cursor-pointer"
            >
              {isFullscreen ? <Minimize2 size={14} /> : <Maximize2 size={14} />}
            </button>
            <button
              type="button"
              onClick={onClose}
              title="Close"
              className="w-7 h-7 rounded-lg flex items-center justify-center text-white/50 hover:text-white hover:bg-white/5 transition-colors cursor-pointer"
            >
              <X size={15} />
            </button>
          </div>
        </div>

        {/* Scrollable Drawer Content */}
        <div className="flex-1 overflow-y-auto px-5 py-5 space-y-4 min-h-0 bg-[#161412]">
          {/* Agent Identity Card */}
          <div className="p-4 md:p-5 rounded-2xl bg-[#0A0908] border border-white/[0.06] flex items-start gap-3.5">
            <div className="w-12 h-12 rounded-2xl bg-[#161412] border border-white/10 flex items-center justify-center text-[#6366F1] shrink-0 font-bold">
              <Bot size={24} />
            </div>
            <div className="min-w-0 flex-1">
              <div className="flex items-center gap-2 flex-wrap">
                <h3 className="text-base font-black text-white font-clash m-0">
                  {agentName}
                </h3>
                <span className="text-[9px] font-mono px-2 py-0.5 rounded bg-[#6366F1]/15 text-[#818cf8] font-bold uppercase">
                  {agentFramework}
                </span>
                {isDefault && (
                  <span className="text-[9px] font-mono px-2 py-0.5 rounded bg-[#F59E0B]/20 text-[#F59E0B] font-bold uppercase">
                    Active Partner
                  </span>
                )}
              </div>
              <p className="text-xs text-[#818cf8] font-mono font-bold mt-0.5 m-0">
                @{username}
              </p>
              <p className="text-xs text-white/50 font-medium leading-relaxed mt-1.5 m-0 line-clamp-2">
                {agentRole}
              </p>
            </div>
          </div>

          {/* Cryptographic Credentials Section */}
          <div className="p-4 rounded-2xl bg-[#0A0908] border border-white/[0.06] space-y-3">
            <div className="flex items-center gap-2">
              <ShieldCheck size={14} className="text-emerald-400" />
              <span className="text-[10px] font-mono uppercase tracking-wider text-white/50 font-bold">
                Agent Sovereign Keys & Addresses
              </span>
            </div>

            {/* Agent ID */}
            <div className="p-2.5 rounded-xl bg-[#161412] border border-white/[0.04] flex items-center justify-between gap-2">
              <div className="min-w-0 flex-1">
                <span className="text-[9px] font-mono uppercase text-white/40 font-bold block">
                  Agent ID
                </span>
                <span className="text-xs font-mono text-white font-bold block truncate mt-0.5">
                  {agentUserId}
                </span>
              </div>
              <button
                type="button"
                onClick={() => copyToClipboard(agentUserId, 'Agent ID', 'id')}
                className="p-1.5 rounded-lg bg-white/5 hover:bg-white/10 text-white/60 hover:text-white transition-colors cursor-pointer shrink-0"
              >
                {copiedKey === 'id' ? <Check size={12} className="text-emerald-400" /> : <Copy size={12} />}
              </button>
            </div>

            {/* Agentic Wallet Address */}
            <div className="p-2.5 rounded-xl bg-[#161412] border border-white/[0.04] flex items-center justify-between gap-2">
              <div className="min-w-0 flex-1">
                <span className="text-[9px] font-mono uppercase text-white/40 font-bold flex items-center gap-1">
                  <Wallet size={10} className="text-[#6366F1]" /> Agentic EVM Wallet
                </span>
                <span className="text-xs font-mono text-white font-bold block truncate mt-0.5">
                  {profile?.walletAddress || '0x... (Provisioning)'}
                </span>
              </div>
              {profile?.walletAddress && (
                <button
                  type="button"
                  onClick={() => copyToClipboard(profile.walletAddress, 'Wallet Address', 'wallet')}
                  className="p-1.5 rounded-lg bg-white/5 hover:bg-white/10 text-white/60 hover:text-white transition-colors cursor-pointer shrink-0"
                >
                  {copiedKey === 'wallet' ? <Check size={12} className="text-emerald-400" /> : <Copy size={12} />}
                </button>
              )}
            </div>

            {/* Nostr Npub Key */}
            <div className="p-2.5 rounded-xl bg-[#161412] border border-white/[0.04] flex items-center justify-between gap-2">
              <div className="min-w-0 flex-1">
                <span className="text-[9px] font-mono uppercase text-white/40 font-bold flex items-center gap-1">
                  <Globe size={10} className="text-[#818cf8]" /> Nostr Identity Key
                </span>
                <span className="text-xs font-mono text-white font-bold block truncate mt-0.5">
                  {profile?.publicKey || 'npub1... (Provisioning)'}
                </span>
              </div>
              {profile?.publicKey && (
                <button
                  type="button"
                  onClick={() => copyToClipboard(profile.publicKey, 'Nostr Key', 'nostr')}
                  className="p-1.5 rounded-lg bg-white/5 hover:bg-white/10 text-white/60 hover:text-white transition-colors cursor-pointer shrink-0"
                >
                  {copiedKey === 'nostr' ? <Check size={12} className="text-emerald-400" /> : <Copy size={12} />}
                </button>
              )}
            </div>
          </div>

          {/* ── Active Tokens & Provisioning Keys ── */}
          <div className="p-4 rounded-2xl bg-[#0A0908] border border-white/[0.06] space-y-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Key size={14} className="text-[#6366F1]" />
                <span className="text-[10px] font-mono uppercase tracking-wider text-white/50 font-bold">
                  Runtime Tokens & API Keys
                </span>
              </div>
              <button
                type="button"
                onClick={() => setIsCreatingToken((prev) => !prev)}
                className="text-[11px] font-mono font-bold text-[#6366F1] hover:underline flex items-center gap-1 cursor-pointer"
              >
                <Plus size={12} /> Mint Token
              </button>
            </div>

            {/* Token Minting Input */}
            {isCreatingToken && (
              <div className="p-3 rounded-xl bg-[#161412] border border-[#6366F1]/30 space-y-2">
                <span className="text-[10px] font-mono uppercase text-white/40 font-bold block">
                  Mint New Agentic PAT
                </span>
                <div className="flex gap-2">
                  <input
                    type="text"
                    placeholder="Token label (e.g. CI Runner, Superteam)"
                    value={newTokenName}
                    onChange={(e) => setNewTokenName(e.target.value)}
                    className="flex-1 h-9 px-3 rounded-lg bg-[#0A0908] border border-white/10 text-xs text-white focus:outline-none focus:border-[#6366F1]"
                  />
                  <button
                    type="button"
                    onClick={handleMintToken}
                    disabled={mintingToken || !newTokenName.trim()}
                    className="h-9 px-3 rounded-lg bg-[#6366F1] hover:bg-[#5254E8] text-white font-bold text-xs flex items-center gap-1 transition-all disabled:opacity-40 cursor-pointer"
                  >
                    {mintingToken ? 'Minting…' : 'Mint'}
                  </button>
                </div>
              </div>
            )}

            {/* Freshly Minted Token Banner */}
            {newlyMintedToken && (
              <div className="p-3 rounded-xl bg-emerald-500/10 border border-emerald-500/30 space-y-1.5 animate-fadeIn">
                <div className="flex items-center justify-between text-[11px] text-emerald-400 font-mono font-bold">
                  <span>Token Created (Copy Now — Won&apos;t be shown again)</span>
                </div>
                <div className="flex items-center justify-between gap-2 p-2 rounded-lg bg-[#0A0908] border border-emerald-500/20">
                  <span className="text-xs font-mono text-white truncate flex-1 select-all">
                    {newlyMintedToken}
                  </span>
                  <button
                    type="button"
                    onClick={() => copyToClipboard(newlyMintedToken, 'Token', 'minted')}
                    className="p-1 rounded-md bg-emerald-500/20 hover:bg-emerald-500/30 text-emerald-400 transition-colors cursor-pointer shrink-0"
                  >
                    {copiedKey === 'minted' ? <Check size={12} /> : <Copy size={12} />}
                  </button>
                </div>
              </div>
            )}

            {/* Active PATs List */}
            {loadingTokens ? (
              <div className="text-center py-3 text-xs text-white/40 font-mono">
                Loading tokens…
              </div>
            ) : agentTokens.length === 0 ? (
              <div className="p-3 rounded-xl bg-[#161412] border border-white/[0.04] text-center">
                <p className="text-xs text-white/40 font-mono m-0">No active PAT tokens minted for this agent.</p>
              </div>
            ) : (
              <div className="space-y-2">
                {agentTokens.map((tok: any) => (
                  <div
                    key={tok.$id || tok.id}
                    className="p-2.5 rounded-xl bg-[#161412] border border-white/[0.04] flex items-center justify-between gap-2"
                  >
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2">
                        <span className="text-xs font-bold text-white truncate block">
                          {tok.name || 'Agent PAT'}
                        </span>
                        <span className="text-[9px] font-mono px-1.5 py-0.2 rounded bg-white/5 text-white/50 font-bold">
                          {tok.category || 'agentic_pat'}
                        </span>
                      </div>
                      <span className="text-[10px] font-mono text-white/40 block truncate mt-0.5">
                        {tok.tokenPrefix || 'kyl_apat_'}••••••••
                      </span>
                    </div>
                    <button
                      type="button"
                      onClick={() => handleRevokeToken(tok.$id || tok.id)}
                      className="p-1.5 rounded-lg text-white/30 hover:text-red-400 hover:bg-white/5 transition-colors cursor-pointer shrink-0"
                      title="Revoke Token"
                    >
                      <Trash2 size={12} />
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Action Tiles Grid */}
          <div className="space-y-2 pt-1">
            <span className="text-[10px] font-mono uppercase tracking-wider text-white/40 font-bold block px-1">
              Actions & Collaboration
            </span>

            {/* View Profile */}
            <button
              type="button"
              onClick={handleViewProfile}
              className="w-full p-3.5 rounded-2xl bg-[#0A0908] hover:bg-[#1C1A18] border border-white/[0.06] hover:border-white/10 flex items-center justify-between gap-3 text-left transition-all cursor-pointer group"
            >
              <div className="flex items-center gap-3">
                <div className="w-8 h-8 rounded-xl bg-white/5 flex items-center justify-center text-white/60 group-hover:text-white">
                  <Globe size={15} />
                </div>
                <div>
                  <h4 className="text-xs font-bold text-white m-0">View Public Profile</h4>
                  <p className="text-[11px] text-white/40 m-0">Inspect agent&apos;s public ecosystem page (/u/{username})</p>
                </div>
              </div>
              <ArrowUpRight size={14} className="text-white/40 group-hover:text-white" />
            </button>

            {/* Start Chat */}
            <button
              type="button"
              onClick={handleStartChat}
              className="w-full p-3.5 rounded-2xl bg-[#0A0908] hover:bg-[#1C1A18] border border-white/[0.06] hover:border-white/10 flex items-center justify-between gap-3 text-left transition-all cursor-pointer group"
            >
              <div className="flex items-center gap-3">
                <div className="w-8 h-8 rounded-xl bg-[#6366F1]/10 text-[#6366F1] flex items-center justify-center">
                  <MessageSquare size={15} />
                </div>
                <div>
                  <h4 className="text-xs font-bold text-white m-0">Start Interactive Session</h4>
                  <p className="text-[11px] text-white/40 m-0">Launch direct workspace prompt sequence with {agentName}</p>
                </div>
              </div>
              <span className="text-xs font-mono font-bold text-[#6366F1]">Chat</span>
            </button>

            {/* Set as Active Partner */}
            {onSelectDefault && (
              <button
                type="button"
                onClick={() => {
                  onSelectDefault(agentId);
                  toast.success(`${agentName} set as active partner`);
                  onClose();
                }}
                className="w-full p-3.5 rounded-2xl bg-[#0A0908] hover:bg-[#1C1A18] border border-white/[0.06] hover:border-white/10 flex items-center justify-between gap-3 text-left transition-all cursor-pointer group"
              >
                <div className="flex items-center gap-3">
                  <div className="w-8 h-8 rounded-xl bg-[#F59E0B]/10 text-[#F59E0B] flex items-center justify-center">
                    <Radio size={15} />
                  </div>
                  <div>
                    <h4 className="text-xs font-bold text-white m-0">
                      {isDefault ? 'Default Partner (Active)' : 'Set as Default Partner'}
                    </h4>
                    <p className="text-[11px] text-white/40 m-0">Use {agentName} as primary assistant across Kylrix</p>
                  </div>
                </div>
                {isDefault && (
                  <span className="text-[9px] font-mono font-bold text-[#F59E0B] uppercase">Active</span>
                )}
              </button>
            )}

            {/* Manage Keys */}
            {onManageKeys && (
              <button
                type="button"
                onClick={() => {
                  onClose();
                  onManageKeys(agent);
                }}
                className="w-full p-3.5 rounded-2xl bg-[#0A0908] hover:bg-[#1C1A18] border border-white/[0.06] hover:border-white/10 flex items-center justify-between gap-3 text-left transition-all cursor-pointer group"
              >
                <div className="flex items-center gap-3">
                  <div className="w-8 h-8 rounded-xl bg-emerald-500/10 text-emerald-400 flex items-center justify-center">
                    <Key size={15} />
                  </div>
                  <div>
                    <h4 className="text-xs font-bold text-white m-0">Manage Agentic PATs & Keys</h4>
                    <p className="text-[11px] text-white/40 m-0">Mint or inspect tokens with <code className="text-emerald-400">kyl_apat_</code> scope</p>
                  </div>
                </div>
                <span className="text-xs font-mono font-bold text-emerald-400">Keys</span>
              </button>
            )}

            {/* Edit Agent */}
            {onEdit && (
              <button
                type="button"
                onClick={() => {
                  onClose();
                  onEdit(agent);
                }}
                className="w-full p-3.5 rounded-2xl bg-[#0A0908] hover:bg-[#1C1A18] border border-white/[0.06] hover:border-white/10 flex items-center justify-between gap-3 text-left transition-all cursor-pointer group"
              >
                <div className="flex items-center gap-3">
                  <div className="w-8 h-8 rounded-xl bg-white/5 flex items-center justify-center text-white/60 group-hover:text-white">
                    <Settings size={15} />
                  </div>
                  <div>
                    <h4 className="text-xs font-bold text-white m-0">Configure Persona & Prompts</h4>
                    <p className="text-[11px] text-white/40 m-0">Edit goal, operational instructions, and framework</p>
                  </div>
                </div>
                <span className="text-xs font-mono font-bold text-white/40 group-hover:text-white">Edit</span>
              </button>
            )}

            {/* Delete Agent */}
            {onDelete && (
              <button
                type="button"
                onClick={() => {
                  onClose();
                  onDelete(agentId, agentName);
                }}
                className="w-full p-3.5 rounded-2xl bg-[#0A0908] hover:bg-rose-950/20 border border-white/[0.06] hover:border-rose-500/30 flex items-center justify-between gap-3 text-left transition-all cursor-pointer group"
              >
                <div className="flex items-center gap-3">
                  <div className="w-8 h-8 rounded-xl bg-rose-500/10 text-rose-400 flex items-center justify-center">
                    <Trash2 size={15} />
                  </div>
                  <div>
                    <h4 className="text-xs font-bold text-rose-400 m-0">Delete Agent</h4>
                    <p className="text-[11px] text-white/40 m-0">Purge custom agent record and ecosystem profile</p>
                  </div>
                </div>
                <span className="text-xs font-mono font-bold text-rose-400">Purge</span>
              </button>
            )}
          </div>
        </div>

        {/* Action Footer */}
        <div className="shrink-0 border-t border-white/[0.06] bg-[#161412] px-5 py-3 md:py-3.5 z-10 flex items-center justify-between gap-3">
          <button
            type="button"
            onClick={onClose}
            className="w-full h-10 rounded-xl bg-white/5 hover:bg-white/10 text-white font-bold text-xs transition-colors cursor-pointer"
          >
            Done
          </button>
        </div>
      </div>
    </>,
    document.body
  );
}
