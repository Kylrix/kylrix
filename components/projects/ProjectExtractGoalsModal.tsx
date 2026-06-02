'use client';

import React, { useState, useEffect } from 'react';
import {
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Box,
  Typography,
  IconButton,
  List,
  ListItem,
  ListItemIcon,
  ListItemText,
  Checkbox,
  Button,
  CircularProgress,
  alpha,
  useTheme,
  Stack,
} from '@/lib/mui-tailwind/material';
import { X, Sparkles, AlertCircle } from 'lucide-react';
import { ID } from 'appwrite';
import { databases } from '@/lib/appwrite/client';
import { APPWRITE_CONFIG } from '@/lib/appwrite/config';
import { ProjectsService } from '@/lib/appwrite/projects';
import { useToast } from '@/components/ui/Toast';
import { useAuth } from '@/context/auth/AuthContext';

interface ProjectExtractGoalsModalProps {
  open: boolean;
  onClose: () => void;
  projectId: string;
  noteTitle: string;
  noteContent: string;
  onExtracted: () => void;
}

interface ParsedTask {
  id: string;
  title: string;
  selected: boolean;
}

export default function ProjectExtractGoalsModal({
  open,
  onClose,
  projectId,
  noteTitle,
  noteContent,
  onExtracted,
}: ProjectExtractGoalsModalProps) {
  const theme = useTheme();
  const { showSuccess, showError } = useToast();
  const { user } = useAuth();
  
  const [tasks, setTasks] = useState<ParsedTask[]>([]);
  const [extracting, setExtracting] = useState(false);

  // Parse unchecked markdown checkboxes (- [ ]) on mount or when content changes
  useEffect(() => {
    if (!noteContent) {
      setTasks([]);
      return;
    }

    const regex = /^\s*[-*]\s*\[\s*\]\s*(.+)$/gm;
    const found: ParsedTask[] = [];
    let match;

    while ((match = regex.exec(noteContent)) !== null) {
      const titleText = match[1].trim();
      if (titleText) {
        found.push({
          id: ID.unique(),
          title: titleText,
          selected: true, // Default to selected
        });
      }
    }
    setTasks(found);
  }, [noteContent]);

  const handleToggle = (id: string) => {
    setTasks((prev) =>
      prev.map((t) => (t.id === id ? { ...t, selected: !t.selected } : t))
    );
  };

  const handleSelectAll = () => {
    const allSelected = tasks.every((t) => t.selected);
    setTasks((prev) => prev.map((t) => ({ ...t, selected: !allSelected })));
  };

  const handleExtract = async () => {
    const selectedTasks = tasks.filter((t) => t.selected);
    if (selectedTasks.length === 0) {
      showError('Extract Action Failed', 'Please select at least one task to extract.');
      return;
    }

    setExtracting(true);
    try {
      const userId = user?.$id || 'system';
      const now = new Date().toISOString();

      for (const task of selectedTasks) {
        // 1. Create a Flow Task in WhisperrFlow DB
        const taskId = ID.unique();
        await (databases as any).createRow(
          APPWRITE_CONFIG.DATABASES.FLOW,
          APPWRITE_CONFIG.TABLES.FLOW.TASKS,
          taskId,
          {
            title: task.title,
            description: `Imported as standalone goal from project note: "${noteTitle}".`,
            status: 'todo',
            priority: 'medium',
            userId: userId,
            createdAt: now,
            updatedAt: now,
          }
        );

        // 2. Link this task as a "goal" to the parent project
        await ProjectsService.addObjectToProject(projectId, 'goal', taskId);
      }

      showSuccess(`Successfully extracted ${selectedTasks.length} goals!`);
      onExtracted();
      onClose();
    } catch (err: any) {
      console.error('Goal extraction failed', err);
      showError('Failed to extract goals', err.message || 'An error occurred.');
    } finally {
      setExtracting(false);
    }
  };

  return (
    <Dialog
      open={open}
      onClose={onClose}
      fullWidth
      maxWidth="sm"
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
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5 }}>
          <Box
            sx={{
              width: 32,
              height: 32,
              borderRadius: '8px',
              bgcolor: alpha(theme.palette.primary.main, 0.1),
              color: theme.palette.primary.main,
              display: 'grid',
              placeItems: 'center',
            }}
          >
            <Sparkles size={16} />
          </Box>
          <Typography variant="h6" sx={{ fontWeight: 900 }}>
            Extract Execution Goals
          </Typography>
        </Box>
        <IconButton onClick={onClose} size="small" sx={{ color: 'rgba(255,255,255,0.4)' }}>
          <X size={20} />
        </IconButton>
      </DialogTitle>

      <Box sx={{ px: 3, pb: 2 }}>
        <Typography variant="body2" sx={{ color: 'rgba(255,255,255,0.5)', fontWeight: 500 }}>
          Parsing unchecked markdown checklist items (`- [ ]`) from <strong style={{ color: '#fff' }}>{noteTitle}</strong>.
        </Typography>
      </Box>

      <DialogContent sx={{ p: 0, borderTop: '1px solid rgba(255,255,255,0.06)', borderBottom: '1px solid rgba(255,255,255,0.06)', maxHeight: 300 }}>
        {tasks.length === 0 ? (
          <Box sx={{ display: 'flex', flexDirection: 'column', alignItems: 'center', py: 6, px: 3, gap: 1.5 }}>
            <AlertCircle size={28} style={{ color: 'rgba(255,255,255,0.3)' }} />
            <Typography variant="caption" sx={{ color: 'rgba(255,255,255,0.4)', fontStyle: 'italic', textAlign: 'center' }}>
              No unchecked checklist items (`- [ ]`) found in this note.
            </Typography>
          </Box>
        ) : (
          <List sx={{ py: 0 }}>
            {tasks.map((task) => (
              <ListItem
                key={task.id}
                disablePadding
                secondaryAction={
                  <Checkbox
                    edge="end"
                    checked={task.selected}
                    onChange={() => handleToggle(task.id)}
                    sx={{
                      color: 'rgba(255,255,255,0.2)',
                      '&.Mui-checked': {
                        color: theme.palette.primary.main,
                      },
                    }}
                  />
                }
                sx={{
                  borderBottom: '1px solid rgba(255,255,255,0.02)',
                  px: 3,
                }}
              >
                <ListItemText
                  primary={task.title}
                  primaryTypographyProps={{
                    sx: {
                      fontWeight: 600,
                      fontSize: '0.85rem',
                      color: task.selected ? '#fff' : 'rgba(255,255,255,0.4)',
                      transition: 'color 0.2s ease',
                    },
                  }}
                />
              </ListItem>
            ))}
          </List>
        )}
      </DialogContent>

      <DialogActions sx={{ p: 3, justifyContent: 'space-between' }}>
        {tasks.length > 0 ? (
          <Button
            size="small"
            onClick={handleSelectAll}
            sx={{
              color: 'rgba(255,255,255,0.5)',
              textTransform: 'none',
              fontWeight: 800,
              fontSize: '0.75rem',
              '&:hover': { color: '#fff', bgcolor: 'transparent' },
            }}
          >
            {tasks.every((t) => t.selected) ? 'Deselect All' : 'Select All'}
          </Button>
        ) : (
          <Box />
        )}
        <Stack direction="row" spacing={1.5}>
          <Button
            onClick={onClose}
            sx={{
              borderRadius: '12px',
              border: '1px solid rgba(255,255,255,0.06)',
              color: 'rgba(255,255,255,0.6)',
              px: 3,
              fontWeight: 800,
              textTransform: 'none',
              fontSize: '0.8rem',
              '&:hover': { bgcolor: 'rgba(255,255,255,0.02)', borderColor: 'rgba(255,255,255,0.1)' },
            }}
          >
            Cancel
          </Button>
          {tasks.length > 0 && (
            <Button
              variant="contained"
              onClick={handleExtract}
              disabled={extracting}
              sx={{
                borderRadius: '12px',
                bgcolor: theme.palette.primary.main,
                color: '#fff',
                px: 3.5,
                fontWeight: 900,
                textTransform: 'none',
                fontSize: '0.8rem',
                boxShadow: 'none',
                '&:hover': { bgcolor: theme.palette.primary.dark, boxShadow: 'none' },
              }}
            >
              {extracting ? <CircularProgress size={16} color="inherit" /> : 'Create Goals'}
            </Button>
          )}
        </Stack>
      </DialogActions>
    </Dialog>
  );
}
