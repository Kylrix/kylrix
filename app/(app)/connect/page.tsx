'use client';

import { Suspense, useEffect, useMemo, useState } from 'react';
import { Feed } from '@/components/social/Feed';
import { ChatList } from '@/components/chat/ChatList';
import { ProjectsService } from '@/lib/appwrite/projects';
import { usePathname, useRouter, useSearchParams } from 'next/navigation';
import { useFAB } from '@/context/FABContext';
import { useUnifiedDrawer } from '@/context/UnifiedDrawerContext';
import { MessageSquare, Phone, Plus, ChevronDown, ChevronUp, Maximize2, FolderKanban } from 'lucide-react';

// Client-side persistence cache to resist flicker and page reloads
let cachedProjects: any[] | null = null;

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

  // Flexible right panel sizes
  const [threadsOpen, setThreadsOpen] = useState(true);
  const [projectsOpen, setProjectsOpen] = useState(true);

  // Projects data state
  const [projects, setProjects] = useState<any[]>(() => cachedProjects || []);
  const [projectsLoading, setProjectsLoading] = useState(() => !cachedProjects);

  const [isDesktop, setIsDesktop] = useState(false);

  useEffect(() => {
    const media = window.matchMedia("(min-width: 1024px)");
    setIsDesktop(media.matches);
    const listener = (e: MediaQueryListEvent) => setIsDesktop(e.matches);
    media.addEventListener("change", listener);
    return () => media.removeEventListener("change", listener);
  }, []);

  useEffect(() => {
    setConfiguration({
      isVisible: true,
      mainColor: '#F59E0B',
      actions: [
        { id: 'chat', label: 'NEW CHAT', icon: <MessageSquare size={20} />, onClick: () => openUnified('new-chat') },
        { id: 'channel', label: 'NEW CHANNEL', icon: <Plus size={20} />, onClick: () => openUnified('new-channel') },
        { id: 'huddle', label: 'START HUDDLE', icon: <Phone size={20} />, onClick: () => router.push('/connect/calls?start=1') }]
    });
    return () => resetConfiguration();
  }, [setConfiguration, resetConfiguration, router, openUnified]);

  useEffect(() => {
    let mounted = true;
    async function loadProjects() {
      try {
        const res = await ProjectsService.listProjects();
        if (mounted) {
          cachedProjects = res.rows || [];
          setProjects(res.rows || []);
          setProjectsLoading(false);
        }
      } catch (err) {
        console.error('Failed to load projects inside Connect home:', err);
        if (mounted) setProjectsLoading(false);
      }
    }
    loadProjects();
    return () => {
      mounted = false;
    };
  }, []);

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

  if (isDesktop) {
    return (
      <div className="max-w-7xl mx-auto py-4 px-4 md:px-6 pointer-events-auto">
        <div className="grid grid-cols-1 lg:grid-cols-[1fr_400px] gap-8 items-start">
          {/* Moments Column */}
          <div>
            <h2 className="text-2xl font-black font-clash text-white mb-6">
              Moments
            </h2>
            <Feed view="personal" composeIntent={composeIntent} />
          </div>

          {/* Sticky Interactive Dashboard Side column */}
          <div className="max-h-[calc(100vh-140px)] overflow-y-auto scrollbar-none pr-1 flex flex-col gap-6 lg:sticky lg:top-[108px]">
            
            {/* Section 1: Huddle Threads */}
            <div 
              className="bg-[#161412] rounded-3xl border border-white/5 p-5 flex flex-col overflow-hidden transition-[height,max-height] duration-400 ease-[cubic-bezier(0.16,1,0.3,1)]"
              style={{
                flex: '0 0 auto',
                height: threadsOpen ? 'auto' : '68px',
                maxHeight: threadsOpen ? '380px' : '68px',
              }}
            >
              {/* Threads Header */}
              <div className={`flex justify-between items-center ${threadsOpen ? 'mb-4' : 'mb-0'}`}>
                <h3 className="text-lg font-black font-clash text-white">
                  Threads
                </h3>
                <div className="flex gap-1">
                  <button 
                    onClick={() => setThreadsOpen(!threadsOpen)} 
                    className="p-1.5 text-white/40 hover:text-white rounded-lg transition-colors"
                  >
                    {threadsOpen ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
                  </button>
                  <button 
                    onClick={() => router.push('/connect/chats')} 
                    className="p-1.5 text-white/40 hover:text-[#F59E0B] rounded-lg transition-colors"
                  >
                    <Maximize2 size={14} />
                  </button>
                </div>
              </div>

              {threadsOpen && (
                <div className="flex-1 overflow-y-auto pr-1">
                  <ChatList activeTab="public" hideTabs={true} />
                </div>
              )}
            </div>

            {/* Section 2: Projects Accordion */}
            <div 
              className="bg-[#161412] rounded-3xl border border-white/5 p-5 flex flex-col overflow-hidden transition-[height,max-height] duration-400 ease-[cubic-bezier(0.16,1,0.3,1)]"
              style={{
                flex: '0 0 auto',
                height: projectsOpen ? 'auto' : '68px',
                maxHeight: projectsOpen ? '380px' : '68px',
              }}
            >
              {/* Projects Header */}
              <div className={`flex justify-between items-center ${projectsOpen ? 'mb-4' : 'mb-0'}`}>
                <h3 className="text-lg font-black font-clash text-white">
                  Projects
                </h3>
                <div className="flex gap-1">
                  <button 
                    onClick={() => setProjectsOpen(!projectsOpen)} 
                    className="p-1.5 text-white/40 hover:text-white rounded-lg transition-colors"
                  >
                    {projectsOpen ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
                  </button>
                  <button 
                    onClick={() => router.push('/projects')} 
                    className="p-1.5 text-white/40 hover:text-[#F59E0B] rounded-lg transition-colors"
                  >
                    <Maximize2 size={14} />
                  </button>
                </div>
              </div>

              {projectsOpen && (
                <div className="flex-1 overflow-y-auto pr-1">
                  {projectsLoading ? (
                    <div className="flex flex-col gap-3.5">
                      {[1, 2, 3].map((n) => (
                        <div key={n} className="flex gap-3.5 p-3.5 rounded-2xl bg-white/[0.01] border border-white/[0.03]">
                          <div className="w-9 h-9 rounded-lg bg-white/5 animate-pulse" />
                          <div className="flex-1 flex flex-col gap-1 justify-center">
                            <div className="h-4 bg-white/5 rounded w-2/3 animate-pulse" />
                            <div className="h-3 bg-white/5 rounded w-1/2 animate-pulse" />
                          </div>
                        </div>
                      ))}
                    </div>
                  ) : projects.length === 0 ? (
                    <div className="text-center py-8">
                      <p className="text-sm text-white/40">
                        No active projects.
                      </p>
                    </div>
                  ) : (
                    <div className="flex flex-col gap-3">
                      {projects.map((proj) => (
                        <div
                          key={proj.$id}
                          onClick={() => router.push(`/projects/${proj.$id}`)}
                          className="flex gap-3.5 p-3.5 rounded-2xl bg-white/[0.02] border border-white/[0.03] cursor-pointer hover:bg-white/[0.04] hover:border-white/[0.08] hover:translate-x-1 transition-all duration-200"
                        >
                          <div 
                            className="w-9 h-9 rounded-lg flex items-center justify-center flex-shrink-0"
                            style={{
                              backgroundColor: `${proj.color || '#6366F1'}1F`,
                              color: proj.color || '#6366F1'
                            }}
                          >
                            <FolderKanban size={18} />
                          </div>
                          <div className="min-w-0 flex-1">
                            <div className="text-sm font-extrabold text-white truncate">
                              {proj.name}
                            </div>
                            <div className="text-[10px] text-white/40 font-mono uppercase truncate mt-0.5">
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

  return (
    <div className="max-w-3xl mx-auto py-4 px-4 sm:px-6 pointer-events-auto">
      <Feed view="personal" composeIntent={composeIntent} />
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
