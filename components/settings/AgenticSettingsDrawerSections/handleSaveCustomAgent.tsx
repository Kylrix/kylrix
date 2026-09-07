'use client';

import React, { useState, useEffect, useCallback } from 'react';
import { 

export function handleSaveCustomAgent(bag: any) {
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

    if (!name.trim()) {
      toast.error('Agent name required');
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
        const { AgentIdentityService } = await import('@/lib/services/agent-identity');
        await AgentIdentityService.syncAgentProfile({
          agentId: mode.agent.$id,
          ownerId: user.$id,
          name: name.trim(),
          role: role.trim(),
          goal: prompt.trim(),
          framework,
        }).catch(() => null);
        toast.success('Agent updated');
        mode.onSaved?.();
      }
      onClose();
    } catch (err: any) {
      toast.error(err?.message || 'Failed to save agent');
    } finally {
      setSaving(false);
    }
}
