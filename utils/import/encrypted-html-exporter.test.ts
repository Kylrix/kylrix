import { describe, it, expect, vi, afterEach } from 'vitest';
import { Window } from 'happy-dom';
import {
  sealPlaintextExport,
  encryptExportData,
  tryCreatePasskeyWrapKey,
  generateEncryptedHtmlPage,
} from './encrypted-html-exporter';

function setupGeneratedHtml(html: string, options?: { credentialsGet?: any }) {
  const win = new Window({ url: 'http://localhost' });
  const doc = win.document;
  doc.write(html);

  win.crypto = globalThis.crypto as any;
  win.TextEncoder = TextEncoder as any;
  win.TextDecoder = TextDecoder as any;
  win.atob = atob;
  win.btoa = btoa;
  win.Blob = globalThis.Blob as any;
  win.URL = globalThis.URL as any;
  if (!win.URL.createObjectURL) {
    win.URL.createObjectURL = vi.fn().mockReturnValue('blob:mock-url');
  }

  if (options?.credentialsGet) {
    Object.defineProperty(win.navigator, 'credentials', {
      value: { get: options.credentialsGet },
      writable: true,
      configurable: true,
    });
  }

  const scriptTag = doc.querySelector('script');
  if (scriptTag && scriptTag.textContent) {
    const runScript = new Function(
      'window',
      'document',
      'navigator',
      'crypto',
      'TextEncoder',
      'TextDecoder',
      'atob',
      'btoa',
      `
      with (window) {
        ${scriptTag.textContent}
      }
    `
    );
    runScript(win, doc, win.navigator, win.crypto, TextEncoder, TextDecoder, atob, btoa);
  }

  return { win, doc };
}

describe('encrypted-html-exporter', () => {
  const sampleVaultData = {
    credentials: [
      { name: 'GitHub', username: 'dev', password: 'secretpassword', url: 'https://github.com' },
    ],
    totpSecrets: [{ issuer: 'Google', accountName: 'dev@gmail.com', secretKey: 'JBSWY3DPEHPK3PXP' }],
    exportedAt: new Date().toISOString(),
  };
  const sampleData = JSON.stringify(sampleVaultData);
  const masterPassword = 'MasterPassword123!';

  afterEach(() => {
    vi.restoreAllMocks();
    vi.unstubAllGlobals();
  });

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
      credentialId: btoa('cred-123'),
      prfKey,
      prfSalt,
    });

    expect(bundle.passkey).toBeDefined();
    expect(bundle.passkey?.credentialId).toBe(btoa('cred-123'));
  });

  it('encryptExportData deprecated wrapper works identically', async () => {
    const bundle = await encryptExportData(sampleData, masterPassword);
    expect(bundle.ciphertext).toBeDefined();
    expect(bundle.wrappedDekPassword).toBeDefined();
  });

  describe('tryCreatePasskeyWrapKey', () => {
    it('returns null when window or PublicKeyCredential is missing', async () => {
      vi.stubGlobal('window', undefined);
      const wrap = await tryCreatePasskeyWrapKey();
      expect(wrap).toBeNull();
    });

    it('returns null when navigator.credentials.get returns null', async () => {
      vi.stubGlobal('window', { PublicKeyCredential: class {} });
      vi.stubGlobal('navigator', {
        credentials: {
          get: vi.fn().mockResolvedValue(null),
        },
      });

      const wrap = await tryCreatePasskeyWrapKey();
      expect(wrap).toBeNull();
    });

    it('returns null when navigator.credentials.get throws an error', async () => {
      vi.stubGlobal('window', { PublicKeyCredential: class {} });
      vi.stubGlobal('navigator', {
        credentials: {
          get: vi.fn().mockRejectedValue(new Error('User cancelled')),
        },
      });

      const wrap = await tryCreatePasskeyWrapKey();
      expect(wrap).toBeNull();
    });

    it('returns null when PRF extension results are missing', async () => {
      vi.stubGlobal('window', { PublicKeyCredential: class {} });
      vi.stubGlobal('navigator', {
        credentials: {
          get: vi.fn().mockResolvedValue({
            rawId: new Uint8Array([1, 2, 3]).buffer,
            getClientExtensionResults: () => ({}),
          }),
        },
      });

      const wrap = await tryCreatePasskeyWrapKey();
      expect(wrap).toBeNull();
    });

    it('returns credentialId, prfKey, and prfSalt when PRF extension succeeds', async () => {
      const dummyPrfRaw = new Uint8Array(32);
      vi.stubGlobal('window', { PublicKeyCredential: class {} });
      vi.stubGlobal('navigator', {
        credentials: {
          get: vi.fn().mockResolvedValue({
            rawId: new Uint8Array([10, 20, 30]).buffer,
            getClientExtensionResults: () => ({
              prf: {
                results: {
                  first: dummyPrfRaw.buffer,
                },
              },
            }),
          }),
        },
      });

      const wrap = await tryCreatePasskeyWrapKey();
      expect(wrap).not.toBeNull();
      expect(wrap?.credentialId).toBeDefined();
      expect(wrap?.prfKey).toBeDefined();
      expect(wrap?.prfSalt).toBeDefined();
    });
  });

  describe('generated HTML page client execution', () => {
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

    it('handles passkey unlock error with err.message when passkey bundle is missing', async () => {
      const bundle = await sealPlaintextExport(sampleData, masterPassword, null);
      const html = generateEncryptedHtmlPage(bundle, 'testuser');
      const { doc } = setupGeneratedHtml(html);

      const passkeyBtn = doc.getElementById('passkey-btn') as HTMLElement;
      expect(passkeyBtn).not.toBeNull();

      passkeyBtn.click();
      await new Promise((resolve) => setTimeout(resolve, 50));

      const errorEl = doc.getElementById('error') as HTMLElement;
      expect(errorEl.classList.contains('show')).toBe(true);
      expect(errorEl.textContent).toBe('Passkey unlock not available for this file.');
    });

    it('handles passkey unlock error with err.message when PRF extension is unavailable', async () => {
      const prfKey = await crypto.subtle.generateKey({ name: 'AES-GCM', length: 256 }, true, [
        'wrapKey',
        'unwrapKey',
        'encrypt',
        'decrypt',
      ]);
      const bundle = await sealPlaintextExport(sampleData, masterPassword, {
        credentialId: btoa('cred-123'),
        prfKey,
        prfSalt: new Uint8Array(32),
      });
      const html = generateEncryptedHtmlPage(bundle, 'testuser');
      const { doc } = setupGeneratedHtml(html, {
        credentialsGet: vi.fn().mockResolvedValue({
          getClientExtensionResults: () => ({}),
        }),
      });

      const passkeyBtn = doc.getElementById('passkey-btn') as HTMLElement;
      passkeyBtn.click();
      await new Promise((resolve) => setTimeout(resolve, 50));

      const errorEl = doc.getElementById('error') as HTMLElement;
      expect(errorEl.classList.contains('show')).toBe(true);
      expect(errorEl.textContent).toBe('This passkey cannot unlock the file (PRF unavailable). Use password.');
    });

    it('handles passkey unlock error fallback when err has no message property', async () => {
      const prfKey = await crypto.subtle.generateKey({ name: 'AES-GCM', length: 256 }, true, [
        'wrapKey',
        'unwrapKey',
        'encrypt',
        'decrypt',
      ]);
      const bundle = await sealPlaintextExport(sampleData, masterPassword, {
        credentialId: btoa('cred-123'),
        prfKey,
        prfSalt: new Uint8Array(32),
      });
      const html = generateEncryptedHtmlPage(bundle, 'testuser');

      // Rejection with an object containing no .message property (triggers fallback 'Passkey unlock failed.')
      const { doc } = setupGeneratedHtml(html, {
        credentialsGet: vi.fn().mockRejectedValue({ code: 500 }),
      });

      const passkeyBtn = doc.getElementById('passkey-btn') as HTMLElement;
      expect(passkeyBtn).not.toBeNull();

      passkeyBtn.click();
      await new Promise((resolve) => setTimeout(resolve, 50));

      const errorEl = doc.getElementById('error') as HTMLElement;
      expect(errorEl.classList.contains('show')).toBe(true);
      expect(errorEl.textContent).toBe('Passkey unlock failed.');
    });

    it('successfully unlocks dashboard when passkey unlock succeeds', async () => {
      const prfKey = await crypto.subtle.generateKey({ name: 'AES-GCM', length: 256 }, true, [
        'wrapKey',
        'unwrapKey',
        'encrypt',
        'decrypt',
      ]);

      // Export DEK under prfKey
      const dekRaw = crypto.getRandomValues(new Uint8Array(32));
      const dek = await crypto.subtle.importKey('raw', dekRaw, { name: 'AES-GCM', length: 256 }, true, [
        'encrypt',
        'decrypt',
      ]);
      const encrypted = await crypto.subtle.encrypt(
        { name: 'AES-GCM', iv: new Uint8Array(12) },
        dek,
        new TextEncoder().encode(sampleData)
      );

      const prfWrapIv = new Uint8Array(12);
      const wrappedDek = await crypto.subtle.wrapKey('raw', dek, prfKey, {
        name: 'AES-GCM',
        iv: prfWrapIv,
      });

      const exportPrfRaw = await crypto.subtle.exportKey('raw', prfKey);

      const bundle = {
        ciphertext: btoa(String.fromCharCode(...new Uint8Array(encrypted))),
        salt: btoa(String.fromCharCode(...new Uint8Array(32))),
        iv: btoa(String.fromCharCode(...new Uint8Array(12))),
        wrappedDekPassword: '',
        wrappedDekIv: '',
        passkey: {
          credentialId: btoa(String.fromCharCode(...new Uint8Array([1, 2, 3]))),
          prfSalt: btoa(String.fromCharCode(...new Uint8Array(32))),
          wrappedDek: btoa(String.fromCharCode(...new Uint8Array(wrappedDek))),
          wrappedDekIv: btoa(String.fromCharCode(...new Uint8Array(prfWrapIv))),
        },
      };

      const html = generateEncryptedHtmlPage(bundle, 'testuser');
      const { doc } = setupGeneratedHtml(html, {
        credentialsGet: vi.fn().mockResolvedValue({
          getClientExtensionResults: () => ({
            prf: { results: { first: exportPrfRaw } },
          }),
        }),
      });

      const passkeyBtn = doc.getElementById('passkey-btn') as HTMLElement;
      passkeyBtn.click();
      await new Promise((resolve) => setTimeout(resolve, 200));

      const unlockCard = doc.getElementById('unlock') as HTMLElement;
      const dashboard = doc.getElementById('dashboard') as HTMLElement;

      expect(unlockCard.classList.contains('hidden')).toBe(true);
      expect(dashboard.classList.contains('hidden')).toBe(false);
      expect(doc.getElementById('list')?.innerHTML).toContain('GitHub');
    });

    it('shows error when password unlock fails and re-enables submit button', async () => {
      const bundle = await sealPlaintextExport(sampleData, masterPassword, null);
      const html = generateEncryptedHtmlPage(bundle, 'testuser');
      const { doc } = setupGeneratedHtml(html);

      const passwordInput = doc.getElementById('password') as HTMLInputElement;
      passwordInput.value = 'WrongPassword!';

      const unlockBtn = doc.getElementById('unlock-btn') as HTMLButtonElement;

      unlockBtn.click();

      await new Promise((resolve) => setTimeout(resolve, 800));

      const errorEl = doc.getElementById('error') as HTMLElement;

      expect(errorEl.classList.contains('show')).toBe(true);
      expect(errorEl.textContent).toBe('Unlock failed. Check the password.');
      expect(unlockBtn.disabled).toBe(false);
      expect(unlockBtn.textContent).toBe('Unlock backup');
    });

    it('successfully unlocks vault with correct password and allows tab switching, search, and download', async () => {
      const bundle = await sealPlaintextExport(sampleData, masterPassword, null);
      const html = generateEncryptedHtmlPage(bundle, 'testuser');
      const { doc } = setupGeneratedHtml(html);

      const passwordInput = doc.getElementById('password') as HTMLInputElement;
      passwordInput.value = masterPassword;

      const unlockBtn = doc.getElementById('unlock-btn') as HTMLButtonElement;
      unlockBtn.click();

      await new Promise((resolve) => setTimeout(resolve, 800));

      const unlockCard = doc.getElementById('unlock') as HTMLElement;
      const dashboard = doc.getElementById('dashboard') as HTMLElement;

      expect(unlockCard.classList.contains('hidden')).toBe(true);
      expect(dashboard.classList.contains('hidden')).toBe(false);
      expect(doc.getElementById('list')?.innerHTML).toContain('GitHub');

      // Test tab switching to totp
      const totpTab = doc.querySelector('.tab[data-tab="totp"]') as HTMLElement;
      totpTab.click();
      expect(totpTab.classList.contains('active')).toBe(true);
      expect(doc.getElementById('list')?.innerHTML).toContain('Google');

      // Test search filtering
      const searchInput = doc.getElementById('search') as HTMLInputElement;
      searchInput.value = 'nonexistent';
      searchInput.dispatchEvent(new doc.defaultView.Event('input'));
      expect(doc.getElementById('list')?.innerHTML).not.toContain('Google');

      searchInput.value = 'Google';
      searchInput.dispatchEvent(new doc.defaultView.Event('input'));
      expect(doc.getElementById('list')?.innerHTML).toContain('Google');

      // Test download JSON button
      const downloadBtn = doc.getElementById('download-json') as HTMLElement;
      expect(() => downloadBtn.click()).not.toThrow();
    });

    it('allows toggling between passkey block and password block', async () => {
      const prfKey = await crypto.subtle.generateKey({ name: 'AES-GCM', length: 256 }, true, [
        'wrapKey',
        'unwrapKey',
        'encrypt',
        'decrypt',
      ]);
      const bundle = await sealPlaintextExport(sampleData, masterPassword, {
        credentialId: btoa('cred-123'),
        prfKey,
        prfSalt: new Uint8Array(32),
      });
      const html = generateEncryptedHtmlPage(bundle, 'testuser');
      const { doc } = setupGeneratedHtml(html);

      const switchPasswordBtn = doc.getElementById('switch-password') as HTMLElement;
      const switchPasskeyBtn = doc.getElementById('switch-passkey') as HTMLElement;
      const passkeyBlock = doc.getElementById('passkey-block') as HTMLElement;
      const passwordBlock = doc.getElementById('password-block') as HTMLElement;

      switchPasswordBtn.click();
      expect(passkeyBlock.classList.contains('hidden')).toBe(true);
      expect(passwordBlock.classList.contains('hidden')).toBe(false);

      switchPasskeyBtn.click();
      expect(passwordBlock.classList.contains('hidden')).toBe(true);
      expect(passkeyBlock.classList.contains('hidden')).toBe(false);
    });
  });
});
