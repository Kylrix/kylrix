export type TelegramNotificationAction =
  | 'invites'
  | 'calls'
  | 'messages'
  | 'mentions'
  | 'task_updates'
  | 'general';

export type TelegramNotificationObject =
  | 'note'
  | 'project'
  | 'task'
  | 'secret'
  | 'totp'
  | 'call'
  | 'huddle'
  | 'event'
  | 'form';

export interface TelegramNotificationPreferences {
  enabled: boolean;
  actions: Record<TelegramNotificationAction, boolean>;
  objects: Record<TelegramNotificationObject, boolean>;
  /** When non-empty, only these resource IDs receive object-scoped alerts. */
  watchedResourceIds: string[];
}

export const TELEGRAM_PREFS_KEY = 'telegram_notification_prefs';

export const TELEGRAM_ACTION_LABELS: Record<TelegramNotificationAction, string> = {
  invites: 'Invites & sharing',
  calls: 'Incoming calls',
  messages: 'Chat messages',
  mentions: 'Mentions',
  task_updates: 'Task & goal updates',
  general: 'General alerts',
};

export const TELEGRAM_OBJECT_LABELS: Record<TelegramNotificationObject, string> = {
  note: 'Ideas',
  project: 'Projects',
  task: 'Tasks & goals',
  secret: 'Passwords',
  totp: 'Authenticator codes',
  call: 'Calls',
  huddle: 'Huddles',
  event: 'Events',
  form: 'Forms',
};

export function defaultTelegramNotificationPreferences(): TelegramNotificationPreferences {
  return {
    enabled: true,
    actions: {
      invites: true,
      calls: true,
      messages: true,
      mentions: true,
      task_updates: true,
      general: true,
    },
    objects: {
      note: true,
      project: true,
      task: true,
      secret: true,
      totp: true,
      call: true,
      huddle: true,
      event: true,
      form: true,
    },
    watchedResourceIds: [],
  };
}

export function parseTelegramNotificationPreferences(raw: unknown): TelegramNotificationPreferences {
  const defaults = defaultTelegramNotificationPreferences();
  if (!raw || typeof raw !== 'object') return defaults;

  const input = raw as Partial<TelegramNotificationPreferences>;
  return {
    enabled: typeof input.enabled === 'boolean' ? input.enabled : defaults.enabled,
    actions: { ...defaults.actions, ...(input.actions || {}) },
    objects: { ...defaults.objects, ...(input.objects || {}) },
    watchedResourceIds: Array.isArray(input.watchedResourceIds)
      ? input.watchedResourceIds.map((id) => String(id || '').trim()).filter(Boolean)
      : [],
  };
}

export function normalizeTelegramObjectType(
  resourceType?: string | null
): TelegramNotificationObject | null {
  const value = String(resourceType || '').trim().toLowerCase();
  switch (value) {
    case 'note':
      return 'note';
    case 'project':
      return 'project';
    case 'task':
    case 'goal':
      return 'task';
    case 'secret':
    case 'credential':
    case 'password':
      return 'secret';
    case 'totp':
      return 'totp';
    case 'call':
      return 'call';
    case 'huddle':
      return 'huddle';
    case 'event':
      return 'event';
    case 'form':
      return 'form';
    default:
      return null;
  }
}

export function resolveTelegramAction(input: {
  type?: 'invite' | 'standard';
  title?: string;
  resourceType?: string;
}): TelegramNotificationAction {
  if (input.type === 'invite') return 'invites';
  const title = String(input.title || '').toLowerCase();
  if (title.includes('call') || title.includes('huddle')) return 'calls';
  if (title.includes('mention')) return 'mentions';
  if (title.includes('message') || title.includes('chat')) return 'messages';
  if (title.includes('task') || title.includes('goal')) return 'task_updates';
  const objectType = normalizeTelegramObjectType(input.resourceType);
  if (objectType === 'task') return 'task_updates';
  if (objectType === 'call' || objectType === 'huddle') return 'calls';
  return 'general';
}

export function shouldDeliverTelegramNotification(
  prefs: TelegramNotificationPreferences,
  context: {
    action: TelegramNotificationAction;
    resourceType?: string | null;
    resourceId?: string | null;
  }
): boolean {
  if (!prefs.enabled) return false;
  if (!prefs.actions[context.action]) return false;

  const objectType = normalizeTelegramObjectType(context.resourceType);
  if (objectType && !prefs.objects[objectType]) return false;

  const resourceId = String(context.resourceId || '').trim();
  if (resourceId && prefs.watchedResourceIds.length > 0) {
    return prefs.watchedResourceIds.includes(resourceId);
  }

  return true;
}
