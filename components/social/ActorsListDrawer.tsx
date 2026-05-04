import React, { useState } from 'react';
import { Drawer, Box, Typography, Avatar, IconButton, Stack, useMediaQuery, useTheme, Button, CircularProgress, alpha } from '@mui/material';
import { X, UserPlus, Check } from 'lucide-react';

export interface Actor {
    $id: string;
    userId?: string;
    username?: string;
    displayName?: string;
    avatar?: string | null;
    isFollowing?: boolean;
}

interface Props {
    open: boolean;
    onClose: () => void;
    title: string;
    actors: Actor[];
    mobile?: boolean;
    onSelect?: (actor: Actor) => void;
    onAction?: (actor: Actor, type: 'follow' | 'unfollow') => Promise<void>;
}

export function ActorsListDrawer({ open, onClose, title, actors, mobile = false, onSelect, onAction }: Props) {
    const theme = useTheme();
    const isMdDown = useMediaQuery(theme.breakpoints.down('md'), { noSsr: true });
    const prefersMobile = mobile || isMdDown;
    const [isExpanded, setIsExpanded] = useState(false);
    const [actionLoading, setActionLoading] = useState<string | null>(null);
    const [confirmUnfollow, setConfirmUnfollow] = useState<string | null>(null);

    const handleAction = async (e: React.MouseEvent, actor: Actor, type: 'follow' | 'unfollow') => {
        e.stopPropagation();
        if (!onAction) return;

        if (type === 'unfollow' && confirmUnfollow !== actor.$id) {
            setConfirmUnfollow(actor.$id);
            return;
        }

        setActionLoading(actor.$id);
        try {
            await onAction(actor, type);
            setConfirmUnfollow(null);
        } catch (error) {
            console.error('Action failed:', error);
        } finally {
            setActionLoading(null);
        }
    };

    return (
        <Drawer
            anchor={prefersMobile ? 'bottom' : 'right'}
            open={open}
            onClose={() => {
                onClose();
                setConfirmUnfollow(null);
            }}
            PaperProps={{ 
                sx: { 
                    bgcolor: '#0A0908', 
                    color: 'white', 
                    borderRadius: prefersMobile ? (isExpanded ? '0' : '24px 24px 0 0') : '24px 0 0 24px', 
                    width: prefersMobile ? '100%' : 400, 
                    p: 3, 
                    height: prefersMobile ? (isExpanded ? '100%' : '75%') : 'auto',
                    maxHeight: prefersMobile ? '90%' : '100%',
                    borderTop: prefersMobile ? '1px solid rgba(255,255,255,0.08)' : 'none', 
                    borderLeft: !prefersMobile ? '1px solid rgba(255,255,255,0.08)' : 'none',
                    transition: 'all 0.3s cubic-bezier(0.4, 0, 0.2, 1)',
                    boxShadow: '-20px 0 40px rgba(0,0,0,0.5)'
                } 
            }}
        >
            {prefersMobile && (
                <Box
                    sx={{ width: '100%', pt: 0, pb: 2, display: 'flex', justifyContent: 'center', cursor: 'pointer' }}
                    onClick={() => setIsExpanded(!isExpanded)}
                >
                    <Box sx={{ width: 40, height: 4, bgcolor: 'rgba(255, 255, 255, 0.1)', borderRadius: '2px' }} />
                </Box>
            )}

            <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', mb: 3 }}>
                <Typography sx={{ fontWeight: 900, fontSize: '1.25rem', fontFamily: 'var(--font-clash)' }}>{title}</Typography>
                <IconButton onClick={onClose} sx={{ color: 'rgba(255,255,255,0.4)', '&:hover': { color: 'white', bgcolor: 'rgba(255,255,255,0.05)' } }}>
                    <X size={20} />
                </IconButton>
            </Box>

            <Box sx={{ mt: 1, flex: 1, overflowY: 'auto', px: 0.5 }}>
                {actors.length === 0 && (
                    <Box sx={{ py: 10, textAlign: 'center', opacity: 0.4 }}>
                        <Typography sx={{ fontWeight: 700 }}>No accounts found</Typography>
                    </Box>
                )}

                <Stack spacing={1.5}>
                    {actors.map(actor => (
                        <Box
                            key={actor.$id}
                            onClick={() => onSelect ? onSelect(actor) : null}
                            sx={{
                                display: 'flex',
                                alignItems: 'center',
                                gap: 2,
                                p: 1.5,
                                borderRadius: '16px',
                                cursor: onSelect ? 'pointer' : 'default',
                                transition: 'all 0.2s ease',
                                '&:hover': { bgcolor: 'rgba(255,255,255,0.03)' }
                            }}
                        >
                            <Avatar 
                                src={actor.avatar || undefined} 
                                sx={{ 
                                    width: 48, 
                                    height: 48, 
                                    borderRadius: '14px',
                                    bgcolor: '#F59E0B',
                                    color: 'black',
                                    fontWeight: 900,
                                    fontSize: '1.1rem',
                                    fontFamily: 'var(--font-clash)'
                                }}
                            >
                                {(actor.displayName || actor.username || actor.$id).charAt(0).toUpperCase()}
                            </Avatar>
                            
                            <Box sx={{ flex: 1, minWidth: 0 }}>
                                <Typography noWrap sx={{ fontWeight: 800, fontSize: '0.95rem' }}>
                                    {actor.displayName || actor.username || actor.$id}
                                </Typography>
                                <Typography variant="caption" sx={{ opacity: 0.5, fontFamily: 'var(--font-mono)' }}>
                                    @{actor.username || actor.$id.slice(0, 7)}
                                </Typography>
                            </Box>

                            {onAction && (
                                <Box sx={{ ml: 1 }}>
                                    {actor.isFollowing ? (
                                        <Button
                                            size="small"
                                            variant={confirmUnfollow === actor.$id ? "contained" : "outlined"}
                                            color={confirmUnfollow === actor.$id ? "error" : "inherit"}
                                            disabled={actionLoading === actor.$id}
                                            onClick={(e) => handleAction(e, actor, 'unfollow')}
                                            sx={{ 
                                                borderRadius: '10px',
                                                textTransform: 'none',
                                                fontWeight: 800,
                                                fontSize: '0.75rem',
                                                px: 1.5,
                                                minWidth: 80,
                                                borderColor: 'rgba(255,255,255,0.1)',
                                                bgcolor: confirmUnfollow === actor.$id ? '#ff4d4d' : 'transparent',
                                                '&:hover': {
                                                    borderColor: confirmUnfollow === actor.$id ? '#ff4d4d' : '#ff4d4d',
                                                    color: confirmUnfollow === actor.$id ? 'white' : '#ff4d4d',
                                                    bgcolor: confirmUnfollow === actor.$id ? alpha('#ff4d4d', 0.8) : alpha('#ff4d4d', 0.05)
                                                }
                                            }}
                                        >
                                            {actionLoading === actor.$id ? (
                                                <CircularProgress size={14} color="inherit" />
                                            ) : confirmUnfollow === actor.$id ? (
                                                'Confirm'
                                            ) : (
                                                <Stack direction="row" spacing={0.5} alignItems="center">
                                                    <Check size={14} />
                                                    <Typography variant="inherit">Following</Typography>
                                                </Stack>
                                            )}
                                        </Button>
                                    ) : (
                                        <Button
                                            size="small"
                                            variant="contained"
                                            disabled={actionLoading === actor.$id}
                                            onClick={(e) => handleAction(e, actor, 'follow')}
                                            sx={{ 
                                                borderRadius: '10px',
                                                textTransform: 'none',
                                                fontWeight: 800,
                                                fontSize: '0.75rem',
                                                px: 2,
                                                minWidth: 80,
                                                bgcolor: '#F59E0B',
                                                color: 'black',
                                                '&:hover': {
                                                    bgcolor: alpha('#F59E0B', 0.8)
                                                }
                                            }}
                                        >
                                            {actionLoading === actor.$id ? (
                                                <CircularProgress size={14} color="inherit" />
                                            ) : (
                                                <Stack direction="row" spacing={0.5} alignItems="center">
                                                    <UserPlus size={14} />
                                                    <Typography variant="inherit">Follow</Typography>
                                                </Stack>
                                            )}
                                        </Button>
                                    )}
                                </Box>
                            )}
                        </Box>
                    ))}
                </Stack>
            </Box>
        </Drawer>
    );
}

export default ActorsListDrawer;
