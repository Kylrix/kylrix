'use server';

import { Query } from 'node-appwrite';
import { createSystemClient } from '@/lib/appwrite-admin';
import { generateAiSdkCompletion } from '@/lib/agentic/llm-provider';
import {
  buildTypeIntelCompletePrompt,
  buildTypeIntelSystemInstruction,
  buildTypeIntelTakeoverPrompt,
  buildWorkspaceIntelNudgePrompt,
  type TypeIntelVoiceSample,
} from '@/lib/agentic/prompts/type-intel';
import {
  typeIntelRemoteRowId,
  typeIntelSessionId,
  typeIntelTargetType,
} from '@/lib/agentic/session-local-store';
import type { TypeIntelKind } from '@/lib/agentic/type-intel-kinds';
import { TYPE_INTEL_KINDS } from '@/lib/agentic/type-intel-kinds';
import { AI_REQUIRES_PRO_MESSAGE } from '@/lib/agentic/access';
import { userHasPaidAiAccess } from '@/lib/server/ai-subscription-gate';

async function getActor(jwt?: string) {
  const { getActor } = await import('./secure-ops');
  return getActor(jwt);
}

function cleanModelText(raw: string): string {
  return String(raw || '')
    .replace(/^```[\w]*\s*/i, '')
    .replace(/```\s*$/i, '')
    .replace(/^["']|["']$/g, '')
    .replace(/^(SUFFIX|FULL DRAFT|FULL POST|Continuation|Draft)\s*:\s*/i, '')
    .trim();
}

function stripDraftPrefix(completion: string, draft: string): string {
  let out = cleanModelText(completion);
  const d = draft.trim();
  if (d && out.startsWith(d)) {
    out = out.slice(d.length).replace(/^\s+/, '');
  }
  if (out.startsWith('{')) {
    try {
      const j = JSON.parse(out);
      out = String(j.suffix || j.completion || j.post || j.text || j.content || '').trim() || out;
    } catch {}
  }
  return out;
}

function assertKind(kind: string): TypeIntelKind {
  if (kind in TYPE_INTEL_KINDS) return kind as TypeIntelKind;
  throw new Error('Invalid type intel kind');
}

/**
 * Never-duplicate ensure for type-intel sessions in agentic_sessions.
 * 1) getRow by deterministic remote id
 * 2) list by userId+targetType+targetId — keep oldest, delete extras
 * 3) create with deterministic id; on conflict re-fetch
 */
export async function ensureTypeIntelSessionAction(params: {
  kind: TypeIntelKind;
  jwt?: string;
  contextSnippet?: string;
}): Promise<{ success: boolean; sessionId?: string; remoteId?: string; error?: string }> {
  try {
    const actor = await getActor(params.jwt);
    if (!actor?.$id) return { success: false, error: 'Unauthorized' };

    const kind = assertKind(params.kind);
    const userId = actor.$id;
    const remoteId = typeIntelRemoteRowId(kind, userId);
    const localId = typeIntelSessionId(kind, userId);
    const targetType = typeIntelTargetType(kind);
    const { databases } = createSystemClient();
    const label = TYPE_INTEL_KINDS[kind].label;
    const context = (
      params.contextSnippet ||
      `${label} writing twin — one per account × type. No chat UI.`
    ).slice(0, 2000);

    try {
      const row = await databases.getRow('passwordManagerDb', 'agentic_sessions', remoteId);
      if (row && (row as any).userId === userId) {
        return { success: true, sessionId: localId, remoteId };
      }
    } catch {}

    let rows: any[] = [];
    try {
      const res = await databases.listRows('passwordManagerDb', 'agentic_sessions', [
        Query.equal('userId', userId),
        Query.equal('targetType', targetType),
        Query.equal('targetId', userId),
        Query.limit(25),
      ]);
      rows = res.rows || [];
    } catch {}

    if (rows.length > 0) {
      rows.sort((a, b) => {
        const at = new Date(a.$createdAt || a.createdAt || 0).getTime();
        const bt = new Date(b.$createdAt || b.createdAt || 0).getTime();
        return at - bt;
      });
      const keeper = rows[0];
      for (const extra of rows.slice(1)) {
        try {
          await databases.deleteRow('passwordManagerDb', 'agentic_sessions', extra.$id);
        } catch {}
      }
      if (keeper.$id !== remoteId) {
        try {
          await databases.createRow('passwordManagerDb', 'agentic_sessions', remoteId, {
            userId,
            context: (keeper.context || context).slice(0, 2000),
            chatHistory: keeper.chatHistory || '[]',
            seen: true,
            isMemory: false,
            isPublic: false,
            isGuest: false,
            isPinned: false,
            targetType,
            targetId: userId,
            isWorkspace: false,
            projectId: null,
          });
          try {
            await databases.deleteRow('passwordManagerDb', 'agentic_sessions', keeper.$id);
          } catch {}
          return { success: true, sessionId: localId, remoteId };
        } catch {
          try {
            await databases.getRow('passwordManagerDb', 'agentic_sessions', remoteId);
            return { success: true, sessionId: localId, remoteId };
          } catch {
            return { success: true, sessionId: localId, remoteId: keeper.$id };
          }
        }
      }
      return { success: true, sessionId: localId, remoteId: keeper.$id };
    }

    try {
      await databases.createRow('passwordManagerDb', 'agentic_sessions', remoteId, {
        userId,
        context,
        chatHistory: '[]',
        seen: true,
        isMemory: false,
        isPublic: false,
        isGuest: false,
        isPinned: false,
        targetType,
        targetId: userId,
        isWorkspace: false,
        projectId: null,
      });
      return { success: true, sessionId: localId, remoteId };
    } catch {
      try {
        await databases.getRow('passwordManagerDb', 'agentic_sessions', remoteId);
        return { success: true, sessionId: localId, remoteId };
      } catch {}
      try {
        const res = await databases.listRows('passwordManagerDb', 'agentic_sessions', [
          Query.equal('userId', userId),
          Query.equal('targetType', targetType),
          Query.equal('targetId', userId),
          Query.limit(1),
        ]);
        if (res.rows?.[0]?.$id) {
          return { success: true, sessionId: localId, remoteId: res.rows[0].$id };
        }
      } catch {}
      return { success: false, error: 'Could not ensure type intel session' };
    }
  } catch (err: any) {
    return { success: false, error: err?.message || 'Ensure failed' };
  }
}

export async function completeTypeIntelDraftAction(params: {
  kind: TypeIntelKind;
  draft: string;
  voiceSamples: TypeIntelVoiceSample[];
  coldStartHints?: string[];
  displayName?: string;
  jwt?: string;
}): Promise<{ success: boolean; completion?: string; error?: string }> {
  try {
    const actor = await getActor(params.jwt);
    if (!actor?.$id) return { success: false, error: 'Unauthorized' };
    const hasAccess = await userHasPaidAiAccess(actor.$id);
    if (!hasAccess) return { success: false, error: AI_REQUIRES_PRO_MESSAGE };

    const kind = assertKind(params.kind);
    await ensureTypeIntelSessionAction({ kind, jwt: params.jwt });

    const draft = String(params.draft || '').slice(0, 4000);
    if (draft.trim().length < 2) return { success: true, completion: '' };

    const samples = (params.voiceSamples || []).slice(0, 24);
    const systemInstruction = buildTypeIntelSystemInstruction({
      kind,
      displayName: params.displayName || actor.name || actor.email,
      hasVoiceSamples: samples.length > 0,
    });
    const prompt = buildTypeIntelCompletePrompt({
      kind,
      draft,
      voiceSamples: samples,
      coldStartHints: params.coldStartHints,
    });

    const raw = await generateAiSdkCompletion({ systemInstruction, prompt });
    const completion = stripDraftPrefix(raw, draft).slice(0, 400);
    return { success: true, completion };
  } catch (err: any) {
    return { success: false, error: err?.message || 'Could not complete draft' };
  }
}

export async function generateTypeIntelTakeoverAction(params: {
  kind: TypeIntelKind;
  draft: string;
  voiceSamples: TypeIntelVoiceSample[];
  coldStartHints?: string[];
  displayName?: string;
  jwt?: string;
}): Promise<{ success: boolean; draft?: string; error?: string }> {
  try {
    const actor = await getActor(params.jwt);
    if (!actor?.$id) return { success: false, error: 'Unauthorized' };
    const hasAccess = await userHasPaidAiAccess(actor.$id);
    if (!hasAccess) return { success: false, error: AI_REQUIRES_PRO_MESSAGE };

    const kind = assertKind(params.kind);
    await ensureTypeIntelSessionAction({ kind, jwt: params.jwt });

    const samples = (params.voiceSamples || []).slice(0, 24);
    const systemInstruction = buildTypeIntelSystemInstruction({
      kind,
      displayName: params.displayName || actor.name || actor.email,
      hasVoiceSamples: samples.length > 0,
    });
    const prompt = buildTypeIntelTakeoverPrompt({
      kind,
      draft: String(params.draft || '').slice(0, 4000),
      voiceSamples: samples,
      coldStartHints: params.coldStartHints,
    });

    const raw = await generateAiSdkCompletion({ systemInstruction, prompt });
    let draft = cleanModelText(raw).slice(0, 4000);
    if (draft.startsWith('{')) {
      try {
        const j = JSON.parse(draft);
        draft = String(j.draft || j.post || j.text || j.content || '').trim() || draft;
      } catch {}
    }
    if (!draft) return { success: false, error: 'Empty draft from agent' };
    return { success: true, draft };
  } catch (err: any) {
    return { success: false, error: err?.message || 'Could not write draft' };
  }
}

/** Occasional workspace tip — samples come from LocalEngine; no table list on server. */
export async function generateWorkspaceIntelNudgeAction(params: {
  jwt?: string;
  displayName?: string;
  samples: Array<{ kind: string; title: string; blurb?: string }>;
}): Promise<{
  success: boolean;
  title?: string;
  message?: string;
  actionHref?: string;
  error?: string;
}> {
  try {
    const actor = await getActor(params.jwt);
    if (!actor?.$id) return { success: false, error: 'Unauthorized' };
    const hasAccess = await userHasPaidAiAccess(actor.$id);
    if (!hasAccess) return { success: false, error: AI_REQUIRES_PRO_MESSAGE };

    // Touch type-intel project session once (never-dup) — no object table reads
    await ensureTypeIntelSessionAction({ kind: 'project', jwt: params.jwt });

    const samples = (params.samples || []).slice(0, 8);
    if (!samples.length) return { success: false, error: 'No samples' };

    const { systemInstruction, prompt } = buildWorkspaceIntelNudgePrompt({
      displayName: params.displayName || actor.name || actor.email,
      samples,
    });
    const raw = await generateAiSdkCompletion({ systemInstruction, prompt });
    let parsed: any = null;
    const cleaned = cleanModelText(raw);
    try {
      const start = cleaned.indexOf('{');
      const end = cleaned.lastIndexOf('}');
      if (start >= 0 && end > start) parsed = JSON.parse(cleaned.slice(start, end + 1));
    } catch {}

    const title = String(parsed?.title || 'Workspace tip').trim().slice(0, 40);
    const message = String(parsed?.message || cleaned).trim().slice(0, 160);
    let actionHref = String(parsed?.actionHref || '/workspaces').trim();
    if (!actionHref.startsWith('/')) actionHref = '/workspaces';
    if (!message) return { success: false, error: 'Empty tip' };
    return { success: true, title, message, actionHref };
  } catch (err: any) {
    return { success: false, error: err?.message || 'Could not write tip' };
  }
}
