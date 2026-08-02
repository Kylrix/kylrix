'use client';

import React, { useCallback, useEffect, useState } from 'react';
import { createPortal } from 'react-dom';
import { useRouter } from 'next/navigation';
import { ChevronUp, MessageSquare, UserPlus, X } from 'lucide-react';
import { IdentityAvatar } from '@/components/IdentityBadge';
import { UsersService } from '@/lib/services/users';
import { fetchProfilePreview } from '@/lib/profile-preview';
import { getCachedIdentityById } from '@/lib/identity-cache';

type Props = {
  open: boolean;
  onClose: () => void;
  userId?: string | null;
  username?: string | null;
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
export function ProfilePeekDrawer({ open, onClose, userId, username, seed }: Props) {
  const router = useRouter();
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
    // seed object identity changes every parent render — key off identity fields only
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

  const toggleExpand = useCallback(() => {
    if (expanded) {
      setExpanded(false);
      return;
    }
    // Expanding all the way = open the real profile page
    goFullProfile();
  }, [expanded, goFullProfile]);

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
        <button
          type="button"
          onClick={toggleExpand}
          className="flex justify-center py-2 w-full shrink-0"
          aria-label="Open full profile"
        >
          <span className="w-10 h-1 rounded-full bg-[#3D3A36]" />
        </button>

        <div className="flex items-center justify-between px-5 pb-2 shrink-0">
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
                fileId={avatarUrl || profile?.avatar || null}
                alt={name}
                fallback={name.replace(/^@/, '').charAt(0).toUpperCase() || '?'}
                size={64}
              />
            </div>
            <div className="min-w-0 flex-1 overflow-hidden">
              <h3 className="text-lg font-black font-clash text-white truncate m-0">{name}</h3>
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

          <div className="flex gap-2 pt-1">
            <button
              type="button"
              onClick={goFullProfile}
              className="flex-1 h-11 rounded-xl bg-[#F59E0B] text-black font-extrabold text-sm inline-flex items-center justify-center gap-1.5"
            >
              <UserPlus size={16} />
              View profile
            </button>
            {uid ? (
              <button
                type="button"
                onClick={() => {
                  onClose();
                  router.push(`/connect/chats?userId=${encodeURIComponent(uid)}`);
                }}
                className="h-11 px-4 rounded-xl bg-[#0A0908] border border-[#34322F] text-white font-bold text-sm inline-flex items-center justify-center"
                aria-label="Message"
              >
                <MessageSquare size={16} />
              </button>
            ) : null}
          </div>
        </div>
      </div>
    </div>
  );

  return createPortal(sheet, document.body);
}
