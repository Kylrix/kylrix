#!/usr/bin/env ts-node
/*
 Admin-only audit script: enumerates e2e-identity keychain rows and reports kty.
 Requires admin credentials (createAdminClient) and admin access to the VAULT DB.
*/
import { createAdminClient } from '../lib/appwrite/admin';
import { APPWRITE_CONFIG } from '../lib/appwrite/config';

async function run() {
  const client = createAdminClient();
  const DB = APPWRITE_CONFIG.DATABASES.VAULT;
  const TABLE = APPWRITE_CONFIG.TABLES.VAULT.KEYCHAIN;

  const pageSize = 100;
  let cursor: string | undefined = undefined;
  const report: any[] = [];

  try {
    do {
      const res = await client.listRows(DB, TABLE, { limit: pageSize, cursor });
      for (const r of res.rows) {
        if (r.type !== 'e2e-identity') continue;
        try {
          const raw = await decryptWithAdminMEKSafe(r.wrappedKey); // implement securely in admin environment
          const data = JSON.parse(raw);
          report.push({ userId: r.userId, rowId: r.$id, kty: data.publicKey?.kty || 'unknown', createdAt: r.$createdAt });
        } catch (e) {
          report.push({ userId: r.userId, rowId: r.$id, kty: 'decryption-failed', createdAt: r.$createdAt });
        }
      }

      cursor = res.nextCursor;
    } while (cursor);

    console.log(JSON.stringify(report, null, 2));
  } catch (e) {
    console.error('audit failed', e);
    process.exit(2);
  }
}

function decryptWithAdminMEKSafe(_wrappedKey: string): Promise<string> {
  // Placeholder: Admin environments must implement secure MEK handling.
  return Promise.reject(new Error('decryptWithAdminMEKSafe not implemented. Run this script only after wiring admin decrypt helper.'));
}

run();
