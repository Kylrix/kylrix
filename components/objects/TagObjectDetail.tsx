'use client';

import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { Tags } from '@/types/appwrite';
import { listTagsByUser, deleteTag } from '@/lib/appwrite';
import { useAuth } from '@/context/auth/AuthContext';
import { useUnifiedDrawer } from '@/context/UnifiedDrawerContext';
import { useToast } from '@/components/ui/Toast';
import { useDynamicSidebar } from '@/components/ui/DynamicSidebar';
import { useOverlay } from '@/components/ui/OverlayContext';
import { useRouter } from 'next/navigation';
import { TaggedResourcesTabs } from '@/components/share/TaggedResourcesTabs';
import { TagObjectRow } from '@/components/ui/TagObjectRow';
import {
  Plus as PlusIcon,
  Tag as TagIcon,
  Loader2 as SpinnerIcon,
  X,
  ArrowLeft,
} from 'lucide-react';

const PAGE_SIZE = 12;

interface TagObjectDetailProps {
  onClose?: () => void;
  initialTagId?: string | null;
  embedded?: boolean;
}

export function TagObjectDetail({ onClose, initialTagId = null, embedded: _embedded = false }: TagObjectDetailProps) {
  const { user, isAuthenticated } = useAuth();
  const router = useRouter();
  const { open: openUnified } = useUnifiedDrawer();
  const { showError } = useToast();
  const { openSidebar, closeSidebar } = useDynamicSidebar();
  const { openOverlay, closeOverlay } = useOverlay();

  const [tags, setTags] = useState<Tags[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selectedTag, setSelectedTag] = useState<Tags | null>(null);
  const [page, setPage] = useState(1);

  const [taggedResources, setTaggedResources] = useState<any>({
    notes: [],
    tasks: [],
    credentials: [],
    totps: [],
    events: [],
    forms: [],
    moments: [],
  });
  const [resolvingResources, setResolvingResources] = useState(false);

  const visibleTags = useMemo(() => tags.slice(0, page * PAGE_SIZE), [tags, page]);
  const hasMore = visibleTags.length < tags.length;

  const fetchTags = useCallback(async () => {
    if (!user?.$id) return;
    setLoading(true);
    setError(null);
    try {
      const res = await listTagsByUser(user.$id);
      const rows = (res.rows || []) as Tags[];
      setTags(rows);
      if (initialTagId) {
        const found = rows.find((t) => t.$id === initialTagId);
        if (found) setSelectedTag(found);
      }
    } catch (err: any) {
      setError(err?.message || 'Failed to load tags');
    } finally {
      setLoading(false);
    }
  }, [user?.$id, initialTagId]);

  useEffect(() => {
    if (isAuthenticated) {
      void fetchTags();
    } else {
      setLoading(false);
    }
  }, [isAuthenticated, fetchTags]);

  const handleResolveResources = useCallback(async (tag: Tags) => {
    setSelectedTag(tag);
    setResolvingResources(true);
    try {
      const { LocalEngine } = await import('@/lib/services/LocalEngine');
      const uid = user?.$id || 'guest';
      const [notes, tasks, creds, totps, events, forms] = await Promise.all([
        LocalEngine.cacheGet<any[]>(`f_notes_list_${uid}`).catch(() => []),
        LocalEngine.cacheGet<any[]>(`f_goals_list_${uid}`).catch(() => []),
        LocalEngine.cacheGet<any[]>(`f_vault_creds_${uid}`).catch(() => []),
        LocalEngine.cacheGet<any[]>(`f_vault_totp_${uid}`).catch(() => []),
        LocalEngine.cacheGet<any[]>(`f_events_${uid}`).catch(() => []),
        LocalEngine.cacheGet<any[]>(`f_forms_${uid}`).catch(() => []),
      ]);

      const tagName = tag.name || '';
      const filterByTag = (items: any[]) =>
        (items || []).filter(
          (it: any) =>
            Array.isArray(it.tags) && it.tags.some((t: string) => t.toLowerCase() === tagName.toLowerCase())
        );

      setTaggedResources({
        notes: filterByTag(notes || []),
        tasks: filterByTag(tasks || []),
        credentials: filterByTag(creds || []),
        totps: filterByTag(totps || []),
        events: filterByTag(events || []),
        forms: filterByTag(forms || []),
        moments: [],
      });
    } catch (err) {
      console.warn('Failed to resolve tagged resources:', err);
    } finally {
      setResolvingResources(false);
    }
  }, [user?.$id]);

  const handleOpenCreateTag = () => {
    openUnified('new-tag', {
      onSuccess: () => {
        void fetchTags();
      },
    });
  };

  const handleDeleteTag = (tagId: string, tagName: string) => {
    openUnified('delete-confirm', {
      title: `Delete tag "${tagName}"?`,
      description: 'Deleting this tag removes it from all categorized items. This cannot be undone.',
      confirmLabel: 'Delete Tag',
      onConfirm: async () => {
        try {
          await deleteTag(tagId);
          setTags((prev) => prev.filter((t) => t.$id !== tagId));
          if (selectedTag?.$id === tagId) {
            setSelectedTag(null);
          }
        } catch (err: any) {
          showError(err?.message || 'Failed to delete tag');
        }
      },
    });
  };

  const handleClose = () => {
    onClose?.();
    closeSidebar();
    closeOverlay();
  };

  return (
    <div className="h-full flex flex-col bg-[#161412] text-white overflow-hidden select-none">
      {/* Top Header */}
      <div className="p-4 md:p-5 border-b border-white/6 flex items-center justify-between gap-3 shrink-0 bg-[#161412]">
        <div className="flex items-center gap-3 min-w-0">
          {selectedTag ? (
            <button
              type="button"
              onClick={() => setSelectedTag(null)}
              className="w-8 h-8 rounded-xl bg-[#0A0908] border border-white/8 text-white/70 hover:text-white flex items-center justify-center transition-colors shrink-0 cursor-pointer"
            >
              <ArrowLeft size={16} />
            </button>
          ) : (
            <div className="w-8 h-8 rounded-xl bg-[#0A0908] text-[#F87171] flex items-center justify-center shrink-0">
              <TagIcon size={16} />
            </div>
          )}
          <div className="min-w-0">
            <h2 className="text-white font-black text-lg font-clash tracking-tight truncate">
              {selectedTag ? `#${selectedTag.name}` : 'Tags & Taxonomy'}
            </h2>
            <p className="text-white/50 text-xs font-satoshi truncate">
              {selectedTag ? 'Tagged objects & items' : `${tags.length} active tag(s)`}
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2 shrink-0">
          {!selectedTag && (
            <button
              type="button"
              onClick={handleOpenCreateTag}
              className="px-3 py-1.5 rounded-xl bg-white text-black font-black text-xs hover:bg-white/90 transition-all flex items-center gap-1.5 cursor-pointer"
            >
              <PlusIcon size={14} />
              <span>New Tag</span>
            </button>
          )}
          <button
            type="button"
            onClick={handleClose}
            className="w-8 h-8 rounded-xl bg-[#0A0908] border border-white/8 text-white/50 hover:text-white flex items-center justify-center transition-colors shrink-0 cursor-pointer"
          >
            <X size={16} />
          </button>
        </div>
      </div>

      {/* Body */}
      <div className="flex-1 overflow-y-auto p-4 md:p-5 space-y-4">
        {loading ? (
          <div className="py-12 flex flex-col items-center justify-center gap-3 text-white/40">
            <SpinnerIcon size={24} className="animate-spin text-[#6366F1]" />
            <span className="text-xs font-satoshi">Loading tags...</span>
          </div>
        ) : error ? (
          <div className="p-4 rounded-2xl bg-red-950/40 border border-red-500/20 text-red-300 text-xs font-satoshi">
            {error}
          </div>
        ) : selectedTag ? (
          <div className="space-y-4">
            {resolvingResources ? (
              <div className="py-12 flex flex-col items-center justify-center gap-3 text-white/40">
                <SpinnerIcon size={24} className="animate-spin text-[#6366F1]" />
                <span className="text-xs font-satoshi">Finding tagged items...</span>
              </div>
            ) : (
              <TaggedResourcesTabs
                resources={taggedResources}
                openSidebar={openSidebar}
                openSecondarySidebar={openSidebar}
                openOverlay={openOverlay}
                closeOverlay={closeOverlay}
                fetchProjectData={async () => {
                  if (selectedTag) void handleResolveResources(selectedTag);
                }}
                handleRemoveObject={async () => {}}
                router={router}
                showError={showError}
              />
            )}
          </div>
        ) : tags.length === 0 ? (
          <div className="py-16 text-center text-white/40 flex flex-col items-center justify-center gap-3">
            <div className="w-12 h-12 rounded-2xl bg-[#0A0908] border border-white/6 flex items-center justify-center text-white/20">
              <TagIcon size={22} />
            </div>
            <p className="text-sm font-bold text-white/60 font-satoshi">No tags found</p>
            <p className="text-xs text-white/40 max-w-xs font-satoshi">
              Create tags to organize and group ideas, goals, forms, and tools seamlessly.
            </p>
          </div>
        ) : (
          <div className="grid grid-cols-1 gap-3">
            {visibleTags.map((tag) => (
              <TagObjectRow
                key={tag.$id}
                tag={tag}
                onClick={() => handleResolveResources(tag)}
                onContextMenu={(e) => {
                  e.preventDefault();
                  handleResolveResources(tag);
                }}
                onDelete={() => handleDeleteTag(tag.$id, tag.name || 'Untitled Tag')}
              />
            ))}
            {hasMore && (
              <button
                type="button"
                onClick={() => setPage(p => p + 1)}
                className="w-full py-2.5 rounded-xl bg-white/5 hover:bg-white/10 text-white/70 hover:text-white text-xs font-bold transition-all mt-2 cursor-pointer"
              >
                Load More Tags
              </button>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
