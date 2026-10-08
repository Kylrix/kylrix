/**
 * Cloudflare Vectorize & Workers AI Embeddings Client
 * Provides edge vector search and semantic similarity for Kylrix notes and agent memory.
 */

const CLOUDFLARE_ACCOUNT_ID = process.env.CLOUDFLARE_ACCOUNT_ID || '59242241c3c3cb486f3d201d0d89fe6f';
const CLOUDFLARE_API_TOKEN = process.env.CLOUDFLARE_API_TOKEN;
const CLOUDFLARE_VECTORIZE_INDEX = process.env.CLOUDFLARE_VECTORIZE_INDEX || 'kylrix-vectorize';
const EMBEDDING_MODEL = '@cf/baai/bge-small-en-v1.5';

export interface VectorMatch {
  id: string;
  score: number;
  metadata?: Record<string, any>;
}

/**
 * Generate 384-dimensional dense embeddings using Cloudflare Workers AI
 */
export async function generateEmbedding(text: string): Promise<number[]> {
  if (!CLOUDFLARE_API_TOKEN) {
    throw new Error('CLOUDFLARE_API_TOKEN is not configured');
  }

  const url = `https://api.cloudflare.com/client/v4/accounts/${CLOUDFLARE_ACCOUNT_ID}/ai/run/${EMBEDDING_MODEL}`;

  const res = await fetch(url, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${CLOUDFLARE_API_TOKEN}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      text: [text],
    }),
  });

  if (!res.ok) {
    const err = await res.text();
    throw new Error(`Workers AI embedding failed (${res.status}): ${err}`);
  }

  const json = await res.json();
  const vector = json.result?.data?.[0];
  if (!vector || !Array.isArray(vector)) {
    throw new Error('Invalid embedding vector returned from Workers AI');
  }

  return vector;
}

/**
 * Insert or upsert vectors into Cloudflare Vectorize index
 */
export async function upsertVectors(
  vectors: Array<{ id: string; values: number[]; metadata?: Record<string, any> }>
): Promise<{ count: number }> {
  if (!CLOUDFLARE_API_TOKEN) {
    throw new Error('CLOUDFLARE_API_TOKEN is not configured');
  }

  const url = `https://api.cloudflare.com/client/v4/accounts/${CLOUDFLARE_ACCOUNT_ID}/vectorize/v2/indexes/${CLOUDFLARE_VECTORIZE_INDEX}/insert`;

  // Vectorize expects newline-delimited JSON or NDJSON payload
  const ndjson = vectors.map((v) => JSON.stringify(v)).join('\n');

  const res = await fetch(url, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${CLOUDFLARE_API_TOKEN}`,
      'Content-Type': 'application/x-ndjson',
    },
    body: ndjson,
  });

  if (!res.ok) {
    const err = await res.text();
    throw new Error(`Vectorize insert failed (${res.status}): ${err}`);
  }

  const json = await res.json();
  return { count: json.result?.count || vectors.length };
}

/**
 * Perform semantic similarity search using query vector
 */
export async function queryVectorize(
  vector: number[],
  topK: number = 5,
  returnValues: boolean = false
): Promise<VectorMatch[]> {
  if (!CLOUDFLARE_API_TOKEN) {
    throw new Error('CLOUDFLARE_API_TOKEN is not configured');
  }

  const url = `https://api.cloudflare.com/client/v4/accounts/${CLOUDFLARE_ACCOUNT_ID}/vectorize/v2/indexes/${CLOUDFLARE_VECTORIZE_INDEX}/query`;

  const res = await fetch(url, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${CLOUDFLARE_API_TOKEN}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      vector,
      topK,
      returnValues,
      returnMetadata: 'all',
    }),
  });

  if (!res.ok) {
    const err = await res.text();
    throw new Error(`Vectorize query failed (${res.status}): ${err}`);
  }

  const json = await res.json();
  const matches = json.result?.matches || [];
  return matches.map((m: any) => ({
    id: m.id,
    score: m.score,
    metadata: m.metadata,
  }));
}

/**
 * High-level semantic search across indexed items
 */
export async function searchSemantic(queryText: string, topK: number = 5): Promise<VectorMatch[]> {
  const vector = await generateEmbedding(queryText);
  return queryVectorize(vector, topK);
}
