'use client';

import React, { useEffect, useRef, useState, useCallback } from 'react';
import { WebRTCManager } from '@/lib/webrtc/WebRTCManager';
import { useAuth } from '@/lib/auth';
import { CallService } from '@/lib/services/call';
import { ActivityService } from '@/lib/services/activity';
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
    Hash,
    Minimize2,
    Maximize2,
    X,
    ShieldAlert
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
    expiresAt,
    initialPresentation = 'fullscreen'
}: { 
    conversationId?: string, 
    isCaller: boolean, 
    callType?: 'audio' | 'video',
    targetId?: string,
    callCode?: string,
    initialMediaSettings?: { video: boolean, audio: boolean, companion: boolean },
    autoInitiate?: boolean,
    callTitle?: string,
    expiresAt?: string,
    initialPresentation?: 'fullscreen' | 'dock'
}) => {
    const { user } = useAuth();
    const [status, setStatus] = useState('Initializing...');
    const [isMuted, setIsMuted] = useState(!initialMediaSettings.audio || initialMediaSettings.companion);
    const [isVideoOff, setIsVideoOff] = useState(!initialMediaSettings.video || initialMediaSettings.companion);
    const [isCompanion, _setIsCompanion] = useState(initialMediaSettings.companion);
    const [targetId, setTargetId] = useState<string | undefined>(initialTargetId);
    const [isFullscreen, setIsFullscreen] = useState(initialPresentation !== 'dock');
    const [timeRemaining, setTimeRemaining] = useState<string>('');
    const [copied, setCopied] = useState(false);
    
    const [joinRequests, setJoinRequests] = useState<JoinRequest[]>([]);
    const [participants, setParticipants] = useState<any[]>([]);
    const [isChatOpen, setIsChatOpen] = useState(false);
    const [isParticipantsOpen, setIsParticipantsOpen] = useState(false);
    const [chatMessages, setChatMessages] = useState<ChatMessage[]>([]);
    const [unreadChatCount, setUnreadChatCount] = useState(0);
    const [isScreenSharing, setIsScreenSharing] = useState(false);
    const [isRecording, setIsRecording] = useState(false);
    const [devices, setDevices] = useState<MediaDeviceInfo[]>([]);
    const [deviceMenuAnchor, setDeviceMenuAnchor] = useState<null | HTMLElement>(null);
    const [remoteTrackLive, setRemoteTrackLive] = useState(false);
    const [micLevel, setMicLevel] = useState(0);
    const [chatNoteId, setChatNoteId] = useState<string | null>(null);
    const [userNames, setUserNames] = useState<Record<string, string>>({});

    // PIP state
    const [isPip, setIsPip] = useState<boolean>(() => {
        if (typeof window !== 'undefined') {
            const saved = localStorage.getItem('kylrix_active_pip');
            if (saved) {
                try {
                    const parsed = JSON.parse(saved);
                    return parsed.isPip === true;
                } catch {
                    return false;
                }
            }
        }
        return false;
    });

    const [pipPosition, setPipPosition] = useState<{ x: number, y: number }>(() => {
        if (typeof window !== 'undefined') {
            const saved = localStorage.getItem('kylrix_active_pip');
            if (saved) {
                try {
                    const parsed = JSON.parse(saved);
                    if (parsed.position) return parsed.position;
                } catch {}
            }
            return { x: window.innerWidth - 340, y: window.innerHeight - 260 };
        }
        return { x: 100, y: 100 };
    });

    const localVideoRef = useRef<HTMLVideoElement>(null);
    const remoteVideoRef = useRef<HTMLVideoElement>(null);
    const rtcManager = useRef<WebRTCManager | null>(null);
    const hasInitiatedCall = useRef(false);
    const router = useRouter();
    const callStartTime = useRef<number | null>(null);
    const touchStartYRef = useRef<number | null>(null);
    const micAudioContextRef = useRef<AudioContext | null>(null);
    const micAnimationFrameRef = useRef<number | null>(null);
    const dragStartRef = useRef<{ startX: number, startY: number, posX: number, posY: number } | null>(null);
    
    useEffect(() => {
        if (callStartTime.current === null) {
            callStartTime.current = Date.now();
        }
    }, []);

    const normalizedStatus = String(status || '').toLowerCase();
    const isPeerLive = remoteTrackLive || normalizedStatus === 'connected' || normalizedStatus === 'completed';

    // Drag handlers for PIP window
    const handleDragStart = (e: React.MouseEvent | React.TouchEvent) => {
        if (!isPip) return;
        const target = e.target as HTMLElement;
        // Don't drag if clicking buttons
        if (target.closest('button') || target.closest('a') || target.closest('svg')) {
            return;
        }
        if (e.type === 'mousedown') {
            e.preventDefault();
        }
        const clientX = 'touches' in e ? e.touches[0].clientX : e.clientX;
        const clientY = 'touches' in e ? e.touches[0].clientY : e.clientY;
        dragStartRef.current = {
            startX: clientX,
            startY: clientY,
            posX: pipPosition.x,
            posY: pipPosition.y
        };
    };

    useEffect(() => {
        if (!isPip) return;

        const handleMouseMove = (e: MouseEvent | TouchEvent) => {
            if (!dragStartRef.current) return;
            const clientX = 'touches' in e ? e.touches[0].clientX : e.clientX;
            const clientY = 'touches' in e ? e.touches[0].clientY : e.clientY;
            
            const deltaX = clientX - dragStartRef.current.startX;
            const deltaY = clientY - dragStartRef.current.startY;
            
            const newX = Math.max(10, Math.min(window.innerWidth - 330, dragStartRef.current.posX + deltaX));
            const newY = Math.max(10, Math.min(window.innerHeight - 250, dragStartRef.current.posY + deltaY));
            
            setPipPosition({ x: newX, y: newY });
        };

        const handleMouseUp = () => {
            dragStartRef.current = null;
        };

        window.addEventListener('mousemove', handleMouseMove);
        window.addEventListener('mouseup', handleMouseUp);
        window.addEventListener('touchmove', handleMouseMove, { passive: true });
        window.addEventListener('touchend', handleMouseUp);

        return () => {
            window.removeEventListener('mousemove', handleMouseMove);
            window.removeEventListener('mouseup', handleMouseUp);
            window.removeEventListener('touchmove', handleMouseMove);
            window.removeEventListener('touchend', handleMouseUp);
        };
    }, [isPip]);

    // Sync PIP state to localStorage
    useEffect(() => {
        if (typeof window === 'undefined') return;
        if (isPip) {
            localStorage.setItem('kylrix_active_pip', JSON.stringify({
                isPip: true,
                position: pipPosition,
                callCode,
                conversationId,
                isCaller,
                callType: _callType,
                targetId,
                initialMediaSettings,
                autoInitiate,
                callTitle,
                expiresAt,
                ts: Date.now()
            }));
        } else {
            localStorage.removeItem('kylrix_active_pip');
        }
    }, [isPip, pipPosition, callCode, conversationId, isCaller, _callType, targetId, initialMediaSettings, autoInitiate, callTitle, expiresAt]);

    const resolveUserName = useCallback(async (userId: string) => {
        if (userId === user?.$id) return user.displayName || user.name || 'Me';
        if (userNames[userId]) return userNames[userId];
        
        try {
            const { getCachedCommentIdentity } = await import('@/lib/commentIdentityCache');
            const cached = getCachedCommentIdentity(userId);
            if (cached) {
                const name = cached.displayName || cached.name || cached.username || 'Participant';
                setUserNames(prev => ({ ...prev, [userId]: name }));
                return name;
            }
        } catch {}
        
        const part = participants.find(p => p.userId === userId);
        if (part && part.name) {
            setUserNames(prev => ({ ...prev, [userId]: part.name }));
            return part.name;
        }

        try {
            const { UsersService } = await import('@/lib/services/users');
            const profile = await UsersService.getProfileById(userId);
            if (profile) {
                const name = profile.displayName || profile.name || profile.username || 'Participant';
                setUserNames(prev => ({ ...prev, [userId]: name }));
                try {
                    const { upsertCommentIdentity } = await import('@/lib/commentIdentityCache');
                    upsertCommentIdentity(profile);
                } catch {}
                return name;
            }
        } catch (e) {
            console.error('Failed to fetch profile for', userId, e);
        }
        
        return 'Participant';
    }, [user, userNames, participants]);

    // Automatically resolve names of active participants
    const participantIds = participants.map(p => p.userId).join(',');
    useEffect(() => {
        participants.forEach(p => {
            if (p.userId && !userNames[p.userId]) {
                resolveUserName(p.userId);
            }
        });
    }, [participantIds, resolveUserName]);

    // Lazy load/spin Ghost Note
    useEffect(() => {
        if (!callCode || !user) return;

        const initGhostChat = async () => {
            try {
                const link = await CallService.getCallLink(callCode);
                if (!link) return;

                const metadata = link.metadata ? JSON.parse(link.metadata) : {};
                if (metadata?.chatNoteId) {
                    setChatNoteId(metadata.chatNoteId);
                } else if (isCaller || link.userId === user.$id) {
                    const title = callTitle || link.title || 'Huddle Chat';
                    const ghostNote = await CallService.createGhostNoteForCall(user.$id, callCode, title);
                    if (ghostNote) {
                        setChatNoteId(ghostNote.$id);
                        await CallService.updateCallMetadata(callCode, { chatNoteId: ghostNote.$id });
                    }
                }
            } catch (e) {
                console.error('[CallInterface] Failed to initialize ghost chat note:', e);
            }
        };

        initGhostChat();
    }, [callCode, user, isCaller, callTitle]);

    // Fetch comments and subscribe to comments table
    useEffect(() => {
        if (!chatNoteId) return;

        let active = true;

        const loadMessages = async () => {
            try {
                const { listComments } = await import('@/lib/appwrite/note');
                const res = await listComments(chatNoteId);
                if (!active) return;

                const msgs: ChatMessage[] = [];
                for (const doc of res.documents) {
                    const name = await resolveUserName(doc.userId);
                    msgs.push({
                        id: doc.$id,
                        senderId: doc.userId,
                        senderName: name,
                        content: doc.content,
                        timestamp: new Date(doc.createdAt).getTime(),
                    });
                }
                msgs.sort((a, b) => a.timestamp - b.timestamp);
                setChatMessages(msgs);
            } catch (e) {
                console.error('Failed to load comments for call chat:', e);
            }
        };

        loadMessages();

        const unsubscribe = client.subscribe(
            `databases.${APPWRITE_CONFIG.DATABASES.NOTE}.collections.comments.documents`,
            async (response: any) => {
                if (!active) return;
                const events = response.events;
                const payload = response.payload;

                if (events.some((e: string) => e.includes('.create'))) {
                    if (payload.noteId === chatNoteId) {
                        const name = await resolveUserName(payload.userId);
                        const msg: ChatMessage = {
                            id: payload.$id,
                            senderId: payload.userId,
                            senderName: name,
                            content: payload.content,
                            timestamp: new Date(payload.createdAt).getTime(),
                        };
                        setChatMessages(prev => {
                            if (prev.some(m => m.id === msg.id)) return prev;
                            return [...prev, msg].sort((a, b) => a.timestamp - b.timestamp);
                        });
                        setUnreadChatCount(c => c + 1);
                    }
                }
            }
        );

        return () => {
            active = false;
            unsubscribe();
        };
    }, [chatNoteId, resolveUserName]);

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

    const handleReconnect = async () => {
        if (!user || !targetId) return;
        setStatus('Reconnecting...');
        hasInitiatedCall.current = true;
        await rtcManager.current?.createOffer(user.$id, targetId);
    };

    const broadcastMessage = async (content: string, attachment?: any) => {
        if (!user) return;
        
        if (chatNoteId) {
            try {
                const { createComment } = await import('@/lib/appwrite/note');
                await createComment(chatNoteId, content);
            } catch (e) {
                console.error('[CallInterface] Failed to send chat message:', e);
                toast.error("Failed to send message");
            }
            return;
        }

        if (!targetId) return;
        const msg: ChatMessage = {
            id: Math.random().toString(36).substring(7),
            senderId: user.$id,
            senderName: user.displayName || user.name || 'Guest',
            content,
            timestamp: Date.now(),
            attachment
        };

        setChatMessages(prev => [...prev, msg]);

        try {
            await CallService.sendSignal(user.$id, targetId, {
                type: 'chat_message',
                message: msg
            });
        } catch (_e) {
            console.error('Failed to broadcast message:', _e);
        }
    };

    // Rebind streams when switching layouts (PIP vs non-PIP)
    useEffect(() => {
        const rebindStreams = () => {
            if (rtcManager.current) {
                const localStream = (rtcManager.current as any).localStream;
                const remoteStream = (rtcManager.current as any).remoteStream;

                if (localVideoRef.current && localStream) {
                    localVideoRef.current.srcObject = localStream;
                }
                if (remoteVideoRef.current && remoteStream) {
                    remoteVideoRef.current.srcObject = remoteStream;
                }
            }
        };

        rebindStreams();
        const timer = setTimeout(rebindStreams, 300);
        return () => clearTimeout(timer);
    }, [isPip, remoteTrackLive, normalizedStatus]);

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
            const timer = setTimeout(() => {
                initDirectCall();
            }, 0);
            return () => clearTimeout(timer);
        }
    }, [conversationId, targetId, user, isCaller]);

    useEffect(() => {
        if (!user) return;

        rtcManager.current = new WebRTCManager({
            onTrack: (stream: MediaStream) => {
                if (remoteVideoRef.current) {
                    remoteVideoRef.current.srcObject = stream;
                }
                const hasRemoteTrack = stream.getTracks().length > 0;
                setRemoteTrackLive(hasRemoteTrack);
                if (hasRemoteTrack) {
                    setStatus('connected');
                }
            },
            onStateChange: (state: string) => setStatus(state),
            onSignal: async (signal: any) => {
                if (['join_request', 'let_in', 'reject_join', 'yank_member', 'presence', 'chat_message', 'offer', 'answer', 'candidate'].includes(signal.type)) {
                    if (signal.target) {
                        try {
                            await CallService.sendSignal(user.$id, signal.target, { ...signal, callId: callCode || conversationId });
                        } catch (_e) {
                            console.error('Failed to send signal');
                        }
                    }
                    return;
                }
                if (['offer', 'answer', 'candidate'].includes(signal.type)) return;
            }
        });

        const initVideo = !isCompanion && initialMediaSettings.video;
        const initAudio = !isCompanion && initialMediaSettings.audio;
        
        rtcManager.current.initializeLocalStream(initVideo, initAudio).then((stream) => {
            if (localVideoRef.current && initVideo) {
                localVideoRef.current.srcObject = stream;
            }
            
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

        const unsubscribe = client.subscribe(
            `databases.${APPWRITE_CONFIG.DATABASES.CHAT}.tables.${APPWRITE_CONFIG.TABLES.CHAT.APP_ACTIVITY}.rows`,
            (response: any) => {
                if (response.events.some((e: string) => e.includes('.update') || e.includes('.create'))) {
                    const activity = response.payload;
                    if (!activity.customStatus) return;
                    
                    try {
                        const signal = JSON.parse(activity.customStatus);
                        if (signal.target !== user.$id) return;
                        if (Date.now() - signal.ts > 60000) return; // relax to 60s for clock drifts

                        if (signal.type === 'let_in') {
                            console.log('[CallInterface] Admitted by host, creating offer...');
                            setStatus('Joining...');
                            setTargetId(signal.sender);
                            if (!hasInitiatedCall.current) {
                                hasInitiatedCall.current = true;
                                setTimeout(() => {
                                    rtcManager.current?.createOffer(user.$id, signal.sender);
                                }, 500);
                            }
                        } else if (signal.type === 'join_request') {
                            setJoinRequests(prev => prev.some(r => r.senderId === signal.sender) ? prev : [...prev, { senderId: signal.sender, senderName: signal.name || 'Guest' }]);
                            toast(`Join request from ${signal.name || 'Guest'}`, { icon: '🙋' });
                        } else if (signal.type === 'yank_member') {
                            toast.error("You have been removed from the call by the host.", { duration: 5000 });
                            setTimeout(() => {
                                endCall();
                            }, 1500);
                        } else if (signal.type === 'chat_message') {
                            setChatMessages(prev => [...prev, signal.message]);
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
            if (micAnimationFrameRef.current) {
                cancelAnimationFrame(micAnimationFrameRef.current);
                micAnimationFrameRef.current = null;
            }
            if (micAudioContextRef.current) {
                micAudioContextRef.current.close().catch(() => undefined);
                micAudioContextRef.current = null;
            }
        };
    }, [user, isCaller, autoInitiate, callCode, conversationId, initialMediaSettings.audio, initialMediaSettings.video, isCompanion, targetId]);

    useEffect(() => {
        const stream = localVideoRef.current?.srcObject as MediaStream | null;
        const audioTrack = stream?.getAudioTracks?.()[0];
        if (!audioTrack || isMuted) {
            setMicLevel(0);
            if (micAnimationFrameRef.current) {
                cancelAnimationFrame(micAnimationFrameRef.current);
                micAnimationFrameRef.current = null;
            }
            if (micAudioContextRef.current) {
                micAudioContextRef.current.close().catch(() => undefined);
                micAudioContextRef.current = null;
            }
            return;
        }

        const audioContext = new AudioContext();
        micAudioContextRef.current = audioContext;
        const source = audioContext.createMediaStreamSource(new MediaStream([audioTrack]));
        const analyser = audioContext.createAnalyser();
        analyser.fftSize = 256;
        const samples = new Uint8Array(analyser.frequencyBinCount);
        source.connect(analyser);

        const tick = () => {
            analyser.getByteTimeDomainData(samples);
            let sum = 0;
            for (let i = 0; i < samples.length; i += 1) {
                const centered = (samples[i] - 128) / 128;
                sum += centered * centered;
            }
            const rms = Math.sqrt(sum / samples.length);
            setMicLevel(Math.min(1, rms * 4.2));
            micAnimationFrameRef.current = requestAnimationFrame(tick);
        };
        micAnimationFrameRef.current = requestAnimationFrame(tick);

        return () => {
            if (micAnimationFrameRef.current) {
                cancelAnimationFrame(micAnimationFrameRef.current);
                micAnimationFrameRef.current = null;
            }
            audioContext.close().catch(() => undefined);
            if (micAudioContextRef.current === audioContext) {
                micAudioContextRef.current = null;
            }
        };
    }, [isMuted, status]);

    const handleAcceptRequest = async (request: JoinRequest) => {
        if (!user) return;
        setJoinRequests(prev => prev.filter(r => r.senderId !== request.senderId));
        try {
            await CallService.sendSignal(user.$id, request.senderId, { type: 'let_in', callId: callCode || conversationId });
            setStatus('Connecting to guest...');
            setParticipants(prev => {
                if (prev.some(p => p.userId === request.senderId)) return prev;
                return [...prev, { userId: request.senderId, name: request.senderName }];
            });
        } catch (_e) {
            toast.error("Failed to admit guest");
        }
    };

    const handleRejectRequest = async (request: JoinRequest) => {
        if (!user) return;
        setJoinRequests(prev => prev.filter(r => r.senderId !== request.senderId));
        try {
            await CallService.sendSignal(user.$id, request.senderId, { type: 'reject_join', callId: callCode || conversationId });
        } catch (_e) {
            console.error("Failed to send reject signal", _e);
        }
    };

    const handleYankParticipant = async (userIdToRemove: string) => {
        if (!user || userIdToRemove === user.$id) return;
        try {
            await CallService.sendSignal(user.$id, userIdToRemove, { 
                type: 'yank_member', 
                target: userIdToRemove, 
                callId: callCode || conversationId 
            });
            setParticipants(prev => prev.filter(p => p.userId !== userIdToRemove));
            toast.success("Participant removed from call.");
        } catch (_e) {
            toast.error("Failed to remove participant");
        }
    };
     
    const endCall = useCallback(() => {
        if (rtcManager.current) {
            rtcManager.current.cleanup();
        }
        if (user?.$id) {
            ActivityService.clearLiveCallActivity(user.$id).catch(() => undefined);
        }
        if (typeof window !== 'undefined') {
            localStorage.removeItem('kylrix_active_pip');
            window.dispatchEvent(new Event('kylrix_call_ended'));
        }
        if (!isPip) {
            router.back();
        }
    }, [router, user?.$id, isPip]);


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

    const handleDockTouchStart = (event: React.TouchEvent) => {
        touchStartYRef.current = event.touches[0]?.clientY ?? null;
    };

    const handleDockTouchEnd = (event: React.TouchEvent) => {
        if (touchStartYRef.current == null) return;
        const endY = event.changedTouches[0]?.clientY ?? touchStartYRef.current;
        const delta = touchStartYRef.current - endY;
        if (delta > 36) {
            setIsFullscreen(true);
        }
        touchStartYRef.current = null;
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

    const handleRestore = () => {
        setIsPip(false);
        const code = callCode || conversationId;
        if (code) {
            router.push(`/connect/call/${code}`);
        }
    };

    if (isPip) {
        return (
            <Paper
                elevation={24}
                sx={{
                    position: 'fixed',
                    left: pipPosition.x,
                    top: pipPosition.y,
                    width: 320,
                    height: 240,
                    bgcolor: '#161412',
                    borderRadius: '20px',
                    border: '2px solid rgba(255,255,255,0.1)',
                    boxShadow: '0 30px 60px rgba(0,0,0,0.8)',
                    zIndex: 9999,
                    overflow: 'hidden',
                    display: 'flex',
                    flexDirection: 'column',
                    cursor: 'grab',
                    '&:active': { cursor: 'grabbing' }
                }}
                onMouseDown={handleDragStart}
                onTouchStart={handleDragStart}
            >
                <Box sx={{ 
                    height: 38, 
                    px: 1.5, 
                    bgcolor: '#0F0E0D', 
                    borderBottom: '1px solid rgba(255,255,255,0.05)', 
                    display: 'flex', 
                    alignItems: 'center', 
                    justifyContent: 'space-between',
                    flexShrink: 0
                }}>
                    <Typography variant="caption" sx={{ fontWeight: 900, color: 'white', opacity: 0.8, userSelect: 'none' }}>
                        {callTitle || 'Huddle'}
                    </Typography>
                    <Stack direction="row" spacing={0.5}>
                        <IconButton size="small" onClick={handleRestore} sx={{ color: 'white', p: 0.5 }}>
                            <Maximize2 size={13} />
                        </IconButton>
                        <IconButton size="small" onClick={endCall} sx={{ color: '#EF4444', p: 0.5 }}>
                            <X size={13} />
                        </IconButton>
                    </Stack>
                </Box>
                
                <Box sx={{ flex: 1, position: 'relative', bgcolor: '#000' }}>
                    <Box 
                        component="video" 
                        ref={remoteVideoRef} 
                        autoPlay 
                        playsInline 
                        sx={{ 
                            width: '100%', 
                            height: '100%', 
                            objectFit: 'cover', 
                            display: isPeerLive && !isVideoOff ? 'block' : 'none',
                            transform: 'scaleX(-1)'
                        }} 
                    />
                    
                    {!isPeerLive && (
                        <Box sx={{ position: 'absolute', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', p: 2, textAlign: 'center' }}>
                            <Typography variant="caption" sx={{ color: 'rgba(255,255,255,0.6)', fontWeight: 800 }}>
                                {status === 'Initializing...' ? 'Connecting...' : status}
                            </Typography>
                        </Box>
                    )}

                    <Box sx={{ 
                        position: 'absolute',
                        bottom: 8,
                        right: 8,
                        width: 72,
                        height: 96,
                        borderRadius: '12px',
                        overflow: 'hidden',
                        border: '1.5px solid rgba(255,255,255,0.2)',
                        boxShadow: '0 4px 10px rgba(0,0,0,0.5)',
                        bgcolor: '#161412'
                    }}>
                        <Box component="video" ref={localVideoRef} autoPlay playsInline muted sx={{ width: '100%', height: '100%', objectFit: 'cover', transform: 'scaleX(-1)' }} />
                    </Box>
                </Box>

                <Box sx={{ 
                    height: 48, 
                    bgcolor: '#0F0E0D', 
                    borderTop: '1px solid rgba(255,255,255,0.05)', 
                    display: 'flex', 
                    alignItems: 'center', 
                    justifyContent: 'center', 
                    gap: 2,
                    flexShrink: 0
                }}>
                    <IconButton onClick={toggleMute} size="small" sx={{ 
                        bgcolor: isMuted ? '#EF4444' : 'rgba(255,255,255,0.05)', 
                        color: 'white',
                        p: 1
                    }}>
                        {isMuted ? <MicOff size={15} /> : <Mic size={15} />}
                    </IconButton>
                    <IconButton onClick={toggleVideo} size="small" sx={{ 
                        bgcolor: isVideoOff ? '#EF4444' : 'rgba(255,255,255,0.05)', 
                        color: 'white',
                        p: 1
                    }}>
                        {isVideoOff ? <VideoOff size={15} /> : <Video size={15} />}
                    </IconButton>
                </Box>
            </Paper>
        );
    }

    return (
        <Box sx={{ 
            position: 'fixed', 
            top: isFullscreen ? 0 : 'auto',
            left: 0,
            right: 0,
            bottom: 0,
            height: isFullscreen ? '100dvh' : '60dvh',
            maxHeight: isFullscreen ? '100dvh' : '60dvh',
            bgcolor: '#0A0908', 
            zIndex: 1300,
            display: 'flex',
            flexDirection: 'column',
            overflow: 'hidden',
            borderTopLeftRadius: isFullscreen ? 0 : 24,
            borderTopRightRadius: isFullscreen ? 0 : 24,
            border: isFullscreen ? 'none' : '1px solid rgba(255,255,255,0.08)',
            boxShadow: isFullscreen ? 'none' : '0 -30px 60px rgba(0,0,0,0.55)',
            transition: 'all 260ms cubic-bezier(0.16, 1, 0.3, 1)'
        }}>
            {!isFullscreen && (
                <Box
                    onTouchStart={handleDockTouchStart}
                    onTouchEnd={handleDockTouchEnd}
                    sx={{
                        pt: 'max(10px, env(safe-area-inset-top))',
                        pb: 1,
                        px: 2,
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'space-between',
                        borderBottom: '1px solid rgba(255,255,255,0.08)',
                        bgcolor: '#161412',
                        position: 'relative',
                    }}
                >
                    <Box sx={{ width: 42, height: 4, borderRadius: 999, bgcolor: 'rgba(255,255,255,0.28)', mx: 'auto', position: 'absolute', left: 0, right: 0, top: 8 }} />
                    <Typography sx={{ color: 'rgba(255,255,255,0.75)', fontWeight: 800, fontSize: '0.78rem', letterSpacing: '0.08em', textTransform: 'uppercase' }}>
                        Live Call
                    </Typography>
                    <Button
                        size="small"
                        onClick={() => setIsFullscreen(true)}
                        startIcon={<ChevronUp size={14} />}
                        sx={{ color: '#A5B4FC', fontWeight: 800, textTransform: 'none' }}
                    >
                        Expand
                    </Button>
                </Box>
            )}
            
            {/* Main Viewport Container */}
            <Box sx={{ flex: 1, display: 'flex', flexDirection: 'row', gap: 2, p: 2, height: 'calc(100vh - 108px - 36px)', minHeight: 0, position: 'relative' }}>
                
                {/* Video Area */}
                <Paper 
                    elevation={24}
                    sx={{ 
                        flex: 1,
                        height: '100%',
                        bgcolor: '#161412', borderRadius: '32px', overflow: 'hidden', position: 'relative',
                        border: '1px solid rgba(255,255,255,0.05)', display: 'flex', alignItems: 'center', justifyContent: 'center',
                        boxShadow: '0 50px 100px -20px rgba(0,0,0,0.7)'
                    }}
                >
                    <Box 
                        component="video" ref={remoteVideoRef} autoPlay playsInline 
                        sx={{ 
                            width: '100%', height: '100%', objectFit: 'cover', 
                            display: isPeerLive && !isVideoOff ? 'block' : 'none',
                            transform: 'scaleX(-1)'
                        }} 
                    />
                    
                    {!isPeerLive && normalizedStatus !== 'failed' && (
                        <Box sx={{ textAlign: 'center', color: 'white', zIndex: 1, px: 3 }}>
                            <Paper sx={{ px: 2, py: 1.2, bgcolor: 'rgba(22,20,18,0.72)', border: '1px solid rgba(255,255,255,0.08)', borderRadius: 3, backdropFilter: 'blur(8px)' }}>
                                <Typography sx={{ fontWeight: 800, fontSize: '0.88rem', color: 'rgba(255,255,255,0.86)' }}>
                                    {status === 'Initializing...' ? 'Waiting for participants...' : status === 'new' ? 'Connecting...' : status}
                                </Typography>
                            </Paper>

                            {isCaller && !targetId && (
                                <Stack spacing={2} alignItems="center" sx={{ mt: 3 }}>
                                    <Typography variant="body2" sx={{ opacity: 0.6, fontWeight: 700 }}>
                                        Share code to invite participant
                                    </Typography>
                                    
                                    <Stack direction="row" spacing={1} sx={{ width: '100%', maxWidth: 420, minWidth: 0 }}>
                                        <Paper sx={{ 
                                            flex: 1, p: 1.5, bgcolor: 'rgba(255,255,255,0.03)', 
                                            border: '1px solid rgba(255,255,255,0.05)', borderRadius: 3,
                                            display: 'flex', alignItems: 'center', gap: 1, overflow: 'hidden', minWidth: 0
                                        }}>
                                            <Typography variant="caption" sx={{
                                                color: 'rgba(255,255,255,0.6)', fontWeight: 900,
                                                whiteSpace: 'nowrap', textOverflow: 'ellipsis', overflow: 'hidden', minWidth: 0,
                                                fontFamily: 'var(--font-jetbrains)'
                                            }}>
                                                {(callCode || conversationId || '').slice(0, 7)}
                                            </Typography>
                                            <IconButton size="small" onClick={handleCopyLink} sx={{ color: COLORS.primary }}>
                                                {copied ? <Check size={16} /> : <Copy size={16} />}
                                            </IconButton>
                                        </Paper>

                                        <Paper sx={{
                                            p: 1.5, bgcolor: 'rgba(255,255,255,0.03)', 
                                            border: '1px solid rgba(255,255,255,0.05)', borderRadius: 3,
                                            display: 'flex', alignItems: 'center', gap: 1, flexShrink: 0
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

                            {(!isCaller || targetId) && normalizedStatus === 'initializing...' && (
                                <CircularProgress size={24} sx={{ mt: 4, color: '#6366F1' }} />
                            )}
                        </Box>
                    )}

                    {/* Local Floating Video Frame */}
                    <Paper 
                        elevation={12}
                        sx={{ 
                            position: 'absolute',
                            bottom: 24,
                            right: 24,
                            width: { xs: 90, sm: 130, md: 150 },
                            height: { xs: 120, sm: 170, md: 200 }, 
                            bgcolor: '#161412', borderRadius: '18px', overflow: 'hidden', border: '2px solid rgba(255,255,255,0.1)',
                            boxShadow: '0 20px 40px rgba(0,0,0,0.5)', zIndex: 1200, transition: 'all 0.3s cubic-bezier(0.4, 0, 0.2, 1)'
                        }}
                    >
                        <Box component="video" ref={localVideoRef} autoPlay playsInline muted sx={{ width: '100%', height: '100%', objectFit: 'cover', transform: 'scaleX(-1)' }} />
                        {isVideoOff && (
                            <Box sx={{ position: 'absolute', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', bgcolor: 'rgba(0,0,0,0.8)' }}>
                                <VideoOff size={28} color="rgba(255,255,255,0.2)" />
                            </Box>
                        )}
                    </Paper>
                </Paper>

                {/* Participants Sidebar (Physically unmounted when closed) */}
                {isParticipantsOpen && (
                    <Paper
                        elevation={16}
                        sx={{
                            width: 320,
                            bgcolor: '#161412',
                            border: '1px solid rgba(255,255,255,0.08)',
                            borderRadius: '24px',
                            display: 'flex',
                            flexDirection: 'column',
                            height: '100%',
                            zIndex: 1302,
                            overflow: 'hidden'
                        }}
                    >
                        <Box sx={{ p: 2.5, borderBottom: '1px solid rgba(255,255,255,0.05)', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                            <Typography variant="subtitle1" sx={{ fontWeight: 900, color: 'white' }}>
                                Participants
                            </Typography>
                            <IconButton size="small" onClick={() => setIsParticipantsOpen(false)} sx={{ color: 'rgba(255,255,255,0.4)' }}>
                                <X size={18} />
                            </IconButton>
                        </Box>
                        <Box sx={{ flex: 1, overflowY: 'auto', p: 2, display: 'flex', flexDirection: 'column', gap: 1.5 }}>
                            {/* Host / Me */}
                            <Paper sx={{ p: 1.5, bgcolor: 'rgba(255,255,255,0.02)', border: '1px solid rgba(255,255,255,0.05)', borderRadius: 3, display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                                <Stack direction="row" spacing={1.5} alignItems="center">
                                    <Avatar sx={{ width: 32, height: 32, bgcolor: COLORS.primary, fontSize: '0.8rem', fontWeight: 900 }}>
                                        {(user?.displayName || user?.name || 'M').slice(0, 1).toUpperCase()}
                                    </Avatar>
                                    <Box>
                                        <Typography variant="body2" sx={{ fontWeight: 800, color: 'white' }}>
                                            {user?.displayName || user?.name || 'You'}
                                        </Typography>
                                        <Typography variant="caption" sx={{ color: isCaller ? COLORS.primary : 'rgba(255,255,255,0.4)', fontWeight: 700 }}>
                                            {isCaller ? 'Host (You)' : 'Guest (You)'}
                                        </Typography>
                                    </Box>
                                </Stack>
                            </Paper>

                            {/* Other participants */}
                            {participants.map((p) => {
                                if (p.userId === user?.$id) return null;
                                const isParticipantHost = isCaller ? false : p.userId === targetId;
                                return (
                                    <Paper key={p.userId} sx={{ p: 1.5, bgcolor: 'rgba(255,255,255,0.02)', border: '1px solid rgba(255,255,255,0.05)', borderRadius: 3, display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                                        <Stack direction="row" spacing={1.5} alignItems="center">
                                            <Avatar sx={{ width: 32, height: 32, bgcolor: isParticipantHost ? COLORS.primary : COLORS.secondary, fontSize: '0.8rem', fontWeight: 900 }}>
                                                {(userNames[p.userId] || p.name || 'P').slice(0, 1).toUpperCase()}
                                            </Avatar>
                                            <Box>
                                                <Typography variant="body2" sx={{ fontWeight: 800, color: 'white' }}>
                                                    {userNames[p.userId] || p.name || 'Participant'}
                                                </Typography>
                                                <Typography variant="caption" sx={{ color: isParticipantHost ? COLORS.primary : 'rgba(255,255,255,0.4)', fontWeight: isParticipantHost ? 700 : 500 }}>
                                                    {isParticipantHost ? 'Host' : 'Active'}
                                                </Typography>
                                            </Box>
                                        </Stack>

                                        {isCaller && (
                                            <Tooltip title="Remove Participant">
                                                <IconButton size="small" onClick={() => handleYankParticipant(p.userId)} sx={{ color: '#EF4444', '&:hover': { bgcolor: 'rgba(239, 68, 68, 0.1)' } }}>
                                                    <UserX size={16} />
                                                </IconButton>
                                            </Tooltip>
                                        )}
                                    </Paper>
                                );
                            })}
                        </Box>
                    </Paper>
                )}

                {/* Admission Requests Modal list */}
                {joinRequests.length > 0 && (
                    <Box sx={{
                        position: 'absolute',
                        top: 24,
                        right: 24,
                        width: 300,
                        zIndex: 1305,
                        display: 'flex',
                        flexDirection: 'column',
                        gap: 1.5
                    }}>
                        {joinRequests.map(req => (
                            <Paper key={req.senderId} sx={{ p: 2, bgcolor: '#161412', border: '1.5px solid #6366F1', borderRadius: '16px', boxShadow: '0 20px 40px rgba(0,0,0,0.6)' }}>
                                <Typography variant="subtitle2" sx={{ fontWeight: 900, color: 'white', mb: 1.5 }}>
                                    {req.senderName} wants to join
                                </Typography>
                                <Box sx={{ display: 'flex', gap: 1 }}>
                                    <Button fullWidth size="small" variant="contained" onClick={() => handleAcceptRequest(req)} startIcon={<UserCheck size={14} />} sx={{ bgcolor: '#6366F1', fontWeight: 900, borderRadius: 2 }}>Admit</Button>
                                    <Button size="small" variant="outlined" onClick={() => handleRejectRequest(req)} sx={{ borderColor: 'rgba(255,255,255,0.1)', color: 'white', borderRadius: 2 }}><UserX size={14} /></Button>
                                </Box>
                            </Paper>
                        ))}
                    </Box>
                )}

                {/* Call Metadata/Status Floating panel */}
                <Box sx={{
                    position: 'absolute',
                    top: 40,
                    left: 40,
                    display: 'flex',
                    flexDirection: 'column',
                    gap: 1.1,
                    maxWidth: 420,
                    zIndex: 1100
                }}>
                    {callTitle && (
                        <Paper sx={{ px: 1.5, py: 0.9, bgcolor: 'rgba(22,20,18,0.6)', backdropFilter: 'blur(10px)', borderRadius: 3, border: '1px solid rgba(255,255,255,0.05)' }}>
                            <Typography variant="subtitle2" noWrap sx={{ fontWeight: 900, color: 'white', fontFamily: 'var(--font-clash)' }}>{callTitle.toUpperCase()}</Typography>
                        </Paper>
                    )}
                    <Stack direction="row" spacing={1} useFlexGap flexWrap="wrap">
                        <Paper sx={{ display: 'flex', alignItems: 'center', gap: 1, px: 1.5, py: 0.8, bgcolor: 'rgba(22,20,18,0.6)', backdropFilter: 'blur(10px)', borderRadius: 3, border: '1px solid rgba(255,255,255,0.05)' }}>
                            <Box sx={{ width: 8, height: 8, bgcolor: isPeerLive ? '#10B981' : '#F59E0B', borderRadius: '50%', boxShadow: `0 0 10px ${isPeerLive ? '#10B981' : '#F59E0B'}` }} />
                            <Typography variant="caption" noWrap sx={{ fontWeight: 800, letterSpacing: '0.05em', color: 'white', maxWidth: 140 }}>{status.toUpperCase()}</Typography>
                        </Paper>
                        {timeRemaining && (
                            <Paper sx={{ display: 'flex', alignItems: 'center', gap: 1, px: 1.5, py: 0.8, bgcolor: 'rgba(239, 68, 68, 0.1)', backdropFilter: 'blur(10px)', borderRadius: 3, border: '1px solid rgba(239, 68, 68, 0.2)' }}>
                                <Clock size={12} color="#EF4444" />
                                <Typography variant="caption" noWrap sx={{ fontWeight: 900, color: '#EF4444', fontFamily: 'var(--font-jetbrains)' }}>{timeRemaining}</Typography>
                            </Paper>
                        )}
                    </Stack>
                    <Paper sx={{ display: 'flex', alignItems: 'center', gap: 1, px: 1.5, py: 0.8, bgcolor: 'rgba(22,20,18,0.6)', backdropFilter: 'blur(10px)', borderRadius: 3, border: '1px solid rgba(255,255,255,0.05)' }}>
                        <Users size={14} color="#6366F1" />
                        <Typography variant="caption" noWrap sx={{ fontWeight: 800, color: 'white', opacity: 0.8 }}>
                            {Math.max(participants.length || 0, isPeerLive ? 2 : 1)} {Math.max(participants.length || 0, isPeerLive ? 2 : 1) === 1 ? 'PARTICIPANT' : 'PARTICIPANTS'}
                        </Typography>
                    </Paper>
                    <Paper sx={{ display: 'flex', alignItems: 'center', gap: 1, px: 1.5, py: 0.8, bgcolor: 'rgba(22,20,18,0.6)', backdropFilter: 'blur(10px)', borderRadius: 3, border: '1px solid rgba(255,255,255,0.05)' }}>
                        <ShieldCheck size={14} color="#6366F1" />
                        <Typography variant="caption" noWrap sx={{ fontWeight: 800, color: 'white', opacity: 0.8 }}>SECURE DIRECT CALL</Typography>
                    </Paper>
                </Box>
            </Box>

            {/* Bottom Control Bar */}
            <Box sx={{ height: 108, display: 'flex', justifyContent: 'center', alignItems: 'center', bgcolor: 'transparent', pb: 3, px: 2 }}>
                <Paper
                    sx={{
                        width: 'min(860px, 100%)',
                        px: { xs: 1, sm: 1.5 },
                        py: 1,
                        borderRadius: '24px',
                        bgcolor: '#161412',
                        border: '1px solid rgba(255,255,255,0.08)',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'space-between',
                        gap: 0.8,
                    }}
                >
                    <Tooltip title={isMuted ? "Unmute" : "Mute"}>
                        <IconButton onClick={toggleMute} sx={{
                            width: 48,
                            height: 48,
                            bgcolor: isMuted ? '#EF4444' : 'rgba(255,255,255,0.05)',
                            color: 'white',
                            border: '1px solid rgba(255,255,255,0.1)',
                            boxShadow: !isMuted && micLevel > 0.08 ? `0 0 ${Math.max(8, 20 * micLevel)}px rgba(245,158,11,${Math.min(0.75, 0.3 + micLevel)})` : 'none',
                            transform: !isMuted ? `scale(${1 + micLevel * 0.08})` : 'scale(1)',
                            transition: 'box-shadow 120ms linear, transform 120ms linear, background-color 140ms ease',
                            '&:hover': { bgcolor: isMuted ? '#DC2626' : 'rgba(255,255,255,0.1)' }
                        }}>
                            {isMuted ? <MicOff size={22} /> : <Mic size={22} />}
                        </IconButton>
                    </Tooltip>

                    <Tooltip title={isScreenSharing ? "Stop Sharing" : "Share Screen"}>
                        <IconButton onClick={toggleScreenShare} sx={{ width: 48, height: 48, bgcolor: isScreenSharing ? '#6366F1' : 'rgba(255,255,255,0.05)', color: 'white', border: '1px solid rgba(255,255,255,0.1)' }}>
                            <Monitor size={20} />
                        </IconButton>
                    </Tooltip>

                    <Tooltip title={isVideoOff ? "Start Video" : "Stop Video"}>
                        <IconButton onClick={toggleVideo} sx={{ width: 48, height: 48, bgcolor: isVideoOff ? '#EF4444' : 'rgba(255,255,255,0.05)', color: 'white', border: '1px solid rgba(255,255,255,0.1)', '&:hover': { bgcolor: isVideoOff ? '#DC2626' : 'rgba(255,255,255,0.1)' } }}>
                            {isVideoOff ? <VideoOff size={20} /> : <Video size={20} />}
                        </IconButton>
                    </Tooltip>

                    <Tooltip title={isRecording ? "Stop Recording" : "Record Call"}>
                        <IconButton onClick={toggleRecording} sx={{ width: 48, height: 48, bgcolor: 'rgba(255,255,255,0.05)', color: isRecording ? '#EF4444' : 'white', border: '1px solid rgba(255,255,255,0.1)' }}>
                            {isRecording ? <Square size={18} /> : <Circle size={18} fill={isRecording ? '#EF4444' : 'none'} />}
                        </IconButton>
                    </Tooltip>

                    <Tooltip title="Reconnect">
                        <IconButton onClick={handleReconnect} sx={{ width: 48, height: 48, bgcolor: 'rgba(255,255,255,0.05)', color: '#6366F1', border: '1px solid rgba(255,255,255,0.1)' }}>
                            <Monitor size={20} />
                        </IconButton>
                    </Tooltip>

                    <Tooltip title="Minimize (Picture in Picture)">
                        <IconButton onClick={() => setIsPip(true)} sx={{ width: 48, height: 48, bgcolor: 'rgba(255,255,255,0.05)', color: 'white', border: '1px solid rgba(255,255,255,0.1)' }}>
                            <Minimize2 size={20} />
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
                                    width: 48, height: 48,
                                    bgcolor: isChatOpen ? '#6366F1' : 'rgba(255,255,255,0.05)', 
                                    color: 'white', 
                                    border: '1px solid rgba(255,255,255,0.1)',
                                    '&:hover': { bgcolor: isChatOpen ? '#4F46E5' : 'rgba(255,255,255,0.1)' } 
                                }}
                            >
                                <MessageSquare size={20} />
                            </IconButton>
                        </Badge>
                    </Tooltip>

                    <Tooltip title="Participants">
                        <IconButton 
                            onClick={() => setIsParticipantsOpen(!isParticipantsOpen)} 
                            sx={{ 
                                width: 48, height: 48,
                                bgcolor: isParticipantsOpen ? '#6366F1' : 'rgba(255,255,255,0.05)', 
                                color: 'white', 
                                border: '1px solid rgba(255,255,255,0.1)',
                                '&:hover': { bgcolor: isParticipantsOpen ? '#4F46E5' : 'rgba(255,255,255,0.1)' } 
                            }}
                        >
                            <Users size={20} />
                        </IconButton>
                    </Tooltip>

                    <Tooltip title="Audio/Video Devices">
                        <IconButton onClick={handleDeviceMenuOpen} sx={{ width: 40, height: 40, color: 'rgba(255,255,255,0.65)' }}>
                            <ChevronUp size={16} />
                        </IconButton>
                    </Tooltip>

                    <Tooltip title="End Call">
                        <Fab onClick={endCall} sx={{ width: 54, height: 54, bgcolor: '#EF4444', color: 'white', '&:hover': { bgcolor: '#DC2626', transform: 'scale(1.05)' }, transition: 'all 0.2s', boxShadow: '0 8px 26px rgba(239,68,68,0.45)' }}>
                            <PhoneOff size={22} />
                        </Fab>
                    </Tooltip>
                </Paper>
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

            {isChatOpen && (
                <InCallChat 
                    isOpen={isChatOpen} 
                    onClose={() => setIsChatOpen(false)} 
                    messages={chatMessages}
                    onSendMessage={broadcastMessage}
                    chatNoteId={chatNoteId}
                    isHost={isCaller}
                />
            )}
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
