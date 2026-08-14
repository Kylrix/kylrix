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
    return row ? mapKylrixReply(row) : null;
  }

  let privBytes = opts.privateKeyBytes;
  if (privBytes && !(privBytes instanceof Uint8Array)) {
    privBytes = new Uint8Array(Object.values(privBytes));
  }
  if ((!privBytes || privBytes.length !== 32) && opts.nsec) {
    try {
      const { nsecToBytes } = await import('@/lib/nostr/crypto');
      privBytes = nsecToBytes(opts.nsec);
    } catch {}
  }

  if (!privBytes || privBytes.length !== 32) {
    throw new Error('Unlock vault to comment on Nostr');
  }

  const pubkey = bytesToHex(secp256k1.schnorr.getPublicKey(privBytes));
  const tags: string[][] = [['e', opts.id, '', 'root']];
  if (opts.rootPubkey) tags.push(['p', opts.rootPubkey]);

  const unsigned = {
    pubkey,
    created_at: Math.floor(Date.now() / 1000),
    kind: 1,
    tags,
    content: text,
  };
  const signed = signEvent(unsigned, privBytes);
  const pool = new NostrRelayPool(RELAYS);
  pool.connect();
  await pool.publish(signed);
  setTimeout(() => pool.close(), 1500);
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
}): Promise<{ liked: boolean }> {
  if (opts.source === 'ecosystem') {
    if (!opts.userId) throw new Error('Sign in to like');
    return SocialService.toggleLike(
      opts.userId,
      opts.id,
      opts.creatorId,
      opts.contentSnippet,
    );
  }

  if (!opts.privateKeyBytes) throw new Error('Unlock vault to like on Nostr');
  const pubkey = bytesToHex(secp256k1.schnorr.getPublicKey(opts.privateKeyBytes));
  const tags: string[][] = [['e', opts.id, '', 'root']];
  if (opts.rootPubkey) tags.push(['p', opts.rootPubkey]);

  const unsigned = {
    pubkey,
    created_at: Math.floor(Date.now() / 1000),
    kind: 7,
    tags,
    content: '+',
  };
  const signed = signEvent(unsigned, opts.privateKeyBytes);
  const pool = new NostrRelayPool(RELAYS);
  pool.connect();
  await pool.publish(signed);
  setTimeout(() => pool.close(), 1500);
  return { liked: true };
}

export function parseMomentRouteId(raw: string): { source: MomentSource; id: string } {
  if (raw.startsWith('nostr_')) return { source: 'nostr', id: raw.slice(6) };
  if (raw.startsWith('eco_')) return { source: 'ecosystem', id: raw.slice(4) };
  if (/^[0-9a-f]{64}$/i.test(raw)) return { source: 'nostr', id: raw };
  return { source: 'ecosystem', id: raw };
}
