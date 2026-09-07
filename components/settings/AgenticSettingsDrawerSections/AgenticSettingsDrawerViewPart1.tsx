'use client';

import React, { useState, useEffect, useCallback } from 'react';
import { 

export function AgenticSettingsDrawerViewPart1(bag: any) {
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
              {mode.type === 'list_custom' && 'Autonomous Agents'}
              {mode.type === 'list_system' && 'Core Specialists'}
              {mode.type === 'preview_system' && 'Internal System Agent'}
              {mode.type === 'create_custom' && 'Agent Crafter'}
              {mode.type === 'edit_custom' && 'Edit Custom Agent'}
              {mode.type === 'select_default' && 'Select Default Partner'}
              {mode.type === 'manage_provisioning_keys' && (isCreatingApkKey ? 'New key' : 'Agent keys')}
              {mode.type === 'manage_byok' && 'Gemini API key'}
              {mode.type === 'manage_cli_skill' && 'Terminal setup'}
            </p>
            <h2 className="text-sm font-black font-clash text-white m-0 leading-tight mt-0.5">
              {mode.type === 'list_custom' && 'Custom Agents Catalog'}
              {mode.type === 'list_system' && 'Internal System Agents'}
              {mode.type === 'preview_system' && mode.agent.name}
              {mode.type === 'create_custom' && 'Create Custom Agent'}
              {mode.type === 'edit_custom' && name}
              {mode.type === 'select_default' && 'Active Agent Partner'}
              {mode.type === 'manage_provisioning_keys' && (isCreatingApkKey ? 'Mint agent key' : 'Agent keys')}
              {mode.type === 'manage_byok' && 'Gemini API key'}
              {mode.type === 'manage_cli_skill' && 'Terminal setup'}
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
        {/* MODE 0A: List Custom Autonomous Agents */}
        {mode.type === 'list_custom' && (
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <span className="text-xs font-mono font-bold text-white/50 uppercase tracking-wider">
                {mode.customAgents.length} Agents Configured
              </span>
              <button
                type="button"
                onClick={mode.onCreateAgent}
                className="h-8 px-3 rounded-xl bg-[#6366F1] hover:bg-[#5254E8] text-white font-bold text-xs flex items-center gap-1 transition-all cursor-pointer shadow-md"
              >
                <Plus size={12} />
                <span>New Agent</span>
              </button>
            </div>

            {mode.customAgents.length === 0 ? (
              <div className="p-8 rounded-[22px] bg-[#0A0908] border border-white/10 flex flex-col items-center justify-center text-center gap-2.5">
                <div className="w-10 h-10 rounded-2xl bg-white/[0.03] border border-white/10 grid place-items-center text-white/30">
                  <Bot size={20} />
                </div>
                <div>
                  <h4 className="text-sm font-bold text-white m-0">No Custom Agents Yet</h4>
                  <p className="text-xs text-white/40 max-w-sm mt-0.5 m-0">
                    Use the Meta Crafter to build specialized agents with their own dedicated Agentic PATs.
                  </p>
                </div>
                <button
                  type="button"
                  onClick={mode.onCreateAgent}
                  className="mt-1 h-8 px-3.5 rounded-xl bg-white/[0.06] hover:bg-white/[0.12] border border-white/10 text-white font-bold text-xs flex items-center gap-1.5 transition-all cursor-pointer"
                >
                  <Plus size={13} />
                  <span>Create Custom Agent</span>
                </button>
              </div>
            ) : (
              <div className="space-y-3">
                {mode.customAgents.map((ca) => {
                  const cfg = JSON.parse(ca.config || '{}');
                  const isSelected = mode.defaultAgentId === ca.$id;
                  return (
                    <div
                      key={ca.$id}
                      onClick={() => {
                        onClose();
                        mode.onSelectAgent(ca);
                      }}
                      className="p-4 bg-[#0A0908] border border-white/10 hover:border-[#6366F1]/40 hover:bg-[#161412] rounded-[22px] shadow-lg flex flex-col justify-between gap-3 transition-all cursor-pointer group"
                    >
                      <div className="flex items-start justify-between gap-3">
                        <div className="flex items-center gap-3 min-w-0">
                          <div className="w-10 h-10 rounded-xl bg-[#161412] border border-white/10 flex items-center justify-center text-[#6366F1] shrink-0 font-bold">
                            <Bot size={18} />
                          </div>
                          <div className="min-w-0 flex-1">
                            <div className="flex items-center gap-1.5 flex-wrap">
                              <h4 className="text-white font-bold text-xs font-clash m-0 truncate group-hover:text-[#818CF8] transition-colors">
                                {cfg.name || 'Custom Agent'}
                              </h4>
                              <span className="text-[9px] font-mono px-1.5 py-0.2 rounded bg-[#6366F1]/15 text-[#818cf8] font-bold border border-[#6366F1]/20">
                                {cfg.framework || 'kylrix'}
                              </span>
                            </div>
                            <p className="text-white/40 text-[11px] mt-0.5 m-0 truncate">
                              {cfg.role || cfg.goal || 'Custom instructions defined'}
                            </p>
                          </div>
                        </div>

                        <div className="flex items-center gap-1 shrink-0">
                          {isSelected && (
                            <span className="text-[9px] font-mono font-bold px-2 py-0.5 rounded bg-[#F59E0B]/20 text-[#F59E0B] border border-[#F59E0B]/30">
                              Default
                            </span>
                          )}
                        </div>
                      </div>

                      <div className="flex items-center justify-between text-[11px] font-mono text-[#818cf8] border-t border-white/10 pt-2">
                        <span className="flex items-center gap-1 text-[10px]">
                          <Key size={11} className="text-emerald-400" /> Keys & Actions
                        </span>
                        <span className="font-bold group-hover:underline flex items-center gap-0.5">
                          Inspect <ChevronRight size={12} />
                        </span>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        )}

        {/* MODE 0B: List Internal System Agents */}
        {mode.type === 'list_system' && (
          <div className="space-y-4">
            <div className="p-4 rounded-2xl bg-[#0A0908] border border-white/[0.06] space-y-1">
              <span className="text-xs font-bold text-white font-mono uppercase tracking-wider block">
                System Specialist Catalog
              </span>
              <p className="text-xs text-white/50 m-0">
                Pre-built task agents for workspace orchestration, flow mapping, and meta prompt crafting.
              </p>
            </div>

            <div className="space-y-3">
              {SYSTEM_AGENTS.map((agent) => {
                const isKylie = agent.id === 'kylie';
                return (
                  <div
                    key={agent.id}
                    onClick={() => {
                      onClose();
                      mode.onSelectAgent(agent);
                    }}
                    className="p-4 bg-[#0A0908] border border-white/10 hover:border-[#F59E0B]/40 hover:bg-[#161412] rounded-[22px] shadow-lg flex flex-col justify-between gap-3 transition-all cursor-pointer group"
                  >
                    <div className="flex items-center gap-3 min-w-0">
                      <div className="w-10 h-10 rounded-xl bg-[#F59E0B]/10 text-[#F59E0B] flex items-center justify-center text-lg shrink-0 border border-[#F59E0B]/20">
                        {agent.avatar}
                      </div>
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-1.5">
                          <h4 className="text-white font-bold text-xs font-clash m-0 truncate group-hover:text-[#F59E0B] transition-colors">
                            {agent.name}
                          </h4>
                          {isKylie && (
                            <span className="text-[8px] font-mono px-1.5 py-0.2 rounded bg-[#F59E0B]/20 text-[#F59E0B] font-bold border border-[#F59E0B]/30">
                              Core
                            </span>
                          )}
                        </div>
                        <p className="text-white/40 text-[11px] m-0 mt-0.5 truncate">{agent.role}</p>
                      </div>
                    </div>

                    <div className="flex items-center justify-between text-[11px] font-mono text-[#F59E0B] border-t border-white/10 pt-2">
                      <span>Inspect Prompt & Persona</span>
                      <ChevronRight size={12} />
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}
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
    </>
  );
}
