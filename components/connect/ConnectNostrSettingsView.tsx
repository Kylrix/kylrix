'use client';

import React, { useState, useEffect } from 'react';
import { 
  ChevronLeft, 
  Key, 
  Lock, 
  Copy, 
  Check, 
  RotateCcw,
  Globe,
  RadioTower,
  Cpu,
  ShieldCheck,
  Eye,
  EyeOff,
  UserCheck,
  Plus,
  Trash2,
  Sparkles,
  ChevronDown,
  ChevronUp,
  X
} from 'lucide-react';
import { useNostrIdentity } from '@/hooks/useNostrIdentity';
import { 
  NOSTR_CONFIG_DEFAULTS,
  type ConnectFeedSettings, 
  type NostrRelayConfig,
  type NostrSettingsConfig
} from '@/lib/connect/feed-settings';
import toast from 'react-hot-toast';

type Props = {
  settings: ConnectFeedSettings;
  onUpdate: (next: Partial<ConnectFeedSettings>) => void;
  onBack: () => void;
  isExpanded?: boolean;
  onToggleExpand?: () => void;
};

export function ConnectNostrSettingsView({ settings, onUpdate, onBack, isExpanded, onToggleExpand }: Props) {
  const { 
    identity, 
    identities,
    loading: identityLoading, 
    isVaultLocked, 
    unlockAndLoad, 
    loadOrMintIdentity,
    importCustomNsec,
    setActiveIdentity,
    deleteIdentity,
    resetToDefaultIdentity
  } = useNostrIdentity();
  const [copiedKey, setCopiedKey] = useState<string | null>(null);
  const [showNsec, setShowNsec] = useState(false);
  const [showImport, setShowImport] = useState(false);
  const [importNsec, setImportNsec] = useState('');
  const [importLabel, setImportLabel] = useState('');
  const [importing, setImporting] = useState(false);
  const [switchingId, setSwitchingId] = useState<string | null>(null);
  const [newRelayUrl, setNewRelayUrl] = useState('');
  const [newRelayRead, setNewRelayRead] = useState(true);
  const [newRelayWrite, setNewRelayWrite] = useState(true);
  const [newIndexerUrl, setNewIndexerUrl] = useState('');

  useEffect(() => {
    if (!isVaultLocked && !identity) {
      void loadOrMintIdentity();
    }
  }, [isVaultLocked, identity, loadOrMintIdentity]);

  const handleImportAccount = async () => {
    const clean = importNsec.trim();
    if (!clean) return;
    setImporting(true);
    try {
      if (isVaultLocked) {
        await unlockAndLoad();
      }
      await importCustomNsec(clean, importLabel.trim() || undefined);
      setImportNsec('');
      setImportLabel('');
      setShowImport(false);
      toast.success('Custom Nostr account added and set as active!');
    } catch (err: any) {
      toast.error(err?.message || 'Failed to import Nostr account');
    } finally {
      setImporting(false);
    }
  };

  const handleSelectAccount = async (id: string) => {
    setSwitchingId(id);
    try {
      await setActiveIdentity(id);
      toast.success('Active Nostr identity switched');
    } catch (err: any) {
      toast.error(err?.message || 'Failed to switch identity');
    } finally {
      setSwitchingId(null);
    }
  };

  const handleDeleteAccount = async (id: string, npub: string) => {
    if (confirm(`Remove Nostr account ${npub.slice(0, 12)}… from your account list?`)) {
      try {
        await deleteIdentity(id);
        toast.success('Nostr account removed');
      } catch (err: any) {
        toast.error(err?.message || 'Failed to remove account');
      }
    }
  };

  const _handleResetToDefaultAccount = async () => {
    try {
      if (isVaultLocked) {
        await unlockAndLoad();
      }
      await resetToDefaultIdentity();
      toast.success('Reset to default derived Nostr identity');
    } catch (err: any) {
      toast.error(err?.message || 'Failed to reset identity');
    }
  };

  const nostrConfig: NostrSettingsConfig = settings.nostrConfig || NOSTR_CONFIG_DEFAULTS;

  const patchNostr = (patch: Partial<NostrSettingsConfig>) => {
    const updated: NostrSettingsConfig = {
      ...nostrConfig,
      ...patch,
      relays: {
        ...nostrConfig.relays,
        ...(patch.relays || {}),
      },
      performance: {
        ...nostrConfig.performance,
        ...(patch.performance || {}),
      },
      protocol: {
        ...nostrConfig.protocol,
        ...(patch.protocol || {}),
      },
    };
    onUpdate({ nostrConfig: updated });
  };

  const copyToClipboard = (text: string, label: string) => {
    if (!text) return;
    navigator.clipboard.writeText(text);
    setCopiedKey(label);
    toast.success(`${label} copied`);
    setTimeout(() => setCopiedKey(null), 2000);
  };

  const handleExportNsec = async () => {
    if (isVaultLocked || !identity?.nsec) {
      const unlocked = await unlockAndLoad();
      if (unlocked?.nsec) {
        setShowNsec(true);
      }
    } else {
      setShowNsec(prev => !prev);
    }
  };

  const addRelay = () => {
    let url = newRelayUrl.trim();
    if (!url) return;
    if (!url.startsWith('ws://') && !url.startsWith('wss://')) {
      url = `wss://${url}`;
    }
    const currentRelays = nostrConfig.relays.defaults || [];
    if (currentRelays.some(r => r.url.toLowerCase() === url.toLowerCase())) {
      toast.error('Relay already exists');
      return;
    }
    const nextRelays: NostrRelayConfig[] = [
      ...currentRelays,
      { url, read: newRelayRead, write: newRelayWrite },
    ];
    patchNostr({
      relays: {
        ...nostrConfig.relays,
        defaults: nextRelays,
      },
    });
    setNewRelayUrl('');
    toast.success('Relay added');
  };

  const removeRelay = (index: number) => {
    const nextRelays = nostrConfig.relays.defaults.filter((_, i) => i !== index);
    patchNostr({
      relays: {
        ...nostrConfig.relays,
        defaults: nextRelays,
      },
    });
  };

  const toggleRelayDirection = (index: number, direction: 'read' | 'write') => {
    const nextRelays = nostrConfig.relays.defaults.map((r, i) => {
      if (i !== index) return r;
      return {
        ...r,
        [direction]: !r[direction],
      };
    });
    patchNostr({
      relays: {
        ...nostrConfig.relays,
        defaults: nextRelays,
      },
    });
  };

  const addIndexer = () => {
    let url = newIndexerUrl.trim();
    if (!url) return;
    if (!url.startsWith('ws://') && !url.startsWith('wss://')) {
      url = `wss://${url}`;
    }
    const current = nostrConfig.relays.lookupIndexers || [];
    if (current.some(u => u.toLowerCase() === url.toLowerCase())) {
      toast.error('Indexer already exists');
      return;
    }
    patchNostr({
      relays: {
        ...nostrConfig.relays,
        lookupIndexers: [...current, url],
      },
    });
    setNewIndexerUrl('');
    toast.success('Indexer added');
  };

  const removeIndexer = (index: number) => {
    const next = nostrConfig.relays.lookupIndexers.filter((_, i) => i !== index);
    patchNostr({
      relays: {
        ...nostrConfig.relays,
        lookupIndexers: next,
      },
    });
  };

  const resetNostrToDefaults = () => {
    patchNostr(NOSTR_CONFIG_DEFAULTS);
    toast.success('Nostr settings reset to recommended defaults');
  };

  return (
    <div className="flex h-full min-h-0 flex-col bg-[#0A0908]">
      {/* Top Header */}
      <div className="flex items-center justify-between border-b border-white/[0.06] bg-[#0A0908] px-5 py-4 shrink-0">
        <div className="flex items-center gap-2.5">
          <button
            type="button"
            onClick={onBack}
            className="h-8 w-8 rounded-lg bg-[#161412] border border-white/[0.06] grid place-items-center text-white/70 hover:text-white hover:bg-white/5 transition-colors"
            title="Back to feed settings"
          >
            <ChevronLeft size={16} />
          </button>
          <div>
            <p className="text-[10px] font-bold uppercase tracking-wider text-white/40 font-mono m-0">Decentralized Protocol</p>
            <h2 className="text-sm font-black font-clash text-white m-0 leading-none mt-0.5">Nostr settings</h2>
          </div>
        </div>
        <div className="flex items-center gap-1.5">
          {onToggleExpand ? (
            <button
              type="button"
              onClick={onToggleExpand}
              className="p-1.5 rounded-lg text-[#8E8A86] hover:text-white hover:bg-[#161412] transition-colors"
              aria-label={isExpanded ? 'Collapse' : 'Full screen'}
              title={isExpanded ? 'Collapse' : 'Full screen'}
            >
              {isExpanded ? <ChevronDown size={18} /> : <ChevronUp size={18} />}
            </button>
          ) : null}
          <button
            type="button"
            onClick={resetNostrToDefaults}
            className="p-1.5 rounded-lg text-white/40 hover:text-[#F59E0B] hover:bg-white/5 transition-colors"
            title="Reset Nostr to defaults"
          >
            <RotateCcw size={16} />
          </button>
        </div>
      </div>

      <div className="flex-1 overflow-y-auto px-5 py-5 space-y-6 min-h-0">
        {/* Active Account Banner */}
        <section className="space-y-3">
          <div className="flex items-center justify-between">
            <h3 className="text-xs font-extrabold uppercase tracking-wider text-white/60 flex items-center gap-1.5 font-mono">
              <Key size={13} className="text-[#F59E0B]" /> Active Nostr Account
            </h3>
            {identity?.isDerived ? (
              <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-[#F59E0B]/10 border border-[#F59E0B]/20 text-[10px] font-bold font-mono text-[#F59E0B]">
                <Sparkles size={10} /> Auto-Generated (MEK)
              </span>
            ) : (
              <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-white/5 border border-white/10 text-[10px] font-bold font-mono text-white/70">
                Custom Imported
              </span>
            )}
          </div>

          <div className="rounded-xl bg-[#161412] border border-white/[0.06] p-3.5 space-y-3">
            {/* Active Public Key (npub) */}
            <div>
              <div className="flex items-center justify-between mb-1.5">
                <span className="text-[11px] font-bold text-white/60 uppercase tracking-wider font-mono">Public key (npub)</span>
                {identity?.npub && (
                  <button
                    type="button"
                    onClick={() => copyToClipboard(identity.npub, 'Active npub')}
                    className="inline-flex items-center gap-1 text-[11px] font-bold text-[#F59E0B] hover:text-[#F59E0B]/80 font-mono"
                  >
                    {copiedKey === 'Active npub' ? <Check size={11} /> : <Copy size={11} />}
                    {copiedKey === 'Active npub' ? 'Copied' : 'Copy'}
                  </button>
                )}
              </div>
              <div className="rounded-lg bg-[#0A0908] border border-white/[0.04] p-2.5 break-all text-xs font-mono text-white/85 select-all">
                {identity?.npub || (identityLoading ? 'Loading key…' : 'Unlock vault to mint/view npub')}
              </div>
            </div>

            {/* Active Private Key (nsec) */}
            <div className="pt-2 border-t border-white/[0.04]">
              <div className="flex items-center justify-between mb-1.5">
                <span className="text-[11px] font-bold text-white/60 uppercase tracking-wider font-mono flex items-center gap-1.5">
                  <ShieldCheck size={11} className="text-emerald-400" /> Private key (nsec)
                </span>
                {identity?.nsec && showNsec && (
                  <button
                    type="button"
                    onClick={() => copyToClipboard(identity.nsec, 'Active nsec')}
                    className="inline-flex items-center gap-1 text-[11px] font-bold text-[#F59E0B] hover:text-[#F59E0B]/80 font-mono"
                  >
                    {copiedKey === 'Active nsec' ? <Check size={11} /> : <Copy size={11} />}
                    {copiedKey === 'Active nsec' ? 'Copied' : 'Copy'}
                  </button>
                )}
              </div>

              {isVaultLocked || !identity?.nsec ? (
                <button
                  type="button"
                  onClick={handleExportNsec}
                  className="w-full flex items-center justify-center gap-2 rounded-lg bg-[#0A0908] hover:bg-white/[0.03] border border-white/[0.06] p-2.5 text-xs font-bold text-white/80 transition-colors"
                >
                  <Lock size={13} className="text-[#F59E0B]" />
                  Unlock vault to export private key
                </button>
              ) : (
                <div className="space-y-2">
                  <div className="rounded-lg bg-[#0A0908] border border-white/[0.04] p-2.5 break-all text-xs font-mono text-white/85 flex items-center justify-between gap-2">
                    <span className="truncate">
                      {showNsec ? identity.nsec : '••••••••••••••••••••••••••••••••••••••••••••••••••••'}
                    </span>
                    <button
                      type="button"
                      onClick={() => setShowNsec(prev => !prev)}
                      className="text-white/40 hover:text-white shrink-0"
                      title={showNsec ? 'Hide' : 'Reveal'}
                    >
                      {showNsec ? <EyeOff size={13} /> : <Eye size={13} />}
                    </button>
                  </div>
                  <p className="text-[10px] text-amber-500/80 font-mono m-0 leading-tight">
                    Encrypted at rest with your Vault MEK. Never share your nsec with anyone.
                  </p>
                </div>
              )}
            </div>
          </div>
        </section>

        {/* Multi-Account Switcher Section */}
        <section className="space-y-3">
          <div className="flex items-center justify-between">
            <h3 className="text-xs font-extrabold uppercase tracking-wider text-white/60 flex items-center gap-1.5 font-mono">
              <UserCheck size={13} className="text-[#F59E0B]" /> Nostr Account Switcher
            </h3>
            <button
              type="button"
              onClick={() => setShowImport(prev => !prev)}
              className="inline-flex items-center gap-1 text-[11px] font-bold text-[#F59E0B] hover:text-[#F59E0B]/80 font-mono"
            >
              {showImport ? 'Cancel' : <><Plus size={12} /> Import custom nsec</>}
            </button>
          </div>

          {/* Import Custom nsec Card */}
          {showImport && (
            <div className="space-y-2.5 rounded-xl bg-[#161412] border border-[#F59E0B]/30 p-3.5 animate-fadeIn">
              <p className="text-xs font-bold text-white m-0">Import External Nostr Account</p>
              <p className="text-[11px] text-white/40 font-satoshi m-0">
                Paste your existing nsec key. It will be encrypted with your Vault Master Encryption Key (MEK) and stored safely.
              </p>
              <input
                type="text"
                value={importLabel}
                onChange={e => setImportLabel(e.target.value)}
                placeholder="Account label (e.g. Personal, Primal, Nostr Bot)"
                className="w-full h-8 rounded-lg bg-[#0A0908] border border-white/[0.06] px-3 text-xs text-white placeholder:text-white/30 focus:outline-none focus:border-[#F59E0B]/40"
              />
              <input
                type="password"
                value={importNsec}
                onChange={e => setImportNsec(e.target.value)}
                placeholder="nsec1... or 64-char hex private key"
                className="w-full h-8 rounded-lg bg-[#0A0908] border border-white/[0.06] px-3 text-xs font-mono text-white placeholder:text-white/30 focus:outline-none focus:border-[#F59E0B]/40"
              />
              <div className="flex items-center justify-end gap-2 pt-1">
                <button
                  type="button"
                  onClick={() => setShowImport(false)}
                  className="px-3 py-1.5 rounded-lg text-xs font-bold text-white/40 hover:text-white"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={handleImportAccount}
                  disabled={importing || !importNsec.trim()}
                  className="h-8 px-4 rounded-lg bg-[#F59E0B] text-black text-xs font-black disabled:opacity-40 hover:bg-amber-400 transition-colors"
                >
                  {importing ? 'Importing & Encrypting…' : 'Import & Switch'}
                </button>
              </div>
            </div>
          )}

          {/* Accounts List */}
          <div className="space-y-2.5">
            {identities.map((acc, index) => {
              const isActive = identity?.npub === acc.npub || acc.isDefault;
              return (
                <div
                  key={acc.id || acc.npub || index}
                  className={`rounded-xl border p-3 transition-all ${
                    isActive 
                      ? 'bg-[#1C1A18] border-[#F59E0B]/40 shadow-sm' 
                      : 'bg-[#161412] border-white/[0.06] hover:border-white/15'
                  }`}
                >
                  <div className="flex items-center justify-between gap-2 mb-1.5">
                    <div className="flex items-center gap-2 min-w-0">
                      <span className={`h-2 w-2 rounded-full shrink-0 ${isActive ? 'bg-[#F59E0B]' : 'bg-white/20'}`} />
                      <p className="text-xs font-bold font-mono text-white truncate m-0">
                        {acc.label || (acc.isDerived ? 'Default Internal Account' : `Account ${index + 1}`)}
                      </p>
                    </div>
                    <div className="flex items-center gap-1.5 shrink-0">
                      {acc.isDerived && (
                        <span className="px-1.5 py-0.5 rounded bg-white/5 text-[9px] font-mono text-white/50 border border-white/5">
                          Internal MEK
                        </span>
                      )}
                      {isActive ? (
                        <span className="px-2 py-0.5 rounded bg-[#F59E0B] text-[10px] font-black text-black font-mono">
                          ACTIVE
                        </span>
                      ) : (
                        <button
                          type="button"
                          disabled={switchingId === acc.id}
                          onClick={() => acc.id && handleSelectAccount(acc.id)}
                          className="px-2.5 py-1 rounded-lg bg-white/10 hover:bg-[#F59E0B] hover:text-black text-white text-[11px] font-bold font-mono transition-colors disabled:opacity-50"
                        >
                          {switchingId === acc.id ? 'Switching…' : 'Switch'}
                        </button>
                      )}
                    </div>
                  </div>

                  <div className="flex items-center justify-between gap-2 pt-1 text-[11px] font-mono text-white/40">
                    <span className="truncate select-all">{acc.npub}</span>
                    <div className="flex items-center gap-2 shrink-0">
                      <button
                        type="button"
                        onClick={() => copyToClipboard(acc.npub, `npub (${acc.npub.slice(0, 8)}…)`)}
                        className="text-white/40 hover:text-[#F59E0B] transition-colors"
                        title="Copy npub"
                      >
                        {copiedKey === `npub (${acc.npub.slice(0, 8)}…)` ? <Check size={12} className="text-emerald-400" /> : <Copy size={12} />}
                      </button>
                      {!acc.isDerived && acc.id && (
                        <button
                          type="button"
                          onClick={() => handleDeleteAccount(acc.id!, acc.npub)}
                          className="text-white/30 hover:text-red-400 transition-colors"
                          title="Remove account"
                        >
                          <Trash2 size={12} />
                        </button>
                      )}
                    </div>
                  </div>
                </div>
              );
            })}

            {identities.length === 0 && (
              <div className="rounded-xl bg-[#161412] border border-white/[0.06] p-4 text-center">
                <p className="text-xs text-white/40 font-satoshi m-0">
                  {isVaultLocked ? 'Unlock vault to load and switch Nostr accounts.' : 'Deriving default account…'}
                </p>
              </div>
            )}
          </div>
        </section>

        {/* Sync Relays (NIP-65 Outbox Topology) */}
        <section className="space-y-3">
          <div className="flex items-center justify-between">
            <h3 className="text-xs font-extrabold uppercase tracking-wider text-white/60 flex items-center gap-1.5 font-mono">
              <RadioTower size={13} className="text-[#F59E0B]" /> Sync relays
            </h3>
            <span className="text-[10px] font-bold uppercase tracking-wider text-white/30 font-mono">
              NIP-65 Outbox
            </span>
          </div>

          <div className="rounded-xl bg-[#161412] border border-white/[0.06] p-3">
            <p className="text-xs text-white/45 font-satoshi m-0">
              Specify the exact relays you want to sync to (write) and sync from (read). The outbox model optimizes reach while keeping data usage minimal.
            </p>
          </div>

          {/* Add Relay Input */}
          <div className="space-y-2 rounded-xl bg-[#161412] border border-white/[0.06] p-3">
            <div className="flex gap-2">
              <input
                value={newRelayUrl}
                onChange={e => setNewRelayUrl(e.target.value)}
                onKeyDown={e => { if (e.key === 'Enter') { e.preventDefault(); addRelay(); } }}
                placeholder="wss://relay.example.com"
                className="flex-1 h-9 rounded-lg bg-[#0A0908] border border-white/[0.06] px-3 text-xs font-mono text-white placeholder:text-white/30 focus:outline-none focus:border-[#F59E0B]/40"
              />
              <button
                type="button"
                onClick={addRelay}
                className="h-9 px-3 rounded-lg bg-[#F59E0B] text-black text-xs font-extrabold shrink-0"
              >
                Add
              </button>
            </div>
            <div className="flex items-center gap-4 px-1 pt-1">
              <label className="inline-flex items-center gap-1.5 text-xs text-white/70 cursor-pointer select-none">
                <input
                  type="checkbox"
                  checked={newRelayRead}
                  onChange={e => setNewRelayRead(e.target.checked)}
                  className="rounded border-white/20 text-[#F59E0B] focus:ring-0 focus:ring-offset-0 bg-[#0A0908]"
                />
                Sync from (read)
              </label>
              <label className="inline-flex items-center gap-1.5 text-xs text-white/70 cursor-pointer select-none">
                <input
                  type="checkbox"
                  checked={newRelayWrite}
                  onChange={e => setNewRelayWrite(e.target.checked)}
                  className="rounded border-white/20 text-[#F59E0B] focus:ring-0 focus:ring-offset-0 bg-[#0A0908]"
                />
                Sync to (write)
              </label>
            </div>
          </div>

          {/* Configured Relays List */}
          <div className="space-y-2">
            {nostrConfig.relays.defaults.map((relay, idx) => (
              <div
                key={relay.url}
                className="flex items-center justify-between gap-2.5 rounded-xl bg-[#161412] border border-white/[0.06] px-3 py-2.5"
              >
                <div className="min-w-0 flex-1">
                  <p className="text-xs font-mono font-bold text-white truncate m-0">{relay.url}</p>
                  <div className="flex items-center gap-2 mt-1">
                    <button
                      type="button"
                      onClick={() => toggleRelayDirection(idx, 'read')}
                      className={`text-[10px] font-mono font-bold px-2 py-0.5 rounded border transition-colors ${
                        relay.read
                          ? 'bg-emerald-500/10 border-emerald-500/25 text-emerald-400'
                          : 'bg-white/5 border-white/10 text-white/30'
                      }`}
                    >
                      Read {relay.read ? '✓' : '✗'}
                    </button>
                    <button
                      type="button"
                      onClick={() => toggleRelayDirection(idx, 'write')}
                      className={`text-[10px] font-mono font-bold px-2 py-0.5 rounded border transition-colors ${
                        relay.write
                          ? 'bg-[#F59E0B]/10 border-[#F59E0B]/25 text-[#F59E0B]'
                          : 'bg-white/5 border-white/10 text-white/30'
                      }`}
                    >
                      Write {relay.write ? '✓' : '✗'}
                    </button>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => removeRelay(idx)}
                  className="text-white/30 hover:text-red-400 p-1.5 transition-colors"
                  title="Remove relay"
                >
                  <X size={14} />
                </button>
              </div>
            ))}
          </div>
        </section>
        {/* Directory & Metadata Indexers */}
        <section className="space-y-3">
          <h3 className="text-xs font-extrabold uppercase tracking-wider text-white/60 flex items-center gap-1.5 font-mono">
            <Globe size={13} className="text-[#F59E0B]" /> Directory indexers
          </h3>

          <div className="flex gap-2">
            <input
              value={newIndexerUrl}
              onChange={e => setNewIndexerUrl(e.target.value)}
              onKeyDown={e => { if (e.key === 'Enter') { e.preventDefault(); addIndexer(); } }}
              placeholder="wss://purplepag.es"
              className="flex-1 h-9 rounded-xl bg-[#161412] border border-white/[0.06] px-3 text-xs font-mono text-white placeholder:text-white/30 focus:outline-none focus:border-[#F59E0B]/40"
            />
            <button
              type="button"
              onClick={addIndexer}
              className="h-9 px-3 rounded-xl bg-white text-black text-xs font-extrabold shrink-0"
            >
              Add
            </button>
          </div>

          <div className="space-y-2">
            {nostrConfig.relays.lookupIndexers.map((url, idx) => (
              <div
                key={url}
                className="flex items-center justify-between gap-2 rounded-xl bg-[#161412] border border-white/[0.06] px-3 py-2"
              >
                <span className="text-xs font-mono text-white/80 truncate">{url}</span>
                <button
                  type="button"
                  onClick={() => removeIndexer(idx)}
                  className="p-1 text-white/30 hover:text-red-400 transition-colors font-mono font-bold text-xs"
                >
                  ×
                </button>
              </div>
            ))}
          </div>
        </section>

        {/* Performance & Anti-Bloat Controls */}
        <section className="space-y-3">
          <h3 className="text-xs font-extrabold uppercase tracking-wider text-white/60 flex items-center gap-1.5 font-mono">
            <Cpu size={13} className="text-[#F59E0B]" /> Performance & protocol
          </h3>

          <div className="space-y-2">
            {/* Outbox model toggle */}
            <button
              type="button"
              onClick={() => patchNostr({ protocol: { ...nostrConfig.protocol, outboxModel: !nostrConfig.protocol.outboxModel } })}
              className={`w-full flex items-center justify-between gap-3 rounded-xl border px-3 py-3 text-left transition-colors ${
                nostrConfig.protocol.outboxModel ? 'bg-[#1C1A18] border-white/[0.06]' : 'bg-[#0A0908] border-white/[0.06]'
              }`}
            >
              <div className="min-w-0 flex-1">
                <p className="text-sm font-bold text-white font-satoshi m-0">NIP-65 Outbox routing</p>
                <p className="text-xs text-white/40 m-0 mt-0.5">Route queries to authors’ specific write relays</p>
              </div>
              <span className={`shrink-0 h-6 w-10 rounded-full p-0.5 flex items-center transition-colors ${
                nostrConfig.protocol.outboxModel ? 'bg-[#F59E0B] justify-end' : 'bg-white/15 justify-start'
              }`}>
                <span className="h-5 w-5 rounded-full bg-white shadow block" />
              </span>
            </button>

            {/* Eager media toggle */}
            <button
              type="button"
              onClick={() => patchNostr({ performance: { ...nostrConfig.performance, eagerMediaLoading: !nostrConfig.performance.eagerMediaLoading } })}
              className={`w-full flex items-center justify-between gap-3 rounded-xl border px-3 py-3 text-left transition-colors ${
                nostrConfig.performance.eagerMediaLoading ? 'bg-[#1C1A18] border-white/[0.06]' : 'bg-[#0A0908] border-white/[0.06]'
              }`}
            >
              <div className="min-w-0 flex-1">
                <p className="text-sm font-bold text-white font-satoshi m-0">Eager media preloading</p>
                <p className="text-xs text-white/40 m-0 mt-0.5">Preload offscreen images (uses more bandwidth)</p>
              </div>
              <span className={`shrink-0 h-6 w-10 rounded-full p-0.5 flex items-center transition-colors ${
                nostrConfig.performance.eagerMediaLoading ? 'bg-[#F59E0B] justify-end' : 'bg-white/15 justify-start'
              }`}>
                <span className="h-5 w-5 rounded-full bg-white shadow block" />
              </span>
            </button>

            {/* Video autoplay toggle */}
            <button
              type="button"
              onClick={() => patchNostr({ performance: { ...nostrConfig.performance, autoplayVideos: !nostrConfig.performance.autoplayVideos } })}
              className={`w-full flex items-center justify-between gap-3 rounded-xl border px-3 py-3 text-left transition-colors ${
                nostrConfig.performance.autoplayVideos ? 'bg-[#1C1A18] border-white/[0.06]' : 'bg-[#0A0908] border-white/[0.06]'
              }`}
            >
              <div className="min-w-0 flex-1">
                <p className="text-sm font-bold text-white font-satoshi m-0">Video autoplay</p>
                <p className="text-xs text-white/40 m-0 mt-0.5">Automatically buffer and play videos</p>
              </div>
              <span className={`shrink-0 h-6 w-10 rounded-full p-0.5 flex items-center transition-colors ${
                nostrConfig.performance.autoplayVideos ? 'bg-[#F59E0B] justify-end' : 'bg-white/15 justify-start'
              }`}>
                <span className="h-5 w-5 rounded-full bg-white shadow block" />
              </span>
            </button>
          </div>
        </section>

        <p className="text-[10px] text-white/25 text-center font-mono m-0 pb-2">
          Edits are persisted to your account settings and local engine • applies across all sessions
        </p>
      </div>
    </div>
  );
}
