'use client';

import React, { useState, useEffect } from 'react';
import {
  Box,
  Typography,
  IconButton,
  Button,
  Chip,
  Divider,
  useTheme,
  CircularProgress,
} from '@mui/material';
import {
  Close as CloseIcon,
  CalendarToday as CalendarIcon,
  AccessTime as TimeIcon,
  LocationOn as LocationIcon,
  Share as ShareIcon,
  Videocam as MeetingIcon,
} from '@mui/icons-material';
import { format } from 'date-fns';
import { useLayout } from '@/context/LayoutContext';
import { events as eventApi } from '@/lib/kylrixflow';
import { generateEventPattern } from '@/utils/patternGenerator';
import { Event as AppwriteEvent } from '@/types/kylrixflow';
import { Event as LocalEvent } from '@/types';

interface EventDetailsProps {
  eventId: string;
  initialData?: AppwriteEvent | LocalEvent | any;
  onBack?: () => void;
}

export default function EventDetails({ eventId, initialData, onBack }: EventDetailsProps) {
  const theme = useTheme();
  const { closeSecondarySidebar } = useLayout();
  const handleClose = () => {
    if (onBack) {
      onBack();
    } else {
      closeSecondarySidebar();
    }
  };
  const [event, setEvent] = useState<AppwriteEvent | LocalEvent | null>(initialData || null);
  const [loading, setLoading] = useState(!initialData);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const fetchEvent = async () => {
      if (initialData) return;
      
      try {
        setLoading(true);
        const data = await eventApi.get(eventId);
        setEvent(data);
      } catch (_err: unknown) {
        console.error('Failed to fetch event details', _err);
        setError('Failed to load event');
      } finally {
        setLoading(false);
      }
    };

    if (eventId) {
        fetchEvent();
    }
  }, [eventId, initialData]);

  // Helper to normalize event data access
  const getId = (evt: any) => evt?.$id || evt?.id;
  const getCoverImage = (evt: any) => evt?.coverImageId || evt?.coverImage;
  const getVisibility = (evt: any) => evt?.visibility || (evt?.isPublic ? 'Public' : 'Private');
  const getMeetingUrl = (evt: any) => evt?.meetingUrl || evt?.url;

  if (loading) {
    return (
      <Box sx={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '100%' }}>
        <CircularProgress />
      </Box>
    );
  }

  if (error || !event) {
    return (
      <Box sx={{ p: 3, textAlign: 'center' }}>
        <Typography color="text.secondary">{error || 'Event not found'}</Typography>
      </Box>
    );
  }

  const startDate = new Date(event.startTime);
  const endDate = new Date(event.endTime);
  const eventIdValue = getId(event);
  const coverImage = getCoverImage(event);
  const visibility = getVisibility(event);
  const meetingUrl = getMeetingUrl(event);
  
  const coverStyle = coverImage
    ? { backgroundImage: `url(${coverImage})` }
    : { background: generateEventPattern(eventIdValue + event.title) };

  return (
    <Box sx={{ height: '100%', display: 'flex', flexDirection: 'column', bgcolor: '#161412' }}>
      {/* Header with Cover */}
      <Box sx={{ position: 'relative' }}>
        <Box
            sx={{
                height: 140,
                width: '100%',
                backgroundSize: 'cover',
                backgroundPosition: 'center',
                ...coverStyle,
            }}
        />
        <IconButton
            onClick={handleClose}
            sx={{
                position: 'absolute',
                top: 8,
                right: 8,
                bgcolor: '#000000',
                border: '1px solid #34322F',
                color: 'white',
                '&:hover': { bgcolor: '#1C1A18' },
            }}
        >
            <CloseIcon sx={{ fontSize: 24 }} />
        </IconButton>
      </Box>

      {/* Content */}
      <Box sx={{ p: 3, overflow: 'auto', flexGrow: 1 }}>
        <Box sx={{ mb: 3 }}>
            <Box sx={{ display: 'flex', gap: 1, mb: 1 }}>
                <Chip
                    label={visibility}
                    size="small"
                    sx={{
                      bgcolor: '#1C1A18',
                      border: '1px solid #34322F',
                      color: 'white',
                      fontWeight: 700,
                      fontFamily: 'var(--font-satoshi)',
                      textTransform: 'capitalize'
                    }}
                />
                {(event as any).status === 'cancelled' && (
                    <Chip 
                      label="Cancelled" 
                      size="small" 
                      sx={{
                        bgcolor: '#EF4444',
                        color: 'black',
                        fontWeight: 800,
                        fontFamily: 'var(--font-mono)'
                      }}
                    />
                )}
            </Box>
            <Typography variant="h5" fontWeight={900} gutterBottom sx={{ fontFamily: 'var(--font-clash)', letterSpacing: '-0.02em', color: 'white' }}>
                {event.title}
            </Typography>
        </Box>

        {/* Date & Time */}
        <Box sx={{ mb: 3 }}>
            <Typography variant="subtitle2" fontWeight={700} gutterBottom sx={{ color: '#8E8A86', fontFamily: 'var(--font-satoshi)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                When
            </Typography>
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5, mb: 1 }}>
                <CalendarIcon sx={{ fontSize: 18, color: '#8E8A86' }} />
                <Typography variant="body2" sx={{ color: 'white', fontFamily: 'var(--font-satoshi)', fontWeight: 600 }}>
                    {format(startDate, 'EEEE, MMMM d, yyyy')}
                </Typography>
            </Box>
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5 }}>
                <TimeIcon sx={{ fontSize: 18, color: '#8E8A86' }} />
                <Typography variant="body2" sx={{ color: 'white', fontFamily: 'var(--font-satoshi)', fontWeight: 600 }}>
                    {format(startDate, 'h:mm a')} - {format(endDate, 'h:mm a')}
                </Typography>
            </Box>
        </Box>

        {/* Location */}
        <Box sx={{ mb: 3 }}>
            <Typography variant="subtitle2" fontWeight={700} gutterBottom sx={{ color: '#8E8A86', fontFamily: 'var(--font-satoshi)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                Where
            </Typography>
            <Box sx={{ display: 'flex', alignItems: 'flex-start', gap: 1.5 }}>
                <Box sx={{ mt: 0.5 }}>
                    <LocationIcon sx={{ fontSize: 18, color: '#8E8A86' }} />
                </Box>
                <Box>
                    <Typography variant="body2" sx={{ color: 'white', fontFamily: 'var(--font-satoshi)', fontWeight: 600 }} gutterBottom>
                        {event.location || 'Online Event'}
                    </Typography>
                    {meetingUrl && (
                        <Button
                            variant="outlined"
                            size="small"
                            startIcon={<MeetingIcon sx={{ fontSize: 18 }} />}
                            href={meetingUrl}
                            target="_blank"
                            sx={{ 
                              mt: 1, 
                              bgcolor: '#1C1A18', 
                              border: '1px solid #34322F',
                              color: 'white',
                              fontWeight: 700,
                              fontFamily: 'var(--font-satoshi)',
                              borderRadius: '8px',
                              textTransform: 'none',
                              '&:hover': {
                                bgcolor: '#242220',
                                borderColor: '#6366F1'
                              }
                            }}
                        >
                            Join Meeting
                        </Button>
                    )}
                </Box>
            </Box>
        </Box>

        <Divider sx={{ my: 3, borderColor: '#34322F' }} />

        {/* Description */}
        <Box sx={{ mb: 3 }}>
            <Typography variant="subtitle2" fontWeight={700} gutterBottom sx={{ color: '#8E8A86', fontFamily: 'var(--font-satoshi)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                About
            </Typography>
            <Typography variant="body2" sx={{ color: '#C1BEBA', fontFamily: 'var(--font-satoshi)', whiteSpace: 'pre-line', lineHeight: 1.6 }}>
                {event.description || 'No description provided.'}
            </Typography>
        </Box>

        <Divider sx={{ my: 3, borderColor: '#34322F' }} />

        {/* Actions */}
        <Box sx={{ display: 'flex', gap: 1, flexWrap: 'wrap' }}>
            <Button
                variant="contained"
                fullWidth
                href={`/flow/events/${eventIdValue}`}
                target="_blank"
                sx={{
                  bgcolor: '#6366F1',
                  color: 'white',
                  fontWeight: 700,
                  fontFamily: 'var(--font-satoshi)',
                  borderRadius: '12px',
                  py: 1.25,
                  '&:hover': {
                    bgcolor: '#4F46E5'
                  }
                }}
            >
                View Event Page
            </Button>
            <Button
                variant="outlined"
                fullWidth
                startIcon={<ShareIcon sx={{ fontSize: 18 }} />}
                onClick={() => {
                     navigator.clipboard.writeText(`${window.location.origin}/events/${eventIdValue}`);
                }}
                sx={{
                  bgcolor: '#1C1A18',
                  border: '1px solid #34322F',
                  color: 'white',
                  fontWeight: 700,
                  fontFamily: 'var(--font-satoshi)',
                  borderRadius: '12px',
                  py: 1.25,
                  '&:hover': {
                    bgcolor: '#242220',
                    borderColor: '#6366F1'
                  }
                }}
            >
                Copy Link
            </Button>
        </Box>
      </Box>
    </Box>
  );
}
