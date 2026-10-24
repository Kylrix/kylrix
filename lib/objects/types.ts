/**
 * Unified object model — one shape for notes, goals, forms, vault items, etc.
 * Live copy + sync engine remain SoT; UI shells switch on `kind`.
 */

export type ObjectKind =
  | 'note'
  | 'goal'
  | 'form'
  | 'event'
  | 'credential'
  | 'totp'
  | 'project'
  | 'agent_session'
  | 'moment';

type ObjectRef = {
  kind: ObjectKind;
  id: string;
};

export type UnifiedObjectCardModel = ObjectRef & {
  title: string;
  subtitle?: string;
  updatedAt?: string | Date | null;
  isPinned?: boolean;
  isPublic?: boolean;
  isGuest?: boolean;
  status?: string | null;
  accent?: string | null;
};

export type UnifiedObjectDetailModel = UnifiedObjectCardModel & {
  body?: string;
  tags?: string[];
  ownerId?: string | null;
  raw?: unknown;
};

/** Accent for card chrome — unified primary color across all object kinds. */
export function objectKindAccent(kind: ObjectKind): string {
  switch (kind) {
    case 'note':
    case 'goal':
    case 'form':
    case 'event':
    case 'moment':
    case 'credential':
    case 'totp':
    case 'project':
    case 'agent_session':
    default:
      return '#6366F1';
  }
}

export function objectKindLabel(kind: ObjectKind): string {
  switch (kind) {
    case 'note':
      return 'Idea';
    case 'goal':
      return 'Goal';
    case 'form':
      return 'Form';
    case 'event':
      return 'Event';
    case 'moment':
      return 'Moment';
    case 'credential':
      return 'Secret';
    case 'totp':
      return 'Code';
    case 'project':
      return 'Project';
    case 'agent_session':
      return 'Chat';
    default:
      return 'Item';
  }
}
