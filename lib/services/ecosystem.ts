import {
  listNotesTurso,
  listVaultItemsTurso,
  listTotpSecretsTurso,
  listEventsTurso,
  upsertNoteTurso,
} from '@/lib/actions/turso-ops';
import { getNamedListCache } from './list-cache';
import { ulid } from '@/lib/utils/ulid';

const notesCache = getNamedListCache<any>('eco_notes', 45000);
const secretsCache = getNamedListCache<any>('eco_secrets', 45000);
const totpCache = getNamedListCache<any>('eco_totp', 45000);
const eventsCache = getNamedListCache<any>('eco_events', 45000);

export const EcosystemService = {
  async listNotes(userId: string, force = false) {
    return notesCache.fetch(async () => {
      const res = await listNotesTurso(userId);
      return { total: (res.rows || []).length, rows: res.rows || [] };
    }, force);
  },

  async createNote(userId: string, title: string, content: string) {
    const id = ulid();
    const now = new Date().toISOString();

    await upsertNoteTurso({
      id,
      userId,
      title,
      content,
      isPublished: true,
      createdAt: now,
      updatedAt: now,
    });

    notesCache.invalidate();

    return { $id: id, id, userId, title, content, createdAt: now, updatedAt: now };
  },

  async listSecrets(userId: string, force = false) {
    return secretsCache.fetch(async () => {
      const res = await listVaultItemsTurso(userId);
      return { total: (res.rows || []).length, rows: res.rows || [] };
    }, force);
  },

  async listTotpSecrets(userId: string, force = false) {
    return totpCache.fetch(async () => {
      const res = await listTotpSecretsTurso(userId);
      return { total: (res.rows || []).length, rows: res.rows || [] };
    }, force);
  },

  async listEvents(userId: string, force = false) {
    return eventsCache.fetch(async () => {
      const res = await listEventsTurso(userId);
      return { total: (res.rows || []).length, rows: res.rows || [] };
    }, force);
  },
};
