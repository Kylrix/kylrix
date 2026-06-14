'use client';

import React, { useCallback, useEffect, useMemo, useState, useRef } from 'react';
import {
  Sparkles,
  MessageCircle,
  Repeat2,
  Edit3,
  UserPlus,
  Send,
  Flag,
  Users,
  RefreshCw,
  Calendar,
  Lock,
  Globe,
  ArrowLeft,
  ShieldCheck,
  Zap
} from 'lucide-react';
import { useRouter, useSearchParams, usePathname } from 'next/navigation';
import { useAuth } from '@/lib/auth';
import { UsersService } from '@/lib/services/users';
import { SocialService } from '@/lib/services/social';
import { useProfile } from '@/components/providers/ProfileProvider';
import { getCachedIdentityByUsername, seedIdentityCache, subscribeIdentityCache } from '@/lib/identity-cache';
import { getProfileView, stageProfileView } from '@/lib/profile-handoff';
import { IdentityAvatar, computeIdentityFlags } from '../common/IdentityBadge';
import { EditProfileModal } from './EditProfileModal';
import ReportUserDialog from './ReportUserDialog';
import { ActorsListDrawer } from '../social/ActorsListDrawer';
import type { Actor } from '../social/ActorsListDrawer';
import { useTokenOps } from '@/context/TokenOpsContext';
import { useWalletOverlay } from '@/context/WalletOverlayContext';
import { toast } from 'react-hot-toast';
import { hasPaidKylrixPlan } from '@/lib/utils';

type TabKey = 'moments' | 'replies' | 'pulses';

interface ProfileProps {
  username: string;
  initialProfile?: any;
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

export function ProfileRedesign({ username, initialProfile }: ProfileProps) {
  const { user: currentUser } = useAuth();
  const { profile: myProfile, refreshProfile: refreshMyProfile } = useProfile();
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();

  const normalizedUsername = normalizeUsername(username);
  const preloadedProfile = useMemo(() => {
    return normalizedUsername ? getProfileView(normalizedUsername)?.profile || null : null;
  }, [normalizedUsername]);
  const cachedUsernameProfile = useMemo(() => {
    return normalizedUsername ? getCachedIdentityByUsername(normalizedUsername) : null;
  }, [normalizedUsername]);

  const [profile, setProfile] = useState<any>(() => initialProfile || preloadedProfile || cachedUsernameProfile);
  const [loading, setLoading] = useState(() => !normalizedUsername || !(initialProfile || preloadedProfile || cachedUsernameProfile));
  const [error, setError] = useState<string | null>(null);
  const [isFollowing, setIsFollowing] = useState(false);
  const [followLoading, setFollowLoading] = useState(false);
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);
  const [isReportModalOpen, setIsReportModalOpen] = useState(false);
  const [refreshNonce, setRefreshNonce] = useState(0);
  const debounceTimerRef = useRef<NodeJS.Timeout | null>(null);
  const { openTokenUserSearch } = useTokenOps();
  const { openWalletWithIntent } = useWalletOverlay();

  const [moments, setMoments] = useState<any[]>([]);
  const [momentsLoading, setMomentsLoading] = useState(false);
  const [momentsError, setMomentsError] = useState<string | null>(null);
  const [stats, setStats] = useState({ followers: 0, following: 0 });

  const [actorsDrawerOpen, setActorsDrawerOpen] = useState(false);
  const [actorsTitle, setActorsTitle] = useState('');
  const [actorsList, setActorsList] = useState<Actor[]>([]);

  const tabParam = searchParams.get('tab');
  const [selectedTab, setSelectedTab] = useState<TabKey>(() => normalizeTab(tabParam));
  const targetUserId = profile?.userId || profile?.$id || null;
  const isOwnProfile = useMemo(() => {
    if (!currentUser?.$id || !targetUserId) return false;
    return currentUser.$id === targetUserId;
  }, [currentUser?.$id, targetUserId]);

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
    const momentsList = moments.filter((moment) => {
      const kind = moment?.metadata?.type || 'post';
      return kind === 'post' || kind === 'quote' || !kind;
    });
    const replies = moments.filter((moment) => moment?.metadata?.type === 'reply');
    const pulses = moments.filter((moment) => moment?.metadata?.type === 'pulse');
    return { moments: momentsList, replies, pulses };
  }, [moments]);

  const tabCounts = useMemo(
    () => ({
      moments: categorized.moments.length,
      replies: categorized.replies.length,
      pulses: categorized.pulses.length,
    }),
    [categorized.moments.length, categorized.pulses.length, categorized.replies.length],
  );

  useEffect(() => {
    setSelectedTab(normalizeTab(tabParam));
  }, [tabParam]);

  const updateTab = useCallback(
    (nextTab: TabKey) => {
      setSelectedTab(nextTab);
      const params = new URLSearchParams(searchParams.toString());
      params.set('tab', nextTab);
      const nextUrl = params.toString() ? `${pathname}?${params.toString()}` : pathname;
      router.replace(nextUrl, { scroll: false });
    },
    [pathname, router, searchParams],
  );

  const currentUserId = currentUser?.$id;
  const myProfileId = myProfile?.$id;

  const loadRelatedData = useCallback(
    async (data: any) => {
      if (!data) return;
      const targetId = data.userId || data.$id;
      if (!targetId) return;

      setMomentsLoading(true);
      setMomentsError(null);
      try {
        const [feedRes, followStats, followingStatus] = await Promise.all([
          SocialService.getFeed(currentUserId, targetId),
          SocialService.getFollowStats(targetId),
          currentUserId ? SocialService.isFollowing(currentUserId, targetId) : Promise.resolve(false)
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
        setMomentsError('Could not load activity feed.');
      } finally {
        setMomentsLoading(false);
      }
    },
    [currentUserId],
  );

  const loadProfile = useCallback(async () => {
    const stagedProfile = normalizedUsername ? (preloadedProfile || cachedUsernameProfile) : null;

    if (stagedProfile) {
      seedIdentityCache(stagedProfile);
      stageProfileView(stagedProfile as any, null);
      setProfile((prev: any) => {
        if (prev && prev.$id === stagedProfile.$id && prev.username === stagedProfile.username && prev.displayName === stagedProfile.displayName && prev.bio === stagedProfile.bio && prev.avatar === stagedProfile.avatar) {
          return prev;
        }
        return stagedProfile;
      });
      setError(null);
      void loadRelatedData(stagedProfile);
    } else {
      setLoading(true);
    }

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
        if (!stagedProfile) {
          setProfile(null);
          setError(`The user @${username} could not be found.`);
        }
        return;
      }

      seedIdentityCache(data);
      stageProfileView(data, null);
      setProfile((prev: any) => {
        if (prev && prev.$id === data.$id && prev.username === data.username && prev.displayName === data.displayName && prev.bio === data.bio && prev.avatar === data.avatar) {
          return prev;
        }
        return data;
      });
      void loadRelatedData(data);
    } catch (loadErr) {
      console.error('Failed to load profile:', loadErr);
      if (!stagedProfile) {
        setProfile(null);
        setError('Could not load this profile right now.');
      }
    } finally {
      setLoading(false);
    }
  }, [cachedUsernameProfile, loadRelatedData, normalizedUsername, preloadedProfile, username, currentUserId, myProfileId]);

  useEffect(() => {
    loadProfile();
  }, [loadProfile, refreshNonce]);

  useEffect(() => {
    if (loading || !profile || !isOwnProfile) return;
    const isPro = currentUser ? hasPaidKylrixPlan(currentUser) : false;
    if (!isPro) {
      toast('Upgrade to Kylrix Pro to unlock unlimited collaboration, E2EE identity publication, and customization!', {
        icon: '💎',
        duration: 5000,
        id: 'pro-upgrade-toast'
      });
    }
  }, [loading, profile, isOwnProfile, currentUser]);

  useEffect(() => {
    if (!normalizedUsername) return;

    const unsubscribe = subscribeIdentityCache((identity) => {
      if (identity.username !== normalizedUsername) return;

      if (debounceTimerRef.current) clearTimeout(debounceTimerRef.current);

      debounceTimerRef.current = setTimeout(() => {
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
      }, 50);
    });

    return () => {
      if (debounceTimerRef.current) clearTimeout(debounceTimerRef.current);
      unsubscribe();
    };
  }, [normalizedUsername]);

  const handleRetry = () => setRefreshNonce((value) => value + 1);

  const handleFollow = async () => {
    if (!currentUser || !profile) return;
    const actualTargetId = profile.userId || profile.$id;
    if (!actualTargetId) return;

    setFollowLoading(true);
    try {
      if (isFollowing) {
        await SocialService.unfollowUser(currentUser.$id, actualTargetId);
        setIsFollowing(false);
        toast.success(`Unfollowed @${profile.username}`);
      } else {
        await SocialService.followUser(currentUser.$id, actualTargetId);
        setIsFollowing(true);
        toast.success(`Following @${profile.username}`);
      }

      const newStats = await SocialService.getFollowStats(actualTargetId);
      setStats({
        followers: newStats.followers,
        following: newStats.following,
      });
    } catch (followErr: any) {
      console.error('Follow operation failed:', followErr);
      toast.error(followErr?.message || 'Follow action failed');
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

  const handleActorAction = async (actor: Actor, action: 'follow' | 'unfollow') => {
    if (!currentUser) return;
    try {
      if (action === 'follow') {
        await SocialService.followUser(currentUser.$id, actor.userId);
        toast.success(`Following @${actor.username}`);
      } else {
        await SocialService.unfollowUser(currentUser.$id, actor.userId);
        toast.success(`Unfollowed @actor.username`);
      }
      if (targetUserId) {
        const [statsUpdate, listUpdate] = await Promise.all([
          SocialService.getFollowStats(targetUserId),
          actorsTitle === 'Followers'
            ? SocialService.getFollowers(targetUserId, currentUser.$id)
            : SocialService.getFollowing(targetUserId, currentUser.$id),
        ]);
        setStats({ followers: statsUpdate.followers, following: statsUpdate.following });
        setActorsList(listUpdate as unknown as Actor[]);
      }
    } catch (err) {
      console.error('Failed to perform follow action inside list drawer:', err);
    }
  };

  const handleMessage = () => {
    if (!profile?.username) return;
    router.push(`/connect/chat/${profile.userId || profile.$id}`);
  };

  const handleTip = () => {
    if (!profile) return;
    openWalletWithIntent?.({
      type: 'send',
      recipientId: profile.userId || profile.$id,
      recipientUsername: profile.username,
      recipientName: profile.displayName,
    });
  };

  if (loading) {
    return (
      <div className="max-w-7xl mx-auto px-4 py-8 flex flex-col gap-6 animate-pulse">
        <div className="h-48 bg-white/5 rounded-[24px] border border-white/8" />
        <div className="flex flex-col md:flex-row gap-6">
          <div className="w-full md:w-80 h-96 bg-white/5 rounded-[24px] border border-white/8" />
          <div className="flex-1 h-96 bg-white/5 rounded-[24px] border border-white/8" />
        </div>
      </div>
    );
  }

  if (error || !profile) {
    return (
      <div className="max-w-3xl mx-auto px-4 py-12">
        <div className="bg-[#151311] border border-white/8 rounded-[24px] p-8 flex flex-col gap-6">
          <div>
            <h2 className="text-white text-xl font-black tracking-tight">Profile Not Found</h2>
            <p className="text-white/60 text-sm mt-1">{error || `The user @${username} does not exist.`}</p>
          </div>
          <div className="flex gap-3">
            <button
              onClick={() => router.push('/connect')}
              className="py-2.5 px-6 rounded-xl bg-[#F59E0B] text-black font-extrabold text-sm transition-all hover:bg-[#DBA400]"
            >
              Back to Connect
            </button>
            <button
              onClick={handleRetry}
              className="py-2.5 px-6 rounded-xl border border-white/8 text-white/80 hover:text-white font-extrabold text-sm transition-all"
            >
              Try again
            </button>
          </div>
        </div>
      </div>
    );
  }

  const tabMeta = {
    moments: {
      title: 'Moments',
      description: 'Original thoughts, quotes, and signals.',
      emptyTitle: 'No moments yet',
      emptyBody: isOwnProfile ? 'Your first post will show up here.' : 'Nothing shared yet.',
      emptyIcon: <Sparkles size={20} />,
    },
    replies: {
      title: 'Replies',
      description: 'Public responses and discussions.',
      emptyTitle: 'No replies yet',
      emptyBody: 'Conversations and feedback will land here.',
      emptyIcon: <MessageCircle size={20} />,
    },
    pulses: {
      title: 'Pulses',
      description: 'Pulse bursts and boosts shared by this profile.',
      emptyTitle: 'No pulses yet',
      emptyBody: 'Republished posts will appear here.',
      emptyIcon: <Repeat2 size={20} />,
    },
  };

  const activeTabMeta = tabMeta[selectedTab];
  const activeTabItems = categorized[selectedTab];

  return (
    <div className="max-w-7xl mx-auto px-4 py-4 md:py-8 space-y-6">
      {/* Top Header Actions */}
      <div className="flex items-center justify-between gap-4">
        <button 
          onClick={() => router.back()}
          className="p-2.5 rounded-xl bg-white/2 hover:bg-white/5 text-white/50 hover:text-white transition-all border border-white/5 group flex items-center gap-2"
          title="Go Back"
        >
          <ArrowLeft size={18} className="transition-transform group-hover:-translate-x-0.5" />
          <span className="text-xs font-black uppercase tracking-wider pr-1">Back</span>
        </button>

        {isOwnProfile && (
          <div className="flex items-center gap-2 px-3 py-1.5 rounded-full bg-[#6366F1]/5 border border-[#6366F1]/20 text-[#6366F1]">
            <ShieldCheck size={14} />
            <span className="text-[10px] font-black uppercase tracking-widest leading-none">Your Private View</span>
          </div>
        )}
      </div>

      {/* Premium Profile Banner Header */}
      <div className="relative h-36 md:h-44 w-full rounded-[24px] overflow-hidden border border-white/8 bg-gradient-to-r from-[#6366F1]/40 via-[#FBBF24]/20 to-[#6366F1]/30">
        <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_top_right,_var(--tw-gradient-stops))] from-white/10 via-transparent to-transparent" />
      </div>

      {/* Floating Header Actions / Info details Card */}
      <div className="relative z-10 bg-[#151311] border border-white/8 rounded-[24px] p-6 -mt-16 md:-mt-20 shadow-xl space-y-6">
        <div className="flex flex-col md:flex-row justify-between items-start md:items-end gap-6">
          {/* Avatar Hinging */}
          <div className="flex items-end gap-4 md:gap-6">
            <div className="border-4 border-[#0F0E0D] rounded-[32px] overflow-hidden shadow-2xl bg-[#0F0E0D] -mt-12 md:-mt-16">
              <IdentityAvatar
                fileId={(isOwnProfile || profile?.isAvatar !== false) ? targetUserId : null}
                userId={targetUserId}
                alt={profile?.displayName || profile?.username || 'User'}
                fallback={(profile?.displayName || profile?.username || 'U').slice(0, 1).toUpperCase()}
                verified={identityFlags.verified}
                pro={identityFlags.pro}
                size={88}
                verifiedSize={20}
                borderRadius="24px"
              />
            </div>
            <div className="space-y-1">
              <h1 className="text-white text-2xl font-black tracking-tight leading-none">
                {profile?.displayName || profile?.username}
              </h1>
              <p className="text-[#6366F1] font-mono text-sm tracking-wide">
                @{profile?.username}
              </p>
            </div>
          </div>

          {/* Quick Actions Container */}
          <div className="flex flex-wrap items-center gap-3 w-full md:w-auto">
            {isOwnProfile ? (
              <button
                onClick={() => setIsEditModalOpen(true)}
                className="w-full md:w-auto py-2.5 px-6 rounded-xl bg-[#6366F1] hover:bg-[#5254E8] text-white font-black text-sm transition-all flex items-center justify-center gap-2 shadow-lg"
              >
                <Edit3 size={15} />
                <span>Edit Profile</span>
              </button>
            ) : (
              <>
                <button
                  onClick={handleFollow}
                  disabled={followLoading || !currentUser}
                  className={`flex-1 md:flex-none py-2.5 px-6 rounded-xl text-sm font-black transition-all flex items-center justify-center gap-2 shadow-lg disabled:opacity-50 ${
                    isFollowing
                      ? 'border border-[#6366F1] text-[#6366F1] hover:bg-[#6366F1]/10'
                      : 'bg-[#6366F1] hover:bg-[#5254E8] text-white'
                  }`}
                >
                  <UserPlus size={15} />
                  <span>{followLoading ? 'Updating...' : isFollowing ? 'Following' : 'Follow'}</span>
                </button>
                
                <button
                  onClick={handleTip}
                  disabled={!currentUser}
                  className="flex-1 md:flex-none py-2.5 px-6 rounded-xl bg-white/10 hover:bg-white/15 text-white border border-white/8 font-black text-sm transition-all disabled:opacity-50"
                >
                  Tip
                </button>

                <button
                  onClick={() => setIsReportModalOpen(true)}
                  disabled={!currentUser}
                  className="p-2.5 rounded-xl bg-red-500/10 hover:bg-red-500/20 text-red-400 border border-red-500/20 hover:border-red-500/40 transition-all disabled:opacity-50"
                >
                  <Flag size={15} />
                </button>
              </>
            )}
          </div>
        </div>

        <div className="h-px bg-white/5" />

        {/* Bio, Joined date & Status */}
        <div className="flex flex-col md:flex-row justify-between gap-6">
          <div className="flex-1 max-w-xl">
            {profile?.bio ? (
              <p className="text-white/70 text-sm leading-relaxed whitespace-pre-wrap">
                {profile.bio}
              </p>
            ) : (
              <p className="text-white/30 text-xs italic">No bio configured yet.</p>
            )}
          </div>

          <div className="flex flex-col sm:flex-row gap-4 sm:gap-6 text-xs text-white/50 shrink-0">
            {joinedAt && (
              <div className="flex items-center gap-2">
                <Calendar size={14} className="text-white/30" />
                <span>Joined {joinedAt}</span>
              </div>
            )}
            <div className="flex items-center gap-2">
              {profile?.isPublic !== false ? (
                <>
                  <Globe size={14} className="text-emerald-400" />
                  <span>Discoverable</span>
                </>
              ) : (
                <>
                  <Lock size={14} className="text-amber-400" />
                  <span>Private Profile</span>
                </>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Profile Details Columns */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
        {/* Left Card: Stats Details */}
        <div className="lg:col-span-4 space-y-6">
          <div className="bg-[#151311] border border-white/8 rounded-[24px] p-6 space-y-4 shadow-xl">
            <h3 className="text-xs font-black tracking-wider text-white/40 uppercase">Ecosystem Connections</h3>
            <div className="grid grid-cols-2 gap-3">
              <button
                onClick={handleOpenFollowers}
                className="bg-white/2 hover:bg-white/4 border border-white/8 rounded-xl p-4 text-left transition-all flex flex-col items-center justify-center"
              >
                <span className="text-white text-xl font-black leading-none">{stats.followers}</span>
                <span className="text-[10px] font-black text-white/35 uppercase tracking-wider mt-2">Followers</span>
              </button>
              <button
                onClick={handleOpenFollowing}
                className="bg-white/2 hover:bg-white/4 border border-white/8 rounded-xl p-4 text-left transition-all flex flex-col items-center justify-center"
              >
                <span className="text-white text-xl font-black leading-none">{stats.following}</span>
                <span className="text-[10px] font-black text-white/35 uppercase tracking-wider mt-2">Following</span>
              </button>
            </div>
          </div>

          {isOwnProfile && (
            <div className="bg-[#151311] border border-[#6366F1]/10 rounded-[24px] p-6 space-y-5 shadow-xl relative overflow-hidden group">
              <div className="absolute top-0 right-0 p-8 -mr-8 -mt-8 bg-[#6366F1]/5 rounded-full blur-2xl group-hover:bg-[#6366F1]/10 transition-colors" />
              
              <div className="flex items-center gap-3 relative z-10">
                <div className="p-2 rounded-lg bg-[#6366F1]/10 text-[#6366F1]">
                  <Zap size={16} />
                </div>
                <h3 className="text-xs font-black tracking-wider text-white uppercase">Profile Management</h3>
              </div>

              <div className="space-y-3 relative z-10">
                <button 
                  onClick={() => setIsEditModalOpen(true)}
                  className="w-full p-3 rounded-xl bg-white/2 hover:bg-white/5 border border-white/5 hover:border-white/10 text-left transition-all flex items-center justify-between group/item"
                >
                  <div className="flex items-center gap-3">
                    <div className="w-8 h-8 rounded-lg bg-white/5 flex items-center justify-center text-white/60">
                      <Edit3 size={14} />
                    </div>
                    <div>
                      <span className="block text-xs font-black text-white leading-tight">Edit Identity</span>
                      <span className="block text-[10px] text-white/40">Update bio & visuals</span>
                    </div>
                  </div>
                </button>

                <button 
                  onClick={() => router.push('/settings')}
                  className="w-full p-3 rounded-xl bg-white/2 hover:bg-white/5 border border-white/5 hover:border-white/10 text-left transition-all flex items-center justify-between group/item"
                >
                  <div className="flex items-center gap-3">
                    <div className="w-8 h-8 rounded-lg bg-white/5 flex items-center justify-center text-white/60">
                      <RefreshCw size={14} />
                    </div>
                    <div>
                      <span className="block text-xs font-black text-white leading-tight">Privacy Guard</span>
                      <span className="block text-[10px] text-white/40">Manage visibility</span>
                    </div>
                  </div>
                </button>
              </div>
            </div>
          )}
        </div>

        {/* Right Card: Tabs & Feeds */}
        <div className="lg:col-span-8 bg-[#151311] border border-white/8 rounded-[24px] p-6 space-y-6">
          {/* Custom Navigation Tabs */}
          <div className="flex gap-2 border-b border-white/8 pb-2">
            {TAB_KEYS.map((key) => {
              const active = selectedTab === key;
              return (
                <button
                  key={key}
                  onClick={() => updateTab(key)}
                  className={`flex-1 py-2 text-center text-xs font-black transition-all rounded-lg ${
                    active 
                      ? 'bg-[#6366F1]/15 text-[#6366F1] border border-[#6366F1]/30' 
                      : 'text-white/45 hover:text-white/80 border border-transparent'
                  }`}
                >
                  <span className="capitalize">{key}</span>
                  <span className="ml-2 px-1.5 py-0.5 rounded-md bg-white/5 text-[9px] font-bold text-white/60">
                    {tabCounts[key]}
                  </span>
                </button>
              );
            })}
          </div>

          {/* Description & Action details */}
          <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
            <div>
              <h3 className="text-white text-sm font-black tracking-tight leading-none">
                {activeTabMeta.title}
              </h3>
              <p className="text-white/45 text-[11px] font-semibold mt-1">{activeTabMeta.description}</p>
            </div>
          </div>

          <div className="h-px bg-white/5" />

          {/* Feed Content Panel */}
          {momentsLoading ? (
            <div className="space-y-4">
              {[1, 2, 3].map((n) => (
                <div key={n} className="h-28 bg-white/3 border border-white/5 rounded-xl animate-pulse" />
              ))}
            </div>
          ) : momentsError ? (
            <div className="p-4 border border-red-500/20 bg-red-500/5 rounded-xl flex items-center justify-between">
              <span className="text-red-400 text-xs font-semibold">{momentsError}</span>
              <button
                onClick={handleRetry}
                className="p-2 bg-white/5 hover:bg-white/10 rounded-lg text-white transition-all"
              >
                <RefreshCw size={14} />
              </button>
            </div>
          ) : (activeTabItems || []).length === 0 ? (
            <div className="flex flex-col items-center justify-center py-12 text-center bg-white/2 border border-dashed border-white/8 rounded-[20px] p-6">
              <div className="w-12 h-12 rounded-xl bg-white/5 flex items-center justify-center text-[#6366F1] mb-4">
                {selectedTab === 'moments' ? <Sparkles size={22} /> : selectedTab === 'replies' ? <MessageCircle size={22} /> : <Repeat2 size={22} />}
              </div>
              <h4 className="text-white text-sm font-black">{activeTabMeta.emptyTitle}</h4>
              <p className="text-white/40 text-xs mt-1.5 max-w-sm">{activeTabMeta.emptyBody}</p>
            </div>
          ) : (
            <div className="space-y-4">
              {activeTabItems.map((moment: any) => {
                const type = moment?.metadata?.type || 'post';
                const publishedAt = new Date(moment.$createdAt).toLocaleDateString(undefined, {
                  month: 'short',
                  day: 'numeric',
                });
                return (
                  <div
                    key={moment.$id}
                    onClick={() => router.push(`/connect/post/${moment.$id}`)}
                    className="p-4 bg-white/2 hover:bg-white/4 border border-white/8 rounded-2xl transition-all cursor-pointer flex flex-col gap-2.5"
                  >
                    <div className="flex justify-between items-center text-[10px] font-bold text-white/30">
                      <span className="uppercase tracking-wider text-[#6366F1]">{type}</span>
                      <span>{publishedAt}</span>
                    </div>
                    <p className="text-white/80 text-sm leading-relaxed">
                      {moment.body || moment.content || moment.caption || 'Shared an update'}
                    </p>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>

      {/* Overlays */}
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
    </div>
  );
}

export const Profile = ProfileRedesign;
export default Profile;
