import type { NextRequest } from 'next/server';
import type { ApiActor } from '@/lib/api/guard';

export async function readV1Body(req: NextRequest): Promise<Record<string, unknown>> {
  const raw = await req.json().catch(() => ({}));
  return raw && typeof raw === 'object' && !Array.isArray(raw) ? (raw as Record<string, unknown>) : {};
}

export interface V1DispatchContext {
  req: NextRequest;
  parts: string[];
  actor: ApiActor;
  method: string;
  a: string | undefined;
  b: string | undefined;
  c: string | undefined;
  d: string | undefined;
  limit: () => number;
  mekHeader: string | null;
  shareKeyHeader: string | null;
  masterPassHeader: string | null;
  formatParam: string | null;
  pureParam: boolean;
  readBody: () => Promise<Record<string, unknown>>;
  params: URLSearchParams;
}

export function createV1DispatchContext(
  req: NextRequest,
  parts: string[],
  actor: ApiActor,
): V1DispatchContext {
  const [a, b, c, d] = parts;
  return {
    req,
    parts,
    actor,
    method: req.method.toUpperCase(),
    a,
    b,
    c,
    d,
    limit: () => Number(req.nextUrl.searchParams.get('limit') || 25),
    mekHeader:
      req.headers.get('x-kylrix-mek') ||
      req.headers.get('X-Kylrix-MEK') ||
      req.nextUrl.searchParams.get('mek'),
    shareKeyHeader:
      req.headers.get('x-share-key') ||
      req.headers.get('X-Share-Key') ||
      req.nextUrl.searchParams.get('shareKey') ||
      req.nextUrl.searchParams.get('key'),
    masterPassHeader:
      req.headers.get('x-master-password') ||
      req.headers.get('X-Master-Password') ||
      req.headers.get('x-masterpass') ||
      req.nextUrl.searchParams.get('masterPassword'),
    formatParam: req.nextUrl.searchParams.get('format'),
    pureParam: req.nextUrl.searchParams.get('pure') === 'true',
    readBody: () => readV1Body(req),
    params: req.nextUrl.searchParams,
  };
}

export type V1RouteHandler = (ctx: V1DispatchContext) => Promise<Response | null>;

export interface V1RouteRule {
  id: string;
  match: (ctx: V1DispatchContext) => boolean;
  handle: V1RouteHandler;
}

export function methodIs(ctx: V1DispatchContext, ...methods: string[]) {
  return methods.includes(ctx.method);
}
