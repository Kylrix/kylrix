'use client';

import React from 'react';
import { Box, Typography, Button, Divider, IconButton } from '@mui/material';
import { X } from 'lucide-react';
import Drawer from '@mui/material/Drawer';
import { useAuth } from '@/context/auth/AuthContext';
import OAuthButtons from '@/components/OAuthButtons';
import { useLoginDrawer } from '@/context/LoginDrawerContext'; // New context needed

const DRAWER_SX = {
  borderTopLeftRadius: '26px',
  borderTopRightRadius: '26px',
  bgcolor: '#161412',
  borderTop: '1px solid #34322F',
  backgroundImage: 'none',
  pb: 'calc(1rem + env(safe-area-inset-bottom))',
  maxWidth: 480,
  width: '100%',
  mx: 'auto'
};

export function LoginDrawer() {
  const { isOpen, close } = useLoginDrawer();
  const { isLoading } = useAuth();

  return (
    <Drawer 
      anchor="bottom" 
      open={isOpen} 
      onClose={close}
      PaperProps={{ sx: DRAWER_SX }}
      ModalProps={{
        keepMounted: false,
        disableScrollLock: false,
        disablePortal: false,
        hideBackdrop: false,
      }}
    >
      <Box sx={{ p: 2.75 }}>
        <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 3 }}>
          <Typography sx={{ fontWeight: 900, fontSize: '1.2rem', color: '#fff' }}>Continue to Kylrix</Typography>
          <IconButton onClick={close} sx={{ color: 'rgba(255,255,255,0.5)' }}>
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
