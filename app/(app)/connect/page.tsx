'use client';

import { Suspense, useEffect, useMemo, useState } from 'react';
import { Feed } from '@/components/social/Feed';
import { ChatList } from '@/components/chat/ChatList';
import { useProjectsList } from '@/hooks/useProjectsList';
import { usePathname, useRouter, useSearchParams } from 'next/navigation';
import { useFAB } from '@/context/FABContext';
import { useUnifiedDrawer } from '@/context/UnifiedDrawerContext';
import { MessageSquare, Phone, Plus, ChevronDown, ChevronUp, Maximize2, FolderKanban } from 'lucide-react';
import { CallHistory } from '@/components/call/CallHistory';

function ConnectHomeContent() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const pathname = usePathname();
  const [composeIntent, setComposeIntent] = useState<{
    noteId: string;
    noteTitle?: string;
    noteContent?: string;
    noteLink?: string;
    draftText?: string;
  } | null>(null);
  const { setConfiguration, resetConfiguration } = useFAB();
  const { open: openUnified } = useUnifiedDrawer();

  // Flexible panel sizes
  const [threadsOpen, setThreadsOpen] = useState(true);
  const [projectsOpen, setProjectsOpen] = useState(true);

  const { projects, loading: projectsLoading } = useProjectsList();

  useEffect(() => {
    setConfiguration({
      isVisible: true,
      mainColor: '#F59E0B',
      mainIcon: <Plus size={32} strokeWidth={3} />,
      onMainClick: () => window.dispatchEvent(new CustomEvent('kylrix:open-moment-composer')),
      actions: [
        { id: 'moment', label: 'CREATE MOMENT', icon: <Plus size={20} />, onClick: () => window.dispatchEvent(new CustomEvent('kylrix:open-moment-composer')) },
        { id: 'chat', label: 'SECURE CHAT', icon: <MessageSquare size={20} />, onClick: () => openUnified('new-chat', { mode: 'secure' }) },
        { id: 'channel', label: 'NEW CHANNEL', icon: <Plus size={20} />, onClick: () => openUnified('new-channel') },
        { id: 'huddle', label: 'START HUDDLE', icon: <Phone size={20} />, onClick: () => router.push('/connect/calls?start=1') }]
    });
    return () => resetConfiguration();
  }, [setConfiguration, resetConfiguration, router, openUnified]);

  const shouldCompose = useMemo(() => searchParams.get('compose') === '1', [searchParams]);

  useEffect(() => {
    if (!shouldCompose) return;
    const queryNoteId = String(searchParams.get('noteId') || '').trim();
    let nextIntent: {
      noteId: string;
      noteTitle?: string;
      noteContent?: string;
      noteLink?: string;
      draftText?: string;
    } | null = null;

    if (queryNoteId) {
      nextIntent = {
        noteId: queryNoteId,
        noteTitle: String(searchParams.get('noteTitle') || '').trim(),
        noteContent: '',
        noteLink: String(searchParams.get('noteLink') || '').trim(),
        draftText: String(searchParams.get('draftText') || '').trim(),
      };
    } else if (typeof window !== 'undefined') {
      const raw = window.sessionStorage.getItem('kylrix:compose-note-intent');
      if (raw) {
        try {
          const parsed = JSON.parse(raw) as {
            noteId?: string;
            noteTitle?: string;
            noteContent?: string;
            noteLink?: string;
            draftText?: string;
          };
          const noteId = String(parsed?.noteId || '').trim();
          if (noteId) {
            nextIntent = {
              noteId,
              noteTitle: String(parsed?.noteTitle || '').trim(),
              noteContent: String(parsed?.noteContent || '').trim(),
              noteLink: String(parsed?.noteLink || '').trim(),
              draftText: String(parsed?.draftText || '').trim(),
            };
          }
        } catch {}
        window.sessionStorage.removeItem('kylrix:compose-note-intent');
      }
    }

    if (nextIntent) setComposeIntent(nextIntent);

    const params = new URLSearchParams(searchParams.toString());
    params.delete('compose');
    params.delete('noteId');
    params.delete('noteTitle');
    params.delete('noteContent');
    params.delete('noteLink');
    params.delete('draftText');
    params.delete('composeKey');
    const next = params.toString();
    router.replace(next ? `${pathname}?${next}` : pathname);
  }, [pathname, router, searchParams, shouldCompose]);

  return (
    <div className="w-full mx-auto py-4 px-4 md:px-6 pointer-events-auto">
      {/* Top spotlight ambient glow */}
      <div className="absolute top-0 left-1/2 -translate-x-1/2 w-full max-w-[1400px] h-[300px] bg-gradient-to-b from-amber-500/[0.04] to-transparent rounded-full blur-3xl pointer-events-none" />

      <div className="grid grid-cols-1 lg:grid-cols-[1fr_340px_340px] gap-6 lg:gap-8 items-start relative z-10">
        
        {/* Primary Column: Moments Feed (Always first in DOM and visually primary) */}
        <div className="min-w-0 w-full flex flex-col gap-6">
          <div className="flex items-center justify-between">
            <h2 className="text-2xl font-black font-clash text-white tracking-tight">
              Moments
            </h2>
          </div>
          <Feed view="personal" composeIntent={composeIntent} />
        </div>

        {/* Column 2: Communications Pocket (Secure Chats & Huddles) */}
        <div className="w-full flex flex-col gap-6 max-h-[calc(100vh-140px)] overflow-y-auto scrollbar-none pr-1 lg:sticky lg:top-[108px]">
          
          {/* Pocket 1: Secure Chats */}
          <div className="bg-[#161412] rounded-3xl border border-white/5 p-5 flex flex-col overflow-hidden shadow-[0_12px_36px_rgba(0,0,0,0.5)] hover:border-white/10 hover:-translate-y-0.5 transition-all duration-300 h-[380px]">
            <div className="flex justify-between items-center mb-3">
              <div className="flex items-center gap-2">
                <div className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
                <h3 className="text-sm font-mono uppercase tracking-widest text-white/90">
                  Secure Chats
                </h3>
              </div>
              <span className="text-[10px] font-mono text-white/30 bg-white/5 px-2 py-0.5 rounded">
                SECURE
              </span>
            </div>
            
            <div className="flex-1 overflow-y-auto pr-1 bg-[#0B0A09] rounded-2xl border border-white/5 p-3 scrollbar-none">
              <ChatList activeTab="secure" hideTabs={true} skipSecureLoad={false} skipThreadsLoad={true} />
            </div>
          </div>

          {/* Pocket 2: Active Huddles */}
          <div className="bg-[#161412] rounded-3xl border border-white/5 p-5 flex flex-col overflow-hidden shadow-[0_12px_36px_rgba(0,0,0,0.5)] hover:border-white/10 hover:-translate-y-0.5 transition-all duration-300 h-[380px]">
            <div className="flex justify-between items-center mb-3">
              <div className="flex items-center gap-2">
                <div className="w-2 h-2 rounded-full bg-amber-500 animate-pulse" />
                <h3 className="text-sm font-mono uppercase tracking-widest text-white/90">
                  Huddles
                </h3>
              </div>
              <span className="text-[10px] font-mono text-white/30 bg-white/5 px-2 py-0.5 rounded">
                VOICE
              </span>
            </div>
            
            <div className="flex-1 overflow-y-auto pr-1 bg-[#0B0A09] rounded-2xl border border-white/5 p-3 scrollbar-none">
              <CallHistory />
            </div>
          </div>
        </div>

        {/* Column 3: Collaboration Pocket (Threads & Projects) */}
        <div className="w-full flex flex-col gap-6 max-h-[calc(100vh-140px)] overflow-y-auto scrollbar-none pr-1 lg:sticky lg:top-[108px]">
          
          {/* Pocket 1: Discussion Threads */}
          <div 
            className="bg-[#161412] rounded-3xl border border-white/5 p-5 flex flex-col overflow-hidden shadow-[0_12px_36px_rgba(0,0,0,0.5)] hover:border-white/10 hover:-translate-y-0.5 transition-all duration-300"
            style={{
              flex: '0 0 auto',
              height: threadsOpen ? '380px' : '68px',
            }}
          >
            <div className="flex justify-between items-center mb-3">
              <div className="flex items-center gap-2">
                <div className="w-2 h-2 rounded-full bg-indigo-500" />
                <h3 className="text-sm font-mono uppercase tracking-widest text-white/90">
                  Threads
                </h3>
              </div>
              <div className="flex gap-1 items-center">
                <button 
                  onClick={() => setThreadsOpen(!threadsOpen)} 
                  className="p-1 text-white/40 hover:text-white rounded transition-colors"
                >
                  {threadsOpen ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
                </button>
                <button 
                  onClick={() => router.push('/connect/chats')} 
                  className="p-1 text-white/40 hover:text-[#F59E0B] rounded transition-colors"
                >
                  <Maximize2 size={12} />
                </button>
              </div>
            </div>

            {threadsOpen && (
              <div className="flex-1 overflow-y-auto pr-1 bg-[#0B0A09] rounded-2xl border border-white/5 p-3 scrollbar-none">
                <ChatList activeTab="public" hideTabs={true} skipSecureLoad={true} skipThreadsLoad={false} />
              </div>
            )}
          </div>

          {/* Pocket 2: Projects Index */}
          <div 
            className="bg-[#161412] rounded-3xl border border-white/5 p-5 flex flex-col overflow-hidden shadow-[0_12px_36px_rgba(0,0,0,0.5)] hover:border-white/10 hover:-translate-y-0.5 transition-all duration-300"
            style={{
              flex: '0 0 auto',
              height: projectsOpen ? '380px' : '68px',
            }}
          >
            <div className="flex justify-between items-center mb-3">
              <div className="flex items-center gap-2">
                <div className="w-2 h-2 rounded-full bg-violet-500" />
                <h3 className="text-sm font-mono uppercase tracking-widest text-white/90">
                  Projects
                </h3>
              </div>
              <div className="flex gap-1 items-center">
                <button 
                  onClick={() => setProjectsOpen(!projectsOpen)} 
                  className="p-1 text-white/40 hover:text-white rounded transition-colors"
                >
                  {projectsOpen ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
                </button>
                <button 
                  onClick={() => router.push('/projects')} 
                  className="p-1 text-white/40 hover:text-[#F59E0B] rounded transition-colors"
                >
                  <Maximize2 size={12} />
                </button>
              </div>
            </div>

            {projectsOpen && (
              <div className="flex-1 overflow-y-auto pr-1 bg-[#0B0A09] rounded-2xl border border-white/5 p-3 scrollbar-none">
                {projectsLoading ? (
                  <div className="flex flex-col gap-2.5">
                    {[1, 2, 3].map((n) => (
                      <div key={n} className="flex gap-3 p-3 rounded-xl bg-white/[0.01] border border-white/[0.03]">
                        <div className="w-8 h-8 rounded bg-white/5 animate-pulse" />
                        <div className="flex-1 flex flex-col gap-1 justify-center">
                          <div className="h-3 bg-white/5 rounded w-2/3 animate-pulse" />
                          <div className="h-2 bg-white/5 rounded w-1/2 animate-pulse" />
                        </div>
                      </div>
                    ))}
                  </div>
                ) : projects.length === 0 ? (
                  <div className="text-center py-8">
                    <p className="text-xs text-white/40">
                      No active projects.
                    </p>
                  </div>
                ) : (
                  <div className="flex flex-col gap-2">
                    {projects.map((proj) => (
                      <div
                        key={proj.$id}
                        onClick={() => router.push(`/projects/${proj.$id}`)}
                        className="flex gap-3 p-2.5 rounded-xl bg-white/[0.02] border border-white/[0.03] cursor-pointer hover:bg-white/[0.04] hover:border-white/[0.08] hover:translate-x-1 transition-all duration-200"
                      >
                        <div 
                          className="w-8 h-8 rounded flex items-center justify-center flex-shrink-0"
                          style={{
                            backgroundColor: `${proj.color || '#6366F1'}1F`,
                            color: proj.color || '#6366F1'
                          }}
                        >
                          <FolderKanban size={16} />
                        </div>
                        <div className="min-w-0 flex-1">
                          <div className="text-xs font-bold text-white truncate">
                            {proj.name}
                          </div>
                          <div className="text-[9px] text-white/40 font-mono uppercase truncate mt-0.5">
                            STATUS: {(proj.status || 'Active').toUpperCase()}
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}
          </div>
        </div>

      </div>
    </div>
  );
}

export default function Home() {
  return (
    <Suspense fallback={null}>
      <ConnectHomeContent />
    </Suspense>
  );
}
