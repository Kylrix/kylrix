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
    useMediaQuery
} from '@mui/material';
import { X, Search, ShieldCheck, MessageSquare, ArrowRight } from 'lucide-react';
import { UsersService } from '@/lib/services/users';
import { ChatService } from '@/lib/services/chat';
import { useAuth } from '@/lib/auth';
import { useRouter } from 'next/navigation';
import { useSudo } from '@/context/SudoContext';
import { ecosystemSecurity } from '@/lib/ecosystem/security';
import toast from 'react-hot-toast';

export function NewChatDrawer({ isOpen, onClose }: { isOpen: boolean; onClose: () => void }) {
    const { user } = useAuth();
    const router = useRouter();
    const theme = useTheme();
    const isMobile = useMediaQuery(theme.breakpoints.down('md'), { noSsr: true });
    const { requestSudo } = useSudo();

    const [query, setQuery] = useState('');
    const [results, setResults] = useState<any[]>([]);
    const [loading, setLoading] = useState(false);

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

    const startChat = async (targetUser: any) => {
        if (!user) return;
        const targetUserId = targetUser.userId || targetUser.$id;

        if (!targetUser.publicKey) {
            toast.error("User hasn't set up secure chatting yet.");
            return;
        }

        // Try to find existing first
        try {
            const existing = await ChatService.getConversations(user.$id);
            const found = existing.rows.find((c: any) =>
                c.type === 'direct' && c.participants.includes(targetUserId)
            );
            if (found) {
                router.push(`/connect/chat/${found.$id}`);
                onClose();
                return;
            }
        } catch {}

        requestSudo({
            onSuccess: async () => {
                try {
                    await ecosystemSecurity.ensureE2EIdentity(user.$id);
                    const newConv = await ChatService.createConversation([user.$id, targetUserId], 'direct');
                    router.push(`/connect/chat/${newConv.$id}`);
                    onClose();
                } catch (error: any) {
                    toast.error(`Failed: ${error.message}`);
                }
            }
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
                    height: isMobile ? '85vh' : '100%',
                    bgcolor: '#0A0908',
                    backgroundImage: 'none',
                    borderLeft: '1px solid #1C1A18',
                    borderTop: isMobile ? '1px solid #1C1A18' : 'none',
                    borderRadius: isMobile ? '24px 24px 0 0' : 0,
                }
            }}
        >
            <Box sx={{ p: 3, height: '100%', display: 'flex', flexDirection: 'column' }}>
                <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', mb: 3 }}>
                    <Stack direction="row" spacing={1.5} alignItems="center">
                        <Box sx={{ p: 1, borderRadius: '12px', bgcolor: alpha('#F59E0B', 0.1), color: '#F59E0B' }}>
                            <MessageSquare size={20} />
                        </Box>
                        <Typography variant="h6" sx={{ fontWeight: 900, fontFamily: 'var(--font-clash)' }}>New Chat</Typography>
                    </Stack>
                    <IconButton onClick={onClose} sx={{ color: '#9B9691' }}><X size={20} /></IconButton>
                </Box>

                <Paper
                    sx={{
                        p: '4px 12px',
                        display: 'flex',
                        alignItems: 'center',
                        bgcolor: '#161412',
                        border: '1px solid #1C1A18',
                        borderRadius: '14px',
                        mb: 3
                    }}
                >
                    <Search size={18} style={{ color: '#9B9691', marginRight: 8 }} />
                    <TextField
                        fullWidth
                        variant="standard"
                        placeholder="Search by username..."
                        value={query}
                        onChange={(e) => setQuery(e.target.value)}
                        InputProps={{ disableUnderline: true, sx: { color: 'white', py: 1 } }}
                    />
                    {loading && <CircularProgress size={16} sx={{ color: '#F59E0B' }} />}
                </Paper>

                <Box sx={{ flex: 1, overflowY: 'auto' }}>
                    {!query.trim() ? (
                        <Box sx={{ textAlign: 'center', py: 8, opacity: 0.5 }}>
                            <ShieldCheck size={48} strokeWidth={1} style={{ marginBottom: 16 }} />
                            <Typography variant="body2">Search for users with published keys to start a secure direct chat.</Typography>
                        </Box>
                    ) : results.length === 0 && !loading ? (
                        <Typography sx={{ textAlign: 'center', py: 4, color: '#9B9691' }}>No verified users found.</Typography>
                    ) : (
                        <List spacing={1}>
                            {results.map((u) => (
                                <ListItem key={u.$id} disablePadding sx={{ mb: 1 }}>
                                    <Button
                                        fullWidth
                                        onClick={() => startChat(u)}
                                        sx={{
                                            justifyContent: 'flex-start',
                                            textAlign: 'left',
                                            p: 2,
                                            borderRadius: '16px',
                                            bgcolor: '#161412',
                                            border: '1px solid #1C1A18',
                                            color: 'white',
                                            '&:hover': { bgcolor: '#1C1A18', borderColor: '#F59E0B' }
                                        }}
                                    >
                                        <ListItemAvatar>
                                            <Avatar src={u.avatar} sx={{ bgcolor: '#0A0908', border: '1px solid #1C1A18' }}>
                                                {(u.displayName || u.username || '?')[0].toUpperCase()}
                                            </Avatar>
                                        </ListItemAvatar>
                                        <ListItemText
                                            primary={u.displayName || u.username}
                                            secondary={`@${u.username}`}
                                            primaryTypographyProps={{ fontWeight: 800, color: 'white' }}
                                            secondaryTypographyProps={{ color: '#9B9691' }}
                                        />
                                        <ArrowRight size={18} style={{ opacity: 0.3 }} />
                                    </Button>
                                </ListItem>
                            ))}
                        </List>
                    )}
                </Box>
            </Box>
        </Drawer>
    );
}
