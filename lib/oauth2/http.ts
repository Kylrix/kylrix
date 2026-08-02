import { client } from '@/lib/appwrite/client';

export class OAuth2HttpError extends Error {
  status: number;
  code?: string;
  response?: string;
  constructor(message: string, status: number, code?: string, response?: string) {
    super(message);
    this.name = 'OAuth2HttpError';
    this.status = status;
    this.code = code;
    this.response = response;
  }
}

function cleanParams(input?: Record<string, unknown>): Record<string, unknown> {
  if (!input) return {};
  const out: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(input)) {
    if (v === undefined) continue;
    out[k] = v;
  }
  return out;
}

function toOAuth2Error(err: unknown): OAuth2HttpError {
  const e = err as any;
  if (e instanceof OAuth2HttpError) return e;

  const message = String(e?.message || err || 'Request failed');
  const status = typeof e?.code === 'number' ? e.code : typeof e?.status === 'number' ? e.status : 0;
  const type = typeof e?.type === 'string' ? e.type : undefined;
  const response = typeof e?.response === 'string' ? e.response : undefined;

  // Browser network/CORS failures surface as TypeError: Failed to fetch with no status.
  if (/failed to fetch|networkerror|load failed/i.test(message)) {
    return new OAuth2HttpError(
      'Could not reach Appwrite Apps API. Check you are signed in, then try again.',
      0,
      'network_error',
      response
    );
  }

  return new OAuth2HttpError(message, status || 500, type, response);
}

/**
 * Session-authenticated Appwrite REST call via the shared Web SDK client.
 * Uses the same cookie-fallback + credentials path as TablesDB CRUD (not a bare fetch).
 */
export async function appwriteSessionFetch<T = unknown>(
  method: string,
  path: string,
  opts?: {
    body?: Record<string, unknown>;
    query?: Record<string, string | string[] | undefined | null>;
  }
): Promise<T> {
  try {
    const endpoint = (client as any).config?.endpoint as string;
    if (!endpoint) {
      throw new OAuth2HttpError('Appwrite client is not configured', 500, 'misconfigured');
    }

    const url = new URL(`${endpoint}${path.startsWith('/') ? path : `/${path}`}`);
    const upper = method.toUpperCase();

    // GET: queries go as params (SDK flattens). POST/PUT/PATCH/DELETE: JSON body.
    if (upper === 'GET') {
      const params: Record<string, unknown> = {};
      if (opts?.query) {
        for (const [k, v] of Object.entries(opts.query)) {
          if (v == null || v === '') continue;
          params[k] = v;
        }
      }
      return (await (client as any).call('get', url, { accept: 'application/json' }, params)) as T;
    }

    const headers: Record<string, string> = {
      'content-type': 'application/json',
      accept: 'application/json',
    };
    const params = cleanParams(opts?.body);

    return (await (client as any).call(upper.toLowerCase(), url, headers, params)) as T;
  } catch (err) {
    throw toOAuth2Error(err);
  }
}
