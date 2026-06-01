'use client';

import {
  Card,
  CardContent,
  CardMedia,
  Typography,
  Box,
  Avatar,
  AvatarGroup,
  IconButton,
  Chip,
} from '@mui/material';
import {
  MapPin,
  Share2,
  Clock,
  Users,
  MoreVertical,
} from 'lucide-react';
import { Event } from '@/types';
import { format, isToday, isTomorrow } from 'date-fns';
import { generateEventPattern as generatePattern } from '@/utils/patternGenerator';
import { useState } from 'react';
import { Menu, MenuItem, ListItemIcon, ListItemText } from '@mui/material';

interface EventCardProps {
  event: Event;
  onClick: () => void;
}

export default function EventCard({ event, onClick }: EventCardProps) {
  const pattern = generatePattern(event.id);
  const [anchorEl, setAnchorEl] = useState<null | HTMLElement>(null);
  
  const getDateLabel = () => {
    const date = new Date(event.startTime);
    if (isToday(date)) return 'Today';
    if (isTomorrow(date)) return 'Tomorrow';
    return null;
  };
  
  const dateLabel = getDateLabel();

  const handleMenuClick = (e: React.MouseEvent) => {
    e.stopPropagation();
    e.preventDefault();
    setAnchorEl(e.currentTarget as HTMLElement);
  };

  const handleMenuClose = () => {
    setAnchorEl(null);
  };

  return (
    <Card
      elevation={0}
      onContextMenu={handleMenuClick}
      sx={{
        border: '1px solid #34322F',
        borderRadius: '28px',
        cursor: 'pointer',
        transition: 'all 0.3s cubic-bezier(0.4, 0, 0.2, 1)',
        overflow: 'hidden',
        boxShadow: 'none',
        backgroundImage: 'none',
        bgcolor: '#161412',
        '&:hover': {
          transform: 'translateY(-2px)',
          boxShadow: '0 12px 24px rgba(0, 0, 0, 0.5)',
          borderColor: '#6366F1',
          bgcolor: '#1C1A18',
          '& .event-image': {
            transform: 'scale(1.05)',
          },
        },
        height: '100%',
        display: 'flex',
        flexDirection: 'column',
      }}
      onClick={onClick}
    >
      <Box sx={{ position: 'relative', overflow: 'hidden' }}>
        <CardMedia
          component="img"
          height="140"
          image={event.coverImage || undefined}
          alt={event.title}
          className="event-image"
          sx={{
            transition: 'transform 0.4s cubic-bezier(0.4, 0, 0.2, 1)',
            background: !event.coverImage ? pattern : undefined,
            objectFit: 'cover',
          }}
        />
        {/* Date badge */}
        <Box
          sx={{
            position: 'absolute',
            top: 12,
            left: 12,
            bgcolor: '#000000',
            borderRadius: '12px',
            px: 1.5,
            py: 0.75,
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            minWidth: 48,
            border: '1px solid #34322F',
          }}
        >
          <Typography 
            variant="caption" 
            fontWeight="800" 
            sx={{ 
              textTransform: 'uppercase',
              color: '#6366F1',
              fontSize: '0.65rem',
              letterSpacing: '0.05em',
              fontFamily: 'var(--font-mono)'
            }}
          >
            {format(new Date(event.startTime), 'MMM')}
          </Typography>
          <Typography 
            variant="h5" 
            fontWeight="900" 
            sx={{ 
              lineHeight: 1,
              color: 'white',
              fontFamily: 'var(--font-clash)',
            }}
          >
            {format(new Date(event.startTime), 'd')}
          </Typography>
        </Box>
        {/* Today/Tomorrow chip */}
        {dateLabel && (
          <Chip
            label={dateLabel}
            size="small"
            sx={{
              position: 'absolute',
              top: 12,
              right: 12,
              bgcolor: dateLabel === 'Today' ? '#10B981' : '#3B82F6',
              color: 'black',
              border: '1px solid #34322F',
              fontWeight: 800,
              fontSize: '0.65rem',
              height: 22,
              textTransform: 'uppercase',
              fontFamily: 'var(--font-mono)'
            }}
          />
        )}
      </Box>

      <CardContent sx={{ flexGrow: 1, display: 'flex', flexDirection: 'column', gap: 1.5, p: 2.5 }}>
        <Box>
          <Typography 
            variant="h6" 
            fontWeight="800" 
            gutterBottom 
            noWrap
            sx={{
              fontSize: '1rem',
              lineHeight: 1.3,
              fontFamily: 'var(--font-clash)',
              color: 'white',
            }}
          >
            {event.title}
          </Typography>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, color: '#9B9691', mb: 0.75 }}>
            <Clock size={14} strokeWidth={1.5} />
            <Typography variant="body2" sx={{ fontSize: '0.75rem', fontWeight: 600, fontFamily: 'var(--font-satoshi)' }}>
              {format(new Date(event.startTime), 'h:mm a')} - {format(new Date(event.endTime), 'h:mm a')}
            </Typography>
          </Box>
          {event.location && (
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, color: '#9B9691' }}>
              <MapPin size={14} strokeWidth={1.5} />
              <Typography variant="body2" noWrap sx={{ fontSize: '0.75rem', fontWeight: 600, fontFamily: 'var(--font-satoshi)' }}>
                {event.location}
              </Typography>
            </Box>
          )}
        </Box>

        <Box sx={{ mt: 'auto', display: 'flex', alignItems: 'center', justifyContent: 'space-between', pt: 1 }}>
          {event.attendees.length > 0 ? (
            <AvatarGroup 
              max={4} 
              sx={{ 
                '& .MuiAvatar-root': { 
                  width: 28, 
                  height: 28, 
                  fontSize: 11,
                  border: '2px solid #34322F',
                  bgcolor: '#1C1A18',
                  color: 'white',
                  fontFamily: 'var(--font-mono)'
                } 
              }}
            >
              {event.attendees.map((id) => (
                <Avatar key={id} alt="User" src={`https://i.pravatar.cc/150?u=${id}`} />
              ))}
            </AvatarGroup>
          ) : (
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, color: '#9B9691' }}>
              <Users size={14} strokeWidth={1.5} />
              <Typography variant="caption" sx={{ fontWeight: 600, fontFamily: 'var(--font-satoshi)' }}>No attendees</Typography>
            </Box>
          )}
          <IconButton 
            size="small" 
            onClick={handleMenuClick}
            sx={{
              color: '#9B9691',
              border: '1px solid #34322F',
              bgcolor: '#1C1A18',
              '&:hover': {
                color: 'white',
                bgcolor: '#34322F',
              },
            }}
          >
            <MoreVertical size={16} strokeWidth={1.5} />
          </IconButton>
        </Box>
      </CardContent>

      <Menu
        anchorEl={anchorEl}
        open={Boolean(anchorEl)}
        onClose={handleMenuClose}
        PaperProps={{
          sx: { 
            minWidth: 180, 
            borderRadius: '16px',
            bgcolor: '#161412',
            border: '1px solid #34322F',
            boxShadow: '0 12px 24px -10px rgba(0,0,0,1)',
            backgroundImage: 'none',
            '& .MuiMenuItem-root': {
              py: 1.2,
              gap: 1.5,
              color: '#9B9691',
              fontFamily: 'var(--font-satoshi)',
              '&:hover': { bgcolor: '#1C1A18', color: 'white' }
            }
          },
        }}
      >
        <MenuItem onClick={handleMenuClose}>
          <ListItemIcon sx={{ minWidth: 'auto !important', color: 'inherit' }}><Share2 size={16} strokeWidth={1.5} /></ListItemIcon>
          <ListItemText primary="Share Event" primaryTypographyProps={{ fontSize: '0.85rem', fontWeight: 800 }} />
        </MenuItem>
      </Menu>
    </Card>
  );
}
