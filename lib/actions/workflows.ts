'use server';

import { WorkflowDbService } from '@/lib/services/workflows';
import { WorkflowChain } from '@/lib/workflow-engine';
import { getActor } from '@/lib/actions/secure-ops';

/**
 * Server action to securely save/sync a workflow chain to the database
 */
export async function saveWorkflowAction(wf: WorkflowChain) {
  try {
    let userId: string | undefined;
    try {
      const actor = await getActor();
      if (actor) userId = actor.$id;
    } catch {
      // Silent fail-safe for unauthenticated flows
    }
    
    await WorkflowDbService.saveWorkflow(wf, userId);
    return { success: true };
  } catch (err: any) {
    console.error('[saveWorkflowAction] Exception:', err);
    return { success: false, error: err?.message || 'Failed to persist workflow' };
  }
}

/**
 * Server action to list all user-accessible workflows
 */
export async function listWorkflowsAction() {
  try {
    const list = await WorkflowDbService.listWorkflows();
    return { success: true, data: list };
  } catch (err: any) {
    console.error('[listWorkflowsAction] Exception:', err);
    return { success: false, error: 'Failed to retrieve workflows', data: [] };
  }
}

/**
 * Server action to list shared public workflows
 */
export async function listPublicWorkflowsAction() {
  try {
    const list = await WorkflowDbService.listPublicWorkflows();
    return { success: true, data: list };
  } catch (err: any) {
    console.error('[listPublicWorkflowsAction] Exception:', err);
    return { success: false, error: 'Failed to retrieve public workflows', data: [] };
  }
}

/**
 * Server action to securely delete a workflow
 */
export async function deleteWorkflowAction(workflowId: string) {
  try {
    // Note: Appwrite document-level security will automatically reject 
    // unauthorized delete attempts on the database layer.
    await WorkflowDbService.deleteWorkflow(workflowId);
    return { success: true };
  } catch (err: any) {
    console.error('[deleteWorkflowAction] Exception:', err);
    return { success: false, error: err?.message || 'Failed to delete workflow' };
  }
}
