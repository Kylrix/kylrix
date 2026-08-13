'use client';

import React, { useEffect, useState } from 'react';
import toast from 'react-hot-toast';

export default function VaultTestPage() {
  const [loading, setLoading] = useState(true);
  const [credentials, setCredentials] = useState<any[]>([]);
  const [totpSecrets, setTotpSecrets] = useState<any[]>([]);
  const [rawLogs, setRawLogs] = useState<string[]>([]);
  const [error, setError] = useState<string | null>(null);

  const log = (msg: string) => {
    console.log(`[VaultTest] ${msg}`);
    setRawLogs((prev) => [...prev, `${new Date().toLocaleTimeString()} - ${msg}`]);
  };

  const fetchRawDirect = async () => {
    setLoading(true);
    setError(null);
    setRawLogs([]);
    try {
      log('Initializing direct Appwrite Client SDK fetch (zero wrappers)...');
      const { Client, Databases } = await import('appwrite');
      const { APPWRITE_CONFIG } = await import('@/lib/appwrite/config');

      const client = new Client()
        .setEndpoint(APPWRITE_CONFIG.ENDPOINT)
        .setProject(APPWRITE_CONFIG.PROJECT_ID);

      const databases = new Databases(client);
      const dbId = APPWRITE_CONFIG.DATABASES.VAULT;
      const credsCollId = APPWRITE_CONFIG.TABLES.VAULT.CREDENTIALS;
      const totpCollId = APPWRITE_CONFIG.TABLES.VAULT.TOTP_SECRETS;

      log(`Querying credentials table (${credsCollId}) from database (${dbId})...`);
      const credsRes = await databases.listRows(dbId, credsCollId);
      log(`Credentials returned: total = ${credsRes.total}, count = ${credsRes.rows.length}`);
      setCredentials(credsRes.rows);

      log(`Querying totpSecrets table (${totpCollId}) from database (${dbId})...`);
      const totpRes = await databases.listRows(dbId, totpCollId);
      log(`TOTP Secrets returned: total = ${totpRes.total}, count = ${totpRes.rows.length}`);
      setTotpSecrets(totpRes.rows);
    } catch (err: any) {
      log(`ERROR CAUGHT: ${err?.message || String(err)}`);
      setError(err?.message || String(err));
    } finally {
      setLoading(false);
    }
  };

  const handleCopyDiagnostics = () => {
    const redactedCredentials = credentials.map((c) => ({
      $id: c.$id,
      userId: c.userId,
      itemType: c.itemType,
      name: '[REDACTED_ENCRYPTED_NAME]',
      username: c.username ? '[REDACTED_ENCRYPTED_USERNAME]' : null,
      permissions: c.$permissions,
      isPinned: c.isPinned ?? null,
      isPublic: c.isPublic ?? null,
      isTrash: c.isTrash ?? null,
      $createdAt: c.$createdAt,
      $updatedAt: c.$updatedAt,
    }));

    const redactedTotp = totpSecrets.map((t) => ({
      $id: t.$id,
      userId: t.userId,
      issuer: t.issuer ? '[REDACTED_ENCRYPTED_ISSUER]' : null,
      accountName: t.accountName ? '[REDACTED_ENCRYPTED_ACCOUNT]' : null,
      permissions: t.$permissions,
      isPinned: t.isPinned ?? null,
      isPublic: t.isPublic ?? null,
      isTrash: t.isTrash ?? null,
      $createdAt: t.$createdAt,
      $updatedAt: t.$updatedAt,
    }));

    const report = {
      timestamp: new Date().toISOString(),
      userAgent: typeof navigator !== 'undefined' ? navigator.userAgent : 'N/A',
      error: error || null,
      logs: rawLogs,
      credentialsCount: credentials.length,
      credentials: redactedCredentials,
      totpCount: totpSecrets.length,
      totpSecrets: redactedTotp,
    };

    const text = JSON.stringify(report, null, 2);
    navigator.clipboard.writeText(text);
    toast.success('Diagnostics copied to clipboard (rows redacted)');
  };

  useEffect(() => {
    void fetchRawDirect();
  }, []);

  return (
    <div className="p-8 max-w-5xl mx-auto text-white space-y-8 font-mono text-xs">
      <div className="flex items-center justify-between border-b border-white/10 pb-4">
        <div>
          <h1 className="text-xl font-bold text-emerald-400 font-clash">/vault/test (Detached Raw Diagnostics)</h1>
          <p className="text-white/50 text-xs">Direct Web SDK listRows fetch without any wrappers, caches, or filtering.</p>
        </div>
        <div className="flex items-center gap-3">
          <button
            onClick={handleCopyDiagnostics}
            className="px-4 py-2 bg-indigo-600 hover:bg-indigo-500 text-white font-bold rounded-xl transition-colors border border-indigo-400/30"
          >
            Copy Redacted Diagnostics
          </button>
          <button
            onClick={() => void fetchRawDirect()}
            className="px-4 py-2 bg-emerald-500 hover:bg-emerald-600 text-black font-bold rounded-xl transition-colors"
          >
            Re-Fetch Raw DB
          </button>
        </div>
      </div>

      {error && (
        <div className="p-4 bg-red-950/60 border border-red-500/50 rounded-2xl text-red-300">
          <p className="font-bold text-sm mb-1">Direct Fetch Exception:</p>
          <p>{error}</p>
        </div>
      )}

      {/* Execution Logs */}
      <div className="p-4 bg-black/60 border border-white/10 rounded-2xl space-y-1">
        <p className="text-emerald-400 font-bold mb-2">Execution Logs:</p>
        {rawLogs.map((l, i) => (
          <div key={i} className="text-white/70">{l}</div>
        ))}
      </div>

      {/* Raw Secrets List */}
      <div className="space-y-4">
        <h2 className="text-lg font-bold text-white flex items-center gap-2">
          Raw Credentials Rows ({credentials.length})
        </h2>
        {loading ? (
          <div className="p-8 text-center text-white/40">Loading raw credentials...</div>
        ) : credentials.length === 0 ? (
          <div className="p-8 text-center bg-white/[0.02] border border-white/5 rounded-2xl text-white/40">
            Zero credentials returned directly by Appwrite Client SDK.
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {credentials.map((c) => (
              <div key={c.$id} className="p-4 bg-[#161412] border border-white/10 rounded-2xl space-y-1 overflow-x-auto">
                <p className="text-emerald-400 font-bold">$id: {c.$id}</p>
                <p>userId: {c.userId}</p>
                <p>itemType: {c.itemType}</p>
                <p className="truncate">name (enc): {c.name}</p>
                <p className="truncate">username (enc): {c.username || 'null'}</p>
                <p className="text-[#9B9691]">permissions: {JSON.stringify(c.$permissions)}</p>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Raw TOTP List */}
      <div className="space-y-4">
        <h2 className="text-lg font-bold text-white flex items-center gap-2">
          Raw TOTP Rows ({totpSecrets.length})
        </h2>
        {loading ? (
          <div className="p-8 text-center text-white/40">Loading raw TOTP...</div>
        ) : totpSecrets.length === 0 ? (
          <div className="p-8 text-center bg-white/[0.02] border border-white/5 rounded-2xl text-white/40">
            Zero TOTP secrets returned directly by Appwrite Client SDK.
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {totpSecrets.map((t) => (
              <div key={t.$id} className="p-4 bg-[#161412] border border-white/10 rounded-2xl space-y-1 overflow-x-auto">
                <p className="text-emerald-400 font-bold">$id: {t.$id}</p>
                <p>userId: {t.userId}</p>
                <p className="truncate">issuer (enc): {t.issuer || 'null'}</p>
                <p className="truncate">accountName (enc): {t.accountName || 'null'}</p>
                <p className="text-[#9B9691]">permissions: {JSON.stringify(t.$permissions)}</p>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
