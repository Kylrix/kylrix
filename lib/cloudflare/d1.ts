/**
 * Cloudflare D1 Edge Database Client
 * Serverless distributed SQLite query client using Cloudflare D1 REST API.
 */

const CLOUDFLARE_ACCOUNT_ID = process.env.CLOUDFLARE_ACCOUNT_ID || '59242241c3c3cb486f3d201d0d89fe6f';
const CLOUDFLARE_API_TOKEN = process.env.CLOUDFLARE_API_TOKEN;
const CLOUDFLARE_D1_DATABASE_ID = process.env.CLOUDFLARE_D1_DATABASE_ID || '580f9871-657b-40a1-bdd2-a3f326652be1';

export interface D1QueryResult<T = any> {
  results: T[];
  success: boolean;
  meta?: {
    duration: number;
    rows_read: number;
    rows_written: number;
  };
}

export async function queryD1<T = any>(sql: string, params: any[] = []): Promise<D1QueryResult<T>> {
  if (!CLOUDFLARE_API_TOKEN) {
    throw new Error('CLOUDFLARE_API_TOKEN is not configured');
  }

  const url = `https://api.cloudflare.com/client/v4/accounts/${CLOUDFLARE_ACCOUNT_ID}/d1/database/${CLOUDFLARE_D1_DATABASE_ID}/query`;

  const res = await fetch(url, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${CLOUDFLARE_API_TOKEN}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      sql,
      params,
    }),
  });

  if (!res.ok) {
    const errorText = await res.text();
    throw new Error(`D1 Query failed (${res.status}): ${errorText}`);
  }

  const data = await res.json();
  const firstResult = data.result?.[0] || { results: [], success: data.success };
  return firstResult;
}

export async function executeD1Batch(statements: Array<{ sql: string; params?: any[] }>): Promise<D1QueryResult[]> {
  if (!CLOUDFLARE_API_TOKEN) {
    throw new Error('CLOUDFLARE_API_TOKEN is not configured');
  }

  const url = `https://api.cloudflare.com/client/v4/accounts/${CLOUDFLARE_ACCOUNT_ID}/d1/database/${CLOUDFLARE_D1_DATABASE_ID}/query`;

  const res = await fetch(url, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${CLOUDFLARE_API_TOKEN}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(statements),
  });

  if (!res.ok) {
    const errorText = await res.text();
    throw new Error(`D1 Batch failed (${res.status}): ${errorText}`);
  }

  const data = await res.json();
  return data.result || [];
}
