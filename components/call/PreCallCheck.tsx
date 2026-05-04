'use client';

import React, { useState, useEffect, useRef, useCallback } from 'react';
import { 
    Box, 
    Typography, 
    Button, 
    Paper, 
    Stack, 
    IconButton, 
    alpha,
    Tooltip,
    Avatar
} from '@mui/material';
import { 
    Video, 
    VideoOff, 
    Mic, 
    MicOff, 
    ShieldCheck, 
    ShieldAlert,
    Smartphone,
    Laptop,
    User as UserIcon
} from 'lucide-react';

const COLORS = {
    background: '#0A0908',
    surface: '#161412',
    hover: '#1C1A18',
    primary: '#6366F1',
    secondary: '#F59E0B',
    success: '#10B981',
    error: '#EF4444',
    rim: 'rgba(255, 255, 255, 0.05)'
};

interface PreCallCheckProps {
    onJoin: (settings: { video: boolean, audio: boolean, companion: boolean }) => void;
    userProfile: any;
    isCompanionDetected?: boolean;
}

export function PreCallCheck({ onJoin, userProfile, isCompanionDetected = false }: PreCallCheckProps) {
    const [videoEnabled, setVideoEnabled] = useState(true);
    const [audioEnabled, setAudioEnabled] = useState(true);
    const [companionMode, setCompanionMode] = useState(isCompanionDetected);
    const [permissions, setPermissions] = useState<{ video: boolean, audio: boolean }>({ video: false, audio: false });
    const videoRef = useRef<HTMLVideoElement>(null);
    const streamRef = useRef<MediaStream | null>(null);

    const checkPermissions = useCallback(async () => {
        try {
            const stream = await navigator.mediaDevices.getUserMedia({ video: true, audio: true });
            streamRef.current = stream;
            if (videoRef.current) videoRef.current.srcObject = stream;
            setPermissions({ video: true, audio: true });
        } catch (_e) {
            console.error('Permission denied:', _e);
            // Try audio only if both failed
            try {
                const audioStream = await navigator.mediaDevices.getUserMedia({ audio: true });
                streamRef.current = audioStream;
                setPermissions({ video: false, audio: true });
            } catch (_e2) {
                setPermissions({ video: false, audio: false });
            }
        }
    }, []);

    useEffect(() => {
        const timer = setTimeout(() => {
            checkPermissions();
        }, 0);
        return () => {
            clearTimeout(timer);
            if (streamRef.current) {
                streamRef.current.getTracks().forEach(track => track.stop());
            }
        };
    }, [checkPermissions]);

    const toggleVideo = () => {
        if (!permissions.video) return;
        setVideoEnabled(!videoEnabled);
        if (streamRef.current) {
            streamRef.current.getVideoTracks().forEach(track => track.enabled = !videoEnabled);
        }
    };

    const toggleAudio = () => {
        if (!permissions.audio) return;
        setAudioEnabled(!audioEnabled);
        if (streamRef.current) {
            streamRef.current.getAudioTracks().forEach(track => track.enabled = !audioEnabled);
        }
    };

    return (
        <Paper sx={{ 
            p: 4, 
            bgcolor: COLORS.surface, 
            borderRadius: 8, 
            border: `1px solid ${COLORS.rim}`,
            maxWidth: 800,
            width: '100%',
            boxShadow: '0 50px 100px -20px rgba(0,0,0,0.5)'
        }}>
            <Stack direction={{ xs: 'column', md: 'row' }} spacing={4}>
                {/* Preview Area */}
                <Box sx={{ flex: 1.5, position: 'relative' }}>
                    <Box sx={{ 
                        width: '100%', 
                        aspectRatio: '16/9', 
                        bgcolor: '#000', 
                        borderRadius: 6, 
                        overflow: 'hidden',
                        position: 'relative',
                        border: `1px solid ${COLORS.rim}`
                    }}>
                        {videoEnabled && permissions.video ? (
                            <video 
                                ref={videoRef} 
                                autoPlay 
                                muted 
                                playsInline 
                                style={{ width: '100%', height: '100%', objectFit: 'cover' }} 
                            />
                        ) : (
                            <Box sx={{ 
                                width: '100%', 
                                height: '100%', 
                                display: 'flex', 
                                alignItems: 'center', 
                                justifyContent: 'center',
                                flexDirection: 'column',
                                gap: 2
                            }}>
                                <Avatar 
                                    src={userProfile?.avatar} 
                                    sx={{ width: 80, height: 80, border: `2px solid ${alpha(COLORS.primary, 0.2)}` }}
                                >
                                    {userProfile?.displayName?.charAt(0) || <UserIcon size={32} />}
                                </Avatar>
                                <Typography variant="body2" sx={{ color: 'rgba(255,255,255,0.4)', fontWeight: 700 }}>
                                    Camera is off
                                </Typography>
                            </Box>
                        )}

                        {/* Floating Controls */}
                        <Stack 
                            direction="row" 
                            spacing={2} 
                            sx={{ 
                                position: 'absolute', 
                                bottom: 16, 
                                left: '50%', 
                                transform: 'translateX(-50%)',
                                zIndex: 10
                            }}
                        >
                            <Tooltip title={permissions.audio ? (audioEnabled ? "Mute" : "Unmute") : "Microphone blocked"}>
                                <IconButton 
                                    onClick={toggleAudio}
                                    sx={{ 
                                        bgcolor: audioEnabled ? 'rgba(255,255,255,0.1)' : COLORS.error,
                                        color: 'white',
                                        '&:hover': { bgcolor: audioEnabled ? 'rgba(255,255,255,0.2)' : alpha(COLORS.error, 0.8) },
                                        backdropFilter: 'blur(10px)'
                                    }}
                                >
                                    {audioEnabled ? <Mic size={20} /> : <MicOff size={20} />}
                                </IconButton>
                            </Tooltip>
                            <Tooltip title={permissions.video ? (videoEnabled ? "Turn off camera" : "Turn on camera") : "Camera blocked"}>
                                <IconButton 
                                    onClick={toggleVideo}
                                    sx={{ 
                                        bgcolor: videoEnabled ? 'rgba(255,255,255,0.1)' : COLORS.error,
                                        color: 'white',
                                        '&:hover': { bgcolor: videoEnabled ? 'rgba(255,255,255,0.2)' : alpha(COLORS.error, 0.8) },
                                        backdropFilter: 'blur(10px)'
                                    }}
                                >
                                    {videoEnabled ? <Video size={20} /> : <VideoOff size={20} />}
                                </IconButton>
                            </Tooltip>
                        </Stack>
                    </Box>
                </Box>

                {/* Settings & Join Area */}
                <Stack sx={{ flex: 1 }} spacing={3} justifyContent="center">
                    <Box>
                        <Typography variant="h5" sx={{ fontWeight: 900, fontFamily: 'var(--font-clash)', mb: 1 }}>
                            Ready to join?
                        </Typography>
                        <Typography variant="body2" sx={{ color: 'rgba(255,255,255,0.5)', fontWeight: 700 }}>
                            Check your hardware settings before entering.
                        </Typography>
                    </Box>

                    <Stack spacing={2}>
                        <Box sx={{ 
                            p: 2, 
                            borderRadius: 4, 
                            bgcolor: alpha(permissions.video && permissions.audio ? COLORS.success : COLORS.secondary, 0.05),
                            border: `1px solid ${alpha(permissions.video && permissions.audio ? COLORS.success : COLORS.secondary, 0.1)}`
                        }}>
                            <Stack direction="row" spacing={1.5} alignItems="center">
                                {permissions.video && permissions.audio ? (
                                    <ShieldCheck size={18} color={COLORS.success} />
                                ) : (
                                    <ShieldAlert size={18} color={COLORS.secondary} />
                                )}
                                <Typography variant="caption" sx={{ fontWeight: 800, color: permissions.video && permissions.audio ? COLORS.success : COLORS.secondary }}>
                                    {permissions.video && permissions.audio 
                                        ? "Hardware verified and ready" 
                                        : "Limited hardware access detected"}
                                </Typography>
                            </Stack>
                        </Box>

                        {isCompanionDetected && (
                            <Button
                                fullWidth
                                variant="outlined"
                                onClick={() => setCompanionMode(!companionMode)}
                                startIcon={companionMode ? <Smartphone size={18} /> : <Laptop size={18} />}
                                sx={{ 
                                    py: 1.5, 
                                    borderRadius: 4, 
                                    borderColor: companionMode ? COLORS.secondary : COLORS.rim,
                                    color: companionMode ? COLORS.secondary : 'white',
                                    bgcolor: companionMode ? alpha(COLORS.secondary, 0.05) : 'transparent',
                                    textTransform: 'none',
                                    fontWeight: 800,
                                    '&:hover': { borderColor: COLORS.secondary, bgcolor: alpha(COLORS.secondary, 0.1) }
                                }}
                            >
                                {companionMode ? "Companion Mode Active" : "Join as Companion?"}
                            </Button>
                        )}
                    </Stack>

                    <Button
                        fullWidth
                        variant="contained"
                        size="large"
                        onClick={() => onJoin({ 
                            video: videoEnabled && permissions.video, 
                            audio: audioEnabled && permissions.audio, 
                            companion: companionMode 
                        })}
                        sx={{ 
                            bgcolor: COLORS.primary, 
                            color: 'white', 
                            py: 2, 
                            borderRadius: 4, 
                            fontWeight: 900,
                            fontSize: '1.1rem',
                            textTransform: 'none',
                            boxShadow: `0 20px 40px -10px ${alpha(COLORS.primary, 0.3)}`,
                            '&:hover': { bgcolor: alpha(COLORS.primary, 0.9) }
                        }}
                    >
                        Join Now
                    </Button>
                </Stack>
            </Stack>
        </Paper>
    );
}
