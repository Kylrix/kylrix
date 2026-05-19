'use client';

import React, { useState, useEffect, useCallback } from 'react';
import {
    Drawer,
    DialogTitle,
    DialogContent,
    List,
    ListItem,
    ListItemAvatar,
    ListItemText,
    ListItemButton,
    Avatar,
    Typography,
    Box,
    IconButton,
    Divider,
    Button,
    Stack,
    Paper,
    alpha,
    useTheme,
    useMediaQuery,
    CircularProgress,
    TextField,
    MenuItem
} from '@mui/material';
import {
    Video,
    Phone,
    Plus,
    Calendar,
    X,
    User,
    Users,
    Clock,
    Type,
    Timer,
    ArrowLeft,
    Hash,
    Copy,
    ExternalLink,
    Mic,
    VideoIcon
} from 'lucide-react';
import { useRouter } from 'next/navigation';
import { ChatService } from '@/lib/services/chat';
import { useAuth } from '@/lib/auth';
import { CallService } from '@/lib/services/call';
import { UsersService } from '@/lib/services/users';
import toast from 'react-hot-toast';
import type { CallLaunchContext } from '@/context/CallLauncherContext';
import { updateNote } from '@/lib/appwrite/note';
import { tasks as taskApi } from '@/lib/kylrixflow';
import { ActivityService } from '@/lib/services/activity';
import { useDrawerState } from '@/components/ui/DrawerStateContext';

// Brand Colors
const COLORS = {
    background: '#0A0908',
    surface: '#161412',
    hover: '#1C1A18',
    primary: '#6366F1', // Ecosystem Primary (Indigo)
    secondary: '#F59E0B', // Connect Primary (Amber)
    rim: 'rgba(255, 255, 255, 0.05)'
};

const truncate = (value: string, max = 44) => {
    const text = String(value || '').trim();
    if (text.length <= max) return text;
    return `${text.slice(0, Math.max(0, max - 1)).trimEnd()}…`;
};

const shortTime = () =>
    new Intl.DateTimeFormat(undefined, { hour: 'numeric', minute: '2-digit' }).format(new Date());

export const CallActionModal = ({
    open,
    onClose,
    launchContext,
}: {
    open: boolean;
    onClose: () => void;
    launchContext?: CallLaunchContext;
}) => {
    const { user } = useAuth();
    const router = useRouter();
    const theme = useTheme();
    const { setIsDrawerOpen } = useDrawerState();

    useEffect(() => {
        setIsDrawerOpen(open);
    }, [open, setIsDrawerOpen]);
    const isMobile = useMediaQuery(theme.breakpoints.down('md'), { noSsr: true });
    const [conversations, setConversations] = useState<any[]>([]);
    const [loading, setLoading] = useState(false);
    const [showScheduleForm, setShowScheduleForm] = useState(false);
    const [showJoinWithId, setShowJoinWithId] = useState(false);
    const [scheduleTitle, setScheduleTitle] = useState('');
    const [instantTitle, setInstantTitle] = useState('');
    const [scheduleTime, setScheduleTime] = useState('');
    const [joinId, setJoinId] = useState('');
    const [duration, setDuration] = useState(120); // Default 2 hours
    const [creating, setCreating] = useState(false);
    const [liveCallState, setLiveCallState] = useState<null | {
        callId: string;
        title: string;
        participantIds: string[];
        type: 'audio' | 'video';
    }>(null);
    const isScopedLaunch = Boolean(launchContext?.conversationId);
    const isNoteLaunch = Boolean(launchContext?.noteId);
    const isTaskLaunch = Boolean(launchContext?.taskId);

    const annotateTaskHuddle = async (taskId: string, callId: string, startedAtIso: string, durationMinutes: number) => {
        try {
            const task = await taskApi.get(taskId);
            const baseDescription = String(task?.description || '').trim();
            const stamp = `\n\n[Kylrix Huddle]\ncallId=${callId}\nstartedAt=${startedAtIso}\ndurationMinutes=${durationMinutes}`;
            await taskApi.update(taskId, {
                description: `${baseDescription}${stamp}`.trim(),
            });
        } catch (error) {
            console.warn('[CallActionModal] Failed to annotate task huddle metadata', error);
        }
    };

    const resolveDefaultInstantTitle = useCallback(async () => {
        if (!launchContext) return '';

        const now = shortTime();

        if (launchContext.noteId) {
            const base = truncate(launchContext.title || 'Shared Note', 42);
            return `${base} • ${now}`;
        }

        if (launchContext.conversationId && user?.$id) {
            try {
                const conversation = await ChatService.getConversationById(launchContext.conversationId, user.$id);
                const participants = Array.isArray(conversation?.participants)
                    ? Array.from(new Set(conversation.participants.filter((id: unknown): id is string => typeof id === 'string' && id.trim().length > 0)))
                    : Array.from(new Set((launchContext.participantIds || []).filter((id): id is string => typeof id === 'string' && id.trim().length > 0)));

                if (conversation?.type === 'group') {
                    const groupName = truncate(conversation?.name || launchContext.conversationName || 'Group', 34);
                    return `${groupName} • ${now}`;
                }

                const pair = Array.from(new Set([user.$id, ...participants])).slice(0, 2);
                if (pair.length >= 2) {
                    const profiles = await Promise.all(pair.map((id) => UsersService.getProfileById(id as string).catch(() => null)));
                    const names = profiles.map((profile, idx) => {
                        const fallback = idx === 0 ? 'You' : 'Guest';
                        return profile?.username || profile?.displayName || fallback;
                    });
                    return `${names[0]} + ${names[1]} • ${now}`;
                }
            } catch {
                // fallback handled below
            }

            const fallbackName = truncate(launchContext.conversationName || 'Call', 34);
            return `${fallbackName} • ${now}`;
        }

        return '';
    }, [launchContext, user?.$id]);

    const loadConversations = useCallback(async () => {
        if (!user) return;
        setLoading(true);
        try {
            const res = await ChatService.getConversations(user.$id);
            const filtered = res.rows.filter((c: any) => {
                const isSelf = c.type === 'direct' && c.participants && 
                              (c.participants.length === 1 || 
                               (c.participants.length === 2 && c.participants.every((p: string) => p === user.$id)));
                return !isSelf;
            });
            setConversations(filtered);
        } catch (e) {
            console.error('Failed to load individuals:', e);
        } finally {
            setLoading(false);
        }
    }, [user]);

    useEffect(() => {
        if (open && user) {
            loadConversations();
            setShowScheduleForm(false);
            setShowJoinWithId(false);
            setScheduleTitle('');
            setInstantTitle('');
            setScheduleTime('');
            setJoinId('');
            setDuration(120);
            setLiveCallState(null);
            resolveDefaultInstantTitle().then((title) => {
                if (title) setInstantTitle(title);
            }).catch(() => undefined);
            if (launchContext?.existingCallId) {
                const participants = Array.from(new Set([user.$id, ...(launchContext.participantIds || [])]));
                setLiveCallState({
                    callId: launchContext.existingCallId,
                    title: launchContext.title || launchContext.conversationName || 'Live Call',
                    participantIds: participants,
                    type: 'video',
                });
            }
        }
    }, [launchContext, open, user, loadConversations, resolveDefaultInstantTitle]);

    const handleStartPublicCall = async () => {
        if (!user) return;
        setCreating(true);
        try {
            let _link;
            if (launchContext?.conversationId) {
                const conversation = await ChatService.getConversationById(launchContext.conversationId, user.$id);
                const participants: string[] = Array.isArray(conversation?.participants)
                    ? Array.from(new Set(
                        conversation.participants.filter(
                            (id: unknown): id is string => typeof id === 'string' && id.trim().length > 0
                        )
                    ))
                    : (launchContext.participantIds || []).filter(
                        (id): id is string => typeof id === 'string' && id.trim().length > 0
                    );

                _link = await CallService.createScopedCallLink({
                    userId: user.$id,
                    type: 'video',
                    title: instantTitle || launchContext.title || conversation?.name || undefined,
                    durationMinutes: duration,
                    scope: conversation?.type === 'group' ? 'group' : 'direct',
                    sourceApp: 'connect',
                    conversationId: launchContext.conversationId,
                    participantIds: participants,
                    isPrivate: true,
                    allowGuests: false,
                });
            } else if (launchContext?.noteId) {
                const participants: string[] = Array.from(new Set(launchContext.participantIds || [user.$id]));
                _link = await CallService.createScopedCallLink({
                    userId: user.$id,
                    type: 'video',
                    title: instantTitle || launchContext.title || 'Note Huddle',
                    durationMinutes: duration,
                    scope: 'note',
                    sourceApp: 'note',
                    noteId: launchContext.noteId,
                    participantIds: participants,
                    isPrivate: true,
                    allowGuests: false,
                });
                const startedAtIso = new Date().toISOString();
                await updateNote(launchContext.noteId, {
                    huddleCallId: _link.$id,
                    huddleStartedAt: startedAtIso,
                    huddleDurationMinutes: duration,
                } as any);
            } else if (launchContext?.taskId) {
                const participants: string[] = Array.from(new Set(launchContext.participantIds || [user.$id]));
                _link = await CallService.createScopedCallLink({
                    userId: user.$id,
                    type: 'video',
                    title: instantTitle || launchContext.title || 'Task Huddle',
                    durationMinutes: duration,
                    scope: 'huddle',
                    sourceApp: 'flow',
                    participantIds: participants,
                    isPrivate: true,
                    allowGuests: false,
                });
                await annotateTaskHuddle(launchContext.taskId, _link.$id, new Date().toISOString(), duration);
            } else {
                _link = await CallService.createCallLink(
                    user.$id,
                    'video',
                    undefined,
                    instantTitle || undefined,
                    undefined,
                    duration
                );
            }
            await ActivityService.setLiveCallActivity(
                user.$id,
                _link.$id,
                isNoteLaunch ? 'note' : isTaskLaunch ? 'flow' : 'connect',
            ).catch(() => undefined);
            const participants = Array.from(new Set([
                user.$id,
                ...(launchContext?.participantIds || []),
            ]));
            setLiveCallState({
                callId: _link.$id,
                title: instantTitle || launchContext?.title || 'Live Call',
                participantIds: participants,
                type: 'video',
            });
        } catch (e: any) {
            console.error('[CallActionModal] Failed to start public call:', e);
            const errorMessage = e.message || "Failed to start public call";
            toast.error(errorMessage);
        } finally {
            setCreating(false);
        }
    };

    const handleScheduleCall = async () => {
        if (!user) return;
        if (!scheduleTime) {
            toast.error("Please select a start time");
            return;
        }

        setCreating(true);
        try {
            await CallService.createCallLink(
                user.$id, 
                'video', 
                undefined, 
                scheduleTitle || undefined, 
                new Date(scheduleTime).toISOString(),
                duration
            );
            toast.success("Call scheduled successfully!");
            router.push(`/calls`);
            onClose();
        } catch (e: any) {
            console.error('[CallActionModal] Failed to schedule call:', e);
            const errorMessage = e.message || "Failed to schedule call";
            toast.error(errorMessage);
        } finally {
            setCreating(false);
        }
    };

    const handleJoinWithId = () => {
        if (!joinId.trim()) {
            toast.error("Please enter a meeting ID");
            return;
        }
        router.push(`/connect/call/${joinId.trim()}`);
        onClose();
    };

    const handleCallIndividual = async (convId: string, type: 'audio' | 'video' = 'video') => {
        if (!user) return;
        setCreating(true);
        try {
            const conversation = conversations.find((c: any) => c.$id === convId);
            const participantIds: string[] = Array.isArray(conversation?.participants)
                ? Array.from(
                      new Set(
                          (conversation.participants as unknown[]).map((id) => String(id)),
                      ),
                  )
                : [];
            const link = await CallService.createScopedCallLink({
                userId: user.$id,
                type,
                title: conversation?.name || (type === 'audio' ? 'Audio Call' : 'Video Call'),
                durationMinutes: duration,
                scope: conversation?.type === 'group' ? 'group' : 'direct',
                sourceApp: 'connect',
                conversationId: convId,
                participantIds,
                isPrivate: true,
                allowGuests: false,
            });
            await ActivityService.setLiveCallActivity(user.$id, link.$id, 'connect').catch(() => undefined);
            setLiveCallState({
                callId: link.$id,
                title: conversation?.name || (type === 'audio' ? 'Audio Call' : 'Video Call'),
                participantIds: Array.from(new Set([user.$id, ...participantIds])),
                type,
            });
        } catch (error: any) {
            toast.error(error?.message || 'Failed to start call');
        } finally {
            setCreating(false);
        }
    };

    const liveCallUrl = liveCallState ? `/connect/call/${liveCallState.callId}` : '';

    const inputStyles = {
        '& .MuiOutlinedInput-root': {
            bgcolor: 'rgba(255,255,255,0.02)',
            borderRadius: '12px',
            border: `1px solid ${COLORS.rim}`,
            transition: 'all 0.2s ease',
            '&:hover': {
                bgcolor: 'rgba(255,255,255,0.04)',
                borderColor: 'rgba(255,255,255,0.1)',
            },
            '&.Mui-focused': {
                bgcolor: 'rgba(255,255,255,0.05)',
                borderColor: COLORS.secondary,
            }
        },
        '& .MuiInputLabel-root': {
            color: 'rgba(255,255,255,0.4)',
            '&.Mui-focused': { color: COLORS.secondary }
        },
        '& .MuiOutlinedInput-notchedOutline': { border: 'none' }
    };

    return (
        <Drawer 
            open={open} 
            onClose={onClose}
            anchor={isMobile ? 'bottom' : 'right'}
            PaperProps={{
                sx: {
                    bgcolor: COLORS.surface,
                    backgroundImage: 'none',
                    borderRadius: isMobile ? '24px 24px 0 0' : '28px 0 0 28px',
                    border: `1px solid ${COLORS.rim}`,
                    maxWidth: '480px',
                    width: '100%',
                    height: isMobile ? '60dvh' : '100%',
                    maxHeight: isMobile ? '60dvh' : '100vh',
                    boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.5)',
                    overflow: 'hidden'
                }
            }}
        >
            <DialogTitle sx={{ 
                p: 3, 
                pb: 2, 
                display: 'flex', 
                alignItems: 'center', 
                justifyContent: 'space-between',
                borderBottom: `1px solid ${COLORS.rim}`
            }}>
                <Stack direction="row" spacing={1.5} alignItems="center">
                    {(showScheduleForm || showJoinWithId) && (
                        <IconButton 
                            onClick={() => { setShowScheduleForm(false); setShowJoinWithId(false); }} 
                            size="small"
                            sx={{ color: 'rgba(255,255,255,0.5)', ml: -1 }}
                        >
                            <ArrowLeft size={20} />
                        </IconButton>
                    )}
                <Typography variant="h6" sx={{
                        fontWeight: 900, 
                        fontFamily: 'var(--font-clash)',
                        letterSpacing: '-0.02em',
                        color: 'white'
                    }}>
                        {showScheduleForm ? 'Schedule Session' : showJoinWithId ? 'Join with ID' : (isScopedLaunch || isNoteLaunch || isTaskLaunch) ? 'Start Call Here' : 'New Session'}
                    </Typography>
                </Stack>
                <IconButton onClick={onClose} sx={{ color: 'rgba(255,255,255,0.3)', '&:hover': { color: 'white', bgcolor: COLORS.hover } }}>
                    <X size={20} />
                </IconButton>
            </DialogTitle>

            <DialogContent sx={{ p: 3, display: 'flex', flexDirection: 'column', gap: 3 }}>
                {!showJoinWithId && (
                    <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2.5 }}>
                        <TextField
                            select
                            fullWidth
                            label="Call Duration"
                            value={duration}
                            onChange={(e) => setDuration(Number(e.target.value))}
                            sx={inputStyles}
                            InputProps={{
                                startAdornment: <Timer size={18} style={{ marginRight: '12px', color: COLORS.secondary }} />,
                            }}
                        >
                            <MenuItem value={15}>15 Minutes</MenuItem>
                            <MenuItem value={30}>30 Minutes</MenuItem>
                            <MenuItem value={60}>1 Hour</MenuItem>
                            <MenuItem value={120}>2 Hours (Free Max)</MenuItem>
                        </TextField>

                        {!showScheduleForm && (
                            <TextField
                                fullWidth
                                label="Meeting Title (Optional)"
                                placeholder={launchContext?.conversationName ? `e.g. ${launchContext.conversationName}` : "e.g. Quick Sync"}
                                value={instantTitle}
                                onChange={(e) => setInstantTitle(e.target.value)}
                                sx={inputStyles}
                                InputProps={{
                                    startAdornment: <Type size={18} style={{ marginRight: '12px', color: COLORS.primary }} />,
                                }}
                            />
                        )}
                    </Box>
                )}

                {liveCallState ? (
                    <Stack spacing={2}>
                        <Paper sx={{ p: 2, borderRadius: '16px', bgcolor: 'rgba(255,255,255,0.03)', border: `1px solid ${COLORS.rim}` }}>
                            <Typography sx={{ color: 'white', fontWeight: 900, fontFamily: 'var(--font-clash)' }}>
                                {liveCallState.title}
                            </Typography>
                            <Typography sx={{ color: 'rgba(255,255,255,0.6)', fontSize: '0.82rem', mt: 0.5 }}>
                                Live now in this drawer
                            </Typography>
                            <Stack direction="row" spacing={1} sx={{ mt: 1.5, flexWrap: 'wrap' }}>
                                {liveCallState.participantIds.slice(0, 6).map((id, idx) => (
                                    <Avatar key={id} sx={{ width: 32, height: 32, bgcolor: idx === 0 ? COLORS.primary : '#2A2724', fontSize: '0.72rem', fontWeight: 800 }}>
                                        {idx === 0 ? 'You' : (id.slice(0, 2).toUpperCase())}
                                    </Avatar>
                                ))}
                            </Stack>
                            <Stack direction="row" spacing={1} sx={{ mt: 2 }}>
                                <IconButton sx={{ bgcolor: 'rgba(255,255,255,0.05)', color: 'white' }}>
                                    <Mic size={16} />
                                </IconButton>
                                <IconButton sx={{ bgcolor: 'rgba(255,255,255,0.05)', color: 'white' }}>
                                    <VideoIcon size={16} />
                                </IconButton>
                                <Button
                                    variant="outlined"
                                    startIcon={<Copy size={14} />}
                                    onClick={async () => {
                                        await navigator.clipboard.writeText(typeof window !== 'undefined' ? `${window.location.origin}${liveCallUrl}` : liveCallUrl);
                                        toast.success('Invite link copied');
                                    }}
                                    sx={{ ml: 'auto', borderColor: COLORS.rim, color: 'white', textTransform: 'none', fontWeight: 800 }}
                                >
                                    Copy Invite
                                </Button>
                            </Stack>
                        </Paper>
                        <Button
                            fullWidth
                            variant="contained"
                            startIcon={<ExternalLink size={16} />}
                            onClick={() => router.push(`${liveCallUrl}?caller=true&view=dock`)}
                            sx={{ bgcolor: COLORS.primary, textTransform: 'none', fontWeight: 900, borderRadius: '14px', py: 1.4 }}
                        >
                            Expand to Full Call UI
                        </Button>
                    </Stack>
                ) : !showScheduleForm && !showJoinWithId ? (
                    <>
                        <Stack direction="row" spacing={2}>
                            <Button
                                fullWidth
                                variant="contained"
                                onClick={handleStartPublicCall}
                                disabled={creating}
                                startIcon={creating ? <CircularProgress size={18} color="inherit" /> : <Plus size={18} />}
                                sx={{ 
                                    bgcolor: COLORS.primary, 
                                    py: 2, 
                                    borderRadius: '16px', 
                                    fontWeight: 900,
                                    textTransform: 'none',
                                    fontFamily: 'var(--font-satoshi)',
                                    boxShadow: `0 8px 20px -6px ${alpha(COLORS.primary, 0.4)}`,
                                    '&:hover': { 
                                        bgcolor: alpha(COLORS.primary, 0.9),
                                        boxShadow: `0 12px 24px -6px ${alpha(COLORS.primary, 0.5)}`,
                                    }
                                }}
                            >
                                {isScopedLaunch ? 'Start in This Chat' : isNoteLaunch ? 'Start Note Huddle' : isTaskLaunch ? 'Start Task Huddle' : 'Start Now'}
                            </Button>
                            {!isScopedLaunch && !isNoteLaunch && !isTaskLaunch && (
                                <Button
                                    fullWidth
                                    variant="outlined"
                                    onClick={() => setShowScheduleForm(true)}
                                    startIcon={<Calendar size={18} />}
                                    sx={{
                                        borderColor: COLORS.rim,
                                        color: 'white',
                                        py: 2,
                                        borderRadius: '16px',
                                        fontWeight: 900,
                                        textTransform: 'none',
                                        fontFamily: 'var(--font-satoshi)',
                                        bgcolor: 'rgba(255,255,255,0.01)',
                                        '&:hover': {
                                            borderColor: 'rgba(255,255,255,0.1)',
                                            bgcolor: COLORS.hover
                                        }
                                    }}
                                >
                                    Schedule
                                </Button>
                            )}
                        </Stack>

                        {!isScopedLaunch && !isNoteLaunch && !isTaskLaunch && (
                            <Button
                                fullWidth
                                variant="text"
                                onClick={() => setShowJoinWithId(true)}
                                startIcon={<Hash size={18} />}
                                sx={{
                                    color: 'rgba(255,255,255,0.4)',
                                    py: 1,
                                    borderRadius: '12px',
                                    fontWeight: 800,
                                    textTransform: 'none',
                                    '&:hover': { color: 'white', bgcolor: 'rgba(255,255,255,0.05)' }
                                }}
                            >
                                Join with Meeting ID
                            </Button>
                        )}

                        {!isScopedLaunch && !isNoteLaunch && !isTaskLaunch && <Divider sx={{ opacity: 0.05, my: 1 }} />}

                        {!isScopedLaunch && !isNoteLaunch && !isTaskLaunch && <Box sx={{ mt: 1 }}>
                            <Typography variant="caption" sx={{ 
                                fontWeight: 900, 
                                color: 'rgba(255,255,255,0.3)', 
                                letterSpacing: '0.1em', 
                                mb: 2, 
                                display: 'block',
                                fontFamily: 'var(--font-satoshi)'
                            }}>
                                RECENT INDIVIDUALS
                            </Typography>
                            
                            {loading ? (
                                <Box sx={{ display: 'flex', justifyContent: 'center', py: 4 }}><CircularProgress size={20} sx={{ color: COLORS.secondary }} /></Box>
                            ) : (
                                <List sx={{ p: 0, display: 'flex', flexDirection: 'column', gap: 1 }}>
                                    {conversations.map((conv) => (
                                        <ListItem key={conv.$id} disablePadding>
                                            <ListItemButton 
                                                onClick={() => handleCallIndividual(conv.$id)}
                                                sx={{ 
                                                    borderRadius: '18px', 
                                                    bgcolor: 'rgba(255,255,255,0.02)',
                                                    border: `1px solid ${COLORS.rim}`,
                                                    p: 1.5,
                                                    transition: 'all 0.2s ease',
                                                    '&:hover': { 
                                                        bgcolor: COLORS.hover,
                                                        borderColor: 'rgba(255,255,255,0.1)',
                                                        transform: 'translateY(-2px)'
                                                    }
                                                }}
                                            >
                                                <ListItemAvatar>
                                                    <Avatar sx={{ 
                                                        bgcolor: COLORS.background, 
                                                        border: `1px solid ${COLORS.rim}`,
                                                        width: 44,
                                                        height: 44
                                                    }}>
                                                        {conv.type === 'group' ? <Users size={22} /> : <User size={22} />}
                                                    </Avatar>
                                                </ListItemAvatar>
                                                <ListItemText 
                                                    primary={conv.name} 
                                                    primaryTypographyProps={{ 
                                                        fontWeight: 800, 
                                                        fontSize: '0.95rem',
                                                        fontFamily: 'var(--font-satoshi)'
                                                    }}
                                                />
                                                <Stack direction="row" spacing={1}>
                                                    <IconButton size="small" sx={{ 
                                                        color: COLORS.primary, 
                                                        bgcolor: alpha(COLORS.primary, 0.08),
                                                        '&:hover': { bgcolor: alpha(COLORS.primary, 0.15) }
                                                    }}>
                                                        <Phone size={16} />
                                                    </IconButton>
                                                    <IconButton size="small" sx={{ 
                                                        color: COLORS.secondary, 
                                                        bgcolor: alpha(COLORS.secondary, 0.08),
                                                        '&:hover': { bgcolor: alpha(COLORS.secondary, 0.15) }
                                                    }}>
                                                        <Video size={16} />
                                                    </IconButton>
                                                </Stack>
                                            </ListItemButton>
                                        </ListItem>
                                    ))}
                                </List>
                            )}
                        </Box>}
                    </>
                ) : showJoinWithId ? (
                    <Stack spacing={3}>
                        <TextField
                            fullWidth
                            label="Meeting ID"
                            placeholder="Paste the ID here..."
                            value={joinId}
                            onChange={(e) => setJoinId(e.target.value)}
                            sx={inputStyles}
                            InputProps={{
                                startAdornment: <Hash size={18} style={{ marginRight: '12px', color: COLORS.primary }} />,
                            }}
                        />
                        <Button
                            fullWidth
                            variant="contained"
                            onClick={handleJoinWithId}
                            sx={{ 
                                py: 2, 
                                borderRadius: '16px', 
                                fontWeight: 900, 
                                textTransform: 'none', 
                                bgcolor: COLORS.primary,
                                color: 'white',
                                fontFamily: 'var(--font-satoshi)',
                                boxShadow: `0 8px 20px -6px ${alpha(COLORS.primary, 0.4)}`,
                                '&:hover': { 
                                    bgcolor: alpha(COLORS.primary, 0.9),
                                    boxShadow: `0 12px 24px -6px ${alpha(COLORS.primary, 0.5)}`,
                                }
                            }}
                        >
                            Join Session
                        </Button>
                    </Stack>
                ) : (
                    <Stack spacing={3}>
                        <TextField
                            fullWidth
                            label="Meeting Title"
                            placeholder="e.g. Weekly Sync"
                            value={scheduleTitle}
                            onChange={(e) => setScheduleTitle(e.target.value)}
                            sx={inputStyles}
                            InputProps={{
                                startAdornment: <Type size={18} style={{ marginRight: '12px', color: COLORS.primary }} />,
                            }}
                        />
                        <TextField
                            fullWidth
                            label="Start Time"
                            type="datetime-local"
                            value={scheduleTime}
                            onChange={(e) => setScheduleTime(e.target.value)}
                            sx={inputStyles}
                            InputLabelProps={{ shrink: true }}
                            InputProps={{
                                startAdornment: <Clock size={18} style={{ marginRight: '12px', color: COLORS.secondary }} />,
                            }}
                        />
                        <Button
                            fullWidth
                            variant="contained"
                            onClick={handleScheduleCall}
                            disabled={creating}
                            sx={{ 
                                py: 2, 
                                borderRadius: '16px', 
                                fontWeight: 900, 
                                textTransform: 'none', 
                                bgcolor: COLORS.secondary,
                                color: COLORS.background,
                                fontFamily: 'var(--font-satoshi)',
                                boxShadow: `0 8px 20px -6px ${alpha(COLORS.secondary, 0.4)}`,
                                '&:hover': { 
                                    bgcolor: alpha(COLORS.secondary, 0.9),
                                    boxShadow: `0 12px 24px -6px ${alpha(COLORS.secondary, 0.5)}`,
                                },
                                '&.Mui-disabled': {
                                    bgcolor: alpha(COLORS.secondary, 0.3),
                                    color: alpha(COLORS.background, 0.5)
                                }
                            }}
                        >
                            {creating ? <CircularProgress size={22} color="inherit" /> : 'Schedule Session'}
                        </Button>
                    </Stack>
                )}
            </DialogContent>
        </Drawer>
    );
};
