import { describe, it, expect, vi, beforeEach } from 'vitest';
import { TursoDatabaseAdapter } from '@/lib/db/repository';
import { submitPublicFormDataSecure } from '@/lib/actions/secure-ops/projects';

vi.mock('@/lib/realtime/partykit', () => ({
  broadcastRealtimeEvent: vi.fn(async () => {}),
}));

const mockFormSubmissionsRows: any[] = [];

vi.mock('@/lib/db', async () => {
  const actualSchema = await vi.importActual<typeof import('@/lib/db/schema')>('@/lib/db/schema');
  return {
    db: {
      select: () => ({
        from: (table: any) => ({
          where: () => {
            const list = table === actualSchema.formSubmissions ? mockFormSubmissionsRows : [];
            const res = list.slice();
            const promise: any = Promise.resolve(res);
            promise.limit = (n: number) => Promise.resolve(res.slice(0, n));
            return promise;
          },
        }),
      }),
      insert: (table: any) => ({
        values: (val: any) => {
          const handleInsert = () => {
            if (table === actualSchema.formSubmissions) {
              const idx = mockFormSubmissionsRows.findIndex((r) => r.id === val.id);
              if (idx >= 0) mockFormSubmissionsRows[idx] = val;
              else mockFormSubmissionsRows.push(val);
            }
            return Promise.resolve();
          };
          const res = handleInsert();
          (res as any).onConflictDoUpdate = (_opts: any) => handleInsert();
          (res as any).onConflictDoNothing = () => handleInsert();
          return res;
        },
      }),
      update: (table: any) => ({
        set: (data: any) => ({
          where: () => {
            if (table === actualSchema.formSubmissions && mockFormSubmissionsRows.length > 0) {
              Object.assign(mockFormSubmissionsRows[0], data);
            }
            return Promise.resolve();
          },
        }),
      }),
      delete: () => ({
        where: () => Promise.resolve(),
      }),
    },
  };
});

describe('Form Submission Normalization and CRUD', () => {
  beforeEach(() => {
    mockFormSubmissionsRows.length = 0;
  });

  it('normalizes form submission legacy keys in createRow', async () => {
    const adapter = new TursoDatabaseAdapter();
    const created = await adapter.createRow<any>('turso', 'formSubmissions', 'sub_1', {
      form_id: '6aae3dab003a7247b90a',
      submitter_id: 'usr_abc123',
      payload: { feedback: 'Great app!', rating: 5 },
      metadata: { browser: 'Chrome' },
      is_public: true,
      is_guest: false,
    });

    expect(created).toBeDefined();
    expect(mockFormSubmissionsRows.length).toBe(1);

    const inserted = mockFormSubmissionsRows[0];
    expect(inserted.id).toBe('sub_1');
    expect(inserted.formId).toBe('6aae3dab003a7247b90a');
    expect(inserted.submitterId).toBe('usr_abc123');
    expect(inserted.payload).toBe(JSON.stringify({ feedback: 'Great app!', rating: 5 }));
    expect(inserted.metadata).toBe(JSON.stringify({ browser: 'Chrome' }));
    expect(inserted.isPublic).toBe(true);
    expect(inserted.isGuest).toBe(false);
    expect(inserted.status).toBe('unread');

    // Legacy keys should be cleanly deleted
    expect(inserted.form_id).toBeUndefined();
    expect(inserted.submitter_id).toBeUndefined();
    expect(inserted.is_public).toBeUndefined();
    expect(inserted.is_guest).toBeUndefined();
  });

  it('handles responses fallback and missing submitterId in createRow', async () => {
    const adapter = new TursoDatabaseAdapter();
    const created = await adapter.createRow<any>('turso', 'form_submissions', 'sub_2', {
      formId: 'form_xyz',
      responses: '{"answer":"yes"}',
    });

    expect(created).toBeDefined();
    expect(mockFormSubmissionsRows.length).toBe(1);

    const inserted = mockFormSubmissionsRows[0];
    expect(inserted.id).toBe('sub_2');
    expect(inserted.formId).toBe('form_xyz');
    expect(inserted.submitterId).toBeNull();
    expect(inserted.payload).toBe('{"answer":"yes"}');
    expect(inserted.isPublic).toBe(true);
    expect(inserted.isGuest).toBe(true);
    expect(inserted.isTrash).toBe(false);
    expect(inserted.responses).toBeUndefined();
  });

  it('normalizes form submission legacy keys in updateRow', async () => {
    const adapter = new TursoDatabaseAdapter();
    // Pre-insert an item
    mockFormSubmissionsRows.push({
      id: 'sub_update_1',
      formId: 'form_123',
      submitterId: null,
      payload: '{}',
      status: 'unread',
      isPublic: true,
      isGuest: true,
      isTrash: false,
    });

    const updated = await adapter.updateRow<any>('turso', 'formSubmissions', 'sub_update_1', {
      status: 'read',
      is_trash: true,
      metadata: { reviewer: 'admin' },
    });

    expect(updated).toBeDefined();
    expect(mockFormSubmissionsRows[0].formId).toBe('form_123'); // Unchanged!
    expect(mockFormSubmissionsRows[0].payload).toBe('{}'); // Unchanged!
    expect(mockFormSubmissionsRows[0].status).toBe('read');
    expect(mockFormSubmissionsRows[0].isTrash).toBe(true);
    expect(mockFormSubmissionsRows[0].metadata).toBe(JSON.stringify({ reviewer: 'admin' }));
    expect(mockFormSubmissionsRows[0].is_trash).toBeUndefined();
  });

  it('submitPublicFormDataSecure serializes payload and metadata objects correctly', async () => {
    const res = await submitPublicFormDataSecure({
      formId: '6aae3dab003a7247b90a',
      payload: { feature: 'Dark mode improvements' } as any,
      metadata: { source: 'settings' } as any,
      submitterId: 'user_dev',
    });

    expect(res).toBeDefined();
    expect(res.payload).toBe(JSON.stringify({ feature: 'Dark mode improvements' }));
    expect(res.metadata).toBe(JSON.stringify({ source: 'settings' }));

    const inserted = mockFormSubmissionsRows.find((r) => r.formId === '6aae3dab003a7247b90a');
    expect(inserted).toBeDefined();
    expect(inserted?.payload).toBe(JSON.stringify({ feature: 'Dark mode improvements' }));
    expect(inserted?.metadata).toBe(JSON.stringify({ source: 'settings' }));
  });
});
