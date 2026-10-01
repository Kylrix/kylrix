import { betterAuth } from 'better-auth';
import { drizzleAdapter } from '@better-auth/drizzle-adapter';
import { emailOTP } from 'better-auth/plugins/email-otp';
import { apiKey } from 'better-auth/plugins/apiKey';
import { Resend } from 'resend';
import { db } from '@/lib/db';
import * as schema from '@/lib/db/schema';

const resendApiKey = process.env.RESEND_API_KEY;
const resend = resendApiKey ? new Resend(resendApiKey) : null;

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
    emailOTP({
      async sendVerificationOTP({ email, otp, type }) {
        if (resend) {
          await resend.emails.send({
            from: 'Kylrix Security <auth@kylrix.space>',
            to: email,
            subject: `Kylrix Verification Code: ${otp}`,
            text: `Your Kylrix ${type} one-time passcode is ${otp}. It expires in 5 minutes. If you did not request this, please ignore.`,
          });
        } else {
          console.log(`[BetterAuth Dev OTP] ${type.toUpperCase()} for ${email}: ${otp}`);
        }
      },
    }),
    apiKey({
      prefix: 'kylrix_pat_',
    }),
  ],
});
