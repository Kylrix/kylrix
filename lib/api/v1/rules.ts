import type { V1DispatchContext, V1RouteHandler, V1RouteRule } from '@/lib/api/v1/context';
import { methodIs } from '@/lib/api/v1/context';

export type { V1RouteRule, V1RouteHandler };

export function v1NotFound(message = 'Not found'): never {
  const err = new Error(message);
  (err as any).status = 404;
  (err as any).code = 'not_found';
  throw err;
}

export function v1Gone(message: string): never {
  const err = new Error(message);
  (err as any).status = 410;
  (err as any).code = 'gone';
  throw err;
}

/** Run ordered route rules; throws not_found when no rule matches. */
export async function runV1RouteRules(ctx: V1DispatchContext, rules: V1RouteRule[]) {
  for (const rule of rules) {
    if (rule.match(ctx)) {
      const res = await rule.handle(ctx);
      if (res) return res;
    }
  }
  return v1NotFound();
}

export function v1Rule(
  id: string,
  match: (ctx: V1DispatchContext) => boolean,
  handle: V1RouteHandler,
): V1RouteRule {
  return { id, match, handle };
}

export function segmentIs(ctx: V1DispatchContext, index: 0 | 1 | 2 | 3, value: string) {
  const seg = [ctx.a, ctx.b, ctx.c, ctx.d][index];
  return seg === value;
}

export function segmentAbsent(ctx: V1DispatchContext, index: 0 | 1 | 2 | 3) {
  return ![ctx.a, ctx.b, ctx.c, ctx.d][index];
}

export { methodIs };
