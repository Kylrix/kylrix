'use client';

import React, { useState, useEffect, useCallback } from 'react';
import {
  Dialog,
  DialogTitle,
  DialogContent,
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
  Button,
  Stack,
} from '@/lib/mui-tailwind/material';
import { X, Search, Plus, FolderKanban } from 'lucide-react';
import { ProjectsService } from '@/lib/appwrite/projects';
import { useToast } from '@/components/ui/Toast';
import { useUnifiedDrawer } from '@/context/UnifiedDrawerContext';

interface ProjectAddSubProjectModalProps {
  open: boolean;
  onClose: () => void;
  projectId: string;
  onAdded: () => void;
}

export default function ProjectAddSubProjectModal({
  open,
  onClose,
  projectId,
  onAdded,
}: ProjectAddSubProjectModalProps) {
  const theme = useTheme();
  const { showSuccess, showError } = useToast();
  const { open: openUnified } = useUnifiedDrawer();
  
  const [query, setQuery] = useState('');
  const [loading, setLoading] = useState(false);
  const [projects, setProjects] = useState<any[]>([]);
  const [linking, setLinking] = useState<string | null>(null);

  const fetchProjects = useCallback(async () => {
    setLoading(true);
    try {
      const res = await ProjectsService.listProjects();
      // Filter out the current project (cannot link to itself)
      const filtered = (res.rows || []).filter((p: any) => p.$id !== projectId);
      setProjects(filtered);
    } catch (err) {
      console.error('Failed to load projects for sub-project picker', err);
      setProjects([]);
    } finally {
      setLoading(false);
    }
  }, [projectId]);

  useEffect(() => {
    if (open) fetchProjects();
  }, [open, fetchProjects]);

  const handleLink = async (childProjectId: string) => {
    setLinking(childProjectId);
    try {
      await ProjectsService.addObjectToProject(projectId, 'project', childProjectId);
      showSuccess('Sub-project linked successfully!');
      onAdded();
      onClose();
    } catch (err: any) {
      showError('Link failed', err.message || 'An error occurred.');
    } finally {
      setLinking(null);
    }
  };

  const handleCreateNew = () => {
    onClose();
    openUnified('new-project', {
      onCreated: async (newProj: any) => {
        try {
          await ProjectsService.addObjectToProject(projectId, 'project', newProj.$id);
          showSuccess('New sub-project created and linked!');
          onAdded();
        } catch (err: any) {
          showError('Failed to automatically link new sub-project', err.message);
        }
      },
    });
  };

  const filteredProjects = projects.filter((p) =>
    p.title?.toLowerCase().includes(query.toLowerCase()) ||
    p.name?.toLowerCase().includes(query.toLowerCase())
  );

  return (
    <Dialog
      open={open}
      onClose={onClose}
      fullWidth
      maxWidth="sm"
      keepMounted={false}
      disablePortal={true}
      PaperProps={{
        sx: {
          bgcolor: '#161412',
          border: '1px solid rgba(255,255,255,0.06)',
          borderRadius: '28px',
          backgroundImage: 'none',
          overflow: 'hidden',
        },
      }}
    >
      <DialogTitle sx={{ p: 3, pb: 1, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <Typography variant="h6" sx={{ fontWeight: 900 }}>
          Integrate Sub-Project
        </Typography>
        <IconButton onClick={onClose} size="small" sx={{ color: 'rgba(255,255,255,0.4)' }}>
          <X size={20} />
        </IconButton>
      </DialogTitle>

      <Box sx={{ p: 2, display: 'flex', gap: 1.5 }}>
        <TextField
          fullWidth
          size="small"
          placeholder="Search existing projects..."
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          InputProps={{
            startAdornment: <Search size={16} style={{ marginRight: '8px', opacity: 0.5 }} />,
            sx: { bgcolor: 'rgba(255,255,255,0.02)', borderRadius: '12px' },
          }}
        />
        <Button
          variant="contained"
          onClick={handleCreateNew}
          startIcon={<Plus size={16} />}
          sx={{
            flexShrink: 0,
            borderRadius: '12px',
            bgcolor: theme.palette.primary.main,
            color: '#fff',
            px: 2.5,
            fontWeight: 800,
            textTransform: 'none',
            fontSize: '0.8rem',
            boxShadow: 'none',
            '&:hover': { bgcolor: theme.palette.primary.dark, boxShadow: 'none' },
          }}
        >
          New Project
        </Button>
      </Box>

      <DialogContent sx={{ p: 0, maxHeight: 350, borderTop: '1px solid rgba(255,255,255,0.06)' }}>
        {loading ? (
          <Box sx={{ display: 'grid', placeItems: 'center', py: 6 }}>
            <CircularProgress size={20} />
          </Box>
        ) : filteredProjects.length === 0 ? (
          <Typography
            variant="caption"
            sx={{
              display: 'block',
              textAlign: 'center',
              py: 8,
              color: 'rgba(255,255,255,0.3)',
              fontStyle: 'italic',
            }}
          >
            {projects.length === 0 ? 'No other active projects found.' : 'No matching projects found.'}
          </Typography>
        ) : (
          <List sx={{ py: 0 }}>
            {filteredProjects.map((item) => (
              <ListItem key={item.$id} disablePadding>
                <ListItemButton
                  onClick={() => handleLink(item.$id)}
                  disabled={!!linking}
                  sx={{ px: 3, py: 2, borderBottom: '1px solid rgba(255,255,255,0.02)' }}
                >
                  <ListItemIcon sx={{ minWidth: 36, color: theme.palette.primary.main }}>
                    <FolderKanban size={18} />
                  </ListItemIcon>
                  <ListItemText
                    primary={item.title || item.name}
                    primaryTypographyProps={{ sx: { fontWeight: 700, fontSize: '0.9rem', color: '#fff' } }}
                    secondary={item.summary || 'Private Container'}
                    secondaryTypographyProps={{ sx: { fontSize: '0.75rem', opacity: 0.5 } }}
                  />
                  {linking === item.$id ? (
                    <CircularProgress size={16} />
                  ) : (
                    <Plus size={16} color={theme.palette.primary.main} />
                  )}
                </ListItemButton>
              </ListItem>
            ))}
          </List>
        )}
      </DialogContent>
    </Dialog>
  );
}
