import { describe, it, expect } from 'vitest';
import { resolveExecArgs, buildAetEnvVars } from './exec';

describe('resolveExecArgs', () => {
  it('classic: idOrUrl + command after --', () => {
    expect(resolveExecArgs('sec1', undefined, ['sec1', '--', 'node', 'x.js'], false))
      .toEqual({ idOrUrl: 'sec1', command: ['node', 'x.js'] });
  });
  it('classic: variadic command without --', () => {
    expect(resolveExecArgs('sec1', ['node', 'x.js'], ['sec1', 'node', 'x.js'], false))
      .toEqual({ idOrUrl: 'sec1', command: ['node', 'x.js'] });
  });
  it('classic: strips flag tokens only (unchanged legacy behavior)', () => {
    expect(resolveExecArgs('sec1', [], ['sec1', '--share-key', 'k', 'npm', 'start'], false).command)
      .toEqual(['k', 'npm', 'start']);
  });
  it('aet: idOrUrl optional, still needs a command', () => {
    expect(resolveExecArgs(undefined, ['env'], [], true))
      .toEqual({ idOrUrl: undefined, command: ['env'] });
    expect(resolveExecArgs(undefined, undefined, [], true).command).toEqual([]);
  });
  it('aet: idOrUrl before -- is kept', () => {
    expect(resolveExecArgs('sec9', undefined, ['sec9', '--', 'bash'], true))
      .toEqual({ idOrUrl: 'sec9', command: ['bash'] });
  });
});

describe('buildAetEnvVars', () => {
  it('non-env items get KYLRIX_SECRET_<NAME>_* vars', () => {
    const taken = new Set<string>();
    const vars = buildAetEnvVars(
      { id: 'c1' },
      { name: 'Prod DB!', username: 'admin', password: 'pw', url: 'https://db', notes: null, customFields: null },
      taken
    );
    expect(vars).toEqual({
      KYLRIX_SECRET_PROD_DB_USERNAME: 'admin',
      KYLRIX_SECRET_PROD_DB_PASSWORD: 'pw',
      KYLRIX_SECRET_PROD_DB_URL: 'https://db',
    });
  });

  it('name collisions get numeric suffixes', () => {
    const taken = new Set<string>();
    const mk = (id: string) =>
      buildAetEnvVars({ id }, { name: 'API', password: `pw-${id}`, username: null, url: null, notes: null, customFields: null }, taken);
    const a = mk('a');
    const b = mk('b');
    expect(a.KYLRIX_SECRET_API_PASSWORD).toBe('pw-a');
    expect(b.KYLRIX_SECRET_API_PASSWORD_2).toBe('pw-b');
  });

  it('isEnv / dotenv notes expand into raw variables', () => {
    const taken = new Set<string>();
    const vars = buildAetEnvVars(
      { id: 'e1', isEnv: true },
      { name: 'bundle', username: null, password: null, url: null, notes: '# c\nAPI_KEY="abc"\nexport DB_URL=postgres://x\n', customFields: null },
      taken
    );
    expect(vars).toEqual({ API_KEY: 'abc', DB_URL: 'postgres://x' });
  });

  it('falls back to row id when name is blank', () => {
    const vars = buildAetEnvVars(
      { id: 'cred_42' },
      { name: '  ', password: 'x', username: null, url: null, notes: null, customFields: null },
      new Set()
    );
    expect(vars).toEqual({ KYLRIX_SECRET_CRED_42_PASSWORD: 'x' });
  });
});
