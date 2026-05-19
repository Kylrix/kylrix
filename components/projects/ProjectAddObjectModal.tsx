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
  Tabs,
  Tab,
  Stack,
  Button,
} from '@mui/material';
import { 
  X, 
  Search, 
  FileText, 
  CheckSquare, 
  Lock, 
  Plus,
} from 'lucide-react';
import { listNotes, listFlowTasks, listKeepCredentials, Query } from '@/lib/appwrite';
import { ProjectsService } from '@/lib/appwrite/projects';
import { useToast } from '@/components/ui/Toast';

interface ProjectAddObjectModalProps {
  open: boolean;
  onClose: () => void;
  projectId: string;
  onAdded: () => void;
}

export default function ProjectAddObjectModal({ open, onClose, projectId, onAdded }: ProjectAddObjectModalProps) {
  const theme = useTheme();
  const { showSuccess, showError } = useToast();
  const [tab, setTab] = useState(0);
  const [query, setQuery] = useState('');
  const [loading, setLoading] = useState(false);
  const [results, setResults] = useState<any[]>([]);
  const [adding, setAdding] = useState<string | null>(null);

  const fetchResults = useCallback(async () => {
    setLoading(true);
    try {
      let res: any;
      const queries = [Query.limit(10)];
      if (query.trim()) {
          // Standard search implementation
          queries.push(Query.search(tab === 0 ? 'title' : 'name', query));
      }

      if (tab === 0) res = await listNotes(queries);
      else if (tab === 1) res = await listFlowTasks(queries);
      else res = await listKeepCredentials(queries);

      setResults(res.documents || res.rows || []);
    } catch (err) {
      console.error('Search failed', err);
      setResults([]);
    } finally {
      setLoading(false);
    }
  }, [tab, query]);

  useEffect(() => {
    if (open) fetchResults();
  }, [open, tab, query, fetchResults]);

  const handleAdd = async (entityId: string) => {
    setAdding(entityId);
    try {
      const kind = tab === 0 ? 'note' : tab === 1 ? 'goal' : 'password';
      await ProjectsService.addObjectToProject(projectId, kind, entityId);
      showSuccess('Added to project');
      onAdded();
      onClose();
    } catch (err: any) {
      showError('Failed to add object', err.message);
    } finally {
      setAdding(null);
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
          overflow: 'hidden'
        }
      }}
    >
      <DialogTitle sx={{ p: 3, pb: 1, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <Typography variant="h6" sx={{ fontWeight: 900 }}>Integrate Object</Typography>
        <IconButton onClick={onClose} size="small" sx={{ color: 'rgba(255,255,255,0.4)' }}><X size={20} /></IconButton>
      </DialogTitle>
      
      <Box sx={{ borderBottom: 1, borderColor: 'rgba(255,255,255,0.06)' }}>
        <Tabs value={tab} onChange={(_, v) => setTab(v)} variant="fullWidth">
            <Tab icon={<FileText size={16} />} iconPosition="start" label="Note" />
            <Tab icon={<CheckSquare size={16} />} iconPosition="start" label="Goal" />
            <Tab icon={<Lock size={16} />} iconPosition="start" label="Secret" />
        </Tabs>
      </Box>

      <Box sx={{ p: 2 }}>
        <TextField
            fullWidth
            size="small"
            placeholder="Search existing resources..."
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            InputProps={{
                startAdornment: <Search size={16} style={{ marginRight: '8px', opacity: 0.5 }} />,
                sx: { bgcolor: 'rgba(255,255,255,0.02)', borderRadius: '12px' }
            }}
        />
      </Box>

      <DialogContent sx={{ p: 0, maxHeight: 400 }}>
        {loading ? (
            <Box sx={{ display: 'grid', placeItems: 'center', py: 4 }}><CircularProgress size={20} /></Box>
        ) : results.length === 0 ? (
            <Typography variant="caption" sx={{ display: 'block', textAlign: 'center', py: 6, color: 'rgba(255,255,255,0.3)', fontStyle: 'italic' }}>No resources found matching your query.</Typography>
        ) : (
            <List>
                {results.map((item) => (
                    <ListItem key={item.$id} disablePadding>
                        <ListItemButton 
                            onClick={() => handleAdd(item.$id)}
                            disabled={!!adding}
                            sx={{ px: 3, py: 1.5, borderBottom: '1px solid rgba(255,255,255,0.02)' }}
                        >
                            <ListItemText 
                                primary={item.title || item.name} 
                                primaryTypographyProps={{ sx: { fontWeight: 700, fontSize: '0.9rem' } }}
                                secondary={item.summary || item.username || 'System Object'}
                                secondaryTypographyProps={{ sx: { fontSize: '0.75rem', opacity: 0.5 } }}
                            />
                            {adding === item.$id ? <CircularProgress size={16} /> : <Plus size={16} color={theme.palette.primary.main} />}
                        </ListItemButton>
                    </ListItem>
                ))}
            </List>
        )}
      </DialogContent>
    </Dialog>
  );
}
