'use client';

import React, { useEffect, useState, use, useCallback } from 'react';
import { 
    Box, 
    Typography, 
    Button, 
    Chip, 
    IconButton, 
    CircularProgress,
    Fade,
    Paper,
    Tabs,
    Tab,
    Stack,
    Snackbar,
    Alert
} from '@mui/material';
import { 
    Edit as EditIcon, 
    Launch as LaunchIcon,
    Assignment as FormIcon,
    ContentCopy as CopyIcon,
    ArrowBack as BackIcon,
    Insights as InsightsIcon
} from '@mui/icons-material';
import { FormsService } from '@/lib/services/forms';
import { Forms } from '@/generated/appwrite/types';
import Link from 'next/link';
import FormDialog from '@/components/forms/FormDialog';
import SubmissionViewer from '@/components/forms/SubmissionViewer';

export default function FormDetailsPage({ params }: { params: Promise<{ formId: string }> }) {
    const resolvedParams = use(params);
    const [form, setForm] = useState<Forms | null>(null);
    const [loading, setLoading] = useState(true);
    const [tab, setTab] = useState(0);
    const [isEditing, setIsEditing] = useState(false);
    const [snackbar, setSnackbar] = useState<string | null>(null);

    const fetchForm = useCallback(async () => {
        setLoading(true);
        try {
            const data = await FormsService.getForm(resolvedParams.formId);
            setForm(data);
        } catch (err) {
            console.error("Failed to fetch form", err);
        } finally {
            setLoading(false);
        }
    }, [resolvedParams.formId]);

    useEffect(() => {
        fetchForm();
    }, [fetchForm]);

    const handleCopyLink = () => {
        const url = `${window.location.origin}/form/${resolvedParams.formId}`;
        navigator.clipboard.writeText(url);
        setSnackbar("Public link copied to clipboard.");
    };

    if (loading) return <Box sx={{ display: 'flex', justifyContent: 'center', py: 20 }}><CircularProgress /></Box>;
    if (!form) return <Box sx={{ p: 4 }}><Typography color="error">Form not found.</Typography></Box>;

    const getStatusColor = (status: string) => {
        switch (status) {
            case 'published': return '#10B981';
            case 'draft': return '#FFB020';
            case 'archived': return '#D14343';
            default: return 'text.secondary';
        }
    };

    return (
        <Box sx={{ 
            animation: 'fadeIn 0.3s ease-out', 
            p: { xs: 2, md: 4 },
            minHeight: '100vh',
            bgcolor: '#000000'
        }}>
            {/* Header / Sub-Header */}
            <Box sx={{ mb: 4, display: 'flex', flexDirection: { xs: 'column', md: 'row' }, gap: 3, justifyContent: 'space-between', alignItems: { md: 'center' } }}>
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
                    <IconButton component={Link} href="/forms" sx={{ bgcolor: '#161514', color: '#6366F1', '&:hover': { bgcolor: '#1F1D1B' } }}>
                        <BackIcon />
                    </IconButton>
                    <Box>
                        <Stack direction="row" spacing={1} alignItems="center">
                            <Typography variant="h4" sx={{ fontWeight: 900, letterSpacing: '-0.04em' }}>{form.title}</Typography>
                            <Chip 
                                label={(form.status || 'unknown').toUpperCase()} 
                                size="small" 
                                sx={{ 
                                    fontSize: '9px', 
                                    fontWeight: 900, 
                                    bgcolor: 'transparent',
                                    color: getStatusColor(form.status || 'draft'),
                                    border: `1px solid ${getStatusColor(form.status || 'draft')}20`
                                }} 
                            />
                        </Stack>
                        <Typography variant="body2" sx={{ color: 'text.secondary', fontWeight: 600 }}>Form ID: {form.$id}</Typography>
                    </Box>
                </Box>

                <Stack direction="row" spacing={2} sx={{ width: { xs: '100%', md: 'auto' } }}>
                    {form.status === 'published' && (
                        <Button 
                            variant="outlined" 
                            startIcon={<CopyIcon />} 
                            onClick={handleCopyLink}
                            sx={{ borderRadius: 2, textTransform: 'none', fontWeight: 700, borderColor: '#161514', color: 'text.primary', bgcolor: '#161514', '&:hover': { bgcolor: '#1F1D1B' } }}
                        >
                            Copy Public Link
                        </Button>
                    )}
                    <Button 
                        variant="contained" 
                        color="primary" 
                        startIcon={<EditIcon />} 
                        onClick={() => setIsEditing(true)}
                        sx={{ borderRadius: 2, px: 3, fontWeight: 800, boxShadow: '0 8px 20px rgba(99, 102, 241, 0.3)' }}
                    >
                        Edit Design
                    </Button>
                </Stack>
            </Box>

            {/* Dynamic Status Bar (Only when Published) */}
            {form.status === 'published' && (
                <Paper sx={{ p: 1.5, mb: 4, borderRadius: 3, bgcolor: '#161514', border: '1px solid rgba(16, 185, 129, 0.2)', display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 2 }}>
                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5, ml: 1 }}>
                        <Box sx={{ width: 8, height: 8, borderRadius: '50%', bgcolor: '#10B981', boxShadow: '0 0 8px #10B981' }} />
                        <Typography variant="body2" sx={{ fontWeight: 800, color: '#10B981', fontSize: '0.75rem', letterSpacing: '0.05em' }}>FORM IS LIVE & ACCEPTING RESPONSES</Typography>
                    </Box>
                    <IconButton size="small" component={Link} href={`/form/${form.$id}`} target="_blank" sx={{ color: '#10B981' }}>
                        <LaunchIcon sx={{ fontSize: 18 }} />
                    </IconButton>
                </Paper>
            )}

            {/* Tabs */}
            <Box sx={{ borderBottom: 1, borderColor: 'rgba(255, 255, 255, 0.05)', mb: 4 }}>
                <Tabs value={tab} onChange={(_, v) => setTab(v)} textColor="primary" indicatorColor="primary">
                    <Tab 
                        icon={<InsightsIcon sx={{ fontSize: 20 }} />} 
                        iconPosition="start" 
                        label={<Typography sx={{ fontWeight: 900, fontSize: '0.8rem', letterSpacing: '0.05em' }}>RESPONSES</Typography>} 
                    />
                    <Tab 
                        icon={<FormIcon sx={{ fontSize: 20 }} />} 
                        iconPosition="start" 
                        label={<Typography sx={{ fontWeight: 900, fontSize: '0.8rem', letterSpacing: '0.05em' }}>PREVIEW & SCHEMA</Typography>} 
                    />
                </Tabs>
            </Box>

            {/* Tab Panels */}
            {tab === 0 && (
                <Fade in={true}>
                    <Box>
                        <SubmissionViewer formId={resolvedParams.formId} formSchema={form.schema} />
                    </Box>
                </Fade>
            )}

            {tab === 1 && (
                <Fade in={true}>
                    <Box sx={{ display: 'grid', gridTemplateColumns: { xs: '1fr', lg: '3fr 2fr' }, gap: 4 }}>
                        <Paper sx={{ p: 4, borderRadius: 4, bgcolor: '#161514', border: '1px solid rgba(255, 255, 255, 0.05)' }}>
                            <Typography variant="overline" sx={{ color: 'text.secondary', fontWeight: 900, mb: 4, display: 'block' }}>SCHEMA PREVIEW</Typography>
                            <Box sx={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                                {JSON.parse(form.schema || '[]').map((field: any) => (
                                    <Box key={field.id}>
                                        <Typography variant="subtitle2" sx={{ mb: 1, fontWeight: 800, opacity: 0.8 }}>
                                            {field.label} {field.required && <Box component="span" sx={{ color: '#ff1744' }}>*</Box>}
                                        </Typography>
                                        <Box sx={{ p: 2, borderRadius: 2, bgcolor: '#1F1D1B', border: '1px solid rgba(255, 255, 255, 0.05)', color: 'text.disabled', fontSize: '0.8rem' }}>
                                            {field.placeholder || `Input for ${field.type}...`}
                                        </Box>
                                    </Box>
                                ))}
                            </Box>
                        </Paper>

                        <Paper sx={{ p: 4, borderRadius: 4, bgcolor: '#161514', border: '1px solid rgba(255, 255, 255, 0.05)', height: 'fit-content' }}>
                            <Typography variant="overline" sx={{ color: 'text.secondary', fontWeight: 900, mb: 2, display: 'block' }}>RAW JSON</Typography>
                            <Box component="pre" sx={{ fontSize: '0.75rem', color: 'text.secondary', overflow: 'auto', maxHeight: 400, fontFamily: 'var(--font-jetbrains)', bgcolor: '#1F1D1B', p: 2, borderRadius: 2 }}>
                                {JSON.stringify(JSON.parse(form.schema || '[]'), null, 2)}
                            </Box>
                        </Paper>
                    </Box>
                </Fade>
            )}

            {/* Edit Dialog */}
            <FormDialog 
                open={isEditing} 
                onClose={() => setIsEditing(false)} 
                form={form} 
                onSaved={fetchForm} 
            />

            <Snackbar 
                open={!!snackbar} 
                autoHideDuration={3000} 
                onClose={() => setSnackbar(null)}
                anchorOrigin={{ vertical: 'bottom', horizontal: 'center' }}
            >
                <Alert severity="success" sx={{ bgcolor: '#10B981', color: '#000', fontWeight: 800, borderRadius: 2 }}>{snackbar}</Alert>
            </Snackbar>
        </Box>
    );
}
