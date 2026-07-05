'use client';

import React, { useState, useEffect } from 'react';
import { useNostrFeed } from '@/hooks/useNostrFeed';
import { useNostrIdentity } from '@/hooks/useNostrIdentity';
import { resolveNostrPubkeysAction } from '@/lib/actions/secure-ops';
import { bytesToNpub, hexToBytes } from '@/lib/tmp/crypto';
import { Heart, MessageCircle, Repeat2, Send, ShieldAlert, Sparkles, Hash, Lock, RefreshCw } from 'lucide-react';
import toast from 'react-hot-toast';

export function NostrFeed() {
  const { identity, loading: identityLoading, isVaultLocked, unlockAndLoad } = useNostrIdentity();
  const { feed, loading: feedLoading, publishPost, refresh, filterTags } = useNostrFeed();
  const [newPostText, setNewPostText] = useState('');
  const [publishing, setPublishing] = useState(false);
  const [resolvedProfiles, setResolvedProfiles] = useState<Record<string, { username: string; avatarUrl?: string }>>({});

  // Resolve profiles from local database mappings asynchronously (UX alignment)
  useEffect(() => {
    if (feed.length === 0) return;

    const unresolvedNpubs = feed
      .map(event => {
        try {
          return bytesToNpub(hexToBytes(event.pubkey));
        } catch {
          return null;
        }
      })
      .filter((n): n is string => !!n && !resolvedProfiles[n]);

    if (unresolvedNpubs.length === 0) return;

    resolveNostrPubkeysAction(unresolvedNpubs).then((res) => {
      if (res && Object.keys(res).length > 0) {
        setResolvedProfiles((prev) => ({ ...prev, ...res }));
      }
    });
  }, [feed, resolvedProfiles]);

  const handlePublish = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newPostText.trim()) return;

    setPublishing(true);
    const success = await publishPost(newPostText);
    setPublishing(false);
    if (success) {
      setNewPostText('');
    }
  };

  const getAuthorDisplay = (pubkeyHex: string) => {
    try {
      const npubStr = bytesToNpub(hexToBytes(pubkeyHex));
      if (resolvedProfiles[npubStr]) {
        return {
          name: `@${resolvedProfiles[npubStr].username}`,
          isEcosystem: true
        };
      }
      return {
        name: `npub...${npubStr.substring(npubStr.length - 8)}`,
        isEcosystem: false
      };
    } catch {
      return {
        name: `npub...${pubkeyHex.substring(pubkeyHex.length - 8)}`,
        isEcosystem: false
      };
    }
  };

  return (
    <div className="w-full flex flex-col gap-6 max-w-2xl mx-auto font-satoshi text-white select-none">
      {/* Curation Indicator */}
      <div className="bg-[#1C1A17] border border-[#F59E0B]/20 rounded-2xl p-4 flex items-center justify-between gap-3 text-xs text-amber-200">
        <div className="flex items-center gap-3">
          <Sparkles size={16} className="text-[#F59E0B] flex-shrink-0" />
          <div>
            <span className="font-bold">Agentic Curation Active:</span> Filtering global relays for tech-centric topics ({filterTags.map(t => `#${t}`).join(', ')}).
          </div>
        </div>
        <button
          onClick={refresh}
          disabled={feedLoading}
          type="button"
          className="p-2 rounded-xl bg-white/5 hover:bg-white/10 text-white/60 hover:text-white transition-all disabled:opacity-50 flex-shrink-0"
          title="Refresh Relays"
        >
          <RefreshCw size={14} className={feedLoading ? 'animate-spin' : ''} />
        </button>
      </div>

      {/* Write Post Box: Gated only for contributing, readable for all */}
      {isVaultLocked ? (
        <div className="bg-[#161412] border border-white/5 rounded-3xl p-5 flex items-center justify-between shadow-lg">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-full bg-white/5 flex items-center justify-center text-white/40">
              <Lock size={16} />
            </div>
            <div className="flex flex-col">
              <span className="text-xs font-bold text-white/80">Contribute to the Town Square</span>
              <span className="text-[10px] text-white/40">Unlock your vault to write and sign encrypted moments.</span>
            </div>
          </div>
          <button
            onClick={unlockAndLoad}
            className="px-4 py-2 bg-[#F59E0B]/10 hover:bg-[#F59E0B]/20 border border-[#F59E0B]/20 text-[#F59E0B] font-bold text-xs rounded-xl transition-all"
          >
            Unlock Vault
          </button>
        </div>
      ) : !identity ? (
        <div className="bg-[#161412] border border-white/5 rounded-3xl p-5 flex items-center justify-center shadow-lg">
          <span className="animate-spin inline-block w-4 h-4 border-2 border-[#F59E0B] border-t-transparent rounded-full mr-2" />
          <span className="text-xs text-white/40 font-mono">Deriving sovereign key...</span>
        </div>
      ) : (
        <form onSubmit={handlePublish} className="bg-[#161412] border border-white/5 rounded-3xl p-5 flex flex-col gap-4 shadow-lg">
          <textarea
            value={newPostText}
            onChange={e => setNewPostText(e.target.value)}
            placeholder="Share your build, ideas, or engineering notes with the global Nostr network..."
            className="w-full bg-white/[0.02] border border-white/5 rounded-2xl px-4 py-3 text-sm text-white placeholder-white/30 focus:outline-none focus:border-white/10 resize-none min-h-[90px]"
          />
          <div className="flex justify-between items-center">
            <div className="flex gap-1.5 flex-wrap">
              {filterTags.slice(0, 3).map(tag => (
                <span 
                  key={tag} 
                  onClick={() => setNewPostText(prev => prev + ` #${tag}`)}
                  className="text-[10px] font-mono text-[#F59E0B] bg-[#F59E0B]/5 hover:bg-[#F59E0B]/10 cursor-pointer border border-[#F59E0B]/10 px-2 py-0.5 rounded-md transition-all"
                >
                  #{tag}
                </span>
              ))}
            </div>
            <button
              type="submit"
              disabled={publishing || !newPostText.trim()}
              className="px-5 py-2 bg-white text-black font-extrabold text-xs rounded-xl hover:bg-white/90 disabled:bg-white/40 disabled:cursor-not-allowed transition-all flex items-center gap-1.5"
            >
              {publishing ? 'Publishing...' : 'Publish Post'}
              <Send size={12} />
            </button>
          </div>
        </form>
      )}

      {/* Feed Container */}
      <div className="flex flex-col gap-4">
        {feedLoading && feed.length === 0 ? (
          <div className="text-center py-12 text-white/40">
            <span className="animate-spin inline-block w-6 h-6 border-2 border-[#F59E0B] border-t-transparent rounded-full mb-3" />
            <p className="text-xs font-mono">Syncing Nostr relays...</p>
          </div>
        ) : feed.length === 0 ? (
          <div className="text-center py-16 bg-[#161412] border border-white/5 rounded-3xl text-white/30">
            <Sparkles size={36} className="mx-auto text-white/20 mb-3" />
            <h4 className="text-sm font-black mb-1 font-clash">Relay Stream Empty</h4>
            <p className="text-xs max-w-xs mx-auto text-white/40">
              No matching tech-focused posts found on connected relays yet. Be the first to share!
            </p>
          </div>
        ) : (
          feed.map(event => {
            const author = getAuthorDisplay(event.pubkey);
            return (
              <div 
                key={event.id}
                className="bg-[#161412] border border-white/5 rounded-3xl p-5 flex flex-col gap-4 transition-all hover:border-white/10 shadow-md"
              >
                {/* Card Header */}
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <div className="w-9 h-9 rounded-full bg-gradient-to-tr from-[#F59E0B] to-amber-700 flex items-center justify-center font-black font-mono text-xs text-white">
                      {author.name.substring(1, 3).toUpperCase()}
                    </div>
                    <div className="flex flex-col">
                      <div className="flex items-center gap-1.5">
                        <span className="text-xs font-bold truncate max-w-[150px]">
                          {author.name}
                        </span>
                        {author.isEcosystem && (
                          <span className="text-[8px] font-bold bg-[#F59E0B]/10 text-[#F59E0B] border border-[#F59E0B]/20 px-1 py-0.2 rounded font-mono uppercase">
                            Kylrix User
                          </span>
                        )}
                      </div>
                      <span className="text-[10px] text-white/30 font-mono">
                        {new Date(event.created_at * 1000).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                      </span>
                    </div>
                  </div>
                  <span className="text-[9px] font-mono bg-white/5 text-white/40 px-2 py-0.5 rounded-full border border-white/5">
                    Kind 1
                  </span>
                </div>

                {/* Card Content */}
                <p className="text-sm text-white/80 leading-relaxed font-sans break-words whitespace-pre-wrap">
                  {event.content}
                </p>

                {/* Card Actions */}
                <div className="flex items-center gap-6 border-t border-white/[0.03] pt-3 text-white/40 text-xs select-none">
                  <button 
                    onClick={() => toast.success('Pulse logged locally!')}
                    className="flex items-center gap-1.5 hover:text-[#F59E0B] transition-all"
                  >
                    <Heart size={14} />
                    <span>Pulse</span>
                  </button>
                  <button className="flex items-center gap-1.5 hover:text-white transition-all">
                    <MessageCircle size={14} />
                    <span>Reply</span>
                  </button>
                  <button className="flex items-center gap-1.5 hover:text-white transition-all">
                    <Repeat2 size={14} />
                    <span>Repost</span>
                  </button>
                </div>
              </div>
            );
          })
        )}
      </div>
    </div>
  );
}
