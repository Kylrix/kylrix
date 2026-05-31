'use client';

import React, { useState } from 'react';
import { Box, Typography, IconButton, Button, Stack, alpha, Switch, FormControlLabel, useTheme, useMediaQuery, Chip, TextField } from '@mui/material';
import { X } from 'lucide-react';
import Drawer from '@mui/material/Drawer';
import { useDrawerState } from '@/components/ui/DrawerStateContext';
import toast from 'react-hot-toast';
import { account } from '@/lib/appwrite';
import { useAuth } from '@/context/auth/AuthContext';

import { GoogleAuthAdapter } from '@/lib/integrations/google/auth';

const GOOGLE_ICON = (
  <svg width="24" height="24" viewBox="0 0 24 24">
    <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" fill="#4285F4" />
    <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853" />
    <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" fill="#FBBC05" />
    <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335" />
  </svg>
);

export function GoogleIntegrationDrawer({ isOpen, onClose }: { isOpen: boolean; onClose: () => void }) {
  const { setIsDrawerOpen } = useDrawerState();
  const theme = useTheme();
  const isDesktop = useMediaQuery(theme.breakpoints.up('md'));
  const { user } = useAuth();
  const kylrixEmail = user?.email || '';
  
  const [googleConnected, setGoogleConnected] = useState(false);
  const [googleUser, setGoogleUser] = useState<any | null>(null);
  const [isAuthenticating, setIsAuthenticating] = useState(false);

  const [googleSyncKeep, setGoogleSyncKeep] = useState(true);
  const [googleSyncCalendar, setGoogleSyncCalendar] = useState(true);
  const [googleSyncDrive, setGoogleSyncDrive] = useState(false);
  const [googleSyncTasks, setGoogleSyncTasks] = useState(true);

  const [disconnectStep, setDisconnectStep] = useState<0 | 1 | 2>(0);
  const [confirmText, setConfirmText] = useState('');

  React.useEffect(() => {
    setIsDrawerOpen(isOpen);
    
    if (isOpen) {
      setDisconnectStep(0);
      setConfirmText('');

      const currentUser = GoogleAuthAdapter.getCurrentUser();
      if (currentUser) {
        setGoogleConnected(true);
        setGoogleUser(currentUser);
      }

      const fetchAppwriteIdentity = async () => {
        try {
          const identityList = await account.listIdentities();
          const googleIdentity = identityList.identities?.find(i => i.provider === 'google');
          if (googleIdentity) {
            setGoogleConnected(true);
            setGoogleUser(prev => prev || {
              displayName: googleIdentity.providerEmail || 'Connected Account',
              email: googleIdentity.providerEmail || 'google',
              photoURL: null
            });
          }
        } catch (e) {
          console.error('[GoogleIntegrationDrawer] failed to check identities', e);
        }
      };

      const unsubscribe = GoogleAuthAdapter.initAuth(
        (user) => {
          setGoogleConnected(true);
          setGoogleUser(user);
        },
        () => {
          void fetchAppwriteIdentity();
        }
      );

      return () => {
        unsubscribe();
      };
    }
  }, [isOpen, setIsDrawerOpen]);

  const handleToggleConnection = async () => {
    if (googleConnected) {
      setDisconnectStep(1);
    } else {
      setIsAuthenticating(true);
      try {
        const result = await GoogleAuthAdapter.signIn();
        if (result?.user) {
          setGoogleConnected(true);
          setGoogleUser(result.user);
          toast.success('Google Suite integrated successfully!');
        }
      } catch (err: any) {
        toast.error(err.message || 'Failed to connect Google account.');
      } finally {
        setIsAuthenticating(false);
      }
    }
  };

  const handleFinalDisconnect = async () => {
    setIsAuthenticating(true);
    try {
      await GoogleAuthAdapter.logout();
      setGoogleConnected(false);
      setGoogleUser(null);
      setDisconnectStep(0);
      setConfirmText('');
      toast.success('Google Suite disconnected and credentials purged.');
    } catch (err: any) {
      toast.error(err.message || 'Failed to disconnect account.');
    } finally {
      setIsAuthenticating(false);
    }
  };

  return (
    <Drawer 
        anchor={isDesktop ? 'right' : 'bottom'} 
        open={isOpen} 
        onClose={onClose} 
        PaperProps={{ 
            sx: {
                bgcolor: '#161412',
                backgroundImage: 'none',
                color: '#fff',
                ...(isDesktop ? {
                    height: '100%',
                    maxWidth: 480,
                    width: '100%',
                    borderLeft: '1px solid #1C1A18',
                    borderTopLeftRadius: 0,
                    borderTopRightRadius: 0,
                } : {
                    height: '60dvh',
                    borderTopLeftRadius: '28px',
                    borderTopRightRadius: '28px',
                    borderTop: '1px solid #1C1A18',
                    maxWidth: 720,
                    width: '100%',
                    mx: 'auto',
                })
            } 
        }} 
        ModalProps={{ keepMounted: false, disableScrollLock: false }}
    >
      <Box sx={{ p: 3, pb: 'calc(1.5rem + env(safe-area-inset-bottom))' }}>
        <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 4 }}>
          <Box sx={{ display: 'flex', gap: 2, alignItems: 'center' }}>
            <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'center', width: 44, height: 44, borderRadius: '12px', bgcolor: 'rgba(255, 255, 255, 0.08)', flexShrink: 0, '& svg': { width: 22, height: 22 } }}>
              {GOOGLE_ICON}
            </Box>
            <Box>
              <Typography sx={{ fontWeight: 900, fontSize: '1.25rem', color: '#fff', fontFamily: 'var(--font-clash)', letterSpacing: '-0.02em' }}>
                Google Suite Integration
              </Typography>
              <Typography variant="body2" sx={{ color: 'rgba(255,255,255,0.45)', mt: 0.5 }}>
                Connect your Google workspace to sync Keep, Drive, Tasks, and Calendars.
              </Typography>
            </Box>
          </Box>
          <IconButton onClick={onClose} sx={{ color: 'rgba(255,255,255,0.5)' }}><X size={20} /></IconButton>
        </Box>

        {disconnectStep === 1 ? (
          <Stack spacing={3}>
            <Box 
              sx={{ 
                p: 3, 
                borderRadius: '24px', 
                bgcolor: '#0A0908', 
                border: '1px solid rgba(239, 68, 68, 0.15)', 
                textAlign: 'center',
                boxShadow: '0 8px 32px rgba(239, 68, 68, 0.02)'
              }}
            >
              <Typography variant="h6" sx={{ fontWeight: 900, color: '#EF4444', mb: 2, fontFamily: 'var(--font-clash)' }}>
                Step 1: Confirm Disconnect
              </Typography>
              <Typography variant="body2" sx={{ color: 'rgba(255, 255, 255, 0.65)', mb: 4, lineHeight: 1.6 }}>
                Disassociating Google Suite will immediately suspend Notes, Drive, and Calendar synchronization. All active background tasks linking your data will cease.
              </Typography>
              <Stack direction="row" spacing={2}>
                <Button
                  variant="contained"
                  fullWidth
                  onClick={() => setDisconnectStep(2)}
                  sx={{ bgcolor: '#EF4444', '&:hover': { bgcolor: '#DC2626' }, borderRadius: '12px', textTransform: 'none', fontWeight: 800 }}
                >
                  Proceed
                </Button>
                <Button
                  variant="outlined"
                  fullWidth
                  onClick={() => setDisconnectStep(0)}
                  sx={{ borderColor: 'rgba(255, 255, 255, 0.1)', color: '#fff', '&:hover': { borderColor: '#fff', bgcolor: 'rgba(255,255,255,0.05)' }, borderRadius: '12px', textTransform: 'none', fontWeight: 800 }}
                >
                  Cancel
                </Button>
              </Stack>
            </Box>
          </Stack>
        ) : disconnectStep === 2 ? (
          <Stack spacing={3}>
            <Box 
              sx={{ 
                p: 3, 
                borderRadius: '24px', 
                bgcolor: '#0A0908', 
                border: '1px solid rgba(239, 68, 68, 0.25)', 
                textAlign: 'center',
                boxShadow: '0 8px 32px rgba(239, 68, 68, 0.05)'
              }}
            >
              <Typography variant="h6" sx={{ fontWeight: 900, color: '#EF4444', mb: 1, fontFamily: 'var(--font-clash)' }}>
                Step 2: Permanent Removal
              </Typography>
              <Typography variant="body2" sx={{ color: 'rgba(255, 255, 255, 0.5)', mb: 3, lineHeight: 1.5 }}>
                This action requires cryptographic token teardown. Please type <Box component="span" sx={{ color: '#fff', fontWeight: 900 }}>DISCONNECT</Box> below to finalize.
              </Typography>
              
              <TextField
                fullWidth
                variant="outlined"
                size="small"
                placeholder="DISCONNECT"
                value={confirmText}
                onChange={(e) => setConfirmText(e.target.value)}
                sx={{
                  mb: 4,
                  '& .MuiOutlinedInput-root': {
                    bgcolor: '#161412',
                    borderRadius: '12px',
                    color: 'white',
                    '& fieldset': { borderColor: 'rgba(255, 255, 255, 0.1)' },
                    '&:hover fieldset': { borderColor: 'rgba(255, 255, 255, 0.2)' },
                    '&.Mui-focused fieldset': { borderColor: '#EF4444' }
                  }
                }}
              />

              <Stack direction="row" spacing={2}>
                <Button
                  variant="contained"
                  fullWidth
                  disabled={confirmText !== 'DISCONNECT'}
                  onClick={handleFinalDisconnect}
                  sx={{ 
                    bgcolor: '#EF4444', 
                    '&:hover': { bgcolor: '#DC2626' }, 
                    borderRadius: '12px', 
                    textTransform: 'none', 
                    fontWeight: 800,
                    '&.Mui-disabled': { bgcolor: 'rgba(239, 68, 68, 0.2)', color: 'rgba(255, 255, 255, 0.3)' }
                  }}
                >
                  Confirm Teardown
                </Button>
                <Button
                  variant="outlined"
                  fullWidth
                  onClick={() => {
                    setDisconnectStep(0);
                    setConfirmText('');
                  }}
                  sx={{ borderColor: 'rgba(255, 255, 255, 0.1)', color: '#fff', '&:hover': { borderColor: '#fff', bgcolor: 'rgba(255,255,255,0.05)' }, borderRadius: '12px', textTransform: 'none', fontWeight: 800 }}
                >
                  Cancel
                </Button>
              </Stack>
            </Box>
          </Stack>
        ) : (
          <Stack spacing={3}>
            {googleConnected && googleUser && (
              <Box 
                sx={{ 
                  p: 2, 
                  borderRadius: '20px', 
                  bgcolor: '#0A0908', 
                  border: '1px solid rgba(255,255,255,0.06)',
                  display: 'flex',
                  alignItems: 'center',
                  gap: 2,
                  mb: 1
                }}
              >
                {googleUser.photoURL ? (
                  <Box 
                    component="img" 
                    src={googleUser.photoURL} 
                    alt="Google Profile"
                    sx={{ width: 44, height: 44, borderRadius: '12px', flexShrink: 0 }}
                  />
                ) : (
                  <Box
                    sx={{
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      width: 44,
                      height: 44,
                      borderRadius: '12px',
                      backgroundColor: 'rgba(99, 102, 241, 0.15)',
                      fontSize: '1.25rem',
                      flexShrink: 0,
                      '& svg': { width: 22, height: 22 }
                    }}
                  >
                    {GOOGLE_ICON}
                  </Box>
                )}
                <Box sx={{ minWidth: 0, flex: 1 }}>
                  <Typography variant="body2" sx={{ fontWeight: 800, color: 'white', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                    {googleUser.displayName || 'Google Account'}
                  </Typography>
                  <Typography variant="caption" sx={{ color: 'rgba(255,255,255,0.4)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', display: 'block' }}>
                    {googleUser.email || 'Connected'}
                  </Typography>
                </Box>
                <Chip 
                  label="CONNECTED" 
                  size="small" 
                  sx={{ 
                    height: 18, 
                    fontSize: '9px', 
                    fontWeight: 900, 
                    bgcolor: 'rgba(16, 185, 129, 0.1)', 
                    color: '#10B981', 
                    border: '1px solid rgba(16, 185, 129, 0.2)' 
                  }} 
                />
              </Box>
            )}

            {!googleConnected && kylrixEmail && (
              <Box 
                sx={{ 
                  p: 2.25, 
                  borderRadius: '16px', 
                  bgcolor: alpha('#6366F1', 0.03), 
                  border: '1px dashed rgba(99, 102, 241, 0.2)',
                  display: 'flex',
                  alignItems: 'flex-start',
                  gap: 1.5,
                  mb: 1
                }}
              >
                <Box sx={{ fontSize: '1.25rem', mt: 0.25 }}>💡</Box>
                <Box>
                  <Typography variant="body2" sx={{ fontWeight: 800, color: 'white', mb: 0.5 }}>
                    Link Recommendation <Typography component="span" sx={{ color: '#F59E0B', fontSize: '0.75rem', fontWeight: 900, ml: 1 }}>(STRONGLY ADVISED)</Typography>
                  </Typography>
                  <Typography variant="caption" sx={{ color: 'rgba(255,255,255,0.45)', lineHeight: 1.4, display: 'block' }}>
                    To prevent directory sync conflicts, we strongly recommend connecting a Google account that uses your active Kylrix email address: <Box component="span" sx={{ color: '#fff', fontWeight: 900, fontFamily: 'var(--font-mono)' }}>{kylrixEmail}</Box>.
                  </Typography>
                </Box>
              </Box>
            )}

            <Box sx={{ display: 'flex', justifyContent: 'center', mb: 2 }}>
               <Button 
                  variant={googleConnected ? 'outlined' : 'contained'}
                  onClick={handleToggleConnection}
                  disabled={isAuthenticating}
                  sx={{ 
                      borderRadius: '12px',
                      textTransform: 'none',
                      fontWeight: 800,
                      width: '100%',
                      py: 1.5,
                      ...(googleConnected 
                          ? { borderColor: '#34322F', color: '#fff', '&:hover': { borderColor: '#4A4845', bgcolor: 'rgba(255,255,255,0.02)' } }
                          : { bgcolor: '#6366F1', '&:hover': { bgcolor: '#5458E8' } })
                  }}
              >
                  {isAuthenticating ? 'Connecting...' : (googleConnected ? "Disconnect Account" : "Connect Google Account")}
              </Button>
            </Box>

            {googleConnected && (
              <Stack spacing={1}>
                  <Box sx={{ p: 2, borderRadius: '16px', bgcolor: '#0A0908', border: '1px solid #1C1A18' }}>
                      <FormControlLabel
                          control={<Switch checked={googleSyncKeep} onChange={(e) => setGoogleSyncKeep(e.target.checked)} color="primary" />}
                          label={
                              <Box>
                                  <Typography variant="body2" sx={{ fontWeight: 800, color: 'white' }}>Google Keep Sync</Typography>
                                  <Typography variant="caption" sx={{ color: 'rgba(255,255,255,0.4)' }}>Two-way sync with Kylrix Notes.</Typography>
                              </Box>
                          }
                          sx={{ m: 0, width: '100%', justifyContent: 'space-between', flexDirection: 'row-reverse' }}
                      />
                  </Box>
                  <Box sx={{ p: 2, borderRadius: '16px', bgcolor: '#0A0908', border: '1px solid #1C1A18' }}>
                      <FormControlLabel
                          control={<Switch checked={googleSyncCalendar} onChange={(e) => setGoogleSyncCalendar(e.target.checked)} color="primary" />}
                          label={
                              <Box>
                                  <Typography variant="body2" sx={{ fontWeight: 800, color: 'white' }}>Google Calendar Connections</Typography>
                                  <Typography variant="caption" sx={{ color: 'rgba(255,255,255,0.4)' }}>Sync tasks and project events.</Typography>
                              </Box>
                          }
                          sx={{ m: 0, width: '100%', justifyContent: 'space-between', flexDirection: 'row-reverse' }}
                      />
                  </Box>
                  <Box sx={{ p: 2, borderRadius: '16px', bgcolor: '#0A0908', border: '1px solid #1C1A18' }}>
                      <FormControlLabel
                          control={<Switch checked={googleSyncTasks} onChange={(e) => setGoogleSyncTasks(e.target.checked)} color="primary" />}
                          label={
                              <Box>
                                  <Typography variant="body2" sx={{ fontWeight: 800, color: 'white' }}>Google Tasks Sync</Typography>
                                  <Typography variant="caption" sx={{ color: 'rgba(255,255,255,0.4)' }}>Mirror Kylrix Flow items to Google Tasks.</Typography>
                              </Box>
                          }
                          sx={{ m: 0, width: '100%', justifyContent: 'space-between', flexDirection: 'row-reverse' }}
                      />
                  </Box>
                  <Box sx={{ p: 2, borderRadius: '16px', bgcolor: '#0A0908', border: '1px solid #1C1A18' }}>
                      <FormControlLabel
                          control={<Switch checked={googleSyncDrive} onChange={(e) => setGoogleSyncDrive(e.target.checked)} color="primary" />}
                          label={
                              <Box>
                                  <Typography variant="body2" sx={{ fontWeight: 800, color: 'white' }}>Google Drive Picker</Typography>
                                  <Typography variant="caption" sx={{ color: 'rgba(255,255,255,0.4)' }}>Attach files directly from Drive.</Typography>
                              </Box>
                          }
                          sx={{ m: 0, width: '100%', justifyContent: 'space-between', flexDirection: 'row-reverse' }}
                      />
                  </Box>
              </Stack>
            )}
          </Stack>
        )}
      </Box>
    </Drawer>
  );
}
