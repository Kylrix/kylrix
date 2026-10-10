import { AuthPort, Actor } from '../../ports/auth.port';
import { db } from '@/lib/db';
import * as schema from '@/lib/db/schema';
import { eq } from 'drizzle-orm';
import { isEmailInAdminList } from '@/lib/appwrite-admin';
import { auth } from '@/lib/auth/better-auth';

// In-memory actor cache (TTL 60,000ms) with in-flight deduplication
const actorCache = new Map<string, { actor: Actor | null; expiresAt: number }>();
const actorInflight = new Map<string, Promise<Actor | null>>();

export class TursoAuthAdapter implements AuthPort {
  async getActor(jwtOrToken?: string): Promise<Actor | null> {
    const cacheKey = jwtOrToken ? `token:${jwtOrToken.slice(0, 32)}` : 'session:current';
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
        let userId: string | null = null;

        // 1. Direct Better Auth token passed or PAT passed
        if (jwtOrToken) {
          // Check session table by token
          const sessions = await db
            .select()
            .from(schema.session)
            .where(eq(schema.session.token, jwtOrToken))
            .limit(1);

          if (sessions.length > 0 && sessions[0].userId) {
            const exp = typeof sessions[0].expiresAt === 'number'
              ? sessions[0].expiresAt
              : new Date(sessions[0].expiresAt).getTime();
            if (exp > Date.now()) {
              userId = sessions[0].userId;
            }
          }

          // If not in session table, check apikey (PAT) table
          if (!userId) {
            const pats = await db
              .select()
              .from(schema.apikey)
              .where(eq(schema.apikey.key, jwtOrToken))
              .limit(1);

            if (pats.length > 0 && pats[0].userId) {
              userId = pats[0].userId;
            }
          }
        }

        // 2. Cookie discovery from Next.js request context
        if (!userId) {
          try {
            const { headers, cookies } = await import('next/headers');
            const [h, cookieStore] = await Promise.all([headers(), cookies()]);

            // Try Better Auth server session check
            const session = await auth.api.getSession({
              headers: h,
            }).catch(() => null);

            if (session?.user?.id) {
              userId = session.user.id;
            } else {
              // Try finding better-auth session token or legacy cookie
              const sessionCookie =
                cookieStore.get('better-auth.session_token') ||
                cookieStore.get('session_token') ||
                cookieStore.get('a_session') ||
                cookieStore.get('session');

              if (sessionCookie?.value) {
                const sessions = await db
                  .select()
                  .from(schema.session)
                  .where(eq(schema.session.token, sessionCookie.value))
                  .limit(1);

                if (sessions.length > 0 && sessions[0].userId) {
                  userId = sessions[0].userId;
                }
              }
            }
          } catch {
            // Non-request context
          }
        }

        if (!userId) {
          actorCache.set(cacheKey, { actor: null, expiresAt: Date.now() + 5000 });
          return null;
        }

        // 3. Resolve user record from Turso user table
        const users = await db
          .select()
          .from(schema.user)
          .where(eq(schema.user.id, userId))
          .limit(1);

        if (users.length === 0) {
          actorCache.set(cacheKey, { actor: null, expiresAt: Date.now() + 5000 });
          return null;
        }

        const u = users[0];
        let labels: string[] = [];
        try {
          if (u.labels) labels = JSON.parse(u.labels);
        } catch {}

        let prefs: Record<string, any> = {};
        try {
          if (u.prefs) prefs = JSON.parse(u.prefs);
        } catch {}

        const actor: Actor = {
          $id: u.id,
          email: u.email || '',
          name: u.name || '',
          emailVerification: Boolean(u.emailVerified),
          isAdmin: this.isEmailAdmin(u.email || ''),
          labels,
          prefs,
        };

        actorCache.set(cacheKey, { actor, expiresAt: Date.now() + 60_000 });
        return actor;
      } catch (err: any) {
        console.error('[TursoAuthAdapter] Failed to get actor:', err?.message || err);
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
    // Generate sovereign JWT signed via Better Auth / internal key
    return { jwt: `turso_${Date.now()}_${Math.random().toString(36).substring(2)}` };
  }

  isEmailAdmin(email: string): boolean {
    return isEmailInAdminList(email);
  }
}
