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

function normalizeCallParticipants(participants: Array<string | null | undefined> = []) {
  return Array.from(
    new Set(participants.map((participant) => String(participant || '').trim()).filter(Boolean))
  );
}

export function createCallMetadata(input: CreateCallMetadataInput): string {
  return JSON.stringify({
    ...input,
    participantIds: normalizeCallParticipants(input.participantIds || []),
    createdAt: new Date().toISOString()});
}

export function parseCallMetadata(raw: unknown): KylrixCallMetadata & { createdAt?: string } {
  if (!raw) {
    return {
      scope: 'link',
      hostId: '',
      participantIds: []};
  }

  if (typeof raw === 'object') {
    return raw as KylrixCallMetadata & { createdAt?: string };
  }

  if (typeof raw !== 'string') {
    return {
      scope: 'link',
      hostId: '',
      participantIds: []};
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
      participantIds: []};
  }
}




