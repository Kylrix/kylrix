import { AI_REQUIRES_PRO_CODE, AI_REQUIRES_PRO_MESSAGE } from './access';

export const AGENTIC_ERROR_CODES = {
  AI_PROVIDER_UNAVAILABLE: 'AI_PROVIDER_UNAVAILABLE',
  AI_RATE_LIMITED: 'AI_RATE_LIMITED',
  AI_AUTH_FAILED: 'AI_AUTH_FAILED',
  AI_TIMEOUT: 'AI_TIMEOUT',
  AI_QUOTA_EXCEEDED: 'AI_QUOTA_EXCEEDED',
  AI_MODEL_NOT_FOUND: 'AI_MODEL_NOT_FOUND',
  AI_PROVIDER_MISCONFIGURED: 'AI_PROVIDER_MISCONFIGURED',
  COMPUTE_LIMIT_EXCEEDED: 'COMPUTE_LIMIT_EXCEEDED',
  PRO_REQUIRED: 'PRO_REQUIRED',
  UNAUTHORIZED: 'UNAUTHORIZED',
  NETWORK_ERROR: 'NETWORK_ERROR',
  UNKNOWN: 'UNKNOWN',
} as const;

export type AgenticErrorCode = (typeof AGENTIC_ERROR_CODES)[keyof typeof AGENTIC_ERROR_CODES];

export interface AgenticUserError {
  code: AgenticErrorCode;
  userMessage: string;
  debugMessage?: string;
}

function extractHttpStatus(raw: string, error: unknown): number | undefined {
  const fromMessage = raw.match(/\[(\d{3})\s+[^\]]+\]/);
  if (fromMessage) return Number(fromMessage[1]);
  const status = (error as { status?: number })?.status;
  return typeof status === 'number' ? status : undefined;
}

export function resolveAgenticError(error: unknown): AgenticUserError {
  const raw = error instanceof Error ? error.message : String(error ?? '');
  const lower = raw.toLowerCase();
  const code = (error as { code?: string })?.code;
  const httpStatus = extractHttpStatus(raw, error);

  if (code === AI_REQUIRES_PRO_CODE || raw === AI_REQUIRES_PRO_MESSAGE) {
    return {
      code: AGENTIC_ERROR_CODES.PRO_REQUIRED,
      userMessage: AI_REQUIRES_PRO_MESSAGE,
      debugMessage: raw,
    };
  }

  if (lower.includes('unauthorized') || lower.includes('not authenticated')) {
    return {
      code: AGENTIC_ERROR_CODES.UNAUTHORIZED,
      userMessage: 'Please sign in and try again.',
      debugMessage: raw,
    };
  }

  if (
    lower.includes('exceeded your dynamic compute') ||
    lower.includes('compute token allocation') ||
    lower.includes('insufficient compute')
  ) {
    return {
      code: AGENTIC_ERROR_CODES.COMPUTE_LIMIT_EXCEEDED,
      userMessage: 'You have reached your compute limit for now. Please try again later.',
      debugMessage: raw,
    };
  }

  if (lower.includes('gemini is not configured') || lower.includes('google_api_key')) {
    return {
      code: AGENTIC_ERROR_CODES.AI_PROVIDER_MISCONFIGURED,
      userMessage: 'Kylie is not available right now. Please try again later.',
      debugMessage: raw,
    };
  }

  if (
    httpStatus === 503 ||
    lower.includes('service unavailable') ||
    lower.includes('high demand') ||
    lower.includes('temporarily unavailable')
  ) {
    return {
      code: AGENTIC_ERROR_CODES.AI_PROVIDER_UNAVAILABLE,
      userMessage: 'Something went wrong. Please try again in a moment.',
      debugMessage: raw,
    };
  }

  if (
    httpStatus === 429 ||
    lower.includes('rate limit') ||
    lower.includes('too many requests') ||
    lower.includes('resource exhausted')
  ) {
    return {
      code: AGENTIC_ERROR_CODES.AI_RATE_LIMITED,
      userMessage: 'Kylie is busy right now. Please try again shortly.',
      debugMessage: raw,
    };
  }

  if (httpStatus === 408 || lower.includes('timeout') || lower.includes('timed out')) {
    return {
      code: AGENTIC_ERROR_CODES.AI_TIMEOUT,
      userMessage: 'That took too long. Please try again.',
      debugMessage: raw,
    };
  }

  if (
    httpStatus === 402 ||
    httpStatus === 403 ||
    lower.includes('quota') ||
    lower.includes('billing')
  ) {
    return {
      code: AGENTIC_ERROR_CODES.AI_QUOTA_EXCEEDED,
      userMessage: 'Kylie is temporarily unavailable. Please try again later.',
      debugMessage: raw,
    };
  }

  if (
    httpStatus === 401 ||
    lower.includes('api key') ||
    lower.includes('permission denied') ||
    lower.includes('invalid authentication')
  ) {
    return {
      code: AGENTIC_ERROR_CODES.AI_AUTH_FAILED,
      userMessage: 'Something went wrong. Please try again later.',
      debugMessage: raw,
    };
  }

  if (httpStatus === 404 || lower.includes('model not found') || lower.includes('not found for api')) {
    return {
      code: AGENTIC_ERROR_CODES.AI_MODEL_NOT_FOUND,
      userMessage: 'Something went wrong. Please try again later.',
      debugMessage: raw,
    };
  }

  if (
    lower.includes('googlegenerativeai error') ||
    lower.includes('generativelanguage.googleapis.com') ||
    lower.includes('fetch failed') ||
    lower.includes('network') ||
    lower.includes('econnreset') ||
    lower.includes('enotfound')
  ) {
    return {
      code: AGENTIC_ERROR_CODES.NETWORK_ERROR,
      userMessage: 'Something went wrong. Please try again later.',
      debugMessage: raw,
    };
  }

  return {
    code: AGENTIC_ERROR_CODES.UNKNOWN,
    userMessage: 'Something went wrong. Please try again later.',
    debugMessage: raw,
  };
}

export function getAgenticUserMessage(error: unknown): string {
  return resolveAgenticError(error).userMessage;
}
