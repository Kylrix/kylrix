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
        border: '1px solid rgba(255, 255, 255, 0.08)',
        borderRadius: '24px',
        cursor: 'pointer',
        transition: 'all 0.3s cubic-bezier(0.4, 0, 0.2, 1)',
        overflow: 'hidden',
        '&:hover': {
          transform: 'translateY(-4px)',
          boxShadow: '0 12px 32px rgba(0, 0, 0, 0.4)',
          borderColor: 'rgba(99, 102, 241, 0.3)',
          '& .event-image': {
            transform: 'scale(1.05)',
          },
        },
        height: '100%',
        display: 'flex',
        flexDirection: 'column',
        background: 'rgba(28, 26, 24, 0.98)',
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
            bgcolor: 'rgba(10, 10, 10, 0.95)',
            borderRadius: '12px',
            px: 1.5,
            py: 0.75,
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            minWidth: 48,
            border: '1px solid rgba(255, 255, 255, 0.1)',
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
              fontFamily: 'var(--font-space-grotesk)',
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
              bgcolor: dateLabel === 'Today' 
                ? 'rgba(76, 175, 80, 0.9)'
                : 'rgba(33, 150, 243, 0.9)',
              color: 'black',
              border: `1px solid ${dateLabel === 'Today' ? 'rgba(76, 175, 80, 0.3)' : 'rgba(33, 150, 243, 0.3)'}`,
              fontWeight: 800,
              fontSize: '0.65rem',
              height: 22,
              textTransform: 'uppercase',
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
              fontFamily: 'var(--font-space-grotesk)',
              color: 'white',
            }}
          >
            {event.title}
          </Typography>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, color: 'rgba(255, 255, 255, 0.5)', mb: 0.75 }}>
            <Clock size={14} strokeWidth={1.5} />
            <Typography variant="body2" sx={{ fontSize: '0.75rem', fontWeight: 600 }}>
              {format(new Date(event.startTime), 'h:mm a')} - {format(new Date(event.endTime), 'h:mm a')}
            </Typography>
          </Box>
          {event.location && (
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, color: 'rgba(255, 255, 255, 0.5)' }}>
              <MapPin size={14} strokeWidth={1.5} />
              <Typography variant="body2" noWrap sx={{ fontSize: '0.75rem', fontWeight: 600 }}>
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
                  border: '2px solid #0F0D0C',
                  bgcolor: 'rgba(255, 255, 255, 0.05)',
                } 
              }}
            >
              {event.attendees.map((id) => (
                <Avatar key={id} alt="User" src={`https://i.pravatar.cc/150?u=${id}`} />
              ))}
            </AvatarGroup>
          ) : (
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, color: 'rgba(255, 255, 255, 0.3)' }}>
              <Users size={14} strokeWidth={1.5} />
              <Typography variant="caption" sx={{ fontWeight: 600 }}>No attendees</Typography>
            </Box>
          )}
          <IconButton 
            size="small" 
            onClick={handleMenuClick}
            sx={{
              color: 'rgba(255, 255, 255, 0.4)',
              '&:hover': {
                color: 'white',
                bgcolor: 'rgba(255, 255, 255, 0.05)',
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
            backgroundColor: 'rgba(22, 20, 18, 0.99)',
            border: '1px solid rgba(255, 255, 255, 0.08)',
            boxShadow: '0 10px 30px rgba(0,0,0,0.5)',
            backgroundImage: 'none',
          },
        }}
      >
        <MenuItem onClick={handleMenuClose} sx={{ py: 1.2, gap: 1.5 }}>
          <ListItemIcon sx={{ minWidth: 'auto !important' }}><Share2 size={16} strokeWidth={1.5} color="rgba(255, 255, 255, 0.6)" /></ListItemIcon>
          <ListItemText primary="Share Event" primaryTypographyProps={{ fontSize: '0.85rem', fontWeight: 600 }} />
        </MenuItem>
      </Menu>
    </Card>
  );
}
