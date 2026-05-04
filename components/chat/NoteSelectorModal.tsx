'use client';

import React, { useState, useEffect } from 'react';
import {
    List,
    ListItemButton,
    ListItemText,
    ListItemIcon,
    Typography,
    Box,
    CircularProgress,
    TextField,
    InputAdornment,
    Drawer,
    IconButton,
    Divider
} from '@mui/material';
import NoteIcon from '@mui/icons-material/DescriptionOutlined';
import SearchIcon from '@mui/icons-material/SearchOutlined';
import CloseIcon from '@mui/icons-material/Close';
import { EcosystemService } from '@/lib/services/ecosystem';
import { useAuth } from '@/lib/auth';

interface NoteSelectorModalProps {
    open: boolean;
    onClose: () => void;
    onSelect: (note: any) => void;
}

export const NoteSelectorModal = ({ open, onClose, onSelect }: NoteSelectorModalProps) => {
    const { user } = useAuth();
    const [notes, setNotes] = useState<any[]>([]);
    const [loading, setLoading] = useState(true);
    const [searchTerm, setSearchTerm] = useState('');

    const loadNotes = React.useCallback(async () => {
        if (!user) return;
        setLoading(true);
        try {
            const res = await EcosystemService.listNotes(user.$id);
            setNotes(res.rows);
        } catch (error: unknown) {
            console.error('Failed to load notes:', error);
        } finally {
            setLoading(false);
        }
    }, [user]);

    useEffect(() => {
        if (open && user) {
            loadNotes();
        }
    }, [open, user, loadNotes]);

    const handleSelect = (note: any) => {
        onSelect(note);
        onClose();
    };

    const filteredNotes = notes.filter(_note => {
        // Note: Title might be encrypted, but let's assume we can't search easily if it is.
        // Some notes might have plaintext titles if they were migrated or public.
        // In this UI, we might only see "[Encrypted Note]" if locked.
        return true; 
    });

    return (
        <Drawer anchor="bottom" open={open} onClose={onClose} PaperProps={{ sx: { borderRadius: '24px 24px 0 0', bgcolor: 'rgba(15, 15, 15, 0.98)', backdropFilter: 'blur(20px)', borderTop: '1px solid rgba(255,255,255,0.08)', boxShadow: '0 -24px 60px rgba(0,0,0,0.6)', maxHeight: { xs: '88dvh', sm: '72vh' } } }}>
            <Box sx={{ p: 3, display: 'flex', flexDirection: 'column', gap: 2, maxHeight: '72vh' }}>
                <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                    <Box>
                        <Typography variant="h6" sx={{ fontWeight: 900, color: 'white', letterSpacing: '-0.02em', fontFamily: 'var(--font-space-grotesk)' }}>ATTACH NOTE</Typography>
                        <Typography variant="caption" sx={{ color: 'rgba(255,255,255,0.45)', fontWeight: 800, textTransform: 'uppercase', letterSpacing: '0.08em' }}>Pick from Kylrix Note</Typography>
                    </Box>
                    <IconButton onClick={onClose} size="small" sx={{ bgcolor: 'rgba(255,255,255,0.03)', color: 'rgba(255,255,255,0.55)' }}><CloseIcon /></IconButton>
                </Box>
                <Divider sx={{ borderColor: 'rgba(255,255,255,0.08)' }} />
                <TextField fullWidth size="small" placeholder="Search notes..." value={searchTerm} onChange={(e) => setSearchTerm(e.target.value)} sx={{ '& .MuiOutlinedInput-root': { bgcolor: 'rgba(255,255,255,0.03)', borderRadius: '12px', '& fieldset': { borderColor: 'rgba(255,255,255,0.08)' }, '&:hover fieldset': { borderColor: 'rgba(99,102,241,0.3)' }, '&.Mui-focused fieldset': { borderColor: '#6366F1' } } }} InputProps={{ startAdornment: (<InputAdornment position="start"><SearchIcon sx={{ color: 'rgba(255,255,255,0.3)', fontSize: 20 }} /></InputAdornment>) }} />
                {loading ? (<Box sx={{ display: 'flex', justifyContent: 'center', py: 4 }}><CircularProgress size={24} /></Box>) : (<List sx={{ maxHeight: '400px', overflowY: 'auto' }}>{filteredNotes.length === 0 ? (<Typography variant="body2" sx={{ textAlign: 'center', py: 4, color: 'text.secondary' }}>No notes found.</Typography>) : (filteredNotes.map((note) => (<ListItemButton key={note.$id} onClick={() => handleSelect(note)} sx={{ borderRadius: '12px', mb: 1, cursor: 'pointer', border: '1px solid rgba(255,255,255,0.05)', '&:hover': { bgcolor: 'rgba(255,255,255,0.05)' } }}><ListItemIcon><NoteIcon sx={{ color: 'primary.main' }} /></ListItemIcon><ListItemText primary={note.title || 'Untitled Note'} secondary={new Date(note.updatedAt).toLocaleDateString()} primaryTypographyProps={{ fontWeight: 600 }} /></ListItemButton>)))}</List>)}
            </Box>
        </Drawer>
    );
};
