'use client';

import React, { useEffect, useState, useCallback, useMemo } from 'react';
import { useRouter, useParams } from 'next/navigation';
import {
  Box,
  IconButton,
  Button,
  Chip,
  Grid,
  Paper,
  Stack,
  Typography,
  CircularProgress,
  alpha,
  useTheme,
  Tabs,
  Tab,
  Divider,
} from '@mui/material';
import {
  Plus,
  FolderKanban,
  FileText,
  CheckSquare,
  Lock,
  MessageCircle,
  Sparkles,
  ArrowLeft,
  LayoutGrid,
  List as ListIcon,
  Trash2,
  ExternalLink,
  Search,
} from 'lucide-react';
import { ProjectsService } from '@/lib/appwrite/projects';
import { useToast } from '@/components/ui/Toast';
import { Projects, ProjectObjects, Notes, Tasks, Credentials } from '@/types/appwrite';
import { listNotes, listFlowTasks, listKeepCredentials, Query } from '@/lib/appwrite';

interface TabPanelProps {
  children?: React.ReactNode;
  index: number;
  value: number;
}

function CustomTabPanel(props: TabPanelProps) {
  const { children, value, index, ...other } = props;
  return (
    <div
      role="tabpanel"
      hidden={value !== index}
      {...other}
    >
      {value === index && (
        <Box sx={{ py: 3 }}>
          {children}
        </Box>
      )}
    </div>
  );
}

export default function ProjectDetailPage() {
  const theme = useTheme();
  const router = useRouter();
  const { projectId } = useParams();
  const { showSuccess, showError } = useToast();

  const [project, setProject] = useState<Projects | null>(null);
  const [projectObjects, setProjectObjects] = useState<ProjectObjects[]>([]);
  const [loading, setLoading] = useState(true);
  const [tabValue, setTabValue] = useState(0);

  // Resolved entities
  const [notes, setNotes] = useState<Notes[]>([]);
  const [tasks, setTasks] = useState<Tasks[]>([]);
  const [credentials, setCredentials] = useState<Credentials[]>([]);
  const [resolving, setResolving] = useState(false);

  const fetchProjectData = useCallback(async () => {
    if (!projectId) return;
    setLoading(true);
    try {
      const p = await ProjectsService.getProject(projectId as string);
      setProject(p);
      const objects = await ProjectsService.listProjectObjects(projectId as string);
      setProjectObjects(objects.documents);
      
      // Resolve entities
      await resolveEntities(objects.documents);
    } catch (err: any) {
      showError('Failed to load project', err.message);
    } finally {
      setLoading(false);
    }
  }, [projectId, showError]);

  const resolveEntities = async (objects: ProjectObjects[]) => {
    setResolving(true);
    try {
      const noteIds = objects.filter(o => o.entityKind === 'note').map(o => o.entityId);
      const taskIds = objects.filter(o => o.entityKind === 'goal' || o.entityKind === 'task').map(o => o.entityId);
      const credentialIds = objects.filter(o => o.entityKind === 'password' || o.entityKind === 'credential').map(o => o.entityId);

      if (noteIds.length) {
          const res = await listNotes([Query.equal('$id', noteIds)]);
          setNotes(res.documents);
      } else setNotes([]);

      if (taskIds.length) {
          const res = await listFlowTasks([Query.equal('$id', taskIds)]);
          setTasks(res.documents);
      } else setTasks([]);

      if (credentialIds.length) {
          const res = await listKeepCredentials([Query.equal('$id', credentialIds)]);
          setCredentials(res.documents);
      } else setCredentials([]);

    } catch (err) {
      console.error('Failed to resolve entities', err);
    } finally {
      setResolving(false);
    }
  };

  useEffect(() => {
    fetchProjectData();
  }, [fetchProjectData]);

  const handleRemoveObject = async (entityId: string) => {
      const obj = projectObjects.find(o => o.entityId === entityId);
      if (!obj) return;

      try {
          await ProjectsService.removeObjectFromProject(obj.$id);
          showSuccess('Item unlinked');
          setProjectObjects(prev => prev.filter(o => o.$id !== obj.$id));
          setNotes(prev => prev.filter(n => n.$id !== entityId));
          setTasks(prev => prev.filter(t => t.$id !== entityId));
          setCredentials(prev => prev.filter(c => c.$id !== entityId));
      } catch (err: any) {
          showError('Failed to unlink item', err.message);
      }
  };

  if (loading) {
    return (
      <Box sx={{ display: 'grid', placeItems: 'center', minHeight: '80vh' }}>
        <CircularProgress sx={{ color: '#6366F1' }} />
      </Box>
    );
  }

  if (!project) {
    return (
      <Box sx={{ textAlign: 'center', py: 10 }}>
        <Typography variant="h5" sx={{ color: '#fff', fontWeight: 900 }}>
          Project not found
        </Typography>
        <Button onClick={() => router.push('/projects')} sx={{ mt: 2, color: '#6366F1' }}>
          Back to projects
        </Button>
      </Box>
    );
  }

  return (
    <Box sx={{ maxWidth: 1240, mx: 'auto', px: { xs: 2, md: 3 }, pb: { xs: 10, md: 6 } }}>
      <Stack direction="row" alignItems="center" spacing={1.5} sx={{ mb: 4 }}>
        <IconButton
          onClick={() => router.push('/projects')}
          sx={{
            bgcolor: '#161412',
            color: '#fff',
            border: '1px solid rgba(255,255,255,0.06)',
            '&:hover': { bgcolor: '#1C1A18' },
          }}
        >
          <ArrowLeft size={18} />
        </IconButton>
        <Box>
          <Typography sx={{ color: '#fff', fontWeight: 900, fontSize: '1.5rem', lineHeight: 1.1 }}>
            {project.title}
          </Typography>
          <Stack direction="row" spacing={1} alignItems="center">
              <Chip 
                label={project.visibility} 
                size="small" 
                sx={{ bgcolor: 'rgba(255,255,255,0.05)', color: 'rgba(255,255,255,0.5)', height: 20, fontSize: '0.65rem', fontWeight: 800, textTransform: 'uppercase' }} 
              />
              <Typography sx={{ color: 'rgba(255,255,255,0.4)', fontSize: '0.8rem', fontWeight: 600 }}>
                {projectObjects.length} linked resources
              </Typography>
          </Stack>
        </Box>
      </Stack>

      <Grid container spacing={3}>
        <Grid item xs={12} md={8}>
          <Paper
            elevation={0}
            sx={{
              bgcolor: '#161412',
              border: '1px solid rgba(255,255,255,0.06)',
              borderRadius: '32px',
              overflow: 'hidden',
              backgroundImage: 'none',
            }}
          >
            <Box sx={{ borderBottom: 1, borderColor: 'rgba(255,255,255,0.06)', px: 2 }}>
              <Tabs 
                value={tabValue} 
                onChange={(_, v) => setTabValue(v)}
                sx={{
                    '& .MuiTab-root': {
                        color: 'rgba(255,255,255,0.4)',
                        fontWeight: 800,
                        textTransform: 'none',
                        minHeight: 64,
                        '&.Mui-selected': { color: '#6366F1' }
                    },
                    '& .MuiTabs-indicator': { bgcolor: '#6366F1', height: 3, borderRadius: '3px 3px 0 0' }
                }}
              >
                <Tab label="Notes" icon={<FileText size={16} />} iconPosition="start" />
                <Tab label="Goals" icon={<CheckSquare size={16} />} iconPosition="start" />
                <Tab label="Vault" icon={<Lock size={16} />} iconPosition="start" />
              </Tabs>
            </Box>

            <Box sx={{ p: 3 }}>
              <CustomTabPanel value={tabValue} index={0}>
                {resolving ? <CircularProgress size={20} /> : notes.length === 0 ? (
                    <Typography sx={{ color: 'rgba(255,255,255,0.3)', fontStyle: 'italic' }}>No notes linked to this project.</Typography>
                ) : (
                    <Stack spacing={2}>
                        {notes.map(note => (
                            <ResourceItem 
                                key={note.$id} 
                                title={note.title || 'Untitled Note'} 
                                kind="note"
                                onOpen={() => router.push(`/note/notes/${note.$id}`)}
                                onUnlink={() => handleRemoveObject(note.$id)}
                            />
                        ))}
                    </Stack>
                )}
              </CustomTabPanel>
              
              <CustomTabPanel value={tabValue} index={1}>
                {resolving ? <CircularProgress size={20} /> : tasks.length === 0 ? (
                    <Typography sx={{ color: 'rgba(255,255,255,0.3)', fontStyle: 'italic' }}>No goals linked to this project.</Typography>
                ) : (
                    <Stack spacing={2}>
                        {tasks.map(task => (
                            <ResourceItem 
                                key={task.$id} 
                                title={task.title} 
                                kind="goal"
                                onOpen={() => router.push(`/flow?taskId=${task.$id}`)}
                                onUnlink={() => handleRemoveObject(task.$id)}
                            />
                        ))}
                    </Stack>
                )}
              </CustomTabPanel>

              <CustomTabPanel value={tabValue} index={2}>
                {resolving ? <CircularProgress size={20} /> : credentials.length === 0 ? (
                    <Typography sx={{ color: 'rgba(255,255,255,0.3)', fontStyle: 'italic' }}>No vault items linked to this project.</Typography>
                ) : (
                    <Stack spacing={2}>
                        {credentials.map(cred => (
                            <ResourceItem 
                                key={cred.$id} 
                                title={cred.name} 
                                kind="password"
                                onOpen={() => router.push(`/vault?id=${cred.$id}`)}
                                onUnlink={() => handleRemoveObject(cred.$id)}
                            />
                        ))}
                    </Stack>
                )}
              </CustomTabPanel>
            </Box>
          </Paper>
        </Grid>

        <Grid item xs={12} md={4}>
          <Stack spacing={3}>
            <Paper
                elevation={0}
                sx={{
                    bgcolor: '#161412',
                    border: '1px solid rgba(255,255,255,0.06)',
                    borderRadius: '28px',
                    p: 3,
                    backgroundImage: 'none',
                }}
            >
                <Typography sx={{ color: '#fff', fontWeight: 900, mb: 1.5, fontSize: '1.1rem' }}>Project Summary</Typography>
                <Typography sx={{ color: 'rgba(255,255,255,0.6)', fontSize: '0.9rem', lineHeight: 1.6 }}>
                    {project.summary || 'No summary provided for this project hub.'}
                </Typography>
                
                <Box sx={{ mt: 3, pt: 3, borderTop: '1px solid rgba(255,255,255,0.06)' }}>
                    <Typography variant="caption" sx={{ color: 'rgba(255,255,255,0.3)', display: 'block', mb: 1 }}>Status</Typography>
                    <Chip 
                        label={project.status} 
                        size="small" 
                        sx={{ bgcolor: alpha('#10B981', 0.1), color: '#10B981', fontWeight: 800, borderRadius: '8px' }} 
                    />
                </Box>
            </Paper>

            <Paper
                elevation={0}
                sx={{
                    bgcolor: '#161412',
                    border: '1px solid rgba(255,255,255,0.06)',
                    borderRadius: '28px',
                    p: 3,
                    backgroundImage: 'none',
                }}
            >
                <Typography sx={{ color: '#fff', fontWeight: 900, mb: 2, fontSize: '1.1rem' }}>Quick Actions</Typography>
                <Stack spacing={1.5}>
                    <ActionButton icon={<Plus size={16} />} label="Add Note" color="#EC4899" onClick={() => router.push('/note/notes')} />
                    <ActionButton icon={<Plus size={16} />} label="Add Goal" color="#A855F7" onClick={() => router.push('/flow')} />
                    <ActionButton icon={<Plus size={16} />} label="Add Secret" color="#10B981" onClick={() => router.push('/vault/dashboard')} />
                </Stack>
            </Paper>
          </Stack>
        </Grid>
      </Grid>
    </Box>
  );
}

function ResourceItem({ title, kind, onOpen, onUnlink }: { title: string, kind: string, onOpen: () => void, onUnlink: () => void }) {
    const theme = useTheme();
    const icon = kind === 'note' ? <FileText size={18} /> : kind === 'goal' ? <CheckSquare size={18} /> : <Lock size={18} />;
    const accent = kind === 'note' ? '#EC4899' : kind === 'goal' ? '#A855F7' : '#10B981';

    return (
        <Paper
            elevation={0}
            sx={{
                bgcolor: 'rgba(255,255,255,0.02)',
                border: '1px solid rgba(255,255,255,0.04)',
                borderRadius: '16px',
                p: 2,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                backgroundImage: 'none',
                '&:hover': { bgcolor: 'rgba(255,255,255,0.04)', borderColor: 'rgba(255,255,255,0.08)' }
            }}
        >
            <Stack direction="row" spacing={2} alignItems="center">
                <Box sx={{ color: accent, display: 'grid', placeItems: 'center' }}>
                    {icon}
                </Box>
                <Typography sx={{ color: '#fff', fontWeight: 700, fontSize: '0.95rem' }}>{title}</Typography>
            </Stack>
            <Stack direction="row" spacing={0.5}>
                <IconButton size="small" onClick={onOpen} sx={{ color: 'rgba(255,255,255,0.4)', '&:hover': { color: '#fff' } }}>
                    <ExternalLink size={16} />
                </IconButton>
                <IconButton size="small" onClick={onUnlink} sx={{ color: 'rgba(255,255,255,0.2)', '&:hover': { color: '#FF453A' } }}>
                    <Trash2 size={16} />
                </IconButton>
            </Stack>
        </Paper>
    );
}

function ActionButton({ icon, label, color, onClick }: { icon: React.ReactNode, label: string, color: string, onClick: () => void }) {
    return (
        <Button
            fullWidth
            variant="outlined"
            startIcon={icon}
            onClick={onClick}
            sx={{
                justifyContent: 'flex-start',
                borderRadius: '12px',
                textTransform: 'none',
                fontWeight: 700,
                color: 'rgba(255,255,255,0.8)',
                borderColor: 'rgba(255,255,255,0.06)',
                '&:hover': {
                    borderColor: alpha(color, 0.4),
                    bgcolor: alpha(color, 0.05),
                    color: '#fff'
                }
            }}
        >
            {label}
        </Button>
    );
}
