'use client';

import React, { useCallback, useEffect, useState } from 'react';
import { createPortal } from 'react-dom';
import { useRouter } from 'next/navigation';
import { ChevronUp, MessageSquare, PhoneCall, X } from 'lucide-react';
import { IdentityAvatar } from '@/components/IdentityBadge';
import { UsersService } from '@/lib/services/users';
import { fetchProfilePreview } from '@/lib/profile-preview';
import { getCachedIdentityById } from '@/lib/identity-cache';
import { useAuth } from '@/lib/auth';
import { useCallLauncher } from '@/context/CallLauncherContext';

type Props = {
  open: boolean;
  onClose: () => void;
  userId?: string | null;
  username?: string | null;
  /** When peeking from an open chat, call uses this conversation */
  conversationId?: string | null;
  /** Optional seed so the sheet paints before network */
  seed?: {
    displayName?: string;
    username?: string;
    bio?: string;
    avatar?: string;
  } | null;
};

/**
 * Compact profile peek — miniature /u/[username].
 * Expand → navigates to full profile page.
 */
export function ProfilePeekDrawer({
  open,
  onClose,
  userId,
  username,
  conversationId,
  seed,
}: Props) {
  const router = useRouter();
  const { user } = useAuth();
  const { openCallLauncher } = useCallLauncher();
  const [mounted, setMounted] = useState(false);
  const [expanded, setExpanded] = useState(false);
  const [profile, setProfile] = useState<any>(seed || null);
  const [avatarUrl, setAvatarUrl] = useState<string | null>(
    seed?.avatar?.startsWith?.('http') ? seed.avatar : null,
  );

  useEffect(() => {
    setMounted(true);
  }, []);

  useEffect(() => {
    if (!open) {
      setExpanded(false);
      return;
    }
    document.body.style.overflow = 'hidden';
    return () => {
      document.body.style.overflow = '';
    };
  }, [open]);

  useEffect(() => {
    if (!open) return;
    setProfile(seed || null);
    setAvatarUrl(seed?.avatar?.startsWith?.('http') ? seed.avatar : null);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, userId, username, seed?.displayName, seed?.username, seed?.bio, seed?.avatar]);

  useEffect(() => {
    if (!open) return;
    let cancelled = false;

    const cached = userId ? getCachedIdentityById(userId) : null;
    if (cached && !cancelled) {
      setProfile((prev: any) => prev || cached);
    }

    void (async () => {
      try {
        let row: any = null;
        if (username) row = await UsersService.getProfile(username);
        else if (userId) row = await UsersService.getProfileById(userId);
        if (cancelled || !row) return;
        setProfile(row);
        const avatar = row.avatar;
        if (avatar?.startsWith?.('http')) {
          setAvatarUrl(avatar);
        } else if (avatar) {
          try {
            const url = await fetchProfilePreview(avatar, 96, 96);
            if (!cancelled) setAvatarUrl(url as unknown as string);
          } catch {
            /* ignore */
          }
        }
      } catch {
        /* keep seed */
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [open, userId, username]);

  const goFullProfile = useCallback(() => {
    const handle = profile?.username || username;
    onClose();
    if (handle) router.push(`/u/${handle}`);
  }, [profile?.username, username, onClose, router]);



  if (!mounted || !open) return null;

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

  const goMessage = () => {
    onClose();
    if (!uid) return;
    if (isOwn) {
      router.push('/connect/chats');
      return;
    }
    if (conversationId) {
      // Already in this chat — just dismiss peek
      return;
    }
    router.push(`/connect/chats?userId=${encodeURIComponent(uid)}`);
  };

  const goCall = () => {
    if (!uid || isOwn) return;
    onClose();
    const participants = user?.$id ? [user.$id, uid] : [uid];
    openCallLauncher({
      source: 'chat',
      conversationId: conversationId || undefined,
      conversationName: displayName,
      participantIds: participants,
      title: 'Audio Call',
    });
  };

  const sheet = (
    <div className="fixed inset-0 z-[10020] flex justify-center overflow-hidden pointer-events-none">
      <button
        type="button"
        aria-label="Close"
        className="absolute inset-0 bg-black/60 pointer-events-auto"
        onClick={onClose}
      />
      <div
        className={`fixed bg-[#161412] border-[#34322F] pointer-events-auto transition-all duration-300 flex flex-col z-[10021] ${
          expanded
            ? 'inset-0 h-[100dvh] max-h-[100dvh] w-full rounded-none border-0'
            : 'inset-x-0 bottom-0 h-auto max-h-[70dvh] border-t rounded-t-[28px] w-full max-w-[720px] left-1/2 -translate-x-1/2'
        }`}
      >
        <div className="flex items-center justify-between px-5 pt-4 pb-2 shrink-0">
          <p className="text-[10px] font-bold uppercase tracking-wider text-white/40 font-mono m-0">
            Profile
          </p>
          <div className="flex items-center gap-1">
            <button
              type="button"
              onClick={goFullProfile}
              className="p-1.5 rounded-lg text-[#8E8A86] hover:text-white hover:bg-[#0A0908]"
              aria-label="Full profile"
              title="Full profile"
            >
              <ChevronUp className="w-5 h-5" />
            </button>
            <button
              type="button"
              onClick={onClose}
              className="p-1.5 rounded-lg text-[#8E8A86] hover:text-white hover:bg-[#0A0908]"
              aria-label="Close"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        <div className="px-5 pb-6 overflow-y-auto min-h-0 space-y-4">
          <div className="flex items-center gap-4 min-w-0">
            <div className="shrink-0 rounded-full overflow-hidden border border-white/[0.06] bg-[#0A0908]">
              <IdentityAvatar
                userId={uid || undefined}
                src={avatarUrl?.startsWith?.('http') ? avatarUrl : null}
                fileId={
                  avatarUrl?.startsWith?.('http')
                    ? null
                    : avatarUrl || profile?.avatar || null
                }
                alt={displayName}
                fallback={displayName.replace(/^@/, '').charAt(0).toUpperCase() || '?'}
                size={64}
              />
            </div>
            <div className="min-w-0 flex-1 overflow-hidden">
              <h3 className="text-lg font-black font-clash text-white truncate m-0">
                {displayName}
                {isOwn ? (
                  <span className="text-[#F59E0B] font-bold text-sm ml-1.5">(You)</span>
                ) : null}
              </h3>
              {handle ? (
                <p className="text-sm font-mono text-[#F59E0B]/90 truncate m-0 mt-0.5">@{handle}</p>
              ) : null}
            </div>
          </div>

          {shortBio ? (
            <p className="text-sm text-white/70 font-satoshi leading-relaxed m-0 break-words [overflow-wrap:anywhere]">
              {shortBio}
            </p>
          ) : (
            <p className="text-sm text-white/35 font-satoshi m-0">No bio yet</p>
          )}

          <div className="grid grid-cols-2 gap-2">
            <div className="rounded-xl bg-[#0A0908] border border-white/[0.06] px-3 py-2.5">
              <p className="text-[10px] font-bold uppercase tracking-wider text-white/35 m-0">Following</p>
              <p className="text-sm font-extrabold text-white m-0 mt-0.5 tabular-nums">
                {profile?.followingCount ?? profile?.stats?.following ?? '—'}
              </p>
            </div>
            <div className="rounded-xl bg-[#0A0908] border border-white/[0.06] px-3 py-2.5">
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
                className="h-11 rounded-xl bg-[#0A0908] border border-[#34322F] text-white font-extrabold text-sm inline-flex items-center justify-center gap-2 disabled:opacity-40 disabled:cursor-not-allowed"
              >
                <PhoneCall size={16} strokeWidth={2.5} />
                Call
              </button>
            </div>
          ) : null}

          <button
            type="button"
            onClick={goFullProfile}
            className="w-full h-10 rounded-xl text-[#9B9691] hover:text-white hover:bg-[#0A0908] border border-transparent hover:border-[#34322F] font-bold text-sm transition-colors"
          >
            View full profile
          </button>
        </div>
      </div>
    </div>
  );

  return createPortal(sheet, document.body);
}
