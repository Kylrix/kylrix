import { describe, it, expect } from 'vitest';
import { ZeroKnowledgeModule, zeroClearBytes, zeroClearStrings } from './zero-knowledge';

describe('ZeroKnowledgeModule', () => {
  it('generates, formats, and parses Agent Enclave Tokens (AET)', () => {
    const etk = ZeroKnowledgeModule.generateEtkSecret();
    expect(etk).toMatch(/^etk_[a-f0-9]{64}$/);

    const tokenStr = ZeroKnowledgeModule.formatAgentToken('tok_123456', etk);
    expect(tokenStr).toBe(`kyl_apk_tok_123456.${etk}`);

    const parsed = ZeroKnowledgeModule.parseAgentToken(tokenStr);
    expect(parsed).not.toBeNull();
    expect(parsed?.tokenId).toBe('tok_123456');
    expect(parsed?.etkSecret).toBe(etk);

    expect(ZeroKnowledgeModule.parseAgentToken('invalid_token')).toBeNull();
  });

  it('encrypts and decrypts payloads using AES-256-GCM', async () => {
    const dek = await ZeroKnowledgeModule.generateDEK();
    const plaintext = 'Secret database key string';

    const encrypted = await ZeroKnowledgeModule.encryptPayload(dek, plaintext);
    expect(encrypted.isEncrypted).toBe(true);
    expect(encrypted.encryptedData).not.toBe(plaintext);

    const decrypted = await ZeroKnowledgeModule.decryptPayload(dek, encrypted.encryptedData, encrypted.iv);
    expect(decrypted).toBe(plaintext);
  });

  it('wraps and unwraps item DEKs using etkSecret', async () => {
    const dek = await ZeroKnowledgeModule.generateDEK();
    const etkSecret = ZeroKnowledgeModule.generateEtkSecret();

    const { wrappedDek, iv } = await ZeroKnowledgeModule.wrapDEK(dek, etkSecret);
    expect(wrappedDek).toBeTruthy();
    expect(iv).toBeTruthy();

    const unwrappedDek = await ZeroKnowledgeModule.unwrapDEK(wrappedDek, iv, etkSecret);
    expect(Array.from(unwrappedDek)).toEqual(Array.from(dek));
  });

  it('creates and unwraps DEKs from WrappedDekMap', async () => {
    const dek1 = await ZeroKnowledgeModule.generateDEK();
    const dek2 = await ZeroKnowledgeModule.generateDEK();
    const etkSecret = ZeroKnowledgeModule.generateEtkSecret();

    const dekMap = await ZeroKnowledgeModule.createWrappedDekMap(
      {
        'res_1': dek1,
        'res_2': dek2,
      },
      etkSecret
    );

    expect(dekMap['res_1']).toBeDefined();
    expect(dekMap['res_2']).toBeDefined();

    const unwrapped1 = await ZeroKnowledgeModule.unwrapDekFromMap(dekMap, 'res_1', etkSecret);
    expect(unwrapped1).not.toBeNull();
    expect(Array.from(unwrapped1!)).toEqual(Array.from(dek1));

    const unwrapped2 = await ZeroKnowledgeModule.unwrapDekFromMap(dekMap, 'res_2', etkSecret);
    expect(unwrapped2).not.toBeNull();
    expect(Array.from(unwrapped2!)).toEqual(Array.from(dek2));

    const unwrappedMissing = await ZeroKnowledgeModule.unwrapDekFromMap(dekMap, 'res_3', etkSecret);
    expect(unwrappedMissing).toBeNull();
  });

  it('zero-clears byte arrays and string references', () => {
    const bytes = new Uint8Array([1, 2, 3, 4, 5]);
    zeroClearBytes(bytes);
    expect(Array.from(bytes)).toEqual([0, 0, 0, 0, 0]);

    const strings = ['secret1', 'secret2'];
    zeroClearStrings(strings);
    expect(strings).toEqual(['', '']);
  });
});
