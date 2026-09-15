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
  Wallet,
  Coins,
  Share2,
  X
} from 'lucide-react';
import { useWalletOverlay } from '@/context/WalletOverlayContext';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/context/auth/AuthContext';
import { useUnifiedDrawer } from '@/context/UnifiedDrawerContext';
import { EditProfileModal } from '@/components/profile/EditProfileModal';
import { getUserBadgesAction } from '@/lib/actions/sponsor-actions';
import { BadgeChip } from '@/components/sponsor/SponsorBadges';
import { fetchProfilePreview, getCachedProfilePreview } from '@/lib/profile-preview';
import toast from 'react-hot-toast';

function isCleanUsername(val?: string | null): boolean {
  if (!val || typeof val !== 'string') return false;
  const trimmed = val.trim();
  return trimmed.length > 0 && !/\s/.test(trimmed);
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
}

export function UnifiedProfileView({
  userId,
  username,
  name,
  avatar,
  bio,
  initialProfile,
  onClose,
}: UnifiedProfileViewProps) {
  const { user } = useAuth();
  const { openWallet, openWalletWithIntent } = useWalletOverlay();
  const { open: openUnifiedDrawer } = useUnifiedDrawer();
  const [tipEnabled, setTipEnabled] = useState<boolean>(true);
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);
  const router = useRouter();

  const currentUserId = user?.$id;
  const targetUid = userId || initialProfile?.userId || initialProfile?.$id || (isOwnCheck() ? currentUserId : undefined);

  function isOwnCheck() {
    return Boolean(
      (currentUserId && userId && currentUserId === userId) ||
      (user?.name && username && user.name.toLowerCase() === username.toLowerCase()) ||
      (user?.prefs?.username && username && user.prefs.username.toLowerCase() === username.toLowerCase())
    );
  }

  const isOwnProfile = isOwnCheck();

  const initialCleanUsername = isCleanUsername(username)
    ? username!.trim().replace(/^@/, '')
    : (isCleanUsername(initialProfile?.username) ? initialProfile.username.trim().replace(/^@/, '') : undefined);

  const [resolvedProfile, setResolvedProfile] = useState<{ 
    name?: string; 
    username?: string; 
    avatar?: string; 
    bio?: string;
    links?: Array<{ title?: string; url: string }>;
    tags?: string[];
    socials?: { twitter?: string; github?: string; website?: string; telegram?: string; lightning?: string };
    createdAt?: string;
  }>({
    name: name || initialProfile?.displayName || initialProfile?.name,
    username: initialCleanUsername,
    avatar: avatar || initialProfile?.avatar || initialProfile?.avatarUrl,
    bio: bio || initialProfile?.bio,
    links: initialProfile?.preferences?.links || initialProfile?.links || [],
    tags: initialProfile?.preferences?.tags || initialProfile?.tags || [],
    socials: initialProfile?.socials || {},
    createdAt: initialProfile?.$createdAt || initialProfile?.createdAt,
  });

  const [resolvedAvatarUrl, setResolvedAvatarUrl] = useState<string | null>(null);
  const [kylrixFollowersCount, setKylrixFollowersCount] = useState<number>(0);
  const [kylrixFollowingCount, setKylrixFollowingCount] = useState<number>(0);
  const [badges, setBadges] = useState<any[]>([]);
  const [copiedKey, setCopiedKey] = useState<string | null>(null);
  const [isFollowing, setIsFollowing] = useState(false);

  // Instant 0ms LocalEngine hydration & lookup profile info
  useEffect(() => {
    let cancelled = false;
    const lookup = async () => {
      try {
        const key = targetUid ? `profile_${targetUid}` : (username ? `profile_${username.replace(/^@/, '').toLowerCase()}` : null);
        if (key) {
          const { LocalEngine } = await import('@/lib/services/LocalEngine');
          const cached = await LocalEngine.cacheGet<any>(key).catch(() => null);
          if (cached && !cancelled) {
            let prefsObj: any = {};
            try {
              prefsObj = typeof cached.preferences === 'string' ? JSON.parse(cached.preferences) : cached.preferences || {};
              if (typeof prefsObj.tipEnabled === 'boolean') setTipEnabled(prefsObj.tipEnabled);
            } catch {}
            setResolvedProfile(prev => ({
              name: prev.name || cached.displayName || cached.name,
              username: isCleanUsername(cached.username) ? cached.username.trim().replace(/^@/, '') : (isCleanUsername(prev.username) ? prev.username : undefined),
              avatar: prev.avatar || cached.avatar || cached.avatarUrl,
              bio: prev.bio || cached.bio,
              links: prev.links?.length ? prev.links : prefsObj.links || cached.links || [],
              tags: prev.tags?.length ? prev.tags : prefsObj.tags || cached.tags || [],
              createdAt: prev.createdAt || cached.$createdAt || cached.createdAt,
            }));
          }
        }

        if (targetUid) {
          const { UsersService } = await import('@/lib/services/users');
          const prof = await UsersService.getProfileById(targetUid).catch(() => null);
          if (cancelled || !prof) return;

          let prefs: any = {};
          try {
            prefs = typeof (prof as any).preferences === 'string'
              ? JSON.parse((prof as any).preferences)
              : (prof as any).preferences || {};
            if (typeof prefs.tipEnabled === 'boolean') {
              setTipEnabled(prefs.tipEnabled);
            }
          } catch {}

          setResolvedProfile(prev => ({
            name: prof.displayName || prof.name || prev.name,
            username: isCleanUsername(prof.username) ? prof.username.trim().replace(/^@/, '') : prev.username,
            avatar: prof.avatar || prof.avatarUrl || prev.avatar,
            bio: prof.bio ?? prev.bio,
            links: prefs.links || (prof as any).links || prev.links || [],
            tags: prefs.tags || (prof as any).tags || prev.tags || [],
            createdAt: (prof as any).$createdAt || prev.createdAt,
          }));
        } else if (username) {
          const { UsersService } = await import('@/lib/services/users');
          const prof = await UsersService.getProfile(username).catch(() => null);
          if (cancelled || !prof) return;

          let prefs: any = {};
          try {
            prefs = typeof (prof as any).preferences === 'string'
              ? JSON.parse((prof as any).preferences)
              : (prof as any).preferences || {};
            if (typeof prefs.tipEnabled === 'boolean') {
              setTipEnabled(prefs.tipEnabled);
            }
          } catch {}

          setResolvedProfile(prev => ({
            name: prof.displayName || prof.name || prev.name,
            username: isCleanUsername(prof.username) ? prof.username.trim().replace(/^@/, '') : prev.username,
            avatar: prof.avatar || prof.avatarUrl || prev.avatar,
            bio: prof.bio ?? prev.bio,
            links: prefs.links || (prof as any).links || prev.links || [],
            tags: prefs.tags || (prof as any).tags || prev.tags || [],
            createdAt: (prof as any).$createdAt || prev.createdAt,
          }));
        }
      } catch {}
    };
    void lookup();
    return () => { cancelled = true; };
  }, [targetUid, username]);

  // Resolve Avatar Preview
  useEffect(() => {
    let cancelled = false;
    const resolveAvatar = async () => {
      const raw = resolvedProfile.avatar || (isOwnProfile ? (user?.prefs?.avatar || user?.prefs?.profilePicId) : null);
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
  }, [resolvedProfile.avatar, isOwnProfile, user, targetUid]);

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

  const activeDisplayName = resolvedProfile.name || name || username || 'Kylrix User';

  const rawUsername = isCleanUsername(resolvedProfile.username)
    ? resolvedProfile.username
    : (isCleanUsername(username)
        ? username
        : (isOwnProfile
            ? (isCleanUsername(user?.prefs?.username) ? user?.prefs?.username : (isCleanUsername(user?.username) ? user?.username : null))
            : null));

  const cleanUsername = rawUsername ? rawUsername.trim().replace(/^@/, '') : null;
  const activeHandle = cleanUsername ? `@${cleanUsername}` : '';
  const activeBio = resolvedProfile.bio || bio || '';

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

  return (
    <div className={`${onClose ? 'h-full flex flex-col' : 'fixed inset-0 z-50 flex flex-col'} w-full max-h-[100dvh] bg-[#161412] text-white overflow-hidden select-none animate-in fade-in duration-150 font-satoshi`}>
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
              {tipEnabled !== false && (
                <button
                  type="button"
                  onClick={() => {
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

              <button
                type="button"
                onClick={() => {
                  openUnifiedDrawer('new-chat', { recipientId: targetUid, recipientName: activeDisplayName });
                }}
                className="p-2 rounded-xl bg-[#000000] border border-white/20 text-white/70 hover:text-white hover:bg-white/5 transition-colors cursor-pointer"
                title="Direct Message"
                aria-label="Direct Message"
              >
                <MessageSquare size={15} />
              </button>
            </>
          )}

          <button
            type="button"
            onClick={() => {
              if (onClose) onClose();
              openWallet();
            }}
            className="p-2 rounded-xl bg-[#000000] border border-white/20 text-white/70 hover:text-white hover:bg-white/5 transition-colors cursor-pointer"
            title="Wallet"
            aria-label="Wallet"
          >
            <Wallet size={15} />
          </button>

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
          <div className="rounded-3xl bg-[#000000] border border-white/20 p-5 sm:p-6 space-y-4 shadow-sm">
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
                  <div className="w-20 h-20 sm:w-24 sm:h-24 rounded-2xl sm:rounded-3xl bg-gradient-to-tr from-amber-500/20 to-pink-500/20 border-2 border-white/20 flex items-center justify-center text-white text-2xl sm:text-3xl font-black font-clash">
                    {activeDisplayName.charAt(0).toUpperCase()}
                  </div>
                )}
              </div>

              {/* Names, Handles & Badges */}
              <div className="min-w-0 flex-1 space-y-1">
                <div className="flex items-center gap-2 flex-wrap">
                  <h1 className="text-lg sm:text-xl font-black font-clash text-white tracking-tight truncate m-0">
                    {activeDisplayName}
                  </h1>
                </div>

                {activeHandle && (
                  <p className="text-xs sm:text-sm font-bold font-mono text-white/60 truncate m-0">
                    {activeHandle}
                  </p>
                )}

                {resolvedProfile.createdAt && (
                  <p className="text-[11px] font-mono text-white/40 truncate m-0 pt-0.5">
                    Member since {new Date(resolvedProfile.createdAt).toLocaleDateString(undefined, { month: 'short', year: 'numeric' })}
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

            {/* Badges & Tags */}
            {(badges.length > 0 || (resolvedProfile.tags && resolvedProfile.tags.length > 0)) && (
              <div className="flex flex-wrap items-center gap-1.5 pt-1">
                {badges.map((b) => (
                  <BadgeChip key={b.$id || b.id} badge={b} size="sm" />
                ))}
                {resolvedProfile.tags?.map((t) => (
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
            {resolvedProfile.links && resolvedProfile.links.length > 0 && (
              <div className="flex flex-wrap gap-2 pt-1">
                {resolvedProfile.links.map((link, idx) => (
                  <a
                    key={idx}
                    href={link.url.startsWith('http') ? link.url : `https://${link.url}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-[#161412] border border-white/20 hover:border-white/40 text-xs font-bold text-white/80 hover:text-white transition-colors cursor-pointer"
                  >
                    <LinkIcon size={12} className="text-[#6366F1]" />
                    <span className="truncate max-w-[160px]">{link.title || link.url.replace(/^https?:\/\//, '')}</span>
                    <ExternalLink size={11} className="text-white/40" />
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
        </div>
      </main>

      {/* Edit Profile Modal */}
      {isEditModalOpen && (
        <EditProfileModal
          open={isEditModalOpen}
          onClose={() => setIsEditModalOpen(false)}
          onUpdate={() => {
            setIsEditModalOpen(false);
          }}
        />
      )}
    </div>
  );
}
