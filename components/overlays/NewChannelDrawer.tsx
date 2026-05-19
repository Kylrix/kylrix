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

export function NewChannelDrawer({ isOpen, onClose }: { isOpen: boolean; onClose: () => void }) {
    const { user } = useAuth();
    const router = useRouter();
    const { requestSudo } = useSudo();

    const [selectedUsers, setSelectedUsers] = useState<any[]>([]);
    const [channelName, setChannelName] = useState('');
    const [creating, setCreating] = useState(false);

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
                    const participantIds = [user.$id, ...selectedUsers.map(u => u.id || u.$id)];
                    
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
                            <Users size={20} />
                        </Box>
                        <Typography variant="h6" sx={{ fontWeight: 900, fontFamily: 'var(--font-clash)' }}>New Channel</Typography>
                    </Stack>
                    <IconButton onClick={onClose} sx={{ color: 'rgba(255,255,255,0.5)' }}><X size={20} /></IconButton>
                </Box>

                <Stack spacing={3}>
                    <Box>
                        <Typography variant="caption" sx={{ color: '#F59E0B', fontWeight: 900, textTransform: 'uppercase', letterSpacing: '0.1em', mb: 1, display: 'block', fontSize: '0.7rem' }}>Channel Identity</Typography>
                        <TextField
                            fullWidth
                            variant="outlined"
                            placeholder="e.g. Alpha Squad"
                            value={channelName}
                            onChange={(e) => setChannelName(e.target.value)}
                            sx={{
                                '& .MuiOutlinedInput-root': {
                                    borderRadius: '14px',
                                    bgcolor: '#0A0908',
                                    '& fieldset': { borderColor: 'rgba(255,255,255,0.05)' },
                                    '&:hover fieldset': { borderColor: 'rgba(255,255,255,0.1)' },
                                    '&.Mui-focused fieldset': { borderColor: '#F59E0B' }
                                },
                                '& input': { color: 'white', fontWeight: 700 }
                            }}
                        />
                    </Box>

                    <Box>
                        <UserSearch 
                            label="INVITE CHANNEL MEMBERS"
                            placeholder="Search verified users..."
                            selectedUsers={selectedUsers}
                            onSelect={(u) => {
                                if (!isValidPublicKey(u.publicKey)) {
                                    toast.error(`${u.displayName || u.username} hasn't set up their secure identity correctly (invalid key).`);
                                    return;
                                }
                                setSelectedUsers([...selectedUsers, u]);
                            }}
                            onRemove={(id) => setSelectedUsers(selectedUsers.filter(u => (u.id || u.$id) !== id))}
                            multiple={true}
                            excludeIds={[user?.$id].filter(Boolean)}
                        />
                    </Box>

                    <Button
                        fullWidth
                        variant="contained"
                        disabled={creating || !channelName.trim() || selectedUsers.length === 0}
                        onClick={handleCreateChannel}
                        sx={{
                            py: 1.75,
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
                </Stack>
            </Box>
        </Drawer>
    );
}
