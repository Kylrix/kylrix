'use client';

import React, { useState, useEffect, useCallback } from 'react';
import {
    Drawer,
    Box,
    Typography,
    IconButton,
    TextField,
    CircularProgress,
    Stack,
    Button,
    alpha,
    useTheme,
    useMediaQuery
} from '@/lib/openbricks/primitives';
import { X, Users } from 'lucide-react';
import { ChatService } from '@/lib/services/chat';
import { useAuth } from '@/lib/auth';
import { usePathname, useRouter } from 'next/navigation';
import { useSudo } from '@/context/SudoContext';
import { ecosystemSecurity } from '@/lib/ecosystem/security';
import toast from 'react-hot-toast';
import UserSearch from '@/components/UserSearch';
import { discoverRecipientSecureReady } from '@/lib/chat/recipient-secure-ready';
import { useDrawerState } from '@/components/ui/DrawerStateContext';
import { useOverlay } from '@/components/ui/OverlayContext';
import { useDynamicSidebar } from '@/components/ui/DynamicSidebar';
import { openCommObjectDetail } from '@/components/objects/CommObjectDetail';
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
    const pathname = usePathname();
    const { requestSudo } = useSudo();
    const theme = useTheme();
    const isDesktop = useMediaQuery(theme.breakpoints.up('md'));
    const { setIsDrawerOpen } = useDrawerState();
    const { openOverlay, closeOverlay } = useOverlay();
    const { openSidebar, closeSidebar } = useDynamicSidebar();
    const [selectedUsers, setSelectedUsers] = useState<any[]>([]);
    const [channelName, setChannelName] = useState('');
    const [creating, setCreating] = useState(false);

    useEffect(() => {
        if (!isOpen) return;
        setIsDrawerOpen(true);
        return () => setIsDrawerOpen(false);
    }, [isOpen, setIsDrawerOpen]);

    const openConversation = useCallback(
        (id: string) => {
            onClose();
            const onChatsPage = Boolean(pathname?.startsWith('/connect/chats'));
            const desktop = typeof window !== 'undefined' && window.innerWidth >= 900;
            if (desktop && onChatsPage) {
                router.replace(`/connect/chats?c=${encodeURIComponent(id)}`, { scroll: false });
                return;
            }
            openCommObjectDetail({
                conversationId: id,
                kind: 'chat',
                openSidebar,
                openOverlay,
                closeSidebar,
                closeOverlay,
            });
        },
        [onClose, pathname, router, openSidebar, openOverlay, closeSidebar, closeOverlay],
    );

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

                    const discoveries = await Promise.all(
                        participantIds.map((id) => discoverRecipientSecureReady(id)),
                    );
                    const missing = discoveries.find((d) => d.userId !== user.$id && !d.ready);
                    if (missing) {
                        const label =
                            missing.profile?.displayName ||
                            missing.profile?.username ||
                            'A member';
                        throw new Error(`${label} hasn't set up secure chat yet.`);
                    }

                    const newConv = await ChatService.createConversation(
                        participantIds,
                        'group',
                        channelName.trim(),
                    );
                    toast.success('Hangout ready');
                    openConversation(newConv.$id);
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
                    height: isDesktop ? 'calc(100dvh - 88px)' : 'auto'}}}
        >
            <Box sx={{ p: 2.75, pb: 'calc(2.75rem + env(safe-area-inset-bottom))' }}>
                <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', mb: 3 }}>
                    <Stack direction="row" spacing={1.5} alignItems="center">
                        <Box sx={{ p: 1, borderRadius: '12px', bgcolor: alpha('#F59E0B', 0.1), color: '#F59E0B' }}>
                            <Users size={20} />
                        </Box>
                        <Typography variant="h6" sx={{ fontWeight: 900, fontFamily: 'var(--font-clash)' }}>New Hangout</Typography>
                    </Stack>
                    <IconButton onClick={onClose} sx={{ color: 'rgba(255,255,255,0.5)' }}><X size={20} /></IconButton>
                </Box>

                <Stack spacing={3}>
                    <Box>
                        <Typography variant="caption" sx={{ color: '#F59E0B', fontWeight: 900, textTransform: 'uppercase', letterSpacing: '0.1em', mb: 1, display: 'block', fontSize: '0.7rem' }}>Hangout name</Typography>
                        <TextField
                            fullWidth
                            variant="outlined"
                            placeholder="e.g. Weekend crew"
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
                            label="ADD PEOPLE"
                            placeholder="Search by name or @username"
                            selectedUsers={selectedUsers}
                            onSelect={(u) => {
                                void (async () => {
                                    const id = u.id || (u as any).$id;
                                    const d = await discoverRecipientSecureReady(
                                        id,
                                        typeof u.publicKey === 'string' ? u.publicKey : null,
                                    );
                                    if (!d.ready) {
                                        toast.error(
                                            `${u.displayName || u.username} hasn't set up secure chat yet.`,
                                        );
                                        return;
                                    }
                                    setSelectedUsers((prev) =>
                                        prev.some((x) => (x.id || (x as any).$id) === id)
                                            ? prev
                                            : [...prev, { ...u, publicKey: d.publicKey }],
                                    );
                                })();
                            }}
                            onRemove={(id) => setSelectedUsers(selectedUsers.filter(u => (u.id || u.$id) !== id))}
                            multiple={true}
                            excludeIds={user?.$id ? [user.$id] : []}
                        />
                    </Box>

                    <Button
                        fullWidth
                        variant="contained"
                        disabled={creating || !channelName.trim() || selectedUsers.length === 0}
                        onClick={handleCreateChannel}
                        sx={{
                            mt: 1,
                            height: 48,
                            borderRadius: '14px',
                            bgcolor: '#F59E0B',
                            color: '#000',
                            fontWeight: 900,
                            '&:hover': { bgcolor: '#eab308' },
                            '&.Mui-disabled': { bgcolor: 'rgba(245,158,11,0.2)', color: 'rgba(0,0,0,0.4)' }
                        }}
                    >
                        {creating ? <CircularProgress size={22} sx={{ color: '#000' }} /> : 'Create hangout'}
                    </Button>
                </Stack>
            </Box>
        </Drawer>
    );
}
