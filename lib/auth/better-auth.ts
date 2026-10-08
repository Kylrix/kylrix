import { betterAuth } from 'better-auth';
import { drizzleAdapter } from '@better-auth/drizzle-adapter';
import { emailOTP, bearer, jwt, multiSession } from 'better-auth/plugins';
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
  database: drizzleAdapter(db, {
    provider: 'sqlite',
    schema: {
      user: schema.user,
      session: schema.session,
      account: schema.account,
      verification: schema.verification,
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
