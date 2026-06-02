'use client';

import { Suspense, useCallback, useEffect, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { Box, CircularProgress, Typography } from '@/lib/mui-tailwind/material';
import { account } from '@/lib/appwrite';
import { normalizeMfaFactors, sessionNeedsTotpMfa } from '@/lib/mfa-session';
import { useSource } from '@/lib/source-context';
import { MfaChallengeDrawer } from '@/components/overlays/MfaChallengeDrawer';
import { createHandoffSessionSecure } from '@/lib/actions/secure-ops';

function buildLoginUrl(source: string | null, redirectUri: string) {
  const url = new URL('/accounts/login', window.location.origin);
  url.searchParams.set('redirect_uri', redirectUri);
  url.searchParams.set('return_to', '/handoff');
  if (source) {
    url.searchParams.set('source', source);
  }
  return url.toString();
}

function AppHandoffContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { setSource, setRedirectUri } = useSource();
  const [status, setStatus] = useState('Preparing app handoff...');
  const [mfaOpen, setMfaOpen] = useState(false);
  const [loginMethod, setLoginMethod] = useState<'email-otp' | 'oauth2' | 'password' | 'unknown'>('unknown');

  const getLoginMethod = useCallback((provider?: string | null) => {
    const value = (provider || '').toLowerCase();
    if (value.includes('email')) return 'email-otp' as const;
    if (value.includes('oauth')) return 'oauth2' as const;
    if (value.includes('password')) return 'password' as const;
    return 'unknown' as const;
  }, []);

  const finishHandoff = useCallback(async (redirectUri: string) => {
    setStatus('Creating the app session handoff...');
    try {
      const jwt = await account.createJWT();
      const { secret, userId } = await createHandoffSessionSecure(jwt.jwt);

      const target = new URL(redirectUri);
      target.searchParams.set('secret', secret);
      target.searchParams.set('userId', userId);
      router.replace(target.toString());
    } catch (_error) {
      const err = _error as any;
      if (err?.code === 'MFA_REQUIRED' || err?.message?.includes('more_factors_required')) {
        try {
          const session = await account.getSession('current');
          setLoginMethod(getLoginMethod((session as any)?.provider));
          setStatus('Complete your second factor to continue.');
          setMfaOpen(true);
          return;
        } catch (sessionError) {
          console.error('[Handoff] Unable to inspect MFA session', sessionError);
        }
      }
      throw _error;
    }
  }, [getLoginMethod, router]);

  useEffect(() => {
    let mounted = true;

    const run = async () => {
      const source = searchParams.get('source') || 'kylrixnote';
      const redirectUri = searchParams.get('redirect_uri');

      if (source) {
        setSource(source);
      }
      if (redirectUri) {
        setRedirectUri(redirectUri);
      }

      if (!redirectUri) {
        if (mounted) {
          setStatus('Missing redirect target. Sending you to login.');
        }
        router.replace('/accounts/login');
        return;
      }

      try {
        if (mounted) {
          setStatus('Checking your session...');
        }
        const [session, factors] = await Promise.all([
          account.getSession('current'),
          account.listMfaFactors().catch(() => null)]);

        if (sessionNeedsTotpMfa({
          session,
          availableFactors: normalizeMfaFactors(factors),
        })) {
          if (mounted) {
            setLoginMethod(getLoginMethod((session as any)?.provider));
            setMfaOpen(true);
            setStatus('Complete your second factor to continue.');
          }
          return;
        }
      } catch (_error) {
        const err = _error as any;
        if (err?.type === 'user_more_factors_required' || err?.message?.includes('more_factors_required')) {
          try {
            const session = await account.getSession('current');
            if (mounted) {
              setLoginMethod(getLoginMethod((session as any)?.provider));
              setMfaOpen(true);
              setStatus('Complete your second factor to continue.');
            }
            return;
          } catch (sessionError) {
            console.error('[Handoff] Unable to inspect MFA session', sessionError);
          }
        }

        router.replace(buildLoginUrl(source, redirectUri));
        return;
      }

      try {
        await finishHandoff(redirectUri);
      } catch (error) {
        console.error('[Handoff] Failed to create app session handoff', error);
        if (mounted) {
          setStatus('Signed in, but the client handoff failed.');
        }
      }
    };

    void run();

    return () => {
      mounted = false;
    };
  }, [finishHandoff, getLoginMethod, searchParams, setRedirectUri, setSource, router]);

  return (
    <Box sx={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', bgcolor: '#000', px: 3 }}>
      <Box sx={{ textAlign: 'center', maxWidth: 420, p: 4 }}>
        <CircularProgress sx={{ color: '#6366F1', mb: 3 }} />
        <Typography sx={{ color: 'white', fontWeight: 800, fontSize: '1.15rem', mb: 1 }}>
          App handoff
        </Typography>
        <Typography sx={{ color: 'rgba(255,255,255,0.65)' }}>
          {status}
        </Typography>
      </Box>
      <MfaChallengeDrawer
        open={mfaOpen}
        onClose={() => setMfaOpen(false)}
        loginMethod={loginMethod}
        onSuccess={async () => {
          const redirectUri = searchParams.get('redirect_uri');
          if (!redirectUri) {
            return;
          }
          setMfaOpen(false);
          setStatus('MFA verified, finishing handoff...');
          await finishHandoff(redirectUri);
        }}
      />
    </Box>
  );
}

export default function AppHandoffPage() {
  return (
    <Suspense fallback={
      <Box sx={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', bgcolor: '#000' }}>
        <CircularProgress sx={{ color: '#6366F1' }} />
      </Box>
    }>
      <AppHandoffContent />
    </Suspense>
  );
}
