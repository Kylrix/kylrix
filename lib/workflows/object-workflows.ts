import { BUILTIN_FLOWS } from '@/lib/flows/builtins';
import type { DiscoverFlow } from '@/lib/flows/types';

export type WorkflowObjectType = 'idea' | 'goal' | 'event' | 'form' | 'secret' | 'totp' | 'all';

export interface BuiltinObjectWorkflow {
  id: string;
  name: string;
  description: string;
  targetObjectTypes: WorkflowObjectType[];
  icon: string;
  requiresAI: boolean; // false for vault (secret, totp)
  handlerKind:
    | 'convert_idea_to_goal'
    | 'convert_goal_to_idea'
    | 'convert_event_to_idea'
    | 'convert_event_to_goal'
    | 'convert_idea_to_event'
    | 'form_responses_drawer'
    | 'vault_export_copy'
    | 'custom_workflow'
    | 'action_hook';
  promptTemplate?: string;
  actionHookId?: string;
}

export const BUILTIN_OBJECT_WORKFLOWS: BuiltinObjectWorkflow[] = [
  {
    id: 'wf-convert-idea-goal',
    name: 'Convert Idea to Goal',
    description: 'Analyze idea text and synthesize actionable goal with task milestones.',
    targetObjectTypes: ['idea'],
    icon: 'CheckSquare',
    requiresAI: true,
    handlerKind: 'convert_idea_to_goal',
    promptTemplate: 'Analyze this idea and generate actionable goals. Title: {{title}}\nContent: {{content}}',
  },
  {
    id: 'wf-convert-goal-idea',
    name: 'Create Idea from Goal',
    description: 'Transform goal objective and tasks back into a conceptual idea note.',
    targetObjectTypes: ['goal'],
    icon: 'FileText',
    requiresAI: true,
    handlerKind: 'convert_goal_to_idea',
    promptTemplate: 'Extract the core conceptual ideas, lessons, and insights from this goal. Title: {{title}}\nDescription: {{content}}',
  },
  {
    id: 'wf-create-idea-event',
    name: 'Create Idea from Event',
    description: 'Extract takeaways, meeting notes, and research points from calendar event.',
    targetObjectTypes: ['event'],
    icon: 'FileText',
    requiresAI: true,
    handlerKind: 'convert_event_to_idea',
    promptTemplate: 'Summarize meeting/event notes and draft key ideas and follow-ups. Title: {{title}}\nDetails: {{content}}',
  },
  {
    id: 'wf-create-goal-event',
    name: 'Create Task from Event',
    description: 'Extract action items, assignments, and due dates from calendar event.',
    targetObjectTypes: ['event'],
    icon: 'CheckSquare',
    requiresAI: true,
    handlerKind: 'convert_event_to_goal',
    promptTemplate: 'Extract actionable tasks and deadlines from this event. Title: {{title}}\nDetails: {{content}}',
  },
  {
    id: 'wf-create-event-idea',
    name: 'Create Event from Idea / Goal',
    description: 'Schedule a dedicated calendar focus block or milestone event for this item.',
    targetObjectTypes: ['idea', 'goal'],
    icon: 'Calendar',
    requiresAI: true,
    handlerKind: 'convert_idea_to_event',
    promptTemplate: 'Propose a structured calendar event schedule for this objective. Title: {{title}}\nDetails: {{content}}',
  },
  {
    id: 'wf-form-responses-goals',
    name: 'Create Goals / Ideas from Form Responses',
    description: 'Filter form submissions by live or ghost fields and generate structured goals/ideas.',
    targetObjectTypes: ['form'],
    icon: 'Sparkles',
    requiresAI: true,
    handlerKind: 'form_responses_drawer',
  },
  {
    id: 'wf-vault-copy-secure',
    name: 'Copy Vault Credentials (Non-AI)',
    description: 'Securely decrypt and copy credential username/password to clipboard locally without AI.',
    targetObjectTypes: ['secret', 'totp'],
    icon: 'Lock',
    requiresAI: false, // EXPLICITLY NO AI FOR ENCRYPTED OBJECTS
    handlerKind: 'vault_export_copy',
  },
];

/**
 * Returns workflows available for a given object type, combining built-ins and custom flows with matching action hooks.
 */
export function getWorkflowsForObject(
  objectType: WorkflowObjectType,
  installedFlows: DiscoverFlow[] = []
): BuiltinObjectWorkflow[] {
  const isVault = objectType === 'secret' || objectType === 'totp';

  // Filter built-ins
  const matchedBuiltins = BUILTIN_OBJECT_WORKFLOWS.filter((wf) => {
    if (isVault && wf.requiresAI) return false; // Hard security guard
    return wf.targetObjectTypes.includes(objectType) || wf.targetObjectTypes.includes('all');
  });

  // Filter installed/custom flows with action hooks
  const matchedInstalled: BuiltinObjectWorkflow[] = [];

  for (const flow of installedFlows) {
    const hooks: string[] = (flow as any).actionHooks || (flow as any).targetObjectTypes || [];
    const supportsType = hooks.includes(objectType) || hooks.includes('all') || hooks.length === 0;

    // Reject AI flow execution if vault object
    if (isVault) continue;

    if (supportsType && !matchedBuiltins.some((b) => b.id === flow.id)) {
      matchedInstalled.push({
        id: flow.id,
        name: flow.name,
        description: flow.description,
        targetObjectTypes: [objectType],
        icon: 'Workflow',
        requiresAI: true,
        handlerKind: 'action_hook',
        actionHookId: flow.id,
      });
    }
  }

  return [...matchedBuiltins, ...matchedInstalled];
}

/**
 * Prompt Guardrail sanitizer for external form data / user input
 */
export function sanitizePromptInput(input: string): string {
  if (!input) return '';
  return input
    .replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, '')
    .replace(/\[\[kylrix-object:.*?\]\]/g, '')
    .replace(/SYSTEM_PROMPT|INSTRUCTION|OVERRIDE|IGNORE PREVIOUS/gi, '[filtered]')
    .trim();
}
