'use server';

import { getActor } from '@/lib/actions/secure-ops';
import { heuristicGenerateFlow } from '@/lib/flows/syntax-engine';
import type { WorkflowChain } from '@/lib/workflow-engine';

type FlowCreatorResult = {
  success: boolean;
  flow?: WorkflowChain;
  raw?: string;
  mode: 'heuristic' | 'llm';
  error?: string;
};

/**
 * Internal custom agent for the Create Flow drawer.
 * Tries LLM (Gemini) via the Flow Creator prompt; falls back to heuristic so the drawer always works offline.
 */
export async function generateFlowFromPromptAction(
  prompt: string,
  titleHint?: string,
  jwt?: string
): Promise<FlowCreatorResult> {
  const p = String(prompt || '').trim();
  if (!p) return { success: false, mode: 'heuristic', error: 'Prompt is required' };
  const title = String(titleHint || '').trim() || p.slice(0, 40);

  // Offline-first: heuristic guarantees end-to-end even without API keys
  const heuristic = heuristicGenerateFlow(p, title);

  try {
    const apiKey = process.env.GOOGLE_API_KEY || process.env.GEMINI_API_KEY;
    const model = process.env.GEMINI_MODEL_NAME || 'gemini-2.0-flash';
    if (!apiKey) {
      return { success: true, flow: heuristic, mode: 'heuristic' };
    }
    // Optional auth check — allow anonymous prompt generation but prefer actor
    await getActor(jwt).catch(() => null);

    const { FLOW_CREATOR_SYSTEM_INSTRUCTION, buildFlowCreatorUserPrompt } = await import('@/lib/agentic/prompts/flow-creator');
    const sys = FLOW_CREATOR_SYSTEM_INSTRUCTION;
    const user = buildFlowCreatorUserPrompt({ prompt: p, titleHint: title });

    const res = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${apiKey}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        systemInstruction: { parts: [{ text: sys }] },
        contents: [{ role: 'user', parts: [{ text: user }] }],
        generationConfig: { temperature: 0.2, maxOutputTokens: 1200 },
      }),
    });
    if (!res.ok) {
      const t = await res.text().catch(() => '');
      throw new Error(`LLM ${res.status}: ${t.slice(0, 400)}`);
    }
    const data = (await res.json()) as any;
    const text: string = data?.candidates?.[0]?.content?.parts?.[0]?.text || '';
    const cleaned = text.trim().replace(/^```json\s*/i, '').replace(/^```\s*/i, '').replace(/```\s*$/i, '').trim();
    const parsed = JSON.parse(cleaned);
    // Validate shape minimally; let syntax-engine do the rest
    if (!parsed || typeof parsed.name !== 'string' || !Array.isArray(parsed.steps)) throw new Error('LLM returned invalid flow shape');
    const flow: WorkflowChain = {
      id: String(parsed.id || title.toLowerCase().replace(/[^a-z0-9]+/g, '-')).slice(0, 40) || heuristic.id,
      name: String(parsed.name || title),
      description: String(parsed.description || p.slice(0, 280)),
      niche: (parsed.niche || heuristic.niche) as any,
      steps: (parsed.steps as any[]).map((s) => ({
        actionId: String(s.actionId),
        timestamp: s.timestamp || new Date().toISOString(),
        importance: s.importance === 'low' ? 'low' : 'high',
      })),
      isPublic: false,
      isAnonymized: true,
      createdAt: new Date().toISOString(),
    };
    return { success: true, flow, raw: cleaned, mode: 'llm' };
  } catch (e: any) {
    // Fallback keeps the UX working
    return { success: true, flow: heuristic, mode: 'heuristic', error: e?.message };
  }
}
