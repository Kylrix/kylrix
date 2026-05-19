'use client';

import { useEffect, useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import {
  Avatar,
  Box,
  Button,
  Chip,
  CircularProgress,
  Divider,
  Drawer,
  IconButton,
  List,
  ListItem,
  ListItemAvatar,
  ListItemButton,
  ListItemText,
  Paper,
  Skeleton,
  Stack,
  TextField,
  Typography,
  alpha,
  useMediaQuery,
  useTheme,
  SpeedDial,
  SpeedDialAction,
  SpeedDialIcon,
} from '@mui/material';
import { Clock3, MessageCircle, Plus, Search, Users, X } from 'lucide-react';
import toast from 'react-hot-toast';

import { ChatService, getConversationRosterSnapshot, subscribeConversationRoster } from '@/lib/services/chat';
import { UsersService } from '@/lib/services/users';
import { useAuth } from '@/lib/auth';
import { useSudo } from '@/context/SudoContext';
import { ecosystemSecurity } from '@/lib/ecosystem/security';
import { seedIdentityCache } from '@/lib/identity-cache';

type ComposerMode = 'chat' | 'group' | null;

type ComposerTarget = {
  userId: string;
  displayName: string;
  username?: string | null;
  avatar?: string | null;
  publicKey?: string | null;
  conversationId?: string | null;
  lastMessageAt?: string | null;
};

const drawerPaperSx = {
  borderTopLeftRadius: { xs: 24, md: 28 },
  borderTopRightRadius: { xs: 24, md: 28 },
  bgcolor: '#141210',
  borderTop: '1px solid rgba(255, 255, 255, 0.08)',
  backgroundImage: 'none',
  boxShadow: '0 -24px 60px rgba(0, 0, 0, 0.45)',
};

const normalizeLabel = (value: string | null | undefined, fallback: string) =>
  (String(value || '').trim() || fallback).trim();

const normalizeTarget = (item: any): ComposerTarget | null => {
  const userId = String(item?.userId || item?.otherUserId || item?.$id || '').trim();
  if (!userId) return null;

  return {
    userId,
    displayName: normalizeLabel(item?.displayName || item?.name, 'Unknown'),
    username: item?.username || null,
    avatar: item?.avatar || item?.avatarUrl || null,
    publicKey: item?.publicKey || null,
    conversationId: item?.conversationId || item?.$id || null,
    lastMessageAt: item?.lastMessageAt || null,
  };
};

const getInitials = (name: string) =>
  name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase())
    .join('') || '?';

export default function ChatComposerFab() {
  const theme = useTheme();
  const isMobile = useMediaQuery(theme.breakpoints.down('md'));
  const router = useRouter();
  const { user } = useAuth();
  const { requestSudo } = useSudo();

  const [open, setOpen] = useState(false);
  const [mode, setMode] = useState<ComposerMode>(null);
  const [query, setQuery] = useState('');
  const [searchResults, setSearchResults] = useState<ComposerTarget[]>([]);
  const [searchLoading, setSearchLoading] = useState(false);
  const [searchError, setSearchError] = useState<string | null>(null);
  const [rosterRows, setRosterRows] = useState<any[]>(getConversationRosterSnapshot());
  const [selectedTargets, setSelectedTargets] = useState<ComposerTarget[]>([]);
  const [groupName, setGroupName] = useState('');
  const [busyTargetId, setBusyTargetId] = useState<string | null>(null);
  const [creating, setCreating] = useState(false);

  useEffect(() => subscribeConversationRoster(setRosterRows), []);

  useEffect(() => {
    let active = true;
    const timer = setTimeout(() => {
      const text = query.trim();
      if (!text || text.length < 2 || !mode) {
        setSearchResults([]);
        setSearchError(null);
        setSearchLoading(false);
        return;
      }

      setSearchLoading(true);
      setSearchError(null);
      UsersService.searchUsers(text)
        .then((res: any) => {
          if (!active) return;
          const rows = Array.isArray(res) ? res : Array.isArray(res?.rows) ? res.rows : [];
          const filtered = rows
            .filter((item: any) => String(item?.userId || item?.$id || '').trim() !== user?.$id)
            .map(normalizeTarget)
            .filter(Boolean) as ComposerTarget[];

          filtered.forEach((item: any) => seedIdentityCache(item));
          setSearchResults(filtered);
        })
        .catch((error) => {
          if (!active) return;
          console.error('[ChatComposerFab] Search failed:', error);
          setSearchResults([]);
          setSearchError('Could not search people right now.');
        })
        .finally(() => {
          if (active) setSearchLoading(false);
        });
    }, 300);

    return () => {
      active = false;
      clearTimeout(timer);
    };
  }, [mode, query, user?.$id]);

  const recentPeople = useMemo(() => {
    const seen = new Map<string, ComposerTarget>();
    for (const row of rosterRows) {
      if (!row || row.type !== 'direct' || row.isSelf) continue;
      const target = normalizeTarget({
        userId: row.otherUserId || row.participants?.find((participant: string) => participant !== user?.$id),
        displayName: row.name,
        username: row.username,
        avatar: row.avatarUrl || row.avatar,
        conversationId: row.$id,
        lastMessageAt: row.lastMessageAt,
      });
      if (!target) continue;

      const existing = seen.get(target.userId);
      const nextAt = new Date(target.lastMessageAt || 0).getTime();
      const existingAt = new Date(existing?.lastMessageAt || 0).getTime();
      if (!existing || nextAt >= existingAt) {
        seen.set(target.userId, target);
      }
    }

    return Array.from(seen.values()).sort(
      (left, right) => new Date(right.lastMessageAt || 0).getTime() - new Date(left.lastMessageAt || 0).getTime(),
    );
  }, [rosterRows, user?.$id]);

  const reset = () => {
    setOpen(false);
    setMode(null);
    setQuery('');
    setSearchResults([]);
    setSearchError(null);
    setSelectedTargets([]);
    setGroupName('');
    setBusyTargetId(null);
    setCreating(false);
  };

  const openComposer = (nextMode: Exclude<ComposerMode, null>) => {
    setOpen(false);
    setMode(nextMode);
    setQuery('');
    setSearchResults([]);
    setSearchError(null);
    setSelectedTargets([]);
    setGroupName('');
  };

  const ensureUnlocked = async (run: () => Promise<void>) => {
    if (ecosystemSecurity.status.isUnlocked) {
      await run();
      return;
    }

    requestSudo({
      onSuccess: () => {
        void run();
      },
    });
  };

  const resolveTargetProfile = async (candidate: ComposerTarget) => {
    const userId = String(candidate?.userId || '').trim();
    if (!userId || userId === user?.$id) return null;

    if (candidate.publicKey) return candidate;

    const profile = await UsersService.getProfileById(userId).catch(() => null);
    if (!profile) return null;
    seedIdentityCache(profile);

    return normalizeTarget(profile);
  };

  const startDirectChat = async (candidate: ComposerTarget) => {
    if (!user?.$id || !mode) return;
    const resolved = await resolveTargetProfile(candidate);
    if (!resolved) {
      toast.error('Could not open that chat.');
      return;
    }

    if (!resolved.publicKey) {
      toast.error(`${resolved.displayName} has not published a public key yet.`);
      return;
    }

    const existing = rosterRows.find((row) => {
      const targetId = row.otherUserId || row.participants?.find((participant: string) => participant !== user.$id);
      return row.type === 'direct' && targetId === resolved.userId;
    });

    if (existing?.$id) {
      router.push(`/connect/chat/${existing.$id}`);
      reset();
      return;
    }

    await ensureUnlocked(async () => {
      setBusyTargetId(resolved.userId);
      try {
        await UsersService.ensureProfileForUser(user);
        await ecosystemSecurity.ensureE2EIdentity(user.$id);
        const newConv = await ChatService.createConversation([user.$id, resolved.userId], 'direct');
        router.push(`/connect/chat/${newConv.$id}`);
        reset();
      } catch (error: any) {
        console.error('[ChatComposerFab] Failed to create chat:', error);
        toast.error(`Failed to create chat: ${error?.message || 'Unknown error'}`);
      } finally {
        setBusyTargetId(null);
      }
    });
  };

  const toggleGroupTarget = async (candidate: ComposerTarget) => {
    const resolved = await resolveTargetProfile(candidate);
    if (!resolved) {
      toast.error('Could not add that person.');
      return;
    }

    if (!resolved.publicKey) {
      toast.error(`${resolved.displayName} has not published a public key yet.`);
      return;
    }

    setSelectedTargets((current) => {
      if (current.some((item) => item.userId === resolved.userId)) {
        return current.filter((item) => item.userId !== resolved.userId);
      }
      return [...current, resolved];
    });
  };

  const createGroup = async () => {
    if (!user?.$id) return;
    if (selectedTargets.length === 0) {
      toast.error('Pick at least one person.');
      return;
    }

    await ensureUnlocked(async () => {
      setCreating(true);
      try {
        const verifiedTargets: ComposerTarget[] = [];
        for (const candidate of selectedTargets) {
          const resolved = await resolveTargetProfile(candidate);
          if (!resolved?.publicKey) {
            throw new Error(`${candidate.displayName} has not published a public key yet.`);
          }
          verifiedTargets.push(resolved);
        }

        await UsersService.ensureProfileForUser(user);
        await ecosystemSecurity.ensureE2EIdentity(user.$id);

        const participants = Array.from(
          new Set([user.$id, ...verifiedTargets.map((item) => item.userId)].filter(Boolean)),
        );
        const newConv = await ChatService.createConversation(participants, 'group', groupName.trim() || 'Group Chat');
        router.push(`/connect/chat/${newConv.$id}`);
        reset();
      } catch (error: any) {
        console.error('[ChatComposerFab] Failed to create group:', error);
        toast.error(`Failed to create group: ${error?.message || 'Unknown error'}`);
      } finally {
        setCreating(false);
      }
    });
  };

  const candidateList = query.trim().length >= 2 ? searchResults : recentPeople;

  return (
    <>
      <Box
        aria-hidden
        sx={{
          position: 'fixed',
          inset: 0,
          zIndex: 999,
          pointerEvents: 'none',
          opacity: open || Boolean(mode) ? 1 : 0,
          transition: 'opacity 220ms ease',
          backdropFilter: open || Boolean(mode) ? 'blur(12px)' : 'blur(0px)',
          bgcolor: open || Boolean(mode) ? 'rgba(10, 9, 8, 0.22)' : 'transparent',
        }}
      />

      <SpeedDial
        ariaLabel="New chat actions"
        sx={{
          position: 'fixed',
          right: { xs: 16, md: 32 },
          bottom: { xs: 'calc(104px + env(safe-area-inset-bottom))', md: 32 },
          zIndex: 1000,
          '& .MuiFab-primary': {
            width: 64,
            height: 64,
            bgcolor: '#1B1917',
            color: '#F3F2EF',
            border: '1px solid rgba(255, 255, 255, 0.08)',
            boxShadow: '0 16px 36px rgba(0, 0, 0, 0.45)',
            transition: 'transform 150ms ease-out, background-color 150ms ease-out, box-shadow 150ms ease-out',
            '&:hover': {
              bgcolor: '#24211E',
              transform: 'translateY(-2px)',
              boxShadow: '0 18px 40px rgba(0, 0, 0, 0.5)',
            },
          },
          '& .MuiSpeedDialAction-fab': {
            bgcolor: '#161412',
            color: '#EDEDED',
            border: '1px solid rgba(255, 255, 255, 0.08)',
            boxShadow: '0 12px 30px rgba(0, 0, 0, 0.35)',
            transition: 'transform 150ms ease-out, background-color 150ms ease-out, border-color 150ms ease-out',
            '&:hover': {
              bgcolor: '#221F1C',
              borderColor: 'rgba(255, 255, 255, 0.16)',
              transform: 'translateY(-2px)',
            },
          },
          '& .MuiSpeedDialAction-staticTooltipLabel': {
            bgcolor: '#161412',
            border: '1px solid rgba(255, 255, 255, 0.08)',
            color: '#F5F5F5',
            fontWeight: 700,
            letterSpacing: '0.04em',
            textTransform: 'uppercase',
            fontSize: '0.72rem',
          },
        }}
        icon={<SpeedDialIcon icon={<Plus size={24} strokeWidth={1.6} />} openIcon={<X size={24} strokeWidth={1.6} />} />}
        open={open}
        onOpen={() => setOpen(true)}
        onClose={() => setOpen(false)}
        direction="up"
      >
        <SpeedDialAction
          icon={<MessageCircle size={20} strokeWidth={1.6} />}
          tooltipTitle="Chat"
          tooltipOpen
          onClick={() => openComposer('chat')}
        />
        <SpeedDialAction
          icon={<Users size={20} strokeWidth={1.6} />}
          tooltipTitle="Group"
          tooltipOpen
          onClick={() => openComposer('group')}
        />
      </SpeedDial>

      <Drawer
        anchor="bottom"
        open={Boolean(mode)}
        onClose={reset}
        ModalProps={{ keepMounted: false, disablePortal: true }}
        PaperProps={{
          sx: {
            ...drawerPaperSx,
            minHeight: { xs: '88dvh', md: '76dvh' },
            maxHeight: { xs: '92dvh', md: '82dvh' },
            overflow: 'hidden',
          },
        }}
      >
        <Box sx={{ p: { xs: 2, md: 3 }, pt: { xs: 2.5, md: 3 }, display: 'flex', flexDirection: 'column', gap: 2 }}>
          <Stack direction="row" alignItems="start" justifyContent="space-between" spacing={2}>
            <Box>
              <Typography sx={{ fontSize: '1.1rem', fontWeight: 900, color: '#F5F5F5' }}>
                {mode === 'group' ? 'New group' : 'New chat'}
              </Typography>
              <Typography variant="body2" sx={{ color: 'rgba(237, 237, 237, 0.68)', mt: 0.5 }}>
                Search people, then start a secure chat instantly.
              </Typography>
            </Box>
            <IconButton
              onClick={reset}
              aria-label="Close composer"
              sx={{
                color: 'rgba(237, 237, 237, 0.78)',
                bgcolor: 'rgba(255, 255, 255, 0.04)',
                border: '1px solid rgba(255, 255, 255, 0.08)',
                '&:hover': { bgcolor: 'rgba(255, 255, 255, 0.08)' },
              }}
            >
              <X size={18} />
            </IconButton>
          </Stack>

          {mode === 'group' && selectedTargets.length > 0 && (
            <Stack direction="row" spacing={1} useFlexGap flexWrap="wrap">
              {selectedTargets.map((target) => (
                <Chip
                  key={target.userId}
                  label={target.displayName}
                  onDelete={() => setSelectedTargets((current) => current.filter((item) => item.userId !== target.userId))}
                  sx={{
                    bgcolor: 'rgba(255, 255, 255, 0.05)',
                    color: '#F5F5F5',
                    border: '1px solid rgba(255, 255, 255, 0.08)',
                    '& .MuiChip-deleteIcon': { color: 'rgba(255, 255, 255, 0.72)' },
                  }}
                />
              ))}
            </Stack>
          )}

          {mode === 'group' && (
            <TextField
              label="Group name"
              value={groupName}
              onChange={(event) => setGroupName(event.target.value)}
              placeholder="Friends"
              fullWidth
              autoComplete="off"
              inputProps={{ maxLength: 64 }}
              sx={{
                '& .MuiInputLabel-root': { color: 'rgba(237, 237, 237, 0.7)' },
                '& .MuiOutlinedInput-root': {
                  bgcolor: 'rgba(255, 255, 255, 0.03)',
                  '& fieldset': { borderColor: 'rgba(255, 255, 255, 0.1)' },
                },
              }}
            />
          )}

          <TextField
            label="Search people"
            type="search"
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="Type a name or username"
            autoComplete="off"
            autoFocus
            fullWidth
            InputProps={{
              startAdornment: <Search size={16} strokeWidth={1.7} style={{ marginRight: 8, opacity: 0.75 }} />,
            }}
            sx={{
              '& .MuiInputLabel-root': { color: 'rgba(237, 237, 237, 0.7)' },
              '& .MuiOutlinedInput-root': {
                bgcolor: 'rgba(255, 255, 255, 0.03)',
                '& fieldset': { borderColor: 'rgba(255, 255, 255, 0.1)' },
              },
            }}
          />

          {searchError && (
            <Paper
              elevation={0}
              sx={{
                p: 1.5,
                borderRadius: 2,
                bgcolor: alpha(theme.palette.error.main, 0.1),
                border: `1px solid ${alpha(theme.palette.error.main, 0.24)}`,
                color: theme.palette.error.light,
              }}
            >
              <Typography variant="body2" sx={{ fontWeight: 700 }}>
                {searchError}
              </Typography>
            </Paper>
          )}

          {mode === 'group' && selectedTargets.length > 0 && (
            <Typography variant="caption" sx={{ color: 'rgba(237, 237, 237, 0.58)' }}>
              Selected people can see the group once it is created.
            </Typography>
          )}

          <Box sx={{ flex: 1, overflowY: 'auto', pr: 0.5 }}>
            {searchLoading && (
              <Stack spacing={1.25}>
                {Array.from({ length: 4 }).map((_, index) => (
                  <Stack key={index} direction="row" spacing={1.5} alignItems="center" sx={{ p: 1.25 }}>
                    <Skeleton variant="circular" width={44} height={44} />
                    <Box sx={{ flex: 1 }}>
                      <Skeleton width="36%" height={18} />
                      <Skeleton width="52%" height={14} />
                    </Box>
                  </Stack>
                ))}
              </Stack>
            )}

            {!searchLoading && candidateList.length > 0 && query.trim().length < 2 && (
              <Box sx={{ mb: 2 }}>
                <Stack direction="row" alignItems="center" spacing={1} sx={{ mb: 1.25 }}>
                  <Clock3 size={16} strokeWidth={1.8} color="#9B9691" />
                  <Typography variant="subtitle2" sx={{ color: '#F5F5F5', fontWeight: 800 }}>
                    Recent people
                  </Typography>
                </Stack>

                <List sx={{ p: 0, display: 'flex', flexDirection: 'column', gap: 1 }}>
                  {candidateList.map((candidate) => {
                    const selected = selectedTargets.some((item) => item.userId === candidate.userId);
                    return (
                      <Paper
                        key={candidate.userId}
                        elevation={0}
                        sx={{
                          borderRadius: 3,
                          bgcolor: selected ? 'rgba(255, 255, 255, 0.06)' : 'rgba(255, 255, 255, 0.025)',
                          border: '1px solid',
                          borderColor: selected ? 'rgba(255, 255, 255, 0.18)' : 'rgba(255, 255, 255, 0.08)',
                        }}
                      >
                        <ListItem disablePadding>
                          <ListItemButton
                            onClick={() => (mode === 'group' ? void toggleGroupTarget(candidate) : void startDirectChat(candidate))}
                            disabled={busyTargetId === candidate.userId || creating}
                            sx={{ py: 1.1, px: 1.5 }}
                          >
                            <ListItemAvatar>
                              <Avatar
                                src={candidate.avatar || undefined}
                                sx={{ width: 44, height: 44, bgcolor: '#3B3530', color: '#F5F5F5' }}
                              >
                                {getInitials(candidate.displayName)}
                              </Avatar>
                            </ListItemAvatar>
                            <ListItemText
                              primary={<Typography sx={{ fontWeight: 800, color: '#F5F5F5' }}>{candidate.displayName}</Typography>}
                              secondary={
                                <Typography variant="body2" sx={{ color: 'rgba(237, 237, 237, 0.64)' }}>
                                  @{candidate.username || candidate.userId.slice(0, 7)}
                                </Typography>
                              }
                            />
                            <Stack direction="row" alignItems="center" spacing={1}>
                              {mode === 'group' && selected && (
                                <Chip label="Selected" size="small" sx={{ bgcolor: 'rgba(255, 255, 255, 0.08)', color: '#F5F5F5' }} />
                              )}
                              {busyTargetId === candidate.userId && <CircularProgress size={18} thickness={5} />}
                            </Stack>
                          </ListItemButton>
                        </ListItem>
                      </Paper>
                    );
                  })}
                </List>
              </Box>
            )}

            {!searchLoading && query.trim().length >= 2 && candidateList.length > 0 && (
              <Box sx={{ mb: 2 }}>
                <Stack direction="row" alignItems="center" spacing={1} sx={{ mb: 1.25 }}>
                  <Users size={16} strokeWidth={1.8} color="#9B9691" />
                  <Typography variant="subtitle2" sx={{ color: '#F5F5F5', fontWeight: 800 }}>
                    Results
                  </Typography>
                </Stack>

                <List sx={{ p: 0, display: 'flex', flexDirection: 'column', gap: 1 }}>
                  {candidateList.map((candidate) => {
                    const selected = selectedTargets.some((item) => item.userId === candidate.userId);
                    return (
                      <Paper
                        key={candidate.userId}
                        elevation={0}
                        sx={{
                          borderRadius: 3,
                          bgcolor: selected ? 'rgba(255, 255, 255, 0.06)' : 'rgba(255, 255, 255, 0.025)',
                          border: '1px solid',
                          borderColor: selected ? 'rgba(255, 255, 255, 0.18)' : 'rgba(255, 255, 255, 0.08)',
                        }}
                      >
                        <ListItem disablePadding>
                          <ListItemButton
                            onClick={() => (mode === 'group' ? void toggleGroupTarget(candidate) : void startDirectChat(candidate))}
                            disabled={busyTargetId === candidate.userId || creating}
                            sx={{ py: 1.1, px: 1.5 }}
                          >
                            <ListItemAvatar>
                              <Avatar
                                src={candidate.avatar || undefined}
                                sx={{ width: 44, height: 44, bgcolor: '#3B3530', color: '#F5F5F5' }}
                              >
                                {getInitials(candidate.displayName)}
                              </Avatar>
                            </ListItemAvatar>
                            <ListItemText
                              primary={<Typography sx={{ fontWeight: 800, color: '#F5F5F5' }}>{candidate.displayName}</Typography>}
                              secondary={
                                <Typography variant="body2" sx={{ color: 'rgba(237, 237, 237, 0.64)' }}>
                                  @{candidate.username || candidate.userId.slice(0, 7)}
                                </Typography>
                              }
                            />
                            <Stack direction="row" alignItems="center" spacing={1}>
                              {mode === 'group' && selected && (
                                <Chip label="Selected" size="small" sx={{ bgcolor: 'rgba(255, 255, 255, 0.08)', color: '#F5F5F5' }} />
                              )}
                              {busyTargetId === candidate.userId && <CircularProgress size={18} thickness={5} />}
                            </Stack>
                          </ListItemButton>
                        </ListItem>
                      </Paper>
                    );
                  })}
                </List>
              </Box>
            )}

            {!searchLoading && query.trim().length >= 2 && candidateList.length === 0 && (
              <Paper
                elevation={0}
                sx={{
                  p: 3,
                  borderRadius: 3,
                  border: '1px solid rgba(255, 255, 255, 0.08)',
                  bgcolor: 'rgba(255, 255, 255, 0.025)',
                  textAlign: 'center',
                }}
              >
                <Typography sx={{ fontWeight: 800, color: '#F5F5F5' }}>No people found</Typography>
                <Typography variant="body2" sx={{ color: 'rgba(237, 237, 237, 0.64)', mt: 0.5 }}>
                  Try a different name or username.
                </Typography>
              </Paper>
            )}

            {!searchLoading && query.trim().length < 2 && candidateList.length === 0 && (
              <Paper
                elevation={0}
                sx={{
                  p: 3,
                  borderRadius: 3,
                  border: '1px solid rgba(255, 255, 255, 0.08)',
                  bgcolor: 'rgba(255, 255, 255, 0.025)',
                  textAlign: 'center',
                }}
              >
                <Typography sx={{ fontWeight: 800, color: '#F5F5F5' }}>No recent chats yet</Typography>
                <Typography variant="body2" sx={{ color: 'rgba(237, 237, 237, 0.64)', mt: 0.5 }}>
                  Search someone by name or username to start a new conversation.
                </Typography>
              </Paper>
            )}
          </Box>

          {mode === 'group' && (
            <>
              <Divider sx={{ borderColor: 'rgba(255, 255, 255, 0.08)' }} />
              <Stack direction="row" spacing={1.25} justifyContent="space-between" alignItems="center">
                <Button
                  onClick={reset}
                  variant="text"
                  sx={{ color: 'rgba(237, 237, 237, 0.72)', minWidth: 88 }}
                >
                  Cancel
                </Button>
                <Button
                  onClick={() => void createGroup()}
                  variant="contained"
                  disabled={creating || selectedTargets.length === 0}
                  sx={{
                    bgcolor: '#F5F5F5',
                    color: '#0A0908',
                    fontWeight: 900,
                    '&:hover': { bgcolor: '#FFFFFF' },
                    '&.Mui-disabled': { bgcolor: 'rgba(255,255,255,0.08)', color: 'rgba(255,255,255,0.32)' },
                  }}
                >
                  {creating ? <CircularProgress size={18} thickness={5} /> : 'Create group'}
                </Button>
              </Stack>
            </>
          )}
        </Box>
      </Drawer>
    </>
  );
}
