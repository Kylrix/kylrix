'use client';

import React, { useState, useEffect, useCallback } from 'react';
import { 
  Cloud, 
  CloudRain, 
  RefreshCw, 
  CheckCircle2, 
  AlertCircle, 
  ShieldAlert, 
  ArrowLeftRight, 
  ArrowUpRight, 
  ArrowDownLeft, 
  Key, 
  Globe, 
  Settings2,
  Check,
  Zap,
  Info
} from 'lucide-react';
import toast from 'react-hot-toast';
import { 
  getCloudSyncConfig, 
  saveCloudSyncConfig, 
  verifyCloudConnection, 
  executeCloudSync, 
  type CloudSyncConfig, 
  type CloudSyncStats,
  type SyncDirection 
} from '@/lib/sync/cloud-sync-client';
import { PairingClient } from '@/sdk/pairing-client';
import { isSelfHostedDeployment } from '@/lib/deployment/surface';

export function CloudSyncSection() {
  const [config, setConfig] = useState<CloudSyncConfig | null>(null);
  const [endpointInput, setEndpointInput] = useState('');
  const [tokenInput, setTokenInput] = useState('');
  const [direction, setDirection] = useState<SyncDirection>('bidirectional');
  const [syncNotes, setSyncNotes] = useState(true);
  const [syncGoals, setSyncGoals] = useState(true);
  const [autoSync, setAutoSync] = useState(false);
  
  const [testing, setTesting] = useState(false);
  const [syncing, setSyncing] = useState(false);
  const [currentStep, setCurrentStep] = useState<string | null>(null);
  const [lastStats, setLastStats] = useState<CloudSyncStats | null>(null);

  // 1-Click Punch & Pair State
  const [pairingSession, setPairingSession] = useState<{
    userCode: string;
    verificationUriComplete: string;
    deviceCode: string;
  } | null>(null);
  const [pairingWaiting, setPairingWaiting] = useState(false);

  const isSelfHosted = isSelfHostedDeployment();

  const handleInitiatePairing = async () => {
    setPairingWaiting(true);
    try {
      const client = new PairingClient(endpointInput || undefined);
      const session = await client.requestPairing({
        clientName: `Self-Hosted Node (${typeof window !== 'undefined' ? window.location.hostname : 'Node'})`,
        clientType: 'self_hosted_sync',
        requestedScopes: ['notes:read', 'notes:write', 'goals:read', 'goals:write', 'profile:read'],
      });

      setPairingSession({
        userCode: session.userCode,
        verificationUriComplete: session.verificationUriComplete,
        deviceCode: session.deviceCode,
      });

      toast.success(`Pairing code generated: ${session.userCode}`);

      // Open authorization screen in new tab/window for 1-click approval
      if (typeof window !== 'undefined') {
        window.open(session.verificationUriComplete, '_blank', 'noopener,noreferrer');
      }

      // Background poll exchange
      const exchanged = await client.pollExchange(session.deviceCode, {
        intervalSeconds: session.interval,
        timeoutSeconds: session.expiresIn,
      });

      // Verification succeeded! Save punch token and verify connection
      setTokenInput(exchanged.token);
      const res = await verifyCloudConnection(endpointInput, exchanged.token);
      if (res.ok && res.account) {
        await saveCloudSyncConfig({
          enabled: true,
          cloudEndpoint: endpointInput.trim(),
          token: exchanged.token,
          syncDirection: direction,
          syncNotes,
          syncGoals,
          autoSync,
          cloudAccount: res.account,
          lastError: null,
        });
        toast.success(`Successfully paired with Cloud account: ${res.account.userId}`);
        setPairingSession(null);
        await loadConfig();
      }
    } catch (err: any) {
      toast.error(err.message || 'Pairing failed.');
    } finally {
      setPairingWaiting(false);
    }
  };

  const loadConfig = useCallback(async () => {
    const cfg = await getCloudSyncConfig();
    setConfig(cfg);
    setEndpointInput(cfg.cloudEndpoint);
    setTokenInput(cfg.token);
    setDirection(cfg.syncDirection);
    setSyncNotes(cfg.syncNotes);
    setSyncGoals(cfg.syncGoals);
    setAutoSync(cfg.autoSync);
  }, []);

  useEffect(() => {
    loadConfig();

    const handleConfigChange = (e: any) => {
      if (e?.detail) {
        setConfig(e.detail);
      }
    };
    window.addEventListener('kylrix:cloud-sync-config-changed', handleConfigChange);
    return () => {
      window.removeEventListener('kylrix:cloud-sync-config-changed', handleConfigChange);
    };
  }, [loadConfig]);

  const handleTestAndSaveConnection = async () => {
    if (!tokenInput.trim()) {
      toast.error('Please provide a Personal Access Token (PAT).');
      return;
    }
    setTesting(true);
    try {
      const res = await verifyCloudConnection(endpointInput, tokenInput);
      if (!res.ok || !res.account) {
        toast.error(res.error || 'Connection failed.');
        return;
      }

      await saveCloudSyncConfig({
        enabled: true,
        cloudEndpoint: endpointInput.trim(),
        token: tokenInput.trim(),
        syncDirection: direction,
        syncNotes,
        syncGoals,
        autoSync,
        cloudAccount: res.account,
        lastError: null,
      });

      toast.success(`Connected to Cloud as ${res.account.userId} (${res.account.tier} Plan)`);
      await loadConfig();
    } catch (err: any) {
      toast.error(err.message || 'Connection test failed.');
    } finally {
      setTesting(false);
    }
  };

  const handleDisconnect = async () => {
    await saveCloudSyncConfig({
      enabled: false,
      token: '',
      cloudAccount: null,
      lastStatus: 'idle',
      lastError: null,
    });
    setTokenInput('');
    toast.success('Cloud replication disconnected.');
    await loadConfig();
  };

  const handleTriggerSync = async () => {
    if (!config?.enabled) {
      toast.error('Please configure and verify connection first.');
      return;
    }
    setSyncing(true);
    setCurrentStep('Starting replication...');
    try {
      const res = await executeCloudSync((step, stats) => {
        setCurrentStep(step);
        setLastStats({ ...stats });
      });

      if (res.success) {
        toast.success('Cloud sync completed cleanly!');
      } else {
        toast.error(res.error || 'Sync completed with warnings.');
      }
      setLastStats(res.stats);
      await loadConfig();
    } catch (err: any) {
      toast.error(err.message || 'Failed to replicate with Cloud.');
    } finally {
      setSyncing(false);
      setCurrentStep(null);
    }
  };

  const handleToggleOption = async (key: 'syncNotes' | 'syncGoals' | 'autoSync', val: boolean) => {
    if (key === 'syncNotes') setSyncNotes(val);
    if (key === 'syncGoals') setSyncGoals(val);
    if (key === 'autoSync') setAutoSync(val);
    await saveCloudSyncConfig({ [key]: val });
  };

  const handleDirectionChange = async (newDir: SyncDirection) => {
    setDirection(newDir);
    await saveCloudSyncConfig({ syncDirection: newDir });
  };

  const isConnected = Boolean(config?.enabled && config?.cloudAccount);

  return (
    <div className="space-y-6">
      {/* Overview & Self-Hosted Context Banner */}
      <section className="rounded-[24px] bg-[#000000] border-2 border-white/20 p-5 md:p-6 space-y-4 shadow-xl">
        <div className="flex items-center justify-between gap-3 flex-wrap">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-[#6366F1]/10 text-[#6366F1] border-2 border-[#6366F1]/30 flex items-center justify-center shrink-0">
              <Cloud size={20} />
            </div>
            <div>
              <h3 className="text-sm font-black text-white font-mono tracking-tight flex items-center gap-2">
                Cloud Replication & Sync
                {isSelfHosted && (
                  <span className="text-[10px] uppercase font-bold tracking-wider px-2 py-0.5 rounded bg-emerald-500/10 text-emerald-400 border border-emerald-500/30">
                    Self-Hosted Node
                  </span>
                )}
              </h3>
              <p className="text-xs text-white/60 font-semibold mt-0.5">
                Bi-directional selective sync between this self-hosted instance and Kylrix Cloud.
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <span className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-[11px] font-bold border-2 font-mono ${
              isConnected 
                ? 'bg-emerald-500/10 border-emerald-500/30 text-emerald-400' 
                : 'bg-white/5 border-white/20 text-white/50'
            }`}>
              <span className={`w-2 h-2 rounded-full ${isConnected ? 'bg-emerald-400 animate-pulse' : 'bg-white/30'}`} />
              {isConnected ? 'Connected' : 'Not Connected'}
            </span>
          </div>
        </div>

        {/* Cloud Account & Tier Status Badge */}
        {isConnected && config?.cloudAccount && (
          <div className="rounded-2xl bg-[#161412] border-2 border-white/15 p-4 flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
            <div className="flex items-center gap-3 min-w-0">
              <div className="w-9 h-9 rounded-xl bg-purple-500/10 text-purple-400 border border-purple-500/30 flex items-center justify-center shrink-0">
                <Globe size={18} />
              </div>
              <div className="min-w-0">
                <p className="text-xs font-bold text-white truncate font-mono">
                  User: {config.cloudAccount.userId}
                </p>
                <div className="flex items-center gap-2 mt-0.5">
                  <span className="text-[10px] font-black uppercase tracking-wider text-[#EC4899]">
                    {config.cloudAccount.tier} PLAN
                  </span>
                  <span className="text-[10px] text-white/40 font-mono">
                    • Max Collabs: {config.cloudAccount.quotas.maxCollaboratorsPerResource ?? 8}
                  </span>
                  <span className="text-[10px] text-white/40 font-mono">
                    • AI: {config.cloudAccount.quotas.aiRateLimitMultiplier}x
                  </span>
                </div>
              </div>
            </div>

            <div className="flex items-center gap-2 w-full md:w-auto justify-end">
              <button
                type="button"
                onClick={handleTriggerSync}
                disabled={syncing}
                className="px-4 py-2 rounded-xl text-xs font-black bg-[#6366F1] hover:bg-[#5254E8] text-white cursor-pointer disabled:opacity-40 border-2 border-[#6366F1] transition-all flex items-center gap-2 shadow-md"
              >
                <RefreshCw size={14} className={syncing ? 'animate-spin' : ''} />
                <span>{syncing ? 'Syncing...' : 'Sync Now'}</span>
              </button>

              <button
                type="button"
                onClick={handleDisconnect}
                disabled={syncing}
                className="px-3 py-2 rounded-xl text-xs font-bold border-2 border-red-500/30 hover:border-red-500/60 bg-red-500/10 text-red-300 cursor-pointer disabled:opacity-40 transition-all"
              >
                Disconnect
              </button>
            </div>
          </div>
        )}

        {/* Sync Progress or Last Status */}
        {currentStep && (
          <div className="rounded-xl bg-[#6366F1]/10 border-2 border-[#6366F1]/30 p-3 flex items-center gap-2 text-xs font-bold text-[#A5B4FC]">
            <RefreshCw size={14} className="animate-spin text-[#6366F1]" />
            <span>{currentStep}</span>
          </div>
        )}

        {lastStats && (
          <div className="rounded-xl bg-[#161412] border-2 border-white/10 p-3.5 space-y-2">
            <div className="flex items-center justify-between text-[11px] font-bold text-white/70 font-mono">
              <span>Last Replication Summary</span>
              <span>{config?.lastSyncAt ? new Date(config.lastSyncAt).toLocaleTimeString() : 'Just now'}</span>
            </div>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-center text-xs">
              <div className="bg-[#000000] p-2 rounded-lg border border-white/10">
                <span className="text-[10px] text-white/50 block font-mono">PULLED</span>
                <span className="font-black text-white">{lastStats.notesPulled + lastStats.goalsPulled} items</span>
              </div>
              <div className="bg-[#000000] p-2 rounded-lg border border-white/10">
                <span className="text-[10px] text-white/50 block font-mono">PUSHED</span>
                <span className="font-black text-emerald-400">{lastStats.notesPushed + lastStats.goalsPushed} items</span>
              </div>
              <div className="bg-[#000000] p-2 rounded-lg border border-white/10">
                <span className="text-[10px] text-white/50 block font-mono">SKIPPED/CLEAN</span>
                <span className="font-black text-white/70">{lastStats.notesSkipped + lastStats.goalsSkipped} items</span>
              </div>
              <div className="bg-[#000000] p-2 rounded-lg border border-white/10">
                <span className="text-[10px] text-white/50 block font-mono">RESOLVED</span>
                <span className="font-black text-purple-400">{lastStats.conflictsResolved} deltas</span>
              </div>
            </div>
            {lastStats.errors.length > 0 && (
              <div className="text-[11px] text-red-400/90 font-mono bg-red-500/10 p-2 rounded border border-red-500/20">
                Warnings: {lastStats.errors.slice(0, 2).join('; ')}
              </div>
            )}
          </div>
        )}
      </section>

      {/* Connection & Credentials Configuration */}
      <section className="rounded-[24px] bg-[#000000] border-2 border-white/20 p-5 md:p-6 space-y-4 shadow-xl">
        <h4 className="text-xs font-black uppercase tracking-wider text-white/60 font-mono">
          Target Cloud Node & Authentication
        </h4>

        <div className="space-y-4">
          <div>
            <label className="text-[11px] font-bold text-white/70 block mb-1.5 font-mono">
              Cloud API Endpoint
            </label>
            <input
              type="text"
              value={endpointInput}
              onChange={(e) => setEndpointInput(e.target.value)}
              placeholder="https://www.kylrix.space/api/v1"
              className="w-full bg-[#161412] border-2 border-white/20 focus:border-[#6366F1] rounded-xl px-3.5 py-2.5 text-xs text-white font-mono outline-none transition-colors"
            />
            <p className="text-[10px] text-white/40 mt-1">
              Default is official Kylrix Cloud (<code>https://www.kylrix.space/api/v1</code>), or any remote Kylrix node.
            </p>
          </div>

          {/* 1-Click Punch & Pair Box */}
          <div className="rounded-2xl bg-[#161412] border-2 border-white/15 p-4 space-y-3">
            <div className="flex items-center justify-between gap-2">
              <div>
                <h5 className="text-xs font-black font-mono text-white flex items-center gap-1.5">
                  <Zap size={15} className="text-[#6366F1]" />
                  <span>Instant Punch Pairing (Recommended)</span>
                </h5>
                <p className="text-[11px] text-white/50 mt-0.5">
                  Authorize this node with a single click — no manual token copy-pasting.
                </p>
              </div>
              <button
                type="button"
                onClick={handleInitiatePairing}
                disabled={pairingWaiting}
                className="px-4 py-2 rounded-xl text-xs font-black bg-[#6366F1] hover:bg-[#5254E8] text-white cursor-pointer disabled:opacity-40 border-2 border-[#6366F1] transition-all flex items-center gap-1.5 shadow-md shrink-0"
              >
                {pairingWaiting ? <RefreshCw size={13} className="animate-spin" /> : <Zap size={13} />}
                <span>{pairingWaiting ? 'Waiting for Approval...' : 'Punch & Pair Now'}</span>
              </button>
            </div>

            {pairingSession && (
              <div className="p-3 bg-black/60 rounded-xl border border-[#6366F1]/30 flex flex-col sm:flex-row items-center justify-between gap-3 text-xs">
                <div className="flex items-center gap-2">
                  <span className="text-[10px] text-white/50 uppercase font-mono">PAIRING CODE:</span>
                  <span className="font-mono font-black text-base text-emerald-400 tracking-wider">
                    {pairingSession.userCode}
                  </span>
                </div>
                <a
                  href={pairingSession.verificationUriComplete}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-xs text-[#818CF8] hover:text-white underline font-mono"
                >
                  Open Approval Link →
                </a>
              </div>
            )}
          </div>

          <div className="relative flex py-1 items-center">
            <div className="flex-grow border-t border-white/10" />
            <span className="flex-shrink mx-3 text-[10px] font-mono text-white/40 uppercase">Or Manual Token</span>
            <div className="flex-grow border-t border-white/10" />
          </div>

          <div>
            <label className="text-[11px] font-bold text-white/70 block mb-1.5 font-mono flex items-center justify-between">
              <span>Personal Access Token (PAT) / Punch Token</span>
              {isConnected && (
                <span className="text-[10px] text-emerald-400 font-normal">● Token active</span>
              )}
            </label>
            <input
              type="password"
              value={tokenInput}
              onChange={(e) => setTokenInput(e.target.value)}
              placeholder="kyl_punch_... or kyl_pat_..."
              className="w-full bg-[#161412] border-2 border-white/20 focus:border-[#6366F1] rounded-xl px-3.5 py-2.5 text-xs text-white font-mono outline-none transition-colors"
            />
            <p className="text-[10px] text-white/40 mt-1">
              Either punch-paired automatically or generated manually under Settings → Developers.
            </p>
          </div>

          <div className="pt-2 flex justify-end">
            <button
              type="button"
              onClick={handleTestAndSaveConnection}
              disabled={testing}
              className="px-5 py-2.5 rounded-xl text-xs font-black bg-[#161412] hover:bg-white/10 text-white cursor-pointer disabled:opacity-40 border-2 border-white/20 transition-all flex items-center gap-2"
            >
              <Key size={14} className={testing ? 'animate-spin' : ''} />
              <span>{testing ? 'Testing connection...' : isConnected ? 'Update Token' : 'Save Manual Token'}</span>
            </button>
          </div>
        </div>
      </section>

      {/* Sync Preferences & Scope Gating */}
      <section className="rounded-[24px] bg-[#000000] border-2 border-white/20 p-5 md:p-6 space-y-5 shadow-xl">
        <h4 className="text-xs font-black uppercase tracking-wider text-white/60 font-mono">
          Replication Mode & Object Selection
        </h4>

        {/* Direction Selector */}
        <div className="space-y-2">
          <label className="text-[11px] font-bold text-white/70 block font-mono">
            Replication Flow
          </label>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5">
            {[
              { id: 'bidirectional', label: 'Bidirectional', desc: 'Sync local & cloud deltas', icon: ArrowLeftRight },
              { id: 'push_only', label: 'Push Only', desc: 'Local backup to Cloud', icon: ArrowUpRight },
              { id: 'pull_only', label: 'Pull Only', desc: 'Mirror Cloud to local', icon: ArrowDownLeft },
            ].map((d) => {
              const Icon = d.icon;
              const isSelected = direction === d.id;
              return (
                <button
                  key={d.id}
                  type="button"
                  onClick={() => handleDirectionChange(d.id as SyncDirection)}
                  className={`p-3.5 rounded-2xl border-2 text-left transition-all cursor-pointer ${
                    isSelected
                      ? 'bg-[#6366F1]/10 border-[#6366F1] text-white shadow-[0_0_12px_rgba(99,102,241,0.2)]'
                      : 'bg-[#161412] border-white/15 text-white/70 hover:border-white/30'
                  }`}
                >
                  <div className="flex items-center gap-2 mb-1">
                    <Icon size={16} className={isSelected ? 'text-[#818CF8]' : 'text-white/40'} />
                    <span className="text-xs font-black">{d.label}</span>
                  </div>
                  <p className="text-[10px] text-white/50 leading-tight">{d.desc}</p>
                </button>
              );
            })}
          </div>
        </div>

        {/* Object Selection */}
        <div className="space-y-3 pt-2">
          <label className="text-[11px] font-bold text-white/70 block font-mono">
            Sync Targets
          </label>
          
          <div className="space-y-2">
            <label className="flex items-center justify-between p-3.5 rounded-xl bg-[#161412] border-2 border-white/15 hover:border-white/30 cursor-pointer transition-colors">
              <div>
                <span className="text-xs font-bold text-white block">Notes & Ideas</span>
                <span className="text-[10px] text-white/50">Includes tags, contents, and public visibility states</span>
              </div>
              <input
                type="checkbox"
                checked={syncNotes}
                onChange={(e) => handleToggleOption('syncNotes', e.target.checked)}
                className="w-4 h-4 rounded text-[#6366F1] focus:ring-0 bg-black border-white/20 cursor-pointer"
              />
            </label>

            <label className="flex items-center justify-between p-3.5 rounded-xl bg-[#161412] border-2 border-white/15 hover:border-white/30 cursor-pointer transition-colors">
              <div>
                <span className="text-xs font-bold text-white block">Goals & Priorities</span>
                <span className="text-[10px] text-white/50">Includes status tracking, deadlines, and project tags</span>
              </div>
              <input
                type="checkbox"
                checked={syncGoals}
                onChange={(e) => handleToggleOption('syncGoals', e.target.checked)}
                className="w-4 h-4 rounded text-[#6366F1] focus:ring-0 bg-black border-white/20 cursor-pointer"
              />
            </label>
          </div>
        </div>

        {/* Tier Safety Guard Warning */}
        <div className="rounded-xl bg-amber-500/10 border-2 border-amber-500/30 p-3.5 flex items-start gap-3">
          <ShieldAlert size={18} className="text-amber-400 shrink-0 mt-0.5" />
          <div className="text-[11px] text-amber-200/90 leading-relaxed font-sans">
            <strong>Quota & Tier Safety Guard:</strong> Self-hosted instances operate with unlimited local storage. When replicating to Kylrix Cloud, objects are verified against your remote Cloud account plan (Free vs Pro) to prevent payload rejections or tier overflows.
          </div>
        </div>
      </section>
    </div>
  );
}
