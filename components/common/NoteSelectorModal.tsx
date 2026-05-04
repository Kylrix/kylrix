'use client';

import React, { useState, useEffect } from 'react';
import {
    Box,
    Typography,
    List,
    ListItemButton,
    ListItemText,
    CircularProgress,
    TextField,
    InputAdornment,
    Drawer,
    IconButton,
    Divider
} from '@mui/material';
import {
    Search as SearchIcon,
    Description as NoteIcon,
    Close as CloseIcon,
} from '@mui/icons-material';
import { AppwriteService } from '@/lib/appwrite';
import { useAuth } from '@/hooks/useAuth';

interface NoteSelectorModalProps {
    isOpen: boolean;
    onClose: () => void;
    onSelect: (noteId: string) => void;
}

export function NoteSelectorModal({ isOpen, onClose, onSelect }: NoteSelectorModalProps) {
    const { user } = useAuth();
    const [notes, setNotes] = useState<any[]>([]);
    const [loading, setLoading] = useState(true);
    const [search, setSearch] = useState('');

    useEffect(() => {
        if (isOpen && user) {
            const fetchNotes = async () => {
                setLoading(true);
                try {
                    const res = await AppwriteService.listFlowNotes(user.$id);
                    setNotes(res.documents);
                } catch (err: unknown) {
                    console.error('Failed to fetch notes:', err);
                } finally {
                    setLoading(false);
                }
            };
            fetchNotes();
        }
    }, [isOpen, user]);

    const filtered = notes.filter(n =>
        (n.title || '').toLowerCase().includes(search.toLowerCase())
    );

    return (
        <Drawer anchor="bottom" open={isOpen} onClose={onClose} PaperProps={{ sx: { borderRadius: '24px 24px 0 0', bgcolor: 'rgba(15, 15, 15, 0.98)', backdropFilter: 'blur(20px)', borderTop: '1px solid rgba(255,255,255,0.08)', boxShadow: '0 -24px 60px rgba(0,0,0,0.6)', maxHeight: { xs: '88dvh', sm: '72vh' } } }}>
            <Box sx={{ p: 3, display: 'flex', flexDirection: 'column', gap: 2, maxHeight: '72vh' }}>
                <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                    <Box>
                        <Typography variant="h5" sx={{ fontWeight: 900, color: '#6366F1', mb: 0.5, fontFamily: 'var(--font-space-grotesk)' }}>ATTACH NOTE</Typography>
                        <Typography variant="caption" sx={{ color: 'rgba(255,255,255,0.45)', fontWeight: 800, textTransform: 'uppercase', letterSpacing: '0.08em' }}>Pick from Kylrix Note</Typography>
                    </Box>
                    <IconButton onClick={onClose} size="small" sx={{ bgcolor: 'rgba(255,255,255,0.03)', color: 'rgba(255,255,255,0.55)' }}><CloseIcon /></IconButton>
                </Box>
                <Divider sx={{ borderColor: 'rgba(255,255,255,0.08)' }} />
                <TextField fullWidth size="small" placeholder="Search notes..." value={search} onChange={(e) => setSearch(e.target.value)} variant="outlined" sx={{ mb: 1, '& .MuiOutlinedInput-root': { bgcolor: 'rgba(255,255,255,0.03)', borderRadius: '12px', '& fieldset': { borderColor: 'rgba(255,255,255,0.08)' }, '&:hover fieldset': { borderColor: 'rgba(99,102,241,0.3)' }, '&.Mui-focused fieldset': { borderColor: '#6366F1' } } }} InputProps={{ startAdornment: (<InputAdornment position="start"><SearchIcon sx={{ color: 'rgba(255, 255, 255, 0.3)', fontSize: 20 }} /></InputAdornment>) }} />
                {loading ? (<Box sx={{ display: 'flex', justifyContent: 'center', p: 4 }}><CircularProgress size={32} sx={{ color: '#6366F1' }} /></Box>) : filtered.length === 0 ? (<Typography variant="body2" sx={{ textAlign: 'center', opacity: 0.5, py: 4 }}>No notes found</Typography>) : (<List sx={{ maxHeight: '400px', overflowY: 'auto' }}>{filtered.map((note) => (<ListItemButton key={note.$id} onClick={() => onSelect(note.$id)} sx={{ borderRadius: '12px', mb: 1, border: '1px solid rgba(255,255,255,0.05)', '&:hover': { bgcolor: 'rgba(99,102,241,0.05)', borderColor: 'rgba(99,102,241,0.2)' } }}><Box sx={{ mr: 2, display: 'flex', color: '#6366F1' }}><NoteIcon fontSize="small" /></Box><ListItemText primary={note.title || 'Untitled Note'} secondary={new Date(note.$createdAt).toLocaleDateString()} primaryTypographyProps={{ fontSize: '0.9rem', fontWeight: 600 }} secondaryTypographyProps={{ fontSize: '0.75rem', sx: { opacity: 0.5 } }} /></ListItemButton>))}</List>)}
            </Box>
        </Drawer>
    );
}
