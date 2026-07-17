'use client';

/**
 * SharedVaultClient — Public read-only view for a shared password credential.
 *
 * Flow:
 *  1. Fetches the public credential row (server already validated isPublic).
 *  2. Decrypts all encrypted fields using the DEK fragment from the URL.
 *  3. Renders name, username, password (masked) with copy buttons.
 *  4. Shows a warning banner that this page is accessible to anyone with the link.
 */

import React, { useState, useEffect, useCallback } from 'react';
import {
  Shield,
  Copy,
  Eye,
  EyeOff,
  Globe,
  ExternalLink,
  CheckCircle2,
  Lock,
  AlertTriangle,
} from 'lucide-react';

interface SharedVaultClientProps {
  credentialId: string;
  dekFragment?: string; // URL-encoded base64 raw AES-GCM 256 key
}

interface DecryptedCredential {
  $id: string;
  name: string;
  username: string | null;
  password: string | null;
  url: string | null;
  notes: string | null;
  itemType: string;
}

const ENCRYPTED_FIELDS_CREDENTIALS = ['name', 'url', 'username', 'password', 'notes', 'customFields'];

async function importDek(dekBase64Safe: string): Promise<CryptoKey> {
  // Input is URL-safe base64 (- → +, _ → /, no padding)
  const base64 = dekBase64Safe.replace(/-/g, '+').replace(/_/g, '/');
  const pad = (4 - (base64.length % 4)) % 4;
  const rawString = atob(base64 + '='.repeat(pad));
  const raw = Uint8Array.from(rawString, (c) => c.charCodeAt(0));
  return crypto.subtle.importKey('raw', raw, { name: 'AES-GCM', length: 256 }, false, ['decrypt']);
}

async function decryptWithDek(ciphertext: string, dek: CryptoKey): Promise<string> {
  try {
    // Format: base64(iv + ciphertext) — matches ecosystemSecurity.decryptWithKey
    const buf = Uint8Array.from(atob(ciphertext), (c) => c.charCodeAt(0));
    const iv = buf.slice(0, 12);
    const data = buf.slice(12);
    const plain = await crypto.subtle.decrypt({ name: 'AES-GCM', iv }, dek, data);
    return new TextDecoder().decode(plain);
  } catch (e) {
    console.error('Decryption error:', e);
    return '[DECRYPTION_FAILED]';
  }
}

function looksEncrypted(val: string): boolean {
  // Encrypted fields are base64 blobs > 20 chars
  return typeof val === 'string' && val.length > 20 && /^[A-Za-z0-9+/=]+$/.test(val);
}

export default function SharedVaultClient({ credentialId, dekFragment, rawCredential }: SharedVaultClientProps & { rawCredential: any }) {
  const [credential, setCredential] = useState<DecryptedCredential | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [showPassword, setShowPassword] = useState(false);
  const [copied, setCopied] = useState<string | null>(null);

  const copyToClipboard = useCallback(async (text: string, field: string) => {
    try {
      await navigator.clipboard.writeText(text);
      setCopied(field);
      setTimeout(() => setCopied(null), 2000);
    } catch {
      // ignore
    }
  }, []);

  useEffect(() => {
    let cancelled = false;

    async function load() {
      setLoading(true);
      setError(null);

      try {
        const raw = rawCredential;
        if (!raw) throw new Error('Failed to load shared credential.');

        if (cancelled) return;

        // If no DEK fragment, display only plaintext-safe fields
        if (!dekFragment) {
          setCredential({
            $id: raw.$id,
            name: raw.name || 'Shared Item',
            username: null,
            password: null,
            url: null,
            notes: null,
            itemType: raw.itemType || 'login',
          });
          return;
        }

        // Decode the DEK from URL — importDek handles URL-safe base64 decoding internally
        const dek = await importDek(dekFragment);

        // Decrypt all encrypted fields
        const decrypt = async (val: string | null | undefined): Promise<string | null> => {
          if (!val) return null;
          if (!looksEncrypted(val)) return val;
          return decryptWithDek(val, dek);
        };

        const decrypted: DecryptedCredential = {
          $id: raw.$id,
          name: (await decrypt(raw.name)) || 'Shared Item',
          username: await decrypt(raw.username),
          password: await decrypt(raw.password),
          url: await decrypt(raw.url),
          notes: await decrypt(raw.notes),
          itemType: raw.itemType || 'login',
        };

        if (!cancelled) setCredential(decrypted);
      } catch (err: any) {
        if (!cancelled) setError(err.message || 'Unknown error');
      } finally {
        if (!cancelled) setLoading(false);
      }
    }

    load();
    return () => { cancelled = true; };
  }, [credentialId, dekFragment, rawCredential]);

  if (loading) {
    return (
      <div className="shared-vault-wrap">
        <div className="shared-vault-card loading-shimmer">
          <div className="shimmer-line wide" />
          <div className="shimmer-line medium" />
          <div className="shimmer-line narrow" />
        </div>
        <style>{sharedVaultStyles}</style>
      </div>
    );
  }

  if (error) {
    return (
      <div className="shared-vault-wrap">
        <div className="shared-vault-card error-card">
          <AlertTriangle size={40} strokeWidth={1.5} className="error-icon" />
          <h2>Link Unavailable</h2>
          <p>{error}</p>
        </div>
        <style>{sharedVaultStyles}</style>
      </div>
    );
  }

  if (!credential) return null;

  return (
    <div className="shared-vault-wrap">
      <div className="shared-vault-card">
        {/* Header */}
        <div className="svc-header">
          <div className="svc-icon-wrap">
            {credential.url ? (
              <img
                src={`https://www.google.com/s2/favicons?domain=${encodeURIComponent(credential.url)}&sz=64`}
                alt=""
                className="svc-favicon"
                onError={(e) => { (e.target as HTMLImageElement).style.display = 'none'; }}
              />
            ) : (
              <Lock size={28} strokeWidth={1.5} />
            )}
          </div>
          <div className="svc-title-block">
            <h1 className="svc-name">{credential.name}</h1>
            <span className="svc-badge">
              <Globe size={11} />
              Shared Password
            </span>
          </div>
        </div>

        {/* Warning */}
        <div className="svc-warning">
          <Shield size={14} />
          <span>Anyone with this link can view these credentials.</span>
        </div>

        {/* Fields */}
        <div className="svc-fields">
          {credential.url && (
            <div className="svc-field">
              <label>Website</label>
              <div className="svc-field-value">
                <span>{credential.url}</span>
                <div className="svc-actions">
                  <a href={credential.url} target="_blank" rel="noopener noreferrer" className="svc-btn icon-btn" title="Open">
                    <ExternalLink size={14} />
                  </a>
                  <button className="svc-btn icon-btn" onClick={() => copyToClipboard(credential.url!, 'url')} title="Copy">
                    {copied === 'url' ? <CheckCircle2 size={14} className="copied" /> : <Copy size={14} />}
                  </button>
                </div>
              </div>
            </div>
          )}

          {credential.username && (
            <div className="svc-field">
              <label>Username</label>
              <div className="svc-field-value">
                <span>{credential.username}</span>
                <button className="svc-btn icon-btn" onClick={() => copyToClipboard(credential.username!, 'username')} title="Copy">
                  {copied === 'username' ? <CheckCircle2 size={14} className="copied" /> : <Copy size={14} />}
                </button>
              </div>
            </div>
          )}

          {credential.password && (
            <div className="svc-field">
              <label>Password</label>
              <div className="svc-field-value">
                <span className="password-val">
                  {showPassword ? credential.password : '•'.repeat(Math.min(credential.password.length, 20))}
                </span>
                <div className="svc-actions">
                  <button className="svc-btn icon-btn" onClick={() => setShowPassword((p) => !p)} title="Toggle visibility">
                    {showPassword ? <EyeOff size={14} /> : <Eye size={14} />}
                  </button>
                  <button className="svc-btn icon-btn" onClick={() => copyToClipboard(credential.password!, 'password')} title="Copy">
                    {copied === 'password' ? <CheckCircle2 size={14} className="copied" /> : <Copy size={14} />}
                  </button>
                </div>
              </div>
            </div>
          )}

          {credential.notes && (
            <div className="svc-field">
              <label>Notes</label>
              <div className="svc-field-value notes-val">
                <span>{credential.notes}</span>
              </div>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="svc-footer">
          <span>Secured by</span>
          <a href="https://www.kylrix.space" target="_blank" rel="noopener noreferrer" className="svc-brand">
            Kylrix Vault
          </a>
        </div>
      </div>
      <style>{sharedVaultStyles}</style>
    </div>
  );
}

const sharedVaultStyles = `
  .shared-vault-wrap {
    min-height: 100vh;
    display: flex;
    align-items: center;
    justify-content: center;
    padding: 24px 16px;
    background: #0a0a0c;
  }

  .shared-vault-card {
    width: 100%;
    max-width: 480px;
    background: #111115;
    border: 1px solid rgba(255,255,255,0.08);
    border-radius: 20px;
    padding: 32px;
    box-shadow: 0 0 60px rgba(0,0,0,0.6), 0 0 0 1px rgba(255,255,255,0.04) inset;
  }

  .svc-header {
    display: flex;
    align-items: center;
    gap: 16px;
    margin-bottom: 20px;
  }

  .svc-icon-wrap {
    width: 52px;
    height: 52px;
    background: rgba(255,255,255,0.06);
    border-radius: 14px;
    display: flex;
    align-items: center;
    justify-content: center;
    flex-shrink: 0;
    overflow: hidden;
    color: #aaa;
  }

  .svc-favicon {
    width: 32px;
    height: 32px;
    object-fit: contain;
  }

  .svc-title-block {
    min-width: 0;
  }

  .svc-name {
    font-size: 20px;
    font-weight: 700;
    color: #f1f1f1;
    margin: 0 0 6px;
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
  }

  .svc-badge {
    display: inline-flex;
    align-items: center;
    gap: 4px;
    font-size: 11px;
    font-weight: 500;
    color: #aaa;
    background: rgba(255,255,255,0.06);
    border-radius: 20px;
    padding: 3px 10px;
    letter-spacing: 0.02em;
  }

  .svc-warning {
    display: flex;
    align-items: center;
    gap: 8px;
    font-size: 12px;
    color: #d4a24a;
    background: rgba(212,162,74,0.08);
    border: 1px solid rgba(212,162,74,0.15);
    border-radius: 10px;
    padding: 10px 14px;
    margin-bottom: 24px;
  }

  .svc-fields {
    display: flex;
    flex-direction: column;
    gap: 14px;
    margin-bottom: 28px;
  }

  .svc-field label {
    display: block;
    font-size: 11px;
    font-weight: 600;
    color: #666;
    text-transform: uppercase;
    letter-spacing: 0.08em;
    margin-bottom: 6px;
  }

  .svc-field-value {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 8px;
    background: rgba(255,255,255,0.04);
    border: 1px solid rgba(255,255,255,0.07);
    border-radius: 10px;
    padding: 10px 12px;
    min-height: 42px;
  }

  .svc-field-value span {
    font-size: 14px;
    color: #e0e0e0;
    word-break: break-all;
    flex: 1;
    min-width: 0;
  }

  .svc-field-value.notes-val {
    flex-direction: column;
    align-items: flex-start;
  }

  .password-val {
    font-family: 'Courier New', monospace;
    letter-spacing: 0.05em;
  }

  .svc-actions {
    display: flex;
    align-items: center;
    gap: 4px;
    flex-shrink: 0;
  }

  .svc-btn {
    background: none;
    border: none;
    cursor: pointer;
    color: #666;
    display: flex;
    align-items: center;
    justify-content: center;
    padding: 4px;
    border-radius: 6px;
    transition: color 0.15s, background 0.15s;
  }

  .svc-btn:hover {
    color: #e0e0e0;
    background: rgba(255,255,255,0.06);
  }

  .copied {
    color: #4ade80 !important;
  }

  .svc-footer {
    display: flex;
    align-items: center;
    justify-content: center;
    gap: 6px;
    font-size: 12px;
    color: #444;
    border-top: 1px solid rgba(255,255,255,0.05);
    padding-top: 20px;
  }

  .svc-brand {
    color: #888;
    font-weight: 600;
    text-decoration: none;
    transition: color 0.15s;
  }

  .svc-brand:hover { color: #ccc; }

  /* Error card */
  .error-card {
    text-align: center;
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 12px;
    padding: 48px 32px;
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
    max-width: 300px;
    line-height: 1.6;
  }

  .error-icon { color: #888; }

  /* Shimmer loading */
  .loading-shimmer {
    display: flex;
    flex-direction: column;
    gap: 16px;
    padding: 40px 32px;
  }

  .shimmer-line {
    height: 14px;
    background: linear-gradient(90deg, rgba(255,255,255,0.04) 25%, rgba(255,255,255,0.08) 50%, rgba(255,255,255,0.04) 75%);
    background-size: 200% 100%;
    border-radius: 8px;
    animation: shimmer 1.5s infinite;
  }

  .shimmer-line.wide { width: 100%; height: 20px; }
  .shimmer-line.medium { width: 70%; }
  .shimmer-line.narrow { width: 45%; }

  @keyframes shimmer {
    0% { background-position: 200% 0; }
    100% { background-position: -200% 0; }
  }
`;
