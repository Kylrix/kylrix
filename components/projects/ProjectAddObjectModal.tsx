'use client';

import React, { useState, useEffect, useCallback } from 'react';
import {
  Drawer,
  Box,
  Typography,
  IconButton,
  TextField,
  List,
  ListItem,
  ListItemButton,
  ListItemIcon,
  ListItemText,
  CircularProgress,
  alpha,
  useTheme,
  Tabs,
  Tab,
  Stack,
  Button,
  Dialog,
  DialogTitle,
  DialogContent,
} from '@/lib/mui-tailwind/material';
import { 
  X, 
  Search, 
  FileText, 
  CheckSquare, 
  Lock, 
  Plus,
  Calendar,
  Tag as TagIcon,
  ClipboardList,
  KeyRound,
  Sparkles,
  PhoneCall,
} from 'lucide-react';
import { listNotes, listFlowTasks, listKeepCredentials, Query, listTags, listTagsByUser } from '@/lib/appwrite';
import { ProjectsService } from '@/lib/appwrite/projects';
import { useToast } from '@/components/ui/Toast';
import { useDataNexus } from '@/context/DataNexusContext';
import { useAuth } from '@/context/auth/AuthContext';
import { useOverlay } from '@/components/ui/OverlayContext';
import { useUnifiedDrawer } from '@/context/UnifiedDrawerContext';
import { useTask } from '@/context/TaskContext';
import { useNotes } from '@/context/NotesContext';

// Service Imports
import { FormsService } from '@/lib/services/forms';
import { EcosystemService } from '@/lib/services/ecosystem';
import { SocialService } from '@/lib/services/social';
import { CallService } from '@/lib/services/call';
import { events as eventApi } from '@/lib/kylrixflow';
import { permissions } from '@/lib/permissions';

// Dialog/Form Imports
import CreateNoteForm from '@/app/(app)/note/(app)/notes/CreateNoteForm';
import CredentialDialog from '@/components/app/dashboard/CredentialDialog';
import FormDialog from '@/components/forms/FormDialog';
import { EventDialog } from '@/components/events/EventDialog';
import NewTotpDialog from '@/components/app/totp/new';
import { CallActionModal } from '@/components/call/CallActionModal';

interface ProjectAddObjectModalProps {
  open: boolean;
  onClose: () => void;
  projectId: string;
  onAdded: () => void;
  initialTab?: number;
}

function CreateMomentDialog({ 
  open, 
  onClose, 
  onSaved, 
  userId,
  showSuccess,
  showError
}: { 
  open: boolean; 
  onClose: () => void; 
  onSaved: () => void; 
  userId: string;
  showSuccess: (msg: string) => void;
  showError: (title: string, msg: string) => void;
}) {
  const [caption, setCaption] = useState('');
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!caption.trim()) return;
    setLoading(true);
    try {
      await SocialService.createMoment(userId, caption, 'post');
      showSuccess('Moment published successfully!');
      onSaved();
      onClose();
    } catch (err: any) {
      showError('Failed to publish moment', err.message || '');
    } finally {
      setLoading(false);
    }
  };

  return (
    <Dialog 
      open={open} 
      onClose={onClose} 
      PaperProps={{
        sx: {
          borderRadius: '24px',
          bgcolor: '#161412',
          border: '1px solid rgba(255,255,255,0.06)',
          backgroundImage: 'none',
          maxWidth: '400px',
          width: '100%',
        }
      }}
    >
      <DialogTitle sx={{ color: 'white', fontWeight: 900, fontFamily: 'var(--font-satoshi)' }}>Create New Moment</DialogTitle>
      <form onSubmit={handleSubmit}>
        <DialogContent sx={{ pb: 3 }}>
          <TextField
            fullWidth
            multiline
            rows={3}
            variant="outlined"
            placeholder="What's on your mind?"
            value={caption}
            onChange={(e) => setCaption(e.target.value)}
            required
            sx={{
              '& .MuiOutlinedInput-root': {
                borderRadius: '16px',
                bgcolor: '#0A0908',
                color: 'white',
                '& fieldset': { borderColor: '#1C1A18' },
                '&:hover fieldset': { borderColor: 'rgba(255, 255, 255, 0.2)' },
                '&.Mui-focused fieldset': { borderColor: '#10B981' }
              }
            }}
          />
        </DialogContent>
        <DialogActions sx={{ px: 3, pb: 3, display: 'flex', justifyContent: 'flex-end', gap: 1 } as any}>
          <Button onClick={onClose} sx={{ color: 'rgba(255,255,255,0.4)', textTransform: 'none' }}>Cancel</Button>
          <Button 
            type="submit" 
            variant="contained" 
            disabled={loading}
            sx={{ 
              borderRadius: '12px', 
              bgcolor: '#10B981', 
              color: 'white',
              '&:hover': { bgcolor: alpha('#10B981', 0.8) },
              textTransform: 'none'
            }}
          >
            {loading ? <CircularProgress size={20} color="inherit" /> : 'Publish'}
          </Button>
        </DialogActions>
      </form>
    </Dialog>
  );
}

import { DialogActions } from '@/lib/mui-tailwind/material';

export default function ProjectAddObjectModal({ open, onClose, projectId, onAdded, initialTab = 0 }: ProjectAddObjectModalProps) {
  const theme = useTheme();
  const { showSuccess, showError } = useToast();
  const { fetchOptimized } = useDataNexus();
  const { user } = useAuth();
  const { openOverlay, closeOverlay } = useOverlay();
  const { open: openUnified } = useUnifiedDrawer();
  const { setTaskDialogOpen } = useTask();
  const { notes: cachedNotes } = useNotes();

  const [tab, setTab] = useState(initialTab);
  const [query, setQuery] = useState('');
  const [loading, setLoading] = useState(false);
  const [results, setResults] = useState<any[]>([]);
  const [adding, setAdding] = useState<string | null>(null);
  const [isMomentDialogOpen, setIsMomentDialogOpen] = useState(false);

  useEffect(() => {
    if (open) {
      setTab(initialTab);
    }
  }, [open, initialTab]);

  const fetchResults = useCallback(async () => {
    if (!user?.$id) return;
    setLoading(true);
    try {
      const cacheKey = `integrate_${tab}_${user.$id}_${query.trim()}`;
      
      const res = await fetchOptimized(cacheKey, async () => {
        const queries = [Query.limit(50)];
        if (query.trim()) {
          queries.push(Query.search(tab === 0 ? 'title' : 'name', query));
        }

        switch (tab) {
          case 0: { // Note
            const filtered = (cachedNotes || []).filter((n: any) => {
              const matchesQuery = !query.trim() || 
                (n.title || '').toLowerCase().includes(query.toLowerCase()) ||
                (n.content || '').toLowerCase().includes(query.toLowerCase());
              if (!matchesQuery) return false;
              
              try {
                const meta = JSON.parse(n.metadata || '{}');
                return !(meta.isEncrypted === true || meta.isEncrypted === 'true' || n.isEncrypted === true);
              } catch {
                return !n.isEncrypted;
              }
            });
            return filtered;
          }
          case 1: { // Goal
            const taskRes = await listFlowTasks(queries);
            return taskRes.rows || [];
          }
          case 2: { // Secret
            if (query.trim()) {
              const secretsRes = await listKeepCredentials(queries);
              return secretsRes.rows || [];
            } else {
              const secretsRes = await EcosystemService.listSecrets(user.$id, true);
              return secretsRes.rows || [];
            }
          }
          case 3: { // Form
            const formRes = await FormsService.listUserForms(user.$id);
            const rows = formRes.rows || [];
            if (query.trim()) {
              return rows.filter((f: any) => 
                (f.title || '').toLowerCase().includes(query.toLowerCase()) ||
                (f.description || '').toLowerCase().includes(query.toLowerCase())
              );
            }
            return rows;
          }
          case 4: { // Event
            const eventRes = await EcosystemService.listEvents(user.$id, true);
            const rows = eventRes.rows || [];
            if (query.trim()) {
              return rows.filter((e: any) => 
                (e.title || '').toLowerCase().includes(query.toLowerCase()) ||
                (e.description || '').toLowerCase().includes(query.toLowerCase())
              );
            }
            return rows;
          }
          case 5: { // Tag
            const tagRes = await listTagsByUser(user.$id);
            const rows = tagRes.rows || [];
            if (query.trim()) {
              return rows.filter((t: any) => 
                (t.name || '').toLowerCase().includes(query.toLowerCase())
              );
            }
            return rows;
          }
          case 6: { // TOTP
            const totpRes = await EcosystemService.listTotpSecrets(user.$id, true);
            const rows = totpRes.rows || [];
            if (query.trim()) {
              return rows.filter((t: any) => 
                (t.issuer || t.accountName || '').toLowerCase().includes(query.toLowerCase())
              );
            }
            return rows;
          }
          case 7: { // Moment
            const momentRes = await SocialService.getFeed(undefined, user.$id);
            const rows = momentRes.rows || [];
            if (query.trim()) {
              return rows.filter((m: any) => 
                (m.caption || '').toLowerCase().includes(query.toLowerCase())
              );
            }
            return rows;
          }
          case 8: { // Call
            const callRes = await CallService.getCallHistory(user.$id, true);
            const rows = Array.isArray(callRes) ? callRes : [];
            if (query.trim()) {
              return rows.filter((c: any) => 
                (c.title || '').toLowerCase().includes(query.toLowerCase())
              );
            }
            return rows;
          }
          default:
            return [];
        }
      });

      setResults(res || []);
    } catch (err) {
      console.error('Search failed', err);
      setResults([]);
    } finally {
      setLoading(false);
    }
  }, [tab, query, user?.$id, fetchOptimized, cachedNotes]);

  useEffect(() => {
    if (open) fetchResults();
  }, [open, tab, query, fetchResults]);

  const handleAdd = async (entityId: string) => {
    setAdding(entityId);
    try {
      let kind = 'note';
      if (tab === 0) kind = 'note';
      else if (tab === 1) kind = 'goal';
      else if (tab === 2) kind = 'password';
      else if (tab === 3) kind = 'form';
      else if (tab === 4) kind = 'event';
      else if (tab === 5) kind = 'tag';
      else if (tab === 6) kind = 'totp';
      else if (tab === 7) kind = 'moment';
      else if (tab === 8) kind = 'call';

      await ProjectsService.addObjectToProject(projectId, kind, entityId);
      showSuccess('Added to project');
      onAdded();
      onClose();
    } catch (err: any) {
      showError('Failed to add object', err.message);
    } finally {
      setAdding(null);
    }
  };

  const handleCreateNew = () => {
    if (!user?.$id) return;
    
    switch (tab) {
      case 0: // Note
        openOverlay(
          <CreateNoteForm
            onNoteCreated={(newNote) => {
              handleAdd(newNote.$id);
              closeOverlay();
            }}
            noteKind="note"
          />
        );
        break;
      case 1: // Goal
        setTaskDialogOpen(true);
        onClose();
        break;
      case 2: // Secret
        openOverlay(
          <CredentialDialog
            open={true}
            onClose={closeOverlay}
            onSaved={() => {
              closeOverlay();
              fetchResults();
            }}
          />
        );
        break;
      case 3: // Form
        openOverlay(
          <FormDialog
            open={true}
            onClose={closeOverlay}
            onSaved={() => {
              closeOverlay();
              fetchResults();
            }}
          />
        );
        break;
      case 4: // Event
        openOverlay(
          <EventDialog
            open={true}
            onClose={closeOverlay}
            onSubmit={async (eventData) => {
              try {
                const calendarId = 'default';
                const visibility = eventData.visibility || 'public';
                const eventPermissions = permissions.forVisibility(visibility, user.$id);
                let meetingUrl = eventData.url || '';

                if (eventData.autoCreateCall) {
                  const call = await CallService.createCallLink(
                    user.$id,
                    'video',
                    undefined,
                    eventData.title,
                    eventData.startTime.toISOString(),
                    60
                  );
                  meetingUrl = `/connect/call/${call.$id}`;
                }

                const newDoc = await eventApi.create({
                  title: eventData.title,
                  description: eventData.description || '',
                  startTime: eventData.startTime.toISOString(),
                  endTime: eventData.endTime.toISOString(),
                  location: eventData.location || '',
                  meetingUrl: meetingUrl,
                  visibility: visibility,
                  status: 'confirmed',
                  coverImageId: eventData.coverImage || '',
                  maxAttendees: 0,
                  recurrenceRule: '',
                  calendarId: calendarId,
                  userId: user.$id,
                }, eventPermissions);

                showSuccess('Event created');
                await ProjectsService.addObjectToProject(projectId, 'event', newDoc.$id);
                closeOverlay();
                onAdded();
                onClose();
              } catch (err: any) {
                showError('Failed to create event', err.message);
              }
            }}
          />
        );
        break;
      case 5: // Tag
        onClose();
        openUnified('new-tag', { 
          onSuccess: () => {
            onAdded();
          } 
        });
        break;
      case 6: // TOTP
        openOverlay(
          <NewTotpDialog
            open={true}
            onClose={() => {
              closeOverlay();
              fetchResults();
            }}
          />
        );
        break;
      case 7: // Moment
        setIsMomentDialogOpen(true);
        break;
      case 8: // Call
        openOverlay(
          <CallActionModal
            open={true}
            onClose={() => {
              closeOverlay();
              fetchResults();
            }}
          />
        );
        break;
      default:
        break;
    }
  };

  const getTabLabel = () => {
    switch (tab) {
      case 0: return 'Note';
      case 1: return 'Goal';
      case 2: return 'Secret';
      case 3: return 'Form';
      case 4: return 'Event';
      case 5: return 'Tag';
      case 6: return 'TOTP';
      case 7: return 'Moment';
      case 8: return 'Call';
      default: return 'Object';
    }
  };

  return (
    <Drawer
      anchor="bottom"
      open={open}
      onClose={onClose}
      ModalProps={{ keepMounted: false, disablePortal: true }}
      sx={{
        zIndex: 1300,
        '& .MuiDrawer-paper': {
          height: '60dvh',
          maxHeight: '60dvh',
          borderTopLeftRadius: '28px',
          borderTopRightRadius: '28px',
          bgcolor: '#161412',
          borderTop: '1px solid rgba(255,255,255,0.06)',
          borderLeft: '1px solid rgba(255,255,255,0.06)',
          borderRight: '1px solid rgba(255,255,255,0.06)',
          backgroundImage: 'none',
          overflow: 'hidden',
          display: 'flex',
          flexDirection: 'column',
          maxWidth: '600px',
          mx: 'auto',
        }
      }}
    >
      <Box sx={{ p: 3, pb: 1, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <Typography variant="h6" sx={{ fontWeight: 900, color: '#fff', fontFamily: 'var(--font-satoshi)' }}>Integrate Object</Typography>
        <IconButton onClick={onClose} size="small" sx={{ color: 'rgba(255,255,255,0.4)' }}><X size={20} /></IconButton>
      </Box>
      
      <Box sx={{ borderBottom: 1, borderColor: 'rgba(255,255,255,0.06)' }}>
        <Tabs 
          value={tab} 
          onChange={(_, v) => setTab(v)} 
          variant="scrollable" 
          scrollButtons="auto"
          allowScrollButtonsMobile
          sx={{
            px: 1,
            '& .MuiTab-root': {
              minWidth: 'auto',
              px: 2,
              py: 1,
              fontSize: '0.8rem',
              textTransform: 'none',
              fontWeight: 700,
              color: 'rgba(255,255,255,0.4)',
              '&.Mui-selected': { color: theme.palette.primary.main }
            }
          }}
        >
            <Tab icon={<FileText size={14} />} iconPosition="start" label="Note" />
            <Tab icon={<CheckSquare size={14} />} iconPosition="start" label="Goal" />
            <Tab icon={<Lock size={14} />} iconPosition="start" label="Secret" />
            <Tab icon={<ClipboardList size={14} />} iconPosition="start" label="Form" />
            <Tab icon={<Calendar size={14} />} iconPosition="start" label="Event" />
            <Tab icon={<TagIcon size={14} />} iconPosition="start" label="Tag" />
            <Tab icon={<KeyRound size={14} />} iconPosition="start" label="TOTP" />
            <Tab icon={<Sparkles size={14} />} iconPosition="start" label="Moment" />
            <Tab icon={<PhoneCall size={14} />} iconPosition="start" label="Call" />
        </Tabs>
      </Box>

      <Stack direction="row" spacing={2} sx={{ p: 2, alignItems: 'center' }}>
        <TextField
            fullWidth
            size="small"
            placeholder={`Search existing ${getTabLabel().toLowerCase()}s...`}
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            InputProps={{
                startAdornment: <Search size={16} style={{ marginRight: '8px', opacity: 0.5 }} />,
                sx: { bgcolor: 'rgba(255,255,255,0.02)', borderRadius: '12px', color: '#fff' }
            }}
        />
        <Button
          variant="outlined"
          startIcon={<Plus size={16} />}
          onClick={handleCreateNew}
          sx={{
            borderRadius: '12px',
            textTransform: 'none',
            fontWeight: 800,
            whiteSpace: 'nowrap',
            borderColor: 'rgba(255,255,255,0.1)',
            color: 'white',
            '&:hover': {
              borderColor: theme.palette.primary.main,
              bgcolor: 'rgba(255,255,255,0.02)',
            }
          }}
        >
          Create New
        </Button>
      </Stack>

      <Box sx={{ flex: 1, overflowY: 'auto' }}>
        {loading ? (
            <Box sx={{ display: 'grid', placeItems: 'center', py: 4 }}><CircularProgress size={20} /></Box>
        ) : results.length === 0 ? (
            <Typography variant="caption" sx={{ display: 'block', textAlign: 'center', py: 6, color: 'rgba(255,255,255,0.3)', fontStyle: 'italic' }}>No resources found matching your query.</Typography>
        ) : (
            <List sx={{ py: 0 }}>
                {results.map((item) => (
                    <ListItem key={item.$id} disablePadding>
                        <ListItemButton 
                            onClick={() => handleAdd(item.$id)}
                            disabled={!!adding}
                            sx={{ px: 3, py: 1.5, borderBottom: '1px solid rgba(255,255,255,0.02)' }}
                        >
                            <ListItemText 
                                primary={item.title || item.name || item.issuer || item.caption || 'System Object'} 
                                primaryTypographyProps={{ sx: { fontWeight: 700, fontSize: '0.9rem', color: '#fff' } }}
                                secondary={item.summary || item.username || item.description || item.accountName || 'System Object'}
                                secondaryTypographyProps={{ sx: { fontSize: '0.75rem', opacity: 0.5 } }}
                            />
                            {adding === item.$id ? <CircularProgress size={16} /> : <Plus size={16} color={theme.palette.primary.main} />}
                        </ListItemButton>
                    </ListItem>
                ))}
            </List>
        )}
      </Box>

      {isMomentDialogOpen && (
        <CreateMomentDialog
          open={isMomentDialogOpen}
          onClose={() => setIsMomentDialogOpen(false)}
          onSaved={() => {
            fetchResults();
          }}
          userId={user?.$id || ''}
          showSuccess={showSuccess}
          showError={showError}
        />
      )}
    </Drawer>
  );
}
