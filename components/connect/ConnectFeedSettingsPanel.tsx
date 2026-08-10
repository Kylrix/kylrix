'use client';

import React, { useEffect, useState } from 'react';
import { X, Sliders, Tag, Eye, Layers, Hash } from 'lucide-react';
import { CONNECT_FEED_DEFAULTS, getConnectFeedSettings, setConnectFeedSettings, type ConnectFeedSettings } from '@/lib/connect/feed-settings';

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

export function ConnectFeedSettingsPanel({ onClose }: { onClose?: () => void }) {
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
        <button type="button" onClick={onClose} className="p-1.5 rounded-lg text-[#8E8A86] hover:text-white hover:bg-[#161412]"><X size={18} /></button>
      </div>

      <div className="flex-1 overflow-y-auto px-5 py-5 space-y-6 min-h-0">
        <div className="rounded-xl bg-[#161412] border border-white/[0.06] p-3">
          <p className="text-xs text-white/45 font-satoshi m-0">Ultra-granular controls synced locally and to your live settings. Changes apply instantly.</p>
        </div>

        <section className="space-y-3">
          <h3 className="text-xs font-extrabold uppercase tracking-wider text-white/60 flex items-center gap-1.5"><Hash size={12} /> Custom feed topics</h3>
          <div className="flex gap-2">
            <input
              value={newTopic}
              onChange={e => setNewTopic(e.target.value)}
              onKeyDown={e => { if (e.key === 'Enter') { e.preventDefault(); addTopic(); } }}
              placeholder="e.g. bitcoin, builders..."
              className="flex-1 h-10 rounded-xl bg-[#161412] border border-white/[0.06] px-3 text-sm text-white placeholder:text-white/30 focus:outline-none focus:border-[#F59E0B]/40"
            />
            <button type="button" onClick={addTopic} className="h-10 px-4 rounded-xl bg-[#F59E0B] text-black text-xs font-extrabold">Add</button>
          </div>
          <div className="flex flex-wrap gap-1.5">
            {settings.topics.length ? settings.topics.map(t => (
              <span key={t} className="inline-flex items-center gap-1.5 rounded-full bg-[#1C1A18] border border-white/[0.06] px-2.5 py-1 text-xs font-bold text-white">
                #{t}
                <button type="button" onClick={() => removeTopic(t)} className="text-white/40 hover:text-white">×</button>
              </span>
            )) : <p className="text-xs text-white/30">No custom topics yet — feed shows all.</p>}
          </div>
        </section>

        <section className="space-y-3">
          <h3 className="text-xs font-extrabold uppercase tracking-wider text-white/60 flex items-center gap-1.5"><Tag size={12} /> Interests</h3>
          <div className="flex gap-2">
            <input
              value={newInterest}
              onChange={e => setNewInterest(e.target.value)}
              onKeyDown={e => { if (e.key === 'Enter') { e.preventDefault(); addInterest(); } }}
              placeholder="e.g. design, ai, nostr..."
              className="flex-1 h-10 rounded-xl bg-[#161412] border border-white/[0.06] px-3 text-sm text-white placeholder:text-white/30 focus:outline-none focus:border-[#F59E0B]/40"
            />
            <button type="button" onClick={addInterest} className="h-10 px-4 rounded-xl bg-white text-black text-xs font-extrabold">Add</button>
          </div>
          <div className="flex flex-wrap gap-1.5">
            {settings.interests.map(t => (
              <span key={t} className="inline-flex items-center gap-1.5 rounded-full bg-[#F59E0B] text-black px-2.5 py-1 text-xs font-extrabold">
                {t}
                <button type="button" onClick={() => removeInterest(t)} className="text-black/60 hover:text-black">×</button>
              </span>
            ))}
          </div>
        </section>

        <section className="space-y-3">
          <h3 className="text-xs font-extrabold uppercase tracking-wider text-white/60 flex items-center gap-1.5"><Layers size={12} /> Sources</h3>
          <Toggle label="Ecosystem moments" desc="Kylrix moments feed" value={settings.showEcosystem} onToggle={() => patch({ showEcosystem: !settings.showEcosystem })} />
          <Toggle label="Nostr feed" desc="External Nostr notes" value={settings.showNostr} onToggle={() => patch({ showNostr: !settings.showNostr })} />
          <Toggle label="Show replies" desc="Include reply threads" value={settings.showReplies} onToggle={() => patch({ showReplies: !settings.showReplies })} />
          <Toggle label="Show likes" desc="Include like counts" value={settings.showLikes} onToggle={() => patch({ showLikes: !settings.showLikes })} />
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
