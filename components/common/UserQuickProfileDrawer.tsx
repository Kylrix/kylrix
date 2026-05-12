'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import {
  Avatar,
  Box,
  Button,
  Chip,
  Divider,
  Drawer,
  IconButton,
  Stack,
  Typography,
  useMediaQuery,
  useTheme,
} from '@mui/material';
import { Copy, MessageCircle, Send, Wallet, X } from 'lucide-react';
import toast from 'react-hot-toast';
import type { KylrixApp } from '@/lib/sdk/design';
import { getQuickProfileSecure } from '@/lib/actions/secure-ops';
import { useWalletOverlay } from '@/context/WalletOverlayContext';
import { account } from '@/lib/appwrite/client';

type UserSeed = {
  userId: string;
  username?: string | null;
  displayName?: string | null;
  avatar?: string | null;
};

type WalletRow = {
  chain: string;
  address: string;
  updatedAt?: string | null;
};

type ProfilePayload = {
  profile: {
    $id: string;
    userId: string;
    username?: string | null;
    displayName?: string | null;
    bio?: string | null;
    avatar?: string | null;
    tier?: string | null;
    publicKey?: string | null;
  } | null;
  wallets: WalletRow[];
};

interface UserQuickProfileDrawerProps {
  open: boolean;
  onClose: () => void;
  user: UserSeed | null;
  currentApp: KylrixApp;
}

function getInitials(name?: string | null) {
  const value = String(name || '').trim();
  if (!value) return 'U';
  return value[0].toUpperCase();
}

function maskAddress(address: string) {
  if (!address) return '';
  if (address.length <= 12) return address;
  return `${address.slice(0, 6)}...${address.slice(-4)}`;
}

export default function UserQuickProfileDrawer({
  open,
  onClose,
  user,
  currentApp,
}: UserQuickProfileDrawerProps) {
  const router = useRouter();
  const theme = useTheme();
  const isDesktop = useMediaQuery(theme.breakpoints.up('md'));
  const [loading, setLoading] = useState(false);
  const [payload, setPayload] = useState<ProfilePayload | null>(null);

  const { openWalletWithIntent } = useWalletOverlay();

  const activeUserId = useMemo(() => String(user?.userId || '').trim(), [user?.userId]);

  useEffect(() => {
    let active = true;

    const run = async () => {
      if (!open || !activeUserId) return;
      setPayload(null);
      setLoading(true);
      try {
        const { jwt } = await account.createJWT().catch(() => ({ jwt: undefined }));
        const data = (await getQuickProfileSecure(activeUserId, jwt)) as ProfilePayload | null;
        if (!active) return;
        if (!data) {
          setPayload({ profile: null, wallets: [] });
          return;
        }
        setPayload(data);
      } catch {
        if (active) setPayload({ profile: null, wallets: [] });
      } finally {
        if (active) setLoading(false);
      }
    };

    void run();
    return () => {
      active = false;
    };
  }, [activeUserId, open]);

  const profile = payload?.profile;
  const displayName = profile?.displayName || user?.displayName || profile?.username || user?.username || 'Person';
  const username = profile?.username || user?.username || null;
  const avatar = profile?.avatar || user?.avatar || null;
  const wallets = useMemo(() => payload?.wallets ?? [], [payload?.wallets]);

  const messageAction = useCallback(() => {
    if (!activeUserId) return;
    onClose();
    router.push(`/connect/chats?userId=${encodeURIComponent(activeUserId)}`);
  }, [activeUserId, onClose, router]);

  const noteAction = useCallback(() => {
    if (!activeUserId) return;
    onClose();
    router.push(`/note/notes?shareTo=${encodeURIComponent(activeUserId)}`);
  }, [activeUserId, onClose, router]);

  const flowAction = useCallback(() => {
    if (!activeUserId) return;
    onClose();
    router.push(`/flow/tasks?assignee=${encodeURIComponent(activeUserId)}`);
  }, [activeUserId, onClose, router]);

  const openProfileAction = useCallback(() => {
    if (!username) return;
    onClose();
    router.push(`/connect/u/${encodeURIComponent(username.replace(/^@+/, ''))}`);
  }, [username, onClose, router]);

  const tipAction = useCallback(async () => {
    if (!wallets.length) {
      toast.error('No published wallet address found for this user.');
      return;
    }
    const target = wallets[0];
    onClose();
    openWalletWithIntent({
        mode: 'send',
        toUser: {
            id: activeUserId,
            username: username || 'User',
            displayName: displayName || 'User',
        },
    });
  }, [wallets, activeUserId, onClose, username, displayName, openWalletWithIntent]);

  const appActions = useMemo(() => {
    const actions = [
      { label: 'Message', onClick: messageAction, icon: <MessageCircle size={16} /> },
      { label: 'Tip', onClick: tipAction, icon: <Wallet size={16} /> },
    ];
    if (currentApp === 'note') {
      actions.unshift({ label: 'Send Note', onClick: noteAction, icon: <Send size={16} /> });
    }
    if (currentApp === 'flow') {
      actions.unshift({ label: 'Assign in Flow', onClick: flowAction, icon: <Send size={16} /> });
    }
    if (username) {
      actions.push({ label: 'View Profile', onClick: openProfileAction, icon: <Send size={16} /> });
    }
    return actions;
  }, [currentApp, username, flowAction, messageAction, noteAction, openProfileAction, tipAction]);

  return (
    <Drawer
      open={open}
      onClose={onClose}
      anchor={isDesktop ? 'right' : 'bottom'}
      PaperProps={{
        sx: {
          bgcolor: '#161412',
          color: '#F4F4F5',
          border: '1px solid #34322F',
          borderRadius: isDesktop ? '24px 0 0 24px' : '24px 24px 0 0',
          width: isDesktop ? 420 : '100%',
          maxHeight: isDesktop ? '100dvh' : '78dvh',
        },
      }}
    >
      <Box sx={{ p: 2.5, display: 'flex', flexDirection: 'column', gap: 2 }}>
        <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <Typography sx={{ fontWeight: 800, letterSpacing: '0.04em', fontSize: '0.78rem', color: '#A1A1AA' }}>
            USER PROFILE
          </Typography>
          <IconButton size="small" onClick={onClose} sx={{ color: '#D4D4D8' }}>
            <X size={16} />
          </IconButton>
        </Box>

        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5 }}>
          <Avatar src={avatar || undefined} sx={{ width: 52, height: 52, bgcolor: '#2A2825' }}>
            {getInitials(displayName)}
          </Avatar>
          <Box sx={{ minWidth: 0 }}>
            <Typography sx={{ fontWeight: 800 }} noWrap>
              {displayName}
            </Typography>
            <Typography sx={{ color: '#A1A1AA', fontSize: '0.85rem' }} noWrap>
              {username ? `@${username.replace(/^@+/, '')}` : activeUserId}
            </Typography>
          </Box>
        </Box>

        {profile?.bio ? (
          <Typography sx={{ color: '#C4C4C7', fontSize: '0.9rem' }}>{profile.bio}</Typography>
        ) : null}

        <Divider sx={{ borderColor: '#34322F' }} />

        <Stack direction="row" spacing={1} useFlexGap flexWrap="wrap">
          {appActions.map((action) => (
            <Button
              key={action.label}
              onClick={action.onClick}
              startIcon={action.icon}
              sx={{
                textTransform: 'none',
                borderRadius: '12px',
                bgcolor: '#1C1A18',
                color: '#F4F4F5',
                border: '1px solid #34322F',
                fontWeight: 700,
                '&:hover': { bgcolor: '#252321' },
              }}
            >
              {action.label}
            </Button>
          ))}
        </Stack>

        <Divider sx={{ borderColor: '#34322F' }} />

        <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1 }}>
          <Typography sx={{ fontWeight: 800, letterSpacing: '0.04em', fontSize: '0.78rem', color: '#A1A1AA' }}>
            PUBLISHED WALLETS
          </Typography>
          {loading ? (
            <Typography sx={{ color: '#A1A1AA', fontSize: '0.86rem' }}>Loading wallets...</Typography>
          ) : wallets.length === 0 ? (
            <Typography sx={{ color: '#A1A1AA', fontSize: '0.86rem' }}>No published wallet addresses.</Typography>
          ) : (
            wallets.map((wallet) => (
              <Box
                key={`${wallet.chain}:${wallet.address}`}
                sx={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  gap: 1,
                  border: '1px solid #34322F',
                  borderRadius: '12px',
                  p: 1.25,
                  bgcolor: '#1C1A18',
                }}
              >
                <Box sx={{ minWidth: 0 }}>
                  <Chip
                    label={wallet.chain.toUpperCase()}
                    size="small"
                    sx={{ height: 22, bgcolor: '#2F2D2A', color: '#F4F4F5', mb: 0.4 }}
                  />
                  <Typography sx={{ fontFamily: 'var(--font-mono)', fontSize: '0.82rem', color: '#D4D4D8' }}>
                    {maskAddress(wallet.address)}
                  </Typography>
                </Box>
                <IconButton
                  size="small"
                  onClick={async () => {
                    try {
                      await navigator.clipboard.writeText(wallet.address);
                      toast.success(`${wallet.chain.toUpperCase()} address copied.`);
                    } catch {
                      toast.error('Failed to copy wallet address.');
                    }
                  }}
                  sx={{ color: '#D4D4D8' }}
                >
                  <Copy size={15} />
                </IconButton>
              </Box>
            ))
          )}
        </Box>
      </Box>
    </Drawer>
  );
}
