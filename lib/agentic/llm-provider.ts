/**
 * Dynamic LLM Engine for Kylrix
 * Supports:
 *  1. Vercel AI SDK (Unified provider with Google Gemini, OpenAI, Ollama)
 *  2. Legacy Direct Provider Fallbacks (@google/generative-ai, Ollama REST, OpenAI REST)
 */

import { GoogleGenerativeAI } from '@google/generative-ai';
import { generateText, streamText, type CoreMessage } from 'ai';
import { resolveLanguageModel } from './ai-sdk/models';
import { runAgenticChat, streamAgenticChat, type AgenticChatOptions } from './ai-sdk/runner';

export interface GenerateLLMParams {
  prompt: string;
  systemInstruction: string;
  responseMimeType?: string;
}

/**
 * Modern Vercel AI SDK completion entrypoint.
 * Generates text or JSON with structured schemas and multi-step tool execution.
 */
export async function generateAiSdkCompletion(params: {
  prompt: string;
  systemInstruction?: string;
  modelName?: string;
  responseMimeType?: string;
}): Promise<string> {
  const model = resolveLanguageModel({ modelName: params.modelName });
  const res = await generateText({
    model,
    system: params.systemInstruction,
    prompt: params.prompt,
  });
  return res.text.trim();
}

/**
 * Modern Vercel AI SDK streaming completion entrypoint.
 */
export async function streamAiSdkCompletion(params: {
  prompt: string;
  systemInstruction?: string;
  modelName?: string;
}) {
  const model = resolveLanguageModel({ modelName: params.modelName });
  return streamText({
    model,
    system: params.systemInstruction,
    prompt: params.prompt,
  });
}

/**
 * Multi-turn agentic execution powered by Vercel AI SDK with autonomous tool execution.
 */
export async function runMultiTurnAgenticTurn(options: AgenticChatOptions) {
  return runAgenticChat(options);
}

/**
 * Streams a multi-turn agentic execution powered by Vercel AI SDK.
 */
export async function streamMultiTurnAgenticTurn(options: AgenticChatOptions) {
  return streamAgenticChat(options);
}

/**
 * Core LLM Completion (Backwards-compatible gateway).
 * Falls through Ollama -> Custom OpenAI endpoint -> Google Gemini.
 */
export async function generateLLMCompletion(params: GenerateLLMParams): Promise<string> {
  const ollamaUrl = process.env.OLLAMA_BASE_URL || process.env.OLLAMA_HOST;
  const ollamaModel = process.env.OLLAMA_MODEL || 'llama3:latest';

  const customOpenAiUrl = process.env.OPENAI_BASE_URL || process.env.LOCAL_AI_BASE_URL;
  const customOpenAiKey = process.env.OPENAI_API_KEY || process.env.LOCAL_AI_API_KEY || 'dummy';
  const customModel = process.env.OPENAI_MODEL || process.env.LOCAL_AI_MODEL || 'gpt-4o-mini';

  const geminiKey = process.env.GOOGLE_API_KEY;
  const geminiModel = process.env.GEMINI_MODEL_NAME || 'gemini-2.0-flash';

  // 1. Check if Ollama endpoint is configured & active
  if (ollamaUrl) {
    try {
      const cleanBase = ollamaUrl.replace(/\/+$/, '');
      const res = await fetch(`${cleanBase}/api/generate`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          model: ollamaModel,
          system: params.systemInstruction,
          prompt: params.prompt,
          stream: false,
          format: params.responseMimeType === 'application/json' ? 'json' : undefined,
        }),
      });
      if (res.ok) {
        const data = await res.json();
        if (data.response) return data.response.trim();
      }
    } catch (err) {
      console.warn('[LLM-Provider] Ollama request failed, falling back:', err);
    }
  }

  // 2. Check if OpenAI-compatible custom endpoint is configured
  if (customOpenAiUrl) {
    try {
      const cleanBase = customOpenAiUrl.replace(/\/+$/, '');
      const res = await fetch(`${cleanBase}/chat/completions`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${customOpenAiKey}`,
        },
        body: JSON.stringify({
          model: customModel,
          messages: [
            { role: 'system', content: params.systemInstruction },
            { role: 'user', content: params.prompt },
          ],
          response_format: params.responseMimeType === 'application/json' ? { type: 'json_object' } : undefined,
        }),
      });
      if (res.ok) {
        const data = await res.json();
        const content = data.choices?.[0]?.message?.content;
        if (content) return content.trim();
      }
    } catch (err) {
      console.warn('[LLM-Provider] OpenAI-compatible endpoint failed, falling back:', err);
    }
  }

  // 3. Fallback to Google Gemini
  if (geminiKey) {
    try {
      const genAI = new GoogleGenerativeAI(geminiKey);
      const model = genAI.getGenerativeModel({
        model: geminiModel,
        systemInstruction: params.systemInstruction,
        generationConfig: {
          responseMimeType: params.responseMimeType || 'application/json',
        },
      });
      const response = await model.generateContent(params.prompt);
      return response.response.text().trim();
    } catch (err) {
      console.warn('[LLM-Provider] Google Gemini direct call failed, trying Vercel AI SDK provider:', err);
      // Fallback to Vercel AI SDK provider
      try {
        return await generateAiSdkCompletion(params);
      } catch {
        throw err;
      }
    }
  }

  throw new Error('No AI provider configured. Please set OLLAMA_BASE_URL, OPENAI_BASE_URL, or GOOGLE_API_KEY.');
}
