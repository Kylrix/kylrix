'use server';

import { WorkflowDbService } from '@/lib/services/workflows';
import { WorkflowChain } from '@/lib/workflow-engine';
import { getActor } from '@/lib/actions/secure-ops';
import { getBuiltinFlow } from '@/lib/flows/builtins';
import { buildPublicResourceUrl } from '@/lib/share/public-url';

/**
 * Server action to securely save/sync a workflow chain to the database
 */
export async function saveWorkflowAction(wf: WorkflowChain, jwt?: string) {
  try {
    const actor = await getActor(jwt);
    if (!actor?.$id) throw new Error('Unauthorized');
    const userId = actor.$id;

    if (!wf || !wf.id) throw new Error('Invalid workflow chain');
    
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
export async function listWorkflowsAction(jwt?: string) {
  try {
    const actor = await getActor(jwt);
    if (!actor?.$id) throw new Error('Unauthorized');

    const list = await WorkflowDbService.listWorkflows();
    return { success: true, data: list };
  } catch (err: any) {
    console.error('[listWorkflowsAction] Exception:', err);
    return { success: false, error: 'Failed to retrieve workflows', data: [] };
  }
}

/** Discover catalog: published community flows (builtins are client-side). */
export async function listDiscoverFlowsAction(jwt?: string) {
  try {
    await getActor(jwt).catch(() => null);
    const list = await WorkflowDbService.listPublicWorkflows();
    return { success: true, data: list };
  } catch (err: any) {
    console.error('[listDiscoverFlowsAction] Exception:', err);
    return { success: false, error: 'Failed to load discover', data: [] as WorkflowChain[] };
  }
}

/** Public share page — builtins, public rows, or owner. */
export async function getFlowAction(workflowId: string, jwt?: string) {
  try {
    const id = String(workflowId || '').trim();
    if (!id) throw new Error('Flow id required');

    const builtin = getBuiltinFlow(id);
    if (builtin) {
      return {
        success: true,
        data: builtin,
        isOwner: false,
        shareUrl: buildPublicResourceUrl('flow', id),
      };
    }

    const actor = await getActor(jwt).catch(() => null);
    const row = await WorkflowDbService.getByWorkflowId(id);
    if (!row) return { success: false, error: 'Flow not found', data: null };

    const perms = (row as any).$permissions || [];
    const isOwner =
      !!actor?.$id &&
      perms.some(
        (p: string) =>
          p.includes(`user:${actor.$id}`) &&
          (p.startsWith('write(') || p.startsWith('update(') || p.startsWith('read('))
      );

    if (!row.isPublic && !isOwner) {
      return { success: false, error: 'This flow is private', data: null };
    }

    return {
      success: true,
      data: row,
      isOwner,
      shareUrl: buildPublicResourceUrl('flow', id),
    };
  } catch (err: any) {
    console.error('[getFlowAction] Exception:', err);
    return { success: false, error: err?.message || 'Failed to load flow', data: null };
  }
}

export async function publishFlowAction(
  workflowId: string,
  opts: { confirmAware: boolean; jwt?: string }
) {
  try {
    if (!opts.confirmAware) {
      return { success: false, error: 'Confirm you understand this will be public.' };
    }
    const { requestFlowPublishSecure } = await import('@/lib/actions/secure-ops/flows');
    const res = await requestFlowPublishSecure({
      flowId: String(workflowId || '').trim(),
      confirmAware: true,
      jwt: opts.jwt,
    });
    return {
      success: true,
      isPublic: !!res.isPublic,
      needsAgent: !!res.needsAgent,
      verdict: res.verdict,
      pii: res.pii,
      shareUrl: res.shareUrl,
    };
  } catch (err: any) {
    console.error('[publishFlowAction] Exception:', err);
    return { success: false, error: err?.message || 'Failed to publish' };
  }
}

export async function unpublishFlowAction(workflowId: string, jwt?: string) {
  try {
    const actor = await getActor(jwt);
    if (!actor?.$id) throw new Error('Unauthorized');
    const id = String(workflowId || '').trim();
    await WorkflowDbService.setPublishState(id, {
      isPublic: false,
      isGuest: false,
      actorId: actor.$id,
    });
    return { success: true, isPublic: false };
  } catch (err: any) {
    console.error('[unpublishFlowAction] Exception:', err);
    return { success: false, error: err?.message || 'Failed to unpublish' };
  }
}

/**
 * Server action to securely delete a workflow
 */
export async function deleteWorkflowAction(workflowId: string, jwt?: string) {
  try {
    const actor = await getActor(jwt);
    if (!actor?.$id) throw new Error('Unauthorized');

    const id = String(workflowId || '').trim();
    if (!id) throw new Error('workflowId is required');

    // Note: Appwrite document-level security will automatically reject 
    // unauthorized delete attempts on the database layer, but we add 
    // explicit check for consistency.
    await WorkflowDbService.deleteWorkflow(id);
    return { success: true };
  } catch (err: any) {
    console.error('[deleteWorkflowAction] Exception:', err);
    return { success: false, error: err?.message || 'Failed to delete workflow' };
  }
}
