import { createServerClient } from '@/lib/appwrite/server';
import { ID, Permission, Role, Query } from 'node-appwrite';
import { createSystemClient, createSystemTablesDB } from '@/lib/appwrite-admin';
import { APPWRITE_CONFIG } from '@/lib/appwrite/config';
import { createHash } from 'node:crypto';
import { withSystemTransaction } from './transaction';

export const CHAT_DB_ID = APPWRITE_CONFIG.DATABASES.CHAT;
export const CONVERSATIONS_TABLE_ID = APPWRITE_CONFIG.TABLES.CHAT.CONVERSATIONS;
export const MESSAGES_TABLE_ID = APPWRITE_CONFIG.TABLES.CHAT.MESSAGES;
export const MESSAGE_REACTIONS_TABLE_ID = APPWRITE_CONFIG.TABLES.CHAT.MESSAGE_REACTIONS;
export const CONVERSATION_MEMBERS_TABLE_ID = 'conversationMembers';
export const KEY_MAPPING_TABLE_ID = 'key_mapping';
export const EPOCHS_TABLE_ID = 'epochs';

export function uniqueIds(ids: Array<string | null | undefined>) {
  return Array.from(new Set(ids.map((value: any) => String(value || '').trim()).filter(Boolean)));
}

export function buildMessagePermissions(senderId: string, recipientIds: string[]) {
  return [
    Permission.read(Role.user(senderId)),
    ...recipientIds.map((userId: any) => Permission.read(Role.user(userId)))];
}

export function buildReactionPermissions(userId: string, recipientIds: string[]) {
  return [
    Permission.read(Role.user(userId)),
    ...recipientIds.map((participantId: any) => Permission.read(Role.user(participantId)))];
}

export function isUniqueConstraintError(error: unknown): boolean {
  const err = error as { code?: number; message?: string; type?: string };
  const message = String(err?.message || err?.type || '').toLowerCase();
  return err?.code === 409 || message.includes('unique') || message.includes('duplicate') || message.includes('already exists');
}

