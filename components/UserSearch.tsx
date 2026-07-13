'use client';

import { useState, useEffect, useCallback, useMemo } from 'react';
import { Search, X, Loader2 } from 'lucide-react';
import { fetchProfilePreview } from '@/lib/profile-preview';
import { IdentityAvatar, computeIdentityFlags } from './common/IdentityBadge';
import { seedIdentityCache } from '@/lib/identity-cache';

function isEmailLike(value?: string | null): boolean {
  if (!value) return false;
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value.trim());
}

function resolveAccountName(user: Record<string, any>): string | null {
  for (const raw of [user.displayName, user.name, user.title]) {
    const value = typeof raw === 'string' ? raw.trim() : '';
    if (!value || isEmailLike(value) || value.startsWith('@')) continue;
    return value;
  }
  return null;
}

function normalizeHandle(raw?: string | null): string | null {
  if (!raw) return null;
  const cleaned = String(raw).trim().replace(/^@+/, '');
  return cleaned || null;
}

function buildCollaboratorSearchLabels(user: Record<string, any>, searchQuery: string) {
  const query = searchQuery.trim();
  const isEmailQuery = isEmailLike(query);

  if ((user as any).isEmailInvite) {
    return { primary: query, secondary: 'Invite via Email' };
  }

  const handle = normalizeHandle(user.username);
  const accountName = resolveAccountName(user);
  const primary = handle || accountName || 'Kylrix User';

  if (isEmailQuery) {
    const email =
      typeof user.email === 'string' && user.email.trim() ? user.email.trim() : query;
    return { primary, secondary: email };
  }

  const secondary = handle && accountName ? accountName : '';
  return { primary, secondary };
}

interface User {
  id: string;
  title: string;
  subtitle: string;
  avatar?: string | null;
  profilePicId?: string | null;
  displayName?: string;
  username?: string;
  publicKey?: string | null;
}

interface UserSearchProps {
  label?: string;
  placeholder?: string;
  selectedUsers: User[];
  onSelect: (user: User) => void;
  onRemove: (userId: string) => void;
  excludeIds?: string[];
  multiple?: boolean;
  inlineResults?: boolean;
}

export default function UserSearch({
  label = 'ASSIGN TO',
  placeholder = 'Search by name or @username',
  selectedUsers,
  onSelect,
  onRemove,
  excludeIds = [],
  multiple: _multiple = true,
  inlineResults = false
}: UserSearchProps) {
  const [query, setQuery] = useState('');
  const [rawResults, setRawResults] = useState<User[]>([]);
  const [isSearching, setIsSearching] = useState(false);

  const results = useMemo(() => {
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    const items = rawResults.filter((u: any) => 
      !selectedUsers.some(s => s.id === u.id) && 
      !excludeIds.includes(u.id)
    );
    const trimmedQuery = query.trim();
    if (emailRegex.test(trimmedQuery) && !isSearching && items.length === 0) {
      items.unshift({
        id: trimmedQuery,
        title: trimmedQuery,
        subtitle: 'Invite via Email',
        avatar: null,
        profilePicId: null,
        email: trimmedQuery,
        isEmailInvite: true
      } as any);
    }
    return items;
  }, [rawResults, selectedUsers, excludeIds, query, isSearching]);

  const debouncedSearch = useCallback(async (searchQuery: string) => {
    if (!searchQuery.trim() || searchQuery.length < 2) {
      setRawResults([]);
      return;
    }

    setIsSearching(true);
    try {
      const { searchGlobalUsers } = await import('@/lib/ecosystem/identity');
      const res = await searchGlobalUsers(searchQuery);
      const nextRows = Array.isArray(res) ? res : (res as any)?.rows || [];
      
      // Seed identity cache
      nextRows.forEach((u: any) => seedIdentityCache(u));

      const normalized = nextRows.map((u: any) => {
        const labels = buildCollaboratorSearchLabels(u, searchQuery);
        return {
          ...u,
          id: u.id || u.userId || u.$id,
          title: labels.primary,
          subtitle: labels.secondary,
          displayName: resolveAccountName(u) || undefined,
          username: normalizeHandle(u.username) || undefined,
          avatar: u.avatar || null,
          profilePicId: u.avatar || null,
          email: isEmailLike(searchQuery) ? (u.email || undefined) : undefined,
        };
      });
      setRawResults(normalized as User[]);
    } catch (err) {
      console.error('User search failed:', err);
      setRawResults([]);
    } finally {
      setIsSearching(false);
    }
  }, []);

  useEffect(() => {
    const timer = setTimeout(() => {
      debouncedSearch(query);
    }, 300);
    return () => clearTimeout(timer);
  }, [query, debouncedSearch]);

  const handleSelect = (user: User) => {
    onSelect(user);
    setQuery('');
    setRawResults([]);
  };

  return (
    <div className="flex flex-col gap-2.5 w-full">
      {label && (
        <span className="text-[10px] font-black text-white/30 tracking-wider uppercase block font-satoshi">
          {label}
        </span>
      )}

      {/* Selected Users Chips */}
      {selectedUsers.length > 0 && (
        <div className="flex flex-wrap gap-2 mb-1">
          {selectedUsers.map((user) => (
            <div
              key={user.id}
              className="flex items-center gap-2 pl-2 pr-1.5 py-1 bg-white/3 border border-white/8 text-[#F2F2F2] font-semibold text-xs rounded-xl transition-all"
            >
              <IdentityAvatar 
                fileId={user.profilePicId || user.avatar || null}
                alt={user.title}
                fallback={(user.title || user.subtitle || 'U').charAt(0).toUpperCase()}
                verified={computeIdentityFlags({
                  createdAt: (user as any).$createdAt || (user as any).createdAt || null,
                  lastUsernameEdit: (user as any).last_username_edit || null,
                  profilePicId: (user as any).profilePicId || (user as any).avatar || null,
                  username: (user as any).username || null,
                  bio: (user as any).bio || null,
                  tier: (user as any).tier || null,
                  publicKey: (user as any).publicKey || null,
                }).verified}
                pro={computeIdentityFlags({
                  createdAt: (user as any).$createdAt || (user as any).createdAt || null,
                  lastUsernameEdit: (user as any).last_username_edit || null,
                  profilePicId: (user as any).profilePicId || (user as any).avatar || null,
                  username: (user as any).username || null,
                  bio: (user as any).bio || null,
                  tier: (user as any).tier || null,
                  publicKey: (user as any).publicKey || null,
                }).pro}
                size={20}
                userId={user.id}
                isAvatar={(user as any).isAvatar}
                isPublic={(user as any).isPublic}
                isGuest={(user as any).isGuest}
                displayName={user.displayName || (user as any).displayName}
                username={user.username || (user as any).username}
                accountName={(user as any).name || (user as any).displayName}
                email={(user as any).email}
              />
              <span className="font-satoshi text-xs font-bold leading-none">{user.title}</span>
              <button
                type="button"
                onClick={() => onRemove(user.id)}
                className="text-white/40 hover:text-[#FF4D4D] transition-colors p-0.5 rounded-md hover:bg-white/5"
              >
                <X size={12} />
              </button>
            </div>
          ))}
        </div>
      )}

      {/* Input container */}
      <div className="relative w-full">
        <div className="relative flex items-center bg-white/2 border border-white/5 rounded-xl px-4 py-2.5 text-sm text-[#F2F2F2] transition hover:bg-white/4 focus-within:bg-white/5 focus-within:border-amber-500/50 focus-within:ring-2 focus-within:ring-amber-500/10">
          <Search size={16} className="text-white/25 mr-2.5 shrink-0" />
          <input
            type="text"
            className="w-full bg-transparent border-none outline-none text-[#F2F2F2] placeholder-white/30 text-xs font-semibold"
            placeholder={placeholder}
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            autoComplete="off"
          />
          {isSearching ? (
            <Loader2 size={16} className="text-amber-500 animate-spin shrink-0" />
          ) : query ? (
            <button
              type="button"
              onClick={() => setQuery('')}
              className="text-white/30 hover:text-white transition-colors shrink-0 p-0.5 rounded hover:bg-white/5"
            >
              <X size={16} />
            </button>
          ) : null}
        </div>

        {/* Results List */}
        {query.length >= 2 && results.length > 0 && (
          <div
            className={
              inlineResults
                ? 'mt-2 bg-[#161412]/98 border border-white/8 rounded-2xl max-h-60 overflow-y-auto z-10'
                : 'absolute top-[calc(100%+8px)] left-0 right-0 z-[100] bg-[#0A0908]/98 backdrop-blur-md border border-white/10 rounded-2xl max-h-70 overflow-y-auto shadow-2xl shadow-black/80'
            }
          >
            <div className="flex flex-col">
              {results.map((user) => (
                <button
                  key={user.id}
                  type="button"
                  onClick={() => handleSelect(user)}
                  className="w-full flex items-center gap-3 px-4 py-3.5 text-left hover:bg-white/5 transition-colors border-none bg-transparent cursor-pointer"
                >
                  <div className="shrink-0">
                    <IdentityAvatar
                      fileId={user.profilePicId || user.avatar || null}
                      alt={user.title}
                      fallback={(user.displayName || user.username || user.title || 'U').charAt(0).toUpperCase()}
                      verified={computeIdentityFlags({
                        createdAt: (user as any).$createdAt || (user as any).createdAt || null,
                        lastUsernameEdit: (user as any).last_username_edit || null,
                        profilePicId: (user as any).profilePicId || (user as any).avatar || null,
                        username: (user as any).username || null,
                        bio: (user as any).bio || null,
                        tier: (user as any).tier || null,
                        publicKey: (user as any).publicKey || null,
                      }).verified}
                      pro={computeIdentityFlags({
                        createdAt: (user as any).$createdAt || (user as any).createdAt || null,
                        lastUsernameEdit: (user as any).last_username_edit || null,
                        profilePicId: (user as any).profilePicId || (user as any).avatar || null,
                        username: (user as any).username || null,
                        bio: (user as any).bio || null,
                        tier: (user as any).tier || null,
                        publicKey: (user as any).publicKey || null,
                      }).pro}
                      size={32}
                      userId={user.id}
                      isAvatar={(user as any).isAvatar}
                      isPublic={(user as any).isPublic}
                      isGuest={(user as any).isGuest}
                      displayName={user.displayName || (user as any).displayName}
                      username={user.username || (user as any).username}
                      accountName={(user as any).name || (user as any).displayName}
                      email={(user as any).email}
                    />
                  </div>
                  <div className="flex-1 min-w-0 flex flex-col gap-0.5">
                    <span className="font-extrabold text-xs text-white truncate font-satoshi">
                      {user.title}
                    </span>
                    {user.subtitle ? (
                      <span className="text-[10px] text-white/45 truncate font-bold font-satoshi">
                        {user.subtitle}
                      </span>
                    ) : null}
                  </div>
                </button>
              ))}
            </div>
          </div>
        )}

        {query.length >= 2 && results.length === 0 && !isSearching && (
          <div
            className={
              inlineResults
                ? 'mt-2 bg-[#161412]/98 border border-white/8 rounded-2xl p-4 text-center z-10'
                : 'absolute top-[calc(100%+8px)] left-0 right-0 z-[100] bg-[#0A0908]/98 backdrop-blur-md border border-white/10 rounded-2xl p-4 text-center shadow-2xl shadow-black/80'
            }
          >
            <p className="text-xs text-white/40 font-bold font-satoshi">
              No entities matching &quot;{query}&quot; found
            </p>
          </div>
        )}
      </div>
    </div>
  );
}
