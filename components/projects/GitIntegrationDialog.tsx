'use client';

import React, { useState, useEffect } from 'react';
import {
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
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

interface GitIntegrationDialogProps {
  isOpen: boolean;
  onClose: () => void;
  projectId: string;
  onSaved: () => void;
  tasks: any[];
}

export default function GitIntegrationDialog({
  isOpen,
  onClose,
  projectId,
  onSaved,
  tasks,
}: GitIntegrationDialogProps) {
  const { showSuccess, showError } = useToast();
  
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

  const handleSave = async () => {
    if (!ownerName.trim() || !repoName.trim()) {
      showError('Validation Error', 'Owner name and repository name are required.');
      return;
    }

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
      showSuccess('Git integration saved successfully!');
      onSaved();
    } catch (err: any) {
      showError('Save failed', err.message || 'Could not save configuration.');
    } finally {
      setLoading(false);
    }
  };

  const handleDelete = async () => {
    if (!integration?.$id) return;
    
    setLoading(true);
    try {
      const ok = await SourceControlService.removeIntegration(integration.$id);
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
    <Dialog
      open={isOpen}
      onClose={onClose}
      keepMounted={false}
      disablePortal={true}
      maxWidth="sm"
      fullWidth
      PaperProps={{
        sx: {
          bgcolor: '#161412',
          backgroundImage: 'none',
          border: '1px solid rgba(255, 255, 255, 0.08)',
          borderRadius: '28px',
          p: 2,
        },
      }}
    >
      <DialogTitle sx={{ m: 0, p: 2, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
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
      </DialogTitle>

      <DialogContent dividers sx={{ borderColor: 'rgba(255,255,255,0.06)', py: 3 }}>
        {loading ? (
          <Box sx={{ display: 'flex', justifyContent: 'center', py: 6 }}>
            <CircularProgress size={40} sx={{ color: '#6366F1' }} />
          </Box>
        ) : (
          <Stack spacing={3}>
            {/* Provider and Mode selection */}
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
                <MenuItem value="gitlab">GitLab</MenuItem>
                <MenuItem value="gitea">Gitea</MenuItem>
              </Select>
            </FormControl>

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

            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5, px: 1, py: 0.5, bgcolor: 'rgba(255,255,255,0.02)', borderRadius: '12px', border: '1px dashed rgba(255,255,255,0.05)' }}>
              <Shield size={16} style={{ color: '#10B981', flexShrink: 0 }} />
              <Typography variant="caption" sx={{ color: 'rgba(255,255,255,0.4)' }}>
                Tokens are stored using secure encryption in Appwrite vault tables.
              </Typography>
            </Box>

            {integration && (
              <>
                <Divider sx={{ borderColor: 'rgba(255,255,255,0.06)' }} />
                
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
          </Stack>
        )}
      </DialogContent>

      <DialogActions sx={{ p: 2, gap: 1 }}>
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
      </DialogActions>
    </Dialog>
  );
}
