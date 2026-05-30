'use client';

import React, { useEffect, useState, useCallback, useRef } from 'react';
import { 
    Box, 
    Typography, 
    Button, 
    Grid, 
    Card, 
    CardContent, 
    Chip, 
    IconButton, 
    Tooltip,
    Fade,
    Paper,
    Divider,
    Stack,
    Tabs,
    Tab,
    Skeleton,
    alpha,
    Menu,
    MenuItem as MuiMenuItem,
    Dialog as ConfirmDialog,
    DialogTitle as ConfirmTitle,
    DialogContent as ConfirmContent,
    DialogActions as ConfirmActions
} from '@mui/material';
import { 
    Add as AddIcon, 
    Edit as EditIcon, 
    Delete as DeleteIcon, 
    Launch as LaunchIcon,
    Assignment as FormIcon,
    MoreVert as MoreIcon,
    AutoAwesome as TemplateIcon,
    History as HistoryIcon,
    Settings as SettingsIcon,
    PushPin as PinIcon
} from '@mui/icons-material';
import { FormsService } from '@/lib/services/forms';
import { DraftsService, FormDraft } from '@/lib/services/drafts';
import { Forms } from '@/generated/appwrite/types';
import Link from 'next/link';
import FormDialog from '@/components/forms/FormDialog';
import FormSettingsDialog from '@/components/forms/FormSettingsDialog';
import { useAuth } from '@/context/auth/AuthContext';
import { useRouter } from 'next/navigation';
import { useDataNexus } from '@/context/DataNexusContext';
import { toast } from 'react-hot-toast';

import { useUnifiedDrawer } from '@/context/UnifiedDrawerContext';
import { FolderKanban } from 'lucide-react';
import DesktopRightSection from '@/components/layout/DesktopRightSection';

export default function FormsDashboard() {
    const { user } = useAuth();
    const router = useRouter();
    const { fetchOptimized, invalidate } = useDataNexus();
    const { open: openDrawer } = useUnifiedDrawer();
    const [forms, setForms] = useState<Forms[]>([]);
    const [offlineDrafts, setOfflineDrafts] = useState<FormDraft[]>([]);
    const [loading, setLoading] = useState(true);
    const [tabValue, setTabValue] = useState(0);
    const [dialogOpen, setDialogOpen] = useState(false);
    const [settingsOpen, setSettingsOpen] = useState(false);
    const [selectedForm, setSelectedForm] = useState<Forms | null>(null);
    const [selectedDraft, setSelectedDraft] = useState<FormDraft | null>(null);
    
    // UI States
    const [menuAnchor, setMenuAnchor] = useState<{ element: HTMLElement, form: Forms } | null>(null);

    const formsLengthRef = useRef(forms.length);
    useEffect(() => {
        formsLengthRef.current = forms.length;
    }, [forms.length]);

    const fetchForms = useCallback(async (showLoading = true) => {
        if (!user) return;
        
        // Only show loading if we don't have forms yet, to prevent blinking
        const shouldShowLoading = showLoading && formsLengthRef.current === 0;
        if (shouldShowLoading) setLoading(true);
        
        try {
            const response = await fetchOptimized(`f_user_forms_${user.$id}`, () => 
                FormsService.listUserForms(user.$id)
            ); 
            
            // Deduplicate by ID and sort by pinned status
            const uniqueForms = response.rows
                .filter((form, index, self) => index === self.findIndex((f) => f.$id === form.$id))
                .sort((a: any, b: any) => {
                    if (a.isPinned && !b.isPinned) return -1;
                    if (!a.isPinned && b.isPinned) return 1;
                    return new Date(b.$createdAt).getTime() - new Date(a.$createdAt).getTime();
                });
            
            setForms(uniqueForms);

            // Load offline drafts
            const manifest = DraftsService.getManifest();
            const draftList: FormDraft[] = [];
            Object.keys(manifest).forEach(id => {
                const d = DraftsService.getDraft(id);
                if (d) draftList.push(d);
            });
            setOfflineDrafts(draftList.sort((a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime()));

        } catch (err) {
            console.error("Failed to fetch forms", err);
        } finally {
            if (shouldShowLoading) setLoading(false);
        }
    }, [user, fetchOptimized]);

    const handleCreate = () => {
        setSelectedForm(null);
        setSelectedDraft(null);
        setDialogOpen(true);
    };

    const handleEdit = (form: Forms) => {
        setSelectedForm(form);
        setSelectedDraft(null);
        setDialogOpen(true);
    };

    const handleEditDraft = (draft: FormDraft) => {
        // If the draft corresponds to an existing form, load that form too
        const existingForm = forms.find(f => f.$id === draft.id);
        setSelectedForm(existingForm || null);
        setSelectedDraft(draft);
        setDialogOpen(true);
    };

    const handleDelete = async (form: Forms) => {
        openDrawer('delete-confirm', {
            title: `Purge "${form.title}"?`,
            description: 'This will permanently erase all metadata, configurations, and associated responses for this form.',
            resourceName: 'this form',
            confirmLabel: 'Confirm Purge',
            onConfirm: async () => {
                if (!user) return;
                try {
                    await FormsService.deleteForm(form.$id);
                    invalidate(`f_user_forms_${user.$id}`);
                    fetchForms(false);
                } catch (err) {
                    console.error("Failed to delete form", err);
                }
            }
        });
    };

    const handleDeleteDraft = (draft: FormDraft) => {
        openDrawer('delete-confirm', {
            title: `Delete Local Draft?`,
            description: `You are about to remove "${draft.title || 'Untitled Portal'}" from your local storage. This cannot be recovered.`,
            resourceName: 'this draft',
            confirmLabel: 'Delete Draft',
            onConfirm: () => {
                DraftsService.clearDraft(draft.id);
                fetchForms(false);
            }
        });
    };

    const handleMenuOpen = (event: React.MouseEvent<HTMLElement>, form: Forms) => {
        setMenuAnchor({ element: event.currentTarget, form });
    };

    const handleMenuClose = () => {
        setMenuAnchor(null);
    };

    const handleOpenSettings = (form: Forms) => {
        handleMenuClose();
        setSelectedForm(form);
        setSelectedDraft(null);
        setSettingsOpen(true);
    };

    const handleTogglePin = async (form: Forms) => {
        try {
            await FormsService.togglePin(form.$id);
            fetchForms(false);
            toast.success(form.isPinned ? "Unpinned" : "Pinned to top");
        } catch (err) {
            toast.error("Failed to toggle pin");
        }
    };

    useEffect(() => {
        if (user) {
            fetchForms();
        }
    }, [user, fetchForms]);

    const getStatusColor = (status: string) => {
        switch (status) {
            case 'published': return '#10B981';
            case 'draft': return '#FFB020';
            case 'archived': return '#D14343';
            default: return 'text.secondary';
        }
    };

    const filteredForms = forms; // Active forms (published/draft on server)

    return (
        <Box sx={{ 
            animation: 'fadeIn 0.4s ease-out', 
            p: { xs: 2, md: 4 },
            minHeight: '100vh',
            bgcolor: '#000000'
        }}>
            <Box sx={{ display: 'grid', gridTemplateColumns: { xs: '1fr', lg: '1fr 400px' }, gap: 4, alignItems: 'flex-start' }}>
                <Box>
            <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 4 }}>
                <Box>
                    <Typography variant="h3" sx={{ fontWeight: 900, mb: 1, letterSpacing: '-0.04em', fontFamily: 'var(--font-clash)' }}>
                        Forms
                    </Typography>
                    <Typography variant="body2" sx={{ color: 'text.secondary', fontWeight: 600 }}>
                        Design data collection workflows for the ecosystem.
                    </Typography>
                </Box>
                <Button 
                    variant="contained" 
                    startIcon={<AddIcon />}
                    onClick={handleCreate}
                    sx={{ borderRadius: 2, px: 3, fontWeight: 800, bgcolor: 'var(--color-primary)', color: 'black', '&:hover': { bgcolor: alpha('#6366F1', 0.9) } }}
                >
                    Create Form
                </Button>
            </Box>

            <Box sx={{ borderBottom: 1, borderColor: 'rgba(255,255,255,0.05)', mb: 4 }}>
                <Tabs 
                    value={tabValue} 
                    onChange={(_, v) => setTabValue(v)}
                    variant="scrollable"
                    scrollButtons="auto"
                    allowScrollButtonsMobile
                    sx={{
                        '& .MuiTab-root': { fontWeight: 800, fontSize: '0.85rem', color: 'text.secondary', px: 3 },
                        '& .Mui-selected': { color: 'var(--color-primary) !important' },
                        '& .MuiTabs-indicator': { bgcolor: 'var(--color-primary)', height: 3, borderRadius: '3px 3px 0 0' }
                    }}
                >
                    <Tab label="Active Forms" icon={<FormIcon sx={{ fontSize: 18 }} />} iconPosition="start" />
                    <Tab label="Templates" icon={<TemplateIcon sx={{ fontSize: 18 }} />} iconPosition="start" />
                    <Tab 
                        label={
                            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                                Drafts
                                {offlineDrafts.length > 0 && (
                                    <Box sx={{ bgcolor: '#FFB020', color: 'black', borderRadius: '50%', width: 18, height: 18, fontSize: '10px', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                                        {offlineDrafts.length}
                                    </Box>
                                )}
                            </Box>
                        } 
                        icon={<HistoryIcon sx={{ fontSize: 18 }} />} 
                        iconPosition="start" 
                    />
                </Tabs>
            </Box>

            {loading ? (
                <Grid container spacing={3}>
                    {[1, 2, 3].map((i) => (
                        <Grid size={{ xs: 12, md: 6, lg: 4 }} key={i}>
                            <Card sx={{ bgcolor: '#161514', border: '1px solid rgba(255, 255, 255, 0.05)', borderRadius: 3 }}>
                                <CardContent sx={{ p: 3 }}>
                                    <Box sx={{ display: 'flex', justifyContent: 'space-between', mb: 2 }}>
                                        <Skeleton variant="rectangular" width={60} height={20} sx={{ borderRadius: 1, bgcolor: '#1F1D1B' }} />
                                        <Skeleton variant="circular" width={24} height={24} sx={{ bgcolor: '#1F1D1B' }} />
                                    </Box>
                                    <Skeleton variant="text" width="80%" height={32} sx={{ mb: 1, bgcolor: '#1F1D1B' }} />
                                    <Skeleton variant="text" width="100%" height={20} sx={{ bgcolor: '#1F1D1B' }} />
                                    <Skeleton variant="text" width="60%" height={20} sx={{ mb: 4, bgcolor: '#1F1D1B' }} />
                                    <Divider sx={{ opacity: 0.05, mb: 3 }} />
                                    <Box sx={{ display: 'flex', gap: 1 }}>
                                        <Skeleton variant="circular" width={32} height={32} sx={{ bgcolor: '#1F1D1B' }} />
                                        <Skeleton variant="circular" width={32} height={32} sx={{ bgcolor: '#1F1D1B' }} />
                                        <Box sx={{ flexGrow: 1 }} />
                                        <Skeleton variant="circular" width={32} height={32} sx={{ bgcolor: 'rgba(255,255,255,0.05)' }} />
                                    </Box>
                                </CardContent>
                            </Card>
                        </Grid>
                    ))}
                </Grid>
            ) : (
                <Box>
                    {/* ACTIVE FORMS TAB */}
                    {tabValue === 0 && (
                        <>
                            {filteredForms.length === 0 ? (
                                <Paper sx={{ py: 12, textAlign: 'center', bgcolor: '#161514', border: '1px dashed rgba(255, 255, 255, 0.1)', borderRadius: 4 }}>
                                    <FormIcon sx={{ fontSize: 64, opacity: 0.1, mb: 2 }} />
                                    <Typography variant="h6" sx={{ opacity: 0.6, mb: 4 }}>No active forms.</Typography>
                                    <Button variant="outlined" startIcon={<AddIcon />} onClick={handleCreate}>Start Building</Button>
                                </Paper>
                            ) : (
                                <Grid container spacing={3}>
                                    {filteredForms.map((form) => (
                                        <Grid size={{ xs: 12, md: 6, lg: 4 }} key={form.$id}>
                                            <Fade in={true}>
                                                <Card 
                                                    onClick={() => router.push(`/flow/forms/${form.$id}`)}
                                                    sx={{ 
                                                        bgcolor: '#161514', 
                                                        border: '1px solid rgba(255, 255, 255, 0.05)', 
                                                        borderRadius: 3,
                                                        cursor: 'pointer',
                                                        transition: 'all 0.2s ease-in-out',
                                                        '&:hover': {
                                                            bgcolor: '#1F1D1B',
                                                            borderColor: 'rgba(99, 102, 241, 0.3)',
                                                            transform: 'translateY(-2px)'
                                                        }
                                                    }}
                                                >
                                                    <CardContent sx={{ p: 3 }}>
                                                        <Box sx={{ display: 'flex', justifyContent: 'space-between', mb: 2 }}>
                                                            <Stack direction="row" spacing={1} alignItems="center">
                                                                <Chip label={(form.status || 'unknown').toUpperCase()} size="small" sx={{ fontSize: '10px', fontWeight: 900, color: getStatusColor(form.status || 'draft'), border: `1px solid ${getStatusColor(form.status || 'draft')}20`, bgcolor: 'transparent' }} />
                                                                {DraftsService.hasDraft(form.$id) && (
                                                                    <Chip label="UNSYNCED DRAFT" size="small" sx={{ fontSize: '10px', fontWeight: 900, bgcolor: alpha('#FFB020', 0.1), color: '#FFB020', border: '1px solid rgba(255, 176, 32, 0.2)' }} />
                                                                )}
                                                            </Stack>
                                                            <Stack direction="row" spacing={0.5} alignItems="center">
                                                                <Tooltip title="Activate Form-to-Project Workflow">
                                                                    <IconButton
                                                                        size="small"
                                                                        sx={{
                                                                            color: '#6366F1',
                                                                            opacity: 0.75,
                                                                            '&:hover': { opacity: 1, bgcolor: 'rgba(99,102,241,0.08)' }
                                                                        }}
                                                                        onClick={(e) => {
                                                                            e.stopPropagation();
                                                                            openDrawer('new-project', {
                                                                                template: {
                                                                                    id: 'form-to-project',
                                                                                    title: 'Analyze Responses', 
                                                                                    summary: 'Convert intake forms into context and auto-spin execution tasks.',
                                                                                    color: '#6366F1'
                                                                                },
                                                                                formId: form.$id,
                                                                                selectedResourceId: form.$id,
                                                                                formTitle: form.title,
                                                                                formDescription: form.description || ''
                                                                            });
                                                                        }}
                                                                    >
                                                                        <Box sx={{ position: 'relative', width: 22, height: 22, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                                                                            <FolderKanban size={16} strokeWidth={2.5} style={{ color: '#6366F1' }} />
                                                                            <Box sx={{
                                                                                position: 'absolute',
                                                                                bottom: -2,
                                                                                right: -2,
                                                                                bgcolor: '#000',
                                                                                borderRadius: '4px',
                                                                                p: '1px',
                                                                                display: 'flex',
                                                                                alignItems: 'center',
                                                                                justifyContent: 'center',
                                                                                border: '1px solid rgba(255,255,255,0.15)',
                                                                                lineHeight: 0
                                                                            }}>
                                                                                <FormIcon sx={{ fontSize: 9, color: '#10B981' }} />
                                                                            </Box>
                                                                        </Box>
                                                                    </IconButton>
                                                                </Tooltip>
                                                                <IconButton 
                                                                    size="small" 
                                                                    sx={{ opacity: 0.4 }}
                                                                    onClick={(e) => {
                                                                        e.stopPropagation();
                                                                        handleMenuOpen(e, form);
                                                                    }}
                                                                >
                                                                    <MoreIcon />
                                                                </IconButton>
                                                            </Stack>
                                                        </Box>
                                                        <Typography variant="h6" sx={{ fontWeight: 800, mb: 1, color: '#F2F2F2' }}>{form.title}</Typography>
                                                        <Typography variant="body2" sx={{ color: 'text.secondary', mb: 4, minHeight: '3em', overflow: 'hidden', display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical' }}>
                                                            {form.description || 'No description provided.'}
                                                        </Typography>
                                                        <Divider sx={{ opacity: 0.05, mb: 3 }} />
                                                        <Box sx={{ display: 'flex', gap: 1 }}>
                                                            <Tooltip title="Preview Public Form">
                                                                <IconButton 
                                                                    size="small" 
                                                                    component={Link} 
                                                                    href={`/flow/form/${form.$id}`} 
                                                                    target="_blank" 
                                                                    onClick={(e) => e.stopPropagation()}
                                                                    sx={{ bgcolor: '#161514' }}
                                                                >
                                                                    <LaunchIcon sx={{ fontSize: 18 }} />
                                                                </IconButton>
                                                            </Tooltip>
                                                            <Box sx={{ flexGrow: 1 }} />
                                                            <IconButton 
                                                                size="small" 
                                                                onClick={(e) => {
                                                                    e.stopPropagation();
                                                                    handleEdit(form);
                                                                }} 
                                                                sx={{ opacity: 0.6 }}
                                                            >
                                                                <EditIcon sx={{ fontSize: 18 }} />
                                                            </IconButton>
                                                            <IconButton 
                                                                size="small" 
                                                                onClick={(e) => {
                                                                    e.stopPropagation();
                                                                    handleDelete(form);
                                                                }} 
                                                                sx={{ color: '#D14343', opacity: 0.6 }}
                                                            >
                                                                <DeleteIcon sx={{ fontSize: 18 }} />
                                                            </IconButton>
                                                        </Box>
                                                    </CardContent>
                                                </Card>
                                            </Fade>
                                        </Grid>
                                    ))}
                                </Grid>
                            )}
                        </>
                    )}

                    {/* TEMPLATES TAB */}
                    {tabValue === 1 && (
                        <Paper sx={{ py: 12, textAlign: 'center', bgcolor: '#161514', border: '1px dashed rgba(255, 255, 255, 0.1)', borderRadius: 4 }}>
                            <TemplateIcon sx={{ fontSize: 64, opacity: 0.1, mb: 2 }} />
                            <Typography variant="h6" sx={{ opacity: 0.6 }}>Templates coming soon.</Typography>
                        </Paper>
                    )}

                    {/* OFFLINE DRAFTS TAB */}
                    {tabValue === 2 && (
                        <>
                            {offlineDrafts.length === 0 ? (
                                <Paper sx={{ py: 12, textAlign: 'center', bgcolor: '#161514', border: '1px dashed rgba(255, 255, 255, 0.1)', borderRadius: 4 }}>
                                    <HistoryIcon sx={{ fontSize: 64, opacity: 0.1, mb: 2 }} />
                                    <Typography variant="h6" sx={{ opacity: 0.6 }}>No offline drafts found.</Typography>
                                </Paper>
                            ) : (
                                <Grid container spacing={3}>
                                    {offlineDrafts.map((draft) => (
                                        <Grid size={{ xs: 12, md: 6, lg: 4 }} key={draft.id}>
                                            <Fade in={true}>
                                                <Card sx={{ bgcolor: '#161514', border: '1px solid rgba(255, 176, 32, 0.1)', borderRadius: 3 }}>
                                                    <CardContent sx={{ p: 3 }}>
                                                        <Box sx={{ display: 'flex', justifyContent: 'space-between', mb: 2 }}>
                                                            <Chip label="LOCAL DRAFT" size="small" sx={{ fontSize: '10px', fontWeight: 900, bgcolor: alpha('#FFB020', 0.1), color: '#FFB020', border: '1px solid rgba(255, 176, 32, 0.2)' }} />
                                                            <Typography variant="caption" sx={{ color: 'text.secondary', fontFamily: 'var(--font-mono)' }}>
                                                                {new Date(draft.updatedAt).toLocaleTimeString()}
                                                            </Typography>
                                                        </Box>
                                                        <Typography variant="h6" sx={{ fontWeight: 800, mb: 1, color: '#F2F2F2' }}>{draft.title || 'Untitled Portal'}</Typography>
                                                        <Typography variant="body2" sx={{ color: 'text.secondary', mb: 4 }}>
                                                            Last saved locally. Sync required to publish.
                                                        </Typography>
                                                        <Divider sx={{ opacity: 0.05, mb: 3 }} />
                                                        <Box sx={{ display: 'flex', gap: 1 }}>
                                                            <Button 
                                                                size="small" 
                                                                variant="outlined" 
                                                                startIcon={<EditIcon />} 
                                                                onClick={() => handleEditDraft(draft)}
                                                                sx={{ borderRadius: 1.5, fontWeight: 800, borderColor: 'rgba(255,255,255,0.1)' }}
                                                            >
                                                                Resume
                                                            </Button>
                                                            <Box sx={{ flexGrow: 1 }} />
                                                            <IconButton size="small" onClick={() => handleDeleteDraft(draft)} sx={{ color: '#D14343', opacity: 0.6 }}><DeleteIcon sx={{ fontSize: 18 }} /></IconButton>
                                                        </Box>
                                                    </CardContent>
                                                </Card>
                                            </Fade>
                                        </Grid>
                                    ))}
                                </Grid>
                            )}
                        </>
                    )}
                </Box>
            )}

            {dialogOpen && (
                <FormDialog 
                    open={dialogOpen} 
                    onClose={() => setDialogOpen(false)} 
                    form={selectedForm}
                    initialDraft={selectedDraft || undefined}
                    onSaved={() => fetchForms(false)} 
                />
            )}

            {settingsOpen && (
                <FormSettingsDialog
                    open={settingsOpen}
                    onClose={() => setSettingsOpen(false)}
                    form={selectedForm}
                    onSaved={() => fetchForms(false)}
                />
            )}

            {/* ACTION MENU */}
            <Menu
                anchorEl={menuAnchor?.element}
                open={Boolean(menuAnchor)}
                onClose={handleMenuClose}
                PaperProps={{
                    sx: {
                        bgcolor: 'rgba(10, 10, 10, 0.95)',
                        backdropFilter: 'blur(10px)',
                        border: '1px solid rgba(255,255,255,0.1)',
                        borderRadius: 2,
                        minWidth: 160,
                        '& .MuiMenuItem-root': {
                            fontSize: '0.8rem',
                            fontWeight: 800,
                            gap: 1.5,
                            py: 1.2,
                            color: 'text.secondary',
                            '&:hover': { bgcolor: 'rgba(255,255,255,0.05)', color: 'white' }
                        }
                    }
                }}
                transformOrigin={{ horizontal: 'right', vertical: 'top' }}
                anchorOrigin={{ horizontal: 'right', vertical: 'bottom' }}
            >
                <MuiMenuItem onClick={() => { handleMenuClose(); handleEdit(menuAnchor!.form); }}>
                    <EditIcon fontSize="small" /> Edit Schema
                </MuiMenuItem>
                <MuiMenuItem onClick={() => handleOpenSettings(menuAnchor!.form)}>
                    <SettingsIcon fontSize="small" /> Settings
                </MuiMenuItem>
                <MuiMenuItem onClick={() => { handleMenuClose(); handleTogglePin(menuAnchor!.form); }}>
                    <PinIcon fontSize="small" sx={{ color: menuAnchor?.form.isPinned ? '#F59E0B' : 'inherit' }} /> {menuAnchor?.form.isPinned ? 'Unpin' : 'Pin'} Form
                </MuiMenuItem>
                <Divider sx={{ opacity: 0.05, my: 0.5 }} />
                <MuiMenuItem onClick={() => { handleMenuClose(); handleDelete(menuAnchor!.form); }} sx={{ color: '#D14343 !important' }}>
                    <DeleteIcon fontSize="small" /> Delete Form
                </MuiMenuItem>
        </Box>
        <Box sx={{ display: { xs: 'none', lg: 'block' } }}>
          <DesktopRightSection panels={['projects', 'huddles', 'goals']} />
        </Box>
      </Box>
    </Box>
  );
}
