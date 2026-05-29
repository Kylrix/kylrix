'use client';

import React, { useState } from 'react';
import {
  Box,
  Typography,
  Stack,
  Button,
  CircularProgress,
  IconButton,
  alpha,
} from '@mui/material';
import { Check, X, Users } from 'lucide-react';
import { useUnifiedDrawer } from '@/context/UnifiedDrawerContext';
import { acceptProjectInviteSecure } from '@/lib/actions/secure-ops';
import { account } from '@/lib/appwrite/client';
import { useToast } from '@/components/ui/Toast';

export interface ProjectInviteDrawerData {
  project: {
    $id: string;
    title: string;
    summary?: string;
  };
  onAccepted: () => void;
}

export function ProjectInviteDrawer() {
  const { drawerData, close } = useUnifiedDrawer();
  const [loading, setLoading] = useState(false);
  const { showSuccess, showError } = useToast();

  const data = drawerData as ProjectInviteDrawerData;

  if (!data) return null;

  const handleAccept = async () => {
    setLoading(true);
    try {
      const { jwt } = await account.createJWT();
      await acceptProjectInviteSecure(data.project.$id, jwt);
      showSuccess('Invitation accepted! Spinning up your secure container access...');
      data.onAccepted();
      close();
    } catch (err: any) {
      console.error('[ProjectInviteDrawer] Failed to accept:', err);
      showError('Action failed', err.message || 'Could not accept invitation.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <Box sx={{ p: { xs: 3, md: 4 }, bgcolor: 'transparent', color: '#fff' }}>
      <Stack direction="row" justifyContent="space-between" alignItems="center" sx={{ mb: 3 }}>
        <Stack direction="row" spacing={2} alignItems="center">
          <Box sx={{ p: 1.5, borderRadius: '12px', bgcolor: alpha('#6366F1', 0.1), color: '#6366F1' }}>
            <Users size={24} />
          </Box>
          <Typography variant="h6" sx={{ fontWeight: 900, fontFamily: 'var(--font-clash)', lineHeight: 1.2 }}>
            Workspace Invitation
          </Typography>
        </Stack>
        <IconButton onClick={close} sx={{ color: 'rgba(255,255,255,0.3)' }}>
          <X size={20} />
        </IconButton>
      </Stack>

      <Box sx={{ mb: 4 }}>
        <Typography sx={{ color: 'rgba(255,255,255,0.9)', fontWeight: 900, fontSize: '1.25rem', mb: 1, fontFamily: 'var(--font-clash)' }}>
          {data.project.title}
        </Typography>
        <Typography sx={{ color: 'rgba(255,255,255,0.5)', fontSize: '0.95rem', lineHeight: 1.6 }}>
          {data.project.summary || 'You have been invited to collaborate on this high-velocity execution container. Accepting grants you secure access to the communication, files, and resources.'}
        </Typography>
      </Box>

      <Stack spacing={2}>
        <Button
          fullWidth
          variant="contained"
          onClick={handleAccept}
          disabled={loading}
          startIcon={loading ? <CircularProgress size={18} color="inherit" /> : <Check size={18} />}
          sx={{
            py: 2,
            borderRadius: '16px',
            fontWeight: 900,
            textTransform: 'none',
            fontSize: '1rem',
            bgcolor: '#6366F1',
            color: '#fff',
            '&:hover': { bgcolor: '#4F46E5', transform: 'translateY(-2px)' },
            transition: 'all 0.3s cubic-bezier(0.16, 1, 0.3, 1)',
            boxShadow: '0 8px 16px rgba(99, 102, 241, 0.15)'
          }}
        >
          {loading ? 'Securing access...' : 'Accept Invitation'}
        </Button>
        
        <Button
          fullWidth
          variant="text"
          onClick={close}
          disabled={loading}
          sx={{
            py: 1.5,
            borderRadius: '12px',
            fontWeight: 800,
            textTransform: 'none',
            color: 'rgba(255,255,255,0.4)',
            '&:hover': { color: '#fff', bgcolor: 'rgba(255,255,255,0.04)' }
          }}
        >
          Decline
        </Button>
      </Stack>
    </Box>
  );
}
