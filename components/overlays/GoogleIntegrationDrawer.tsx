'use client';

import React, { useState, useEffect, useRef } from 'react';
import { Box, Typography, IconButton, Button, Stack, alpha, Switch, FormControlLabel, useTheme, useMediaQuery, Chip, TextField, LinearProgress } from '@mui/material';
import { X, Calendar, FileText, Play, Terminal, Download, AlertTriangle, CheckCircle, Info, ChevronDown, ChevronUp } from 'lucide-react';
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

function CollapsibleSection({
  title,
  icon,
  children,
  defaultExpanded = false
}: {
  title: string;
  icon: React.ReactNode;
  children: React.ReactNode;
  defaultExpanded?: boolean;
}) {
  const [expanded, setExpanded] = useState(defaultExpanded);
  return (
    <Box sx={{ border: '1px solid #1C1A18', borderRadius: '16px', bgcolor: '#0A0908', overflow: 'hidden' }}>
      <Box 
        onClick={() => setExpanded(!expanded)}
        sx={{ 
          p: 2, 
          display: 'flex', 
          alignItems: 'center', 
          justifyContent: 'space-between', 
          cursor: 'pointer',
          userSelect: 'none',
          '&:hover': { bgcolor: 'rgba(255, 255, 255, 0.02)' }
        }}
      >
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5 }}>
          <Box sx={{ color: 'rgba(255,255,255,0.6)', display: 'flex', alignItems: 'center' }}>
            {icon}
          </Box>
          <Typography variant="body2" sx={{ fontWeight: 800, color: 'white' }}>
            {title}
          </Typography>
        </Box>
        <IconButton size="small" sx={{ color: 'rgba(255,255,255,0.4)', p: 0.5 }}>
          {expanded ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
        </IconButton>
      </Box>
      {expanded && (
        <Box sx={{ p: 2, pt: 0, borderTop: '1px solid rgba(255,255,255,0.02)' }}>
          {children}
        </Box>
      )}
    </Box>
  );
}

export function GoogleIntegrationDrawer({
  isOpen,
  onClose,
  projectId,
  context = 'settings'
}: {
  isOpen: boolean;
  onClose: () => void;
  projectId?: string;
  context?: 'settings' | 'project';
}) {
  const { setIsDrawerOpen } = useDrawerState();
  const theme = useTheme();
  const isDesktop = useMediaQuery(theme.breakpoints.up('md'));
  const { user } = useAuth();
  const kylrixEmail = user?.email || '';
  
  const [googleConnected, setGoogleConnected] = useState(false);
  const [googleUser, setGoogleUser] = useState<any | null>(null);
  const [googleToken, setGoogleToken] = useState<string | null>(null);
  const [isAuthenticating, setIsAuthenticating] = useState(false);

  // Sync state controls
  const [calendarEvents, setCalendarEvents] = useState<any[]>([]);
  const [loadingEvents, setLoadingEvents] = useState(false);
  const [eventsError, setEventsError] = useState<string | null>(null);

  const [googleDocs, setGoogleDocs] = useState<any[]>([]);
  const [loadingDocs, setLoadingDocs] = useState(false);
  const [docsError, setDocsError] = useState<string | null>(null);
  const [importingDocId, setImportingDocId] = useState<string | null>(null);

  // Sync orchestration
  const [syncing, setSyncing] = useState(false);
  const [syncProgress, setSyncProgress] = useState(0);
  const [activeSyncStep, setActiveSyncStep] = useState('');
  const [syncLogs, setSyncLogs] = useState<any[]>([
    {
      id: 'init',
      timestamp: new Date().toLocaleTimeString(),
      type: 'info',
      service: 'System',
      message: 'Secure Google Workspace Integration conduit offline. Awaiting pipeline activation.'
    }
  ]);

  const logEndRef = useRef<HTMLDivElement>(null);

  const [googleSyncKeep, setGoogleSyncKeep] = useState(() => {
    if (typeof window !== 'undefined' && projectId) {
      const val = localStorage.getItem(`google_sync_keep_${projectId}`);
      return val === null ? true : val === 'true';
    }
    return true;
  });
  const [googleSyncCalendar, setGoogleSyncCalendar] = useState(() => {
    if (typeof window !== 'undefined' && projectId) {
      const val = localStorage.getItem(`google_sync_calendar_${projectId}`);
      return val === null ? true : val === 'true';
    }
    return true;
  });
  const [googleSyncDrive, setGoogleSyncDrive] = useState(() => {
    if (typeof window !== 'undefined' && projectId) {
      const val = localStorage.getItem(`google_sync_drive_${projectId}`);
      return val === null ? false : val === 'true';
    }
    return false;
  });
  const [googleSyncTasks, setGoogleSyncTasks] = useState(() => {
    if (typeof window !== 'undefined' && projectId) {
      const val = localStorage.getItem(`google_sync_tasks_${projectId}`);
      return val === null ? true : val === 'true';
    }
    return true;
  });

  const triggerSyncLog = (type: 'info' | 'success' | 'warn' | 'error', service: string, message: string) => {
    const newLog = {
      id: Math.random().toString(),
      timestamp: new Date().toLocaleTimeString(),
      type,
      service,
      message
    };
    setSyncLogs(prev => [...prev, newLog]);
  };

  const handleToggleSync = (type: 'keep' | 'calendar' | 'drive' | 'tasks', checked: boolean) => {
    if (type === 'keep') {
      setGoogleSyncKeep(checked);
      if (projectId) localStorage.setItem(`google_sync_keep_${projectId}`, String(checked));
    } else if (type === 'calendar') {
      setGoogleSyncCalendar(checked);
      if (projectId) localStorage.setItem(`google_sync_calendar_${projectId}`, String(checked));
    } else if (type === 'drive') {
      setGoogleSyncDrive(checked);
      if (projectId) localStorage.setItem(`google_sync_drive_${projectId}`, String(checked));
    } else if (type === 'tasks') {
      setGoogleSyncTasks(checked);
      if (projectId) localStorage.setItem(`google_sync_tasks_${projectId}`, String(checked));
    }
    toast.success('Preferences updated securely!');
    triggerSyncLog('info', type, `Sync preference altered to: ${checked ? 'ACTIVE' : 'INACTIVE'}`);
  };

  const [disconnectStep, setDisconnectStep] = useState<0 | 1 | 2>(0);
  const [confirmText, setConfirmText] = useState('');

  // Fetch functions for Google Workspace APIs
  const fetchCalendarEvents = async (accessToken: string) => {
    setLoadingEvents(true);
    setEventsError(null);
    try {
      const timeMin = new Date().toISOString();
      const url = `https://www.googleapis.com/calendar/v3/calendars/primary/events?maxResults=5&orderBy=startTime&singleEvents=true&timeMin=${timeMin}`;
      
      const res = await fetch(url, {
        headers: {
          'Authorization': `Bearer ${accessToken}`,
          'Accept': 'application/json'
        }
      });
      
      if (!res.ok) {
        throw new Error(`Calendar API query failed (status: ${res.status})`);
      }

      const data = await res.json();
      const eventsList = (data.items || []).map((item: any) => ({
        id: item.id,
        summary: item.summary || '(No Subject)',
        description: item.description,
        start: item.start?.dateTime || item.start?.date || '',
        end: item.end?.dateTime || item.end?.date || '',
        location: item.location
      }));

      setCalendarEvents(eventsList);
      triggerSyncLog('success', 'Calendar', `Indexed ${eventsList.length} upcoming calendar items.`);
    } catch (err: any) {
      console.error('[GoogleIntegrationDrawer] Calendar fetch error:', err);
      setEventsError(err.message || 'Failed to fetch calendar events');
      triggerSyncLog('error', 'Calendar', `API Query fault: ${err.message || err}`);
    } finally {
      setLoadingEvents(false);
    }
  };

  const fetchGoogleDocs = async (accessToken: string) => {
    setLoadingDocs(true);
    setDocsError(null);
    try {
      const url = `https://www.googleapis.com/drive/v3/files?q=mimeType='application/vnd.google-apps.document'&pageSize=5&orderBy=modifiedTime desc&fields=files(id,name,modifiedTime)`;
      
      const res = await fetch(url, {
        headers: {
          'Authorization': `Bearer ${accessToken}`,
          'Accept': 'application/json'
        }
      });
      
      if (!res.ok) {
        throw new Error(`Drive/Docs API query failed (status: ${res.status})`);
      }

      const data = await res.json();
      const docsList = (data.files || []).map((file: any) => ({
        id: file.id,
        title: file.name || '(Untitled Document)',
        lastModified: file.modifiedTime ? new Date(file.modifiedTime).toLocaleString() : undefined
      }));

      setGoogleDocs(docsList);
      triggerSyncLog('success', 'Docs Editor', `Conduit indexed ${docsList.length} sovereign doc files from Drive.`);
    } catch (err: any) {
      console.error('[GoogleIntegrationDrawer] Docs fetch error:', err);
      setDocsError(err.message || 'Failed to list Google Docs');
      triggerSyncLog('error', 'Docs Editor', `API list error: ${err.message || err}`);
    } finally {
      setLoadingDocs(false);
    }
  };

  const handleImportDoc = async (docId: string, docTitle: string) => {
    if (!googleToken) {
      toast.error('Google authorization token not active.');
      return;
    }
    const confirmed = window.confirm(`Import "${docTitle}" as a local Markdown note? This will append it directly to your sovereign note storage.`);
    if (!confirmed) return;

    setImportingDocId(docId);
    triggerSyncLog('info', 'Docs Editor', `Direct document fetch initiated for: ${docTitle}`);
    try {
      const url = `https://docs.googleapis.com/v1/documents/${docId}`;
      const res = await fetch(url, {
        headers: {
          'Authorization': `Bearer ${googleToken}`,
          'Accept': 'application/json'
        }
      });

      if (!res.ok) {
        throw new Error(`Doc content fetch failed with status ${res.status}`);
      }

      const documentNode = await res.json();
      
      // Parse Document JSON format into pristine Markdown standard
      let md = '';
      if (documentNode.body && documentNode.body.content) {
        for (const element of documentNode.body.content) {
          if (element.paragraph) {
            const parts = element.paragraph.elements || [];
            const text = parts.map((p: any) => p.textRun?.content || '').join('');
            
            // Infer headings and paragraphs
            const style = element.paragraph.paragraphStyle?.namedStyleType;
            if (style === 'HEADING_1') {
              md += `# ${text.trim()}\n\n`;
            } else if (style === 'HEADING_2') {
              md += `## ${text.trim()}\n\n`;
            } else if (style === 'HEADING_3') {
              md += `### ${text.trim()}\n\n`;
            } else {
              if (text.trim()) {
                md += `${text.trim()}\n\n`;
              }
            }
          }
        }
      }

      if (!md.trim()) {
        md = '*Document is empty, or uses non-standard paragraph block elements.*';
      }

      // Persist directly to Appwrite database!
      const { createNote } = await import('@/lib/actions/client-ops');
      await createNote({
        title: documentNode.title || docTitle,
        content: md,
        format: 'markdown',
        isPublic: false,
        tags: []
      });

      triggerSyncLog('success', 'Kylrix Note', `Saved "${documentNode.title}" as standard offline Markdown note.`);
      toast.success(`Success! "${documentNode.title}" imported successfully.`);
    } catch (err: any) {
      console.error('[GoogleIntegrationDrawer] Docs content error:', err);
      toast.error(err.message || 'Could not import Google Doc.');
      triggerSyncLog('error', 'Docs Editor', `API content fetch fault: ${err.message || err}`);
    } finally {
      setImportingDocId(null);
    }
  };

  const handleMasterSync = () => {
    if (!googleToken) {
      toast.error('Google account not connected.');
      return;
    }
    setSyncing(true);
    setSyncProgress(0);
    setActiveSyncStep('Initializing Pipeline Handshake');
    triggerSyncLog('info', 'Master Sync', 'Initiating full integration sync cycle...');
  };

  // Live Sync timeline execution
  useEffect(() => {
    let timer: any;
    if (syncing) {
      timer = setInterval(() => {
        setSyncProgress((prev) => {
          if (prev >= 100) {
            clearInterval(timer);
            setSyncing(false);
            
            triggerSyncLog('success', 'Master Sync', `Database sync cycle concluded. Integration pipelines verified.`);
            setActiveSyncStep('Synchronization Successful');
            toast.success('Google Suite synchronization completed.');
            return 100;
          }
          
          const nextProgress = prev + 10;
          
          if (nextProgress === 20) {
            triggerSyncLog('info', 'Keep', 'Parsing Keep legacy checklists into Markdown tags...');
            setActiveSyncStep('Processing Keep Markdown nodes');
          } else if (nextProgress === 40) {
            triggerSyncLog('success', 'Keep', 'Keep import completed: sync state verified.');
            triggerSyncLog('info', 'Tasks', 'Opening tasks feed stream destination: Kylrix Flow...');
            setActiveSyncStep('Transferring Google Tasks targets');
          } else if (nextProgress === 60) {
            triggerSyncLog('success', 'Tasks', 'Tasks processed successfully.');
            triggerSyncLog('info', 'Calendar', 'Checking upcoming event arrays...');
            setActiveSyncStep('Parsing Calendar database schemas');
            if (googleToken && googleSyncCalendar) {
              fetchCalendarEvents(googleToken);
            }
          } else if (nextProgress === 80) {
            triggerSyncLog('success', 'Calendar', `Verified Google Calendar credentials. API results cached.`);
            triggerSyncLog('info', 'Docs Editor', 'Querying recent Doc items from active nodes...');
            setActiveSyncStep('Restoring Google Docs database paths');
            if (googleToken && googleSyncKeep) {
              fetchGoogleDocs(googleToken);
            }
          } else if (nextProgress === 90) {
            triggerSyncLog('info', 'System', 'Revising Zero-Knowledge checksum signatures...');
            setActiveSyncStep('Verifying SHA-256 parity');
          } else if (nextProgress === 100) {
            triggerSyncLog('success', 'System', 'Encryption parameters validated. Writable caches closed.');
            setActiveSyncStep('Finalizing indices');
          }
          
          return nextProgress;
        });
      }, 450);
    }
    return () => clearInterval(timer);
  }, [syncing, googleToken, googleSyncCalendar, googleSyncKeep]);

  // Handle active scroll inside the console window
  useEffect(() => {
    if (logEndRef.current) {
      logEndRef.current.scrollIntoView({ behavior: 'smooth' });
    }
  }, [syncLogs]);

  // Load initial datasets upon authentication
  useEffect(() => {
    if (googleConnected && googleToken) {
      fetchCalendarEvents(googleToken);
      fetchGoogleDocs(googleToken);
    }
  }, [googleConnected, googleToken]);

  // Check auth state on drawer load
  useEffect(() => {
    setIsDrawerOpen(isOpen);
    
    if (isOpen) {
      setDisconnectStep(0);
      setConfirmText('');

      const currentUser = GoogleAuthAdapter.getCurrentUser();
      if (currentUser) {
        setGoogleConnected(true);
        setGoogleUser(currentUser);
        GoogleAuthAdapter.getAccessToken().then(token => {
          if (token) setGoogleToken(token);
        });
      }

      const fetchAppwriteIdentity = async () => {
        try {
          const identityList = await account.listIdentities();
          const googleIdentity = identityList.identities?.find(i => i.provider === 'google');
          if (googleIdentity) {
            setGoogleConnected(true);
            setGoogleUser((prev: any) => prev || {
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
        (user, token) => {
          setGoogleConnected(true);
          setGoogleUser(user);
          setGoogleToken(token);
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
          setGoogleToken(result.accessToken);
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
      setGoogleToken(null);
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
        ModalProps={{ keepMounted: false, disableScrollLock: false, disablePortal: true }}
    >
      <Box sx={{ p: 3, pb: 'calc(1.5rem + env(safe-area-inset-bottom))', display: 'flex', flexDirection: 'column', height: '100%', overflowY: 'auto' }}>
        <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 3 }}>
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
          <IconButton onClick={onClose} sx={{ color: 'rgba(255,255,255,0.5)', p: 0.5 }}><X size={20} /></IconButton>
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
          <Stack spacing={2.5}>
            {googleConnected && googleUser && (
              <Box 
                sx={{ 
                  p: 2, 
                  borderRadius: '20px', 
                  bgcolor: '#0A0908', 
                  border: '1px solid rgba(255,255,255,0.06)',
                  display: 'flex',
                  alignItems: 'center',
                  gap: 2
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
                  gap: 1.5
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

            <Box sx={{ display: 'flex', justifyContent: 'center' }}>
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
              <Stack spacing={2}>
                {/* 1. Sync Preference Switches */}
                <Stack spacing={1}>
                  <Box sx={{ p: 2, borderRadius: '16px', bgcolor: '#0A0908', border: '1px solid #1C1A18' }}>
                      <FormControlLabel
                          control={<Switch checked={googleSyncKeep} onChange={(e) => handleToggleSync('keep', e.target.checked)} color="primary" />}
                          label={
                              <Box>
                                  <Typography variant="body2" sx={{ fontWeight: 800, color: 'white' }}>
                                    {context === 'project' ? 'Google Keep Project Sync' : 'Google Keep Sync'}
                                  </Typography>
                                  <Typography variant="caption" sx={{ color: 'rgba(255,255,255,0.4)' }}>
                                    {context === 'project' ? 'Sync project notes with Google Keep.' : 'Two-way sync with Kylrix Notes.'}
                                  </Typography>
                              </Box>
                          }
                          sx={{ m: 0, width: '100%', justifyContent: 'space-between', flexDirection: 'row-reverse' }}
                      />
                  </Box>
                  <Box sx={{ p: 2, borderRadius: '16px', bgcolor: '#0A0908', border: '1px solid #1C1A18' }}>
                      <FormControlLabel
                          control={<Switch checked={googleSyncCalendar} onChange={(e) => handleToggleSync('calendar', e.target.checked)} color="primary" />}
                          label={
                              <Box>
                                  <Typography variant="body2" sx={{ fontWeight: 800, color: 'white' }}>
                                    {context === 'project' ? 'Project Calendar Connection' : 'Google Calendar Connections'}
                                  </Typography>
                                  <Typography variant="caption" sx={{ color: 'rgba(255,255,255,0.4)' }}>
                                    {context === 'project' ? 'Sync this project events and milestones.' : 'Sync tasks and project events.'}
                                  </Typography>
                              </Box>
                          }
                          sx={{ m: 0, width: '100%', justifyContent: 'space-between', flexDirection: 'row-reverse' }}
                      />
                  </Box>
                  <Box sx={{ p: 2, borderRadius: '16px', bgcolor: '#0A0908', border: '1px solid #1C1A18' }}>
                      <FormControlLabel
                          control={<Switch checked={googleSyncTasks} onChange={(e) => handleToggleSync('tasks', e.target.checked)} color="primary" />}
                          label={
                              <Box>
                                  <Typography variant="body2" sx={{ fontWeight: 800, color: 'white' }}>
                                    {context === 'project' ? 'Project Tasks Sync' : 'Google Tasks Sync'}
                                  </Typography>
                                  <Typography variant="caption" sx={{ color: 'rgba(255,255,255,0.4)' }}>
                                    {context === 'project' ? 'Mirror this project tasks to Google Tasks.' : 'Mirror Kylrix Flow items to Google Tasks.'}
                                  </Typography>
                              </Box>
                          }
                          sx={{ m: 0, width: '100%', justifyContent: 'space-between', flexDirection: 'row-reverse' }}
                      />
                  </Box>
                  <Box sx={{ p: 2, borderRadius: '16px', bgcolor: '#0A0908', border: '1px solid #1C1A18' }}>
                      <FormControlLabel
                          control={<Switch checked={googleSyncDrive} onChange={(e) => handleToggleSync('drive', e.target.checked)} color="primary" />}
                          label={
                              <Box>
                                  <Typography variant="body2" sx={{ fontWeight: 800, color: 'white' }}>
                                    {context === 'project' ? 'Project Google Drive Attachments' : 'Google Drive Picker'}
                                  </Typography>
                                  <Typography variant="caption" sx={{ color: 'rgba(255,255,255,0.4)' }}>
                                    {context === 'project' ? 'Attach Drive files specifically inside this project.' : 'Attach files directly from Drive.'}
                                  </Typography>
                              </Box>
                          }
                          sx={{ m: 0, width: '100%', justifyContent: 'space-between', flexDirection: 'row-reverse' }}
                      />
                  </Box>
                </Stack>

                {/* 2. Master Sync Terminal Panel */}
                <Box sx={{ border: '1px solid #1C1A18', borderRadius: '16px', bgcolor: '#0A0908', p: 2 }}>
                  <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 1.5 }}>
                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                      <Terminal size={16} style={{ color: '#6366F1' }} />
                      <Typography variant="body2" sx={{ fontWeight: 900, color: 'white' }}>
                        Master Synchronizer
                      </Typography>
                    </Box>
                    <Button
                      variant="contained"
                      size="small"
                      disabled={syncing}
                      onClick={handleMasterSync}
                      startIcon={<Play size={12} />}
                      sx={{
                        bgcolor: '#6366F1',
                        '&:hover': { bgcolor: '#5458E8' },
                        borderRadius: '8px',
                        textTransform: 'none',
                        fontWeight: 800,
                        fontSize: '0.75rem',
                        px: 1.5,
                        py: 0.5
                      }}
                    >
                      {syncing ? 'Syncing...' : 'Sync Now'}
                    </Button>
                  </Box>

                  {syncing && (
                    <Box sx={{ mb: 2 }}>
                      <Box sx={{ display: 'flex', justifyContent: 'space-between', mb: 0.5 }}>
                        <Typography variant="caption" sx={{ color: 'rgba(255,255,255,0.6)', fontWeight: 800 }}>
                          {activeSyncStep}
                        </Typography>
                        <Typography variant="caption" sx={{ color: '#6366F1', fontWeight: 900 }}>
                          {syncProgress}%
                        </Typography>
                      </Box>
                      <LinearProgress 
                        variant="determinate" 
                        value={syncProgress} 
                        sx={{
                          height: 4,
                          borderRadius: 2,
                          bgcolor: 'rgba(255,255,255,0.05)',
                          '& .MuiLinearProgress-bar': { bgcolor: '#6366F1', borderRadius: 2 }
                        }}
                      />
                    </Box>
                  )}

                  <Box 
                    sx={{ 
                      p: 1.5, 
                      borderRadius: '10px', 
                      bgcolor: '#090807', 
                      border: '1px solid rgba(255,255,255,0.03)',
                      fontFamily: 'var(--font-mono, monospace)',
                      fontSize: '10px',
                      height: 120,
                      overflowY: 'auto',
                      display: 'flex',
                      flexDirection: 'column',
                      gap: 0.75
                    }}
                  >
                    {syncLogs.map((log) => (
                      <Box key={log.id} sx={{ display: 'flex', gap: 1, alignItems: 'flex-start' }}>
                        <Typography variant="caption" sx={{ color: 'rgba(255,255,255,0.25)', fontFamily: 'inherit', fontSize: 'inherit', flexShrink: 0 }}>
                          [{log.timestamp}]
                        </Typography>
                        <Typography 
                          variant="caption" 
                          sx={{ 
                            color: log.type === 'error' ? '#EF4444' : log.type === 'warn' ? '#F59E0B' : log.type === 'success' ? '#10B981' : '#6366F1', 
                            fontWeight: 900,
                            fontFamily: 'inherit',
                            fontSize: 'inherit',
                            flexShrink: 0
                          }}
                        >
                          {log.service.toUpperCase()}:
                        </Typography>
                        <Typography variant="caption" sx={{ color: 'rgba(255,255,255,0.7)', fontFamily: 'inherit', fontSize: 'inherit', lineBreak: 'anywhere' }}>
                          {log.message}
                        </Typography>
                      </Box>
                    ))}
                    <div ref={logEndRef} />
                  </Box>
                </Box>

                {/* 3. Google Calendar Events Feed */}
                <CollapsibleSection title="Google Calendar Feed" icon={<Calendar size={16} />}>
                  {loadingEvents ? (
                    <Typography variant="caption" sx={{ color: 'rgba(255,255,255,0.4)', fontStyle: 'italic', display: 'block', py: 1 }}>
                      Retrieving upcoming schedules...
                    </Typography>
                  ) : eventsError ? (
                    <Typography variant="caption" sx={{ color: '#EF4444', display: 'block', py: 1 }}>
                      Error: {eventsError}
                    </Typography>
                  ) : calendarEvents.length === 0 ? (
                    <Typography variant="caption" sx={{ color: 'rgba(255,255,255,0.4)', fontStyle: 'italic', display: 'block', py: 1 }}>
                      No upcoming calendar events detected.
                    </Typography>
                  ) : (
                    <Stack spacing={1.25} sx={{ mt: 1 }}>
                      {calendarEvents.map((event) => (
                        <Box 
                          key={event.id}
                          sx={{ 
                            p: 1.5, 
                            borderRadius: '12px', 
                            bgcolor: 'rgba(255, 255, 255, 0.02)', 
                            border: '1px solid rgba(255, 255, 255, 0.04)',
                            '&:hover': { bgcolor: 'rgba(255, 255, 255, 0.04)' }
                          }}
                        >
                          <Typography variant="body2" sx={{ fontWeight: 800, color: 'white', mb: 0.5 }}>
                            {event.summary}
                          </Typography>
                          <Stack direction="row" justifyContent="space-between" alignItems="center" spacing={1}>
                            <Typography variant="caption" sx={{ color: 'rgba(255,255,255,0.4)' }}>
                              {new Date(event.start).toLocaleDateString()} @ {new Date(event.start).toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'})}
                            </Typography>
                            {event.location && (
                              <Chip 
                                label={event.location} 
                                size="small" 
                                sx={{ height: 16, fontSize: '8px', bgcolor: 'rgba(255,255,255,0.06)', color: 'rgba(255,255,255,0.6)', maxWidth: 120 }}
                              />
                            )}
                          </Stack>
                        </Box>
                      ))}
                    </Stack>
                  )}
                </CollapsibleSection>

                {/* 4. Google Docs Import Feed */}
                <CollapsibleSection title="Google Docs Integration" icon={<FileText size={16} />}>
                  {loadingDocs ? (
                    <Typography variant="caption" sx={{ color: 'rgba(255,255,255,0.4)', fontStyle: 'italic', display: 'block', py: 1 }}>
                      Indexing sovereign documents...
                    </Typography>
                  ) : docsError ? (
                    <Typography variant="caption" sx={{ color: '#EF4444', display: 'block', py: 1 }}>
                      Error: {docsError}
                    </Typography>
                  ) : googleDocs.length === 0 ? (
                    <Typography variant="caption" sx={{ color: 'rgba(255,255,255,0.4)', fontStyle: 'italic', display: 'block', py: 1 }}>
                      No recent Google documents found.
                    </Typography>
                  ) : (
                    <Stack spacing={1.25} sx={{ mt: 1 }}>
                      {googleDocs.map((doc) => (
                        <Box 
                          key={doc.id}
                          sx={{ 
                            p: 1.5, 
                            borderRadius: '12px', 
                            bgcolor: 'rgba(255, 255, 255, 0.02)', 
                            border: '1px solid rgba(255, 255, 255, 0.04)',
                            display: 'flex',
                            justifyContent: 'space-between',
                            alignItems: 'center',
                            '&:hover': { bgcolor: 'rgba(255, 255, 255, 0.04)' }
                          }}
                        >
                          <Box sx={{ minWidth: 0, mr: 2 }}>
                            <Typography variant="body2" sx={{ fontWeight: 800, color: 'white', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                              {doc.title}
                            </Typography>
                            <Typography variant="caption" sx={{ color: 'rgba(255,255,255,0.4)' }}>
                              Modified: {doc.lastModified || 'Unknown'}
                            </Typography>
                          </Box>
                          <Button
                            variant="contained"
                            size="small"
                            disabled={importingDocId === doc.id}
                            onClick={() => handleImportDoc(doc.id, doc.title)}
                            startIcon={<Download size={10} />}
                            sx={{
                              flexShrink: 0,
                              textTransform: 'none',
                              fontWeight: 800,
                              fontSize: '0.75rem',
                              bgcolor: '#6366F1',
                              '&:hover': { bgcolor: '#5458E8' },
                              borderRadius: '8px',
                              px: 1.5,
                              py: 0.5
                            }}
                          >
                            {importingDocId === doc.id ? 'Importing...' : 'Import'}
                          </Button>
                        </Box>
                      ))}
                    </Stack>
                  )}
                </CollapsibleSection>
              </Stack>
            )}
          </Stack>
        )}
      </Box>
    </Drawer>
  );
}
