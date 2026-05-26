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
import { createGhostNoteChat, listGhostNoteChats } from '@/lib/actions/client-ops';

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

        // Bypassing E2EE if ecosystem is locked OR target user has no valid publicKey
        if (!ecosystemSecurity.status.isUnlocked || !isValidPublicKey(targetUser.publicKey)) {
            try {
                toast.loading('Initializing huddle...', { id: 'ghost-init' });
                const existingGhosts = await listGhostNoteChats();
                const foundGhost = existingGhosts.find((c: any) => {
                    let metadataObj: any = {};
                    try {
                        metadataObj = typeof c.metadata === 'string' ? JSON.parse(c.metadata) : (c.metadata || {});
                    } catch {}
                    const participants = c.collaborators || metadataObj.participants || [];
                    return participants.includes(targetUserId);
                });

                if (foundGhost) {
                    toast.dismiss('ghost-init');
                    router.push(`/connect/chat/${foundGhost.$id}`);
                    onClose();
                    return;
                }

                const title = targetUser.displayName || targetUser.username || targetUser.title || 'Huddle';
                const newGhost = await createGhostNoteChat(title, [user.$id, targetUserId]);
                toast.success('Huddle thread ready!', { id: 'ghost-init' });
                router.push(`/connect/chat/${newGhost.$id}`);
                onClose();
            } catch (error: any) {
                console.error('Failed to create ghost huddle:', error);
                toast.error(`Failed to create huddle: ${error?.message || 'Unknown error'}`, { id: 'ghost-init' });
            }
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
                        <Typography variant="h6" sx={{ fontWeight: 900, fontFamily: 'var(--font-clash)' }}>New Thread</Typography>
                    </Stack>
                    <IconButton onClick={onClose} sx={{ color: 'rgba(255,255,255,0.5)' }}><X size={20} /></IconButton>
                </Box>

                <Box sx={{ flex: 1 }}>
                    <UserSearch 
                        label="SEARCH GLOBAL DIRECTORY"
                        placeholder="Search by name, @username, or User ID"
                        selectedUsers={selectedUsers}
                        onSelect={(u) => setSelectedUsers([u])}
                        onRemove={() => setSelectedUsers([])}
                        multiple={false}
                        excludeIds={user?.$id ? [user.$id] : []}
                        inlineResults={true}
                    />
                    
                    {!selectedUsers.length && (
                        <Box sx={{ textAlign: 'center', py: 6, opacity: 0.5 }}>
                            <ShieldCheck size={40} strokeWidth={1} style={{ marginBottom: 12 }} />
                            <Typography variant="caption" sx={{ display: 'block', fontWeight: 600 }}>
                                Search for any user by name, username, or User ID to start a huddle thread immediately.
                            </Typography>
                        </Box>
                    )}
                </Box>
            </Box>
        </Drawer>
    );
}
