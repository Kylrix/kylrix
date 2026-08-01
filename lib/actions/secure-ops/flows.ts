'use server';

import { getActor } from '@/lib/actions/secure-ops';
import { FlowInstallService } from '@/lib/services/flow-installs';
import { FlowReviewService } from '@/lib/services/flow-reviews';
import type { FlowScopeInput } from '@/lib/flows/bindings';
import { buildPublicResourceUrl } from '@/lib/share/public-url';

/**
 * Secure install punch — installer owns flow_installs row;
 * system client alone bumps workflows.installCount.
 */
export async function installFlowSecure(params: {
  flowId: string;
  scope?: FlowScopeInput;
  grants?: Record<string, unknown> | null;
  bindObject?: boolean;
  jwt?: string;
}) {
  const actor = await getActor(params.jwt);
  if (!actor?.$id) throw new Error('Unauthorized');

  const flowId = String(params.flowId || '').trim();
  if (!flowId) throw new Error('flowId required');

  const result = await FlowInstallService.install({
    flowId,
    installerId: actor.$id,
    scope: params.scope || { type: 'user' },
    grants: params.grants || null,
    bindObject: params.bindObject !== false,
  });

  return {
    success: true,
    created: result.created,
    installId: result.install.$id,
    installCount: result.installCount,
    scopeKey: result.install.scopeKey,
  };
}

export async function listMyFlowInstallsSecure(jwt?: string) {
  const actor = await getActor(jwt);
  if (!actor?.$id) throw new Error('Unauthorized');
  const rows = await FlowInstallService.listForInstaller(actor.$id);
  return { success: true, data: rows };
}

export async function revokeFlowInstallSecure(params: {
  installId: string;
  jwt?: string;
}) {
  const actor = await getActor(params.jwt);
  if (!actor?.$id) throw new Error('Unauthorized');
  await FlowInstallService.revoke({
    installId: params.installId,
    installerId: actor.$id,
  });
  return { success: true };
}

/**
 * Publish gate: always punches into review pipeline (agentic hole).
 * Auto-approves only general+no-PII; otherwise pending for agent.
 */
export async function requestFlowPublishSecure(params: {
  flowId: string;
  confirmAware: boolean;
  jwt?: string;
}) {
  const actor = await getActor(params.jwt);
  if (!actor?.$id) throw new Error('Unauthorized');

  const result = await FlowReviewService.requestPublishReview({
    flowId: String(params.flowId || '').trim(),
    actorId: actor.$id,
    confirmAware: !!params.confirmAware,
  });

  return {
    success: true,
    ...result,
    shareUrl: buildPublicResourceUrl('flow', params.flowId),
  };
}
