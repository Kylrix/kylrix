'use client';

/**
 * UnifiedFileAttachmentDrawer — Workspace Object Attachment Drawer.
 * Focuses purely on relational workspace objects:
 *   Goals, Ideas, Projects, Threads, TOTPs, Forms, Events, Vault, Tags, Sessions.
 * Fully hydrated from live SDK getters + RxDB + LocalEngine.
 * Displays "Encrypted" badge when items are encrypted.
 */

import React, { useState, useEffect, useCallback } from 'react';
import {
  X,
  FileText,
  Search,
  Loader2,
  Target,
  FileCode,
  Calendar,
  Key,
  Tag as TagIcon,
  Layers,
  Maximize2,
  Minimize2,
  Lock,
  FolderKanban,
  MessageSquare,
  ShieldAlert,
  Bot,
} from 'lucide-react';
import { useUnifiedFileDrawer } from '@/context/UnifiedFileDrawerContext';
import { LocalEngine } from '@/lib/services/LocalEngine';
import { getRxDB } from '@/lib/webrtc/RxDBManager';
import { useAuth } from '@/context/auth/AuthContext';
import { useNotes } from '@/context/NotesContext';
import { getAllTags, listNotesPaginated } from '@/lib/appwrite';
import { FormsService } from '@/lib/services/forms';
import { serializeObjectBlock } from '@/lib/note-object-secondary';
import { useTask } from '@/context/TaskContext';
import { ProjectsService } from '@/lib/appwrite/projects';
import { VaultService } from '@/lib/appwrite/vault';
import { tasks, events } from '@/lib/kylrixflow';
import { useSudo } from '@/context/SudoContext';

type ObjectSubTab =
  | 'goals'
  | 'ideas'
  | 'projects'
  | 'threads'
  | 'totps'
  | 'forms'
  | 'events'
  | 'vault'
  | 'tags'
  | 'sessions';

function isLikelyEncrypted(str?: string | null): boolean {
  if (!str || typeof str !== 'string') return false;
  const s = str.trim();
  if (
    s.startsWith('[DECRYPTION_') ||
    s.startsWith('{"iv"') ||
    s.startsWith('{"ct"') ||
    s.startsWith('{"v"') ||
    s.startsWith('{"data"')
  ) {
    return true;
  }
  if (s.includes('::') && s.length > 20) return true;
  if (s.length > 40 && !s.includes(' ') && /^[a-zA-Z0-9+/=_-]+$/.test(s)) return true;
  return false;
}

export function UnifiedFileAttachmentDrawer() {
  const { isOpen, options, closeFileDrawer } = useUnifiedFileDrawer();
  const { user } = useAuth();
  const { promptSudo, isUnlocked } = useSudo();
  const userId = user?.$id || 'guest';
  const { notes: localContextNotes } = useNotes();
  const { tasks: localContextGoals } = useTask();

  const [isFullscreen, setIsFullscreen] = useState(false);
  const [activeSubTab, setActiveSubTab] = useState<ObjectSubTab>('goals');
  const [searchQuery, setSearchQuery] = useState('');
  const [objectItems, setObjectItems] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);

  // Honor caller defaults each open
  useEffect(() => {
    if (!isOpen) return;
    setActiveSubTab(options?.initialSubTab || 'goals');
    setSearchQuery('');
  }, [isOpen, options?.initialSubTab]);

  // Auto MasterPass when switching to encrypted sub-tabs
  useEffect(() => {
    if (isOpen && (activeSubTab === 'totps' || activeSubTab === 'vault')) {
      if (!isUnlocked) {
        void promptSudo('unlock', false, true);
      }
    }
  }, [isOpen, activeSubTab, isUnlocked, promptSudo]);

  // Comprehensive 0ms Local & Live SDK Hydration for All Object Types
  const loadLocalObjects = useCallback(async () => {
    setLoading(true);
    try {
      let items: any[] = [];
      const db = await getRxDB();

      if (activeSubTab === 'ideas') {
        items = localContextNotes && localContextNotes.length > 0 ? localContextNotes : [];
        if (items.length === 0) {
          const { loadNotesFromLocalCopy } = await import('@/lib/notes/load-local-notes');
          const local = await loadNotesFromLocalCopy({ userId });
          items = local?.notes || [];
        }
        if (items.length === 0) {
          const res = await listNotesPaginated({ limit: 100 });
          items = res.rows || [];
        }
      } else if (activeSubTab === 'goals') {
        const { loadGoalsFromLocalCopy } = await import('@/lib/goals/load-local-goals');
        items = await loadGoalsFromLocalCopy({
          userId,
          existingTasks: localContextGoals,
        });
        if (items.length === 0) {
          const res = await tasks.list();
          items = res?.rows || [];
        }
      } else if (activeSubTab === 'projects') {
        const cached = await LocalEngine.cacheGet<any[]>(`f_user_projects_${userId}`);
        if (cached && cached.length > 0) {
          items = cached;
        } else {
          const res: any = await ProjectsService.listProjects();
          items = Array.isArray(res) ? res : (res?.rows || []);
          await LocalEngine.cacheSet(`f_user_projects_${userId}`, items);
        }
      } else if (activeSubTab === 'threads') {
        const { ThreadService } = await import('@/lib/services/threads');
        const rows = await ThreadService.listForOwner(userId, 50).catch(() => []);
        items = rows || [];
      } else if (activeSubTab === 'totps') {
        const cached = await LocalEngine.cacheGet<any[]>(`f_decrypted_totps_${userId}`);
        if (cached && cached.length > 0) {
          items = cached;
        } else {
          const totpList = await VaultService.listTOTPSecrets(userId).catch(() => []);
          items = totpList || [];
          if (items.length > 0) {
            await LocalEngine.cacheSet(`f_decrypted_totps_${userId}`, items);
          }
        }
      } else if (activeSubTab === 'vault') {
        const cached = await LocalEngine.cacheGet<any[]>(`f_decrypted_vault_${userId}`);
        if (cached && cached.length > 0) {
          items = cached;
        } else {
          const res = await VaultService.listCredentials(userId).catch(() => ({ rows: [] }));
          items = res.rows || [];
          if (items.length > 0) {
            await LocalEngine.cacheSet(`f_decrypted_vault_${userId}`, items);
          }
        }
      } else if (activeSubTab === 'forms') {
        const cached = await LocalEngine.cacheGet<any[]>(`f_user_forms_${userId}`);
        if (cached && cached.length > 0) {
          items = cached;
        } else {
          const res = await FormsService.listUserForms(userId).catch(() => []);
          items = Array.isArray(res) ? res : ((res as any)?.rows || []);
          await LocalEngine.cacheSet(`f_user_forms_${userId}`, items);
        }
      } else if (activeSubTab === 'events') {
        const cached = await LocalEngine.cacheGet<any[]>(`f_user_events_${userId}`);
        if (cached && cached.length > 0) {
          items = cached;
        } else {
          const res = await events.list().catch(() => ({ rows: [] }));
          items = res.rows || [];
          await LocalEngine.cacheSet(`f_user_events_${userId}`, items);
        }
      } else if (activeSubTab === 'tags') {
        const cached = await LocalEngine.cacheGet<any[]>(`f_user_tags_${userId}`);
        if (cached && cached.length > 0) {
          items = cached;
        } else {
          const res = await getAllTags().catch(() => ({ rows: [] }));
          items = res.rows || [];
          await LocalEngine.cacheSet(`f_user_tags_${userId}`, items);
        }
      } else if (activeSubTab === 'sessions') {
        if (db && db.agent_sessions) {
          const docs = await db.agent_sessions.find().exec();
          if (docs && docs.length > 0) {
            items = docs.map((d: any) => d.toJSON());
          }
        }
        if (items.length === 0) {
          const { AgenticSessionLocalStore } = await import('@/lib/agentic/session-local-store');
          items = await AgenticSessionLocalStore.getSessionsList(userId).catch(() => []);
        }
      }

      setObjectItems(items);
    } catch (err) {
      console.warn('[UnifiedAttachment] Error loading objects for tab', activeSubTab, err);
      setObjectItems([]);
    } finally {
      setLoading(false);
    }
  }, [activeSubTab, userId, localContextNotes, localContextGoals]);

  useEffect(() => {
    if (isOpen) {
      void loadLocalObjects();
    }
  }, [isOpen, activeSubTab, loadLocalObjects]);

  // Re-hydrate when unlocked; clear RAM list when locked
  useEffect(() => {
    if (!isOpen) return;
    if (activeSubTab !== 'totps' && activeSubTab !== 'vault') return;
    if (isUnlocked) {
      void loadLocalObjects();
    } else {
      setObjectItems([]);
      void LocalEngine.cacheDelete(`f_decrypted_totps_${userId}`).catch(() => undefined);
      void LocalEngine.cacheDelete(`f_decrypted_vault_${userId}`).catch(() => undefined);
    }
  }, [isOpen, isUnlocked, activeSubTab, loadLocalObjects, userId]);

  if (!isOpen || !options) return null;

  const handleSelectObject = async (item: any) => {
    if (
      (activeSubTab === 'totps' || activeSubTab === 'vault') &&
      !isUnlocked
    ) {
      const ok = await promptSudo('unlock');
      if (!ok) return;
    }

    const isEncrypted = item.isEncrypted || item.encrypted || item.locked;
    const itemTitle = isEncrypted
      ? 'Encrypted Item'
      : item.title || item.name || item.label || 'Attached Item';

    const childId = item.$id || item.id || 'obj';
    let childKind: any = 'note';
    if (activeSubTab === 'ideas') childKind = 'note';
    else if (activeSubTab === 'goals') childKind = 'task';
    else if (activeSubTab === 'projects') childKind = 'note';
    else if (activeSubTab === 'threads') childKind = 'note';
    else if (activeSubTab === 'totps') childKind = 'vault';
    else if (activeSubTab === 'vault') childKind = 'vault';
    else if (activeSubTab === 'forms') childKind = 'form';
    else if (activeSubTab === 'sessions') {
      const ok = window.confirm(
        'Attaching an agent session makes the entire conversation visible to anyone who can see this note. Continue?'
      );
      if (!ok) return;
      childKind = 'session';
    }

    const objectBlock = serializeObjectBlock({
      childId,
      childKind,
      bucketId: activeSubTab,
      label: itemTitle,
      appTheme: 'idea',
      metadata: { title: itemTitle, subTab: activeSubTab },
    });

    options.onSelectFile({
      $id: childId,
      name: itemTitle,
      bucketId: activeSubTab,
      sizeOriginal: 0,
      mimeType: 'application/x-kylrix-object',
      fileUrl: objectBlock,
    });
    closeFileDrawer();
  };

  const filteredObjects = objectItems.filter((item) => {
    if (!searchQuery.trim()) return true;
    const q = searchQuery.toLowerCase();
    const str = `${item.title || ''} ${item.name || ''} ${item.label || ''} ${item.serviceName || ''} ${item.issuer || ''} ${item.accountName || ''}`.toLowerCase();
    return str.includes(q);
  });

  const getSubTabIcon = (tab: ObjectSubTab) => {
    switch (tab) {
      case 'goals': return Target;
      case 'ideas': return FileText;
      case 'projects': return FolderKanban;
      case 'threads': return MessageSquare;
      case 'totps': return ShieldAlert;
      case 'forms': return FileCode;
      case 'events': return Calendar;
      case 'vault': return Key;
      case 'tags': return TagIcon;
      case 'sessions': return Bot;
      default: return Layers;
    }
  };

  const CurrentSubTabIcon = getSubTabIcon(activeSubTab);

  return (
    <div className="fixed inset-0 z-[999999] flex items-end justify-center bg-black/80 animate-fadeIn p-0 sm:p-4">
      <div
        className={`w-full max-w-3xl bg-[#161412] border-t sm:border border-[#34322F] rounded-t-[28px] sm:rounded-[28px] p-6 shadow-2xl font-satoshi flex flex-col transition-all duration-300 ${
          isFullscreen ? 'h-[92vh]' : 'h-[60vh] max-h-[600px]'
        }`}
      >
        {/* Header */}
        <div className="flex items-center justify-between pb-4 border-b border-[#1C1A18] shrink-0">
          <div className="flex items-center gap-2.5">
            <div className="p-2 rounded-xl bg-[#0A0908] border border-[#1C1A18] text-[#A855F7]">
              <Layers className="w-5 h-5" />
            </div>
            <div>
              <h3 className="font-clash font-extrabold text-xl text-[#F5F2ED]">
                {options?.title || 'Attach Workspace Object'}
              </h3>
              <p className="text-xs text-[#9B9691] font-mono mt-0.5 capitalize">
                Select {activeSubTab} to link
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={() => setIsFullscreen((prev) => !prev)}
              className="p-2 rounded-xl text-[#9B9691] hover:text-[#F5F2ED] bg-[#0A0908] border border-[#1C1A18] hover:border-[#34322F] transition-all cursor-pointer"
              title={isFullscreen ? 'Shrink Drawer' : 'Full Screen'}
            >
              {isFullscreen ? <Minimize2 className="w-4 h-4" /> : <Maximize2 className="w-4 h-4" />}
            </button>
            <button
              onClick={closeFileDrawer}
              className="p-2 rounded-xl text-[#9B9691] hover:text-[#F5F2ED] bg-[#0A0908] border border-[#1C1A18] hover:border-[#34322F] transition-all cursor-pointer"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* Objects Container */}
        <div className="flex-1 flex flex-col overflow-hidden mt-4">
          {/* Scrollable Sub-Tabs */}
          <div className="flex items-center gap-2 overflow-x-auto pb-2 custom-scrollbar shrink-0">
            {[
              { id: 'goals', label: 'Goals', icon: Target },
              { id: 'ideas', label: 'Ideas', icon: FileText },
              { id: 'projects', label: 'Projects', icon: FolderKanban },
              { id: 'threads', label: 'Threads', icon: MessageSquare },
              { id: 'totps', label: 'TOTPs', icon: ShieldAlert },
              { id: 'forms', label: 'Forms', icon: FileCode },
              { id: 'events', label: 'Events', icon: Calendar },
              { id: 'sessions', label: 'Chats', icon: Bot },
              { id: 'vault', label: 'Vault', icon: Key },
              { id: 'tags', label: 'Tags', icon: TagIcon },
            ].map((sub) => {
              const IconComponent = sub.icon;
              const isSelected = activeSubTab === sub.id;
              return (
                <button
                  key={sub.id}
                  onClick={() => setActiveSubTab(sub.id as ObjectSubTab)}
                  className={`flex items-center gap-2 px-3.5 py-2 rounded-xl text-xs font-bold whitespace-nowrap transition-all cursor-pointer ${
                    isSelected
                      ? 'bg-[#A855F7] text-white shadow-lg shadow-[#A855F7]/20'
                      : 'bg-[#0A0908] text-[#9B9691] hover:text-[#F5F2ED] border border-[#1C1A18]'
                  }`}
                >
                  <IconComponent className="w-4 h-4" />
                  <span>{sub.label}</span>
                </button>
              );
            })}
          </div>

          <div className="relative my-3 shrink-0">
            <Search className="absolute left-3.5 top-3 w-4 h-4 text-[#9B9691]" />
            <input
              type="text"
              placeholder={`Search ${activeSubTab}...`}
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full bg-[#0A0908] border border-[#1C1A18] rounded-xl pl-10 pr-4 py-2.5 text-sm text-[#F5F2ED] focus:outline-none focus:border-[#A855F7] transition-all"
            />
          </div>

          <div className="flex-1 overflow-y-auto space-y-2.5 pr-1 custom-scrollbar">
            {loading ? (
              <div className="flex justify-center items-center py-16 text-[#9B9691]">
                <Loader2 className="w-6 h-6 animate-spin text-[#A855F7]" />
              </div>
            ) : filteredObjects.length === 0 ? (
              <div className="text-center py-16 text-[#9B9691] text-xs space-y-3">
                {!isUnlocked && (activeSubTab === 'totps' || activeSubTab === 'vault') ? (
                  <>
                    <p>Unlock to browse and attach {activeSubTab}.</p>
                    <button
                      type="button"
                      onClick={() => void promptSudo('unlock')}
                      className="inline-flex items-center justify-center px-4 py-2 rounded-xl bg-[#6366F1] text-white text-[11px] font-extrabold cursor-pointer border-none"
                    >
                      Unlock
                    </button>
                  </>
                ) : (
                  <p>No {activeSubTab} found.</p>
                )}
              </div>
            ) : (
              filteredObjects.map((item, idx) => {
                const rawTitle = item.title || item.name || item.label || item.serviceName || item.issuer || item.accountName || '';
                const isEncrypted = item.isEncrypted || item.encrypted || item.locked || isLikelyEncrypted(rawTitle);
                let titleText = rawTitle;
                if (isEncrypted) {
                  titleText = `Encrypted ${activeSubTab.charAt(0).toUpperCase() + activeSubTab.slice(1)}`;
                } else if (!titleText || titleText.trim() === '') {
                  titleText = 'Untitled Item';
                }

                return (
                  <div
                    key={item.$id || item.id || idx}
                    onClick={() => handleSelectObject(item)}
                    className="flex items-center justify-between p-3.5 rounded-2xl bg-[#0A0908] border border-[#1C1A18] hover:border-[#A855F7] transition-all cursor-pointer group"
                  >
                    <div className="flex items-center gap-3.5 min-w-0">
                      <div className="p-2.5 rounded-xl bg-[#161412] border border-[#1C1A18] text-[#A855F7] shrink-0">
                        {isEncrypted ? <Lock className="w-4 h-4 text-amber-400" /> : <CurrentSubTabIcon className="w-4 h-4" />}
                      </div>
                      <div className="min-w-0">
                        <div className="flex items-center gap-2">
                          <p className="text-sm font-bold text-[#F5F2ED] truncate group-hover:text-[#A855F7] transition-colors">
                            {titleText}
                          </p>
                          {isEncrypted && (
                            <span className="px-2 py-0.5 rounded-md bg-amber-500/10 text-amber-400 text-[10px] font-bold border border-amber-500/20">
                              Encrypted
                            </span>
                          )}
                        </div>
                        <p className="text-xs text-[#9B9691] font-mono mt-0.5 capitalize">
                          {activeSubTab}
                        </p>
                      </div>
                    </div>
                    <button className="px-3.5 py-1.5 rounded-xl bg-[#161412] border border-[#1C1A18] group-hover:bg-[#A855F7] group-hover:border-[#A855F7] text-xs font-bold text-[#F5F2ED] group-hover:text-white transition-all shrink-0">
                      Attach
                    </button>
                  </div>
                );
              })
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
