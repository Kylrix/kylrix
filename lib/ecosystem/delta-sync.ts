import { syncNotesDeltaSecure } from '@/lib/actions/secure-ops';

/**
 * Client-side helper for Transaction-Clock Delta Sync.
 */
export async function syncNotesDelta(localManifest: { id: string; updatedAt: string }[]) {
  try {
    const result = await syncNotesDeltaSecure(localManifest);
    if (!result.success) {
      throw new Error('Delta sync failed');
    }
    return result;
  } catch (err) {
    console.error('[Delta Sync] Failed:', err);
    throw err;
  }
}
