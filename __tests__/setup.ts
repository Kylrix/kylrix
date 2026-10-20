import { vi } from 'vitest';

function createMockDb() {
  const chain: any = {};
  const methods = [
    'select',
    'from',
    'where',
    'limit',
    'orderBy',
    'insert',
    'values',
    'update',
    'set',
    'delete',
    'onConflictDoNothing',
    'onConflictDoUpdate',
    'returning',
  ];

  methods.forEach((m) => {
    chain[m] = vi.fn().mockImplementation(() => chain);
  });

  chain.then = (resolve: Function) => Promise.resolve([]).then(resolve as any);
  chain.catch = (reject: Function) => Promise.resolve([]).catch(reject as any);

  return chain;
}

vi.mock('@/lib/db', async () => {
  const actualSchema = await vi.importActual<object>('@/lib/db/schema');
  return {
    ...actualSchema,
    db: createMockDb(),
    client: {
      execute: vi.fn().mockResolvedValue({ rows: [] }),
    },
  };
});
