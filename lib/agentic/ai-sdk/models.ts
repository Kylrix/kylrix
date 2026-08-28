/**
 * Vercel AI SDK - Model Provider Resolution for Kylrix Agentic System
 * Supports:
 * 1. Google Gemini via @ai-sdk/google (Default)
 * 2. OpenAI / OpenAI-compatible local endpoints (Ollama, LocalAI, vLLM) via @ai-sdk/openai
 */

import { google, createGoogleGenerativeAI } from '@ai-sdk/google';
import { createOpenAI } from '@ai-sdk/openai';
import type { LanguageModel } from 'ai';

export interface ModelResolutionOptions {
  modelName?: string;
  provider?: 'google' | 'openai' | 'ollama' | 'auto';
  apiKey?: string;
  baseURL?: string;
}

/**
 * Resolves the appropriate Vercel AI SDK LanguageModel instance
 * dynamically based on environment configuration and caller options.
 */
export function resolveLanguageModel(options?: ModelResolutionOptions): LanguageModel {
  const provider = options?.provider || 'auto';

  // 1. Ollama / Local OpenAI-compatible endpoint
  const ollamaUrl = process.env.OLLAMA_BASE_URL || process.env.OLLAMA_HOST;
  const customOpenAiUrl = options?.baseURL || process.env.OPENAI_BASE_URL || process.env.LOCAL_AI_BASE_URL;
  const customOpenAiKey = options?.apiKey || process.env.OPENAI_API_KEY || process.env.LOCAL_AI_API_KEY || 'dummy';

  if (provider === 'ollama' || (provider === 'auto' && ollamaUrl && !process.env.GOOGLE_API_KEY)) {
    const cleanBase = (ollamaUrl || 'http://localhost:11434').replace(/\/+$/, '') + '/v1';
    const localProvider = createOpenAI({
      baseURL: cleanBase,
      apiKey: customOpenAiKey,
    });
    const model = options?.modelName || process.env.OLLAMA_MODEL || 'llama3:latest';
    return localProvider(model);
  }

  // 2. Custom OpenAI endpoint or OpenAI provider
  if (provider === 'openai' || (provider === 'auto' && customOpenAiUrl && !process.env.GOOGLE_API_KEY)) {
    const cleanBase = (customOpenAiUrl || 'https://api.openai.com/v1').replace(/\/+$/, '');
    const customProvider = createOpenAI({
      baseURL: cleanBase,
      apiKey: customOpenAiKey,
    });
    const model = options?.modelName || process.env.OPENAI_MODEL || process.env.LOCAL_AI_MODEL || 'gpt-4o-mini';
    return customProvider(model);
  }

  // 3. Google Gemini (Preferred default for Kylrix agentic runtime)
  const geminiKey = options?.apiKey || process.env.GOOGLE_API_KEY || process.env.GEMINI_API_KEY;
  const defaultGeminiModel = process.env.GEMINI_MODEL_NAME || 'gemini-2.0-flash';
  const modelName = options?.modelName || defaultGeminiModel;

  if (geminiKey) {
    const customGoogle = createGoogleGenerativeAI({
      apiKey: geminiKey,
    });
    return customGoogle(modelName);
  }

  // Fallback to global instance if configured
  return google(modelName);
}
