'use client';

import { useEffect, useState, useRef } from 'react';
import { X, Sparkles, FileText, ListChecks, Map as MapIcon, Lightbulb, Send, Paperclip, Link2, Image as ImageIcon } from 'lucide-react';
import { Drawer, Box } from '@/lib/openbricks/primitives';
import { LocalEngine } from '@/lib/services/LocalEngine';

// Sidekick — flagship per-object companion. One session per object (targetType/targetId).
// Migrated from SummarizeDrawer: keeps summarize skeleton but adds full chat + LocalEngine + sidekick prompt.

export type SidekickTarget = { type: string; id: string; title?: string; content?: string; metadata?: Record<string, unknown>; tags?: string[] };

type SidekickResult = {
  oneLiner: string;
  sections: { heading: string; bullets: string[] }[];
  mindMap: { nodes: { id: string; label: string; kind: string }[]; edges: { from: string; to: string; label?: string }[] };
  suggestions?: { label: string; prompt: string }[];
  nextSteps?: { label: string; prompt: string }[];
};

type ChatMsg = { id: string; role: 'user' | 'assistant'; content: string; at?: string };

function Skeleton() {
  return (
    <div className="flex flex-col gap-4 animate-pulse">
      <div className="h-4 bg-white/10 rounded w-3/4" />
      <div className="h-3 bg-white/5 rounded w-full" />
      <div className="h-3 bg-white/5 rounded w-5/6" />
      <div className="h-24 bg-white/[0.03] rounded-xl border border-white/5" />
      <div className="h-32 bg-white/[0.03] rounded-xl border border-white/5" />
    </div>
  );
}

function MindMapFlow({ data }: { data: SidekickResult['mindMap'] | null }) {
  if (!data || !data.nodes?.length) return <div className="text-xs text-white/30">No map yet — ask Sidekick.</div>;
  const nodes = data.nodes.slice(0, 10);
  const edges = data.edges.slice(0, 12);
  const cx = 160, cy = 100, r = 75;
  const pos = new Map<string, { x: number; y: number }>();
  nodes.forEach((n, i) => {
    if (n.kind === 'central') pos.set(n.id, { x: cx, y: cy });
    else {
      const angle = (i / Math.max(1, nodes.length - 1)) * Math.PI * 2;
      pos.set(n.id, { x: cx + Math.cos(angle) * r, y: cy + Math.sin(angle) * r });
    }
  });
  return (
    <div className="bg-[#0A0908] border border-white/5 rounded-2xl p-3 overflow-hidden">
      <svg viewBox="0 0 320 220" className="w-full h-[220px]">
        {edges.map((e, i) => {
          const a = pos.get(e.from), b = pos.get(e.to);
          if (!a || !b) return null;
          return <line key={i} x1={a.x} y1={a.y} x2={b.x} y2={b.y} stroke="rgba(168,85,247,0.35)" strokeWidth={1.5} />;
        })}
        {nodes.map((n) => {
          const p = pos.get(n.id)!;
          const isCentral = n.kind === 'central';
          return (
            <g key={n.id}>
              <rect x={p.x - 42} y={p.y - 14} width={84} height={28} rx={14} fill={isCentral ? '#A855F7' : '#161412'} stroke={isCentral ? '#A855F7' : 'rgba(255,255,255,0.08)'} />
              <text x={p.x} y={p.y + 4} textAnchor="middle" fontSize={9} fontWeight={800} fill={isCentral ? 'white' : '#D6D1CA'}>{n.label.slice(0, 14)}</text>
            </g>
          );
        })}
      </svg>
    </div>
  );
}

export function SidekickDrawer({
  open,
  onClose,
  target,
}: {
  open: boolean;
  onClose: () => void;
  target: SidekickTarget | null;
}) {
  const [isMobile, setIsMobile] = useState(false);
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<SidekickResult | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [sessionId, setSessionId] = useState<string | null>(null);
  const [messages, setMessages] = useState<ChatMsg[]>([]);
  const [input, setInput] = useState('');
  const [sending, setSending] = useState(false);
  const listRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const h = () => setIsMobile(window.innerWidth < 768);
    h();
    window.addEventListener('resize', h);
    return () => window.removeEventListener('resize', h);
  }, []);

  // Plug into LocalEngine: sidekick draft per object
  const draftKey = target ? `sidekick:draft:${target.type}:${target.id}` : null;
  useEffect(() => {
    if (!open || !draftKey) return;
    LocalEngine.cacheGet<string>(draftKey).then((v) => { if (v) setInput(v); }).catch(()=>{});
  }, [open, draftKey]);
  useEffect(() => {
    if (!draftKey) return;
    const t = setTimeout(()=> { LocalEngine.cacheSet(draftKey, input).catch(()=>{}); }, 300);
    return ()=> clearTimeout(t);
  }, [input, draftKey]);

  // Load or create sidekick session — if pre-existing conversation, show chat instead of re-querying summary
  useEffect(() => {
    if (!open || !target) return;
    let cancelled = false;
    (async () => {
      setLoading(true);
      setError(null);
      setResult(null);
      setMessages([]);
      setSessionId(null);
      try {
        const { account } = await import('@/lib/appwrite/client');
        const jwt = await account.createJWT().then((r: any) => r.jwt || '').catch(() => undefined);
        const { AgenticSessionLocalStore } = await import('@/lib/agentic/session-local-store');
        const user = await account.get().catch(() => null);
        // 1) Check LocalEngine cached sidekick result/chat for instant paint
        const localCacheKey = `sidekick:result:${target.type}:${target.id}`;
        const cached = await LocalEngine.cacheGet<any>(localCacheKey).catch(()=>null);
        if (cached?.oneLiner && !cancelled) {
          setResult(cached as SidekickResult);
          // also try to hydrate messages
          const cachedMsgs = await LocalEngine.cacheGet<ChatMsg[]>(`sidekick:chat:${target.type}:${target.id}`).catch(()=>null);
          if (Array.isArray(cachedMsgs) && cachedMsgs.length) setMessages(cachedMsgs);
        }
        // 2) Check AgenticSessionLocalStore for existing session with targetType/targetId — if has chatHistory, show chat, don't re-summarize
        if (user?.$id) {
          const sessions = await AgenticSessionLocalStore.getSessionsList(user.$id);
          const localMatch: any = sessions.find((s: any) => (s as any).targetType === target.type && (s as any).targetId === target.id);
          if (localMatch?.chatHistory) {
            try {
              const hist = JSON.parse(localMatch.chatHistory);
              if (Array.isArray(hist) && hist.length) {
                const msgs: ChatMsg[] = hist.map((m: any) => ({ id: m.id || `${m.role}-${m.at}`, role: m.role, content: m.content, at: m.at }));
                if (!cancelled) {
                  setMessages(msgs);
                  // try to derive result from last assistant JSON
                  const lastAssistant = [...hist].reverse().find((m: any) => m.role === 'assistant');
                  if (lastAssistant?.content) {
                    try {
                      const parsed = JSON.parse(lastAssistant.content);
                      if (parsed?.oneLiner) setResult(parsed as SidekickResult);
                    } catch {}
                  }
                  setSessionId(localMatch.id);
                  setLoading(false);
                  // Persist to LocalEngine for offline
                  if (msgs.length) LocalEngine.cacheSet(`sidekick:chat:${target.type}:${target.id}`, msgs).catch(()=>{});
                  return; // Don't re-query summary — show existing chat
                }
              }
            } catch {}
          }
        }

        // 3) No local hit — invoke dedicated sidekick prompt (not standard template) via server action
        const { executeSidekickAction } = await import('@/lib/actions/sidekick');
        const res: any = await executeSidekickAction({ target, jwt });
        if (cancelled) return;
        if (res?.result) {
          setResult(res.result as SidekickResult);
          await LocalEngine.cacheSet(localCacheKey, res.result).catch(()=>{});
          if (res.sessionId) {
            setSessionId(res.sessionId);
            const newMsgs: ChatMsg[] = [
              { id: `u_${Date.now()}`, role: 'user', content: `Analyze ${target.type} ${target.title || target.id}` },
              { id: `a_${Date.now()}`, role: 'assistant', content: JSON.stringify(res.result) },
            ];
            setMessages(newMsgs);
            await LocalEngine.cacheSet(`sidekick:chat:${target.type}:${target.id}`, newMsgs).catch(()=>{});
            if (user?.$id) {
              const store = (await import('@/lib/agentic/session-local-store')).AgenticSessionLocalStore;
              await store.upsertSession({
                id: res.sessionId,
                userId: user.$id,
                chatHistory: newMsgs.map(m=> ({ id: m.id, role: m.role, content: m.content })) as any,
                // @ts-ignore additive columns
                targetType: target.type,
                targetId: target.id,
              } as any);
              await store.setActiveSessionId(user.$id, res.sessionId);
            }
          }
        } else if (res?.error) setError(res.error);
      } catch (e: any) {
        if (!cancelled) setError(e?.message || 'Sidekick failed');
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => { cancelled = true; };
  }, [open, target?.id, target?.type]);

  useEffect(()=> { if (listRef.current) listRef.current.scrollTop = listRef.current.scrollHeight; }, [messages, result]);

  const handleSend = async () => {
    const trimmed = input.trim();
    if (!trimmed || !target || sending) return;
    setSending(true);
    const userMsg: ChatMsg = { id: `u_${Date.now()}`, role: 'user', content: trimmed };
    const next = [...messages, userMsg];
    setMessages(next);
    setInput('');
    if (draftKey) LocalEngine.cacheSet(draftKey, '').catch(()=>{});
    await LocalEngine.cacheSet(`sidekick:chat:${target.type}:${target.id}`, next).catch(()=>{});
    try {
      const { account } = await import('@/lib/appwrite/client');
      const jwt = await account.createJWT().then((r:any)=> r.jwt || '').catch(()=> undefined);
      const { executeSidekickChat } = await import('@/lib/actions/sidekick');
      const res: any = await executeSidekickChat({ target, message: trimmed, sessionId: sessionId || undefined, jwt });
      const assistant: ChatMsg = { id: `a_${Date.now()}`, role: 'assistant', content: res?.response || res?.result ? JSON.stringify(res.result) : 'Done.' };
      const updated = [...next, assistant];
      setMessages(updated);
      await LocalEngine.cacheSet(`sidekick:chat:${target.type}:${target.id}`, updated).catch(()=>{});
      if (res?.sessionId && !sessionId) setSessionId(res.sessionId);
      // If response is new summary JSON, update result
      try {
        const parsed = JSON.parse(assistant.content);
        if (parsed?.oneLiner) { setResult(parsed); await LocalEngine.cacheSet(`sidekick:result:${target.type}:${target.id}`, parsed).catch(()=>{}); }
      } catch {}
      // Also upsert agentic local store
      const { account: acc } = await import('@/lib/appwrite/client');
      const user = await acc.get().catch(()=>null);
      if (user?.$id && (res?.sessionId || sessionId)) {
        const sid = res?.sessionId || sessionId!;
        const store = (await import('@/lib/agentic/session-local-store')).AgenticSessionLocalStore;
        await store.upsertSession({ id: sid, userId: user.$id, chatHistory: updated.map(m=> ({ id: m.id, role: m.role, content: m.content })) as any, targetType: target.type, targetId: target.id } as any);
      }

      // Feed into Contextual Engine: learn patterns and ingest user clarifications
      try {
        const { patternMatcher, contextManager } = await import('@/lib/contextual-engine');
        patternMatcher.ingestText(trimmed, { niche: 'intelligence' });
        const isCorrection = /^(don't|dont|no\b|i meant|actually|correction|instead)/i.test(trimmed);
        if (isCorrection) {
          const lastAssistant = [...messages].reverse().find(m => m.role === 'assistant');
          contextManager.ingestUserClarification(target.id, {
            originalQueryOrAction: lastAssistant?.content?.slice(0, 200) || '',
            userClarificationText: trimmed,
            affectedObjectId: target.id,
          });
        }
      } catch {}
    } catch (e:any) {
      setError(e?.message || 'Chat failed');
    } finally { setSending(false); }
  };

  const content = (
    <div className="h-full flex flex-col bg-[#0A0908] overflow-hidden">
      <div className="px-6 py-5 flex items-center justify-between border-b border-white/[0.05] shrink-0">
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 rounded-xl bg-[#A855F7]/15 border border-[#A855F7]/20 flex items-center justify-center">
            <Sparkles size={16} className="text-[#A855F7]" />
          </div>
          <div>
            <div className="text-[11px] font-black tracking-widest text-[#A855F7] uppercase">Sidekick</div>
            <div className="text-sm font-black text-white font-clash -mt-1 truncate max-w-[180px]">{target?.title || 'Research companion'}</div>
          </div>
        </div>
        <button onClick={onClose} className="p-2 rounded-xl text-white/40 hover:text-white hover:bg-white/5">
          <X size={18} />
        </button>
      </div>

      <div ref={listRef} className="flex-1 overflow-y-auto px-6 py-6 flex flex-col gap-6">
        {!target ? (
          <div className="text-sm text-white/40">No object selected.</div>
        ) : loading ? (
          <div className="flex flex-col gap-4">
            {/* Instant skeleton while background fetch (LocalEngine → DB) runs — drawer already open */}
            <Skeleton />
            <div className="rounded-2xl bg-[#161412] border border-white/5 p-4">
              <div className="text-xs font-black uppercase tracking-wider text-white/60 mb-2">Quick actions</div>
              <div className="flex flex-wrap gap-2">
                {['Suggest tags', 'Create goal', 'Attach object'].map((label) => (
                  <button key={label} onClick={() => setInput(label + ' for ' + (target.title || target.id))} className="px-3 py-1.5 rounded-full bg-white/5 border border-white/5 text-xs font-bold text-white/70 hover:bg-[#A855F7]/10 hover:border-[#A855F7]/20 hover:text-[#A855F7] transition-colors">
                    {label}
                  </button>
                ))}
              </div>
              <div className="text-[11px] text-white/20 mt-2">Uses same tag logic as create-idea drawer • LocalEngine cache first</div>
            </div>
          </div>
        ) : error ? (
          <div className="p-4 rounded-xl bg-red-500/10 border border-red-500/20 text-sm text-red-300">{error}</div>
        ) : (
          <>
            {/* Reuse agentic runtime quick suggestions — same logic as create-idea drawer */}
            {!result && messages.length === 0 && (
              <div className="rounded-2xl bg-[#161412] border border-white/5 p-4">
                <div className="text-xs font-black uppercase tracking-wider text-white mb-2">Quick actions</div>
                <div className="flex flex-wrap gap-2">
                  {(['Add tags: ' + (target.title || '').split(' ').slice(0, 2).join(', ') || 'Add tags', 'Summarize again', 'Create goal from this'].map((label) => (
                    <button key={label} onClick={() => setInput(label)} className="px-3 py-1.5 rounded-full bg-white/5 border border-white/5 text-xs font-bold text-white/70 hover:bg-[#A855F7]/10 hover:border-[#A855F7]/20 hover:text-white transition-colors">
                      {label}
                    </button>
                  )))}
                </div>
              </div>
            )}
            {result && (
              <>
                <div className="rounded-2xl bg-[#161412] border border-white/5 p-4 flex gap-3">
                  <Lightbulb size={18} className="text-[#A855F7] shrink-0 mt-0.5" />
                  <p className="text-[13px] leading-relaxed font-semibold text-white/90">{result.oneLiner}</p>
                </div>
                <div className="flex flex-col gap-3">
                  {result.sections?.map((sec, i) => (
                    <div key={i} className="rounded-2xl bg-[#161412] border border-white/5 p-4">
                      <div className="flex items-center gap-2 mb-2">
                        {sec.heading.toLowerCase().includes('action') ? <ListChecks size={14} className="text-[#10B981]" /> : <FileText size={14} className="text-white/40" />}
                        <span className="text-xs font-black uppercase tracking-wider text-white">{sec.heading}</span>
                      </div>
                      <ul className="list-disc pl-5 flex flex-col gap-1">
                        {sec.bullets.map((b, j) => <li key={j} className="text-[13px] leading-relaxed text-[#D6D1CA]">{b}</li>)}
                      </ul>
                    </div>
                  ))}
                </div>
                <div className="rounded-2xl bg-[#161412] border border-white/5 p-4">
                  <div className="flex items-center gap-2 mb-3">
                    <MapIcon size={14} className="text-[#A855F7]" />
                    <span className="text-xs font-black uppercase tracking-wider text-white">Object Map</span>
                    <span className="ml-auto text-[10px] font-bold text-white/30">flow • mind map</span>
                  </div>
                  <MindMapFlow data={result.mindMap} />
                  <div className="mt-3 flex flex-wrap gap-1.5">
                    {result.mindMap?.nodes?.slice(0, 6).map((n) => (
                      <span key={n.id} className="px-2 py-1 rounded-full bg-white/5 border border-white/5 text-[11px] font-bold text-white/70">{n.label}</span>
                    ))}
                  </div>
                </div>
                {(result.suggestions?.length || result.nextSteps?.length) ? (
                  <div className="rounded-2xl bg-[#161412] border border-white/5 p-4 flex flex-col gap-2">
                    <div className="text-xs font-black uppercase tracking-wider text-white">Quick actions</div>
                    <div className="flex flex-wrap gap-2">
                      {[...(result.suggestions || []), ...(result.nextSteps || [])].slice(0, 6).map((s, idx) => (
                        <button key={idx} onClick={() => setInput(s.prompt)} className="px-3 py-1.5 rounded-full bg-[#A855F7]/10 border border-[#A855F7]/20 text-xs font-bold text-[#E9D5FF] hover:bg-[#A855F7]/15 hover:border-[#A855F7]/30 transition-colors">
                          {s.label}
                        </button>
                      ))}
                    </div>
                  </div>
                ) : null}
              </>
            )}

            {/* Chat history — if pre-existing conversation, we show it instead of re-querying summary */}
            {messages.length > 0 && (
              <div className="flex flex-col gap-3">
                <div className="text-[11px] font-black tracking-widest text-white/30 uppercase">Conversation</div>
                {messages.map((m) => (
                  <div key={m.id} className={`max-w-[85%] rounded-2xl px-4 py-3 text-[13px] leading-relaxed ${m.role === 'user' ? 'bg-[#A855F7] text-white self-end' : 'bg-[#161412] border border-white/5 text-[#D6D1CA] self-start'}`}>
                    {(() => { try { const p = JSON.parse(m.content); if (p?.oneLiner) return p.oneLiner; } catch {} return m.content; })()}
                  </div>
                ))}
              </div>
            )}

            {sessionId && <div className="text-[11px] text-white/30 text-center">Sidekick session {sessionId.slice(0, 8)} • one per object • targetType/targetId — return months later</div>}

            {/* Future hooks placeholder */}
            <div className="rounded-2xl bg-white/[0.02] border border-dashed border-white/5 p-3 flex flex-col gap-2">
              <div className="text-xs font-bold text-white/60 flex items-center gap-2"><Paperclip size={14} /> Attachments & Linked Objects — coming soon</div>
              <div className="flex gap-2">
                <button onClick={()=> {}} className="flex-1 py-2 rounded-xl bg-white/5 border border-white/5 text-xs font-bold text-white/50 flex items-center justify-center gap-1.5"><ImageIcon size={14}/> Upload file</button>
                <button onClick={()=> {}} className="flex-1 py-2 rounded-xl bg-white/5 border border-white/5 text-xs font-bold text-white/50 flex items-center justify-center gap-1.5"><Link2 size={14}/> Attach note</button>
              </div>
              <div className="text-[11px] text-white/20">Sidekick session is itself an object — later: objects table, file uploads via StorageService, mental model map attachments.</div>
            </div>
          </>
        )}
      </div>

      {/* Chat bar — plugged into LocalEngine */}
      <div className="p-4 border-t border-white/5 bg-[#0A0908] shrink-0 flex gap-2">
        <input value={input} onChange={(e)=> setInput(e.target.value)} onKeyDown={(e)=> { if (e.key==='Enter' && !e.shiftKey) { e.preventDefault(); handleSend(); }}} placeholder={target ? `Ask Sidekick about ${target.title || target.type}…` : 'Ask Sidekick…'} className="flex-1 bg-[#161412] border border-white/5 rounded-xl px-4 py-3 text-sm text-white placeholder:text-white/20 focus:outline-none focus:border-[#A855F7]/30" />
        <button onClick={handleSend} disabled={sending || !input.trim()} className="px-4 py-3 rounded-xl bg-[#A855F7] hover:bg-[#9333EA] disabled:opacity-40 text-white font-black flex items-center justify-center">
          <Send size={16} />
        </button>
      </div>
    </div>
  );

  if (!open) return null;
  if (!isMobile) {
    const { NativeSidebarMount } = require('@/components/layout/NativeSidebarMount');
    return (
      <NativeSidebarMount active={open} sidebarKey={`sidekick-${target?.type}-${target?.id}`} width={520} title="Sidekick">
        {content}
      </NativeSidebarMount>
    );
  }
  return (
    <Drawer anchor="bottom" open={open} onClose={onClose} PaperProps={{ sx: { height: '84dvh', maxHeight: '90dvh', bgcolor: '#0A0908', borderTop: '1px solid rgba(255,255,255,0.05)', borderTopLeftRadius: '24px', borderTopRightRadius: '24px', zIndex: 1401 } as any }} ModalProps={{ keepMounted: false, disablePortal: true, sx: { zIndex: 1400 } as any }}>
      <Box sx={{ display: 'flex', justifyContent: 'center', py: 1.5 }}><Box sx={{ width: 40, height: 4, borderRadius: 2, bgcolor: '#3D3A36' }} /></Box>
      <div className="h-[calc(100%-24px)] overflow-hidden">{content}</div>
    </Drawer>
  );
}

// Back-compat: keep SummarizeDrawer as alias to SidekickDrawer to avoid codebase confusion during migration
export const SummarizeDrawer = SidekickDrawer;
