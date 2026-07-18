/**
 * Thin client entry for one-shot agentic runs (no drawer / session UI required).
 * Paid access is enforced again inside the server action.
 */

import { executeInstantRequestAction } from '@/lib/actions/agentic';
import { assertClientPaidAiAccess } from './access';

export type InstantAgenticResult = Awaited<ReturnType<typeof executeInstantRequestAction>>;

export async function runInstantAgenticRequest(params: {
  prompt: string;
  user?: unknown;
  jwt?: string;
  pageContext?: {
    zone: string;
    route: string;
    title: string;
    systemHint: string;
    resourceId?: string;
    userMessage?: string;
  };
  userMessage?: string;
}): Promise<InstantAgenticResult> {
  if (params.user !== undefined) {
    assertClientPaidAiAccess(params.user);
  }
  return executeInstantRequestAction(params.prompt, params.jwt, params.pageContext, {
    userMessage: params.userMessage,
  });
}
