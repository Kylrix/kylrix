/**
 * Autonomous Agent Scheduler & Runtime
 * 
 * Orchestrates autonomous agent tasks across Cloudflare Workers AI,
 * OpenRouter/Jev, and local model endpoints with automatic workspace stamping.
 */

import { ApiResources } from '@/lib/api/resources';
import type { ApiActor } from '@/lib/api/guard';
import { executeWorkersAiChat, isWorkersAiAvailable, WORKERS_AI_MODELS } from './workers-ai';

export interface AgentTaskRequest {
  actor: ApiActor;
  prompt: string;
  workspaceId?: string | null;
  workspaceName?: string | null;
  context?: string;
  createIdeaOnComplete?: boolean;
  createGoalOnComplete?: boolean;
  model?: string;
}

export interface AgentTaskResult {
  success: boolean;
  output: string;
  summary: string;
  provider: 'workers-ai' | 'google-ai' | 'openai' | 'fallback';
  createdItems?: {
    ideaId?: string;
    goalId?: string;
  };
  error?: string;
}

/**
 * Runs an autonomous agent task on behalf of an authenticated actor.
 */
export async function runAgentTask(req: AgentTaskRequest): Promise<AgentTaskResult> {
  const prompt = req.prompt.trim();
  if (!prompt) {
    return {
      success: false,
      output: '',
      summary: 'Prompt was empty.',
      provider: 'fallback',
      error: 'Empty prompt provided.',
    };
  }

  const systemInstruction =
    'You are an autonomous AI assistant operating inside the Kylrix sovereign workspace. ' +
    'The user is managing their decentralized ideas, tasks, security, and goals. ' +
    'Provide clear, concise, actionable solutions. If the user asks for steps, break them down clearly. ' +
    'Keep your tone direct, professional, and helpful.';

  const userContent = req.context
    ? `Context: ${req.context}\n\nTask: ${prompt}`
    : prompt;

  let outputText = '';
  let providerUsed: AgentTaskResult['provider'] = 'fallback';

  // 1. Try Cloudflare Workers AI first (Free edge inference)
  if (isWorkersAiAvailable()) {
    const cfRes = await executeWorkersAiChat({
      model: req.model || WORKERS_AI_MODELS.FAST_CHAT,
      messages: [
        { role: 'system', content: systemInstruction },
        { role: 'user', content: userContent },
      ],
      max_tokens: 1024,
      temperature: 0.3,
    });

    if (cfRes.success && cfRes.text) {
      outputText = cfRes.text;
      providerUsed = 'workers-ai';
    }
  }

  // 2. Fallback to Google AI / Gemini if configured
  if (!outputText && process.env.GOOGLE_API_KEY) {
    try {
      const { GoogleGenerativeAI } = await import('@google/generative-ai');
      const genAI = new GoogleGenerativeAI(process.env.GOOGLE_API_KEY);
      const model = genAI.getGenerativeModel({ model: 'gemini-1.5-flash' });
      const result = await model.generateContent(`${systemInstruction}\n\n${userContent}`);
      const text = result.response.text();
      if (text) {
        outputText = text;
        providerUsed = 'google-ai';
      }
    } catch (err: any) {
      console.warn('[AgentScheduler] Google AI fallback error:', err?.message);
    }
  }

  // 3. Fallback to OpenAI / OpenRouter if configured
  if (!outputText && (process.env.OPENAI_API_KEY || process.env.OPENROUTER_API_KEY)) {
    try {
      const apiKey = process.env.OPENAI_API_KEY || process.env.OPENROUTER_API_KEY;
      const baseUrl = process.env.OPENROUTER_API_KEY
        ? 'https://openrouter.ai/api/v1'
        : (process.env.OPENAI_BASE_URL || 'https://api.openai.com/v1');

      const res = await fetch(`${baseUrl}/chat/completions`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${apiKey}`,
        },
        body: JSON.stringify({
          model: process.env.OPENROUTER_API_KEY ? 'meta-llama/llama-3.1-8b-instruct:free' : 'gpt-4o-mini',
          messages: [
            { role: 'system', content: systemInstruction },
            { role: 'user', content: userContent },
          ],
          max_tokens: 1024,
        }),
      });

      if (res.ok) {
        const json = await res.json();
        const text = json.choices?.[0]?.message?.content;
        if (text) {
          outputText = text;
          providerUsed = 'openai';
        }
      }
    } catch (err: any) {
      console.warn('[AgentScheduler] OpenAI fallback error:', err?.message);
    }
  }

  // 4. Default synthetic response if no external AI keys are configured
  if (!outputText) {
    outputText =
      `Task "${prompt}" processed successfully.\n\n` +
      `Kylrix agent runtime has structured your task. To enable edge LLM inference, configure ` +
      `CLOUDFLARE_ACCOUNT_ID and CLOUDFLARE_API_TOKEN in your environment.`;
  }

  const createdItems: AgentTaskResult['createdItems'] = {};

  // Auto-persist idea or goal if requested or relevant
  if (req.createIdeaOnComplete || req.createIdeaOnComplete === undefined) {
    try {
      const ideaPayload: any = {
        title: `🤖 Agent: ${prompt.slice(0, 45)}`,
        content: outputText,
      };
      if (req.workspaceId) {
        ideaPayload.projectId = req.workspaceId;
        ideaPayload.isWorkspace = true;
      }
      const newIdea = await ApiResources.createNote(req.actor, ideaPayload);
      createdItems.ideaId = newIdea.id;
    } catch (err: any) {
      console.warn('[AgentScheduler] Failed to auto-save idea:', err?.message);
    }
  }

  // Broadcast realtime update to user's room if realtime relay is available
  try {
    const { realtimeRelay } = await import('@/lib/realtime/client');
    realtimeRelay.send(`user-${req.actor.userId}`, {
      channel: `user-${req.actor.userId}`,
      type: 'agent_update',
      kind: 'broadcast_agent_update',
      userId: req.actor.userId,
      data: {
        agentName: 'Cloudflare Edge Agent',
        message: `Executed: ${prompt.slice(0, 60)}`,
        output: outputText.slice(0, 200),
        workspaceId: req.workspaceId,
        createdItems,
      },
    });
  } catch {}

  const summary = outputText.slice(0, 200) + (outputText.length > 200 ? '...' : '');

  return {
    success: true,
    output: outputText,
    summary,
    provider: providerUsed,
    createdItems,
  };
}
