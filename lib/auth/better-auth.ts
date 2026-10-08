import { betterAuth } from 'better-auth';
import { drizzleAdapter } from '@better-auth/drizzle-adapter';
import { emailOTP, bearer, jwt, multiSession, lastLoginMethod, twoFactor } from 'better-auth/plugins';
import { passkey } from '@better-auth/passkey';
import { oauthProvider } from '@better-auth/oauth-provider';
import { db } from '@/lib/db';
import * as schema from '@/lib/db/schema';
import { PAT_SCOPES } from '@/lib/api/scopes';

export const KYLRIX_OAUTH_SCOPES = [
  'openid',
  'profile',
  'email',
  'offline_access',
  'phone',
  ...PAT_SCOPES,
] as const;

export const auth = betterAuth({
  appName: 'Kylrix',
  database: drizzleAdapter(db, {
    provider: 'sqlite',
    schema: {
      user: schema.user,
      session: schema.session,
      account: schema.account,
      verification: schema.verification,
      twoFactor: schema.twoFactor,
      passkey: schema.passkey,
      apikey: schema.apikey,
      jwks: schema.jwks,
      oauthClient: schema.oauthClient,
      oauthResource: schema.oauthResource,
      oauthClientResource: schema.oauthClientResource,
      oauthRefreshToken: schema.oauthRefreshToken,
      oauthAccessToken: schema.oauthAccessToken,
      oauthConsent: schema.oauthConsent,
      oauthClientAssertion: schema.oauthClientAssertion,
    },
  }),
  secret: process.env.BETTER_AUTH_SECRET || 'kylrix_default_dev_secret_must_be_32_chars_long_min',
  baseURL: process.env.BETTER_AUTH_URL || process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3005',
  socialProviders: {
    ...(process.env.GITHUB_CLIENT_ID && process.env.GITHUB_CLIENT_SECRET
      ? {
          github: {
            clientId: process.env.GITHUB_CLIENT_ID,
            clientSecret: process.env.GITHUB_CLIENT_SECRET,
          },
        }
      : {}),
    ...(process.env.GOOGLE_CLIENT_ID && process.env.GOOGLE_CLIENT_SECRET
      ? {
          google: {
            clientId: process.env.GOOGLE_CLIENT_ID,
            clientSecret: process.env.GOOGLE_CLIENT_SECRET,
          },
        }
      : {}),
  },
  plugins: [
    multiSession({
      maximumSessions: 5,
    }),
    lastLoginMethod(),
    passkey({
      rpName: 'Kylrix',
    }),
    twoFactor({
      issuer: 'Kylrix',
      allowPasswordless: true,
      otpOptions: {
        async sendOTP({ user, otp }, _ctx) {
          console.log(`[BetterAuth 2FA OTP] for ${user.email} (${user.id}): ${otp}`);

          // 1. Dispatch Email with 2FA code
          try {
            const { dispatchEmail } = await import('@/lib/services/internal/emailDispatch');
            await dispatchEmail({
              eventType: 'mfa_challenge',
              sourceApp: 'auth',
              verificationMode: 'error',
              actorName: user.name || 'User',
              actorId: user.id,
              recipientIds: [user.id],
              recipientEmails: [user.email],
              resourceId: `otp:${Date.now()}`,
              resourceTitle: 'Two-Factor Authentication Code',
              resourceType: 'auth.mfa',
              templateKey: 'kylrix:mfa-challenge',
              ctaUrl: process.env.NEXT_PUBLIC_APP_URL || 'https://www.kylrix.space',
              ctaText: 'Open Kylrix',
              metadata: { otp, email: user.email },
            }).catch(() => {});
          } catch {}

          // 2. Dispatch Telegram notification if linked
          try {
            const { db } = await import('@/lib/db');
            const { telegramConnections } = await import('@/lib/db/schema');
            const { eq } = await import('drizzle-orm');
            const tgConn = await db
              .select()
              .from(telegramConnections)
              .where(eq(telegramConnections.isVerified, true))
              .limit(10);

            const botToken = process.env.TELEGRAM_BOT_TOKEN;
            if (botToken && tgConn && tgConn.length > 0) {
              const tgText = `🔐 *Kylrix 2FA Security Code*\n\nYour one-time verification code is: \`${otp}\`\n\n_This code will expire shortly. Do not share it with anyone._`;
              for (const conn of tgConn) {
                if (conn.tgChatId) {
                  fetch(`https://api.telegram.org/bot${botToken}/sendMessage`, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                      chat_id: conn.tgChatId,
                      text: tgText,
                      parse_mode: 'Markdown',
                    }),
                  }).catch(() => {});
                }
              }
            }
          } catch {}
        },
      },
    }),
    emailOTP({
      async sendVerificationOTP({ email, otp, type }) {
        console.log(`[BetterAuth OTP] ${type.toUpperCase()} for ${email}: ${otp}`);
      },
    }),
    bearer(),
    jwt(),
    oauthProvider({
      loginPage: '/login',
      consentPage: '/oauth/consent',
      scopes: [...KYLRIX_OAUTH_SCOPES],
    }),
  ],
});
