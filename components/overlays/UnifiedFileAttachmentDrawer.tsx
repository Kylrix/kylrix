'use client';

/**
 * UnifiedFileAttachmentDrawer — 3-Tab Unified Attachment Drawer.
 * Tabs:
 *   1. 'objects' (Default) with sub-tabs: Goals, Ideas, Projects, Threads, TOTPs, Forms, Events, Vault, Tags.
 *      Fully hydrated from live SDK getters + RxDB + LocalEngine. Displays "Encrypted" badge when items are encrypted.
 *   2. 'synced': Synced Media from Storage Buckets cached in LocalEngine (0ms Local Copy + Live Refresh).
 *   3. 'upload': Drag-and-drop or file uploader.
 *
 * Fullscreen Expansion Supported.
 */

import React, { useState, useEffect, useCallback } from 'react';
import {
  X,
  UploadCloud,
  FileText,
  Image as ImageIcon,
  Music,
  Video,
  Check,
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
  Sparkles,
  FolderKanban,
  MessageSquare,
  ShieldAlert,
} from 'lucide-react';
import { useUnifiedFileDrawer, SyncedMediaFile } from '@/context/UnifiedFileDrawerContext';
import { LocalEngine } from '@/lib/services/LocalEngine';
import { StorageService } from '@/lib/services/storage';
import { getRxDB } from '@/lib/webrtc/RxDBManager';
import { useAuth } from '@/context/auth/AuthContext';
import { useNotes } from '@/context/NotesContext';
import { storage } from '@/lib/appwrite/client';
import { getAllTags, listNotesPaginated } from '@/lib/appwrite';
import { FormsService } from '@/lib/services/forms';
import { useTask } from '@/context/TaskContext';
import { ProjectsService } from '@/lib/appwrite/projects';
import { VaultService } from '@/lib/appwrite/vault';
import { tasks, events } from '@/lib/kylrixflow';

const BUCKETS = [
  'general_storage',
  'notes_attachments',
  'messages',
  'task_attachments',
  'voice',
  'profile_pictures',
  'event_covers',
];

type MainTab = 'objects' | 'synced' | 'upload';
type ObjectSubTab =
  | 'goals'
  | 'ideas'
  | 'projects'
  | 'threads'
  | 'totps'
  | 'forms'
  | 'events'
  | 'vault'
  | 'tags';

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
  const userId = user?.$id || 'guest';
  const { notes: localContextNotes } = useNotes();

  const { tasks: localContextGoals } = useTask();

  const [isFullscreen, setIsFullscreen] = useState(false);
  const [activeTab, setActiveTab] = useState<MainTab>('objects');
  const [activeSubTab, setActiveSubTab] = useState<ObjectSubTab>('goals');
  const [searchQuery, setSearchQuery] = useState('');

  const [mediaFiles, setMediaFiles] = useState<SyncedMediaFile[]>([]);
  const [objectItems, setObjectItems] = useState<any[]>([]);

  const [loading, setLoading] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [selectedFile, setSelectedFile] = useState<SyncedMediaFile | null>(null);

  // 1. Comprehensive 0ms Local & Live SDK Hydration for All Object Types
  const loadLocalObjects = useCallback(async () => {
    setLoading(true);
    try {
      let items: any[] = [];
      const db = await getRxDB();

      if (activeSubTab === 'ideas') {
        // Ideas / Notes — Unified 0ms Local Copy
        items = localContextNotes && localContextNotes.length > 0 ? localContextNotes : [];
        if (items.length === 0) {
          items = (await db.notes.find().exec()).map((d) => d.toJSON());
        }
        if (items.length === 0) {
          const res = await listNotesPaginated({ limit: 100 });
          items = res.rows || [];
        }
      } else if (activeSubTab === 'goals') {
        // Goals / Tasks — Unified 0ms Local Copy (Same as Goal Card Page)
        items = localContextGoals && localContextGoals.length > 0 ? localContextGoals : [];
        if (items.length === 0) {
          items = (await db.tasks.find().exec()).map((d) => d.toJSON());
        }
        if (items.length === 0) {
          items = (await LocalEngine.cacheGet<any[]>('f_goals_list')) || [];
        }
        if (items.length === 0) {
          try {
            const res = await tasks.list();
            items = res.rows || [];
          } catch (_e) {
            /* optional fallback */
          }
        }
      } else if (activeSubTab === 'projects') {
        // Projects
        try {
          items = (await LocalEngine.cacheGet<any[]>('f_projects_list')) || [];
          if (items.length === 0) {
            const res = await ProjectsService.listProjects(true);
            items = res.rows || [];
          }
        } catch (_e) {
          items = (await LocalEngine.cacheGet<any[]>('f_projects_list')) || [];
        }
      } else if (activeSubTab === 'threads') {
        // Threads / Discussions
        const allNotes = (await db.notes.find().exec()).map((d) => d.toJSON());
        items = allNotes.filter((n: any) => n.isThread || n.isDiscussion || n.isGhost);
        if (items.length === 0) {
          items = (await LocalEngine.cacheGet<any[]>('f_threads_list')) || [];
        }
      } else if (activeSubTab === 'totps') {
        // TOTPs / Credentials
        try {
          const res = await VaultService.listTOTPSecrets(userId);
          items = Array.isArray(res) ? res : [];
        } catch (_e) {
          items = (await LocalEngine.cacheGet<any[]>(`f_keychain_${userId}`)) || [];
        }
      } else if (activeSubTab === 'vault') {
        // Vault Items / Secrets
        try {
          items = await VaultService.listAllCredentials(userId);
        } catch (_e) {
          items = (await LocalEngine.cacheGet<any[]>(`f_keychain_${userId}`)) || [];
        }
      } else if (activeSubTab === 'tags') {
        // Tags
        try {
          const res = await getAllTags();
          items = res.rows || [];
        } catch (_e) {
          items = (await db.tags.find().exec()).map((d) => d.toJSON());
        }
      } else if (activeSubTab === 'forms') {
        // Forms
        try {
          const res = await FormsService.listUserForms(userId);
          items = Array.isArray(res) ? res : (res as any)?.rows || [];
        } catch (_e) {
          items = (await db.forms.find().exec()).map((d) => d.toJSON());
          if (items.length === 0) {
            items = (await LocalEngine.cacheGet<any[]>('f_forms_list')) || [];
          }
        }
      } else if (activeSubTab === 'events') {
        // Events
        try {
          const res = await events.list();
          items = res.rows || (Array.isArray(res) ? res : []);
        } catch (_e) {
          items = (await db.events.find().exec()).map((d) => d.toJSON());
          if (items.length === 0) {
            items = (await LocalEngine.cacheGet<any[]>('f_events_list')) || [];
          }
        }
      }

      setObjectItems(items);
    } catch (_e) {
      setObjectItems([]);
    } finally {
      setLoading(false);
    }
  }, [activeSubTab, userId, localContextNotes]);

  // Load Synced Media from LocalEngine + Storage Buckets + Local Notes Attachments
  const loadSyncedMedia = useCallback(async () => {
    try {
      const cachedMedia = await LocalEngine.cacheGet<SyncedMediaFile[]>(`f_user_media_${userId}`);
      if (cachedMedia && cachedMedia.length > 0) {
        setMediaFiles(cachedMedia);
      }

      // Live fetch across storage buckets
      const fetchedFiles: SyncedMediaFile[] = [];
      const seenIds = new Set<string>();

      // Scan attached media objects from local notes SoT
      if (localContextNotes && localContextNotes.length > 0) {
        localContextNotes.forEach((note: any) => {
          if (note.attachments) {
            try {
              const atts = typeof note.attachments === 'string' ? JSON.parse(note.attachments) : note.attachments;
              if (Array.isArray(atts)) {
                atts.forEach((a: any) => {
                  const fid = a.fileId || a.$id;
                  if (fid && !seenIds.has(fid)) {
                    seenIds.add(fid);
                    const bId = a.bucketId || 'notes_attachments';
                    fetchedFiles.push({
                      $id: fid,
                      name: a.name || a.title || 'Note Attachment',
                      bucketId: bId,
                      sizeOriginal: a.size || a.sizeOriginal || 0,
                      mimeType: a.mimeType || a.type || 'image/png',
                      createdAt: a.createdAt || note.createdAt || new Date().toISOString(),
                      fileUrl: a.fileUrl || StorageService.getFileView(fid, bId),
                    });
                  }
                });
              }
            } catch (_e) {}
          }
        });
      }

      for (const bucketId of BUCKETS) {
        try {
          const listRes = await storage.listFiles(bucketId);
          if (listRes?.files) {
            listRes.files.forEach((f: any) => {
              if (!seenIds.has(f.$id)) {
                seenIds.add(f.$id);
                fetchedFiles.push({
                  $id: f.$id,
                  name: f.name,
                  bucketId,
                  sizeOriginal: f.sizeOriginal || f.size || 0,
                  mimeType: f.mimeType,
                  createdAt: f.$createdAt || f.createdAt,
                  fileUrl: StorageService.getFileView(f.$id, bucketId),
                });
              }
            });
          }
        } catch (_e) {}
      }

      if (fetchedFiles.length > 0) {
        setMediaFiles(fetchedFiles);
        await LocalEngine.cacheSet(`f_user_media_${userId}`, fetchedFiles);
      }
    } catch (_err) {}
  }, [userId, localContextNotes]);

  useEffect(() => {
    if (isOpen) {
      setActiveTab('objects');
      setSelectedFile(null);
      void loadLocalObjects();
      void loadSyncedMedia();
    }
  }, [isOpen, loadLocalObjects, loadSyncedMedia]);

  if (!isOpen || !options) return null;

  const handleSelectObject = (item: any) => {
    const isEncrypted = item.isEncrypted || item.encrypted || item.locked;
    const itemTitle = isEncrypted
      ? 'Encrypted Item'
      : item.title || item.name || item.label || 'Attached Item';

    let rawReference = `[${itemTitle}](source:kylrix${activeSubTab}:${item.$id || item.id})`;
    if (activeSubTab === 'ideas') {
      rawReference = `[Idea: ${itemTitle}](file://notes/${item.$id || item.id})`;
    } else if (activeSubTab === 'goals') {
      rawReference = `[Goal: ${itemTitle}](source:kylrixgoal:${item.$id || item.id})`;
    } else if (activeSubTab === 'projects') {
      rawReference = `[Project: ${itemTitle}](source:kylrixproject:${item.$id || item.id})`;
    } else if (activeSubTab === 'threads') {
      rawReference = `[Thread: ${itemTitle}](source:kylrixthread:${item.$id || item.id})`;
    } else if (activeSubTab === 'totps') {
      rawReference = `[TOTP: ${itemTitle}](source:kylrixvault:${item.$id || item.id})`;
    }

    options.onSelectFile({
      $id: item.$id || item.id || 'obj',
      name: itemTitle,
      bucketId: activeSubTab,
      sizeOriginal: 0,
      mimeType: 'application/x-kylrix-object',
      fileUrl: rawReference,
    });
    closeFileDrawer();
  };

  const handleConfirmMediaSelection = () => {
    if (selectedFile) {
      options.onSelectFile(selectedFile);
      closeFileDrawer();
    }
  };

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setUploading(true);
    try {
      const bucket = 'notes_attachments';
      const uploaded = await StorageService.uploadFile(file, bucket);
      const newMedia: SyncedMediaFile = {
        $id: uploaded.$id,
        name: uploaded.name,
        bucketId: bucket,
        sizeOriginal: uploaded.sizeOriginal || file.size,
        mimeType: uploaded.mimeType || file.type,
        createdAt: new Date().toISOString(),
        fileUrl: StorageService.getFileView(uploaded.$id, bucket),
      };

      const updated = [newMedia, ...mediaFiles];
      setMediaFiles(updated);
      await LocalEngine.cacheSet(`f_user_media_${userId}`, updated);

      options.onSelectFile(newMedia);
      closeFileDrawer();
    } catch (err) {
      console.error('Failed to upload file:', err);
    } finally {
      setUploading(false);
    }
  };

  const filteredMedia = mediaFiles.filter((f) =>
    f.name.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const filteredObjects = objectItems.filter((o) =>
    String(o.title || o.name || o.label || '').toLowerCase().includes(searchQuery.toLowerCase())
  );

  const renderFileIcon = (file: SyncedMediaFile) => {
    const mime = file.mimeType || '';
    if (mime.startsWith('image/')) return <ImageIcon className="w-5 h-5 text-[#A855F7]" />;
    if (mime.startsWith('video/')) return <Video className="w-5 h-5 text-[#3B82F6]" />;
    if (mime.startsWith('audio/')) return <Music className="w-5 h-5 text-[#10B981]" />;
    return <FileText className="w-5 h-5 text-[#F59E0B]" />;
  };

  return (
    <div className="fixed inset-0 z-[999999] flex items-end justify-center bg-black/80 backdrop-blur-md animate-fadeIn">
      <div
        className={`w-full max-w-3xl bg-[#161412] border-t border-[#34322F] rounded-t-[28px] p-6 shadow-2xl font-satoshi flex flex-col transition-all ${
          isFullscreen ? 'h-[96vh]' : 'max-h-[85vh]'
        }`}
      >
        {/* Header */}
        <div className="flex items-center justify-between pb-4 border-b border-[#1C1A18]">
          <div className="flex items-center gap-2.5">
            <div className="p-2 rounded-xl bg-[#0A0908] border border-[#1C1A18] text-[#A855F7]">
              <Layers className="w-5 h-5" />
            </div>
            <div>
              <h3 className="font-clash font-extrabold text-xl text-[#F5F2ED]">
                {options.title || 'Attach Object or Media'}
              </h3>
              <p className="text-xs text-[#9B9691] font-mono mt-0.5">
                0ms Local Copy Engine
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={() => setIsFullscreen((prev) => !prev)}
              className="p-2 rounded-xl text-[#9B9691] hover:text-[#F5F2ED] bg-[#0A0908] border border-[#1C1A18] hover:border-[#34322F] transition-all"
              title={isFullscreen ? 'Shrink Drawer' : 'Full Screen'}
            >
              {isFullscreen ? <Minimize2 className="w-4 h-4" /> : <Maximize2 className="w-4 h-4" />}
            </button>
            <button
              onClick={closeFileDrawer}
              className="p-2 rounded-xl text-[#9B9691] hover:text-[#F5F2ED] bg-[#0A0908] border border-[#1C1A18] hover:border-[#34322F] transition-all"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* Main 3-Tab Switcher (Objects, Synced, Upload) */}
        <div className="flex items-center gap-2 mt-4 p-1.5 bg-[#0A0908] rounded-2xl border border-[#1C1A18]">
          <button
            onClick={() => setActiveTab('objects')}
            className={`flex-1 py-2.5 text-xs font-bold rounded-xl transition-all ${
              activeTab === 'objects'
                ? 'bg-[#161412] text-[#F5F2ED] border border-[#34322F] shadow-md'
                : 'text-[#9B9691] hover:text-[#F5F2ED]'
            }`}
          >
            Objects
          </button>
          <button
            onClick={() => setActiveTab('synced')}
            className={`flex-1 py-2.5 text-xs font-bold rounded-xl transition-all ${
              activeTab === 'synced'
                ? 'bg-[#161412] text-[#F5F2ED] border border-[#34322F] shadow-md'
                : 'text-[#9B9691] hover:text-[#F5F2ED]'
            }`}
          >
            Synced ({mediaFiles.length})
          </button>
          <button
            onClick={() => setActiveTab('upload')}
            className={`flex-1 py-2.5 text-xs font-bold rounded-xl transition-all ${
              activeTab === 'upload'
                ? 'bg-[#161412] text-[#F5F2ED] border border-[#34322F] shadow-md'
                : 'text-[#9B9691] hover:text-[#F5F2ED]'
            }`}
          >
            Upload
          </button>
        </div>

        {/* Tab 1: Objects */}
        {activeTab === 'objects' && (
          <div className="flex-1 flex flex-col overflow-hidden mt-4">
            {/* Scrollable Sub-Tabs */}
            <div className="flex items-center gap-2 overflow-x-auto pb-2 custom-scrollbar">
              {[
                { id: 'goals', label: 'Goals', icon: Target },
                { id: 'ideas', label: 'Ideas', icon: FileText },
                { id: 'projects', label: 'Projects', icon: FolderKanban },
                { id: 'threads', label: 'Threads', icon: MessageSquare },
                { id: 'totps', label: 'TOTPs', icon: ShieldAlert },
                { id: 'forms', label: 'Forms', icon: FileCode },
                { id: 'events', label: 'Events', icon: Calendar },
                { id: 'vault', label: 'Vault', icon: Key },
                { id: 'tags', label: 'Tags', icon: TagIcon },
              ].map((sub) => {
                const IconComponent = sub.icon;
                const isSelected = activeSubTab === sub.id;
                return (
                  <button
                    key={sub.id}
                    onClick={() => setActiveSubTab(sub.id as ObjectSubTab)}
                    className={`flex items-center gap-2 px-3.5 py-2 rounded-xl text-xs font-bold whitespace-nowrap transition-all ${
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

            <div className="relative my-3">
              <Search className="absolute left-3.5 top-3 w-4 h-4 text-[#9B9691]" />
              <input
                type="text"
                placeholder={`Search local ${activeSubTab}...`}
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
                <div className="text-center py-16 text-[#9B9691] text-xs">
                  No local {activeSubTab} found.
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
                          {isEncrypted ? <Lock className="w-4 h-4 text-amber-400" /> : <Sparkles className="w-4 h-4" />}
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
                            {activeSubTab} • Local Copy
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
        )}

        {/* Tab 2: Synced */}
        {activeTab === 'synced' && (
          <div className="flex-1 flex flex-col overflow-hidden mt-4">
            <div className="relative mb-3">
              <Search className="absolute left-3.5 top-3 w-4 h-4 text-[#9B9691]" />
              <input
                type="text"
                placeholder="Search synced media..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full bg-[#0A0908] border border-[#1C1A18] rounded-xl pl-10 pr-4 py-2.5 text-sm text-[#F5F2ED] focus:outline-none focus:border-[#A855F7]"
              />
            </div>

            <div className="flex-1 overflow-y-auto space-y-2.5 pr-1 custom-scrollbar">
              {filteredMedia.length === 0 ? (
                <div className="text-center py-16 text-[#9B9691] text-xs flex flex-col items-center gap-2">
                  <span>No synced media files found in local storage.</span>
                  <button
                    onClick={() => void loadSyncedMedia()}
                    className="mt-2 px-3 py-1.5 rounded-xl bg-[#0A0908] border border-[#1C1A18] text-[#A855F7] text-xs font-bold hover:bg-[#161412]"
                  >
                    Refresh Media Storage
                  </button>
                </div>
              ) : (
                filteredMedia.map((file) => {
                  const isSelected = selectedFile?.$id === file.$id;
                  const isImg = file.mimeType?.startsWith('image/') || /\.(jpg|jpeg|png|webp|gif|svg)$/i.test(file.name);
                  const isAudio = file.mimeType?.startsWith('audio/') || /\.(mp3|wav|ogg|m4a|webm)$/i.test(file.name) || file.bucketId === 'voice';

                  return (
                    <div
                      key={file.$id}
                      onClick={() => setSelectedFile(file)}
                      className={`flex flex-col gap-2 p-3.5 rounded-2xl border transition-all cursor-pointer ${
                        isSelected
                          ? 'bg-[#161412] border-[#A855F7] shadow-lg shadow-[#A855F7]/10'
                          : 'bg-[#0A0908] border-[#1C1A18] hover:border-[#34322F]'
                      }`}
                    >
                      <div className="flex items-center justify-between min-w-0 w-full">
                        <div className="flex items-center gap-3.5 min-w-0">
                          {isImg ? (
                            /* eslint-disable-next-line @next/next/no-img-element */
                            <img
                              src={file.fileUrl}
                              alt={file.name}
                              className="w-12 h-12 rounded-xl object-cover border border-[#1C1A18] shrink-0 bg-[#161412]"
                            />
                          ) : (
                            <div className="p-2.5 rounded-xl bg-[#161412] border border-[#1C1A18] text-[#A855F7]">
                              {renderFileIcon(file)}
                            </div>
                          )}
                          <div className="min-w-0">
                            <p className="text-sm font-semibold text-[#F5F2ED] truncate">
                              {file.name}
                            </p>
                            <p className="text-xs text-[#9B9691] font-mono mt-0.5 capitalize">
                              {file.bucketId.replace('_', ' ')} • {(file.sizeOriginal / 1024).toFixed(1)} KB
                            </p>
                          </div>
                        </div>
                        {isSelected && (
                          <div className="p-1.5 rounded-full bg-[#A855F7] text-white shrink-0 ml-2">
                            <Check className="w-4 h-4" />
                          </div>
                        )}
                      </div>

                      {/* Inline Audio Player Preview for Voice Notes */}
                      {isAudio && (
                        <div className="mt-1 pt-2 border-t border-[#1C1A18]/60 w-full" onClick={(e) => e.stopPropagation()}>
                          <audio controls src={file.fileUrl} className="w-full h-8 rounded-lg bg-[#161412]" />
                        </div>
                      )}
                    </div>
                  );
                })
              )}
            </div>

            {selectedFile && (
              <div className="mt-4 pt-3 border-t border-[#1C1A18] flex justify-end">
                <button
                  onClick={handleConfirmMediaSelection}
                  className="px-6 py-2.5 bg-[#A855F7] hover:bg-[#9333EA] text-white font-bold text-sm rounded-xl transition-all shadow-lg"
                >
                  Attach Selected Media
                </button>
              </div>
            )}
          </div>
        )}

        {/* Tab 3: Upload */}
        {activeTab === 'upload' && (
          <div className="flex-1 flex flex-col items-center justify-center py-16 mt-4 border-2 border-dashed border-[#1C1A18] rounded-2xl bg-[#0A0908]">
            {uploading ? (
              <div className="flex flex-col items-center gap-3">
                <Loader2 className="w-8 h-8 animate-spin text-[#A855F7]" />
                <p className="text-xs text-[#9B9691]">Uploading and caching to local media...</p>
              </div>
            ) : (
              <label className="flex flex-col items-center gap-3 cursor-pointer">
                <div className="p-4 rounded-2xl bg-[#161412] border border-[#1C1A18] text-[#A855F7]">
                  <UploadCloud className="w-8 h-8" />
                </div>
                <div className="text-center">
                  <p className="text-sm font-bold text-[#F5F2ED]">Click to browse file</p>
                  <p className="text-xs text-[#9B9691] mt-1">
                    File will be uploaded and cached to your local media
                  </p>
                </div>
                <input
                  type="file"
                  onChange={handleFileUpload}
                  className="hidden"
                />
              </label>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
