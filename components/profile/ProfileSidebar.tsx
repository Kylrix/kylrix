'use client';

import React, { useCallback, useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { ChevronUp, MessageSquare, PhoneCall, X } from 'lucide-react';
import { IdentityAvatar } from '@/components/IdentityBadge';
import { UsersService } from '@/lib/services/users';
import { fetchProfilePreview } from '@/lib/profile-preview';
import { getCachedIdentityById } from '@/lib/identity-cache';
import { useAuth } from '@/lib/auth';
import { useCallLauncher } from '@/context/CallLauncherContext';

/**
 * Native right-sidebar profile peek — same data as ProfilePeekDrawer
 * but rendered as embedded sidebar content (opaque openbricks, stackable).
 * Mobile callers can still use ProfilePeekDrawer via openOverlay.
 */
export function ProfileSidebar({
  userId,
  username,
  conversationId,
  seed,
  onClose,
}: {
  userId?: string | null;
  username?: string | null;
  conversationId?: string | null;
  seed?: { displayName?: string; username?: string; bio?: string; avatar?: string } | null;
  onClose?: () => void;
}) {
  const router = useRouter();
  const { user } = useAuth();
  const { openCallLauncher } = useCallLauncher();
  const [profile, setProfile] = useState<any>(seed || null);
  const [avatarUrl, setAvatarUrl] = useState<string | null>(
    seed?.avatar?.startsWith?.('http') ? seed.avatar : null,
  );

  useEffect(() => {
    setProfile(seed || null);
    setAvatarUrl(seed?.avatar?.startsWith?.('http') ? seed.avatar : null);
  }, [seed?.displayName, seed?.username, seed?.bio, seed?.avatar, username, userId]);

  useEffect(() => {
    let cancelled = false;
    const cached = userId ? getCachedIdentityById(userId) : null;
    if (cached && !cancelled) setProfile((prev: any) => prev || cached);
    void (async () => {
      try {
        let row: any = null;
        if (username) row = await UsersService.getProfile(username);
        else if (userId) row = await UsersService.getProfileById(userId);
        if (cancelled || !row) return;
        setProfile(row);
        const avatar = row.avatar;
        if (avatar?.startsWith?.('http')) setAvatarUrl(avatar);
        else if (avatar) {
          try {
            const url = await fetchProfilePreview(avatar, 96, 96);
            if (!cancelled) setAvatarUrl(url as unknown as string);
          } catch {}
        }
      } catch {}
    })();
    return () => {
      cancelled = true;
    };
  }, [userId, username]);

  const name =
    profile?.displayName ||
    seed?.displayName ||
    profile?.username ||
    username ||
    'Someone';
  const handle = profile?.username || username || '';
  const bio = (profile?.bio || seed?.bio || '').trim();
  const shortBio = bio.length > 140 ? `${bio.slice(0, 139).trim()}…` : bio;
  const uid = profile?.userId || profile?.$id || userId;
  const isOwn = Boolean(user?.$id && uid && user.$id === uid);
  const displayName = name.replace(/\s*\(You\)\s*/gi, '').trim() || name;

  const goFullProfile = useCallback(() => {
    if (onClose) onClose();
    if (handle) router.push(`/u/${handle}`);
  }, [handle, onClose, router]);

  const goMessage = () => {
    if (onClose) onClose();
    if (!uid) return;
    if (isOwn) {
      router.push('/connect/chats');
      return;
    }
    if (conversationId) return;
    router.push(`/connect/chats?userId=${encodeURIComponent(uid)}`);
  };

  const goCall = () => {
    if (!uid || isOwn) return;
    if (onClose) onClose();
    const participants = user?.$id ? [user.$id, uid] : [uid];
    openCallLauncher({
      source: 'chat',
      conversationId: conversationId || undefined,
      conversationName: displayName,
      participantIds: participants,
      title: 'Audio Call',
    });
  };

  return (
    <div className="flex h-full min-h-0 flex-col bg-[#0A0908]">
      <div className="flex items-center justify-between border-b border-white/[0.06] bg-[#0A0908] px-5 md:px-6 py-4 md:py-5 shrink-0">
        <p className="text-[10px] font-bold uppercase tracking-wider text-white/40 font-mono m-0">Profile</p>
        <div className="flex items-center gap-1">
          <button
            type="button"
            onClick={goFullProfile}
            className="p-1.5 rounded-lg text-[#8E8A86] hover:text-white hover:bg-[#161412]"
            aria-label="Full profile"
            title="Full profile"
          >
            <ChevronUp className="w-5 h-5" />
          </button>
          <button
            type="button"
            onClick={onClose}
            className="p-1.5 rounded-lg text-[#8E8A86] hover:text-white hover:bg-[#161412]"
            aria-label="Close"
          >
            <X className="w-5 h-5" />
          </button>
        </div>
      </div>

      <div className="flex-1 overflow-y-auto px-5 md:px-6 py-6 md:py-8 space-y-4 md:space-y-6 min-h-0">
        <div className="flex items-center gap-4 min-w-0">
          <div className="shrink-0 rounded-full overflow-hidden border border-white/[0.06] bg-[#161412]">
            <IdentityAvatar
              userId={uid || undefined}
              src={avatarUrl?.startsWith?.('http') ? avatarUrl : null}
              fileId={avatarUrl?.startsWith?.('http') ? null : avatarUrl || profile?.avatar || null}
              alt={displayName}
              fallback={displayName.replace(/^@/, '').charAt(0).toUpperCase() || '?'}
              size={64}
            />
          </div>
          <div className="min-w-0 flex-1 overflow-hidden">
            <h3 className="text-lg font-black font-clash text-white truncate m-0">
              {displayName}
              {isOwn ? <span className="text-[#F59E0B] font-bold text-sm ml-1.5">(You)</span> : null}
            </h3>
            {handle ? <p className="text-sm font-mono text-[#F59E0B]/90 truncate m-0 mt-0.5">@{handle}</p> : null}
          </div>
        </div>

        {shortBio ? (
          <p className="text-sm text-white/70 font-satoshi leading-relaxed m-0 break-words [overflow-wrap:anywhere]">{shortBio}</p>
        ) : (
          <p className="text-sm text-white/35 font-satoshi m-0">No bio yet</p>
        )}

        <div className="grid grid-cols-2 gap-2">
          <div className="rounded-xl bg-[#161412] border border-white/[0.06] px-3 py-2.5">
            <p className="text-[10px] font-bold uppercase tracking-wider text-white/35 m-0">Following</p>
            <p className="text-sm font-extrabold text-white m-0 mt-0.5 tabular-nums">
              {profile?.followingCount ?? profile?.stats?.following ?? '—'}
            </p>
          </div>
          <div className="rounded-xl bg-[#161412] border border-white/[0.06] px-3 py-2.5">
            <p className="text-[10px] font-bold uppercase tracking-wider text-white/35 m-0">Followers</p>
            <p className="text-sm font-extrabold text-white m-0 mt-0.5 tabular-nums">
              {profile?.followerCount ?? profile?.stats?.followers ?? '—'}
            </p>
          </div>
        </div>

        {uid ? (
          <div className="grid grid-cols-2 gap-2 pt-1">
            <button
              type="button"
              onClick={goMessage}
              className="h-11 rounded-xl bg-[#F59E0B] text-black font-extrabold text-sm inline-flex items-center justify-center gap-2"
            >
              <MessageSquare size={16} strokeWidth={2.5} />
              {isOwn ? 'Notes to self' : 'Message'}
            </button>
            <button
              type="button"
              onClick={goCall}
              disabled={isOwn}
              className="h-11 rounded-xl bg-[#161412] border border-[#34322F] text-white font-extrabold text-sm inline-flex items-center justify-center gap-2 disabled:opacity-40 disabled:cursor-not-allowed"
            >
              <PhoneCall size={16} strokeWidth={2.5} />
              Call
            </button>
          </div>
        ) : null}

        <button
          type="button"
          onClick={goFullProfile}
          className="w-full h-10 rounded-xl text-[#9B9691] hover:text-white hover:bg-[#161412] border border-transparent hover:border-[#34322F] font-bold text-sm transition-colors"
        >
          View full profile
        </button>
      </div>
    </div>
  );
}
