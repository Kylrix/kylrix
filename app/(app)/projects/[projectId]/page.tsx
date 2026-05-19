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
  Avatar,
  AvatarGroup,
  Tooltip,
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
  Users,
  Settings as SettingsIcon,
  MoreHorizontal,
  PlusCircle,
  Workflow,
  History,
} from 'lucide-react';
import { ProjectsService } from '@/lib/appwrite/projects';
import { useToast } from '@/components/ui/Toast';
import { Projects, ProjectObjects, Notes, Tasks, Credentials, Users as UserType } from '@/types/appwrite';
import { listNotes, listFlowTasks, listKeepCredentials, Query, AppwriteService } from '@/lib/appwrite';
import { IdentityAvatar } from '@/components/common/IdentityBadge';
import { useUnifiedDrawer } from '@/context/UnifiedDrawerContext';
import ProjectAddObjectModal from '@/components/projects/ProjectAddObjectModal';

interface TabPanelProps {
  children?: React.ReactNode;
  index: number;
  value: number;
}

function CustomTabPanel(props: TabPanelProps) {
  const { children, value, index, ...other } = props;
  return (
    <div role="tabpanel" hidden={value !== index} {...other}>
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
  const { open: openUnified } = useUnifiedDrawer();

  const [project, setProject] = useState<Projects | null>(null);
  const [projectObjects, setProjectObjects] = useState<ProjectObjects[]>([]);
  const [loading, setLoading] = useState(true);
  const [tabValue, setTabValue] = useState(0);
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);

  // Resolved entities
  const [notes, setNotes] = useState<Notes[]>([]);
  const [tasks, setTasks] = useState<any[]>([]);
  const [credentials, setCredentials] = useState<Credentials[]>([]);
  const [collaborators, setCollaborators] = useState<any[]>([]);
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
      const collaboratorIds = objects.filter(o => o.entityKind === 'collaborator').map(o => o.entityId);

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

      if (collaboratorIds.length) {
          const res = await AppwriteService.getUsersByIds(collaboratorIds);
          setCollaborators(res);
      } else setCollaborators([]);

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
          setCollaborators(prev => prev.filter(u => u.$id !== entityId));
      } catch (err: any) {
          showError('Failed to unlink item', err.message);
      }
  };

  const handleAddCollaborator = () => {
      openUnified('share-note', {
          resourceId: projectId as string,
          resourceType: 'project',
          resourceTitle: project?.title || 'Project',
          onShared: (userId: string) => {
              ProjectsService.addCollaborator(projectId as string, userId);
              fetchProjectData();
          }
      });
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
    <Box sx={{ minHeight: '100vh', bgcolor: '#0A0908', color: '#fff' }}>
      <Box sx={{ maxWidth: 1440, mx: 'auto', px: { xs: 2, md: 4 }, pt: { xs: 2, md: 6 }, pb: 10 }}>
        
        {/* Modern Breadcrumb / Top Bar */}
        <Stack direction="row" alignItems="center" justifyContent="space-between" sx={{ mb: 6 }}>
            <Stack direction="row" alignItems="center" spacing={2.5}>
                <IconButton
                    onClick={() => router.push('/projects')}
                    sx={{
                        width: 44,
                        height: 44,
                        bgcolor: '#161412',
                        color: '#fff',
                        border: '1px solid rgba(255,255,255,0.06)',
                        '&:hover': { bgcolor: '#1C1A18', transform: 'translateX(-2px)' },
                        transition: 'all 0.2s ease'
                    }}
                >
                    <ArrowLeft size={20} />
                </IconButton>
                <Box>
                    <Stack direction="row" spacing={1.5} alignItems="center">
                        <Typography sx={{ color: '#fff', fontWeight: 900, fontSize: { xs: '1.25rem', md: '1.8rem' }, fontFamily: 'var(--font-clash)', letterSpacing: '-0.02em' }}>
                            {project.title}
                        </Typography>
                        <Chip 
                            label={project.status} 
                            size="small" 
                            sx={{ 
                                bgcolor: alpha(project.status === 'active' ? '#10B981' : '#F59E0B', 0.1), 
                                color: project.status === 'active' ? '#10B981' : '#F59E0B', 
                                fontWeight: 900, 
                                fontSize: '0.65rem', 
                                textTransform: 'uppercase',
                                height: 22,
                                border: `1px solid ${alpha(project.status === 'active' ? '#10B981' : '#F59E0B', 0.2)}`
                            }} 
                        />
                    </Stack>
                    <Typography sx={{ color: 'rgba(255,255,255,0.4)', fontSize: '0.85rem', fontWeight: 600 }}>
                        {projectObjects.length} linked ecosystem objects • {collaborators.length + 1} participants
                    </Typography>
                </Box>
            </Stack>

            <Stack direction="row" spacing={1.5}>
                <Button
                    variant="outlined"
                    startIcon={<SettingsIcon size={18} />}
                    sx={{
                        borderRadius: '14px',
                        borderColor: 'rgba(255,255,255,0.06)',
                        color: 'rgba(255,255,255,0.6)',
                        fontWeight: 800,
                        textTransform: 'none',
                        px: 2.5,
                        '&:hover': { borderColor: 'rgba(255,255,255,0.2)', bgcolor: alpha('#fff', 0.02) }
                    }}
                >
                    Settings
                </Button>
                <Button
                    variant="contained"
                    startIcon={<PlusCircle size={18} />}
                    onClick={() => setIsAddModalOpen(true)}
                    sx={{
                        borderRadius: '14px',
                        bgcolor: '#6366F1',
                        color: '#000',
                        fontWeight: 900,
                        textTransform: 'none',
                        px: 3,
                        boxShadow: '0 12px 24px rgba(99, 102, 241, 0.2)',
                        '&:hover': { bgcolor: alpha('#6366F1', 0.9) }
                    }}
                >
                    Integrate Object
                </Button>
            </Stack>
        </Stack>

        <Grid container spacing={4}>
            {/* Left Content Column */}
            <Grid item xs={12} lg={8.5}>
                <Paper
                    elevation={0}
                    sx={{
                        bgcolor: '#161412',
                        border: '1px solid rgba(255,255,255,0.06)',
                        borderRadius: '32px',
                        overflow: 'hidden',
                        backgroundImage: 'none',
                        boxShadow: '0 24px 48px rgba(0,0,0,0.5)'
                    }}
                >
                    <Box sx={{ borderBottom: 1, borderColor: 'rgba(255,255,255,0.06)', px: 3, pt: 1, bgcolor: alpha('#fff', 0.01) }}>
                        <Tabs 
                            value={tabValue} 
                            onChange={(_, v) => setTabValue(v)}
                            sx={{
                                '& .MuiTab-root': {
                                    color: 'rgba(255,255,255,0.4)',
                                    fontWeight: 900,
                                    textTransform: 'none',
                                    minHeight: 72,
                                    fontSize: '0.95rem',
                                    letterSpacing: '0.01em',
                                    mr: 4,
                                    '&.Mui-selected': { color: '#6366F1' }
                                },
                                '& .MuiTabs-indicator': { bgcolor: '#6366F1', height: 3, borderRadius: '3px 3px 0 0' }
                            }}
                        >
                            <Tab label="Integrated Notes" icon={<FileText size={18} />} iconPosition="start" />
                            <Tab label="Execution Goals" icon={<CheckSquare size={18} />} iconPosition="start" />
                            <Tab label="Vault Assets" icon={<Lock size={18} />} iconPosition="start" />
                        </Tabs>
                    </Box>

                    <Box sx={{ p: 4 }}>
                        <CustomTabPanel value={tabValue} index={0}>
                            {resolving ? <LoadingPlaceholder /> : notes.length === 0 ? <EmptyState kind="note" /> : (
                                <Grid container spacing={2}>
                                    {notes.map(note => (
                                        <Grid item xs={12} key={note.$id}>
                                            <ResourceItem 
                                                title={note.title || 'Untitled Note'} 
                                                kind="note"
                                                metadata={note.tags?.slice(0, 3).join(' • ') || 'No tags'}
                                                onOpen={() => router.push(`/note/notes/${note.$id}`)}
                                                onUnlink={() => handleRemoveObject(note.$id)}
                                            />
                                        </Grid>
                                    ))}
                                </Grid>
                            )}
                        </CustomTabPanel>
                        
                        <CustomTabPanel value={tabValue} index={1}>
                            {resolving ? <LoadingPlaceholder /> : tasks.length === 0 ? <EmptyState kind="goal" /> : (
                                <Grid container spacing={2}>
                                    {tasks.map(task => (
                                        <Grid item xs={12} key={task.$id}>
                                            <ResourceItem 
                                                title={task.title} 
                                                kind="goal"
                                                metadata={`${task.status.replace('-', ' ')} • ${task.priority}`}
                                                onOpen={() => router.push(`/flow?taskId=${task.$id}`)}
                                                onUnlink={() => handleRemoveObject(task.$id)}
                                            />
                                        </Grid>
                                    ))}
                                </Grid>
                            )}
                        </CustomTabPanel>

                        <CustomTabPanel value={tabValue} index={2}>
                            {resolving ? <LoadingPlaceholder /> : credentials.length === 0 ? <EmptyState kind="password" /> : (
                                <Grid container spacing={2}>
                                    {credentials.map(cred => (
                                        <Grid item xs={12} key={cred.$id}>
                                            <ResourceItem 
                                                title={cred.name} 
                                                kind="password"
                                                metadata={cred.username || 'Shared access'}
                                                onOpen={() => router.push(`/vault?id=${cred.$id}`)}
                                                onUnlink={() => handleRemoveObject(cred.$id)}
                                            />
                                        </Grid>
                                    ))}
                                </Grid>
                            )}
                        </CustomTabPanel>
                    </Box>
                </Paper>

                {/* Suggested Workflows Section */}
                <Box sx={{ mt: 6 }}>
                    <Typography variant="caption" sx={{ color: 'rgba(255,255,255,0.3)', fontWeight: 800, textTransform: 'uppercase', letterSpacing: '0.15em', mb: 3, display: 'block' }}>
                        Suggested Workflows
                    </Typography>
                    <Grid container spacing={2}>
                        {[
                            { title: 'Project Documentation', icon: FileText, color: '#EC4899', desc: 'Create a new note specific to this project.' },
                            { title: 'Sprint Planning', icon: CheckSquare, color: '#A855F7', desc: 'Initialize a goal to track execution.' },
                            { title: 'Access Hardening', icon: Lock, color: '#10B981', desc: 'Store new secrets for the team.' }
                        ].map(wf => (
                            <Grid item xs={12} md={4} key={wf.title}>
                                <Paper elevation={0} sx={{ p: 2.5, borderRadius: '24px', bgcolor: '#161412', border: '1px solid rgba(255,255,255,0.06)', transition: 'all 0.2s ease', cursor: 'pointer', '&:hover': { borderColor: alpha(wf.color, 0.3), transform: 'translateY(-2px)' } }}>
                                    <Stack direction="row" spacing={2} alignItems="center" sx={{ mb: 1.5 }}>
                                        <Box sx={{ color: wf.color }}><wf.icon size={18} /></Box>
                                        <Typography variant="body2" sx={{ fontWeight: 800 }}>{wf.title}</Typography>
                                    </Stack>
                                    <Typography variant="caption" sx={{ color: 'rgba(255,255,255,0.4)', lineHeight: 1.4 }}>{wf.desc}</Typography>
                                </Paper>
                            </Grid>
                        ))}
                    </Grid>
                </Box>
            </Grid>

            {/* Right Sidebar Column */}
            <Grid item xs={12} lg={3.5}>
                <Stack spacing={4}>
                    {/* Participants */}
                    <Paper
                        elevation={0}
                        sx={{
                            bgcolor: '#161412',
                            border: '1px solid rgba(255,255,255,0.06)',
                            borderRadius: '32px',
                            p: 3,
                            backgroundImage: 'none',
                        }}
                    >
                        <Stack direction="row" justifyContent="space-between" alignItems="center" sx={{ mb: 2.5 }}>
                            <Typography sx={{ color: '#fff', fontWeight: 900, fontSize: '1.1rem' }}>Participants</Typography>
                            <IconButton 
                                size="small" 
                                onClick={handleAddCollaborator}
                                sx={{ bgcolor: alpha('#6366F1', 0.1), color: '#6366F1', '&:hover': { bgcolor: alpha('#6366F1', 0.2) } }}
                            >
                                <Plus size={18} />
                            </IconButton>
                        </Stack>
                        
                        <Stack spacing={1.5}>
                            <Box sx={{ p: 1.5, borderRadius: '16px', bgcolor: alpha('#fff', 0.02), border: '1px solid rgba(255,255,255,0.04)', display: 'flex', alignItems: 'center', gap: 1.5 }}>
                                <IdentityAvatar size={34} src={undefined} fallback="O" verified={true} />
                                <Box sx={{ flex: 1 }}>
                                    <Typography variant="body2" sx={{ fontWeight: 800 }}>Project Owner</Typography>
                                    <Typography variant="caption" sx={{ color: 'rgba(255,255,255,0.4)', display: 'block' }}>Full Control</Typography>
                                </Box>
                                <Chip label="OWNER" size="small" sx={{ height: 18, fontSize: '0.6rem', fontWeight: 900, bgcolor: 'rgba(255,255,255,0.05)', color: 'rgba(255,255,255,0.5)' }} />
                            </Box>

                            {collaborators.map(user => (
                                <Box key={user.$id} sx={{ p: 1.5, borderRadius: '16px', bgcolor: alpha('#fff', 0.01), border: '1px solid rgba(255,255,255,0.03)', display: 'flex', alignItems: 'center', gap: 1.5 }}>
                                    <IdentityAvatar 
                                        size={34} 
                                        fileId={user.profilePicId} 
                                        alt={user.name} 
                                        fallback={user.name?.[0].toUpperCase() || 'U'} 
                                        verified={user.verified} 
                                    />
                                    <Box sx={{ flex: 1, minWidth: 0 }}>
                                        <Typography variant="body2" sx={{ fontWeight: 800, noWrap: true }}>{user.name || user.email}</Typography>
                                        <Typography variant="caption" sx={{ color: 'rgba(255,255,255,0.4)', display: 'block' }}>Collaborator</Typography>
                                    </Box>
                                    <IconButton size="small" onClick={() => handleRemoveObject(user.$id)} sx={{ opacity: 0.2, '&:hover': { opacity: 1, color: '#FF453A' } }}>
                                        <Trash2 size={14} />
                                    </IconButton>
                                </Box>
                            ))}
                        </Stack>
                    </Paper>

                    <Paper
                        elevation={0}
                        sx={{
                            bgcolor: '#161412',
                            border: '1px solid rgba(255,255,255,0.06)',
                            borderRadius: '32px',
                            p: 3.5,
                            backgroundImage: 'none',
                        }}
                    >
                        <Typography sx={{ color: '#fff', fontWeight: 900, mb: 1.5, fontSize: '1.1rem' }}>Project Insights</Typography>
                        <Typography sx={{ color: 'rgba(255,255,255,0.5)', fontSize: '0.9rem', lineHeight: 1.6, mb: 3 }}>
                            {project.summary || 'This project is used to group and coordinate your work.'}
                        </Typography>
                        
                        <Stack spacing={2}>
                            <Box sx={{ p: 2, borderRadius: '16px', bgcolor: alpha('#fff', 0.01), border: '1px solid rgba(255,255,255,0.03)' }}>
                                <Typography variant="caption" sx={{ color: 'rgba(255,255,255,0.3)', fontWeight: 800, textTransform: 'uppercase', display: 'block', mb: 1 }}>Visibility</Typography>
                                <Stack direction="row" spacing={1} alignItems="center" sx={{ color: '#6366F1' }}>
                                    <Globe size={14} />
                                    <Typography variant="body2" sx={{ fontWeight: 900, textTransform: 'capitalize' }}>{project.visibility}</Typography>
                                </Stack>
                            </Box>
                            <Box sx={{ p: 2, borderRadius: '16px', bgcolor: alpha('#fff', 0.01), border: '1px solid rgba(255,255,255,0.03)' }}>
                                <Typography variant="caption" sx={{ color: 'rgba(255,255,255,0.3)', fontWeight: 800, textTransform: 'uppercase', display: 'block', mb: 1 }}>Last Update</Typography>
                                <Stack direction="row" spacing={1} alignItems="center">
                                    <History size={14} color="rgba(255,255,255,0.4)" />
                                    <Typography variant="body2" sx={{ fontWeight: 900 }}>{new Date(project.updatedAt || '').toLocaleDateString()}</Typography>
                                </Stack>
                            </Box>
                        </Stack>
                    </Paper>
                </Stack>
            </Grid>
        </Grid>
      </Box>

      <ProjectAddObjectModal 
        open={isAddModalOpen} 
        onClose={() => setIsAddModalOpen(false)} 
        projectId={projectId as string} 
        onAdded={fetchProjectData} 
      />
    </Box>
  );
}

function LoadingPlaceholder() {
    return (
        <Box sx={{ display: 'grid', placeItems: 'center', py: 8 }}>
            <CircularProgress size={24} sx={{ color: '#6366F1' }} />
        </Box>
    );
}

function EmptyState({ kind }: { kind: string }) {
    const icon = kind === 'note' ? <FileText size={32} /> : kind === 'goal' ? <CheckSquare size={32} /> : <Lock size={32} />;
    return (
        <Box sx={{ textAlign: 'center', py: 6, opacity: 0.4 }}>
            <Box sx={{ mb: 2, display: 'flex', justifyContent: 'center' }}>{icon}</Box>
            <Typography variant="body2" sx={{ fontWeight: 700 }}>No {kind}s linked to this project yet.</Typography>
        </Box>
    );
}

function ResourceItem({ title, kind, metadata, onOpen, onUnlink }: { title: string, kind: string, metadata: string, onOpen: () => void, onUnlink: () => void }) {
    const icon = kind === 'note' ? <FileText size={20} /> : kind === 'goal' ? <CheckSquare size={20} /> : <Lock size={20} />;
    const accent = kind === 'note' ? '#EC4899' : kind === 'goal' ? '#A855F7' : '#10B981';

    return (
        <Paper
            elevation={0}
            sx={{
                bgcolor: 'rgba(255,255,255,0.02)',
                border: '1px solid rgba(255,255,255,0.04)',
                borderRadius: '20px',
                p: 2.5,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                backgroundImage: 'none',
                transition: 'all 0.2s ease',
                '&:hover': { 
                    bgcolor: 'rgba(255,255,255,0.03)', 
                    borderColor: alpha(accent, 0.2),
                    transform: 'translateY(-1px)'
                }
            }}
        >
            <Stack direction="row" spacing={2.5} alignItems="center" sx={{ minWidth: 0 }}>
                <Box sx={{ 
                    width: 44, 
                    height: 44, 
                    borderRadius: '12px', 
                    bgcolor: alpha(accent, 0.1), 
                    color: accent, 
                    display: 'grid', 
                    placeItems: 'center',
                    border: `1px solid ${alpha(accent, 0.2)}`
                }}>
                    {icon}
                </Box>
                <Box sx={{ minWidth: 0 }}>
                    <Typography sx={{ color: '#fff', fontWeight: 800, fontSize: '1rem', noWrap: true }}>{title}</Typography>
                    <Typography variant="caption" sx={{ color: 'rgba(255,255,255,0.4)', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.05em' }}>{metadata}</Typography>
                </Box>
            </Stack>
            <Stack direction="row" spacing={1}>
                <Button
                    size="small"
                    startIcon={<ExternalLink size={14} />}
                    onClick={onOpen}
                    sx={{ color: 'rgba(255,255,255,0.5)', fontWeight: 800, textTransform: 'none', '&:hover': { color: '#fff' } }}
                >
                    View
                </Button>
                <IconButton size="small" onClick={onUnlink} sx={{ color: 'rgba(255,255,255,0.1)', '&:hover': { color: '#FF453A', bgcolor: alpha('#FF453A', 0.05) } }}>
                    <Trash2 size={16} />
                </IconButton>
            </Stack>
        </Paper>
    );
}
