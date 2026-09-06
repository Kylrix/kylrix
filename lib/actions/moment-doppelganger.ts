'use server';

import { generateAiSdkCompletion } from '@/lib/agentic/llm-provider';
import {
  buildMomentCompletePrompt,
  buildMomentDoppelgangerSystemInstruction,
  buildMomentTakeoverPrompt,
  type MomentVoiceSample,
} from '@/lib/agentic/prompts/moment-doppelganger';
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

export async function completeMomentDraftAction(params: {
  draft: string;
  voiceSamples: MomentVoiceSample[];
  coldStartHints?: string[];
  displayName?: string;
  jwt?: string;
}): Promise<{ success: boolean; completion?: string; error?: string }> {
  try {
    const actor = await getActor(params.jwt);
    if (!actor?.$id) return { success: false, error: 'Unauthorized' };
    const hasAccess = await userHasPaidAiAccess(actor.$id);
    if (!hasAccess) return { success: false, error: AI_REQUIRES_PRO_MESSAGE };

    const draft = String(params.draft || '').slice(0, 4000);
    if (draft.trim().length < 2) return { success: true, completion: '' };

    const samples = (params.voiceSamples || []).slice(0, 24);
    const systemInstruction = buildMomentDoppelgangerSystemInstruction({
      displayName: params.displayName || actor.name || actor.email,
      hasVoiceSamples: samples.length > 0,
    });
    const prompt = buildMomentCompletePrompt({
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
