'use client';
import { useColors } from '@/lib/theme-context';

import { useState, useEffect, useCallback } from 'react';
import { account } from '@/lib/appwrite';
import { useDataNexus } from '@/context/DataNexusContext';
import {
  Box,
  Typography,
  Button,
  Alert,
  AlertTitle,
  CircularProgress,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Stack,
  Chip,
  IconButton,
} from '@mui/material';
import DeleteIcon from '@mui/icons-material/Delete';
import RefreshIcon from '@mui/icons-material/Refresh';
import LaptopIcon from '@mui/icons-material/Laptop';
import PhoneIcon from '@mui/icons-material/Phone';
import TabletIcon from '@mui/icons-material/Tablet';
import { Models } from 'appwrite';

interface Session extends Models.Session {
  deviceType?: 'desktop' | 'mobile' | 'tablet';
}

interface SessionsManagerProps {
  onSessionsLoaded?: (count: number) => void;
}

export default function SessionsManager({ onSessionsLoaded }: SessionsManagerProps) {
  const dynamicColors = useColors();
  const { fetchOptimized, invalidate } = useDataNexus();
  const [loading, setLoading] = useState(true);
  const [sessions, setSessions] = useState<Session[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [selectedSession, setSelectedSession] = useState<Session | null>(null);
  const [deleting, setDeleting] = useState(false);

  const loadSessions = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);
      const sessionList = await fetchOptimized('user_sessions', async () => {
        return await account.listSessions();
      }, 1000 * 60 * 10);
      
      const formattedSessions = (sessionList.sessions || []).map((session) => ({
        ...session,
        deviceType: getDeviceType((session as any).userAgent || session.clientName || ''),
      }));
      setSessions(formattedSessions);
      onSessionsLoaded?.(formattedSessions.length);
    } catch (err: unknown) {
      setError((err as Error).message);
    } finally {
      setLoading(false);
    }
  }, [onSessionsLoaded, fetchOptimized]);

  useEffect(() => {
    loadSessions();
  }, [loadSessions]);

  const getDeviceType = (userAgent: string): 'desktop' | 'mobile' | 'tablet' => {
    if (/mobile|android/i.test(userAgent)) return 'mobile';
    if (/ipad|tablet/i.test(userAgent)) return 'tablet';
    return 'desktop';
  };

  const getDeviceIcon = (deviceType: string) => {
    switch (deviceType) {
      case 'mobile':
        return <PhoneIcon sx={{ fontSize: 20 }} />;
      case 'tablet':
        return <TabletIcon sx={{ fontSize: 20 }} />;
      default:
        return <LaptopIcon sx={{ fontSize: 20 }} />;
    }
  };

  const handleDeleteClick = (session: Session) => {
    setSelectedSession(session);
    setDeleteDialogOpen(true);
  };

  const handleDeleteSession = async () => {
    if (!selectedSession) return;
    try {
      setDeleting(true);
      setError(null);
      await account.deleteSession(selectedSession.$id);
      invalidate('user_sessions');
      setSessions(sessions.filter((s) => s.$id !== selectedSession.$id));
      setDeleteDialogOpen(false);
      setSelectedSession(null);
    } catch (err: unknown) {
      setError((err as Error).message);
    } finally {
      setDeleting(false);
    }
  };

  const handleDeleteAllSessions = async () => {
    try {
      setLoading(true);
      setError(null);
      await account.deleteSessions();
      invalidate('user_sessions');
      setSessions([]);
      onSessionsLoaded?.(0);
    } catch (err: unknown) {
      setError((err as Error).message);
    } finally {
      setLoading(false);
    }
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleString();
  };

  const getCountryFromIP = (_ip: string): string => {
    // Simple placeholder - in production, use a geolocation service
    return 'Unknown Location';
  };

  if (loading && sessions.length === 0) {
    return (
      <Box sx={{ display: 'flex', justifyContent: 'center', py: 3 }}>
        <CircularProgress size={40} sx={{ color: dynamicColors.primary }} />
      </Box>
    );
  }

  return (
    <Box>
      {error && (
        <Alert
          severity="error"
          sx={{
            mb: 3,
            borderRadius: '12px',
            bgcolor: 'rgba(239, 68, 68, 0.1)',
            border: '1px solid rgba(239, 68, 68, 0.2)',
            color: '#FCA5A5',
          }}
        >
          <AlertTitle sx={{ fontWeight: 700 }}>Error</AlertTitle>
          {error}
        </Alert>
      )}

      {sessions.length === 0 ? (
        <Box
          sx={{
            backgroundColor: '#161514',
            borderRadius: '12px',
            p: 4,
            textAlign: 'center',
          }}
        >
          <Typography sx={{ color: 'rgba(255, 255, 255, 0.5)', fontSize: '0.95rem' }}>
            No active sessions found.
          </Typography>
        </Box>
      ) : (
        <Box>
          <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 3 }}>
            <Typography sx={{ color: 'rgba(255, 255, 255, 0.7)', fontSize: '0.875rem', fontWeight: 500 }}>
              {sessions.length} active {sessions.length === 1 ? 'session' : 'sessions'}
            </Typography>
            <Box sx={{ display: 'flex', gap: 2 }}>
              <Button
                onClick={loadSessions}
                disabled={loading}
                startIcon={<RefreshIcon />}
                sx={{
                  color: 'white',
                  borderColor: 'rgba(255, 255, 255, 0.2)',
                  fontSize: '0.75rem',
                  fontWeight: 500,
                  textTransform: 'none',
                  borderRadius: '8px',
                  border: '1px solid rgba(255, 255, 255, 0.2)',
                  boxShadow: '0 1px 2px 0 rgb(0 0 0 / 0.2)',
                  '&:hover': {
                    borderColor: 'rgba(255, 255, 255, 0.3)',
                    boxShadow: '0 2px 4px 0 rgb(0 0 0 / 0.3)',
                  },
                }}
              >
                Refresh
              </Button>
              {sessions.length > 1 && (
                <Button
                  onClick={handleDeleteAllSessions}
                  sx={{
                    color: '#ef4444',
                    borderColor: 'rgba(239, 68, 68, 0.3)',
                    backgroundColor: 'rgba(239, 68, 68, 0.1)',
                    fontSize: '0.75rem',
                    fontWeight: 500,
                    textTransform: 'none',
                    borderRadius: '8px',
                    border: '1px solid rgba(239, 68, 68, 0.3)',
                    boxShadow: '0 1px 2px 0 rgb(0 0 0 / 0.2)',
                    '&:hover': {
                      backgroundColor: 'rgba(239, 68, 68, 0.2)',
                      borderColor: 'rgba(239, 68, 68, 0.5)',
                      boxShadow: '0 2px 4px 0 rgb(0 0 0 / 0.3)',
                    },
                  }}
                >
                  Logout All
                </Button>
              )}
            </Box>
          </Box>

          <Stack spacing={2}>
            {sessions.map((session) => (
              <Box
                key={session.$id}
                sx={{
                  backgroundColor: '#161514',
                  borderRadius: '12px',
                  p: 2,
                  display: 'flex',
                  alignItems: 'flex-start',
                  justifyContent: 'space-between',
                  gap: 2,
                  overflow: 'hidden',
                  transition: 'all 0.2s ease-out',
                  '&:hover': {
                    backgroundColor: '#1F1D1B',
                  }
                }}
              >
                <Box sx={{ flex: 1, minWidth: 0 }}>
                  <Box sx={{ display: 'flex', alignItems: 'center', gap: 2, mb: 2 }}>
                    <Box
                      sx={{
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        width: 44,
                        height: 44,
                        borderRadius: '10px',
                        backgroundColor: 'rgba(99, 102, 241, 0.15)',
                        color: dynamicColors.primary,
                        flexShrink: 0,
                      }}
                    >
                      {getDeviceIcon(session.deviceType || 'desktop')}
                    </Box>
                    <Box sx={{ minWidth: 0, flex: 1 }}>
                      <Typography sx={{ fontSize: '0.95rem', fontWeight: 600, color: '#FFFFFF', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                        {session.clientName || 'Unknown Client'} ({session.deviceType?.toUpperCase() || 'DESKTOP'})
                      </Typography>
                      <Typography sx={{ fontSize: '0.8rem', color: 'rgba(255, 255, 255, 0.5)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                        {getCountryFromIP(session.ip)} • {session.ip}
                      </Typography>
                    </Box>
                  </Box>

                  <Box sx={{ display: 'flex', gap: 4, mt: 2.5, flexWrap: 'wrap' }}>
                    <Box>
                      <Typography sx={{ fontSize: '0.65rem', color: 'rgba(255, 255, 255, 0.4)', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                        Last Active
                      </Typography>
                      <Typography sx={{ fontSize: '0.8rem', color: 'rgba(255, 255, 255, 0.7)', fontWeight: 500, mt: 0.5 }}>
                        {formatDate(session.$updatedAt || session.$createdAt)}
                      </Typography>
                    </Box>
                    <Box>
                      <Typography sx={{ fontSize: '0.65rem', color: 'rgba(255, 255, 255, 0.4)', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                        Created
                      </Typography>
                      <Typography sx={{ fontSize: '0.8rem', color: 'rgba(255, 255, 255, 0.7)', fontWeight: 500, mt: 0.5 }}>
                        {formatDate(session.$createdAt)}
                      </Typography>
                    </Box>
                    {session.current && (
                      <Chip
                        label="Current Session"
                        size="small"
                        sx={{
                          backgroundColor: 'rgba(34, 197, 94, 0.2)',
                          color: '#22c55e',
                          fontSize: '0.65rem',
                          fontWeight: 500,
                          height: 20,
                          borderRadius: '0.375rem',
                        }}
                      />
                    )}
                  </Box>
                </Box>

                <IconButton
                  onClick={() => handleDeleteClick(session)}
                  sx={{
                    width: 40,
                    height: 40,
                    padding: 0,
                    margin: 0,
                    flexShrink: 0,
                    color: '#EF4444',
                    borderRadius: '8px',
                    backgroundColor: 'rgba(239, 68, 68, 0.08)',
                    border: '1px solid rgba(239, 68, 68, 0.2)',
                    transition: 'all 0.2s ease-out',
                    '&:hover': {
                      backgroundColor: 'rgba(239, 68, 68, 0.15)',
                      borderColor: 'rgba(239, 68, 68, 0.4)',
                    },
                  }}
                >
                  <DeleteIcon sx={{ fontSize: 20 }} />
                </IconButton>
              </Box>
            ))}
          </Stack>
        </Box>
      )}

      {/* Delete Confirmation Dialog */}
      <Dialog
        open={deleteDialogOpen}
        onClose={() => setDeleteDialogOpen(false)}
        PaperProps={{
          sx: {
            backgroundColor: '#161514',
            border: '1px solid rgba(255, 255, 255, 0.1)',
            borderRadius: '12px',
          },
        }}
      >
        <DialogTitle sx={{ color: 'white', pb: 1, fontWeight: 600 }}>Logout Session</DialogTitle>
        <DialogContent>
          <Typography sx={{ color: 'rgba(255, 255, 255, 0.7)', mt: 2 }}>
            Are you sure you want to logout this session? This action cannot be undone.
          </Typography>
        </DialogContent>
        <DialogActions sx={{ p: 2, gap: 1 }}>
          <Button
            onClick={() => setDeleteDialogOpen(false)}
            sx={{
              color: 'rgba(255, 255, 255, 0.7)',
              borderRadius: '8px',
              textTransform: 'none',
              fontWeight: 600,
            }}
          >
            Cancel
          </Button>
          <Button
            onClick={handleDeleteSession}
            disabled={deleting}
            variant="contained"
            sx={{
              backgroundColor: '#ef4444',
              color: 'white',
              borderRadius: '8px',
              textTransform: 'none',
              fontWeight: 600,
              '&:hover': {
                backgroundColor: '#dc2626',
              },
            }}
          >
            {deleting ? 'Logging out...' : 'Logout'}
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
}
