'use client';

import React from 'react';
import { 
    Drawer, 
    Box, 
    Typography, 
    IconButton, 
    Divider,
    Button,
    Paper,
    Stack,
    Link as MuiLink
} from '@mui/material';
import CloseIcon from '@mui/icons-material/Close';
import EventIcon from '@mui/icons-material/Event';
import LocationOnIcon from '@mui/icons-material/LocationOn';
import AccessTimeIcon from '@mui/icons-material/AccessTime';
import LanguageIcon from '@mui/icons-material/Language';

interface EventViewDrawerProps {
    open: boolean;
    onClose: () => void;
    event: any;
}

export const EventViewDrawer = ({ open, onClose, event }: EventViewDrawerProps) => {
    if (!event) return null;

    const startDate = new Date(event.startTime);
    const endDate = new Date(event.endTime);

    return (
        <Drawer
            anchor="right"
            open={open}
            onClose={onClose}
            PaperProps={{
                sx: { 
                    width: { xs: '100%', sm: 450 },
                    bgcolor: 'background.default',
                    borderLeft: '1px solid rgba(255, 255, 255, 0.08)'
                }
            }}
        >
            <Box sx={{ p: 3, display: 'flex', flexDirection: 'column', height: '100%' }}>
                <Box sx={{ display: 'flex', alignItems: 'center', mb: 3 }}>
                    <EventIcon color="primary" sx={{ mr: 1.5, fontSize: 28 }} />
                    <Typography variant="h6" fontWeight={800} sx={{ flex: 1 }}>
                        Event Details
                    </Typography>
                    <IconButton onClick={onClose} size="small" sx={{ bgcolor: 'rgba(255, 255, 255, 0.05)' }}>
                        <CloseIcon fontSize="small" />
                    </IconButton>
                </Box>

                <Paper 
                    elevation={0} 
                    variant="outlined" 
                    sx={{ 
                        p: 3, 
                        borderRadius: 4, 
                        bgcolor: 'rgba(255, 255, 255, 0.02)',
                        mb: 4
                    }}
                >
                    <Typography variant="h5" fontWeight={900} gutterBottom sx={{ color: 'primary.main', fontFamily: 'var(--font-space-grotesk)' }}>
                        {event.title || 'Untitled Event'}
                    </Typography>
                    
                    <Stack spacing={2} sx={{ mt: 3 }}>
                        <Box sx={{ display: 'flex', gap: 2, alignItems: 'flex-start' }}>
                            <AccessTimeIcon sx={{ color: 'rgba(255, 255, 255, 0.4)', fontSize: 20, mt: 0.3 }} />
                            <Box>
                                <Typography variant="subtitle2" fontWeight={700} color="white">
                                    {startDate.toLocaleDateString([], { weekday: 'long', month: 'long', day: 'numeric' })}
                                </Typography>
                                <Typography variant="caption" color="text.secondary">
                                    {startDate.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })} - {endDate.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                                </Typography>
                            </Box>
                        </Box>

                        {event.location && (
                            <Box sx={{ display: 'flex', gap: 2, alignItems: 'flex-start' }}>
                                <LocationOnIcon sx={{ color: 'rgba(255, 255, 255, 0.4)', fontSize: 20, mt: 0.3 }} />
                                <Box>
                                    <Typography variant="subtitle2" fontWeight={700} color="white">
                                        Location
                                    </Typography>
                                    <Typography variant="caption" color="text.secondary">
                                        {event.location}
                                    </Typography>
                                </Box>
                            </Box>
                        )}

                        {event.meetingUrl && (
                            <Box sx={{ display: 'flex', gap: 2, alignItems: 'flex-start' }}>
                                <LanguageIcon sx={{ color: 'rgba(255, 255, 255, 0.4)', fontSize: 20, mt: 0.3 }} />
                                <Box>
                                    <Typography variant="subtitle2" fontWeight={700} color="white">
                                        Online Meeting
                                    </Typography>
                                    <MuiLink href={event.meetingUrl} target="_blank" variant="caption" color="primary" sx={{ textDecoration: 'none', fontWeight: 600 }}>
                                        Join Meeting
                                    </MuiLink>
                                </Box>
                            </Box>
                        )}
                    </Stack>
                    
                    <Divider sx={{ my: 3, opacity: 0.1 }} />
                    
                    <Typography variant="subtitle2" fontWeight={700} color="white" gutterBottom>
                        Description
                    </Typography>
                    <Typography variant="body2" sx={{ color: 'text.secondary', lineHeight: 1.7 }}>
                        {event.description || 'No description provided.'}
                    </Typography>
                </Paper>

                <Box sx={{ mt: 'auto', display: 'flex', gap: 2 }}>
                    <Button 
                        fullWidth 
                        variant="contained" 
                        color="primary"
                        component="a"
                        href={`http://localhost:3003/events/${event.$id || event.id}`} // Assuming Flow app runs on 3003
                        target="_blank"
                        sx={{ borderRadius: 3, py: 1.5, fontWeight: 800, color: 'black' }}
                    >
                        Open in Flow
                    </Button>
                </Box>
            </Box>
        </Drawer>
    );
};