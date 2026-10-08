/**
 * Cloudflare Workers AI Integration
 * 
 * Runs open-source LLMs and embedding models on Cloudflare's serverless edge GPUs.
 * Optimized for the 10,000 free daily Neurons tier with automatic model tiering.
 */

export interface WorkersAIMessage {
  role: 'system' | 'user' | 'assistant';
  content: string;
}

export interface WorkersAICompletionOptions {
  model?: string;
  messages: WorkersAIMessage[];
  temperature?: number;
  max_tokens?: number;
  accountId?: string;
  apiToken?: string;
}

export interface WorkersAIEmbeddingOptions {
  model?: string;
  text: string | string[];
  accountId?: string;
  apiToken?: string;
}

export interface WorkersAIResponse {
  success: boolean;
  text?: string;
  usage?: {
    neurons?: number;
    prompt_tokens?: number;
    completion_tokens?: number;
  };
  error?: string;
}

export interface WorkersAIEmbeddingResponse {
  success: boolean;
  embeddings?: number[][];
  error?: string;
}

export const WORKERS_AI_MODELS = {
  // Ultra-light, fast, free-tier friendly (~lowest neuron consumption)
  FAST_CHAT: '@cf/meta/llama-3.1-8b-instruct',
  // High reasoning and structured generation
  FLAGSHIP_CHAT: '@cf/meta/llama-3.3-70b-instruct',
  // Deep reasoning / chain-of-thought
  REASONING: '@cf/deepseek-ai/deepseek-r1-distill-qwen-32b',
  // Fast edge embeddings for search and memory
  EMBEDDINGS: '@cf/baai/bge-base-en-v1.5',
  // Multilingual whisper for voice/audio transcriptions
  WHISPER: '@cf/openai/whisper',
};

/**
 * Returns true if Cloudflare Workers AI credentials are present.
 */
export function isWorkersAiAvailable(): boolean {
  const accountId = process.env.CLOUDFLARE_ACCOUNT_ID || process.env.CF_ACCOUNT_ID;
  const token = process.env.CLOUDFLARE_API_TOKEN || process.env.CF_API_TOKEN || process.env.CLOUDFLARE_D1_TOKEN;
  return Boolean(accountId && token);
}

/**
 * Executes a text generation/chat completion request against Cloudflare Workers AI.
 */
export async function executeWorkersAiChat(options: WorkersAICompletionOptions): Promise<WorkersAIResponse> {
  const accountId = (
    options.accountId ||
    process.env.CLOUDFLARE_ACCOUNT_ID ||
    process.env.CF_ACCOUNT_ID
  )?.trim();

  const apiToken = (
    options.apiToken ||
    process.env.CLOUDFLARE_API_TOKEN ||
    process.env.CF_API_TOKEN ||
    process.env.CLOUDFLARE_D1_TOKEN
  )?.trim();

  if (!accountId || !apiToken) {
    return {
      success: false,
      error: 'Cloudflare credentials missing (CLOUDFLARE_ACCOUNT_ID or CLOUDFLARE_API_TOKEN).',
    };
  }

  // Default to fast, low-neuron model to preserve free quota
  const model = options.model || WORKERS_AI_MODELS.FAST_CHAT;
  const url = `https://api.cloudflare.com/client/v4/accounts/${accountId}/ai/run/${model}`;

  try {
    const res = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${apiToken}`,
      },
      body: JSON.stringify({
        messages: options.messages,
        temperature: options.temperature ?? 0.3,
        max_tokens: options.max_tokens ?? 1024,
      }),
    });

    if (!res.ok) {
      const errorText = await res.text().catch(() => '');
      return {
        success: false,
        error: `Workers AI error (${res.status}): ${errorText || res.statusText}`,
      };
    }

    const data = await res.json();
    const result = data.result;
    const responseText = result?.response || result?.text || (typeof result === 'string' ? result : '');

    return {
      success: true,
      text: responseText.trim(),
      usage: {
        neurons: data?.usage?.neurons,
      },
    };
  } catch (err: any) {
    return {
      success: false,
      error: err?.message || 'Network error while executing Workers AI chat',
    };
  }
}

/**
 * Computes embeddings using Cloudflare Workers AI.
 */
export async function executeWorkersAiEmbeddings(options: WorkersAIEmbeddingOptions): Promise<WorkersAIEmbeddingResponse> {
  const accountId = (
    options.accountId ||
    process.env.CLOUDFLARE_ACCOUNT_ID ||
    process.env.CF_ACCOUNT_ID
  )?.trim();

  const apiToken = (
    options.apiToken ||
    process.env.CLOUDFLARE_API_TOKEN ||
    process.env.CF_API_TOKEN ||
    process.env.CLOUDFLARE_D1_TOKEN
  )?.trim();

  if (!accountId || !apiToken) {
    return {
      success: false,
      error: 'Cloudflare credentials missing (CLOUDFLARE_ACCOUNT_ID or CLOUDFLARE_API_TOKEN).',
    };
  }

  const model = options.model || WORKERS_AI_MODELS.EMBEDDINGS;
  const url = `https://api.cloudflare.com/client/v4/accounts/${accountId}/ai/run/${model}`;
  const textInput = Array.isArray(options.text) ? options.text : [options.text];

  try {
    const res = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${apiToken}`,
      },
      body: JSON.stringify({
        text: textInput,
      }),
    });

    if (!res.ok) {
      const errorText = await res.text().catch(() => '');
      return {
        success: false,
        error: `Workers AI embedding error (${res.status}): ${errorText || res.statusText}`,
      };
    }

    const data = await res.json();
    const vectors = data?.result?.data || data?.result?.shape || data?.result;

    return {
      success: true,
      embeddings: Array.isArray(vectors) ? vectors : [],
    };
  } catch (err: any) {
    return {
      success: false,
      error: err?.message || 'Network error while generating Workers AI embeddings',
    };
  }
}
