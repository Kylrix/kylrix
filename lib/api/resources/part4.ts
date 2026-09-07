import { ID, Permission, Query, Role } from 'node-appwrite';
import { systemTables, type SystemTablesPort } from '@/lib/data';
import { APPWRITE_CONFIG } from '@/lib/appwrite/config';
import type { ApiActor } from '@/lib/api/guard';
import { requireScope } from '@/lib/api/guard';
import { resolveParentRef } from '@/lib/api/v1/query';
import { listScopeCatalog, type PatScope } from '@/lib/api/scopes';
import { PatService } from '@/lib/services/pats';
import { clampNoteTitle } from '@/constants/noteTitle';
import {
import { WorkflowDbService } from '@/lib/services/workflows';
import {
import {
import {
import { ownedWorkspaceListQueries, subProjectsListQueries } from '@/lib/projects/workspace-queries';
import { assertActorFeatureAccess } from '@/lib/tools/gate';
import {
  DB,
  NOTES,
  FLOW_DB,
  TASKS,
  WORKFLOWS,
  badRequest,
  notFound,
  forbidden,
  assertOwnedNote,
  assertOwnedGoal,
  CHAT_DB,
  PROJECT_OBJECTS,
  linkObjectToWorkspace,
  unlinkObjectFromWorkspace,
  TAGS_TABLE,
  ensureTagsExist,
  getWorkspaceObjectIds,
  getAllLinkedWorkspaceObjectIds,
  resolveWorkspaceMekBytes,
} from './helpers';

export const apiResourcesPart4 = {
  async listMoments(actor: ApiActor, limit = 25, opts?: { mine?: boolean }) {
    requireScope(actor, 'moments:read');
    const tables = systemTables();
    const momentsTable = APPWRITE_CONFIG.TABLES.CONNECT.MOMENTS || 'moments';
    const queries: any[] = [
      Query.orderDesc('$createdAt'),
      Query.limit(Math.min(100, Math.max(1, limit))),
    ];
    if (opts?.mine) {
      queries.unshift(Query.equal('userId', actor.userId));
    } else {
      // Public feed posts (exclude reply noise when possible)
      queries.unshift(Query.equal('isPublic', true));
    }
    const res = await tables.listRows({
      databaseId: APPWRITE_CONFIG.DATABASES.CONNECT,
      tableId: momentsTable,
      queries,
    });
    return res.rows
      .filter((r: any) => {
        if (opts?.mine) return true;
        const kind = String(r.momentKind || '').toLowerCase();
        return !kind || kind === 'post' || kind === 'quote' || kind === 'pulse';
      })
      .map((r: any) => shapeMoment(r));
  },

  async deriveAgentSovereignCrypto(customMnemonic?: string) {
    const bip39 = await import('@scure/bip39');
    const { wordlist } = await import('@scure/bip39/wordlists/english.js');
    const { HDKey } = await import('@scure/bip32');
    const secp256k1 = await import('@noble/secp256k1');
    const ed25519 = await import('@noble/ed25519');
    const { sha512 } = await import('@noble/hashes/sha2.js');
    const { base58, bech32 } = await import('@scure/base');
    const { keccak_256 } = await import('@noble/hashes/sha3.js');
    const { ripemd160: hash160 } = await import('@noble/hashes/legacy.js');
    const { blake2b } = await import('@noble/hashes/blake2.js');

    ed25519.hashes.sha512 = (message: Uint8Array) => sha512(message);
    ed25519.hashes.sha512Async = (message: Uint8Array) => Promise.resolve(sha512(message));

    const mnemonic = customMnemonic || bip39.generateMnemonic(wordlist, 128);
    const seed = await bip39.mnemonicToSeed(mnemonic);
    const rootKey = HDKey.fromMasterSeed(seed);

    // 1. EVM (m/44'/60'/0'/0/0)
    const evmChild = rootKey.derive("m/44'/60'/0'/0/0");
    if (!evmChild.privateKey) throw new Error('Failed to derive EVM key');
    const evmPub = secp256k1.getPublicKey(evmChild.privateKey, false).slice(1);
    const evmHash = keccak_256(evmPub);
    const ethAddress = '0x' + Array.from(evmHash.slice(-20)).map((b) => b.toString(16).padStart(2, '0')).join('').toLowerCase();

    // 2. Solana (m/44'/501'/0'/0')
    const solChild = rootKey.derive("m/44'/501'/0'/0'");
    if (!solChild.privateKey) throw new Error('Failed to derive Solana key');
    const solPub = await ed25519.getPublicKey(solChild.privateKey);
    const solAddress = base58.encode(solPub);

    // 3. Bitcoin (m/84'/0'/0'/0/0 Native SegWit P2WPKH)
    const btcChild = rootKey.derive("m/84'/0'/0'/0/0");
    if (!btcChild.publicKey) throw new Error('Failed to derive Bitcoin key');
    const pkh = hash160(btcChild.publicKey);
    const btcWords = bech32.toWords(pkh);
    const btcAddress = bech32.encode('bc', [0, ...btcWords]);

    // 4. Sui (m/44'/784'/0'/0'/0')
    const suiChild = rootKey.derive("m/44'/784'/0'/0'/0'");
    if (!suiChild.privateKey) throw new Error('Failed to derive Sui key');
    const suiPub = await ed25519.getPublicKey(suiChild.privateKey);
    const tmp = new Uint8Array(33);
    tmp.set([0x00]);
    tmp.set(suiPub, 1);
    const suiHash = blake2b(tmp, { dkLen: 32 });
    const suiAddress = '0x' + Array.from(suiHash).map((b) => b.toString(16).padStart(2, '0')).join('').slice(0, 64);

    // 5. Nostr keypair
    const nostrPriv = evmChild.privateKey;
    const nostrPubRaw = secp256k1.getPublicKey(nostrPriv, true).slice(1);
    const nostrPubkeyHex = Array.from(nostrPubRaw).map((b) => b.toString(16).padStart(2, '0')).join('');
    const nostrWords = bech32.toWords(nostrPubRaw);
    const nostrNpub = bech32.encode('npub', nostrWords);
    const nostrNsec = bech32.encode('nsec', bech32.toWords(nostrPriv));

    // 6. 32-byte MEK Hex
    const mekHex = Array.from(nostrPriv).map((b) => b.toString(16).padStart(2, '0')).join('');

    // 7. Multi-chain Wallet JSON map matching Kylrix standard
    const walletMap = {
      sol: solAddress,
      eth: ethAddress,
      btc: btcAddress,
      sui: suiAddress,
      base: ethAddress,
      polygon: ethAddress,
      arbitrum: ethAddress,
    };

    const walletAddressJson = JSON.stringify({
      sol: solAddress,
      eth: ethAddress,
      btc: btcAddress,
      sui: suiAddress,
    });

    return {
      mnemonic,
      walletAddressJson,
      walletMap,
      ethAddress,
      solAddress,
      btcAddress,
      suiAddress,
      nostrNpub,
      nostrNsec,
      nostrPubkeyHex,
      mekHex,
    };
  },

  async listFeed(
    actor: ApiActor,
    limit = 25,
    opts?: { source?: 'ecosystem' | 'nostr' | 'all' },
  ) {
    requireScope(actor, 'moments:read');
    const source = opts?.source || 'all';
    const lim = Math.min(50, Math.max(1, limit));
    const items: any[] = [];

    if (source === 'ecosystem' || source === 'all') {
      const eco = await this.listMoments(actor, lim, { mine: false });
      items.push(...eco.map((m: any) => ({ ...m, feedSource: 'ecosystem' })));
    }

    if (source === 'nostr' || source === 'all') {
      try {
        const { fetchNostrFeed } = await import('@/lib/nostr/server-query');
        const events = await fetchNostrFeed(lim);
        for (const e of events) {
          items.push({
            id: `nostr_${e.id}`,
            source: 'nostr',
            feedSource: 'nostr',
            content: e.content || '',
            caption: e.content || '',
            pubkey: e.pubkey,
            createdAt: new Date(e.created_at * 1000).toISOString(),
            momentKind: 'post',
            isPublic: true,
          });
        }
      } catch (e) {
        console.warn('[ApiResources.listFeed] nostr feed failed', e);
      }
    }

    items.sort(
      (a, b) =>
        new Date(b.createdAt || 0).getTime() - new Date(a.createdAt || 0).getTime(),
    );
    return items.slice(0, lim);
  },

  async getMoment(actor: ApiActor, rawId: string) {
    requireScope(actor, 'moments:read');
    const { parseMomentRouteId } = await import('@/lib/connect/moment-engagement');
    const { source, id } = parseMomentRouteId(rawId);

    if (source === 'nostr') {
      const { fetchNostrEventById, fetchNostrReplies } = await import(
        '@/lib/nostr/server-query'
      );
      const [event, eng] = await Promise.all([
        fetchNostrEventById(id),
        fetchNostrReplies(id),
      ]);
      if (!event) return notFound('Moment not found');
      return {
        id: `nostr_${event.id}`,
        source: 'nostr' as const,
        content: event.content || '',
        caption: event.content || '',
        pubkey: event.pubkey,
        createdAt: new Date(event.created_at * 1000).toISOString(),
        momentKind: 'post',
        isPublic: true,
        stats: {
          likes: eng.likeCount,
          replies: eng.replies.length,
        },
        canCommentViaApi: false,
      };
    }

    const tables = systemTables();
    const row = (await tables
      .getRow({
        databaseId: APPWRITE_CONFIG.DATABASES.CONNECT,
        tableId: APPWRITE_CONFIG.TABLES.CONNECT.MOMENTS || 'moments',
        rowId: id,
      })
      .catch(() => null)) as any;
    if (!row) notFound('Moment not found');
    // Public moments OR own
    if (!row.isPublic && row.userId !== actor.userId) notFound('Moment not found');
    return { ...shapeMoment(row), canCommentViaApi: true };
  },

  async listMomentComments(actor: ApiActor, rawId: string, limit = 50) {
    requireScope(actor, 'moments:read');
    const { parseMomentRouteId } = await import('@/lib/connect/moment-engagement');
    const { source, id } = parseMomentRouteId(rawId);
    const lim = Math.min(100, Math.max(1, limit));

    if (source === 'nostr') {
      const { fetchNostrReplies } = await import('@/lib/nostr/server-query');
      const eng = await fetchNostrReplies(id);
      return eng.replies.slice(0, lim).map((e) => shapeMomentCommentNostr(e));
    }

    await this.getMoment(actor, id);
    const tables = systemTables();
    const res = await tables.listRows({
      databaseId: APPWRITE_CONFIG.DATABASES.CONNECT,
      tableId: APPWRITE_CONFIG.TABLES.CONNECT.MOMENTS || 'moments',
      queries: [
        Query.equal('sourceId', id),
        Query.equal('momentKind', 'reply'),
        Query.orderDesc('$createdAt'),
        Query.limit(lim),
      ],
    });
    return res.rows.map((r: any) => shapeMomentCommentEcosystem(r));
  },

  async createMomentComment(actor: ApiActor, rawId: string, body: Record<string, unknown>) {
    requireScope(actor, 'moments:write');
    const { parseMomentRouteId } = await import('@/lib/connect/moment-engagement');
    const { source, id } = parseMomentRouteId(rawId);
    if (source === 'nostr') {
      const err = new Error(
        'Nostr comments need an unlocked vault key — use the app. Internal moments support PAT comments.',
      );
      (err as any).status = 400;
      (err as any).code = 'nostr_vault_required';
      throw err;
    }
    const content = String(body.content ?? body.text ?? body.caption ?? '').trim();
    if (!content) badRequest('content required');
    await this.getMoment(actor, id);

    const tables = systemTables();
    const now = new Date().toISOString();
    const metadata = JSON.stringify({ type: 'reply', sourceId: id });
    const row = await tables.createRow({
      databaseId: APPWRITE_CONFIG.DATABASES.CONNECT,
      tableId: APPWRITE_CONFIG.TABLES.CONNECT.MOMENTS || 'moments',
      rowId: ID.unique(),
      data: {
        userId: actor.userId,
        caption: content,
        type: 'image',
        momentKind: 'reply',
        sourceId: id,
        searchTitle: content.slice(0, 255),
        fileId: metadata,
        isPublic: true,
        isGuest: true,
        createdAt: now,
        expiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString(),
      },
      permissions: [
        Permission.read(Role.user(actor.userId)),
        Permission.read(Role.any()),
      ],
    });
    return shapeMomentCommentCreated({
      id: (row as any).$id,
      content,
      userId: actor.userId,
      createdAt: now,
    });
  },

  async createMoment(actor: ApiActor, body: Record<string, unknown>) {
    requireScope(actor, 'moments:write');
    const content = String(body.content ?? body.caption ?? body.text ?? '').trim();
    if (!content) badRequest('content required');
    const tables = systemTables();
    const now = new Date().toISOString();
    const metadata = JSON.stringify({ type: 'post' });
    const row = await tables.createRow({
      databaseId: APPWRITE_CONFIG.DATABASES.CONNECT,
      tableId: APPWRITE_CONFIG.TABLES.CONNECT.MOMENTS || 'moments',
      rowId: ID.unique(),
      data: {
        userId: actor.userId,
        caption: content,
        type: 'image',
        momentKind: 'post',
        sourceId: null,
        searchTitle: content.slice(0, 255),
        fileId: metadata,
        isPublic: body.isPublic !== false,
        isGuest: body.isPublic !== false,
        createdAt: now,
        expiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString(),
      },
      permissions: [
        Permission.read(Role.user(actor.userId)),
        ...(body.isPublic !== false ? [Permission.read(Role.any())] : []),
      ],
    });
    return shapeMoment(row);
  },

  async listThreads(
    actor: ApiActor,
    limit = 25,
    opts?: { parentKind?: string; parentId?: string },
  ) {
    requireScope(actor, 'chats:read');
    const { ThreadService } = await import('@/lib/services/threads');
    if (opts?.parentKind && opts?.parentId) {
      return ThreadService.listForParent(opts.parentKind, opts.parentId, limit);
    }
    return ThreadService.listForOwner(actor.userId, limit);
  },

  async ensureThread(actor: ApiActor, body: Record<string, unknown>) {
    requireScope(actor, 'chats:write');
    const { parentKind, parentId } = resolveParentRef(body);
    if (!parentKind || !parentId) badRequest('parent_kind and parent_id required');
    const { ThreadService } = await import('@/lib/services/threads');
    const result = await ThreadService.getOrCreate({
      parentKind,
      parentId,
      channel: body.channel != null ? String(body.channel) : undefined,
      ownerId: actor.userId,
      title: body.title != null ? String(body.title) : undefined,
      isPublic: body.isPublic === true,
      legacyNoteId: body.legacyNoteId != null ? String(body.legacyNoteId) : null,
    });
    return result;
  },

  async getThread(actor: ApiActor, id: string) {
    requireScope(actor, 'chats:read');
    const { ThreadService } = await import('@/lib/services/threads');
    const thread = await ThreadService.getById(id);
    if (!thread) return notFound('Thread not found');
    if (thread.ownerId !== actor.userId && !thread.isPublic) return notFound('Thread not found');
    return thread;
  },

  async listThreadMessages(
    actor: ApiActor,
    threadId: string,
    limit = 50,
    opts?: { rootMessageId?: string; parentMessageId?: string; topLevelOnly?: boolean },
  ) {
    requireScope(actor, 'chats:read');
    await this.getThread(actor, threadId);
    const { ThreadService } = await import('@/lib/services/threads');
    return ThreadService.listMessages(threadId, {
      limit,
      rootMessageId: opts?.rootMessageId,
      parentMessageId: opts?.parentMessageId,
      topLevelOnly: opts?.topLevelOnly,
      includeLegacyComments: true,
    });
  },

  async createThreadMessage(actor: ApiActor, threadId: string, body: Record<string, unknown>) {
    requireScope(actor, 'chats:write');
    await this.getThread(actor, threadId);
    const text = String(body.content ?? body.text ?? '').trim();
    if (!text) badRequest('content required');
    const { ThreadService } = await import('@/lib/services/threads');
    return ThreadService.postMessage({
      threadId,
      userId: actor.userId,
      content: text,
      parentMessageId:
        body.parentMessageId != null
          ? String(body.parentMessageId)
          : body.parentCommentId != null
            ? String(body.parentCommentId)
            : null,
      contentType: body.contentType != null ? String(body.contentType) : 'text',
      metadata: body.metadata != null ? String(body.metadata) : null,
      isVoice: body.isVoice === true,
      isEncrypted: body.isEncrypted === true,
    });
  },

  async getWorkspaceThread(actor: ApiActor, workspaceId: string) {
    requireScope(actor, 'chats:read');
    requireScope(actor, 'workspaces:read');
    const tables = systemTables();
    const project = (await tables
      .getRow({ databaseId: FLOW_DB, tableId: 'projects', rowId: workspaceId })
      .catch(() => null)) as any;
    if (!project) notFound('Workspace not found');

    const { ThreadService } = await import('@/lib/services/threads');
    let legacyNoteId: string | null = null;
    try {
      const meta = JSON.parse(project.metadata || '{}');
      legacyNoteId = meta.discussionNoteId || null;
    } catch {
      legacyNoteId = null;
    }

    const { thread, created } = await ThreadService.getOrCreate({
      parentKind: 'workspace',
      parentId: workspaceId,
      channel: ThreadService.CHANNEL_GENERAL,
      ownerId: project.ownerId || actor.userId,
      title: `${project.title || 'Workspace'} discussion`,
      legacyNoteId: project.primaryThreadId ? null : legacyNoteId,
    });

    // Prefer stamped primaryThreadId; adopt legacy if present
    if (legacyNoteId && !thread.legacyNoteId) {
      await ThreadService.adoptLegacyNote({
        parentKind: 'workspace',
        parentId: workspaceId,
        ownerId: project.ownerId || actor.userId,
        legacyNoteId,
        title: `${project.title || 'Workspace'} discussion`,
      });
    }

    const fresh = (await ThreadService.getById(thread.id)) || thread;
    if (fresh.ownerId !== actor.userId && project.ownerId !== actor.userId && !fresh.isPublic) {
      notFound('Thread not found');
    }
    const messages = await ThreadService.listMessages(fresh.id, {
      limit: 100,
      includeLegacyComments: true,
    });
    return {
      workspaceId,
      threadId: fresh.id,
      thread: fresh,
      messages,
      created,
    };
  },

  async replyWorkspaceThread(
    actor: ApiActor,
    workspaceId: string,
    body: Record<string, unknown>,
  ) {
    requireScope(actor, 'chats:write');
    requireScope(actor, 'workspaces:read');
    const pack = await this.getWorkspaceThread(actor, workspaceId);
    if (!pack.threadId) badRequest('Workspace has no discussion thread');
    return this.createThreadMessage(actor, pack.threadId, body);
  },

  async ensureNoteDiscussion(actor: ApiActor, noteId: string) {
    requireScope(actor, 'chats:write');
    requireScope(actor, 'notes:read');
    await assertOwnedNote(systemTables(), actor, noteId);
    const { ThreadService } = await import('@/lib/services/threads');
    return ThreadService.getOrCreate({
      parentKind: 'note',
      parentId: noteId,
      channel: ThreadService.CHANNEL_DISCUSS,
      ownerId: actor.userId,
      title: 'Discussion',
    });
  },

  async ensureGoalDiscussion(actor: ApiActor, goalId: string) {
    requireScope(actor, 'chats:write');
    requireScope(actor, 'goals:read');
    await assertOwnedGoal(systemTables(), actor, goalId);
    const { ThreadService } = await import('@/lib/services/threads');
    return ThreadService.getOrCreate({
      parentKind: 'goal',
      parentId: goalId,
      channel: ThreadService.CHANNEL_DISCUSS,
      ownerId: actor.userId,
      title: 'Goal discussion',
    });
  },

  async listTags(actor: ApiActor, limit = 50) {
    requireScope(actor, 'tags:read');
    const tables = systemTables();
    const res = await tables.listRows({
      databaseId: DB,
      tableId: TAGS_TABLE,
      queries: [
        Query.equal('userId', actor.userId),
        Query.limit(Math.min(200, Math.max(1, limit))),
      ],
    });
    return res.rows.map((r: any) => shapeTag(r));
  },

  async createTag(actor: ApiActor, body: Record<string, unknown>) {
    requireScope(actor, 'tags:write');
    const name = String(body.name || '').trim();
    if (!name) badRequest('Tag name is required');
    const tables = systemTables();
    const now = new Date().toISOString();
    const nameLower = name.toLowerCase();

    const existing = await tables
      .listRows({
        databaseId: DB,
        tableId: TAGS_TABLE,
        queries: [Query.equal('userId', actor.userId), Query.equal('nameLower', nameLower), Query.limit(1)],
      })
      .catch(() => ({ rows: [] as any[] }));

    if (existing.rows && existing.rows.length > 0) {
      return shapeTag(existing.rows[0]);
    }

    const color = typeof body.color === 'string' ? body.color : '#A855F7';
    const description = typeof body.description === 'string' ? body.description : '';
    const created = await tables.createRow({
      databaseId: DB,
      tableId: TAGS_TABLE,
      rowId: ID.unique(),
      data: {
        name,
        nameLower,
        userId: actor.userId,
        isPublic: !!body.isPublic,
        isGuest: !!body.isGuest,
        usageCount: 0,
        metadata: JSON.stringify({ color, description }),
        createdAt: now,
        updatedAt: now,
      },
      permissions: [Permission.read(Role.any()), Permission.update(Role.user(actor.userId))],
    });

    return shapeTag(created);
  },

  async deleteTag(actor: ApiActor, id: string) {
    if (actor.isAgent || actor.category === 'agentic_pat') {
      forbidden('Autonomous agents cannot delete user tags. Tag deletion requires human owner authorization.');
    }
    requireScope(actor, 'tags:write');
    const tables = systemTables();
    await tables.deleteRow({
      databaseId: DB,
      tableId: TAGS_TABLE,
      rowId: id,
    });
    return { id, deleted: true };
  },

  async listObjects(actor: ApiActor, limit = 50) {
    requireScope(actor, 'objects:read');
    const tables = systemTables();
    const res = await tables.listRows({
      databaseId: FLOW_DB,
      tableId: APPWRITE_CONFIG.TABLES.FLOW.OBJECTS || 'objects',
      queries: [
        Query.equal('userId', actor.userId),
        Query.orderDesc('$createdAt'),
        Query.limit(Math.min(200, Math.max(1, limit))),
      ],
    });
    return res.rows.map((r: any) => ({
      id: r.$id,
      parentKind: r.parentKind || null,
      parentId: r.parentId || null,
      childKind: r.childKind || null,
      childId: r.childId || null,
      createdAt: r.$createdAt || r.createdAt || null,
    }));
  },

  async getAgentSession(actor: ApiActor, id: string) {
    requireScope(actor, 'agents:read');
    const tables = systemTables();
    const row = (await tables
      .getRow({ databaseId: FLOW_DB, tableId: 'agentic_sessions', rowId: id })
      .catch(() => null)) as any;
    if (!row || row.userId !== actor.userId) notFound('Session not found');
    if (row.harness) requireScope(actor, 'agents:harness');
    return shapeAgentSessionDetail(row);
  },
  async deleteAgentSession(actor: ApiActor, id: string) {
    requireScope(actor, 'agents:write');
    await this.getAgentSession(actor, id);
    const tables = systemTables();
    await tables.deleteRow({ databaseId: FLOW_DB, tableId: 'agentic_sessions', rowId: id });
    return { id, deleted: true };
  },};
