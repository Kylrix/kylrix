"use client";
import { useEffect, useState } from "react";
import { useRouter, usePathname } from "next/navigation";
import { getCurrentUser } from "@/lib/appwrite";
import { useAuth } from "./AuthContext";
import Navigation from "../Navigation";
import QuickCreateFab from "./QuickCreateFab";
import { Box, CircularProgress, Typography } from "@mui/material";

const PUBLIC_ROUTES = [
  "/reset", "/verify", "/landing"
];

function isPublicRoute(path: string) {
  return PUBLIC_ROUTES.includes(path);
}

interface AppShellProps {
  children: React.ReactNode;
}

export default function AppShell({ children }: AppShellProps) {
  const router = useRouter();
  const pathname = usePathname();
  const { openIDMWindow, idmWindowOpen } = useAuth();
  const [authChecked, setAuthChecked] = useState(false);


  useEffect(() => {
    if (isPublicRoute(pathname)) {
      setAuthChecked(true);
      return;
    }
    getCurrentUser()
      .then(user => {
        if (!user) openIDMWindow();
        setAuthChecked(true);
      })
      .catch(() => {
        openIDMWindow();
        setAuthChecked(true);
      });
  }, [pathname, openIDMWindow]);

  const handleCreateNote = () => {
    router.push('/notes/new');
  };

  const handleCreateDoodle = () => {
    router.push('/notes/new?format=doodle');
  };

  const handleCreateVoiceNote = () => {
    console.log('Creating voice note...');
  };

  const handleCreatePhotoNote = () => {
    console.log('Creating photo note...');
  };

  const handleCreateLinkNote = () => {
    console.log('Creating link note...');
  };

  if (!authChecked) {
    return (
      <Box 
        sx={{ 
          display: 'flex', 
          flexDirection: 'column',
          alignItems: 'center', 
          justifyContent: 'center', 
          minHeight: '100vh',
          gap: 3,
          bgcolor: 'rgba(15, 13, 12, 0.95)',
          backdropFilter: 'blur(25px) saturate(180%)',
        }}
      >
        <CircularProgress size={48} thickness={4} sx={{ color: 'var(--color-primary)' }} />
        <Typography 
          variant="body1" 
          sx={{ 
            color: 'rgba(255, 255, 255, 0.6)',
            fontFamily: 'var(--font-clash)',
            fontWeight: 700,
            textTransform: 'uppercase',
            letterSpacing: '0.1em'
          }}
        >
          Initializing Note...
        </Typography>
      </Box>
    );
  }

  return (
    <Box sx={{ position: 'relative', minHeight: '100vh' }}>
      <Box
        sx={{
          display: 'flex',
          minHeight: '100vh',
          filter: idmWindowOpen ? 'blur(25px)' : 'none',
          transition: 'filter 0.3s ease',
        }}
      >
        <Navigation />
        
        <Box
          component="main"
          sx={{
            flexGrow: 1,
            display: 'flex',
            flexDirection: 'column',
            // Desktop: account for sidebar width
            width: { xs: '100%', md: 'calc(100% - 280px)' },
            ml: { xs: 0, md: '280px' },
            // Mobile: account for bottom nav
            pt: { xs: 0, md: 0 },
            pb: { xs: '100px', md: 2 }, // Space for mobile bottom nav
            minHeight: '100vh',
          }}
        >
          <Box
            sx={{
              flex: 1,
              p: { xs: 2, md: 3 },
              maxWidth: '100%',
              overflow: 'hidden',
            }}
          >
            {children}
          </Box>
        </Box>

        <QuickCreateFab
          onCreateNote={handleCreateNote}
          onCreateDoodle={handleCreateDoodle}
          onCreateVoiceNote={handleCreateVoiceNote}
          onCreatePhotoNote={handleCreatePhotoNote}
          onCreateLinkNote={handleCreateLinkNote}
        />
      </Box>

      {idmWindowOpen && (
        <Box
          sx={{
            position: 'fixed',
            inset: 0,
            backgroundColor: 'rgba(10, 10, 10, 0.8)',
            backdropFilter: 'blur(25px) saturate(180%)',
            zIndex: 1400,
            display: 'flex',
            justifyContent: 'center',
            alignItems: 'center',
            textAlign: 'center',
            px: 3,
          }}
        >
          <Box sx={{ 
            p: 4, 
            borderRadius: '24px', 
            border: '1px solid rgba(255, 255, 255, 0.1)',
            bgcolor: 'rgba(15, 13, 12, 0.95)',
            boxShadow: '0 24px 48px rgba(0, 0, 0, 0.6)'
          }}>
            <Typography 
              variant="h6" 
              sx={{ 
                mb: 2, 
                fontWeight: 900, 
                fontFamily: 'var(--font-clash)',
                color: 'var(--color-primary)',
                textTransform: 'uppercase',
                letterSpacing: '0.05em'
              }}
            >
              Authentication Required
            </Typography>
            <Typography 
              variant="body2" 
              sx={{ 
                color: 'rgba(255, 255, 255, 0.7)',
                fontFamily: 'var(--font-satoshi), sans-serif',
                maxWidth: 300,
                lineHeight: 1.6
              }}
            >
              Please complete the login process in the popup window to continue.
            </Typography>
          </Box>
        </Box>
      )}
    </Box>
  );
}
