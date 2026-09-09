import { describe, it, expect, beforeEach } from 'vitest';
import { getLastActiveAppRedirectUrl } from './useLastActiveApp';

describe('useLastActiveApp / getLastActiveAppRedirectUrl', () => {
  beforeEach(() => {
    localStorage.clear();
  });

  it('defaults to connect dashboard when localStorage is empty', () => {
    const url = getLastActiveAppRedirectUrl('https://app.kylrix.space/');
    expect(url).toBe('https://app.kylrix.space/connect');
  });

  it('resolves correct dashboard URL for saved app in localStorage', () => {
    localStorage.setItem('kylrix_last_active_app', 'note');
    const url = getLastActiveAppRedirectUrl('https://app.kylrix.space');
    expect(url).toBe('https://app.kylrix.space/app');

    localStorage.setItem('kylrix_last_active_app', 'vault');
    expect(getLastActiveAppRedirectUrl('https://app.kylrix.space')).toBe('https://app.kylrix.space/vault');

    localStorage.setItem('kylrix_last_active_app', 'accounts');
    expect(getLastActiveAppRedirectUrl('https://app.kylrix.space')).toBe('https://app.kylrix.space/accounts/settings/profile');

    localStorage.setItem('kylrix_last_active_app', 'flow');
    expect(getLastActiveAppRedirectUrl('https://app.kylrix.space')).toBe('https://app.kylrix.space/flow');
  });
});
