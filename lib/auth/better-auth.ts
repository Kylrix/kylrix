import { betterAuth } from 'better-auth';
import { drizzleAdapter } from '@better-auth/drizzle-adapter';
import { emailOTP } from 'better-auth/plugins/email-otp';
import { bearer } from 'better-auth/plugins';
import { sendTransactionalEmail } from '@/lib/email/dispatcher';
import { db } from '@/lib/db';
import * as schema from '@/lib/db/schema';

export const auth = betterAuth({
  database: drizzleAdapter(db, {
    provider: 'sqlite',
    schema: {
      user: schema.user,
      session: schema.session,
      account: schema.account,
      verification: schema.verification,
      apikey: schema.apikey,
    },
  }),
  session: {
    additionalFields: {
      tokenType: {
        type: 'string',
        required: false,
        defaultValue: 'web',
      },
      clientName: {
        type: 'string',
        required: false,
        defaultValue: 'Web Browser',
      },
      workspaceId: {
        type: 'string',
        required: false,
      },
      scopes: {
        type: 'string',
        required: false,
      },
      lastActiveAt: {
        type: 'date',
        required: false,
      },
    },
  },
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
    bearer(),
    emailOTP({
      async sendVerificationOTP({ email, otp, type }) {
        await sendTransactionalEmail({
          to: email,
          subject: `Kylrix Verification Code: ${otp}`,
          text: `Your Kylrix ${type} one-time passcode is ${otp}. It expires in 5 minutes. If you did not request this, please ignore.`,
          html: `<div style="font-family: sans-serif; background: #161412; color: #fff; padding: 24px; border-radius: 12px;">
            <h2 style="margin: 0 0 16px 0; color: #6366F1;">Kylrix Security</h2>
            <p style="font-size: 14px; color: #a1a1aa;">Your one-time passcode for ${type} is:</p>
            <div style="font-size: 32px; font-weight: bold; letter-spacing: 4px; color: #34D399; margin: 20px 0;">${otp}</div>
            <p style="font-size: 12px; color: #71717a;">This code expires in 5 minutes. If you did not make this request, you can safely ignore this email.</p>
          </div>`,
        });
      },
    }),
  ],
});
