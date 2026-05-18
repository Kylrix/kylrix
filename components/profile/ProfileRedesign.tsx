'use client';

import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  Alert,
  Avatar,
  Box,
  Button,
  ButtonBase,
  Chip,
  CircularProgress,
  Container,
  Divider,
  Paper,
  Skeleton,
  Stack,
  Tab,
  Tabs,
  Typography,
} from '@mui/material';
import {
  BadgeCheck,
  Edit3,
  Flag,
  MessageCircle,
  Repeat2,
  Send,
  Sparkles,
  UserPlus,
  Users,
  RefreshCw,
} from 'lucide-react';
import { usePathname, useRouter, useSearchParams } from 'next/navigation';
import { useAuth } from '@/lib/auth';
import { UsersService } from '@/lib/services/users';
import { SocialService } from '@/lib/services/social';
import { useProfile } from '@/components/providers/ProfileProvider';
import { getCachedIdentityByUsername, seedIdentityCache, subscribeIdentityCache } from '@/lib/identity-cache';
import { getProfileView, stageProfileView } from '@/lib/profile-handoff';
import { IdentityAvatar, IdentityName, computeIdentityFlags } from '../common/IdentityBadge';
import { EditProfileModal } from './EditProfileModal';
import ReportUserDialog from './ReportUserDialog';
import { ActorsListDrawer } from '../social/ActorsListDrawer';
import type { Actor } from '../social/ActorsListDrawer';
import { useTokenOps } from '@/context/TokenOpsContext';
import { useWalletOverlay } from '@/context/WalletOverlayContext';

type TabKey = 'moments' | 'replies' | 'pulses';

interface ProfileProps {
  username?: string;
}

const TAB_KEYS: TabKey[] = ['moments', 'replies', 'pulses'];

const normalizeUsername = (value?: string | null) => {
  if (!value) return null;
  return value.toString().trim().replace(/^@+/, '').toLowerCase().replace(/[^a-z0-9_-]/g, '') || null;
};

const normalizeTab = (value: string | null): TabKey => {
  if (value === 'replies' || value === 'pulses') return value;
  return 'moments';
};

const formatJoinedAt = (value?: string | null) => {
  if (!value) return null;
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return null;
  return new Intl.DateTimeFormat(undefined, { month: 'short', year: 'numeric' }).format(date);
};

const getIdentityLabel = (profile: any) => {
  if (!profile) return 'Profile';
  return profile.displayName || profile.username || 'Anonymous';
};

const getHandle = (profile: any) => {
  if (!profile) return '@unknown';
  return `@${profile.username || 'unknown'}`;
};

function ProfileStatCard({
  label,
  value,
  icon,
  onClick,
  active = false,
}: {
  label: string;
  value: string | number;
  icon: React.ReactNode;
  onClick?: () => void;
  active?: boolean;
}) {
  const card = (
    <Paper
      elevation={0}
      sx={{
        width: '100%',
        p: 1.5,
        borderRadius: 4,
        border: '1px solid rgba(255,255,255,0.06)',
        bgcolor: active ? '#1C1A18' : '#151311',
        transition: 'transform 150ms ease-out, border-color 150ms ease-out, background-color 150ms ease-out',
        '&:hover': {
          borderColor: 'rgba(245, 158, 11, 0.24)',
          bgcolor: '#1B1917',
          transform: 'translateY(-1px)',
        },
      }}
    >
      <Stack direction="row" spacing={1.5} alignItems="center">
        <Box
          sx={{
            width: 40,
            height: 40,
            borderRadius: 3,
            display: 'grid',
            placeItems: 'center',
            bgcolor: '#1F1D1B',
            color: '#F59E0B',
            flexShrink: 0,
          }}
        >
          {icon}
        </Box>
        <Box sx={{ minWidth: 0 }}>
          <Typography sx={{ fontSize: '1.1rem', fontWeight: 900, lineHeight: 1, color: 'var(--foreground)' }}>
            {value}
          </Typography>
          <Typography sx={{ mt: 0.35, fontSize: '0.75rem', letterSpacing: '0.08em', textTransform: 'uppercase', color: 'rgba(255,255,255,0.48)', fontWeight: 800 }}>
            {label}
          </Typography>
        </Box>
      </Stack>
    </Paper>
  );

  if (!onClick) return card;

  return (
    <ButtonBase
      onClick={onClick}
      sx={{
        display: 'block',
        width: '100%',
        borderRadius: 4,
        textAlign: 'left',
        '&.Mui-focusVisible': {
          outline: 'none',
          boxShadow: '0 0 0 2px rgba(245, 158, 11, 0.85)',
        },
      }}
    >
      {card}
    </ButtonBase>
  );
}

function ProfileMomentSkeleton() {
  return (
    <Stack spacing={1.5}>
      {Array.from({ length: 3 }).map((_, index) => (
        <Paper
          key={index}
          elevation={0}
          sx={{
            p: 2.5,
            borderRadius: 4,
            bgcolor: '#151311',
            border: '1px solid rgba(255,255,255,0.06)',
          }}
        >
          <Stack spacing={1.5}>
            <Stack direction="row" spacing={1.5} alignItems="center">
              <Skeleton variant="circular" width={44} height={44} sx={{ bgcolor: 'rgba(255,255,255,0.04)' }} />
              <Box sx={{ flex: 1 }}>
                <Skeleton width="40%" height={22} sx={{ bgcolor: 'rgba(255,255,255,0.04)' }} />
                <Skeleton width="22%" height={18} sx={{ bgcolor: 'rgba(255,255,255,0.04)' }} />
              </Box>
            </Stack>
            <Skeleton variant="rounded" height={72} sx={{ bgcolor: 'rgba(255,255,255,0.04)' }} />
            <Skeleton width="30%" height={16} sx={{ bgcolor: 'rgba(255,255,255,0.04)' }} />
          </Stack>
        </Paper>
      ))}
    </Stack>
  );
}

function EmptyState({
  title,
  body,
  actionLabel,
  onAction,
  icon,
}: {
  title: string;
  body: string;
  actionLabel: string;
  onAction: () => void;
  icon: React.ReactNode;
}) {
  return (
    <Paper
      elevation={0}
      sx={{
        p: { xs: 3, md: 4 },
        borderRadius: 4,
        border: '1px solid rgba(255,255,255,0.06)',
        bgcolor: '#151311',
      }}
    >
      <Stack spacing={2} alignItems="flex-start">
        <Box
          sx={{
            width: 48,
            height: 48,
            borderRadius: 3,
            display: 'grid',
            placeItems: 'center',
            bgcolor: '#1F1D1B',
            color: '#F59E0B',
          }}
        >
          {icon}
        </Box>
        <Box>
          <Typography sx={{ fontSize: '1rem', fontWeight: 900, color: 'var(--foreground)' }}>{title}</Typography>
          <Typography sx={{ mt: 0.5, color: 'rgba(255,255,255,0.64)', lineHeight: 1.7 }}>{body}</Typography>
        </Box>
        <Button
          variant="contained"
          onClick={onAction}
          sx={{
            bgcolor: '#F59E0B',
            color: '#0A0908',
            fontWeight: 800,
            borderRadius: 3,
            px: 2.25,
            textTransform: 'none',
            '&:hover': { bgcolor: '#DBA400' },
          }}
        >
          {actionLabel}
        </Button>
      </Stack>
    </Paper>
  );
}

function MomentCard({
  moment,
  onOpen,
}: {
  moment: any;
  onOpen: () => void;
}) {
  const type = moment?.metadata?.type || 'post';
  const source = moment?.sourceMoment || null;
  const sourceIdentity = source?.creator || {};
  const sourceLabel = sourceIdentity.displayName || sourceIdentity.username || source?.displayName || source?.username || 'someone';
  const sourceHandle = `@${sourceIdentity.username || source?.username || 'unknown'}`;
  const publishedAt = new Date(moment.$createdAt).toLocaleDateString(undefined, {
    month: 'short',
    day: 'numeric',
  });

  const typeLabel = type === 'reply' ? 'Reply' : type === 'pulse' ? 'Pulse' : 'Moment';

  return (
    <ButtonBase
      onClick={onOpen}
      sx={{
        display: 'block',
        width: '100%',
        borderRadius: 4,
        textAlign: 'left',
        '&.Mui-focusVisible': {
          outline: 'none',
          boxShadow: '0 0 0 2px rgba(245, 158, 11, 0.85)',
        },
      }}
    >
      <Paper
        elevation={0}
        sx={{
          p: { xs: 2.25, md: 2.75 },
          borderRadius: 4,
          border: '1px solid rgba(255,255,255,0.06)',
          bgcolor: '#151311',
          transition: 'transform 150ms ease-out, border-color 150ms ease-out, background-color 150ms ease-out',
          '&:hover': {
            borderColor: 'rgba(245, 158, 11, 0.24)',
            bgcolor: '#1B1917',
            transform: 'translateY(-1px)',
          },
        }}
      >
        <Stack spacing={1.5}>
          <Stack direction="row" justifyContent="space-between" alignItems="center" spacing={2}>
            <Stack direction="row" spacing={1.25} alignItems="center" sx={{ minWidth: 0 }}>
              <Avatar
                src={moment?.creator?.avatar || undefined}
                alt={getIdentityLabel(moment?.creator)}
                sx={{ width: 40, height: 40, borderRadius: 2 }}
              >
                {getIdentityLabel(moment?.creator).slice(0, 1).toUpperCase()}
              </Avatar>
              <Box sx={{ minWidth: 0 }}>
                <Stack direction="row" spacing={1} alignItems="center" sx={{ minWidth: 0, flexWrap: 'wrap' }}>
                  <Typography sx={{ fontWeight: 900, color: 'var(--foreground)', lineHeight: 1.1 }}>
                    {getIdentityLabel(moment?.creator)}
                  </Typography>
                  <Chip
                    label={typeLabel}
                    size="small"
                    sx={{
                      height: 24,
                      borderRadius: 999,
                      bgcolor: '#1F1D1B',
                      color: '#F59E0B',
                      fontWeight: 800,
                      letterSpacing: '0.04em',
                    }}
                  />
                </Stack>
                <Typography variant="caption" sx={{ color: 'rgba(255,255,255,0.5)' }}>
                  {source ? `${publishedAt} · ${sourceHandle}` : publishedAt}
                </Typography>
              </Box>
            </Stack>
            <Typography variant="caption" sx={{ color: 'rgba(255,255,255,0.38)', whiteSpace: 'nowrap' }}>
              Open
            </Typography>
          </Stack>

          <Typography sx={{ color: 'rgba(255,255,255,0.88)', lineHeight: 1.8, whiteSpace: 'pre-wrap' }}>
            {moment?.caption || 'No caption'}
          </Typography>

          {source && (
            <Paper
              elevation={0}
              sx={{
                p: 1.5,
                borderRadius: 3,
                bgcolor: '#1A1715',
                border: '1px solid rgba(255,255,255,0.05)',
              }}
            >
              <Stack spacing={0.5}>
                <Typography variant="caption" sx={{ color: 'rgba(255,255,255,0.5)', fontWeight: 800, letterSpacing: '0.08em', textTransform: 'uppercase' }}>
                  {type === 'reply' ? 'Replying to' : 'Pulsed from'}
                </Typography>
                <Typography sx={{ fontWeight: 700, color: 'rgba(255,255,255,0.76)' }}>
                  {sourceLabel} <Box component="span" sx={{ color: 'rgba(255,255,255,0.44)', fontWeight: 600 }}>{sourceHandle}</Box>
                </Typography>
                <Typography sx={{ color: 'rgba(255,255,255,0.62)', lineHeight: 1.7 }}>
                  {source.caption}
                </Typography>
              </Stack>
            </Paper>
          )}

          <Stack direction="row" spacing={2.5} sx={{ color: 'rgba(255,255,255,0.5)' }} flexWrap="wrap">
            <Stack direction="row" spacing={0.75} alignItems="center">
              <Sparkles size={14} aria-hidden="true" />
              <Typography variant="caption" sx={{ fontWeight: 700 }}>
                {moment?.stats?.likes || 0}
              </Typography>
            </Stack>
            <Stack direction="row" spacing={0.75} alignItems="center">
              <MessageCircle size={14} aria-hidden="true" />
              <Typography variant="caption" sx={{ fontWeight: 700 }}>
                {moment?.stats?.replies || 0}
              </Typography>
            </Stack>
            <Stack direction="row" spacing={0.75} alignItems="center">
              <Repeat2 size={14} aria-hidden="true" />
              <Typography variant="caption" sx={{ fontWeight: 700 }}>
                {moment?.stats?.pulses || 0}
              </Typography>
            </Stack>
          </Stack>
        </Stack>
      </Paper>
    </ButtonBase>
  );
}

function TabPanel({
  active,
  loading,
  error,
  items,
  emptyTitle,
  emptyBody,
  emptyActionLabel,
  emptyIcon,
  onEmptyAction,
  onOpenMoment,
}: {
  active: boolean;
  loading: boolean;
  error: string | null;
  items: any[];
  emptyTitle: string;
  emptyBody: string;
  emptyActionLabel: string;
  emptyIcon: React.ReactNode;
  onEmptyAction: () => void;
  onOpenMoment: (momentId: string) => void;
}) {
  if (!active) return null;

  if (loading) return <ProfileMomentSkeleton />;

  if (error) {
    return (
      <Paper
        elevation={0}
        sx={{
          p: { xs: 3, md: 4 },
          borderRadius: 4,
          border: '1px solid rgba(255,255,255,0.06)',
          bgcolor: '#151311',
        }}
      >
        <Stack spacing={2}>
          <Alert
            severity="error"
            icon={<RefreshCw size={18} />}
            sx={{
              bgcolor: '#211714',
              color: '#fff',
              border: '1px solid rgba(239,68,68,0.15)',
            }}
          >
            {error}
          </Alert>
          <Button
            variant="contained"
            onClick={onEmptyAction}
            sx={{
              alignSelf: 'flex-start',
              bgcolor: '#F59E0B',
              color: '#0A0908',
              fontWeight: 800,
              borderRadius: 3,
              px: 2.25,
              textTransform: 'none',
              '&:hover': { bgcolor: '#DBA400' },
            }}
          >
            Try again
          </Button>
        </Stack>
      </Paper>
    );
  }

  if (items.length === 0) {
    return <EmptyState title={emptyTitle} body={emptyBody} actionLabel={emptyActionLabel} onAction={onEmptyAction} icon={emptyIcon} />;
  }

  return (
    <Stack spacing={1.5}>
      {items.map((moment) => (
        <MomentCard key={moment.$id} moment={moment} onOpen={() => onOpenMoment(moment.$id)} />
      ))}
    </Stack>
  );
}

export function ProfileRedesign({ username }: ProfileProps) {
  const { user: currentUser } = useAuth();
  const { profile: myProfile, refreshProfile: refreshMyProfile } = useProfile();
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const normalizedUsername = normalizeUsername(username);
  const preloadedProfile = normalizedUsername ? getProfileView(normalizedUsername)?.profile || null : null;
  const cachedUsernameProfile = normalizedUsername ? getCachedIdentityByUsername(normalizedUsername) : null;

  const [profile, setProfile] = useState<any>(() => preloadedProfile || cachedUsernameProfile);
  const [loading, setLoading] = useState(() => !normalizedUsername || !(preloadedProfile || cachedUsernameProfile));
  const [error, setError] = useState<string | null>(null);
  const [isFollowing, setIsFollowing] = useState(false);
  const [followLoading, setFollowLoading] = useState(false);
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);
  const [isReportModalOpen, setIsReportModalOpen] = useState(false);
  const [refreshNonce, setRefreshNonce] = useState(0);
  const { openTokenUserSearch } = useTokenOps();
  const { openWalletWithIntent } = useWalletOverlay();

  const [moments, setMoments] = useState<any[]>([]);
  const [momentsLoading, setMomentsLoading] = useState(false);
  const [momentsError, setMomentsError] = useState<string | null>(null);
  const [stats, setStats] = useState({ followers: 0, following: 0 });

  const [actorsDrawerOpen, setActorsDrawerOpen] = useState(false);
  const [actorsTitle, setActorsTitle] = useState('');
  const [actorsList, setActorsList] = useState<Actor[]>([]);

  const activeTab = normalizeTab(searchParams.get('tab'));
  const targetUserId = profile?.userId || profile?.$id || null;
  const isOwnProfile = Boolean(currentUser && targetUserId && currentUser.$id === targetUserId);
  const identityFlags = computeIdentityFlags({
    createdAt: profile?.$createdAt || profile?.createdAt || null,
    lastUsernameEdit: profile?.last_username_edit || profile?.preferences?.last_username_edit || null,
    profilePicId: profile?.avatar || profile?.profilePicId || null,
    username: profile?.username || null,
    bio: profile?.bio || null,
    tier: profile?.tier || null,
    publicKey: profile?.publicKey || null,
  });

  const joinedAt = formatJoinedAt(profile?.$createdAt || profile?.createdAt || null);
  const categorized = useMemo(() => {
    const postLike = moments.filter((moment) => {
      const kind = moment?.metadata?.type || 'post';
      return kind === 'post' || kind === 'quote' || !kind;
    });
    const replies = moments.filter((moment) => moment?.metadata?.type === 'reply');
    const pulses = moments.filter((moment) => moment?.metadata?.type === 'pulse');
    return { postLike, replies, pulses };
  }, [moments]);

  const tabCounts = useMemo(
    () => ({
      moments: categorized.postLike.length,
      replies: categorized.replies.length,
      pulses: categorized.pulses.length,
    }),
    [categorized.postLike.length, categorized.pulses.length, categorized.replies.length],
  );

  const pageSearchParams = useMemo(() => new URLSearchParams(searchParams.toString()), [searchParams]);

  const updateTab = useCallback(
    (nextTab: TabKey) => {
      const params = new URLSearchParams(pageSearchParams.toString());
      params.set('tab', nextTab);
      const nextUrl = params.toString() ? `${pathname}?${params.toString()}` : pathname;
      router.replace(nextUrl);
    },
    [pageSearchParams, pathname, router],
  );

  const loadRelatedData = useCallback(
    async (data: any) => {
      if (!data) return;
      const targetId = data.userId || data.$id;
      if (!targetId) return;

      setMomentsLoading(true);
      setMomentsError(null);
      try {
        const [feedRes, followStats, followingStatus] = await Promise.all([
          SocialService.getFeed(currentUser?.$id, targetId),
          SocialService.getFollowStats(targetId),
          currentUser ? SocialService.isFollowing(currentUser.$id, targetId) : Promise.resolve(false),
        ]);

        setMoments(feedRes.rows || []);
        setStats({
          followers: typeof followStats.followers === 'number' ? followStats.followers : 0,
          following: typeof followStats.following === 'number' ? followStats.following : 0,
        });
        setIsFollowing(Boolean(followingStatus));
      } catch (loadErr) {
        console.error('Failed to load profile activity:', loadErr);
        setMoments([]);
        setMomentsError('Could not load this profile activity. Try again.');
      } finally {
        setMomentsLoading(false);
      }
    },
    [currentUser],
  );

  const loadProfile = useCallback(async () => {
    const stagedProfile = normalizedUsername ? (preloadedProfile || cachedUsernameProfile) : null;

    if (stagedProfile) {
      seedIdentityCache(stagedProfile);
      stageProfileView(stagedProfile as any, null);
      setProfile(stagedProfile);
      setError(null);
      setLoading(false);
      void loadRelatedData(stagedProfile);
      return;
    }

    setLoading(true);
    setError(null);
    setMoments([]);
    setMomentsError(null);

    try {
      let data: any = null;
      if (normalizedUsername) {
        data = await UsersService.getProfile(normalizedUsername);
      } else if (currentUser) {
        const synced = await UsersService.forceSyncProfileWithIdentity(currentUser);
        data = synced || (myProfile && myProfile.userId === currentUser.$id ? myProfile : null);
        if (!data) {
          data = await UsersService.ensureProfileForUser(currentUser);
        }
      }

      if (!data) {
        setProfile(null);
        setError(`The user @${username} could not be found.`);
        return;
      }

      seedIdentityCache(data);
      stageProfileView(data, null);
      setProfile((prev: any) => {
        if (
          prev &&
          prev.$id === data.$id &&
          prev.username === data.username &&
          prev.bio === data.bio &&
          prev.displayName === data.displayName &&
          prev.avatar === data.avatar
        ) {
          return prev;
        }
        return data;
      });
      void loadRelatedData(data);
    } catch (loadErr) {
      console.error('Failed to load profile:', loadErr);
      setProfile(null);
      setError('Could not load this profile right now.');
    } finally {
      setLoading(false);
    }
  }, [cachedUsernameProfile, currentUser, loadRelatedData, myProfile, normalizedUsername, preloadedProfile, username]);

  useEffect(() => {
    loadProfile();
  }, [loadProfile, refreshNonce]);

  useEffect(() => {
    if (!normalizedUsername) return;

    const unsubscribe = subscribeIdentityCache((identity) => {
      if (identity.username !== normalizedUsername) return;
      setProfile((prev: any) => {
        if (
          prev &&
          prev.$id === identity.$id &&
          prev.username === identity.username &&
          prev.bio === identity.bio &&
          prev.displayName === identity.displayName &&
          prev.avatar === identity.avatar &&
          JSON.stringify(prev.socialStats) === JSON.stringify(identity.socialStats)
        ) {
          return prev;
        }
        return identity;
      });
    });

    return () => unsubscribe();
  }, [normalizedUsername]);

  const categorizedByTab = useMemo(
    () => ({
      moments: categorized.postLike,
      replies: categorized.replies,
      pulses: categorized.pulses,
    }),
    [categorized.postLike, categorized.pulses, categorized.replies],
  );

  const handleRetry = () => setRefreshNonce((value) => value + 1);

  const handleFollow = async () => {
    if (!currentUser || !profile || !targetUserId) return;
    setFollowLoading(true);
    try {
      if (isFollowing) {
        await SocialService.unfollowUser(currentUser.$id, targetUserId);
        setIsFollowing(false);
      } else {
        await SocialService.followUser(currentUser.$id, targetUserId);
        setIsFollowing(true);
      }

      try {
        const newStats = await SocialService.getFollowStats(targetUserId);
        setStats({
          followers: newStats.followers,
          following: newStats.following,
        });
      } catch (statsErr) {
        console.warn('Failed to refresh follow stats', statsErr);
      }
    } catch (followErr) {
      console.error('Follow operation failed:', followErr);
    } finally {
      setFollowLoading(false);
    }
  };

  const handleOpenFollowers = async () => {
    if (!targetUserId) return;
    setActorsTitle('Followers');
    setActorsDrawerOpen(true);
    setActorsList([]);
    const followers = await SocialService.getFollowers(targetUserId, currentUser?.$id);
    setActorsList(followers as unknown as Actor[]);
  };

  const handleOpenFollowing = async () => {
    if (!targetUserId) return;
    setActorsTitle('Following');
    setActorsDrawerOpen(true);
    setActorsList([]);
    const following = await SocialService.getFollowing(targetUserId, currentUser?.$id);
    setActorsList(following as unknown as Actor[]);
  };

  const handleActorAction = async (actor: Actor, type: 'follow' | 'unfollow') => {
    if (!currentUser || !targetUserId) return;
    const actorId = actor.userId || actor.$id;
    if (type === 'follow') {
      await SocialService.followUser(currentUser.$id, actorId);
    } else {
      await SocialService.unfollowUser(currentUser.$id, actorId);
    }

    setActorsList((prev) =>
      prev.map((item) =>
        item.$id === actor.$id || item.userId === actor.userId ? { ...item, isFollowing: type === 'follow' } : item,
      ),
    );

    if (actorId === targetUserId) {
      setIsFollowing(type === 'follow');
    }

    const newStats = await SocialService.getFollowStats(targetUserId);
    setStats({
      followers: newStats.followers,
      following: newStats.following,
    });
  };

  const handleMessage = () => {
    if (!targetUserId) return;
    router.push(`/connect/chats?userId=${targetUserId}`);
  };

  const handleTip = () => {
    if (!currentUser || !profile || !targetUserId) return;
    openWalletWithIntent({
      mode: 'send',
      toUser: {
        id: String(targetUserId),
        username: String(profile.username || ''),
        displayName: String(profile.displayName || profile.username || 'User'),
      },
    });
  };

  const handleRequest = () => {
    if (!currentUser || !profile || !targetUserId) return;
    openTokenUserSearch({
      mode: 'request',
      fromUserId: currentUser.$id,
      source: 'profile_request',
      preselectedUser: {
        id: String(targetUserId),
        username: String(profile.username || ''),
        displayName: String(profile.displayName || profile.username || 'User'),
      },
    });
  };

  const profileCardLoading = loading && !profile;

  if (profileCardLoading) {
    return (
      <Container maxWidth="xl" sx={{ py: { xs: 2, md: 4 }, px: { xs: 0, md: 2 } }}>
        <Stack spacing={2.5}>
          <Paper
            elevation={0}
            sx={{
              p: { xs: 2.5, md: 4 },
              borderRadius: 5,
              bgcolor: '#151311',
              border: '1px solid rgba(255,255,255,0.06)',
            }}
          >
            <Stack direction={{ xs: 'column', lg: 'row' }} spacing={3}>
              <Skeleton variant="rounded" width={140} height={140} sx={{ borderRadius: 4, bgcolor: 'rgba(255,255,255,0.04)' }} />
              <Stack spacing={1.5} sx={{ flex: 1 }}>
                <Skeleton width="38%" height={36} sx={{ bgcolor: 'rgba(255,255,255,0.04)' }} />
                <Skeleton width="20%" height={22} sx={{ bgcolor: 'rgba(255,255,255,0.04)' }} />
                <Skeleton width="80%" height={22} sx={{ bgcolor: 'rgba(255,255,255,0.04)' }} />
                <Skeleton width="66%" height={22} sx={{ bgcolor: 'rgba(255,255,255,0.04)' }} />
                <Stack direction="row" spacing={1.25}>
                  <Skeleton width={96} height={42} sx={{ bgcolor: 'rgba(255,255,255,0.04)' }} />
                  <Skeleton width={96} height={42} sx={{ bgcolor: 'rgba(255,255,255,0.04)' }} />
                  <Skeleton width={96} height={42} sx={{ bgcolor: 'rgba(255,255,255,0.04)' }} />
                </Stack>
              </Stack>
            </Stack>
          </Paper>
          <ProfileMomentSkeleton />
        </Stack>
      </Container>
    );
  }

  if (!profile) {
    return (
      <Container maxWidth="xl" sx={{ py: { xs: 2, md: 4 }, px: { xs: 0, md: 2 } }}>
        <Paper
          elevation={0}
          sx={{
            p: { xs: 3, md: 5 },
            borderRadius: 5,
            bgcolor: '#151311',
            border: '1px solid rgba(255,255,255,0.06)',
          }}
        >
          <Stack spacing={2.5} alignItems="flex-start">
            <Box
              sx={{
                width: 56,
                height: 56,
                borderRadius: 3,
                display: 'grid',
                placeItems: 'center',
                bgcolor: '#1F1D1B',
                color: '#F59E0B',
              }}
            >
              <Users size={24} aria-hidden="true" />
            </Box>
            <Box>
              <Typography variant="h4" sx={{ fontWeight: 900, color: 'var(--foreground)', fontFamily: 'var(--font-clash)' }}>
                {error ? 'Profile unavailable' : 'Profile not found'}
              </Typography>
              <Typography sx={{ mt: 0.75, color: 'rgba(255,255,255,0.64)', lineHeight: 1.7 }}>
                {error || `The user @${username} does not exist in this ecosystem.`}
              </Typography>
            </Box>
            <Stack direction={{ xs: 'column', sm: 'row' }} spacing={1.5}>
              <Button
                variant="contained"
                onClick={() => router.push('/connect')}
                sx={{
                  bgcolor: '#F59E0B',
                  color: '#0A0908',
                  fontWeight: 800,
                  borderRadius: 3,
                  px: 2.25,
                  textTransform: 'none',
                  '&:hover': { bgcolor: '#DBA400' },
                }}
              >
                Back to Connect
              </Button>
              <Button
                variant="outlined"
                onClick={handleRetry}
                sx={{
                  borderColor: 'rgba(255,255,255,0.12)',
                  color: 'rgba(255,255,255,0.82)',
                  fontWeight: 800,
                  borderRadius: 3,
                  px: 2.25,
                  textTransform: 'none',
                }}
              >
                Try again
              </Button>
            </Stack>
          </Stack>
        </Paper>
      </Container>
    );
  }

  return (
    <Container maxWidth="xl" sx={{ py: { xs: 2, md: 4 }, px: { xs: 0, md: 2 } }}>
      <Box sx={{ display: 'flex', flexDirection: 'column', gap: 3 }}>
        <Paper
          elevation={0}
          sx={{
            p: { xs: 2.5, md: 4 },
            borderRadius: 5,
            bgcolor: '#151311',
            border: '1px solid rgba(255,255,255,0.06)',
          }}
        >
          <Stack direction={{ xs: 'column', lg: 'row' }} spacing={3} alignItems="stretch">
            <Box sx={{ width: { lg: 320 }, flexShrink: 0 }}>
              <Stack spacing={2.25} alignItems={{ xs: 'center', lg: 'flex-start' }}>
                <Box sx={{ position: 'relative' }}>
                  <IdentityAvatar
                    fileId={profile?.avatar}
                    alt={getIdentityLabel(profile)}
                    fallback={getIdentityLabel(profile).slice(0, 1).toUpperCase()}
                    verified={identityFlags.verified}
                    pro={identityFlags.pro}
                    size={132}
                    verifiedSize={22}
                    borderRadius="28px"
                  />
                </Box>
                <Box sx={{ textAlign: { xs: 'center', lg: 'left' } }}>
                  <Stack direction="row" spacing={1} alignItems="center" justifyContent={{ xs: 'center', lg: 'flex-start' }} flexWrap="wrap">
                    <IdentityName verified={identityFlags.verified} sx={{ fontSize: '1.8rem', fontWeight: 900, letterSpacing: '-0.04em' }}>
                      {getIdentityLabel(profile)}
                    </IdentityName>
                    {isOwnProfile && (
                      <Chip
                        label="Your profile"
                        size="small"
                        sx={{
                          height: 24,
                          borderRadius: 999,
                          bgcolor: '#1F1D1B',
                          color: '#F59E0B',
                          fontWeight: 800,
                        }}
                      />
                    )}
                  </Stack>
                  <Typography sx={{ mt: 0.5, color: 'rgba(255,255,255,0.52)', fontFamily: 'var(--font-mono)', letterSpacing: '0.02em' }}>
                    {getHandle(profile)}
                  </Typography>
                  {joinedAt && (
                    <Typography sx={{ mt: 1, color: 'rgba(255,255,255,0.42)', fontSize: '0.8rem' }}>
                      Joined {joinedAt}
                    </Typography>
                  )}
                </Box>

                {profile.bio && (
                  <Typography
                    sx={{
                      color: 'rgba(255,255,255,0.76)',
                      lineHeight: 1.75,
                      textAlign: { xs: 'center', lg: 'left' },
                    }}
                  >
                    {profile.bio}
                  </Typography>
                )}

                <Stack direction="row" spacing={1} flexWrap="wrap" justifyContent={{ xs: 'center', lg: 'flex-start' }}>
                  {identityFlags.verified && (
                    <Chip
                      label="Verified"
                      size="small"
                      icon={<BadgeCheck size={14} />}
                      sx={{
                        bgcolor: '#1F1D1B',
                        color: '#F59E0B',
                        borderRadius: 999,
                        fontWeight: 800,
                      }}
                    />
                  )}
                  {identityFlags.pro && (
                    <Chip
                      label="Pro"
                      size="small"
                      sx={{
                        bgcolor: '#1F1D1B',
                        color: '#fff',
                        borderRadius: 999,
                        fontWeight: 800,
                      }}
                    />
                  )}
                </Stack>
              </Stack>
            </Box>

            <Box sx={{ flex: 1 }}>
              <Stack spacing={2.25}>
                <Stack direction={{ xs: 'column', sm: 'row' }} spacing={1.25} flexWrap="wrap">
                  {isOwnProfile ? (
                    <Button
                      variant="contained"
                      startIcon={<Edit3 size={16} />}
                      onClick={() => setIsEditModalOpen(true)}
                      sx={{
                        bgcolor: '#F59E0B',
                        color: '#0A0908',
                        fontWeight: 800,
                        borderRadius: 3,
                        px: 2.25,
                        py: 1,
                        minHeight: 44,
                        textTransform: 'none',
                        '&:hover': { bgcolor: '#DBA400' },
                      }}
                    >
                      Edit profile
                    </Button>
                  ) : (
                    <>
                      <Button
                        variant={isFollowing ? 'outlined' : 'contained'}
                        startIcon={<UserPlus size={16} />}
                        onClick={handleFollow}
                        disabled={followLoading || !currentUser}
                        sx={{
                          bgcolor: isFollowing ? 'transparent' : '#F59E0B',
                          color: isFollowing ? '#F59E0B' : '#0A0908',
                          borderColor: '#F59E0B',
                          fontWeight: 800,
                          borderRadius: 3,
                          px: 2.25,
                          py: 1,
                          minHeight: 44,
                          textTransform: 'none',
                          '&:hover': {
                            bgcolor: isFollowing ? '#1B1917' : '#DBA400',
                            borderColor: '#F59E0B',
                          },
                        }}
                      >
                        {followLoading ? 'Updating...' : isFollowing ? 'Following' : 'Follow'}
                      </Button>
                      <Button
                        variant="outlined"
                        startIcon={<Send size={16} />}
                        onClick={handleMessage}
                        disabled={!currentUser}
                        sx={{
                          borderColor: 'rgba(255,255,255,0.12)',
                          color: 'rgba(255,255,255,0.84)',
                          fontWeight: 800,
                          borderRadius: 3,
                          px: 2.25,
                          py: 1,
                          minHeight: 44,
                          textTransform: 'none',
                        }}
                      >
                        Message
                      </Button>
                      <Button
                        variant="outlined"
                        onClick={handleTip}
                        disabled={!currentUser}
                        sx={{
                          borderColor: 'rgba(255,255,255,0.12)',
                          color: 'rgba(255,255,255,0.84)',
                          fontWeight: 800,
                          borderRadius: 3,
                          px: 2.25,
                          py: 1,
                          minHeight: 44,
                          textTransform: 'none',
                        }}
                      >
                        Tip
                      </Button>
                      <Button
                        variant="outlined"
                        startIcon={<Flag size={16} />}
                        onClick={() => setIsReportModalOpen(true)}
                        disabled={!currentUser}
                        sx={{
                          borderColor: 'rgba(239,68,68,0.35)',
                          color: 'rgba(239,68,68,0.9)',
                          fontWeight: 800,
                          borderRadius: 3,
                          px: 2.25,
                          py: 1,
                          minHeight: 44,
                          textTransform: 'none',
                          '&:hover': {
                            borderColor: 'rgba(239,68,68,0.75)',
                            bgcolor: '#221615',
                          },
                        }}
                      >
                        Report
                      </Button>
                    </>
                  )}
                </Stack>

                <Box
                  sx={{
                    display: 'grid',
                    gridTemplateColumns: { xs: 'repeat(2, minmax(0, 1fr))', md: 'repeat(5, minmax(0, 1fr))' },
                    gap: 1.25,
                  }}
                >
                  <ProfileStatCard label="Moments" value={categorizedByTab.moments.length} icon={<Sparkles size={16} />} onClick={() => updateTab('moments')} active={activeTab === 'moments'} />
                  <ProfileStatCard label="Replies" value={categorizedByTab.replies.length} icon={<MessageCircle size={16} />} onClick={() => updateTab('replies')} active={activeTab === 'replies'} />
                  <ProfileStatCard label="Pulses" value={categorizedByTab.pulses.length} icon={<Repeat2 size={16} />} onClick={() => updateTab('pulses')} active={activeTab === 'pulses'} />
                  <ProfileStatCard label="Followers" value={stats.followers} icon={<Users size={16} />} onClick={handleOpenFollowers} />
                  <ProfileStatCard label="Following" value={stats.following} icon={<Users size={16} />} onClick={handleOpenFollowing} />
                </Box>

                {!currentUser && !isOwnProfile && (
                  <Typography sx={{ color: 'rgba(255,255,255,0.48)', fontSize: '0.85rem' }}>
                    Sign in to follow, message, tip, or report.
                  </Typography>
                )}
              </Stack>
            </Box>
          </Stack>
        </Paper>

        <Paper
          elevation={0}
          sx={{
            borderRadius: 5,
            bgcolor: '#151311',
            border: '1px solid rgba(255,255,255,0.06)',
            overflow: 'hidden',
          }}
        >
          <Box sx={{ px: { xs: 1, md: 2 }, pt: 1 }}>
            <Tabs
              value={activeTab}
              onChange={(_, value) => updateTab(value)}
              variant="scrollable"
              allowScrollButtonsMobile
              textColor="inherit"
              TabIndicatorProps={{ sx: { backgroundColor: '#F59E0B', height: 3, borderRadius: 999 } }}
              sx={{
                minHeight: 60,
                '& .MuiTab-root': {
                  minHeight: 60,
                  textTransform: 'none',
                  color: 'rgba(255,255,255,0.58)',
                  fontWeight: 800,
                  letterSpacing: '0.01em',
                },
                '& .Mui-selected': {
                  color: '#fff',
                },
              }}
            >
              {TAB_KEYS.map((tabKey) => {
                const labels = {
                  moments: { label: 'Moments', count: tabCounts.moments },
                  replies: { label: 'Replies', count: tabCounts.replies },
                  pulses: { label: 'Pulses', count: tabCounts.pulses },
                }[tabKey];
                const iconMap = {
                  moments: <Sparkles size={16} />,
                  replies: <MessageCircle size={16} />,
                  pulses: <Repeat2 size={16} />,
                };

                return (
                  <Tab
                    key={tabKey}
                    value={tabKey}
                    icon={iconMap[tabKey]}
                    iconPosition="start"
                    label={
                      <Stack direction="row" spacing={1} alignItems="center">
                        <span>{labels.label}</span>
                        <Box
                          component="span"
                          sx={{
                            px: 1,
                            py: 0.25,
                            borderRadius: 999,
                            bgcolor: '#1F1D1B',
                            color: 'rgba(255,255,255,0.72)',
                            fontSize: '0.72rem',
                            fontWeight: 800,
                            lineHeight: 1,
                          }}
                        >
                          {labels.count}
                        </Box>
                      </Stack>
                    }
                  />
                );
              })}
            </Tabs>
          </Box>
          <Divider sx={{ borderColor: 'rgba(255,255,255,0.06)' }} />
          <Box sx={{ p: { xs: 2, md: 3 } }}>
            <TabPanel
              active={activeTab === 'moments'}
              loading={momentsLoading}
              error={momentsError}
              items={categorizedByTab.moments}
              emptyTitle="No moments yet"
              emptyBody={isOwnProfile ? 'Your first post, quote, or update will appear here.' : 'This profile has not shared any moments yet.'}
              emptyActionLabel="Explore Connect"
              emptyIcon={<Sparkles size={20} />}
              onEmptyAction={() => router.push('/connect')}
              onOpenMoment={(momentId) => router.push(`/connect/post/${momentId}`)}
            />
            <TabPanel
              active={activeTab === 'replies'}
              loading={momentsLoading}
              error={momentsError}
              items={categorizedByTab.replies}
              emptyTitle="No replies yet"
              emptyBody="Replies and thread comments from this user will land here."
              emptyActionLabel="Back to moments"
              emptyIcon={<MessageCircle size={20} />}
              onEmptyAction={() => updateTab('moments')}
              onOpenMoment={(momentId) => router.push(`/connect/post/${momentId}`)}
            />
            <TabPanel
              active={activeTab === 'pulses'}
              loading={momentsLoading}
              error={momentsError}
              items={categorizedByTab.pulses}
              emptyTitle="No pulses yet"
              emptyBody="Boosts and repost-style pulses will appear here once this user starts sharing them."
              emptyActionLabel="Back to moments"
              emptyIcon={<Repeat2 size={20} />}
              onEmptyAction={() => updateTab('moments')}
              onOpenMoment={(momentId) => router.push(`/connect/post/${momentId}`)}
            />
          </Box>
        </Paper>
      </Box>

      {!isOwnProfile && targetUserId && (
        <ReportUserDialog
          open={isReportModalOpen}
          onClose={() => setIsReportModalOpen(false)}
          targetUserId={targetUserId}
          targetUsername={profile.username}
          contextType="profile"
          contextId={profile.$id}
          contextUrl={typeof window !== 'undefined' ? window.location.href : null}
          sourceApp="kylrix"
        />
      )}

      <EditProfileModal
        open={isEditModalOpen}
        onClose={() => setIsEditModalOpen(false)}
        profile={profile}
        onUpdate={() => {
          refreshMyProfile();
          loadProfile();
        }}
      />

      <ActorsListDrawer
        open={actorsDrawerOpen}
        onClose={() => setActorsDrawerOpen(false)}
        title={actorsTitle}
        actors={actorsList}
        onSelect={(actor) => {
          setActorsDrawerOpen(false);
          router.push(`/u/${actor.username}`);
        }}
        onAction={handleActorAction}
      />
    </Container>
  );
}

export const Profile = ProfileRedesign;
