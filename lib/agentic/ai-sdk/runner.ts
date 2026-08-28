/**
 * Vercel AI SDK - Multi-Turn Agentic Runner for Kylrix
 * Handles autonomous multi-step reasoning, tool execution loops, and structured responses.
 */

import { generateText, streamText, generateObject, type CoreMessage, type LanguageModelV1 } from 'ai';
import { resolveLanguageModel, type ModelResolutionOptions } from './models';
import { getKylrixAiTools, type ToolExecutionContext } from './tools';
import type { z } from 'zod';

export interface AgenticChatOptions {
  messages: Array<CoreMessage | { role: 'user' | 'assistant' | 'system'; content: string }>;
  systemInstruction?: string;
  modelOptions?: ModelResolutionOptions;
  modelInstance?: LanguageModelV1;
  maxSteps?: number;
  userId?: string;
  jwt?: string;
  onStepFinish?: (step: any) => void;
}

export interface AgenticRunResult {
  text: string;
  toolCalls: Array<{ name: string; args: Record<string, any> }>;
  steps: any[];
  finishReason: string;
  usage?: any;
}

/**
 * Runs a multi-turn agentic chat turn with autonomous multi-step tool execution.
 */
export async function runAgenticChat(options: AgenticChatOptions): Promise<AgenticRunResult> {
  const model = options.modelInstance || resolveLanguageModel(options.modelOptions);
  const emittedToolCalls: Array<{ name: string; args: Record<string, any> }> = [];

  const toolCtx: ToolExecutionContext = {
    userId: options.userId,
    jwt: options.jwt,
    onToolCallEmitted: (tc) => {
      emittedToolCalls.push(tc);
    },
  };

  const tools = getKylrixAiTools(toolCtx);
  const maxSteps = options.maxSteps ?? 5;

  const result = await generateText({
    model,
    system: options.systemInstruction,
    messages: options.messages as CoreMessage[],
    tools,
    maxSteps,
    onStepFinish: options.onStepFinish,
  });

  // Consolidate tool calls from both Vercel AI SDK step results and local emitter
  const collectedCalls = [...emittedToolCalls];
  if (result.toolCalls && Array.isArray(result.toolCalls)) {
    for (const tc of result.toolCalls) {
      if (!collectedCalls.some((c) => c.name === tc.toolName && JSON.stringify(c.args) === JSON.stringify(tc.args))) {
        collectedCalls.push({
          name: tc.toolName,
          args: (tc.args as Record<string, any>) || {},
        });
      }
    }
  }

  return {
    text: result.text.trim(),
    toolCalls: collectedCalls,
    steps: result.steps || [],
    finishReason: result.finishReason,
    usage: result.usage,
  };
}

/**
 * Streams a multi-turn agentic chat turn with real-time token delivery and tool calls.
 */
export async function streamAgenticChat(options: AgenticChatOptions) {
  const model = options.modelInstance || resolveLanguageModel(options.modelOptions);
  const toolCtx: ToolExecutionContext = {
    userId: options.userId,
    jwt: options.jwt,
  };

  const tools = getKylrixAiTools(toolCtx);
  const maxSteps = options.maxSteps ?? 5;

  return streamText({
    model,
    system: options.systemInstruction,
    messages: options.messages as CoreMessage[],
    tools,
    maxSteps,
    onStepFinish: options.onStepFinish,
  });
}

/**
 * Generates structured, type-safe agentic output matching a Zod schema.
 */
export async function generateAgenticStructure<T>(params: {
  schema: z.ZodSchema<T>;
  prompt: string;
  systemInstruction?: string;
  modelOptions?: ModelResolutionOptions;
}): Promise<T> {
  const model = resolveLanguageModel(params.modelOptions);
  const result = await generateObject({
    model,
    schema: params.schema,
    system: params.systemInstruction,
    prompt: params.prompt,
  });

  return result.object;
}
