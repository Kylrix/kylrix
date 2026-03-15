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
} from '@mui/material';
import NextLink from 'next/link';
import Navbar from '@/components/Navbar';
import Logo from '@/components/Logo';
import { useSubscription } from '@/context/subscription/SubscriptionContext';
import { SubscriptionTier } from '@/lib/subscription/ppp';

export default function PricingPage() {
  const { prices, detectedRegion, paymentMethod, setPaymentMethod } = useSubscription();

  const tiers: { id: SubscriptionTier; name: string; description: string; features: string[] }[] = [
    { 
      id: 'PRO', 
      name: 'Pro', 
      description: 'The Fair Standard',
      features: ['24/7 Priority Support', 'Basic Knowledge Graph', '5 Private Vault Slots'] 
    },
    { 
      id: 'ULTRA', 
      name: 'Ultra', 
      description: 'The Intelligence Engine',
      features: ['AI Knowledge Expansion', 'Advanced Flow Automations', 'Zero-Knowledge DMs'] 
    },
    { 
      id: 'ENTERPRISE', 
      name: 'Enterprise', 
      description: 'The Absolute Tier',
      features: ['Unlimited Scale', 'Custom AI Models', 'Full Governance Control'] 
    },
  ];

  return (
    <Box component="main" sx={{ pt: 12 }}>
      <Navbar />
      <div className="bg-mesh" />

      <Container maxWidth="xl" sx={{ py: { xs: 8, md: 15 } }}>
        <header style={{ textAlign: 'center', marginBottom: '60px' }}>
          <Typography 
            variant="h1" 
            sx={{ 
              mb: 2, 
              fontWeight: 900,
              fontSize: { xs: '2.5rem', sm: '3.5rem', md: '5rem' },
              fontFamily: 'Clash Display',
              lineHeight: 1.1
            }}
          >
            Global Pricing
          </Typography>
          <Typography variant="body1" sx={{ opacity: 0.7, fontSize: { xs: '0.9rem', md: '1.1rem' }, px: 2 }}>
            Regional adjustments for {detectedRegion.name} ({detectedRegion.countryCode})
          </Typography>
          
          {/* Payment Method Toggle */}
          <Stack 
            direction={{ xs: 'column', sm: 'row' }} 
            justifyContent="center" 
            spacing={2} 
            sx={{ mt: 5, px: 2 }}
          >
            <Button 
              onClick={() => setPaymentMethod('CRYPTO')}
              sx={{
                width: { xs: '100%', sm: 'auto' },
                px: 4,
                py: 1.5,
                borderRadius: '100px',
                border: '1px solid rgba(255,255,255,0.1)',
                bgcolor: paymentMethod === 'CRYPTO' ? 'white' : 'transparent',
                color: paymentMethod === 'CRYPTO' ? 'black' : 'white',
                fontWeight: 700,
                fontSize: { xs: '0.8rem', sm: '0.875rem' },
                opacity: paymentMethod === 'CRYPTO' ? 1 : 0.5,
                '&:hover': {
                    bgcolor: paymentMethod === 'CRYPTO' ? 'white' : 'rgba(255,255,255,0.05)',
                }
              }}
            >
              Crypto (The Fair Price)
            </Button>
            <Button 
              onClick={() => setPaymentMethod('CARD')}
              sx={{
                width: { xs: '100%', sm: 'auto' },
                px: 4,
                py: 1.5,
                borderRadius: '100px',
                border: '1px solid rgba(255,255,255,0.1)',
                bgcolor: paymentMethod === 'CARD' ? 'white' : 'transparent',
                color: paymentMethod === 'CARD' ? 'black' : 'white',
                fontWeight: 700,
                fontSize: { xs: '0.8rem', sm: '0.875rem' },
                opacity: paymentMethod === 'CARD' ? 1 : 0.5,
                '&:hover': {
                    bgcolor: paymentMethod === 'CARD' ? 'white' : 'rgba(255,255,255,0.05)',
                }
              }}
            >
              Legacy Card (Surcharge 1.25x)
            </Button>
          </Stack>
        </header>

        <Grid container spacing={4} sx={{ mb: { xs: 6, md: 10 } }}>
          {tiers.map((tier) => (
            <Grid size={{ xs: 12, md: 4 }} key={tier.id}>
              <Box 
                sx={{
                  p: { xs: 4, sm: 5, md: 6 },
                  height: '100%',
                  border: '1px solid rgba(255, 255, 255, 0.1)',
                  borderRadius: { xs: 6, md: 8 },
                  background: 'rgba(10, 10, 10, 0.8)',
                  backdropFilter: 'blur(30px) saturate(180%)',
                  display: 'flex',
                  flexDirection: 'column',
                  transition: 'all 0.4s',
                  '&:hover': { 
                    borderColor: 'rgba(255, 255, 255, 0.2)',
                    transform: { xs: 'none', md: 'translateY(-12px)' },
                    bgcolor: 'rgba(15, 15, 15, 0.95)',
                  }
                }}
              >
                <Typography variant="h3" sx={{ fontFamily: 'Clash Display', fontSize: { xs: '1.75rem', md: '2rem' }, mb: 1, fontWeight: 900 }}>{tier.name}</Typography>
                <Typography variant="body2" sx={{ opacity: 0.5, mb: 4 }}>{tier.description}</Typography>
                
                <Box sx={{ mb: { xs: 3, md: 5 } }}>
                  <Typography component="span" sx={{ fontSize: { xs: '2.5rem', md: '3rem' }, fontWeight: 900 }}>
                    {detectedRegion.symbol}{prices[tier.id].toFixed(2)}
                  </Typography>
                  <Typography component="span" sx={{ opacity: 0.5, ml: 1, fontSize: { xs: '1rem', md: '1.2rem' } }}>/mo</Typography>
                </Box>

                <Stack spacing={2} sx={{ mb: { xs: 4, md: 6 }, flexGrow: 1 }}>
                  {tier.features.map((feature, i) => (
                    <Stack key={i} direction="row" spacing={2} alignItems="center" sx={{ opacity: 0.8 }}>
                      <Typography sx={{ color: '#4CAF50', fontWeight: 900, fontSize: '0.9rem' }}>✓</Typography>
                      <Typography variant="body2" sx={{ fontSize: { xs: '0.875rem', md: '1rem' } }}>{feature}</Typography>
                    </Stack>
                  ))}
                </Stack>

                <Button 
                  fullWidth
                  variant={tier.id === 'ULTRA' ? "contained" : "outlined"}
                  sx={{
                    py: 2,
                    borderRadius: 3,
                    fontWeight: 900,
                    bgcolor: tier.id === 'ULTRA' ? 'white' : 'transparent',
                    color: tier.id === 'ULTRA' ? 'black' : 'white',
                    borderColor: 'rgba(255,255,255,0.1)',
                    '&:hover': {
                        bgcolor: tier.id === 'ULTRA' ? 'rgba(255,255,255,0.9)' : 'rgba(255,255,255,0.05)',
                        borderColor: 'white'
                    }
                  }}
                >
                  Select {tier.name}
                </Button>
              </Box>
            </Grid>
          ))}
        </Grid>

        {/* Free Tier Callout */}
        <Box 
          sx={{
            p: { xs: 4, sm: 5, md: 6 },
            borderRadius: { xs: 6, md: 8 },
            background: 'rgba(255, 255, 255, 0.02)',
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
            <Typography variant="h4" sx={{ fontFamily: 'Clash Display', fontSize: { xs: '1.5rem', md: '1.75rem' }, fontWeight: 900, mb: 1 }}>Kylrix Free</Typography>
            <Typography variant="body2" sx={{ opacity: 0.6, fontSize: { xs: '0.875rem', md: '1rem' } }}>Basic access for individuals. No credit card required.</Typography>
          </Box>
          <Button 
            onClick={() => window.location.assign('/dashboard')}
            variant="outlined"
            sx={{
              width: { xs: '100%', md: 'auto' },
              px: 5,
              py: { xs: 1.5, md: 2 },
              borderRadius: 3,
              borderColor: 'rgba(255, 255, 255, 0.1)',
              color: 'white',
              fontWeight: 900,
              '&:hover': {
                borderColor: 'white',
                bgcolor: 'rgba(255, 255, 255, 0.05)'
              }
            }}
          >
            Continue Free
          </Button>
        </Box>
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
