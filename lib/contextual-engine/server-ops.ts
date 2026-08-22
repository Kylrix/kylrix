'use server';

import { Query, Permission, Role, ID } from 'node-appwrite';
import { createSystemTablesDB } from '@/lib/appwrite-admin';
import { APPWRITE_CONFIG } from '@/lib/appwrite/config';
import { getActor } from '@/lib/actions/secure-ops/shared';
import { ContextObject, KnowledgeGraphEdge, PatternMatch } from './types';

const DB_ID = APPWRITE_CONFIG.DATABASES.PASSWORD_MANAGER || 'passwordManagerDb';
const TBL_CONTEXTS = APPWRITE_CONFIG.TABLES.CONTEXTS || 'contexts';
const TBL_GRAPH = APPWRITE_CONFIG.TABLES.KNOWLEDGE_GRAPH || 'knowledge_graph';
const TBL_PATTERNS = APPWRITE_CONFIG.TABLES.PATTERNS || 'patterns';

export async function saveContextSecure(data: Partial<ContextObject>, jwt?: string): Promise<any> {
  const actor = await getActor(jwt);
  if (!actor || !actor.$id) throw new Error('Unauthorized: Session expired');

  const tables = createSystemTablesDB();
  const contextId = data.id || ID.unique();
  const now = new Date().toISOString();

  const payload: any = {
    title: String(data.title || 'General Context').slice(0, 255),
    description: data.description ? String(data.description).slice(0, 4000) : undefined,
    niche: data.niche || 'workspace',
    scopeKey: data.scopeKey || `workspace:${data.workspaceId || actor.$id}`,
    workspaceId: data.workspaceId || actor.$id,
    userId: data.isAnonymized ? 'anonymized' : actor.$id,
    confidence: data.confidence ?? 1.0,
    weight: data.weight ?? 1.0,
    isAnonymized: !!data.isAnonymized,
    clarifications: data.clarifications ? JSON.stringify(data.clarifications) : undefined,
    metadata: data.metadata ? JSON.stringify(data.metadata) : undefined,
    createdAt: data.createdAt || now,
    updatedAt: now,
  };

  const perms = [Permission.read(Role.user(actor.$id))];
  if (data.isAnonymized) {
    perms.push(Permission.read(Role.any()));
  }

  try {
    const existing = await tables.getRow({
      databaseId: DB_ID,
      tableId: TBL_CONTEXTS,
      rowId: contextId,
    });
    if (existing) {
      delete payload.createdAt;
      delete payload.userId;
      const updated = await tables.updateRow({
        databaseId: DB_ID,
        tableId: TBL_CONTEXTS,
        rowId: contextId,
        data: payload,
      });
      return JSON.parse(JSON.stringify(updated));
    }
  } catch {}

  const created = await tables.createRow({
    databaseId: DB_ID,
    tableId: TBL_CONTEXTS,
    rowId: contextId,
    data: payload,
    permissions: perms,
  });

  return JSON.parse(JSON.stringify(created));
}

export async function listContextsSecure(workspaceId?: string, jwt?: string): Promise<ContextObject[]> {
  const actor = await getActor(jwt);
  if (!actor || !actor.$id) return [];

  const tables = createSystemTablesDB();
  const queries = [Query.equal('userId', actor.$id), Query.limit(50)];
  if (workspaceId) {
    queries.push(Query.equal('workspaceId', workspaceId));
  }

  try {
    const res = await tables.listRows({
      databaseId: DB_ID,
      tableId: TBL_CONTEXTS,
      queries: queries as any[],
    });

    return res.rows.map((row: any) => ({
      id: row.$id,
      title: row.title,
      description: row.description,
      niche: row.niche,
      scopeKey: row.scopeKey,
      workspaceId: row.workspaceId,
      userId: row.userId,
      confidence: row.confidence ?? 1.0,
      weight: row.weight ?? 1.0,
      isAnonymized: row.isAnonymized === true,
      clarifications: row.clarifications ? JSON.parse(row.clarifications) : [],
      metadata: row.metadata ? JSON.parse(row.metadata) : {},
      createdAt: row.createdAt || row.$createdAt,
      updatedAt: row.updatedAt || row.$updatedAt,
    }));
  } catch {
    return [];
  }
}

export async function syncGraphEdgeSecure(edge: KnowledgeGraphEdge, jwt?: string): Promise<any> {
  const actor = await getActor(jwt);
  if (!actor || !actor.$id) throw new Error('Unauthorized');

  const tables = createSystemTablesDB();
  const edgeId = edge.id || ID.unique();
  const now = new Date().toISOString();

  const payload: any = {
    sourceId: edge.sourceId,
    sourceKind: edge.sourceKind,
    targetId: edge.targetId,
    targetKind: edge.targetKind,
    contextId: edge.contextId,
    userId: edge.isAnonymized ? undefined : actor.$id,
    relation: edge.relation,
    distance: edge.distance,
    weight: edge.weight,
    confidence: edge.confidence,
    version: edge.version || 1,
    isAnonymized: !!edge.isAnonymized,
    metadata: edge.metadata ? JSON.stringify(edge.metadata) : undefined,
    createdAt: edge.createdAt || now,
    updatedAt: now,
  };

  const perms = [Permission.read(Role.user(actor.$id))];
  if (edge.isAnonymized) perms.push(Permission.read(Role.any()));

  try {
    const created = await tables.createRow({
      databaseId: DB_ID,
      tableId: TBL_GRAPH,
      rowId: edgeId,
      data: payload,
      permissions: perms,
    });
    return JSON.parse(JSON.stringify(created));
  } catch {
    return null;
  }
}

export async function syncPatternSecure(pattern: PatternMatch, jwt?: string): Promise<any> {
  const actor = await getActor(jwt);
  if (!actor || !actor.$id) return null;

  const tables = createSystemTablesDB();
  const patternId = pattern.id || ID.unique();
  const now = new Date().toISOString();

  const payload: any = {
    patternKey: pattern.patternKey.slice(0, 191),
    patternType: pattern.patternType,
    ngram: pattern.ngram ? pattern.ngram.slice(0, 255) : undefined,
    completion: pattern.completion.slice(0, 2000),
    niche: pattern.niche || 'workspace',
    userId: pattern.isAnonymized ? undefined : actor.$id,
    frequency: pattern.frequency || 1,
    confidence: pattern.confidence,
    weight: pattern.weight,
    isAnonymized: !!pattern.isAnonymized,
    metadata: pattern.metadata ? JSON.stringify(pattern.metadata) : undefined,
    createdAt: pattern.createdAt || now,
    updatedAt: now,
  };

  const perms = [Permission.read(Role.user(actor.$id))];
  if (pattern.isAnonymized) perms.push(Permission.read(Role.any()));

  try {
    const created = await tables.createRow({
      databaseId: DB_ID,
      tableId: TBL_PATTERNS,
      rowId: patternId,
      data: payload,
      permissions: perms,
    });
    return JSON.parse(JSON.stringify(created));
  } catch {
    return null;
  }
}
