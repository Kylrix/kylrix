'use client';

import React from 'react';
import { 
  Box, 
  Container, 
  Typography, 
  Button, 
  Stack, 
  Grid, 
  alpha,
  Divider,
  Paper,
  Tooltip,
} from '@mui/material';
import { Info } from 'lucide-react';
import NextLink from 'next/link';
import { useRouter } from 'next/navigation';
import Navbar from '@/components/Navbar';
import Logo from '@/components/Logo';
import { useAuth } from '@/context/auth/AuthContext';
import { getEcosystemUrl } from '@/lib/ecosystem';
import { useSubscription } from '@/context/subscription/SubscriptionContext';
import { SubscriptionTier } from '@/lib/subscription/ppp';

export default function PricingPage() {
  const { user, isAuthenticated, openIDMWindow } = useAuth();
  const { prices, detectedRegion, paymentMethod, setPaymentMethod, exchangeRates } = useSubscription();
  const [isRedirecting, setIsRedirecting] = React.useState(false);
  const [waitingForAuth, setWaitingForAuth] = React.useState(false);
  const router = useRouter();

  const getCheckoutUrl = React.useCallback((tier: string) => {
    return `${getEcosystemUrl('accounts')}/subscription/pro/checkout?planId=${tier}&source=${encodeURIComponent(window.location.href)}`;
  }, []);

  const handleSelectTier = (tier: string) => {
    const checkoutUrl = getCheckoutUrl(tier);
    
    if (!isAuthenticated) {
      setWaitingForAuth(true);
      openIDMWindow(checkoutUrl);
      return;
    }
    
    setIsRedirecting(true);
    window.location.assign(checkoutUrl);
  };

  // Automatically redirect if we become authenticated while on this page
  // and we were waiting for it.
  React.useEffect(() => {
    if (isAuthenticated && waitingForAuth && !isRedirecting) {
      const checkoutUrl = getCheckoutUrl('PRO_MONTH');
      setIsRedirecting(true);
      window.location.assign(checkoutUrl);
    }
  }, [isAuthenticated, waitingForAuth, isRedirecting, getCheckoutUrl]);

  const tiers = [
    { 
      id: 'PRO_MONTH', 
      name: 'Pro Monthly', 
      description: 'Advanced Intelligence & Unlimited Scale',
      price: prices['PRO'],
      period: '/mo',
      features: [
        '24/7 Priority Support', 
        'Neural Knowledge Graph', 
        'Unlimited Vault Slots', 
        'AI-Enhanced Intelligence', 
        'Advanced Flow Orchestration', 
        'Zero-Knowledge DMs'
      ] 
    },
    { 
      id: 'PRO_YEAR', 
      name: 'Pro Yearly', 
      description: 'Full Power with 2 Months Free',
      price: (prices['PRO'] || 0) * 10,
      period: '/yr',
      features: [
        'Everything in Monthly',
        '2 Months Free (12 for 10)',
        'Neural Knowledge Graph', 
        'Unlimited Vault Slots', 
        'Advanced Flow Orchestration', 
        'Zero-Knowledge DMs'
      ] 
    },
  ];

  return (
    <Box component="main" sx={{ pt: 12, minHeight: '100vh', bgcolor: '#050505', color: 'white' }}>
      <Navbar />
      <div className="bg-mesh" />

      <Container maxWidth="xl" sx={{ py: { xs: 8, md: 15 }, position: 'relative', zIndex: 1 }}>
        <header style={{ textAlign: 'center', marginBottom: '80px' }}>
          <Typography 
            variant="h1" 
            sx={{ 
              mb: 2, 
              fontWeight: 900,
              fontSize: { xs: '2.5rem', sm: '3.5rem', md: '5rem' },
              fontFamily: 'Clash Display',
              lineHeight: 1.1,
              letterSpacing: '-0.02em'
            }}
          >
            Global Pricing
          </Typography>
          <Typography variant="body1" sx={{ opacity: 0.6, fontSize: { xs: '0.9rem', md: '1.1rem' }, px: 2, fontFamily: 'Satoshi' }}>
            Regional adjustments for {detectedRegion.name} ({detectedRegion.countryCode})
          </Typography>
        </header>

        <Grid container spacing={4} sx={{ mb: { xs: 6, md: 10 } }} justifyContent="center">
          {tiers.map((tier) => (
            <Grid size={{ xs: 12, sm: 8, md: 5 }} key={tier.id}>
              <Paper 
                elevation={0}
                sx={{
                  p: { xs: 4, sm: 5, md: 6 },
                  height: '100%',
                  border: '1px solid rgba(255, 255, 255, 0.05)',
                  borderRadius: '32px',
                  background: 'rgba(255, 255, 255, 0.02)',
                  backdropFilter: 'blur(20px)',
                  display: 'flex',
                  flexDirection: 'column',
                  transition: 'all 0.4s cubic-bezier(0.4, 0, 0.2, 1)',
                  '&:hover': { 
                    borderColor: 'rgba(255, 255, 255, 0.1)',
                    background: 'rgba(255, 255, 255, 0.04)',
                    transform: { xs: 'none', md: 'translateY(-8px)' },
                  }
                }}
              >
                <Typography variant="h3" sx={{ fontFamily: 'Clash Display', fontSize: { xs: '1.75rem', md: '2rem' }, mb: 1, fontWeight: 900, letterSpacing: '-0.02em' }}>Kylrix {tier.name}</Typography>
                <Typography variant="body2" sx={{ opacity: 0.5, mb: 4, fontFamily: 'Satoshi' }}>{tier.description}</Typography>
                
                <Box sx={{ mb: { xs: 4, md: 5 } }}>
                  {detectedRegion.countryCode !== 'US' && exchangeRates[detectedRegion.currency] && (
                    <Stack direction="row" spacing={1} alignItems="center" sx={{ mb: 1, opacity: 0.5 }}>
                      <Typography sx={{ fontSize: '0.8rem', fontWeight: 600, fontFamily: 'JetBrains Mono' }}>
                        ≈ {detectedRegion.symbol}{(tier.price * (exchangeRates[detectedRegion.currency] || 1)).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                        </Typography>
                        <Tooltip title={`Estimated conversion from USD to ${detectedRegion.currency} based on current market rates. Actual crypto charges are pinned to USD.`}>
                        <Info size={12} cursor="help" />
                        </Tooltip>
                        </Stack>
                        )}
                        <Stack direction="row" alignItems="baseline" sx={{ flexWrap: 'wrap' }}>
                        <Typography 
                        component="span" 
                        sx={{ 
                        fontSize: { xs: '2.2rem', sm: '2.5rem', md: '3.5rem' }, 
                        fontWeight: 900, 
                        fontFamily: 'JetBrains Mono',
                        lineHeight: 1
                        }}
                        >
                        ${tier.price?.toFixed(2)}
                        </Typography>
                        <Typography 
                        component="span" 
                        sx={{ 
                        opacity: 0.4, 
                        ml: 1, 
                        fontSize: { xs: '0.85rem', md: '1.1rem' }, 
                        fontFamily: 'Satoshi' 
                        }}
                        >
                        {tier.period}
                        </Typography>
                        </Stack>

                </Box>

                <Stack spacing={2.5} sx={{ mb: { xs: 6, md: 8 }, flexGrow: 1 }}>
                  {tier.features.map((feature, i) => (
                    <Stack key={i} direction="row" spacing={2} alignItems="center">
                      <Box sx={{ 
                        width: 20, 
                        height: 20, 
                        borderRadius: '6px', 
                        bgcolor: 'rgba(255, 255, 255, 0.05)', 
                        display: 'flex', 
                        alignItems: 'center', 
                        justifyContent: 'center',
                        border: '1px solid rgba(255, 255, 255, 0.1)'
                      }}>
                        <Typography sx={{ color: 'white', fontWeight: 900, fontSize: '0.7rem' }}>✓</Typography>
                      </Box>
                      <Typography variant="body2" sx={{ fontSize: { xs: '0.875rem', md: '0.95rem' }, opacity: 0.7, fontFamily: 'Satoshi' }}>{feature}</Typography>
                    </Stack>
                  ))}
                </Stack>

                <Button 
                  onClick={() => handleSelectTier(tier.id)}
                  fullWidth
                  variant="contained"
                  sx={{
                    py: 2,
                    borderRadius: '16px',
                    fontWeight: 800,
                    bgcolor: 'white',
                    color: 'black',
                    border: '1px solid rgba(255, 255, 255, 0.1)',
                    textTransform: 'none',
                    fontFamily: 'Satoshi',
                    fontSize: '1rem',
                    transition: 'all 0.3s',
                    '&:hover': {
                        bgcolor: 'rgba(255,255,255,0.9)',
                        borderColor: 'rgba(255, 255, 255, 0.2)',
                        transform: 'scale(1.02)'
                    }
                  }}
                >
                  Select {tier.name}
                </Button>
              </Paper>
            </Grid>
          ))}
        </Grid>

        {/* Free Tier Callout */}
        <Paper 
          elevation={0}
          sx={{
            p: { xs: 4, sm: 5, md: 6 },
            borderRadius: '32px',
            background: 'rgba(255, 255, 255, 0.01)',
            border: '1px solid rgba(255, 255, 255, 0.05)',
            display: 'flex',
            flexDirection: { xs: 'column', md: 'row' },
            justifyContent: 'space-between',
            alignItems: 'center',
            backdropFilter: 'blur(30px)',
            gap: { xs: 3, md: 4 },
            textAlign: { xs: 'center', md: 'left' }
          }}
        >
          <Box>
            <Typography variant="h4" sx={{ fontFamily: 'Clash Display', fontSize: { xs: '1.5rem', md: '1.75rem' }, fontWeight: 900, mb: 1, letterSpacing: '-0.02em' }}>Kylrix Free</Typography>
            <Typography variant="body2" sx={{ opacity: 0.5, fontSize: { xs: '0.875rem', md: '1rem' }, fontFamily: 'Satoshi' }}>High-performance tools for everyone—free forever. Experience the full core ecosystem with no restrictions and no credit card required.</Typography>
          </Box>
          <Button 
            onClick={() => window.location.assign('/dashboard')}
            variant="outlined"
            sx={{
              width: { xs: '100%', md: 'auto' },
              px: 5,
              py: { xs: 1.5, md: 2 },
              borderRadius: '16px',
              borderColor: 'rgba(255, 255, 255, 0.1)',
              color: 'white',
              fontWeight: 800,
              textTransform: 'none',
              fontFamily: 'Satoshi',
              fontSize: '1rem',
              '&:hover': {
                borderColor: 'white',
                bgcolor: 'rgba(255, 255, 255, 0.05)'
              }
            }}
          >
            Continue Free
          </Button>
        </Paper>
      </Container>

      {/* Footer */}
      <Box sx={{ py: 15, borderTop: '1px solid rgba(255,255,255,0.1)', bgcolor: 'rgba(5,5,5,0.8)' }}>
        <Container maxWidth="xl">
          <Grid container spacing={8}>
            <Grid size={{ xs: 12, md: 5 }}>
              <Logo size={40} sx={{ mb: 4 }} />
              <Typography variant="body1" sx={{ opacity: 0.4, maxWidth: 400 }}>
                High-fidelity secure productivity applications. Built for the future of digital sovereignty.
              </Typography>
            </Grid>
            <Grid size={{ xs: 12, md: 7 }}>
              <Grid container spacing={8} justifyContent="flex-end">
                {[
                  { title: 'Resources', links: ['Docs', 'Developers', 'Downloads'] },
                  { title: 'Legal', links: ['Privacy', 'Terms'] }
                ].map((col) => (
                  <Grid size={{ xs: 6, sm: 4 }} key={col.title}>
                    <Typography variant="subtitle2" sx={{ mb: 4, color: '#fff', opacity: 0.3, letterSpacing: '0.2em', textTransform: 'uppercase' }}>{col.title}</Typography>
                    <Stack spacing={2}>
                      {col.links.map(link => (
                        <Box key={link} component={NextLink} href={`/${link.toLowerCase()}`} sx={{ textDecoration: 'none' }}>
                          <Typography 
                            variant="body2" 
                            sx={{ 
                              fontWeight: 500, 
                              opacity: 0.5, 
                              color: 'white',
                              transition: 'all 0.3s',
                              '&:hover': { opacity: 1, color: '#6366F1' } 
                            }}
                          >
                            {link}
                          </Typography>
                        </Box>
                      ))}
                    </Stack>
                  </Grid>
                ))}
              </Grid>
            </Grid>
          </Grid>
          <Box sx={{ mt: 10, pt: 8, borderTop: '1px solid rgba(255,255,255,0.05)' }}>
            <Typography variant="caption" sx={{ opacity: 0.2, color: 'white' }}>
              © 2026 Kylrix Organization. Built with absolute precision.
            </Typography>
          </Box>
        </Container>
      </Box>
    </Box>
  );
}
