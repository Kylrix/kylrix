/**
 * Dynamic LLM Engine for Kylrix
 * Supports:
 *  1. Local Ollama (OLLAMA_BASE_URL, e.g. http://localhost:11434 or http://host.docker.internal:11434)
 *  2. Custom OpenAI-compatible local/remote endpoints (OPENAI_BASE_URL + OPENAI_API_KEY)
 *  3. Google Gemini (GOOGLE_API_KEY)
 */

import { GoogleGenerativeAI } from '@google/generative-ai';

export interface GenerateLLMParams {
  prompt: string;
  systemInstruction: string;
  responseMimeType?: string;
}

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
  }

  throw new Error('No AI provider configured. Please set OLLAMA_BASE_URL, OPENAI_BASE_URL, or GOOGLE_API_KEY.');
}
