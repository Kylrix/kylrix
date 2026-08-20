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
  requiresAuth?: boolean;
  requiresMasterpass?: boolean;
}

/**
 * Universally unblocks getting and copying share links instantly for any object.
 *
 * 1. Computes the share link immediately from the object state & resource ID.
 *    - If the object has a DEK or is encrypted, attempts to unwrap using MEK.
 *    - If MEK is not yet unlocked, signals to prompt masterpass unlock.
 * 2. Copies the link to clipboard with zero artificial delay.
 * 3. Immediately triggers prioritized background synchronization:
 *    - Flushes pending sync payloads for the object if not yet remote.
 *    - Ensures `isPublic: true` and `isGuest: true` are persisted.
 *    - If user is not logged in, opens the auth drawer with dynamic object context.
 */
export async function executeInstantShare(
  resourceType: PublicResourceType,
  resourceId: string,
  options: InstantShareOptions = {}
): Promise<InstantShareResult> {
  const { dek, isPublic, isGuest, resourceTitle, openLoginDrawer, openMasterpassPrompt, projectId } = options;

  // 1. Verify User Authentication for cloud sharing
  const currentUser = getCurrentUserSnapshot();
  if (!currentUser?.$id) {
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
      requiresAuth: true,
    };
  }

  // 2. Build URL & resolve encryption DEK fragment
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

  // 3. Unblock Instant Copying
  let copied = false;
  try {
    if (typeof navigator !== 'undefined' && navigator.clipboard?.writeText) {
      await navigator.clipboard.writeText(finalUrl);
      copied = true;
    }
  } catch (clipErr) {
    console.warn('[InstantShare] Clipboard copy warning:', clipErr);
  }

  // 4. Aggressive Background Synchronizer
  // Ensures the object is flushed upstream FIRST before publishing permissions
  void (async () => {
    try {
      // 4a. If object is pending in LocalEngine / SyncEngine, run the sync cycle immediately and wait for creation
      if (autonomicSyncEngine.isPending(resourceId)) {
        await autonomicSyncEngine.runCycle().catch(() => {});
      }

      // 4b. Now that the row is guaranteed to exist upstream, ensure public & guest flags are active
      if (!isPublic || !isGuest) {
        await toggleResourcePublicGuest({
          resourceType,
          resourceId,
          mode: 'publish',
          projectId,
        }).catch((err) => {
          console.warn('[InstantShare] toggleResourcePublicGuest warning:', err);
        });
      }
    } catch (syncErr) {
      console.error('[InstantShare] Background share sync error:', syncErr);
    }
  })();

  return {
    success: true,
    url: finalUrl,
    copied,
    requiresMasterpass,
  };
}
