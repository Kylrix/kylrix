'use client';

import React, { useEffect, useRef, useState, useCallback } from 'react';
import { WebRTCManager } from '@/lib/webrtc/WebRTCManager';
import { useAuth } from '@/lib/auth';
import { CallService } from '@/lib/services/call';
import { client } from '@/lib/appwrite/client';
import { APPWRITE_CONFIG } from '@/lib/appwrite/config';
import { useRouter } from 'next/navigation';
import { 
    Box, 
    IconButton, 
    Typography, 
    Fab, 
    Avatar,
    Tooltip,
    Badge,
    CircularProgress,
    Button,
    Paper,
    alpha,
    Stack, Menu, MenuItem, ListItemIcon, ListItemText, Divider 
} from '@mui/material';
import {
    PhoneOff,
    Mic,
    MicOff,
    Video,
    VideoOff,
    Users,
    ShieldCheck,
    UserCheck,
    UserX,
    MessageSquare,
    Monitor,
    Circle,
    Square,
    ChevronUp,
    Clock,
    Copy,
    Check,
    Hash
} from 'lucide-react';
import toast from 'react-hot-toast';
import { InCallChat } from './InCallChat';

import { ChatService } from '@/lib/services/chat';

interface ChatMessage {
    id: string;
    senderId: string;
    senderName: string;
    content: string;
    timestamp: number;
    attachment?: any;
}

interface JoinRequest {
    senderId: string;
    senderName: string;
}

export const CallInterface = ({ 
    conversationId, 
    isCaller, 
    callType: _callType = 'video',
    targetId: initialTargetId,
    callCode,
    initialMediaSettings = { video: true, audio: true, companion: false },
    autoInitiate = false,
    callTitle,
    expiresAt
}: { 
    conversationId?: string, 
    isCaller: boolean, 
    callType?: 'audio' | 'video',
    targetId?: string,
    callCode?: string,
    initialMediaSettings?: { video: boolean, audio: boolean, companion: boolean },
    autoInitiate?: boolean,
    callTitle?: string,
    expiresAt?: string
}) => {
    const { user } = useAuth();
    const [status, setStatus] = useState('Initializing...');
    const [isMuted, setIsMuted] = useState(!initialMediaSettings.audio || initialMediaSettings.companion);
    const [isVideoOff, setIsVideoOff] = useState(!initialMediaSettings.video || initialMediaSettings.companion);
    const [isCompanion, _setIsCompanion] = useState(initialMediaSettings.companion);
    const [targetId, setTargetId] = useState<string | undefined>(initialTargetId);
    const [timeRemaining, setTimeRemaining] = useState<string>('');
    const [copied, setCopied] = useState(false);
    
    const [joinRequests, setJoinRequests] = useState<JoinRequest[]>([]);
    const [participants, setParticipants] = useState<any[]>([]);
    const [isChatOpen, setIsChatOpen] = useState(false);
    const [chatMessages, setChatMessages] = useState<ChatMessage[]>([]);
    const [unreadChatCount, setUnreadChatCount] = useState(0);
    const [isScreenSharing, setIsScreenSharing] = useState(false);
    const [isRecording, setIsRecording] = useState(false);
    const [devices, setDevices] = useState<MediaDeviceInfo[]>([]);
    const [deviceMenuAnchor, setDeviceMenuAnchor] = useState<null | HTMLElement>(null);
    
    const localVideoRef = useRef<HTMLVideoElement>(null);
    const remoteVideoRef = useRef<HTMLVideoElement>(null);
    const rtcManager = useRef<WebRTCManager | null>(null);
    const hasInitiatedCall = useRef(false);
    const router = useRouter();
    const callStartTime = useRef<number | null>(null);
    
    useEffect(() => {
        if (callStartTime.current === null) {
            callStartTime.current = Date.now();
        }
    }, []);

    const handleDeviceMenuOpen = async (event: React.MouseEvent<HTMLElement>) => {
        const devs = await rtcManager.current?.getDevices();
        if (devs) setDevices(devs);
        setDeviceMenuAnchor(event.currentTarget);
    };

    const handleSwitchDevice = async (kind: 'audioinput' | 'videoinput', deviceId: string) => {
        const stream = await rtcManager.current?.switchDevice(kind, deviceId);
        if (stream && localVideoRef.current) {
            localVideoRef.current.srcObject = stream;
        }
        setDeviceMenuAnchor(null);
    };

    const toggleScreenShare = async () => {
        try {
            const stream = await rtcManager.current?.toggleScreenShare(!isScreenSharing);
            setIsScreenSharing(!isScreenSharing);
            if (localVideoRef.current) {
                localVideoRef.current.srcObject = stream || (rtcManager.current as any).localStream;
            }
        } catch (_e) {
            console.error('Screen share failed:', _e);
            setIsScreenSharing(false);
        }
    };

    const toggleRecording = () => {
        if (isRecording) {
            rtcManager.current?.stopRecording();
            toast.success("Recording saved");
        } else {
            rtcManager.current?.startRecording();
            toast.success("Recording started");
        }
        setIsRecording(!isRecording);
    };

    const broadcastMessage = async (content: string, attachment?: any) => {
        if (!user || !targetId) return;
        
        const msg: ChatMessage = {
            id: Math.random().toString(36).substring(7),
            senderId: user.$id,
            senderName: user.name || 'Guest',
            content,
            timestamp: Date.now(),
            attachment
        };

        // Add to local state immediately
        setChatMessages(prev => [...prev, msg]);

        // Broadcast to target
        try {
            await CallService.sendSignal(user.$id, targetId, {
                type: 'chat_message',
                message: msg
            });
        } catch (_e) {
            console.error('Failed to broadcast message:', _e);
        }
    };

    useEffect(() => {
        const initDirectCall = async () => {
            if (!user || !conversationId || targetId) return;
            try {
                const conv = await ChatService.getConversationById(conversationId, user.$id);
                const other = conv.participants.find((p: string) => p !== user.$id);
                if (other) {
                    setTargetId(other);
                    if (isCaller) {
                        rtcManager.current?.createOffer(user.$id, other);
                    }
                }
            } catch (_e) {
                console.error('Failed to init direct call:', _e);
            }
        };

        if (conversationId && !targetId) {
            // Use a separate effect or a timeout to avoid synchronous state updates during render
            const timer = setTimeout(() => {
                initDirectCall();
            }, 0);
            return () => clearTimeout(timer);
        }
    }, [conversationId, targetId, user, isCaller]);

    useEffect(() => {
        if (!user) return;

        // 1. Setup WebRTC Manager
        rtcManager.current = new WebRTCManager({
            onTrack: (stream: MediaStream) => {
                if (remoteVideoRef.current) {
                    remoteVideoRef.current.srcObject = stream;
                }
            },
            onStateChange: (state: string) => setStatus(state),
            onSignal: async (signal: any) => {
                if (['join_request', 'let_in', 'presence', 'chat_message'].includes(signal.type)) {
                    if (signal.target) {
                        try {
                            // Include callId in signal for better tracking
                            await CallService.sendSignal(user.$id, signal.target, { ...signal, callId: callCode || conversationId });
                        } catch (_e) {
                            console.error('Failed to send signal');
                        }
                    }
                    return;
                }

                // Media negotiation is now handled by Cloudflare session APIs.
                if (['offer', 'answer', 'candidate'].includes(signal.type)) return;
            }
        });

        // 2. Initialize Media
        const initVideo = !isCompanion && initialMediaSettings.video;
        const initAudio = !isCompanion && initialMediaSettings.audio;
        
        rtcManager.current.initializeLocalStream(initVideo, initAudio).then((stream) => {
            if (localVideoRef.current && initVideo) {
                localVideoRef.current.srcObject = stream;
            }
            
            // 3. If this side should initiate, do it once the media stream is ready.
            if ((isCaller || autoInitiate) && targetId && !hasInitiatedCall.current) {
                hasInitiatedCall.current = true;
                rtcManager.current?.createOffer(user.$id, targetId);
            } else if ((isCaller || autoInitiate) && !targetId) {
                  setStatus('Waiting for participants...');
            }
        }).catch(err => {
             console.error("Failed to init media stream:", err);
             setStatus('Media Access Error');
             toast.error("Could not access camera/microphone");
        });

        // 4. Subscribe to signals via APP_ACTIVITY (WebSocket Realtime)
        const unsubscribe = client.subscribe(
            `databases.${APPWRITE_CONFIG.DATABASES.CHAT}.tables.${APPWRITE_CONFIG.TABLES.CHAT.APP_ACTIVITY}.rows`,
            (response: any) => {
                if (response.events.some((e: string) => e.includes('.update') || e.includes('.create'))) {
                    const activity = response.payload;
                    if (!activity.customStatus) return;
                    
                    try {
                        const signal = JSON.parse(activity.customStatus);
                        if (signal.target !== user.$id) return;
                        if (Date.now() - signal.ts > 10000) return;

                        if (signal.type === 'join_request') {
                            if (signal.callId === (callCode || conversationId) || !signal.callId) {
                                setJoinRequests(prev => {
                                    if (prev.some(r => r.senderId === signal.sender)) return prev;
                                    return [...prev, { 
                                        senderId: signal.sender, 
                                        senderName: signal.senderName || 'Guest' 
                                    }];
                                });
                                toast(`Join Request from ${signal.senderName || 'Guest'}`, { icon: '👋' });
                            }
                        } else if (signal.type === 'let_in') {
                            console.log('[CallInterface] Admitted by host, creating offer...');
                            setStatus('Joining...');
                            setTargetId(signal.sender);
                            // Small delay to ensure host is ready
                            if (!hasInitiatedCall.current) {
                                hasInitiatedCall.current = true;
                                setTimeout(() => {
                                    rtcManager.current?.createOffer(user.$id, signal.sender);
                                }, 500);
                            }
                        } else if (signal.type === 'chat_message') {
                            setChatMessages(prev => [...prev, signal.message]);
                            // We use a ref or a separate state for unread count to avoid re-running this effect
                            setUnreadChatCount(c => c + 1);
                            toast(`${signal.message.senderName}: ${signal.message.content.substring(0, 30)}...`, { 
                                icon: '💬',
                                style: { borderRadius: '12px', background: '#161412', color: '#fff', border: '1px solid rgba(255,255,255,0.1)' }
                            });
                        } else {
                            rtcManager.current?.handleSignal(signal);
                        }
                    } catch (_e) {}
                }
            }
        );

        return () => {
            unsubscribe();
            if (rtcManager.current) {
                rtcManager.current.cleanup();
            }
        };
    }, [user, isCaller, autoInitiate, callCode, conversationId, initialMediaSettings.audio, initialMediaSettings.video, isCompanion, targetId]);

    const handleAcceptRequest = async (request: JoinRequest) => {
        if (!user) return;
        setJoinRequests(prev => prev.filter(r => r.senderId !== request.senderId));
        try {
            await CallService.sendSignal(user.$id, request.senderId, { type: 'let_in', callId: callCode || conversationId });
            setStatus('Connecting to guest...');
        } catch (_e) {
            toast.error("Failed to admit guest");
        }
    };

    const handleRejectRequest = (request: JoinRequest) => {
        setJoinRequests(prev => prev.filter(r => r.senderId !== request.senderId));
    };

     
    const endCall = useCallback(() => {
        if (rtcManager.current) {
            rtcManager.current.cleanup();
        }
        router.back();
    }, [router]);

    // Presence & Participant Tracking
    useEffect(() => {
        if (!user || !callCode) return;

        const updatePresence = async () => {
            try {
                const signal = {
                    type: 'presence',
                    sender: user.$id,
                    senderName: user.name || 'User',
                    callId: callCode || conversationId,
                    ts: Date.now()
                };
                // We broadcast this to the host or everyone if we are the host
                // For now, we update our own activity which others can see
                await CallService.sendSignal(user.$id, isCaller ? 'broadcast' : (targetId || 'host'), signal);
            } catch (_e) {}
        };

        const fetchParticipants = async () => {
            const active = await CallService.getActiveParticipants(callCode || conversationId || '');
            setParticipants(active);
        };

        updatePresence();
        fetchParticipants();
        const interval = setInterval(() => {
            updatePresence();
            fetchParticipants();
        }, 10000);

        return () => clearInterval(interval);
    }, [user, callCode, conversationId, isCaller, targetId]);

    // Timer for call expiration
    useEffect(() => {
        if (!expiresAt) return;

        const interval = setInterval(() => {
            const now = new Date();
            const end = new Date(expiresAt);
            const diff = end.getTime() - now.getTime();

            if (diff <= 0) {
                setTimeRemaining('Ended');
                clearInterval(interval);
                toast.error("Call duration exceeded. Ending session...");
                setTimeout(endCall, 3000);
                return;
            }

            const hours = Math.floor(diff / 3600000);
            const mins = Math.floor((diff % 3600000) / 60000);
            const secs = Math.floor((diff % 60000) / 1000);
            
            if (hours > 0) {
                setTimeRemaining(`${hours}h ${mins}m`);
            } else {
                setTimeRemaining(`${mins}m ${secs}s`);
            }

            // Warning at 5 minutes
            if (diff <= 300000 && diff > 299000) {
                toast("5 minutes remaining in this session", { icon: '⏳' });
            }
        }, 1000);

        return () => clearInterval(interval);
    }, [expiresAt, endCall]);

    const handleCopyLink = () => {
        const url = `${window.location.origin}/call/${callCode || conversationId}`;
        navigator.clipboard.writeText(url);
        setCopied(true);
        toast.success("Link copied to clipboard");
        setTimeout(() => setCopied(false), 2000);
    };

    const handleCopyId = () => {
        navigator.clipboard.writeText(callCode || conversationId || '');
        toast.success("Meeting ID copied");
    };

    const toggleMute = () => {
        if (localVideoRef.current?.srcObject) {
            const stream = localVideoRef.current.srcObject as MediaStream;
            stream.getAudioTracks().forEach(track => track.enabled = !track.enabled);
            setIsMuted(!isMuted);
        }
    };

    const toggleVideo = () => {
        if (localVideoRef.current?.srcObject) {
            const stream = localVideoRef.current.srcObject as MediaStream;
            stream.getVideoTracks().forEach(track => track.enabled = !track.enabled);
            setIsVideoOff(!isVideoOff);
        }
    };

    return (
        <Box sx={{ 
            position: 'fixed', 
            top: 0, left: 0, right: 0, bottom: 0, 
            bgcolor: '#0A0908', 
            zIndex: 1300,
            display: 'flex',
            flexDirection: 'column',
            overflow: 'hidden'
        }}>
            {/* Main Viewport */}
            <Box sx={{ flex: 1, position: 'relative', display: 'flex', justifyContent: 'center', alignItems: 'center', p: 2 }}>
                <Paper 
                    elevation={24}
                    sx={{ 
                        width: '100%', height: '100%', maxWidth: '1200px', maxHeight: '800px',
                        bgcolor: '#161412', borderRadius: '32px', overflow: 'hidden', position: 'relative',
                        border: '1px solid rgba(255,255,255,0.05)', display: 'flex', alignItems: 'center', justifyContent: 'center',
                        boxShadow: '0 50px 100px -20px rgba(0,0,0,0.7)'
                    }}
                >
                    <Box 
                        component="video" ref={remoteVideoRef} autoPlay playsInline 
                        sx={{ 
                            width: '100%', height: '100%', objectFit: 'cover', 
                            display: status === 'connected' && !isVideoOff ? 'block' : 'none',
                            transform: 'scaleX(-1)'
                        }} 
                    />
                    
                    {((status as any) !== 'connected' || (status as any) === 'failed') && (
                        <Box sx={{ textAlign: 'center', color: 'white', zIndex: 1, px: 3 }}>
                            <Avatar sx={{ width: 120, height: 120, mb: 3, mx: 'auto', bgcolor: alpha('#6366F1', 0.1), border: '2px solid #6366F1' }}>
                                <Users size={64} color="#6366F1" />
                            </Avatar>
                            <Typography variant="h4" sx={{ fontWeight: 900, fontFamily: 'var(--font-clash)', letterSpacing: '-0.02em', mb: 1 }}>
                                {status === 'Initializing...' ? 'Kylrix Connect' : status === 'new' ? 'Connecting...' : status}
                            </Typography>
                            
                            {isCaller && !targetId && (
                                <Stack spacing={2} alignItems="center" sx={{ mt: 3 }}>
                                    <Typography variant="body1" sx={{ opacity: 0.5, fontWeight: 700 }}>
                                        Share this link or ID to start the session
                                    </Typography>
                                    
                                    <Stack direction="row" spacing={1} sx={{ width: '100%', maxWidth: 400 }}>
                                        <Paper sx={{ 
                                            flex: 1, p: 1.5, bgcolor: 'rgba(255,255,255,0.03)', 
                                            border: '1px solid rgba(255,255,255,0.05)', borderRadius: 3,
                                            display: 'flex', alignItems: 'center', gap: 1, overflow: 'hidden'
                                        }}>
                                            <Typography variant="caption" sx={{ 
                                                color: 'rgba(255,255,255,0.4)', fontWeight: 800, 
                                                whiteSpace: 'nowrap', textOverflow: 'ellipsis', overflow: 'hidden' 
                                            }}>
                                                {`${window.location.origin.replace(/^https?:\/\//, '')}/call/${callCode || conversationId}`}
                                            </Typography>
                                            <IconButton size="small" onClick={handleCopyLink} sx={{ color: COLORS.primary }}>
                                                {copied ? <Check size={16} /> : <Copy size={16} />}
                                            </IconButton>
                                        </Paper>

                                        <Paper sx={{ 
                                            p: 1.5, bgcolor: 'rgba(255,255,255,0.03)', 
                                            border: '1px solid rgba(255,255,255,0.05)', borderRadius: 3,
                                            display: 'flex', alignItems: 'center', gap: 1
                                        }}>
                                            <Hash size={14} color="rgba(255,255,255,0.3)" />
                                            <Typography variant="caption" sx={{ color: 'white', fontWeight: 900, fontFamily: 'var(--font-jetbrains)' }}>
                                                {(callCode || conversationId || '').slice(0, 8)}
                                            </Typography>
                                            <IconButton size="small" onClick={handleCopyId} sx={{ color: COLORS.secondary }}>
                                                <Copy size={16} />
                                            </IconButton>
                                        </Paper>
                                    </Stack>
                                </Stack>
                            )}

                            {(!isCaller || targetId) && status === 'Initializing...' && (
                                <CircularProgress size={24} sx={{ mt: 4, color: '#6366F1' }} />
                            )}
                        </Box>
                    )}
                </Paper>
                
                <Paper 
                    elevation={12}
                    sx={{ 
                        position: 'absolute', bottom: 40, right: 40, width: { xs: 120, sm: 180 }, height: { xs: 160, sm: 240 }, 
                        bgcolor: '#161412', borderRadius: '24px', overflow: 'hidden', border: '2px solid rgba(255,255,255,0.1)',
                        boxShadow: '0 20px 40px rgba(0,0,0,0.5)', zIndex: 1301, transition: 'all 0.3s cubic-bezier(0.4, 0, 0.2, 1)'
                    }}
                >
                    <Box component="video" ref={localVideoRef} autoPlay playsInline muted sx={{ width: '100%', height: '100%', objectFit: 'cover', transform: 'scaleX(-1)' }} />
                    {isVideoOff && (
                        <Box sx={{ position: 'absolute', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', bgcolor: 'rgba(0,0,0,0.8)' }}>
                            <VideoOff size={32} color="rgba(255,255,255,0.2)" />
                        </Box>
                    )}
                </Paper>

                {joinRequests.length > 0 && (
                    <Box sx={{ position: 'absolute', top: 100, right: 40, width: 300, zIndex: 1305, display: 'flex', flexDirection: 'column', gap: 1 }}>
                        {joinRequests.map(req => (
                            <Paper key={req.senderId} sx={{ p: 2, bgcolor: '#161412', border: '1px solid #6366F1', borderRadius: 3 }}>
                                <Typography variant="subtitle2" sx={{ fontWeight: 800, color: 'white', mb: 1.5 }}>{req.senderName} wants to join</Typography>
                                <Box sx={{ display: 'flex', gap: 1 }}>
                                    <Button fullWidth size="small" variant="contained" onClick={() => handleAcceptRequest(req)} startIcon={<UserCheck size={14} />} sx={{ bgcolor: '#6366F1', fontWeight: 900 }}>Admit</Button>
                                    <Button size="small" variant="outlined" onClick={() => handleRejectRequest(req)} sx={{ borderColor: 'rgba(255,255,255,0.1)', color: 'white' }}><UserX size={14} /></Button>
                                </Box>
                            </Paper>
                        ))}
                    </Box>
                )}

                <Box sx={{ position: 'absolute', top: 40, left: 40, display: 'flex', flexDirection: 'column', gap: 1.5 }}>
                    {callTitle && (
                        <Paper sx={{ px: 2, py: 1, bgcolor: 'rgba(22,20,18,0.6)', backdropFilter: 'blur(10px)', borderRadius: 3, border: '1px solid rgba(255,255,255,0.05)' }}>
                            <Typography variant="subtitle2" sx={{ fontWeight: 900, color: 'white', fontFamily: 'var(--font-clash)' }}>{callTitle.toUpperCase()}</Typography>
                        </Paper>
                    )}
                    <Stack direction="row" spacing={1.5}>
                        <Paper sx={{ display: 'flex', alignItems: 'center', gap: 1.5, px: 2, py: 1, bgcolor: 'rgba(22,20,18,0.6)', backdropFilter: 'blur(10px)', borderRadius: 3, border: '1px solid rgba(255,255,255,0.05)' }}>
                            <Box sx={{ width: 8, height: 8, bgcolor: status === 'connected' ? '#10B981' : '#F59E0B', borderRadius: '50%', boxShadow: `0 0 10px ${status === 'connected' ? '#10B981' : '#F59E0B'}` }} />
                            <Typography variant="caption" sx={{ fontWeight: 800, letterSpacing: '0.05em', color: 'white' }}>{status.toUpperCase()}</Typography>
                        </Paper>
                        {timeRemaining && (
                            <Paper sx={{ display: 'flex', alignItems: 'center', gap: 1, px: 2, py: 1, bgcolor: 'rgba(239, 68, 68, 0.1)', backdropFilter: 'blur(10px)', borderRadius: 3, border: '1px solid rgba(239, 68, 68, 0.2)' }}>
                                <Clock size={12} color="#EF4444" />
                                <Typography variant="caption" sx={{ fontWeight: 900, color: '#EF4444', fontFamily: 'var(--font-jetbrains)' }}>{timeRemaining}</Typography>
                            </Paper>
                        )}
                    </Stack>
                    <Paper sx={{ display: 'flex', alignItems: 'center', gap: 1.5, px: 2, py: 1, bgcolor: 'rgba(22,20,18,0.6)', backdropFilter: 'blur(10px)', borderRadius: 3, border: '1px solid rgba(255,255,255,0.05)' }}>
                        <Users size={14} color="#6366F1" />
                        <Typography variant="caption" sx={{ fontWeight: 800, color: 'white', opacity: 0.8 }}>
                            {participants.length || 1} {participants.length === 1 ? 'PARTICIPANT' : 'PARTICIPANTS'}
                        </Typography>
                    </Paper>
                    <Paper sx={{ display: 'flex', alignItems: 'center', gap: 1.5, px: 2, py: 1, bgcolor: 'rgba(22,20,18,0.6)', backdropFilter: 'blur(10px)', borderRadius: 3, border: '1px solid rgba(255,255,255,0.05)' }}>
                        <ShieldCheck size={14} color="#6366F1" />
                        <Typography variant="caption" sx={{ fontWeight: 800, color: 'white', opacity: 0.8 }}>E2E ENCRYPTED P2P</Typography>
                    </Paper>
                </Box>
            </Box>

            {/* Bottom Controls */}
            <Box sx={{ height: 120, display: 'flex', justifyContent: 'center', alignItems: 'center', gap: { xs: 1, sm: 4 }, bgcolor: 'transparent', pb: 4, px: 2 }}>
                <Box sx={{ display: 'flex', gap: 1 }}>
                    <Tooltip title={isMuted ? "Unmute" : "Mute"}>
                        <IconButton onClick={toggleMute} sx={{ width: 56, height: 56, bgcolor: isMuted ? '#EF4444' : 'rgba(255,255,255,0.05)', color: 'white', border: '1px solid rgba(255,255,255,0.1)', '&:hover': { bgcolor: isMuted ? '#DC2626' : 'rgba(255,255,255,0.1)' } }}>
                            {isMuted ? <MicOff size={22} /> : <Mic size={22} />}
                        </IconButton>
                    </Tooltip>
                    <IconButton onClick={handleDeviceMenuOpen} size="small" sx={{ color: 'rgba(255,255,255,0.3)', mt: -2 }}>
                        <ChevronUp size={16} />
                    </IconButton>
                </Box>

                <Tooltip title={isScreenSharing ? "Stop Sharing" : "Share Screen"}>
                    <IconButton onClick={toggleScreenShare} sx={{ width: 56, height: 56, bgcolor: isScreenSharing ? '#6366F1' : 'rgba(255,255,255,0.05)', color: 'white', border: '1px solid rgba(255,255,255,0.1)' }}>
                        <Monitor size={22} />
                    </IconButton>
                </Tooltip>

                <Tooltip title="End Call">
                    <Fab onClick={endCall} sx={{ width: 72, height: 72, bgcolor: '#EF4444', color: 'white', '&:hover': { bgcolor: '#DC2626', transform: 'scale(1.05)' }, transition: 'all 0.2s' }}>
                        <PhoneOff size={32} />
                    </Fab>
                </Tooltip>

                <Tooltip title={isVideoOff ? "Start Video" : "Stop Video"}>
                    <IconButton onClick={toggleVideo} sx={{ width: 56, height: 56, bgcolor: isVideoOff ? '#EF4444' : 'rgba(255,255,255,0.05)', color: 'white', border: '1px solid rgba(255,255,255,0.1)', '&:hover': { bgcolor: isVideoOff ? '#DC2626' : 'rgba(255,255,255,0.1)' } }}>
                        {isVideoOff ? <VideoOff size={22} /> : <Video size={22} />}
                    </IconButton>
                </Tooltip>

                <Tooltip title={isRecording ? "Stop Recording" : "Record Call"}>
                    <IconButton onClick={toggleRecording} sx={{ width: 56, height: 56, bgcolor: 'rgba(255,255,255,0.05)', color: isRecording ? '#EF4444' : 'white', border: '1px solid rgba(255,255,255,0.1)' }}>
                        {isRecording ? <Square size={20} /> : <Circle size={20} fill={isRecording ? '#EF4444' : 'none'} />}
                    </IconButton>
                </Tooltip>

                <Tooltip title="Messages">
                    <Badge badgeContent={unreadChatCount} color="primary">
                        <IconButton 
                            onClick={() => {
                                setIsChatOpen(!isChatOpen);
                                setUnreadChatCount(0);
                            }} 
                            sx={{ 
                                width: 56, height: 56,
                                bgcolor: isChatOpen ? '#6366F1' : 'rgba(255,255,255,0.05)', 
                                color: 'white', 
                                border: '1px solid rgba(255,255,255,0.1)',
                                '&:hover': { bgcolor: isChatOpen ? '#4F46E5' : 'rgba(255,255,255,0.1)' } 
                            }}
                        >
                            <MessageSquare size={22} />
                        </IconButton>
                    </Badge>
                </Tooltip>
            </Box>

            <Menu
                anchorEl={deviceMenuAnchor}
                open={Boolean(deviceMenuAnchor)}
                onClose={() => setDeviceMenuAnchor(null)}
                PaperProps={{
                    sx: { bgcolor: '#161412', color: 'white', border: '1px solid rgba(255,255,255,0.1)', borderRadius: 3, mt: -10 }
                }}
            >
                <Typography variant="caption" sx={{ px: 2, py: 1, display: 'block', opacity: 0.5, fontWeight: 800 }}>AUDIO INPUT</Typography>
                {devices.filter(d => d.kind === 'audioinput').map(d => (
                    <MenuItem key={d.deviceId} onClick={() => handleSwitchDevice('audioinput', d.deviceId)} sx={{ fontSize: '0.8rem', py: 1 }}>
                        <ListItemIcon><Mic size={16} color="white" /></ListItemIcon>
                        <ListItemText primary={d.label || `Microphone ${d.deviceId.slice(0, 5)}`} />
                    </MenuItem>
                ))}
                <Divider sx={{ opacity: 0.1 }} />
                <Typography variant="caption" sx={{ px: 2, py: 1, display: 'block', opacity: 0.5, fontWeight: 800 }}>VIDEO INPUT</Typography>
                {devices.filter(d => d.kind === 'videoinput').map(d => (
                    <MenuItem key={d.deviceId} onClick={() => handleSwitchDevice('videoinput', d.deviceId)} sx={{ fontSize: '0.8rem', py: 1 }}>
                        <ListItemIcon><Video size={16} color="white" /></ListItemIcon>
                        <ListItemText primary={d.label || `Camera ${d.deviceId.slice(0, 5)}`} />
                    </MenuItem>
                ))}
            </Menu>

            <InCallChat 
                isOpen={isChatOpen} 
                onClose={() => setIsChatOpen(false)} 
                messages={chatMessages}
                onSendMessage={broadcastMessage}
            />
        </Box>
    );
};

const COLORS = {
    background: '#0A0908',
    surface: '#161412',
    hover: '#1C1A18',
    primary: '#6366F1',
    secondary: '#F59E0B',
    rim: 'rgba(255, 255, 255, 0.05)'
};
