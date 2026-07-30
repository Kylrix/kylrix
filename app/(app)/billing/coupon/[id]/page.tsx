'use client';

import { useEffect, useMemo, useRef, useState, use } from 'react';
import { useRouter } from 'next/navigation';
import { Alert, Box, Button, CircularProgress, Container, Paper, Stack, Typography, alpha } from '@/lib/openbricks/primitives';
import { CheckCircle2, Loader2, Ticket } from 'lucide-react';
import { useAuth } from '@/context/auth/AuthContext';
import { claimCouponAction } from '@/lib/actions/billing/billing';
import { account } from '@/lib/appwrite/client';

type CouponClaimResponse = {
  ok?: boolean;
  claimed?: boolean;
  alreadyClaimed?: boolean;
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
  const router = useRouter();
  const params = use(props.params);
  const { user, isLoading } = useAuth();
  const couponId = useMemo(() => (params.id || '').trim(), [params.id]);
  const [state, setState] = useState<'loading' | 'ready' | 'claimed' | 'error'>('loading');
  const [message, setMessage] = useState<string>('Resolving coupon...');
  const [coupon, setCoupon] = useState<CouponClaimResponse | null>(null);
  const claimStartedRef = useRef(false);
  const [isClaiming, setIsClaiming] = useState(false);

  useEffect(() => {
    if (isLoading) return;
    if (!user) {
      const url = new URL('/', window.location.origin);
      url.searchParams.set('source', window.location.href);
      url.searchParams.set('return_to', `/billing/coupon/${encodeURIComponent(couponId)}`);
      router.push(url.toString());
      return;
    }

    if (claimStartedRef.current) return;
    claimStartedRef.current = true;

    const checkCoupon = async () => {
      try {
        const jwt = await account.createJWT().then((res: any) => res?.jwt || '').catch(() => '');
        // Verify target availability first without performing redemption logic
        const data = (await claimCouponAction(couponId, jwt || undefined, true)) as CouponClaimResponse;
        
        setCoupon(data);
        if (data.alreadyClaimed) {
          setState('claimed');
          setMessage(data.message || 'This coupon is already active on your account.');
          return;
        }
        setState('ready');
        setMessage(data.message || `You qualify for this discount!`);
      } catch (error: any) {
        setState('error');
        setMessage(error?.message || 'Coupon check failed.');
      }
    };

    void checkCoupon();
  }, [couponId, isLoading, user, router]);

  const handleClaim = async () => {
    if (!couponId || isClaiming) return;
    setIsClaiming(true);
    try {
      const jwt = await account.createJWT().then((res: any) => res?.jwt || '').catch(() => '');
      const data = (await claimCouponAction(couponId, jwt || undefined, false)) as CouponClaimResponse;

      setCoupon(data);

      if (data.requiresPayment && data.couponId) {
        const checkoutUrl = new URL('/billing/checkout', window.location.origin);
        checkoutUrl.searchParams.set('planId', data.planId || 'PRO_MONTH');
        checkoutUrl.searchParams.set('months', String(data.months || 1));
        checkoutUrl.searchParams.set('countryCode', (user?.prefs as any)?.region || 'US');
        checkoutUrl.searchParams.set('couponId', data.couponId);
        router.push(checkoutUrl.toString());
        return;
      }

      setState('claimed');
      setMessage(data.message || 'Coupon applied successfully.');
      const successUrl = new URL('/billing/success', window.location.origin);
      successUrl.searchParams.set('success', 'true');
      router.replace(successUrl.toString());
    } catch (error: any) {
      setState('error');
      setMessage(error?.message || 'Coupon could not be claimed.');
    } finally {
      setIsClaiming(false);
    }
  };

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
            boxShadow: '0 28px 60px rgba(0,0,0,0.42)'}}
        >
          <Stack spacing={3} alignItems="center" textAlign="center">
            <Box sx={{ p: 2, borderRadius: 4, bgcolor: alpha('#6366F1', 0.08), color: '#6366F1' }}>
              <Ticket size={28} />
            </Box>

            <Typography variant="overline" sx={{ letterSpacing: '0.2em', fontWeight: 800, color: 'rgba(255,255,255,0.5)' }}>
              Kylrix coupon
            </Typography>

            <Typography component="h1" sx={{ fontFamily: 'var(--font-clash)', fontSize: '2.2rem', lineHeight: 1, fontWeight: 900 }}>
              {state === 'loading' ? 'Resolving coupon...' : state === 'ready' ? 'Ready to Claim' : state === 'claimed' ? 'Coupon applied' : 'Coupon unavailable'}
            </Typography>

            <Typography sx={{ color: 'rgba(255,255,255,0.68)', lineHeight: 1.7 }}>
              {message}
            </Typography>

            {state === 'ready' && coupon && (
              <Box sx={{ py: 1.5, px: 3, border: '1px solid rgba(255,255,255,0.06)', borderRadius: '16px', bgcolor: 'rgba(255,255,255,0.02)', width: '100%' }}>
                <Stack spacing={1} textAlign="left">
                  <Typography variant="body2" sx={{ color: '#6366F1', fontWeight: 800 }}>Discount Value: {coupon.discountPercent}% Off</Typography>
                  <Typography variant="body2" sx={{ color: 'rgba(255,255,255,0.6)' }}>Plan Duration: {coupon.months || 1} Month(s)</Typography>
                  <Typography variant="body2" sx={{ color: 'rgba(255,255,255,0.6)' }}>Applicable Plan: {coupon.planId || 'PRO_MONTH'}</Typography>
                </Stack>
              </Box>
            )}

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

            {state === 'ready' && (
              <Button
                variant="contained"
                onClick={handleClaim}
                disabled={isClaiming}
                sx={{
                  bgcolor: '#6366F1',
                  color: '#fff',
                  borderRadius: 999,
                  px: 4,
                  py: 1.5,
                  textTransform: 'none',
                  fontWeight: 900,
                  fontSize: '0.95rem',
                  '&:hover': { bgcolor: '#4F46E5' },
                  '&:disabled': { opacity: 0.5 }}}
                startIcon={isClaiming ? <Loader2 size={16} className="animate-spin" /> : <Ticket size={16} />}
              >
                {isClaiming ? 'Claiming...' : 'Redeem Coupon'}
              </Button>
            )}

            {state === 'claimed' && (
              <Button
                variant="contained"
                onClick={() => {
                  if (coupon?.requiresPayment && coupon.couponId) {
                    const checkoutUrl = new URL('/billing/checkout', window.location.origin);
                    checkoutUrl.searchParams.set('planId', coupon.planId || 'PRO_MONTH');
                    checkoutUrl.searchParams.set('months', String(coupon.months || 1));
                    checkoutUrl.searchParams.set('couponId', coupon.couponId);
                    router.push(checkoutUrl.toString());
                  } else {
                    router.push('/settings');
                  }
                }}
                sx={{
                  bgcolor: '#10B981',
                  color: '#fff',
                  borderRadius: 999,
                  px: 4,
                  py: 1.5,
                  textTransform: 'none',
                  fontWeight: 900,
                  fontSize: '0.95rem',
                  '&:hover': { bgcolor: '#059669' }}}
                startIcon={<CheckCircle2 size={16} />}
              >
                {coupon?.requiresPayment ? 'Proceed to Checkout' : 'Go to Settings'}
              </Button>
            )}
          </Stack>
        </Paper>
      </Container>
    </Box>
  );
}
