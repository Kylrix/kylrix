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
  EyeOff
} from 'lucide-react';
import { useNostrIdentity } from '@/hooks/useNostrIdentity';
import { 
  NOSTR_CONFIG_DEFAULTS,
  type ConnectFeedSettings, 
  type NostrRelayConfig,
  type NostrSettingsConfig
} from '@/lib/connect/feed-settings';
import toast from 'react-hot-toast';

  const { 
    identity, 
    loading: identityLoading, 
    isVaultLocked, 
    unlockAndLoad, 
    loadOrMintIdentity,
    importCustomNsec,
    resetToDefaultIdentity
  } = useNostrIdentity();
  const [copiedKey, setCopiedKey] = useState<'npub' | 'nsec' | null>(null);
  const [showNsec, setShowNsec] = useState(false);
  const [showImport, setShowImport] = useState(false);
  const [importNsec, setImportNsec] = useState('');
  const [importing, setImporting] = useState(false);
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
      await importCustomNsec(clean);
      setImportNsec('');
      setShowImport(false);
      toast.success('Nostr account switched successfully');
    } catch (err: any) {
      toast.error(err?.message || 'Failed to switch Nostr account');
    } finally {
      setImporting(false);
    }
  };

  const handleResetToDefaultAccount = async () => {
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

  const copyToClipboard = (text: string, type: 'npub' | 'nsec') => {
    if (!text) return;
    navigator.clipboard.writeText(text);
    setCopiedKey(type);
    toast.success(type === 'npub' ? 'Public key (npub) copied' : 'Private key (nsec) copied');
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
        <button
          type="button"
          onClick={resetNostrToDefaults}
          className="p-1.5 rounded-lg text-white/40 hover:text-[#F59E0B] hover:bg-white/5 transition-colors"
          title="Reset Nostr to defaults"
        >
          <RotateCcw size={14} />
        </button>
      </div>

      <div className="flex-1 overflow-y-auto px-5 py-5 space-y-6 min-h-0">
        {/* Keys & Identity Section */}
        <section className="space-y-3">
          <h3 className="text-xs font-extrabold uppercase tracking-wider text-white/60 flex items-center gap-1.5 font-mono">
            <Key size={13} className="text-[#F59E0B]" /> Nostr keys
          </h3>

          <div className="rounded-xl bg-[#161412] border border-white/[0.06] p-3.5 space-y-3">
            {/* Public Key (npub) */}
            <div>
              <div className="flex items-center justify-between mb-1.5">
                <span className="text-[11px] font-bold text-white/60 uppercase tracking-wider font-mono">Public key (npub)</span>
                {identity?.npub && (
                  <button
                    type="button"
                    onClick={() => copyToClipboard(identity.npub, 'npub')}
                    className="inline-flex items-center gap-1 text-[11px] font-bold text-[#F59E0B] hover:text-[#F59E0B]/80 font-mono"
                  >
                    {copiedKey === 'npub' ? <Check size={11} /> : <Copy size={11} />}
                    {copiedKey === 'npub' ? 'Copied' : 'Copy'}
                  </button>
                )}
              </div>
              <div className="rounded-lg bg-[#0A0908] border border-white/[0.04] p-2.5 break-all text-xs font-mono text-white/85 select-all">
                {identity?.npub || (identityLoading ? 'Loading key…' : 'Unlock vault to mint/view npub')}
              </div>
            </div>

            {/* Private Key (nsec) */}
            <div className="pt-2 border-t border-white/[0.04]">
              <div className="flex items-center justify-between mb-1.5">
                <span className="text-[11px] font-bold text-white/60 uppercase tracking-wider font-mono flex items-center gap-1.5">
                  <ShieldCheck size={11} className="text-emerald-400" /> Private key (nsec)
                </span>
                {identity?.nsec && showNsec && (
                  <button
                    type="button"
                    onClick={() => copyToClipboard(identity.nsec, 'nsec')}
                    className="inline-flex items-center gap-1 text-[11px] font-bold text-[#F59E0B] hover:text-[#F59E0B]/80 font-mono"
                  >
                    {copiedKey === 'nsec' ? <Check size={11} /> : <Copy size={11} />}
                    {copiedKey === 'nsec' ? 'Copied' : 'Copy'}
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
                    Never share your nsec with anyone. It gives full control of your Nostr identity.
                  </p>
                </div>
              )}
            </div>

            {/* Switch / Import Nostr Account */}
            <div className="pt-2 border-t border-white/[0.04] space-y-2">
              <div className="flex items-center justify-between">
                <span className="text-[11px] font-bold text-white/60 uppercase tracking-wider font-mono">Account switching</span>
                <button
                  type="button"
                  onClick={() => setShowImport(prev => !prev)}
                  className="text-[11px] font-bold text-[#F59E0B] hover:text-[#F59E0B]/80 font-mono"
                >
                  {showImport ? 'Cancel' : '+ Import custom nsec'}
                </button>
              </div>

              {showImport ? (
                <div className="space-y-2 rounded-lg bg-[#0A0908] border border-white/[0.06] p-2.5">
                  <input
                    type="password"
                    value={importNsec}
                    onChange={e => setImportNsec(e.target.value)}
                    placeholder="nsec1... or 64-char hex private key"
                    className="w-full h-8 rounded bg-[#161412] border border-white/[0.06] px-2.5 text-xs font-mono text-white placeholder:text-white/30 focus:outline-none focus:border-[#F59E0B]/40"
                  />
                  <div className="flex items-center justify-between gap-2 pt-1">
                    <button
                      type="button"
                      onClick={handleResetToDefaultAccount}
                      className="text-[10px] font-mono text-white/40 hover:text-white"
                    >
                      Reset to default derived key
                    </button>
                    <button
                      type="button"
                      onClick={handleImportAccount}
                      disabled={importing || !importNsec.trim()}
                      className="h-7 px-3 rounded bg-[#F59E0B] text-black text-xs font-extrabold disabled:opacity-40"
                    >
                      {importing ? 'Importing…' : 'Switch account'}
                    </button>
                  </div>
                </div>
              ) : (
                <div className="flex items-center justify-between">
                  <span className="text-xs text-white/40">Using custom or default Nostr identity</span>
                  <button
                    type="button"
                    onClick={handleResetToDefaultAccount}
                    className="text-[11px] font-mono font-bold text-white/40 hover:text-white"
                    title="Derive fresh key from vault MEK"
                  >
                    Reset to default
                  </button>
                </div>
              )}
            </div>
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
                          ? 'bg-emerald-500/10 border-emerald-500/30 text-emerald-400' 
                          : 'bg-white/[0.02] border-white/[0.06] text-white/30'
                      }`}
                    >
                      {relay.read ? '✓ Read' : 'Read off'}
                    </button>
                    <button
                      type="button"
                      onClick={() => toggleRelayDirection(idx, 'write')}
                      className={`text-[10px] font-mono font-bold px-2 py-0.5 rounded border transition-colors ${
                        relay.write 
                          ? 'bg-amber-500/10 border-amber-500/30 text-amber-400' 
                          : 'bg-white/[0.02] border-white/[0.06] text-white/30'
                      }`}
                    >
                      {relay.write ? '✓ Write' : 'Write off'}
                    </button>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => removeRelay(idx)}
                  className="p-1.5 rounded-lg text-white/30 hover:text-red-400 hover:bg-red-500/10 transition-colors shrink-0"
                  title="Remove relay"
                >
                  <span className="text-xs font-bold font-mono">×</span>
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
