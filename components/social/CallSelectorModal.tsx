'use client';

import React, { useEffect, useState, useCallback } from 'react';
import { 
    Drawer,
    DialogTitle, 
    DialogContent, 
    DialogActions, 
    Button, 
    List, 
    ListItem, 
    ListItemText, 
    ListItemIcon,
    Typography,
    CircularProgress,
    Box,
    IconButton,
    alpha,
    InputBase
} from '@mui/material';
import {
    Phone,
    Video,
    Search,
    X,
    Clock,
    AlertCircle
} from 'lucide-react';
import { CallService } from '@/lib/services/call';
import { useAuth } from '@/lib/auth';

interface CallSelectorModalProps {
    open: boolean;
    onClose: () => void;
    onSelect: (call: any) => void;
}

export const CallSelectorModal = ({ open, onClose, onSelect }: CallSelectorModalProps) => {
    const { user } = useAuth();
    const [calls, setCalls] = useState<any[]>([]);
    const [loading, setLoading] = useState(false);
    const [searchQuery, setSearchQuery] = useState('');

    const loadCalls = useCallback(async () => {
        if (!user?.$id) return;
        setLoading(true);
        try {
            const response = await CallService.getCallHistory(user.$id);
            // Only show links (not direct calls) and only if they are not expired
            const activeLinks = response.filter((c: any) => c.isLink && !c.isExpired);
            setCalls(activeLinks);
        } catch (error: unknown) {
            console.error('Failed to load calls:', error);
        } finally {
            setLoading(false);
        }
    }, [user?.$id]);

    useEffect(() => {
        if (open && user) {
            loadCalls();
        }
    }, [open, user, loadCalls]);

    const filteredCalls = calls.filter(call => 
        call.title?.toLowerCase().includes(searchQuery.toLowerCase()) ||
        call.type?.toLowerCase().includes(searchQuery.toLowerCase())
    );

    return (
        <Drawer 
            open={open} 
            onClose={onClose} 
            PaperProps={{ 
                sx: { 
                    borderRadius: '24px 24px 0 0',
                    bgcolor: 'rgba(10, 10, 10, 0.9)',
                    backdropFilter: 'blur(25px) saturate(180%)',
                    border: '1px solid rgba(255, 255, 255, 0.1)',
                    backgroundImage: 'none',
                    boxShadow: '0 24px 48px rgba(0,0,0,0.5)',
                    overflow: 'hidden',
                    maxHeight: '88vh',
                    width: '100%'
                } 
            }}
            anchor="bottom"
        >
            <DialogTitle sx={{ 
                p: 3, 
                pb: 2, 
                display: 'flex', 
                alignItems: 'center', 
                justifyContent: 'space-between',
                borderBottom: '1px solid rgba(255, 255, 255, 0.05)'
            }}>
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
                    <Box sx={{ 
                        p: 1, 
                        borderRadius: '12px', 
                        bgcolor: alpha('#F59E0B', 0.1), 
                        color: '#F59E0B',
                        display: 'flex'
                    }}>
                        <Phone size={24} strokeWidth={1.5} />
                    </Box>
                    <Box>
                        <Typography variant="h6" sx={{ fontWeight: 900, fontFamily: 'var(--font-space-grotesk)', letterSpacing: '-0.02em', lineHeight: 1.2 }}>
                            Attach Call Link
                        </Typography>
                        <Typography variant="caption" sx={{ color: 'rgba(255, 255, 255, 0.4)', fontWeight: 600 }}>
                            Select an active call link to share
                        </Typography>
                    </Box>
                </Box>
                <IconButton onClick={onClose} sx={{ color: 'rgba(255, 255, 255, 0.3)', '&:hover': { color: 'white', bgcolor: 'rgba(255, 255, 255, 0.05)' } }}>
                    <X size={20} />
                </IconButton>
            </DialogTitle>

            <DialogContent sx={{ p: 3, mt: 1 }}>
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
                            borderColor: alpha('#F59E0B', 0.5),
                            bgcolor: 'rgba(255, 255, 255, 0.05)',
                        }
                    }}
                >
                    <Search size={18} color="rgba(255, 255, 255, 0.3)" strokeWidth={1.5} />
                    <Box sx={{ width: 12 }} />
                    <InputBase
                        autoFocus
                        placeholder="Search your call links..."
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
                        <CircularProgress size={32} sx={{ color: '#F59E0B' }} />
                        <Typography variant="caption" sx={{ color: 'rgba(255, 255, 255, 0.4)', fontWeight: 700, letterSpacing: '0.1em' }}>
                            FETCHING CALLS...
                        </Typography>
                    </Box>
                ) : filteredCalls.length > 0 ? (
                    <List sx={{ pt: 0 }}>
                        {filteredCalls.map((call) => (
                            <ListItem 
                                key={call.$id} 
                                component="div"
                                onClick={() => {
                                    onSelect(call);
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
                                        borderColor: alpha('#F59E0B', 0.3),
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
                                        color: '#F59E0B'
                                    }}>
                                        {call.type === 'video' ? <Video size={20} strokeWidth={1.5} /> : <Phone size={20} strokeWidth={1.5} />}
                                    </Box>
                                </ListItemIcon>
                                <ListItemText 
                                    primary={call.title || `${call.type.charAt(0).toUpperCase() + call.type.slice(1)} Call`} 
                                    secondary={
                                        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mt: 0.5, color: 'rgba(255, 255, 255, 0.4)' }}>
                                            <Clock size={12} />
                                            <Typography variant="caption" sx={{ fontWeight: 600 }}>
                                                Starts: {new Date(call.startsAt).toLocaleString()}
                                            </Typography>
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
                            {searchQuery ? 'NO_MATCHING_CALLS' : 'NO_ACTIVE_CALL_LINKS'}
                        </Typography>
                        <Typography variant="body2" sx={{ color: 'rgba(255, 255, 255, 0.4)', lineHeight: 1.6 }}>
                            {searchQuery 
                                ? `No call links found matching "${searchQuery}".` 
                                : 'You don\'t have any active call links. Create one in the Calls section first.'}
                        </Typography>
                    </Box>
                )}
            </DialogContent>
            
            <DialogActions sx={{ p: 3, pt: 0 }}>
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
            </DialogActions>
        </Drawer>
    );
};
