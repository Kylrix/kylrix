'use client';

import React from 'react';
import { 
    Drawer, 
    Box, 
    Typography, 
    IconButton, 
    Divider,
    Button,
    Paper
} from '@mui/material';
import CloseIcon from '@mui/icons-material/Close';
import DescriptionIcon from '@mui/icons-material/Description';
import OpenInNewIcon from '@mui/icons-material/OpenInNew';

interface NoteViewDrawerProps {
    open: boolean;
    onClose: () => void;
    note: any;
}

export const NoteViewDrawer = ({ open, onClose, note }: NoteViewDrawerProps) => {
    if (!note) return null;

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
                    <DescriptionIcon color="primary" sx={{ mr: 1.5, fontSize: 28 }} />
                    <Typography variant="h6" fontWeight={800} sx={{ flex: 1 }}>
                        Shared Note
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
                    <Typography variant="h5" fontWeight={900} gutterBottom sx={{ color: 'primary.main' }}>
                        {note.title || 'Untitled Note'}
                    </Typography>
                    <Typography variant="caption" color="text.disabled" sx={{ display: 'block', mb: 3 }}>
                        Last updated: {new Date(note.updatedAt || note.$updatedAt).toLocaleDateString()}
                    </Typography>
                    
                    <Divider sx={{ mb: 3, opacity: 0.1 }} />
                    
                    <Box sx={{ 
                        color: 'text.secondary', 
                        lineHeight: 1.8, 
                        whiteSpace: 'pre-wrap',
                        fontFamily: 'var(--font-inter)',
                        fontSize: '1rem'
                    }}>
                        {note.content}
                    </Box>
                </Paper>

                <Box sx={{ mt: 'auto', display: 'flex', gap: 2 }}>
                    <Button 
                        fullWidth 
                        variant="outlined" 
                        startIcon={<OpenInNewIcon />}
                        component="a"
                        href={`/notes/shared/${note.$id || note.id}`}
                        target="_blank"
                        sx={{ borderRadius: 3, py: 1.5, fontWeight: 700 }}
                    >
                        Shared View
                    </Button>
                    <Button 
                        fullWidth 
                        variant="contained" 
                        color="primary"
                        component="a"
                        href={`http://localhost:3002/note/${note.$id || note.id}`} // Assuming Note app runs on 3002
                        target="_blank"
                        sx={{ borderRadius: 3, py: 1.5, fontWeight: 800, color: 'black' }}
                    >
                        Open in Note
                    </Button>
                </Box>
            </Box>
        </Drawer>
    );
};
