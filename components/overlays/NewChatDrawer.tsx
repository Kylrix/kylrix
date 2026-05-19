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
import UserSearch from '@/components/UserSearch';

const DRAWER_SX = {
    borderTopLeftRadius: '26px',
    borderTopRightRadius: '26px',
    bgcolor: '#161412',
    borderTop: '1px solid #34322F',
    maxWidth: 720,
    width: '100%',
    mx: 'auto',
    maxHeight: '60vh'
};

const isValidPublicKey = (key: string | null | undefined): boolean => {
    if (!key) return false;
    try {
        const normalized = key.replace(/-/g, '+').replace(/_/g, '/');
        const binary = atob(normalized);
        return binary.length === 32;
    } catch {
        return false;
    }
};

export function NewChatDrawer({ isOpen, onClose }: { isOpen: boolean; onClose: () => void }) {
    const { user } = useAuth();
    const router = useRouter();
    const { requestSudo } = useSudo();
    const [selectedUsers, setSelectedUsers] = useState<any[]>([]);

    const startChat = useCallback(async (targetUser: any) => {
        if (!user) return;
        const targetUserId = targetUser.id || targetUser.$id;

        if (!isValidPublicKey(targetUser.publicKey)) {
            toast.error("User hasn't set up secure chatting yet (invalid key).");
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
    }, [user, router, onClose, requestSudo]);

    useEffect(() => {
        if (selectedUsers.length > 0) {
            startChat(selectedUsers[0]);
            setSelectedUsers([]);
        }
    }, [selectedUsers, startChat]);

    return (
        <Drawer
            anchor="bottom"
            open={isOpen}
            onClose={onClose}
            PaperProps={{ sx: DRAWER_SX }}
            ModalProps={{ keepMounted: false, disablePortal: true }}
        >
            <Box sx={{ p: 2.75, pb: 'calc(2.75rem + env(safe-area-inset-bottom))' }}>
                <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', mb: 3 }}>
                    <Stack direction="row" spacing={1.5} alignItems="center">
                        <Box sx={{ p: 1, borderRadius: '12px', bgcolor: alpha('#F59E0B', 0.1), color: '#F59E0B' }}>
                            <MessageSquare size={20} />
                        </Box>
                        <Typography variant="h6" sx={{ fontWeight: 900, fontFamily: 'var(--font-clash)' }}>New Chat</Typography>
                    </Stack>
                    <IconButton onClick={onClose} sx={{ color: 'rgba(255,255,255,0.5)' }}><X size={20} /></IconButton>
                </Box>

                <Box sx={{ flex: 1 }}>
                    <UserSearch 
                        label="SEARCH GLOBAL DIRECTORY"
                        placeholder="Search by name or @username"
                        selectedUsers={selectedUsers}
                        onSelect={(u) => setSelectedUsers([u])}
                        onRemove={() => setSelectedUsers([])}
                        multiple={false}
                        excludeIds={[user?.$id].filter(Boolean)}
                    />
                    
                    {!selectedUsers.length && (
                        <Box sx={{ textAlign: 'center', py: 6, opacity: 0.5 }}>
                            <ShieldCheck size={40} strokeWidth={1} style={{ marginBottom: 12 }} />
                            <Typography variant="caption" sx={{ display: 'block', fontWeight: 600 }}>
                                Only verified users with published keys are surfacing here.
                            </Typography>
                        </Box>
                    )}
                </Box>
            </Box>
        </Drawer>
    );
}
