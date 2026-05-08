'use client';

import React from 'react';
import { Box, Container, Typography, Paper, Button, Stack, CircularProgress } from '@mui/material';
import { CheckCircle2, ShieldCheck, Zap, Globe, AlertCircle } from 'lucide-react';
import NextLink from 'next/link';
import { useAuth } from '@/context/auth/AuthContext';
import { account } from '@/lib/appwrite/client';
import { verifyProEntitlementAction } from '../../actions/billing';

type VerifyState =
  | { status: 'loading' }
  | { status: 'unauthenticated' }
  | { status: 'verified'; expiresAt: string | null; source: string }
  | { status: 'not_entitled' };

export default function ProSuccessPage() {
  const { user, isLoading: authLoading } = useAuth();
  const [verify, setVerify] = React.useState<VerifyState>({ status: 'loading' });
  const [dashboardUrl] = React.useState('/');

  React.useEffect(() => {
    let cancelled = false;

    const run = async () => {
      if (authLoading) return;
      if (!user) {
        if (!cancelled) setVerify({ status: 'unauthenticated' });
        return;
      }
      try {
        const jwt = await account.createJWT().then((res: { jwt?: string }) => res?.jwt || '').catch(() => '');
        const result = await verifyProEntitlementAction(jwt || undefined);
        if (cancelled) return;
        if (!result.authenticated) {
          setVerify({ status: 'unauthenticated' });
          return;
        }
        if (result.active) {
          setVerify({
            status: 'verified',
            expiresAt: result.expiresAt,
            source: result.source,
          });
        } else {
          setVerify({ status: 'not_entitled' });
        }
      } catch {
        if (!cancelled) setVerify({ status: 'not_entitled' });
      }
    };

    void run();
    return () => {
      cancelled = true;
    };
  }, [user, authLoading]);

  const outerSx = {
    minHeight: '100vh',
    bgcolor: '#0A0908',
    color: 'white',
    display: 'flex',
    alignItems: 'center',
    py: 10,
  };

  if (!authLoading && !user) {
    return (
      <Box component="main" sx={outerSx}>
        <Container maxWidth="md">
          <Paper
            elevation={0}
            sx={{
              p: { xs: 4, md: 6 },
              borderRadius: '40px',
              background: 'linear-gradient(180deg, rgba(99, 102, 241, 0.05) 0%, rgba(0, 0, 0, 0) 100%)',
              border: '1px solid rgba(255, 255, 255, 0.05)',
              textAlign: 'center',
            }}
          >
            <Box sx={{ mb: 4, display: 'flex', justifyContent: 'center', color: '#F59E0B' }}>
              <AlertCircle size={48} />
            </Box>
            <Typography variant="h4" sx={{ fontFamily: 'Clash Display', fontWeight: 900, mb: 2 }}>
              Sign in to continue
            </Typography>
            <Typography variant="body1" sx={{ opacity: 0.65, mb: 4, fontFamily: 'Satoshi' }}>
              This page can&apos;t confirm a subscription until you&apos;re signed in. Pro access is never granted just by opening a link.
            </Typography>
            <Button
              component={NextLink}
              href="/accounts/login"
              variant="contained"
              sx={{
                py: 1.5,
                px: 4,
                borderRadius: '16px',
                bgcolor: '#6366F1',
                color: '#000',
                fontWeight: 800,
                textTransform: 'none',
              }}
            >
              Sign in
            </Button>
          </Paper>
        </Container>
      </Box>
    );
  }

  if (authLoading || verify.status === 'loading') {
    return (
      <Box component="main" sx={outerSx}>
        <Container maxWidth="sm" sx={{ textAlign: 'center' }}>
          <CircularProgress sx={{ color: '#6366F1' }} />
          <Typography sx={{ mt: 2, opacity: 0.7, fontFamily: 'Satoshi' }}>Confirming your subscription…</Typography>
        </Container>
      </Box>
    );
  }

  if (verify.status === 'unauthenticated') {
    return (
      <Box component="main" sx={outerSx}>
        <Container maxWidth="md">
          <Paper
            elevation={0}
            sx={{
              p: { xs: 4, md: 6 },
              borderRadius: '40px',
              background: 'linear-gradient(180deg, rgba(99, 102, 241, 0.05) 0%, rgba(0, 0, 0, 0) 100%)',
              border: '1px solid rgba(255, 255, 255, 0.05)',
              textAlign: 'center',
            }}
          >
            <Box sx={{ mb: 4, display: 'flex', justifyContent: 'center', color: '#F59E0B' }}>
              <AlertCircle size={48} />
            </Box>
            <Typography variant="h4" sx={{ fontFamily: 'Clash Display', fontWeight: 900, mb: 2 }}>
              We couldn&apos;t verify your session
            </Typography>
            <Typography variant="body1" sx={{ opacity: 0.65, mb: 4, fontFamily: 'Satoshi' }}>
              Sign in again so we can confirm your subscription against your account.
            </Typography>
            <Button
              component={NextLink}
              href="/accounts/login"
              variant="contained"
              sx={{
                py: 1.5,
                px: 4,
                borderRadius: '16px',
                bgcolor: '#6366F1',
                color: '#000',
                fontWeight: 800,
                textTransform: 'none',
              }}
            >
              Sign in
            </Button>
          </Paper>
        </Container>
      </Box>
    );
  }

  if (verify.status === 'not_entitled') {
    return (
      <Box component="main" sx={outerSx}>
        <Container maxWidth="md">
          <Paper
            elevation={0}
            sx={{
              p: { xs: 4, md: 8 },
              borderRadius: '40px',
              background: 'linear-gradient(180deg, rgba(99, 102, 241, 0.05) 0%, rgba(0, 0, 0, 0) 100%)',
              border: '1px solid rgba(255, 255, 255, 0.05)',
              textAlign: 'center',
            }}
          >
            <Box sx={{ mb: 4, display: 'flex', justifyContent: 'center', color: '#F59E0B' }}>
              <AlertCircle size={56} />
            </Box>
            <Typography variant="h2" sx={{ fontFamily: 'Clash Display', fontWeight: 900, mb: 2, fontSize: { xs: '2rem', md: '2.75rem' } }}>
              No active Pro subscription found
            </Typography>
            <Typography variant="h6" sx={{ opacity: 0.6, mb: 4, maxWidth: 560, mx: 'auto', fontFamily: 'Satoshi', fontWeight: 500 }}>
              We couldn&apos;t verify paid Pro time on your account. If you just completed checkout, wait a minute for the payment to
              confirm, then refresh. Otherwise you can start or resume checkout from pricing.
            </Typography>
            <Stack direction={{ xs: 'column', sm: 'row' }} spacing={2} justifyContent="center">
              <Button
                component={NextLink}
                href="/pricing"
                variant="contained"
                sx={{
                  py: 2,
                  px: 5,
                  borderRadius: '16px',
                  bgcolor: '#6366F1',
                  color: '#000',
                  fontWeight: 800,
                  textTransform: 'none',
                }}
              >
                View pricing
              </Button>
              <Button
                component={NextLink}
                href="/accounts/subscription/pro/checkout?planId=PRO_MONTH&months=1&countryCode=US&paymentMethod=CRYPTO"
                variant="outlined"
                sx={{
                  py: 2,
                  px: 5,
                  borderRadius: '16px',
                  borderColor: 'rgba(255,255,255,0.2)',
                  color: 'white',
                  fontWeight: 700,
                  textTransform: 'none',
                }}
              >
                Go to checkout
              </Button>
            </Stack>
          </Paper>
        </Container>
      </Box>
    );
  }

  const expLabel =
    verify.expiresAt &&
    verify.source !== 'prefs_lifetime' &&
    !Number.isNaN(new Date(verify.expiresAt).getTime())
      ? new Date(verify.expiresAt).toLocaleString(undefined, { dateStyle: 'medium', timeStyle: 'short' })
      : null;

  return (
    <Box component="main" sx={outerSx}>
      <Container maxWidth="md">
        <Paper
          elevation={0}
          sx={{
            p: { xs: 4, md: 8 },
            borderRadius: '40px',
            background: 'linear-gradient(180deg, rgba(99, 102, 241, 0.05) 0%, rgba(0, 0, 0, 0) 100%)',
            border: '1px solid rgba(255, 255, 255, 0.05)',
            backdropFilter: 'blur(30px)',
            textAlign: 'center',
            position: 'relative',
            overflow: 'hidden',
          }}
        >
          <Box
            sx={{
              position: 'absolute',
              top: -100,
              left: -100,
              width: 300,
              height: 300,
              borderRadius: '50%',
              background: 'radial-gradient(circle, rgba(99, 102, 241, 0.1) 0%, transparent 70%)',
              filter: 'blur(50px)',
            }}
          />

          <Box sx={{ mb: 6, display: 'flex', justifyContent: 'center' }}>
            <Box
              sx={{
                width: 100,
                height: 100,
                borderRadius: '30px',
                bgcolor: 'rgba(99, 102, 241, 0.1)',
                color: '#6366F1',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                border: '1px solid rgba(99, 102, 241, 0.2)',
                boxShadow: '0 20px 40px rgba(0,0,0,0.4)',
              }}
            >
              <CheckCircle2 size={50} />
            </Box>
          </Box>

          <Typography
            variant="h2"
            sx={{
              fontFamily: 'Clash Display',
              fontWeight: 900,
              mb: 2,
              fontSize: { xs: '2.5rem', md: '3.5rem' },
              letterSpacing: '-0.02em',
            }}
          >
            Welcome to Pro
          </Typography>

          <Typography variant="h6" sx={{ opacity: 0.6, mb: expLabel ? 1 : 4, maxWidth: 600, mx: 'auto', fontFamily: 'Satoshi' }}>
            Your subscription is active. You have full access to the high-fidelity Kylrix workspace features included in your plan.
          </Typography>

          {expLabel && (
            <Typography variant="body2" sx={{ opacity: 0.45, mb: 4, fontFamily: 'Satoshi' }}>
              Current period ends {expLabel}
            </Typography>
          )}

          <Box sx={{ display: 'grid', gridTemplateColumns: { xs: '1fr', sm: '1fr 1fr 1fr' }, gap: 3, mb: 8 }}>
            {[
              { icon: <ShieldCheck />, title: 'Advanced Security', desc: 'Zero-knowledge DMs and vault isolation' },
              { icon: <Zap />, title: 'Intelligence', desc: 'Neural Knowledge Graph and AI expansion' },
              { icon: <Globe />, title: 'Universal', desc: 'Active across all Kylrix applications' },
            ].map((feature, i) => (
              <Box key={i} sx={{ p: 3, borderRadius: '24px', bgcolor: 'rgba(255,255,255,0.02)', border: '1px solid rgba(255,255,255,0.03)' }}>
                <Box sx={{ color: '#6366F1', mb: 2 }}>{feature.icon}</Box>
                <Typography sx={{ fontWeight: 800, mb: 1, fontSize: '0.9rem' }}>{feature.title}</Typography>
                <Typography sx={{ opacity: 0.5, fontSize: '0.8rem' }}>{feature.desc}</Typography>
              </Box>
            ))}
          </Box>

          <Button
            component={NextLink}
            href={dashboardUrl}
            variant="contained"
            sx={{
              py: 2,
              px: 6,
              borderRadius: '16px',
              bgcolor: 'white',
              color: 'black',
              fontWeight: 800,
              textTransform: 'none',
              fontSize: '1.1rem',
              transition: '0.3s',
              '&:hover': { bgcolor: 'rgba(255,255,255,0.9)', transform: 'translateY(-2px)' },
            }}
          >
            Launch Dashboard
          </Button>
        </Paper>
      </Container>
    </Box>
  );
}
