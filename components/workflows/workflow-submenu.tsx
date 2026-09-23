'use client';

import React from 'react';
import {
  Workflow,
  Sparkles,
  CheckSquare,
  FileText,
  Calendar,
  Lock,
} from 'lucide-react';
import {
  getWorkflowsForObject,
  BuiltinObjectWorkflow,
  WorkflowObjectType,
} from '@/lib/workflows/object-workflows';

export interface WorkflowSubmenuTarget {
  id: string;
  title: string;
  content?: string;
  description?: string;
  tags?: string[];
  raw?: any;
}

export interface WorkflowSubmenuOptions {
  objectType: WorkflowObjectType;
  targetObject: WorkflowSubmenuTarget;
  activeWorkspaceId?: string | null;
  installedFlows?: any[];
  onOpenFormResponsesWorkflow?: () => void;
  showSuccess?: (msg: string) => void;
  showError?: (msg: string, detail?: string) => void;
  showInfo?: (msg: string) => void;
}

export async function executeBuiltinWorkflow(
  wf: BuiltinObjectWorkflow,
  options: WorkflowSubmenuOptions
) {
  const {
    objectType,
    targetObject,
    activeWorkspaceId,
    onOpenFormResponsesWorkflow,
    showSuccess = (msg: string) => console.log(msg),
    showError = (msg: string) => console.error(msg),
    showInfo = (msg: string) => console.log(msg),
  } = options;

  if (wf.handlerKind === 'form_responses_drawer') {
    onOpenFormResponsesWorkflow?.();
    return;
  }

  if (wf.handlerKind === 'vault_export_copy') {
    try {
      const textToCopy = `${targetObject.title}: ${targetObject.content || targetObject.description || ''}`;
      await navigator.clipboard.writeText(textToCopy);
      showSuccess('Vault item details copied securely');
    } catch {
      showError('Failed to copy vault item details');
    }
    return;
  }

  showInfo(`Executing workflow: ${wf.name}...`);

  try {
    const workspaceOpts = {
      activeWorkspaceId: activeWorkspaceId || null,
      projectId: activeWorkspaceId || null,
      isWorkspace: Boolean(activeWorkspaceId),
    };

    if (wf.handlerKind === 'convert_idea_to_goal') {
      const { convertNoteToGoalAgentic } = await import('@/lib/ai-actions');
      await convertNoteToGoalAgentic(targetObject.raw || (targetObject as any), workspaceOpts);
      showSuccess('Created goal(s) in Kylrix Flow');
    } else if (
      wf.handlerKind === 'convert_goal_to_idea' ||
      wf.handlerKind === 'convert_event_to_idea'
    ) {
      const { convertObjectToIdeasAgentic } = await import('@/lib/ai-actions');
      await convertObjectToIdeasAgentic(
        {
          id: targetObject.id,
          title: targetObject.title,
          content: targetObject.content || targetObject.description,
          type: objectType === 'goal' ? 'goal' : 'event',
        },
        workspaceOpts
      );
      showSuccess('Created idea(s) in Ideas directory');
    } else if (wf.handlerKind === 'convert_event_to_goal') {
      const { unifiedCreate } = await import('@/lib/services/unified-object-service');
      await unifiedCreate('goal', {
        title: `Task from Event: ${targetObject.title}`,
        description: targetObject.content || targetObject.description || '',
        status: 'todo',
        priority: 'medium',
        ...(workspaceOpts.projectId ? { projectId: workspaceOpts.projectId, isWorkspace: true } : {}),
      });
      showSuccess('Task created from Event');
    } else if (wf.handlerKind === 'convert_idea_to_event') {
      const { unifiedCreate } = await import('@/lib/services/unified-object-service');
      const now = new Date();
      const start = new Date(now.getTime() + 3600000).toISOString();
      const end = new Date(now.getTime() + 7200000).toISOString();
      await unifiedCreate('event', {
        title: `Event for: ${targetObject.title}`,
        description: targetObject.content || targetObject.description || '',
        startTime: start,
        endTime: end,
        ...(workspaceOpts.projectId ? { projectId: workspaceOpts.projectId, isWorkspace: true } : {}),
      });
      showSuccess('Event scheduled in Calendar');
    } else {
      showSuccess(`Executed workflow: ${wf.name}`);
    }
  } catch (err: any) {
    showError('Workflow Failed', err?.message || 'Execution error');
  }
}

/**
 * Builds the sub-menu items for the native Object Context Menu drawer.
 * Renders inside the same drawer as a sub-state without opening an external component.
 */
export function getWorkflowSubmenuItems(options: WorkflowSubmenuOptions) {
  const workflows = getWorkflowsForObject(options.objectType, options.installedFlows);

  if (workflows.length === 0) {
    return [
      {
        label: 'No workflows available',
        icon: <Workflow size={15} className="text-[#9B9691]" />,
        onClick: () => {},
      },
    ];
  }

  return workflows.map((wf) => {
    let icon = <Workflow size={15} className="text-[#A855F7]" />;
    if (wf.icon === 'CheckSquare') icon = <CheckSquare size={15} className="text-[#A855F7]" />;
    else if (wf.icon === 'FileText') icon = <FileText size={15} className="text-[#10B981]" />;
    else if (wf.icon === 'Calendar') icon = <Calendar size={15} className="text-[#3B82F6]" />;
    else if (wf.icon === 'Lock') icon = <Lock size={15} className="text-[#EC4899]" />;
    else if (wf.icon === 'Sparkles') icon = <Sparkles size={15} className="text-[#A855F7]" />;

    return {
      label: wf.name,
      icon,
      onClick: () => executeBuiltinWorkflow(wf, options),
    };
  });
}
