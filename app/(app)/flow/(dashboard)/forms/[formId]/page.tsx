'use client';

import React, { useEffect, useState, use, useCallback } from 'react';
import { useAuth } from '@/context/auth/AuthContext';
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
import { createGhostNoteForResource, promoteGhostResourceThreadToStory } from '@/lib/actions/client-ops';
import { createComment, listComments, getNote } from '@/lib/appwrite/note';
import { client } from '@/lib/appwrite/client';
import { APPWRITE_CONFIG } from '@/lib/appwrite/config';
import { useToast } from '@/components/ui/Toast';
import { AppwriteService } from '@/lib/appwrite';
import { MessageSquare, Clock, FileText, Globe, Send } from 'lucide-react';
import { TextField } from '@mui/material';
import { MultiSectionContainer } from '@/context/SectionContext';

export default function FormDetailsPage({ params, formId: propFormId, onBack }: { params?: Promise<{ formId: string }>; formId?: string; onBack?: () => void }) {
    const resolvedParams = {
        formId: propFormId || (params ? use(params).formId : '')
    };
    const [form, setForm] = useState<Forms | null>(null);
    const [loading, setLoading] = useState(true);
    const [tab, setTab] = useState(0);
    const [isEditing, setIsEditing] = useState(false);
    const [snackbar, setSnackbar] = useState<string | null>(null);

    // Huddle Discussion State & Effects
    const { showSuccess, showError } = useToast();
    const { user } = useAuth();
    const [huddleMessages, setHuddleMessages] = useState<any[]>([]);
    const [huddleLoading, setHuddleLoading] = useState(false);
    const [huddleSending, setHuddleSending] = useState(false);
    const [isHuddleInit, setIsHuddleInit] = useState(false);
    const [huddleTimeRemaining, setHuddleTimeRemaining] = useState('');
    const [inputText, setInputText] = useState('');
    const huddleMessageEndRef = React.useRef<HTMLDivElement>(null);

    // Check if Huddle is initialized
    useEffect(() => {
        if (!resolvedParams.formId) return;
        let active = true;

        const checkHuddle = async () => {
            try {
                const note = await getNote(resolvedParams.formId);
                if (!active) return;
                if (note && note.metadata) {
                    setIsHuddleInit(true);
                    const noteMeta = JSON.parse(note.metadata);
                    const expiresAt = new Date(noteMeta.expiresAt).getTime();
                    const updateTimer = () => {
                        const diff = expiresAt - Date.now();
                        if (diff <= 0) {
                            setHuddleTimeRemaining('Expired');
                        } else {
                            const days = Math.floor(diff / (24 * 60 * 60 * 1000));
                            const hours = Math.floor((diff % (24 * 60 * 60 * 1000)) / (60 * 60 * 1000));
                            setHuddleTimeRemaining(`${days}d ${hours}h remaining`);
                        }
                    };
                    updateTimer();
                }
            } catch (err) {
                if (active) setIsHuddleInit(false);
            }
        };

        checkHuddle();
        return () => { active = false; };
    }, [resolvedParams.formId]);

    // Load comments and subscribe
    useEffect(() => {
        if (!resolvedParams.formId || !isHuddleInit) return;
        let active = true;
        setHuddleLoading(true);

        const loadHuddleComments = async () => {
            try {
                const res = await listComments(resolvedParams.formId);
                if (!active) return;
                const msgs = await Promise.all(
                    res.rows.map(async (doc: any) => {
                        let senderName = 'Collaborator';
                        if (user && doc.userId === user.$id) {
                            senderName = user.name || 'You';
                        } else {
                            try {
                                const profile = await AppwriteService.getProfile(doc.userId);
                                if (profile) senderName = profile.name || 'Collaborator';
                            } catch {}
                        }
                        return {
                            id: doc.$id,
                            senderId: doc.userId,
                            senderName,
                            content: doc.content,
                            timestamp: new Date(doc.createdAt).getTime(),
                        };
                    })
                );
                msgs.sort((a: any, b: any) => a.timestamp - b.timestamp);
                setHuddleMessages(msgs);
            } catch (err) {
                console.error('Failed to load huddle comments:', err);
            } finally {
                if (active) setHuddleLoading(false);
            }
        };

        loadHuddleComments();

        const unsubscribe = client.subscribe(
            `databases.${APPWRITE_CONFIG.DATABASES.NOTE}.collections.comments.documents`,
            async (response: any) => {
                if (!active) return;
                const events = response.events;
                const payload = response.payload;

                if (events.some((e: string) => e.includes('.create')) && payload.noteId === resolvedParams.formId) {
                    let senderName = 'Collaborator';
                    if (user && payload.userId === user.$id) {
                        senderName = user.name || 'You';
                    } else {
                        try {
                            const profile = await AppwriteService.getProfile(payload.userId);
                            if (profile) senderName = profile.name || 'Collaborator';
                        } catch {}
                    }
                    const msg = {
                        id: payload.$id,
                        senderId: payload.userId,
                        senderName,
                        content: payload.content,
                        timestamp: new Date(payload.createdAt).getTime(),
                    };
                    setHuddleMessages(prev => {
                        if (prev.some(m => m.id === msg.id)) return prev;
                        return [...prev, msg].sort((a, b) => a.timestamp - b.timestamp);
                    });
                }
            }
        );

        return () => {
            active = false;
            unsubscribe();
        };
    }, [resolvedParams.formId, isHuddleInit, user]);

    useEffect(() => {
        huddleMessageEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    }, [huddleMessages]);

    const handleInitHuddle = async () => {
        if (!form) return;
        setHuddleLoading(true);
        try {
            await createGhostNoteForResource(resolvedParams.formId, 'form', `${form.title} Discussion`);
            setIsHuddleInit(true);
            showSuccess('Form huddle thread initialized!');
        } catch (err) {
            console.error('Failed to init huddle:', err);
            showError('Failed to initialize huddle.');
        } finally {
            setHuddleLoading(false);
        }
    };

    const handleSendHuddleMessage = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!inputText.trim() || huddleSending) return;
        setHuddleSending(true);
        try {
            await createComment(resolvedParams.formId, inputText.trim());
            setInputText('');
        } catch (err) {
            console.error('Failed to send comment:', err);
            showError('Failed to send message.');
        } finally {
            setHuddleSending(false);
        }
    };

    const handleSaveHuddleAsStory = async () => {
        setHuddleLoading(true);
        try {
            await promoteGhostResourceThreadToStory(resolvedParams.formId, 'form');
            showSuccess('Discussion promoted to permanent Story note!');
            setIsHuddleInit(false);
            setHuddleMessages([]);
        } catch (err) {
            console.error('Failed to save story:', err);
            showError('Failed to promote discussion.');
        } finally {
            setHuddleLoading(false);
        }
    };

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
        const url = `${window.location.origin}/flow/form/${resolvedParams.formId}`;
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
            <MultiSectionContainer panels={['projects', 'huddles', 'goals']}>
            {/* Header / Sub-Header */}
            <Box sx={{ mb: 4, display: 'flex', flexDirection: { xs: 'column', md: 'row' }, gap: 3, justifyContent: 'space-between', alignItems: { md: 'center' } }}>
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
                    <IconButton 
                        {...(onBack ? { onClick: onBack } : { component: Link, href: "/flow/forms" })} 
                        sx={{ bgcolor: '#161514', color: '#6366F1', '&:hover': { bgcolor: '#1F1D1B' } }}
                    >
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
                    <IconButton size="small" component={Link} href={`/flow/form/${form.$id}`} target="_blank" sx={{ color: '#10B981' }}>
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
                    <Tab 
                        icon={<MessageSquare size={16} />} 
                        iconPosition="start" 
                        label={<Typography sx={{ fontWeight: 900, fontSize: '0.8rem', letterSpacing: '0.05em' }}>DISCUSSION</Typography>} 
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

            {tab === 2 && (
                <Fade in={true}>
                    <Box sx={{ display: 'flex', flexDirection: 'column', height: 600, bgcolor: 'rgba(255,255,255,0.01)', borderRadius: '24px', border: '1px solid rgba(255,255,255,0.04)', overflow: 'hidden', position: 'relative' }}>
                        {/* Mode Control & Toolbar */}
                        <Stack direction="row" justifyContent="space-between" alignItems="center" sx={{ p: 2.25, borderBottom: '1px solid rgba(255,255,255,0.06)', bgcolor: 'rgba(0,0,0,0.15)' }}>
                            <Typography variant="body2" sx={{ fontWeight: 900, color: 'white' }}>Public Huddle Thread</Typography>
                            {isHuddleInit && huddleTimeRemaining && (
                                <Stack direction="row" spacing={1.5} alignItems="center">
                                    <Stack direction="row" spacing={0.75} alignItems="center" sx={{ color: '#F59E0B' }}>
                                        <Clock size={14} style={{ color: '#F59E0B' }} />
                                        <Typography variant="caption" sx={{ fontWeight: 800 }}>{huddleTimeRemaining}</Typography>
                                    </Stack>
                                    <Button
                                        size="small"
                                        startIcon={<FileText size={14} />}
                                        onClick={handleSaveHuddleAsStory}
                                        sx={{
                                            bgcolor: 'rgba(236, 72, 153, 0.1)', color: '#EC4899', fontWeight: 800, fontSize: '0.75rem', px: 2, py: 0.75, borderRadius: '8px', textTransform: 'none',
                                            '&:hover': { bgcolor: 'rgba(236, 72, 153, 0.15)' }
                                        }}
                                    >
                                        Save Story
                                    </Button>
                                </Stack>
                            )}
                        </Stack>

                        {/* Main Viewport */}
                        <Box sx={{ flex: 1, minHeight: 0, display: 'flex', flexDirection: 'column', position: 'relative' }}>
                            {huddleLoading && (
                                <Box sx={{ position: 'absolute', inset: 0, display: 'grid', placeItems: 'center', bgcolor: 'rgba(10,9,8,0.7)', zIndex: 2 }}>
                                    <CircularProgress size={28} sx={{ color: '#6366F1' }} />
                                </Box>
                            )}

                            {!isHuddleInit ? (
                                <Box sx={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', p: 4, textAlign: 'center' }}>
                                    <Box sx={{ width: 56, height: 56, borderRadius: '16px', display: 'grid', placeItems: 'center', bgcolor: 'rgba(99, 102, 241, 0.08)', color: '#6366F1', border: '1px solid rgba(99, 102, 241, 0.15)', mb: 2.5 }}>
                                        <Globe size={26} style={{ color: '#6366F1' }} />
                                    </Box>
                                    <Typography variant="body2" sx={{ fontWeight: 800, color: 'white', mb: 1 }}>Initialize Public Huddle</Typography>
                                    <Typography variant="caption" sx={{ color: 'rgba(255,255,255,0.4)', maxWidth: 360, lineHeight: 1.5, mb: 3 }}>
                                        Coordinate form structure, survey target audience, or review field submissions with your collaborators in this temporary real-time public thread. Comments auto-clean in 7 days.
                                    </Typography>
                                    <Button 
                                        onClick={handleInitHuddle}
                                        sx={{ bgcolor: '#6366F1', color: '#fff', fontWeight: 800, fontSize: '0.8rem', py: 1.25, px: 3, borderRadius: '10px', textTransform: 'none', '&:hover': { bgcolor: '#575CF0' } }}
                                    >
                                        Start Huddle
                                    </Button>
                                </Box>
                            ) : (
                                <>
                                    <Box sx={{ flex: 1, overflowY: 'auto', p: 3, display: 'flex', flexDirection: 'column', gap: 2 }}>
                                        {huddleMessages.length === 0 ? (
                                            <Box sx={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', opacity: 0.35 }}>
                                                <Typography variant="caption" sx={{ fontStyle: 'italic' }}>No messages yet. Start the discussion!</Typography>
                                            </Box>
                                        ) : (
                                            huddleMessages.map((msg) => {
                                                const isSelf = msg.senderId === user?.$id;
                                                return (
                                                    <Box key={msg.id} sx={{ alignSelf: isSelf ? 'flex-end' : 'flex-start', maxWidth: '75%' }}>
                                                        <Typography variant="caption" sx={{ color: 'rgba(255,255,255,0.3)', fontWeight: 800, display: 'block', mb: 0.5, textAlign: isSelf ? 'right' : 'left' }}>
                                                            {msg.senderName}
                                                        </Typography>
                                                        <Paper 
                                                            elevation={0}
                                                            sx={{
                                                                p: 1.75,
                                                                borderRadius: '16px',
                                                                borderTopRightRadius: isSelf ? 0 : '16px',
                                                                borderTopLeftRadius: isSelf ? '16px' : 0,
                                                                bgcolor: isSelf ? '#6366F1' : 'rgba(255,255,255,0.03)',
                                                                border: isSelf ? 'none' : '1px solid rgba(255,255,255,0.04)',
                                                                color: '#fff',
                                                                boxShadow: 'none',
                                                                backgroundImage: 'none'
                                                            }}
                                                        >
                                                            <Typography variant="body2" sx={{ fontWeight: 600, lineHeight: 1.5, wordBreak: 'break-word', fontSize: '0.85rem' }}>
                                                                {msg.content}
                                                            </Typography>
                                                        </Paper>
                                                        <Typography variant="caption" sx={{ color: 'rgba(255,255,255,0.2)', fontSize: '0.65rem', display: 'block', mt: 0.5, textAlign: isSelf ? 'right' : 'left' }}>
                                                            {new Date(msg.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                                                        </Typography>
                                                    </Box>
                                                );
                                            })
                                        )}
                                        <div ref={huddleMessageEndRef} />
                                    </Box>

                                    {/* Input Form */}
                                    <Box component="form" onSubmit={handleSendHuddleMessage} sx={{ p: 2.25, borderTop: '1px solid rgba(255,255,255,0.06)', bgcolor: 'rgba(0,0,0,0.15)' }}>
                                        <Stack direction="row" spacing={1.5}>
                                            <TextField
                                                fullWidth
                                                size="small"
                                                value={inputText}
                                                onChange={(e) => setInputText(e.target.value)}
                                                placeholder="Type huddle message (auto-cleans in 7 days)..."
                                                variant="standard"
                                                InputProps={{
                                                    disableUnderline: true,
                                                    sx: {
                                                        bgcolor: '#0A0908',
                                                        borderRadius: '12px',
                                                        color: 'white',
                                                        px: 2,
                                                        py: 1,
                                                        fontWeight: 600,
                                                        fontSize: '0.85rem',
                                                        border: '1px solid rgba(255,255,255,0.05)',
                                                        '&:hover': { borderColor: 'rgba(255,255,255,0.1)' }
                                                    }
                                                }}
                                            />
                                            <IconButton 
                                                type="submit"
                                                disabled={!inputText.trim() || huddleSending}
                                                sx={{
                                                    bgcolor: '#6366F1',
                                                    color: '#fff',
                                                    borderRadius: '12px',
                                                    width: 40,
                                                    height: 40,
                                                    '&:hover': { bgcolor: '#575CF0' },
                                                    '&.Mui-disabled': { bgcolor: 'rgba(255,255,255,0.02)', color: 'rgba(255,255,255,0.1)' }
                                                }}
                                            >
                                                <Send size={16} style={{ color: '#fff' }} />
                                            </IconButton>
                                        </Stack>
                                    </Box>
                                </>
                            )}
                        </Box>
                    </Box>
                </Fade>
            )}

            {/* Edit Dialog */}
            {isEditing && (
                <FormDialog 
                    open={isEditing} 
                    onClose={() => setIsEditing(false)} 
                    form={form} 
                    onSaved={fetchForm} 
                />
            )}

            <Snackbar 
                open={!!snackbar} 
                autoHideDuration={3000} 
                onClose={() => setSnackbar(null)}
                anchorOrigin={{ vertical: 'bottom', horizontal: 'center' }}
            >
                <Alert severity="success" sx={{ bgcolor: '#10B981', color: '#000', fontWeight: 800, borderRadius: 2 }}>{snackbar}</Alert>
            </Snackbar>
          </MultiSectionContainer>
        </Box>
  );
}
