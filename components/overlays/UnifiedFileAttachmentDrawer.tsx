'use client';

/**
 * UnifiedFileAttachmentDrawer — 3-Tab Unified Attachment Drawer.
 * Tabs:
 *   1. 'objects' (Default) with sub-tabs: Goals, Notes, Forms, Events, Vault, Tags. (0ms Local Copy)
 *   2. 'synced': Synced Media from Storage Buckets cached in LocalEngine (0ms Local Copy)
 *   3. 'upload': Drag-and-drop or upload new file
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
  HardDrive,
  Target,
  FileCode,
  Calendar,
  Key,
  Tag,
  Layers,
} from 'lucide-react';
import { useUnifiedFileDrawer, SyncedMediaFile } from '@/context/UnifiedFileDrawerContext';
import { LocalEngine } from '@/lib/services/LocalEngine';
import { StorageService } from '@/lib/services/storage';
import { useAuth } from '@/context/auth/AuthContext';

const BUCKETS = [
  'notes_attachments',
  'messages',
  'task_attachments',
  'voice',
  'profile_pictures',
];

type MainTab = 'objects' | 'synced' | 'upload';
type ObjectSubTab = 'goals' | 'notes' | 'forms' | 'events' | 'vault' | 'tags';

export function UnifiedFileAttachmentDrawer() {
  const { isOpen, options, closeFileDrawer } = useUnifiedFileDrawer();
  const { user } = useAuth();
  const userId = user?.$id || 'guest';

  const [activeTab, setActiveTab] = useState<MainTab>('objects');
  const [activeSubTab, setActiveSubTab] = useState<ObjectSubTab>('goals');
  const [searchQuery, setSearchQuery] = useState('');

  const [mediaFiles, setMediaFiles] = useState<SyncedMediaFile[]>([]);
  const [objectItems, setObjectItems] = useState<any[]>([]);

  const [loading, setLoading] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [selectedFile, setSelectedFile] = useState<SyncedMediaFile | null>(null);

  // 1. Load Local Copy Objects & Media at 0ms Speed
  const loadLocalData = useCallback(async () => {
    setLoading(true);
    try {
      // Synced Media Local Copy
      const cachedMedia = await LocalEngine.cacheGet<SyncedMediaFile[]>(`f_user_media_${userId}`);
      if (cachedMedia && cachedMedia.length > 0) {
        setMediaFiles(cachedMedia);
      }

      // Objects Local Copy depending on subtab
      const cachedObjects = await LocalEngine.cacheGet<any[]>(`f_${activeSubTab}_${userId}`) ||
                            await LocalEngine.cacheGet<any[]>(`f_user_${activeSubTab}_${userId}`) || [];
      setObjectItems(cachedObjects);
    } catch (_e) {} finally {
      setLoading(false);
    }

    // Remote sync for storage media if online
    if (typeof navigator !== 'undefined' && navigator.onLine) {
      try {
        const fetchedFiles: SyncedMediaFile[] = [];
        for (const bucketId of BUCKETS) {
          try {
            const listRes = await StorageService.listFiles(bucketId, [], 50);
            if (listRes?.files) {
              listRes.files.forEach((f: any) => {
                fetchedFiles.push({
                  $id: f.$id,
                  name: f.name,
                  bucketId,
                  sizeOriginal: f.sizeOriginal || f.size || 0,
                  mimeType: f.mimeType,
                  createdAt: f.$createdAt || f.createdAt,
                  fileUrl: StorageService.getFileView(f.$id, bucketId),
                });
              });
            }
          } catch (_e) {}
        }
        if (fetchedFiles.length > 0) {
          setMediaFiles(fetchedFiles);
          await LocalEngine.cacheSet(`f_user_media_${userId}`, fetchedFiles);
        }
      } catch (_err) {}
    }
  }, [userId, activeSubTab]);

  useEffect(() => {
    if (isOpen) {
      setActiveTab('objects');
      setSelectedFile(null);
      void loadLocalData();
    }
  }, [isOpen, loadLocalData]);

  if (!isOpen || !options) return null;

  const handleSelectObject = (item: any) => {
    const itemTitle = item.title || item.name || item.label || 'Attached Item';
    let rawReference = `[${itemTitle}](source:kylrix${activeSubTab}:${item.$id || item.id})`;
    if (activeSubTab === 'notes') {
      rawReference = `[Note: ${itemTitle}](file://notes/${item.$id || item.id})`;
    } else if (activeSubTab === 'goals') {
      rawReference = `[Goal: ${itemTitle}](source:kylrixgoal:${item.$id || item.id})`;
    } else if (activeSubTab === 'forms') {
      rawReference = `[Form: ${itemTitle}](source:kylrixform:${item.$id || item.id})`;
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
    String(o.title || o.name || '').toLowerCase().includes(searchQuery.toLowerCase())
  );

  const renderFileIcon = (file: SyncedMediaFile) => {
    const mime = file.mimeType || '';
    if (mime.startsWith('image/')) return <ImageIcon className="w-5 h-5 text-[#A855F7]" />;
    if (mime.startsWith('video/')) return <Video className="w-5 h-5 text-[#3B82F6]" />;
    if (mime.startsWith('audio/')) return <Music className="w-5 h-5 text-[#10B981]" />;
    return <FileText className="w-5 h-5 text-[#F59E0B]" />;
  };

  return (
    <div className="fixed inset-0 z-[999999] flex items-end justify-center bg-black/75 backdrop-blur-md animate-fadeIn">
      <div className="w-full max-w-2xl bg-[#0A0908] border-t border-[#1C1A18] rounded-t-[28px] p-6 shadow-2xl font-satoshi flex flex-col max-h-[85vh] transition-all">
        {/* Header */}
        <div className="flex items-center justify-between pb-4 border-b border-[#1C1A18]">
          <div className="flex items-center gap-2.5">
            <Layers className="w-5 h-5 text-[#A855F7]" />
            <h3 className="font-clash font-extrabold text-xl text-[#F5F2ED]">
              {options.title || 'Attach Object or Media'}
            </h3>
          </div>
          <button
            onClick={closeFileDrawer}
            className="p-2 rounded-xl text-[#9B9691] hover:text-[#F5F2ED] hover:bg-[#161412] transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Top 3-Tab Switcher */}
        <div className="flex items-center gap-2 mt-4 p-1 bg-[#161412] rounded-xl border border-[#1C1A18]">
          <button
            onClick={() => setActiveTab('objects')}
            className={`flex-1 py-2 text-xs font-bold rounded-lg transition-all ${
              activeTab === 'objects'
                ? 'bg-[#1C1A18] text-[#F5F2ED] shadow-sm'
                : 'text-[#9B9691] hover:text-[#F5F2ED]'
            }`}
          >
            Objects
          </button>
          <button
            onClick={() => setActiveTab('synced')}
            className={`flex-1 py-2 text-xs font-bold rounded-lg transition-all ${
              activeTab === 'synced'
                ? 'bg-[#1C1A18] text-[#F5F2ED] shadow-sm'
                : 'text-[#9B9691] hover:text-[#F5F2ED]'
            }`}
          >
            Synced Media ({mediaFiles.length})
          </button>
          <button
            onClick={() => setActiveTab('upload')}
            className={`flex-1 py-2 text-xs font-bold rounded-lg transition-all ${
              activeTab === 'upload'
                ? 'bg-[#1C1A18] text-[#F5F2ED] shadow-sm'
                : 'text-[#9B9691] hover:text-[#F5F2ED]'
            }`}
          >
            Upload New
          </button>
        </div>

        {/* Tab 1: Objects (With Sub-Tabs) */}
        {activeTab === 'objects' && (
          <div className="flex-1 flex flex-col overflow-hidden mt-4">
            {/* Scrollable Sub-Tabs */}
            <div className="flex items-center gap-1.5 overflow-x-auto pb-2 custom-scrollbar">
              {[
                { id: 'goals', label: 'Goals', icon: Target },
                { id: 'notes', label: 'Notes', icon: FileText },
                { id: 'forms', label: 'Forms', icon: FileCode },
                { id: 'events', label: 'Events', icon: Calendar },
                { id: 'vault', label: 'Vault', icon: Key },
                { id: 'tags', label: 'Tags', icon: Tag },
              ].map((sub) => {
                const IconComponent = sub.icon;
                const isSelected = activeSubTab === sub.id;
                return (
                  <button
                    key={sub.id}
                    onClick={() => setActiveSubTab(sub.id as ObjectSubTab)}
                    className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold whitespace-nowrap transition-all ${
                      isSelected
                        ? 'bg-[#A855F7] text-white shadow-sm'
                        : 'bg-[#161412] text-[#9B9691] hover:text-[#F5F2ED] border border-[#1C1A18]'
                    }`}
                  >
                    <IconComponent className="w-3.5 h-3.5" />
                    <span>{sub.label}</span>
                  </button>
                );
              })}
            </div>

            <div className="relative my-2">
              <Search className="absolute left-3.5 top-3 w-4 h-4 text-[#9B9691]" />
              <input
                type="text"
                placeholder={`Search local ${activeSubTab}...`}
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full bg-[#161412] border border-[#1C1A18] rounded-xl pl-10 pr-4 py-2 text-sm text-[#F5F2ED] focus:outline-none focus:border-[#A855F7]"
              />
            </div>

            <div className="flex-1 overflow-y-auto space-y-2 pr-1 custom-scrollbar">
              {loading ? (
                <div className="flex justify-center items-center py-12 text-[#9B9691]">
                  <Loader2 className="w-6 h-6 animate-spin text-[#A855F7]" />
                </div>
              ) : filteredObjects.length === 0 ? (
                <div className="text-center py-12 text-[#9B9691] text-xs">
                  No local {activeSubTab} found.
                </div>
              ) : (
                filteredObjects.map((item, idx) => (
                  <div
                    key={item.$id || item.id || idx}
                    onClick={() => handleSelectObject(item)}
                    className="flex items-center justify-between p-3 rounded-xl bg-[#161412] border border-[#1C1A18] hover:border-[#A855F7] transition-all cursor-pointer group"
                  >
                    <div className="flex items-center gap-3 min-w-0">
                      <div className="p-2 rounded-lg bg-[#0A0908] border border-[#1C1A18] text-[#A855F7]">
                        <Layers className="w-4 h-4" />
                      </div>
                      <div className="min-w-0">
                        <p className="text-sm font-bold text-[#F5F2ED] truncate group-hover:text-[#A855F7] transition-colors">
                          {item.title || item.name || item.label || 'Untitled Object'}
                        </p>
                        <p className="text-xs text-[#9B9691] font-mono mt-0.5 capitalize">
                          {activeSubTab} • Local Copy
                        </p>
                      </div>
                    </div>
                    <button className="px-3 py-1.5 rounded-lg bg-[#1C1A18] hover:bg-[#A855F7] hover:text-white text-xs font-bold text-[#F5F2ED] transition-all">
                      Attach
                    </button>
                  </div>
                ))
              )}
            </div>
          </div>
        )}

        {/* Tab 2: Synced Media (0ms Instant Selection) */}
        {activeTab === 'synced' && (
          <div className="flex-1 flex flex-col overflow-hidden mt-4">
            <div className="relative mb-3">
              <Search className="absolute left-3.5 top-3 w-4 h-4 text-[#9B9691]" />
              <input
                type="text"
                placeholder="Search synced media..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full bg-[#161412] border border-[#1C1A18] rounded-xl pl-10 pr-4 py-2 text-sm text-[#F5F2ED] focus:outline-none focus:border-[#A855F7]"
              />
            </div>

            <div className="flex-1 overflow-y-auto space-y-2 pr-1 custom-scrollbar">
              {loading && mediaFiles.length === 0 ? (
                <div className="flex justify-center items-center py-12 text-[#9B9691]">
                  <Loader2 className="w-6 h-6 animate-spin text-[#A855F7]" />
                </div>
              ) : filteredMedia.length === 0 ? (
                <div className="text-center py-12 text-[#9B9691] text-xs">
                  No synced media found.
                </div>
              ) : (
                filteredMedia.map((file) => {
                  const isSelected = selectedFile?.$id === file.$id;
                  return (
                    <div
                      key={file.$id}
                      onClick={() => setSelectedFile(file)}
                      className={`flex items-center justify-between p-3 rounded-xl border transition-all cursor-pointer ${
                        isSelected
                          ? 'bg-[#1C1A18] border-[#A855F7] shadow-sm'
                          : 'bg-[#161412] border-[#1C1A18] hover:border-[#34322F]'
                      }`}
                    >
                      <div className="flex items-center gap-3 min-w-0">
                        <div className="p-2.5 rounded-lg bg-[#0A0908] border border-[#1C1A18]">
                          {renderFileIcon(file)}
                        </div>
                        <div className="min-w-0">
                          <p className="text-sm font-semibold text-[#F5F2ED] truncate">
                            {file.name}
                          </p>
                          <p className="text-xs text-[#9B9691] font-mono mt-0.5">
                            {file.bucketId} • {(file.sizeOriginal / 1024).toFixed(1)} KB
                          </p>
                        </div>
                      </div>
                      {isSelected && (
                        <div className="p-1 rounded-full bg-[#A855F7] text-white">
                          <Check className="w-4 h-4" />
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
                  className="px-5 py-2.5 bg-[#A855F7] hover:bg-[#9333EA] text-white font-bold text-sm rounded-xl transition-all shadow-lg"
                >
                  Attach Selected Media
                </button>
              </div>
            )}
          </div>
        )}

        {/* Tab 3: Upload New */}
        {activeTab === 'upload' && (
          <div className="flex-1 flex flex-col items-center justify-center py-12 mt-4 border-2 border-dashed border-[#1C1A18] rounded-2xl bg-[#161412]/50">
            {uploading ? (
              <div className="flex flex-col items-center gap-3">
                <Loader2 className="w-8 h-8 animate-spin text-[#A855F7]" />
                <p className="text-xs text-[#9B9691]">Uploading and syncing to local media...</p>
              </div>
            ) : (
              <label className="flex flex-col items-center gap-3 cursor-pointer">
                <div className="p-4 rounded-full bg-[#1C1A18] text-[#A855F7]">
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
