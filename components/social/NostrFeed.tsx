'use client';

import React, { useState } from 'react';
import { useNostrFeed } from '@/hooks/useNostrFeed';
import { useNostrIdentity } from '@/hooks/useNostrIdentity';
import { Heart, MessageCircle, Repeat2, Send, ShieldAlert, Sparkles, Hash, Search } from 'lucide-react';
import toast from 'react-hot-toast';

export function NostrFeed() {
  const { identity, loading: identityLoading, isVaultLocked, unlockAndLoad } = useNostrIdentity();
  const { feed, loading: feedLoading, publishPost, filterTags } = useNostrFeed();
  const [newPostText, setNewPostText] = useState('');
  const [publishing, setPublishing] = useState(false);

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

  if (isVaultLocked || !identity) {
    return (
      <div className="w-full bg-[#161412] border border-white/5 rounded-3xl p-12 text-center flex flex-col items-center justify-center min-h-[400px] text-white shadow-[0_12px_36px_rgba(0,0,0,0.5)]">
        <div className="w-16 h-16 rounded-full bg-amber-500/10 text-[#F59E0B] flex items-center justify-center mb-6">
          <Sparkles size={32} className="animate-pulse" />
        </div>
        <h3 className="text-xl font-black font-clash mb-2">Global Town Square Encrypted</h3>
        <p className="text-sm text-white/50 max-w-sm mb-8 font-satoshi">
          Unlock your local secure vault using your MasterPass to access, view, and sign messages in the global decentralized technical feed.
        </p>
        <button
          onClick={unlockAndLoad}
          disabled={identityLoading}
          className="px-6 py-3 bg-[#F59E0B] hover:bg-[#D97706] disabled:bg-amber-500/50 text-white font-extrabold rounded-2xl transition-all shadow-[0_4px_12px_rgba(245,158,11,0.2)]"
        >
          {identityLoading ? 'Initializing WESP...' : 'Unlock Sovereign Vault'}
        </button>
      </div>
    );
  }

  return (
    <div className="w-full flex flex-col gap-6 max-w-2xl mx-auto font-satoshi text-white select-none">
      {/* Curation Indicator */}
      <div className="bg-[#1C1A17] border border-[#F59E0B]/20 rounded-2xl p-4 flex items-center gap-3 text-xs text-amber-200">
        <Sparkles size={16} className="text-[#F59E0B] flex-shrink-0" />
        <div>
          <span className="font-bold">Agentic Curation Active:</span> Filtering global relays for tech-centric topics ({filterTags.map(t => `#${t}`).join(', ')}).
        </div>
      </div>

      {/* Compose Form */}
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
          feed.map(event => (
            <div 
              key={event.id}
              className="bg-[#161412] border border-white/5 rounded-3xl p-5 flex flex-col gap-4 transition-all hover:border-white/10 shadow-md"
            >
              {/* Card Header */}
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="w-9 h-9 rounded-full bg-gradient-to-tr from-[#F59E0B] to-amber-700 flex items-center justify-center font-black font-mono text-xs text-white">
                    {event.pubkey.substring(0, 2).toUpperCase()}
                  </div>
                  <div className="flex flex-col">
                    <span className="text-xs font-bold truncate max-w-[150px]">
                      npub...{event.pubkey.substring(event.pubkey.length - 8)}
                    </span>
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
          ))
        )}
      </div>
    </div>
  );
}
