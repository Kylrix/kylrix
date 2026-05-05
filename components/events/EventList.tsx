'use client';

import React, { useState, useEffect } from 'react';
import {
  Box,
  Typography,
  Button,
  Tabs,
  Tab,
  CircularProgress,
  alpha,
} from '@mui/material';
import Grid from '@mui/material/Grid';
import { Add as AddIcon } from '@mui/icons-material';
import EventCard from './EventCard';
import EventDialog from './EventDialog';
import { Event } from '@/types';
import { events as eventApi } from '@/lib/kylrixflow';
import { useTask } from '@/context/TaskContext';
import { useLayout } from '@/context/LayoutContext';
import { useAuth } from '@/context/auth/AuthContext';
import { permissions, EventVisibility } from '@/lib/permissions';
import { CallService } from '@/lib/services/call';
import toast from 'react-hot-toast';
import { Query } from 'appwrite';

export default function EventList() {
  const [tabValue, setTabValue] = useState(0);
  const [events, setEvents] = useState<Event[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const { projects, userId } = useTask();
  const { openSecondarySidebar } = useLayout();
  const { isAuthenticated, openIDMWindow } = useAuth();

  const handleTabChange = (event: React.SyntheticEvent, newValue: number) => {
    setTabValue(newValue);
  };

  useEffect(() => {
    const fetchEvents = async () => {
      try {
        setIsLoading(true);
        
        const queries: string[] = [];
        if (userId) {
          queries.push(Query.equal('userId', userId));
        } else if (!isAuthenticated) {
          queries.push(Query.equal('visibility', 'public'));
        }

        queries.push(Query.limit(100));
        queries.push(Query.select(['$id', 'title', 'description', 'startTime', 'endTime', 'location', 'visibility', 'status', 'coverImageId', 'userId', '$createdAt', '$updatedAt']));

        const list = await eventApi.list(queries);
        const mapped = list.rows.map(doc => ({
          id: doc.$id,
          title: doc.title,
          description: doc.description,
          startTime: new Date(doc.startTime),
          endTime: new Date(doc.endTime),
          location: doc.location,
          url: '',
          coverImage: '',
          attendees: [],
          isPublic: false,
          creatorId: '',
          createdAt: new Date(doc.$createdAt),
          updatedAt: new Date(doc.$updatedAt),
        }));
        setEvents(mapped);
      } catch (_error: unknown) {
        console.error('Failed to fetch events', _error);
      } finally {
        setIsLoading(false);
      }
    };

    fetchEvents();
  }, [userId, isAuthenticated]);

  const handleCreateEvent = async (eventData: any) => {
    try {
      // Use first project as calendar or default
      const calendarId = projects[0]?.id || 'default';
      const currentUserId = userId || 'guest';
      const visibility: EventVisibility = eventData.visibility || 'public';
      
      // Get appropriate permissions based on visibility
      const eventPermissions = permissions.forVisibility(visibility, currentUserId);
      
      let meetingUrl = eventData.url || '';

      // Auto-create call if requested
      if (eventData.autoCreateCall && currentUserId !== 'guest') {
        try {
          const call = await CallService.createCallLink(
            currentUserId,
            'video',
            undefined,
            eventData.title,
            eventData.startTime.toISOString(),
            60 // 1 hour duration
          );
          meetingUrl = `/connect/call/${call.$id}`;
          toast.success('Kylrix Connect call scheduled');
        } catch (callErr) {
          console.error('Failed to create call link', callErr);
          toast.error('Failed to create call link, but event will be created');
        }
      }

      const newDoc = await eventApi.create(
        {
          title: eventData.title,
          description: eventData.description || '',
          startTime: eventData.startTime.toISOString(),
          endTime: eventData.endTime.toISOString(),
          location: eventData.location || '',
          meetingUrl: meetingUrl,
          visibility: visibility,
          status: 'confirmed',
          coverImageId: eventData.coverImage || '',
          maxAttendees: 0,
          recurrenceRule: '',
          calendarId: calendarId,
          userId: currentUserId,
        },
        eventPermissions
      );

      const newEvent: Event = {
        id: newDoc.$id,
        title: newDoc.title,
        description: newDoc.description,
        startTime: new Date(newDoc.startTime),
        endTime: new Date(newDoc.endTime),
        location: newDoc.location,
        url: '',
        coverImage: '',
        attendees: [],
        isPublic: visibility === 'public',
        creatorId: currentUserId,
        createdAt: new Date(newDoc.$createdAt),
        updatedAt: new Date(newDoc.$updatedAt),
      };

      setEvents([newEvent, ...events]);
      setIsDialogOpen(false);
    } catch (_error: unknown) {
      console.error('Failed to create event', _error);
    }
  };

  if (isLoading) {
    return (
      <Box sx={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '100%' }}>
        <CircularProgress />
      </Box>
    );
  }

  return (
    <Box sx={{ height: '100%', display: 'flex', flexDirection: 'column', bgcolor: '#000000', minHeight: '100vh', p: { xs: 2, md: 4 } }}>
      <Box
        sx={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          mb: 4,
          flexWrap: 'wrap',
          gap: 2,
          p: 1,
        }}
      >
        <Box>
          <Typography 
            variant="h4" 
            fontWeight="900"
            sx={{ 
              fontFamily: 'var(--font-clash)',
              letterSpacing: '-0.03em',
              color: 'white',
              mb: 0.5
            }}
          >
            Events
          </Typography>
          <Typography 
            variant="body2" 
            sx={{ 
              color: 'rgba(255, 255, 255, 0.5)',
              fontWeight: 600,
              letterSpacing: '0.01em'
            }}
          >
            Discover and manage your schedule
          </Typography>
        </Box>
        <Button
          variant="contained"
          startIcon={<AddIcon sx={{ fontSize: 20 }} />}
          sx={{ 
            borderRadius: '14px', 
            px: 3, 
            py: 1.2,
            bgcolor: '#6366F1',
            color: 'white',
            fontWeight: 800,
            textTransform: 'none',
            fontSize: '0.9rem',
            boxShadow: '0 8px 24px rgba(99, 102, 241, 0.3)',
            '&:hover': {
              bgcolor: alpha('#6366F1', 0.8),
              transform: 'translateY(-2px)',
              boxShadow: '0 12px 28px rgba(99, 102, 241, 0.4)',
            },
            transition: 'all 0.2s cubic-bezier(0.4, 0, 0.2, 1)',
          }}
          onClick={() => {
            if (!isAuthenticated) {
              openIDMWindow();
              return;
            }
            setIsDialogOpen(true);
          }}
        >
          {isAuthenticated ? 'Create Event' : 'Sign in to Create'}
        </Button>
      </Box>

      <Box sx={{ 
        mb: 4, 
        bgcolor: '#161514', 
        borderRadius: '16px', 
        p: 0.5,
        width: 'fit-content',
        border: '1px solid rgba(255, 255, 255, 0.05)'
      }}>
        <Tabs 
          value={tabValue} 
          onChange={handleTabChange} 
          aria-label="event tabs"
          sx={{
            minHeight: 40,
            '& .MuiTabs-indicator': {
              display: 'none',
            },
            '& .MuiTab-root': {
              minHeight: 40,
              borderRadius: '12px',
              textTransform: 'none',
              fontWeight: 700,
              fontSize: '0.85rem',
              color: 'rgba(255, 255, 255, 0.5)',
              px: 3,
              transition: 'all 0.2s ease',
              '&.Mui-selected': {
                color: 'white',
                bgcolor: 'rgba(255, 255, 255, 0.08)',
              },
              '&:hover': {
                color: 'white',
                bgcolor: 'rgba(255, 255, 255, 0.04)',
              }
            }
          }}
        >
          <Tab label="Upcoming" />
          <Tab label="Past" />
          {isAuthenticated && <Tab label="My Events" />}
        </Tabs>
      </Box>

      <Grid container spacing={3}>
        {events.map((event) => (
          <Grid size={{ xs: 12, sm: 6, md: 4, lg: 3 }} key={event.id}>
            <EventCard 
              event={event} 
              onClick={() => openSecondarySidebar('event', event.id, event)} 
            />
          </Grid>
        ))}
      </Grid>

      <EventDialog
        open={isDialogOpen}
        onClose={() => setIsDialogOpen(false)}
        onSubmit={handleCreateEvent}
      />
    </Box>
  );
}
