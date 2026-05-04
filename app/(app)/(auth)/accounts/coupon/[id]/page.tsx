'use client';

import { useEffect, useMemo, useState, use } from 'react';
import { Alert, Box, Button, CircularProgress, Container, Paper, Stack, Typography, alpha } from '@mui/material';
import { CheckCircle2, Loader2, ShieldCheck, Ticket } from 'lucide-react';
import { useAuth } from '@/context/AuthContext';

type CouponClaimResponse = {
  ok?: boolean;
  claimed?: boolean;
  requiresPayment?: boolean;
  couponId?: string;
  discountPercent?: number;
  planId?: string;
  months?: number;
  currentPeriodEnd?: string;
  message?: string;
  error?: string;
};

export default function CouponLandingPage(props: { params: Promise<{ id: string }> }) {
  const params = use(props.params);
  const { user, loading } = useAuth();
  const couponId = useMemo(() => (params.id || '').trim(), [params.id]);
  const [state, setState] = useState<'loading' | 'ready' | 'claimed' | 'error'>('loading');
  const [message, setMessage] = useState<string>('Resolving coupon...');
  const [coupon, setCoupon] = useState<CouponClaimResponse | null>(null);

  useEffect(() => {
    if (loading) return;
    if (!user) {
      const url = new URL('/login', window.location.origin);
      url.searchParams.set('source', window.location.href);
      url.searchParams.set('return_to', `/coupon/${encodeURIComponent(couponId)}`);
      window.location.assign(url.toString());
      return;
    }

    const run = async () => {
      try {
        const res = await fetch('/api/billing/coupons/claim', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ couponId }),
        });
        const data = (await res.json().catch(() => ({}))) as CouponClaimResponse;
        if (!res.ok) {
          throw new Error(data.error || 'Failed to claim coupon.');
        }

        setCoupon(data);

        if (data.requiresPayment && data.couponId) {
          const checkoutUrl = new URL('/subscription/pro/checkout', window.location.origin);
          checkoutUrl.searchParams.set('planId', data.planId || 'PRO_MONTH');
          checkoutUrl.searchParams.set('months', String(data.months || 1));
          checkoutUrl.searchParams.set('countryCode', (user?.prefs as any)?.region || 'US');
          checkoutUrl.searchParams.set('couponId', data.couponId);
          window.location.assign(checkoutUrl.toString());
          return;
        }

        setState('claimed');
        setMessage(data.message || 'Coupon applied successfully.');
        const successUrl = new URL('/pro/success', window.location.origin);
        successUrl.searchParams.set('success', 'true');
        window.location.replace(successUrl.toString());
      } catch (error: any) {
        setState('error');
        setMessage(error?.message || 'Coupon could not be applied.');
      }
    };

    run();
  }, [couponId, loading, user]);

  return (
    <Box sx={{ minHeight: '100vh', bgcolor: '#0A0908', color: '#fff', display: 'flex', alignItems: 'center', py: 8 }}>
      <Container maxWidth="sm">
        <Paper
          elevation={0}
          sx={{
            p: { xs: 3, sm: 4 },
            borderRadius: 5,
            bgcolor: '#161412',
            border: '1px solid rgba(255,255,255,0.06)',
            boxShadow: '0 28px 60px rgba(0,0,0,0.42)',
          }}
        >
          <Stack spacing={3} alignItems="center" textAlign="center">
            <Box sx={{ p: 2, borderRadius: 4, bgcolor: alpha('#6366F1', 0.08), color: '#6366F1' }}>
              <Ticket size={28} />
            </Box>

            <Typography variant="overline" sx={{ letterSpacing: '0.2em', fontWeight: 800, color: 'rgba(255,255,255,0.5)' }}>
              Kylrix coupon
            </Typography>

            <Typography component="h1" sx={{ fontFamily: 'var(--font-clash)', fontSize: '2.2rem', lineHeight: 1, fontWeight: 900 }}>
              {state === 'loading' ? 'Redeeming coupon...' : state === 'claimed' ? 'Coupon applied' : 'Coupon unavailable'}
            </Typography>

            <Typography sx={{ color: 'rgba(255,255,255,0.68)', lineHeight: 1.7 }}>
              {message}
            </Typography>

            {state === 'loading' && (
              <Stack direction="row" spacing={1.5} alignItems="center" sx={{ color: 'rgba(255,255,255,0.55)' }}>
                <CircularProgress size={18} sx={{ color: '#6366F1' }} />
                <Typography variant="body2">Validating against the accounts API...</Typography>
              </Stack>
            )}

            {state === 'error' && (
              <Alert severity="error" sx={{ width: '100%', bgcolor: alpha('#EF4444', 0.08), color: '#fff', border: '1px solid rgba(255,255,255,0.06)' }}>
                {message}
              </Alert>
            )}

            {coupon?.requiresPayment && (
              <Alert icon={<ShieldCheck size={18} />} severity="info" sx={{ width: '100%', bgcolor: alpha('#10B981', 0.08), color: '#fff', border: '1px solid rgba(255,255,255,0.06)' }}>
                Coupon reserved. Checkout will apply the discount server-side.
              </Alert>
            )}

            <Button
              variant="contained"
              href="/subscription/pro/checkout"
              sx={{
                bgcolor: '#6366F1',
                color: '#fff',
                borderRadius: 999,
                px: 3,
                textTransform: 'none',
                fontWeight: 800,
                '&:hover': { bgcolor: '#4F46E5' },
              }}
              startIcon={state === 'loading' ? <Loader2 size={16} /> : <CheckCircle2 size={16} />}
            >
              Continue
            </Button>
          </Stack>
        </Paper>
      </Container>
    </Box>
  );
}
