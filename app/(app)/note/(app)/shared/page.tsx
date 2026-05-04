"use client";

import React, { useState, useEffect, useMemo } from 'react';
import type { Notes } from '@/types/appwrite';
import NoteCard from '@/components/ui/NoteCard';
import { getSharedNotes, listPublicNotesByUser, getCurrentUser } from '@/lib/appwrite';
import { useNotes } from '@/context/NotesContext';
import {
  Box,
  Typography,
  Button,
  Tabs,
  Tab,
  Grid,
  Chip,
  CircularProgress,
  Container,
  IconButton
} from '@mui/material';
import {
  Search as SearchIcon,
  Public as GlobeAltIcon,
  Person as UserIcon,
} from '@mui/icons-material';
import { MobileBottomNav } from '@/components/Navigation';

interface SharedNote extends Notes {
  sharedPermission?: string;
  sharedAt?: string;
  sharedBy?: { name: string; email: string } | null;
}

export default function SharedNotesPage() {
  const [sharedNotes, setSharedNotes] = useState<SharedNote[]>([]);
  const [publicNotes, setPublicNotes] = useState<Notes[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState(0);
  const { isPinned } = useNotes();

  // Fetch shared and public notes once on mount
  useEffect(() => {
    const fetchNotes = async () => {
      try {
        setLoading(true);
        
        const [sharedResult, user] = await Promise.all([
          getSharedNotes(),
          getCurrentUser()
        ]);

        setSharedNotes(sharedResult.documents as SharedNote[]);

        if (user && user.$id) {
          const publicResult = await listPublicNotesByUser(user.$id);
          setPublicNotes(publicResult.documents as unknown as Notes[]);
        } else {
          setPublicNotes([]);
        }
      } catch (error: any) {
        console.error('Error fetching shared notes:', error);
      } finally {
        setLoading(false);
      }
    };

    fetchNotes();
  }, []);

  const sortedSharedNotes = useMemo(() => {
    return [...sharedNotes].sort((a, b) => {
      const aPinned = isPinned(a.$id);
      const bPinned = isPinned(b.$id);
      if (aPinned && !bPinned) return -1;
      if (!aPinned && bPinned) return 1;
      return 0;
    });
  }, [sharedNotes, isPinned]);

  const sortedPublicNotes = useMemo(() => {
    return [...publicNotes].sort((a, b) => {
      const aPinned = isPinned(a.$id);
      const bPinned = isPinned(b.$id);
      if (aPinned && !bPinned) return -1;
      if (!aPinned && bPinned) return 1;
      return 0;
    });
  }, [publicNotes, isPinned]);

  const currentNotes = activeTab === 0 ? sortedSharedNotes : sortedPublicNotes;

  return (
    <Box sx={{ 
      position: 'relative', 
      display: 'flex', 
      flexDirection: 'column', 
      minHeight: '100vh', 
      bgcolor: 'background.default',
      overflowX: 'hidden'
    }}>
      <Container maxWidth="xl" sx={{ flexGrow: 1, pt: 6, pb: { xs: 12, md: 4 } }}>
        {/* Mobile Header - Hidden on Desktop */}
        <Box sx={{ display: { xs: 'flex', md: 'none' }, alignItems: 'center', justifyContent: 'space-between', mb: 4 }}>
          <Typography variant="h2" sx={{ fontWeight: 900 }}>
            Shared
          </Typography>
          <IconButton sx={{ bgcolor: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.1)' }}>
            <SearchIcon />
          </IconButton>
        </Box>

        {/* Desktop Header */}
        <Box sx={{ display: { xs: 'none', md: 'flex' }, alignItems: 'center', justifyContent: 'space-between', mb: 6 }}>
          <Box>
            <Typography variant="h1" sx={{ mb: 1 }}>
              Shared
            </Typography>
            <Typography variant="body1" sx={{ color: 'text.secondary' }}>
              Notes shared with you and your public notes
            </Typography>
          </Box>
          <Button 
            variant="outlined" 
            startIcon={<SearchIcon />}
            sx={{ 
              borderRadius: 3,
              borderColor: 'rgba(255,255,255,0.1)',
              color: 'text.primary',
              '&:hover': { borderColor: 'primary.main', bgcolor: 'rgba(99, 102, 241, 0.05)' }
            }}
          >
            Search Shared Notes
          </Button>
        </Box>

        {/* Tabs */}
        <Box sx={{ 
          mb: 4, 
          bgcolor: 'rgba(255,255,255,0.03)', 
          borderRadius: 4, 
          p: 0.5,
          border: '1px solid rgba(255,255,255,0.05)'
        }}>
          <Tabs 
            value={activeTab} 
            onChange={(_, newValue) => setActiveTab(newValue)}
            variant="fullWidth"
            sx={{
              '& .MuiTabs-indicator': { display: 'none' },
              '& .MuiTab-root': {
                borderRadius: 3.5,
                minHeight: 48,
                transition: 'all 0.2s',
                color: 'text.secondary',
                '&.Mui-selected': {
                  bgcolor: 'primary.main',
                  color: 'background.default',
                  fontWeight: 700,
                },
                '&:hover:not(.Mui-selected)': {
                  color: 'text.primary',
                  bgcolor: 'rgba(255,255,255,0.05)'
                }
              }
            }}
          >
            <Tab icon={<UserIcon sx={{ fontSize: 20 }} />} iconPosition="start" label={`Private (${sharedNotes.length})`} />
            <Tab icon={<GlobeAltIcon sx={{ fontSize: 20 }} />} iconPosition="start" label={`Public (${publicNotes.length})`} />
          </Tabs>
        </Box>

        {/* Content */}
        {loading ? (
          <Box sx={{ display: 'flex', justifyContent: 'center', py: 10 }}>
            <CircularProgress color="primary" />
          </Box>
        ) : currentNotes.length === 0 ? (
          <Box sx={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', py: 10, textAlign: 'center' }}>
            <Box sx={{ 
              width: 96, 
              height: 96, 
              bgcolor: 'rgba(255,255,255,0.03)', 
              borderRadius: 6, 
              display: 'flex', 
              alignItems: 'center', 
              justifyContent: 'center', 
              mb: 3,
              border: '1px solid rgba(255,255,255,0.05)'
            }}>
              {activeTab === 0 ? (
                <UserIcon sx={{ fontSize: 48, color: 'text.disabled' }} />
              ) : (
                <GlobeAltIcon sx={{ fontSize: 48, color: 'text.disabled' }} />
              )}
            </Box>
            <Typography variant="h4" sx={{ mb: 2 }}>
              {activeTab === 0 ? 'No private shared notes yet' : 'No public notes yet'}
            </Typography>
            <Typography variant="body1" sx={{ color: 'text.secondary', maxWidth: 400, mb: 4 }}>
              {activeTab === 0 
                ? "When others share notes with you, they'll appear here. Start collaborating by sharing your own notes!"
                : "When you make your notes public, they’ll appear here."
              }
            </Typography>
          </Box>
        ) : (
          <Grid container spacing={3}>
            {currentNotes.map((note) => (
                <Grid size={{ xs: 6, sm: 4, md: 3, lg: 2.4 }} key={note.$id}>
                  <NoteCard note={note} />
                  {activeTab === 0 && (note as SharedNote).sharedBy && (
                    <Typography variant="caption" sx={{ display: 'block', mt: 1, color: 'text.secondary', textAlign: 'center' }}>
                      Shared by {(note as SharedNote).sharedBy?.name || (note as SharedNote).sharedBy?.email}
                    </Typography>
                  )}
                  {activeTab === 0 && ['write', 'admin'].includes(String((note as SharedNote).sharedPermission || '')) && (
                    <Chip
                      size="small"
                      label="Editable"
                      sx={{
                        display: 'flex',
                        mx: 'auto',
                        mt: 1,
                        width: 'fit-content',
                        bgcolor: 'rgba(16, 185, 129, 0.12)',
                        color: '#10B981',
                        fontWeight: 800,
                      }}
                    />
                  )}
                </Grid>
              ))}
          </Grid>
        )}
      </Container>

      {/* Mobile Bottom Navigation */}
      <MobileBottomNav />
    </Box>
  );
}
