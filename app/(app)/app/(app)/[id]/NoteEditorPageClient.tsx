'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { useParams, useRouter, useSearchParams } from 'next/navigation';
import { getNote, cachePublicNoteDecryptionKey } from '@/lib/appwrite';
import { deleteNote, updateNote } from '@/lib/actions/client-ops';
import type { Notes } from '@/types/appwrite';
import { useToast } from '@/components/ui/Toast';
import CommentsSection from '@/app/(app)/app/(app)/notes/Comments';
import NoteReactions from '@/app/(app)/app/(app)/notes/NoteReactions';
import { useDataNexus } from '@/context/DataNexusContext';
import NoteContentRenderer from '@/components/NoteContentRenderer';
import { ArrowLeft, Edit2, Eye, Trash2, Save, Calendar, Tag, Globe, Lock } from 'lucide-react';
import { formatNoteUpdatedDate } from '@/lib/date-utils';

export default function NoteEditorPageClient() {
  const { id } = useParams();
  const router = useRouter();
  const searchParams = useSearchParams();
  const decryptionKey = searchParams.get('key');

  const [rawNote, setRawNote] = useState<Notes | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isEditing, setIsEditing] = useState(false);
  const [title, setTitle] = useState('');
  const [content, setContent] = useState('');
  const [isDirty, setIsDirty] = useState(false);
  const [isSaving, setIsSaving] = useState(false);

  const { showSuccess, showError } = useToast();
  const { fetchOptimized, setCachedData, invalidate, getCachedData } = useDataNexus();

  const CACHE_KEY = useMemo(() => (id ? `note_${id}` : null), [id]);

  useEffect(() => {
    if (id && decryptionKey) {
      cachePublicNoteDecryptionKey(id as string, decryptionKey);
    }
  }, [id, decryptionKey]);

  useEffect(() => {
    let mounted = true;

    if (!id || !CACHE_KEY) {
      setIsLoading(false);
      return;
    }

    const cached = getCachedData<Notes>(CACHE_KEY);
    if (cached) {
      setRawNote(cached);
      setTitle(cached.title || '');
      setContent(cached.content || '');
      setIsLoading(false);
    }

    void (async () => {
      if (!cached) setIsLoading(true);
      try {
        let fetched: Notes | null = null;
        try {
          fetched = await fetchOptimized(CACHE_KEY, () => getNote(id as string));
        } catch {
          const { getPublicNoteDataSecure } = await import('@/lib/actions/secure-ops');
          fetched = await getPublicNoteDataSecure(id as string);
        }
        if (mounted && fetched) {
          setRawNote(fetched);
          setTitle(fetched.title || '');
          setContent(fetched.content || '');
        }
      } catch (error: unknown) {
        console.error('Failed to load note', error);
        if (mounted) setRawNote(null);
        showError('Failed to load note', 'Please try again later.');
      } finally {
        if (mounted) setIsLoading(false);
      }
    })();

    return () => {
      mounted = false;
    };
  }, [id, CACHE_KEY, showError, fetchOptimized, getCachedData]);

  const handleSave = async () => {
    if (!id || !isDirty) return;
    setIsSaving(true);
    try {
      const updated = await updateNote(id as string, {
        title: title.trim(),
        content: content.trim(),
        format: rawNote?.format || 'markdown',
        tags: rawNote?.tags || [],
        isPublic: rawNote?.isPublic || false,
        isGuest: rawNote?.isGuest || false
      });
      setRawNote(updated as Notes);
      if (CACHE_KEY) setCachedData(CACHE_KEY, updated);
      setIsDirty(false);
      setIsEditing(false);
      showSuccess('Saved', 'Your changes have been saved.');
    } catch (err) {
      console.error('Save failed', err);
      showError('Save failed', 'Could not save note updates.');
    } finally {
      setIsSaving(false);
    }
  };

  const handleDelete = useCallback(
    async (noteId: string) => {
      if (!confirm('Are you sure you want to delete this note?')) return;
      try {
        await deleteNote(noteId);
        if (CACHE_KEY) invalidate(CACHE_KEY);
        showSuccess('Deleted', 'Note removed');
        router.push('/app');
      } catch (error: unknown) {
        console.error('Delete failed', error);
        showError('Delete failed', 'Could not delete the note.');
      }
    },
    [CACHE_KEY, invalidate, router, showSuccess, showError],
  );

  const handleBack = useCallback(() => {
    router.push('/app');
  }, [router]);

  if (isLoading) {
    return (
      <div className="bg-[#0A0908] text-white font-satoshi min-h-[calc(100dvh-72px)] flex items-center justify-center">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-[#6366F1]" />
      </div>
    );
  }

  if (!rawNote) {
    return (
      <div className="min-h-[50dvh] flex flex-col items-center justify-center bg-[#0A0908] text-[#9B9691] text-sm gap-4">
        <span>Note not found or you do not have permission to view it.</span>
        <button
          onClick={handleBack}
          className="h-9 px-4 rounded-xl border border-white/10 hover:border-white/20 bg-white/2 hover:bg-white/5 text-white/80 font-bold text-xs transition-all flex items-center gap-1.5"
        >
          <ArrowLeft size={14} />
          <span>Back to App</span>
        </button>
      </div>
    );
  }

  const formattedDate = formatNoteUpdatedDate(rawNote);

  return (
    <div className="text-white font-satoshi pb-12 select-none">
      <div className="max-w-[800px] mx-auto w-full px-2 sm:px-4 md:px-6 pt-2">
        
        {/* Navigation & Action Header */}
        <div className="flex items-center justify-between gap-4 mb-6">
          <button
            onClick={handleBack}
            className="h-9 px-4 rounded-xl border border-white/10 hover:border-white/20 bg-white/2 hover:bg-white/5 text-white/80 font-bold text-xs flex items-center justify-center gap-1.5 transition-all select-none"
          >
            <ArrowLeft size={16} />
            <span>Back</span>
          </button>

          <div className="flex items-center gap-2">
            <button
              onClick={() => setIsEditing(!isEditing)}
              className={`h-9 px-4 rounded-xl border font-bold text-xs flex items-center justify-center gap-1.5 transition-all select-none ${
                isEditing 
                  ? 'border-[#6366F1]/30 bg-[#6366F1]/10 text-[#6366F1]' 
                  : 'border-white/10 hover:border-white/20 bg-white/2 hover:bg-white/5 text-white/80'
              }`}
            >
              {isEditing ? <Eye size={14} /> : <Edit2 size={14} />}
              <span>{isEditing ? 'Read Mode' : 'Edit Mode'}</span>
            </button>

            <button
              onClick={() => handleDelete(rawNote.$id)}
              className="h-9 w-9 rounded-xl border border-red-500/20 hover:border-red-500/30 bg-red-500/5 hover:bg-red-500/10 text-red-500 flex items-center justify-center transition-all"
              title="Delete Note"
            >
              <Trash2 size={14} />
            </button>
          </div>
        </div>

        {/* Note Body Card */}
        <div className="p-4 sm:p-6 md:p-8 bg-[#161412] border border-white/5 rounded-[24px] shadow-xl relative overflow-hidden mb-6">
          {/* Decorative glowing gradient overlay */}
          <div className="absolute -top-24 -right-24 w-48 h-48 bg-[#6366F1]/5 blur-[60px] rounded-full pointer-events-none" />

          {isEditing ? (
            <div className="space-y-4">
              <input
                type="text"
                value={title}
                onChange={(e) => {
                  setTitle(e.target.value);
                  setIsDirty(true);
                }}
                placeholder="Note Title"
                className="w-full bg-transparent text-white font-black text-2xl tracking-tight font-mono focus:outline-none border-b border-white/10 pb-2 placeholder:text-white/20"
              />

              <textarea
                value={content}
                onChange={(e) => {
                  setContent(e.target.value);
                  setIsDirty(true);
                }}
                placeholder="Write your note content here (markdown is supported)..."
                className="w-full min-h-[300px] bg-transparent text-white/90 text-[15px] leading-relaxed focus:outline-none resize-y placeholder:text-white/20"
              />

              <div className="flex justify-end pt-2 border-t border-white/5">
                <button
                  onClick={handleSave}
                  disabled={!isDirty || isSaving}
                  className="h-9 px-4 rounded-xl bg-[#6366F1] hover:bg-[#5254E8] text-white font-black text-xs transition-all flex items-center justify-center gap-1.5 shadow-lg select-none disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {isSaving ? (
                    <div className="animate-spin rounded-full h-3.5 w-3.5 border-b-2 border-white" />
                  ) : (
                    <>
                      <Save size={14} />
                      <span>Save Changes</span>
                    </>
                  )}
                </button>
              </div>
            </div>
          ) : (
            <div className="space-y-4">
              <h1 className="text-white font-black text-2xl tracking-tight font-mono break-words leading-tight">
                {title || 'Untitled Thought'}
              </h1>

              {/* Metadata Row */}
              <div className="flex flex-wrap items-center gap-4 text-xs text-white/40 font-semibold font-mono pb-4 border-b border-white/5">
                <div className="flex items-center gap-1">
                  <Calendar size={12} />
                  <span>{formattedDate}</span>
                </div>

                {rawNote.isPublic && (
                  <div className="flex items-center gap-1 text-[#00F0FF]">
                    <Globe size={12} />
                    <span>Shared Publicly</span>
                  </div>
                )}

                {rawNote.parentNoteId && (
                  <div className="flex items-center gap-1 text-[#F59E0B]">
                    <Lock size={12} />
                    <span>Encrypted Vault Note</span>
                  </div>
                )}
              </div>

              {/* Markdown Rendered Content */}
              <div className="prose prose-invert max-w-none text-white/90 leading-relaxed font-satoshi text-[15px] min-h-[150px] break-words pt-2">
                {content.trim() ? (
                  <NoteContentRenderer content={content} format={rawNote.format || 'markdown'} />
                ) : (
                  <p className="text-white/20 italic font-medium">Empty note.</p>
                )}
              </div>
            </div>
          )}
        </div>

        {/* Reactions & Comments Section */}
        {!isEditing && (
          <div className="flex flex-col gap-6">
            <section className="rounded-[24px] border border-white/5 bg-[#161412] p-5 shadow-lg">
              <h3 className="text-white font-black text-xs tracking-wider uppercase font-mono mb-4 text-white/40">Reactions</h3>
              <NoteReactions targetId={id as string} />
            </section>

            <section className="rounded-[24px] border border-white/5 bg-[#161412] p-5 shadow-lg">
              <h3 className="text-white font-black text-xs tracking-wider uppercase font-mono mb-4 text-white/40">Comments</h3>
              <CommentsSection noteId={id as string} decryptionKey={decryptionKey || undefined} />
            </section>
          </div>
        )}

      </div>
    </div>
  );
}
