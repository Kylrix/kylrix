'use client';

import React, { useEffect, useState } from 'react';
import { CallService } from '@/lib/services/call';
import { UsersService } from '@/lib/services/users';
import { useAuth } from '@/lib/auth';
import { useRouter } from 'next/navigation';
import { 
    Box, 
    Typography, 
    List, 
    ListItem, 
    ListItemAvatar, 
    Avatar, 
    ListItemText,
    IconButton,
    Paper,
    Chip,
    Fab,
    Tooltip,
    Stack,
    Divider,
    Badge,
    Skeleton
} from '@mui/material';
import CallIcon from '@mui/icons-material/Call';
import VideocamIcon from '@mui/icons-material/Videocam';
import _CallMissedIcon from '@mui/icons-material/CallMissed';
import CallReceivedIcon from '@mui/icons-material/CallReceived';
import CallMadeIcon from '@mui/icons-material/CallMade';
import AddIcCallIcon from '@mui/icons-material/AddIcCall';
import DeleteIcon from '@mui/icons-material/Delete';
import StopIcon from '@mui/icons-material/Stop';
import RefreshIcon from '@mui/icons-material/Refresh';
import HistoryIcon from '@mui/icons-material/History';
import toast from 'react-hot-toast';
import { seedIdentityCache } from '@/lib/identity-cache';

export const CallHistory = ({ onNewCall }: { onNewCall?: () => void }) => {
    const { user } = useAuth();
    const [calls, setCalls] = useState<any[]>([]);
    const [activeCalls, setActiveCalls] = useState<any[]>([]);
    const [loading, setLoading] = useState(true);
    const router = useRouter();

    const loadCalls = React.useCallback(async () => {
        if (!user) return;
        setLoading(true);
        try {
            // Run cleanup of old logs
            await CallService.cleanupOldCallLogs();

            const [history, ongoing] = await Promise.all([
                CallService.getCallHistory(user.$id),
                CallService.getActiveCalls(user.$id)
            ]);
            
            const enrich = async (callList: any[]) => {
                return await Promise.all(callList.map(async (call: any) => {
                    const isCaller = call.callerId === user.$id;
                    const otherId = isCaller ? call.receiverId : call.callerId;
                    
                    try {
                        const profile = otherId ? await UsersService.getProfileById(otherId) : null;
                        if (profile) seedIdentityCache(profile);
                        return {
                            ...call,
                            otherUser: profile || { 
                                username: call.isLink ? (call.title || 'Public Link') : 'User', 
                                displayName: call.isLink ? (call.title || 'Public Link Session') : undefined,
                                $id: otherId 
                            },
                            direction: isCaller ? 'outgoing' : 'incoming'
                        };
                    } catch (_e: unknown) {
                        return { 
                            ...call, 
                            otherUser: { 
                                username: call.isLink ? (call.title || 'Public Link') : 'User', 
                                $id: otherId 
                            }, 
                            direction: isCaller ? 'outgoing' : 'incoming' 
                        };
                    }
                }));
            };
            
            const [enrichedHistory, enrichedActive] = await Promise.all([
                enrich(history),
                enrich(ongoing)
            ]);

            setCalls(enrichedHistory);
            setActiveCalls(enrichedActive);
        } catch (error: unknown) {
            console.error('Failed to load call history:', error);
            toast.error('Failed to load calls');
        } finally {
            setLoading(false);
        }
    }, [user]);

    useEffect(() => {
        if (user) {
            loadCalls();
        }
    }, [user, loadCalls]);

    const handleEndCall = async (callId: string) => {
        try {
            await CallService.endCall(callId);
            toast.success('Call ended');
            loadCalls();
        } catch (_e) {
            toast.error('Failed to end call');
        }
    };

    const handleDeleteCall = async (callId: string) => {
        if (!confirm('Are you sure you want to delete this call log?')) return;
        try {
            await CallService.deleteCallLog(callId);
            toast.success('Call log deleted');
            loadCalls();
        } catch (_e) {
            toast.error('Failed to delete call log');
        }
    };

    const startCall = (call: any) => {
        if (call.isLink) {
            window.location.assign(`/call/${call.$id}`);
            return;
        }
        if (!call.otherUser?.$id) {
            toast.error("User ID not available for this call");
            return;
        }
        window.location.assign(`/chat/${call.otherUser.$id}`);
    };

    if (loading) {
        return (
            <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
                {[1, 2, 3].map((i) => (
                    <Paper key={i} sx={{ p: 2, borderRadius: 3, bgcolor: 'rgba(255,255,255,0.02)', border: '1px solid rgba(255,255,255,0.05)' }} elevation={0}>
                        <Stack direction="row" spacing={2} alignItems="center">
                            <Skeleton variant="circular" width={44} height={44} sx={{ bgcolor: 'rgba(255,255,255,0.05)' }} />
                            <Box sx={{ flex: 1 }}>
                                <Skeleton width="40%" sx={{ bgcolor: 'rgba(255,255,255,0.05)' }} />
                                <Skeleton width="22%" sx={{ bgcolor: 'rgba(255,255,255,0.05)' }} />
                            </Box>
                        </Stack>
                    </Paper>
                ))}
            </Box>
        );
    }

    return (
        <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2, position: 'relative', minHeight: '50vh' }}>
            <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <Typography variant="subtitle2" color="text.secondary" fontWeight="bold">
                    {activeCalls.length > 0 ? `Ongoing Sessions (${activeCalls.length})` : 'No active sessions'}
                </Typography>
                <IconButton size="small" onClick={loadCalls} sx={{ opacity: 0.6 }}>
                    <RefreshIcon fontSize="small" />
                </IconButton>
            </Box>

            {activeCalls.length > 0 && (
                <List sx={{ mb: 2 }}>
                    {activeCalls.map((call) => (
                        <Paper 
                            key={call.$id} 
                            sx={{ 
                                mb: 1.5, 
                                borderRadius: 3, 
                                border: '1px solid #6366F1',
                                cursor: 'pointer',
                                transition: 'all 0.2s ease',
                                '&:hover': {
                                    bgcolor: 'rgba(99, 102, 241, 0.05)',
                                    transform: 'translateY(-2px)'
                                }
                            }} 
                            elevation={0} 
                            variant="outlined"
                            onClick={() => startCall(call)}
                        >
                            <ListItem
                                secondaryAction={
                                    <Stack direction="row" spacing={1}>
                                        <Tooltip title="End Call">
                                            <IconButton edge="end" onClick={(e) => { e.stopPropagation(); handleEndCall(call.$id); }} color="warning">
                                                <StopIcon />
                                            </IconButton>
                                        </Tooltip>
                                        <Tooltip title="Delete Permanently">
                                            <IconButton edge="end" onClick={(e) => { e.stopPropagation(); handleDeleteCall(call.$id); }} color="error">
                                                <DeleteIcon />
                                            </IconButton>
                                        </Tooltip>
                                    </Stack>
                                }
                            >
                                <ListItemAvatar>
                                    <Badge
                                        overlap="circular"
                                        anchorOrigin={{ vertical: 'bottom', horizontal: 'right' }}
                                        variant="dot"
                                        sx={{ '& .MuiBadge-badge': { bgcolor: '#10B981', boxShadow: '0 0 0 2px #161412' } }}
                                    >
                                        <Avatar sx={{ bgcolor: 'primary.main', color: 'white' }}>
                                            {call.type === 'video' ? <VideocamIcon /> : <CallIcon />}
                                        </Avatar>
                                    </Badge>
                                </ListItemAvatar>
                                <ListItemText
                                    primary={
                                        <Typography fontWeight="bold" sx={{ color: '#6366F1' }}>
                                            {call.otherUser.displayName || call.otherUser.username}
                                        </Typography>
                                    }
                                    secondary={
                                        <Typography variant="caption" sx={{ color: 'text.secondary', display: 'block' }}>
                                            Started {new Date(call.startedAt).toLocaleTimeString()}
                                        </Typography>
                                    }
                                />
                            </ListItem>
                        </Paper>
                    ))}
                </List>
            )}

            <Divider sx={{ opacity: 0.1, mb: 1 }} />
            <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 1 }}>
                <Typography variant="subtitle2" color="text.secondary" fontWeight="bold">Recent History</Typography>
                <Tooltip title="Call logs are cleared every 7 days">
                    <Stack direction="row" spacing={0.5} alignItems="center" sx={{ opacity: 0.5, cursor: 'help' }}>
                        <HistoryIcon sx={{ fontSize: 14 }} />
                        <Typography variant="caption" fontWeight="bold">7D Retention</Typography>
                    </Stack>
                </Tooltip>
            </Box>

            {calls.filter(c => c.status !== 'ongoing').length === 0 ? (
                <Box sx={{ textAlign: 'center', py: 5, color: 'text.secondary' }}>
                    <CallIcon sx={{ fontSize: 60, mb: 2, opacity: 0.5 }} />
                    <Typography>No recent calls</Typography>
                </Box>
            ) : (
                <List>
                    {calls.filter(c => c.status !== 'ongoing').map((call) => (
                        <Paper 
                            key={call.$id} 
                            sx={{ 
                                mb: 1.5, 
                                borderRadius: 3,
                                cursor: 'pointer',
                                transition: 'all 0.2s ease',
                                '&:hover': {
                                    bgcolor: 'rgba(255, 255, 255, 0.02)',
                                    transform: 'translateY(-2px)'
                                }
                            }} 
                            elevation={0} 
                            variant="outlined"
                            onClick={() => startCall(call)}
                        >
                            <ListItem
                                secondaryAction={
                                    <Stack direction="row" spacing={1}>
                                        <IconButton edge="end" onClick={(e) => { e.stopPropagation(); handleDeleteCall(call.$id); }} size="small" sx={{ opacity: 0.3 }}>
                                            <DeleteIcon fontSize="small" />
                                        </IconButton>
                                    </Stack>
                                }
                            >
                                <ListItemAvatar>
                                    <Avatar sx={{ bgcolor: call.status === 'missed' ? 'error.light' : 'primary.light', color: call.status === 'missed' ? 'error.main' : 'primary.main' }}>
                                        {call.type === 'video' ? <VideocamIcon /> : <CallIcon />}
                                    </Avatar>
                                </ListItemAvatar>
                                <ListItemText
                                    primary={
                                        <Typography fontWeight="bold">
                                            {call.otherUser.displayName || call.otherUser.username}
                                        </Typography>
                                    }
                                    secondary={
                                        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mt: 0.5 }}>
                                            {call.direction === 'outgoing' ? <CallMadeIcon fontSize="small" /> : <CallReceivedIcon fontSize="small" />}
                                            <Typography variant="caption" color="text.secondary">
                                                {new Date(call.startedAt).toLocaleDateString()}
                                            </Typography>
                                            {call.status === 'missed' && (
                                                <Chip label="Missed" size="small" color="error" variant="outlined" sx={{ height: 20, fontSize: '0.65rem' }} />
                                            )}
                                        </Box>
                                    }
                                />
                            </ListItem>
                        </Paper>
                    ))}
                </List>
            )}
            
            <Fab 
                color="primary" 
                aria-label="add call" 
                sx={{ 
                    position: 'fixed', 
                    bottom: 80, 
                    right: 24,
                    bgcolor: '#6366F1',
                    '&:hover': { bgcolor: '#4F46E5' }
                }}
                onClick={() => onNewCall ? onNewCall() : router.push('/chats')}
            >
                <AddIcCallIcon />
            </Fab>
        </Box>
    );
};
