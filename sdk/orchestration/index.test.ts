import { describe, it, expect } from 'vitest';
import { createCrossObjectMetadata } from './index';

describe('sdk/orchestration', () => {
  it('creates cross object metadata with default values', () => {
    const origin = {
      sourceApp: 'note' as const,
      sourceId: 'note-123',
    };
    const res = createCrossObjectMetadata(origin);
    expect(res).toEqual({
      sourceApp: 'note',
      sourceId: 'note-123',
      sourceKind: null,
      sourceRoute: null,
      surface: 'inline',
      sourceLabel: null,
      openMode: 'same-tab',
      createdAt: expect.any(String),
      minimized: true,
      maximizedRoute: null,
    });
  });

  it('creates cross object metadata with custom options and extra payload', () => {
    const origin = {
      sourceApp: 'vault' as const,
      sourceId: 'v-1',
      sourceKind: 'credential' as const,
      sourceRoute: '/vault/item/1',
      surface: 'drawer' as const,
      sourceLabel: 'Vault Item',
    };
    const res = createCrossObjectMetadata(origin, {
      openMode: 'drawer',
      minimized: false,
      maximizedRoute: '/vault/full',
      extra: { foo: 'bar' },
    });
    expect(res).toEqual({
      sourceApp: 'vault',
      sourceId: 'v-1',
      sourceKind: 'credential',
      sourceRoute: '/vault/item/1',
      surface: 'drawer',
      sourceLabel: 'Vault Item',
      openMode: 'drawer',
      createdAt: expect.any(String),
      minimized: false,
      maximizedRoute: '/vault/full',
      foo: 'bar',
    });
  });
});
