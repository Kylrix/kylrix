export const DEFAULT_FEEDBACK_FORM_ID = '6aae3dab003a7247b90a';

export const DEFAULT_FEEDBACK_FORM_ROW = {
  $id: DEFAULT_FEEDBACK_FORM_ID,
  id: DEFAULT_FEEDBACK_FORM_ID,
  userId: 'system',
  title: 'Feature Request & Bug Report',
  description: 'Help shape the future of Kylrix. Report issues, request new features, or share suggestions directly with the core development team.',
  schema: JSON.stringify([
    {
      id: 'f_category',
      type: 'radio',
      label: 'Submission Category',
      required: true,
      options: ['Feature Request', 'Bug Report', 'General Feedback', 'Performance Issue'],
    },
    {
      id: 'f_title',
      type: 'text',
      label: 'Summary / Title',
      placeholder: 'Brief summary of your request or issue',
      required: true,
    },
    {
      id: 'f_module',
      type: 'checkbox',
      label: 'Affected Area / Module',
      required: false,
      options: ['Notes', 'Flow', 'Vault', 'Settings', 'Sync & Turso', 'AI / Agents', 'UI & Theme', 'Billing'],
    },
    {
      id: 'f_details',
      type: 'textarea',
      label: 'Details & Context',
      placeholder: 'Describe what you would like to see, or the steps to reproduce the bug...',
      required: true,
    },
  ]),
  settings: JSON.stringify({
    ghostFields: ['client_environment', 'subscription_tier', 'identity_id', 'contributor_status'],
    collectGhostFields: true,
    allowAnonymousFill: true,
  }),
  status: 'published',
  visibility: 'public',
  isPublic: true,
  isGuest: true,
  isWorkspace: false,
  $createdAt: '2026-01-01T00:00:00.000Z',
  $updatedAt: '2026-01-01T00:00:00.000Z',
};
