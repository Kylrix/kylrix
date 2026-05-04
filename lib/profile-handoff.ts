/**
 * Profile view handoff utilities
 * Stages profile data for navigation between apps
 */

interface ProfileSeed {
  username?: string;
  name?: string;
  avatar?: string;
  [key: string]: any;
}

/**
 * Stages a profile view in sessionStorage for cross-app navigation
 * This allows the profile page to load with cached data while fetching fresh details
 * @param profile - The profile data to stage
 * @param avatarId - Optional avatar file ID
 */
export function stageProfileView(profile: ProfileSeed, avatarId?: string | null) {
  try {
    const staged = {
      username: profile.username,
      name: profile.name,
      avatar: avatarId || profile.avatar,
      timestamp: Date.now(),
    };
    sessionStorage.setItem('kylrix_staged_profile', JSON.stringify(staged));
  } catch (_e) {
    // Fail silently if sessionStorage is unavailable
  }
}

/**
 * Retrieves a staged profile view from sessionStorage
 * @returns The staged profile data or null if not found/expired
 */
export function getStagedProfileView(): ProfileSeed | null {
  try {
    const data = sessionStorage.getItem('kylrix_staged_profile');
    if (!data) return null;
    
    const staged = JSON.parse(data);
    // Expire after 30 seconds
    if (Date.now() - staged.timestamp > 30000) {
      sessionStorage.removeItem('kylrix_staged_profile');
      return null;
    }
    
    return staged;
  } catch (_e) {
    return null;
  }
}

/**
 * Clears the staged profile view
 */
export function clearStagedProfileView() {
  try {
    sessionStorage.removeItem('kylrix_staged_profile');
  } catch (_e) {
    // Fail silently
  }
}
