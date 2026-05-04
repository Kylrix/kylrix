"use client";

import { useEffect } from "react";
import { Box, Container, Stack, Typography, Button, CircularProgress, AppBar, Toolbar } from "@mui/material";
import { useRouter } from "next/navigation";
import { useAppwriteVault } from "@/context/appwrite-context";
import PasswordGenerator from "@/components/ui/PasswordGenerator";
import Logo from "@/components/common/Logo";

export default function LandingPage() {
  const { user, openIDMWindow, isAuthenticating } = useAppwriteVault();
  const router = useRouter();

  useEffect(() => {
    if (user) {
      router.replace("/dashboard");
    }
  }, [user, router]);

  return (
    <Box sx={{ 
      display: 'flex', 
      flexDirection: 'column', 
      minHeight: '100vh', 
      bgcolor: '#0A0908', 
      color: 'white',
      backgroundImage: 'radial-gradient(circle at 50% -20%, rgba(16, 185, 129, 0.08) 0%, transparent 50%)'
    }}>
      <AppBar 
        position="sticky" 
        sx={{ 
          bgcolor: 'rgba(10, 9, 8, 0.8)', 
          backdropFilter: 'blur(25px) saturate(180%)', 
          borderBottom: '1px solid rgba(255, 255, 255, 0.1)',
          boxShadow: 'none',
        }}
      >
        <Toolbar sx={{ justifyContent: 'space-between', px: { xs: 2, md: 5 }, height: 80 }}>
          <Stack direction="row" spacing={1.5} alignItems="center">
            <Logo app="vault" size={36} variant="full" href="/" component="a" />
          </Stack>
          
          <Box>
            <Button 
              variant="text" 
              onClick={() => openIDMWindow()}
              disabled={isAuthenticating}
              sx={{ 
                color: '#10B981',
                fontWeight: 900,
                textTransform: 'uppercase',
                letterSpacing: '0.1em'
              }}
            >
              {isAuthenticating ? <CircularProgress size={20} color="inherit" /> : 'Sign In'}
            </Button>
          </Box>
        </Toolbar>
      </AppBar>

      <Box component="main" sx={{ flex: 1, py: { xs: 4, md: 8 } }}>
        <Container maxWidth="md">
          <Stack spacing={6}>
            {/* Header Section */}
            <Box sx={{ textAlign: 'center' }}>
              <Typography variant="h3" sx={{ 
                fontWeight: 900, 
                mb: 2,
                fontSize: { xs: '2rem', md: '2.5rem' },
                background: 'linear-gradient(135deg, #10B981 0%, #10B981 100%)',
                WebkitBackgroundClip: 'text',
                WebkitTextFillColor: 'transparent',
                backgroundClip: 'text',
              }}>
                Generate Secure Passwords
              </Typography>
              <Typography variant="body1" sx={{ 
                color: 'rgba(255, 255, 255, 0.6)',
                maxWidth: '500px',
                mx: 'auto',
                lineHeight: 1.6,
                fontSize: '1.05rem'
              }}>
                Create powerful, random passwords instantly. No sign-up required. Keep them safe with your vault when you're ready.
              </Typography>
            </Box>

            {/* Password Generator Component */}
            <Box sx={{ 
              display: 'flex',
              justifyContent: 'center'
            }}>
              <Box sx={{ width: '100%', maxWidth: '500px' }}>
                <PasswordGenerator />
              </Box>
            </Box>

            {/* Sign In CTA */}
            {!user && (
              <Box sx={{ 
                textAlign: 'center', 
                pt: 4, 
                borderTop: '1px solid rgba(255, 255, 255, 0.08)',
                mt: 2
              }}>
                <Stack spacing={3} alignItems="center">
                  <Box>
                    <Typography variant="body2" sx={{ 
                      color: 'rgba(255, 255, 255, 0.5)', 
                      mb: 2,
                      fontWeight: 500
                    }}>
                      Ready to securely manage all your passwords?
                    </Typography>
                  </Box>
                  <Button
                    variant="contained"
                    size="large"
                    disabled={isAuthenticating}
                    onClick={() => {
                      try {
                        openIDMWindow();
                      } catch (err: unknown) {
                        alert(err instanceof Error ? err.message : "Failed to open authentication");
                      }
                    }}
                    sx={{
                      bgcolor: '#10B981',
                      color: '#000',
                      px: 5,
                      py: 1.75,
                      borderRadius: '16px',
                      fontWeight: 900,
                      fontSize: '1rem',
                      textTransform: 'none',
                      boxShadow: '0 8px 25px rgba(16, 185, 129, 0.25)',
                      transition: 'all 0.3s cubic-bezier(0.4, 0, 0.2, 1)',
                      '&:hover': {
                        bgcolor: '#0d9b70',
                        transform: 'translateY(-2px)',
                        boxShadow: '0 12px 35px rgba(16, 185, 129, 0.35)'
                      },
                      '&:disabled': {
                        bgcolor: 'rgba(255,255,255,0.1)',
                        color: 'rgba(255,255,255,0.3)'
                      }
                    }}
                  >
                    {isAuthenticating ? <CircularProgress size={20} color="inherit" /> : 'Sign In to Vault'}
                  </Button>
                </Stack>
              </Box>
            )}
          </Stack>
        </Container>
      </Box>

      <Box component="footer" sx={{ 
        borderTop: '1px solid rgba(255, 255, 255, 0.05)', 
        py: 6, 
        textAlign: 'center',
        bgcolor: 'rgba(0, 0, 0, 0.2)'
      }}>
        <Typography variant="caption" sx={{ 
          color: 'rgba(255, 255, 255, 0.2)', 
          fontWeight: 700, 
          letterSpacing: '0.1em' 
        }}>
          © 2026 KYLRIX VAULT. ZERO-KNOWLEDGE PASSWORD MANAGEMENT.
        </Typography>
      </Box>
    </Box>
  );
}
