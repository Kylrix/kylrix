/**
 * Workflow bridge — run stored workflow chains as agentic tool sequences.
 */

import type { WorkflowChain, WorkflowStep } from '@/lib/workflow-engine';
import { emitAgenticSpineEvent } from './spine-bridge';

export interface WorkflowTriggerContext {
  userId?: string;
  resourceId?: string;
  resourceType?: string;
  payload?: Record<string, unknown>;
}

/**
 * Map high-level workflow step actionIds to agent prompts (foundation).
 * Full playback UI comes later; agent can execute equivalent tool chains now.
 */
const ACTION_TO_PROMPT: Record<string, (ctx: WorkflowTriggerContext) => string> = {
  'productivity.flow.board.click.create_task': () =>
    'Create a goal from the current workflow context using create_goal with isAgentic true.',
  'workspace.form.response.received': (ctx) =>
    `A new form response arrived for form ${ctx.resourceId || 'unknown'}. Create a follow-up goal summarizing action items.`,
};

export function workflowStepToAgentPrompt(
  step: WorkflowStep,
  ctx: WorkflowTriggerContext,
): string | null {
  const fn = ACTION_TO_PROMPT[step.actionId];
  if (fn) return fn(ctx);
  if (step.metadata?.agentPrompt && typeof step.metadata.agentPrompt === 'string') {
    return step.metadata.agentPrompt;
  }
  return null;
}

export async function triggerWorkflowAgentRun(
  workflow: WorkflowChain,
  ctx: WorkflowTriggerContext,
): Promise<void> {
  const prompts: string[] = [];
  for (const step of workflow.steps) {
    const p = workflowStepToAgentPrompt(step, ctx);
    if (p) prompts.push(p);
  }
  if (!prompts.length) return;
  emitAgenticSpineEvent({
    type: 'agentic.run',
    prompt: prompts.join('\n\n'),
    source: `workflow:${workflow.id}`,
    autoRun: true,
  });
}

/** Example: form response → todo workflow hook */
export function onFormResponseReceived(formId: string, submissionId: string): void {
  emitAgenticSpineEvent({
    type: 'agentic.run',
    prompt: `Form ${formId} received submission ${submissionId}. Create a goal titled "Follow up on form response" with details from the submission context.`,
    source: 'workflow:form-response-todo',
    autoRun: false,
  });
}
