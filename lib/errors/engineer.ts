'use server';

import { getActor } from '@/lib/actions/secure-ops/shared';
import { canExposeLiveErrorsForEmail, isEmailInEngineerList } from '@/lib/services/internal/engineer-guard';
import { devLogStreamer } from '@/lib/dev/live-logs';

export interface EngineerErrorDetails {
  isEngineer: boolean;
  canSeeLiveErrors: boolean;
  message?: string;
  stack?: string;
  digest?: string;
  timestamp?: string;
}

/**
 * Server action that returns unmasked error details and live logs if and only if
 * dev mode is enabled OR the authenticated user's email is listed in ENGINEERS=.
 */
export async function getLiveErrorDetailsAction(
  inputDigest?: string | null,
  jwt?: string
): Promise<EngineerErrorDetails> {
  const actor = await getActor(jwt).catch(() => null);
  const email = actor?.email || null;
  const isEng = isEmailInEngineerList(email);
  const canSee = canExposeLiveErrorsForEmail(email);

  if (!canSee) {
    return {
      isEngineer: false,
      canSeeLiveErrors: false,
    };
  }

  // Look up error entry in live logs streamer if digest is provided
  let message: string | undefined;
  let stack: string | undefined;
  let timestamp: string | undefined;

  if (inputDigest) {
    const recentLogs = devLogStreamer.getRecentLogs(200, 'error');
    const matched = recentLogs.find((entry) => {
      if (entry.message?.includes(inputDigest)) return true;
      if (entry.id?.includes(inputDigest)) return true;
      if (entry.stack?.includes(inputDigest)) return true;
      return false;
    });

    if (matched) {
      message = matched.message;
      stack = matched.stack;
      timestamp = matched.timestamp;
    } else {
      // If not matched by exact digest ID, fetch latest error log as fallback
      const latestError = recentLogs[recentLogs.length - 1];
      if (latestError) {
        message = latestError.message;
        stack = latestError.stack;
        timestamp = latestError.timestamp;
      } else {
        message = `Server Error Digest: ${inputDigest}`;
      }
    }
  }

  return {
    isEngineer: isEng,
    canSeeLiveErrors: canSee,
    message: message || 'An unexpected server error occurred.',
    stack,
    digest: inputDigest || undefined,
    timestamp: timestamp || new Date().toISOString(),
  };
}

/**
 * Helper to format error message for an actor before throwing/returning.
 */
export async function formatErrorForActor(err: unknown, actorOrEmail?: any): Promise<string> {
  const email = typeof actorOrEmail === 'string' ? actorOrEmail : actorOrEmail?.email;
  const canSee = canExposeLiveErrorsForEmail(email);
  const rawMessage = err instanceof Error ? err.message : String(err || 'Unknown error');

  if (canSee) {
    return rawMessage;
  }

  // For non-engineers in production, do not leak internal system details
  return 'An error occurred while processing your request. Please try again or contact support.';
}

/**
 * Server check to verify whether the caller session belongs to an engineer.
 */
export async function isCurrentActorEngineer(jwt?: string): Promise<boolean> {
  try {
    const actor = await getActor(jwt).catch(() => null);
    const email = actor?.email || null;
    return isEmailInEngineerList(email);
  } catch {
    return false;
  }
}

