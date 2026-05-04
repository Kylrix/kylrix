import type { KylrixApp } from '../design';

export type KylrixCallScope = 'direct' | 'group' | 'link' | 'note' | 'huddle';

export interface KylrixCallMetadata {
  scope: KylrixCallScope;
  hostId: string;
  title?: string;
  sourceApp?: KylrixApp;
  conversationId?: string;
  noteId?: string;
  huddleId?: string;
  participantIds?: string[];
  isPrivate?: boolean;
  allowGuests?: boolean;
  startsAt?: string | null;
  expiresAt?: string | null;
}

export interface CreateCallMetadataInput extends Omit<KylrixCallMetadata, 'participantIds'> {
  participantIds?: Array<string | null | undefined>;
}

export function normalizeCallParticipants(participants: Array<string | null | undefined> = []) {
  return Array.from(
    new Set(participants.map((participant) => String(participant || '').trim()).filter(Boolean))
  );
}

export function createCallMetadata(input: CreateCallMetadataInput): string {
  return JSON.stringify({
    ...input,
    participantIds: normalizeCallParticipants(input.participantIds || []),
    createdAt: new Date().toISOString(),
  });
}

export function parseCallMetadata(raw: unknown): KylrixCallMetadata & { createdAt?: string } {
  if (!raw) {
    return {
      scope: 'link',
      hostId: '',
      participantIds: [],
    };
  }

  if (typeof raw === 'object') {
    return raw as KylrixCallMetadata & { createdAt?: string };
  }

  if (typeof raw !== 'string') {
    return {
      scope: 'link',
      hostId: '',
      participantIds: [],
    };
  }

  try {
    const parsed = JSON.parse(raw);
    return parsed && typeof parsed === 'object'
      ? (parsed as KylrixCallMetadata & { createdAt?: string })
      : { scope: 'link', hostId: '', participantIds: [] };
  } catch {
    return {
      scope: 'link',
      hostId: '',
      participantIds: [],
    };
  }
}

export function isCallExpired(call: {
  expiresAt?: string | null;
  startsAt?: string | null;
  metadata?: unknown;
}, now = Date.now()) {
  const metadata = parseCallMetadata(call.metadata);
  const expiresAt = call.expiresAt || metadata.expiresAt || null;
  const startsAt = call.startsAt || metadata.startsAt || null;

  if (!expiresAt) return false;

  const endTime = new Date(expiresAt).getTime();
  if (Number.isNaN(endTime)) return false;

  if (startsAt) {
    const startTime = new Date(startsAt).getTime();
    if (!Number.isNaN(startTime) && now < startTime) {
      return false;
    }
  }

  return now > endTime;
}

export function isCallActive(call: {
  expiresAt?: string | null;
  startsAt?: string | null;
  metadata?: unknown;
}, now = Date.now()) {
  const metadata = parseCallMetadata(call.metadata);
  const startsAt = call.startsAt || metadata.startsAt || null;
  const expiresAt = call.expiresAt || metadata.expiresAt || null;

  if (startsAt) {
    const startTime = new Date(startsAt).getTime();
    if (!Number.isNaN(startTime) && now < startTime) {
      return false;
    }
  }

  if (expiresAt) {
    const endTime = new Date(expiresAt).getTime();
    if (!Number.isNaN(endTime) && now > endTime) {
      return false;
    }
  }

  return true;
}

export function buildCallJoinUrl(baseUrl: string, callId: string, params: Record<string, string | number | boolean | null | undefined> = {}) {
  const url = new URL(`/call/${callId}`, baseUrl);

  for (const [key, value] of Object.entries(params)) {
    if (value === null || value === undefined || value === '') continue;
    url.searchParams.set(key, String(value));
  }

  return url.toString();
}

export function buildCallTitle(scope: KylrixCallScope, title?: string | null) {
  if (title && title.trim()) return title.trim();
  switch (scope) {
    case 'direct':
      return 'Direct Call';
    case 'group':
      return 'Group Call';
    case 'note':
      return 'Note Huddle';
    case 'huddle':
      return 'Huddle';
    case 'link':
    default:
      return 'Public Call';
  }
}
