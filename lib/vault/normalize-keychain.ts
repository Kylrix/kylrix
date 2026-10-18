export function normalizeKeychainRow(row: any): any {
  if (!row) return null;
  const metadata = typeof row.metadata === 'string'
    ? (() => { try { return JSON.parse(row.metadata); } catch { return {}; } })()
    : (row.metadata || {});

  let params = row.params ?? metadata.params;
  if (typeof params === 'string') {
    try { params = JSON.parse(params); } catch {}
  }

  const wrappedKey = row.wrappedKey || row.encryptedPayload || '';
  const salt = row.salt || metadata.salt || row.nonce || '';

  const isArgon = row.isArgon ?? metadata.isArgon ?? (
    (typeof params === 'string' && params.includes('Argon2id')) ||
    params?.algo === 'Argon2id' ||
    params?.algorithm === 'Argon2id' ||
    row.algorithm === 'Argon2id' ||
    salt.length === 32 || salt.length === 44
  );

  return {
    ...row,
    $id: row.$id || row.id,
    id: row.id || row.$id,
    wrappedKey,
    salt,
    params,
    isArgon: Boolean(isArgon),
    credentialId: row.credentialId || metadata.credentialId || (row.type === 'passkey' ? row.account : null),
    type: row.type || 'password',
    authPass: row.authPass ?? metadata.authPass ?? true,
    isPending: row.isPending ?? metadata.isPending ?? false,
  };
}
