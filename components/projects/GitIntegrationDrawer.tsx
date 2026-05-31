'use client';

import React, { useState, useEffect } from 'react';
import {
  Drawer,
  Box,
  Typography,
  IconButton,
  TextField,
  Button,
  Select,
  MenuItem,
  FormControl,
  InputLabel,
  Stack,
  alpha,
  CircularProgress,
  Divider,
  useMediaQuery,
  useTheme,
} from '@mui/material';
import { X, GitBranch, Terminal, Shield, RefreshCw, CheckCircle, ChevronRight, ArrowLeft, AlertCircle } from 'lucide-react';
import { GithubAuthAdapter } from '@/lib/integrations/github/auth';
import { SourceControlService, SourceControlRow } from '@/lib/services/sourceControl';
import { useToast } from '@/components/ui/Toast';
import { useSudo } from '@/context/SudoContext';
import { useAuth } from '@/context/auth/AuthContext';

const GITHUB_ICON = (
  <svg width="24" height="24" fill="currentColor" viewBox="0 0 24 24">
    <path fillRule="evenodd" d="M12 2C6.477 2 2 6.484 2 12.017c0 4.425 2.865 8.18 6.839 9.504.5.092.682-.217.682-.483 0-.237-.008-.868-.013-1.703-2.782.605-3.369-1.343-3.369-1.343-.454-1.158-1.11-1.466-1.11-1.466-.908-.62.069-.608.069-.608 1.003.07 1.531 1.032 1.531 1.032.892 1.53 2.341 1.088 2.91.832.092-.647.35-1.088.636-1.338-2.22-.253-4.555-1.113-4.555-4.951 0-1.093.39-1.988 1.029-2.688-.103-.253-.446-1.272.098-2.65 0 0 .84-.27 2.75 1.026A9.564 9.564 0 0112 6.844c.85.004 1.705.115 2.504.337 1.909-1.296 2.747-1.027 2.747-1.027.546 1.379.202 2.398.1 2.651.64.7 1.028 1.595 1.028 2.688 0 3.848-2.339 4.695-4.566 4.943.359.309.678.92.678 1.855 0 1.338-.012 2.419-.012 2.747 0 .268.18.58.688.482A10.019 10.019 0 0022 12.017C22 6.484 17.522 2 12 2z" clipRule="evenodd" />
  </svg>
);

interface GitIntegrationDrawerProps {
  isOpen: boolean;
  onClose: () => void;
  projectId: string;
  onSaved: () => void;
  tasks: any[];
}

const DRAWER_SX = {
  borderTopLeftRadius: '26px',
  borderTopRightRadius: '26px',
  bgcolor: '#161412',
  borderTop: '1px solid rgba(255,255,255,0.08)',
  maxWidth: 640,
  width: '100%',
  mx: 'auto',
  p: 3,
  boxSizing: 'border-box' as const,
  maxHeight: '95vh',
  overflowY: 'auto' as const,
};

export default function GitIntegrationDrawer({
  isOpen,
  onClose,
  projectId,
  onSaved,
  tasks,
}: GitIntegrationDrawerProps) {
  const { showSuccess, showError } = useToast();
  const { requestSudo } = useSudo();
  const { user } = useAuth();
  const kylrixEmail = user?.email || '';
  
  const theme = useTheme();
  const isDesktop = useMediaQuery(theme.breakpoints.up('md'));
  const anchor = isDesktop ? 'right' : 'bottom';
  
  const [provider, setProvider] = useState('github');
  const [ownerName, setOwnerName] = useState('');
  const [repoName, setRepoName] = useState('');
  const [enabled, setEnabled] = useState(true);
  const [syncLogs, setSyncLogs] = useState<string[]>([]);
  const [loading, setLoading] = useState(false);
  const [syncing, setSyncing] = useState(false);
  const [integration, setIntegration] = useState<SourceControlRow | null>(null);

  // OAuth & Identity State
  const [checkingIdentities, setCheckingIdentities] = useState(true);
  const [githubIdentity, setGithubIdentity] = useState<any | null>(null);
  const [isAuthenticating, setIsAuthenticating] = useState(false);
  const [step, setStep] = useState(1);

  // Load existing integration row and check connected identities on mount
  useEffect(() => {
    async function load() {
      setLoading(true);
      setCheckingIdentities(true);
      try {
        // 1. Fetch connected identities from Firebase Adapter
        const currentUser = GithubAuthAdapter.getCurrentUser();
        setGithubIdentity(currentUser || null);

        // 2. Fetch source control configuration
        const list = await SourceControlService.listIntegrations(projectId);
        if (list.length > 0) {
          const item = list[0];
          setIntegration(item);
          setProvider(item.provider || 'github');
          setOwnerName(item.ownerName || '');
          setRepoName(item.repoName || '');
          setEnabled(item.enabled !== false);
          
          // If we have both config and active identity, advance to step 2 automatically
          if (currentUser) {
            setStep(2);
          }
        }
      } catch (err) {
        console.error('Failed to load integration details:', err);
      } finally {
        setLoading(false);
        setCheckingIdentities(false);
      }
    }
    if (isOpen) {
      load();
    }
  }, [isOpen, projectId]);

  // Direct OAuth connection via Firebase
  const handleConnectGitHub = async () => {
    try {
      setIsAuthenticating(true);
      const result = await GithubAuthAdapter.signIn();
      if (result?.user) {
        setGithubIdentity(result.user);
        showSuccess('Success', 'GitHub account linked successfully!');
        setStep(2);
      }
    } catch (err: any) {
      showError('Link failed', err.message || 'Could not connect GitHub account.');
    } finally {
      setIsAuthenticating(false);
    }
  };

  const handleSave = () => {
    if (!ownerName.trim() || !repoName.trim()) {
      showError('Validation Error', 'Owner name and repository name are required.');
      return;
    }

    if (!githubIdentity) {
      showError('Validation Error', 'You must link a GitHub account first.');
      return;
    }

    // Require Masterpass unlock before saving sensitive configuration
    requestSudo({
      onSuccess: async () => {
        setLoading(true);
        try {
          const saved = await SourceControlService.saveIntegration(projectId, {
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
          showSuccess('Git integration saved securely!');
          onSaved();
        } catch (err: any) {
          showError('Save failed', err.message || 'Could not save configuration.');
        } finally {
          setLoading(false);
        }
      }
    });
  };

  const handleDelete = () => {
    const integrationId = integration?.$id;
    if (!integrationId) return;
    
    // Require Masterpass verification to delete/disconnect configurations
    requestSudo({
      onSuccess: async () => {
        setLoading(true);
        try {
          const ok = await SourceControlService.removeIntegration(integrationId);
          if (ok) {
            showSuccess('Integration disconnected successfully!');
            setIntegration(null);
            setOwnerName('');
            setRepoName('');
            setSyncLogs([]);
            onSaved();
            setStep(1);
          } else {
            showError('Delete failed', 'Could not remove integration.');
          }
        } catch (err: any) {
          showError('Delete failed', err.message || 'Could not delete configuration.');
        } finally {
          setLoading(false);
        }
      }
    });
  };

  const handleSyncTasks = async () => {
    if (!integration) return;
    setSyncing(true);
    setSyncLogs(['[Sync] Connecting to Git provider API...']);
    
    try {
      const res = await SourceControlService.syncTasksToGitIssues(projectId, integration, tasks);
      setSyncLogs(res.logs);
      if (res.success) {
        showSuccess('Sync complete', `Successfully exported ${res.syncedCount} tasks to ${provider}!`);
      }
    } catch (err: any) {
      setSyncLogs(prev => [...prev, `[Error] Sync failed: ${err.message || 'Network Timeout'}`]);
      showError('Sync failed', err.message || 'Task-to-issue export failed.');
    } finally {
      setSyncing(false);
    }
  };

  return (
    <Drawer
      anchor={anchor}
      open={isOpen}
      onClose={onClose}
      keepMounted={false}
      disablePortal={true}
      PaperProps={{
        sx: {
          ...DRAWER_SX,
          ...(isDesktop ? {
            height: '100vh',
            maxHeight: '100vh',
            width: '35%',
            maxWidth: '480px',
            borderTopLeftRadius: '26px',
            borderBottomLeftRadius: '26px',
            borderTopRightRadius: 0,
            borderBottomRightRadius: 0,
            borderTop: 0,
            borderLeft: '1px solid rgba(255,255,255,0.08)',
            margin: 0,
          } : {
            maxHeight: '95vh',
            width: '100%',
            borderTopLeftRadius: '26px',
            borderTopRightRadius: '26px',
            borderTop: '1px solid rgba(255,255,255,0.08)',
          })
        }
      }}
    >
      {/* Drawer Header */}
      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 3 }}>
        <Stack direction="row" spacing={1.5} alignItems="center">
          <Box sx={{ color: '#6366F1', display: 'flex' }}><GitBranch size={22} /></Box>
          <Typography variant="h6" sx={{ fontFamily: 'var(--font-clash)', fontWeight: 900, color: '#fff' }}>
            Configure Git Integration
          </Typography>
        </Stack>
        <IconButton
          onClick={onClose}
          sx={{
            color: 'rgba(255, 255, 255, 0.4)',
            '&:hover': { color: '#fff', bgcolor: 'rgba(255, 255, 255, 0.05)' },
          }}
        >
          <X size={18} />
        </IconButton>
      </Box>

      {loading || checkingIdentities ? (
        <Box sx={{ display: 'flex', justifyContent: 'center', py: 6 }}>
          <CircularProgress size={40} sx={{ color: '#6366F1' }} />
        </Box>
      ) : (
        <Stack spacing={3}>
          {/* Service Selection Dropdown */}
          <FormControl fullWidth size="small">
            <InputLabel sx={{ color: 'rgba(255,255,255,0.4)' }}>Integration Service</InputLabel>
            <Select
              value={provider}
              label="Integration Service"
              onChange={(e) => setProvider(e.target.value)}
              sx={{
                color: '#fff',
                '& .MuiOutlinedInput-notchedOutline': { borderColor: 'rgba(255,255,255,0.1)' },
                '&:hover .MuiOutlinedInput-notchedOutline': { borderColor: 'rgba(255,255,255,0.2)' },
                '&.Mui-focused .MuiOutlinedInput-notchedOutline': { borderColor: '#6366F1' },
              }}
            >
              <MenuItem value="github">GitHub</MenuItem>
              <MenuItem value="gitlab" disabled>GitLab (Pro Feature - Disabled)</MenuItem>
              <MenuItem value="gitea" disabled>Gitea (Pro Feature - Disabled)</MenuItem>
            </Select>
          </FormControl>

          {/* Flow Step 1: OAuth Identity Connection */}
          {step === 1 && (
            <Stack spacing={3}>
              {!githubIdentity ? (
                <Box
                  sx={{
                    p: 3,
                    borderRadius: '20px',
                    bgcolor: 'rgba(255, 255, 255, 0.02)',
                    border: '1px solid rgba(255, 255, 255, 0.06)',
                    textAlign: 'center',
                  }}
                >
                  <Box sx={{ color: 'rgba(255, 255, 255, 0.3)', display: 'flex', justifyContent: 'center', mb: 2 }}>
                    <AlertCircle size={48} />
                  </Box>
                  <Typography variant="subtitle1" sx={{ fontWeight: 800, color: '#fff', mb: 1 }}>
                    Link GitHub Account
                  </Typography>
                  <Typography variant="body2" sx={{ color: 'rgba(255, 255, 255, 0.5)', mb: 3, maxWidth: '480px', mx: 'auto', lineHeight: 1.5 }}>
                    Connect your GitHub account to access your organization repositories, manage sync settings, and export tasks.
                  </Typography>
                  <Button
                    variant="contained"
                    fullWidth
                    disabled={isAuthenticating}
                    onClick={handleConnectGitHub}
                    startIcon={
                      isAuthenticating ? <CircularProgress size={18} color="inherit" /> : (
                      <svg width="18" height="18" fill="currentColor" viewBox="0 0 24 24" style={{ marginRight: 4 }}>
                        <path fillRule="evenodd" d="M12 2C6.477 2 2 6.484 2 12.017c0 4.425 2.865 8.18 6.839 9.504.5.092.682-.217.682-.483 0-.237-.008-.868-.013-1.703-2.782.605-3.369-1.343-3.369-1.343-.454-1.158-1.11-1.466-1.11-1.466-.908-.62.069-.608.069-.608 1.003.07 1.531 1.032 1.531 1.032.892 1.53 2.341 1.088 2.91.832.092-.647.35-1.088.636-1.338-2.22-.253-4.555-1.113-4.555-4.951 0-1.093.39-1.988 1.029-2.688-.103-.253-.446-1.272.098-2.65 0 0 .84-.27 2.75 1.026A9.564 9.564 0 0112 6.844c.85.004 1.705.115 2.504.337 1.909-1.296 2.747-1.027 2.747-1.027.546 1.379.202 2.398.1 2.651.64.7 1.028 1.595 1.028 2.688 0 3.848-2.339 4.695-4.566 4.943.359.309.678.92.678 1.855 0 1.338-.012 2.419-.012 2.747 0 .268.18.58.688.482A10.019 10.019 0 0022 12.017C22 6.484 17.522 2 12 2z" clipRule="evenodd" />
                      </svg>
                      )
                    }
                    sx={{
                      borderRadius: '14px',
                      bgcolor: '#fff',
                      color: '#000',
                      fontWeight: 900,
                      py: 1.5,
                      textTransform: 'none',
                      '&:hover': { bgcolor: 'rgba(255, 255, 255, 0.85)' },
                    }}
                  >
                    {isAuthenticating ? 'Connecting...' : 'Link GitHub Account'}
                  </Button>
                </Box>
              ) : (
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
                    <Box>
                      <Typography variant="body1" sx={{ fontWeight: 800, color: '#fff' }}>
                        GitHub Account Connected
                      </Typography>
                      <Typography variant="caption" sx={{ color: 'rgba(255, 255, 255, 0.5)' }}>
                        Linked Profile: {githubIdentity.providerEmail || githubIdentity.providerUid}
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
              )}
            </Stack>
          )}

          {/* Flow Step 2: Repository Sync Configuration */}
          {step === 2 && (
            <Stack spacing={3}>
              {/* Back Button to check account info */}
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

              {/* Repo configuration inputs */}
              <Stack direction={{ xs: 'column', sm: 'row' }} spacing={2}>
                <TextField
                  fullWidth
                  size="small"
                  label="Owner / Organization"
                  placeholder="e.g., google"
                  value={ownerName}
                  onChange={(e) => setOwnerName(e.target.value)}
                  InputLabelProps={{ style: { color: 'rgba(255,255,255,0.4)' } }}
                  InputProps={{
                    style: { color: '#fff' },
                    sx: {
                      '& .MuiOutlinedInput-notchedOutline': { borderColor: 'rgba(255,255,255,0.1)' },
                      '&:hover .MuiOutlinedInput-notchedOutline': { borderColor: 'rgba(255,255,255,0.2)' },
                    },
                  }}
                />
                <TextField
                  fullWidth
                  size="small"
                  label="Repository Name"
                  placeholder="e.g., antigravity"
                  value={repoName}
                  onChange={(e) => setRepoName(e.target.value)}
                  InputLabelProps={{ style: { color: 'rgba(255,255,255,0.4)' } }}
                  InputProps={{
                    style: { color: '#fff' },
                    sx: {
                      '& .MuiOutlinedInput-notchedOutline': { borderColor: 'rgba(255,255,255,0.1)' },
                      '&:hover .MuiOutlinedInput-notchedOutline': { borderColor: 'rgba(255,255,255,0.2)' },
                    },
                  }}
                />
              </Stack>

              <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5, px: 2, py: 1.25, bgcolor: 'rgba(255,255,255,0.02)', borderRadius: '14px', border: '1px dashed rgba(255,255,255,0.06)' }}>
                <Shield size={16} style={{ color: '#10B981', flexShrink: 0 }} />
                <Typography variant="caption" sx={{ color: 'rgba(255,255,255,0.4)', lineHeight: 1.3 }}>
                  Access keys are fully encrypted and securely stored in your private vault.
                </Typography>
              </Box>

              {integration && (
                <>
                  <Divider sx={{ borderColor: 'rgba(255,255,255,0.06)', my: 1 }} />
                  
                  {/* Task Sync Control */}
                  <Stack spacing={1.5}>
                    <Stack direction="row" justifyContent="space-between" alignItems="center">
                      <Typography variant="body2" sx={{ fontWeight: 800, color: '#fff' }}>
                        Git Issue Tracker Sync
                      </Typography>
                      <Button
                        variant="contained"
                        size="small"
                        startIcon={syncing ? <CircularProgress size={14} sx={{ color: '#000' }} /> : <RefreshCw size={14} />}
                        onClick={handleSyncTasks}
                        disabled={syncing}
                        sx={{
                          borderRadius: '10px',
                          bgcolor: '#6366F1',
                          color: '#000',
                          fontWeight: 900,
                          textTransform: 'none',
                          '&:hover': { bgcolor: '#4F46E5' },
                        }}
                      >
                        Export Tasks to Issues
                      </Button>
                    </Stack>
                    <Typography variant="caption" sx={{ color: 'rgba(255,255,255,0.4)' }}>
                      Export project tasks to the connected Git repository issue board.
                    </Typography>

                    {syncLogs.length > 0 && (
                      <Box
                        sx={{
                          p: 2,
                          borderRadius: '16px',
                          bgcolor: '#090807',
                          border: '1px solid rgba(255,255,255,0.05)',
                          fontFamily: 'monospace',
                          fontSize: '0.75rem',
                          color: 'rgba(255,255,255,0.6)',
                          maxHeight: '140px',
                          overflowY: 'auto',
                        }}
                      >
                        <Stack direction="row" spacing={1} alignItems="center" sx={{ mb: 1, color: 'rgba(255,255,255,0.3)' }}>
                          <Terminal size={12} />
                          <Typography variant="caption" sx={{ fontWeight: 800 }}>INTEGRATION TERMINAL LOGS</Typography>
                        </Stack>
                        {syncLogs.map((log, i) => (
                          <div key={i} style={{ marginBottom: '3px' }}>{log}</div>
                        ))}
                      </Box>
                    )}
                  </Stack>
                </>
              )}

              {/* Action Buttons */}
              <Box sx={{ display: 'flex', justifyContent: 'flex-end', gap: 1.5, mt: 2 }}>
                {integration && (
                  <Button
                    variant="text"
                    color="error"
                    onClick={handleDelete}
                    disabled={loading}
                    sx={{ fontWeight: 800, textTransform: 'none' }}
                  >
                    Disconnect
                  </Button>
                )}
                <Box sx={{ flexGrow: 1 }} />
                <Button
                  variant="text"
                  onClick={onClose}
                  sx={{ color: 'rgba(255,255,255,0.6)', fontWeight: 800, textTransform: 'none' }}
                >
                  Cancel
                </Button>
                <Button
                  variant="contained"
                  onClick={handleSave}
                  disabled={loading}
                  sx={{
                    borderRadius: '12px',
                    bgcolor: '#fff',
                    color: '#000',
                    fontWeight: 900,
                    px: 3,
                    textTransform: 'none',
                    '&:hover': { bgcolor: 'rgba(255,255,255,0.8)' },
                  }}
                >
                  {loading ? <CircularProgress size={16} sx={{ color: '#000' }} /> : 'Save Integration'}
                </Button>
              </Box>
            </Stack>
          )}
        </Stack>
      )}
    </Drawer>
  );
}
