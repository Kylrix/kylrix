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

/**
 * Decide secure chat vs thread.
 * - Secure is default when recipient is ready (valid published public key).
 * - Thread only when the user explicitly asked for a thread, OR recipient is not ready.
 * - Never start secure without a valid key; never force a thread when they are ready unless explicit.
 */
export function resolveChatChannelKind(opts: {
  recipientReady: boolean;
  /** User opened create from Threads / chose thread */
  explicitThread?: boolean;
}): 'secure' | 'thread' {
  if (opts.explicitThread) return 'thread';
  if (opts.recipientReady) return 'secure';
  return 'thread';
}
