import { ID, Query, Permission, Role } from 'appwrite';
import { account, databases, getCurrentUser } from './client';
import type {
  Notes,
  Tags,
  Comments,
  Reactions,
  Settings} from '@/types/appwrite';
import { TargetType } from '@/types/appwrite';
// Removed static import of secure-ops to prevent Next.js isomorphic bundling errors.

import { APPWRITE_CONFIG } from './config';
import { ecosystemSecurity } from '@/lib/ecosystem/security';
import { createNoteCreationService } from '@/sdk';
import { buildAutoTitleFromContent, clampNoteTitle } from '@/constants/noteTitle';
import { buildSourceNoteTags } from '@/sdk/crosslinks';
import { hasPaidKylrixPlan } from '@/lib/utils';
import { invalidateTablesDbRowCache } from '@/lib/ecosystem/tablesdb-row-cache';
import { publishNexusInvalidate } from '@/lib/ecosystem/nexus-bridge';
import { ownerRowPermissions } from '@/lib/appwrite/owner-acl';

export const activeNoteKeys = new Map<string, CryptoKey>();

// export app public uri

// NOTE database ID (internal, not exported to avoid conflict with vault's APPWRITE_DATABASE_ID)
export const APPWRITE_DATABASE_ID = APPWRITE_CONFIG.DATABASES.NOTE;

// Appwrite config IDs from constants
export const APPWRITE_TABLE_ID_NOTES = APPWRITE_CONFIG.TABLES.NOTE.NOTES;
export const APPWRITE_TABLE_ID_TAGS = APPWRITE_CONFIG.TABLES.NOTE.TAGS;
export const APPWRITE_TABLE_ID_COMMENTS = APPWRITE_CONFIG.TABLES.NOTE.COMMENTS;
export const APPWRITE_TABLE_ID_REACTIONS = APPWRITE_CONFIG.TABLES.NOTE.REACTIONS;
export const POLYMORPHIC_COLLABORATORS_TABLE = APPWRITE_CONFIG.TABLES.FLOW.COLLABORATORS || 'Collaborators';
