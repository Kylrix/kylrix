'use client';

import React, { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import { Tags } from '@/types/appwrite';
import { listTags, deleteTag } from '@/lib/appwrite';
import { ProjectsService } from '@/lib/appwrite/projects';
import { useAuth } from '@/context/auth/AuthContext';
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
  Loader2 as SpinnerIcon,
  ArrowLeft,
  ShieldCheck
} from 'lucide-react';

import { TagNotesListSidebar } from '@/components/ui/TagNotesListSidebar';
import { useContextMenu } from '@/components/ui/ContextMenuContext';

import { TagObjectRow } from '@/components/ui/TagObjectRow';

const PAGE_SIZE = 12;

function useIsDesktop() {
  const [isDesktop, setIsDesktop] = useState(false);

  useEffect(() => {
    if (typeof window === 'undefined') return;
    const media = window.matchMedia('(min-width: 768px)');
    const sync = () => setIsDesktop(media.matches);
    sync();
    media.addEventListener('change', sync);
    return () => media.removeEventListener('change', sync);
  }, []);

  return isDesktop;
}

export default function TagsPage() {
  const { user, isAuthenticated, openIDMWindow } = useAuth();
  const { open: openUnified } = useUnifiedDrawer();
  const {} = useFAB();
  const { } = useSection();
  const { openSidebar, closeSidebar } = useDynamicSidebar();
  const { openSecondarySidebar } = useLayout();
  const isDesktop = useIsDesktop();
  const { openOverlay, closeOverlay } = useOverlay();
  const contextMenu = useContextMenu();
  const { showError } = useToast();
  const router = useRouter();
  
  const hasFetched = useRef(false);
  const [tags, setTags] = useState<Tags[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selectedTag, setSelectedTag] = useState<Tags | null>(null);
  const [page, setPage] = useState(1);
  const sentinelRef = useRef<HTMLDivElement | null>(null);
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

  const visibleTags = useMemo(() => tags.slice(0, page * PAGE_SIZE), [tags, page]);
  const hasMore = visibleTags.length < tags.length;

  useEffect(() => {
    if (!sentinelRef.current || !hasMore) return;
    const observer = new IntersectionObserver(
      (entries) => {
        if (entries[0]?.isIntersecting) {
          setPage((prev) => prev + 1);
        }
      },
      { rootMargin: '200px' }
    );
    observer.observe(sentinelRef.current);
    return () => observer.disconnect();
  }, [hasMore]);

  const fetchTags = useCallback(async (showLoading = true) => {
    if (!user) {
      setError('User not authenticated');
      return;
    }

    const userId = user.$id;
    const cacheKey = `f_user_tags_${userId}`;

    // 1. Paint local first — LocalEngine instant (global, workspace-agnostic per tag spec)
    if (tagsLengthRef.current === 0) {
      try {
        const { LocalEngine } = await import('@/lib/services/LocalEngine');
        const cached = await LocalEngine.cacheGet<Tags[]>(cacheKey);
        if (cached && Array.isArray(cached) && cached.length) {
          setTags(cached);
          setLoading(false);
        }
      } catch {}
    }

    try {
      if (showLoading && tagsLengthRef.current === 0) setLoading(true);

      // 2. Background replenish — via secure-ops branching (client TablesDB read-only per system.server-sdk-action)
      // Tags are global (not one of 6 workspace-scoped objects: note/goal/event/form/credential/totp), so fetch once
      // Uses listTags() → listTagsSecure() → createSystemTablesDB (Admin) + getActor(JWT) — RLS-safe, not direct DB bypass
      const fetchAllTags = async (): Promise<Tags[]> => {
        try {
          const res: any = await listTags();
          const rows: Tags[] = Array.isArray(res?.rows) ? res.rows : (Array.isArray(res) ? res : []);
          // Server already does limit 100 + orderDesc; for >100, paginated secure fetch would be needed
          // For now treat as full (covers most users) and merge locally
          return rows.filter((r: any) => r?.$id) as Tags[];
        } catch {
          return [];
        }
      };

      const tagRows = await fetchAllTags();

      setTags((prev) => {
        const byId = new Map<string, Tags>();
        (prev || []).forEach((t) => t && t.$id && byId.set(t.$id, t));
        tagRows.forEach((t) => t && t.$id && byId.set(t.$id, t));
        const merged = Array.from(byId.values());
        // Sort by updatedAt desc for stable UI (matches server orderDesc)
        merged.sort((a: any, b: any) => new Date(b.$updatedAt || b.$createdAt || 0).getTime() - new Date(a.$updatedAt || a.$createdAt || 0).getTime());

        void (async () => {
          try {
            const { LocalEngine } = await import('@/lib/services/LocalEngine');
            await LocalEngine.cacheSet(cacheKey, merged);
          } catch {}
        })();

        return merged;
      });
    } catch (err: any) {
      // Failed pull must not wipe populated live set (local-first #2)
      if (tagsLengthRef.current === 0) {
        setError(err instanceof Error ? err.message : 'Failed to fetch tags');
      }
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

  const handleTagClick = useCallback(
    (tag: Tags) => {
      setSelectedTag(tag);
      if (isDesktop) {
        openSidebar(
          <TagNotesListSidebar
            tag={tag}
            onBack={() => closeSidebar()}
            onNoteUpdate={() => fetchTags(false)}
            onNoteDelete={() => fetchTags(false)}
          />,
          tag.$id,
          { hideHeader: true },
        );
      } else {
        openOverlay(
          <TagNotesListSidebar
            tag={tag}
            onBack={() => closeOverlay()}
            onNoteUpdate={() => fetchTags(false)}
            onNoteDelete={() => fetchTags(false)}
          />,
        );
      }
    },
    [isDesktop, openSidebar, closeSidebar, openOverlay, closeOverlay, fetchTags],
  );

  const handleTagContextMenu = useCallback(
    (e: React.MouseEvent | React.TouchEvent, tag: Tags) => {
      e.preventDefault();
      e.stopPropagation();
      const point = 'touches' in e ? e.touches[0] : e;
      contextMenu?.openMenu({
        x: point?.clientX ?? 0,
        y: point?.clientY ?? 0,
        items: [
          {
            label: `Tag: #${tag.name}`,
            onClick: () => handleTagClick(tag),
          },
          {
            label: 'Edit Tag',
            icon: <EditIcon size={16} />,
            onClick: () => handleEdit(tag),
          },
          {
            label: 'Delete Tag',
            icon: <TrashIcon size={16} className="text-red-500" />,
            variant: 'destructive',
            onClick: () => handleDelete(tag),
          },
        ],
      });
    },
    [contextMenu, handleTagClick],
  );

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
    <div className="min-h-screen bg-[#0A0908] text-white p-4 md:p-8 pt-6 md:pt-8">
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
                <>
                  <div className="grid gap-6 items-stretch [grid-template-columns:repeat(auto-fill,minmax(min(100%,280px),1fr))] sm:[grid-template-columns:repeat(auto-fill,minmax(280px,1fr))] xl:[grid-template-columns:repeat(auto-fill,minmax(300px,1fr))]">
                    {visibleTags.map((tag) => (
                      <TagObjectRow
                        key={tag.$id}
                        tag={tag}
                        onClick={() => handleTagClick(tag)}
                        onContextMenu={(e) => handleTagContextMenu(e, tag)}
                        onEdit={() => handleEdit(tag)}
                        onDelete={() => handleDelete(tag)}
                      />
                    ))}
                  </div>
                  {hasMore && (
                    <div ref={sentinelRef} className="py-6 flex justify-center w-full">
                      <div className="w-6 h-6 border-2 border-[#6366F1] border-t-transparent rounded-full animate-spin" />
                    </div>
                  )}
                </>
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
