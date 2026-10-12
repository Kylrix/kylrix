import type { QueryExpression } from '@/lib/core/ports/database.port';

/** Backend-agnostic query builders — never import node-appwrite Query in domain code. */
export const q = {
  equal: (attribute: string, value: unknown): QueryExpression => ({ type: 'equal', attribute, value }),
  notEqual: (attribute: string, value: unknown): QueryExpression => ({ type: 'notEqual', attribute, value }),
  lessThan: (attribute: string, value: unknown): QueryExpression => ({ type: 'lessThan', attribute, value }),
  lessThanEqual: (attribute: string, value: unknown): QueryExpression => ({ type: 'lessThanEqual', attribute, value }),
  greaterThan: (attribute: string, value: unknown): QueryExpression => ({ type: 'greaterThan', attribute, value }),
  greaterThanEqual: (attribute: string, value: unknown): QueryExpression => ({ type: 'greaterThanEqual', attribute, value }),
  search: (attribute: string, value: string): QueryExpression => ({ type: 'search', attribute, value }),
  orderAsc: (attribute: string): QueryExpression => ({ type: 'orderAsc', attribute }),
  orderDesc: (attribute: string): QueryExpression => ({ type: 'orderDesc', attribute }),
  limit: (value: number): QueryExpression => ({ type: 'limit', value }),
  offset: (value: number): QueryExpression => ({ type: 'offset', value }),
  select: (value: string[]): QueryExpression => ({ type: 'select', value }),
  contains: (attribute: string, value: unknown): QueryExpression => ({ type: 'contains', attribute, value }),
} as const;

export type { QueryExpression };
