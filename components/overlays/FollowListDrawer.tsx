'use client';

import React, { useEffect, useState, useCallback } from 'react';
import { X, Users, UserPlus, UserCheck, Loader2, Search } from 'lucide-react';
import { fetchNostrFollowers, fetchNostrFollowing, toggleNostrFollow } from '@/lib/nostr/user-activity';
import { getCachedNostrProfile, queueNostrProfileFetch } from '@/lib/nostr/metadata';
import { useNostrIdentity } from '@/hooks/useNostrIdentity';
import { useAuth } from '@/context/auth/AuthContext';
import { bytesToHex, npubToBytes, bytesToNpub, hexToBytes } from '@/lib/nostr/crypto';
import toast from 'react-hot-toast';

export interface FollowListDrawerProps {
  pubkey?: string;
  npub?: string;
  type?: 'followers' | 'following';
  targetName?: string;
  onClose?: () => void;
}

interface UserItem {
  pubkey: string;
  npub: string;
  name?: string;
  displayName?: string;
  about?: string;
  picture?: string;
  nip05?: string;
}

export function FollowListDrawer({
  pubkey: initialPubkey,
  npub: initialNpub,
  type = 'followers',
  targetName = 'User',
  onClose,
}: FollowListDrawerProps) {
  const { identity } = useNostrIdentity();
  const { user } = useAuth();

  const [loading, setLoading] = useState(true);
  const [users, setUsers] = useState<UserItem[]>([]);
  const [myFollowing, setMyFollowing] = useState<Set<string>>(new Set());
  const [searchQuery, setSearchQuery] = useState('');
  const [togglingPubkeys, setTogglingPubkeys] = useState<Set<string>>(new Set());

  // Resolve target hex pubkey
  let targetHex = initialPubkey || '';
  if (!targetHex && initialNpub) {
    try {
      targetHex = bytesToHex(npubToBytes(initialNpub));
    } catch {}
  } else if (targetHex.startsWith('npub')) {
    try {
      targetHex = bytesToHex(npubToBytes(targetHex));
    } catch {}
  }

  // Resolve own hex pubkey
  const myHex = identity?.pubkeyHex || (user?.prefs?.nostrPubkey ? String(user.prefs.nostrPubkey) : null);

  // Load list of followers or following
  const loadList = useCallback(async () => {
    if (!targetHex) {
      setLoading(false);
      return;
    }
    setLoading(true);
    try {
      let rawPubkeys: string[] = [];

      if (type === 'followers') {
        const followers = await fetchNostrFollowers(targetHex, 4000);
        rawPubkeys = followers.map((f) => f.pubkey.toLowerCase());
      } else {
        const following = await fetchNostrFollowing(targetHex, 4000);
        rawPubkeys = following.map((p) => p.toLowerCase());
      }

      const uniquePubkeys = Array.from(new Set(rawPubkeys));

      // Build initial user items
      const items: UserItem[] = uniquePubkeys.map((pk) => {
        let npubStr = '';
        try {
          npubStr = bytesToNpub(hexToBytes(pk));
        } catch {
          npubStr = pk;
        }
        const cached = getCachedNostrProfile(pk);
        return {
          pubkey: pk,
          npub: npubStr,
          name: cached?.name,
          displayName: cached?.displayName,
          about: cached?.about,
          picture: cached?.picture,
          nip05: cached?.nip05,
        };
      });

      setUsers(items);

      // Queue metadata fetch for all pubkeys
      if (uniquePubkeys.length > 0) {
        void queueNostrProfileFetch(uniquePubkeys);
      }
    } catch (err) {
      console.warn('[FollowListDrawer] Failed to fetch list:', err);
    } finally {
      setLoading(false);
    }
  }, [targetHex, type]);

  // Load current user's own following list
  useEffect(() => {
    let cancelled = false;
    const syncMyFollowing = async () => {
      if (!myHex) {
        // Fallback to local storage cache
        try {
          const { LocalEngine } = await import('@/lib/services/LocalEngine');
          const cached = await LocalEngine.cacheGet<string[]>('kylrix:follows');
          if (cached && Array.isArray(cached) && !cancelled) {
            setMyFollowing(new Set(cached.map((p) => p.toLowerCase())));
          }
        } catch {}
        return;
      }
      try {
        const following = await fetchNostrFollowing(myHex, 3500);
        if (!cancelled) {
          setMyFollowing(new Set(following.map((p) => p.toLowerCase())));
        }
      } catch {}
    };
    void syncMyFollowing();
    return () => {
      cancelled = true;
    };
  }, [myHex]);

  useEffect(() => {
    void loadList();
  }, [loadList]);

  // Periodic metadata update for cached profiles
  useEffect(() => {
    if (!users.length) return;
    const interval = setInterval(() => {
      setUsers((prev) =>
        prev.map((u) => {
          if (u.name || u.picture) return u;
          const cached = getCachedNostrProfile(u.pubkey);
          if (cached && (cached.name || cached.picture)) {
            return {
              ...u,
              name: cached.name,
              displayName: cached.displayName,
              about: cached.about,
              picture: cached.picture,
              nip05: cached.nip05,
            };
          }
          return u;
        })
      );
    }, 1200);
    return () => clearInterval(interval);
  }, [users.length]);

  const handleToggleFollow = async (itemPubkey: string) => {
    const isCurrentlyFollowing = myFollowing.has(itemPubkey.toLowerCase());
    setTogglingPubkeys((prev) => new Set(prev).add(itemPubkey));

    try {
      const privKey = identity?.privateKeyBytes || identity?.nsec || user?.prefs?.nostrNsec;
      if (!privKey) {
        toast.error('Sign in or unlock vault to follow on Nostr');
        setTogglingPubkeys((prev) => {
          const next = new Set(prev);
          next.delete(itemPubkey);
          return next;
        });
        return;
      }

      const res = await toggleNostrFollow(itemPubkey, !isCurrentlyFollowing, privKey);
      if (res.success) {
        setMyFollowing((prev) => {
          const next = new Set(prev);
          if (isCurrentlyFollowing) {
            next.delete(itemPubkey.toLowerCase());
          } else {
            next.add(itemPubkey.toLowerCase());
          }
          return next;
        });
        toast.success(isCurrentlyFollowing ? 'Unfollowed' : 'Following on Nostr');
      }
    } catch (err: any) {
      toast.error(err?.message || 'Could not update follow status');
    } finally {
      setTogglingPubkeys((prev) => {
        const next = new Set(prev);
        next.delete(itemPubkey);
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
      u.npub.toLowerCase().includes(q) ||
      u.nip05?.toLowerCase().includes(q) ||
      u.pubkey.toLowerCase().includes(q)
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
            title="Close"
          >
            <X size={16} />
          </button>
        )}
      </header>

      {/* Search Input */}
      {users.length > 5 && (
        <div className="px-5 pt-3 pb-1 shrink-0">
          <div className="relative">
            <Search size={14} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-white/40" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search followers or following…"
              className="w-full bg-[#000000] border border-white/20 rounded-xl pl-9 pr-3 py-2 text-xs text-white placeholder-white/30 focus:outline-none focus:border-[#A855F7]/60 transition-colors"
            />
          </div>
        </div>
      )}

      {/* List Body */}
      <main className="flex-1 overflow-y-auto p-5 space-y-2.5 min-h-0 select-text">
        {loading ? (
          <div className="flex flex-col items-center justify-center py-16 gap-3 text-white/40">
            <Loader2 size={24} className="animate-spin text-[#A855F7]" />
            <span className="text-xs font-mono">Fetching Nostr contact list…</span>
          </div>
        ) : filteredUsers.length === 0 ? (
          <div className="py-16 text-center text-white/40 text-xs font-mono">
            {searchQuery ? 'No matching users found' : `No ${type} found on Nostr relays`}
          </div>
        ) : (
          filteredUsers.map((item) => {
            const isSelf = myHex && item.pubkey.toLowerCase() === myHex.toLowerCase();
            const isFollowingItem = myFollowing.has(item.pubkey.toLowerCase());
            const isToggling = togglingPubkeys.has(item.pubkey);
            const title = item.displayName || item.name || `${item.npub.slice(0, 10)}…${item.npub.slice(-4)}`;

            return (
              <div
                key={item.pubkey}
                className="flex items-center justify-between gap-3 p-3 rounded-2xl bg-[#000000] border border-white/20 hover:border-white/40 transition-all shadow-sm"
              >
                {/* User Info */}
                <div className="flex items-center gap-3 min-w-0 flex-1">
                  {item.picture ? (
                    <img
                      src={item.picture}
                      alt={title}
                      className="w-10 h-10 rounded-xl object-cover border border-white/10 shrink-0 bg-[#161412]"
                      onError={(e) => {
                        (e.target as HTMLElement).style.display = 'none';
                      }}
                    />
                  ) : (
                    <div className="w-10 h-10 rounded-xl bg-gradient-to-tr from-[#6366F1]/30 to-[#A855F7]/30 border border-white/10 flex items-center justify-center text-white font-bold text-sm shrink-0 font-clash">
                      {title.charAt(0).toUpperCase()}
                    </div>
                  )}

                  <div className="min-w-0 flex-1 space-y-0.5">
                    <div className="flex items-center gap-1.5 min-w-0">
                      <span className="text-xs sm:text-sm font-bold text-white truncate font-clash">
                        {title}
                      </span>
                    </div>
                    <p className="text-[11px] font-mono text-white/40 truncate">
                      {item.nip05 || `@${item.npub.slice(0, 12)}…`}
                    </p>
                  </div>
                </div>

                {/* Follow/Unfollow Action Button */}
                {isSelf ? (
                  <span className="px-2.5 py-1 rounded-lg bg-[#6366F1]/20 text-[#818CF8] text-[10px] font-bold font-mono shrink-0">
                    YOU
                  </span>
                ) : (
                  <button
                    type="button"
                    disabled={isToggling}
                    onClick={() => handleToggleFollow(item.pubkey)}
                    className={`inline-flex items-center gap-1 px-3 py-1.5 rounded-xl text-xs font-extrabold transition-all shrink-0 cursor-pointer ${
                      isFollowingItem
                        ? 'bg-[#161412] text-[#10B981] border border-[#10B981]/30 hover:bg-rose-500/20 hover:text-rose-400 hover:border-rose-500/30'
                        : 'bg-[#F59E0B] text-black hover:bg-[#d97706]'
                    }`}
                  >
                    {isToggling ? (
                      <Loader2 size={13} className="animate-spin" />
                    ) : isFollowingItem ? (
                      <>
                        <UserCheck size={13} />
                        <span>Following</span>
                      </>
                    ) : (
                      <>
                        <UserPlus size={13} />
                        <span>Follow</span>
                      </>
                    )}
                  </button>
                )}
              </div>
            );
          })
        )}
      </main>
    </div>
  );
}
