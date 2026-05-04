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
  InputAdornment,
  Drawer,
  IconButton,
  Divider
} from '@mui/material';
import { 
  Search as SearchIcon,
  Event as EventIcon,
  Schedule as TimeIcon,
  Close as CloseIcon
} from '@mui/icons-material';
import { listFlowEvents } from '@/lib/appwrite';
import { useToast } from './Toast';

interface Event {
  $id: string;
  title: string;
  startTime: string;
  location: string;
}

interface EventSelectorModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSelect: (eventId: string) => void;
}

export function EventSelectorModal({ isOpen, onClose, onSelect }: EventSelectorModalProps) {
  const [events, setEvents] = useState<Event[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const { showError } = useToast();

  useEffect(() => {
    if (isOpen) {
      const fetchEvents = async () => {
        setLoading(true);
        try {
          const res = await listFlowEvents();
          setEvents(res.documents as any[]);
        } catch (err: any) {
          showError(err.message || 'Failed to fetch events from Kylrix Flow');
          onClose();
        } finally {
          setLoading(false);
        }
      };
      fetchEvents();
    }
  }, [isOpen, showError, onClose]);

  const filteredEvents = events.filter(event => 
    (event.title || '').toLowerCase().includes(search.toLowerCase()) ||
    (event.location || '').toLowerCase().includes(search.toLowerCase())
  );

  return (
    <Drawer
      anchor="bottom"
      open={isOpen}
      onClose={onClose}
      PaperProps={{
        sx: {
          borderRadius: '24px 24px 0 0',
          bgcolor: 'rgba(15, 13, 12, 0.98)',
          backdropFilter: 'blur(20px) saturate(180%)',
          borderTop: '1px solid rgba(255, 255, 255, 0.08)',
          boxShadow: '0 -24px 60px rgba(0,0,0,0.65)',
          maxHeight: { xs: '88dvh', sm: '72vh' },
        }
      }}
    >
      <Box sx={{ minHeight: 0, maxHeight: '72vh', display: 'flex', flexDirection: 'column', p: 3, gap: 2, overflow: 'hidden' }}>
        <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 2 }}>
          <Box>
            <Typography variant="h6" sx={{ fontWeight: 900, letterSpacing: '-0.02em', color: 'white', fontFamily: 'var(--font-clash-display)' }}>
              Attach Event
            </Typography>
            <Typography variant="caption" sx={{ color: 'rgba(255,255,255,0.45)', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.1em' }}>
              Pick from Flow
            </Typography>
          </Box>
          <IconButton onClick={onClose} sx={{ color: 'rgba(255,255,255,0.6)', bgcolor: 'rgba(255,255,255,0.03)' }}>
            <CloseIcon />
          </IconButton>
        </Box>
        <Divider sx={{ borderColor: 'rgba(255,255,255,0.06)' }} />
        <TextField
          fullWidth
          size="small"
          placeholder="Search events..."
          value={search}
          onChange={ (e) => setSearch(e.target.value)}
          sx={{
            mb: 2,
            '& .MuiOutlinedInput-root': {
              bgcolor: 'rgba(255, 255, 255, 0.03)',
              borderRadius: '12px',
              '& fieldset': { borderColor: 'rgba(255, 255, 255, 0.1)' },
              '&:hover fieldset': { borderColor: 'rgba(99, 102, 241, 0.3)' },
              '&.Mui-focused fieldset': { borderColor: '#6366F1' },
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
          <Box sx={{ display: 'flex', justifyContent: 'center', alignItems: 'center', flex: 1, minHeight: 0 }}>
            <CircularProgress size={32} sx={{ color: '#6366F1' }} />
          </Box>
        ) : filteredEvents.length === 0 ? (
          <Box sx={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', flex: 1, minHeight: 0, opacity: 0.5, textAlign: 'center' }}>
            <EventIcon sx={{ fontSize: 48, mb: 1 }} />
            <Typography variant="body2">No events found</Typography>
          </Box>
        ) : (
          <List sx={{ flex: 1, minHeight: 0, overflowY: 'auto', pr: 1 }}>
            {filteredEvents.map((event) => (
              <ListItemButton
                key={event.$id}
                onClick={() => onSelect(event.$id)}
                sx={{
                  borderRadius: '12px',
                  mb: 1,
                  border: '1px solid rgba(255, 255, 255, 0.05)',
                  '&:hover': {
                    bgcolor: 'rgba(99, 102, 241, 0.05)',
                    borderColor: 'rgba(99, 102, 241, 0.2)',
                  }
                }}
              >
                <Box sx={{ mr: 2, display: 'flex', color: 'rgba(99, 102, 241, 0.6)' }}>
                  <EventIcon fontSize="small" />
                </Box>
                <ListItemText 
                  primary={event.title} 
                  secondary={
                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mt: 0.5 }}>
                      <TimeIcon sx={{ fontSize: 12, color: 'rgba(255, 255, 255, 0.3)' }} />
                      <Typography variant="caption" sx={{ color: 'rgba(255, 255, 255, 0.4)' }}>
                        {new Date(event.startTime).toLocaleDateString()} {new Date(event.startTime).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                      </Typography>
                    </Box>
                  }
                  primaryTypographyProps={{ 
                    fontSize: '0.9rem', 
                    fontWeight: 600,
                    color: 'rgba(255, 255, 255, 0.9)'
                  }} 
                />
              </ListItemButton>
            ))}
          </List>
        )}
      </Box>
    </Drawer>
  );
}
