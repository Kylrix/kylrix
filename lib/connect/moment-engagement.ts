/**
 * Source-agnostic moment engagement (likes + comments).
 * Kylrix rows → SocialService; Nostr events → relay thread queries / signed events.
 */

import { SocialService } from '@/lib/services/social';
import { fetchNostrThread } from '@/lib/nostr/thread';
import { signEvent, type NostrEvent } from '@/lib/nostr/nostr';
import { NostrRelayPool } from '@/lib/nostr/nostr';
import { bytesToHex } from '@/lib/nostr/crypto';
import * as secp256k1 from '@noble/secp256k1';

export type MomentSource = 'ecosystem' | 'nostr';

export interface MomentComment {
  id: string;
  source: MomentSource;
  authorName: string;
  authorPubkey?: string;
  content: string;
  createdAt: number;
  raw?: unknown;
}

export interface MomentEngagementSnapshot {
  comments: MomentComment[];
  likesCount: number;
  repliesCount: number;
  zapsCount?: number;
  repostsCount?: number;
  isLiked?: boolean;
}

const RELAYS = [
  'wss://nos.lol',
  'wss://purplepag.es',
  'wss://relay.damus.io',
  'wss://relay.primal.net',
];

function shortPubkey(pubkey: string) {
  return `npub…${pubkey.slice(-8)}`;
}

function mapKylrixReply(row: any): MomentComment {
  return {
    id: row.$id || row.id,
    source: 'ecosystem',
    authorName: row.userName || row.user?.name || row.username || 'Someone',
    content: row.caption || row.content || row.text || '',
    createdAt: new Date(row.$createdAt || row.createdAt || Date.now()).getTime(),
    raw: row,
  };
}

function mapNostrReply(event: NostrEvent): MomentComment {
  return {
    id: event.id,
    source: 'nostr',
    authorName: shortPubkey(event.pubkey),
    authorPubkey: event.pubkey,
    content: event.content || '',
    createdAt: event.created_at * 1000,
    raw: event,
  };
}

/** Normalise privateKeyBytes: plain Uint8Array or serialised object → Uint8Array */
function toUint8Array(raw: any): Uint8Array | null {
  if (!raw) return null;
  if (raw instanceof Uint8Array) return raw.length === 32 ? raw : null;
  if (typeof raw === 'object') {
    const arr = new Uint8Array(Object.values(raw) as number[]);
    return arr.length === 32 ? arr : null;
  }
  return null;
}

/** Build, sign and fire-and-forget a Nostr event to all relays. */
async function publishToNostr(
  privBytes: Uint8Array,
  kind: number,
  tags: string[][],
  content: string,
): Promise<void> {
  const pubkey = bytesToHex(secp256k1.schnorr.getPublicKey(privBytes));
  const unsigned = {
    pubkey,
    created_at: Math.floor(Date.now() / 1000),
    kind,
    tags,
    content,
  };
  const signed = signEvent(unsigned, privBytes);
  const pool = new NostrRelayPool(RELAYS);
  await pool.publishAndClose(signed);
}

export async function loadMomentEngagement(opts: {
  source: MomentSource;
  id: string;
  userId?: string;
}): Promise<MomentEngagementSnapshot> {
  const { source, id, userId } = opts;

  if (source === 'ecosystem') {
    const [replies, moment, liked] = await Promise.all([
      SocialService.getReplies(id, userId).catch(() => []),
      SocialService.getMomentById(id, userId).catch(() => null),
      userId ? SocialService.isLiked(userId, id).catch(() => false) : Promise.resolve(false),
    ]);
    const comments = (Array.isArray(replies) ? replies : []).map(mapKylrixReply);
    return {
      comments,
      repliesCount: comments.length,
      likesCount: moment?.stats?.likes ?? moment?.likeCount ?? 0,
      zapsCount: moment?.stats?.zaps ?? moment?.zapCount ?? 0,
      repostsCount: moment?.stats?.reposts ?? moment?.repostCount ?? 0,
      isLiked: Boolean(liked),
    };
  }

  const thread = await fetchNostrThread(id);
  return {
    comments: thread.replies.map(mapNostrReply),
    repliesCount: thread.replyCount,
    likesCount: thread.likeCount,
    zapsCount: thread.zapCount,
    repostsCount: thread.repostCount,
    isLiked: false,
  };
}

export async function createMomentComment(opts: {
  source: MomentSource;
  id: string;
  content: string;
  userId?: string;
  privateKeyBytes?: Uint8Array | Record<string, number> | any;
  nsec?: string;
  rootPubkey?: string;
  nostrId?: string;
}): Promise<MomentComment | null> {
  const text = opts.content.trim();
  if (!text) return null;

  if (opts.source === 'ecosystem') {
    if (!opts.userId) throw new Error('Sign in to comment');
    const row = await SocialService.createMoment(
      opts.userId,
      text,
      'reply',
      [],
      'public',
      undefined,
      undefined,
      opts.id,
    );

    // If moment was synced to Nostr and vault is unlocked, dual-sync reply to Nostr
    if (opts.nostrId && opts.privateKeyBytes) {
      const privBytes = toUint8Array(opts.privateKeyBytes);
      if (privBytes) {
        const tags: string[][] = [['e', opts.nostrId, '', 'root']];
        if (opts.rootPubkey) tags.push(['p', opts.rootPubkey]);
        await publishToNostr(privBytes, 1, tags, text).catch((e) =>
          console.warn('[Engagement] Dual Nostr reply sync skipped:', e),
        );
      }
    }

    return row ? mapKylrixReply(row) : null;
  }

  // Pure Nostr post: resolve private key
  let privBytes = toUint8Array(opts.privateKeyBytes);
  if (!privBytes && opts.nsec) {
    try {
      const { nsecToBytes } = await import('@/lib/nostr/crypto');
      privBytes = nsecToBytes(opts.nsec);
    } catch {}
  }
  if (!privBytes) throw new Error('Unlock vault to comment on Nostr');

  const tags: string[][] = [['e', opts.id, '', 'root']];
  if (opts.rootPubkey) tags.push(['p', opts.rootPubkey]);
  const pubkey = bytesToHex(secp256k1.schnorr.getPublicKey(privBytes));
  const unsigned = {
    pubkey,
    created_at: Math.floor(Date.now() / 1000),
    kind: 1,
    tags,
    content: text,
  };
  const signed = signEvent(unsigned, privBytes);
  const pool = new NostrRelayPool(RELAYS);
  await pool.publishAndClose(signed);
  return mapNostrReply(signed);
}

export async function toggleMomentLike(opts: {
  source: MomentSource;
  id: string;
  userId?: string;
  creatorId?: string;
  contentSnippet?: string;
  privateKeyBytes?: Uint8Array;
  rootPubkey?: string;
  nostrId?: string;
}): Promise<{ liked: boolean }> {
  if (opts.source === 'ecosystem') {
    if (!opts.userId) throw new Error('Sign in to like');
    const res = await SocialService.toggleLike(
      opts.userId,
      opts.id,
      opts.creatorId,
      opts.contentSnippet,
    );

    if (res.liked && opts.nostrId && opts.privateKeyBytes) {
      const privBytes = toUint8Array(opts.privateKeyBytes);
      if (privBytes) {
        const tags: string[][] = [['e', opts.nostrId, '', 'root']];
        if (opts.rootPubkey) tags.push(['p', opts.rootPubkey]);
        await publishToNostr(privBytes, 7, tags, '+').catch((e) =>
          console.warn('[Engagement] Dual Nostr like sync skipped:', e),
        );
      }
    }

    return res;
  }

  const privBytes = toUint8Array(opts.privateKeyBytes);
  if (!privBytes) throw new Error('Unlock vault to like on Nostr');

  const tags: string[][] = [['e', opts.id, '', 'root']];
  if (opts.rootPubkey) tags.push(['p', opts.rootPubkey]);
  await publishToNostr(privBytes, 7, tags, '+');
  return { liked: true };
}

export async function repostMoment(opts: {
  source: MomentSource;
  id: string;
  userId?: string;
  creatorId?: string;
  privateKeyBytes?: Uint8Array;
  rootPubkey?: string;
  nostrId?: string;
}): Promise<{ reposted: boolean }> {
  if (opts.source === 'ecosystem') {
    if (!opts.userId) throw new Error('Sign in to pulse/repost');
    await SocialService.createMoment(
      opts.userId,
      '',
      'pulse',
      [],
      'public',
      undefined,
      undefined,
      opts.id,
    );

    if (opts.nostrId && opts.privateKeyBytes) {
      const privBytes = toUint8Array(opts.privateKeyBytes);
      if (privBytes) {
        const tags: string[][] = [['e', opts.nostrId, '', 'root']];
        if (opts.rootPubkey) tags.push(['p', opts.rootPubkey]);
        await publishToNostr(privBytes, 6, tags, '').catch((e) =>
          console.warn('[Engagement] Dual Nostr pulse sync skipped:', e),
        );
      }
    }

    return { reposted: true };
  }

  const privBytes = toUint8Array(opts.privateKeyBytes);
  if (!privBytes) throw new Error('Unlock vault to repost on Nostr');

  const tags: string[][] = [['e', opts.id, '', 'root']];
  if (opts.rootPubkey) tags.push(['p', opts.rootPubkey]);
  await publishToNostr(privBytes, 6, tags, '');
  return { reposted: true };
}

export function parseMomentRouteId(raw: string): { source: MomentSource; id: string } {
  if (raw.startsWith('nostr_')) return { source: 'nostr', id: raw.slice(6) };
  if (raw.startsWith('eco_')) return { source: 'ecosystem', id: raw.slice(4) };
  if (/^[0-9a-f]{64}$/i.test(raw)) return { source: 'nostr', id: raw };
  return { source: 'ecosystem', id: raw };
}
