'use client';

import React from 'react';
import { Box, Typography, Button, Divider, IconButton } from '@mui/material';
import { X } from 'lucide-react';
import Drawer from '@mui/material/Drawer';
import { useAuth } from '@/context/auth/AuthContext';
import OAuthButtons from '@/components/OAuthButtons';
import { useUnifiedDrawer } from '@/context/UnifiedDrawerContext';

const DRAWER_SX = {
  borderTopLeftRadius: '24px',
  borderTopRightRadius: '24px',
  bgcolor: '#161412',
  borderTop: '1px solid #34322F',
  backgroundImage: 'none',
  maxWidth: 480,
  width: '100%',
  mx: 'auto'
};

export function LoginDrawer() {
  const { activeContent, close } = useUnifiedDrawer();
  const { isLoading } = useAuth();
  const isOpen = activeContent === 'login';

  return (
    <Drawer 
      anchor="bottom" 
      open={isOpen} 
      onClose={close}
      PaperProps={{ sx: DRAWER_SX }}
      ModalProps={{
        keepMounted: false,
        disableScrollLock: false,
        disablePortal: true,
        hideBackdrop: false,
      }}
    >
      <Box sx={{ p: 3 }}>
        <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 3 }}>
          <Typography sx={{ fontWeight: 900, fontSize: '1.2rem', color: '#fff', fontFamily: 'var(--font-clash)' }}>
            Continue to Kylrix
          </Typography>
          <IconButton onClick={close} sx={{ color: '#9B9691' }}>
            <X size={20} />
          </IconButton>
        </Box>

        <OAuthButtons />

        <Divider sx={{ my: 3, borderColor: '#34322F' }} />

        <Typography sx={{ color: 'rgba(255,255,255,0.5)', fontSize: '0.8rem', textAlign: 'center' }}>
          By continuing, you agree to our Terms and Privacy Policy.
        </Typography>
      </Box>
    </Drawer>
  );
}
