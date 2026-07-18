/**
 * Shared Pro/Teams gate for AI + agentic features.
 * Client UI should open upgrade; server must also enforce.
 */

import { hasPaidKylrixPlan } from '@/lib/utils';

export const AI_UPGRADE_LABEL = 'AI features';
export const MILESTONES_UPGRADE_LABEL = 'Milestones';
export const AI_REQUIRES_PRO_CODE = 'AI_REQUIRES_PRO';
export const AI_REQUIRES_PRO_MESSAGE =
  'AI features require Pro or Teams. Upgrade to continue.';

/** Client-side: true when user may use ecosystem AI / agentic / paid productivity AI. */
export function userMayUsePaidAi(user: unknown): boolean {
  return hasPaidKylrixPlan(user);
}

export function assertClientPaidAiAccess(user: unknown): void {
  if (!userMayUsePaidAi(user)) {
    const err = new Error(AI_REQUIRES_PRO_MESSAGE);
    (err as Error & { code?: string }).code = AI_REQUIRES_PRO_CODE;
    throw err;
  }
}
