'use client';

import React, { useEffect, useState, useCallback } from 'react';
import { useRouter } from 'next/navigation';
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
  Container,
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
  ArrowUpRight,
  Workflow,
  Globe,
  Users,
} from 'lucide-react';
import ProjectsActionFab from '@/components/projects/ProjectsActionFab';
import ProjectCard from '@/components/projects/ProjectCard';
import CreateProjectModal from '@/components/projects/CreateProjectModal';
import { ProjectsService } from '@/lib/appwrite/projects';
import { useToast } from '@/components/ui/Toast';
import { Projects } from '@/types/appwrite';

const workflows = [
    {
        title: 'Bridge Documentation',
        description: 'Link your specs and research notes directly to this hub.',
        icon: FileText,
        color: '#EC4899',
        action: 'Open Notes',
        href: '/note/notes'
    },
    {
        title: 'Centralize Flow',
        description: 'Attach roadmap goals and execution tasks for total visibility.',
        icon: CheckSquare,
        color: '#A855F7',
        action: 'Open Flow',
        href: '/flow'
    },
    {
        title: 'Fortify Access',
        description: 'Keep environment variables and API keys in the project vault.',
        icon: Lock,
        color: '#10B981',
        action: 'Open Vault',
        href: '/vault/dashboard'
    }
];

export default function ProjectsPage() {
  const theme = useTheme();
  const router = useRouter();
  const { showSuccess, showError } = useToast();
  
  const [projects, setProjects] = useState<Projects[]>([]);
  const [loading, setLoading] = useState(true);
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);

  const fetchProjects = useCallback(async () => {
    setLoading(true);
    try {
      const res = await ProjectsService.listProjects();
      setProjects(res.documents);
    } catch (err: any) {
      showError('Failed to load projects', err.message);
    } finally {
      setLoading(false);
    }
  }, [showError]);

  useEffect(() => {
    fetchProjects();
  }, [fetchProjects]);

  const handleDeleteProject = async (projectId: string) => {
    if (!confirm('Are you sure you want to delete this project hub? All links will be destroyed.')) return;
    try {
      await ProjectsService.deleteProject(projectId);
      showSuccess('Hub destroyed');
      setProjects(prev => prev.filter(p => p.$id !== projectId));
    } catch (err: any) {
      showError('Action failed', err.message);
    }
  };

  const handleProjectClick = (projectId: string) => {
    router.push(`/projects/${projectId}`);
  };

  return (
    <Box sx={{ minHeight: '100vh', bgcolor: '#0A0908', color: '#fff' }}>
      <Container maxWidth="xl" sx={{ pt: { xs: 4, md: 8 }, pb: 10 }}>
        {/* Header Section */}
        <Stack direction={{ xs: 'column', md: 'row' }} spacing={4} justifyContent="space-between" alignItems={{ xs: 'flex-start', md: 'flex-end' }} sx={{ mb: 8 }}>
            <Box>
                <Stack direction="row" spacing={1.5} alignItems="center" sx={{ mb: 1.5 }}>
                    <Box sx={{ px: 1.5, py: 0.5, borderRadius: '8px', bgcolor: alpha('#6366F1', 0.1), color: '#6366F1', border: '1px solid rgba(99, 102, 241, 0.2)' }}>
                        <Typography variant="caption" sx={{ fontWeight: 900, letterSpacing: '0.1em' }}>ECOSYSTEM V3</Typography>
                    </Box>
                </Stack>
                <Typography variant="h1" sx={{ fontWeight: 900, fontFamily: 'var(--font-clash)', fontSize: { xs: '2.5rem', md: '4.2rem' }, lineHeight: 1, letterSpacing: '-0.03em' }}>
                    Project Hubs
                </Typography>
                <Typography sx={{ mt: 2, color: 'rgba(255,255,255,0.4)', maxWidth: 500, fontSize: '1.1rem', fontWeight: 500 }}>
                    Unified abstraction layer for your notes, tasks, and credentials. The bedrock of your digital workspace.
                </Typography>
            </Box>

            <Button
                variant="contained"
                startIcon={<Plus size={20} />}
                onClick={() => setIsCreateModalOpen(true)}
                sx={{
                    bgcolor: '#6366F1',
                    color: '#000',
                    borderRadius: '16px',
                    fontWeight: 900,
                    textTransform: 'none',
                    px: 4,
                    py: 1.8,
                    fontSize: '1rem',
                    boxShadow: '0 20px 40px rgba(99, 102, 241, 0.25)',
                    '&:hover': { bgcolor: alpha('#6366F1', 0.9), transform: 'translateY(-2px)' },
                    transition: 'all 0.3s cubic-bezier(0.16, 1, 0.3, 1)'
                }}
            >
                Initialize New Hub
            </Button>
        </Stack>

        <Grid container spacing={4}>
            {/* Main Projects List */}
            <Grid item xs={12} lg={8}>
                <Typography variant="caption" sx={{ color: 'rgba(255,255,255,0.3)', fontWeight: 800, textTransform: 'uppercase', letterSpacing: '0.15em', mb: 3, display: 'block' }}>
                    Active Hubs ({projects.length})
                </Typography>
                
                {loading ? (
                    <Box sx={{ display: 'grid', placeItems: 'center', py: 10 }}>
                        <CircularProgress sx={{ color: '#6366F1' }} />
                    </Box>
                ) : projects.length === 0 ? (
                    <Paper
                        elevation={0}
                        sx={{
                            bgcolor: '#161412',
                            border: '1px dashed rgba(255,255,255,0.08)',
                            borderRadius: '32px',
                            p: 8,
                            textAlign: 'center',
                            backgroundImage: 'none',
                        }}
                    >
                        <Box sx={{ width: 80, height: 80, borderRadius: '24px', bgcolor: alpha('#6366F1', 0.05), color: '#6366F1', display: 'grid', placeItems: 'center', mx: 'auto', mb: 3 }}>
                            <FolderKanban size={40} />
                        </Box>
                        <Typography variant="h5" sx={{ color: '#fff', fontWeight: 900, mb: 1 }}>No hubs detected</Typography>
                        <Typography sx={{ color: 'rgba(255,255,255,0.5)', mb: 4, maxWidth: 360, mx: 'auto' }}>
                            Initialize your first project hub to start cross-linking your ecosystem objects.
                        </Typography>
                        <Button variant="outlined" onClick={() => setIsCreateModalOpen(true)} sx={{ borderRadius: '12px', borderColor: 'rgba(255,255,255,0.1)', color: '#fff', px: 4, fontWeight: 800 }}>Create First Hub</Button>
                    </Paper>
                ) : (
                    <Grid container spacing={2.5}>
                        {projects.map(project => (
                            <Grid item xs={12} sm={6} key={project.$id}>
                                <ProjectCard 
                                    project={project} 
                                    onClick={handleProjectClick}
                                    onDelete={handleDeleteProject}
                                />
                            </Grid>
                        ))}
                    </Grid>
                )}
            </Grid>

            {/* Sidebar / Workflows */}
            <Grid item xs={12} lg={4}>
                <Stack spacing={4}>
                    <Box>
                        <Typography variant="caption" sx={{ color: 'rgba(255,255,255,0.3)', fontWeight: 800, textTransform: 'uppercase', letterSpacing: '0.15em', mb: 3, display: 'block' }}>
                            Suggested Workflows
                        </Typography>
                        <Stack spacing={2}>
                            {workflows.map((wf) => (
                                <Paper
                                    key={wf.title}
                                    elevation={0}
                                    sx={{
                                        p: 2.5,
                                        borderRadius: '24px',
                                        bgcolor: '#161412',
                                        border: '1px solid rgba(255,255,255,0.06)',
                                        backgroundImage: 'none',
                                        cursor: 'pointer',
                                        transition: 'all 0.2s ease',
                                        '&:hover': { bgcolor: '#1C1A18', borderColor: alpha(wf.color, 0.2) }
                                    }}
                                    onClick={() => router.push(wf.href)}
                                >
                                    <Stack direction="row" spacing={2} alignItems="center">
                                        <Box sx={{ width: 42, height: 42, borderRadius: '12px', bgcolor: alpha(wf.color, 0.1), color: wf.color, display: 'grid', placeItems: 'center' }}>
                                            <wf.icon size={20} />
                                        </Box>
                                        <Box sx={{ flex: 1 }}>
                                            <Typography variant="body2" sx={{ fontWeight: 800, color: '#fff' }}>{wf.title}</Typography>
                                            <Typography variant="caption" sx={{ color: 'rgba(255,255,255,0.4)', display: 'block' }}>{wf.description}</Typography>
                                        </Box>
                                        <ArrowUpRight size={16} color="rgba(255,255,255,0.2)" />
                                    </Stack>
                                </Paper>
                            ))}
                        </Stack>
                    </Box>

                    <Paper
                        elevation={0}
                        sx={{
                            p: 4,
                            borderRadius: '32px',
                            bgcolor: alpha('#6366F1', 0.03),
                            border: '1px solid rgba(99, 102, 241, 0.1)',
                            backgroundImage: 'none',
                        }}
                    >
                        <Workflow size={28} color="#6366F1" style={{ marginBottom: '16px' }} />
                        <Typography variant="h6" sx={{ fontWeight: 900, mb: 1 }}>Ecosystem Power</Typography>
                        <Typography variant="body2" sx={{ color: 'rgba(255,255,255,0.5)', lineHeight: 1.6, mb: 3 }}>
                            Projects are more than folders. They are reactive contexts that bring your data to life. Link a Note to a Goal to see documentation while you work.
                        </Typography>
                        <Button 
                            fullWidth 
                            variant="text" 
                            onClick={() => router.push('/docs/projects')}
                            sx={{ color: '#6366F1', fontWeight: 800, justifyContent: 'flex-start', px: 0 }}
                        >
                            Learn about Hubs
                        </Button>
                    </Paper>
                </Stack>
            </Grid>
        </Grid>
      </Container>

      <CreateProjectModal 
        open={isCreateModalOpen} 
        onClose={() => setIsCreateModalOpen(false)}
        onCreated={(newProject) => setProjects(prev => [newProject, ...prev])}
      />
      
      <ProjectsActionFab />
    </Box>
  );
}
