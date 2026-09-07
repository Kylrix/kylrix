'use client';

import React, { useState, useEffect, useCallback } from 'react';
import { 

export function AgenticSettingsDrawerViewPart2(bag: any) {
  const {
    agentPats,
    apkList,
    byokInput,
    cacheKey,
    cached,
    copiedApk,
    copiedPrompt,
    copiedToken,
    creatingAgentPat,
    creatingApk,
    framework,
    fresh,
    handleCopyPrompt,
    handleCreateAgentPat,
    handleCreateApk,
    handleMetaGenerate,
    handleRevokeAgentPat,
    handleRevokeApk,
    handleSaveCustomAgent,
    isCreatingApkKey,
    keyName,
    loadAgentPats,
    loadApkList,
    loadingAgentPats,
    loadingApk,
    metaInput,
    metaSuggestions,
    metaThinking,
    mode,
    name,
    newAgentPatName,
    newApkName,
    newlyCreatedApk,
    newlyCreatedToken,
    next,
    onClose,
    prompt,
    res,
    role,
    saving,
    savingByok,
    setAgentPats,
    setApkList,
    setByokInput,
    setCopiedApk,
    setCopiedPrompt,
    setCopiedToken,
    setCreatingAgentPat,
    setCreatingApk,
    setFramework,
    setIsCreatingApkKey,
    setLoadingAgentPats,
    setLoadingApk,
    setMetaInput,
    setMetaSuggestions,
    setMetaThinking,
    setName,
    setNewAgentPatName,
    setNewApkName,
    setNewlyCreatedApk,
    setNewlyCreatedToken,
    setPrompt,
    setRole,
    setSaving,
    setSavingByok,
    userGoal
  } = bag as any;
  return (
    <>
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
                      <Check size={13} /> Agent key created (shown once)
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
                    Export as <code className="text-[#818cf8] font-mono">KYLRIX_AGENT_KEY</code> in your terminal. It will not be shown again.
                  </p>
                </div>
              </div>
            ) : isCreatingApkKey ? (
              /* STATE 2: Dedicated Key Name Selection & Creation Form */
              <div className="space-y-4">
                <div className="p-4 rounded-2xl bg-[#0A0908] border border-white/[0.06] space-y-3">
                  <div>
                    <label className="text-xs font-bold text-white block mb-2">
                      Name <span className="text-[#6366F1]">*</span>
                    </label>
                    <input
                      value={newApkName}
                      onChange={(e) => setNewApkName(e.target.value)}
                      placeholder="e.g. Cursor agent, CI bot"
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

                <p className="text-xs text-white/45 m-0">
                  Scope: <code className="font-mono text-[#818cf8]">agents:provision</code> — registers the agent and mints its own workspace token. Does not access your notes or vault.
                </p>
              </div>
            ) : (
              /* STATE 3: Active Keys List & Zero-Trust Architecture Info */
              <div className="space-y-4">
                <p className="text-xs text-white/50 m-0 leading-relaxed">
                  Keys start with <code className="font-mono text-[#818cf8]">kyl_apk_</code>. Each key lets one autonomous agent provision its own workspace and mint its own PAT.
                </p>

                <div className="space-y-2.5">
                  <h4 className="text-xs font-bold text-white/40 uppercase tracking-wider font-mono m-0">
                    Active keys
                  </h4>

                  {loadingApk ? (
                    <div className="p-6 rounded-2xl bg-[#0A0908] border border-white/5 flex items-center justify-center text-white/40 text-xs">
                      <RefreshCw size={14} className="animate-spin mr-2" /> Loading keys...
                    </div>
                  ) : apkList.length === 0 ? (
                    <div className="p-6 rounded-2xl bg-[#0A0908] border border-white/5 text-center text-xs text-white/40">
                      No agent keys yet.
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

        {/* ── Mode 6: BYOK & Compute ── */}
        {mode.type === 'manage_byok' && (
          <div className="space-y-4">
            <div className="p-5 rounded-2xl bg-[#0A0908] border border-white/[0.06] space-y-3">
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold text-white font-mono uppercase tracking-wider">
                  Compute Status
                </span>
                <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-[#10B981]/15 text-[#10B981] font-bold">
                  {mode.hasByok ? 'BYOK Unlimited' : `${mode.computeState?.tier || 'Pro'} Tier`}
                </span>
              </div>
              <p className="text-xs text-white/50 m-0 leading-relaxed">
                {mode.hasByok
                  ? 'Your private Google Gemini key is active. All agent prompts and summary passes use your private quota directly without daily ecosystem rate caps.'
                  : 'You are using the shared daily ecosystem compute pool. Add a private Gemini API key for unthrottled generation.'}
              </p>
            </div>

            {/* Token Allocation Bar */}
            <div className="p-4 rounded-2xl bg-[#0A0908] border border-white/[0.06] space-y-2.5">
              <div className="flex items-center justify-between text-xs font-mono">
                <span className="text-white/60">
                  {mode.hasByok ? 'Private API Key Mode:' : 'Daily Token Pool:'}
                </span>
                <span className="text-white font-bold">
                  {mode.hasByok
                    ? '∞ (Uncapped)'
                    : `${(mode.computeState?.balance ?? 100000).toLocaleString()} / ${(mode.computeState?.maxBalance ?? 100000).toLocaleString()} Tokens`}
                </span>
              </div>
              <div className="w-full h-2 rounded-full bg-white/[0.06] overflow-hidden">
                <div
                  className={`h-full transition-all duration-500 rounded-full ${
                    mode.hasByok ? 'w-full bg-[#10B981]' : 'bg-[#10B981]'
                  }`}
                  style={{ width: mode.hasByok ? '100%' : `${mode.computeState?.percent ?? 100}%` }}
                />
              </div>
              <p className="text-[10px] text-white/40 font-mono m-0 pt-1">
                Replenishes automatically every 24 hours.
              </p>
            </div>

            {/* Private API Key Input Card */}
            <div className="p-5 rounded-2xl bg-[#0A0908] border border-white/[0.06] space-y-3">
              <label className="text-xs font-bold text-white font-mono uppercase tracking-wider block">
                Google Gemini API Key
              </label>
              <p className="text-xs text-white/40 m-0">
                Key is sealed securely in your user preferences and never shared across tenants.
              </p>
              <input
                type="password"
                value={byokInput}
                onChange={(e) => setByokInput(e.target.value)}
                placeholder={mode.hasByok ? '•••••••••••••••••••••••• (Active)' : 'AIzaSy...'}
                className="w-full h-11 rounded-xl bg-[#161412] border border-white/[0.08] px-3.5 text-xs font-mono text-white placeholder:text-white/30 focus:outline-none focus:border-[#10B981]"
              />
              <div className="flex gap-2 pt-1">
                {mode.hasByok && (
                  <button
                    type="button"
                    onClick={async () => {
                      setSavingByok(true);
                      try {
                        await mode.onDeleteByok();
                        setByokInput('');
                        onClose();
                      } finally {
                        setSavingByok(false);
                      }
                    }}
                    disabled={savingByok}
                    className="px-4 h-10 rounded-xl bg-red-500/10 hover:bg-red-500/20 text-red-400 font-bold text-xs transition-colors cursor-pointer"
                  >
                    Remove Key
                  </button>
                )}
                <button
                  type="button"
                  onClick={async () => {
                    if (!byokInput.trim()) return;
                    setSavingByok(true);
                    try {
                      await mode.onSaveByok(byokInput.trim());
                      setByokInput('');
                      onClose();
                    } finally {
                      setSavingByok(false);
                    }
                  }}
                  disabled={savingByok || !byokInput.trim()}
                  className="flex-1 h-10 rounded-xl bg-[#10B981] hover:bg-[#059669] text-black font-bold text-xs flex items-center justify-center gap-1.5 transition-all disabled:opacity-40 cursor-pointer shadow-lg shadow-[#10B981]/10"
                >
                  {savingByok ? <RefreshCw size={14} className="animate-spin" /> : <Check size={14} />}
                  <span>{mode.hasByok ? 'Update Key' : 'Save Gemini Key'}</span>
                </button>
              </div>
            </div>
          </div>
        )}

        {/* ── Mode 7: CLI Skill & Superteam Integration ── */}
        {mode.type === 'manage_cli_skill' && (
          <div className="space-y-4">
            <div className="p-5 rounded-2xl bg-[#0A0908] border border-white/[0.06] space-y-3">
              <span className="text-xs font-bold text-white block">Install skills</span>
              <p className="text-xs text-white/50 m-0">
                MCP, REST API, and agent runtime docs in one install:
              </p>
              <div className="p-3 rounded-xl bg-[#161412] border border-white/[0.06] flex items-center justify-between gap-2">
                <code className="text-xs font-mono text-[#818CF8] truncate select-all">
                  {KYLRIX_SKILLS_INSTALL}
                </code>
                <button
                  type="button"
                  onClick={async () => {
                    await navigator.clipboard.writeText(KYLRIX_SKILLS_INSTALL);
                    toast.success('Skill install command copied');
                  }}
                  className="p-1.5 rounded-lg bg-white/5 hover:bg-white/10 text-white/60 hover:text-white transition-colors cursor-pointer shrink-0"
                >
                  <Copy size={13} />
                </button>
              </div>
            </div>

            <div className="p-5 rounded-2xl bg-[#0A0908] border border-white/[0.06] space-y-3">
              <div className="flex items-center justify-between gap-2">
                <span className="text-xs font-bold text-white block">Shell exports</span>
                <button
                  type="button"
                  onClick={async () => {
                    const text = `export KYLRIX_AGENT_KEY=kyl_apk_...\nexport KYLRIX_API_URL=http://localhost:3005/api/v1`;
                    await navigator.clipboard.writeText(text);
                    toast.success('Environment variables copied');
                  }}
                  className="inline-flex items-center gap-1 text-[11px] font-mono font-bold text-[#818CF8] hover:underline cursor-pointer"
                >
                  <Copy size={11} />
                  <span>Copy All</span>
                </button>
              </div>
              <p className="text-xs text-white/50 m-0">
                After minting an agent key above, export it in your terminal:
              </p>
              <div className="space-y-2 max-w-full overflow-hidden">
                {/* Var 1: KYLRIX_AGENT_KEY */}
                <div className="p-2.5 rounded-xl bg-[#161412] border border-white/[0.06] flex items-center justify-between gap-2 min-w-0">
                  <code className="text-xs font-mono text-emerald-400 truncate flex-1 select-all">
                    export KYLRIX_AGENT_KEY=kyl_apk_...
                  </code>
                  <button
                    type="button"
                    onClick={async () => {
                      await navigator.clipboard.writeText('export KYLRIX_AGENT_KEY=kyl_apk_...');
                      toast.success('KYLRIX_AGENT_KEY export copied');
                    }}
                    className="p-1.5 rounded-lg bg-white/5 hover:bg-white/10 text-white/60 hover:text-white transition-colors cursor-pointer shrink-0"
                    title="Copy export"
                  >
                    <Copy size={12} />
                  </button>
                </div>

                {/* Var 2: KYLRIX_API_URL */}
                <div className="p-2.5 rounded-xl bg-[#161412] border border-white/[0.06] flex items-center justify-between gap-2 min-w-0">
                  <code className="text-xs font-mono text-white/70 truncate flex-1 select-all">
                    export KYLRIX_API_URL=http://localhost:3005/api/v1
                  </code>
                  <button
                    type="button"
                    onClick={async () => {
                      await navigator.clipboard.writeText('export KYLRIX_API_URL=http://localhost:3005/api/v1');
                      toast.success('KYLRIX_API_URL export copied');
                    }}
                    className="p-1.5 rounded-lg bg-white/5 hover:bg-white/10 text-white/60 hover:text-white transition-colors cursor-pointer shrink-0"
                    title="Copy export"
                  >
                    <Copy size={12} />
                  </button>
                </div>
              </div>
              <p className="text-xs text-white/35 m-0">
                For tools on your personal workspace, use a PAT from Developers instead of an agent key.
              </p>
            </div>
          </div>
        )}
      </div>

      {/* Fixed Non-Scrolling Bottom Action Bars for BYOK and CLI Skill */}
      {(mode.type === 'manage_byok' || mode.type === 'manage_cli_skill' || mode.type === 'preview_system' || mode.type === 'select_default') && (
        <div className="shrink-0 border-t border-white/[0.06] bg-[#161412] px-5 py-3 md:py-3.5 z-10 flex items-center justify-between gap-3">
          <button
            type="button"
            onClick={onClose}
            className="w-full h-10 rounded-xl bg-white/5 hover:bg-white/10 text-white font-bold text-xs transition-colors cursor-pointer"
          >
            Done
          </button>
        </div>
      )}

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
                <span>Mint agent key</span>
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
              <span>Mint agent key</span>
            </button>
          )}
        </div>
      )}
    </div>
  );
    </>
  );
}
