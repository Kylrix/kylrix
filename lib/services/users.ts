import { ulid } from '@/lib/utils/ulid';
import { seedIdentityCache } from '../identity-cache';
import { db } from '@/lib/db';
import * as schema from '@/lib/db/schema';
import { eq, inArray } from 'drizzle-orm';

const PROFILE_ROW_TTL_MS = 15 * 60 * 1000;
const profileRowCache = new Map<string, { row: any; at: number }>();

function normalizeUsernameSuggestion(input: string | null | undefined): string | null {
  if (!input) return null;
  const cleaned = input
    .toString()
    .trim()
    .replace(/^@+/, '')
    .toLowerCase()
    .replace(/[^a-z0-9_]/g, '');
  return cleaned || null;
}

function deriveUsernameCandidates(user: { $id: string; email?: string; name?: string }): string[] {
  const nameParts = user.name ? user.name.trim().split(/\s+/).filter(Boolean) : [];
  const firstName = nameParts[0] || '';
  const surname = nameParts[1] || '';
  const emailPrefix = user.email ? user.email.split('@')[0].replace(/[^a-zA-Z0-9_]/g, '') : '';
  const raw = [
    normalizeUsernameSuggestion(firstName),
    normalizeUsernameSuggestion(surname),
    normalizeUsernameSuggestion(emailPrefix),
    normalizeUsernameSuggestion(`u${user.$id.slice(0, 12)}`),
  ].filter(Boolean) as string[];
  return Array.from(new Set(raw));
}

function fallbackUsernameFromUser(userId: string, email?: string | null): string {
  const ep = email ? normalizeUsernameSuggestion(email.split('@')[0].replace(/[^a-zA-Z0-9_]/g, '')) : null;
  if (ep && ep.length >= 3) return ep;
  const fb = normalizeUsernameSuggestion(`u${userId.slice(0, 12)}`);
  return fb && fb.length >= 3 ? fb : `u${userId.slice(0, 12)}`;
}

export function buildUsernameHandleSuggestions(user: {
  $id: string;
  email?: string | null;
  name?: string | null;
}): string[] {
  const candidates = deriveUsernameCandidates({
    $id: user.$id,
    email: user.email ?? undefined,
    name: user.name ?? undefined,
  });
  const out: string[] = [];
  for (const c of candidates) {
    const n = normalizeUsernameSuggestion(c);
    if (n && n.length >= 3) out.push(n);
  }
  const fb = normalizeUsernameSuggestion(fallbackUsernameFromUser(user.$id, user.email ?? null));
  if (fb && fb.length >= 3) out.push(fb);
  return Array.from(new Set(out)).slice(0, 6);
}

function rememberProfileRow(row: any | null, lookupKey: string) {
  if (!row) return;
  const at = Date.now();
  profileRowCache.set(lookupKey, { row, at });
  if (row.id) profileRowCache.set(row.id, { row, at });
  if (row.userId) profileRowCache.set(row.userId, { row, at });
  if (row.username) profileRowCache.set(row.username.toLowerCase(), { row, at });
  seedIdentityCache(row);
}

export function invalidateUsersProfileRowCache(userId?: string | null) {
  if (!userId) return;
  profileRowCache.delete(userId);
}

export const UsersService = {
  async forceSyncProfileWithIdentity(user: { $id: string }): Promise<any | null> {
    return this.getProfileById(user.$id);
  },
  async getProfileById(userId: string): Promise<any | null> {
    if (!userId) return null;

    const hit = profileRowCache.get(userId);
    if (hit && Date.now() - hit.at < PROFILE_ROW_TTL_MS) {
      return hit.row ? { ...hit.row, $id: hit.row.id } : null;
    }

    try {
      const rows = await db
        .select()
        .from(schema.profiles)
        .where(eq(schema.profiles.userId, userId))
        .limit(1);

      if (rows.length > 0) {
        const r = { ...rows[0], $id: rows[0].id };
        rememberProfileRow(r, userId);
        return r;
      }
    } catch {}

    return null;
  },

  async updateProfile(userId: string, data: any) {
    let profile = await this.getProfileById(userId);
    if (!profile) {
      // Auto-create profile row if it doesn't exist yet
      const fallbackUsername = fallbackUsernameFromUser(userId);
      profile = await this.createProfile(userId, fallbackUsername, data);
      if (profile) return profile;
    }
    if (profile) {
      const now = new Date().toISOString();
      await db
        .update(schema.profiles)
        .set({ ...data, updatedAt: now })
        .where(eq(schema.profiles.id, profile.id));

      invalidateUsersProfileRowCache(userId);
      const updated = { ...profile, ...data, updatedAt: now };
      rememberProfileRow(updated, userId);
      return updated;
    }
    return null;
  },

  async createProfile(userId: string, username: string, data: any = {}) {
    const id = `p-${userId}`;
    const now = new Date().toISOString();
    const row = {
      id,
      userId,
      username,
      displayName: data.displayName || username,
      publicKey: data.publicKey || null,
      avatar: data.avatar ?? null,
      bio: data.bio || '',
      createdAt: now,
      updatedAt: now,
    };

    await db.insert(schema.profiles).values(row).onConflictDoNothing();
    const result = { ...row, $id: id };
    rememberProfileRow(result, userId);
    return result;
  },

  async isUsernameAvailable(username: string): Promise<boolean> {
    const normalized = username.trim().toLowerCase().replace(/^@/, '');
    if (!normalized) return false;

    try {
      const rows = await db
        .select()
        .from(schema.profiles)
        .where(eq(schema.profiles.username, normalized))
        .limit(1);

      return rows.length === 0;
    } catch {
      return true;
    }
  },

  async ensureProfileForUser(user: any) {
    try {
      const userId = user.$id || user.id;
      const existing = await this.getProfileById(userId);
      if (existing) return existing;

      const email = user.email || user.name || 'user';
      const defaultUsername = email.split('@')[0].replace(/[^a-z0-9_]/g, '_').toLowerCase();

      let username = defaultUsername;
      let attempts = 0;
      while (!(await this.isUsernameAvailable(username)) && attempts < 5) {
        username = `${defaultUsername}${ulid().slice(-6).toLowerCase()}`;
        attempts++;
      }

      return await this.createProfile(userId, username, {
        displayName: user.name || email,
      });
    } catch (error) {
      console.warn('[UsersService] Failed to ensure profile:', error);
      return null;
    }
  },

  async searchUsers(query: string) {
    try {
      const { searchGlobalUsersSecure } = await import('@/lib/actions/secure-ops');
      return await searchGlobalUsersSecure(query);
    } catch {
      return [];
    }
  },

  async getProfile(username: string): Promise<any | null> {
    if (!username) return null;
    const normalized = username.replace(/^@/, '').toLowerCase().trim();

    try {
      const rows = await db
        .select()
        .from(schema.profiles)
        .where(eq(schema.profiles.username, normalized))
        .limit(1);

      if (rows.length > 0) {
        const r = { ...rows[0], $id: rows[0].id };
        rememberProfileRow(r, normalized);
        return r;
      }
    } catch {}

    return null;
  },

  async setProfileDiscoverable(userId: string, isDiscoverable: boolean) {
    return await this.updateProfile(userId, { isPublic: isDiscoverable });
  },

  async setAvatarVisible(userId: string, fileId: string, isVisible: boolean) {
    return await this.updateProfile(userId, { avatar: fileId, isAvatar: isVisible });
  },

  async lookupUserByEmail(email: string) {
    try {
      const rows = await db
        .select()
        .from(schema.user)
        .where(eq(schema.user.email, email.trim().toLowerCase()))
        .limit(1);

      if (rows.length > 0) {
        return { ...rows[0], $id: rows[0].id };
      }
    } catch {}
    return null;
  },

  async getUsersByIds(ids: string[]): Promise<any[]> {
    if (!ids?.length) return [];
    try {
      const rows = await db
        .select()
        .from(schema.profiles)
        .where(inArray(schema.profiles.userId, ids));

      return rows.map((r) => ({ ...r, $id: r.id }));
    } catch {
      return [];
    }
  },
};
