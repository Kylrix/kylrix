'use client';

import React, { useState, useMemo } from 'react';
import { 
  Box, 
  Container, 
  Typography, 
  Button, 
  Stack, 
  Grid, 
  alpha,
  Paper,
  Slider,
  Tooltip,
} from '@mui/material';
import { Info, Sparkles, Globe, ShieldCheck } from 'lucide-react';
import Navbar from '@/components/Navbar';
import Logo from '@/components/Logo';
import { useAuth } from '@/context/auth/AuthContext';
import { getEcosystemUrl } from '@/lib/ecosystem';
import { useSubscription } from '@/context/subscription/SubscriptionContext';

export default function PricingPage() {
  const { isAuthenticated, openIDMWindow } = useAuth();
  const { prices, detectedRegion } = useSubscription();
  const [months, setMonths] = useState(1);
  const [isRedirecting, setIsRedirecting] = useState(false);

  const basePrice = prices['PRO'] || 10;
  const isYearly = months >= 12;
  
  // Calculate display price: if 12+ months, apply the 10-for-12 discount
  const totalPrice = useMemo(() => {
    if (months >= 12) {
      const years = Math.floor(months / 12);
      const remainingMonths = months % 12;
      return (years * 10 * basePrice) + (remainingMonths * basePrice);
    }
    return months * basePrice;
  }, [months, basePrice]);

  const handleSubscribe = () => {
    const planId = months >= 12 ? 'PRO_YEAR' : 'PRO_MONTH';
    const checkoutUrl = `${getEcosystemUrl('accounts')}/subscription/pro/checkout?planId=${planId}&months=${months}&countryCode=${detectedRegion.countryCode}&source=${encodeURIComponent(window.location.href)}`;
    
    if (!isAuthenticated) {
      openIDMWindow(checkoutUrl);
      return;
    }
    
    setIsRedirecting(true);
    window.location.assign(checkoutUrl);
  };

  const pppSavings = useMemo(() => {
    const standardUsd = months >= 12 ? 100 : 10;
    const diff = standardUsd - (totalPrice / (months >= 12 ? Math.floor(months/12) : 1));
    return diff > 0.5 ? diff : 0;
  }, [totalPrice, months]);

  return (
    <Box component="main" sx={{ pt: 12, minHeight: '100vh', bgcolor: '#050505', color: 'white' }}>
      <Navbar />
      <div className="bg-mesh" />

      <Container maxWidth="md" sx={{ py: { xs: 8, md: 12 }, position: 'relative', zIndex: 1 }}>
        <Box sx={{ textAlign: 'center', mb: 8 }}>
          <Typography variant="h1" sx={{ fontWeight: 900, fontSize: { xs: '2.5rem', md: '4.5rem' }, fontFamily: 'Clash Display', mb: 2 }}>
            Kylrix Pro
          </Typography>
          <Typography sx={{ opacity: 0.6, fontSize: '1.1rem', maxWidth: 600, mx: 'auto', fontFamily: 'Satoshi' }}>
            Get full access to the ecosystem with a plan that scales with you and respects your local economy.
          </Typography>
        </Box>

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
          <Grid container spacing={6} alignItems="center">
            <Grid size={{ xs: 12, md: 6 }}>
              <Stack spacing={4}>
                <Box>
                  <Typography sx={{ color: '#6366F1', fontWeight: 800, fontSize: '0.75rem', textTransform: 'uppercase', tracking: '0.1em', mb: 1 }}>
                    Duration
                  </Typography>
                  <Typography variant="h4" sx={{ fontWeight: 900, mb: 3, fontFamily: 'Clash Display' }}>
                    {months} {months === 1 ? 'Month' : 'Months'}
                  </Typography>
                  <Slider
                    value={months}
                    min={1}
                    max={24}
                    onChange={(_, val) => setMonths(val as number)}
                    sx={{
                      color: '#6366F1',
                      '& .MuiSlider-thumb': {
                        width: 24,
                        height: 24,
                        backgroundColor: '#fff',
                        border: '2px solid #6366F1',
                      },
                      '& .MuiSlider-rail': { opacity: 0.1 },
                    }}
                  />
                  {isYearly && (
                    <Box sx={{ mt: 2, p: 1.5, borderRadius: '12px', bgcolor: 'rgba(16, 185, 129, 0.1)', border: '1px solid rgba(16, 185, 129, 0.2)', display: 'inline-flex', alignItems: 'center', gap: 1 }}>
                      <Sparkles size={16} color="#10b981" />
                      <Typography sx={{ color: '#10b981', fontSize: '0.85rem', fontWeight: 700 }}>
                        Yearly Discount: 2 Months Free applied
                      </Typography>
                    </Box>
                  )}
                </Box>

                <Stack spacing={2}>
                  {[
                    { icon: ShieldCheck, text: 'Unlimited Vault & Notes storage' },
                    { icon: Globe, text: 'Universal Identity across all apps' },
                    { icon: Sparkles, text: 'Full AI Neural Graph access' }
                  ].map((feat, i) => (
                    <Stack key={i} direction="row" spacing={2} alignItems="center">
                      <feat.icon size={18} color="#6366F1" />
                      <Typography sx={{ fontSize: '0.95rem', opacity: 0.8 }}>{feat.text}</Typography>
                    </Stack>
                  ))}
                </Stack>
              </Stack>
            </Grid>

            <Grid size={{ xs: 12, md: 6 }}>
              <Box sx={{ p: 4, borderRadius: '32px', bgcolor: 'rgba(255, 255, 255, 0.03)', border: '1px solid rgba(255, 255, 255, 0.05)', textAlign: 'center' }}>
                <Typography sx={{ opacity: 0.5, fontSize: '0.85rem', mb: 1 }}>Total Investment</Typography>
                <Typography sx={{ fontSize: '4rem', fontWeight: 900, fontFamily: 'JetBrains Mono', lineHeight: 1 }}>
                  ${totalPrice.toFixed(2)}
                </Typography>
                
                {detectedRegion.countryCode !== 'US' && (
                  <Box sx={{ mt: 2, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 0.5 }}>
                    <Typography sx={{ color: '#6366F1', fontWeight: 700, fontSize: '0.9rem' }}>
                      Regional Price Applied ({detectedRegion.name})
                    </Typography>
                    <Typography sx={{ opacity: 0.4, fontSize: '0.75rem' }}>
                      Prices are adjusted to be fair everywhere.
                    </Typography>
                  </Box>
                )}

                <Button 
                  onClick={handleSubscribe}
                  fullWidth
                  disabled={isRedirecting}
                  variant="contained"
                  sx={{
                    mt: 4,
                    py: 2,
                    borderRadius: '16px',
                    fontWeight: 900,
                    bgcolor: 'white',
                    color: 'black',
                    fontSize: '1.1rem',
                    '&:hover': { bgcolor: '#f0f0f0' }
                  }}
                >
                  {isRedirecting ? 'Redirecting...' : 'Continue to Checkout'}
                </Button>
                
                <Typography sx={{ mt: 3, opacity: 0.4, fontSize: '0.75rem', px: 2 }}>
                  Your subscription time is calculated based on your contribution. Any payment amount is automatically converted into active Pro time.
                </Typography>
              </Box>
            </Grid>
          </Grid>
        </Paper>
      </Container>
    </Box>
  );
}

