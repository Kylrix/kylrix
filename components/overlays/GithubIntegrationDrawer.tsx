'use client';

import React, { useState } from 'react';
import { Box, Typography, IconButton, Button, Stack, alpha, Switch, FormControlLabel, useTheme, useMediaQuery, Chip, TextField, CircularProgress, Divider, Select, MenuItem, FormControl, InputLabel } from '@mui/material';
import { X, GitBranch, Terminal, Shield, RefreshCw, CheckCircle, ChevronRight, ArrowLeft, AlertCircle } from 'lucide-react';
import Drawer from '@mui/material/Drawer';
import { useDrawerState } from '@/components/ui/DrawerStateContext';
import toast from 'react-hot-toast';
import { account } from '@/lib/appwrite';
import { useAuth } from '@/context/auth/AuthContext';
import { useSudo } from '@/context/SudoContext';
import { SourceControlService } from '@/lib/services/sourceControl';

import { GithubAuthAdapter } from '@/lib/integrations/github/auth';

const GITHUB_ICON = (
  <svg width="24" height="24" fill="currentColor" viewBox="0 0 24 24">
    <path fillRule="evenodd" d="M12 2C6.477 2 2 6.484 2 12.017c0 4.425 2.865 8.18 6.839 9.504.5.092.682-.217.682-.483 0-.237-.008-.868-.013-1.703-2.782.605-3.369-1.343-3.369-1.343-.454-1.158-1.11-1.466-1.11-1.466-.908-.62.069-.608.069-.608 1.003.07 1.531 1.032 1.531 1.032.892 1.53 2.341 1.088 2.91.832.092-.647.35-1.088.636-1.338-2.22-.253-4.555-1.113-4.555-4.951 0-1.093.39-1.988 1.029-2.688-.103-.253-.446-1.272.098-2.65 0 0 .84-.27 2.75 1.026A9.564 9.564 0 0112 6.844c.85.004 1.705.115 2.504.337 1.909-1.296 2.747-1.027 2.747-1.027.546 1.379.202 2.398.1 2.651.64.7 1.028 1.595 1.028 2.688 0 3.848-2.339 4.695-4.566 4.943.359.309.678.92.678 1.855 0 1.338-.012 2.419-.012 2.747 0 .268.18.58.688.482A10.019 10.019 0 0022 12.017C22 6.484 17.522 2 12 2z" clipRule="evenodd" />
  </svg>
);

export function GithubIntegrationDrawer({
  isOpen,
  onClose,
  projectId,
  context = 'settings',
  onSaved,
  tasks = []
}: {
  isOpen: boolean;
  onClose: () => void;
  projectId?: string;
  context?: 'settings' | 'project';
  onSaved?: () => void;
  tasks?: any[];
}) {
  const { setIsDrawerOpen } = useDrawerState();
  const theme = useTheme();
  const isDesktop = useMediaQuery(theme.breakpoints.up('md'));
  const { user } = useAuth();
  const kylrixEmail = user?.email || '';
  
  const [githubConnected, setGithubConnected] = useState(false);
  const [githubUser, setGithubUser] = useState<any | null>(null);
  const [isAuthenticating, setIsAuthenticating] = useState(false);

  const [githubSyncIssues, setGithubSyncIssues] = useState(true);
  const [githubSyncCommits, setGithubSyncCommits] = useState(true);
  const [githubSyncPRs, setGithubSyncPRs] = useState(false);

  // Disconnect Confirmation Multi-Stage Flow States
  const [disconnectStep, setDisconnectStep] = useState<0 | 1 | 2>(0);
  const [confirmText, setConfirmText] = useState('');

  // Project-specific states
  const [provider, setProvider] = useState('github');
  const [ownerName, setOwnerName] = useState('');
  const [repoName, setRepoName] = useState('');
  const [enabled, setEnabled] = useState(true);
  const [syncLogs, setSyncLogs] = useState<string[]>([]);
  const [loading, setLoading] = useState(false);
  const [syncing, setSyncing] = useState(false);
  const [integration, setIntegration] = useState<any | null>(null);
  const [step, setStep] = useState(1);

  const { requestSudo } = useSudo();

  React.useEffect(() => {
    setIsDrawerOpen(isOpen);
    
    if (isOpen) {
      // Reset disconnect verification states on open
      setDisconnectStep(0);
      setConfirmText('');

      // 1. Initial synchronous check of Firebase auth
      const currentUser = GithubAuthAdapter.getCurrentUser();
      if (currentUser) {
        setGithubConnected(true);
        setGithubUser(currentUser);
      }

      // Helper to query active Appwrite linked identities
      const fetchAppwriteIdentity = async () => {
        try {
          const identityList = await account.listIdentities();
          const githubIdentity = identityList.identities?.find(i => i.provider === 'github');
          if (githubIdentity) {
            setGithubConnected(true);
            setGithubUser((prev: any) => prev || {
              displayName: githubIdentity.providerEmail || githubIdentity.providerUid,
              email: githubIdentity.providerEmail || 'github',
              photoURL: null
            });
          }
        } catch (e) {
          console.error('[GithubIntegrationDrawer] failed to check identities', e);
        }
      };

      // Helper to query active project integration configurations
      const fetchProjectIntegration = async () => {
        if (!projectId) return;
        setLoading(true);
        try {
          const list = await SourceControlService.listIntegrations(projectId);
          if (list.length > 0) {
            const item = list[0];
            setIntegration(item);
            setProvider(item.provider || 'github');
            setOwnerName(item.ownerName || '');
            setRepoName(item.repoName || '');
            setEnabled(item.enabled !== false);
            setStep(2);
          } else {
            setIntegration(null);
            setStep(1);
          }
        } catch (e) {
          console.error('[GithubIntegrationDrawer] failed to load project integrations', e);
        } finally {
          setLoading(false);
        }
      };

      // 2. Subscribe to live Firebase auth changes
      const unsubscribe = GithubAuthAdapter.initAuth(
        (user) => {
          setGithubConnected(true);
          setGithubUser(user);
          if (projectId) {
            void fetchProjectIntegration();
          }
        },
        () => {
          // Fall back to check Appwrite identities if Firebase auth hasn't synced
          void fetchAppwriteIdentity();
          if (projectId) {
            void fetchProjectIntegration();
          }
        }
      );

      if (projectId) {
        void fetchProjectIntegration();
      }

      return () => {
        unsubscribe();
      };
    }
  }, [isOpen, setIsDrawerOpen, projectId]);

  const handleToggleConnection = async () => {
    if (githubConnected) {
      // Trigger confirmation instead of immediate disconnect
      setDisconnectStep(1);
    } else {
      setIsAuthenticating(true);
      try {
        const result = await GithubAuthAdapter.signIn();
        if (result?.user) {
          setGithubConnected(true);
          setGithubUser(result.user);
          toast.success('GitHub integrated successfully!');
        }
      } catch (err: any) {
        toast.error(err.message || 'Failed to connect GitHub account.');
      } finally {
        setIsAuthenticating(false);
      }
    }
  };

  const handleFinalDisconnect = async () => {
    setIsAuthenticating(true);
    try {
      await GithubAuthAdapter.logout();
      setGithubConnected(false);
      setGithubUser(null);
      setDisconnectStep(0);
      setConfirmText('');
      toast.success('GitHub disconnected and credentials purged.');
    } catch (err: any) {
      toast.error(err.message || 'Failed to disconnect account.');
    } finally {
      setIsAuthenticating(false);
    }
  };

  const handleSave = () => {
    if (!ownerName.trim() || !repoName.trim()) {
      toast.error('Owner name and repository name are required.');
      return;
    }

    if (!githubConnected) {
      toast.error('You must link a GitHub account first.');
      return;
    }

    requestSudo({
      onSuccess: async () => {
        setLoading(true);
        try {
          const saved = await SourceControlService.saveIntegration(projectId!, {
            provider,
            ownerName: ownerName.trim(),
            repoName: repoName.trim(),
            enabled,
            metadata: JSON.stringify({
              updatedAt: new Date().toISOString(),
              syncEnabled: true,
            }),
          });
          setIntegration(saved);
          toast.success('Git integration saved securely!');
          if (onSaved) onSaved();
          setStep(2);
        } catch (err: any) {
          toast.error(err.message || 'Could not save configuration.');
        } finally {
          setLoading(false);
        }
      }
    });
  };

  const handleDeleteRepo = () => {
    const integrationId = integration?.$id;
    if (!integrationId) return;
    
    requestSudo({
      onSuccess: async () => {
        setLoading(true);
        try {
          const ok = await SourceControlService.removeIntegration(integrationId);
          if (ok) {
            toast.success('Integration disconnected successfully!');
            setIntegration(null);
            setOwnerName('');
            setRepoName('');
            setSyncLogs([]);
            if (onSaved) onSaved();
            setStep(1);
          } else {
            toast.error('Could not remove integration.');
          }
        } catch (err: any) {
          toast.error(err.message || 'Could not delete configuration.');
        } finally {
          setLoading(false);
        }
      }
    });
  };

  const handleSyncTasks = async () => {
    if (!integration || !projectId) return;
    setSyncing(true);
    setSyncLogs(['[Sync] Connecting to Git provider API...']);
    
    try {
      const res = await SourceControlService.syncTasksToGitIssues(projectId, integration, tasks);
      setSyncLogs(res.logs);
      if (res.success) {
        toast.success(`Successfully exported ${res.syncedCount} tasks to ${provider}!`);
      }
    } catch (err: any) {
      setSyncLogs(prev => [...prev, `[Error] Sync failed: ${err.message || 'Network Timeout'}`]);
      toast.error(err.message || 'Task-to-issue export failed.');
    } finally {
      setSyncing(false);
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
            <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'center', width: 44, height: 44, borderRadius: '12px', bgcolor: 'rgba(255, 255, 255, 0.08)', color: 'white', flexShrink: 0, '& svg': { width: 22, height: 22 } }}>
              {GITHUB_ICON}
            </Box>
            <Box>
              <Typography sx={{ fontWeight: 900, fontSize: '1.25rem', color: '#fff', fontFamily: 'var(--font-clash)', letterSpacing: '-0.02em' }}>
                GitHub Integration
              </Typography>
              <Typography variant="body2" sx={{ color: 'rgba(255,255,255,0.45)', mt: 0.5 }}>
                Connect your GitHub account to access repositories, manage sync settings, and export tasks.
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
                Disassociating GitHub will immediately suspend task, issue and pull request synchronization. All active background tasks linking your repository data will cease.
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
                Step 2: Permanent Teardown
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
            {githubConnected && githubUser && (
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
                {githubUser.photoURL ? (
                  <Box 
                    component="img" 
                    src={githubUser.photoURL} 
                    alt="GitHub Profile"
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
                      backgroundColor: 'rgba(255, 255, 255, 0.08)',
                      color: 'white',
                      flexShrink: 0,
                      '& svg': { width: 22, height: 22 }
                    }}
                  >
                    {GITHUB_ICON}
                  </Box>
                )}
                <Box sx={{ minWidth: 0, flex: 1 }}>
                  <Typography variant="body2" sx={{ fontWeight: 800, color: 'white', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                    {githubUser.displayName || 'GitHub Account'}
                  </Typography>
                  <Typography variant="caption" sx={{ color: 'rgba(255,255,255,0.4)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', display: 'block' }}>
                    {githubUser.email || githubUser.uid || 'Connected'}
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

            {!githubConnected && kylrixEmail && (
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
                    To prevent directory sync conflicts, we strongly recommend connecting a GitHub account that uses your active Kylrix email address: <Box component="span" sx={{ color: '#fff', fontWeight: 900, fontFamily: 'var(--font-mono)' }}>{kylrixEmail}</Box>.
                  </Typography>
                </Box>
              </Box>
            )}

            <Box sx={{ display: 'flex', justifyContent: 'center', mb: 2 }}>
               <Button 
                  variant={githubConnected ? 'outlined' : 'contained'}
                  onClick={handleToggleConnection}
                  disabled={isAuthenticating}
                  sx={{ 
                      borderRadius: '12px',
                      textTransform: 'none',
                      fontWeight: 800,
                      width: '100%',
                      py: 1.5,
                      ...(githubConnected 
                          ? { borderColor: '#34322F', color: '#fff', '&:hover': { borderColor: '#4A4845', bgcolor: 'rgba(255,255,255,0.02)' } }
                          : { bgcolor: '#6366F1', '&:hover': { bgcolor: '#5458E8' } })
                  }}
              >
                  {isAuthenticating ? 'Connecting...' : (githubConnected ? "Disconnect Account" : "Connect GitHub Account")}
              </Button>
            </Box>

            {githubConnected && (
              context === 'project' ? (
                <Stack spacing={3} sx={{ mt: 1 }}>
                  {step === 1 ? (
                    <Box
                      sx={{
                        p: 3,
                        borderRadius: '20px',
                        bgcolor: alpha('#10B981', 0.03),
                        border: '1px solid rgba(16, 185, 129, 0.15)',
                      }}
                    >
                      <Stack direction="row" spacing={2} alignItems="center" sx={{ mb: 2.5 }}>
                        <Box sx={{ color: '#10B981', display: 'flex' }}><CheckCircle size={24} /></Box>
                        <Box sx={{ minWidth: 0, flex: 1 }}>
                          <Typography variant="body1" sx={{ fontWeight: 800, color: '#fff' }}>
                            GitHub Account Connected
                          </Typography>
                          <Typography variant="caption" sx={{ color: 'rgba(255, 255, 255, 0.5)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', display: 'block' }}>
                            Linked Profile: {githubUser?.email || githubUser?.displayName || 'Connected'}
                          </Typography>
                        </Box>
                      </Stack>
                      <Button
                        variant="contained"
                        fullWidth
                        onClick={() => setStep(2)}
                        endIcon={<ChevronRight size={16} />}
                        sx={{
                          borderRadius: '14px',
                          bgcolor: '#6366F1',
                          color: '#fff',
                          fontWeight: 900,
                          py: 1.5,
                          textTransform: 'none',
                          '&:hover': { bgcolor: '#4F46E5' },
                        }}
                      >
                        Configure Repository Integration
                      </Button>
                    </Box>
                  ) : (
                    <Stack spacing={3}>
                      <Box>
                        <Button
                          variant="text"
                          size="small"
                          onClick={() => setStep(1)}
                          startIcon={<ArrowLeft size={14} />}
                          sx={{ color: 'rgba(255, 255, 255, 0.5)', textTransform: 'none', fontWeight: 800, p: 0, '&:hover': { color: '#fff', bgcolor: 'transparent' } }}
                        >
                          View Linked Account Info
                        </Button>
                      </Box>

                      {loading ? (
                        <Box sx={{ display: 'flex', justifyContent: 'center', py: 4 }}>
                          <CircularProgress size={28} sx={{ color: '#6366F1' }} />
                        </Box>
                      ) : (
                        <Stack spacing={3.25}>
                          <Box sx={{ p: 2.5, borderRadius: '20px', bgcolor: 'rgba(255,255,255,0.02)', border: '1px solid rgba(255,255,255,0.06)' }}>
                            <Typography variant="subtitle2" sx={{ fontWeight: 800, color: 'white', mb: 2 }}>
                              Repository Settings
                            </Typography>
                            <Stack spacing={2}>
                              <TextField
                                fullWidth
                                label="Repository Owner"
                                variant="outlined"
                                size="small"
                                placeholder="e.g. facebook"
                                value={ownerName}
                                onChange={(e) => setOwnerName(e.target.value)}
                                sx={{
                                  '& .MuiOutlinedInput-root': {
                                    bgcolor: '#161412',
                                    borderRadius: '12px',
                                    color: 'white',
                                    '& fieldset': { borderColor: 'rgba(255,255,255,0.1)' }
                                  }
                                }}
                              />
                              <TextField
                                fullWidth
                                label="Repository Name"
                                variant="outlined"
                                size="small"
                                placeholder="e.g. react"
                                value={repoName}
                                onChange={(e) => setRepoName(e.target.value)}
                                sx={{
                                  '& .MuiOutlinedInput-root': {
                                    bgcolor: '#161412',
                                    borderRadius: '12px',
                                    color: 'white',
                                    '& fieldset': { borderColor: 'rgba(255,255,255,0.1)' }
                                  }
                                }}
                              />
                              <FormControlLabel
                                control={<Switch checked={enabled} onChange={(e) => setEnabled(e.target.checked)} color="primary" />}
                                label={
                                  <Box>
                                    <Typography variant="body2" sx={{ fontWeight: 800, color: 'white' }}>Enable Repository Sync</Typography>
                                    <Typography variant="caption" sx={{ color: 'rgba(255,255,255,0.45)' }}>Active background sync for tasks.</Typography>
                                  </Box>
                                }
                                sx={{ ml: 0, justifyContent: 'space-between', flexDirection: 'row-reverse', width: '100%', mt: 1 }}
                              />
                            </Stack>
                          </Box>

                          <Stack direction="row" spacing={2}>
                            <Button
                              variant="contained"
                              fullWidth
                              onClick={handleSave}
                              disabled={loading}
                              sx={{ borderRadius: '12px', bgcolor: '#6366F1', fontWeight: 800, '&:hover': { bgcolor: '#4F46E5' } }}
                            >
                              Save Settings
                            </Button>

                            {integration && (
                              <Button
                                variant="outlined"
                                color="error"
                                fullWidth
                                onClick={handleDeleteRepo}
                                disabled={loading}
                                sx={{ borderRadius: '12px', borderColor: 'rgba(239, 68, 68, 0.2)', color: '#EF4444', '&:hover': { bgcolor: 'rgba(239,68,68,0.05)', borderColor: '#EF4444' } }}
                              >
                                Remove Integration
                              </Button>
                            )}
                          </Stack>

                          {integration && (
                            <Box sx={{ p: 2.5, borderRadius: '20px', bgcolor: '#0A0908', border: '1px solid #1C1A18' }}>
                              <Typography variant="subtitle2" sx={{ fontWeight: 800, color: 'white', mb: 1, display: 'flex', alignItems: 'center', gap: 1 }}>
                                <Terminal size={16} /> Actions & Logs
                              </Typography>
                              <Typography variant="caption" sx={{ color: 'rgba(255,255,255,0.4)', mb: 2, display: 'block' }}>
                                Sync Kylrix project tasks to this repository&apos;s GitHub Issues.
                              </Typography>
                              <Button
                                variant="contained"
                                fullWidth
                                onClick={handleSyncTasks}
                                disabled={syncing}
                                startIcon={syncing ? <CircularProgress size={16} color="inherit" /> : <RefreshCw size={16} />}
                                sx={{ borderRadius: '12px', bgcolor: '#10B981', fontWeight: 800, mb: 2, '&:hover': { bgcolor: '#059669' } }}
                              >
                                {syncing ? 'Syncing...' : 'Sync Tasks to Issues'}
                              </Button>

                              {syncLogs.length > 0 && (
                                <Box sx={{ bgcolor: '#161412', p: 1.5, borderRadius: '12px', border: '1px solid rgba(255,255,255,0.05)', maxHeight: 160, overflowY: 'auto', mt: 1 }}>
                                  {syncLogs.map((log, idx) => (
                                    <Typography key={idx} variant="caption" sx={{ fontFamily: 'var(--font-mono)', display: 'block', color: log.startsWith('[Error]') ? '#EF4444' : 'rgba(255,255,255,0.78)', mb: 0.5 }}>
                                      {log}
                                    </Typography>
                                  ))}
                                </Box>
                              )}
                            </Box>
                          )}
                        </Stack>
                      )}
                    </Stack>
                  )}
                </Stack>
              ) : (
                <Stack spacing={1}>
                    <Box sx={{ p: 2, borderRadius: '16px', bgcolor: '#0A0908', border: '1px solid #1C1A18' }}>
                        <FormControlLabel
                            control={<Switch checked={githubSyncIssues} onChange={(e) => setGithubSyncIssues(e.target.checked)} color="primary" />}
                            label={
                                <Box>
                                    <Typography variant="body2" sx={{ fontWeight: 800, color: 'white' }}>GitHub Issue Sync</Typography>
                                    <Typography variant="caption" sx={{ color: 'rgba(255,255,255,0.4)' }}>Mirror project tasks directly into GitHub repository issues.</Typography>
                                </Box>
                            }
                            sx={{ m: 0, width: '100%', justifyContent: 'space-between', flexDirection: 'row-reverse' }}
                        />
                    </Box>
                    <Box sx={{ p: 2, borderRadius: '16px', bgcolor: '#0A0908', border: '1px solid #1C1A18' }}>
                        <FormControlLabel
                            control={<Switch checked={githubSyncCommits} onChange={(e) => setGithubSyncCommits(e.target.checked)} color="primary" />}
                            label={
                                <Box>
                                    <Typography variant="body2" sx={{ fontWeight: 800, color: 'white' }}>Commits Feed Sync</Typography>
                                    <Typography variant="caption" sx={{ color: 'rgba(255,255,255,0.4)' }}>Import repository commits as personal feed actions.</Typography>
                                </Box>
                            }
                            sx={{ m: 0, width: '100%', justifyContent: 'space-between', flexDirection: 'row-reverse' }}
                        />
                    </Box>
                    <Box sx={{ p: 2, borderRadius: '16px', bgcolor: '#0A0908', border: '1px solid #1C1A18' }}>
                        <FormControlLabel
                            control={<Switch checked={githubSyncPRs} onChange={(e) => setGithubSyncPRs(e.target.checked)} color="primary" />}
                            label={
                                <Box>
                                    <Typography variant="body2" sx={{ fontWeight: 800, color: 'white' }}>Pull Request Notifications</Typography>
                                    <Typography variant="caption" sx={{ color: 'rgba(255,255,255,0.4)' }}>Notify on repository open PR and code review activities.</Typography>
                                </Box>
                            }
                            sx={{ m: 0, width: '100%', justifyContent: 'space-between', flexDirection: 'row-reverse' }}
                        />
                    </Box>
                </Stack>
              )
            )}
          </Stack>
        )}
      </Box>
    </Drawer>
  );
}
