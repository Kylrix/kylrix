/**
 * Kill-switch for optional global client traffic (onboarding drawers, topbar MasterPass probe,
 * presence polling). Set to `false` to restore full behavior.
 *
 * Wired from: `GlobalShell.tsx`, `NoteTopbar.tsx`.
 */
export const DISABLE_GLOBAL_HEALTH_OVERHEAD = false;
