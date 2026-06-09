'use client';

import React, { useState, useEffect, useCallback, useRef } from 'react';
import { Tags } from '@/types/appwrite';
import { listTags, deleteTag } from '@/lib/appwrite';
import { updateNote } from '@/lib/actions/client-ops';
import { useAuth } from '@/context/auth/AuthContext';
import { formatDateWithFallback } from '@/lib/date-utils';
import { TagNotesListSidebar } from '@/components/ui/TagNotesListSidebar';
import { useUnifiedDrawer } from '@/context/UnifiedDrawerContext';
import { MultiSectionContainer } from '@/context/SectionContext';
import { useFAB } from '@/context/FABContext';
import { 
  Plus as PlusIcon, 
  Edit2 as EditIcon, 
  Trash2 as TrashIcon, 
  Tag as TagIcon,
  Clock as ClockIcon,
  Loader2 as SpinnerIcon,
  Plus
} from 'lucide-react';

export default function TagsPage() {
  const { user, isAuthenticated, openIDMWindow } = useAuth();
  const { open } = useUnifiedDrawer();
  const { setConfiguration, resetConfiguration } = useFAB();
  const hasFetched = useRef(false);
  const [tags, setTags] = useState<Tags[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selectedTag, setSelectedTag] = useState<Tags | null>(null);

  const fetchTags = useCallback(async () => {
    if (!user) {
      setError('User not authenticated');
      return;
    }

    try {
      setLoading(true);
      const response = await listTags();
      setTags(response.rows as unknown as Tags[]);
    } catch (err: any) {
       setError(err instanceof Error ? err.message : 'Failed to fetch tags');
    } finally {
      setLoading(false);
    }
  }, [user]);

  const handleCreateNew = useCallback(() => {
    open('new-tag', { onSuccess: fetchTags });
  }, [open, fetchTags]);

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
    open('new-tag', { tag, onSuccess: fetchTags });
  };



  const handleDelete = async (tag: Tags) => {
    open('delete-confirm', {
        title: `Delete tag "${tag.name}"?`,
        description: 'This will remove the tag from all associated notes. The notes themselves will not be deleted.',
        resourceName: 'this tag',
        confirmLabel: 'Delete Tag',
        onConfirm: async () => {
            try {
                await deleteTag(tag.$id);
                await fetchTags();
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

  if (selectedTag) {
    return (
      <div className="min-h-screen bg-[#0A0908] text-white">
        <div className="flex h-screen w-full">
          {/* Left Column - Desktop Only */}
          <div className="hidden lg:block lg:w-1/2 border-r border-white/5 p-8 overflow-y-auto">
            <div className="mb-6">
              <h1 className="text-white font-black text-3xl tracking-tight leading-tight mb-1 font-mono">
                Tags Management
              </h1>
              <p className="text-white/40 text-xs font-semibold leading-normal font-sans">
                Organize your notes with custom tags and colors
              </p>
            </div>

            <div className="flex items-center justify-between gap-4 mb-6">
              <span className="text-[10px] font-black tracking-wider uppercase text-white/30 font-mono">
                {tags.length} tag{tags.length !== 1 ? 's' : ''} total
              </span>
              <button
                onClick={handleCreateNew}
                className="h-10 px-4 rounded-xl bg-[#6366F1]/10 hover:bg-[#6366F1]/20 border border-[#6366F1]/20 hover:border-[#6366F1]/40 flex items-center justify-center text-[#818CF8] font-bold text-xs gap-1.5 transition-all"
              >
                <PlusIcon size={16} />
                <span>Create New</span>
              </button>
            </div>

            <div className="flex flex-col gap-3">
              {tags.map((tag) => (
                <button
                  key={tag.$id}
                  onClick={() => setSelectedTag(tag)}
                  className={`w-full flex items-center justify-between p-4 rounded-2xl border text-left transition-all duration-300 ${
                    selectedTag?.$id === tag.$id
                      ? 'bg-[#1C1A18] border-[#6366F1]/40 shadow-xl'
                      : 'bg-[#161412] border-white/5 hover:border-[#6366F1]/40 hover:bg-[#1C1A18] hover:translate-x-1'
                  }`}
                >
                  <div className="flex items-center gap-3 min-w-0">
                    <span 
                      style={{ backgroundColor: tag.color || '#6366F1' }} 
                      className="w-3 h-3 rounded-full flex-shrink-0"
                    />
                    <span className="font-extrabold text-sm text-white truncate">
                      {tag.name}
                    </span>
                  </div>
                  <span className="flex-shrink-0 bg-white/3 text-white/40 text-[9px] font-black uppercase tracking-wider px-2 py-0.5 rounded border border-white/8 font-mono">
                    {tag.usageCount || 0} notes
                  </span>
                </button>
              ))}
            </div>
          </div>

          {/* Right Column - Note List Sidebar */}
          <div className="w-full lg:w-1/2 h-screen overflow-hidden">
            <TagNotesListSidebar
              tag={selectedTag!}
              onBack={() => setSelectedTag(null)}
              onNoteUpdate={async (updatedNote) => {
                try {
                  await updateNote(updatedNote.$id || '', updatedNote);
                } catch (err: any) {
                  console.error('Failed to update note:', err);
                }
              }}
              onNoteDelete={(noteId) => {
                console.log('Note deleted:', noteId);
              }}
            />
          </div>
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
            <div>
              <h1 className="text-white font-black text-2xl md:text-3xl tracking-tight leading-tight mb-1 font-mono tracking-tighter">
                Tags Management
              </h1>
              <p className="text-white/40 text-xs font-semibold leading-normal font-sans">
                Organize your notes with custom tags and colors
              </p>
            </div>
            
            <button 
              onClick={handleCreateNew}
              className="h-10 px-4 rounded-xl bg-[#6366F1]/10 hover:bg-[#6366F1]/20 border border-[#6366F1]/20 hover:border-[#6366F1]/40 flex items-center justify-center text-[#818CF8] font-bold text-xs gap-1.5 transition-all"
            >
              <PlusIcon size={16} />
              <span>Create Tag</span>
            </button>
          </header>

          {error && (
            <div className="p-4 mb-6 rounded-2xl bg-red-500/10 border border-red-500/20 text-[#ff4444] text-sm font-semibold">
              {error}
            </div>
          )}

          {/* Action / Count Bar */}
          <div className="flex items-center justify-between gap-4 mb-6 select-none">
            <span className="text-[10px] font-black tracking-widest uppercase text-white/30 font-mono leading-none">
              {tags.length} tag{tags.length !== 1 ? 's' : ''} total
            </span>
          </div>

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
                Create your first tag to start organizing your notes
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
                        <div className="min-w-0">
                          <h3 className="text-white text-base font-black tracking-tight leading-tight truncate font-mono">
                            {tag.name}
                          </h3>
                          <span className="block text-[9px] font-black uppercase tracking-wider text-white/30 font-mono mt-0.5">
                            {tag.usageCount || 0} notes
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

        </MultiSectionContainer>
      </div>
    </div>
  );
}
