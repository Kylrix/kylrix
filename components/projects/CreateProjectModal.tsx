'use client';

import React, { useState } from 'react';
import {
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Button,
  TextField,
  Box,
  Typography,
  alpha,
  useTheme,
  FormControl,
  InputLabel,
  Select,
  MenuItem,
} from '@mui/material';
import { ProjectsService } from '@/lib/appwrite/projects';
import { useToast } from '@/components/ui/Toast';

interface CreateProjectModalProps {
  open: boolean;
  onClose: () => void;
  onCreated: (project: any) => void;
}

export default function CreateProjectModal({ open, onClose, onCreated }: CreateProjectModalProps) {
  const theme = useTheme();
  const { showSuccess, showError } = useToast();
  const [title, setTitle] = useState('');
  const [summary, setSummary] = useState('');
  const [visibility, setVisibility] = useState<'private' | 'shared' | 'public'>('private');
  const [loading, setLoading] = useState(false);

  const handleSubmit = async () => {
    if (!title.trim()) return;
    setLoading(true);
    try {
      const project = await ProjectsService.createProject({
        title: title.trim(),
        summary: summary.trim(),
        visibility,
        status: 'active',
      });
      showSuccess('Project created', 'Your new project has been initialized.');
      onCreated(project);
      handleClose();
    } catch (err: any) {
      showError('Failed to create project', err.message);
    } finally {
      setLoading(false);
    }
  };

  const handleClose = () => {
    setTitle('');
    setSummary('');
    setVisibility('private');
    onClose();
  };

  return (
    <Dialog 
      open={open} 
      onClose={handleClose}
      PaperProps={{
        sx: {
          bgcolor: '#161412',
          border: '1px solid rgba(255,255,255,0.06)',
          borderRadius: '28px',
          backgroundImage: 'none',
          p: 1
        }
      }}
    >
      <DialogTitle sx={{ fontWeight: 900, fontSize: '1.5rem', color: '#fff' }}>
        Create Project
      </DialogTitle>
      <DialogContent>
        <Box sx={{ mt: 1, display: 'flex', flexDirection: 'column', gap: 3 }}>
          <TextField
            fullWidth
            label="Title"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            variant="outlined"
            autoFocus
            InputLabelProps={{ sx: { color: 'rgba(255,255,255,0.5)' } }}
            sx={{
              '& .MuiOutlinedInput-root': {
                color: '#fff',
                bgcolor: 'rgba(255,255,255,0.03)',
                borderRadius: '16px',
                '& fieldset': { borderColor: 'rgba(255,255,255,0.1)' },
              }
            }}
          />
          <TextField
            fullWidth
            label="Summary"
            value={summary}
            onChange={(e) => setSummary(e.target.value)}
            variant="outlined"
            multiline
            rows={3}
            InputLabelProps={{ sx: { color: 'rgba(255,255,255,0.5)' } }}
            sx={{
              '& .MuiOutlinedInput-root': {
                color: '#fff',
                bgcolor: 'rgba(255,255,255,0.03)',
                borderRadius: '16px',
                '& fieldset': { borderColor: 'rgba(255,255,255,0.1)' },
              }
            }}
          />
          <FormControl fullWidth>
            <InputLabel sx={{ color: 'rgba(255,255,255,0.5)' }}>Visibility</InputLabel>
            <Select
              value={visibility}
              label="Visibility"
              onChange={(e) => setVisibility(e.target.value as any)}
              sx={{
                color: '#fff',
                bgcolor: 'rgba(255,255,255,0.03)',
                borderRadius: '16px',
                '& .MuiOutlinedInput-notchedOutline': { borderColor: 'rgba(255,255,255,0.1)' },
                '& .MuiSvgIcon-root': { color: 'rgba(255,255,255,0.5)' }
              }}
            >
              <MenuItem value="private">Private</MenuItem>
              <MenuItem value="shared">Shared</MenuItem>
              <MenuItem value="public">Public</MenuItem>
            </Select>
          </FormControl>
        </Box>
      </DialogContent>
      <DialogActions sx={{ p: 3 }}>
        <Button onClick={handleClose} sx={{ color: 'rgba(255,255,255,0.6)', fontWeight: 800 }}>
          Cancel
        </Button>
        <Button 
          variant="contained" 
          onClick={handleSubmit} 
          disabled={loading || !title.trim()}
          sx={{ 
            borderRadius: '14px', 
            bgcolor: '#6366F1', 
            px: 4,
            fontWeight: 800,
            '&:hover': { bgcolor: alpha('#6366F1', 0.8) }
          }}
        >
          {loading ? 'Creating...' : 'Create'}
        </Button>
      </DialogActions>
    </Dialog>
  );
}
