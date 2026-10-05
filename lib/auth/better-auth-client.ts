'use client';

import { createAuthClient } from 'better-auth/react';
import { apiKeyClient } from 'better-auth/client/plugins';

export const authClient = createAuthClient({
  baseURL: typeof window !== 'undefined' ? window.location.origin : (process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3005'),
  plugins: [
    apiKeyClient(),
  ],
});

export const { signIn, signUp, signOut, useSession } = authClient;
