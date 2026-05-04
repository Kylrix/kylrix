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
    FileText,
    Search,
    X,
    FileCheck,
    AlertCircle
} from 'lucide-react';
import { EcosystemService } from '@/lib/services/ecosystem';
import { useAuth } from '@/lib/auth';

interface NoteSelectorModalProps {
    open: boolean;
    onClose: () => void;
    onSelect: (note: any) => void;
}

export const NoteSelectorModal = ({ open, onClose, onSelect }: NoteSelectorModalProps) => {
    const theme = useTheme();
    const isMobile = useMediaQuery(theme.breakpoints.down('md'));
    const { user } = useAuth();
    const [notes, setNotes] = useState<any[]>([]);
    const [loading, setLoading] = useState(false);
    const [searchQuery, setSearchQuery] = useState('');

    const loadNotes = useCallback(async () => {
        if (!user?.$id) return;
        setLoading(true);
        try {
            const response = await EcosystemService.listNotes(user.$id);
            // Smart filter: only public notes
            const publicNotes = response.rows.filter((n: any) => n.isPublic === true);
            setNotes(publicNotes);
        } catch (error: unknown) {
            console.error('Failed to load notes:', error);
        } finally {
            setLoading(false);
        }
    }, [user?.$id]);

    useEffect(() => {
        if (open && user) {
            loadNotes();
        }
    }, [open, user, loadNotes]);

    const filteredNotes = notes.filter(note => 
        note.title?.toLowerCase().includes(searchQuery.toLowerCase()) ||
        note.content?.toLowerCase().includes(searchQuery.toLowerCase())
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
                        bgcolor: alpha('#6366F1', 0.1), 
                        color: '#6366F1',
                        display: 'flex'
                    }}>
                        <FileText size={24} strokeWidth={1.5} />
                    </Box>
                    <Box>
                        <Typography variant="h6" sx={{ fontWeight: 900, fontFamily: 'var(--font-space-grotesk)', letterSpacing: '-0.02em', lineHeight: 1.2 }}>
                            Attach Cognitive Note
                        </Typography>
                        <Typography variant="caption" sx={{ color: 'rgba(255, 255, 255, 0.4)', fontWeight: 600 }}>
                            Select a public note from your Kylrix Note vault
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
                            borderColor: alpha('#6366F1', 0.5),
                            bgcolor: 'rgba(255, 255, 255, 0.05)',
                        }
                    }}
                >
                    <Search size={18} color="rgba(255, 255, 255, 0.3)" strokeWidth={1.5} />
                    <Box sx={{ width: 12 }} />
                    <InputBase
                        autoFocus
                        placeholder="Search your notes..."
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
                        <CircularProgress size={32} sx={{ color: '#6366F1' }} />
                        <Typography variant="caption" sx={{ color: 'rgba(255, 255, 255, 0.4)', fontWeight: 700, letterSpacing: '0.1em' }}>
                            ACCESSING VAULT...
                        </Typography>
                    </Box>
                ) : filteredNotes.length > 0 ? (
                    <List sx={{ pt: 0 }}>
                        {filteredNotes.map((note) => (
                            <ListItem 
                                key={note.$id} 
                                component="div"
                                onClick={() => {
                                    onSelect(note);
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
                                        borderColor: alpha('#6366F1', 0.3),
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
                                        color: '#6366F1'
                                    }}>
                                        <FileCheck size={20} strokeWidth={1.5} />
                                    </Box>
                                </ListItemIcon>
                                <ListItemText 
                                    primary={note.title || 'Untitled Note'} 
                                    secondary={
                                        <Typography variant="caption" noWrap sx={{ color: 'rgba(255, 255, 255, 0.4)', display: 'block', mt: 0.5, overflow: 'hidden', textOverflow: 'ellipsis' }}>
                                            {note.content?.substring(0, 100).replace(/[#*`]/g, '')}
                                        </Typography>
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
                            {searchQuery ? 'NO_MATCHING_NOTES' : 'VAULT_EMPTY_OR_PRIVATE'}
                        </Typography>
                        <Typography variant="body2" sx={{ color: 'rgba(255, 255, 255, 0.4)', lineHeight: 1.6 }}>
                            {searchQuery 
                                ? `No public notes found matching "${searchQuery}".` 
                                : 'Only notes marked as "Public" in Kylrix Note can be shared in the ecosystem feed.'}
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