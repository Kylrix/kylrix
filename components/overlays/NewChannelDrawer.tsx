'use client';

import React, { useState, useEffect, useCallback } from 'react';
import {
    Drawer,
    Box,
    Typography,
    IconButton,
    TextField,
    List,
    ListItem,
    ListItemText,
    ListItemAvatar,
    Avatar,
    Paper,
    CircularProgress,
    Stack,
    Button,
    alpha,
    useTheme,
    useMediaQuery,
    Checkbox,
    Chip
} from '@mui/material';
import { X, Search, ShieldCheck, Users, ArrowRight, Check } from 'lucide-react';
import { UsersService } from '@/lib/services/users';
import { ChatService } from '@/lib/services/chat';
import { useAuth } from '@/lib/auth';
import { useRouter } from 'next/navigation';
import { useSudo } from '@/context/SudoContext';
import { ecosystemSecurity } from '@/lib/ecosystem/security';
import toast from 'react-hot-toast';

export function NewChannelDrawer({ isOpen, onClose }: { isOpen: boolean; onClose: () => void }) {
    const { user } = useAuth();
    const router = useRouter();
    const theme = useTheme();
    const isMobile = useMediaQuery(theme.breakpoints.down('md'), { noSsr: true });
    const { requestSudo } = useSudo();

    const [query, setQuery] = useState('');
    const [results, setResults] = useState<any[]>([]);
    const [loading, setLoading] = useState(false);
    const [selectedUsers, setSelectedUsers] = useState<any[]>([]);
    const [channelName, setChannelName] = useState('');
    const [creating, setCreating] = useState(false);

    const handleSearch = useCallback(async () => {
        if (!query.trim()) {
            setResults([]);
            return;
        }
        setLoading(true);
        try {
            // Strict check: only users with public keys
            const res = await UsersService.searchUsers(query, { requirePublicKey: true });
            const rows = Array.isArray(res) ? res : (res as any).rows || [];
            setResults(rows.filter((u: any) => u.$id !== user?.$id));
        } catch (error) {
            console.error('Search failed:', error);
        } finally {
            setLoading(false);
        }
    }, [query, user?.$id]);

    useEffect(() => {
        const timeoutId = setTimeout(handleSearch, 400);
        return () => clearTimeout(timeoutId);
    }, [query, handleSearch]);

    const toggleUser = (u: any) => {
        const id = u.userId || u.$id;
        if (selectedUsers.some(su => (su.userId || su.$id) === id)) {
            setSelectedUsers(prev => prev.filter(su => (su.userId || su.$id) !== id));
        } else {
            if (!u.publicKey) {
                toast.error("User hasn't set up secure chatting yet.");
                return;
            }
            setSelectedUsers(prev => [...prev, u]);
        }
    };

    const handleCreateChannel = async () => {
        if (!user) return;
        if (!channelName.trim()) {
            toast.error("Please enter a channel name.");
            return;
        }
        if (selectedUsers.length === 0) {
            toast.error("Please select at least one member.");
            return;
        }

        setCreating(true);
        requestSudo({
            onSuccess: async () => {
                try {
                    await ecosystemSecurity.ensureE2EIdentity(user.$id);
                    const participantIds = [user.$id, ...selectedUsers.map(u => u.userId || u.$id)];
                    
                    // Final safety check: ensure all participants have public keys
                    const profiles = await Promise.all(participantIds.map(id => UsersService.getProfileById(id)));
                    const missingKey = profiles.find(p => !p?.publicKey);
                    if (missingKey) {
                        throw new Error(`${missingKey.displayName || 'A member'} is not ready for secure channels yet.`);
                    }

                    const newConv = await ChatService.createConversation(participantIds, 'group', channelName.trim());
                    router.push(`/connect/chat/${newConv.$id}`);
                    onClose();
                } catch (error: any) {
                    toast.error(`Failed: ${error.message}`);
                } finally {
                    setCreating(false);
                }
            },
            onCancel: () => setCreating(false)
        });
    };

    return (
        <Drawer
            anchor={isMobile ? 'bottom' : 'right'}
            open={isOpen}
            onClose={onClose}
            PaperProps={{
                sx: {
                    width: isMobile ? '100%' : 440,
                    height: isMobile ? '90vh' : '100%',
                    bgcolor: '#0A0908',
                    backgroundImage: 'none',
                    borderLeft: '1px solid #1C1A18',
                    borderTop: isMobile ? '1px solid #1C1A18' : 'none',
                    borderRadius: isMobile ? '24px 24px 0 0' : 0,
                    display: 'flex',
                    flexDirection: 'column'
                }
            }}
        >
            <Box sx={{ p: 3, display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                <Stack direction="row" spacing={1.5} alignItems="center">
                    <Box sx={{ p: 1, borderRadius: '12px', bgcolor: alpha('#F59E0B', 0.1), color: '#F59E0B' }}>
                        <Users size={20} />
                    </Box>
                    <Typography variant="h6" sx={{ fontWeight: 900, fontFamily: 'var(--font-clash)' }}>New Channel</Typography>
                </Stack>
                <IconButton onClick={onClose} sx={{ color: '#9B9691' }}><X size={20} /></IconButton>
            </Box>

            <Box sx={{ px: 3, pb: 3, flex: 1, overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: 3 }}>
                <Box>
                    <Typography variant="caption" sx={{ color: '#9B9691', fontWeight: 800, textTransform: 'uppercase', letterSpacing: '0.1em', mb: 1, display: 'block' }}>Channel Identity</Typography>
                    <TextField
                        fullWidth
                        variant="outlined"
                        placeholder="e.g. Alpha Squad"
                        value={channelName}
                        onChange={(e) => setChannelName(e.target.value)}
                        sx={{
                            '& .MuiOutlinedInput-root': {
                                borderRadius: '14px',
                                bgcolor: '#161412',
                                '& fieldset': { borderColor: '#1C1A18' },
                                '&:hover fieldset': { borderColor: '#34322F' },
                                '&.Mui-focused fieldset': { borderColor: '#F59E0B' }
                            },
                            '& input': { color: 'white', fontWeight: 700 }
                        }}
                    />
                </Box>

                <Box>
                    <Typography variant="caption" sx={{ color: '#9B9691', fontWeight: 800, textTransform: 'uppercase', letterSpacing: '0.1em', mb: 1, display: 'block' }}>Add Members</Typography>
                    <Paper
                        sx={{
                            p: '4px 12px',
                            display: 'flex',
                            alignItems: 'center',
                            bgcolor: '#161412',
                            border: '1px solid #1C1A18',
                            borderRadius: '14px',
                            mb: 2
                        }}
                    >
                        <Search size={18} style={{ color: '#9B9691', marginRight: 8 }} />
                        <TextField
                            fullWidth
                            variant="standard"
                            placeholder="Search verified users..."
                            value={query}
                            onChange={(e) => setQuery(e.target.value)}
                            InputProps={{ disableUnderline: true, sx: { color: 'white', py: 1 } }}
                        />
                        {loading && <CircularProgress size={16} sx={{ color: '#F59E0B' }} />}
                    </Paper>

                    {selectedUsers.length > 0 && (
                        <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 1, mb: 2 }}>
                            {selectedUsers.map(u => (
                                <Chip
                                    key={u.$id}
                                    label={u.displayName || u.username}
                                    onDelete={() => toggleUser(u)}
                                    sx={{
                                        bgcolor: alpha('#F59E0B', 0.1),
                                        color: '#F59E0B',
                                        border: '1px solid #F59E0B',
                                        fontWeight: 800,
                                        borderRadius: '10px'
                                    }}
                                />
                            ))}
                        </Box>
                    )}

                    <Box>
                        {results.map((u) => {
                            const isSelected = selectedUsers.some(su => (su.userId || su.$id) === (u.userId || u.$id));
                            return (
                                <Button
                                    key={u.$id}
                                    fullWidth
                                    onClick={() => toggleUser(u)}
                                    sx={{
                                        justifyContent: 'flex-start',
                                        textAlign: 'left',
                                        p: 1.5,
                                        borderRadius: '14px',
                                        bgcolor: isSelected ? alpha('#F59E0B', 0.05) : 'transparent',
                                        border: '1px solid',
                                        borderColor: isSelected ? '#F59E0B' : 'transparent',
                                        color: 'white',
                                        mb: 1,
                                        '&:hover': { bgcolor: '#161412' }
                                    }}
                                >
                                    <ListItemAvatar>
                                        <Avatar src={u.avatar} sx={{ width: 40, height: 40, bgcolor: '#0A0908', border: '1px solid #1C1A18' }}>
                                            {(u.displayName || u.username || '?')[0].toUpperCase()}
                                        </Avatar>
                                    </ListItemAvatar>
                                    <ListItemText
                                        primary={u.displayName || u.username}
                                        secondary={`@${u.username}`}
                                        primaryTypographyProps={{ fontWeight: 800, color: 'white', fontSize: '0.9rem' }}
                                        secondaryTypographyProps={{ color: '#9B9691', fontSize: '0.75rem' }}
                                    />
                                    {isSelected && <Check size={18} style={{ color: '#F59E0B' }} />}
                                </Button>
                            );
                        })}
                    </Box>
                </Box>
            </Box>

            <Box sx={{ p: 3, borderTop: '1px solid #1C1A18' }}>
                <Button
                    fullWidth
                    variant="contained"
                    disabled={creating || !channelName.trim() || selectedUsers.length === 0}
                    onClick={handleCreateChannel}
                    sx={{
                        py: 2,
                        borderRadius: '16px',
                        fontWeight: 900,
                        bgcolor: '#F59E0B',
                        color: '#000',
                        textTransform: 'none',
                        fontSize: '1rem',
                        '&:hover': { bgcolor: alpha('#F59E0B', 0.8) },
                        '&.Mui-disabled': { bgcolor: alpha('#F59E0B', 0.2), color: alpha('#fff', 0.3) }
                    }}
                >
                    {creating ? <CircularProgress size={24} color="inherit" /> : 'Create Channel'}
                </Button>
            </Box>
        </Drawer>
    );
}
