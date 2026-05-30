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
} from '@mui/material';
import { X, GitBranch, Terminal, Shield, RefreshCw } from 'lucide-react';
import { SourceControlService, SourceControlRow } from '@/lib/services/sourceControl';
import { useToast } from '@/components/ui/Toast';
import { useSudo } from '@/context/SudoContext';

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
  maxHeight: '90vh',
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
  
  const [provider, setProvider] = useState('github');
  const [ownerName, setOwnerName] = useState('');
  const [repoName, setRepoName] = useState('');
  const [accessToken, setAccessToken] = useState('');
  const [enabled, setEnabled] = useState(true);
  const [syncLogs, setSyncLogs] = useState<string[]>([]);
  const [loading, setLoading] = useState(false);
  const [syncing, setSyncing] = useState(false);
  const [integration, setIntegration] = useState<SourceControlRow | null>(null);

  // Load existing integration row on mount
  useEffect(() => {
    async function load() {
      setLoading(true);
      try {
        const list = await SourceControlService.listIntegrations(projectId);
        if (list.length > 0) {
          const item = list[0];
          setIntegration(item);
          setProvider(item.provider || 'github');
          setOwnerName(item.ownerName || '');
          setRepoName(item.repoName || '');
          setAccessToken(item.accessToken || '');
          setEnabled(item.enabled !== false);
        }
      } catch (err) {
        console.error('Failed to load source control integration:', err);
      } finally {
        setLoading(false);
      }
    }
    if (isOpen) {
      load();
    }
  }, [isOpen, projectId]);

  const handleSave = () => {
    if (!ownerName.trim() || !repoName.trim()) {
      showError('Validation Error', 'Owner name and repository name are required.');
      return;
    }

    // Require Masterpass unlock before saving sensitive secrets/access tokens
    requestSudo({
      onSuccess: async () => {
        setLoading(true);
        try {
          const saved = await SourceControlService.saveIntegration(projectId, {
            provider,
            ownerName: ownerName.trim(),
            repoName: repoName.trim(),
            accessToken: accessToken.trim(),
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
    
    // Require Masterpass verification to delete/disconnect secure configurations
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
            setAccessToken('');
            setSyncLogs([]);
            onSaved();
            onClose();
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
      anchor="bottom"
      open={isOpen}
      onClose={onClose}
      keepMounted={false}
      disablePortal={true}
      PaperProps={{
        sx: DRAWER_SX,
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

      {loading ? (
        <Box sx={{ display: 'flex', justifyContent: 'center', py: 6 }}>
          <CircularProgress size={40} sx={{ color: '#6366F1' }} />
        </Box>
      ) : (
        <Stack spacing={3}>
          {/* Provider Selection */}
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

          {/* Secure token key input */}
          <TextField
            fullWidth
            size="small"
            type="password"
            label="Secure Access Token / API Key"
            placeholder="Enter your personal access token (optional)"
            value={accessToken}
            onChange={(e) => setAccessToken(e.target.value)}
            InputLabelProps={{ style: { color: 'rgba(255,255,255,0.4)' } }}
            InputProps={{
              style: { color: '#fff' },
              sx: {
                '& .MuiOutlinedInput-notchedOutline': { borderColor: 'rgba(255,255,255,0.1)' },
                '&:hover .MuiOutlinedInput-notchedOutline': { borderColor: 'rgba(255,255,255,0.2)' },
              },
            }}
          />

          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5, px: 2, py: 1.25, bgcolor: 'rgba(255,255,255,0.02)', borderRadius: '14px', border: '1px dashed rgba(255,255,255,0.06)' }}>
            <Shield size={16} style={{ color: '#10B981', flexShrink: 0 }} />
            <Typography variant="caption" sx={{ color: 'rgba(255,255,255,0.4)', lineHeight: 1.3 }}>
              Security tokens are fully encrypted using PBKDF2/AES-GCM encryption before saving.
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
    </Drawer>
  );
}
