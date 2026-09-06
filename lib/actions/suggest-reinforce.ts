'use server';

import { generateAiSdkCompletion } from '@/lib/agentic/llm-provider';
import {
  buildSuggestReinforceSystemInstruction,
  buildSuggestReinforceUserPrompt,
  type SuggestReinforceSignal,
} from '@/lib/agentic/prompts/suggest-reinforce';
import { AI_REQUIRES_PRO_MESSAGE } from '@/lib/agentic/access';
import { userHasPaidAiAccess } from '@/lib/server/ai-subscription-gate';

async function getActor(jwt?: string) {
  const { getActor } = await import('./secure-ops');
  return getActor(jwt);
}

function parseCuratorJson(raw: string): {
  worthRecording: boolean;
  styleNotes: string[];
  conversationBit: string | null;
  voiceSample: string | null;
  sessionInfoLine: string | null;
} {
  let text = String(raw || '')
    .replace(/^```[\w]*\s*/i, '')
    .replace(/```\s*$/i, '')
    .trim();
  const start = text.indexOf('{');
  const end = text.lastIndexOf('}');
  if (start >= 0 && end > start) text = text.slice(start, end + 1);
  try {
    const j = JSON.parse(text);
    return {
      worthRecording: Boolean(j?.worthRecording),
      styleNotes: Array.isArray(j?.styleNotes)
        ? j.styleNotes.map((x: unknown) => String(x || '').trim()).filter(Boolean).slice(0, 3)
        : [],
      conversationBit: j?.conversationBit ? String(j.conversationBit).trim().slice(0, 220) : null,
      voiceSample: j?.voiceSample ? String(j.voiceSample).trim().slice(0, 140) : null,
      sessionInfoLine: j?.sessionInfoLine ? String(j.sessionInfoLine).trim().slice(0, 80) : null,
    };
  } catch {
    return {
      worthRecording: false,
      styleNotes: [],
      conversationBit: null,
      voiceSample: null,
      sessionInfoLine: null,
    };
  }
}

/**
 * Background curator — decides what edit signals belong in Moments session memory.
 */
export async function reinforceSuggestLearningAction(params: {
  jwt?: string;
  signals: SuggestReinforceSignal[];
  existingStyleNotes?: string[];
}): Promise<{
  success: boolean;
  worthRecording?: boolean;
  styleNotes?: string[];
  conversationBit?: string | null;
  voiceSample?: string | null;
  sessionInfoLine?: string | null;
  error?: string;
}> {
  try {
    const actor = await getActor(params.jwt);
    if (!actor?.$id) return { success: false, error: 'Unauthorized' };
    const hasAccess = await userHasPaidAiAccess(actor.$id);
    if (!hasAccess) return { success: false, error: AI_REQUIRES_PRO_MESSAGE };

    const signals = (params.signals || []).slice(0, 8);
    if (!signals.length) {
      return { success: true, worthRecording: false };
    }

    const raw = await generateAiSdkCompletion({
      systemInstruction: buildSuggestReinforceSystemInstruction(),
      prompt: buildSuggestReinforceUserPrompt({
        signals,
        existingStyleNotes: params.existingStyleNotes,
      }),
      responseMimeType: 'application/json',
    });

    const parsed = parseCuratorJson(raw);
    if (!parsed.worthRecording) {
      return { success: true, worthRecording: false, styleNotes: [], conversationBit: null };
    }
    return { success: true, ...parsed };
  } catch (err: any) {
    return { success: false, error: err?.message || 'Reinforce failed' };
  }
}
