/**
 * Locked HTML backup — plaintext vault JSON sealed with AES-GCM.
 * Unlock UI mirrors sudo: master password and optional passkey (WebAuthn PRF).
 */

function bytesToB64(bytes: Uint8Array): string {
  let s = '';
  bytes.forEach((b) => {
    s += String.fromCharCode(b);
  });
  return btoa(s);
}

function b64ToBytes(b64: string): Uint8Array {
  return new Uint8Array(
    atob(b64)
      .split('')
      .map((c) => c.charCodeAt(0)),
  );
}

async function derivePasswordKey(password: string, salt: Uint8Array): Promise<CryptoKey> {
  const encoder = new TextEncoder();
  const keyMaterial = await crypto.subtle.importKey(
    'raw',
    encoder.encode(password),
    { name: 'PBKDF2' },
    false,
    ['deriveKey'],
  );
  return crypto.subtle.deriveKey(
    {
      name: 'PBKDF2',
      salt: salt as BufferSource,
      iterations: 210000,
      hash: 'SHA-256',
    },
    keyMaterial,
    { name: 'AES-GCM', length: 256 },
    false,
    ['encrypt', 'decrypt', 'wrapKey', 'unwrapKey'],
  );
}

export type LockedHtmlBundle = {
  ciphertext: string;
  salt: string;
  iv: string;
  /** DEK wrapped with password-derived key */
  wrappedDekPassword: string;
  wrappedDekIv: string;
  /** Optional passkey PRF wrap */
  passkey?: {
    credentialId: string;
    prfSalt: string;
    wrappedDek: string;
    wrappedDekIv: string;
  } | null;
};

export async function sealPlaintextExport(
  dataStr: string,
  password: string,
  passkeyWrap?: { credentialId: string; prfKey: CryptoKey; prfSalt: Uint8Array } | null,
): Promise<LockedHtmlBundle> {
  const salt = crypto.getRandomValues(new Uint8Array(32));
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const dekRaw = crypto.getRandomValues(new Uint8Array(32));

  const dek = await crypto.subtle.importKey('raw', dekRaw, { name: 'AES-GCM', length: 256 }, true, [
    'encrypt',
    'decrypt',
  ]);

  const encrypted = await crypto.subtle.encrypt(
    { name: 'AES-GCM', iv },
    dek,
    new TextEncoder().encode(dataStr),
  );

  const passwordKey = await derivePasswordKey(password, salt);
  const wrapIv = crypto.getRandomValues(new Uint8Array(12));
  const wrappedDekPassword = await crypto.subtle.wrapKey('raw', dek, passwordKey, {
    name: 'AES-GCM',
    iv: wrapIv,
  });

  let passkey: LockedHtmlBundle['passkey'] = null;
  if (passkeyWrap?.prfKey && passkeyWrap.credentialId && passkeyWrap.prfSalt) {
    const prfWrapIv = crypto.getRandomValues(new Uint8Array(12));
    const wrappedDek = await crypto.subtle.wrapKey('raw', dek, passkeyWrap.prfKey, {
      name: 'AES-GCM',
      iv: prfWrapIv,
    });
    passkey = {
      credentialId: passkeyWrap.credentialId,
      prfSalt: bytesToB64(passkeyWrap.prfSalt),
      wrappedDek: bytesToB64(new Uint8Array(wrappedDek)),
      wrappedDekIv: bytesToB64(prfWrapIv),
    };
  }

  return {
    ciphertext: bytesToB64(new Uint8Array(encrypted)),
    salt: bytesToB64(salt),
    iv: bytesToB64(iv),
    wrappedDekPassword: bytesToB64(new Uint8Array(wrappedDekPassword)),
    wrappedDekIv: bytesToB64(wrapIv),
    passkey,
  };
}

/** @deprecated — prefer sealPlaintextExport (DEK wrap). Kept for older callers. */
export async function encryptExportData(dataStr: string, password: string) {
  const sealed = await sealPlaintextExport(dataStr, password, null);
  return {
    ciphertext: sealed.ciphertext,
    salt: sealed.salt,
    iv: sealed.iv,
    wrappedDekPassword: sealed.wrappedDekPassword,
    wrappedDekIv: sealed.wrappedDekIv,
    passkey: sealed.passkey,
  };
}

/**
 * Attempt WebAuthn PRF to produce an AES wrap key for locking the HTML backup.
 * Returns null when passkeys/PRF are unavailable — password-only lock still works.
 */
export async function tryCreatePasskeyWrapKey(): Promise<{
  credentialId: string;
  prfKey: CryptoKey;
  prfSalt: Uint8Array;
} | null> {
  if (typeof window === 'undefined' || !window.PublicKeyCredential) return null;
  try {
    const challenge = crypto.getRandomValues(new Uint8Array(32));
    const prfSalt = crypto.getRandomValues(new Uint8Array(32));
    const cred = (await navigator.credentials.get({
      publicKey: {
        challenge,
        timeout: 60000,
        userVerification: 'required',
        extensions: {
          prf: { eval: { first: prfSalt } },
        } as AuthenticationExtensionsClientInputs,
      },
    })) as PublicKeyCredential | null;
    if (!cred) return null;
    const ext = cred.getClientExtensionResults?.() as {
      prf?: { results?: { first?: ArrayBuffer } };
    };
    const prfFirst = ext?.prf?.results?.first;
    if (!prfFirst) return null;
    const prfKey = await crypto.subtle.importKey(
      'raw',
      prfFirst,
      { name: 'AES-GCM', length: 256 },
      false,
      ['wrapKey', 'unwrapKey', 'encrypt', 'decrypt'],
    );
    const credentialId = bytesToB64(new Uint8Array(cred.rawId));
    return { credentialId, prfKey, prfSalt };
  } catch {
    return null;
  }
}

export function generateEncryptedHtmlPage(
  bundle: LockedHtmlBundle | { ciphertext: string; salt: string; iv: string },
  username: string,
): string {
  const sealed: LockedHtmlBundle = {
    ciphertext: bundle.ciphertext,
    salt: bundle.salt,
    iv: (bundle as LockedHtmlBundle).iv || (bundle as any).iv,
    wrappedDekPassword: (bundle as LockedHtmlBundle).wrappedDekPassword || '',
    wrappedDekIv: (bundle as LockedHtmlBundle).wrappedDekIv || '',
    passkey: (bundle as LockedHtmlBundle).passkey || null,
  };

  const legacyDirect =
    !sealed.wrappedDekPassword
      ? 'true'
      : 'false';

  const passkeyJson = sealed.passkey ? JSON.stringify(sealed.passkey) : 'null';

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>Kylrix Transfer · Locked backup</title>
  <style>
    :root { color-scheme: dark; }
    * { box-sizing: border-box; }
    body {
      margin: 0;
      min-height: 100dvh;
      font-family: "Satoshi", "Segoe UI", system-ui, sans-serif;
      background: #161412;
      color: #fff;
    }
    .shell {
      min-height: 100dvh;
      display: flex;
      align-items: center;
      justify-content: center;
      padding: 24px;
    }
    .card {
      width: 100%;
      max-width: 420px;
      background: #000;
      border: 2px solid rgba(255,255,255,0.2);
      border-radius: 28px;
      padding: 28px 24px;
    }
    .brand {
      width: 10px; height: 10px; border-radius: 2px; background: #10B981; display: inline-block;
    }
    h1 { font-family: "Clash Display", "Segoe UI", sans-serif; font-size: 1.35rem; margin: 12px 0 4px; }
    .meta { font-size: 0.72rem; letter-spacing: 0.08em; text-transform: uppercase; font-weight: 500; margin: 0 0 20px; }
    label { display: block; font-size: 0.72rem; letter-spacing: 0.08em; text-transform: uppercase; margin-bottom: 8px; }
    input[type=password] {
      width: 100%; padding: 14px 16px; border-radius: 14px; border: 1px solid rgba(255,255,255,0.2);
      background: #161412; color: #fff; font-size: 0.95rem; outline: none;
    }
    input[type=password]:focus { border-color: #10B981; }
    .btn {
      width: 100%; margin-top: 14px; padding: 14px; border-radius: 14px; border: none;
      font-weight: 800; font-size: 0.9rem; cursor: pointer;
    }
    .btn-primary { background: #10B981; color: #000; }
    .btn-ghost {
      background: #161412; color: #fff; border: 1px solid rgba(255,255,255,0.2);
    }
    .btn:disabled { opacity: 0.5; cursor: wait; }
    .err {
      display: none; margin-top: 12px; padding: 12px; border-radius: 12px;
      border: 1px solid rgba(255,255,255,0.2); background: #161412; font-size: 0.85rem; font-weight: 700;
    }
    .err.show { display: block; }
    .passkey-orb {
      width: 72px; height: 72px; margin: 8px auto 12px; border-radius: 999px;
      border: 2px solid rgba(255,255,255,0.25); display: flex; align-items: center; justify-content: center;
      background: #161412; cursor: pointer;
    }
    .passkey-orb:hover { border-color: #10B981; }
    .hidden { display: none !important; }
    #dashboard {
      width: 100%; max-width: 960px; background: #000; border: 2px solid rgba(255,255,255,0.2);
      border-radius: 28px; padding: 24px; max-height: 90dvh; overflow: auto;
    }
    table { width: 100%; border-collapse: collapse; font-size: 0.85rem; }
    th, td { text-align: left; padding: 10px 8px; border-bottom: 1px solid rgba(255,255,255,0.1); vertical-align: top; }
    th { font-size: 0.72rem; letter-spacing: 0.08em; text-transform: uppercase; }
    .tabbar { display: flex; gap: 8px; margin: 16px 0; }
    .tab {
      flex: 1; padding: 10px; border-radius: 12px; border: 1px solid rgba(255,255,255,0.2);
      background: #161412; color: #fff; font-weight: 800; cursor: pointer;
    }
    .tab.active { background: #10B981; color: #000; border-color: #10B981; }
  </style>
</head>
<body>
  <div class="shell">
    <div id="unlock" class="card">
      <span class="brand"></span>
      <h1>Confirm access</h1>
      <p class="meta">Locked backup · ${username.replace(/[<>&"]/g, '')}</p>

      <div id="passkey-block" class="${sealed.passkey ? '' : 'hidden'}">
        <button type="button" class="passkey-orb" id="passkey-btn" title="Unlock with passkey" aria-label="Unlock with passkey">
          <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="#10B981" stroke-width="2"><path d="M12 11c1.66 0 3-1.34 3-3S13.66 5 12 5 9 6.34 9 8s1.34 3 3 3zm0 2c-2.33 0-7 1.17-7 3.5V19h14v-2.5c0-2.33-4.67-3.5-7-3.5z"/></svg>
        </button>
        <p class="meta" style="text-align:center;margin-bottom:16px">Tap to verify with passkey</p>
        <button type="button" class="btn btn-ghost" id="switch-password">Use password instead</button>
      </div>

      <form id="password-block" class="${sealed.passkey ? 'hidden' : ''}">
        <label for="password">Master password</label>
        <input id="password" type="password" autocomplete="current-password" placeholder="••••••••" required />
        <button class="btn btn-primary" type="submit" id="unlock-btn">Unlock backup</button>
        ${sealed.passkey ? '<button type="button" class="btn btn-ghost" id="switch-passkey">Use passkey instead</button>' : ''}
      </form>

      <div id="error" class="err"></div>
    </div>

    <div id="dashboard" class="hidden">
      <div style="display:flex;justify-content:space-between;gap:12px;align-items:center;flex-wrap:wrap">
        <div>
          <h1 style="margin:0">Transfer backup</h1>
          <p class="meta" id="export-info"></p>
        </div>
        <button class="btn btn-ghost" style="width:auto;margin:0" id="download-json">Download JSON</button>
      </div>
      <div class="tabbar">
        <button type="button" class="tab active" data-tab="secrets">Secrets</button>
        <button type="button" class="tab" data-tab="totp">Smart codes</button>
      </div>
      <input id="search" type="search" placeholder="Search…" style="width:100%;padding:12px 14px;border-radius:12px;border:1px solid rgba(255,255,255,0.2);background:#161412;color:#fff;margin-bottom:12px" />
      <div id="list"></div>
    </div>
  </div>

  <script>
    const BUNDLE = {
      ciphertext: ${JSON.stringify(sealed.ciphertext)},
      salt: ${JSON.stringify(sealed.salt)},
      iv: ${JSON.stringify(sealed.iv)},
      wrappedDekPassword: ${JSON.stringify(sealed.wrappedDekPassword)},
      wrappedDekIv: ${JSON.stringify(sealed.wrappedDekIv)},
      passkey: ${passkeyJson},
      legacyDirect: ${legacyDirect}
    };

    let payload = null;
    let activeTab = 'secrets';

    function b64ToBytes(b64) {
      return Uint8Array.from(atob(b64), c => c.charCodeAt(0));
    }
    function showError(msg) {
      const el = document.getElementById('error');
      el.textContent = msg;
      el.classList.add('show');
    }
    function clearError() {
      document.getElementById('error').classList.remove('show');
    }

    async function derivePasswordKey(password, salt) {
      const keyMaterial = await crypto.subtle.importKey('raw', new TextEncoder().encode(password), { name: 'PBKDF2' }, false, ['deriveKey']);
      return crypto.subtle.deriveKey(
        { name: 'PBKDF2', salt, iterations: 210000, hash: 'SHA-256' },
        keyMaterial,
        { name: 'AES-GCM', length: 256 },
        false,
        ['decrypt', 'unwrapKey']
      );
    }

    async function decryptWithDek(dek) {
      const plain = await crypto.subtle.decrypt(
        { name: 'AES-GCM', iv: b64ToBytes(BUNDLE.iv) },
        dek,
        b64ToBytes(BUNDLE.ciphertext)
      );
      return JSON.parse(new TextDecoder().decode(plain));
    }

    async function unlockWithPassword(password) {
      const salt = b64ToBytes(BUNDLE.salt);
      const passwordKey = await derivePasswordKey(password, salt);
      if (BUNDLE.legacyDirect === true || !BUNDLE.wrappedDekPassword) {
        // Legacy: ciphertext encrypted directly with password-derived key
        const plain = await crypto.subtle.decrypt(
          { name: 'AES-GCM', iv: b64ToBytes(BUNDLE.iv) },
          passwordKey,
          b64ToBytes(BUNDLE.ciphertext)
        );
        return JSON.parse(new TextDecoder().decode(plain));
      }
      const dek = await crypto.subtle.unwrapKey(
        'raw',
        b64ToBytes(BUNDLE.wrappedDekPassword),
        passwordKey,
        { name: 'AES-GCM', iv: b64ToBytes(BUNDLE.wrappedDekIv) },
        { name: 'AES-GCM', length: 256 },
        false,
        ['decrypt']
      );
      return decryptWithDek(dek);
    }

    async function unlockWithPasskey() {
      if (!BUNDLE.passkey) throw new Error('Passkey unlock not available for this file.');
      const challenge = crypto.getRandomValues(new Uint8Array(32));
      const prfSalt = b64ToBytes(BUNDLE.passkey.prfSalt);
      const credId = b64ToBytes(BUNDLE.passkey.credentialId);
      const assertion = await navigator.credentials.get({
        publicKey: {
          challenge,
          timeout: 60000,
          userVerification: 'required',
          allowCredentials: [{ type: 'public-key', id: credId }],
          extensions: { prf: { eval: { first: prfSalt } } }
        }
      });
      const ext = assertion.getClientExtensionResults();
      const prfFirst = ext && ext.prf && ext.prf.results && ext.prf.results.first;
      if (!prfFirst) throw new Error('This passkey cannot unlock the file (PRF unavailable). Use password.');
      const prfKey = await crypto.subtle.importKey('raw', prfFirst, { name: 'AES-GCM', length: 256 }, false, ['unwrapKey']);
      const dek = await crypto.subtle.unwrapKey(
        'raw',
        b64ToBytes(BUNDLE.passkey.wrappedDek),
        prfKey,
        { name: 'AES-GCM', iv: b64ToBytes(BUNDLE.passkey.wrappedDekIv) },
        { name: 'AES-GCM', length: 256 },
        false,
        ['decrypt']
      );
      return decryptWithDek(dek);
    }

    function vaultParts(data) {
      const vault = (data && data.data && data.data.vault) || data || {};
      return {
        credentials: Array.isArray(vault.credentials) ? vault.credentials : (Array.isArray(data.credentials) ? data.credentials : []),
        totpSecrets: Array.isArray(vault.totpSecrets) ? vault.totpSecrets : (Array.isArray(data.totpSecrets) ? data.totpSecrets : [])
      };
    }

    function render() {
      const { credentials, totpSecrets } = vaultParts(payload);
      const q = (document.getElementById('search').value || '').toLowerCase().trim();
      const rows = activeTab === 'totp' ? totpSecrets : credentials;
      const filtered = rows.filter((item) => {
        const blob = JSON.stringify(item).toLowerCase();
        return !q || blob.includes(q);
      });
      document.getElementById('export-info').textContent =
        (payload && payload.exportedAt ? ('Exported ' + new Date(payload.exportedAt).toLocaleString() + ' · ') : '') +
        filtered.length + ' / ' + rows.length + ' shown';

      if (activeTab === 'totp') {
        document.getElementById('list').innerHTML = '<table><thead><tr><th>Issuer</th><th>Account</th><th>Secret</th></tr></thead><tbody>' +
          filtered.map((t) => '<tr><td>' + escapeHtml(t.issuer || '') + '</td><td>' + escapeHtml(t.accountName || '') + '</td><td><code>' + escapeHtml(t.secretKey || '') + '</code></td></tr>').join('') +
          '</tbody></table>';
      } else {
        document.getElementById('list').innerHTML = '<table><thead><tr><th>Name</th><th>Username</th><th>Password</th><th>URL</th></tr></thead><tbody>' +
          filtered.map((c) => '<tr><td>' + escapeHtml(c.name || '') + '</td><td>' + escapeHtml(c.username || '') + '</td><td><code>' + escapeHtml(c.password || '') + '</code></td><td>' + escapeHtml(c.url || '') + '</td></tr>').join('') +
          '</tbody></table>';
      }
    }

    function escapeHtml(s) {
      return String(s).replace(/[&<>"']/g, (ch) => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[ch]));
    }

    async function enterDashboard(data) {
      payload = data;
      document.getElementById('unlock').classList.add('hidden');
      document.getElementById('dashboard').classList.remove('hidden');
      render();
    }

    document.getElementById('password-block').addEventListener('submit', async (e) => {
      e.preventDefault();
      clearError();
      const btn = document.getElementById('unlock-btn');
      btn.disabled = true;
      btn.textContent = 'Unlocking…';
      try {
        const data = await unlockWithPassword(document.getElementById('password').value);
        await enterDashboard(data);
      } catch (err) {
        showError('Unlock failed. Check the password.');
        btn.disabled = false;
        btn.textContent = 'Unlock backup';
      }
    });

    const passkeyBtn = document.getElementById('passkey-btn');
    if (passkeyBtn) {
      passkeyBtn.addEventListener('click', async () => {
        clearError();
        try {
          const data = await unlockWithPasskey();
          await enterDashboard(data);
        } catch (err) {
          showError(err && err.message ? err.message : 'Passkey unlock failed.');
        }
      });
    }
    const switchPassword = document.getElementById('switch-password');
    if (switchPassword) switchPassword.addEventListener('click', () => {
      document.getElementById('passkey-block').classList.add('hidden');
      document.getElementById('password-block').classList.remove('hidden');
    });
    const switchPasskey = document.getElementById('switch-passkey');
    if (switchPasskey) switchPasskey.addEventListener('click', () => {
      document.getElementById('password-block').classList.add('hidden');
      document.getElementById('passkey-block').classList.remove('hidden');
    });

    document.querySelectorAll('.tab').forEach((tab) => {
      tab.addEventListener('click', () => {
        document.querySelectorAll('.tab').forEach((t) => t.classList.remove('active'));
        tab.classList.add('active');
        activeTab = tab.getAttribute('data-tab');
        render();
      });
    });
    document.getElementById('search').addEventListener('input', render);
    document.getElementById('download-json').addEventListener('click', () => {
      const blob = new Blob([JSON.stringify(payload, null, 2)], { type: 'application/json' });
      const a = document.createElement('a');
      a.href = URL.createObjectURL(blob);
      a.download = 'kylrix-unlocked-backup.json';
      a.click();
    });
  </script>
</body>
</html>`;
}
