'use client';

import React from 'react';
import { Box, Container, Typography, Paper, Button } from '@mui/material';
import { CheckCircle2, ShieldCheck, Zap, Globe } from 'lucide-react';
import NextLink from 'next/link';

export default function ProSuccessPage() {
  const [dashboardUrl, setDashboardUrl] = React.useState('https://kylrix.space/dashboard');

  React.useEffect(() => {
    if (typeof window !== 'undefined') {
      const isLocal = window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1';
      if (isLocal) {
        setDashboardUrl('http://localhost:3005/dashboard');
      }
    }
  }, []);

  return (
    <Box component="main" sx={{ minHeight: '100vh', bgcolor: '#0A0908', color: 'white', display: 'flex', alignItems: 'center', py: 10 }}>
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
            overflow: 'hidden'
          }}
        >
          {/* Decorative elements */}
          <Box sx={{ position: 'absolute', top: -100, left: -100, width: 300, height: 300, borderRadius: '50%', background: 'radial-gradient(circle, rgba(99, 102, 241, 0.1) 0%, transparent 70%)', filter: 'blur(50px)' }} />

          <Box sx={{ mb: 6, display: 'flex', justifyContent: 'center' }}>
            <Box sx={{ 
              width: 100, 
              height: 100, 
              borderRadius: '30px', 
              bgcolor: 'rgba(99, 102, 241, 0.1)', 
              color: '#6366F1',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              border: '1px solid rgba(99, 102, 241, 0.2)',
              boxShadow: '0 20px 40px rgba(0,0,0,0.4)'
            }}>
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
              letterSpacing: '-0.02em'
            }}
          >
            Welcome to Pro
          </Typography>
          
          <Typography variant="h6" sx={{ opacity: 0.6, mb: 6, maxWidth: 600, mx: 'auto', fontFamily: 'Satoshi' }}>
            Your account has been upgraded. You now have full access to the high-fidelity Kylrix ecosystem.
          </Typography>

          <Box sx={{ display: 'grid', gridTemplateColumns: { xs: '1fr', sm: '1fr 1fr 1fr' }, gap: 3, mb: 8 }}>
            {[
              { icon: <ShieldCheck />, title: 'Advanced Security', desc: 'Zero-knowledge DMs and vault isolation' },
              { icon: <Zap />, title: 'Intelligence', desc: 'Neural Knowledge Graph and AI expansion' },
              { icon: <Globe />, title: 'Universal', desc: 'Active across all Kylrix applications' }
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
              '&:hover': { bgcolor: 'rgba(255,255,255,0.9)', transform: 'translateY(-2px)' }
            }}
          >
            Launch Dashboard
          </Button>
        </Paper>
      </Container>
    </Box>
  );
}
