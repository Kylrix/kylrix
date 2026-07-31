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

/** Accent for card chrome — matches ecosystem app colors (ideas pink, goals violet, …). */
export function objectKindAccent(kind: ObjectKind): string {
  switch (kind) {
    case 'note':
      return '#EC4899';
    case 'goal':
      return '#A855F7';
    case 'form':
      return '#6366F1';
    case 'event':
      return '#22C55E';
    case 'moment':
      return '#F59E0B';
    case 'credential':
    case 'totp':
      return '#F59E0B';
    case 'project':
      return '#6366F1';
    case 'agent_session':
      return '#F59E0B';
    default:
      return '#9B9691';
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
