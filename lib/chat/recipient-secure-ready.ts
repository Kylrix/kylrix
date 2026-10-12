import { UsersService } from '@/lib/services/users';
import { isValidX25519PublicKey } from '@/lib/crypto/public-key';

export type RecipientSecureDiscovery = {
  userId: string;
  ready: boolean;
  publicKey: string | null;
  profile: any | null;
};

/**
 * Live secure-readiness discovery — always refresh profile publicKey from the network.
 * Never trust search-card seed alone (often omits publicKey → false "no secure" → wrong thread).
 */
export async function discoverRecipientSecureReady(
  userId: string,
  seedPublicKey?: string | null,
): Promise<RecipientSecureDiscovery> {
  let publicKey =
    typeof seedPublicKey === 'string' && seedPublicKey.trim() ? seedPublicKey.trim() : null;
  let profile: any | null = null;

  try {
    profile = await UsersService.getProfileById(userId);
    const live = typeof profile?.publicKey === 'string' ? profile.publicKey.trim() : '';
    if (live) publicKey = live;
  } catch {
    /* keep seed */
  }

  return {
    userId,
    ready: isValidX25519PublicKey(publicKey),
    publicKey,
    profile,
  };
}

export function canonicalDirectParticipants(ids: string[]): string[] {
  return Array.from(new Set(ids.map((s) => String(s).trim()).filter(Boolean))).sort();
}

export function directParticipantsEqual(a: string[], b: string[]): boolean {
  if (a.length !== b.length) return false;
  const ca = [...a].sort();
  const cb = [...b].sort();
  return ca.every((v, i) => v === cb[i]);
}

export function extractthreadParticipantIds(thread: any): string[] {
  let metadataObj: any = {};
  try {
    metadataObj = typeof thread.metadata === 'string' ? JSON.parse(thread.metadata) : thread.metadata || {};
  } catch {
    /* ignore */
  }
  const raw = Array.isArray(thread.collaborators) && thread.collaborators.length
    ? thread.collaborators
    : metadataObj.participants || metadataObj.participantIds || [];
  return Array.isArray(raw) ? raw.map((s: any) => String(s)).filter(Boolean) : [];
}

/**
 * Decide secure chat vs thread.
 * - Secure is default when BOTH participants are ready (valid published X25519 public keys).
 * - Thread only when the user explicitly asked for a thread, OR either side is not ready.
 * - Never start secure without valid keys on both ends; never force a thread when both are ready unless explicit.
 */
export function resolveChatChannelKind(opts: {
  recipientReady: boolean;
  selfReady?: boolean;
  /** User opened create from Threads / chose thread */
  explicitThread?: boolean;
}): 'secure' | 'thread' {
  if (opts.explicitThread) return 'thread';
  const selfReady = opts.selfReady ?? true;
  if (opts.recipientReady && selfReady) return 'secure';
  return 'thread';
}
