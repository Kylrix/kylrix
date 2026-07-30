/**
 * Agentic user preferences — stored in Appwrite account prefs.
 */

export interface AgenticPreferences {
  authorizedTools: string[];
  /** When true, delete_resource always requires explicit confirmation drawer */
  requireDeleteConfirmation: boolean;
  /** When true, destructive tools need one-time approval even if whitelisted */
  strictDestructiveMode: boolean;
}

const DEFAULT_PREFS: AgenticPreferences = {
  authorizedTools: [],
  requireDeleteConfirmation: true,
  strictDestructiveMode: true};

const DESTRUCTIVE_TOOL_KEYS = new Set([
  'delete_resource',
  'objects.idea.delete',
  'objects.goal.delete',
  'objects.form.delete',
  'objects.workspace.delete',
  'objects.vault.secret.delete',
]);

export function parseAgenticPreferences(raw: Record<string, unknown> | null | undefined): AgenticPreferences {
  if (!raw || typeof raw !== 'object') return { ...DEFAULT_PREFS };
  return {
    authorizedTools: Array.isArray(raw.authorizedTools)
      ? (raw.authorizedTools as string[])
      : DEFAULT_PREFS.authorizedTools,
    requireDeleteConfirmation:
      typeof raw.requireDeleteConfirmation === 'boolean'
        ? raw.requireDeleteConfirmation
        : DEFAULT_PREFS.requireDeleteConfirmation,
    strictDestructiveMode:
      typeof raw.strictDestructiveMode === 'boolean'
        ? raw.strictDestructiveMode
        : DEFAULT_PREFS.strictDestructiveMode};
}

export function toolRequiresAuthorization(
  toolKey: string,
  prefs: AgenticPreferences,
  registryRequiresAuth?: boolean,
): boolean {
  if (prefs.authorizedTools.includes('allow_all')) return false;
  if (prefs.authorizedTools.includes(toolKey)) return false;
  if (DESTRUCTIVE_TOOL_KEYS.has(toolKey) && prefs.requireDeleteConfirmation) return true;
  return !!registryRequiresAuth;
}
