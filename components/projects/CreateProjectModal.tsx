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
  Stack,
  IconButton,
} from '@mui/material';
import { 
  Rocket, 
  ShieldAlert, 
  Briefcase, 
  Zap,
  ArrowRight,
  Sparkles,
} from 'lucide-react';
import { ProjectsService } from '@/lib/appwrite/projects';
import { useToast } from '@/components/ui/Toast';

interface CreateProjectModalProps {
  open: boolean;
  onClose: () => void;
  onCreated: (project: any) => void;
}

const suggestions = [
  { 
    title: 'Product Launch', 
    summary: 'Coordinate specs, roadmap tasks, and social announcements in one hub.',
    icon: Rocket,
    color: '#EC4899',
  },
  { 
    title: 'Security Audit', 
    summary: 'Centralize sensitive credentials, vault secrets, and hardening checklists.',
    icon: ShieldAlert,
    color: '#10B981',
  },
  { 
    title: 'Client Handover', 
    summary: 'Package final documentation, access keys, and project context for transfer.',
    icon: Briefcase,
    color: '#F59E0B',
  },
  { 
    title: 'Team Sprint', 
    summary: 'Rapid execution hub for active tasks, huddle links, and shared notes.',
    icon: Zap,
    color: '#A855F7',
  },
];

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
      showSuccess('Project created', 'Your new hub is ready for integration.');
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

  const applySuggestion = (s: typeof suggestions[0]) => {
      setTitle(s.title);
      setSummary(s.summary);
  };

  return (
    <Dialog 
      open={open} 
      onClose={handleClose}
      fullWidth
      maxWidth="md"
      PaperProps={{
        sx: {
          bgcolor: '#0A0908',
          border: '1px solid rgba(255,255,255,0.06)',
          borderRadius: '32px',
          backgroundImage: 'none',
          p: 2,
          overflow: 'hidden'
        }
      }}
    >
      <DialogTitle sx={{ p: 3, pb: 1 }}>
        <Stack direction="row" spacing={1.5} alignItems="center">
            <Box sx={{ p: 1, borderRadius: '12px', bgcolor: alpha('#6366F1', 0.1), color: '#6366F1', display: 'grid', placeItems: 'center' }}>
                <Sparkles size={20} />
            </Box>
            <Typography variant="h5" sx={{ fontWeight: 900, color: '#fff', fontFamily: 'var(--font-clash)' }}>
                Initialize Hub
            </Typography>
        </Stack>
      </DialogTitle>
      <DialogContent sx={{ p: 0 }}>
        <Grid container>
            {/* Suggested Patterns */}
            <Grid item xs={12} md={5} sx={{ p: 3, borderRight: { md: '1px solid rgba(255,255,255,0.06)' }, bgcolor: alpha('#fff', 0.01) }}>
                <Typography variant="caption" sx={{ color: 'rgba(255,255,255,0.3)', fontWeight: 800, textTransform: 'uppercase', letterSpacing: '0.1em', mb: 2.5, display: 'block' }}>
                    Suggested Hubs
                </Typography>
                <Stack spacing={1.5}>
                    {suggestions.map((s) => (
                        <Box 
                            key={s.title}
                            onClick={() => applySuggestion(s)}
                            sx={{ 
                                p: 2, 
                                borderRadius: '18px', 
                                border: '1px solid rgba(255,255,255,0.04)',
                                bgcolor: title === s.title ? alpha(s.color, 0.08) : 'transparent',
                                borderColor: title === s.title ? alpha(s.color, 0.2) : 'rgba(255,255,255,0.04)',
                                cursor: 'pointer',
                                transition: 'all 0.2s ease',
                                '&:hover': { bgcolor: alpha(s.color, 0.05), borderColor: alpha(s.color, 0.1) }
                            }}
                        >
                            <Stack direction="row" spacing={1.5} alignItems="center">
                                <Box sx={{ color: s.color, display: 'grid', placeItems: 'center' }}>
                                    <s.icon size={18} />
                                </Box>
                                <Box sx={{ flex: 1 }}>
                                    <Typography variant="body2" sx={{ fontWeight: 800, color: '#fff' }}>{s.title}</Typography>
                                    <Typography variant="caption" sx={{ color: 'rgba(255,255,255,0.4)', display: 'block', mt: 0.25 }}>{s.summary.slice(0, 40)}...</Typography>
                                </Box>
                                <ArrowRight size={14} color="rgba(255,255,255,0.2)" />
                            </Stack>
                        </Box>
                    ))}
                </Stack>
            </Grid>

            {/* Custom Configuration */}
            <Grid item xs={12} md={7} sx={{ p: 3 }}>
                <Typography variant="caption" sx={{ color: 'rgba(255,255,255,0.3)', fontWeight: 800, textTransform: 'uppercase', letterSpacing: '0.1em', mb: 2.5, display: 'block' }}>
                    Configuration
                </Typography>
                <Stack spacing={3}>
                    <TextField
                        fullWidth
                        label="Hub Title"
                        value={title}
                        onChange={(e) => setTitle(e.target.value)}
                        variant="outlined"
                        autoFocus
                        InputLabelProps={{ sx: { color: 'rgba(255,255,255,0.4)', fontWeight: 700 } }}
                        sx={{
                            '& .MuiOutlinedInput-root': {
                                color: '#fff',
                                bgcolor: '#161412',
                                borderRadius: '16px',
                                fontWeight: 700,
                                '& fieldset': { borderColor: 'rgba(255,255,255,0.06)' },
                                '&:hover fieldset': { borderColor: 'rgba(255,255,255,0.12)' },
                            }
                        }}
                    />
                    <TextField
                        fullWidth
                        label="Purpose / Summary"
                        value={summary}
                        onChange={(e) => setSummary(e.target.value)}
                        variant="outlined"
                        multiline
                        rows={3}
                        InputLabelProps={{ sx: { color: 'rgba(255,255,255,0.4)', fontWeight: 700 } }}
                        sx={{
                            '& .MuiOutlinedInput-root': {
                                color: '#fff',
                                bgcolor: '#161412',
                                borderRadius: '16px',
                                '& fieldset': { borderColor: 'rgba(255,255,255,0.06)' },
                                '&:hover fieldset': { borderColor: 'rgba(255,255,255,0.12)' },
                            }
                        }}
                    />
                    <FormControl fullWidth>
                        <InputLabel sx={{ color: 'rgba(255,255,255,0.4)', fontWeight: 700 }}>Visibility Level</InputLabel>
                        <Select
                            value={visibility}
                            label="Visibility Level"
                            onChange={(e) => setVisibility(e.target.value as any)}
                            sx={{
                                color: '#fff',
                                bgcolor: '#161412',
                                borderRadius: '16px',
                                fontWeight: 700,
                                '& .MuiOutlinedInput-notchedOutline': { borderColor: 'rgba(255,255,255,0.06)' },
                                '& .MuiSvgIcon-root': { color: 'rgba(255,255,255,0.3)' }
                            }}
                        >
                            <MenuItem value="private">Private (Only you)</MenuItem>
                            <MenuItem value="shared">Shared (Collaborators only)</MenuItem>
                            <MenuItem value="public">Public (Anyone with link)</MenuItem>
                        </Select>
                    </FormControl>
                </Stack>
            </Grid>
        </Grid>
      </DialogContent>
      <DialogActions sx={{ p: 3, pt: 1 }}>
        <Button onClick={handleClose} sx={{ color: 'rgba(255,255,255,0.5)', fontWeight: 800, textTransform: 'none' }}>
          Cancel
        </Button>
        <Button 
          variant="contained" 
          onClick={handleSubmit} 
          disabled={loading || !title.trim()}
          sx={{ 
            borderRadius: '16px', 
            bgcolor: '#6366F1', 
            px: 6,
            py: 1.5,
            fontWeight: 900,
            textTransform: 'none',
            boxShadow: '0 8px 32px rgba(99, 102, 241, 0.3)',
            '&:hover': { bgcolor: alpha('#6366F1', 0.8) }
          }}
        >
          {loading ? 'Initializing...' : 'Create Hub'}
        </Button>
      </DialogActions>
    </Dialog>
  );
}
