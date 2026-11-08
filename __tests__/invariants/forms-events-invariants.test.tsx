import { describe, it, expect, vi, beforeEach } from 'vitest';
import { TursoDatabaseAdapter } from '@/lib/db/repository';
import fs from 'node:fs';
import path from 'node:path';

const mockFormSubmissionsRows: any[] = [];

vi.mock('@/lib/realtime/partykit', () => ({
  broadcastRealtimeEvent: vi.fn(async () => {}),
}));

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

describe('Forms & Events Invariants (forms-events-invariants.test.tsx)', () => {
  beforeEach(() => {
    mockFormSubmissionsRows.length = 0;
  });

  describe('Creator and User Query Invariant', () => {
    it('listFormsTurso and listEventsTurso query across both userId and creatorId', () => {
      const tursoOpsFile = path.resolve(process.cwd(), 'lib/actions/turso-ops.ts');
      const content = fs.readFileSync(tursoOpsFile, 'utf-8');

      // Assert listFormsTurso includes or(inArray(schema.forms.userId, allUserIds), inArray(schema.forms.creatorId, allUserIds))
      expect(content).toMatch(/inArray\(\s*schema\.forms\.userId\s*,\s*allUserIds\s*\)/);
      expect(content).toMatch(/inArray\(\s*schema\.forms\.creatorId\s*,\s*allUserIds\s*\)/);

      // Assert listEventsTurso includes or(inArray(schema.events.userId, allUserIds), inArray(schema.events.creatorId, allUserIds))
      expect(content).toMatch(/inArray\(\s*schema\.events\.userId\s*,\s*allUserIds\s*\)/);
      expect(content).toMatch(/inArray\(\s*schema\.events\.creatorId\s*,\s*allUserIds\s*\)/);
    });
  });

  describe('Form Submissions Serialization and Column Mapping', () => {
    it('cleanly serializes payload and metadata into JSON strings without column transposition errors', async () => {
      const adapter = new TursoDatabaseAdapter();
      const submissionInput = {
        form_id: 'form_prod_survey',
        submitter_id: 'usr_respondent_456',
        payload: {
          satisfaction: 10,
          featureRequests: ['offline-sync', 'passkey-login'],
        },
        metadata: {
          browser: 'Firefox',
          country: 'CA',
        },
        is_public: true,
        is_guest: false,
      };

      const res = await adapter.createRow<any>(
        'turso',
        'form_submissions',
        'sub_test_001',
        submissionInput
      );

      expect(res).toBeDefined();
      expect(mockFormSubmissionsRows).toHaveLength(1);

      const inserted = mockFormSubmissionsRows[0];
      // Invariant: formId and submitterId correctly camelCased
      expect(inserted.formId).toBe('form_prod_survey');
      expect(inserted.submitterId).toBe('usr_respondent_456');

      // Invariant: payload is a valid JSON string
      expect(typeof inserted.payload).toBe('string');
      const parsedPayload = JSON.parse(inserted.payload);
      expect(parsedPayload.satisfaction).toBe(10);
      expect(parsedPayload.featureRequests).toEqual(['offline-sync', 'passkey-login']);

      // Invariant: metadata is a valid JSON string
      expect(typeof inserted.metadata).toBe('string');
      const parsedMetadata = JSON.parse(inserted.metadata);
      expect(parsedMetadata.browser).toBe('Firefox');
      expect(parsedMetadata.country).toBe('CA');

      // Invariant: legacy keys must not be passed to SQL column bindings
      expect(inserted.form_id).toBeUndefined();
      expect(inserted.submitter_id).toBeUndefined();
      expect(inserted.is_public).toBeUndefined();
      expect(inserted.is_guest).toBeUndefined();
    });
  });
});
