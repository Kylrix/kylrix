'use server';

import { Query } from 'node-appwrite';
import { createSystemClient } from '@/lib/appwrite-admin';
import { generateAiSdkCompletion } from '@/lib/agentic/llm-provider';
import {
  buildMomentCompletePrompt,
  buildMomentDoppelgangerSystemInstruction,
  buildMomentReplySuggestPrompt,
  buildMomentTakeoverPrompt,
  type MomentVoiceSample,
} from '@/lib/agentic/prompts/moment-doppelganger';
import {
  MOMENT_DOPPELGANGER_TARGET_TYPE,
  momentDoppelgangerRemoteRowId,
  momentDoppelgangerSessionId,
} from '@/lib/agentic/session-local-store';
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
    .replace(/^(SUFFIX|FULL POST|Continuation|Draft)\s*:\s*/i, '')
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
      out = String(j.suffix || j.completion || j.post || j.text || '').trim() || out;
    } catch {}
  }
  return out;
}

/**
 * Never-duplicate ensure for Moments voice twin in agentic_sessions.
 * 1) getRow by deterministic remote id
 * 2) list by userId+targetType+targetId — keep oldest, delete extras
 * 3) create with deterministic id; on conflict re-fetch
 */
export async function ensureMomentDoppelgangerSessionAction(params: {
  jwt?: string;
  contextSnippet?: string;
}): Promise<{ success: boolean; sessionId?: string; remoteId?: string; error?: string }> {
  try {
    const actor = await getActor(params.jwt);
    if (!actor?.$id) return { success: false, error: 'Unauthorized' };

    const userId = actor.$id;
    const remoteId = momentDoppelgangerRemoteRowId(userId);
    const localId = momentDoppelgangerSessionId(userId);
    const { databases } = createSystemClient();
    const context =
      (params.contextSnippet || 'Moment voice twin — one per account. No chat UI.').slice(0, 2000);

    // 1) Deterministic id hit
    try {
      const row = await databases.getRow('passwordManagerDb', 'agentic_sessions', remoteId);
      if (row && (row as any).userId === userId) {
        return { success: true, sessionId: localId, remoteId };
      }
    } catch {}

    // 2) Composite lookup — collapse duplicates
    let rows: any[] = [];
    try {
      const res = await databases.listRows('passwordManagerDb', 'agentic_sessions', [
        Query.equal('userId', userId),
        Query.equal('targetType', MOMENT_DOPPELGANGER_TARGET_TYPE),
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
      // Prefer migrating keeper onto deterministic id when different
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
            targetType: MOMENT_DOPPELGANGER_TARGET_TYPE,
            targetId: userId,
            isWorkspace: false,
            projectId: null,
          });
          try {
            await databases.deleteRow('passwordManagerDb', 'agentic_sessions', keeper.$id);
          } catch {}
          return { success: true, sessionId: localId, remoteId };
        } catch {
          // Race / exists — fall through to get
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

    // 3) Create once with deterministic id
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
        targetType: MOMENT_DOPPELGANGER_TARGET_TYPE,
        targetId: userId,
        isWorkspace: false,
        projectId: null,
      });
      return { success: true, sessionId: localId, remoteId };
    } catch {
      // Concurrent create — re-fetch by id or composite
      try {
        await databases.getRow('passwordManagerDb', 'agentic_sessions', remoteId);
        return { success: true, sessionId: localId, remoteId };
      } catch {}
      try {
        const res = await databases.listRows('passwordManagerDb', 'agentic_sessions', [
          Query.equal('userId', userId),
          Query.equal('targetType', MOMENT_DOPPELGANGER_TARGET_TYPE),
          Query.equal('targetId', userId),
          Query.limit(1),
        ]);
        if (res.rows?.[0]?.$id) {
          return { success: true, sessionId: localId, remoteId: res.rows[0].$id };
        }
      } catch {}
      return { success: false, error: 'Could not ensure moment session' };
    }
  } catch (err: any) {
    return { success: false, error: err?.message || 'Ensure failed' };
  }
}

export async function completeMomentDraftAction(params: {
  draft: string;
  voiceSamples: MomentVoiceSample[];
  coldStartHints?: string[];
  displayName?: string;
  jwt?: string;
  /** Reply mode: allow empty draft + parent context */
  replyMode?: boolean;
  parentSnippet?: string;
}): Promise<{ success: boolean; completion?: string; error?: string }> {
  try {
    const actor = await getActor(params.jwt);
    if (!actor?.$id) return { success: false, error: 'Unauthorized' };
    const hasAccess = await userHasPaidAiAccess(actor.$id);
    if (!hasAccess) return { success: false, error: AI_REQUIRES_PRO_MESSAGE };

    const draft = String(params.draft || '').slice(0, 4000);
    const replyMode = Boolean(params.replyMode);
    if (!replyMode && draft.trim().length < 2) return { success: true, completion: '' };

    const samples = (params.voiceSamples || []).slice(0, 24);
    const systemInstruction = buildMomentDoppelgangerSystemInstruction({
      displayName: params.displayName || actor.name || actor.email,
      hasVoiceSamples: samples.length > 0,
    });

    const prompt = replyMode
      ? buildMomentReplySuggestPrompt({
          draft,
          parentSnippet: params.parentSnippet,
          voiceSamples: samples,
          coldStartHints: params.coldStartHints,
        })
      : buildMomentCompletePrompt({
          draft,
          voiceSamples: samples,
          coldStartHints: params.coldStartHints,
        });

    const raw = await generateAiSdkCompletion({ systemInstruction, prompt });
    const emptyDraft = draft.trim().length === 0;
    const completion = (
      replyMode && emptyDraft
        ? cleanModelText(raw)
        : stripDraftPrefix(raw, draft)
    ).slice(0, replyMode && emptyDraft ? 280 : 400);
    return { success: true, completion };
  } catch (err: any) {
    return { success: false, error: err?.message || 'Could not complete draft' };
  }
}

export async function generateMomentTakeoverAction(params: {
  draft: string;
  voiceSamples: MomentVoiceSample[];
  coldStartHints?: string[];
  displayName?: string;
  jwt?: string;
}): Promise<{ success: boolean; post?: string; error?: string }> {
  try {
    const actor = await getActor(params.jwt);
    if (!actor?.$id) return { success: false, error: 'Unauthorized' };
    const hasAccess = await userHasPaidAiAccess(actor.$id);
    if (!hasAccess) return { success: false, error: AI_REQUIRES_PRO_MESSAGE };

    await ensureMomentDoppelgangerSessionAction({ jwt: params.jwt });

    const samples = (params.voiceSamples || []).slice(0, 24);
    const systemInstruction = buildMomentDoppelgangerSystemInstruction({
      displayName: params.displayName || actor.name || actor.email,
      hasVoiceSamples: samples.length > 0,
    });
    const prompt = buildMomentTakeoverPrompt({
      draft: String(params.draft || '').slice(0, 4000),
      voiceSamples: samples,
      coldStartHints: params.coldStartHints,
    });

    const raw = await generateAiSdkCompletion({ systemInstruction, prompt });
    let post = cleanModelText(raw).slice(0, 2000);
    if (post.startsWith('{')) {
      try {
        const j = JSON.parse(post);
        post = String(j.post || j.text || j.content || '').trim() || post;
      } catch {}
    }
    if (!post) return { success: false, error: 'Empty draft from agent' };
    return { success: true, post };
  } catch (err: any) {
    return { success: false, error: err?.message || 'Could not write post' };
  }
}
