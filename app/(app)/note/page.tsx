"use client";

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import dynamic from 'next/dynamic';
import { Box, CircularProgress } from '@mui/material';

const HomeContent = dynamic(
  async () => {
    const { useAuth } = await import('@/components/ui/AuthContext');
    const { useRouter: useRouterHook } = await import('next/navigation');
    const { 
      AppBar, 
      Toolbar, 
      Stack, 
      Typography
    } = await import('@mui/material');
    const Logo = (await import('@/components/common/Logo')).default;
    const { Button } = await import('@/components/ui/Button');
    const { DynamicSidebarProvider, DynamicSidebar } = await import('@/components/ui/DynamicSidebar');
    const { GhostEditor } = await import('@/components/landing/GhostEditor');

    function HomeContentInner() {
      const router = useRouterHook();
      const { isAuthenticated, isLoading, openIDMWindow, isAuthenticating } = useAuth();

      useEffect(() => {
        if (!isLoading && isAuthenticated) {
          router.replace('/note/notes');
        }
      }, [isAuthenticated, isLoading, router]);

      // If authenticated, we show nothing (it will redirect)
      if (isAuthenticated) return null;

      return (
        <DynamicSidebarProvider>
          <Box sx={{ 
            display: 'flex', 
            flexDirection: 'column', 
            minHeight: '100vh', 
            bgcolor: '#0F0D0C', 
            color: 'rgba(255, 255, 255, 0.9)',
            backgroundImage: 'radial-gradient(circle at 50% 0%, rgba(99, 102, 241, 0.05) 0%, transparent 50%)'
          }}>
            <AppBar 
              position="sticky" 
              sx={{ 
                bgcolor: 'rgba(15, 13, 12, 0.8)', 
                backdropFilter: 'blur(25px) saturate(180%)', 
                borderBottom: '1px solid rgba(255, 255, 255, 0.1)',
                boxShadow: 'none',
                backgroundImage: 'none'
              }}
            >
              <Toolbar sx={{ justifyContent: 'space-between', px: { xs: 2, md: 5 }, height: 80 }}>
                <Stack direction="row" spacing={1.5} alignItems="center">
                  <Logo app="note" size={36} variant="full" href="/" component="a" />
                </Stack>
                
                <Box>
                  <Button 
                    variant="text" 
                    onClick={() => openIDMWindow()}
                    isLoading={isAuthenticating}
                    sx={{ 
                      color: '#6366F1',
                      fontWeight: 900,
                      textTransform: 'uppercase',
                      letterSpacing: '0.1em'
                    }}
                  >
                    Sign In
                  </Button>
                </Box>
              </Toolbar>
            </AppBar>

            <Box component="main" sx={{ flex: 1, py: 4 }}>
              <GhostEditor />
            </Box>

            <Box component="footer" sx={{ borderTop: '1px solid rgba(255, 255, 255, 0.05)', py: 6, textAlign: 'center' }}>
              <Typography variant="caption" sx={{ color: 'rgba(255, 255, 255, 0.2)', fontWeight: 700, letterSpacing: '0.1em' }}>
                  © 2026 KYLRIX MESH. POWERED BY SOVEREIGN IDENTITY.
              </Typography>
            </Box>
          </Box>
          <DynamicSidebar />
        </DynamicSidebarProvider>
      );
    }

    return HomeContentInner;
  },
  { ssr: false }
);

export default function Home() {
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  if (!mounted) {
    return (
      <Box sx={{ display: 'flex', height: '100vh', alignItems: 'center', justifyContent: 'center', bgcolor: '#0F0D0C' }}>
        <CircularProgress color="primary" />
      </Box>
    );
  }

  return <HomeContent />;
}
