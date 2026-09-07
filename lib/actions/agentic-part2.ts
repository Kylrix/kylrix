'use server';

import { ID, Query } from 'node-appwrite';

import { createSystemClient } from '@/lib/appwrite-admin';
import { createServerClient } from '@/lib/appwrite/server';
import { userHasPaidAiAccess } from '@/lib/server/ai-subscription-gate';
import { AI_REQUIRES_PRO_MESSAGE } from '@/lib/agentic/access';
import { resolveAgenticError, type AgenticErrorCode } from '@/lib/agentic/errors';





import { getActor } from './secure-ops';

// ... (rest of imports)

async function requireUser(jwt?: string) {
  const actor = await getActor(jwt);
  if (!actor?.$id) throw new Error('Unauthorized');
  return actor;
}

async function checkComputeBalance(userId: string) {
  const hasAccess = await userHasPaidAiAccess(userId);
  if (!hasAccess) {
    throw new Error(AI_REQUIRES_PRO_MESSAGE);
  }

  const { databases } = createSystemClient();
  const res = await databases.listRows(
    'passwordManagerDb',
    'compute_balances',
    [Query.equal('userId', userId), Query.limit(1)]
  );

  let balanceRow: any = null;
  if (res.rows.length === 0) {
    balanceRow = await databases.createRow(
      'passwordManagerDb',
      'compute_balances',
      ID.unique(),
      {
        userId,
        tier: 'pro',
        balance: 100000,
        lastResetAt: new Date().toISOString()
      }
    );
  } else {
    balanceRow = res.rows[0];
  }

  if (balanceRow.balance <= 0) {
    throw new Error('You have exceeded your dynamic compute token allocation.');
  }
  return balanceRow;
}

async function debitComputeBalance(userId: string, balanceRow: any, promptText: string, completionText: string) {
  const { databases } = createSystemClient();
  const promptLength = promptText.length || 0;
  const estimatedPromptTokens = Math.ceil(promptLength / 4) + 120;
  const estimatedCompletionTokens = Math.ceil(completionText.length / 4);
  const totalTokens = estimatedPromptTokens + estimatedCompletionTokens;

  const newBalance = Math.max(0, balanceRow.balance - totalTokens);
  await databases.updateRow(
    'passwordManagerDb',
    'compute_balances',
    balanceRow.$id,
    { balance: newBalance }
  );

  await databases.createRow(
    'passwordManagerDb',
    'compute_ledger',
    ID.unique(),
    {
      userId,
      tokensConsumed: totalTokens,
      timestamp: new Date().toISOString()
    }
  );
}




export async function toggleAgentConversationShareAction(
  params: {
    sessionId: string;
    messageId: string;
    mode: 'publish' | 'make_private';
  },
  jwt?: string) {
  const user = await requireUser(jwt);
  const { createSystemTablesDB } = await import('@/lib/appwrite-admin');
  const tables = createSystemTablesDB();

  const row = await tables.getRow({
    databaseId: 'passwordManagerDb',
    tableId: 'agentic_sessions',
    rowId: params.sessionId});
  if (row.userId !== user.$id) throw new Error('Unauthorized');

  let historyArr: any[] = [];
  try {
    historyArr = JSON.parse(row.chatHistory || '[]');
  } catch {
    historyArr = [];
  }

  const enable = params.mode === 'publish';
  let found = false;
  const next = historyArr.map((m: any) => {
    if (m.id !== params.messageId) return m;
    found = true;
    return {
      ...m,
      isPublic: enable,
      isGuest: enable};
  });
  if (!found) throw new Error('Message not found in session');

  await tables.updateRow({
    databaseId: 'passwordManagerDb',
    tableId: 'agentic_sessions',
    rowId: params.sessionId,
    data: {
      chatHistory: JSON.stringify(next),
      isPublic: row.isPublic,
      isGuest: row.isGuest}});

  const { buildPublicResourceUrl } = await import('@/lib/share/public-url');
  return {
    success: true,
    isPublic: enable,
    isGuest: enable,
    publicUrl: buildPublicResourceUrl(
      'agent_conversation',
      `${params.sessionId}__${params.messageId}`)};
}

function sanitizePublicChatMessage(m: any) {
  return {
    id: String(m?.id || ''),
    role: m?.role === 'assistant' ? ('assistant' as const) : ('user' as const),
    content: String(m?.content || ''),
    isPublic: m?.isPublic === true,
    isGuest: m?.isGuest === true};
}

function parseSessionChatHistory(raw: unknown): any[] {
  try {
    const parsed = typeof raw === 'string' ? JSON.parse(raw || '[]') : raw;
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

export async function getPublicAgentSessionSecure(sessionId: string) {
  if (!sessionId) return null;
  const { createSystemTablesDB } = await import('@/lib/appwrite-admin');
  const tables = createSystemTablesDB();
  const row = await tables
    .getRow({
      databaseId: 'passwordManagerDb',
      tableId: 'agentic_sessions',
      rowId: sessionId})
    .catch(() => null);

  if (!row || row.isMemory === true) return null;
  const isPublic = row.isPublic === true;
  const isGuest = row.isGuest === true;
  if (!isPublic && !isGuest) return null;

  const history = parseSessionChatHistory(row.chatHistory).map(sanitizePublicChatMessage);
  const firstUser = history.find((m) => m.role === 'user');
  const title = firstUser?.content
    ? String(firstUser.content).slice(0, 96)
    : 'Shared chat with Kylie';

  return JSON.parse(
    JSON.stringify({
      id: row.$id,
      title,
      messages: history,
      userId: row.userId || null,
      isPublic,
      isGuest,
      updatedAt: row.$updatedAt,
      createdAt: row.$createdAt}));
}

/**
 * Public read for a single shared message.
 * Composite id: `{sessionId}__{messageId}` (matches share URL builder).
 */
export async function getPublicAgentConversationSecure(compositeId: string) {
  if (!compositeId || !compositeId.includes('__')) return null;
  const sep = compositeId.indexOf('__');
  const sessionId = compositeId.slice(0, sep);
  const messageId = compositeId.slice(sep + 2);
  if (!sessionId || !messageId) return null;

  const { createSystemTablesDB } = await import('@/lib/appwrite-admin');
  const tables = createSystemTablesDB();
  const row = await tables
    .getRow({
      databaseId: 'passwordManagerDb',
      tableId: 'agentic_sessions',
      rowId: sessionId})
    .catch(() => null);

  if (!row || row.isMemory === true) return null;

  const sessionPublic = row.isPublic === true || row.isGuest === true;
  const history = parseSessionChatHistory(row.chatHistory);
  const message = history.find((m: any) => m?.id === messageId);
  if (!message) return null;

  const messagePublic = message.isPublic === true || message.isGuest === true;
  if (!sessionPublic && !messagePublic) return null;

  return JSON.parse(
    JSON.stringify({
      sessionId,
      message: sanitizePublicChatMessage(message),
      userId: row.userId || null,
      sessionIsPublic: sessionPublic,
      updatedAt: row.$updatedAt}));
}

export async function deleteAgentSession(sessionId: string, jwt?: string) {
  const user = await requireUser(jwt);
  const { createSystemTablesDB } = await import('@/lib/appwrite-admin');
  const tables = createSystemTablesDB();
  
  const row = await tables.getRow({
    databaseId: 'passwordManagerDb',
    tableId: 'agentic_sessions',
    rowId: sessionId
  });
  if (row.userId !== user.$id) {
    throw new Error('Unauthorized');
  }

  // Cascade delete tool calls for this session
  try {
    const toolRows = await tables.listRows({
      databaseId: 'passwordManagerDb',
      tableId: 'tool_calls',
      queries: [Query.equal('sessionId', sessionId), Query.limit(500)]});
    for (const tr of toolRows.rows || []) {
      await tables.deleteRow({
        databaseId: 'passwordManagerDb',
        tableId: 'tool_calls',
        rowId: tr.$id}).catch(() => {});
    }
  } catch (e) {
    console.warn('[deleteAgentSession] tool_calls cascade failed:', e);
  }

  await tables.deleteRow({
    databaseId: 'passwordManagerDb',
    tableId: 'agentic_sessions',
    rowId: sessionId
  });

  const { account } = await createServerClient(jwt);
  const prefs = await account.getPrefs().catch(() => ({}));
  if ((prefs as any)?.activeAgentSessionId === sessionId) {
    const listRes = await tables.listRows({
      databaseId: 'passwordManagerDb',
      tableId: 'agentic_sessions',
      queries: [
        Query.equal('userId', user.$id),
        Query.notEqual('isMemory', true),
        Query.limit(1)
      ]
    });
    const nextSessionId = listRes.rows[0]?.$id || null;
    await account.updatePrefs({ ...prefs, activeAgentSessionId: nextSessionId }).catch(() => {});
  }

  return { success: true };
}

export async function selectAgentSession(sessionId: string, jwt?: string) {
  const user = await requireUser(jwt);
  const { createSystemTablesDB } = await import('@/lib/appwrite-admin');
  const tables = createSystemTablesDB();
  
  const row = await tables.getRow({
    databaseId: 'passwordManagerDb',
    tableId: 'agentic_sessions',
    rowId: sessionId
  });
  if (row.userId !== user.$id) {
    throw new Error('Unauthorized');
  }

  const { account } = await createServerClient(jwt);
  const prefs = await account.getPrefs().catch(() => ({}));
  await account.updatePrefs({ ...prefs, activeAgentSessionId: sessionId }).catch(() => {});

  return {
    success: true,
    session: {
      id: row.$id,
      context: row.context || '',
      chatHistory: row.chatHistory || '[]',
      isPublic: row.isPublic === true,
      isGuest: row.isGuest === true,
      isPinned: row.isPinned === true,
      createdAt: row.$createdAt,
      updatedAt: row.$updatedAt
    }
  };
}

/** Flag a single conversation turn for quality review (not the whole session). */
export async function flagAgentConversationPointAction(
  params: {
    conversationId: string;
    messageRole: 'user' | 'assistant';
    sessionId?: string;
    reason?: string;
  },
  jwt?: string) {
  const user = await requireUser(jwt);
  if (!params.conversationId) return { success: false };

  let sessionId = params.sessionId;
  if (!sessionId) {
    const session = await getAgentSession(jwt);
    sessionId = session.rowId || undefined;
  }

  const { TelemetryService } = await import('@/lib/services/telemetry');
  await TelemetryService.recordAgenticTelemetry({
    userId: user.$id,
    action: 'conversation_flagged',
    zone: 'intelligence',
    pointers: sessionId ? `${sessionId}:${params.conversationId}` : params.conversationId,
    metadata: {
      sessionId: sessionId || null,
      conversationId: params.conversationId,
      messageRole: params.messageRole,
      reason: params.reason || 'user_retry',
      flaggedAt: new Date().toISOString()}});

  return { success: true };
}
