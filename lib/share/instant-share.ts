import { PublicResourceType, PublicUrlOptions } from './resource-types';
import { buildPublicResourceUrl } from './public-url';
import { masterPassCrypto, looksEncrypted, decryptField } from '@/lib/masterpass-crypto';
import { toggleResourcePublicGuest } from '@/lib/actions/client-ops';
import { autonomicSyncEngine } from '@/lib/services/sync-engine';
import { getCurrentUserSnapshot } from '@/lib/appwrite/client';

function toUrlSafeBase64(base64: string): string {
  return base64.replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

export interface InstantShareOptions extends PublicUrlOptions {
  dek?: string | null;
  /** Current known local flags (for UI only — never skips remote publish). */
  isPublic?: boolean;
  isGuest?: boolean;
  resourceTitle?: string;
  openLoginDrawer?: (context: { title?: string; subtitle?: string; objectKind?: string }) => void;
  openMasterpassPrompt?: () => void;
}

export interface InstantShareResult {
  success: boolean;
  url: string;
  copied: boolean;
  /** True only after Appwrite isPublic+isGuest columns confirmed via secure-ops. */
  published?: boolean;
  isPublic?: boolean;
  isGuest?: boolean;
  requiresAuth?: boolean;
  requiresMasterpass?: boolean;
  error?: string;
}

/**
 * Share link + publish. Link may copy early; `published` / `success` only after
 * remote `isPublic`+`isGuest` are confirmed. Never treat local optimism as truth.
 */
export async function executeInstantShare(
  resourceType: PublicResourceType,
  resourceId: string,
  options: InstantShareOptions = {}
): Promise<InstantShareResult> {
  const { dek, resourceTitle, openLoginDrawer, openMasterpassPrompt, projectId } = options;

  const currentUser = getCurrentUserSnapshot();
  if (!currentUser?.$id && resourceType !== 'moment') {
    if (openLoginDrawer) {
      const friendlyName = resourceTitle ? `"${resourceTitle}"` : resourceType;
      openLoginDrawer({
        title: `Share ${resourceType.charAt(0).toUpperCase() + resourceType.slice(1)}`,
        subtitle: `Create an account or log in to share ${friendlyName} with others.`,
        objectKind: resourceType,
      });
    }
    return {
      success: false,
      url: '',
      copied: false,
      published: false,
      requiresAuth: true,
    };
  }

  let keyFragment = '';
  let requiresMasterpass = false;

  if (dek && typeof dek === 'string' && dek.trim()) {
    const isUnlocked = masterPassCrypto.isVaultUnlocked();
    if (isUnlocked) {
      try {
        const dekBase64 = looksEncrypted(dek) ? await decryptField(dek) : dek;
        if (dekBase64) {
          keyFragment = `/${toUrlSafeBase64(dekBase64)}`;
        }
      } catch (err) {
        console.warn('[InstantShare] Could not unwrap DEK with MEK:', err);
      }
    } else {
      requiresMasterpass = true;
      if (openMasterpassPrompt) {
        openMasterpassPrompt();
      }
    }
  }

  const baseUrl = buildPublicResourceUrl(resourceType, resourceId, { projectId });
  const finalUrl = keyFragment ? `${baseUrl}${keyFragment}` : baseUrl;

  let copied = false;
  try {
    if (typeof navigator !== 'undefined' && navigator.clipboard?.writeText) {
      await navigator.clipboard.writeText(finalUrl);
      copied = true;
    }
  } catch (clipErr) {
    console.warn('[InstantShare] Clipboard copy warning:', clipErr);
  }

  // Flush row first, then ALWAYS publish columns (idempotent). Never skip on local flags.
  try {
    try {
      if (resourceType === 'note' || resourceType === 'idea') {
        const { getLiveNoteForSync } = await import('@/lib/sync/pending-sync-bridge');
        const live = getLiveNoteForSync(resourceId);
        const stamped = {
          ...(live || { $id: resourceId }),
          $id: resourceId,
          isPublic: true,
          isGuest: true,
          updatedAt: new Date().toISOString(),
          $updatedAt: new Date().toISOString(),
        };
        autonomicSyncEngine.markPending(resourceId, stamped.updatedAt, stamped, { force: true });
      } else if (resourceType === 'goal' || resourceType === 'task') {
        const { getLiveGoalForSync } = await import('@/lib/sync/pending-sync-bridge');
        const live = getLiveGoalForSync(resourceId);
        if (live) {
          const { goalPendingKey } = await import('@/lib/sync/goal-keys');
          autonomicSyncEngine.markPending(
            goalPendingKey(resourceId),
            new Date().toISOString(),
            { ...live, isPublic: true, isGuest: true },
            { force: true },
          );
        } else {
          autonomicSyncEngine.markPending(resourceId, new Date().toISOString(), undefined, {
            force: true,
          });
        }
      } else if (!autonomicSyncEngine.isPending(resourceId)) {
        autonomicSyncEngine.markPending(resourceId, new Date().toISOString(), undefined, {
          force: true,
        });
      }
    } catch (enqueueErr) {
      console.warn('[InstantShare] force enqueue warning:', enqueueErr);
    }

    await autonomicSyncEngine.runCycle().catch(() => {});

    const publishRes = await toggleResourcePublicGuest({
      resourceType,
      resourceId,
      mode: 'publish',
      projectId,
    });

    if (!publishRes?.success || !publishRes.isPublic || !publishRes.isGuest) {
      return {
        success: false,
        url: finalUrl,
        copied,
        published: false,
        isPublic: publishRes?.isPublic === true,
        isGuest: publishRes?.isGuest === true,
        requiresMasterpass,
        error: 'Could not confirm public sharing on the server',
      };
    }

    return {
      success: true,
      url: publishRes.publicUrl || finalUrl,
      copied,
      published: true,
      isPublic: true,
      isGuest: true,
      requiresMasterpass,
    };
  } catch (syncErr) {
    const message =
      syncErr instanceof Error ? syncErr.message : 'Share sync failed';
    console.error('[InstantShare] Share publish error:', syncErr);
    return {
      success: false,
      url: finalUrl,
      copied,
      published: false,
      requiresMasterpass,
      error: message,
    };
  }
}
