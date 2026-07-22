'use client';

import React, { useState, useEffect, useCallback, useRef } from 'react';
import { Tags } from '@/types/appwrite';
import { listTags, deleteTag } from '@/lib/appwrite';
import { ProjectsService } from '@/lib/appwrite/projects';
import { useAuth } from '@/context/auth/AuthContext';
import { formatDateWithFallback } from '@/lib/date-utils';
import { useUnifiedDrawer } from '@/context/UnifiedDrawerContext';
import { MultiSectionContainer, useSection } from '@/context/SectionContext';
import { useFAB } from '@/context/FABContext';
import { useRouter } from 'next/navigation';
import { useToast } from '@/components/ui/Toast';
import { useDynamicSidebar } from '@/components/ui/DynamicSidebar';
import { useLayout } from '@/context/LayoutContext';
import { useOverlay } from '@/components/ui/OverlayContext';
import { TaggedResourcesTabs } from '@/components/share/TaggedResourcesTabs';
import { 
  Plus as PlusIcon, 
  Edit2 as EditIcon, 
  Trash2 as TrashIcon, 
  Tag as TagIcon,
  Clock as ClockIcon,
  Loader2 as SpinnerIcon,
  ArrowLeft,
  ShieldCheck
} from 'lucide-react';
import { SyncStatusDot } from '@/components/ui/SyncStatusDot';

export default function TagsPage() {
  const { user, isAuthenticated, openIDMWindow } = useAuth();
  const { open: openUnified } = useUnifiedDrawer();
  const { setConfiguration, resetConfiguration } = useFAB();
  const { setActiveDetail } = useSection();
  const { openSidebar } = useDynamicSidebar();
  const { openSecondarySidebar } = useLayout();
  const { openOverlay, closeOverlay } = useOverlay();
  const { showError } = useToast();
  const router = useRouter();
  
  const hasFetched = useRef(false);
  const [tags, setTags] = useState<Tags[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selectedTag, setSelectedTag] = useState<Tags | null>(null);
  const [taggedResources, setTaggedResources] = useState<any>({
    notes: [],
    tasks: [],
    credentials: [],
    totps: [],
    events: [],
    forms: [],
    moments: []
  });
  const [resolvingResources, setResolvingResources] = useState(false);

  const tagsLengthRef = useRef(tags.length);
  useEffect(() => {
    tagsLengthRef.current = tags.length;
  }, [tags.length]);

  const fetchTags = useCallback(async (showLoading = true) => {
    if (!user) {
      setError('User not authenticated');
      return;
    }

    const userId = user.$id;
    const cacheKey = `f_user_tags_${userId}`;

    if (tagsLengthRef.current === 0) {
      try {
        const { getRxDB } = await import('@/lib/webrtc/RxDBManager');
        const db = await getRxDB().catch(() => null);
        if (db) {
          const cachedDoc = await db.cache.findOne(cacheKey).exec().catch(() => null);
          if (cachedDoc?.data && Array.isArray(cachedDoc.data)) {
            setTags(cachedDoc.data as Tags[]);
            setLoading(false);
          }
        }
      } catch {}
    }

    try {
      if (showLoading && tagsLengthRef.current === 0) setLoading(true);
      const response = await listTags();
      const tagRows: Tags[] = Array.isArray(response)
        ? response
        : (Array.isArray((response as any)?.rows) ? (response as any).rows : []);

      setTags((prev) => {
        const byId = new Map<string, Tags>();
        (prev || []).forEach((t) => t && t.$id && byId.set(t.$id, t));
        tagRows.forEach((t) => t && t.$id && byId.set(t.$id, t));
        const merged = Array.from(byId.values());

        (async () => {
          try {
            const { getRxDB } = await import('@/lib/webrtc/RxDBManager');
            const db = await getRxDB().catch(() => null);
            if (db) {
              await db.cache.upsert({
                id: cacheKey,
                data: merged as any,
                timestamp: Date.now(),
              }).catch(() => {});
            }
          } catch {}
        })();

        return merged;
      });
    } catch (err: any) {
      setError(err instanceof Error ? err.message : 'Failed to fetch tags');
    } finally {
      setLoading(false);
    }
  }, [user]);

  const resolveTaggedResources = useCallback(async (tag: Tags) => {
    setResolvingResources(true);
    try {
      const res = await ProjectsService.listTaggedResources([tag.$id]);
      setTaggedResources(res);
    } catch (err) {
      console.error('Failed to resolve tagged resources:', err);
    } finally {
      setResolvingResources(false);
    }
  }, []);

  useEffect(() => {
    if (selectedTag) {
      resolveTaggedResources(selectedTag);
    }
  }, [selectedTag, resolveTaggedResources]);

  const handleCreateNew = useCallback(() => {
    openUnified('new-tag', { onSuccess: fetchTags });
  }, [openUnified, fetchTags]);

  useEffect(() => {
    if (!isAuthenticated) {
      openIDMWindow();
      return;
    }
    
    if (user && !hasFetched.current) {
      hasFetched.current = true;
      fetchTags();
    }
  }, [isAuthenticated, user, fetchTags, openIDMWindow]);

  const handleEdit = (tag: Tags) => {
    openUnified('new-tag', { tag, onSuccess: fetchTags });
  };

  const handleDelete = async (tag: Tags) => {
    openUnified('delete-confirm', {
        title: `Delete tag "${tag.name}"?`,
        description: 'This will remove the tag from all associated resources. The objects themselves will not be deleted.',
        resourceName: 'this tag',
        confirmLabel: 'Delete Tag',
        onConfirm: async () => {
            try {
                await deleteTag(tag.$id);
                await fetchTags();
                if (selectedTag?.$id === tag.$id) setSelectedTag(null);
            } catch (err: any) {
                setError(err instanceof Error ? err.message : 'Failed to delete tag');
            }
        }
    });
  };

  if (!isAuthenticated) {
    return (
      <div className="min-h-screen bg-[#0A0908] flex items-center justify-center">
        <div className="flex flex-col items-center gap-3">
          <SpinnerIcon className="animate-spin text-[#6366F1]" size={36} />
          <p className="text-white/40 text-sm font-semibold font-sans">Please log in to manage your tags</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#0A0908] text-white p-4 md:p-8">
      <div className="max-w-[1440px] mx-auto w-full">
        <MultiSectionContainer panels={['note', 'huddles', 'projects']}>
          
          {/* Header */}
          <header className="flex flex-col md:flex-row items-start md:items-center justify-between gap-4 p-5 mb-8 bg-white/[0.01] border border-white/8 rounded-[32px] shadow-2xl relative select-none">
            <div className="absolute top-[-1px] left-[10%] right-[10%] h-[1px] bg-gradient-to-r from-transparent via-[#EC4899] to-transparent" />
            <div className="flex items-center gap-4">
              <button
                onClick={() => selectedTag ? setSelectedTag(null) : router.back()}
                className="w-10 h-10 rounded-xl flex items-center justify-center text-white/40 hover:text-white bg-white/5 hover:bg-white/10 border border-white/6 transition-all"
              >
                <ArrowLeft size={18} />
              </button>
              <div>
                <h1 className="text-white font-black text-2xl md:text-3xl tracking-tight leading-tight mb-1 font-mono tracking-tighter">
                  {selectedTag ? `# ${selectedTag.name?.toUpperCase() || ''}` : 'Global Tags'}
                </h1>
                <p className="text-white/40 text-xs font-semibold leading-normal font-sans">
                  {selectedTag ? `Sweeping ecosystem resources with this tag` : 'Organize and sweep resources across the ecosystem'}
                </p>
              </div>
            </div>
            
            {!selectedTag && (
              <button 
                onClick={handleCreateNew}
                className="h-10 px-4 rounded-xl bg-[#6366F1]/10 hover:bg-[#6366F1]/20 border border-[#6366F1]/20 hover:border-[#6366F1]/40 flex items-center justify-center text-[#818CF8] font-bold text-xs gap-1.5 transition-all"
              >
                <PlusIcon size={16} />
                <span>Create Tag</span>
              </button>
            )}
          </header>

          {error && (
            <div className="p-4 mb-6 rounded-2xl bg-red-500/10 border border-red-500/20 text-[#ff4444] text-sm font-semibold">
              {error}
            </div>
          )}

          {!selectedTag ? (
            <>
              {/* Tags Grid */}
              {loading ? (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  {[1, 2, 3, 4].map((i) => (
                    <div 
                      key={i} 
                      className="p-6 rounded-[32px] bg-[#161412] border border-white/5 animate-pulse min-h-[180px]"
                    />
                  ))}
                </div>
              ) : tags.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-20 text-center select-none">
                  <div className="w-24 h-24 bg-white/5 border border-white/10 rounded-[28px] flex items-center justify-center mb-6 shadow-2xl">
                    <TagIcon size={38} className="text-white/30" />
                  </div>
                  <h4 className="text-white font-black text-lg tracking-tight mb-2">No Tags Yet</h4>
                  <p className="text-white/40 text-xs font-semibold max-w-xs leading-relaxed mb-6">
                    Create your first tag to start organizing your ecosystem
                  </p>
                  <button
                    onClick={handleCreateNew}
                    className="h-10 px-6 rounded-xl bg-[#6366F1] text-black font-extrabold text-xs transition-all hover:bg-[#6366F1]/80 hover:translate-y-[-1px]"
                  >
                    Create First Tag
                  </button>
                </div>
              ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  {tags.map((tag) => (
                    <div
                      key={tag.$id}
                      onClick={() => setSelectedTag(tag)}
                      className="p-6 rounded-[32px] bg-[#161412] border border-white/5 shadow-2xl hover:border-white/10 hover:bg-[#1C1A18] hover:translate-y-[-2px] transition-all duration-300 ease-out cursor-pointer flex flex-col justify-between min-h-[196px] group"
                    >
                      <div>
                        {/* Top Row: Name and Count */}
                        <div className="flex items-start gap-4 mb-3 w-full justify-between">
                          <div className="flex items-center gap-3 min-w-0">
                            <div 
                              style={{ 
                                backgroundColor: `${tag.color || '#6366F1'}1a`,
                                color: tag.color || '#6366F1',
                                borderColor: `${tag.color || '#6366F1'}33`
                              }}
                              className="w-12 h-12 rounded-2xl border flex items-center justify-center flex-shrink-0 group-hover:scale-105 transition-transform"
                            >
                              <TagIcon size={20} />
                            </div>
                            <div className="min-w-0 flex-1">
                              <div className="flex items-center gap-2">
                                <h3 className="text-white text-base font-black tracking-tight leading-tight truncate font-mono">
                                  {tag.name}
                                </h3>
                                <SyncStatusDot resourceId={tag.$id} />
                              </div>
                              <span className="block text-[9px] font-black uppercase tracking-wider text-white/30 font-mono mt-0.5">
                                {(tag as any).usageCount || 0} items
                              </span>
                            </div>
                          </div>
                        </div>

                        {/* Description */}
                        {tag.description && (
                          <p className="text-xs text-white/50 font-medium leading-relaxed mb-4 line-clamp-2 select-text">
                            {tag.description}
                          </p>
                        )}
                      </div>

                      <div>
                        {/* Access time metadata */}
                        <div className="flex items-center gap-1.5 text-white/20 text-[10px] font-bold font-mono uppercase mb-4">
                          <ClockIcon size={12} />
                          <span>
                            Created {formatDateWithFallback(tag.createdAt, { year: 'numeric', month: 'short', day: 'numeric' })}
                          </span>
                        </div>

                        {/* Bottom Row Actions */}
                        <div className="flex gap-3">
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              handleEdit(tag);
                            }}
                            className="flex-1 py-2 px-3 rounded-xl border border-white/5 bg-[#1C1A18] hover:bg-[#252220] hover:border-white/10 text-white font-extrabold text-xs flex items-center justify-center gap-1.5 transition-all"
                          >
                            <EditIcon size={14} />
                            <span>Edit</span>
                          </button>
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              handleDelete(tag);
                            }}
                            className="flex-1 py-2 px-3 rounded-xl border border-red-500/10 bg-red-500/5 hover:bg-red-500/10 hover:border-red-500/20 text-red-500 font-extrabold text-xs flex items-center justify-center gap-1.5 transition-all"
                          >
                            <TrashIcon size={14} />
                            <span>Delete</span>
                          </button>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </>
          ) : (
            <div className="flex flex-col gap-8">
              {/* Tagged Resources Section */}
              <div className="bg-[#161412] border border-white/6 rounded-[32px] overflow-hidden shadow-2xl">
                  <div className="border-b border-white/6 px-6 py-5 bg-white/[0.01] flex items-center justify-between gap-3">
                      <div className="flex items-center gap-3">
                        <TagIcon size={18} className="text-[#6366F1] flex-shrink-0" />
                        <span className="text-white font-black text-base tracking-tight leading-none block uppercase">
                            Swept Resources
                        </span>
                      </div>
                      <span className="bg-[#6366F1]/10 text-[#6366F1] text-[9px] font-black uppercase tracking-wider px-2 py-0.5 rounded border border-[#6366F1]/20">
                          AUTO-SWEPT
                      </span>
                  </div>
                  
                  <div className="px-6 py-3 bg-[#6366F1]/5 border-b border-white/4 flex items-center gap-2.5">
                      <ShieldCheck size={14} className="text-[#10B981] flex-shrink-0" />
                      <p className="text-[10px] text-white/50 font-bold leading-tight">
                        By default, tagged items keep their permissions. Global sweeping respects resource owner privacy.
                      </p>
                  </div>

                  <div className="p-4 md:p-8">
                    {resolvingResources ? (
                      <div className="flex flex-col items-center justify-center py-20 gap-3">
                         <SpinnerIcon className="animate-spin text-[#6366F1]" size={24} />
                         <span className="text-white/30 text-xs font-bold font-mono">Resolving ecosystem items...</span>
                      </div>
                    ) : Object.values(taggedResources).every((arr: any) => arr.length === 0) ? (
                      <div className="py-20 text-center select-none">
                        <p className="text-white/20 italic text-sm font-semibold">
                          No resources found with tag #{selectedTag.name}
                        </p>
                      </div>
                    ) : (
                      <TaggedResourcesTabs 
                        resources={taggedResources} 
                        openSidebar={openSidebar}
                        openSecondarySidebar={openSecondarySidebar}
                        openOverlay={openOverlay}
                        closeOverlay={closeOverlay}
                        fetchProjectData={async () => {}} // No project to refresh
                        handleRemoveObject={async () => {}} // Cannot remove from global swept list
                        router={router}
                        showError={showError}
                      />
                    )}
                  </div>
              </div>
            </div>
          )}

        </MultiSectionContainer>
      </div>
    </div>
  );
}
