'use client';

import React, { useState, useEffect } from 'react';
import { 
  Box, 
  Typography, 
  List, 
  ListItemButton, 
  ListItemText, 
  CircularProgress, 
  TextField,
  InputAdornment
} from '@mui/material';
import { 
  Search as SearchIcon,
  Assignment as TaskIcon,
} from '@mui/icons-material';
import { Dialog } from '../ui/Dialog';
import { AppwriteService } from '@/lib/appwrite';
import { useAuth } from '@/hooks/useAuth';

interface TaskSelectorModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSelect: (taskId: string) => void;
}

export function TaskSelectorModal({ isOpen, onClose, onSelect }: TaskSelectorModalProps) {
  const { user } = useAuth();
  const [tasks, setTasks] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');

  useEffect(() => {
    if (isOpen && user) {
      const fetchTasks = async () => {
        setLoading(true);
        try {
          const res = await AppwriteService.listFlowTasks(user.$id);
          setTasks(res.documents);
        } catch (err: unknown) {
          console.error('Failed to fetch tasks:', err);
        } finally {
          setLoading(false);
        }
      };
      fetchTasks();
    }
  }, [isOpen, user]);

  const filtered = tasks.filter(t => 
    (t.title || '').toLowerCase().includes(search.toLowerCase())
  );

  return (
    <Dialog open={isOpen} onClose={onClose}>
      <Box sx={{ p: 4 }}>
        <Typography variant="h5" sx={{ fontWeight: 900, color: '#10b981', mb: 3, fontFamily: 'var(--font-space-grotesk)' }}>
          ATTACH TASK (FLOW)
        </Typography>

        <TextField
          fullWidth
          size="small"
          placeholder="Search tasks..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          variant="outlined"
          sx={{
            mb: 3,
            '& .MuiOutlinedInput-root': {
              bgcolor: 'rgba(255, 255, 255, 0.03)',
              borderRadius: '12px',
              '& fieldset': { borderColor: 'rgba(255, 255, 255, 0.1)' },
              '&:hover fieldset': { borderColor: 'rgba(16, 185, 129, 0.3)' },
              '&.Mui-focused fieldset': { borderColor: '#10b981' },
            }
          }}
          InputProps={{
            startAdornment: (
              <InputAdornment position="start">
                <SearchIcon sx={{ color: 'rgba(255, 255, 255, 0.3)', fontSize: 20 }} />
              </InputAdornment>
            ),
          }}
        />

        {loading ? (
          <Box sx={{ display: 'flex', justifyContent: 'center', p: 4 }}>
            <CircularProgress size={32} sx={{ color: '#10b981' }} />
          </Box>
        ) : filtered.length === 0 ? (
          <Typography variant="body2" sx={{ textAlign: 'center', opacity: 0.5, py: 4 }}>No tasks found</Typography>
        ) : (
          <List sx={{ maxHeight: '400px', overflowY: 'auto' }}>
            {filtered.map((task) => (
              <ListItemButton
                key={task.$id}
                onClick={() => onSelect(task.$id)}
                sx={{
                  borderRadius: '12px',
                  mb: 1,
                  border: '1px solid rgba(255, 255, 255, 0.05)',
                  '&:hover': {
                    bgcolor: 'rgba(16, 185, 129, 0.05)',
                    borderColor: 'rgba(16, 185, 129, 0.2)',
                  }
                }}
              >
                <Box sx={{ mr: 2, display: 'flex', color: '#10b981' }}>
                  <TaskIcon fontSize="small" />
                </Box>
                <ListItemText 
                  primary={task.title} 
                  primaryTypographyProps={{ fontSize: '0.9rem', fontWeight: 600 }}
                />
              </ListItemButton>
            ))}
          </List>
        )}
      </Box>
    </Dialog>
  );
}
