"use client";
import React, { useState, useEffect, useMemo, useCallback } from 'react';
import type { Notes } from '@/types/appwrite';
import NoteCard from '@/components/ui/NoteCard';
import { getSharedNotes, listPublicNotesByUser } from '@/lib/appwrite';
import { getNotePublicState } from '@/lib/appwrite/note';
import { useNotes } from '@/context/NotesContext';
import { useAuth } from '@/context/auth/AuthContext';
import { useDataNexus } from '@/context/DataNexusContext';
import { MultiSectionContainer } from '@/context/SectionContext';
import { useFAB } from '@/context/FABContext';
import { useOverlay } from '@/components/ui/OverlayContext';
import CreateNoteForm from '../notes/CreateNoteForm';
import {
  getSessionSharedNotes,
  setSessionSharedNotes,
  partitionSharedNotes,
  sharedNotesCacheKey,
  myPublicNotesCacheKey,
  mergeNotesById,
  type SharedNoteRow,
} from '@/lib/note/shared-notes-cache';
import {
  Search as SearchIcon,
  Globe as GlobeIcon,
  Lock as LockIcon,
  Loader2 as SpinnerIcon,
  Plus as PlusIcon
} from 'lucide-react';

function buildPublicTab(ownedPublic: Notes[], sharedPublic: SharedNoteRow[]): Notes[] {
  return mergeNotesById(ownedPublic, sharedPublic);
}

function hasInstantSharedData(
  privateNotes: SharedNoteRow[],
  publicNotes: Notes[],
): boolean {
  return privateNotes.length > 0 || publicNotes.length > 0;
}

export default function SharedNotesPage() {
  const { isPinned, notes: ownedNotes } = useNotes();
  const { user } = useAuth();
  const { getCachedDataAsync, setCachedData } = useDataNexus();
  const { openOverlay, closeOverlay } = useOverlay();
  const { setConfiguration, resetConfiguration } = useFAB();

  const openComposer = useCallback(() => {
    let createdNoteId: string | null = null;

    const handleNoteCreated = (note: any) => {
      createdNoteId = note.$id;
    };

    const handleClose = () => {
      closeOverlay();
      if (createdNoteId) {
        const shareUrl = `${window.location.origin}/note/shared/${createdNoteId}`;
        navigator.clipboard.writeText(shareUrl);
        import('react-hot-toast').then(({ default: toast }) => {
          toast.success('Public link copied to clipboard!');
        });
      }
    };

    openOverlay(
      <CreateNoteForm
        onNoteCreated={handleNoteCreated}
        noteKind="note"
        initialContent={{
          isPublic: true,
          isGuest: true
        } as any}
        onClose={handleClose}
      />
    );
  }, [openOverlay, closeOverlay]);

  useEffect(() => {
    setConfiguration({
      isVisible: true,
      mainColor: '#EC4899',
      onMainClick: () => openComposer(),
      actions: [
        { id: 'new-shared-note', label: 'NEW PUBLIC NOTE', icon: <PlusIcon size={16} />, onClick: () => openComposer() },
      ]
    });
    return () => resetConfiguration();
  }, [setConfiguration, resetConfiguration, openComposer]);

  const sessionRows = getSessionSharedNotes();
  const sessionPartition = sessionRows ? partitionSharedNotes(sessionRows) : null;
  const ownedPublicSeed = useMemo(
    () => ownedNotes.filter((n) => getNotePublicState(n)),
    [ownedNotes],
  );

  const [privateNotes, setPrivateNotes] = useState<SharedNoteRow[]>(
    () => sessionPartition?.privateNotes ?? [],
  );
  const [publicNotes, setPublicNotes] = useState<Notes[]>(() =>
    sessionPartition
      ? buildPublicTab(ownedPublicSeed, sessionPartition.sharedPublicNotes)
      : ownedPublicSeed,
  );
  const [loading, setLoading] = useState(
    () => !hasInstantSharedData(sessionPartition?.privateNotes ?? [], sessionPartition ? buildPublicTab(ownedPublicSeed, sessionPartition.sharedPublicNotes) : ownedPublicSeed),
  );
  const [activeTab, setActiveTab] = useState(0);

  const applySharedPayload = useCallback(
    (sharedDocs: SharedNoteRow[], myPublicNotes: Notes[]) => {
      const { privateNotes: nextPrivate, sharedPublicNotes } = partitionSharedNotes(sharedDocs);
      const ownedPublic = ownedNotes.filter((n) => getNotePublicState(n));
      setPrivateNotes(nextPrivate);
      setPublicNotes(buildPublicTab(myPublicNotes.length ? myPublicNotes : ownedPublic, sharedPublicNotes));
    },
    [ownedNotes],
  );

  // Merge owned public notes as NotesContext cold-starts (same RxDB substrate as /note).
  useEffect(() => {
    if (ownedPublicSeed.length === 0) return;
    setPublicNotes((prev) => {
      const sharedFromOthers = prev.filter((n) => n.userId && n.userId !== user?.$id);
      return buildPublicTab(ownedPublicSeed, sharedFromOthers as SharedNoteRow[]);
    });
    setLoading(false);
  }, [ownedPublicSeed, user?.$id]);

  useEffect(() => {
    if (!user?.$id) {
      setLoading(false);
      return;
    }

    let mounted = true;

    const hydrateAndRefresh = async () => {
      // RxDB / memory mirror — instant on cold start when /note already warmed the cache.
      if (!getSessionSharedNotes()) {
        const [cachedShared, cachedMyPublic] = await Promise.all([
          getCachedDataAsync<SharedNoteRow[]>(sharedNotesCacheKey(user.$id)),
          getCachedDataAsync<Notes[]>(myPublicNotesCacheKey(user.$id)),
        ]);

        if (!mounted) return;

        if (cachedShared?.length || cachedMyPublic?.length) {
          setSessionSharedNotes(cachedShared || []);
          applySharedPayload(cachedShared || [], cachedMyPublic || []);
          setLoading(false);
        }
      }

      try {
        const [sharedResult, myPublicResult] = await Promise.all([
          getSharedNotes(),
          listPublicNotesByUser(user.$id),
        ]);

        if (!mounted) return;

        const sharedDocs = (sharedResult.rows || []) as SharedNoteRow[];
        const myPublicNotes = (myPublicResult.rows || []) as unknown as Notes[];

        setSessionSharedNotes(sharedDocs);
        void setCachedData(sharedNotesCacheKey(user.$id), sharedDocs);
        void setCachedData(myPublicNotesCacheKey(user.$id), myPublicNotes);
        applySharedPayload(sharedDocs, myPublicNotes);
      } catch (error: unknown) {
        console.error('Error fetching shared notes:', error);
      } finally {
        if (mounted) setLoading(false);
      }
    };

    void hydrateAndRefresh();

    return () => {
      mounted = false;
    };
  }, [user?.$id, getCachedDataAsync, setCachedData, applySharedPayload]);

  const sortedPrivateNotes = useMemo(() => {
    return [...privateNotes].sort((a, b) => {
      const aPinned = isPinned(a.$id);
      const bPinned = isPinned(b.$id);
      if (aPinned && !bPinned) return -1;
      if (!aPinned && bPinned) return 1;
      return 0;
    });
  }, [privateNotes, isPinned]);

  const sortedPublicNotes = useMemo(() => {
    return [...publicNotes].sort((a, b) => {
      const aPinned = isPinned(a.$id);
      const bPinned = isPinned(b.$id);
      if (aPinned && !bPinned) return -1;
      if (!aPinned && bPinned) return 1;
      return 0;
    });
  }, [publicNotes, isPinned]);

  const currentNotes = activeTab === 0 ? sortedPrivateNotes : sortedPublicNotes;

  return (
    <div className="relative flex flex-col min-h-screen bg-[#0A0908] text-white overflow-x-hidden">
      <div className="flex-1 w-full max-w-[1440px] mx-auto px-4 md:px-6 pt-6 pb-24 md:pb-12">
        <MultiSectionContainer panels={['tags', 'huddles', 'projects']}>

          {/* Header Section */}
          <header className="flex flex-col md:flex-row items-start md:items-center justify-between gap-4 p-5 mb-8 bg-white/[0.01] border border-white/8 rounded-[32px] shadow-2xl relative select-none">
            <div className="absolute top-[-1px] left-[10%] right-[10%] h-[1px] bg-gradient-to-r from-transparent via-[#EC4899] to-transparent" />
            <div>
              <h1 className="text-white font-black text-2xl md:text-3xl tracking-tight leading-tight mb-1 font-mono tracking-tighter">
                Shared
              </h1>
              <p className="text-white/40 text-xs font-semibold leading-normal font-sans">
                Notes shared with you and your public notes
              </p>
            </div>

            <button
              className="h-10 px-4 rounded-xl bg-white/3 border border-white/8 hover:border-white/15 flex items-center justify-center text-white/60 hover:text-white font-bold text-xs gap-1.5 transition-all"
            >
              <SearchIcon size={16} />
              <span>Search Shared</span>
            </button>
          </header>

          {/* Tabs */}
          <div className="mb-6 bg-[#161412] border border-white/8 rounded-[20px] p-1 flex items-center gap-1 select-none">
            <button
              onClick={() => setActiveTab(0)}
              className={`flex-1 py-3 rounded-[14px] text-xs font-black transition-all flex items-center justify-center gap-2 border ${
                activeTab === 0
                  ? 'bg-[#EC4899]/10 border-[#EC4899]/20 text-[#EC4899] shadow-[0_4px_12px_rgba(236,72,153,0.1)]'
                  : 'border-transparent text-white/60 hover:text-white hover:bg-white/5'
              }`}
            >
              <LockIcon size={16} />
              <span>Private ({privateNotes.length})</span>
            </button>
            <button
              onClick={() => setActiveTab(1)}
              className={`flex-1 py-3 rounded-[14px] text-xs font-black transition-all flex items-center justify-center gap-2 border ${
                activeTab === 1
                  ? 'bg-[#EC4899]/10 border-[#EC4899]/20 text-[#EC4899] shadow-[0_4px_12px_rgba(236,72,153,0.1)]'
                  : 'border-transparent text-white/60 hover:text-white hover:bg-white/5'
              }`}
            >
              <GlobeIcon size={16} />
              <span>Public ({publicNotes.length})</span>
            </button>
          </div>

          {/* Content */}
          {loading ? (
            <div className="flex justify-center py-20">
              <SpinnerIcon className="animate-spin text-[#EC4899]" size={36} />
            </div>
          ) : currentNotes.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-20 text-center select-none">
              <div className="w-24 h-24 bg-white/5 border border-white/10 rounded-[28px] flex items-center justify-center mb-6 shadow-2xl">
                {activeTab === 0 ? (
                  <LockIcon size={38} className="text-white/30" />
                ) : (
                  <GlobeIcon size={38} className="text-white/30" />
                )}
              </div>
              <h4 className="text-white font-black text-lg tracking-tight mb-2">
                {activeTab === 0 ? 'No Private Shared Notes' : 'No Public Notes'}
              </h4>
              <p className="text-white/40 text-xs font-semibold max-w-xs leading-relaxed">
                {activeTab === 0
                  ? "When others share notes with you, they'll appear here. Start collaborating by sharing your own notes!"
                  : "When you make your notes public, they'll appear here."
                }
              </p>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {currentNotes.map((note) => (
                <div key={note.$id} className="flex flex-col gap-2">
                  <NoteCard note={note} />

                  <div className="flex flex-col items-center gap-1.5 select-none">
                    {activeTab === 0 && (note as SharedNoteRow).sharedBy && (
                      <span className="block text-[9px] font-black font-mono uppercase tracking-wider text-white/40">
                        BY: {((note as SharedNoteRow).sharedBy?.name || (note as SharedNoteRow).sharedBy?.email || 'Collaborator').toUpperCase()}
                      </span>
                    )}
                    {['write', 'admin'].includes(String((note as any).sharedPermission || '')) && (
                      <span className="inline-block px-2.5 py-0.5 rounded-[6px] text-[8px] font-black uppercase font-mono bg-[#10B981]/10 border border-[#10B981]/20 text-[#10B981]">
                        Editable
                      </span>
                    )}
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
