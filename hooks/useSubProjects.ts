'use client';

/**
 * Deprecated hook — sub-projects removed from ecosystem in favor of workspaces + goals.
 */
export function useSubProjects(_workspaceId?: string | null) {
  return {
    projects: [],
    loading: false,
    refetch: async () => {},
    invalidate: () => {},
  };
}
