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
  ArrowLeft,
  ArrowUpRight,
  Workflow,
  Sparkles,
} from 'lucide-react';
import { useFAB } from '@/context/FABContext';
import ProjectCard from '@/components/projects/ProjectCard';
import CreateProjectModal from '@/components/projects/CreateProjectModal';
import { ProjectsService } from '@/lib/appwrite/projects';
import { useToast } from '@/components/ui/Toast';
import { Projects } from '@/types/appwrite';

const suggestions = [
    {
        title: 'New Note',
        description: 'Jot down ideas or documentation.',
        icon: FileText,
        color: '#EC4899',
        href: '/note/notes'
    },
    {
        title: 'New Goal',
        description: 'Set a target for execution.',
        icon: CheckSquare,
        color: '#A855F7',
        href: '/flow'
    },
    {
        title: 'New Secret',
        description: 'Secure a password or key.',
        icon: Lock,
        color: '#10B981',
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

  const { setConfiguration, resetConfiguration } = useFAB();

  useEffect(() => {
    setConfiguration({
      isVisible: true,
      mainColor: '#6366F1',
      actions: [
        { id: 'create-project', label: 'CREATE PROJECT', icon: <Plus size={20} />, onClick: () => setIsCreateModalOpen(true) },
        { id: 'insights', label: 'AI INSIGHTS', icon: <Sparkles size={20} />, onClick: () => router.push('/note/notes') },
      ]
    });
    return () => resetConfiguration();
  }, [setConfiguration, resetConfiguration, router]);

  useEffect(() => {
    fetchProjects();
  }, [fetchProjects]);

  const handleDeleteProject = async (projectId: string) => {
    if (!confirm('Delete this project?')) return;
    try {
      await ProjectsService.deleteProject(projectId);
      showSuccess('Project deleted');
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
      <Container maxWidth="xl" sx={{ pt: { xs: 4, md: 6 }, pb: 10 }}>
        {/* Back Button */}
        <IconButton
          onClick={() => router.back()}
          sx={{
            mb: 3,
            bgcolor: '#161412',
            color: '#fff',
            border: '1px solid rgba(255,255,255,0.06)',
            '&:hover': { bgcolor: '#1C1A18' },
          }}
        >
          <ArrowLeft size={18} />
        </IconButton>

        {/* Header Section */}
        <Stack direction={{ xs: 'column', md: 'row' }} spacing={4} justifyContent="space-between" alignItems={{ xs: 'flex-start', md: 'flex-end' }} sx={{ mb: 4 }}>
            <Box>
                <Typography variant="h1" sx={{ fontWeight: 900, fontFamily: 'var(--font-clash)', fontSize: { xs: '2.5rem', md: '3.5rem' }, lineHeight: 1, letterSpacing: '-0.03em' }}>
                    Projects
                </Typography>
                <Typography sx={{ mt: 1.5, color: 'rgba(255,255,255,0.4)', maxWidth: 500, fontSize: '1rem', fontWeight: 500 }}>
                    Group your notes, tasks, and passwords into simple projects.
                </Typography>
            </Box>

            <Box sx={{ display: { xs: 'none', md: 'block' } }}>
                {/* Empty box to maintain layout if needed, but FAB handles creation now */}
            </Box>
        </Stack>

        {/* Quick Actions / Suggestions */}
        <Grid container spacing={2} sx={{ mb: 8 }}>
            {suggestions.map((s) => (
                <Grid item xs={12} sm={4} key={s.title}>
                    <Paper
                        elevation={0}
                        onClick={() => router.push(s.href)}
                        sx={{
                            p: 2.5,
                            borderRadius: '24px',
                            bgcolor: '#161412',
                            border: '1px solid rgba(255,255,255,0.06)',
                            cursor: 'pointer',
                            transition: 'all 0.2s ease',
                            '&:hover': { bgcolor: '#1C1A18', borderColor: alpha(s.color, 0.2) }
                        }}
                    >
                        <Stack direction="row" spacing={2} alignItems="center">
                            <Box sx={{ width: 40, height: 40, borderRadius: '12px', bgcolor: alpha(s.color, 0.1), color: s.color, display: 'grid', placeItems: 'center' }}>
                                <s.icon size={20} />
                            </Box>
                            <Box sx={{ flex: 1 }}>
                                <Typography variant="body2" sx={{ fontWeight: 800 }}>{s.title}</Typography>
                                <Typography variant="caption" sx={{ color: 'rgba(255,255,255,0.4)' }}>{s.description}</Typography>
                            </Box>
                            <ArrowUpRight size={16} color="rgba(255,255,255,0.2)" />
                        </Stack>
                    </Paper>
                </Grid>
            ))}
        </Grid>

        <Grid container spacing={4}>
            {/* Main Projects List */}
            <Grid item xs={12}>
                <Typography variant="caption" sx={{ color: 'rgba(255,255,255,0.3)', fontWeight: 800, textTransform: 'uppercase', letterSpacing: '0.15em', mb: 3, display: 'block' }}>
                    My Projects ({projects.length})
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
                        <Typography variant="h5" sx={{ color: '#fff', fontWeight: 900, mb: 1 }}>No projects yet</Typography>
                        <Typography sx={{ color: 'rgba(255,255,255,0.5)', mb: 4, maxWidth: 360, mx: 'auto' }}>
                            Start a project to keep your work organized in one place.
                        </Typography>
                        <Button variant="outlined" onClick={() => setIsCreateModalOpen(true)} sx={{ borderRadius: '12px', borderColor: 'rgba(255,255,255,0.1)', color: '#fff', px: 4, fontWeight: 800 }}>Create First Project</Button>
                    </Paper>
                ) : (
                    <Grid container spacing={2.5}>
                        {projects.map(project => (
                            <Grid item xs={12} sm={6} lg={4} key={project.$id}>
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
        </Grid>
      </Container>

      <CreateProjectModal 
        open={isCreateModalOpen} 
        onClose={() => setIsCreateModalOpen(false)}
        onCreated={(newProject) => setProjects(prev => [newProject, ...prev])}
      />
    </Box>
  );
}
