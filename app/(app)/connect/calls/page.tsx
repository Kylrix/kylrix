'use client';

import React, { useState, useEffect, Suspense } from 'react';
import { CallHistory } from '@/components/call/CallHistory';
import { CallActionModal } from '@/components/call/CallActionModal';
import { Hash, ArrowRight, FileText } from 'lucide-react';
import toast from 'react-hot-toast';
import { useRouter, useSearchParams } from 'next/navigation';
import { MultiSectionContainer, useSection } from '@/context/SectionContext';
import { listNotes } from '@/lib/appwrite';

function NotesFeed() {
    const [notes, setNotes] = useState<any[]>([]);
    const [loading, setLoading] = useState(false);
    const router = useRouter();

    useEffect(() => {
        let mounted = true;
        async function load() {
            setLoading(true);
            try {
                const res = await listNotes([], 5);
                if (mounted) setNotes(res.rows || []);
            } catch (e) {
                console.error(e);
            } finally {
                if (mounted) setLoading(false);
            }
        }
        load();
        return () => { mounted = false; };
    }, []);

    if (loading) {
        return (
            <div className="mt-6">
                <h3 className="text-lg font-black font-clash text-white mb-6">
                    Recent Notes
                </h3>
                <div className="flex flex-col gap-4">
                    {[1, 2, 3].map((i) => (
                        <div
                            key={i}
                            className="flex gap-4 p-4 rounded-2xl bg-white/[0.02] border border-white/[0.03]"
                        >
                            <div className="w-10 h-10 rounded-xl bg-white/5 animate-pulse flex-shrink-0" />
                            <div className="flex-1 flex flex-col gap-1 justify-center">
                                <div className="h-4 bg-white/5 rounded w-2/3 animate-pulse" />
                                <div className="h-3 bg-white/5 rounded w-1/2 animate-pulse" />
                            </div>
                        </div>
                    ))}
                </div>
            </div>
        );
    }

    return (
        <div className="mt-6">
            <div className="flex justify-between items-center mb-6">
                <h3 className="text-lg font-black font-clash text-white">
                    Recent Notes
                </h3>
                <button 
                    onClick={() => router.push('/note/notes')} 
                    className="text-sm text-[#F59E0B] hover:text-[#d98105] font-bold transition-colors"
                >
                    View All
                </button>
            </div>
            <div className="flex flex-col gap-4">
                {notes.length === 0 ? (
                    <p className="text-sm text-white/40 text-center py-4">
                        No recent notes.
                    </p>
                ) : (
                    notes.map((note) => (
                        <div
                            key={note.$id}
                            onClick={() => router.push(`/note/notes/${note.$id}`)}
                            className="flex gap-4 p-4 rounded-2xl bg-white/[0.02] border border-white/[0.03] cursor-pointer hover:bg-white/[0.04] hover:border-white/[0.08] hover:translate-x-1 transition-all duration-200"
                        >
                            <div className="w-10 h-10 rounded-xl flex items-center justify-center bg-pink-500/10 text-pink-500 flex-shrink-0">
                                <FileText size={20} />
                            </div>
                            <div className="min-w-0 flex-1">
                                <div className="text-sm font-extrabold text-white truncate">
                                    {note.title || 'Untitled Note'}
                                </div>
                                <div className="text-xs text-white/40 truncate mt-0.5">
                                    {note.content ? note.content.substring(0, 60) + '...' : 'Empty Note'}
                                </div>
                            </div>
                        </div>
                    ))
                )}
            </div>
        </div>
    );
}

function CallsContent() {
    const [modalOpen, setModalOpen] = useState(false);
    const searchParams = useSearchParams();
    const [joinInput, setJoinId] = useState('');
    const [refreshKey, setRefreshKey] = useState(0);
    const router = useRouter();
    const { setActiveDetail } = useSection();

    const [isDesktop, setIsDesktop] = useState(false);
    useEffect(() => {
        const media = window.matchMedia("(min-width: 1024px)");
        setIsDesktop(media.matches);
        const listener = (e: MediaQueryListEvent) => setIsDesktop(e.matches);
        media.addEventListener("change", listener);
        return () => media.removeEventListener("change", listener);
    }, []);

    useEffect(() => {
        if (searchParams.get('start') === '1') {
            setModalOpen(true);
            // Clean up URL
            const params = new URLSearchParams(searchParams.toString());
            params.delete('start');
            const next = params.toString();
            router.replace(next ? `/connect/calls?${next}` : '/connect/calls');
        }
    }, [searchParams, router]);

    const handleJoin = () => {
        if (!joinInput.trim()) {
            toast.error("Please enter a meeting ID or URL");
            return;
        }
        
        let id = joinInput.trim();
        // If it's a URL, extract the ID
        if (id.includes('/connect/call/')) {
            id = id.split('/connect/call/').pop() || id;
        } else if (id.includes('/call/')) {
            id = id.split('/call/').pop() || id;
        }
        
        if (isDesktop) {
            setActiveDetail({ type: 'call', id });
        } else {
            router.push(`/connect/call/${id}`);
        }
    };

    return (
        <>
            <div className="mb-6 flex flex-col md:flex-row gap-4 items-center justify-between">
                <h2 className="text-xl font-bold text-white">Call History</h2>
                
                <div className="p-1 pl-4 bg-white/[0.02] border border-white/[0.05] rounded-2xl flex items-center gap-2 w-full md:w-[400px]">
                    <Hash size={18} className="opacity-30 text-white" />
                    <input 
                        type="text"
                        placeholder="Join with ID or Link..."
                        value={joinInput}
                        onChange={(e) => setJoinId(e.target.value)}
                        onKeyDown={(e) => e.key === 'Enter' && handleJoin()}
                        className="bg-transparent border-none text-sm font-bold text-white placeholder-white/30 focus:outline-none flex-1 py-1"
                    />
                    <button 
                        onClick={handleJoin}
                        className="bg-[#6366F1] hover:bg-[#5053df] text-white rounded-xl w-10 h-9 flex items-center justify-center transition-colors flex-shrink-0"
                    >
                        <ArrowRight size={18} />
                    </button>
                </div>
            </div>
            
            <CallHistory key={refreshKey} onNewCall={() => setModalOpen(true)} />

            {modalOpen && (
                <CallActionModal 
                    open={modalOpen} 
                    onClose={() => {
                        setModalOpen(false);
                        setRefreshKey(prev => prev + 1);
                    }} 
                />
            )}
        </>
    );
}

export default function CallsPage() {
    return (
        <div className="max-w-7xl mx-auto py-6 px-4 relative min-h-screen pointer-events-auto">
            <MultiSectionContainer panels={['projects', 'threads']}>
                <Suspense fallback={null}>
                    <CallsContent />
                </Suspense>
            </MultiSectionContainer>
        </div>
    );
}
