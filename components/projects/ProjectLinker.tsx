'use client';

import React, { useState, useEffect, useCallback } from 'react';
import {
  Drawer,
  Box,
  Typography,
  IconButton,
  List,
  ListItem,
  ListItemButton,
  ListItemIcon,
  ListItemText,
  CircularProgress,
  alpha,
  useTheme,
  Button,
} from '@mui/material';
import { 
  X, 
  FolderKanban, 
  Plus,
  Check,
} from 'lucide-react';
import { ProjectsService } from '@/lib/appwrite/projects';
import { useToast } from '@/components/ui/Toast';
import { Projects } from '@/types/appwrite';

interface ProjectLinkerProps {
  open: boolean;
  onClose: () => void;
  entityId: string;
  entityKind: 'note' | 'goal' | 'password';
  onLinked?: () => void;
}

export default function ProjectLinker({ open, onClose, entityId, entityKind, onLinked }: ProjectLinkerProps) {
  const theme = useTheme();
  const { showSuccess, showError } = useToast();
  
  const [projects, setProjects] = useState<Projects[]>([]);
  const [loading, setLoading] = useState(false);
  const [linking, setLinking] = useState<string | null>(null);

  const fetchProjects = useCallback(async () => {
    setLoading(true);
    try {
      const res = await ProjectsService.listProjects();
      setProjects(res.documents);
    } catch (err: any) {
      console.error('Failed to load projects', err);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (open) fetchProjects();
  }, [open, fetchProjects]);

  const handleLink = async (projectId: string) => {
    setLinking(projectId);
    try {
      await ProjectsService.addObjectToProject(projectId, entityKind, entityId);
      showSuccess('Linked to project');
      onLinked?.();
      onClose();
    } catch (err: any) {
      showError('Link failed', err.message);
    } finally {
      setLinking(null);
    }
  };

  return (
    <Drawer
      anchor="right"
      open={open}
      onClose={onClose}
      PaperProps={{
        sx: {
          width: { xs: '100%', sm: 400 },
          bgcolor: '#161412',
          borderLeft: '1px solid rgba(255,255,255,0.06)',
          backgroundImage: 'none',
        }
      }}
    >
      <Box sx={{ p: 3, height: '100%', display: 'flex', flexDirection: 'column' }}>
        <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 4 }}>
          <Box>
            <Typography variant="h6" sx={{ color: '#fff', fontWeight: 900 }}>Add to Project</Typography>
            <Typography variant="caption" sx={{ color: 'rgba(255,255,255,0.4)', fontWeight: 700 }}>Select a project for this {entityKind}</Typography>
          </Box>
          <IconButton onClick={onClose} sx={{ color: 'rgba(255,255,255,0.5)' }}>
            <X size={20} />
          </IconButton>
        </Box>

        {loading ? (
          <Box sx={{ display: 'grid', placeItems: 'center', flex: 1 }}>
            <CircularProgress size={24} sx={{ color: '#6366F1' }} />
          </Box>
        ) : projects.length === 0 ? (
          <Box sx={{ textAlign: 'center', py: 8 }}>
            <Typography sx={{ color: 'rgba(255,255,255,0.3)', mb: 3 }}>No projects found.</Typography>
            <Button 
                variant="outlined" 
                startIcon={<Plus size={16} />}
                sx={{ borderRadius: '12px', textTransform: 'none', fontWeight: 800 }}
                onClick={() => { /* Open create project? */ }}
            >
                Create Project
            </Button>
          </Box>
        ) : (
          <List sx={{ flex: 1, overflowY: 'auto' }}>
            {projects.map((project) => (
              <ListItem key={project.$id} disablePadding sx={{ mb: 1.5 }}>
                <ListItemButton
                  onClick={() => handleLink(project.$id)}
                  disabled={!!linking}
                  sx={{
                    borderRadius: '16px',
                    bgcolor: 'rgba(255,255,255,0.02)',
                    border: '1px solid rgba(255,255,255,0.04)',
                    transition: 'all 0.2s ease',
                    '&:hover': {
                        bgcolor: 'rgba(255,255,255,0.04)',
                        borderColor: alpha('#6366F1', 0.3)
                    }
                  }}
                >
                  <ListItemIcon sx={{ minWidth: 44 }}>
                    <Box sx={{ color: '#6366F1' }}>
                        <FolderKanban size={20} />
                    </Box>
                  </ListItemIcon>
                  <ListItemText 
                    primary={project.title}
                    primaryTypographyProps={{ sx: { color: '#fff', fontWeight: 700 } }}
                    secondary={project.visibility}
                    secondaryTypographyProps={{ sx: { color: 'rgba(255,255,255,0.4)', fontSize: '0.75rem', textTransform: 'uppercase', fontWeight: 800 } }}
                  />
                  {linking === project.$id ? (
                      <CircularProgress size={16} sx={{ color: '#6366F1' }} />
                  ) : (
                      <Plus size={16} color="rgba(255,255,255,0.3)" />
                  )}
                </ListItemButton>
              </ListItem>
            ))}
          </List>
        )}
      </Box>
    </Drawer>
  );
}
