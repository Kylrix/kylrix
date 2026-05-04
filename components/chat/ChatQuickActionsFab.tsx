'use client';

import { useEffect, useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import {
  Box,
  Button,
  Checkbox,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  List,
  ListItem,
  ListItemAvatar,
  ListItemButton,
  ListItemText,
  Paper,
  SpeedDial,
  SpeedDialAction,
  SpeedDialIcon,
  Stack,
  TextField,
  Typography,
  useMediaQuery,
  useTheme,
  Avatar,
} from '@mui/material';
import { MessageCircle, Phone, Plus, Users, X } from 'lucide-react';
import toast from 'react-hot-toast';

import { ChatService } from '@/lib/services/chat';
import { UsersService } from '@/lib/services/users';
import { useAuth } from '@/lib/auth';
import { useSudo } from '@/context/SudoContext';
import { ecosystemSecurity } from '@/lib/ecosystem/security';
import { seedIdentityCache } from '@/lib/identity-cache';
import { fetchProfilePreview } from '@/lib/profile-preview';

type Mode = 'chat' | 'group' | null;

const ActionAvatar = ({ user }: { user: any }) => {
  const [avatarUrl, setAvatarUrl] = useState<string | null>(null);

  useEffect(() => {
    let active = true;
    const resolveAvatar = async () => {
      const avatar = user.avatar;
      if (!avatar) {
        if (active) setAvatarUrl(null);
        return;
      }

      if (String(avatar).startsWith('http')) {
        if (active) setAvatarUrl(avatar);
        return;
      }

      try {
        const preview = await fetchProfilePreview(avatar, 64, 64);
        if (active) setAvatarUrl(preview as unknown as string);
      } catch {
        if (active) setAvatarUrl(null);
      }
    };

    void resolveAvatar();
    return () => {
      active = false;
    };
  }, [user.avatar]);

  return (
    <Avatar src={avatarUrl || undefined} sx={{ width: 44, height: 44, bgcolor: '#F59E0B', color: '#FFFFFF' }}>
      {!avatarUrl && (user.displayName || user.username || '?').charAt(0).toUpperCase()}
    </Avatar>
  );
};

export default function ChatQuickActionsFab({ hidden = false }: { hidden?: boolean }) {
  const theme = useTheme();
  const isMobile = useMediaQuery(theme.breakpoints.down('md'));
  const router = useRouter();
  const { user } = useAuth();
  const { requestSudo } = useSudo();
  const [open, setOpen] = useState(false);
  const [mode, setMode] = useState<Mode>(null);
  const [query, setQuery] = useState('');
  const [loading, setLoading] = useState(false);
  const [results, setResults] = useState<any[]>([]);
  const [selectedUsers, setSelectedUsers] = useState<any[]>([]);
  const [groupName, setGroupName] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const title = useMemo(() => (mode === 'group' ? 'New Group' : 'New Chat'), [mode]);

  useEffect(() => {
    let active = true;
    const timer = setTimeout(() => {
      if (!mode || query.trim().length < 2) {
        setResults([]);
        setLoading(false);
        return;
      }

      setLoading(true);
      UsersService.searchUsers(query)
        .then((res) => {
          if (!active) return;
          const filtered = (res.rows || []).filter((u: any) => (u.userId || u.$id) !== user?.$id);
          filtered.forEach((u: any) => seedIdentityCache(u));
          setResults(filtered);
        })
        .catch((error) => {
          console.error('[ChatQuickActionsFab] Search failed:', error);
        })
        .finally(() => {
          if (active) setLoading(false);
        });
    }, 350);

    return () => {
      active = false;
      clearTimeout(timer);
    };
  }, [mode, query, user?.$id]);

  const reset = () => {
    setQuery('');
    setLoading(false);
    setResults([]);
    setSelectedUsers([]);
    setGroupName('');
    setMode(null);
    setOpen(false);
  };

  const openComposer = (nextMode: Exclude<Mode, null>) => {
    setMode(nextMode);
    setOpen(false);
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

  const startDirectChat = async (targetUser: any) => {
    if (!user) return;
    const targetUserId = targetUser.userId || targetUser.$id;

    if (!targetUser.publicKey) {
      toast.error(`${targetUser.displayName || targetUser.username} hasn't set up secure chatting yet.`);
      return;
    }

    try {
      const existing = await ChatService.getConversations(user.$id);
      const found = existing.rows.find((c: any) => c.type === 'direct' && c.participants?.includes(targetUserId));
      if (found) {
        router.push(`/chat/${found.$id}`);
        reset();
        return;
      }
    } catch (error) {
      console.error('[ChatQuickActionsFab] Direct lookup failed:', error);
    }

    await ensureUnlocked(async () => {
      try {
        await UsersService.ensureProfileForUser(user);
        await ecosystemSecurity.ensureE2EIdentity(user.$id);
        const participants = targetUserId === user.$id ? [user.$id] : [user.$id, targetUserId];
        const newConv = await ChatService.createConversation(participants, 'direct');
        router.push(`/chat/${newConv.$id}`);
        reset();
      } catch (error: any) {
        console.error('[ChatQuickActionsFab] Failed to create chat:', error);
        toast.error(`Failed to create chat: ${error?.message || 'Unknown error'}`);
      }
    });
  };

  const createGroup = async () => {
    if (!user) return;
    const participants = Array.from(new Set([user.$id, ...selectedUsers.map((u) => u.userId || u.$id)].filter(Boolean)));
    const name = groupName.trim() || 'Group Chat';

    if (participants.length < 2) {
      toast.error('Pick at least one other person for the group.');
      return;
    }

    await ensureUnlocked(async () => {
      setSubmitting(true);
      try {
        await UsersService.ensureProfileForUser(user);
        await ecosystemSecurity.ensureE2EIdentity(user.$id);
        const newConv = await ChatService.createConversation(participants, 'group', name);
        router.push(`/chat/${newConv.$id}`);
        reset();
      } catch (error: any) {
        console.error('[ChatQuickActionsFab] Failed to create group:', error);
        toast.error(`Failed to create group: ${error?.message || 'Unknown error'}`);
      } finally {
        setSubmitting(false);
      }
    });
  };

  if (hidden) return null;

  return (
    <>
      <Box
        aria-hidden
        sx={{
          position: 'fixed',
          inset: 0,
          zIndex: 999,
          pointerEvents: 'none',
          opacity: open ? 1 : 0,
          transition: 'opacity 220ms ease',
          backdropFilter: open ? 'blur(14px) saturate(170%)' : 'blur(0px)',
          bgcolor: open ? 'rgba(10, 9, 8, 0.22)' : 'transparent',
        }}
      />
      <SpeedDial
        ariaLabel="Quick chat actions"
        sx={{
          position: 'fixed',
          right: { xs: 16, md: 32 },
          bottom: { xs: 'calc(104px + env(safe-area-inset-bottom))', md: 32 },
          zIndex: 1000,
          '& .MuiFab-primary': {
            bgcolor: '#6366F1',
            color: '#000000',
            boxShadow: '0 0 30px rgba(99, 102, 241, 0.4)',
            transition: 'all 0.3s cubic-bezier(0.4, 0, 0.2, 1)',
            '&::before': {
              content: '""',
              position: 'absolute',
              inset: 0,
              borderRadius: '50%',
              background: 'linear-gradient(180deg, rgba(255,255,255,0.2), rgba(255,255,255,0.02))',
              opacity: 0.8,
              pointerEvents: 'none',
            },
            '&:hover': {
              bgcolor: '#00D1DA',
              transform: 'scale(1.1) rotate(90deg)',
              boxShadow: '0 0 50px rgba(99, 102, 241, 0.6)',
            },
          },
          '& .MuiSpeedDialAction-fab': {
            bgcolor: 'rgba(10, 10, 10, 0.72)',
            border: '1px solid rgba(255, 255, 255, 0.12)',
            color: 'rgba(255, 255, 255, 0.78)',
            transition: 'all 0.22s cubic-bezier(0.4, 0, 0.2, 1)',
            backdropFilter: 'blur(16px) saturate(180%)',
            clipPath: 'polygon(18% 0, 100% 0, 82% 100%, 0 100%)',
            borderRadius: '14px',
            boxShadow: '0 16px 40px rgba(0, 0, 0, 0.38)',
            transform: 'skewX(-12deg)',
            '& .MuiSvgIcon-root, svg': {
              transform: 'skewX(12deg)',
            },
            '&:hover': {
              bgcolor: 'rgba(99, 102, 241, 0.14)',
              color: '#6366F1',
              borderColor: '#6366F1',
              transform: 'skewX(-12deg) translateY(-4px)',
            },
            '& .MuiSpeedDialAction-staticTooltipLabel': {
              transform: 'translateY(-1px)',
            },
          },
          '& .MuiSpeedDialAction-fab + .MuiSpeedDialAction-fab': {
            mt: 1,
          },
          '& .MuiSpeedDialAction-staticTooltipLabel': {
            bgcolor: 'rgba(10, 10, 10, 0.88)',
            border: '1px solid rgba(255, 255, 255, 0.12)',
            color: '#fff',
            fontFamily: 'var(--font-satoshi)',
            fontWeight: 700,
            letterSpacing: '0.05em',
            textTransform: 'uppercase',
            fontSize: '0.75rem',
            padding: '6px 12px',
            borderRadius: '10px',
            backdropFilter: 'blur(14px) saturate(180%)',
          },
        }}
        icon={<SpeedDialIcon icon={<Plus size={24} strokeWidth={1.5} />} openIcon={<X size={24} strokeWidth={1.5} />} />}
        open={open}
        onOpen={() => setOpen(true)}
        onClose={() => setOpen(false)}
        direction="up"
        >
        <SpeedDialAction
          icon={<Phone size={20} strokeWidth={1.5} color="#F59E0B" />}
          tooltipTitle="Call"
          tooltipOpen
          onClick={() => {
            setOpen(false);
            router.push('/calls');
          }}
        />
        <SpeedDialAction
          icon={<Users size={20} strokeWidth={1.5} color="#10B981" />}
          tooltipTitle="Group"
          tooltipOpen
          onClick={() => openComposer('group')}
        />
        <SpeedDialAction
          icon={<MessageCircle size={20} strokeWidth={1.5} color="#6366F1" />}
          tooltipTitle="Chat"
          tooltipOpen
          onClick={() => openComposer('chat')}
        />
      </SpeedDial>

      <Dialog
        open={Boolean(mode)}
        onClose={reset}
        fullWidth
        maxWidth="sm"
        fullScreen={isMobile}
        PaperProps={{
          sx: {
            borderRadius: isMobile ? 0 : '24px',
            bgcolor: '#161412',
            border: '1px solid rgba(255, 255, 255, 0.08)',
            backgroundImage: 'none',
          },
        }}
      >
        <DialogTitle sx={{ pb: 1, fontWeight: 900 }}>{title}</DialogTitle>
        <DialogContent sx={{ pt: 1 }}>
          {mode === 'group' && (
            <TextField
              fullWidth
              value={groupName}
              onChange={(e) => setGroupName(e.target.value)}
              placeholder="Group name"
              sx={{ mb: 2 }}
            />
          )}
          <TextField
            fullWidth
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search by name or @username..."
            autoFocus
            sx={{ mb: 2 }}
          />

          {loading && (
            <Typography variant="body2" sx={{ opacity: 0.6, py: 1 }}>
              Searching...
            </Typography>
          )}

          <List sx={{ display: 'flex', flexDirection: 'column', gap: 1 }}>
            {results.map((u) => {
              const id = u.userId || u.$id;
              const checked = selectedUsers.some((item) => (item.userId || item.$id) === id);
              return (
                <Paper
                  key={id}
                  elevation={0}
                  sx={{
                    borderRadius: '18px',
                    bgcolor: checked ? 'rgba(99, 102, 241, 0.08)' : 'rgba(255,255,255,0.02)',
                    border: '1px solid',
                    borderColor: checked ? 'rgba(99, 102, 241, 0.35)' : 'rgba(255,255,255,0.06)',
                  }}
                >
                  <ListItem disablePadding>
                    <ListItemButton
                      onClick={() => {
                        if (mode === 'chat') {
                          void startDirectChat(u);
                          return;
                        }

                        setSelectedUsers((current) => {
                          if (checked) {
                            return current.filter((item) => (item.userId || item.$id) !== id);
                          }
                          return [...current, u];
                        });
                      }}
                      sx={{ py: 1.25, px: 1.5 }}
                    >
                      <ListItemAvatar>
                        <ActionAvatar user={u} />
                      </ListItemAvatar>
                      <ListItemText
                        primary={<Typography sx={{ fontWeight: 800 }}>{u.displayName || u.username || 'Unknown'}</Typography>}
                        secondary={`@${u.username || id.slice(0, 7)}`}
                      />
                      {mode === 'group' && <Checkbox checked={checked} />}
                    </ListItemButton>
                  </ListItem>
                </Paper>
              );
            })}

            {query.trim().length >= 2 && !loading && results.length === 0 && (
              <Box sx={{ py: 4, textAlign: 'center', opacity: 0.6 }}>
                <Typography variant="body2" sx={{ fontWeight: 700 }}>No users found</Typography>
              </Box>
            )}
          </List>

          {mode === 'group' && selectedUsers.length > 0 && (
            <Stack direction="row" spacing={1} useFlexGap flexWrap="wrap" sx={{ mt: 2 }}>
              {selectedUsers.map((u) => (
                <Paper
                  key={u.userId || u.$id}
                  sx={{
                    px: 1.25,
                    py: 0.5,
                    borderRadius: '999px',
                    bgcolor: 'rgba(255,255,255,0.04)',
                    border: '1px solid rgba(255,255,255,0.08)',
                  }}
                >
                  <Typography variant="caption" sx={{ fontWeight: 700 }}>
                    {u.displayName || u.username}
                  </Typography>
                </Paper>
              ))}
            </Stack>
          )}
        </DialogContent>
        <DialogActions sx={{ p: 2 }}>
          <Button onClick={reset} sx={{ color: 'text.secondary' }}>
            Cancel
          </Button>
          {mode === 'group' ? (
            <Button
              onClick={() => void createGroup()}
              variant="contained"
              disabled={submitting || selectedUsers.length === 0}
              sx={{ bgcolor: '#6366F1' }}
            >
              Create Group
            </Button>
          ) : null}
        </DialogActions>
      </Dialog>
    </>
  );
}
