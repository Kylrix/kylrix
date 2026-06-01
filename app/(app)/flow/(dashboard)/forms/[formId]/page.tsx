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
    Alert,
    Skeleton
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
import { useUnifiedDrawer } from '@/context/UnifiedDrawerContext';
import { getResourceCollaboratorsSecure } from '@/lib/actions/secure-ops';
import { account } from '@/lib/appwrite';
import { MessageSquare, Clock, FileText, Globe, Send, Share2 } from 'lucide-react';
import { TextField } from '@mui/material';
import { MultiSectionContainer } from '@/context/SectionContext';
import { IdentityAvatar } from '@/components/common/IdentityBadge';

export default function FormDetailsPage({ params, formId: propFormId, onBack }: { params?: Promise<{ formId: string }>; formId?: string; onBack?: () => void }) {
    const resolvedParams = {
        formId: propFormId || (params ? use(params).formId : '')
    };
    const [rawForm, setRawForm] = useState<Forms | null>(null);
    const [loading, setLoading] = useState(true);

    const form = rawForm || (loading ? {
        $id: resolvedParams.formId as string,
        title: 'Loading Form...',
        status: 'draft',
        schema: '[]',
        $createdAt: new Date().toISOString(),
        $updatedAt: new Date().toISOString(),
    } as any : null);
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

    const { open: openUnified } = useUnifiedDrawer();
    const [collaborators, setCollaborators] = useState<any[]>([]);
    const [loadingCollaborators, setLoadingCollaborators] = useState(false);

    const fetchCollaborators = useCallback(async () => {
        if (!resolvedParams.formId) return;
        setLoadingCollaborators(true);
        try {
            const { jwt } = await account.createJWT();
            const { collaborators: collabs } = await getResourceCollaboratorsSecure({
                resourceId: resolvedParams.formId,
                resourceType: 'form',
                jwt
            });
            setCollaborators(collabs || []);
        } catch (err) {
            console.error('Failed to fetch form collaborators:', err);
        } finally {
            setLoadingCollaborators(false);
        }
    }, [resolvedParams.formId]);

    useEffect(() => {
        fetchCollaborators();
    }, [fetchCollaborators]);

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
            setRawForm(data);
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

    if (!loading && !form) return <Box sx={{ p: 4 }}><Typography color="error">Form not found.</Typography></Box>;

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
                        sx={{ bgcolor: '#161412', color: '#6366F1', border: '1px solid #34322F', '&:hover': { bgcolor: '#1C1A18', borderColor: '#6366F1' } }}
                    >
                        <BackIcon />
                    </IconButton>
                    <Box>
                        <Stack direction="row" spacing={1} alignItems="center">
                            {loading ? (
                                <Skeleton variant="text" width={220} height={36} sx={{ bgcolor: '#161412', borderRadius: '4px' }} />
                            ) : (
                                <Typography variant="h4" sx={{ fontWeight: 900, letterSpacing: '-0.04em', fontFamily: 'var(--font-clash)', color: '#FFF' }}>{form.title}</Typography>
                            )}
                            {!loading && (
                                <Chip 
                                    label={(form.status || 'unknown').toUpperCase()} 
                                    size="small" 
                                    sx={{ 
                                        fontSize: '9px', 
                                        fontWeight: 900, 
                                        bgcolor: 'transparent',
                                        color: getStatusColor(form.status || 'draft'),
                                        border: `1px solid ${getStatusColor(form.status || 'draft')}`,
                                        fontFamily: 'var(--font-mono)'
                                    }} 
                                />
                            )}
                        </Stack>
                        {loading ? (
                            <Skeleton variant="text" width={140} height={18} sx={{ bgcolor: '#161412', mt: 1, borderRadius: '3px' }} />
                        ) : (
                            <Typography variant="body2" sx={{ color: '#9B9691', fontWeight: 600, fontFamily: 'var(--font-satoshi)' }}>Form ID: {form.$id}</Typography>
                        )}
                    </Box>
                </Box>

                <Stack direction="row" spacing={2} sx={{ width: { xs: '100%', md: 'auto' } }}>
                    {form.status === 'published' && (
                        <Button 
                            variant="outlined" 
                            startIcon={<CopyIcon />} 
                            onClick={handleCopyLink}
                            sx={{ borderRadius: '12px', textTransform: 'none', fontWeight: 800, borderColor: '#34322F', color: '#FFF', bgcolor: '#161412', fontFamily: 'var(--font-satoshi)', '&:hover': { bgcolor: '#1C1A18', borderColor: '#6366F1' } }}
                        >
                            Copy Public Link
                        </Button>
                    )}
                    <Button 
                        variant="outlined" 
                        startIcon={<Share2 size={16} />} 
                        onClick={() => openUnified('share-note', {
                            resourceId: resolvedParams.formId,
                            resourceType: 'form',
                            resourceTitle: form.title,
                            onShared: () => fetchCollaborators()
                        })}
                        sx={{ borderRadius: '12px', textTransform: 'none', fontWeight: 800, borderColor: '#34322F', color: '#FFF', bgcolor: '#161412', fontFamily: 'var(--font-satoshi)', '&:hover': { bgcolor: '#1C1A18', borderColor: '#6366F1' } }}
                    >
                        Share Form
                    </Button>
                    <Button 
                        variant="contained" 
                        startIcon={<EditIcon />} 
                        onClick={() => setIsEditing(true)}
                        sx={{ borderRadius: '12px', px: 3, fontWeight: 800, bgcolor: '#6366F1', color: 'black', fontFamily: 'var(--font-satoshi)', '&:hover': { bgcolor: '#575CF0' } }}
                    >
                        Edit Design
                    </Button>
                </Stack>
            </Box>

            {/* Dynamic Status Bar (Only when Published) */}
            {form.status === 'published' && (
                <Paper sx={{ p: 1.5, mb: 4, borderRadius: '16px', bgcolor: '#161412', border: '1px solid #10B981', display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 2, backgroundImage: 'none', boxShadow: 'none' }}>
                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5, ml: 1 }}>
                        <Box sx={{ width: 8, height: 8, borderRadius: '50%', bgcolor: '#10B981', boxShadow: '0 0 8px #10B981' }} />
                        <Typography variant="body2" sx={{ fontWeight: 800, color: '#10B981', fontSize: '0.75rem', letterSpacing: '0.05em', fontFamily: 'var(--font-mono)' }}>FORM IS LIVE & ACCEPTING RESPONSES</Typography>
                    </Box>
                    <IconButton size="small" component={Link} href={`/flow/form/${form.$id}`} target="_blank" sx={{ color: '#10B981' }}>
                        <LaunchIcon sx={{ fontSize: 18 }} />
                    </IconButton>
                </Paper>
            )}

            {/* Tabs */}
            <Box sx={{ borderBottom: 1, borderColor: '#34322F', mb: 4 }}>
                <Tabs 
                    value={tab} 
                    onChange={(_, v) => setTab(v)}
                    sx={{
                        '& .MuiTab-root': { fontWeight: 800, fontSize: '0.85rem', color: '#9B9691', px: 3, fontFamily: 'var(--font-satoshi)' },
                        '& .Mui-selected': { color: '#6366F1 !important' },
                        '& .MuiTabs-indicator': { bgcolor: '#6366F1', height: 3, borderRadius: '3px 3px 0 0' }
                    }}
                >
                    <Tab label="RESPONSES" icon={<InsightsIcon sx={{ fontSize: 18 }} />} iconPosition="start" />
                    <Tab label="PREVIEW & SCHEMA" icon={<FormIcon sx={{ fontSize: 18 }} />} iconPosition="start" />
                    <Tab label="DISCUSSION" icon={<MessageSquare size={16} />} iconPosition="start" />
                </Tabs>
            </Box>

            {/* Tab Panels */}
            {tab === 0 && (
                <Fade in={true}>
                    <Box>
                        {loading ? (
                            <Stack spacing={2}>
                                {[1, 2, 3].map((i) => (
                                    <Skeleton key={i} variant="rounded" width="100%" height={80} sx={{ bgcolor: '#161412', borderRadius: '12px' }} />
                                ))}
                            </Stack>
                        ) : (
                            <SubmissionViewer formId={resolvedParams.formId} formSchema={form.schema} />
                        )}
                    </Box>
                </Fade>
            )}

            {tab === 1 && (
                <Fade in={true}>
                    <Box sx={{ display: 'grid', gridTemplateColumns: { xs: '1fr', lg: '3fr 2fr' }, gap: 4 }}>
                        <Paper sx={{ p: 4, borderRadius: '24px', bgcolor: '#161412', border: '1px solid #34322F', backgroundImage: 'none', boxShadow: 'none' }}>
                            <Typography variant="overline" sx={{ color: '#9B9691', fontWeight: 900, mb: 4, display: 'block', fontFamily: 'var(--font-mono)' }}>SCHEMA PREVIEW</Typography>
                            <Box sx={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                                {loading ? (
                                    <Box sx={{ display: 'flex', flexDirection: 'column', gap: 3 }}>
                                        {[1, 2].map((i) => (
                                            <Box key={i}>
                                                <Skeleton variant="text" width="30%" height={20} sx={{ bgcolor: '#1C1A18', mb: 1 }} />
                                                <Skeleton variant="rounded" width="100%" height={56} sx={{ bgcolor: '#161412', borderRadius: '8px' }} />
                                            </Box>
                                        ))}
                                    </Box>
                                ) : JSON.parse(form.schema || '[]').map((field: any) => (
                                    <Box key={field.id}>
                                        <Typography variant="subtitle2" sx={{ mb: 1, fontWeight: 800, fontFamily: 'var(--font-satoshi)', color: '#FFF' }}>
                                            {field.label} {field.required && <Box component="span" sx={{ color: '#ff1744' }}>*</Box>}
                                        </Typography>
                                        <Box sx={{ p: 2, borderRadius: '12px', bgcolor: '#000000', border: '1px solid #34322F', color: '#9B9691', fontSize: '0.85rem', fontFamily: 'var(--font-satoshi)' }}>
                                            {field.placeholder || `Input for ${field.type}...`}
                                        </Box>
                                    </Box>
                                ))}
                            </Box>
                        </Paper>

                        <Box sx={{ display: 'flex', flexDirection: 'column', gap: 3 }}>
                            <Paper sx={{ p: 4, borderRadius: '24px', bgcolor: '#161412', border: '1px solid #34322F', height: 'fit-content', backgroundImage: 'none', boxShadow: 'none' }}>
                                <Typography variant="overline" sx={{ color: '#9B9691', fontWeight: 900, mb: 2, display: 'block', fontFamily: 'var(--font-mono)' }}>RAW JSON</Typography>
                                {loading ? (
                                    <Skeleton variant="rounded" width="100%" height={160} sx={{ bgcolor: '#161412', borderRadius: '8px' }} />
                                ) : (
                                    <Box component="pre" sx={{ fontSize: '0.75rem', color: '#9B9691', overflow: 'auto', maxHeight: 400, fontFamily: 'var(--font-mono)', bgcolor: '#000000', border: '1px solid #34322F', p: 2, borderRadius: '12px' }}>
                                        {JSON.stringify(JSON.parse(form.schema || '[]'), null, 2)}
                                    </Box>
                                )}
                            </Paper>

                            <Paper sx={{ p: 4, borderRadius: '24px', bgcolor: '#161412', border: '1px solid #34322F', height: 'fit-content', backgroundImage: 'none', boxShadow: 'none' }}>
                                <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 3 }}>
                                    <Typography variant="overline" sx={{ color: '#9B9691', fontWeight: 900, fontFamily: 'var(--font-mono)' }}>COLLABORATORS</Typography>
                                    {!loading && (
                                        <Button 
                                            size="small"
                                            onClick={() => openUnified('share-note', {
                                                resourceId: resolvedParams.formId,
                                                resourceType: 'form',
                                                resourceTitle: form.title,
                                                onShared: () => fetchCollaborators()
                                            })}
                                            sx={{ color: '#10B981', fontWeight: 800, fontSize: '0.7rem', textTransform: 'none', p: 0, minWidth: 0, fontFamily: 'var(--font-satoshi)', '&:hover': { textDecoration: 'underline' } }}
                                        >
                                            + Manage
                                        </Button>
                                    )}
                                </Box>
                                
                                {loading ? (
                                    <Skeleton variant="rounded" width="100%" height={80} sx={{ bgcolor: '#161412', borderRadius: '8px' }} />
                                ) : loadingCollaborators ? (
                                    <CircularProgress size={16} sx={{ color: '#10B981' }} />
                                ) : collaborators.length === 0 ? (
                                    <Typography variant="caption" sx={{ color: '#9B9691', fontStyle: 'italic', display: 'block', fontFamily: 'var(--font-satoshi)' }}>
                                        No co-collaborators added yet.
                                    </Typography>
                                ) : (
                                    <Stack spacing={1.5}>
                                        {collaborators.map((profile) => (
                                            <Box 
                                                key={profile.$id || profile.userId} 
                                                onClick={() => openUnified('share-note', {
                                                    resourceId: resolvedParams.formId,
                                                    resourceType: 'form',
                                                    resourceTitle: form.title,
                                                    initialCollaborator: profile,
                                                    onShared: () => fetchCollaborators()
                                                })}
                                                sx={{ 
                                                    display: 'flex', 
                                                    alignItems: 'center', 
                                                    gap: 1.5, 
                                                    p: 1, 
                                                    borderRadius: '12px', 
                                                    bgcolor: '#1C1A18', 
                                                    border: '1px solid #34322F',
                                                    cursor: 'pointer',
                                                    transition: 'all 0.2s ease',
                                                    '&:hover': {
                                                        borderColor: '#6366F1',
                                                        bgcolor: '#1C1A18'
                                                    }
                                                }}
                                            >
                                                <IdentityAvatar
                                                    fileId={profile.avatar || profile.profilePicId || null}
                                                    alt={profile.displayName || profile.username}
                                                    fallback={(profile.displayName || profile.username || 'U').charAt(0).toUpperCase()}
                                                    size={28}
                                                />
                                                <Box sx={{ flex: 1, minWidth: 0 }}>
                                                    <Typography variant="caption" sx={{ fontWeight: 800, color: 'white', display: 'block', fontFamily: 'var(--font-satoshi)' }} noWrap>
                                                        {profile.displayName || profile.username}
                                                    </Typography>
                                                    <Typography variant="caption" sx={{ color: '#9B9691', display: 'block', fontSize: '9px', fontFamily: 'var(--font-mono)' }}>
                                                        {profile.permissionLevel || 'Viewer'}
                                                    </Typography>
                                                </Box>
                                            </Box>
                                        ))}
                                    </Stack>
                                )}
                            </Paper>
                        </Box>
                    </Box>
                </Fade>
            )}

            {tab === 2 && (
                <Fade in={true}>
                    <Box sx={{ display: 'flex', flexDirection: 'column', height: 600, bgcolor: '#161412', borderRadius: '24px', border: '1px solid #34322F', overflow: 'hidden', position: 'relative' }}>
                        {/* Mode Control & Toolbar */}
                        <Stack direction="row" justifyContent="space-between" alignItems="center" sx={{ p: 2.25, borderBottom: '1px solid #34322F', bgcolor: '#000000' }}>
                            <Typography variant="body2" sx={{ fontWeight: 800, color: '#FFF', fontFamily: 'var(--font-clash)', letterSpacing: '0.01em' }}>Public Huddle Thread</Typography>
                            {isHuddleInit && huddleTimeRemaining && (
                                <Stack direction="row" spacing={1.5} alignItems="center">
                                    <Stack direction="row" spacing={0.75} alignItems="center" sx={{ color: '#FFB020' }}>
                                        <Clock size={14} style={{ color: '#FFB020' }} />
                                        <Typography variant="caption" sx={{ fontWeight: 800, fontFamily: 'var(--font-mono)' }}>{huddleTimeRemaining}</Typography>
                                    </Stack>
                                    <Button
                                        size="small"
                                        startIcon={<FileText size={14} />}
                                        onClick={handleSaveHuddleAsStory}
                                        sx={{
                                            bgcolor: '#1C1A18', color: '#EC4899', border: '1px solid #34322F', fontWeight: 800, fontSize: '0.75rem', px: 2, py: 0.75, borderRadius: '12px', textTransform: 'none', fontFamily: 'var(--font-satoshi)',
                                            '&:hover': { bgcolor: '#34322F', borderColor: '#EC4899' }
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
                                <Box sx={{ position: 'absolute', inset: 0, display: 'grid', placeItems: 'center', bgcolor: '#000000', zIndex: 2 }}>
                                    <CircularProgress size={28} sx={{ color: '#6366F1' }} />
                                </Box>
                            )}

                            {!isHuddleInit ? (
                                <Box sx={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', p: 4, textAlign: 'center' }}>
                                    <Box sx={{ width: 56, height: 56, borderRadius: '16px', display: 'grid', placeItems: 'center', bgcolor: '#1C1A18', color: '#6366F1', border: '1px solid #34322F', mb: 2.5 }}>
                                        <Globe size={26} style={{ color: '#6366F1' }} />
                                    </Box>
                                    <Typography variant="body2" sx={{ fontWeight: 800, color: '#FFF', mb: 1, fontFamily: 'var(--font-clash)', letterSpacing: '0.01em' }}>Initialize Public Huddle</Typography>
                                    <Typography variant="caption" sx={{ color: '#9B9691', maxWidth: 360, lineHeight: 1.5, mb: 3, fontFamily: 'var(--font-satoshi)' }}>
                                        Coordinate form structure, survey target audience, or review field submissions with your collaborators in this temporary real-time public thread. Comments auto-clean in 7 days.
                                    </Typography>
                                    <Button 
                                        onClick={handleInitHuddle}
                                        sx={{ bgcolor: '#6366F1', color: 'black', fontWeight: 800, fontSize: '0.8rem', py: 1.25, px: 3, borderRadius: '12px', textTransform: 'none', fontFamily: 'var(--font-satoshi)', '&:hover': { bgcolor: '#575CF0' } }}
                                    >
                                        Start Huddle
                                    </Button>
                                </Box>
                            ) : (
                                <>
                                    <Box sx={{ flex: 1, overflowY: 'auto', p: 3, display: 'flex', flexDirection: 'column', gap: 2 }}>
                                        {huddleMessages.length === 0 ? (
                                            <Box sx={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                                                <Typography variant="caption" sx={{ fontStyle: 'italic', color: '#9B9691', fontFamily: 'var(--font-satoshi)' }}>No messages yet. Start the discussion!</Typography>
                                            </Box>
                                        ) : (
                                            huddleMessages.map((msg) => {
                                                const isSelf = msg.senderId === user?.$id;
                                                return (
                                                    <Box key={msg.id} sx={{ alignSelf: isSelf ? 'flex-end' : 'flex-start', maxWidth: '75%' }}>
                                                        <Typography variant="caption" sx={{ color: '#9B9691', fontWeight: 800, display: 'block', mb: 0.5, textAlign: isSelf ? 'right' : 'left', fontFamily: 'var(--font-satoshi)' }}>
                                                            {msg.senderName}
                                                        </Typography>
                                                        <Paper 
                                                            elevation={0}
                                                            sx={{
                                                                p: 1.75,
                                                                borderRadius: '16px',
                                                                borderTopRightRadius: isSelf ? 0 : '16px',
                                                                borderTopLeftRadius: isSelf ? '16px' : 0,
                                                                bgcolor: isSelf ? '#6366F1' : '#1C1A18',
                                                                border: isSelf ? 'none' : '1px solid #34322F',
                                                                color: isSelf ? 'black' : '#fff',
                                                                boxShadow: 'none',
                                                                backgroundImage: 'none'
                                                            }}
                                                        >
                                                            <Typography variant="body2" sx={{ fontWeight: 600, lineHeight: 1.5, wordBreak: 'break-word', fontSize: '0.85rem', fontFamily: 'var(--font-satoshi)' }}>
                                                                {msg.content}
                                                            </Typography>
                                                        </Paper>
                                                        <Typography variant="caption" sx={{ color: '#9B9691', fontSize: '0.65rem', display: 'block', mt: 0.5, textAlign: isSelf ? 'right' : 'left', fontFamily: 'var(--font-mono)' }}>
                                                            {new Date(msg.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                                                        </Typography>
                                                    </Box>
                                                );
                                            })
                                        )}
                                        <div ref={huddleMessageEndRef} />
                                    </Box>

                                    {/* Input Form */}
                                    <Box component="form" onSubmit={handleSendHuddleMessage} sx={{ p: 2.25, borderTop: '1px solid #34322F', bgcolor: '#000000' }}>
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
                                                        bgcolor: '#161412',
                                                        borderRadius: '12px',
                                                        color: 'white',
                                                        px: 2,
                                                        py: 1,
                                                        fontWeight: 600,
                                                        fontSize: '0.85rem',
                                                        border: '1px solid #34322F',
                                                        fontFamily: 'var(--font-satoshi)',
                                                        '&:hover': { borderColor: '#6366F1' }
                                                    }
                                                }}
                                            />
                                            <IconButton 
                                                type="submit"
                                                disabled={!inputText.trim() || huddleSending}
                                                sx={{
                                                    bgcolor: '#6366F1',
                                                    color: 'black',
                                                    borderRadius: '12px',
                                                    width: 40,
                                                    height: 40,
                                                    '&:hover': { bgcolor: '#575CF0' },
                                                    '&.Mui-disabled': { bgcolor: '#1C1A18', color: '#34322F' }
                                                }}
                                            >
                                                <Send size={16} style={{ color: 'inherit' }} />
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
