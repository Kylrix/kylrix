"use client";

import React, { useEffect } from 'react';
import { 
  Box, 
  Container, 
  Typography, 
  Stack, 
  Grid, 
  AppBar, 
  Toolbar, 
  Link,
  Avatar
} from '@mui/material';
import { Button } from '@/components/ui/Button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/Card';
import { useAuth } from '@/components/ui/AuthContext';
import {
  Description as DescriptionIcon,
  CloudUpload as CloudIcon,
  VerifiedUser as ShieldCheckIcon,
} from '@mui/icons-material';
import { useRouter } from 'next/navigation';
import Logo from '@/components/common/Logo';

const features = [
  {
    icon: <DescriptionIcon style={{ height: 32, width: 32 }} />,
    title: 'Secure Note Taking',
    description:
      "Capture your ideas with professional-grade note taking tools and comprehensive organizing features.",
  },
  {
    icon: <CloudIcon style={{ height: 32, width: 32 }} />,
    title: 'Secure Synchronization',
    description:
      'Securely store and share your notes with professional-grade encryption and private access control.',
  },
  {
    icon: <ShieldCheckIcon style={{ height: 32, width: 32 }} />,
    title: 'Smart Organization',
    description:
      'Organize your thoughts with tags, search, and secure cloud management.',
  },
];

export default function LandingPage() {
  const { openIDMWindow, isAuthenticated, user, isAuthenticating } = useAuth();
  const router = useRouter();

  useEffect(() => {
    if (isAuthenticated) {
      router.replace('/notes');
      return;
    }
  }, [isAuthenticated, router]);

  // Generate user initials from name or email
  const getUserInitials = (user: any): string => {
    if (user?.name) {
      return user.name.split(' ').map((n: string) => n[0]).join('').toUpperCase().slice(0, 2);
    }
    if (user?.email) {
      return user.email.slice(0, 2).toUpperCase();
    }
    return 'U';
  };

  return (
    <Box sx={{ 
      display: 'flex', 
      flexDirection: 'column', 
      minHeight: '100vh', 
      bgcolor: '#0A0908', 
      color: 'rgba(255, 255, 255, 0.9)',
      backgroundImage: 'radial-gradient(circle at 50% -20%, rgba(99, 102, 241, 0.1) 0%, transparent 70%)'
    }}>
      <AppBar 
        position="sticky" 
        sx={{ 
          bgcolor: 'rgba(10, 9, 8, 0.8)', 
          backdropFilter: 'none', 
          borderBottom: '1px solid rgba(255, 255, 255, 0.05)',
          boxShadow: 'none',
          backgroundImage: 'none'
        }}
      >
        <Toolbar sx={{ justifyContent: 'space-between', px: { xs: 2, md: 5 }, height: 80 }}>
          <Stack direction="row" spacing={1.5} alignItems="center">
            <Logo 
              app="note" 
              size={36} 
              variant="full" 
              href="/"
              component="a"
              sx={{ '&:hover': { opacity: 0.8 } }}
            />
          </Stack>
          
          <Stack direction="row" spacing={4} sx={{ display: { xs: 'none', md: 'flex' }, flex: 1, justifyContent: 'center' }}>
            {['Product', 'Solutions', 'Resources', 'Pricing'].map((item) => (
              <Link
                key={item}
                href="#"
                underline="none"
                sx={{ 
                  fontSize: '0.75rem', 
                  fontWeight: 700, 
                  color: 'rgba(255, 255, 255, 0.5)',
                  fontFamily: '"Space Grotesk", sans-serif',
                  textTransform: 'uppercase',
                  letterSpacing: '0.1em',
                  transition: 'all 0.2s',
                  '&:hover': { color: '#6366F1' }
                }}
              >
                {item}
              </Link>
            ))}
          </Stack>

          <Box>
            {isAuthenticated ? (
              <Avatar sx={{ 
                bgcolor: '#6366F1', 
                color: '#000', 
                width: 36, 
                height: 36, 
                fontSize: '0.875rem', 
                fontWeight: 900,
                fontFamily: '"Space Grotesk", sans-serif'
              }}>
                {getUserInitials(user)}
              </Avatar>
            ) : (
              <Button 
                variant="text" 
                onClick={() => openIDMWindow()}
                isLoading={isAuthenticating}
                sx={{ 
                  color: '#6366F1',
                  fontWeight: 900,
                  fontFamily: '"Space Grotesk", sans-serif',
                  textTransform: 'uppercase',
                  letterSpacing: '0.1em'
                }}
              >
                Login
              </Button>
            )}
          </Box>
        </Toolbar>
      </AppBar>

      <Box component="main" sx={{ flex: 1 }}>
        <Box sx={{ py: { xs: 12, md: 20 }, textAlign: 'center', position: 'relative' }}>
          <Container maxWidth="md">
            <Typography 
              variant="h1" 
              sx={{ 
                mb: 3, 
                fontSize: { xs: '3rem', md: '5.5rem' }, 
                fontWeight: 900, 
                lineHeight: 0.9,
                fontFamily: 'var(--font-clash), "Space Grotesk", sans-serif',
                textTransform: 'uppercase',
                letterSpacing: '-0.02em',
                background: 'linear-gradient(to bottom, #FFF 0%, rgba(255,255,255,0.7) 100%)',
                WebkitBackgroundClip: 'text',
                WebkitTextFillColor: 'transparent',
              }}
            >
              Your notes, <br />
              <Box component="span" sx={{ color: '#6366F1', WebkitTextFillColor: '#6366F1' }}>Secured</Box>
            </Typography>
            <Typography 
              variant="body1" 
              sx={{ 
                mb: 8, 
                color: 'rgba(255, 255, 255, 0.5)', 
                fontSize: { xs: '1.125rem', md: '1.25rem' }, 
                maxWidth: '650px', 
                mx: 'auto',
                fontFamily: 'var(--font-satoshi), sans-serif',
                lineHeight: 1.6
              }}
            >
              Transform your ideas with professional note taking and secure your notes. 
              Capture comprehensive content instantly, collaborate seamlessly, and own your data forever.
            </Typography>

            <Stack direction="column" alignItems="center" spacing={2} sx={{ mb: 10 }}>
              <Button 
                size="large" 
                sx={{ 
                  px: 8, 
                  py: 2.5, 
                  fontSize: '1.125rem', 
                  fontWeight: 900,
                  fontFamily: '"Space Grotesk", sans-serif',
                  textTransform: 'uppercase',
                  letterSpacing: '0.1em',
                  bgcolor: '#6366F1',
                  color: '#000',
                  borderRadius: '100px',
                  boxShadow: '0 0 30px rgba(99, 102, 241, 0.3)',
                  '&:hover': {
                    bgcolor: '#00D1D9',
                    boxShadow: '0 0 40px rgba(99, 102, 241, 0.5)',
                  }
                }}
                onClick={() => openIDMWindow()}
                isLoading={isAuthenticating}
              >
                Get Started Free
              </Button>
            </Stack>
          </Container>
        </Box>

        <Box sx={{ py: { xs: 12, md: 20 }, bgcolor: '#0A0908' }}>
          <Container>
            <Box sx={{ textAlign: 'center', mb: 12, maxWidth: '800px', mx: 'auto' }}>
              <Typography 
                variant="h2" 
                sx={{ 
                  mb: 3, 
                  fontWeight: 900, 
                  fontFamily: 'var(--font-clash), "Space Grotesk", sans-serif',
                  textTransform: 'uppercase',
                  letterSpacing: '0.05em',
                  fontSize: { xs: '2rem', md: '3.5rem' }
                }}
              >
                Secure notes <br />
                <Box component="span" sx={{ color: '#6366F1' }}>for the future</Box>
              </Typography>
              <Typography 
                variant="body1" 
                sx={{ 
                  color: 'rgba(255, 255, 255, 0.4)',
                  fontFamily: 'var(--font-satoshi), sans-serif',
                  fontSize: '1.1rem'
                }}
              >
                Experience next-generation note-taking with intelligent organization, 
                private cloud storage, and advanced security built-in.
              </Typography>
            </Box>

            <Grid container spacing={4}>
              {features.map((feature, index) => (
                <Grid size={{ xs: 12, md: 4 }} key={index}>
                  <Card sx={{ 
                    height: '100%', 
                    display: 'flex', 
                    flexDirection: 'column', 
                    gap: 3,
                    bgcolor: '#161412',
                    backdropFilter: 'none',
                    border: '1px solid rgba(255, 255, 255, 0.05)',
                    boxShadow: '0 20px 40px -15px rgba(0,0,0,0.8), inset 0 1px 1px rgba(255,255,255,0.05), inset 0 -1px 0 rgba(0,0,0,0.5)',
                    borderRadius: '32px',
                    p: 2,
                    transition: 'all 0.5s cubic-bezier(0.16, 1, 0.3, 1)',
                    '&:hover': {
                      transform: 'translateY(-8px) scale(1.01)',
                      borderColor: 'rgba(99, 102, 241, 0.3)',
                      boxShadow: '0 40px 80px -20px rgba(0,0,0,0.9), 0 0 20px rgba(99, 102, 241, 0.1), inset 0 1px 1px rgba(255,255,255,0.08)',
                    }
                  }}>
                    <CardHeader>
                      <Box sx={{ 
                        display: 'flex', 
                        height: 64, 
                        width: 64, 
                        alignItems: 'center', 
                        justifyContent: 'center', 
                        borderRadius: '20px', 
                        bgcolor: 'rgba(99, 102, 241, 0.1)', 
                        color: '#6366F1',
                        border: '1px solid rgba(99, 102, 241, 0.2)'
                      }}>
                        {feature.icon}
                      </Box>
                    </CardHeader>
                    <CardContent>
                      <CardTitle sx={{ 
                        mb: 2, 
                        fontWeight: 900, 
                        fontFamily: '"Space Grotesk", sans-serif',
                        textTransform: 'uppercase',
                        letterSpacing: '0.05em',
                        fontSize: '1.25rem'
                      }}>
                        {feature.title}
                      </CardTitle>
                      <Typography 
                        variant="body2" 
                        sx={{ 
                          color: 'rgba(255, 255, 255, 0.5)',
                          fontFamily: 'var(--font-satoshi), sans-serif',
                          lineHeight: 1.6,
                          fontSize: '0.95rem'
                        }}
                      >
                        {feature.description}
                      </Typography>
                    </CardContent>
                  </Card>
                </Grid>
              ))}
            </Grid>
          </Container>
        </Box>
      </Box>

      <Box component="footer" sx={{ borderTop: '1px solid rgba(255, 255, 255, 0.05)', py: 10, bgcolor: '#0A0908' }}>
        <Container>
          <Stack direction={{ xs: 'column', md: 'row' }} justifyContent="space-between" alignItems="center" spacing={6}>
            <Stack direction="row" spacing={4} flexWrap="wrap" justifyContent="center">
              {['About', 'Contact', 'Privacy Policy', 'Terms of Service'].map((item) => (
                <Link
                  key={item}
                  href="#"
                  underline="none"
                  sx={{ 
                    fontSize: '0.75rem', 
                    fontWeight: 700,
                    fontFamily: '"Space Grotesk", sans-serif',
                    textTransform: 'uppercase',
                    letterSpacing: '0.1em',
                    color: 'rgba(255, 255, 255, 0.4)',
                    transition: 'color 0.2s',
                    '&:hover': { color: '#6366F1' }
                  }}
                >
                  {item}
                </Link>
              ))}
            </Stack>
            <Typography 
              variant="body2" 
              sx={{ 
                color: 'rgba(255, 255, 255, 0.2)',
                fontFamily: '"Space Grotesk", sans-serif',
                fontWeight: 700,
                textTransform: 'uppercase',
                letterSpacing: '0.1em',
                fontSize: '0.7rem'
              }}
            >
              © 2025 Kylrix Note. All rights reserved.
            </Typography>
          </Stack>
        </Container>
      </Box>
    </Box>
  );
}
