'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import {
  AppBar,
  Toolbar,
  Typography,
  Box,
  Button,
  Stack,
  Divider,
} from '@mui/material';
import { safeDeleteCurrentSession } from '@/lib/safe-session';
import { User, Settings, LogOut, Home } from 'lucide-react';

interface NavProps {
  userEmail?: string;
}

export default function Navigation({ userEmail }: NavProps) {
  const router = useRouter();

  const handleSignOut = async () => {
    try {
      await safeDeleteCurrentSession();
      router.replace('/login');
    } catch (error) {
      console.error('Sign out failed:', error);
      // Fallback redirect
      router.replace('/login');
    }
  };

  return (
    <AppBar position="sticky" sx={{ 
      boxShadow: 'none', 
      bgcolor: 'rgba(10, 10, 10, 0.8)', 
      backdropFilter: 'blur(20px)',
      borderBottom: '1px solid rgba(255, 255, 255, 0.1)',
      backgroundImage: 'none'
    }}>
      <Toolbar sx={{ maxWidth: '7xl', width: '100%', margin: '0 auto', py: 1 }}>
        <Link href="/" style={{ textDecoration: 'none', color: 'inherit', display: 'flex', alignItems: 'center', gap: 12 }}>
          <Box
            sx={{
              width: 36,
              height: 36,
              background: 'linear-gradient(135deg, #6366F1 0%, #0057FF 100%)',
              borderRadius: '10px',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              boxShadow: '0 0 15px rgba(99, 102, 241, 0.3)'
            }}
          >
            <User size={20} color="black" strokeWidth={2} />
          </Box>
          <Typography
            variant="h6"
            sx={{
              fontWeight: 900,
              letterSpacing: '-0.02em',
              color: 'white',
              fontFamily: 'var(--font-inter)'
            }}
          >
            Kylrix ID
          </Typography>
        </Link>

        <Box sx={{ flexGrow: 1 }} />

        <Stack direction="row" spacing={0.5} sx={{ display: 'flex', alignItems: 'center' }}>
          <Button
            component={Link}
            href="/"
            startIcon={<Home size={18} strokeWidth={1.5} />}
            sx={{ 
              color: 'rgba(255, 255, 255, 0.6)', 
              textTransform: 'none', 
              fontWeight: 600, 
              display: { xs: 'none', sm: 'flex' },
              '&:hover': { color: 'white', bgcolor: 'rgba(255, 255, 255, 0.05)' } 
            }}
          >
            Home
          </Button>
          <Button
            component={Link}
            href="/settings"
            startIcon={<Settings size={18} strokeWidth={1.5} />}
            sx={{ color: 'rgba(255, 255, 255, 0.6)', textTransform: 'none', fontWeight: 600, '&:hover': { color: 'white', bgcolor: 'rgba(255, 255, 255, 0.05)' } }}
          >
            Settings
          </Button>

          {userEmail && (
            <>
              <Divider orientation="vertical" sx={{ borderColor: 'rgba(255,255,255,0.1)', height: 24, mx: 1, display: { xs: 'none', sm: 'block' } }} />
              <Stack direction="row" spacing={2} sx={{ alignItems: 'center', pl: 1 }}>
                <Box sx={{ textAlign: 'right', display: { xs: 'none', md: 'block' } }}>
                  <Typography variant="caption" sx={{ color: 'rgba(255,255,255,0.5)', display: 'block', lineHeight: 1 }}>
                    Personal Identity
                  </Typography>
                  <Typography variant="body2" sx={{ fontWeight: 700, color: 'white' }}>
                    {userEmail}
                  </Typography>
                </Box>
                <Button
                  onClick={handleSignOut}
                  startIcon={<LogOut size={18} strokeWidth={1.5} />}
                  variant="outlined"
                  size="small"
                  sx={{
                    borderColor: 'rgba(255, 77, 77, 0.3)',
                    color: '#FF4D4D',
                    fontWeight: 700,
                    textTransform: 'none',
                    borderRadius: '10px',
                    '&:hover': {
                      borderColor: '#FF4D4D',
                      bgcolor: 'rgba(255, 77, 77, 0.05)',
                    },
                    '& .MuiButton-startIcon': {
                      margin: { xs: 0, sm: 'inherit' }
                    }
                  }}
                >
                  <Box component="span" sx={{ display: { xs: 'none', sm: 'inline' } }}>Sign Out</Box>
                </Button>
              </Stack>
            </>
          )}
        </Stack>
      </Toolbar>
    </AppBar>
  );
}
