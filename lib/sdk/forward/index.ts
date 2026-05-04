import { Query } from 'appwrite';
import type { KylrixApp } from '../design';

export type ForwardTargetKind = 'person' | 'conversation';

export interface ForwardProfile {
  userId: string;
  username?: string | null;
  displayName?: string | null;
  avatar?: string | null;
  publicKey?: string | null;
  email?: string | null;
}

export interface ForwardContact {
  $id?: string;
  userId: string;
  contactUserId: string;
  nickname?: string | null;
  relationship?: string | null;
  isBlocked?: boolean | null;
  isFavorite?: boolean | null;
  notes?: string | null;
  tags?: string[] | null;
}

export interface ForwardConversation {
  $id: string;
  participants?: string[] | null;
  participantCount?: number | null;
  type?: 'direct' | 'group' | string | null;
  creatorId?: string | null;
  name?: string | null;
  title?: string | null;
  lastMessageAt?: string | null;
  lastMessageText?: string | null;
  updatedAt?: string | null;
  createdAt?: string | null;
  avatarUrl?: string | null;
  avatarFileId?: string | null;
}

export interface ForwardTarget {
  id: string;
  kind: ForwardTargetKind;
  userId?: string | null;
  conversationId?: string | null;
  displayName: string;
  username?: string | null;
  avatar?: string | null;
  relationship?: string | null;
  isFavorite?: boolean;
  isBlocked?: boolean;
  participantCount?: number;
  lastMessageAt?: string | null;
  lastMessageText?: string | null;
  sourceApps: KylrixApp[];
  searchableTerms: string[];
}

export interface ForwardMessageRequest {
  conversationId: string;
  senderId: string;
  content: string;
  type?: 'text' | 'image' | 'video' | 'audio' | 'file' | 'call_signal' | 'system' | 'attachment';
  attachments?: string[];
  replyTo?: string;
  metadata?: Record<string, unknown> | null;
  permissionSyncAuth?: { jwt?: string; cookie?: string };
}

export interface ForwardConversationCreator {
  participantIds: string[];
  type?: 'direct' | 'group';
  name?: string;
}

export interface ForwardSource {
  listConversations(userId: string): Promise<ForwardConversation[]>;
  listContacts(userId: string): Promise<ForwardContact[]>;
  resolveProfiles(userIds: string[]): Promise<ForwardProfile[]>;
  searchProfiles?(query: string, limit?: number): Promise<ForwardProfile[]>;
  createConversation?(input: ForwardConversationCreator): Promise<{ $id: string } | null>;
  sendMessage?(request: ForwardMessageRequest): Promise<any>;
}

export interface ForwardSecurityGate {
  status: { isUnlocked: boolean };
  getMasterKey(): CryptoKey | null;
}

export interface ForwardDirectoryOptions {
  query?: string;
  limit?: number;
  includeGroups?: boolean;
  includeContactsOnly?: boolean;
}

export interface ForwardDirectoryDeps {
  source: ForwardSource;
  security?: ForwardSecurityGate | null;
  sourceApp?: KylrixApp;
}

const normalizeText = (value: unknown) =>
  String(value || '')
    .trim()
    .toLowerCase();

const uniqueStrings = (values: Array<string | null | undefined>) =>
  Array.from(new Set(values.map((value) => String(value || '').trim()).filter(Boolean)));

const buildSearchableTerms = (...values: Array<string | null | undefined>) =>
  uniqueStrings(values.map((value) => normalizeText(value)).filter(Boolean));

const sortForwardTargets = (targets: ForwardTarget[]) =>
  [...targets].sort((left, right) => {
    const leftScore = (left.isFavorite ? 3 : 0) + (left.lastMessageAt ? 2 : 0) + (left.kind === 'conversation' ? 1 : 0);
    const rightScore = (right.isFavorite ? 3 : 0) + (right.lastMessageAt ? 2 : 0) + (right.kind === 'conversation' ? 1 : 0);
    if (leftScore !== rightScore) return rightScore - leftScore;
    return normalizeText(left.displayName).localeCompare(normalizeText(right.displayName));
  });

const matchesQuery = (target: ForwardTarget, query: string) => {
  const needle = normalizeText(query);
  if (!needle) return true;
  return target.searchableTerms.some((term) => term.includes(needle));
};

const getConversationLabel = (conversation: ForwardConversation, fallback: string) =>
  String(conversation.name || conversation.title || fallback || 'Conversation').trim() || 'Conversation';

const pickConversationAvatar = (conversation: ForwardConversation) =>
  conversation.avatarUrl || conversation.avatarFileId || null;

export function isMasterpassRequired(security?: ForwardSecurityGate | null) {
  if (!security) return false;
  return !security.status.isUnlocked || !security.getMasterKey();
}

export function createForwardSecurityGate(security?: ForwardSecurityGate | null) {
  return {
    isUnlocked: () => Boolean(security?.status.isUnlocked && security.getMasterKey()),
    isLocked: () => isMasterpassRequired(security),
    assertUnlocked() {
      if (isMasterpassRequired(security)) {
        throw new Error('MASTERPASS_LOCKED');
      }
    },
  };
}

export function mergeForwardTargets(
  currentUserId: string,
  conversations: ForwardConversation[],
  contacts: ForwardContact[],
  profiles: ForwardProfile[] = [],
  options: ForwardDirectoryOptions = {},
  sourceApp: KylrixApp = 'connect'
) {
  const profileMap = new Map(profiles.map((profile) => [profile.userId, profile]));
  const contactMap = new Map(contacts.map((contact) => [contact.contactUserId, contact]));
  const targetsByKey = new Map<string, ForwardTarget>();
  const includeGroups = options.includeGroups ?? true;
  const includeContactsOnly = options.includeContactsOnly ?? true;

  for (const conversation of conversations || []) {
    const participants = uniqueStrings(Array.isArray(conversation.participants) ? conversation.participants : []).filter((id) => id !== currentUserId);
    const isGroup = String(conversation.type || '').toLowerCase() === 'group' || participants.length > 1;

    if (isGroup) {
      if (!includeGroups) continue;

      const fallback = participants
        .map((participantId) => profileMap.get(participantId)?.displayName || profileMap.get(participantId)?.username || participantId)
        .filter(Boolean)
        .join(', ');

      const label = getConversationLabel(conversation, fallback);
      const key = `conversation:${conversation.$id}`;
      const existing = targetsByKey.get(key);
      const target: ForwardTarget = {
        id: existing?.id || key,
        kind: 'conversation',
        conversationId: conversation.$id,
        displayName: existing?.displayName || label,
        username: existing?.username || null,
        avatar: existing?.avatar || participants.map((participantId) => profileMap.get(participantId)?.avatar).find(Boolean) || pickConversationAvatar(conversation),
        participantCount: conversation.participantCount || participants.length || existing?.participantCount || 0,
        lastMessageAt: conversation.lastMessageAt || conversation.updatedAt || conversation.createdAt || existing?.lastMessageAt || null,
        lastMessageText: conversation.lastMessageText || existing?.lastMessageText || null,
        sourceApps: uniqueStrings([...(existing?.sourceApps || []), sourceApp]) as KylrixApp[],
        searchableTerms: buildSearchableTerms(
          label,
          conversation.lastMessageText,
          conversation.name,
          conversation.title,
          ...participants.map((id) => profileMap.get(id)?.username || profileMap.get(id)?.displayName || id)
        ),
      };

      targetsByKey.set(key, target);
      continue;
    }

    for (const participantId of participants) {
      const profile = profileMap.get(participantId);
      const contact = contactMap.get(participantId) || null;
      const key = `person:${participantId}`;
      const existing = targetsByKey.get(key);
      const displayName = profile?.displayName || profile?.username || contact?.nickname || participantId;
      const username = profile?.username || null;
      const avatar = profile?.avatar || existing?.avatar || null;
      const lastMessageAt = conversation.lastMessageAt || conversation.updatedAt || conversation.createdAt || existing?.lastMessageAt || null;
      const lastMessageText = conversation.lastMessageText || existing?.lastMessageText || null;
      const target: ForwardTarget = {
        id: existing?.id || key,
        kind: 'person',
        userId: participantId,
        conversationId: existing?.conversationId || conversation.$id || null,
        displayName: existing?.displayName || displayName,
        username: existing?.username || username,
        avatar,
        relationship: contact?.relationship || existing?.relationship || null,
        isFavorite: Boolean(contact?.isFavorite || existing?.isFavorite),
        isBlocked: Boolean(contact?.isBlocked || existing?.isBlocked),
        participantCount: 2,
        lastMessageAt,
        lastMessageText,
        sourceApps: uniqueStrings([...(existing?.sourceApps || []), sourceApp]) as KylrixApp[],
        searchableTerms: buildSearchableTerms(
          displayName,
          username,
          contact?.nickname,
          contact?.notes,
          lastMessageText,
          ...(contact?.tags || []),
        ),
      };

      if (contact?.isBlocked) {
        target.searchableTerms.push('blocked');
      }

      targetsByKey.set(key, target);
    }
  }

  if (includeContactsOnly) {
    for (const contact of contacts || []) {
      const participantId = contact.contactUserId;
      const key = `person:${participantId}`;
      const existing = targetsByKey.get(key);
      const profile = profileMap.get(participantId);
      if (existing) {
        existing.relationship = existing.relationship || contact.relationship || null;
        existing.isFavorite = Boolean(existing.isFavorite || contact.isFavorite);
        existing.isBlocked = Boolean(existing.isBlocked || contact.isBlocked);
        if (!existing.avatar && profile?.avatar) {
          existing.avatar = profile.avatar;
        }
        if ((!existing.username || existing.displayName === existing.userId) && profile?.username) {
          existing.username = profile.username;
        }
        if ((!existing.displayName || existing.displayName === existing.userId) && profile?.displayName) {
          existing.displayName = profile.displayName;
        }
        existing.searchableTerms = uniqueStrings([
          ...existing.searchableTerms,
          normalizeText(contact.nickname),
          normalizeText(contact.notes),
          ...(contact.tags || []).map((tag) => normalizeText(tag)),
        ]);
        continue;
      }

      const displayName = profile?.displayName || profile?.username || contact.nickname || participantId;
      targetsByKey.set(key, {
        id: key,
        kind: 'person',
        userId: participantId,
        conversationId: null,
        displayName,
        username: profile?.username || null,
        avatar: profile?.avatar || null,
        relationship: contact.relationship || null,
        isFavorite: Boolean(contact.isFavorite),
        isBlocked: Boolean(contact.isBlocked),
        participantCount: 1,
        lastMessageAt: null,
        lastMessageText: null,
        sourceApps: [sourceApp],
        searchableTerms: buildSearchableTerms(displayName, profile?.username, contact.nickname, contact.notes, ...(contact.tags || [])),
      });
    }
  }

  const targets = sortForwardTargets([...targetsByKey.values()]);
  const filtered = options.query ? targets.filter((target) => matchesQuery(target, options.query || '')) : targets;
  return typeof options.limit === 'number' ? filtered.slice(0, options.limit) : filtered;
}

export function createForwardDirectory(deps: ForwardDirectoryDeps) {
  const gate = createForwardSecurityGate(deps.security);

  const service = {
    isMasterpassRequired: () => gate.isLocked(),

    async listForwardTargets(currentUserId: string, options: ForwardDirectoryOptions = {}) {
      const [conversations, contacts] = await Promise.all([
        deps.source.listConversations(currentUserId),
        deps.source.listContacts(currentUserId),
      ]);

      const profileIds = uniqueStrings([
        ...conversations.flatMap((conversation) => Array.isArray(conversation.participants) ? conversation.participants : []),
        ...contacts.map((contact) => contact.contactUserId),
      ]).filter((userId) => userId !== currentUserId);

      const profiles = profileIds.length > 0 ? await deps.source.resolveProfiles(profileIds) : [];
      return mergeForwardTargets(currentUserId, conversations, contacts, profiles, options, deps.sourceApp || 'connect');
    },

    async searchForwardTargets(currentUserId: string, query: string, options: Omit<ForwardDirectoryOptions, 'query'> = {}) {
      const targets = await service.listForwardTargets(currentUserId, { ...options, query });
      if (targets.length > 0 || !deps.source.searchProfiles) {
        return targets;
      }

      const fallbackProfiles = await deps.source.searchProfiles(query, options.limit || 10);
      return fallbackProfiles.map((profile) => ({
        id: `person:${profile.userId}`,
        kind: 'person' as const,
        userId: profile.userId,
        conversationId: null,
        displayName: profile.displayName || profile.username || profile.userId,
        username: profile.username || null,
        avatar: profile.avatar || null,
        relationship: null,
        isFavorite: false,
        isBlocked: false,
        participantCount: 1,
        lastMessageAt: null,
        lastMessageText: null,
        sourceApps: [deps.sourceApp || 'connect'],
        searchableTerms: buildSearchableTerms(profile.displayName, profile.username, profile.email),
      }));
    },

    async ensureConversationForTarget(currentUserId: string, target: ForwardTarget) {
      if (target.conversationId) {
        return target.conversationId;
      }

      if (!target.userId) {
        throw new Error('FORWARD_TARGET_REQUIRES_CONVERSATION');
      }

      if (!deps.source.createConversation) {
        throw new Error('CREATE_CONVERSATION_NOT_AVAILABLE');
      }

      const conversation = await deps.source.createConversation({
        participantIds: [currentUserId, target.userId],
        type: 'direct',
      });

      if (!conversation?.$id) {
        throw new Error('FAILED_TO_CREATE_FORWARD_CONVERSATION');
      }

      return conversation.$id;
    },

    buildForwardMessageRequest(
      currentUserId: string,
      target: ForwardTarget,
      payload: {
        content: string;
        type?: ForwardMessageRequest['type'];
        attachments?: string[];
        replyTo?: string;
        metadata?: Record<string, unknown> | null;
        sourceApp?: KylrixApp;
        sourceResourceId?: string;
        sourceResourceType?: string;
        permissionSyncAuth?: ForwardMessageRequest['permissionSyncAuth'];
      }
    ): ForwardMessageRequest {
      const metadata = {
        forwarded: true,
        forwardedFromApp: payload.sourceApp || deps.sourceApp || 'connect',
        forwardedFromResourceId: payload.sourceResourceId || null,
        forwardedFromResourceType: payload.sourceResourceType || null,
        forwardedTargetId: target.id,
        forwardedTargetKind: target.kind,
        ...(payload.metadata || {}),
      };

      return {
        conversationId: target.conversationId || '',
        senderId: currentUserId,
        content: payload.content,
        type: payload.type || 'attachment',
        attachments: payload.attachments || [],
        replyTo: payload.replyTo,
        metadata,
        permissionSyncAuth: payload.permissionSyncAuth,
      };
    },

    async forwardToTarget(
      currentUserId: string,
      target: ForwardTarget,
      payload: {
        content: string;
        type?: ForwardMessageRequest['type'];
        attachments?: string[];
        replyTo?: string;
        metadata?: Record<string, unknown> | null;
        sourceApp?: KylrixApp;
        sourceResourceId?: string;
        sourceResourceType?: string;
        permissionSyncAuth?: ForwardMessageRequest['permissionSyncAuth'];
      }
    ) {
      gate.assertUnlocked();

      if (!deps.source.sendMessage) {
        throw new Error('SEND_MESSAGE_NOT_AVAILABLE');
      }

      const conversationId = await service.ensureConversationForTarget(currentUserId, target);
      const request = service.buildForwardMessageRequest(currentUserId, { ...target, conversationId }, payload);
      return await deps.source.sendMessage({
        ...request,
        conversationId,
      });
    },
  };

  return service;
}

export interface AppwriteForwardSourceConfig {
  databaseId: string;
  conversationsTableId: string;
  conversationMembersTableId: string;
  contactsTableId: string;
  profilesTableId: string;
}

export interface AppwriteForwardSourceClient {
  listRows(databaseId: string, tableId: string, queries?: string[]): Promise<{ rows: any[] }>;
}

export function createAppwriteForwardSource(client: AppwriteForwardSourceClient, config: AppwriteForwardSourceConfig) {
  return {
    async listConversations(userId: string) {
      const membershipRows = await client.listRows(config.databaseId, config.conversationMembersTableId, [
        Query.equal('userId', userId),
        Query.limit(1000),
      ]).catch(() => ({ rows: [] as any[] }));

      const conversationIds = uniqueStrings((membershipRows.rows || []).map((row: any) => row.conversationId));
      if (conversationIds.length === 0) {
        const legacy = await client.listRows(config.databaseId, config.conversationsTableId, [
          Query.contains('participants', userId),
          Query.limit(100),
        ]).catch(() => ({ rows: [] as any[] }));
        return legacy.rows || [];
      }

      const conversationsResult = await client.listRows(config.databaseId, config.conversationsTableId, [
        Query.equal('$id', conversationIds),
        Query.limit(conversationIds.length),
      ]).catch(() => ({ rows: [] as any[] }));

      const allMembers = await client.listRows(config.databaseId, config.conversationMembersTableId, [
        Query.equal('conversationId', conversationIds),
        Query.limit(Math.min(1000, conversationIds.length * 10)),
      ]).catch(() => ({ rows: [] as any[] }));

      const memberRowsByConversation = new Map<string, string[]>();
      for (const row of allMembers.rows || []) {
        if (!row?.conversationId || !row?.userId) continue;
        const existing = memberRowsByConversation.get(row.conversationId) || [];
        if (!existing.includes(row.userId)) existing.push(row.userId);
        memberRowsByConversation.set(row.conversationId, existing);
      }

      return (conversationsResult.rows || []).map((conversation: any) => ({
        ...conversation,
        participants: memberRowsByConversation.get(conversation.$id) || conversation.participants || [],
      }));
    },

    async listContacts(userId: string) {
      const contactsResult = await client.listRows(config.databaseId, config.contactsTableId, [
        Query.equal('userId', userId),
        Query.limit(1000),
      ]).catch(() => ({ rows: [] as any[] }));

      return contactsResult.rows || [];
    },

    async resolveProfiles(userIds: string[]) {
      if (!userIds.length) return [];
      const profileRows = await client.listRows(config.databaseId, config.profilesTableId, [
        Query.equal('userId', userIds),
        Query.limit(userIds.length),
      ]).catch(() => ({ rows: [] as any[] }));

      return (profileRows.rows || []).map((profile: any) => ({
        userId: profile.userId || profile.$id,
        username: profile.username || null,
        displayName: profile.displayName || profile.name || profile.username || profile.userId || null,
        avatar: profile.avatar || profile.avatarUrl || profile.avatarFileId || null,
        publicKey: profile.publicKey || null,
        email: profile.email || null,
      }));
    },

    async searchProfiles(query: string, limit = 10) {
      const cleaned = normalizeText(query);
      if (!cleaned) return [];

      const [byUsername, byDisplayName] = await Promise.all([
        client.listRows(config.databaseId, config.profilesTableId, [
          Query.search('username', cleaned),
          Query.limit(limit),
        ]).catch(() => ({ rows: [] as any[] })),
        client.listRows(config.databaseId, config.profilesTableId, [
          Query.search('displayName', cleaned),
          Query.limit(limit),
        ]).catch(() => ({ rows: [] as any[] })),
      ]);

      const rowsByUserId = new Map<string, any>();
      for (const profile of [...(byUsername.rows || []), ...(byDisplayName.rows || [])]) {
        const userId = profile.userId || profile.$id;
        if (!userId || rowsByUserId.has(userId)) continue;
        rowsByUserId.set(userId, profile);
      }

      return Array.from(rowsByUserId.values()).map((profile: any) => ({
        userId: profile.userId || profile.$id,
        username: profile.username || null,
        displayName: profile.displayName || profile.name || profile.username || profile.userId || null,
        avatar: profile.avatar || profile.avatarUrl || profile.avatarFileId || null,
        publicKey: profile.publicKey || null,
        email: profile.email || null,
      }));
    },
  };
}

export function buildForwardTargetSearchIndex(targets: ForwardTarget[]) {
  return targets.map((target) => ({
    ...target,
    searchableText: target.searchableTerms.join(' '),
  }));
}

