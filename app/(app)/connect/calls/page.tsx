'use client';

import React, { useState, useEffect, Suspense } from 'react';
import { CallHistory } from '@/components/call/CallHistory';
import { CallActionModal } from '@/components/call/CallActionModal';
import { Hash, ArrowRight } from 'lucide-react';
import toast from 'react-hot-toast';
import { useRouter, useSearchParams } from 'next/navigation';
import { MultiSectionContainer, useSection } from '@/context/SectionContext';


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
