'use client';

import React, { useEffect, useState, useCallback } from 'react';
import { Users, UserPlus, UserCheck, Loader2, Search, X } from 'lucide-react';
import { useAuth } from '@/context/auth/AuthContext';
import { SocialService } from '@/lib/services/social';
import toast from 'react-hot-toast';

export interface FollowListDrawerProps {
  userId?: string;
  type?: 'followers' | 'following';
  targetName?: string;
  onClose?: () => void;
}

interface UserItem {
  userId: string;
  name?: string;
  displayName?: string;
  username?: string;
  bio?: string;
  avatar?: string;
}

export function FollowListDrawer({
  userId,
  type = 'followers',
  targetName = 'User',
  onClose,
}: FollowListDrawerProps) {
  const { user } = useAuth();

  const [loading, setLoading] = useState(true);
  const [users, setUsers] = useState<UserItem[]>([]);
  const [myFollowing, setMyFollowing] = useState<Set<string>>(new Set());
  const [searchQuery, setSearchQuery] = useState('');
  const [togglingIds, setTogglingIds] = useState<Set<string>>(new Set());

  const targetId = userId || user?.$id;

  const loadList = useCallback(async () => {
    if (!targetId) {
      setLoading(false);
      return;
    }
    setLoading(true);
    try {
      let rawProfiles: any[] = [];
      if (type === 'followers') {
        rawProfiles = await SocialService.getFollowers(targetId, user?.$id);
      } else {
        rawProfiles = await SocialService.getFollowing(targetId, user?.$id);
      }

      const items: UserItem[] = (rawProfiles || []).map((p) => ({
        userId: p.userId || p.$id || p.id,
        name: p.name || p.displayName,
        displayName: p.displayName || p.name,
        username: p.username,
        bio: p.bio,
        avatar: p.avatar || p.avatarUrl,
      }));

      setUsers(items);
    } catch (err) {
      console.warn('[FollowListDrawer] Failed to fetch list:', err);
    } finally {
      setLoading(false);
    }
  }, [targetId, type, user?.$id]);

  useEffect(() => {
    void loadList();
  }, [loadList]);

  // Load current user's following list
  useEffect(() => {
    if (!user?.$id) return;
    SocialService.getFollowing(user.$id)
      .then((res) => {
        const ids = new Set<string>((res || []).map((p: any) => p.userId || p.$id));
        setMyFollowing(ids);
      })
      .catch(() => {});
  }, [user?.$id]);

  const handleToggleFollow = async (itemUserId: string) => {
    if (!user?.$id) {
      toast.error('Please sign in to follow users');
      return;
    }
    const isCurrentlyFollowing = myFollowing.has(itemUserId);
    setTogglingIds((prev) => new Set(prev).add(itemUserId));

    try {
      if (isCurrentlyFollowing) {
        await SocialService.unfollowUser(user.$id, itemUserId);
        setMyFollowing((prev) => {
          const next = new Set(prev);
          next.delete(itemUserId);
          return next;
        });
        toast.success('Unfollowed');
      } else {
        await SocialService.followUser(user.$id, itemUserId);
        setMyFollowing((prev) => {
          const next = new Set(prev);
          next.add(itemUserId);
          return next;
        });
        toast.success('Following');
      }
    } catch (err: any) {
      toast.error(err?.message || 'Could not update follow status');
    } finally {
      setTogglingIds((prev) => {
        const next = new Set(prev);
        next.delete(itemUserId);
        return next;
      });
    }
  };

  const filteredUsers = users.filter((u) => {
    if (!searchQuery.trim()) return true;
    const q = searchQuery.toLowerCase();
    return (
      u.name?.toLowerCase().includes(q) ||
      u.displayName?.toLowerCase().includes(q) ||
      u.username?.toLowerCase().includes(q) ||
      u.userId.toLowerCase().includes(q)
    );
  });

  return (
    <div className="flex flex-col h-full bg-[#161412] text-white select-none font-satoshi overflow-hidden">
      {/* Header */}
      <header className="flex items-center justify-between px-5 py-4 border-b border-white/20 bg-[#161412] shrink-0 z-10">
        <div className="flex items-center gap-3 min-w-0">
          <div className="w-9 h-9 rounded-xl bg-[#000000] border border-white/20 flex items-center justify-center text-[#A855F7] shrink-0 shadow-sm">
            <Users size={18} />
          </div>
          <div className="min-w-0">
            <h2 className="text-base font-black font-clash text-white truncate leading-tight">
              {type === 'followers' ? 'Followers' : 'Following'}
            </h2>
            <p className="text-xs font-mono text-white/50 truncate mt-0.5">
              {targetName} • {users.length} {type}
            </p>
          </div>
        </div>

        {onClose && (
          <button
            type="button"
            onClick={onClose}
            className="p-2 rounded-xl bg-[#000000] border border-white/20 text-white/60 hover:text-white hover:bg-white/5 transition-colors cursor-pointer"
            aria-label="Close"
          >
            <X size={18} />
          </button>
        )}
      </header>

      {/* Search Input */}
      <div className="p-3 border-b border-white/10 bg-[#161412]">
        <div className="relative">
          <Search size={14} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-white/40 pointer-events-none" />
          <input
            type="text"
            placeholder="Search users…"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full pl-9 pr-3 py-2 bg-[#000000] border border-white/20 rounded-xl text-xs text-white placeholder-white/40 focus:outline-none focus:border-[#A855F7] transition-colors"
          />
        </div>
      </div>

      {/* Body List */}
      <div className="flex-1 overflow-y-auto min-h-0 p-3 space-y-2">
        {loading ? (
          <div className="py-12 flex flex-col items-center justify-center text-white/40 gap-2">
            <Loader2 size={24} className="animate-spin text-[#A855F7]" />
            <span className="text-xs font-mono">Loading…</span>
          </div>
        ) : filteredUsers.length === 0 ? (
          <div className="py-12 text-center text-white/40 text-xs font-mono">
            {searchQuery ? 'No matching users found' : `No ${type} yet`}
          </div>
        ) : (
          filteredUsers.map((item) => {
            const isMe = user?.$id === item.userId;
            const isFollowingItem = myFollowing.has(item.userId);
            const isToggling = togglingIds.has(item.userId);

            return (
              <div
                key={item.userId}
                className="flex items-center justify-between p-3 rounded-2xl bg-[#000000] border border-white/10 hover:border-white/20 transition-all gap-3"
              >
                <div className="flex items-center gap-3 min-w-0 flex-1">
                  {item.avatar ? (
                    <img
                      src={item.avatar}
                      alt={item.displayName || item.name || 'User'}
                      className="w-10 h-10 rounded-xl object-cover border border-white/10 shrink-0"
                    />
                  ) : (
                    <div className="w-10 h-10 rounded-xl bg-gradient-to-tr from-amber-500/20 to-pink-500/20 border border-white/10 flex items-center justify-center text-white text-sm font-bold font-clash shrink-0">
                      {(item.displayName || item.name || 'U').charAt(0).toUpperCase()}
                    </div>
                  )}

                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-bold text-white truncate leading-tight">
                      {item.displayName || item.name || 'User'}
                    </p>
                    {item.username && (
                      <p className="text-xs text-white/50 font-mono truncate">
                        @{item.username}
                      </p>
                    )}
                    {item.bio && (
                      <p className="text-xs text-white/60 line-clamp-1 mt-0.5">
                        {item.bio}
                      </p>
                    )}
                  </div>
                </div>

                {!isMe && (
                  <button
                    type="button"
                    onClick={() => handleToggleFollow(item.userId)}
                    disabled={isToggling}
                    className={`shrink-0 inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-bold transition-all cursor-pointer ${
                      isFollowingItem
                        ? 'bg-[#161412] text-[#10B981] border border-[#10B981]/30 hover:border-rose-500/30 hover:text-rose-400'
                        : 'bg-[#F59E0B] text-black hover:bg-[#d97706]'
                    }`}
                  >
                    {isToggling ? (
                      <Loader2 size={12} className="animate-spin" />
                    ) : isFollowingItem ? (
                      <UserCheck size={12} />
                    ) : (
                      <UserPlus size={12} />
                    )}
                    <span>{isFollowingItem ? 'Following' : 'Follow'}</span>
                  </button>
                )}
              </div>
            );
          })
        )}
      </div>
    </div>
  );
}
