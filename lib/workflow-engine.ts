import { TelemetryNiche } from './context-engine';

export type StepImportance = 'high' | 'low';

export interface WorkflowStep {
  actionId: string; // e.g. "workspace.note.editor.click.save_btn"
  timestamp: string;
  importance: StepImportance;
  metadata?: Record<string, any>;
  isDynamic?: boolean; // If true, targetId is resolved dynamically (e.g. {{LATEST_NOTE_ID}}) at playback
  negationActionId?: string | null;
}

export interface WorkflowChain {
  id: string;
  name: string;
  description: string;
  niche: TelemetryNiche;
  steps: WorkflowStep[];
  isPublic: boolean;
  isAnonymized: boolean;
  createdAt: string;
}

/**
 * Reversible Action Negation Mappings
 */
const REVERSIBLE_NEGATIONS: Record<string, string> = {
  // Note/Workspace toggles
  'workspace.note.editor.click.make_public': 'workspace.note.editor.click.make_private',
  'workspace.note.editor.click.make_private': 'workspace.note.editor.click.make_public',
  'workspace.note.editor.click.pin_note': 'workspace.note.editor.click.unpin_note',
  'workspace.note.editor.click.unpin_note': 'workspace.note.editor.click.pin_note',
  
  // Security/Vault toggles
  'security.vault.settings.click.enable_byok': 'security.vault.settings.click.disable_byok',
  'security.vault.settings.click.disable_byok': 'security.vault.settings.click.enable_byok',
  'security.vault.credentials.click.hide_password': 'security.vault.credentials.click.reveal_password',
  'security.vault.credentials.click.reveal_password': 'security.vault.credentials.click.hide_password',

  // Productivity/Flow toggles
  'productivity.flow.board.click.complete_task': 'productivity.flow.board.click.reopen_task',
  'productivity.flow.board.click.reopen_task': 'productivity.flow.board.click.complete_task'
};

/**
 * Irreversible Actions that cannot be negated
 */
const IRREVERSIBLE_ACTIONS = new Set<string>([
  'workspace.note.editor.click.delete_note',
  'productivity.flow.board.click.delete_task',
  'security.vault.credentials.click.delete_credential',
  'system.settings.click.delete_account'
]);

/**
 * Creates an unambiguous hierarchical action ID following our niche terminology.
 */

/**
 * Automatically determine action step importance to filter noise
 */
export function getStepImportance(actionId: string): StepImportance {
  const parts = actionId.split('.');
  const action = parts[3] || '';
  const element = parts[4] || '';
  
  // High-frequency UI interactions (scroll, hover, drag) are low importance
  if (
    action.includes('scroll') || 
    action.includes('hover') || 
    action.includes('focus') || 
    element.includes('scrollbar') || 
    element.includes('tooltip')
  ) {
    return 'low';
  }
  
  // Clicks, saves, updates, deletions, and completes are high importance
  return 'high';
}

/**
 * Evaluates whether an action ID has a valid negation
 */
export function getNegationActionId(actionId: string): string | null {
  return REVERSIBLE_NEGATIONS[actionId] || null;
}

/**
 * Strips all personal identifying information (UUIDs, names, titles)
 * and keeps only the raw structured container of actions.
 */
export function anonymizeWorkflow(workflow: WorkflowChain): WorkflowChain {
  const anonymizedSteps = workflow.steps.map(step => {
    const cleanMeta: Record<string, any> = {};
    
    if (step.metadata) {
      // Keep structural context but strip text/titles/identifying attributes
      if (step.metadata.type) cleanMeta.type = step.metadata.type;
      if (step.metadata.niche) cleanMeta.niche = step.metadata.niche;
      if (step.metadata.app) cleanMeta.app = step.metadata.app;
      
      // Anonymize identifying keys
      if (step.metadata.id || step.metadata.targetId) {
        cleanMeta.targetId = 'ANONYMIZED_UUID';
      }
      if (step.metadata.title || step.metadata.name) {
        cleanMeta.targetName = 'ANONYMIZED_RESOURCE';
      }
    }

    return {
      ...step,
      metadata: cleanMeta
    };
  });

  return {
    ...workflow,
    name: `Anonymized Workflow (${workflow.name.slice(0, 15)})`,
    description: `Anonymized workflow chain container: ${workflow.description}`,
    steps: anonymizedSteps,
    isAnonymized: true
  };
}

/**
 * Compiles the negated version of a workflow.
 * Reverts toggles/switch actions, and throws an error if irreversible actions (like deletes) exist.
 */
export function negateWorkflow(workflow: WorkflowChain): { success: boolean; workflow?: WorkflowChain; error?: string } {
  const negatedSteps: WorkflowStep[] = [];

  // Filter for high-importance steps first (no use in negating scroll noise)
  const activeSteps = workflow.steps.filter(s => s.importance === 'high');

  for (const step of activeSteps) {
    if (IRREVERSIBLE_ACTIONS.has(step.actionId)) {
      return { 
        success: false, 
        error: `Cannot negate workflow: contains irreversible deletion action "${step.actionId}".` 
      };
    }

    const negatedId = getNegationActionId(step.actionId);
    if (!negatedId) {
      // Fallback: If no explicit negation exists, we keep the original ID but tag it as negated in metadata
      negatedSteps.push({
        ...step,
        metadata: {
          ...step.metadata,
          negatedContextFlag: true
        }
      });
    } else {
      negatedSteps.push({
        ...step,
        actionId: negatedId,
        negationActionId: step.actionId
      });
    }
  }

  // Playback in reverse order to undo steps in correct sequence
  const reversedNegatedSteps = negatedSteps.reverse();

  return {
    success: true,
    workflow: {
      ...workflow,
      id: `${workflow.id}_negated`,
      name: `Inverse: ${workflow.name}`,
      description: `Negated inversion of "${workflow.name}": ${workflow.description}`,
      steps: reversedNegatedSteps,
      createdAt: new Date().toISOString()
    }
  };
}
