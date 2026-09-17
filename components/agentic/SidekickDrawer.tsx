'use client';

import { useEffect, useState, useRef, useCallback } from 'react';
import { X, Sparkles, FileText, ListChecks, Map as MapIcon, Lightbulb, Send, Paperclip, Target, FormInput, Tag, Copy, FolderKanban, ShieldAlert, FileCode, Calendar, Bot, Layers, Trash2 } from 'lucide-react';
import { Drawer, Box } from '@/lib/openbricks/primitives';
import { LocalEngine } from '@/lib/services/LocalEngine';
import { useUnifiedFileDrawer } from '@/context/UnifiedFileDrawerContext';
import { AgenticMarkdown } from '@/components/agentic/AgenticMarkdown';
import { getAgenticUserMessage } from '@/lib/agentic/errors';
import toast from 'react-hot-toast';

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

type PendingAttachment = { childId: string; childKind: string; name: string; bucketId?: string };

function renderKindIcon(kind: string) {
  switch (kind) {
    case 'task': case 'goal': return <Target size={13} className="text-purple-400 shrink-0" />;
    case 'note': case 'idea': return <FileText size={13} className="text-indigo-400 shrink-0" />;
    case 'project': return <FolderKanban size={13} className="text-blue-400 shrink-0" />;
    case 'vault': case 'totp': return <ShieldAlert size={13} className="text-amber-400 shrink-0" />;
    case 'form': return <FileCode size={13} className="text-emerald-400 shrink-0" />;
    case 'event': return <Calendar size={13} className="text-pink-400 shrink-0" />;
    case 'session': return <Bot size={13} className="text-cyan-400 shrink-0" />;
    case 'tag': return <Tag size={13} className="text-yellow-400 shrink-0" />;
    default: return <Layers size={13} className="text-purple-400 shrink-0" />;
  }
}

function deriveChildKind(bucketId?: string, mimeType?: string): string {
  if (bucketId === 'ideas') return 'note';
  if (bucketId === 'goals') return 'task';
  if (bucketId === 'projects') return 'project';
  if (bucketId === 'threads') return 'note';
  if (bucketId === 'totps' || bucketId === 'vault') return 'vault';
  if (bucketId === 'forms') return 'form';
  if (bucketId === 'events') return 'event';
  if (bucketId === 'sessions') return 'session';
  if (bucketId === 'tags') return 'tag';
  if (mimeType?.startsWith('image/')) return 'image';
  if (mimeType) return 'file';
  return 'note';
}

async function getRedactedObjectExcerpt(childId: string, _childKind: string): Promise<string> {
  try {
    const { LocalEngine } = await import('@/lib/services/LocalEngine');
    const { redactSensitiveEnvContent } = await import('@/lib/unorganic-email-api');
    const { redactPIIAndSensitiveFields } = await import('@/lib/tools/registry');

    let text = '';
    const note = await LocalEngine.cacheGet<any>(`note_${childId}`).catch(() => null);
    if (note) {
      text = `${note.title || ''}\n${note.content || ''}`.trim();
    } else {
      const task = await LocalEngine.cacheGet<any>(`task_${childId}`).catch(() => null);
      if (task) {
        text = `${task.title || ''}\n${task.description || ''}`.trim();
      }
    }

    if (text) {
      const step1 = redactSensitiveEnvContent(text);
      const step2 = redactPIIAndSensitiveFields({ content: step1 });
      const redacted = (step2 as any).content || step1;
      return redacted.slice(0, 500);
    }
  } catch {}
  return '';
}

function renderMessageContent(content?: string | null) {
  const text = typeof content === 'string' ? content : (content ? String(content) : '');
  if (!text) return null;

  const attachRegex = /\[Attached:\s*(.*?)\s*\((.*?)\)\s*-\s*ID:\s*(.*?)\]/g;
  const matches = [...text.matchAll(attachRegex)];
  let cleanText = text.replace(attachRegex, '').trim();

  try {
    const p = JSON.parse(cleanText);
    if (p?.oneLiner) cleanText = p.oneLiner;
  } catch {}

  return (
    <div className="flex flex-col gap-2">
      {cleanText && <AgenticMarkdown content={cleanText} />}
      {matches.length > 0 && (
        <div className="flex flex-wrap gap-1.5 mt-1">
          {matches.map((match, idx) => (
            <div key={idx} className="flex items-center gap-1.5 px-2.5 py-1 rounded-xl bg-black/30 border border-white/10 text-xs text-purple-200">
              <Paperclip size={12} className="text-purple-400" />
              <span className="font-bold">{match[1]}</span>
              <span className="text-[10px] opacity-60 uppercase">({match[2]})</span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

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
  const { openFileDrawer } = useUnifiedFileDrawer();
  const [isMobile, setIsMobile] = useState(false);
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<SidekickResult | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [sessionId, setSessionId] = useState<string | null>(null);
  const [messages, setMessages] = useState<ChatMsg[]>([]);
  const [input, setInput] = useState('');
  const [sending, setSending] = useState(false);
  const [pendingAttachments, setPendingAttachments] = useState<PendingAttachment[]>([]);
  const [attachedSessionObjects, setAttachedSessionObjects] = useState<any[]>([]);
  const [showAttachedObjectsDrawer, setShowAttachedObjectsDrawer] = useState(false);
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

  // Load attached objects for this sidekick session (0ms LocalEngine + background sync)
  const loadSidekickAttachments = useCallback(async (sid?: string | null) => {
    if (!sid && !target) return;
    const cacheKey = sid ? `sidekick:attachments:${sid}` : `sidekick:attachments:${target?.type}:${target?.id}`;
    const cached = await LocalEngine.cacheGet<any[]>(cacheKey).catch(() => null);
    if (Array.isArray(cached)) {
      setAttachedSessionObjects(cached);
    }
    if (sid) {
      try {
        const { getObjectsByParent } = await import('@/lib/actions/client-ops');
        const rows = await getObjectsByParent(sid, 'sidekick');
        if (Array.isArray(rows)) {
          setAttachedSessionObjects(rows);
          LocalEngine.cacheSet(cacheKey, rows).catch(() => {});
          if (target) {
            LocalEngine.cacheSet(`sidekick:attachments:${target.type}:${target.id}`, rows).catch(() => {});
          }
        }
      } catch {}
    }
  }, [target]);

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
      setPendingAttachments([]);
      setAttachedSessionObjects([]);
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
                  void loadSidekickAttachments(localMatch.id);
                  return; // Don't re-query summary — show existing chat
                }
              }
            } catch {}
          }
        }

        // 3) No local hit — invoke dedicated sidekick prompt (not standard template) via server action
        const { executeSidekickAction } = await import('@/lib/actions/sidekick');
        const res: any = await executeSidekickAction({ target, jwt }).catch((err: any) => ({
          success: false,
          error: getAgenticUserMessage(err),
        }));
        if (cancelled) return;
        if (res?.result) {
          setResult(res.result as SidekickResult);
          await LocalEngine.cacheSet(localCacheKey, res.result).catch(()=>{});
          if (res.sessionId) {
            setSessionId(res.sessionId);
            void loadSidekickAttachments(res.sessionId);
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
        if (!cancelled) setError(getAgenticUserMessage(e));
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => { cancelled = true; };
  }, [open, target?.id, target?.type]);

  useEffect(()=> { if (listRef.current) listRef.current.scrollTop = listRef.current.scrollHeight; }, [messages, result]);

  const handleIntelligentAction = useCallback(async (actionType: 'goal' | 'form' | 'note', promptText?: string) => {
    if (!target) return;
    setSending(true);
    try {
      if (actionType === 'goal') {
        const goalTitle = promptText ? promptText.replace(/^create\s+(a\s+)?goal\s*(to|for)?\s*/i, '').trim() : target.title || 'Goal';
        const formattedTitle = goalTitle ? goalTitle.charAt(0).toUpperCase() + goalTitle.slice(1) : `Goal for ${target.title || target.type}`;
        const { convertNoteToGoalAgentic } = await import('@/lib/ai-actions');
        const task = await convertNoteToGoalAgentic({
          $id: target.id,
          title: formattedTitle,
          content: target.content || `Goal derived from ${target.type}: ${target.title || target.id}`,
        } as any);
        toast.success(`Goal created: ${task?.title || formattedTitle}`);
        const assistantMsg: ChatMsg = {
          id: `a_${Date.now()}`,
          role: 'assistant',
          content: `🎯 **Created Goal:** **"${task?.title || formattedTitle}"**\n\n- **Status:** To Do\n- **Linked Object:** ${target.type} (${target.title || target.id})`,
        };
        const updated = [...messages, assistantMsg];
        setMessages(updated);
        LocalEngine.cacheSet(`sidekick:chat:${target.type}:${target.id}`, updated).catch(() => {});
      } else if (actionType === 'form') {
        const { generateObjectAssistSchemaAction } = await import('@/lib/actions/ai');
        const formPrompt = promptText || `Create a form tailored for ${target.type}: ${target.title || 'Untitled'}. Content context: ${target.content?.slice(0, 500) || ''}`;
        const { account } = await import('@/lib/appwrite/client');
        const jwt = await account.createJWT().then((r: any) => r.jwt || '').catch(() => undefined);
        const schemaRes = await generateObjectAssistSchemaAction({ kind: 'form', prompt: formPrompt, jwt });
        const generated = schemaRes?.data || {};
        const { createForm } = await import('@/lib/actions/client-ops');
        const newForm = await createForm({
          title: generated.title || `Form: ${target.title || 'Untitled'}`,
          description: generated.description || `Generated for ${target.type}: ${target.title || target.id}`,
          schema: JSON.stringify(generated.fields || [
            { id: 'f1', type: 'text', label: 'Response / Feedback', required: true },
            { id: 'f2', type: 'email', label: 'Contact Email', required: false },
          ]),
          status: 'draft',
        });
        toast.success(`Form created: ${newForm.title}`);
        const assistantMsg: ChatMsg = {
          id: `a_${Date.now()}`,
          role: 'assistant',
          content: `📝 **Created Form:** **"${newForm.title}"**\n\n- **Description:** ${newForm.description}\n- **Questions:** ${Array.isArray(generated.fields) ? generated.fields.length : 2} dynamic fields created based on ${target.type}.`,
        };
        const updated = [...messages, assistantMsg];
        setMessages(updated);
        LocalEngine.cacheSet(`sidekick:chat:${target.type}:${target.id}`, updated).catch(() => {});
      } else if (actionType === 'note') {
        const { createNote } = await import('@/lib/actions/client-ops');
        const noteTitle = promptText ? promptText.replace(/^draft\s+(a\s+)?(note|summary)\s*(for|on)?\s*/i, '').trim() : `Summary of ${target.title || target.type}`;
        const formattedTitle = noteTitle ? noteTitle.charAt(0).toUpperCase() + noteTitle.slice(1) : `Note: ${target.title || target.type}`;
        const newNote = await createNote({
          title: formattedTitle,
          content: `### Executive Note for ${target.title || target.type}\n\n**Source Object:** ${target.type} (${target.id})\n\n**Context:**\n${target.content || 'N/A'}`,
          tags: target.tags || ['sidekick', 'ai'],
          isPublic: false,
        });
        toast.success(`Note created: ${newNote.title}`);
        const assistantMsg: ChatMsg = {
          id: `a_${Date.now()}`,
          role: 'assistant',
          content: `💡 **Created Note:** **"${newNote.title}"**\n\nSaved to Ideas & Notes with relevant context from this ${target.type}.`,
        };
        const updated = [...messages, assistantMsg];
        setMessages(updated);
        LocalEngine.cacheSet(`sidekick:chat:${target.type}:${target.id}`, updated).catch(() => {});
      }
    } catch (e: any) {
      toast.error('Action failed: ' + (e?.message || 'Error'));
    } finally {
      setSending(false);
    }
  }, [target, messages]);

  const handleCopySummary = useCallback(() => {
    if (!result?.oneLiner && !target) return;
    const text = result?.oneLiner || `${target?.title || 'Object'}\n\n${target?.content || ''}`;
    navigator.clipboard.writeText(text);
    toast.success('Summary copied to clipboard');
  }, [result, target]);

  const handleOpenAttachDrawer = () => {
    openFileDrawer({
      title: 'Attach Object to Sidekick',
      initialTab: 'objects',
      disabledTabs: ['synced', 'upload'],
      onSelectFile: (file) => {
        if (pendingAttachments.length >= 10) {
          toast.error('Maximum 10 objects can be attached at once.');
          return;
        }
        if (pendingAttachments.some((a) => a.childId === file.$id)) {
          toast.error('Object already attached to message.');
          return;
        }
        const childKind = deriveChildKind(file.bucketId, file.mimeType);
        setPendingAttachments((prev) => [
          ...prev,
          { childId: file.$id, childKind, name: file.name, bucketId: file.bucketId },
        ]);
        toast.success(`Attached ${file.name}`);
      },
    });
  };

  const handleDetachSessionObject = async (childId: string) => {
    const currentSessionId = sessionId;
    if (!currentSessionId) return;
    try {
      const { detachObjectByRelation, getObjectsByParent } = await import('@/lib/actions/client-ops');
      await detachObjectByRelation({ parentId: currentSessionId, childId });
      const updated = await getObjectsByParent(currentSessionId, 'sidekick').catch(() => []);
      setAttachedSessionObjects(updated);
      const cacheKey = `sidekick:attachments:${currentSessionId}`;
      LocalEngine.cacheSet(cacheKey, updated).catch(() => {});
      if (target) {
        LocalEngine.cacheSet(`sidekick:attachments:${target.type}:${target.id}`, updated).catch(() => {});
      }
      toast.success('Object detached from session');
    } catch {
      toast.error('Failed to detach object');
    }
  };

  const handleSend = async () => {
    const trimmed = input.trim();
    if ((!trimmed && pendingAttachments.length === 0) || !target || sending) return;
    setSending(true);

    const attachmentsToProcess = [...pendingAttachments];
    setPendingAttachments([]);

    let promptWithAttachments = trimmed;
    if (attachmentsToProcess.length > 0) {
      const attachmentTexts = await Promise.all(
        attachmentsToProcess.map(async (att) => {
          const excerpt = await getRedactedObjectExcerpt(att.childId, att.childKind);
          return `[Attached: ${att.name} (${att.childKind}) - ID: ${att.childId}]${excerpt ? `\nContent: ${excerpt}` : ''}`;
        })
      );
      promptWithAttachments = trimmed ? `${trimmed}\n\n${attachmentTexts.join('\n\n')}` : attachmentTexts.join('\n\n');
    }

    const userMsg: ChatMsg = { id: `u_${Date.now()}`, role: 'user', content: promptWithAttachments };
    const next = [...messages, userMsg];
    setMessages(next);
    setInput('');
    if (draftKey) LocalEngine.cacheSet(draftKey, '').catch(()=>{});
    await LocalEngine.cacheSet(`sidekick:chat:${target.type}:${target.id}`, next).catch(()=>{});
    try {
      const { account } = await import('@/lib/appwrite/client');
      const jwt = await account.createJWT().then((r:any)=> r.jwt || '').catch(()=> undefined);
      const { executeSidekickChat } = await import('@/lib/actions/sidekick');
      const res: any = await executeSidekickChat({ target, message: promptWithAttachments, sessionId: sessionId || undefined, jwt }).catch((err: any) => ({
        success: false,
        error: getAgenticUserMessage(err),
      }));
      if (res?.error) {
        setError(res.error);
        toast.error(res.error);
        return;
      }
      const assistant: ChatMsg = {
        id: `a_${Date.now()}`,
        role: 'assistant',
        content: res?.response ? res.response : res?.result ? JSON.stringify(res.result) : 'Done.',
      };
      const updated = [...next, assistant];
      setMessages(updated);
      await LocalEngine.cacheSet(`sidekick:chat:${target.type}:${target.id}`, updated).catch(()=>{});

      const activeSid = res?.sessionId || sessionId;
      if (res?.sessionId && !sessionId) setSessionId(res.sessionId);

      // Persist attached objects to DB and local cache for sidekick session
      if (activeSid && attachmentsToProcess.length > 0) {
        try {
          const { attachObject, getObjectsByParent } = await import('@/lib/actions/client-ops');
          for (const att of attachmentsToProcess) {
            await attachObject({
              parentId: activeSid,
              parentKind: 'sidekick',
              childId: att.childId,
              childKind: att.childKind,
              metadata: { name: att.name, bucketId: att.bucketId },
            }).catch(() => {});
          }
          const updatedObjs = await getObjectsByParent(activeSid, 'sidekick').catch(() => []);
          setAttachedSessionObjects(updatedObjs);
          const cacheKey = `sidekick:attachments:${activeSid}`;
          LocalEngine.cacheSet(cacheKey, updatedObjs).catch(() => {});
          if (target) {
            LocalEngine.cacheSet(`sidekick:attachments:${target.type}:${target.id}`, updatedObjs).catch(() => {});
          }
        } catch (attachErr) {
          console.warn('Failed to persist session attachments:', attachErr);
        }
      }
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
      setError(getAgenticUserMessage(e));
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
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => setShowAttachedObjectsDrawer(true)}
            className="relative p-2 rounded-xl text-white/60 hover:text-white hover:bg-white/5 transition-colors cursor-pointer flex items-center justify-center"
            title="Attached Objects in this Sidekick Session"
          >
            <Paperclip size={18} />
            {attachedSessionObjects.length > 0 && (
              <span className="absolute -top-1 -right-1 min-w-[18px] h-4.5 px-1 rounded-full bg-[#A855F7] text-[10px] font-black text-white flex items-center justify-center">
                {attachedSessionObjects.length}
              </span>
            )}
          </button>
          <button onClick={onClose} className="p-2 rounded-xl text-white/40 hover:text-white hover:bg-white/5">
            <X size={18} />
          </button>
        </div>
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
            {/* Intelligent Contextual Actions */}
            <div className="rounded-2xl bg-[#161412] border border-white/5 p-4 flex flex-col gap-3">
              <div className="text-xs font-black uppercase tracking-wider text-purple-400 font-mono flex items-center justify-between">
                <div className="flex items-center gap-1.5">
                  <Sparkles size={14} />
                  <span>Contextual Intelligent Actions</span>
                </div>
                <span className="text-[10px] text-white/40 font-normal">Auto-tailored to this {target.type}</span>
              </div>

              {/* Dynamic Suggestions or AI Fallback Actions */}
              <div className="flex flex-col gap-2">
                {result?.suggestions?.length ? (
                  result.suggestions.map((s, idx) => {
                    const isGoal = /goal/i.test(s.label || s.prompt);
                    const isForm = /form/i.test(s.label || s.prompt);
                    const isNote = /note|summary|draft/i.test(s.label || s.prompt);

                    return (
                      <button
                        key={idx}
                        type="button"
                        onClick={() => {
                          if (isGoal) handleIntelligentAction('goal', s.prompt);
                          else if (isForm) handleIntelligentAction('form', s.prompt);
                          else if (isNote) handleIntelligentAction('note', s.prompt);
                          else {
                            setInput(s.prompt);
                            handleSend();
                          }
                        }}
                        className="p-3 rounded-xl bg-[#0A0908] border border-white/5 hover:border-[#A855F7]/40 hover:bg-[#A855F7]/10 transition-all text-left flex items-center justify-between cursor-pointer group"
                      >
                        <div className="flex items-center gap-2.5 min-w-0">
                          {isGoal ? (
                            <Target size={15} className="text-purple-400 shrink-0 group-hover:scale-110 transition-transform" />
                          ) : isForm ? (
                            <FormInput size={15} className="text-indigo-400 shrink-0 group-hover:scale-110 transition-transform" />
                          ) : isNote ? (
                            <FileText size={15} className="text-emerald-400 shrink-0 group-hover:scale-110 transition-transform" />
                          ) : (
                            <Sparkles size={15} className="text-amber-400 shrink-0 group-hover:scale-110 transition-transform" />
                          )}
                          <div className="min-w-0">
                            <p className="text-xs font-bold text-white group-hover:text-[#E9D5FF] truncate">{s.label}</p>
                            <p className="text-[10px] text-white/40 truncate mt-0.5">{s.prompt}</p>
                          </div>
                        </div>
                        <span className="text-[10px] font-mono font-bold px-2 py-0.5 rounded bg-white/5 text-white/60 group-hover:bg-[#A855F7]/20 group-hover:text-white shrink-0 ml-2">
                          Run
                        </span>
                      </button>
                    );
                  })
                ) : (
                  <div className="grid grid-cols-2 gap-2">
                    <button
                      type="button"
                      onClick={() => handleIntelligentAction('goal')}
                      className="p-2.5 rounded-xl bg-[#0A0908] border border-white/5 hover:border-purple-500/30 hover:bg-purple-500/5 transition-all text-left flex items-center gap-2 cursor-pointer group"
                    >
                      <Target size={15} className="text-purple-400 shrink-0 group-hover:scale-110 transition-transform" />
                      <span className="text-xs font-bold text-white/80 group-hover:text-white">Create Goal for {target.type}</span>
                    </button>

                    <button
                      type="button"
                      onClick={() => handleIntelligentAction('form')}
                      className="p-2.5 rounded-xl bg-[#0A0908] border border-white/5 hover:border-indigo-500/30 hover:bg-indigo-500/5 transition-all text-left flex items-center gap-2 cursor-pointer group"
                    >
                      <FormInput size={15} className="text-indigo-400 shrink-0 group-hover:scale-110 transition-transform" />
                      <span className="text-xs font-bold text-white/80 group-hover:text-white">Create Tailored Form</span>
                    </button>

                    <button
                      type="button"
                      onClick={() => handleIntelligentAction('note')}
                      className="p-2.5 rounded-xl bg-[#0A0908] border border-white/5 hover:border-emerald-500/30 hover:bg-emerald-500/5 transition-all text-left flex items-center gap-2 cursor-pointer group"
                    >
                      <FileText size={15} className="text-emerald-400 shrink-0 group-hover:scale-110 transition-transform" />
                      <span className="text-xs font-bold text-white/80 group-hover:text-white">Draft Summary Note</span>
                    </button>

                    <button
                      type="button"
                      onClick={handleCopySummary}
                      className="p-2.5 rounded-xl bg-[#0A0908] border border-white/5 hover:border-amber-500/30 hover:bg-amber-500/5 transition-all text-left flex items-center gap-2 cursor-pointer group"
                    >
                      <Copy size={15} className="text-amber-400 shrink-0 group-hover:scale-110 transition-transform" />
                      <span className="text-xs font-bold text-white/80 group-hover:text-white">Copy Summary</span>
                    </button>
                  </div>
                )}
              </div>
            </div>

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
                {result.nextSteps?.length ? (
                  <div className="rounded-2xl bg-[#161412] border border-white/5 p-4 flex flex-col gap-2">
                    <div className="text-xs font-black uppercase tracking-wider text-white">Suggested Next Steps</div>
                    <div className="flex flex-wrap gap-2">
                      {result.nextSteps.slice(0, 6).map((s, idx) => (
                        <button key={idx} onClick={() => setInput(s.prompt)} className="px-3 py-1.5 rounded-full bg-[#A855F7]/10 border border-[#A855F7]/20 text-xs font-bold text-[#E9D5FF] hover:bg-[#A855F7]/15 hover:border-[#A855F7]/30 transition-colors">
                          {s.label}
                        </button>
                      ))}
                    </div>
                  </div>
                ) : null}
              </>
            )}

            {/* Chat history — conversation panel */}
            {messages.length > 0 && (
              <div className="flex flex-col gap-3">
                <div className="text-[11px] font-black tracking-widest text-white/30 uppercase">Conversation</div>
                {messages.map((m) => (
                  <div key={m.id} className={`max-w-[88%] rounded-2xl px-4 py-3 text-[13px] leading-relaxed ${m.role === 'user' ? 'bg-[#A855F7] text-white self-end' : 'bg-[#161412] border border-white/5 text-[#D6D1CA] self-start'}`}>
                    {renderMessageContent(m.content)}
                  </div>
                ))}
              </div>
            )}
          </>
        )}
      </div>

      {/* Chat bar — plugged into LocalEngine with pending attachment pills */}
      <div className="p-4 border-t border-white/5 bg-[#0A0908] shrink-0 flex flex-col gap-2">
        {/* Pending attachment pills directly above input bar */}
        {pendingAttachments.length > 0 && (
          <div className="flex items-center gap-2 overflow-x-auto pb-1 custom-scrollbar">
            {pendingAttachments.map((att) => (
              <div
                key={att.childId}
                className="flex items-center gap-1.5 px-2.5 py-1 rounded-xl bg-[#161412] border border-[#A855F7]/30 text-xs text-white shrink-0 shadow-sm"
              >
                {renderKindIcon(att.childKind)}
                <span className="truncate max-w-[120px] text-[11px] font-semibold">{att.name}</span>
                <button
                  type="button"
                  onClick={() => setPendingAttachments((prev) => prev.filter((p) => p.childId !== att.childId))}
                  className="p-0.5 rounded hover:bg-white/10 text-white/40 hover:text-white ml-0.5 cursor-pointer"
                  title="Remove attachment"
                >
                  <X size={12} />
                </button>
              </div>
            ))}
          </div>
        )}

        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={handleOpenAttachDrawer}
            className="p-3 rounded-xl bg-[#161412] border border-white/5 text-white/60 hover:text-[#A855F7] hover:border-[#A855F7]/30 transition-colors flex items-center justify-center cursor-pointer shrink-0"
            title="Attach Object"
          >
            <Paperclip size={18} />
          </button>
          <input
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter' && !e.shiftKey) {
                e.preventDefault();
                handleSend();
              }
            }}
            placeholder={target ? `Ask Sidekick about ${target.title || target.type}…` : 'Ask Sidekick…'}
            className="flex-1 bg-[#161412] border border-white/5 rounded-xl px-4 py-3 text-sm text-white placeholder:text-white/20 focus:outline-none focus:border-[#A855F7]/30 min-w-0"
          />
          <button
            onClick={handleSend}
            disabled={sending || (!input.trim() && pendingAttachments.length === 0)}
            className="px-4 py-3 rounded-xl bg-[#A855F7] hover:bg-[#9333EA] disabled:opacity-40 text-white font-black flex items-center justify-center shrink-0 cursor-pointer"
          >
            <Send size={16} />
          </button>
        </div>
      </div>

      {/* Session Attached Objects Bottom Drawer */}
      {showAttachedObjectsDrawer && (
        <Drawer
          anchor="bottom"
          open={showAttachedObjectsDrawer}
          onClose={() => setShowAttachedObjectsDrawer(false)}
          PaperProps={{
            sx: {
              bgcolor: '#161412',
              borderTop: '1px solid rgba(255,255,255,0.1)',
              borderTopLeftRadius: '24px',
              borderTopRightRadius: '24px',
              p: 3,
              maxWidth: '600px',
              mx: 'auto',
              maxHeight: '60dvh',
              overflowY: 'auto',
            },
          }}
          ModalProps={{ keepMounted: false, disablePortal: true, sx: { zIndex: 1500 } }}
        >
          <div className="flex flex-col gap-4">
            <div className="flex items-center justify-between border-b border-white/10 pb-3">
              <div className="flex items-center gap-2">
                <Paperclip size={18} className="text-[#A855F7]" />
                <h4 className="font-clash font-extrabold text-base text-white">
                  Attached Objects ({attachedSessionObjects.length})
                </h4>
              </div>
              <button
                onClick={() => setShowAttachedObjectsDrawer(false)}
                className="p-1.5 rounded-lg text-white/40 hover:text-white hover:bg-white/5"
              >
                <X size={16} />
              </button>
            </div>

            {attachedSessionObjects.length === 0 ? (
              <div className="py-8 text-center text-xs text-white/40">
                No objects attached to this Sidekick session yet.
              </div>
            ) : (
              <div className="flex flex-col gap-2">
                {attachedSessionObjects.map((obj, idx) => {
                  const meta = typeof obj.metadata === 'string' ? JSON.parse(obj.metadata || '{}') : obj.metadata || {};
                  const titleText = meta.name || meta.label || obj.childId;
                  const kind = obj.childKind || 'object';

                  return (
                    <div
                      key={obj.$id || obj.childId || idx}
                      className="flex items-center justify-between p-3 rounded-2xl bg-[#0A0908] border border-white/5"
                    >
                      <div className="flex items-center gap-3 min-w-0">
                        <div className="p-2 rounded-xl bg-[#161412] border border-white/5">
                          {renderKindIcon(kind)}
                        </div>
                        <div className="min-w-0">
                          <p className="text-xs font-bold text-white truncate">{titleText}</p>
                          <p className="text-[10px] font-mono text-white/40 uppercase mt-0.5">
                            {kind} • ID: {obj.childId?.slice(0, 12)}
                          </p>
                        </div>
                      </div>
                      <button
                        type="button"
                        onClick={() => handleDetachSessionObject(obj.childId)}
                        className="p-2 rounded-xl bg-red-500/10 border border-red-500/20 text-red-400 hover:bg-red-500/20 transition-colors cursor-pointer shrink-0 ml-2"
                        title="Detach object"
                      >
                        <Trash2 size={14} />
                      </button>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </Drawer>
      )}
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
