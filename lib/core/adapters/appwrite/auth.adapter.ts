import { AuthPort, Actor } from '../../ports/auth.port';
import { createServerClient } from '@/lib/appwrite/server';
import { isEmailInAdminList } from '@/lib/appwrite-admin';

// In-memory actor cache (TTL 60,000ms) with in-flight deduplication to prevent repetitive account.get() reads
const actorCache = new Map<string, { actor: Actor | null; expiresAt: number }>();
const actorInflight = new Map<string, Promise<Actor | null>>();

export class AppwriteAuthAdapter implements AuthPort {
  async getActor(jwt?: string): Promise<Actor | null> {
    const cacheKey = jwt ? `jwt:${jwt.slice(0, 32)}` : 'session:current';
    const now = Date.now();
    const cached = actorCache.get(cacheKey);
    if (cached && cached.expiresAt > now) {
      return cached.actor ? { ...cached.actor } : null;
    }

    const pending = actorInflight.get(cacheKey);
    if (pending) {
      return await pending;
    }

    const fetcher = async (): Promise<Actor | null> => {
      try {
        const { account } = await createServerClient(jwt);
        const user = await account.get().catch(() => null);
        if (!user) {
          actorCache.set(cacheKey, { actor: null, expiresAt: Date.now() + 5000 });
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
          prefs: user.prefs || {},
        };

        // Cache successful actor resolution for 60 seconds
        actorCache.set(cacheKey, { actor, expiresAt: Date.now() + 60_000 });

        // Prune old entries
        if (actorCache.size > 200) {
          const curTime = Date.now();
          for (const [key, entry] of actorCache.entries()) {
            if (entry.expiresAt <= curTime) actorCache.delete(key);
          }
        }

        return actor;
      } catch (err) {
        console.error('[AppwriteAuthAdapter] Failed to get actor:', err);
        return null;
      }
    };

    const task = fetcher().finally(() => {
      actorInflight.delete(cacheKey);
    });
    actorInflight.set(cacheKey, task);
    return await task;
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
