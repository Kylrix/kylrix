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
  Event as EventIcon,
} from '@mui/icons-material';
import { Dialog } from '../ui/Dialog';
import { AppwriteService } from '@/lib/appwrite';
import { useAuth } from '@/hooks/useAuth';

interface EventSelectorModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSelect: (eventId: string) => void;
}

export function EventSelectorModal({ isOpen, onClose, onSelect }: EventSelectorModalProps) {
  const { user } = useAuth();
  const [events, setEvents] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');

  useEffect(() => {
    if (isOpen && user) {
      const fetchEvents = async () => {
        setLoading(true);
        try {
          const res = await AppwriteService.listFlowEvents(user.$id);
          setEvents(res.documents);
        } catch (err: unknown) {
          console.error('Failed to fetch events:', err);
        } finally {
          setLoading(false);
        }
      };
      fetchEvents();
    }
  }, [isOpen, user]);

  const filtered = events.filter(e => 
    (e.title || '').toLowerCase().includes(search.toLowerCase())
  );

  return (
    <Dialog open={isOpen} onClose={onClose}>
      <Box sx={{ p: 4 }}>
        <Typography variant="h5" sx={{ fontWeight: 900, color: '#10b981', mb: 3, fontFamily: 'var(--font-space-grotesk)' }}>
          ATTACH EVENT (FLOW)
        </Typography>

        <TextField
          fullWidth
          size="small"
          placeholder="Search events..."
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
          <Typography variant="body2" sx={{ textAlign: 'center', opacity: 0.5, py: 4 }}>No events found</Typography>
        ) : (
          <List sx={{ maxHeight: '400px', overflowY: 'auto' }}>
            {filtered.map((event) => (
              <ListItemButton
                key={event.$id}
                onClick={() => onSelect(event.$id)}
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
                  <EventIcon fontSize="small" />
                </Box>
                <ListItemText 
                  primary={event.title} 
                  secondary={new Date(event.startTime).toLocaleDateString()}
                  primaryTypographyProps={{ fontSize: '0.9rem', fontWeight: 600 }}
                  secondaryTypographyProps={{ fontSize: '0.75rem', sx: { opacity: 0.5 } }}
                />
              </ListItemButton>
            ))}
          </List>
        )}
      </Box>
    </Dialog>
  );
}
