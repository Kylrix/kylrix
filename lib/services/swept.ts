export const SweptService = {
  async getConfig(projectId: string) {
    if (typeof window === 'undefined') {
      return { enabled: false, scopeType: 'project', anchorKind: 'tag' };
    }
    const { getSweptConfigSecure } = await import('@/lib/actions/secure-ops');
    return getSweptConfigSecure(projectId);
  },

  async setEnabled(projectId: string, enabled: boolean) {
    const { upsertSweptConfigSecure } = await import('@/lib/actions/secure-ops');
    return upsertSweptConfigSecure(projectId, { enabled });
  },
};
