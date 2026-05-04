'use client';

import React, { useState, useEffect, useCallback } from 'react';
import { UsersService } from '@/lib/services/users';
import type { Profiles } from '@/generated/appwrite/types';
import { ChatService } from '@/lib/services/chat';
import { useAuth } from '@/lib/auth';
import { useRouter } from 'next/navigation';
import {
    Box,
    TextField,
    List,
    ListItem,
    ListItemText,
    ListItemAvatar,
    Avatar,
    Typography,
    Paper,
    CircularProgress,
    Skeleton,
    Stack
} from '@mui/material';
import SearchIcon from '@mui/icons-material/Search';
import PersonIcon from '@mui/icons-material/Person';
import toast from 'react-hot-toast';

import { useSudo } from '@/context/SudoContext';
import { getCachedIdentityById, getCachedIdentityByUsername, seedIdentityCache } from '@/lib/identity-cache';

const SearchResultAvatar = ({ u }: { u: any }) => {
    const cachedById = getCachedIdentityById(u.userId || u.$id);
    const cachedByUsername = getCachedIdentityByUsername(u.username);
    const avatar = u.avatar || cachedById?.avatar || cachedByUsername?.avatar;

    return (
        <Avatar
            src={avatar || undefined}
            sx={{
                bgcolor: 'rgba(255, 255, 255, 0.05)',
                border: '1px solid rgba(255, 255, 255, 0.1)',
                width: 44,
                height: 44
            }}
        >
            {!avatar && <PersonIcon sx={{ color: 'rgba(255, 255, 255, 0.3)' }} />}
        </Avatar>
    );
};

export const UserSearch = () => {
    const [query, setQuery] = useState('');
    const [results, setResults] = useState<Profiles[]>([]);
    const [loading, setLoading] = useState(false);
    const { user } = useAuth();
    const router = useRouter();
    const { requestSudo } = useSudo();

    const handleSearch = useCallback(async (e?: React.FormEvent) => {
        if (e) e.preventDefault();
        if (!query.trim()) return;

        setLoading(true);
        try {
            const res = await UsersService.searchUsers(query);
            const nextRows = res.rows as any;
            nextRows.forEach((u: any) => seedIdentityCache(u));
            setResults(nextRows);
        } catch (error) {
            console.error('Search failed:', error);
        } finally {
            setLoading(false);
        }
    }, [query]);

    useEffect(() => {
        const timeoutId = setTimeout(() => {
            if (query.trim()) {
                handleSearch();
            } else {
                setResults([]);
            }
        }, 500);
        return () => clearTimeout(timeoutId);
    }, [query, handleSearch]);

    const startChat = async (targetUser: any) => {
        if (!user) return;
        const targetUserId = targetUser.$id;

        if (!targetUser.publicKey) {
            toast.error(`${targetUser.displayName || targetUser.username} hasn't set up their account for secure chatting yet.`);
            return;
        }

        // Instant check: look for existing conversation locally first
        try {
            const existing = await ChatService.getConversations(user.$id);
            let found;
            if (targetUserId === user.$id) {
                found = existing.rows.find((c: any) =>
                    c.type === 'direct' &&
                    c.participants.length === 1 &&
                    c.participants[0] === user.$id
                );
            } else {
                found = existing.rows.find((c: any) =>
                    c.type === 'direct' &&
                    c.participants.includes(targetUserId) &&
                    c.participants.length > 1
                );
            }

            if (found) {
                router.push(`/chat/${found.$id}`);
                return; // Instant jump
            }
        } catch (e) {
            console.error("Local check failed", e);
        }

        // If not found, ensure Sudo is unlocked before creating
        requestSudo({
            onSuccess: async () => {
                try {
                    const participants = targetUserId === user.$id ? [user.$id] : [user.$id, targetUserId];
                    const newConv = await ChatService.createConversation(participants, 'direct');
                    router.push(`/chat/${newConv.$id}`);
                } catch (error: any) {
                    console.error('Failed to create chat:', error);
                    toast.error(`Failed to create chat: ${error?.message || 'Unknown error'}`);
                }
            }
        });
    };

    return (
        <Box sx={{ p: 2 }}>
            <Paper
                component="form"
                onSubmit={handleSearch}
                sx={{
                    p: '8px 16px',
                    display: 'flex',
                    alignItems: 'center',
                    mb: 4,
                    borderRadius: '16px',
                    bgcolor: 'rgba(255, 255, 255, 0.03)',
                    border: '1px solid rgba(255, 255, 255, 0.1)',
                    boxShadow: 'none'
                }}
            >
                <SearchIcon sx={{ color: 'rgba(255, 255, 255, 0.3)', mr: 2 }} />
                <TextField
                    sx={{ flex: 1 }}
                    placeholder="Search by name or @username..."
                    variant="standard"
                    value={query}
                    onChange={(e) => setQuery(e.target.value)}
                    InputProps={{
                        disableUnderline: true,
                        sx: { color: 'white', fontWeight: 500 }
                    }}
                />
                {loading && <CircularProgress size={20} sx={{ ml: 1 }} />}
            </Paper>

            {loading && results.length === 0 && (
                <Stack spacing={1.5} sx={{ mb: 2 }}>
                    {[1, 2, 3].map((i) => (
                        <Paper key={i} sx={{ p: 2, borderRadius: '20px', bgcolor: 'rgba(255, 255, 255, 0.02)', border: '1px solid rgba(255, 255, 255, 0.05)' }} elevation={0}>
                            <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
                                <Skeleton variant="circular" width={44} height={44} sx={{ bgcolor: 'rgba(255,255,255,0.05)' }} />
                                <Box sx={{ flex: 1 }}>
                                    <Skeleton width="40%" sx={{ bgcolor: 'rgba(255,255,255,0.05)' }} />
                                    <Skeleton width="25%" sx={{ bgcolor: 'rgba(255,255,255,0.05)' }} />
                                </Box>
                            </Box>
                        </Paper>
                    ))}
                </Stack>
            )}

            <List sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
                {(results as any[]).map((u) => (
                    <Paper
                        key={u.$id}
                        sx={{
                            borderRadius: '20px',
                            bgcolor: 'rgba(255, 255, 255, 0.02)',
                            border: '1px solid rgba(255, 255, 255, 0.05)',
                            transition: 'all 0.2s ease',
                            '&:hover': {
                                bgcolor: 'rgba(255, 255, 255, 0.04)',
                                borderColor: 'rgba(0, 240, 255, 0.2)'
                            }
                        }}
                        elevation={0}
                    >
                        <ListItem
                            sx={{
                                p: 2,
                                cursor: 'pointer',
                                '&:hover': {
                                    bgcolor: 'rgba(255, 255, 255, 0.04)',
                                }
                            }}
                            onClick={() => startChat(u)}
                        >
                            <ListItemAvatar sx={{ mr: 1 }}>
                                <SearchResultAvatar u={u} />
                            </ListItemAvatar>
                            <ListItemText
                                primary={
                                    <Typography sx={{ fontWeight: 800, color: 'white', fontSize: '1rem' }}>
                                        {u.displayName || u.username || `@${(u.userId || u.$id || '').slice(0, 7)}`}
                                    </Typography>
                                }
                                secondary={
                                    <Typography sx={{ color: 'rgba(255, 255, 255, 0.4)', fontSize: '0.85rem', fontWeight: 600 }}>
                                        @{u.username || (u.userId || u.$id || '').slice(0, 7)}
                                    </Typography>
                                }
                            />
                        </ListItem>
                    </Paper>
                ))}
                {results.length === 0 && query.trim().length >= 2 && !loading && (
                    <Box sx={{ textAlign: 'center', py: 8, opacity: 0.5 }}>
                        <Typography variant="body1" sx={{ fontWeight: 700 }}>No users found</Typography>
                        <Typography variant="body2">Try a different name or @username</Typography>
                    </Box>
                )}
            </List>
        </Box>
    );
};
