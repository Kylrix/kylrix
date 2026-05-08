'use client';

import React, { useEffect, useState, Suspense, useMemo } from 'react';
import { useAuth } from '@/context/auth/AuthContext';
import { useSearchParams } from 'next/navigation';
import { Box, Container, Typography, CircularProgress, Paper, Button, Stack, Divider } from '@mui/material';
import { Rocket, Heart, Globe, Clock } from 'lucide-react';
import { calculateSubscriptionPrice, PPP_DATA } from '@/lib/subscription/ppp';
import { createBillingCheckoutSessionAction } from '../../../actions/billing';
import { account } from '@/lib/appwrite/client';

function CheckoutContent() {
  const { user, isLoading: authLoading } = useAuth();
  const searchParams = useSearchParams();
  const [error, setError] = useState<string | null>(null);
  const [initializing, setInitializing] = useState(false);

  const planId = searchParams.get('planId') || 'PRO_MONTH';
  const months = parseInt(searchParams.get('months') || '1');
  const giftRecipientId = searchParams.get('giftRecipientId') || '';
  const giftRecipientName = searchParams.get('giftRecipientName') || '';
  const giftMessage = searchParams.get('giftMessage') || '';
  const couponId = searchParams.get('couponId') || '';
  const countryCode = searchParams.get('countryCode') || (user?.prefs as any)?.region || 'US';
  const region = PPP_DATA[countryCode] || PPP_DATA.DEFAULT;

  const expectedPrice = useMemo(() => {
    return calculateSubscriptionPrice(planId, countryCode, 'CRYPTO', months);
  }, [planId, countryCode, months]);

  const monthlyPrice = useMemo(() => {
    return calculateSubscriptionPrice('PRO_MONTH', countryCode, 'CRYPTO', 1);
  }, [countryCode]);

  const markBillingSyncPending = (userId: string) => {
    if (typeof window === 'undefined') return;
    window.localStorage.setItem(`kylrix:subscription:sync-pending:${userId}`, JSON.stringify({ ts: Date.now() }));
  };

  useEffect(() => {
    const startCheckout = async () => {
      if (authLoading || !user || initializing) return;
      
      setInitializing(true);
      try {
        const jwt = await account.createJWT().then((res: any) => res?.jwt || '').catch(() => '');
        const session = await createBillingCheckoutSessionAction({
          planId,
          method: 'CRYPTO',
          countryCode,
          months,
          giftRecipientId: giftRecipientId || undefined,
          giftRecipientName: giftRecipientName || undefined,
          giftMessage: giftMessage || undefined,
          couponId: couponId || undefined,
          jwt: jwt || undefined,
          baseUrl: `${window.location.origin}/accounts`,
        });

        if (session.url) {
          markBillingSyncPending(user.$id);
          window.location.assign(session.url);
        } else {
          const sessionError = 'error' in session ? session.error : undefined;
          setError(typeof sessionError === 'string' ? sessionError : 'Failed to create checkout session');
          setInitializing(false);
        }
      } catch (err) {
        setError('An unexpected error occurred. Please try again.');
        console.error('Checkout error:', err);
        setInitializing(false);
      }
    };

    startCheckout();
  }, [user, authLoading, initializing, planId, countryCode, months, giftMessage, giftRecipientId, giftRecipientName, couponId]);

  useEffect(() => {
    if (!authLoading && !user) {
      if (typeof window !== 'undefined') {
        const currentUrl = window.location.href;
        window.location.assign(`/accounts/login?source=${encodeURIComponent(currentUrl)}`);
      }
    }
  }, [user, authLoading]);

  if (authLoading || !user) {
    return (
      <Box sx={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '100vh', bgcolor: '#0A0908' }}>
        <CircularProgress sx={{ color: '#6366F1' }} />
      </Box>
    );
  }

  return (
    <Box component="main" sx={{ minHeight: '100vh', bgcolor: '#0A0908', color: 'white', display: 'flex', alignItems: 'center', justifyContent: 'center', py: 4 }}>
      <Container maxWidth="sm">
        <Paper 
          elevation={0}
          sx={{
            p: { xs: 4, md: 6 },
            borderRadius: '40px',
            background: 'rgba(255, 255, 255, 0.02)',
            border: '1px solid rgba(255, 255, 255, 0.05)',
            backdropFilter: 'blur(20px)',
          }}
        >
          <Stack spacing={4}>
            <Box sx={{ textAlign: 'center' }}>
              <Box sx={{ display: 'inline-flex', p: 2, borderRadius: '20px', bgcolor: 'rgba(99, 102, 241, 0.1)', color: '#6366F1', mb: 3 }}>
                <Rocket size={32} />
              </Box>
              <Typography variant="h4" sx={{ fontFamily: 'Clash Display', fontWeight: 900, mb: 1 }}>
                {giftRecipientId ? 'Confirm Gift Subscription' : 'Confirm Subscription'}
              </Typography>
              <Typography sx={{ opacity: 0.6 }}>
                {giftRecipientId
                  ? `Finalizing a gift for ${giftRecipientName || giftRecipientId}.`
                  : `Finalizing your ${months} month ${months >= 12 ? 'yearly' : 'monthly'} access.`}
              </Typography>
            </Box>

            <Box sx={{ p: 3, borderRadius: '24px', bgcolor: 'rgba(255, 255, 255, 0.02)', border: '1px solid rgba(255, 255, 255, 0.05)' }}>
              <Stack spacing={2.5}>
                <Stack direction="row" justifyContent="space-between" alignItems="center">
                  <Stack direction="row" spacing={1.5} alignItems="center">
                    <Globe size={18} color="#6366F1" />
                    <Typography sx={{ fontSize: '0.9rem', fontWeight: 600 }}>Regional Price</Typography>
                  </Stack>
                  <Typography sx={{ fontSize: '0.9rem', opacity: 0.8 }}>{region.name}</Typography>
                </Stack>

                {months > 1 && (
                  <Stack direction="row" justifyContent="space-between" alignItems="center">
                    <Stack direction="row" spacing={1.5} alignItems="center">
                      <Clock size={18} color="#6366F1" />
                      <Typography sx={{ fontSize: '0.9rem', fontWeight: 600 }}>Monthly Rate</Typography>
                    </Stack>
                    <Typography sx={{ fontSize: '0.9rem', opacity: 0.8 }}>${monthlyPrice.toFixed(2)}</Typography>
                  </Stack>
                )}
                
                <Stack direction="row" justifyContent="space-between" alignItems="center">
                  <Stack direction="row" spacing={1.5} alignItems="center">
                    <Heart size={18} color="#6366F1" />
                    <Typography sx={{ fontSize: '0.9rem', fontWeight: 600 }}>Total Amount</Typography>
                  </Stack>
                  <Typography sx={{ fontSize: '1.2rem', fontWeight: 900, fontFamily: 'JetBrains Mono' }}>${expectedPrice.toFixed(2)}</Typography>
                </Stack>

                <Divider sx={{ opacity: 0.05 }} />

                <Stack direction="row" spacing={2}>
                  <Clock size={20} color="#6366F1" style={{ flexShrink: 0, marginTop: 2 }} />
                  <Typography sx={{ fontSize: '0.85rem', opacity: 0.5, lineHeight: 1.5 }}>
                    {giftRecipientId
                      ? 'This checkout will create a gift coupon for the recipient. Their account will claim it automatically on login.'
                      : 'Kylrix uses a flexible model. Any amount you send is converted into Pro time. If you send less than the suggested value, your subscription duration will be automatically adjusted to match your payment.'}
                  </Typography>
                </Stack>
              </Stack>
            </Box>

            <Box sx={{ textAlign: 'center' }}>
              {error ? (
                <Box>
                  <Typography sx={{ color: '#ef4444', mb: 3 }}>{error}</Typography>
                  <Button 
                    onClick={() => window.location.reload()}
                    variant="outlined"
                    sx={{ color: 'white', borderColor: 'rgba(255, 255, 255, 0.1)', borderRadius: '12px', textTransform: 'none' }}
                  >
                    Try Again
                  </Button>
                </Box>
              ) : (
                <Stack spacing={2} alignItems="center">
                  <CircularProgress size={28} sx={{ color: '#6366F1' }} />
                  <Typography sx={{ fontSize: '0.9rem', opacity: 0.4 }}>
                    Redirecting to secure payment portal...
                  </Typography>
                </Stack>
              )}
            </Box>
          </Stack>
        </Paper>
      </Container>
    </Box>
  );
}

export default function ProCheckoutPage() {
  return (
    <Suspense fallback={
      <Box sx={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '100vh', bgcolor: '#0A0908' }}>
        <CircularProgress sx={{ color: '#6366F1' }} />
      </Box>
    }>
      <CheckoutContent />
    </Suspense>
  );
}
