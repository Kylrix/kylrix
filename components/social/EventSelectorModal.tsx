'use client';

import React, { useEffect, useState, useCallback } from 'react';
import { 
    Drawer, 
    Button, 
    List, 
    ListItem, 
    ListItemText, 
    ListItemIcon,
    Typography,
    DialogTitle,
    CircularProgress,
    Box,
    IconButton,
    alpha,
    Fade as _Fade,
    InputBase,
    useTheme,
    useMediaQuery,
} from '@mui/material';
import {
    Calendar,
    Search,
    X,
    Clock,
    MapPin,
    AlertCircle
} from 'lucide-react';
import { EcosystemService } from '@/lib/services/ecosystem';
import { useAuth } from '@/lib/auth';

interface EventSelectorModalProps {
    open: boolean;
    onClose: () => void;
    onSelect: (event: any) => void;
}

export const EventSelectorModal = ({ open, onClose, onSelect }: EventSelectorModalProps) => {
    const theme = useTheme();
    const isMobile = useMediaQuery(theme.breakpoints.down('md'));
    const { user } = useAuth();
    const [events, setEvents] = useState<any[]>([]);
    const [loading, setLoading] = useState(false);
    const [searchQuery, setSearchQuery] = useState('');

    const loadEvents = useCallback(async () => {
        if (!user?.$id) return;
        setLoading(true);
        try {
            const response = await EcosystemService.listEvents(user.$id);
            // Smart filter: ONLY public events from Kylrix Flow
            const publicEvents = response.rows.filter((e: any) => e.visibility === 'public');
            setEvents(publicEvents);
        } catch (error: unknown) {
            console.error('Failed to load events:', error);
        } finally {
            setLoading(false);
        }
    }, [user]);

    useEffect(() => {
        if (open && user) {
            loadEvents();
        }
    }, [open, user, loadEvents]);

    const filteredEvents = events.filter(event => 
        event.title?.toLowerCase().includes(searchQuery.toLowerCase()) ||
        event.description?.toLowerCase().includes(searchQuery.toLowerCase())
    );

    return (
        <Drawer 
            anchor={isMobile ? 'bottom' : 'right'}
            open={open} 
            onClose={onClose} 
            PaperProps={{ 
                sx: { 
                    width: isMobile ? '100%' : 'min(100vw, 500px)',
                    maxWidth: '100%',
                    height: isMobile ? 'auto' : '100%',
                    maxHeight: isMobile ? '92dvh' : '100%',
                    borderRadius: isMobile ? '28px 28px 0 0' : '0',
                    bgcolor: 'rgba(10, 10, 10, 0.9)',
                    backdropFilter: 'blur(25px) saturate(180%)',
                    border: '1px solid rgba(255, 255, 255, 0.1)',
                    backgroundImage: 'none',
                    boxShadow: '0 24px 48px rgba(0,0,0,0.5)',
                    overflow: 'hidden',
                    display: 'flex',
                    flexDirection: 'column',
                } 
            }}
        >
            <DialogTitle sx={{ 
                p: 3, 
                pb: 2, 
                display: 'flex', 
                alignItems: 'center', 
                justifyContent: 'space-between',
                borderBottom: '1px solid rgba(255, 255, 255, 0.05)',
                flexShrink: 0,
            }}>
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
                    <Box sx={{ 
                        p: 1, 
                        borderRadius: '12px', 
                        bgcolor: alpha('#00A3FF', 0.1), 
                        color: '#00A3FF',
                        display: 'flex'
                    }}>
                        <Calendar size={24} strokeWidth={1.5} />
                    </Box>
                    <Box>
                        <Typography variant="h6" sx={{ fontWeight: 900, fontFamily: 'var(--font-space-grotesk)', letterSpacing: '-0.02em', lineHeight: 1.2 }}>
                            Attach Orchestrated Event
                        </Typography>
                        <Typography variant="caption" sx={{ color: 'rgba(255, 255, 255, 0.4)', fontWeight: 600 }}>
                            Select a public event from your Kylrix Flow calendar
                        </Typography>
                    </Box>
                </Box>
                <IconButton onClick={onClose} sx={{ color: 'rgba(255, 255, 255, 0.3)', '&:hover': { color: 'white', bgcolor: 'rgba(255, 255, 255, 0.05)' } }}>
                    <X size={20} />
                </IconButton>
            </DialogTitle>

            <Box sx={{ p: 3, mt: 1, flex: 1, overflowY: 'auto' }}>
                <Box
                    sx={{
                        display: 'flex',
                        alignItems: 'center',
                        bgcolor: 'rgba(255, 255, 255, 0.03)',
                        border: '1px solid rgba(255, 255, 255, 0.08)',
                        borderRadius: '16px',
                        px: 2,
                        py: 1,
                        mb: 3,
                        transition: 'all 0.2s ease',
                        '&:focus-within': {
                            borderColor: alpha('#00A3FF', 0.5),
                            bgcolor: 'rgba(255, 255, 255, 0.05)',
                        }
                    }}
                >
                    <Search size={18} color="rgba(255, 255, 255, 0.3)" strokeWidth={1.5} />
                    <Box sx={{ width: 12 }} />
                    <InputBase
                        autoFocus
                        placeholder="Search your events..."
                        fullWidth
                        value={searchQuery}
                        onChange={(e) => setSearchQuery(e.target.value)}
                        sx={{
                            color: 'white',
                            fontSize: '0.95rem',
                            fontWeight: 500,
                            '& .MuiInputBase-input::placeholder': {
                                color: 'rgba(255, 255, 255, 0.3)',
                                opacity: 1,
                            },
                        }}
                    />
                </Box>
                
                {loading ? (
                    <Box sx={{ display: 'flex', flexDirection: 'column', alignItems: 'center', py: 8, gap: 2 }}>
                        <CircularProgress size={32} sx={{ color: '#00A3FF' }} />
                        <Typography variant="caption" sx={{ color: 'rgba(255, 255, 255, 0.4)', fontWeight: 700, letterSpacing: '0.1em' }}>
                            SYNCING CALENDAR...
                        </Typography>
                    </Box>
                ) : filteredEvents.length > 0 ? (
                    <List sx={{ pt: 0 }}>
                        {filteredEvents.map((event) => (
                            <ListItem 
                                key={event.$id} 
                                component="div"
                                onClick={() => {
                                    onSelect(event);
                                    onClose();
                                }}
                                sx={{ 
                                    cursor: 'pointer', 
                                    borderRadius: '16px',
                                    p: 2,
                                    mb: 1.5,
                                    border: '1px solid rgba(255, 255, 255, 0.05)',
                                    bgcolor: 'rgba(255, 255, 255, 0.01)',
                                    transition: 'all 0.2s cubic-bezier(0.4, 0, 0.2, 1)',
                                    '&:hover': { 
                                        bgcolor: 'rgba(255, 255, 255, 0.04)',
                                        borderColor: alpha('#00A3FF', 0.3),
                                        transform: 'translateX(4px)'
                                    }
                                }}
                            >
                                <ListItemIcon sx={{ minWidth: 48 }}>
                                    <Box sx={{ 
                                        width: 36, 
                                        height: 36, 
                                        borderRadius: '10px', 
                                        bgcolor: 'rgba(255, 255, 255, 0.03)',
                                        display: 'flex',
                                        alignItems: 'center',
                                        justifyContent: 'center',
                                        color: '#00A3FF'
                                    }}>
                                        <Calendar size={20} strokeWidth={1.5} />
                                    </Box>
                                </ListItemIcon>
                                <ListItemText 
                                    primary={event.title || 'Untitled Event'} 
                                    secondary={
                                        <Box sx={{ display: 'flex', flexDirection: 'column', gap: 0.5, mt: 0.5 }}>
                                            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, color: 'rgba(255, 255, 255, 0.4)' }}>
                                                <Clock size={12} />
                                                <Typography variant="caption" sx={{ fontWeight: 600 }}>
                                                    {new Date(event.startTime).toLocaleDateString()} • {new Date(event.startTime).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                                                </Typography>
                                            </Box>
                                            {event.location && (
                                                <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, color: 'rgba(255, 255, 255, 0.4)' }}>
                                                    <MapPin size={12} />
                                                    <Typography variant="caption" sx={{ fontWeight: 600 }}>
                                                        {event.location}
                                                    </Typography>
                                                </Box>
                                            )}
                                        </Box>
                                    }
                                    primaryTypographyProps={{ 
                                        sx: { fontWeight: 800, color: 'white', fontSize: '0.95rem' } 
                                    }}
                                />
                            </ListItem>
                        ))}
                    </List>
                ) : (
                    <Box sx={{ textAlign: 'center', py: 8, px: 4 }}>
                        <Box sx={{ mb: 2, color: 'rgba(255, 255, 255, 0.1)' }}>
                            <AlertCircle size={48} strokeWidth={1} />
                        </Box>
                        <Typography sx={{ color: 'white', fontWeight: 800, mb: 1 }}>
                            {searchQuery ? 'NO_MATCHING_EVENTS' : 'CALENDAR_EMPTY_OR_PRIVATE'}
                        </Typography>
                        <Typography variant="body2" sx={{ color: 'rgba(255, 255, 255, 0.4)', lineHeight: 1.6 }}>
                            {searchQuery 
                                ? `No public events found matching "${searchQuery}".` 
                                : 'Only events marked as "Public" in Kylrix Flow can be shared in the ecosystem feed.'}
                        </Typography>
                    </Box>
                )}
            </Box>
            
            <Box sx={{ p: 3, pt: 0, display: 'flex', gap: 1, borderTop: '1px solid rgba(255, 255, 255, 0.05)', flexShrink: 0 }}>
                <Button 
                    onClick={onClose}
                    sx={{ 
                        borderRadius: '12px', 
                        px: 3, 
                        color: 'rgba(255, 255, 255, 0.5)',
                        fontWeight: 700,
                        textTransform: 'none',
                        '&:hover': { color: 'white', bgcolor: 'rgba(255, 255, 255, 0.05)' }
                    }}
                >
                    Cancel
                </Button>
            </Box>
        </Drawer>
    );
};