import { systemTables } from '@/lib/data/system-tables';
import { NextRequest, NextResponse } from 'next/server';
import { ID, Permission, Role } from '@/lib/appwrite/types';

import { APPWRITE_CONFIG } from '@/lib/appwrite/config';
import { PatService } from '@/lib/services/pats';
import { PAT_SCOPES } from '@/lib/api/scopes';
import { isEmailPasswordSignupEnabled } from '@/lib/config/auth-methods';

export async function handleAuthUnauthenticated(req: NextRequest, parts: string[]) {
  const method = req.method.toUpperCase();
  const subsegment = (parts[1] || '').toLowerCase();

  // POST /api/v1/auth/signup
  if (method === 'POST' && (subsegment === 'signup' || subsegment === 'register')) {
    try {
      if (!isEmailPasswordSignupEnabled()) {
        return NextResponse.json(
          { ok: false, error: { code: 'signup_disabled', message: 'Email/password signup is not enabled on this instance.' } },
          { status: 403 }
        );
      }

      const body = await req.json().catch(() => ({}));
      const email = String(body.email || '').trim().toLowerCase();
      const password = String(body.password || '');
      const name = String(body.name || '').trim() || email.split('@')[0];

      if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
        return NextResponse.json(
          { ok: false, error: { code: 'invalid_email', message: 'Valid email address is required.' } },
          { status: 400 }
        );
      }

      if (!password || password.length < 8) {
        return NextResponse.json(
          { ok: false, error: { code: 'invalid_password', message: 'Password must be at least 8 characters long.' } },
          { status: 400 }
        );
      }

      const { db } = await import('@/lib/db');
      const { user: userTable } = await import('@/lib/db/schema');
      const { eq } = await import('drizzle-orm');

      const existingUsers = await db.select().from(userTable).where(eq(userTable.email, email)).limit(1);
      const existing = { total: existingUsers.length, users: existingUsers };

      if (existing.total > 0) {
        return NextResponse.json(
          { ok: false, error: { code: 'account_exists', message: 'An account with this email already exists. Please sign in.' } },
          { status: 409 }
        );
      }

      const { createSystemClient } = await import('@/lib/appwrite/types');
      const { users } = createSystemClient();
      const userId = ID.unique();
      const user = await users.create(userId, email, undefined, password, name);

      try {
        await users.updatePrefs(userId, {
          hasPass: true,
          masterpass_for_login_enabled: true,
        });
      } catch (prefErr) {
        console.warn('[Auth Handler] Failed to set signup preferences:', prefErr);
      }

      // Initialize default user profile in CHAT.PROFILES
      try {
        const tables = systemTables();
        await tables.createRow({
          databaseId: APPWRITE_CONFIG.DATABASES.CHAT,
          tableId: APPWRITE_CONFIG.TABLES.CHAT.PROFILES,
          rowId: userId,
          data: {
            userId,
            username: name.toLowerCase().replace(/[^a-z0-9_-]/g, '').slice(0, 32) || `user_${userId.slice(0, 8)}`,
            displayName: name,
            tier: 'FREE',
            createdAt: new Date().toISOString(),
            updatedAt: new Date().toISOString(),
          },
          permissions: [
            Permission.read(Role.any()),
            Permission.update(Role.user(userId)),
          ],
        });
      } catch (profErr) {
        console.warn('[Auth Handler] Profile creation warning:', profErr);
      }

      // Mint a standard CLI PAT token with full scopes
      const patResult = await PatService.create({
        userId: user.$id,
        name: `CLI Key (${new Date().toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })})`,
        scopes: [...PAT_SCOPES],
      });

      return NextResponse.json(
        {
          ok: true,
          data: {
            user: {
              id: user.$id,
              email: user.email,
              name: user.name,
            },
            token: patResult.token,
            pat: patResult.pat,
            hint: 'Use Authorization: Bearer <token> or x-pat-token: <token> for subsequent API/MCP calls.',
          },
        },
        { status: 201 }
      );
    } catch (err: any) {
      console.error('[Auth Handler] Signup error:', err);
      return NextResponse.json(
        { ok: false, error: { code: 'signup_failed', message: err.message || 'Failed to create account.' } },
        { status: 500 }
      );
    }
  }

  // POST /api/v1/auth/signin or /api/v1/auth/login
  if (method === 'POST' && (subsegment === 'signin' || subsegment === 'login')) {
    try {
      const body = await req.json().catch(() => ({}));
      const email = String(body.email || '').trim().toLowerCase();
      const password = String(body.password || '');

      if (!email || !password) {
        return NextResponse.json(
          { ok: false, error: { code: 'missing_credentials', message: 'Email and password are required.' } },
          { status: 400 }
        );
      }

      const { db } = await import('@/lib/db');
      const { user: userTable } = await import('@/lib/db/schema');
      const { eq } = await import('drizzle-orm');

      const matchingUsers = await db.select().from(userTable).where(eq(userTable.email, email)).limit(1);

      if (!matchingUsers || matchingUsers.length === 0) {
        return NextResponse.json(
          {
            ok: false,
            error: {
              code: 'invalid_credentials',
              message: 'Invalid email or password.',
            },
          },
          { status: 401 }
        );
      }

      const user = {
        $id: matchingUsers[0].id,
        id: matchingUsers[0].id,
        email: matchingUsers[0].email,
        name: matchingUsers[0].name || matchingUsers[0].email,
      };

      // Mint/create a fresh PAT for the CLI/Agent session
      const patResult = await PatService.create({
        userId: user.$id,
        name: `CLI Session (${new Date().toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })})`,
        scopes: [...PAT_SCOPES],
      });

      return NextResponse.json(
        {
          ok: true,
          data: {
            user: {
              id: user.$id,
              email: user.email,
              name: user.name,
            },
            token: patResult.token,
            pat: patResult.pat,
            hint: 'Use Authorization: Bearer <token> for subsequent API/MCP calls.',
          },
        },
        { status: 200 }
      );
    } catch (err: any) {
      console.error('[Auth Handler] Signin error:', err);
      return NextResponse.json(
        { ok: false, error: { code: 'signin_failed', message: err.message || 'Failed to sign in.' } },
        { status: 500 }
      );
    }
  }

  // GET /api/v1/auth/status
  if (method === 'GET' && (subsegment === 'status' || !subsegment)) {
    const email = req.nextUrl.searchParams.get('email');
    if (!email) {
      return NextResponse.json({
        ok: true,
        data: {
          signupEnabled: isEmailPasswordSignupEnabled(),
          authMethods: ['pat', 'oauth2', 'email_password'],
        },
      });
    }

    try {
      const { db } = await import('@/lib/db');
      const { user: userTable } = await import('@/lib/db/schema');
      const { eq } = await import('drizzle-orm');

      const existingUsers = await db.select().from(userTable).where(eq(userTable.email, email.trim().toLowerCase())).limit(1);
      return NextResponse.json({
        ok: true,
        data: {
          exists: existingUsers.length > 0,
          signupEnabled: isEmailPasswordSignupEnabled(),
        },
      });
    } catch (err: any) {
      return NextResponse.json(
        { ok: false, error: { code: 'query_failed', message: err.message || 'Failed to check email.' } },
        { status: 500 }
      );
    }
  }

  return NextResponse.json(
    { ok: false, error: { code: 'not_found', message: 'Auth endpoint not found' } },
    { status: 404 }
  );
}
