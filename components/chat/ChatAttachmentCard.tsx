'use client';

import React, { useEffect, useRef, useState } from 'react';
import { Box, Typography, Button, Stack, IconButton, alpha } from '@/lib/openbricks/primitives';
import { Shield, FileText, CheckSquare, PlusCircle, ExternalLink, Lock, Check, RefreshCw } from 'lucide-react';
import type { AttachmentMetadata } from '@/types/p2p';

export function ChatAttachmentCard({ metadata }: { metadata: AttachmentMetadata }) {
        const [showTOTP, setShowTOTP] = useState(false);
        const [isExpired, setIsExpired] = useState(false);
        const [timeLeft, setTimeLeft] = useState(30);
        const [isRevealingSecret, setIsRevealingSecret] = useState(false);
        const revealTimerRef = useRef<NodeJS.Timeout | null>(null);

        const [currentCode, setCurrentCode] = useState(metadata.payload.currentCode || '000 000');

        useEffect(() => {
            if (metadata.subType === 'totp' && metadata.payload.expiry) {
                const timer = setInterval(() => {
                    const diff = Math.max(0, Math.floor((new Date(metadata.payload.expiry!).getTime() - Date.now()) / 1000));
                    setTimeLeft(diff);
                    if (diff <= 0) {
                        setIsExpired(true);
                        setCurrentCode(metadata.payload.nextCode || 'EXPIRED');
                        clearInterval(timer);
                    }
                }, 1000);
                return () => clearInterval(timer);
            }
        }, [metadata]);

        const getEntityIcon = () => {
            switch (metadata.entity) {
                case 'vault': return <Shield size={18} color="#F59E0B" />;
                case 'note': return <FileText size={18} color="#6366F1" />;
                case 'flow': return <CheckSquare size={18} color="#10B981" />;
                default: return <PlusCircle size={18} />;
            }
        };

        const getEntityColor = () => {
            switch (metadata.entity) {
                case 'vault': return '#F59E0B';
                case 'note': return '#6366F1';
                case 'flow': return '#10B981';
                default: return '#94A3B8';
            }
        };

        const handleCardAction = () => {
            const domain = process.env.NEXT_PUBLIC_DOMAIN || 'kylrix.space';
            switch (metadata.entity) {
                case 'note':
                    window.open(`https://note.${domain}/n/${metadata.referenceId}`, '_blank');
                    break;
                case 'vault':
                    window.open(`https://vault.${domain}/vault?id=${metadata.referenceId}`, '_blank');
                    break;
                case 'flow':
                    window.open(`https://flow.${domain}/${metadata.subType === 'task' ? 'tasks' : 'forms'}/${metadata.referenceId}`, '_blank');
                    break;
            }
        };

        const handleSecretMouseDown = () => {
            if (metadata.subType !== 'password') return;
            revealTimerRef.current = setTimeout(() => {
                setIsRevealingSecret(true);
            }, 500);
        };

        const handleSecretMouseUp = () => {
            if (revealTimerRef.current) clearTimeout(revealTimerRef.current);
            setIsRevealingSecret(false);
        };

        return (
            <Box sx={{
                mt: 1,
                minWidth: 260,
                maxWidth: 320,
                borderRadius: '16px',
                overflow: 'hidden',
                border: '1px solid rgba(255, 255, 255, 0.12)',
                background: '#161412',
                boxShadow: '0 8px 32px rgba(0,0,0,0.3)',
                position: 'relative',
                '&::before': {
                    content: '""',
                    position: 'absolute',
                    inset: 0,
                    borderRadius: '16px',
                    padding: '1px',
                    background: metadata.entity === 'vault'
                        ? 'rgba(245, 158, 11, 0.18)'
                        : 'rgba(99, 102, 241, 0.18)',
                    mask: 'linear-gradient(#fff 0 0) content-box, linear-gradient(#fff 0 0)',
                    WebkitMaskComposite: 'xor',
                    maskComposite: 'exclude',
                    pointerEvents: 'none'
                }
            }}>
                <Box sx={{ p: 1.5, display: 'flex', alignItems: 'center', justifyContent: 'space-between', borderBottom: '1px solid rgba(255, 255, 255, 0.05)' }}>
                    <Stack direction="row" spacing={1} alignItems="center">
                        {getEntityIcon()}
                        <Typography variant="caption" sx={{ fontWeight: 800, textTransform: 'uppercase', letterSpacing: 1, opacity: 0.8, color: 'text.primary', fontFamily: 'var(--font-clash)' }}>
                            {metadata.entity} • {metadata.subType}
                        </Typography>
                    </Stack>
                    <Stack direction="row" spacing={0.5} alignItems="center">
                        <Box sx={{ 
                            px: 0.8, 
                            py: 0.2, 
                            borderRadius: '4px', 
                            bgcolor: `${alpha(getEntityColor(), 0.1)}`, 
                            border: `1px solid ${alpha(getEntityColor(), 0.2)}`,
                            display: 'flex',
                            alignItems: 'center',
                            gap: 0.5
                        }}>
                            <Lock size={10} color={getEntityColor()} />
                            <Typography sx={{ fontSize: '8px', fontWeight: 900, color: getEntityColor(), textTransform: 'uppercase' }}>Verified</Typography>
                        </Box>
                        <IconButton size="small" onClick={handleCardAction} sx={{ opacity: 0.5, '&:hover': { opacity: 1, bgcolor: 'rgba(255,255,255,0.05)' } }}>
                            <ExternalLink size={14} />
                        </IconButton>
                    </Stack>
                </Box>

                <Box sx={{ p: 2 }}>
                    <Typography variant="subtitle2" sx={{ fontWeight: 700, mb: 1, color: 'text.primary', fontFamily: 'var(--font-satoshi)' }}>{metadata.payload.label}</Typography>
                    
                    {metadata.entity === 'flow' ? (
                        <Box sx={{ mt: 1 }}>
                             <Box sx={{ 
                                p: 1.5, 
                                bgcolor: 'rgba(16, 185, 129, 0.05)', 
                                borderRadius: '12px', 
                                border: '1px solid rgba(16, 185, 129, 0.1)',
                                display: 'flex',
                                alignItems: 'center',
                                gap: 1.5
                            }}>
                                <Box sx={{ 
                                    width: 24, 
                                    height: 24, 
                                    borderRadius: '6px', 
                                    border: '2px solid #10B981',
                                    display: 'flex',
                                    alignItems: 'center',
                                    justifyContent: 'center',
                                    color: '#10B981'
                                }}>
                                     {metadata.subType === 'task' && metadata.payload.isCompleted && <Check size={16} strokeWidth={3} />}
                                </Box>
                                <Box>
                                    <Typography variant="body2" sx={{ fontWeight: 600, color: 'text.primary' }}>
                                        {metadata.subType === 'task' ? 'Task Assignment' : 'Dynamic Form'}
                                    </Typography>
                                    <Typography variant="caption" sx={{ opacity: 0.5, display: 'block' }}>
                                        {metadata.subType === 'task' ? (metadata.payload.isCompleted ? 'Completed' : 'Pending') : 'Input Required'}
                                    </Typography>
                                </Box>
                            </Box>
                            <Button 
                                fullWidth 
                                size="small" 
                                onClick={handleCardAction}
                                sx={{ 
                                    mt: 1, 
                                    borderRadius: '8px', 
                                    textTransform: 'none', 
                                    fontWeight: 700,
                                    bgcolor: 'rgba(16, 185, 129, 0.1)',
                                    color: '#10B981',
                                    '&:hover': { bgcolor: 'rgba(16, 185, 129, 0.2)' }
                                }}
                            >
                                {metadata.subType === 'task' ? 'View Task' : 'Open Form'}
                            </Button>
                        </Box>
                    ) : metadata.subType === 'totp' ? (
                        <Box sx={{ mt: 1 }}>
                            <Box sx={{ 
                                bgcolor: 'rgba(0,0,0,0.4)', 
                                borderRadius: '12px', 
                                p: 2, 
                                textAlign: 'center',
                                border: '1px solid rgba(245, 158, 11, 0.2)',
                                position: 'relative',
                                overflow: 'hidden'
                            }}>
                                <Typography variant="h5" sx={{ 
                                    fontFamily: 'var(--font-mono)', 
                                    letterSpacing: 4, 
                                    fontWeight: 900,
                                    color: isExpired ? '#ff4d4d' : '#F59E0B',
                                    filter: showTOTP ? 'none' : 'blur(8px)',
                                    transition: 'filter 0.4s cubic-bezier(0.4, 0, 0.2, 1)',
                                    textShadow: isExpired ? 'none' : '0 0 12px rgba(245, 158, 11, 0.3)'
                                }}>
                                    {currentCode}
                                </Typography>
                                {!showTOTP && !isExpired && (
                                    <Button 
                                        size="small" 
                                        onClick={() => setShowTOTP(true)}
                                        sx={{ 
                                            position: 'absolute', 
                                            top: '50%', 
                                            left: '50%', 
                                            transform: 'translate(-50%, -50%)', 
                                            fontWeight: 900, 
                                            color: '#F59E0B',
                                            bgcolor: 'rgba(245, 158, 11, 0.1)',
                                            px: 2,
                                            borderRadius: '8px',
                                            '&:hover': { bgcolor: 'rgba(245, 158, 11, 0.2)' }
                                        }}
                                    >
                                        Reveal Code
                                    </Button>
                                )}
                                {isExpired && (
                                    <Typography variant="caption" sx={{ color: '#ff4d4d', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 0.5, mt: 0.5, fontWeight: 700 }}>
                                        <RefreshCw size={10} className="animate-spin" /> PULSE ROTATED
                                    </Typography>
                                )}
                            </Box>
                            {!isExpired && (
                                <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mt: 1.5, px: 0.5 }}>
                                    <Box sx={{ flex: 1, height: 3, bgcolor: 'rgba(255,255,255,0.05)', borderRadius: 1, overflow: 'hidden' }}>
                                        <Box sx={{ 
                                            width: `${(timeLeft / 30) * 100}%`, 
                                            height: '100%', 
                                            bgcolor: timeLeft < 10 ? '#ff4d4d' : '#F59E0B',
                                            transition: 'width 1s linear, background-color 0.3s ease',
                                            boxShadow: timeLeft < 10 ? '0 0 8px #ff4d4d' : 'none'
                                        }} />
                                    </Box>
                                    <Typography variant="caption" sx={{ fontFamily: 'var(--font-mono)', opacity: 0.5, fontWeight: 700 }}>{timeLeft}s</Typography>
                                </Box>
                            )}
                        </Box>
                    ) : metadata.subType === 'password' ? (
                        <Box 
                            onMouseDown={handleSecretMouseDown}
                            onMouseUp={handleSecretMouseUp}
                            onMouseLeave={handleSecretMouseUp}
                            onTouchStart={handleSecretMouseDown}
                            onTouchEnd={handleSecretMouseUp}
                            sx={{ 
                                mt: 1,
                                bgcolor: 'rgba(0,0,0,0.3)', 
                                borderRadius: '12px', 
                                p: 1.5, 
                                border: '1px solid rgba(255, 255, 255, 0.05)',
                                cursor: 'pointer',
                                userSelect: 'none',
                                position: 'relative',
                                transition: 'all 0.2s ease',
                                '&:active': { transform: 'scale(0.98)', bgcolor: 'rgba(0,0,0,0.5)' }
                            }}
                        >
                             <Typography variant="body2" sx={{ 
                                fontFamily: 'var(--font-mono)', 
                                letterSpacing: isRevealingSecret ? 1 : 4, 
                                opacity: isRevealingSecret ? 1 : 0.4,
                                color: isRevealingSecret ? 'text.primary' : 'text.secondary',
                                textAlign: 'center',
                                transition: 'all 0.2s ease'
                            }}>
                                {isRevealingSecret ? (metadata.payload.preview || 'SECRET_KEY') : '••••••••'}
                            </Typography>
                            {!isRevealingSecret && (
                                <Typography variant="caption" sx={{ display: 'block', textAlign: 'center', mt: 0.5, opacity: 0.3, fontSize: '9px', fontWeight: 800 }}>
                                    HOLD TO REVEAL
                                </Typography>
                            )}
                        </Box>
                    ) : (
                        <Box sx={{ 
                            mt: 1, 
                            p: 1.5, 
                            bgcolor: 'rgba(255,255,255,0.02)', 
                            borderRadius: '12px', 
                            border: '1px solid rgba(255,255,255,0.05)' 
                        }}>
                            <Typography variant="body2" sx={{ opacity: 0.7, fontSize: '0.85rem', lineHeight: 1.5, fontFamily: 'var(--font-satoshi)' }}>
                                {metadata.payload.preview || 'No preview available'}
                            </Typography>
                        </Box>
                    )}
                </Box>
            </Box>
        );
}
