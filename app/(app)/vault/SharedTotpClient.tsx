'use client';

/**
 * SharedTotpClient — Public read-only view for a shared TOTP secret.
 *
 * Two modes driven by the URL key segment:
 *  A. Seed Share  → /vault/totp/[id]/[dekBase64]
 *     Decrypts secretKey, shows live TOTP code with countdown.
 *  B. Temp 60s   → /vault/totp/[id]/temp/[base64EncodedParams]
 *     Params: { seed: string, start: number, digits: number, step: number, algo: string }
 *     No decryption needed — seed already in plaintext, code derived from start time.
 *     Valid only within 90 seconds of the start timestamp.
 */

import React, { useState, useEffect, useCallback, useRef } from 'react';
import { Shield, Copy, Clock, AlertTriangle, CheckCircle2, RefreshCw } from 'lucide-react';

interface SharedTotpClientProps {
  totpId: string;
  keySegments?: string[]; // URL catch-all key segments: [dekBase64] or ['temp', base64Params]
}

interface TempTotpParams {
  seed: string;       // plaintext TOTP secret
  start: number;      // unix timestamp (ms) when the 60-second window started
  digits: number;
  step: number;       // usually 30
  algo: string;       // SHA1, SHA256, SHA512
}

// ----- TOTP computation (RFC 6238) -----
async function computeTotpCode(secret: string, algo: string, digits: number, step: number, t?: number): Promise<string> {
  const now = t ?? Date.now();
  const counter = Math.floor(now / 1000 / step);

  // base32 decode
  const base32Chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ234567';
  const cleanSecret = secret.toUpperCase().replace(/=+$/, '').replace(/\s/g, '');
  let bits = 0;
  let bitsCount = 0;
  const bytes: number[] = [];
  for (const ch of cleanSecret) {
    const val = base32Chars.indexOf(ch);
    if (val < 0) continue;
    bits = (bits << 5) | val;
    bitsCount += 5;
    if (bitsCount >= 8) {
      bytes.push((bits >>> (bitsCount - 8)) & 0xff);
      bitsCount -= 8;
    }
  }
  const keyBytes = new Uint8Array(bytes);

  // counter → 8 bytes big-endian
  const counterBuf = new ArrayBuffer(8);
  const view = new DataView(counterBuf);
  view.setUint32(4, counter & 0xffffffff, false);
  view.setUint32(0, Math.floor(counter / 0x100000000) & 0xffffffff, false);

  const algoName = algo.toUpperCase().includes('256') ? 'SHA-256' : algo.toUpperCase().includes('512') ? 'SHA-512' : 'SHA-1';
  const cryptoKey = await crypto.subtle.importKey('raw', keyBytes, { name: 'HMAC', hash: algoName }, false, ['sign']);
  const sig = await crypto.subtle.sign('HMAC', cryptoKey, counterBuf);
  const hmac = new Uint8Array(sig);

  const offset = hmac[hmac.length - 1] & 0x0f;
  const code = ((hmac[offset] & 0x7f) << 24) |
               ((hmac[offset + 1] & 0xff) << 16) |
               ((hmac[offset + 2] & 0xff) << 8) |
               (hmac[offset + 3] & 0xff);
  return String(code % Math.pow(10, digits)).padStart(digits, '0');
}

function secondsLeft(step: number): number {
  return step - Math.floor((Date.now() / 1000) % step);
}

function decodeBase64Safe(str: string): string {
  try {
    return atob(str.replace(/-/g, '+').replace(/_/g, '/'));
  } catch {
    return '';
  }
}

async function importDek(dekBase64Safe: string): Promise<CryptoKey> {
  // Input is URL-safe base64 (- → +, _ → /, no padding) — do NOT decodeURIComponent
  const base64 = dekBase64Safe.replace(/-/g, '+').replace(/_/g, '/');
  const pad = (4 - (base64.length % 4)) % 4;
  const rawString = atob(base64 + '='.repeat(pad));
  const raw = Uint8Array.from(rawString, (c) => c.charCodeAt(0));
  return crypto.subtle.importKey('raw', raw, { name: 'AES-GCM', length: 256 }, false, ['decrypt']);
}

async function decryptWithDek(ciphertext: string, dek: CryptoKey): Promise<string> {
  try {
    const buf = Uint8Array.from(atob(ciphertext), (c) => c.charCodeAt(0));
    const iv = buf.slice(0, 12);
    const data = buf.slice(12);
    const plain = await crypto.subtle.decrypt({ name: 'AES-GCM', iv }, dek, data);
    return new TextDecoder().decode(plain);
  } catch (e) {
    console.error('Decryption failed:', e);
    throw new Error('Decryption failed — the key may be invalid or expired.');
  }
}

function looksEncrypted(val: string): boolean {
  return typeof val === 'string' && val.length > 20 && /^[A-Za-z0-9+/=]+$/.test(val);
}

// ─── Main Component ───────────────────────────────────────────────────────────

export default function SharedTotpClient({ totpId, keySegments, rawTotp }: SharedTotpClientProps & { rawTotp: any }) {
  const [state, setState] = useState<
    | { kind: 'loading' }
    | { kind: 'error'; message: string }
    | { kind: 'expired'; message: string }
    | { kind: 'ready'; label: string; code: string; digits: number; step: number; seed: string; algo: string; isTemp: boolean; tempExpiry?: number }
  >({ kind: 'loading' });

  const [code, setCode] = useState('');
  const [secsLeft, setSecsLeft] = useState(30);
  const [copied, setCopied] = useState(false);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const startLive = useCallback((seed: string, digits: number, step: number, algo: string, tempExpiry?: number) => {
    async function tick() {
      if (tempExpiry && Date.now() > tempExpiry) {
        setState({ kind: 'expired', message: 'This temporary code has expired.' });
        if (timerRef.current) clearInterval(timerRef.current);
        return;
      }
      const c = await computeTotpCode(seed, algo, digits, step);
      setCode(c);
      setSecsLeft(secondsLeft(step));
    }

    tick();
    timerRef.current = setInterval(tick, 1000);
  }, []);

  useEffect(() => {
    return () => { if (timerRef.current) clearInterval(timerRef.current); };
  }, []);

  useEffect(() => {
    let cancelled = false;

    async function load() {
      setState({ kind: 'loading' });

      try {
        // ── Mode B: Temp 60s ────────────────────────────────────────────
        if (keySegments && keySegments[0] === 'temp' && keySegments[1]) {
          const decoded = decodeBase64Safe(keySegments[1]);
          if (!decoded) throw new Error('Invalid temp token format.');
          const params: TempTotpParams = JSON.parse(decoded);
          if (!params.seed || !params.start) throw new Error('Malformed temp token.');

          const expiry = params.start + 90_000; // 90-second window
          if (Date.now() > expiry) {
            if (!cancelled) setState({ kind: 'expired', message: 'This 60-second code has expired. Ask for a new link.' });
            return;
          }

          if (!cancelled) {
            setState({
              kind: 'ready',
              label: 'Temporary TOTP Code',
              code: '',
              digits: params.digits || 6,
              step: params.step || 30,
              seed: params.seed,
              algo: params.algo || 'SHA1',
              isTemp: true,
              tempExpiry: expiry,
            });
            startLive(params.seed, params.digits || 6, params.step || 30, params.algo || 'SHA1', expiry);
          }
          return;
        }

        // ── Mode A: Seed DEK share ──────────────────────────────────────
        const dekRaw = keySegments?.[0];
        const raw = rawTotp;
        if (!raw) throw new Error('Failed to load shared TOTP.');

        if (cancelled) return;

        let secretKey = raw.secretKey;
        let issuer = raw.issuer || '';
        let accountName = raw.accountName || '';
        const digits = raw.digits || 6;
        const step = raw.period || 30;
        const algo = raw.algorithm || 'SHA1';

        if (dekRaw) {
          // dekRaw is already URL-decoded by Next.js — pass directly to importDek
          const dek = await importDek(dekRaw);
          if (secretKey && looksEncrypted(secretKey)) secretKey = await decryptWithDek(secretKey, dek);
          if (issuer && looksEncrypted(issuer)) issuer = await decryptWithDek(issuer, dek);
          if (accountName && looksEncrypted(accountName)) accountName = await decryptWithDek(accountName, dek);
        }

        if (!secretKey) throw new Error('Could not retrieve TOTP seed from this link.');

        const label = [issuer, accountName].filter(Boolean).join(' · ') || 'Shared TOTP';

        if (!cancelled) {
          setState({ kind: 'ready', label, code: '', digits, step, seed: secretKey, algo, isTemp: false });
          startLive(secretKey, digits, step, algo);
        }
      } catch (err: any) {
        if (!cancelled) setState({ kind: 'error', message: err.message || 'Unknown error.' });
      }
    }

    load();
    return () => { cancelled = true; };
  }, [totpId, keySegments, startLive]);

  const copyCode = useCallback(async () => {
    if (!code) return;
    try {
      await navigator.clipboard.writeText(code);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch { /**/ }
  }, [code]);

  if (state.kind === 'loading') {
    return (
      <div className="shared-totp-wrap">
        <div className="shared-totp-card shimmer-card">
          <div className="shimmer-line wide" style={{ height: 20 }} />
          <div className="code-placeholder" />
          <div className="shimmer-line narrow" style={{ marginTop: 8 }} />
        </div>
        <style>{styles}</style>
      </div>
    );
  }

  if (state.kind === 'error' || state.kind === 'expired') {
    return (
      <div className="shared-totp-wrap">
        <div className="shared-totp-card error-card">
          <AlertTriangle size={40} strokeWidth={1.5} className="err-icon" />
          <h2>{state.kind === 'expired' ? 'Code Expired' : 'Unavailable'}</h2>
          <p>{state.message}</p>
        </div>
        <style>{styles}</style>
      </div>
    );
  }

  const progress = secsLeft / state.step;
  const urgent = secsLeft <= 5;

  return (
    <div className="shared-totp-wrap">
      <div className="shared-totp-card">
        {/* Header */}
        <div className="stc-header">
          <Shield size={18} strokeWidth={1.5} className="stc-shield" />
          <div>
            <h1 className="stc-label">{state.label}</h1>
            {state.isTemp && (
              <span className="stc-temp-badge">Temporary · Expires soon</span>
            )}
          </div>
        </div>

        {/* Warning */}
        <div className="stc-warning">
          <AlertTriangle size={13} />
          <span>Anyone with this link can see this code.</span>
        </div>

        {/* Code Display */}
        <div className="stc-code-wrap">
          <div className={`stc-code ${urgent ? 'urgent' : ''}`}>
            {code ? code.match(/.{1,3}/g)?.join(' ') : '------'}
          </div>
          <button className="stc-copy-btn" onClick={copyCode} title="Copy code">
            {copied ? <CheckCircle2 size={18} className="copied-icon" /> : <Copy size={18} />}
          </button>
        </div>

        {/* Countdown ring */}
        <div className="stc-timer-row">
          <div className="stc-ring-wrap">
            <svg viewBox="0 0 36 36" className="stc-ring">
              <circle cx="18" cy="18" r="15.9" fill="none" stroke="rgba(255,255,255,0.08)" strokeWidth="2.5" />
              <circle
                cx="18" cy="18" r="15.9"
                fill="none"
                stroke={urgent ? '#ef4444' : '#6366f1'}
                strokeWidth="2.5"
                strokeDasharray={`${progress * 100} 100`}
                strokeLinecap="round"
                transform="rotate(-90 18 18)"
                style={{ transition: 'stroke-dasharray 1s linear, stroke 0.3s' }}
              />
            </svg>
            <span className={`stc-secs ${urgent ? 'urgent-text' : ''}`}>{secsLeft}</span>
          </div>
          <span className="stc-timer-label">
            <Clock size={12} />
            seconds remaining
          </span>
        </div>

        {/* Footer */}
        <div className="stc-footer">
          <span>Secured by</span>
          <a href="https://www.kylrix.space" target="_blank" rel="noopener noreferrer" className="stc-brand">
            Kylrix Vault
          </a>
        </div>
      </div>
      <style>{styles}</style>
    </div>
  );
}

const styles = `
  @import url('https://fonts.googleapis.com/css2?family=Inter:wght@400;600;700&family=JetBrains+Mono:wght@500;700&display=swap');

  .shared-totp-wrap {
    min-height: 100vh;
    display: flex;
    align-items: center;
    justify-content: center;
    padding: 24px 16px;
    background: #0a0a0c;
    font-family: 'Inter', system-ui, sans-serif;
  }

  .shared-totp-card {
    width: 100%;
    max-width: 400px;
    background: #111115;
    border: 1px solid rgba(255,255,255,0.08);
    border-radius: 20px;
    padding: 32px;
    box-shadow: 0 0 60px rgba(0,0,0,0.6), 0 0 0 1px rgba(255,255,255,0.04) inset;
  }

  .stc-header {
    display: flex;
    align-items: flex-start;
    gap: 12px;
    margin-bottom: 18px;
  }

  .stc-shield {
    color: #6366f1;
    margin-top: 2px;
    flex-shrink: 0;
  }

  .stc-label {
    font-size: 17px;
    font-weight: 700;
    color: #f1f1f1;
    margin: 0 0 4px;
    line-height: 1.3;
  }

  .stc-temp-badge {
    font-size: 11px;
    font-weight: 500;
    color: #d4a24a;
    background: rgba(212,162,74,0.12);
    border-radius: 20px;
    padding: 2px 9px;
  }

  .stc-warning {
    display: flex;
    align-items: center;
    gap: 7px;
    font-size: 12px;
    color: #d4a24a;
    background: rgba(212,162,74,0.08);
    border: 1px solid rgba(212,162,74,0.15);
    border-radius: 10px;
    padding: 9px 13px;
    margin-bottom: 28px;
  }

  .stc-code-wrap {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 12px;
    margin-bottom: 22px;
  }

  .stc-code {
    font-family: 'JetBrains Mono', 'Courier New', monospace;
    font-size: 36px;
    font-weight: 700;
    color: #e0e0ff;
    letter-spacing: 0.12em;
    transition: color 0.3s;
    flex: 1;
  }

  .stc-code.urgent {
    color: #ef4444;
    animation: pulse 1s ease-in-out infinite;
  }

  @keyframes pulse {
    0%, 100% { opacity: 1; }
    50% { opacity: 0.7; }
  }

  .stc-copy-btn {
    background: rgba(255,255,255,0.06);
    border: 1px solid rgba(255,255,255,0.08);
    border-radius: 10px;
    color: #888;
    cursor: pointer;
    width: 42px;
    height: 42px;
    display: flex;
    align-items: center;
    justify-content: center;
    transition: background 0.15s, color 0.15s;
    flex-shrink: 0;
  }

  .stc-copy-btn:hover {
    background: rgba(255,255,255,0.1);
    color: #e0e0e0;
  }

  .copied-icon { color: #4ade80; }

  .stc-timer-row {
    display: flex;
    align-items: center;
    gap: 14px;
    margin-bottom: 28px;
  }

  .stc-ring-wrap {
    position: relative;
    width: 44px;
    height: 44px;
    flex-shrink: 0;
  }

  .stc-ring {
    width: 44px;
    height: 44px;
  }

  .stc-secs {
    position: absolute;
    inset: 0;
    display: flex;
    align-items: center;
    justify-content: center;
    font-size: 12px;
    font-weight: 700;
    color: #aaa;
    font-family: 'JetBrains Mono', monospace;
  }

  .stc-secs.urgent-text { color: #ef4444; }

  .stc-timer-label {
    display: flex;
    align-items: center;
    gap: 5px;
    font-size: 13px;
    color: #555;
  }

  .stc-footer {
    display: flex;
    align-items: center;
    justify-content: center;
    gap: 6px;
    font-size: 12px;
    color: #444;
    border-top: 1px solid rgba(255,255,255,0.05);
    padding-top: 20px;
  }

  .stc-brand {
    color: #888;
    font-weight: 600;
    text-decoration: none;
  }

  .stc-brand:hover { color: #ccc; }

  /* Error */
  .error-card {
    text-align: center;
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 12px;
    padding: 40px 24px;
  }

  .error-card h2 {
    font-size: 20px;
    font-weight: 700;
    color: #f1f1f1;
    margin: 0;
  }

  .error-card p {
    font-size: 14px;
    color: #888;
    margin: 0;
    max-width: 280px;
    line-height: 1.6;
  }

  .err-icon { color: #888; }

  /* Shimmer */
  .shimmer-card {
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 20px;
    padding: 40px 32px;
  }

  .shimmer-line {
    height: 14px;
    background: linear-gradient(90deg, rgba(255,255,255,0.04) 25%, rgba(255,255,255,0.08) 50%, rgba(255,255,255,0.04) 75%);
    background-size: 200% 100%;
    border-radius: 8px;
    animation: shimmer 1.5s infinite;
  }

  .shimmer-line.wide { width: 100%; }
  .shimmer-line.narrow { width: 50%; }

  .code-placeholder {
    width: 180px;
    height: 44px;
    border-radius: 10px;
    background: linear-gradient(90deg, rgba(255,255,255,0.04) 25%, rgba(255,255,255,0.08) 50%, rgba(255,255,255,0.04) 75%);
    background-size: 200% 100%;
    animation: shimmer 1.5s infinite;
  }

  @keyframes shimmer {
    0% { background-position: 200% 0; }
    100% { background-position: -200% 0; }
  }
`;
