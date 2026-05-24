'use client';

import React, { useState, useEffect } from 'react';
import {
  Box,
  Typography,
  Stack,
  Button,
  CircularProgress,
  IconButton,
  alpha,
  useTheme,
  Divider,
} from '@mui/material';
import {
  ShieldCheck,
  Key,
  User as UserIcon,
  CheckCircle2,
  X,
  ArrowRight,
  ChevronRight,
  MessageSquare,
} from 'lucide-react';
import { useAuth } from '@/context/auth/AuthContext';
import { ecosystemSecurity } from '@/lib/ecosystem/security';
import { useSudo } from '@/context/SudoContext';
import { useRouter } from 'next/navigation';
import { useUnifiedDrawer } from '@/context/UnifiedDrawerContext';
import { UsersService } from '@/lib/services/users';

export function SecureChatSetupDrawer() {
  const theme = useTheme();
  const router = useRouter();
  const { user } = useAuth();
  const { requestSudo } = useSudo();
  const { close, open: openDrawer } = useUnifiedDrawer();

  const [status, setStatus] = useState(ecosystemSecurity.status);
  const [loading, setLoading] = useState(false);
  const [profile, setProfile] = useState<any>(null);

  useEffect(() => {
    const unsub = ecosystemSecurity.onStatusChange(setStatus);
    if (user?.$id) {
        UsersService.getProfileById(user.$id).then(setProfile);
    }
    return unsub;
  }, [user?.$id]);

  const hasUsername = !!(profile?.username);
  const hasMasterpass = !!(status.hasMasterpass);
  const hasIdentity = !!(status.hasIdentity);
  const isUnlocked = status.isUnlocked;

  const handleSetupMasterpass = () => {
    openDrawer('masterpass');
  };

  const handleSetupUsername = () => {
    router.push('/settings');
    close();
  };

  const handleInitializeIdentity = async () => {
    if (!user?.$id) return;
    setLoading(true);
    try {
        if (!isUnlocked) {
            requestSudo({
                onSuccess: async () => {
                    await ecosystemSecurity.ensureE2EIdentity(user.$id);
                    setLoading(false);
                },
                onCancel: () => setLoading(false)
            });
        } else {
            await ecosystemSecurity.ensureE2EIdentity(user.$id);
            setLoading(false);
        }
    } catch (err) {
        console.error('Failed to initialize identity', err);
        setLoading(false);
    }
  };

  const isComplete = hasUsername && hasMasterpass && hasIdentity;

  return (
    <Box sx={{ p: { xs: 3, md: 4 }, bgcolor: 'transparent', color: '#fff', minHeight: '400px' }}>
      <Stack direction="row" justifyContent="space-between" alignItems="center" sx={{ mb: 4 }}>
        <Stack direction="row" spacing={2} alignItems="center">
          <Box sx={{ p: 1.5, borderRadius: '12px', bgcolor: alpha('#F59E0B', 0.1), color: '#F59E0B' }}>
            <ShieldCheck size={24} />
          </Box>
          <Box>
            <Typography variant="h6" sx={{ fontWeight: 900, fontFamily: 'var(--font-clash)', lineHeight: 1.2 }}>
              Secure Communication
            </Typography>
            <Typography variant="caption" sx={{ color: 'rgba(255,255,255,0.4)', fontWeight: 600 }}>
              KYLRIX END-TO-E2EE PROTOCOL
            </Typography>
          </Box>
        </Stack>
        <IconButton onClick={close} sx={{ color: 'rgba(255,255,255,0.3)' }}>
          <X size={20} />
        </IconButton>
      </Stack>

      <Typography sx={{ color: 'rgba(255,255,255,0.6)', mb: 4, fontSize: '0.95rem', lineHeight: 1.6 }}>
        To enable secure chatting, your account must be properly configured. This ensures zero-knowledge encryption for all your messages.
      </Typography>

      <Stack spacing={2} sx={{ mb: 6 }}>
        {/* Step 1: MasterPass */}
        <Box 
            onClick={!hasMasterpass ? handleSetupMasterpass : undefined}
            sx={{ 
                p: 2.5, 
                borderRadius: '20px', 
                bgcolor: '#161412', 
                border: '1px solid',
                borderColor: hasMasterpass ? 'rgba(16, 185, 129, 0.2)' : 'rgba(255,255,255,0.06)',
                cursor: hasMasterpass ? 'default' : 'pointer',
                transition: 'all 0.2s ease',
                '&:hover': !hasMasterpass ? { bgcolor: '#1C1A18', borderColor: 'rgba(255,255,255,0.1)' } : {}
            }}
        >
          <Stack direction="row" justifyContent="space-between" alignItems="center">
            <Stack direction="row" spacing={2} alignItems="center">
              <Box sx={{ color: hasMasterpass ? '#10B981' : 'rgba(255,255,255,0.3)' }}>
                {hasMasterpass ? <CheckCircle2 size={22} /> : <Key size={22} />}
              </Box>
              <Box>
                <Typography sx={{ fontWeight: 800, fontSize: '0.95rem', color: hasMasterpass ? '#fff' : 'rgba(255,255,255,0.5)' }}>
                  Ecosystem MasterPass
                </Typography>
                <Typography variant="caption" sx={{ color: 'rgba(255,255,255,0.3)', display: 'block' }}>
                  {hasMasterpass ? 'Configured and active' : 'Required for encryption keys'}
                </Typography>
              </Box>
            </Stack>
            {!hasMasterpass && <ChevronRight size={18} style={{ opacity: 0.3 }} />}
          </Stack>
        </Box>

        {/* Step 2: Username */}
        <Box 
            onClick={!hasUsername ? handleSetupUsername : undefined}
            sx={{ 
                p: 2.5, 
                borderRadius: '20px', 
                bgcolor: '#161412', 
                border: '1px solid',
                borderColor: hasUsername ? 'rgba(16, 185, 129, 0.2)' : 'rgba(255,255,255,0.06)',
                cursor: hasUsername ? 'default' : 'pointer',
                transition: 'all 0.2s ease',
                '&:hover': !hasUsername ? { bgcolor: '#1C1A18', borderColor: 'rgba(255,255,255,0.1)' } : {}
            }}
        >
          <Stack direction="row" justifyContent="space-between" alignItems="center">
            <Stack direction="row" spacing={2} alignItems="center">
              <Box sx={{ color: hasUsername ? '#10B981' : 'rgba(255,255,255,0.3)' }}>
                {hasUsername ? <CheckCircle2 size={22} /> : <UserIcon size={22} />}
              </Box>
              <Box>
                <Typography sx={{ fontWeight: 800, fontSize: '0.95rem', color: hasUsername ? '#fff' : 'rgba(255,255,255,0.5)' }}>
                  Ecosystem Username
                </Typography>
                <Typography variant="caption" sx={{ color: 'rgba(255,255,255,0.3)', display: 'block' }}>
                  {hasUsername ? `@${profile?.username}` : 'Required for discovery'}
                </Typography>
              </Box>
            </Stack>
            {!hasUsername && <ChevronRight size={18} style={{ opacity: 0.3 }} />}
          </Stack>
        </Box>

        {/* Step 3: Identity Generation */}
        <Box 
            onClick={hasMasterpass && !hasIdentity ? handleInitializeIdentity : undefined}
            sx={{ 
                p: 2.5, 
                borderRadius: '20px', 
                bgcolor: '#161412', 
                border: '1px solid',
                borderColor: hasIdentity ? 'rgba(16, 185, 129, 0.2)' : (hasMasterpass ? alpha('#F59E0B', 0.2) : 'rgba(255,255,255,0.06)'),
                cursor: hasIdentity || !hasMasterpass ? 'default' : 'pointer',
                transition: 'all 0.2s ease',
                opacity: hasMasterpass ? 1 : 0.5,
                '&:hover': hasMasterpass && !hasIdentity ? { bgcolor: '#1C1A18', borderColor: 'rgba(255,255,255,0.1)' } : {}
            }}
        >
          <Stack direction="row" justifyContent="space-between" alignItems="center">
            <Stack direction="row" spacing={2} alignItems="center">
              <Box sx={{ color: hasIdentity ? '#10B981' : (hasMasterpass ? '#F59E0B' : 'rgba(255,255,255,0.3)') }}>
                {hasIdentity ? <CheckCircle2 size={22} /> : <MessageSquare size={22} />}
              </Box>
              <Box>
                <Typography sx={{ fontWeight: 800, fontSize: '0.95rem', color: hasIdentity ? '#fff' : 'rgba(255,255,255,0.5)' }}>
                  Secure Identity
                </Typography>
                <Typography variant="caption" sx={{ color: 'rgba(255,255,255,0.3)', display: 'block' }}>
                  {hasIdentity ? 'X25519 Keys Published' : 'Generate your encryption keys'}
                </Typography>
              </Box>
            </Stack>
            {loading && <CircularProgress size={18} sx={{ color: '#F59E0B' }} />}
            {hasMasterpass && !hasIdentity && !loading && <ArrowRight size={18} style={{ color: '#F59E0B' }} />}
          </Stack>
        </Box>
      </Stack>

      <Button
        fullWidth
        variant="contained"
        disabled={!isComplete}
        onClick={close}
        sx={{
            py: 2,
            borderRadius: '16px',
            fontWeight: 900,
            textTransform: 'none',
            fontSize: '1rem',
            bgcolor: isComplete ? '#fff' : alpha('#fff', 0.1),
            color: isComplete ? '#000' : alpha('#fff', 0.2),
            '&:hover': { bgcolor: '#fff', transform: 'translateY(-2px)' },
            transition: 'all 0.3s cubic-bezier(0.16, 1, 0.3, 1)'
        }}
      >
        {isComplete ? 'Continue to Chat' : 'Complete Setup Above'}
      </Button>
    </Box>
  );
}
