/** Keep visibility, isPublic, and isGuest aligned for display and gates. */
export function normalizeProjectVisibility<T extends Record<string, any>>(project: T | null | undefined): T | null | undefined {
  if (!project) return project;

  const visibility = project.visibility;
  const isPublic = project.isPublic === true;
  const isGuest = project.isGuest === true;
  const worldVisible = visibility === 'public' || isPublic || isGuest;

  if (worldVisible) {
    return {
      ...project,
      visibility: 'public',
      isPublic: true,
      isGuest: isGuest || visibility === 'public',
    };
  }

  if (visibility === 'private' || (!isPublic && !isGuest)) {
    return {
      ...project,
      visibility: 'private',
      isPublic: false,
      isGuest: false,
    };
  }

  return project;
}
