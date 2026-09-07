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
  /**
   * When true: return URL immediately and publish isPublic/isGuest in the background.
   * Callers should treat `published: false` + `pending: true` as “confirming”, not “shared”.
   */
  deferPublish?: boolean;
  /** Fired when background publish finishes (only with deferPublish). */
  onPublishSettled?: (result: InstantShareResult) => void;
}

export interface InstantShareResult {
  success: boolean;
  url: string;
  copied: boolean;
  /** True only after Appwrite isPublic+isGuest columns confirmed via secure-ops. */
  published?: boolean;
  /** Background publish still running (URL is already usable to copy). */
  pending?: boolean;
  isPublic?: boolean;
  isGuest?: boolean;
  requiresAuth?: boolean;
  requiresMasterpass?: boolean;
  error?: string;
}

/** Sync URL from offline id — never waits on network. */
export function buildInstantShareUrl(
  resourceType: PublicResourceType,
  resourceId: string,
  options: Pick<InstantShareOptions, 'projectId' | 'dek'> & { keyFragment?: string } = {},
): string {
  const baseUrl = buildPublicResourceUrl(resourceType, resourceId, {
    projectId: options.projectId,
  });
  if (options.keyFragment) return `${baseUrl}${options.keyFragment}`;
  return baseUrl;
}

async function resolveDekFragment(
  dek: string | null | undefined,
  openMasterpassPrompt?: () => void,
): Promise<{ keyFragment: string; requiresMasterpass: boolean }> {
  if (!dek || typeof dek !== 'string' || !dek.trim()) {
    return { keyFragment: '', requiresMasterpass: false };
  }
  const isUnlocked = masterPassCrypto.isVaultUnlocked();
  if (!isUnlocked) {
    if (openMasterpassPrompt) openMasterpassPrompt();
    return { keyFragment: '', requiresMasterpass: true };
  }
  try {
    const dekBase64 = looksEncrypted(dek) ? await decryptField(dek) : dek;
    if (dekBase64) {
      return { keyFragment: `/${toUrlSafeBase64(dekBase64)}`, requiresMasterpass: false };
    }
  } catch (err) {
    console.warn('[InstantShare] Could not unwrap DEK with MEK:', err);
  }
  return { keyFragment: '', requiresMasterpass: false };
}

/** Public URL with DEK path segment for encrypted vault/locked shares. */
export async function buildInstantShareUrlWithDek(
  resourceType: PublicResourceType,
  resourceId: string,
  options: Pick<InstantShareOptions, 'projectId' | 'dek' | 'openMasterpassPrompt'> = {},
): Promise<{ url: string; requiresMasterpass: boolean; keyFragment: string }> {
  const { keyFragment, requiresMasterpass } = await resolveDekFragment(
    options.dek,
    options.openMasterpassPrompt,
  );
  return {
    url: buildInstantShareUrl(resourceType, resourceId, {
      projectId: options.projectId,
      keyFragment,
    }),
    requiresMasterpass,
    keyFragment,
  };
}

async function enqueueShareFlush(
  resourceType: PublicResourceType,
  resourceId: string,
): Promise<void> {
  try {
    if (resourceType === 'note') {
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
}

/**
 * Flush row + set isPublic/isGuest on Appwrite. Does not build URL.
 */
export async function ensureSharePublished(
  resourceType: PublicResourceType,
  resourceId: string,
  options: Pick<InstantShareOptions, 'projectId'> = {},
): Promise<InstantShareResult> {
  const url = buildInstantShareUrl(resourceType, resourceId, { projectId: options.projectId });
  try {
    await enqueueShareFlush(resourceType, resourceId);
    await autonomicSyncEngine.runCycle().catch(() => {});

    const publishRes = await toggleResourcePublicGuest({
      resourceType,
      resourceId,
      mode: 'publish',
      projectId: options.projectId,
    });

    if (!publishRes?.success || !publishRes.isPublic || !publishRes.isGuest) {
      return {
        success: false,
        // Always keep client-built URL — Server Actions resolve to kylrix.space
        url,
        copied: false,
        published: false,
        pending: false,
        isPublic: publishRes?.isPublic === true,
        isGuest: publishRes?.isGuest === true,
        error: 'Could not confirm public sharing on the server',
      };
    }

    return {
      success: true,
      url,
      copied: false,
      published: true,
      pending: false,
      isPublic: true,
      isGuest: true,
    };
  } catch (syncErr) {
    const message = syncErr instanceof Error ? syncErr.message : 'Share sync failed';
    console.error('[InstantShare] Share publish error:', syncErr);
    return {
      success: false,
      url,
      copied: false,
      published: false,
      pending: false,
      error: message,
    };
  }
}

/**
 * Share link + publish.
 * Default: await publish (strict).
 * `deferPublish: true`: return URL immediately; publish in background.
 */
export async function executeInstantShare(
  resourceType: PublicResourceType,
  resourceId: string,
  options: InstantShareOptions = {},
): Promise<InstantShareResult> {
  const {
    dek,
    resourceTitle,
    openLoginDrawer,
    openMasterpassPrompt,
    projectId,
    deferPublish = false,
    onPublishSettled,
  } = options;

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

  const { keyFragment, requiresMasterpass } = await resolveDekFragment(dek, openMasterpassPrompt);
  const finalUrl = buildInstantShareUrl(resourceType, resourceId, { projectId, keyFragment });

  let copied = false;
  try {
    if (typeof navigator !== 'undefined' && navigator.clipboard?.writeText) {
      await navigator.clipboard.writeText(finalUrl);
      copied = true;
    }
  } catch (clipErr) {
    console.warn('[InstantShare] Clipboard copy warning:', clipErr);
  }

  if (deferPublish) {
    void ensureSharePublished(resourceType, resourceId, { projectId }).then((pub) => {
      const settled: InstantShareResult = {
        ...pub,
        url: pub.url || finalUrl,
        copied,
        requiresMasterpass,
      };
      try {
        onPublishSettled?.(settled);
      } catch {}
    });
    return {
      success: true,
      url: finalUrl,
      copied,
      published: false,
      pending: true,
      requiresMasterpass,
    };
  }

  const pub = await ensureSharePublished(resourceType, resourceId, { projectId });
  return {
    ...pub,
    url: pub.url || finalUrl,
    copied,
    requiresMasterpass,
  };
}
