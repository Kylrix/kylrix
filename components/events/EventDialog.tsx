'use client';

import React, { useState } from 'react';
import {
  Drawer,
  TextField,
  Button,
  Box,
  IconButton,
  Typography,
  Divider,
  InputAdornment,
  ToggleButtonGroup,
  ToggleButton,
  alpha,
  Switch,
  useTheme,
  useMediaQuery,
} from '@mui/material';
import {
  Close as CloseIcon,
  LocationOn,
  Link as LinkIcon,
  Public as PublicIcon,
  Lock as PrivateIcon,
  LinkOff as UnlistedIcon,
  VideoCall as VideoIcon,
} from '@mui/icons-material';
import { DateTimePicker } from '@mui/x-date-pickers/DateTimePicker';
import { LocalizationProvider } from '@mui/x-date-pickers/LocalizationProvider';
import { AdapterDateFns } from '@mui/x-date-pickers/AdapterDateFns';
import { addHours } from 'date-fns';
import { EventVisibility } from '@/lib/permissions';
import UserSearch from '@/components/UserSearch';

interface User {
  id: string;
  title: string;
  subtitle: string;
  avatar?: string | null;
  profilePicId?: string | null;
}

interface EventDialogProps {
  open: boolean;
  onClose: () => void;
  onSubmit: (eventData: any) => void;
}

export const EventDialog: React.FC<EventDialogProps> = ({ open, onClose, onSubmit }) => {
  const theme = useTheme();
  const isMobile = useMediaQuery(theme.breakpoints.down('md'));
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [startTime, setStartTime] = useState<Date | null>(new Date());
  const [endTime, setEndTime] = useState<Date | null>(addHours(new Date(), 1));
  const [location, setLocation] = useState('');
  const [url, setUrl] = useState('');
  const [coverImage, setCoverImage] = useState('');
  const [visibility, setVisibility] = useState<EventVisibility>('public');
  const [selectedGuests, setSelectedGuests] = useState<User[]>([]);
  const [autoCreateCall, setAutoCreateCall] = useState(false);

  const handleSubmit = () => {
    if (!title.trim() || !startTime || !endTime) return;

    onSubmit({
      title,
      description,
      startTime,
      endTime,
      location,
      url,
      coverImage,
      visibility,
      guests: selectedGuests.map(g => g.id),
      autoCreateCall
    });

    resetForm();
  };

  const resetForm = () => {
    setTitle('');
    setDescription('');
    setStartTime(new Date());
    setEndTime(addHours(new Date(), 1));
    setLocation('');
    setUrl('');
    setCoverImage('');
    setVisibility('public');
    setSelectedGuests([]);
    setAutoCreateCall(false);
  };

  const handleClose = () => {
    onClose();
    resetForm();
  };

  return (
    <LocalizationProvider dateAdapter={AdapterDateFns}>
      <Drawer
        anchor={isMobile ? 'bottom' : 'right'}
        open={open}
        onClose={handleClose}
        ModalProps={{ keepMounted: true }}
        PaperProps={{
          sx: {
            width: isMobile ? '100%' : 'min(100vw, 600px)',
            maxWidth: '100%',
            height: isMobile ? '92dvh' : '100%',
            maxHeight: '100dvh',
            bgcolor: 'rgba(10, 10, 10, 0.9)',
            backdropFilter: 'blur(25px) saturate(180%)',
            border: '1px solid rgba(255, 255, 255, 0.1)',
            backgroundImage: 'none',
            borderRadius: isMobile ? '24px 24px 0 0' : '0',
            display: 'flex',
            flexDirection: 'column'
          },
        }}
      >
        {/* Header */}
        <Box
          sx={{
            p: 3,
            pb: 2,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            borderBottom: '1px solid rgba(255, 255, 255, 0.05)',
            flexShrink: 0
          }}
        >
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
            <Box sx={{ 
              p: 1, 
              borderRadius: '12px', 
              bgcolor: alpha('#6366F1', 0.1), 
              color: '#6366F1',
              display: 'flex'
            }}>
              <VideoIcon sx={{ fontSize: 24 }} />
            </Box>
            <Box>
              <Typography variant="h6" sx={{ fontWeight: 900, fontFamily: 'var(--font-clash)', letterSpacing: '-0.02em', lineHeight: 1.2 }}>
                Create New Event
              </Typography>
              <Typography variant="caption" sx={{ color: 'rgba(255, 255, 255, 0.4)', fontWeight: 600 }}>
                Orchestrate a new moment in the ecosystem
              </Typography>
            </Box>
          </Box>
          <IconButton onClick={handleClose} sx={{ color: 'rgba(255, 255, 255, 0.3)', '&:hover': { color: 'white', bgcolor: 'rgba(255, 255, 255, 0.05)' } }}>
            <CloseIcon sx={{ fontSize: 20 }} />
          </IconButton>
        </Box>

        {/* Content */}
        <Box sx={{ 
          p: 3, 
          mt: 1,
          flex: 1,
          overflowY: 'auto',
          overflowX: 'hidden',
          '&::-webkit-scrollbar': {
            width: '6px'
          },
          '&::-webkit-scrollbar-track': {
            bgcolor: 'transparent'
          },
          '&::-webkit-scrollbar-thumb': {
            bgcolor: 'rgba(255, 255, 255, 0.1)',
            borderRadius: '3px',
            '&:hover': {
              bgcolor: 'rgba(255, 255, 255, 0.2)'
            }
          }
        }}>
          <Box sx={{ display: 'flex', flexDirection: 'column', gap: 3 }}>
            {/* Title */}
            <TextField
              autoFocus
              placeholder="Event Title"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              fullWidth
              variant="standard"
              InputProps={{
                disableUnderline: true,
                sx: { 
                  fontSize: '1.5rem', 
                  fontWeight: 900,
                  fontFamily: 'var(--font-clash)',
                  color: 'white',
                  '&::placeholder': { color: 'rgba(255, 255, 255, 0.2)', opacity: 1 }
                },
              }}
            />

            {/* Description */}
            <TextField
              placeholder="Add description or agenda..."
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              fullWidth
              multiline
              rows={2}
              variant="standard"
              InputProps={{
                disableUnderline: true,
                sx: { 
                  fontSize: '1rem', 
                  fontWeight: 500,
                  color: 'rgba(255, 255, 255, 0.7)',
                  '&::placeholder': { color: 'rgba(255, 255, 255, 0.3)', opacity: 1 }
                },
              }}
            />

            <Divider sx={{ opacity: 0.05 }} />

            {/* Date Time Row */}
            <Box sx={{ display: 'flex', gap: 2, flexDirection: { xs: 'column', sm: 'row' } }}>
              <Box sx={{ flex: 1 }}>
                <Typography variant="caption" sx={{ color: 'rgba(255, 255, 255, 0.4)', fontWeight: 700, mb: 1, display: 'block', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                  Starts At
                </Typography>
                <DateTimePicker
                  value={startTime}
                  onChange={(newValue) => setStartTime(newValue)}
                  slotProps={{ 
                    textField: { 
                      fullWidth: true,
                      variant: 'standard',
                      InputProps: { 
                        disableUnderline: true,
                        sx: { 
                          bgcolor: 'rgba(255, 255, 255, 0.03)', 
                          p: 1.5, 
                          borderRadius: '12px',
                          border: '1px solid rgba(255, 255, 255, 0.05)',
                          fontSize: '0.9rem',
                          fontWeight: 600
                        } 
                      }
                    } 
                  }}
                />
              </Box>
              <Box sx={{ flex: 1 }}>
                <Typography variant="caption" sx={{ color: 'rgba(255, 255, 255, 0.4)', fontWeight: 700, mb: 1, display: 'block', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                  Ends At
                </Typography>
                <DateTimePicker
                  value={endTime}
                  onChange={(newValue) => setEndTime(newValue)}
                  slotProps={{ 
                    textField: { 
                      fullWidth: true,
                      variant: 'standard',
                      InputProps: { 
                        disableUnderline: true,
                        sx: { 
                          bgcolor: 'rgba(255, 255, 255, 0.03)', 
                          p: 1.5, 
                          borderRadius: '12px',
                          border: '1px solid rgba(255, 255, 255, 0.05)',
                          fontSize: '0.9rem',
                          fontWeight: 600
                        } 
                      }
                    } 
                  }}
                />
              </Box>
            </Box>

            {/* Location & Link Row */}
            <Box sx={{ display: 'flex', gap: 2, flexDirection: { xs: 'column', sm: 'row' } }}>
              <TextField
                placeholder="Location (Physical or Virtual)"
                value={location}
                onChange={(e) => setLocation(e.target.value)}
                fullWidth
                variant="standard"
                InputProps={{
                  disableUnderline: true,
                  startAdornment: (
                    <InputAdornment position="start">
                      <LocationOn sx={{ fontSize: 18, color: '#6366F1' }} />
                    </InputAdornment>
                  ),
                  sx: { 
                    bgcolor: 'rgba(255, 255, 255, 0.03)', 
                    p: 1.5, 
                    borderRadius: '12px', 
                    border: '1px solid rgba(255, 255, 255, 0.05)',
                    fontSize: '0.9rem',
                    fontWeight: 600
                  }
                }}
              />
              <TextField
                placeholder="External Link (Optional)"
                value={url}
                onChange={(e) => setUrl(e.target.value)}
                fullWidth
                variant="standard"
                InputProps={{
                  disableUnderline: true,
                  startAdornment: (
                    <InputAdornment position="start">
                      <LinkIcon sx={{ fontSize: 18, color: '#6366F1' }} />
                    </InputAdornment>
                  ),
                  sx: { 
                    bgcolor: 'rgba(255, 255, 255, 0.03)', 
                    p: 1.5, 
                    borderRadius: '12px',
                    border: '1px solid rgba(255, 255, 255, 0.05)',
                    fontSize: '0.9rem',
                    fontWeight: 600
                  }
                }}
              />
            </Box>

            {/* Auto-create Call */}
            <Box sx={{ 
              display: 'flex', 
              alignItems: 'center', 
              justifyContent: 'space-between',
              p: 2,
              borderRadius: '16px',
              bgcolor: alpha('#6366F1', 0.05),
              border: `1px solid ${alpha('#6366F1', 0.1)}`,
              transition: 'all 0.2s ease',
              '&:hover': { bgcolor: alpha('#6366F1', 0.08) }
            }}>
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
                <Box sx={{ p: 1, bgcolor: alpha('#6366F1', 0.1), borderRadius: '10px', color: '#6366F1' }}>
                  <VideoIcon sx={{ fontSize: 20 }} />
                </Box>
                <Box>
                    <Typography variant="subtitle2" fontWeight={800} sx={{ color: 'white' }}>
                    Kylrix Connect Call
                    </Typography>
                    <Typography variant="caption" sx={{ color: 'rgba(255, 255, 255, 0.5)', fontWeight: 600 }}>
                     Create a secure video call link for this event
                    </Typography>
                  </Box>
                </Box>
              <Switch 
                checked={autoCreateCall}
                onChange={(e) => setAutoCreateCall(e.target.checked)}
                sx={{
                  '& .MuiSwitch-switchBase.Mui-checked': { color: '#6366F1' },
                  '& .MuiSwitch-switchBase.Mui-checked + .MuiSwitch-track': { backgroundColor: '#6366F1' },
                }}
              />
            </Box>

            {/* Visibility */}
            <Box>
              <Typography variant="caption" sx={{ color: 'rgba(255, 255, 255, 0.4)', fontWeight: 700, mb: 1.5, display: 'block', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                Event Visibility
              </Typography>
              <ToggleButtonGroup
                value={visibility}
                exclusive
                onChange={(_, value) => value && setVisibility(value)}
                fullWidth
                sx={{
                  gap: 1,
                  '& .MuiToggleButtonGroup-grouped': {
                    border: '1px solid rgba(255, 255, 255, 0.05) !important',
                    borderRadius: '12px !important',
                    color: 'rgba(255, 255, 255, 0.4)',
                    textTransform: 'none',
                    fontWeight: 700,
                    fontSize: '0.85rem',
                    bgcolor: 'rgba(255, 255, 255, 0.02)',
                    '&.Mui-selected': {
                      bgcolor: alpha('#6366F1', 0.1),
                      color: '#6366F1',
                      borderColor: alpha('#6366F1', 0.3) + ' !important',
                    },
                    '&:hover': {
                      bgcolor: 'rgba(255, 255, 255, 0.05)',
                    }
                  },
                }}
              >
                <ToggleButton value="public">
                  <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                    <PublicIcon sx={{ fontSize: 16 }} />
                    Public
                  </Box>
                </ToggleButton>
                <ToggleButton value="unlisted">
                  <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                    <UnlistedIcon sx={{ fontSize: 16 }} />
                    Unlisted
                  </Box>
                </ToggleButton>
                <ToggleButton value="private">
                  <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                    <PrivateIcon sx={{ fontSize: 16 }} />
                    Private
                  </Box>
                </ToggleButton>
              </ToggleButtonGroup>
            </Box>

            {/* Guests */}
            <UserSearch
              label="INVITE GUESTS"
              placeholder="Search people to invite..."
              selectedUsers={selectedGuests}
              onSelect={(user) => setSelectedGuests(prev => [...prev, user])}
              onRemove={(userId) => setSelectedGuests(prev => prev.filter(u => u.id !== userId))}
            />
          </Box>
        </Box>

        {/* Footer */}
        <Box sx={{ 
          p: 3, 
          pt: 1, 
          gap: 1.5,
          display: 'flex',
          flexDirection: 'column',
          borderTop: '1px solid rgba(255, 255, 255, 0.05)',
          flexShrink: 0
        }}>
          <Button 
            onClick={handleClose} 
            fullWidth
            sx={{ 
              color: 'rgba(255, 255, 255, 0.5)', 
              fontWeight: 700, 
              textTransform: 'none',
              borderRadius: '12px',
              py: 1.5,
              '&:hover': { color: 'white', bgcolor: 'rgba(255, 255, 255, 0.05)' }
            }}
          >
            Cancel
          </Button>
          <Button
            onClick={handleSubmit}
            fullWidth
            variant="contained"
            disabled={!title.trim() || !startTime || !endTime}
            sx={{
              borderRadius: '12px',
              px: 4,
              py: 1.5,
              fontWeight: 800,
              textTransform: 'none',
              bgcolor: '#6366F1',
              color: 'white',
              boxShadow: '0 8px 24px rgba(99, 102, 241, 0.3)',
              '&:hover': { 
                bgcolor: alpha('#6366F1', 0.8),
                boxShadow: '0 12px 28px rgba(99, 102, 241, 0.4)',
              },
              '&.Mui-disabled': {
                bgcolor: 'rgba(255, 255, 255, 0.05)',
                color: 'rgba(255, 255, 255, 0.2)'
              }
            }}
          >
            Create Event
          </Button>
        </Box>
      </Drawer>
    </LocalizationProvider>
  );
}

export default EventDialog;
