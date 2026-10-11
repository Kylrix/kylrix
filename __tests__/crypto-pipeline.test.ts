import { describe, it, expect, beforeEach, vi } from 'vitest';
import { ecosystemSecurity } from '../lib/ecosystem/security';

describe('Cryptographic Pipeline Audit: Envelope Decryption', () => {
  let userMek: CryptoKey;
  let agentMek: CryptoKey;
  let itemDek: CryptoKey;

  const ivSize = 16;

  async function generateKey(): Promise<CryptoKey> {
    return await crypto.subtle.generateKey(
      { name: 'AES-GCM', length: 256 },
      true,
      ['encrypt', 'decrypt']
    );
  }

  async function wrapKeyWithMek(keyToWrap: CryptoKey, wrappingMek: CryptoKey): Promise<string> {
    const raw = await crypto.subtle.exportKey('raw', keyToWrap);
    const iv = crypto.getRandomValues(new Uint8Array(ivSize));
    const encrypted = await crypto.subtle.encrypt({ name: 'AES-GCM', iv }, wrappingMek, raw);
    const combined = new Uint8Array(iv.length + encrypted.byteLength);
    combined.set(iv);
    combined.set(new Uint8Array(encrypted), iv.length);
    return btoa(String.fromCharCode(...combined));
  }

  async function encryptPayloadWithDek(plaintext: string, dek: CryptoKey): Promise<string> {
    const encoder = new TextEncoder();
    const data = encoder.encode(plaintext);
    const iv = crypto.getRandomValues(new Uint8Array(ivSize));
    const encrypted = await crypto.subtle.encrypt({ name: 'AES-GCM', iv }, dek, data);
    const combined = new Uint8Array(iv.length + encrypted.byteLength);
    combined.set(iv);
    combined.set(new Uint8Array(encrypted), iv.length);
    return btoa(String.fromCharCode(...combined));
  }

  beforeEach(async () => {
    ecosystemSecurity.lock();
    userMek = await generateKey();
    agentMek = await generateKey();
    itemDek = await generateKey();

    const rawUserMek = await crypto.subtle.exportKey('raw', userMek);
    await ecosystemSecurity.importMasterKey(rawUserMek);
  });

  it('1. Personal Workspace Decryption (2-Step: user_MEK -> item_DEK -> ciphertext)', async () => {
    const secretText = 'classified-personal-credential';
    const wrappedDek = await wrapKeyWithMek(itemDek, userMek);
    const ciphertext = await encryptPayloadWithDek(secretText, itemDek);

    const personalWorkspace = { isAgentic: false, id: 'personal_ws_1' };

    const decrypted = await ecosystemSecurity.decryptWithWorkspace(
      ciphertext,
      personalWorkspace,
      wrappedDek
    );

    expect(decrypted).toBe(secretText);
  });

  it('2. Agentic Workspace Decryption (3-Step: user_MEK -> agent_MEK -> item_DEK -> ciphertext)', async () => {
    const secretText = 'classified-agentic-credential';
    const wrappedDekUnderAgentMek = await wrapKeyWithMek(itemDek, agentMek);
    const ciphertext = await encryptPayloadWithDek(secretText, itemDek);

    const agenticWorkspace = { isAgentic: true, agentId: 'agent_999', id: 'ws_agentic_1' };

    vi.spyOn(ecosystemSecurity, 'getAgentMek').mockResolvedValue(agentMek);

    const decrypted = await ecosystemSecurity.decryptWithWorkspace(
      ciphertext,
      agenticWorkspace,
      wrappedDekUnderAgentMek
    );

    expect(decrypted).toBe(secretText);
  });

  it('3. Mismatch Handling & Fast Failure on Tampered AEAD Auth Tags', async () => {
    const secretText = 'tampered-data';
    const wrappedDek = await wrapKeyWithMek(itemDek, userMek);
    const ciphertext = await encryptPayloadWithDek(secretText, itemDek);

    const ciphertextBytes = new Uint8Array(atob(ciphertext).split('').map((c) => c.charCodeAt(0)));
    ciphertextBytes[ciphertextBytes.length - 1] ^= 0xff; // Tamper last byte (auth tag)
    const tamperedCiphertext = btoa(String.fromCharCode(...ciphertextBytes));

    const personalWorkspace = { isAgentic: false, id: 'personal_ws_1' };

    await expect(
      ecosystemSecurity.decryptWithWorkspace(tamperedCiphertext, personalWorkspace, wrappedDek)
    ).rejects.toThrow('AEAD_AUTH_TAG_MISMATCH');
  });

  it('4. Rejection of Agentic Payload under Personal Workspace Discriminator (and vice versa)', async () => {
    const secretText = 'mismatched-routing-payload';
    const wrappedDekUnderAgentMek = await wrapKeyWithMek(itemDek, agentMek);
    const ciphertext = await encryptPayloadWithDek(secretText, itemDek);

    const personalWorkspace = { isAgentic: false, id: 'personal_ws_1' };

    vi.spyOn(ecosystemSecurity, 'getAgentMek').mockResolvedValue(agentMek);

    await expect(
      ecosystemSecurity.decryptWithWorkspace(ciphertext, personalWorkspace, wrappedDekUnderAgentMek)
    ).rejects.toThrow('AEAD_AUTH_TAG_MISMATCH');
  });

  it('5. IV Uniqueness Across Envelope Layers', async () => {
    const wrappedDek1 = await wrapKeyWithMek(itemDek, userMek);
    const wrappedDek2 = await wrapKeyWithMek(itemDek, userMek);

    const iv1 = atob(wrappedDek1).substring(0, 16);
    const iv2 = atob(wrappedDek2).substring(0, 16);

    expect(iv1).not.toBe(iv2);
  });

  it('6. Agent MEK Memory Hygiene on Lock', async () => {
    vi.spyOn(ecosystemSecurity, 'getAgentMek').mockImplementation(async (id) => {
      if (id === 'agent_1') return agentMek;
      return null;
    });

    const resolvedKey = await ecosystemSecurity.getAgentMek('agent_1');
    expect(resolvedKey).toBe(agentMek);

    ecosystemSecurity.lock();

    const status = ecosystemSecurity.status;
    expect(status.isUnlocked).toBe(false);
    expect(status.hasKey).toBe(false);
  });
});
