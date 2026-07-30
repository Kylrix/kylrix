import { APPWRITE_CONFIG } from '@/lib/appwrite/config';

/** Per-user project autosweep preferences backed by the `swept` table. */
export const SweptService = {
  async getConfig(projectId: string) {
    if (typeof window === 'undefined') {
      return { enabled: false, scopeType: 'project', anchorKind: 'tag' };
    }
    const { account } = await import('@/lib/appwrite/client');
    const { jwt } = await account.createJWT();
    const { getSweptConfigSecure } = await import('@/lib/actions/secure-ops');
    return getSweptConfigSecure(projectId, jwt);
  },

  async setEnabled(projectId: string, enabled: boolean) {
    const { account } = await import('@/lib/appwrite/client');
    const { jwt } = await account.createJWT();
    const { upsertSweptConfigSecure } = await import('@/lib/actions/secure-ops');
    return upsertSweptConfigSecure(projectId, { enabled }, jwt);
  },
};

