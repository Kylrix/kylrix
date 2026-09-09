import { describe, it, expect } from 'vitest';
import {
  sealPlaintextExport,
  encryptExportData,
  tryCreatePasskeyWrapKey,
  generateEncryptedHtmlPage,
} from './encrypted-html-exporter';

describe('encrypted-html-exporter', () => {
  const sampleData = JSON.stringify({ vault: { credentials: [], totpSecrets: [] } });
  const masterPassword = 'MasterPassword123!';

  it('seals plaintext data with AES-GCM and PBKDF2', async () => {
    const bundle = await sealPlaintextExport(sampleData, masterPassword, null);
    expect(bundle.ciphertext).toBeDefined();
    expect(bundle.salt).toBeDefined();
    expect(bundle.iv).toBeDefined();
    expect(bundle.wrappedDekPassword).toBeDefined();
    expect(bundle.passkey).toBeNull();
  });

  it('seals plaintext data with passkey wrap option', async () => {
    const prfKey = await crypto.subtle.generateKey({ name: 'AES-GCM', length: 256 }, true, [
      'wrapKey',
      'unwrapKey',
      'encrypt',
      'decrypt',
    ]);
    const prfSalt = new Uint8Array(32);
    const bundle = await sealPlaintextExport(sampleData, masterPassword, {
      credentialId: 'cred-123',
      prfKey,
      prfSalt,
    });

    expect(bundle.passkey).toBeDefined();
    expect(bundle.passkey?.credentialId).toBe('cred-123');
  });

  it('encryptExportData deprecated wrapper works identically', async () => {
    const bundle = await encryptExportData(sampleData, masterPassword);
    expect(bundle.ciphertext).toBeDefined();
    expect(bundle.wrappedDekPassword).toBeDefined();
  });

  it('tryCreatePasskeyWrapKey returns null when PublicCredential or WebAuthn is unavailable', async () => {
    const wrap = await tryCreatePasskeyWrapKey();
    expect(wrap).toBeNull();
  });

  it('generates HTML backup page string with embedded bundle and username', async () => {
    const bundle = await sealPlaintextExport(sampleData, masterPassword, null);
    const html = generateEncryptedHtmlPage(bundle, 'testuser');

    expect(html).toContain('<!DOCTYPE html>');
    expect(html).toContain('Locked backup · testuser');
    expect(html).toContain(bundle.ciphertext);

    const legacyHtml = generateEncryptedHtmlPage(
      { ciphertext: 'c', salt: 's', iv: 'i' },
      'legacyuser'
    );
    expect(legacyHtml).toContain('legacyuser');
  });
});
