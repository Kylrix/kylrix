/**
 * Minimal NIP-57 / LNURL-pay zap helper for Nostr moments.
 * Prefer WebLN when present; otherwise return a payable invoice for the user wallet.
 */

import { getCachedNostrProfile, queueNostrProfileFetch } from '@/lib/nostr/metadata';
import { signEvent, NostrRelayPool, type NostrEvent } from '@/lib/nostr/nostr';
import { bytesToHex } from '@/lib/nostr/crypto';
import * as secp256k1 from '@noble/secp256k1';
import { getNostrWriteRelays } from '@/lib/connect/feed-settings';

function lightningAddressToLnurl(lud16: string): string {
  const [name, domain] = lud16.trim().split('@');
  if (!name || !domain) throw new Error('Invalid lightning address');
  return `https://${domain}/.well-known/lnurlp/${encodeURIComponent(name)}`;
}

async function fetchJson(url: string): Promise<any> {
  const res = await fetch(url, { method: 'GET' });
  if (!res.ok) throw new Error(`Lightning endpoint failed (${res.status})`);
  return res.json();
}

export async function resolveRecipientLud16(pubkey: string): Promise<string | null> {
  let meta = getCachedNostrProfile(pubkey);
  if (!meta?.lud16 && !meta?.lud06) {
    await queueNostrProfileFetch([pubkey]);
    await new Promise((r) => setTimeout(r, 2400));
    meta = getCachedNostrProfile(pubkey);
  }
  const lud16 = meta?.lud16 || meta?.lud06;
  return typeof lud16 === 'string' && lud16.includes('@') ? lud16 : null;
}

export type NostrZapResult = {
  success: boolean;
  paid?: boolean;
  invoice?: string;
  error?: string;
};

/**
 * Lightning zap toward a Nostr event/pubkey (LNURL-pay + optional WebLN).
 * Publishes a kind-9734 zap request when a private key is available.
 */
export async function sendNostrZap(opts: {
  recipientPubkey: string;
  eventId?: string;
  amountSats: number;
  comment?: string;
  privateKeyBytes?: Uint8Array | null;
}): Promise<NostrZapResult> {
  const amountSats = Math.max(1, Math.floor(opts.amountSats || 1));
  try {
    const lud16 = await resolveRecipientLud16(opts.recipientPubkey);
    if (!lud16) {
      return {
        success: false,
        error: 'This person has no Lightning address on their Nostr profile yet',
      };
    }

    const lnurl = lightningAddressToLnurl(lud16);
    const payService = await fetchJson(lnurl);
    if (payService.tag !== 'payRequest' || !payService.callback) {
      return { success: false, error: 'Lightning address is not ready for zaps' };
    }

    const msats = amountSats * 1000;
    if (payService.minSendable && msats < payService.minSendable) {
      return {
        success: false,
        error: `Minimum zap is ${Math.ceil(payService.minSendable / 1000)} sats`,
      };
    }
    if (payService.maxSendable && msats > payService.maxSendable) {
      return {
        success: false,
        error: `Maximum zap is ${Math.floor(payService.maxSendable / 1000)} sats`,
      };
    }

    const callback = new URL(payService.callback);
    callback.searchParams.set('amount', String(msats));
    if (opts.comment) callback.searchParams.set('comment', opts.comment.slice(0, 120));

    if (opts.privateKeyBytes && payService.allowsNostr && payService.nostrPubkey) {
      try {
        const pubkey = bytesToHex(secp256k1.schnorr.getPublicKey(opts.privateKeyBytes));
        const configured = await Promise.resolve(getNostrWriteRelays()).catch(() => [] as string[]);
        const relays = (Array.isArray(configured) ? configured : []).slice(0, 4);
        const tags: string[][] = [
          ['p', opts.recipientPubkey],
          ['amount', String(msats)],
          ['relays', ...(relays.length ? relays : ['wss://relay.damus.io'])],
        ];
        if (opts.eventId) tags.push(['e', opts.eventId]);
        const unsigned = {
          kind: 9734,
          pubkey,
          created_at: Math.floor(Date.now() / 1000),
          tags,
          content: opts.comment || '',
        };
        const signed = signEvent(unsigned, opts.privateKeyBytes) as NostrEvent;
        callback.searchParams.set('nostr', JSON.stringify(signed));
        const pool = new NostrRelayPool(relays.length ? relays : ['wss://relay.damus.io']);
        void pool.publishAndClose(signed).catch(() => {});
      } catch {
        /* zap request optional */
      }
    }

    const invoiceRes = await fetchJson(callback.toString());
    const invoice = String(invoiceRes.pr || '').trim();
    if (!invoice) {
      return { success: false, error: 'Could not get a Lightning invoice' };
    }

    const webln = typeof window !== 'undefined' ? (window as any).webln : null;
    if (webln?.enable && webln?.sendPayment) {
      await webln.enable();
      await webln.sendPayment(invoice);
      return { success: true, paid: true, invoice };
    }

    if (typeof navigator !== 'undefined' && navigator.clipboard?.writeText) {
      await navigator.clipboard.writeText(invoice).catch(() => {});
    }
    return {
      success: true,
      paid: false,
      invoice,
      error: 'Invoice copied — pay it in your Lightning wallet to finish the zap',
    };
  } catch (err: any) {
    return { success: false, error: err?.message || 'Nostr zap failed' };
  }
}
