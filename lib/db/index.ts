import { createClient } from '@libsql/client';
import { drizzle } from 'drizzle-orm/libsql';
import * as schema from './schema';

const rawUrl = (process.env.TURSO_DATABASE_URL || '').trim();
// The web standard client supports libsql:, wss:, ws:, https:, http:. Never pass file: which throws URL_SCHEME_NOT_SUPPORTED
const url = rawUrl && !rawUrl.startsWith('file:')
  ? rawUrl
  : 'libsql://kylrix-nathfavour.aws-eu-west-1.turso.io';

const authToken = (process.env.TURSO_AUTH_TOKEN || '').trim() || undefined;

export const client = createClient({
  url,
  authToken,
});

export const db = drizzle(client, { schema });

export * from './schema';
