import { account } from '@/lib/appwrite/client';
import { APPWRITE_CONFIG } from '@/lib/appwrite/config';

export class OAuth2HttpError extends Error {
  status: number;
  code?: string;
  constructor(message: string, status: number, code?: string) {
    super(message);
    this.name = 'OAuth2HttpError';
    this.status = status;
    this.code = code;
  }
}

async function sessionJwt(): Promise<string> {
  const res = await account.createJWT().catch(() => null);
  const jwt = res?.jwt;
  if (!jwt) {
    throw new OAuth2HttpError('Sign in required', 401, 'unauthorized');
  }
  return jwt;
}

/**
 * Session-authenticated Appwrite REST call (Apps + OAuth2 grant APIs).
 * Uses X-Appwrite-JWT so consent works even when cookies are third-party restricted.
 */
export async function appwriteSessionFetch<T = unknown>(
  method: string,
  path: string,
  opts?: {
    body?: Record<string, unknown>;
    query?: Record<string, string | string[] | undefined | null>;
    /** When false, skip JWT (public endpoints only). Default true. */
    auth?: boolean;
  }
): Promise<T> {
  const url = new URL(`${APPWRITE_CONFIG.ENDPOINT}${path.startsWith('/') ? path : `/${path}`}`);
  if (opts?.query) {
    for (const [k, v] of Object.entries(opts.query)) {
      if (v == null || v === '') continue;
      if (Array.isArray(v)) {
        for (const item of v) url.searchParams.append(k, item);
      } else {
        url.searchParams.set(k, v);
      }
    }
  }

  const headers: Record<string, string> = {
    'X-Appwrite-Project': APPWRITE_CONFIG.PROJECT_ID,
    Accept: 'application/json',
  };

  if (opts?.auth !== false) {
    headers['X-Appwrite-JWT'] = await sessionJwt();
  }

  const hasBody = opts?.body != null && method.toUpperCase() !== 'GET';
  if (hasBody) {
    headers['Content-Type'] = 'application/json';
  }

  const res = await fetch(url.toString(), {
    method: method.toUpperCase(),
    headers,
    body: hasBody ? JSON.stringify(opts!.body) : undefined,
    credentials: 'include',
    cache: 'no-store',
  });

  if (res.status === 204) {
    return undefined as T;
  }

  const text = await res.text();
  let data: any = null;
  if (text) {
    try {
      data = JSON.parse(text);
    } catch {
      data = { message: text };
    }
  }

  if (!res.ok) {
    throw new OAuth2HttpError(
      data?.message || `Appwrite request failed (${res.status})`,
      res.status,
      data?.type || data?.code
    );
  }

  return data as T;
}
