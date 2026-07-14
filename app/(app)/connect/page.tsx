'use client';

import { Suspense, useEffect, useMemo, useState } from 'react';
import { NostrFeed } from '@/components/social/NostrFeed';
import { ChatList } from '@/components/chat/ChatList';
import { MailBox } from '@/components/connect/MailBox';
import { useProjectsList } from '@/hooks/useProjectsList';
import { usePathname, useRouter, useSearchParams } from 'next/navigation';
import { useFAB } from '@/context/FABContext';
import { useUnifiedDrawer } from '@/context/UnifiedDrawerContext';
import { MessageSquare, Phone, Plus, ChevronDown, ChevronUp, Maximize2, FolderKanban, Bookmark, Hash } from 'lucide-react';
import { useResourcePins } from '@/context/ResourcePinContext';
import { useSection } from '@/context/SectionContext';
import { useAuth } from '@/context/auth/AuthContext';
import toast from 'react-hot-toast';

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
  const [bookmarksOpen, setBookmarksOpen] = useState(true);
  const [activeTab, setActiveTab] = useState<'moments' | 'chats' | 'mail'>('moments');
  const [chatsActiveTab, setChatsActiveTab] = useState<'secure' | 'public'>('secure');

  const { projects, loading: projectsLoading } = useProjectsList();
  const { user } = useAuth();
  const { pinSets } = useResourcePins();
  const { setActiveDetail } = useSection();
  const [bookmarkedMoments, setBookmarkedMoments] = useState<any[]>([]);
  const [bookmarksLoading, setBookmarksLoading] = useState(true);

  useEffect(() => {
    if (!user?.$id) return;
    const bookmarkedIds = Array.from(pinSets.moment || []);
    if (bookmarkedIds.length === 0) {
      setBookmarkedMoments([]);
      setBookmarksLoading(false);
      return;
    }

    let active = true;
    setBookmarksLoading(true);
    
    const fetchBookmarks = async () => {
      try {
        const { APPWRITE_CONFIG } = await import('@/lib/appwrite/config');
        const { tablesDB } = await import('@/lib/appwrite/client');
        const { Query } = await import('appwrite');
        
        const res = await tablesDB.listRows(
          APPWRITE_CONFIG.DATABASES.CONNECT,
          APPWRITE_CONFIG.TABLES.CONNECT.MOMENTS,
          [Query.equal('$id', bookmarkedIds), Query.limit(100)]
        );
        
        if (active) {
          setBookmarkedMoments(res.rows || []);
        }
      } catch (err) {
        console.error('Failed to load bookmarked moments:', err);
      } finally {
        if (active) setBookmarksLoading(false);
      }
    };

    void fetchBookmarks();
    return () => { active = false; };
  }, [pinSets.moment, user?.$id]);

  useEffect(() => {
    if (activeTab === 'chats') {
      if (chatsActiveTab === 'public') {
        setConfiguration({
          isVisible: true,
          mainColor: '#F59E0B',
          mainIcon: <Plus size={32} strokeWidth={3} />,
          onMainClick: () => openUnified('new-chat', { mode: 'thread' }),
          actions: [
            { id: 'new-thread', label: 'NEW THREAD', icon: <Hash size={20} />, onClick: () => openUnified('new-chat', { mode: 'thread' }) },
          ],
        });
      } else {
        setConfiguration({
          isVisible: true,
          mainColor: '#F59E0B',
          mainIcon: <Plus size={32} strokeWidth={3} />,
          onMainClick: () => openUnified('new-chat', { mode: 'secure' }),
          actions: [
            { id: 'secret-chat', label: 'SECURE CHAT', icon: <MessageSquare size={20} />, onClick: () => openUnified('new-chat', { mode: 'secure' }) },
            { id: 'channel', label: 'NEW CHANNEL', icon: <Plus size={20} />, onClick: () => openUnified('new-channel') },
            { id: 'huddle', label: 'START HUDDLE', icon: <Phone size={20} />, onClick: () => router.push('/connect/calls?start=1') },
          ],
        });
      }
      return () => resetConfiguration();
    }

    setConfiguration({
      isVisible: true,
      mainColor: '#F59E0B',
      mainIcon: <Plus size={32} strokeWidth={3} />,
      onMainClick: () => window.dispatchEvent(new CustomEvent('kylrix:open-moment-composer')),
      actions: [
        { id: 'moment', label: 'CREATE MOMENT', icon: <Plus size={20} />, onClick: () => window.dispatchEvent(new CustomEvent('kylrix:open-moment-composer')) },
        { id: 'chat', label: 'SECURE CHAT', icon: <MessageSquare size={20} />, onClick: () => openUnified('new-chat', { mode: 'secure' }) },
        { id: 'channel', label: 'NEW CHANNEL', icon: <Plus size={20} />, onClick: () => openUnified('new-channel') },
        { id: 'huddle', label: 'START HUDDLE', icon: <Phone size={20} />, onClick: () => router.push('/connect/calls?start=1') },
      ],
    });
    return () => resetConfiguration();
  }, [activeTab, chatsActiveTab, setConfiguration, resetConfiguration, router, openUnified]);

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

      <div className="max-w-7xl mx-auto relative z-10">
        {/* Tab Switcher */}
        <div className="flex items-center gap-2 p-1 bg-white/[0.02] border border-white/5 rounded-2xl w-fit select-none mb-8">
          <button
            onClick={() => setActiveTab('moments')}
            className={`px-5 py-2.5 rounded-xl text-xs font-extrabold transition-all ${
              activeTab === 'moments'
                ? 'bg-[#F59E0B] text-white shadow-[0_4px_12px_rgba(245,158,11,0.25)]'
                : 'text-white/50 hover:text-white hover:bg-white/5'
            }`}
          >
            Moments
          </button>
          <button
            onClick={() => setActiveTab('chats')}
            className={`px-5 py-2.5 rounded-xl text-xs font-extrabold transition-all ${
              activeTab === 'chats'
                ? 'bg-[#F59E0B] text-white shadow-[0_4px_12px_rgba(245,158,11,0.25)]'
                : 'text-white/50 hover:text-white hover:bg-white/5'
            }`}
          >
            Chats
          </button>
          <button
            onClick={() => setActiveTab('mail')}
            className={`px-5 py-2.5 rounded-xl text-xs font-extrabold transition-all ${
              activeTab === 'mail'
                ? 'bg-[#F59E0B] text-white shadow-[0_4px_12px_rgba(245,158,11,0.25)]'
                : 'text-white/50 hover:text-white hover:bg-white/5'
            }`}
          >
            Mail
          </button>
        </div>

        {/* Tab Content */}
        {activeTab === 'moments' && (
          <div className="max-w-3xl md:max-w-[1400px] mx-auto grid grid-cols-1 md:grid-cols-[1fr_340px] gap-8 items-start">
            {/* Left Column: Moments Feed */}
            <div className="min-w-0 w-full flex flex-col gap-6">
              <div className="flex items-between justify-between">
                <h2 className="text-2xl font-black font-clash text-white tracking-tight">
                  Moments
                </h2>
              </div>
              <NostrFeed />
            </div>

            {/* Right Column: Collaboration Sidebar */}
            <div className="hidden md:flex w-full flex-col gap-8 max-h-[calc(100vh-140px)] overflow-y-auto scrollbar-none pr-1 md:sticky md:top-[108px]">
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
                    <ChatList activeTab="public" hideTabs={true} skipSecureLoad={true} />
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
                        {projects.map((proj) => {
                          const isPending = (proj as any).isPending;
                          const isRequested = (proj as any).isRequested;
                          return (
                            <div
                              key={proj.$id}
                              onClick={() => {
                                if (isPending) {
                                  openUnified('project-invite', {
                                    project: proj,
                                    onAccepted: () => {
                                      router.push(`/projects/${proj.$id}`);
                                    }
                                  });
                                } else if (isRequested) {
                                  openUnified('project-invite', {
                                    project: proj,
                                    isRequested: true
                                  });
                                } else {
                                  router.push(`/projects/${proj.$id}`);
                                }
                              }}
                              className="flex gap-3 p-2.5 rounded-xl bg-white/[0.02] border border-white/[0.03] cursor-pointer hover:bg-white/[0.04] hover:border-white/[0.08] hover:translate-x-1 transition-all duration-200"
                            >
                              <div 
                                className="w-8 h-8 rounded flex items-center justify-center flex-shrink-0"
                                style={{
                                  backgroundColor: `${(proj as any).color || '#6366F1'}1F`,
                                  color: (proj as any).color || '#6366F1'
                                }}
                              >
                                <FolderKanban size={16} />
                              </div>
                              <div className="min-w-0 flex-1">
                                <div className="text-xs font-bold text-white truncate">
                                  {proj.title}
                                </div>
                                <div className="text-[9px] text-white/40 font-mono uppercase truncate mt-0.5">
                                  STATUS: {isPending ? 'INVITED' : (isRequested ? 'REQUESTED' : (proj.status || 'Active').toUpperCase())}
                                </div>
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    )}
                  </div>
                )}
              </div>

              {/* Pocket 3: Bookmarks */}
              <div 
                className="bg-[#161412] rounded-3xl border border-white/5 p-5 flex flex-col overflow-hidden shadow-[0_12px_36px_rgba(0,0,0,0.5)] hover:border-white/10 hover:-translate-y-0.5 transition-all duration-300"
                style={{
                  flex: '0 0 auto',
                  height: bookmarksOpen ? '380px' : '68px',
                }}
              >
                <div className="flex justify-between items-center mb-3">
                  <div className="flex items-center gap-2">
                    <div className="w-2 h-2 rounded-full bg-amber-500" />
                    <h3 className="text-sm font-mono uppercase tracking-widest text-white/90">
                      Bookmarks
                    </h3>
                  </div>
                  <div className="flex gap-1 items-center">
                    <button 
                      onClick={() => setBookmarksOpen(!bookmarksOpen)} 
                      className="p-1 text-white/40 hover:text-white rounded transition-colors"
                    >
                      {bookmarksOpen ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
                    </button>
                  </div>
                </div>

                {bookmarksOpen && (
                  <div className="flex-1 overflow-y-auto pr-1 bg-[#0B0A09] rounded-2xl border border-white/5 p-3 scrollbar-none">
                    {bookmarksLoading ? (
                      <div className="flex flex-col gap-2.5">
                        {[1, 2].map((n) => (
                          <div key={n} className="flex gap-3 p-3 rounded-xl bg-white/[0.01] border border-white/[0.03]">
                            <div className="w-8 h-8 rounded bg-white/5 animate-pulse" />
                            <div className="flex-1 flex flex-col gap-1 justify-center">
                              <div className="h-3 bg-white/5 rounded w-2/3 animate-pulse" />
                            </div>
                          </div>
                        ))}
                      </div>
                    ) : bookmarkedMoments.length === 0 ? (
                      <div className="text-center py-8">
                        <p className="text-xs text-white/40">
                          No bookmarks yet.
                        </p>
                      </div>
                    ) : (
                      <div className="flex flex-col gap-2">
                        {bookmarkedMoments.map((moment) => (
                          <div
                            key={moment.$id}
                            onClick={() => setActiveDetail({ type: 'moment', id: moment.$id, data: moment })}
                            className="flex gap-3 p-2.5 rounded-xl bg-white/[0.02] border border-white/[0.03] cursor-pointer hover:bg-white/[0.04] hover:border-white/[0.08] hover:translate-x-1 transition-all duration-200"
                          >
                            <div 
                              className="w-8 h-8 rounded flex items-center justify-center flex-shrink-0 bg-amber-500/10 text-amber-500"
                            >
                              <Bookmark size={16} className="fill-amber-500/20" />
                            </div>
                            <div className="min-w-0 flex-1">
                              <div className="text-xs font-bold text-white truncate">
                                {moment.caption || 'Untitled Moment'}
                              </div>
                              <div className="text-[9px] text-white/40 font-mono uppercase truncate mt-0.5">
                                {(moment.momentKind || 'POST').toUpperCase()}
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
        )}

        {activeTab === 'chats' && (
          <div className="max-w-3xl mx-auto flex flex-col gap-6">
            {/* Desktop Stacked View */}
            <div className="hidden lg:flex flex-col gap-8">
              <div>
                <div className="flex items-center justify-between mb-4">
                  <h2 className="text-lg font-black font-clash text-white">
                    Secret Chats
                  </h2>
                  <button
                    type="button"
                    onClick={() => openUnified('new-chat', { mode: 'secure' })}
                    className="flex items-center gap-2 px-3 py-2 rounded-xl bg-[#F59E0B] text-black text-xs font-extrabold hover:brightness-110 transition"
                  >
                    <Plus size={14} strokeWidth={3} />
                    New secure chat
                  </button>
                </div>
                <ChatList activeTab="secure" hideTabs={true} skipThreadsLoad />
              </div>
              <hr className="border-white/5 my-4" />
              <div>
                <div className="flex items-center justify-between mb-4">
                  <h2 className="text-lg font-black font-clash text-white">
                    Threads
                  </h2>
                  <button
                    type="button"
                    onClick={() => openUnified('new-chat', { mode: 'thread' })}
                    className="flex items-center gap-2 px-3 py-2 rounded-xl bg-[#F59E0B] text-black text-xs font-extrabold hover:brightness-110 transition"
                  >
                    <Plus size={14} strokeWidth={3} />
                    New thread
                  </button>
                </div>
                <ChatList activeTab="public" hideTabs={true} skipSecureLoad />
              </div>
            </div>

            {/* Mobile Tabbed View */}
            <div className="block lg:hidden">
              <ChatList activeTab={chatsActiveTab} onTabChange={setChatsActiveTab} />
            </div>
          </div>
        )}

        {activeTab === 'mail' && (
          <div className="w-full">
            <MailBox />
          </div>
        )}
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
