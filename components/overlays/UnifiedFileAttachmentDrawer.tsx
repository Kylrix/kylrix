'use client';

/**
 * UnifiedFileAttachmentDrawer — Object linker drawer.
 * File upload and synced media tabs have been removed (storage not supported).
 * Only the 'objects' tab remains for linking notes, goals, projects, etc.
 */

import React, { useState, useEffect, useCallback } from 'react';
import { X, Target, FileText, FolderKanban, Key, Tag as TagIcon, Calendar, Bot } from 'lucide-react';
import { useUnifiedFileDrawer } from '@/context/UnifiedFileDrawerContext';
import { LocalEngine } from '@/lib/services/LocalEngine';
import { useAuth } from '@/context/auth/AuthContext';
import { useNotes } from '@/context/NotesContext';
import { useTask } from '@/context/TaskContext';

export function UnifiedFileAttachmentDrawer() {
  const { isOpen, options, closeFileDrawer } = useUnifiedFileDrawer();
  const { user } = useAuth();
  const { notes: localContextNotes } = useNotes();
  const { tasks: localContextGoals } = useTask();
  const [searchQuery, setSearchQuery] = useState('');
  const [items, setItems] = useState<any[]>([]);
  const [activeSubTab, setActiveSubTab] = useState<string>(options?.initialSubTab || 'ideas');

  useEffect(() => {
    if (!isOpen) return;
    setActiveSubTab(options?.initialSubTab || 'ideas');
    setSearchQuery('');
  }, [isOpen, options?.initialSubTab]);

  useEffect(() => {
    if (!isOpen) return;
    void (async () => {
      try {
        if (activeSubTab === 'ideas') {
          const uid = user?.$id;
          const cached = [
            ...(localContextNotes || []),
            ...(uid ? (await LocalEngine.cacheGet<any[]>(`f_notes_list_${uid}`)) || [] : []),
            ...((await LocalEngine.cacheGet<any[]>('f_notes_list')) || []),
          ];
          const seen = new Set<string>();
          setItems(cached.filter((n) => { const id = n.$id || n.id; if (!id || seen.has(id)) return false; seen.add(id); return true; }));
        } else if (activeSubTab === 'goals') {
          const uid = user?.$id;
          const cached = [
            ...(localContextGoals || []),
            ...(uid ? (await LocalEngine.cacheGet<any[]>(`f_goals_list_${uid}`)) || [] : []),
            ...((await LocalEngine.cacheGet<any[]>('f_goals_list')) || []),
          ];
          const seen = new Set<string>();
          setItems(cached.filter((g) => { const id = g.$id || g.id; if (!id || seen.has(id)) return false; seen.add(id); return true; }));
        } else {
          setItems([]);
        }
      } catch {
        setItems([]);
      }
    })();
  }, [isOpen, activeSubTab, user?.$id, localContextNotes, localContextGoals]);

  const filtered = items.filter((item) => {
    if (!searchQuery) return true;
    const q = searchQuery.toLowerCase();
    const title = String(item.title || item.name || '').toLowerCase();
    return title.includes(q);
  });

  const handleSelect = useCallback((item: any) => {
    if (!options?.onSelectFile) return;
    options.onSelectFile({
      $id: item.$id || item.id || '',
      name: item.title || item.name || 'Untitled',
      bucketId: '',
      sizeOriginal: 0,
      mimeType: 'application/json',
    });
    closeFileDrawer();
  }, [options, closeFileDrawer]);

  if (!isOpen) return null;

  const subTabs = [
    { key: 'ideas', label: 'Ideas', icon: <FileText size={14} /> },
    { key: 'goals', label: 'Goals', icon: <Target size={14} /> },
    { key: 'projects', label: 'Projects', icon: <FolderKanban size={14} /> },
    { key: 'vault', label: 'Vault', icon: <Key size={14} /> },
    { key: 'tags', label: 'Tags', icon: <TagIcon size={14} /> },
    { key: 'events', label: 'Events', icon: <Calendar size={14} /> },
    { key: 'sessions', label: 'Sessions', icon: <Bot size={14} /> },
  ];

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center sm:items-center" onClick={closeFileDrawer}>
      <div
        className="relative w-full max-w-lg max-h-[80vh] bg-[#0D0C0B] border border-white/[0.08] rounded-t-2xl sm:rounded-2xl flex flex-col overflow-hidden"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-4 py-3 border-b border-white/[0.06]">
          <span className="text-sm font-bold text-white font-satoshi">
            {options?.title || 'Attach Object'}
          </span>
          <button
            type="button"
            onClick={closeFileDrawer}
            className="p-1.5 rounded-lg text-white/40 hover:text-white hover:bg-white/[0.06]"
            aria-label="Close"
          >
            <X size={16} />
          </button>
        </div>

        {/* Sub-tabs */}
        <div className="flex gap-1 px-3 py-2 overflow-x-auto border-b border-white/[0.04]">
          {subTabs.map(({ key, label, icon }) => (
            <button
              key={key}
              type="button"
              onClick={() => setActiveSubTab(key)}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold font-satoshi whitespace-nowrap transition-colors ${
                activeSubTab === key
                  ? 'bg-white/[0.1] text-white'
                  : 'text-white/40 hover:text-white/70 hover:bg-white/[0.04]'
              }`}
            >
              {icon}
              {label}
            </button>
          ))}
        </div>

        {/* Search */}
        <div className="px-3 py-2">
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search…"
            className="w-full bg-[#161412] border border-white/[0.06] rounded-xl px-3 py-2 text-sm text-white placeholder:text-white/30 outline-none focus:border-white/20"
          />
        </div>

        {/* Items list */}
        <div className="flex-1 overflow-y-auto px-2 pb-3">
          {filtered.length === 0 ? (
            <p className="text-center text-xs text-white/30 py-8">Nothing found</p>
          ) : (
            filtered.slice(0, 50).map((item) => {
              const id = item.$id || item.id || '';
              const title = item.title || item.name || 'Untitled';
              return (
                <button
                  key={id}
                  type="button"
                  onClick={() => handleSelect(item)}
                  className="w-full flex items-center gap-3 px-3 py-2.5 rounded-xl hover:bg-white/[0.04] transition-colors text-left"
                >
                  <span className="min-w-0 flex-1 truncate text-sm text-white font-satoshi">{title}</span>
                </button>
              );
            })
          )}
        </div>
      </div>
    </div>
  );
}
