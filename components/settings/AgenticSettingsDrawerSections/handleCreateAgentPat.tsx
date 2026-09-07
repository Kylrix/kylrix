'use client';

import React, { useState, useEffect, useCallback } from 'react';
import { 

export function handleCreateAgentPat(bag: any) {
  const {
  agentPats,
  apkList,
  byokInput,
  copiedApk,
  copiedPrompt,
  copiedToken,
  creatingAgentPat,
  creatingApk,
  framework,
  handleCopyPrompt,
  handleCreateAgentPat,
  handleCreateApk,
  handleMetaGenerate,
  handleRevokeAgentPat,
  handleRevokeApk,
  handleSaveCustomAgent,
  isCreatingApkKey,
  loadAgentPats,
  loadApkList,
  loadingAgentPats,
  loadingApk,
  metaInput,
  metaSuggestions,
  metaThinking,
  name,
  newAgentPatName,
  newApkName,
  newlyCreatedApk,
  newlyCreatedToken,
  prompt,
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
  setSavingByok
  } = bag as any;

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
}
