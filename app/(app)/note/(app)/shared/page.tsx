"use client";

import React, { useState, useEffect, useMemo } from 'react';
import type { Notes } from '@/types/appwrite';
import NoteCard from '@/components/ui/NoteCard';
import { getSharedNotes, listPublicNotesByUser, getCurrentUser } from '@/lib/appwrite';
import { useNotes } from '@/context/NotesContext';
import { MultiSectionContainer } from '@/context/SectionContext';
import { 
  Search as SearchIcon, 
  Globe as GlobeIcon, 
  Lock as LockIcon,
  Loader2 as SpinnerIcon
} from 'lucide-react';

interface SharedNote extends Notes {
  sharedPermission?: string;
  sharedAt?: string;
  sharedBy?: { name: string; email: string } | null;
}

export default function SharedNotesPage() {
  const [privateNotes, setPrivateNotes] = useState<SharedNote[]>([]);
  const [publicNotes, setPublicNotes] = useState<Notes[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState(0);
  const { isPinned } = useNotes();

  // Fetch shared and public notes once on mount
  useEffect(() => {
    const fetchNotes = async () => {
      try {
        setLoading(true);
        
        const [sharedResult, user] = await Promise.all([
          getSharedNotes(),
          getCurrentUser()
        ]);

        if (user && user.$id) {
          const myPublicResult = await listPublicNotesByUser(user.$id);
          const myPublicNotes = myPublicResult.rows as unknown as Notes[];
          
          // Partition shared notes into private and public
          const sharedDocs = sharedResult.rows as SharedNote[];
          const sharedPrivate = sharedDocs.filter(n => !n.isPublic);
          const sharedPublic = sharedDocs.filter(n => n.isPublic);

          setPrivateNotes(sharedPrivate);
          
          // Public tab = (My Public Notes) + (Notes shared with me that are public)
          setPublicNotes([...myPublicNotes, ...sharedPublic]);
        } else {
          setPrivateNotes([]);
          setPublicNotes([]);
        }
      } catch (error: any) {
        console.error('Error fetching shared notes:', error);
      } finally {
        setLoading(false);
      }
    };

    fetchNotes();
  }, []);

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
                  : "When you make your notes public, they’ll appear here."
                }
              </p>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {currentNotes.map((note) => (
                <div key={note.$id} className="flex flex-col gap-2">
                  <NoteCard note={note} />
                  
                  <div className="flex flex-col items-center gap-1.5 select-none">
                    {activeTab === 0 && (note as SharedNote).sharedBy && (
                      <span className="block text-[9px] font-black font-mono uppercase tracking-wider text-white/40">
                        BY: {((note as SharedNote).sharedBy?.name || (note as SharedNote).sharedBy?.email || 'Collaborator').toUpperCase()}
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
