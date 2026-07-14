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
} from '@/lib/openbricks/primitives';
import { X, Search, ShieldCheck, Users, ArrowRight, Check } from 'lucide-react';
import { UsersService } from '@/lib/services/users';
import { ChatService } from '@/lib/services/chat';
import { useAuth } from '@/lib/auth';
import { useRouter } from 'next/navigation';
import { useSudo } from '@/context/SudoContext';
import { ecosystemSecurity } from '@/lib/ecosystem/security';
import toast from 'react-hot-toast';
import UserSearch from '@/components/UserSearch';
import { isValidX25519PublicKey } from '@/lib/crypto/public-key';
import { useProUpgrade } from '@/context/ProUpgradeContext';
import { useSubscription } from '@/context/subscription/SubscriptionContext';
import { useDrawerState } from '@/components/ui/DrawerStateContext';
import { TOPBAR_DRAWER_BACKDROP_SLOT } from '@/lib/ui/topbar-drawer-slot';

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

export function NewChannelDrawer({ isOpen, onClose }: { isOpen: boolean; onClose: () => void }) {
    const { user } = useAuth();
    const router = useRouter();
    const { requestSudo } = useSudo();
    const { openProUpgrade } = useProUpgrade();
    const { currentTier } = useSubscription();
    const isTeams = currentTier === 'TEAMS' || currentTier === 'ORG' || currentTier === 'LIFETIME';

    const theme = useTheme();
    const isDesktop = useMediaQuery(theme.breakpoints.up('md'));
    const { setIsDrawerOpen } = useDrawerState();
    const [selectedUsers, setSelectedUsers] = useState<any[]>([]);
    const [channelName, setChannelName] = useState('');
    const [creating, setCreating] = useState(false);

    useEffect(() => {
        if (!isOpen) return;
        setIsDrawerOpen(true);
        return () => setIsDrawerOpen(false);
    }, [isOpen, setIsDrawerOpen]);

    const handleCreateChannel = async () => {
        if (!user) return;
        if (!isTeams) {
            openProUpgrade('New Channel');
            return;
        }
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

    if (!isOpen) return null;

    return (
        <Drawer
            anchor={isDesktop ? 'right' : 'bottom'}
            open={isOpen}
            onClose={onClose}
            keepMounted={false}
            disablePortal={true}
            slotProps={TOPBAR_DRAWER_BACKDROP_SLOT}
            PaperProps={{
                sx: {
                    ...DRAWER_SX,
                    p: 0,
                    borderTopLeftRadius: isDesktop ? 0 : DRAWER_SX.borderTopLeftRadius,
                    borderTopRightRadius: isDesktop ? 0 : DRAWER_SX.borderTopRightRadius,
                    borderLeft: isDesktop ? '1px solid #34322F' : undefined,
                    width: isDesktop ? 'min(480px, 90vw)' : DRAWER_SX.width,
                    maxHeight: isDesktop ? 'calc(100dvh - 88px)' : DRAWER_SX.maxHeight,
                    height: isDesktop ? 'calc(100dvh - 88px)' : 'auto',
                },
            }}
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
                            onChange={(e: React.ChangeEvent<HTMLInputElement>) => setChannelName(e.target.value)}
                            sx={{
                                '& .ob-input-root': {
                                    borderRadius: '14px',
                                    bgcolor: '#0A0908',
                                    '& fieldset': { borderColor: 'rgba(255,255,255,0.05)' },
                                    '&:hover fieldset': { borderColor: 'rgba(255,255,255,0.1)' },
                                    '&.ob-focused fieldset': { borderColor: '#F59E0B' }
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
                                if (!isValidX25519PublicKey(u.publicKey)) {
                                    toast.error(`${u.displayName || u.username} hasn't set up their secure identity correctly (invalid key).`);
                                    return;
                                }
                                setSelectedUsers([...selectedUsers, u]);
                            }}
                            onRemove={(id) => setSelectedUsers(selectedUsers.filter(u => (u.id || u.$id) !== id))}
                            multiple={true}
                            excludeIds={[user?.$id].filter(Boolean) as string[]}
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
                            '&.ob-disabled': { bgcolor: alpha('#F59E0B', 0.2), color: alpha('#fff', 0.3) }
                        }}
                    >
                        {creating ? <CircularProgress size={24} color="inherit" /> : 'Create Channel'}
                    </Button>
                </Stack>
            </Box>
        </Drawer>
    );
}
