'use client';

import React, { useEffect, useState } from 'react';
import {
  X,
  ChevronLeft,
  ChevronRight,
  Copy,
  KeyRound,
  CheckCheck,
  RotateCcw,
  Sparkles,
  ChevronDown,
  ChevronUp,
  ShieldAlert,
  Lightbulb,
  Target,
  Lock,
  Bot,
  FolderGit2,
  Workflow,
  MessageSquare,
  Settings,
} from 'lucide-react';
import toast from 'react-hot-toast';
import { Drawer, useTheme, useMediaQuery } from '@/lib/openbricks/primitives';
import { PAT_SCOPES, PAT_SCOPE_META, normalizeScopes, type PatScope } from '@/lib/api/scopes';
import { createPat } from '@/lib/actions/client-ops';
import { TOPBAR_DRAWER_BACKDROP_SLOT } from '@/lib/ui/topbar-drawer-slot';
import { formatAgentToken, generateEtkSecret, zeroClearBytes } from '@/lib/security/zero-knowledge';
import { buildAetEnvelope, loadPermittedRows } from '@/lib/security/aet-mint';
import { masterPassCrypto } from '@/lib/masterpass-crypto';
import { useAuth } from '@/context/auth/AuthContext';

type Step = 'name' | 'wizard_step1' | 'wizard_step2' | 'scopes' | 'done';

const DEFAULT_SCOPES: PatScope[] = ['profile:read', 'notes:read', 'notes:write'];

export type ResourceCategoryKey =
  | 'ideas'
  | 'goals'
  | 'vault'
  | 'agents'
  | 'workspaces'
  | 'forms'
  | 'chats'
  | 'settings';

export type AccessSweepKey = 'all' | 'read' | 'write';

export interface ScopeCategoryDef {
  key: ResourceCategoryKey;
  label: string;
  icon: React.ComponentType<{ size?: number; className?: string }>;
  scopes: PatScope[];
}

export const SCOPE_CATEGORIES: ScopeCategoryDef[] = [
  {
    key: 'ideas',
    label: 'Ideas & Notes',
    icon: Lightbulb,
    scopes: ['notes:read', 'notes:write'],
  },
  {
    key: 'goals',
    label: 'Goals & Tasks',
    icon: Target,
    scopes: ['goals:read', 'goals:write'],
  },
  {
    key: 'vault',
    label: 'Vault & Credentials',
    icon: Lock,
    scopes: ['vault:read', 'vault:write'],
  },
  {
    key: 'agents',
    label: 'Agents & Tools',
    icon: Bot,
    scopes: ['tools:execute', 'agents:read', 'agents:write', 'agents:harness', 'agents:provision'],
  },
  {
    key: 'workspaces',
    label: 'Workspaces & Objects',
    icon: FolderGit2,
    scopes: [
      'workspaces:read',
      'workspaces:write',
      'objects:read',
      'objects:write',
      'tags:read',
      'tags:write',
      'trash:read',
      'trash:write',
    ],
  },
  {
    key: 'forms',
    label: 'Forms & Workflows',
    icon: Workflow,
    scopes: [
      'forms:read',
      'forms:write',
      'events:read',
      'events:write',
      'flows:read',
      'flows:write',
      'flows:install',
    ],
  },
  {
    key: 'chats',
    label: 'Chats & Community',
    icon: MessageSquare,
    scopes: ['chats:read', 'chats:write', 'moments:read', 'moments:write'],
  },
  {
    key: 'settings',
    label: 'Settings & Billing',
    icon: Settings,
    scopes: ['profile:read', 'pats:read', 'pats:write', 'billing:read', 'billing:write'],
  },
];

// Resource toggles in the agent-key wizard add and lock these read scopes (#317).
export const AET_RESOURCE_SCOPES = {
  vault: ['vault:read'],
  totp: ['vault:read'], // TOTP routes require vault:read
  notes: ['notes:read'],
} as const satisfies Record<string, readonly PatScope[]>;

export function computeAetRequiredScopes(p: {
  permittedVault: boolean;
  permittedTotp: boolean;
  permittedNotes: boolean;
}): PatScope[] {
  const s = new Set<PatScope>(['profile:read']);
  if (p.permittedVault) AET_RESOURCE_SCOPES.vault.forEach((x) => s.add(x));
  if (p.permittedTotp) AET_RESOURCE_SCOPES.totp.forEach((x) => s.add(x));
  if (p.permittedNotes) AET_RESOURCE_SCOPES.notes.forEach((x) => s.add(x));
  return [...s];
}

export function computeAetScopes(
  selected: PatScope[],
  p: Parameters<typeof computeAetRequiredScopes>[0]
): PatScope[] {
  return normalizeScopes([...selected, ...computeAetRequiredScopes(p)]);
}

export function isReadScope(scope: PatScope): boolean {
  return scope.endsWith(':read') || scope === 'profile:read';
}

export function isWriteScope(scope: PatScope): boolean {
  return !isReadScope(scope);
}

export function computeSweepScopes(
  resourceFilter: ResourceCategoryKey | 'all',
  accessFilter: AccessSweepKey
): PatScope[] {
  let candidateScopes: PatScope[] = [];

  if (resourceFilter === 'all') {
    candidateScopes = [...PAT_SCOPES];
  } else {
    const cat = SCOPE_CATEGORIES.find((c) => c.key === resourceFilter);
    candidateScopes = cat ? [...cat.scopes] : [];
  }

  if (accessFilter === 'read') {
    return candidateScopes.filter(isReadScope);
  } else if (accessFilter === 'write') {
    return candidateScopes.filter(isWriteScope);
  }
  return candidateScopes;
}

function paperSx(isDesktop: boolean) {
  return {
    bgcolor: '#161412',
    backgroundImage: 'none',
    color: '#fff',
    border: '1px solid rgba(255,255,255,0.06)',
    boxSizing: 'border-box' as const,
    ...(isDesktop
      ? {
          height: '100dvh',
          width: 'min(100vw, 460px)',
          borderRadius: '26px 0 0 26px',
          borderLeft: '1px solid rgba(255,255,255,0.08)',
        }
      : {
          height: '80dvh',
          maxHeight: '80dvh',
          width: '100%',
          borderRadius: '26px 26px 0 0',
          borderTop: '1px solid rgba(255,255,255,0.08)',
        }),
  };
}

export function CreatePatDrawer({
  open,
  onClose,
  onCreated,
  isWorkspace = false,
  workspaceId = null,
}: {
  open: boolean;
  onClose: () => void;
  onCreated?: () => void;
  isWorkspace?: boolean;
  workspaceId?: string | null;
}) {
  const theme = useTheme();
  const isDesktop = useMediaQuery(theme.breakpoints.up('md'));
  const { user } = useAuth();
  const [step, setStep] = useState<Step>('name');
  const [name, setName] = useState('');
  const [selected, setSelected] = useState<PatScope[]>(DEFAULT_SCOPES);
  const [creating, setCreating] = useState(false);
  const [token, setToken] = useState<string | null>(null);

  // Agent key (AET) state — the unlock key never touches React state or the wire.
  const [isAetToken, setIsAetToken] = useState(false);
  const [permittedVault, setPermittedVault] = useState(true);
  const [permittedTotp, setPermittedTotp] = useState(true);
  const [permittedNotes, setPermittedNotes] = useState(false);
  const [aetExpiryDays, setAetExpiryDays] = useState<number>(30);
  const [needsUnlock, setNeedsUnlock] = useState(false);
  const [unlockPwd, setUnlockPwd] = useState('');
  const [unlocking, setUnlocking] = useState(false);
  const [shareSummary, setShareSummary] = useState<{ included: number; skipped: number } | null>(null);

  // Sweep / Preset state
  const [activeResourceFilter, setActiveResourceFilter] = useState<ResourceCategoryKey | 'all'>('all');
  const [activeAccessFilter, setActiveAccessFilter] = useState<AccessSweepKey>('all');

  // Accordion collapsed categories map
  const [expandedCats, setExpandedCats] = useState<Record<string, boolean>>({
    ideas: true,
    goals: true,
    vault: true,
    agents: true,
    workspaces: false,
    forms: false,
    chats: false,
    settings: false,
  });

  useEffect(() => {
    if (!open) return;
    setStep('name');
    setName('');
    setSelected(DEFAULT_SCOPES);
    setCreating(false);
    setToken(null);
    setNeedsUnlock(false);
    setUnlockPwd('');
    setShareSummary(null);
    setActiveResourceFilter('all');
    setActiveAccessFilter('all');
  }, [open]);

  // The minted key string is dropped on unmount and on close.
  useEffect(() => () => setToken(null), []);

  if (!open) return null;

  const handleClose = () => {
    setToken(null);
    onClose();
  };

  const requiredAetScopes = isAetToken
    ? computeAetRequiredScopes({ permittedVault, permittedTotp, permittedNotes })
    : [];

  const toggleScope = (s: PatScope) => {
    if (requiredAetScopes.includes(s)) return; // locked: needed for the chosen items
    setSelected((prev) =>
      prev.includes(s) ? prev.filter((x) => x !== s) : [...prev, s]
    );
  };

  const toggleCategory = (catScopes: PatScope[]) => {
    const allSelected = catScopes.every((s) => selected.includes(s));
    if (allSelected) {
      setSelected((prev) => prev.filter((s) => !catScopes.includes(s)));
    } else {
      setSelected((prev) => Array.from(new Set([...prev, ...catScopes])));
    }
  };

  const handleSelectAll = () => {
    setSelected([...PAT_SCOPES]);
    toast.success('Selected all 34 permissions');
  };

  const handleClearAll = () => {
    setSelected(isAetToken ? computeAetRequiredScopes({ permittedVault, permittedTotp, permittedNotes }) : []);
    toast.success('Cleared all permissions');
  };

  const applySweepPreset = (resource: ResourceCategoryKey | 'all', access: AccessSweepKey) => {
    setActiveResourceFilter(resource);
    setActiveAccessFilter(access);
    const target = computeSweepScopes(resource, access);
    setSelected(
      isAetToken
        ? computeAetScopes(target, { permittedVault, permittedTotp, permittedNotes })
        : target
    );

    const resName = resource === 'all' ? 'All Resources' : SCOPE_CATEGORIES.find((c) => c.key === resource)?.label;
    const accName = access === 'all' ? 'Full Access' : access === 'read' ? 'Read Only' : 'Write & Execute';
    toast.success(`Applied preset: ${resName} (${accName}) — ${target.length} perms`);
  };

  const toggleExpandCat = (key: string) => {
    setExpandedCats((prev) => ({ ...prev, [key]: !prev[key] }));
  };

  const copy = async (text: string) => {
    try {
      await navigator.clipboard.writeText(text);
      toast.success('Copied');
    } catch {
      toast.success(text);
    }
  };

  const handleCreate = async () => {
    if (!name.trim()) {
      toast.error('Name required');
      return;
    }
    if (selected.length === 0) {
      toast.error('Pick at least one permission');
      return;
    }
    if (isAetToken) {
      const mek = masterPassCrypto.getMasterKey();
      if (!mek || !masterPassCrypto.isVaultUnlocked()) {
        setNeedsUnlock(true);
        return;
      }
      const etk = generateEtkSecret();
      setCreating(true);
      try {
        const userId = (user as any)?.$id || (user as any)?.id;
        const rows = await loadPermittedRows({
          userId,
          permittedVault,
          permittedTotp,
          permittedNotes,
          isWorkspace,
          workspaceId,
        });
        const { envelope, included, skipped } = await buildAetEnvelope({
          mek,
          rows,
          etkSecret: etk,
          resources: { credential: permittedVault, totp: permittedTotp, note: permittedNotes },
        });
        if (included === 0) {
          toast.error('None of the chosen items can be shared yet.');
          return;
        }
        const res = await createPat({
          name: name.trim(),
          scopes: computeAetScopes(selected, { permittedVault, permittedTotp, permittedNotes }),
          expiresAt: aetExpiryDays > 0 ? new Date(Date.now() + aetExpiryDays * 86_400_000).toISOString() : null,
          keyCategory: 'agent_enclave_token',
          isWorkspace,
          workspaceId,
          aetEnvelope: envelope,
        });
        setToken(formatAgentToken(res.token, etk));
        setShareSummary({ included, skipped });
        setStep('done');
        try {
          await navigator.clipboard.writeText(formatAgentToken(res.token, etk));
          toast.success('Agent key created and copied');
        } catch {
          toast.success('Agent key created — copy it now');
        }
        onCreated?.();
      } catch (err: any) {
        toast.error(err?.message || 'Create failed');
      } finally {
        zeroClearBytes(etk);
        setCreating(false);
      }
      return;
    }
    setCreating(true);
    try {
      const res = await createPat({
        name: name.trim(),
        scopes: selected,
        isWorkspace,
        workspaceId,
      });
      setToken(res.token);
      setStep('done');
      try {
        await navigator.clipboard.writeText(res.token);
        toast.success('Token created and copied');
      } catch {
        toast.success('Token created — copy it now');
      }
      onCreated?.();
    } catch (err: any) {
      toast.error(err?.message || 'Create failed');
    } finally {
      setCreating(false);
    }
  };

  return (
    <Drawer
      anchor={isDesktop ? 'right' : 'bottom'}
      open={open}
      onClose={handleClose}
      keepMounted={false}
      disablePortal
      ModalProps={{ keepMounted: false }}
      slotProps={TOPBAR_DRAWER_BACKDROP_SLOT}
      PaperProps={{ sx: paperSx(isDesktop) }}
    >
      <div className="flex flex-col h-full font-satoshi overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between gap-3 px-5 pt-5 pb-3 shrink-0 border-b border-white/[0.06]">
          <div className="min-w-0">
            <p className="text-[10px] font-extrabold uppercase tracking-[0.18em] text-white/40">
              {isAetToken ? 'Agent Key' : isWorkspace ? 'Workspace Key' : 'Personal Access Token'}
            </p>
            <h2 className="text-lg font-black font-clash text-white tracking-tight truncate">
              {step === 'name' && '1. Token Name'}
              {step === 'scopes' && '2. Permissions & Scopes'}
              {step === 'done' && '3. Save Your Secret Key'}
            </h2>
          </div>
          <button
            type="button"
            onClick={handleClose}
            className="p-2 rounded-xl bg-[#0A0908] border border-white/[0.06] text-white/50 hover:text-white cursor-pointer transition-colors"
            aria-label="Close"
          >
            <X size={18} />
          </button>
        </div>

        {/* Content Body */}
        <div className="flex-1 min-h-0 overflow-y-auto px-5 py-4 space-y-4">
          {step === 'name' && (
            <div className="space-y-4 pt-2">
              <div className="space-y-1.5">
                <label className="text-xs font-bold text-white/80">Token Name / Purpose</label>
                <input
                  autoFocus
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="e.g. Local CLI, Production Runner, Auto-Agent"
                  className="w-full rounded-2xl bg-[#0A0908] border border-white/10 px-4 py-3.5 text-sm text-white placeholder:text-white/30 outline-none focus:border-[#6366F1] transition-colors"
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' && name.trim()) setStep('scopes');
                  }}
                />
              </div>

              <div className="p-3.5 rounded-2xl bg-[#0A0908] border border-white/[0.06] space-y-1 text-xs text-white/50 leading-relaxed">
                <p className="font-bold text-white/80">About PATs & Keys</p>
                <p>
                  Tokens inherit your identity when invoking the REST API or MCP tools. Choose fine-grained scopes on the next screen to adhere to the principle of least privilege.
                </p>
              </div>

              <div className="p-3.5 rounded-2xl bg-[#0A0908] border border-indigo-500/30 space-y-2">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <ShieldAlert size={16} className="text-indigo-400" />
                    <span className="text-xs font-bold text-white font-mono">Agent key with access to private items</span>
                  </div>
                  <input
                    type="checkbox"
                    checked={isAetToken}
                    onChange={(e) => setIsAetToken(e.target.checked)}
                    className="w-4 h-4 accent-[#6366F1] cursor-pointer"
                  />
                </div>
                <p className="text-[11px] text-white/50 leading-relaxed">
                  Lets an AI agent read the private items you choose. Only you and the agent can open them; Kylrix cannot.
                </p>
              </div>

              <button
                type="button"
                disabled={!name.trim()}
                onClick={() => setStep(isAetToken ? 'wizard_step1' : 'scopes')}
                className="w-full inline-flex items-center justify-center gap-2 py-3.5 rounded-2xl bg-[#6366F1] hover:bg-[#5558E6] text-white text-sm font-extrabold cursor-pointer disabled:opacity-40 transition-all"
              >
                {isAetToken ? 'Next: Choose items' : 'Configure Permissions'}
                <ChevronRight size={16} />
              </button>
            </div>
          )}

          {step === 'wizard_step1' && (
            <div className="space-y-4 pt-2">
              <div className="p-3.5 rounded-2xl bg-[#0A0908] border border-white/[0.08] space-y-1.5">
                <p className="text-xs font-bold text-indigo-400 font-mono">Step 1: Select Permitted Items</p>
                <p className="text-xs text-white/50">
                  Choose which private items this agent key can open.
                </p>
              </div>

              <div className="space-y-2">
                <label className="flex items-center justify-between p-3.5 rounded-2xl bg-[#0A0908] border border-white/10 cursor-pointer">
                  <div className="flex items-center gap-3">
                    <Lock size={16} className="text-indigo-400" />
                    <div>
                      <p className="text-xs font-bold text-white">Vault Credentials</p>
                      <p className="text-[10px] text-white/40">Passwords, API keys, private credentials</p>
                    </div>
                  </div>
                  <input
                    type="checkbox"
                    checked={permittedVault}
                    onChange={(e) => setPermittedVault(e.target.checked)}
                    className="w-4 h-4 accent-[#6366F1] cursor-pointer"
                  />
                </label>

                <label className="flex items-center justify-between p-3.5 rounded-2xl bg-[#0A0908] border border-white/10 cursor-pointer">
                  <div className="flex items-center gap-3">
                    <KeyRound size={16} className="text-indigo-400" />
                    <div>
                      <p className="text-xs font-bold text-white">TOTP 2FA Secrets</p>
                      <p className="text-[10px] text-white/40">Authenticator codes & seeds</p>
                    </div>
                  </div>
                  <input
                    type="checkbox"
                    checked={permittedTotp}
                    onChange={(e) => setPermittedTotp(e.target.checked)}
                    className="w-4 h-4 accent-[#6366F1] cursor-pointer"
                  />
                </label>

                {false && (
                <label className="flex items-center justify-between p-3.5 rounded-2xl bg-[#0A0908] border border-white/10 cursor-pointer">
                  <div className="flex items-center gap-3">
                    <Lightbulb size={16} className="text-indigo-400" />
                    <div>
                      <p className="text-xs font-bold text-white">Private Notes</p>
                      <p className="text-[10px] text-white/40">Private notes you have locked</p>
                    </div>
                  </div>
                  <input
                    type="checkbox"
                    checked={permittedNotes}
                    onChange={(e) => setPermittedNotes(e.target.checked)}
                    className="w-4 h-4 accent-[#6366F1] cursor-pointer"
                  />
                </label>
                )}
              </div>

              <div className="grid grid-cols-2 gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setStep('name')}
                  className="py-3.5 rounded-2xl border border-white/10 text-white/70 text-xs font-extrabold cursor-pointer hover:bg-white/5"
                >
                  Back
                </button>
                <button
                  type="button"
                  disabled={!permittedVault && !permittedTotp && !permittedNotes}
                  onClick={() => setStep('wizard_step2')}
                  className="py-3.5 rounded-2xl bg-[#6366F1] hover:bg-[#5558E6] text-white text-xs font-extrabold cursor-pointer disabled:opacity-40"
                >
                  Step 2: Security Policy
                </button>
              </div>
            </div>
          )}

          {step === 'wizard_step2' && (
            <div className="space-y-4 pt-2">
              <div className="p-3.5 rounded-2xl bg-[#0A0908] border border-white/[0.08] space-y-1.5">
                <p className="text-xs font-bold text-indigo-400 font-mono">Step 2: Security & Expiry Policy</p>
                <p className="text-xs text-white/50">
                  Configure token TTL expiration and access limits.
                </p>
              </div>

              <div className="space-y-2">
                <label className="text-xs font-bold text-white/80 block">Token Expiration Policy</label>
                <select
                  value={aetExpiryDays}
                  onChange={(e) => setAetExpiryDays(Number(e.target.value))}
                  className="w-full rounded-2xl bg-[#0A0908] border border-white/10 px-4 py-3 text-xs text-white outline-none focus:border-[#6366F1]"
                >
                  <option value={7}>7 Days</option>
                  <option value={30}>30 Days (Default)</option>
                  <option value={90}>90 Days</option>
                  <option value={365}>365 Days</option>
                  <option value={0}>No Expiration</option>
                </select>
              </div>

              <div className="p-3.5 rounded-2xl bg-[#0A0908] border border-amber-500/20 text-xs text-amber-300 space-y-1">
                <p className="font-bold flex items-center gap-1">
                  <ShieldAlert size={14} /> Private by design
                </p>
                <p className="text-[11px] text-white/60 leading-relaxed">
                  Your browser prepares a key that only this agent can use. Kylrix stores a locked copy and cannot open your items.
                </p>
              </div>

              <div className="grid grid-cols-2 gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setStep('wizard_step1')}
                  className="py-3.5 rounded-2xl border border-white/10 text-white/70 text-xs font-extrabold cursor-pointer hover:bg-white/5"
                >
                  Back
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setSelected((prev) =>
                      computeAetScopes(prev, { permittedVault, permittedTotp, permittedNotes })
                    );
                    setStep('scopes');
                  }}
                  className="py-3.5 rounded-2xl bg-[#6366F1] hover:bg-[#5558E6] text-white text-xs font-extrabold cursor-pointer"
                >
                  Step 3: Review Permissions
                </button>
              </div>
            </div>
          )}

          {step === 'scopes' && (
            <div className="space-y-4">
              {/* Top Utility Actions Bar */}
              <div className="flex items-center justify-between gap-2 p-2.5 rounded-2xl bg-[#0A0908] border border-white/[0.08]">
                <div className="flex items-center gap-2 min-w-0">
                  <span className="px-2 py-0.5 rounded-md bg-[#6366F1]/20 border border-[#6366F1]/40 text-[#A5B4FC] text-[11px] font-mono font-bold">
                    {selected.length} / {PAT_SCOPES.length}
                  </span>
                  <p className="text-xs font-bold text-white/70 truncate">Selected</p>
                </div>
                <div className="flex items-center gap-1.5 shrink-0">
                  <button
                    type="button"
                    onClick={handleSelectAll}
                    className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-xl bg-white/10 hover:bg-white/15 text-white text-[11px] font-extrabold cursor-pointer transition-colors"
                  >
                    <CheckCheck size={13} className="text-emerald-400" />
                    Select All
                  </button>
                  <button
                    type="button"
                    onClick={handleClearAll}
                    className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-xl bg-white/[0.04] hover:bg-white/10 text-white/60 hover:text-white text-[11px] font-bold cursor-pointer transition-colors"
                  >
                    <RotateCcw size={12} />
                    Clear
                  </button>
                </div>
              </div>

              {/* Scope Sweeps & Presets Sub-section */}
              <div className="p-3 rounded-2xl bg-[#0A0908] border border-white/[0.06] space-y-3">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-1.5">
                    <Sparkles size={14} className="text-[#818cf8]" />
                    <p className="text-xs font-bold text-white">Quick Scope Sweeps & Presets</p>
                  </div>
                  <span className="text-[10px] text-white/40 uppercase font-mono tracking-wider">
                    Combine filters
                  </span>
                </div>

                {/* Resource Selector Bar */}
                <div className="space-y-1">
                  <p className="text-[10px] font-bold text-white/40 uppercase tracking-wider">1. Resource Scope</p>
                  <div className="flex flex-wrap gap-1">
                    <button
                      type="button"
                      onClick={() => applySweepPreset('all', activeAccessFilter)}
                      className={`px-2.5 py-1 rounded-lg text-[11px] font-bold cursor-pointer transition-all border ${
                        activeResourceFilter === 'all'
                          ? 'bg-[#6366F1] border-[#6366F1] text-white'
                          : 'bg-[#161412] border-white/10 text-white/60 hover:text-white'
                      }`}
                    >
                      All Resources
                    </button>
                    {SCOPE_CATEGORIES.map((cat) => (
                      <button
                        key={cat.key}
                        type="button"
                        onClick={() => applySweepPreset(cat.key, activeAccessFilter)}
                        className={`px-2 py-1 rounded-lg text-[11px] font-bold cursor-pointer transition-all border ${
                          activeResourceFilter === cat.key
                            ? 'bg-[#6366F1] border-[#6366F1] text-white'
                            : 'bg-[#161412] border-white/10 text-white/60 hover:text-white'
                        }`}
                      >
                        {cat.label.split(' ')[0]}
                      </button>
                    ))}
                  </div>
                </div>

                {/* Access Level Sweep Bar */}
                <div className="space-y-1">
                  <p className="text-[10px] font-bold text-white/40 uppercase tracking-wider">2. Access Sweep</p>
                  <div className="grid grid-cols-3 gap-1.5">
                    <button
                      type="button"
                      onClick={() => applySweepPreset(activeResourceFilter, 'all')}
                      className={`py-1.5 px-2 rounded-xl text-[11px] font-extrabold cursor-pointer text-center border transition-all ${
                        activeAccessFilter === 'all'
                          ? 'bg-indigo-500/20 border-indigo-500/50 text-indigo-200'
                          : 'bg-[#161412] border-white/10 text-white/50 hover:text-white'
                      }`}
                    >
                      All Access
                    </button>
                    <button
                      type="button"
                      onClick={() => applySweepPreset(activeResourceFilter, 'read')}
                      className={`py-1.5 px-2 rounded-xl text-[11px] font-extrabold cursor-pointer text-center border transition-all ${
                        activeAccessFilter === 'read'
                          ? 'bg-emerald-500/20 border-emerald-500/50 text-emerald-300'
                          : 'bg-[#161412] border-white/10 text-white/50 hover:text-white'
                      }`}
                    >
                      Read Only
                    </button>
                    <button
                      type="button"
                      onClick={() => applySweepPreset(activeResourceFilter, 'write')}
                      className={`py-1.5 px-2 rounded-xl text-[11px] font-extrabold cursor-pointer text-center border transition-all ${
                        activeAccessFilter === 'write'
                          ? 'bg-amber-500/20 border-amber-500/50 text-amber-300'
                          : 'bg-[#161412] border-white/10 text-white/50 hover:text-white'
                      }`}
                    >
                      Write & Exec
                    </button>
                  </div>
                </div>
              </div>

              {/* Categorized Granular Permissions List */}
              <div className="space-y-2.5 pt-1">
                <p className="text-[11px] font-extrabold uppercase tracking-wider text-white/40">
                  Granular Permissions
                </p>

                {SCOPE_CATEGORIES.map((cat) => {
                  const Icon = cat.icon;
                  const catSelectedCount = cat.scopes.filter((s) => selected.includes(s)).length;
                  const allCatSelected = catSelectedCount === cat.scopes.length;
                  const isExpanded = !!expandedCats[cat.key];

                  return (
                    <div
                      key={cat.key}
                      className="rounded-2xl bg-[#0A0908] border border-white/[0.06] overflow-hidden transition-colors"
                    >
                      {/* Accordion Category Header */}
                      <div className="flex items-center justify-between gap-2 p-3 bg-[#161412]/50 hover:bg-[#161412] transition-colors">
                        <button
                          type="button"
                          onClick={() => toggleExpandCat(cat.key)}
                          className="flex items-center gap-2.5 min-w-0 text-left flex-1 cursor-pointer"
                        >
                          <div className="p-1.5 rounded-xl bg-white/5 border border-white/10 text-[#818cf8]">
                            <Icon size={15} />
                          </div>
                          <div className="min-w-0">
                            <p className="text-xs font-bold text-white truncate">{cat.label}</p>
                            <p className="text-[10px] text-white/40 font-mono">
                              {catSelectedCount} / {cat.scopes.length} granted
                            </p>
                          </div>
                        </button>

                        <div className="flex items-center gap-1.5 shrink-0">
                          <button
                            type="button"
                            onClick={() => toggleCategory(cat.scopes)}
                            className={`px-2 py-1 rounded-lg text-[10px] font-extrabold cursor-pointer border transition-colors ${
                              allCatSelected
                                ? 'bg-[#6366F1]/20 border-[#6366F1]/40 text-[#A5B4FC]'
                                : 'bg-white/5 border-white/10 text-white/60 hover:text-white'
                            }`}
                          >
                            {allCatSelected ? 'Deselect Cat' : 'Select Cat'}
                          </button>
                          <button
                            type="button"
                            onClick={() => toggleExpandCat(cat.key)}
                            className="p-1 text-white/40 hover:text-white cursor-pointer"
                          >
                            {isExpanded ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
                          </button>
                        </div>
                      </div>

                      {/* Granular Scopes Grid */}
                      {isExpanded && (
                        <div className="p-3 border-t border-white/[0.04] grid grid-cols-1 gap-1.5">
                          {cat.scopes.map((s) => {
                            const on = selected.includes(s);
                            const meta = PAT_SCOPE_META[s];
                            const isRead = isReadScope(s);
                            const required = requiredAetScopes.includes(s);

                            return (
                              <button
                                key={s}
                                type="button"
                                disabled={required}
                                title={required ? 'Needed for the items you chose' : undefined}
                                onClick={() => toggleScope(s)}
                                className={`flex items-center justify-between gap-2 p-2.5 rounded-xl text-left border cursor-pointer transition-all ${
                                  on
                                    ? meta?.danger
                                      ? 'bg-red-500/10 border-red-500/30 text-white'
                                      : 'bg-[#6366F1]/15 border-[#6366F1]/30 text-white'
                                    : 'bg-[#161412] border-white/[0.04] text-white/40 hover:text-white/70 hover:border-white/10'
                                }`}
                              >
                                <div className="min-w-0 flex-1">
                                  <div className="flex items-center gap-1.5">
                                    <p className="text-xs font-bold truncate">{meta?.label || s}</p>
                                    {meta?.danger && (
                                      <span className="inline-flex items-center gap-0.5 px-1.5 py-0.2 rounded text-[9px] font-mono font-bold bg-red-500/20 text-red-300 border border-red-500/30">
                                        <ShieldAlert size={10} />
                                        Sensitive
                                      </span>
                                    )}
                                  </div>
                                  <p className="text-[10px] font-mono text-white/30 truncate">
                                    {s}{required && <span className="text-indigo-300 not-italic font-sans"> · Needed for the items you chose</span>}
                                  </p>
                                </div>

                                <div className="flex items-center gap-1.5 shrink-0">
                                  <span
                                    className={`px-1.5 py-0.5 rounded text-[9px] font-mono font-bold border ${
                                      isRead
                                        ? 'bg-emerald-500/10 border-emerald-500/20 text-emerald-400'
                                        : 'bg-amber-500/10 border-amber-500/20 text-amber-300'
                                    }`}
                                  >
                                    {isRead ? 'read' : 'write'}
                                  </span>
                                  <div
                                    className={`w-4 h-4 rounded-md border flex items-center justify-center ${
                                      on
                                        ? 'bg-[#6366F1] border-[#6366F1] text-white'
                                        : 'border-white/20 bg-transparent'
                                    }`}
                                  >
                                    {on && <CheckCheck size={11} />}
                                  </div>
                                </div>
                              </button>
                            );
                          })}
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>

              {/* Bottom Action Grid */}
              <div className="grid grid-cols-2 gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setStep('name')}
                  className="inline-flex items-center justify-center gap-1.5 py-3 rounded-2xl border border-white/10 text-white/70 text-sm font-extrabold cursor-pointer hover:bg-white/5 transition-colors"
                >
                  <ChevronLeft size={16} />
                  Back
                </button>
                {needsUnlock ? (
                  <div className="col-span-2 p-3.5 rounded-2xl bg-[#0A0908] border border-amber-500/30 space-y-2.5">
                    <p className="text-xs font-bold text-amber-300 flex items-center gap-1.5">
                      <Lock size={13} /> Unlock your vault to continue
                    </p>
                    <input
                      type="password"
                      value={unlockPwd}
                      onChange={(e) => setUnlockPwd(e.target.value)}
                      placeholder="Master password"
                      className="w-full rounded-xl bg-[#161412] border border-white/10 px-3.5 py-2.5 text-sm text-white placeholder:text-white/30 outline-none focus:border-[#6366F1]"
                      onKeyDown={(e) => {
                        if (e.key === 'Enter') document.getElementById('aet-unlock-btn')?.click();
                      }}
                    />
                    <button
                      id="aet-unlock-btn"
                      type="button"
                      disabled={unlocking || !unlockPwd}
                      onClick={async () => {
                        const userId = (user as any)?.$id || (user as any)?.id;
                        setUnlocking(true);
                        try {
                          const ok = await masterPassCrypto.unlock(unlockPwd, userId, false);
                          if (ok) {
                            setNeedsUnlock(false);
                            setUnlockPwd('');
                            toast.success('Vault unlocked');
                          } else {
                            toast.error('Wrong master password');
                          }
                        } catch {
                          toast.error('Could not unlock vault');
                        } finally {
                          setUnlocking(false);
                        }
                      }}
                      className="w-full py-2.5 rounded-xl bg-[#6366F1] hover:bg-[#5558E6] text-white text-xs font-extrabold cursor-pointer disabled:opacity-40"
                    >
                      {unlocking ? 'Unlocking…' : 'Unlock Vault'}
                    </button>
                  </div>
                ) : (
                <button
                  type="button"
                  disabled={creating || selected.length === 0}
                  onClick={() => void handleCreate()}
                  className="inline-flex items-center justify-center gap-1.5 py-3 rounded-2xl bg-[#6366F1] hover:bg-[#5558E6] text-white text-sm font-extrabold cursor-pointer disabled:opacity-40 transition-all"
                >
                  <KeyRound size={16} />
                  {creating ? 'Creating…' : isAetToken ? 'Mint Agent Key' : `Mint Token (${selected.length})`}
                </button>
                )}
              </div>
            </div>
          )}

          {step === 'done' && token && (
            <div className="space-y-4 pt-2">
              <div className="rounded-2xl bg-[#0A0908] border border-amber-500/25 p-4 space-y-2">
                <p className="text-[11px] font-bold text-amber-400">
                  {isAetToken && shareSummary
                    ? `Agent key created. It can open ${shareSummary.included} items. Copy it now; you will not see it again.`
                    : 'Secret key generated! Copied to clipboard.'}
                </p>
                {isAetToken && shareSummary && shareSummary.skipped > 0 && (
                  <p className="text-[10px] text-white/50">
                    {shareSummary.skipped} older items could not be included. Open and save them once to make them shareable.
                  </p>
                )}
                <code className="block text-[11px] font-mono text-white/80 break-all select-all bg-[#161412] p-3 rounded-xl border border-white/10">
                  {token}
                </code>
                <p className="text-[10px] text-white/40">
                  You won&apos;t be able to view this full token string again after closing this drawer.
                </p>
              </div>
              <button
                type="button"
                onClick={() => void copy(token)}
                className="w-full inline-flex items-center justify-center gap-2 py-3.5 rounded-2xl border border-white/10 text-white text-sm font-extrabold cursor-pointer hover:bg-white/5 transition-colors"
              >
                <Copy size={16} />
                Copy to Clipboard Again
              </button>
              <button
                type="button"
                onClick={handleClose}
                className="w-full py-3.5 rounded-2xl bg-[#6366F1] hover:bg-[#5558E6] text-white text-sm font-extrabold cursor-pointer transition-colors"
              >
                Done
              </button>
            </div>
          )}
        </div>
      </div>
    </Drawer>
  );
}
