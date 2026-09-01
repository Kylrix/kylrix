'use client';

import React, { useEffect, useState } from 'react';
import { X, Sliders, Tag, Eye, Layers, Hash, RadioTower, ChevronRight, ChevronUp, ChevronDown, UserCircle2 } from 'lucide-react';
import { CONNECT_FEED_DEFAULTS, getConnectFeedSettings, setConnectFeedSettings, type ConnectFeedSettings } from '@/lib/connect/feed-settings';
import { CURATED_TOPIC_CATEGORIES } from '@/lib/ecosystem/intelligence-topics';
import { ConnectNostrSettingsView } from './ConnectNostrSettingsView';
import { useAuth } from '@/context/auth/AuthContext';
import { useUnifiedDrawer } from '@/context/UnifiedDrawerContext';
import { useNostrIdentity } from '@/hooks/useNostrIdentity';

function Toggle({ label, value, onToggle, desc }: { label: string; value: boolean; onToggle: () => void; desc?: string }) {
  return (
    <button
      type="button"
      onClick={onToggle}
      className={`w-full flex items-center justify-between gap-3 rounded-xl border px-3 py-3 text-left transition-colors ${value ? 'bg-[#1C1A18] border-white/[0.06]' : 'bg-[#0A0908] border-white/[0.06]'}`}
    >
      <div className="min-w-0 flex-1">
        <p className="text-sm font-bold text-white font-satoshi m-0">{label}</p>
        {desc ? <p className="text-xs text-white/40 m-0 mt-0.5">{desc}</p> : null}
      </div>
      <span className={`shrink-0 h-6 w-10 rounded-full p-0.5 flex items-center transition-colors ${value ? 'bg-[#F59E0B] justify-end' : 'bg-white/15 justify-start'}`}>
        <span className="h-5 w-5 rounded-full bg-white shadow block" />
      </span>
    </button>
  );
}

export function ConnectFeedSettingsPanel({ 
  onClose,
  isExpanded,
  onToggleExpand
}: { 
  onClose?: () => void;
  isExpanded?: boolean;
  onToggleExpand?: () => void;
}) {
  const { user } = useAuth();
  const profile = user as (typeof user & { username?: string; name?: string; displayName?: string; avatar?: string; avatarUrl?: string }) | null;
  const { open: openUnifiedDrawer } = useUnifiedDrawer();
  const { identity } = useNostrIdentity();
  const [view, setView] = useState<'feed' | 'nostr'>('feed');
  const [settings, setSettings] = useState<ConnectFeedSettings>(CONNECT_FEED_DEFAULTS);
  const [newTopic, setNewTopic] = useState('');
  const [newInterest, setNewInterest] = useState('');

  useEffect(() => {
    let mounted = true;
    void getConnectFeedSettings().then(s => { if (mounted) setSettings(s); });
    return () => { mounted = false; };
  }, []);

  const patch = (next: Partial<ConnectFeedSettings>) => {
    const merged = { ...settings, ...next };
    setSettings(merged as ConnectFeedSettings);
    void setConnectFeedSettings(next);
  };

  if (view === 'nostr') {
    return (
      <ConnectNostrSettingsView
        settings={settings}
        onUpdate={patch}
        onBack={() => setView('feed')}
        isExpanded={isExpanded}
        onToggleExpand={onToggleExpand}
      />
    );
  }

  const addTopic = () => {
    const t = newTopic.trim().toLowerCase();
    if (!t || settings.topics.includes(t)) return;
    patch({ topics: [...settings.topics, t].slice(0, 20) });
    setNewTopic('');
  };
  const removeTopic = (t: string) => patch({ topics: settings.topics.filter(x => x !== t) });
  const addInterest = () => {
    const t = newInterest.trim().toLowerCase();
    if (!t || settings.interests.includes(t)) return;
    patch({ interests: [...settings.interests, t].slice(0, 20) });
    setNewInterest('');
  };
  const removeInterest = (t: string) => patch({ interests: settings.interests.filter(x => x !== t) });

  return (
    <div className="flex h-full min-h-0 flex-col bg-[#0A0908]">
      <div className="flex items-center justify-between border-b border-white/[0.06] bg-[#0A0908] px-5 py-4 shrink-0">
        <div className="flex items-center gap-2.5">
          <span className="h-8 w-8 rounded-lg bg-[#161412] border border-white/[0.06] grid place-items-center">
            <Sliders size={14} className="text-white" />
          </span>
          <div>
            <p className="text-[10px] font-bold uppercase tracking-wider text-white/40 font-mono m-0">Feed settings</p>
            <h2 className="text-sm font-black font-clash text-white m-0 leading-none mt-0.5">Live feed</h2>
          </div>
        </div>
        <div className="flex items-center gap-1.5">
          {onToggleExpand ? (
            <button
              type="button"
              onClick={onToggleExpand}
              className="p-1.5 rounded-lg text-[#8E8A86] hover:text-white hover:bg-[#161412] transition-colors"
              aria-label={isExpanded ? 'Collapse' : 'Full screen'}
              title={isExpanded ? 'Collapse' : 'Full screen'}
            >
              {isExpanded ? <ChevronDown size={18} /> : <ChevronUp size={18} />}
            </button>
          ) : null}
          <button type="button" onClick={onClose} className="p-1.5 rounded-lg text-[#8E8A86] hover:text-white hover:bg-[#161412]"><X size={18} /></button>
        </div>
      </div>

      <div className="flex-1 overflow-y-auto px-5 py-5 space-y-6 min-h-0">
        <div className="rounded-xl bg-[#161412] border border-white/[0.06] p-3">
          <p className="text-xs text-white/45 font-satoshi m-0">Ultra-granular controls synced locally and to your live settings. Changes apply instantly.</p>
        </div>

        {/* Profile Section */}
        {user && (
          <section className="space-y-3">
            <h3 className="text-xs font-extrabold uppercase tracking-wider text-white/60 flex items-center gap-1.5 font-mono">
              <UserCircle2 size={12} className="text-emerald-400" /> Your Profile
            </h3>
            <button
              type="button"
              onClick={() => openUnifiedDrawer('profile-preview', {
                userId: user.$id,
                username: profile?.username || user.name,
                name: profile?.name || (profile as any)?.displayName || user.name,
                avatar: profile?.avatar || (profile as any)?.avatarUrl,
                npub: identity?.npub || undefined,
                source: 'ecosystem',
              })}
              className="w-full flex items-center justify-between gap-3 rounded-xl border border-white/[0.08] bg-[#161412] p-3.5 text-left hover:bg-[#1C1A18] hover:border-emerald-400/40 transition-all group"
            >
              <div className="flex items-center gap-3 min-w-0">
                <span className="h-8 w-8 rounded-full bg-[#0A0908] border border-white/[0.06] grid place-items-center shrink-0 overflow-hidden">
                  {profile?.avatar || profile?.avatarUrl ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={profile.avatar || profile.avatarUrl} alt="" className="w-full h-full object-cover" />
                  ) : (
                    <UserCircle2 size={15} className="text-emerald-400" />
                  )}
                </span>
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-bold text-white font-satoshi m-0 truncate">
                    {profile?.name || profile?.displayName || user.name || 'Your profile'}
                  </p>
                  <p className="text-xs text-white/40 m-0 mt-0.5 truncate">
                    View your posts, Nostr activity and identity
                  </p>
                </div>
              </div>
              <ChevronRight size={16} className="text-white/40 group-hover:text-emerald-400 group-hover:translate-x-0.5 shrink-0 transition-all" />
            </button>
          </section>
        )}

        {/* Curated Wide-Range Topics Section */}
        <section className="space-y-3.5">
          <div className="flex items-center justify-between">
            <h3 className="text-xs font-extrabold uppercase tracking-wider text-white/60 flex items-center gap-1.5 font-mono">
              <Hash size={12} className="text-[#F59E0B]" /> Curated Topics & Tags
            </h3>
            <span className="text-[10px] font-mono text-white/40">Fixed anchors</span>
          </div>

          <div className="flex gap-2">
            <input
              value={newTopic}
              onChange={e => setNewTopic(e.target.value)}
              onKeyDown={e => { if (e.key === 'Enter') { e.preventDefault(); addTopic(); } }}
              placeholder="Add custom topic (e.g. bitcoin, rust)..."
              className="flex-1 h-9 rounded-xl bg-[#161412] border border-white/[0.06] px-3 text-xs text-white placeholder:text-white/30 focus:outline-none focus:border-[#F59E0B]/40"
            />
            <button type="button" onClick={addTopic} className="h-9 px-3.5 rounded-xl bg-[#F59E0B] text-black text-xs font-black">Add</button>
          </div>

          {/* Active Selected Topics */}
          <div className="flex flex-wrap gap-1.5 min-h-6">
            {settings.topics.length ? settings.topics.map(t => (
              <span key={t} className="inline-flex items-center gap-1.5 rounded-lg bg-[#1C1A18] border border-[#F59E0B]/30 px-2.5 py-1 text-xs font-bold text-[#F59E0B] font-mono">
                #{t}
                <button type="button" onClick={() => removeTopic(t)} className="text-[#F59E0B]/60 hover:text-white">×</button>
              </span>
            )) : <p className="text-xs text-white/30 font-satoshi m-0">No fixed topic filters active — showing all ecosystem topics.</p>}
          </div>

          {/* Curated Categories Catalog */}
          <div className="space-y-2.5 pt-2">
            <p className="text-[11px] font-bold text-white/50 uppercase tracking-wider font-mono m-0">
              Browse Topics Catalog
            </p>
            <div className="space-y-3">
              {CURATED_TOPIC_CATEGORIES.map(category => (
                <div key={category.id} className="rounded-xl bg-[#161412] border border-white/[0.04] p-3 space-y-2">
                  <div>
                    <p className="text-xs font-bold text-white font-satoshi m-0">{category.label}</p>
                    <p className="text-[10px] text-white/40 font-satoshi m-0 mt-0.5">{category.description}</p>
                  </div>
                  <div className="flex flex-wrap gap-1.5 pt-1">
                    {category.topics.map(item => {
                      const isSelected = settings.topics.includes(item.tag.toLowerCase());
                      return (
                        <button
                          key={item.id}
                          type="button"
                          onClick={() => {
                            if (isSelected) removeTopic(item.tag.toLowerCase());
                            else patch({ topics: [...settings.topics, item.tag.toLowerCase()].slice(0, 20) });
                          }}
                          className={`px-2.5 py-1 rounded-lg text-xs font-mono transition-colors ${
                            isSelected
                              ? 'bg-[#F59E0B] text-black font-extrabold shadow-sm'
                              : 'bg-[#0A0908] border border-white/[0.06] text-white/70 hover:text-white hover:border-white/20'
                          }`}
                        >
                          #{item.label}
                        </button>
                      );
                    })}
                  </div>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* Dynamic Real-time Interests Section */}
        <section className="space-y-3">
          <div className="flex items-center justify-between">
            <h3 className="text-xs font-extrabold uppercase tracking-wider text-white/60 flex items-center gap-1.5 font-mono">
              <Tag size={12} className="text-emerald-400" /> Ephemeral Interests
            </h3>
            <span className="text-[10px] font-mono text-emerald-400 font-bold">Fast-adaptive (minutes)</span>
          </div>

          <p className="text-[11px] text-white/40 font-satoshi m-0 leading-relaxed">
            Interests drift and adapt rapidly based on what you consume and engage with across your workspace and feed.
          </p>

          <div className="flex gap-2">
            <input
              value={newInterest}
              onChange={e => setNewInterest(e.target.value)}
              onKeyDown={e => { if (e.key === 'Enter') { e.preventDefault(); addInterest(); } }}
              placeholder="e.g. design, ai, nostr..."
              className="flex-1 h-9 rounded-xl bg-[#161412] border border-white/[0.06] px-3 text-xs text-white placeholder:text-white/30 focus:outline-none focus:border-emerald-400/40"
            />
            <button type="button" onClick={addInterest} className="h-9 px-3.5 rounded-xl bg-emerald-400 text-black text-xs font-black">Add</button>
          </div>

          <div className="flex flex-wrap gap-1.5">
            {settings.interests.map(rawInterest => {
              const parts = String(rawInterest).split(':');
              const name = parts[0];
              const isWeighted = parts.length > 1 && Number(parts[1]) > 1;
              return (
                <span
                  key={rawInterest}
                  className={`inline-flex items-center gap-1.5 rounded-lg px-2.5 py-1 text-xs font-mono font-bold transition-all ${
                    isWeighted
                      ? 'bg-amber-400/15 border border-amber-400/40 text-amber-300 shadow-sm'
                      : 'bg-emerald-400/15 border border-emerald-400/30 text-emerald-300'
                  }`}
                  title={isWeighted ? 'High-intent weighted interest' : 'Standard interest'}
                >
                  {isWeighted ? <span className="text-[10px] text-amber-400">⚡</span> : null}
                  {name}
                  <button
                    type="button"
                    onClick={() => removeInterest(rawInterest)}
                    className={isWeighted ? 'text-amber-300/60 hover:text-white' : 'text-emerald-300/60 hover:text-emerald-100'}
                  >
                    ×
                  </button>
                </span>
              );
            })}
          </div>
        </section>

        <section className="space-y-3">
          <h3 className="text-xs font-extrabold uppercase tracking-wider text-white/60 flex items-center gap-1.5"><Layers size={12} /> Sources</h3>
          <Toggle label="Ecosystem moments" desc="Kylrix moments feed" value={settings.showEcosystem} onToggle={() => patch({ showEcosystem: !settings.showEcosystem })} />
          <Toggle label="Nostr feed" desc="External Nostr notes" value={settings.showNostr} onToggle={() => patch({ showNostr: !settings.showNostr })} />
          <Toggle label="Show replies" desc="Include reply threads" value={settings.showReplies} onToggle={() => patch({ showReplies: !settings.showReplies })} />
          <Toggle label="Show likes" desc="Include like counts" value={settings.showLikes} onToggle={() => patch({ showLikes: !settings.showLikes })} />
        </section>

        {/* Dedicated Nostr Section */}
        <section className="space-y-3">
          <div className="flex items-center justify-between">
            <h3 className="text-xs font-extrabold uppercase tracking-wider text-white/60 flex items-center gap-1.5">
              <RadioTower size={12} className="text-[#F59E0B]" /> Nostr settings
            </h3>
            <span className="text-[10px] font-mono px-1.5 py-0.5 rounded bg-emerald-500/10 text-emerald-400 font-bold">
              NIP-65
            </span>
          </div>

          <button
            type="button"
            onClick={() => setView('nostr')}
            className="w-full flex items-center justify-between gap-3 rounded-xl border border-white/[0.08] bg-[#161412] p-3.5 text-left hover:bg-[#1C1A18] hover:border-[#F59E0B]/40 transition-all group"
          >
            <div className="flex items-center gap-3 min-w-0">
              <span className="h-8 w-8 rounded-lg bg-[#0A0908] border border-white/[0.06] grid place-items-center shrink-0">
                <RadioTower size={15} className="text-[#F59E0B]" />
              </span>
              <div className="min-w-0 flex-1">
                <p className="text-sm font-bold text-white font-satoshi m-0 flex items-center gap-2">
                  Keys, Outbox & Relays
                </p>
                <p className="text-xs text-white/40 m-0 mt-0.5 truncate">
                  Inspect npub, export nsec, switch account, and configure sync to/from servers
                </p>
              </div>
            </div>
            <ChevronRight size={16} className="text-white/40 group-hover:text-[#F59E0B] group-hover:translate-x-0.5 shrink-0 transition-all" />
          </button>
        </section>

        <section className="space-y-3">
          <h3 className="text-xs font-extrabold uppercase tracking-wider text-white/60 flex items-center gap-1.5"><Eye size={12} /> Media</h3>
          <Toggle label="Auto preview media" desc="Load images/link previews inline" value={settings.autoPreviewMedia} onToggle={() => patch({ autoPreviewMedia: !settings.autoPreviewMedia })} />
          <Toggle label="Auto-play media" desc="Auto play videos/gifs" value={settings.autoPlayMedia} onToggle={() => patch({ autoPlayMedia: !settings.autoPlayMedia })} />
          <Toggle label="Compact mode" desc="Denser feed tiles" value={settings.compactMode} onToggle={() => patch({ compactMode: !settings.compactMode })} />
        </section>

        <button
          type="button"
          onClick={() => { patch(CONNECT_FEED_DEFAULTS as any); }}
          className="w-full h-10 rounded-xl bg-[#161412] border border-white/[0.06] text-white text-xs font-bold hover:bg-white/5"
        >
          Reset to defaults
        </button>
        <p className="text-[10px] text-white/25 text-center font-mono m-0">Synced locally + to your live settings • applies instantly</p>
      </div>
    </div>
  );
}
