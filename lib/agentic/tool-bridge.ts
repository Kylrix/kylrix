/**
 * Maps legacy agent tool keys ↔ canonical dotted tool ids.
 * UI and object tools stay stable when routes or table layouts change.
 */

export const LEGACY_TO_CANONICAL: Record<string, string> = {
  create_note: 'objects.idea.create',
  update_note: 'objects.idea.update',
  get_note: 'objects.idea.read',
  delete_resource: 'objects.*.delete',
  create_goal: 'objects.goal.create',
  update_goal: 'objects.goal.update',
  list_goals: 'objects.goal.search',
  create_project: 'objects.workspace.create',
  link_to_project: 'objects.workspace.link',
  navigate_workspace: 'ui.navigate',
  toggle_privacy: 'objects.visibility.toggle',
  suggest_next_steps: 'ui.suggest_next_steps',
  create_or_select_agent: 'ui.open_drawer',
  open_wallet_funding: 'ui.open_drawer',
  search_ecosystem: 'search.ecosystem',
  submit_form_response: 'objects.form.submit',
  open_preview: 'ui.preview.open',
};

export function canonicalizeToolKey(toolKey: string): string {
  return LEGACY_TO_CANONICAL[toolKey] || toolKey;
}

export function isLegacyToolKey(toolKey: string): boolean {
  return toolKey in LEGACY_TO_CANONICAL;
}
