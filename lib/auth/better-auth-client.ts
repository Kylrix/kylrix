'use client';

import { createAuthClient } from 'better-auth/react';
import { emailOTPClient, multiSessionClient, lastLoginMethodClient, twoFactorClient } from 'better-auth/client/plugins';
import { passkeyClient } from '@better-auth/passkey/client';
import { oauthProviderClient } from '@better-auth/oauth-provider/client';

export const authClient = createAuthClient({
  baseURL: typeof window !== 'undefined' ? window.location.origin : (process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3005'),
  plugins: [
    emailOTPClient(),
    multiSessionClient(),
    lastLoginMethodClient(),
    passkeyClient(),
    oauthProviderClient(),
    twoFactorClient(),
  ],
});

export const { signIn, signUp, signOut, useSession } = authClient;
