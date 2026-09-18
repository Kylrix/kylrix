import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import {
  isEmailInEngineerList,
  isEngineerUser,
  canExposeLiveErrorsForEmail,
  canExposeLiveErrorsForUser,
} from './engineer-guard';

describe('engineer-guard', () => {
  const origEnv = process.env;

  beforeEach(() => {
    process.env = { ...origEnv };
  });

  afterEach(() => {
    process.env = origEnv;
  });

  it('correctly identifies emails in ENGINEERS env list', () => {
    process.env.ENGINEERS = 'alice@kylrix.space, BOB@kylrix.space ,  charlie@dev.com ';

    expect(isEmailInEngineerList('alice@kylrix.space')).toBe(true);
    expect(isEmailInEngineerList('bob@kylrix.space')).toBe(true);
    expect(isEmailInEngineerList('CHARLIE@DEV.COM')).toBe(true);

    expect(isEmailInEngineerList('eve@hacker.com')).toBe(false);
    expect(isEmailInEngineerList(null)).toBe(false);
    expect(isEmailInEngineerList('')).toBe(false);
  });

  it('correctly checks isEngineerUser object helper', () => {
    process.env.ENGINEERS = 'engineer@kylrix.space';

    expect(isEngineerUser({ email: 'engineer@kylrix.space' })).toBe(true);
    expect(isEngineerUser({ email: 'user@kylrix.space' })).toBe(false);
    expect(isEngineerUser(null)).toBe(false);
    expect(canExposeLiveErrorsForUser({ email: 'engineer@kylrix.space' })).toBe(true);
  });

  it('allows live errors in dev mode regardless of ENGINEERS', () => {
    process.env.NODE_ENV = 'development';
    process.env.ENGINEERS = '';

    expect(canExposeLiveErrorsForEmail('anyuser@example.com')).toBe(true);
  });

  it('restricts live errors in production mode to ENGINEERS list', () => {
    process.env.NODE_ENV = 'production';
    process.env.ENGINEERS = 'lead-eng@kylrix.space';

    expect(canExposeLiveErrorsForEmail('lead-eng@kylrix.space')).toBe(true);
    expect(canExposeLiveErrorsForEmail('normal-user@kylrix.space')).toBe(false);
    expect(canExposeLiveErrorsForEmail(null)).toBe(false);
  });
});
