'use client';

import React, { useState, useEffect } from 'react';
import { 
  ExternalLink, 
  Copy, 
  Check, 
  MessageSquare,
  Edit3,
  Settings,
  ShieldCheck,
  UserPlus,
  UserCheck,
  Link as LinkIcon,
  Coins,
  Share2,
  X,
  Sparkles,
  Crown,
  GitCommit,
  GitPullRequest,
  Github,
  MapPin,
  Wallet,
  Globe,
  Twitter,
  Send,
  Linkedin
} from 'lucide-react';
import { getUserSubscriptionTier } from '@/lib/utils';
import { useWalletOverlay } from '@/context/WalletOverlayContext';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/context/auth/AuthContext';
import { useUnifiedDrawer } from '@/context/UnifiedDrawerContext';
import { EditProfileModal } from '@/components/profile/EditProfileModal';
import { getUserBadgesAction } from '@/lib/actions/sponsor-actions';
import { BadgeChip } from '@/components/sponsor/SponsorBadges';
import { fetchProfilePreview, getCachedProfilePreview } from '@/lib/profile-preview';
import { Identicon } from '@/components/Identicon';
import { extractNormalizedProfile, NormalizedProfileLink } from '@/lib/profile-utils';
import toast from 'react-hot-toast';

function isCleanUsername(val?: string | null): boolean {
  if (!val || typeof val !== 'string') return false;
  const trimmed = val.trim();
  return trimmed.length > 0 && !/\s/.test(trimmed);
}

export function renderProfileLinkIcon(type?: string) {
  switch (type) {
    case 'github':
      return <Github size={13} className="text-white/80 shrink-0" />;
    case 'twitter':
      return <Twitter size={13} className="text-[#1DA1F2] shrink-0" />;
    case 'telegram':
      return <Send size={13} className="text-[#0088cc] shrink-0" />;
    case 'linkedin':
      return <Linkedin size={13} className="text-[#0A66C2] shrink-0" />;
    case 'website':
      return <Globe size={13} className="text-[#6366F1] shrink-0" />;
    default:
      return <LinkIcon size={13} className="text-[#6366F1] shrink-0" />;
  }
}

export interface UnifiedProfileViewProps {
  userId?: string;
  username?: string;
  name?: string;
  avatar?: string;
  bio?: string;
  source?: string;
  initialProfile?: any;
  onClose?: () => void;
  isPage?: boolean;
}

export interface ContributorActivityData {
  isContributor: boolean;
  prCount: number;
  commitCount?: number;
  githubUsername?: string | null;
  lastCheckedAt?: string;
  recentCommits?: Array<{
    sha: string;
    message: string;
    url: string;
    date: string;
    repo?: string;
  }>;
  recentPrs?: Array<{
    id: number;
    title: string;
    url: string;
    date: string;
    state: string;
  }>;
}

export function ProfilePublishedTabs({
  targetUid,
  username,
  contributorData
}: {
  targetUid?: string;
  username?: string | null;
  contributorData?: ContributorActivityData | null;
}) {
  const [activeTab, setActiveTab] = useState<'articles' | 'forms' | 'events' | 'flows' | 'github'>('articles');
  const [publishedItems, setPublishedItems] = useState<{
    articles: any[];
    forms: any[];
    events: any[];
    flows: any[];
  }>({
    articles: [],
    forms: [],
    events: [],
    flows: [],
  });
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    let cancelled = false;
    async function loadPublished() {
      if (!targetUid && !username) return;
      setLoading(true);
      try {
        const { LocalEngine } = await import('@/lib/services/LocalEngine');
        const [localNotes, localForms, localEvents, localFlows] = await Promise.all([
          LocalEngine.cacheGet<any[]>('notes_published').catch(() => []),
          LocalEngine.cacheGet<any[]>('forms_published').catch(() => []),
          LocalEngine.cacheGet<any[]>('events_published').catch(() => []),
          LocalEngine.cacheGet<any[]>('flows_published').catch(() => []),
        ]);

        if (!cancelled) {
          const filterUser = (items: any[]) =>
            Array.isArray(items)
              ? items.filter(
                  (i) =>
                    (i.status === 'published' || i.isPublished === true) &&
                    (i.userId === targetUid || i.ownerId === targetUid || i.author === targetUid)
                )
              : [];

          setPublishedItems({
            articles: filterUser(localNotes || []),
            forms: filterUser(localForms || []),
            events: filterUser(localEvents || []),
            flows: filterUser(localFlows || []),
          });
        }
      } catch (err) {
        console.warn('Failed to fetch published user content:', err);
      } finally {
        if (!cancelled) setLoading(false);
      }
    }
    void loadPublished();
    return () => {
      cancelled = true;
    };
  }, [targetUid, username]);

  const tabs: Array<{ id: 'articles' | 'forms' | 'events' | 'flows' | 'github'; label: string; icon?: React.ReactNode }> = [
    { id: 'articles', label: 'Articles' },
    { id: 'forms', label: 'Forms' },
    { id: 'events', label: 'Events' },
    { id: 'flows', label: 'Flows' },
    {
      id: 'github',
      label: 'GitHub Activity',
      icon: <Github size={13} className="text-white/70" />
    },
  ];

  const currentList = activeTab !== 'github' ? (publishedItems[activeTab] || []) : [];
  const recentCommits = contributorData?.recentCommits || [];
  const recentPrs = contributorData?.recentPrs || [];

  return (
    <div className="rounded-3xl bg-[#000000] border border-white/20 p-5 sm:p-6 space-y-4 shadow-sm">
      {/* Tab bar */}
      <div className="flex items-center gap-2 border-b border-white/10 pb-3 overflow-x-auto scrollbar-none">
        {tabs.map((tab) => {
          let count = 0;
          if (tab.id === 'github') {
            count = (recentCommits.length || 0) + (recentPrs.length || 0);
          } else {
            count = publishedItems[tab.id]?.length || 0;
          }
          const isActive = activeTab === tab.id;
          return (
            <button
              key={tab.id}
              type="button"
              onClick={() => setActiveTab(tab.id)}
              className={`px-3.5 py-1.5 rounded-xl text-xs font-bold transition-all cursor-pointer whitespace-nowrap flex items-center gap-1.5 ${
                isActive
                  ? 'bg-[#6366F1] text-white shadow-[0_0_12px_rgba(99,102,241,0.35)]'
                  : 'bg-[#161412] text-white/60 hover:text-white hover:bg-white/10'
              }`}
            >
              {tab.icon}
              <span>{tab.label}</span>
              {count > 0 && (
                <span className={`text-[10px] px-1.5 py-0.2 rounded-full font-mono ${isActive ? 'bg-white/20 text-white' : 'bg-white/10 text-white/60'}`}>
                  {count}
                </span>
              )}
            </button>
          );
        })}
      </div>

      {/* Content list or GitHub Commits tab */}
      <div className="min-h-[120px] flex flex-col justify-center">
        {activeTab === 'github' ? (
          <div className="space-y-3">
            {contributorData?.githubUsername && (
              <div className="flex items-center justify-between px-3 py-2 rounded-2xl bg-[#161412] border border-white/10 text-xs font-mono text-white/70">
                <span className="flex items-center gap-1.5">
                  <Github size={14} className="text-[#6366F1]" />
                  <span>GitHub: <strong className="text-white">@{contributorData.githubUsername}</strong></span>
                </span>
                {contributorData.isContributor && (
                  <span className="text-[10px] font-bold px-2 py-0.5 rounded bg-emerald-500/15 text-emerald-400 border border-emerald-500/30">
                    Recognized Contributor
                  </span>
                )}
              </div>
            )}

            {recentPrs.length > 0 && (
              <div className="space-y-2">
                <h4 className="text-[11px] font-mono uppercase tracking-wider text-white/50 px-1">Merged Pull Requests</h4>
                {recentPrs.map((pr) => (
                  <a
                    key={pr.id}
                    href={pr.url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="p-3.5 rounded-2xl bg-[#161412] border border-white/10 hover:border-emerald-500/40 transition-all flex items-start justify-between gap-3 group cursor-pointer"
                  >
                    <div className="space-y-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <GitPullRequest size={14} className="text-emerald-400 shrink-0" />
                        <h4 className="text-xs font-bold text-white group-hover:text-emerald-300 transition-colors truncate">
                          {pr.title}
                        </h4>
                      </div>
                      <p className="text-[10px] font-mono text-white/40">
                        {new Date(pr.date).toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' })}
                      </p>
                    </div>
                    <span className="text-[9px] font-mono uppercase px-2 py-0.5 rounded bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 shrink-0">
                      {pr.state}
                    </span>
                  </a>
                ))}
              </div>
            )}

            {recentCommits.length > 0 ? (
              <div className="space-y-2">
                <h4 className="text-[11px] font-mono uppercase tracking-wider text-white/50 px-1">Recent Commits</h4>
                {recentCommits.map((c) => (
                  <a
                    key={c.sha + c.date}
                    href={c.url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="p-3.5 rounded-2xl bg-[#161412] border border-white/10 hover:border-white/25 transition-all flex items-start justify-between gap-3 group cursor-pointer"
                  >
                    <div className="space-y-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <GitCommit size={14} className="text-[#818CF8] shrink-0" />
                        <h4 className="text-xs font-bold text-white group-hover:text-[#A5B4FC] transition-colors truncate">
                          {c.message}
                        </h4>
                      </div>
                      <div className="flex items-center gap-2 text-[10px] font-mono text-white/40">
                        <span>{c.repo || 'Kylrix/kylrix'}</span>
                        <span>•</span>
                        <span>{new Date(c.date).toLocaleDateString(undefined, { month: 'short', day: 'numeric' })}</span>
                      </div>
                    </div>
                    <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-white/5 text-white/70 border border-white/10 shrink-0">
                      {c.sha}
                    </span>
                  </a>
                ))}
              </div>
            ) : (
              recentPrs.length === 0 && (
                <div className="text-center py-8 text-xs text-white/40 font-satoshi space-y-1">
                  <p className="font-bold text-white/60">No recent GitHub activity found</p>
                  <p className="text-[11px] text-white/30">
                    Connect GitHub account in settings or contribute to Kylrix repositories to show activity.
                  </p>
                </div>
              )
            )}
          </div>
        ) : loading ? (
          <div className="text-center py-8 text-xs font-mono text-white/40 animate-pulse">
            Loading published content…
          </div>
        ) : currentList.length > 0 ? (
          <div className="space-y-2">
            {currentList.map((item: any, idx: number) => (
              <div
                key={item.$id || item.id || idx}
                className="p-3.5 rounded-2xl bg-[#161412] border border-white/10 hover:border-white/20 transition-all flex items-center justify-between"
              >
                <div>
                  <h4 className="text-xs font-extrabold text-white font-clash">{item.title || item.name || 'Untitled'}</h4>
                  <p className="text-[10px] text-white/40 font-mono mt-0.5">{item.description || item.summary || 'Published content'}</p>
                </div>
                <span className="text-[9px] font-mono uppercase px-2 py-0.5 rounded bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
                  Published
                </span>
              </div>
            ))}
          </div>
        ) : (
          <div className="text-center py-8 text-xs text-white/40 font-satoshi space-y-1">
            <p className="font-bold text-white/60">No published {activeTab} yet</p>
            <p className="text-[11px] text-white/30">
              Only items marked as published will appear here.
            </p>
          </div>
        )}
      </div>
    </div>
  );
}

export function UnifiedProfileView({
  userId,
  username,
  name,
  avatar,
  bio,
  initialProfile,
  onClose,
  isPage,
}: UnifiedProfileViewProps) {
  const { user } = useAuth();
  const { openWalletWithIntent } = useWalletOverlay();
  const { open: openUnifiedDrawer } = useUnifiedDrawer();
  const [tipEnabled, setTipEnabled] = useState<boolean>(true);
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);
  const router = useRouter();

  const currentUserId = user?.$id;
  const targetUid = userId || initialProfile?.userId || initialProfile?.$id || (isOwnCheck() ? currentUserId : undefined);

  function isOwnCheck() {
    return Boolean(
      (currentUserId && userId && currentUserId === userId) ||
      (currentUserId && initialProfile && (initialProfile.userId === currentUserId || initialProfile.$id === currentUserId)) ||
      (user?.name && username && user.name.toLowerCase() === username.toLowerCase()) ||
      (user?.prefs?.username && username && user.prefs.username.toLowerCase() === username.toLowerCase())
    );
  }

  const isOwnProfile = isOwnCheck();
  const currentUserTier = isOwnProfile ? getUserSubscriptionTier(user) : null;

  const initialCleanUsername = typeof username === 'string' && isCleanUsername(username)
    ? username.trim().replace(/^@/, '')
    : (typeof initialProfile?.username === 'string' && isCleanUsername(initialProfile.username) ? initialProfile.username.trim().replace(/^@/, '') : undefined);

  const [rawProfileData, setRawProfileData] = useState<any>(initialProfile || null);

  const [resolvedAvatarUrl, setResolvedAvatarUrl] = useState<string | null>(null);
  const [kylrixFollowersCount, setKylrixFollowersCount] = useState<number>(0);
  const [kylrixFollowingCount, setKylrixFollowingCount] = useState<number>(0);
  const [badges, setBadges] = useState<any[]>([]);
  const [copiedKey, setCopiedKey] = useState<string | null>(null);
  const [isFollowing, setIsFollowing] = useState(false);
  const [contributorData, setContributorData] = useState<ContributorActivityData | null>(null);

  // Compute normalized profile from raw data
  const normalizedProfile = extractNormalizedProfile({
    ...rawProfileData,
    displayName: name || rawProfileData?.displayName || rawProfileData?.name,
    username: initialCleanUsername || rawProfileData?.username,
    avatar: avatar || rawProfileData?.avatar || rawProfileData?.avatarUrl,
    bio: bio || rawProfileData?.bio,
  });

  // Instant 0ms LocalEngine hydration & lookup profile info + contributor status
  useEffect(() => {
    let cancelled = false;
    const lookup = async () => {
      let handleForContributor: string | null = username || initialProfile?.username || null;
      try {
        const profileCacheKey = targetUid ? `profile_${targetUid}` : (username ? `profile_${username.replace(/^@/, '').toLowerCase()}` : null);
        const contribCacheKey = handleForContributor ? `contrib_status_${handleForContributor.replace(/^@/, '').toLowerCase()}` : null;

        const { LocalEngine } = await import('@/lib/services/LocalEngine');

        if (profileCacheKey) {
          const cachedProfile = await LocalEngine.cacheGet<any>(profileCacheKey).catch(() => null);
          if (cachedProfile && !cancelled) {
            setRawProfileData(cachedProfile);
            try {
              const prefsObj = typeof cachedProfile.preferences === 'string' ? JSON.parse(cachedProfile.preferences) : cachedProfile.preferences || {};
              if (typeof prefsObj.tipEnabled === 'boolean') setTipEnabled(prefsObj.tipEnabled);
            } catch {}
          }
        }

        if (contribCacheKey) {
          const cachedContrib = await LocalEngine.cacheGet<ContributorActivityData>(contribCacheKey).catch(() => null);
          if (cachedContrib && !cancelled) {
            setContributorData(cachedContrib);
          }
        }

        if (targetUid) {
          const { UsersService } = await import('@/lib/services/users');
          const prof = await UsersService.getProfileById(targetUid).catch(() => null);
          if (cancelled || !prof) return;
          if (prof.username && isCleanUsername(prof.username)) {
            handleForContributor = prof.username.trim().replace(/^@/, '');
          }

          try {
            const prefs = typeof (prof as any).preferences === 'string'
              ? JSON.parse((prof as any).preferences)
              : (prof as any).preferences || {};
            if (typeof prefs.tipEnabled === 'boolean') {
              setTipEnabled(prefs.tipEnabled);
            }
          } catch {}

          setRawProfileData(prof);
          if (profileCacheKey) {
            void LocalEngine.cacheSet(profileCacheKey, prof);
          }
        } else if (username) {
          const { UsersService } = await import('@/lib/services/users');
          const prof = await UsersService.getProfile(username).catch(() => null);
          if (cancelled || !prof) return;
          if (prof.username && isCleanUsername(prof.username)) {
            handleForContributor = prof.username.trim().replace(/^@/, '');
          }

          try {
            const prefs = typeof (prof as any).preferences === 'string'
              ? JSON.parse((prof as any).preferences)
              : (prof as any).preferences || {};
            if (typeof prefs.tipEnabled === 'boolean') {
              setTipEnabled(prefs.tipEnabled);
            }
          } catch {}

          setRawProfileData(prof);
          if (profileCacheKey) {
            void LocalEngine.cacheSet(profileCacheKey, prof);
          }
        }
      } catch {}

      // Fetch fresh contributor status & commit activity for viewed user
      if (handleForContributor && !cancelled) {
        try {
          const { getContributorStatusByUsernameAction } = await import('@/lib/actions/contributor-ops');
          const res = await getContributorStatusByUsernameAction(handleForContributor);
          if (res && !cancelled) {
            setContributorData(res);
            const { LocalEngine } = await import('@/lib/services/LocalEngine');
            void LocalEngine.cacheSet(`contrib_status_${handleForContributor.toLowerCase()}`, res);
          }
        } catch {}
      }
    };
    void lookup();
    return () => { cancelled = true; };
  }, [targetUid, username, initialProfile?.username]);

  // Resolve Avatar Preview
  useEffect(() => {
    let cancelled = false;
    const resolveAvatar = async () => {
      const raw = normalizedProfile.avatarUrl || (isOwnProfile ? (user?.prefs?.avatar || user?.prefs?.profilePicId) : null);
      if (!raw) {
        if (targetUid) {
          const cachedPreview = getCachedProfilePreview(targetUid);
          if (cachedPreview && !cancelled) {
            setResolvedAvatarUrl(cachedPreview);
            return;
          }
        }
        return;
      }

      if (raw.startsWith('http')) {
        if (!cancelled) setResolvedAvatarUrl(raw);
        return;
      }

      if (targetUid) {
        const preview = await fetchProfilePreview(targetUid).catch(() => null);
        if (!cancelled && preview) {
          setResolvedAvatarUrl(preview);
          return;
        }
      }

      try {
        const { StorageService } = await import('@/lib/services/storage');
        const viewUrl = StorageService.getFileView(raw);
        if (!cancelled && viewUrl) {
          setResolvedAvatarUrl(viewUrl);
        }
      } catch {}
    };
    void resolveAvatar();
    return () => { cancelled = true; };
  }, [normalizedProfile.avatarUrl, isOwnProfile, user, targetUid]);

  // Fetch Badges
  useEffect(() => {
    if (!targetUid) return;
    let cancelled = false;
    getUserBadgesAction(targetUid)
      .then((res) => {
        if (!cancelled && res) setBadges(res);
      })
      .catch(() => {});
    return () => { cancelled = true; };
  }, [targetUid]);

  // Fetch Follow Stats
  useEffect(() => {
    if (!targetUid) return;
    let cancelled = false;
    const loadFollowStats = async () => {
      try {
        const { SocialService } = await import('@/lib/services/social');
        const [followers, following] = await Promise.all([
          SocialService.getFollowers(targetUid).catch(() => []),
          SocialService.getFollowing(targetUid).catch(() => []),
        ]);
        if (!cancelled) {
          setKylrixFollowersCount(Array.isArray(followers) ? followers.length : 0);
          setKylrixFollowingCount(Array.isArray(following) ? following.length : 0);
        }
      } catch {}
    };
    void loadFollowStats();
    return () => { cancelled = true; };
  }, [targetUid]);

  // Check Local Follow Status
  useEffect(() => {
    if (!targetUid) return;
    import('@/lib/services/LocalEngine').then(({ LocalEngine }) => {
      LocalEngine.cacheGet<string[]>('kylrix:follows').then((follows) => {
        if (follows && Array.isArray(follows)) {
          setIsFollowing(follows.includes(targetUid));
        }
      }).catch(() => {});
    });
  }, [targetUid]);

  const activeDisplayName = normalizedProfile.displayName || name || username || 'Kylrix User';

  const rawUsername = typeof normalizedProfile.username === 'string' && isCleanUsername(normalizedProfile.username)
    ? normalizedProfile.username
    : (typeof username === 'string' && isCleanUsername(username)
        ? username
        : (isOwnProfile
            ? (typeof user?.prefs?.username === 'string' && isCleanUsername(user?.prefs?.username) ? user?.prefs?.username : (typeof user?.username === 'string' && isCleanUsername(user?.username) ? user?.username : null))
            : null));

  const cleanUsername = typeof rawUsername === 'string' ? rawUsername.trim().replace(/^@/, '') : null;
  const activeHandle = cleanUsername ? `@${cleanUsername}` : '';
  const activeBio = normalizedProfile.bio || bio || '';

  const copyToClipboard = (text: string, label: string) => {
    navigator.clipboard.writeText(text);
    setCopiedKey(label);
    toast.success(`Copied ${label}`);
    setTimeout(() => setCopiedKey(null), 1500);
  };

  const handleToggleFollow = async () => {
    if (!targetUid) return;
    try {
      const { LocalEngine } = await import('@/lib/services/LocalEngine');
      const follows = (await LocalEngine.cacheGet<string[]>('kylrix:follows')) || [];
      const nextFollows = isFollowing ? follows.filter(k => k !== targetUid) : [...follows, targetUid];
      await LocalEngine.cacheSet('kylrix:follows', nextFollows);
      setIsFollowing(!isFollowing);
      toast.success(isFollowing ? 'Unfollowed' : 'Following');
      window.dispatchEvent(new CustomEvent('kylrix:follows-updated', { detail: nextFollows }));
    } catch {
      toast.error('Could not update follow');
    }
  };

  const handleOpenDirectMessage = () => {
    if (!user) {
      openUnifiedDrawer('login');
      return;
    }
    openUnifiedDrawer('new-chat', { recipientId: targetUid, recipientName: activeDisplayName });
  };

  const containerClasses = isPage
    ? 'w-full min-h-screen flex flex-col bg-[#161412] text-white overflow-y-auto select-none font-satoshi'
    : (onClose
        ? 'h-full flex flex-col w-full max-h-[100dvh] bg-[#161412] text-white overflow-hidden select-none animate-in fade-in duration-150 font-satoshi'
        : 'fixed inset-0 z-50 flex flex-col w-full max-h-[100dvh] bg-[#161412] text-white overflow-hidden select-none animate-in fade-in duration-150 font-satoshi');

  return (
    <div className={containerClasses}>
      {/* Top Header Bar */}
      <header className="flex items-center justify-between px-4 sm:px-6 py-3 border-b border-white/20 bg-[#161412] shrink-0 z-30">
        <div className="flex items-center gap-2.5 min-w-0">
          <span className="h-2.5 w-2.5 rounded-full shrink-0 bg-emerald-400 shadow-[0_0_8px_rgba(52,211,153,0.6)]" />
          <span className="text-xs font-mono font-bold text-white/80 truncate">
            {activeHandle || activeDisplayName}
          </span>
        </div>

        <div className="flex items-center gap-2 shrink-0">
          {/* Own Profile Actions */}
          {isOwnProfile ? (
            <>
              <button
                type="button"
                onClick={() => setIsEditModalOpen(true)}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-extrabold bg-[#6366F1] text-white hover:bg-[#5254D8] active:scale-95 transition-all shadow-[0_4px_12px_rgba(99,102,241,0.25)] cursor-pointer"
                title="Edit"
                aria-label="Edit"
              >
                <Edit3 size={14} />
                <span className="hidden sm:inline">Edit</span>
              </button>

              <button
                type="button"
                onClick={() => {
                  if (onClose) onClose();
                  router.push('/settings');
                }}
                className="p-2 rounded-xl bg-[#000000] border border-white/20 text-white/70 hover:text-white hover:bg-white/5 transition-colors cursor-pointer"
                title="Settings"
                aria-label="Settings"
              >
                <Settings size={15} />
              </button>
            </>
          ) : (
            <>
              {/* Message / DM Button for External Visitors */}
              <button
                type="button"
                onClick={handleOpenDirectMessage}
                className="inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-xl text-xs font-extrabold bg-[#6366F1] text-white hover:bg-[#5254D8] active:scale-95 transition-all shadow-[0_4px_12px_rgba(99,102,241,0.3)] cursor-pointer"
                title={`Message ${activeDisplayName}`}
                aria-label={`Message ${activeDisplayName}`}
              >
                <MessageSquare size={14} />
                <span>Message</span>
              </button>

              {tipEnabled !== false && (
                <button
                  type="button"
                  onClick={() => {
                    if (onClose) onClose();
                    openWalletWithIntent({
                      mode: 'send',
                      toUser: {
                        id: targetUid || '',
                        username: rawUsername || '',
                        displayName: activeDisplayName,
                      },
                    });
                  }}
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-extrabold bg-emerald-500 text-black hover:bg-emerald-400 active:scale-95 transition-all shadow-[0_4px_12px_rgba(16,185,129,0.25)] cursor-pointer"
                  title={`Tip ${activeDisplayName}`}
                  aria-label={`Tip ${activeDisplayName}`}
                >
                  <Coins size={14} />
                  <span className="hidden sm:inline">Tip</span>
                </button>
              )}

              <button
                type="button"
                onClick={handleToggleFollow}
                className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-extrabold transition-all cursor-pointer ${
                  isFollowing
                    ? 'bg-[#000000] text-[#10B981] border border-[#10B981]/30 hover:bg-rose-500/20 hover:text-rose-400 hover:border-rose-500/30'
                    : 'bg-[#F59E0B] text-black hover:bg-[#d97706]'
                }`}
                title={isFollowing ? 'Following' : 'Follow'}
                aria-label={isFollowing ? 'Following' : 'Follow'}
              >
                {isFollowing ? <UserCheck size={14} /> : <UserPlus size={14} />}
                <span className="hidden sm:inline">{isFollowing ? 'Following' : 'Follow'}</span>
              </button>
            </>
          )}

          {!isOwnProfile && (
            <button
              type="button"
              onClick={() => {
                window.dispatchEvent(
                  new CustomEvent('kylrix:open-sidekick', {
                    detail: {
                      type: 'profile',
                      id: targetUid || activeHandle || 'profile',
                      title: activeDisplayName,
                      content: activeBio || '',
                      metadata: {
                        handle: activeHandle,
                        following: kylrixFollowingCount,
                        followers: kylrixFollowersCount,
                      },
                    },
                  })
                );
              }}
              className="p-2 rounded-xl bg-[#A855F7]/15 border border-[#A855F7]/25 text-[#A855F7] hover:text-white hover:bg-[#A855F7]/25 transition-all cursor-pointer"
              title="Sidekick Companion"
              aria-label="Sidekick Companion"
            >
              <Sparkles size={15} />
            </button>
          )}

          <button
            type="button"
            onClick={() => {
              const url = window.location.origin + (activeHandle ? `/u/${activeHandle.replace(/^@/, '')}` : `/u/${targetUid}`);
              navigator.clipboard.writeText(url);
              toast.success('Link copied!');
            }}
            className="p-2 rounded-xl bg-[#000000] border border-white/20 text-white/70 hover:text-white hover:bg-white/5 transition-colors cursor-pointer"
            title="Share"
            aria-label="Share"
          >
            <Share2 size={15} />
          </button>

          {onClose && (
            <button
              type="button"
              onClick={onClose}
              className="p-2 rounded-xl bg-[#000000] border border-white/20 text-white/70 hover:text-white transition-colors cursor-pointer ml-1"
              title="Close"
              aria-label="Close"
            >
              <X size={16} />
            </button>
          )}
        </div>
      </header>

      {/* Main Content Body */}
      <main className="flex-1 overflow-y-auto min-h-0 select-text bg-[#161412]">
        <div className="max-w-2xl mx-auto px-4 sm:px-6 py-6 space-y-5">
          {/* Identity Card */}
          <div className="rounded-3xl bg-[#000000] border border-white/20 p-5 sm:p-6 space-y-4 shadow-sm relative overflow-hidden">
            {/* Subtle Gradient Accent */}
            <div className="absolute top-0 right-0 left-0 h-1 bg-gradient-to-r from-emerald-500 via-[#6366F1] to-amber-500 opacity-80" />

            <div className="flex items-center gap-4 min-w-0">
              {/* Avatar */}
              <div className="relative shrink-0">
                {resolvedAvatarUrl ? (
                  <img
                    src={resolvedAvatarUrl}
                    alt={activeDisplayName}
                    className="w-20 h-20 sm:w-24 sm:h-24 rounded-2xl sm:rounded-3xl object-cover border-2 border-white/20 shadow-md"
                  />
                ) : (
                  <Identicon
                    seed={targetUid || activeDisplayName || 'kylrix'}
                    size={88}
                    borderRadius="1.25rem"
                    className="w-20 h-20 sm:w-24 sm:h-24 border-2 border-white/20 shadow-md"
                  />
                )}
              </div>

              {/* Names, Handles & Badges */}
              <div className="min-w-0 flex-1 space-y-1">
                <div className="flex items-center gap-2 flex-wrap">
                  <h1 className="text-lg sm:text-xl font-black font-clash text-white tracking-tight truncate m-0">
                    {activeDisplayName}
                  </h1>
                  {contributorData?.isContributor || (isOwnProfile && currentUserTier === 'CONTRIBUTOR') ? (
                    <span
                      title="Kylrix Contributor · Active merged contribution or recent commits"
                      className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[10px] font-black tracking-wider uppercase font-mono border bg-emerald-500/15 text-emerald-400 border-emerald-500/30 shadow-sm"
                    >
                      <Crown size={11} className="text-emerald-400" />
                      <span>CONTRIBUTOR</span>
                    </span>
                  ) : (
                    isOwnProfile && currentUserTier && (
                      <span className={`inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-black tracking-wider uppercase font-mono border ${
                        currentUserTier === 'TEAMS' || currentUserTier === 'ORG'
                          ? 'bg-amber-500/15 text-amber-300 border-amber-500/30'
                          : currentUserTier === 'PRO' || currentUserTier === 'LIFETIME'
                          ? 'bg-[#6366F1]/15 text-[#818CF8] border-[#6366F1]/30'
                          : 'bg-white/10 text-white/60 border-white/20'
                      }`}>
                        <Crown size={11} className={currentUserTier === 'FREE' ? 'text-white/40' : 'text-amber-400'} />
                        <span>{currentUserTier} PLAN</span>
                      </span>
                    )
                  )}
                </div>

                {activeHandle && (
                  <p className="text-xs sm:text-sm font-bold font-mono text-white/60 truncate m-0">
                    {activeHandle}
                  </p>
                )}

                {normalizedProfile.createdAt && !isNaN(new Date(normalizedProfile.createdAt).getTime()) && (
                  <p className="text-[11px] font-mono text-white/40 truncate m-0 pt-0.5">
                    Member since {new Date(normalizedProfile.createdAt).toLocaleDateString(undefined, { month: 'short', year: 'numeric' })}
                  </p>
                )}
              </div>
            </div>

            {/* Metrics Strip */}
            <div className="grid grid-cols-2 gap-2 pt-2 border-t border-white/20">
              <button
                type="button"
                onClick={() => {
                  if (targetUid) {
                    openUnifiedDrawer('follow-list', {
                      userId: targetUid,
                      type: 'following',
                      targetName: activeDisplayName,
                    });
                  }
                }}
                className="rounded-2xl bg-[#161412] border border-white/20 px-4 py-2.5 flex items-center justify-between hover:border-white/40 active:scale-[0.98] transition-all cursor-pointer text-left"
              >
                <span className="text-xs font-bold text-white/50 uppercase tracking-wider">
                  Following
                </span>
                <span className="text-sm font-black font-mono text-white tabular-nums">
                  {kylrixFollowingCount}
                </span>
              </button>
              <button
                type="button"
                onClick={() => {
                  if (targetUid) {
                    openUnifiedDrawer('follow-list', {
                      userId: targetUid,
                      type: 'followers',
                      targetName: activeDisplayName,
                    });
                  }
                }}
                className="rounded-2xl bg-[#161412] border border-white/20 px-4 py-2.5 flex items-center justify-between hover:border-white/40 active:scale-[0.98] transition-all cursor-pointer text-left"
              >
                <span className="text-xs font-bold text-white/50 uppercase tracking-wider">
                  Followers
                </span>
                <span className="text-sm font-black font-mono text-white tabular-nums">
                  {kylrixFollowersCount}
                </span>
              </button>
            </div>

            {/* Bio */}
            {activeBio ? (
              <p className="text-sm text-white/85 leading-relaxed font-satoshi whitespace-pre-wrap break-words">
                {activeBio}
              </p>
            ) : (
              <p className="text-xs text-white/35 italic font-satoshi">
                No bio yet.
              </p>
            )}

            {/* Location & Wallet Pill strip */}
            {(normalizedProfile.location || normalizedProfile.walletAddress) && (
              <div className="flex flex-wrap items-center gap-2 pt-1">
                {normalizedProfile.location && (
                  <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-xl bg-[#161412] border border-white/20 text-xs font-medium text-white/80">
                    <MapPin size={12} className="text-rose-400 shrink-0" />
                    <span>{normalizedProfile.location}</span>
                  </span>
                )}
                {normalizedProfile.walletAddress && (
                  <button
                    type="button"
                    onClick={() => copyToClipboard(normalizedProfile.walletAddress!, 'Wallet Address')}
                    className="inline-flex items-center gap-1.5 px-3 py-1 rounded-xl bg-[#161412] border border-white/20 hover:border-white/40 text-xs font-mono text-emerald-400 transition-colors cursor-pointer"
                    title="Copy Wallet Address"
                  >
                    <Wallet size={12} className="shrink-0" />
                    <span>{normalizedProfile.walletAddress.slice(0, 6)}…{normalizedProfile.walletAddress.slice(-4)}</span>
                    {copiedKey === 'Wallet Address' ? <Check size={11} className="text-emerald-400" /> : <Copy size={11} className="text-white/40" />}
                  </button>
                )}
              </div>
            )}

            {/* Badges & Tags */}
            {(badges.length > 0 || (normalizedProfile.tags && normalizedProfile.tags.length > 0)) && (
              <div className="flex flex-wrap items-center gap-1.5 pt-1">
                {badges.map((b) => (
                  <BadgeChip key={b.$id || b.id} badge={b} size="sm" />
                ))}
                {normalizedProfile.tags?.map((t) => (
                  <span
                    key={t}
                    className="inline-flex items-center px-2 py-0.5 rounded-md bg-[#161412] border border-white/10 text-xs font-mono text-zinc-300"
                  >
                    #{t}
                  </span>
                ))}
              </div>
            )}

            {/* Socials & Custom Links */}
            {normalizedProfile.links && normalizedProfile.links.length > 0 && (
              <div className="flex flex-wrap gap-2 pt-1">
                {normalizedProfile.links.map((link: NormalizedProfileLink, idx: number) => (
                  <a
                    key={idx}
                    href={link.url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-[#161412] border border-white/20 hover:border-white/40 text-xs font-bold text-white/80 hover:text-white transition-colors cursor-pointer"
                  >
                    {renderProfileLinkIcon(link.type)}
                    <span className="truncate max-w-[160px]">{link.title}</span>
                    <ExternalLink size={11} className="text-white/40 shrink-0" />
                  </a>
                ))}
              </div>
            )}

            {/* ID pill */}
            {targetUid && (
              <div className="flex flex-wrap items-center gap-2 pt-2 border-t border-white/20">
                <button
                  type="button"
                  onClick={() => copyToClipboard(targetUid, 'User ID')}
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-[#161412] border border-white/20 hover:border-white/40 text-xs font-mono text-white/70 hover:text-white transition-colors cursor-pointer"
                  title="Copy ID"
                >
                  <ShieldCheck size={13} className="text-[#10B981]" />
                  <span>ID: {targetUid.slice(0, 8)}…</span>
                  {copiedKey === 'User ID' ? <Check size={12} className="text-emerald-400" /> : <Copy size={12} className="text-white/40" />}
                </button>
              </div>
            )}
          </div>

          {/* Published Content & GitHub Commits Section */}
          <ProfilePublishedTabs
            targetUid={targetUid}
            username={rawUsername || activeHandle}
            contributorData={contributorData}
          />
        </div>
      </main>

      {/* Edit Profile Modal */}
      {isEditModalOpen && (
        <EditProfileModal
          open={isEditModalOpen}
          profile={rawProfileData}
          onClose={() => setIsEditModalOpen(false)}
          onUpdate={() => {
            setIsEditModalOpen(false);
          }}
        />
      )}
    </div>
  );
}
