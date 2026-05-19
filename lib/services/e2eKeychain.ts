// Runtime wrapper for writing e2e identities with validation
import { tablesDB } from '../appwrite/client';
import { APPWRITE_CONFIG } from '../appwrite/config';
import { ID } from 'appwrite';

export async function writeE2EIdentity(userId: string, jwk: any) {
  if (!jwk || jwk?.publicKey?.kty !== 'OKP') {
    throw new Error('INVALID_KEY_TYPE');
  }

  const row = {
    userId,
    type: 'e2e-identity',
    version: 'v2-x25519',
    jwk,
    createdAt: new Date().toISOString()
  };

  return await tablesDB.createRow(APPWRITE_CONFIG.DATABASES.VAULT, APPWRITE_CONFIG.TABLES.VAULT.KEYCHAIN, ID.unique(), row);
}
