import { AuthPort, Actor } from '../../ports/auth.port';
import { createServerClient } from '@/lib/appwrite/server';
import { isEmailInAdminList } from '@/lib/appwrite-admin';

// Short-term in-memory actor cache (TTL 3000ms) to coalesce rapid Server Action checks
const actorCache = new Map<string, { actor: Actor | null; expiresAt: number }>();

export class AppwriteAuthAdapter implements AuthPort {
  async getActor(jwt?: string): Promise<Actor | null> {
    try {
      const cacheKey = jwt ? `jwt:${jwt.slice(0, 32)}` : 'session:current';
      const now = Date.now();
      const cached = actorCache.get(cacheKey);
      if (cached && cached.expiresAt > now) {
        return cached.actor;
      }

      const { account } = await createServerClient(jwt);
      const user = await account.get().catch(() => null);
      if (!user) {
        actorCache.set(cacheKey, { actor: null, expiresAt: now + 1500 });
        return null;
      }
      
      const isAdmin = isEmailInAdminList(user.email);
      
      const actor: Actor = {
        $id: user.$id,
        email: user.email || '',
        name: user.name || '',
        emailVerification: !!user.emailVerification,
        isAdmin,
        labels: user.labels || [],
        prefs: user.prefs || {}};

      // Cache successful actor resolution for 3 seconds
      actorCache.set(cacheKey, { actor, expiresAt: now + 3000 });

      // Prune old entries
      if (actorCache.size > 50) {
        for (const [key, entry] of actorCache.entries()) {
          if (entry.expiresAt <= now) actorCache.delete(key);
        }
      }

      return actor;
    } catch (err) {
      console.error('[AppwriteAuthAdapter] Failed to get actor:', err);
      return null;
    }
  }

  async createJWT(): Promise<{ jwt: string }> {
    const { client } = await createServerClient();
    const { Account } = await import('node-appwrite');
    const account = new Account(client);
    const res = await account.createJWT();
    return { jwt: res.jwt };
  }

  isEmailAdmin(email: string): boolean {
    return isEmailInAdminList(email);
  }
}
