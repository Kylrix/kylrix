import { describe, it, expect } from 'vitest';
import * as secp256k1 from '@noble/secp256k1';
import { sha256 } from '@noble/hashes/sha2.js';
import { bytesToHex, bytesToNpub } from '@/lib/nostr/crypto';
import {
  encryptNip04,
  decryptNip04,
  getEcdhSharedSecret,
} from '@/lib/nostr/dm';

secp256k1.hashes.sha256 = (m) => sha256(m);

function randomPrivKey(): Uint8Array {
  return crypto.getRandomValues(new Uint8Array(32));
}

describe('Nostr NIP-04 DM Encryption/Decryption', () => {
  it('should compute identical ECDH shared secret for Alice and Bob', () => {
    const alicePriv = randomPrivKey();
    const alicePubRaw = secp256k1.getPublicKey(alicePriv, true).slice(1);
    const alicePubHex = bytesToHex(alicePubRaw);

    const bobPriv = randomPrivKey();
    const bobPubRaw = secp256k1.getPublicKey(bobPriv, true).slice(1);
    const bobPubHex = bytesToHex(bobPubRaw);

    const aliceSecret = getEcdhSharedSecret(alicePriv, bobPubHex);
    const bobSecret = getEcdhSharedSecret(bobPriv, alicePubHex);

    expect(bytesToHex(aliceSecret)).toBe(bytesToHex(bobSecret));
  });

  it('should encrypt and decrypt NIP-04 DM messages correctly', async () => {
    const alicePriv = randomPrivKey();
    const alicePubRaw = secp256k1.getPublicKey(alicePriv, true).slice(1);
    const alicePubHex = bytesToHex(alicePubRaw);

    const bobPriv = randomPrivKey();
    const bobPubRaw = secp256k1.getPublicKey(bobPriv, true).slice(1);
    const bobPubHex = bytesToHex(bobPubRaw);

    const plainText = 'Hello Bob, this is a secret Nostr DM!';

    // Alice encrypts for Bob
    const encrypted = await encryptNip04(plainText, alicePriv, bobPubHex);
    expect(encrypted).toContain('?iv=');

    // Bob decrypts from Alice
    const decryptedByBob = await decryptNip04(encrypted, bobPriv, alicePubHex);
    expect(decryptedByBob).toBe(plainText);

    // Alice decrypts using Bob's public key (her own sent message)
    const decryptedByAlice = await decryptNip04(encrypted, alicePriv, bobPubHex);
    expect(decryptedByAlice).toBe(plainText);
  });

  it('should handle npub as recipient address in ECDH', async () => {
    const alicePriv = randomPrivKey();
    const bobPriv = randomPrivKey();
    const bobPubRaw = secp256k1.getPublicKey(bobPriv, true).slice(1);
    const bobNpub = bytesToNpub(bobPubRaw);

    const plainText = 'Testing npub resolution in NIP-04 DM';

    const encrypted = await encryptNip04(plainText, alicePriv, bobNpub);
    const decrypted = await decryptNip04(encrypted, bobPriv, bytesToHex(secp256k1.getPublicKey(alicePriv, true).slice(1)));

    expect(decrypted).toBe(plainText);
  });
});
