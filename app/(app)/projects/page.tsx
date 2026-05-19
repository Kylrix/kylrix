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
} from 'lucide-react';
import ProjectsActionFab from '@/components/projects/ProjectsActionFab';
import ProjectCard from '@/components/projects/ProjectCard';
import CreateProjectModal from '@/components/projects/CreateProjectModal';
import { ProjectsService } from '@/lib/appwrite/projects';
import { useToast } from '@/components/ui/Toast';
import { Projects } from '@/types/appwrite';

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
    if (!confirm('Are you sure you want to delete this project? All linked objects will be unlinked.')) return;
    try {
      await ProjectsService.deleteProject(projectId);
      showSuccess('Project deleted');
      setProjects(prev => prev.filter(p => p.$id !== projectId));
    } catch (err: any) {
      showError('Delete failed', err.message);
    }
  };

  const handleProjectClick = (projectId: string) => {
    router.push(`/projects/${projectId}`);
  };

  return (
    <Box sx={{ maxWidth: 1240, mx: 'auto', px: { xs: 2, md: 3 }, pb: { xs: 10, md: 6 } }}>
      <Stack direction="row" alignItems="center" justifyContent="space-between" sx={{ mb: 4 }}>
        <Stack direction="row" alignItems="center" spacing={1.5}>
          <IconButton
            onClick={() => router.back()}
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
              Projects
            </Typography>
            <Typography sx={{ color: 'rgba(255,255,255,0.4)', fontSize: '0.8rem', fontWeight: 600 }}>
              Manage your ecosystem hubs
            </Typography>
          </Box>
        </Stack>
        
        <Button
          variant="contained"
          startIcon={<Plus size={18} />}
          onClick={() => setIsCreateModalOpen(true)}
          sx={{
            bgcolor: '#6366F1',
            color: '#fff',
            borderRadius: '14px',
            fontWeight: 800,
            textTransform: 'none',
            px: 3,
            boxShadow: '0 8px 24px rgba(99, 102, 241, 0.25)',
            '&:hover': { bgcolor: alpha('#6366F1', 0.8) }
          }}
        >
          New Project
        </Button>
      </Stack>

      {loading ? (
        <Box sx={{ display: 'grid', placeItems: 'center', py: 10 }}>
          <CircularProgress sx={{ color: '#6366F1' }} />
        </Box>
      ) : projects.length === 0 ? (
        <Paper
          elevation={0}
          sx={{
            bgcolor: '#161412',
            border: '1px dashed rgba(255,255,255,0.1)',
            borderRadius: '32px',
            p: 8,
            textAlign: 'center',
            backgroundImage: 'none',
          }}
        >
          <Box
            sx={{
              width: 80,
              height: 80,
              borderRadius: '24px',
              bgcolor: alpha('#6366F1', 0.05),
              color: '#6366F1',
              display: 'grid',
              placeItems: 'center',
              mx: 'auto',
              mb: 3
            }}
          >
            <FolderKanban size={40} />
          </Box>
          <Typography variant="h5" sx={{ color: '#fff', fontWeight: 900, mb: 1 }}>
            No projects found
          </Typography>
          <Typography sx={{ color: 'rgba(255,255,255,0.5)', mb: 4, maxWidth: 400, mx: 'auto' }}>
            Create your first project to organize your notes, tasks, and secrets into a unified ecosystem hub.
          </Typography>
          <Button
            variant="contained"
            onClick={() => setIsCreateModalOpen(true)}
            sx={{
              bgcolor: '#6366F1',
              color: '#fff',
              borderRadius: '12px',
              fontWeight: 800,
              px: 4,
            }}
          >
            Get Started
          </Button>
        </Paper>
      ) : (
        <Grid container spacing={3}>
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

      <CreateProjectModal 
        open={isCreateModalOpen} 
        onClose={() => setIsCreateModalOpen(false)}
        onCreated={(newProject) => setProjects(prev => [newProject, ...prev])}
      />
      
      <ProjectsActionFab />
    </Box>
  );
}
