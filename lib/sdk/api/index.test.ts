import { describe, expect, it } from 'vitest';
import { buildApiPath, createApiModulePaths } from './index';

describe('api helpers', () => {
  it('builds clean api paths', () => {
    expect(buildApiPath('/api/', '/connect/', '/messages/')).toBe('/api/connect/messages');
  });

  it('creates connect and forward api namespaces', () => {
    const paths = createApiModulePaths('/api');
    expect(paths.connect.messages).toBe('/api/connect/messages');
    expect(paths.forward.send).toBe('/api/forward/send');
  });
});
