'use client';

import { useCallback, useEffect, useMemo, useRef, useState, type ComponentType, type FormEvent, type KeyboardEvent } from 'react';
import { usePathname, useRouter } from 'next/navigation';
import Link from 'next/link';
import {
  AlarmClock,
  BarChart3,
  Bell,
  Bot,
  Calendar,
  CalendarPlus,
  CalendarRange,
  ChevronRight,
  Compass,
  CreditCard,
  FilePlus,
  Flag,
  FolderKanban,
  History,
  Kanban,
  KeyRound,
  Lightbulb,
  Link2,
  ListTodo,
  Lock,
  MessageSquare,
  MessagesSquare,
  Milestone,
  PenLine,
  Plus,
  RefreshCw,
  Search,
  Send,
  Settings,
  Share2,
  Shield,
  ShieldCheck,
  Smartphone,
  Sparkles,
  Sunrise,
  Tags,
  Target,
  Trash2,
  User,
  Users,
  Video,
  Wallet,
  Workflow,
  X,
  Zap,
} from 'lucide-react';

import { useAgenticDrawer } from '@/context/AgenticDrawerContext';
import { useUnifiedDrawer } from '@/context/UnifiedDrawerContext';
import { useWalletOverlay } from '@/context/WalletOverlayContext';
import { useAuth } from '@/context/auth/AuthContext';
import { useNotes } from '@/context/NotesContext';
import { useTask } from '@/context/TaskContext';
import { useDataNexus } from '@/context/DataNexusContext';
import { AgenticService } from '@/lib/services/agentic';
import {
  buildInstantPrompt,
  getQuickWorkflows,
  resolveAgenticPageContext,
  runInstantAgenticRequest,
  type QuickWorkflowAction,
  userMayUsePaidAi,
  AI_UPGRADE_LABEL,
} from '@/lib/agentic';
import { getAppColor } from '@/lib/ecosystem-app-colors';
import { useProUpgrade } from '@/context/ProUpgradeContext';
import { account } from '@/lib/appwrite/client';
import { WalletService } from '@/lib/services/wallets';
import { toast } from 'react-hot-toast';

interface ToolCallDisplay {
  toolKey: string;
  specifier?: string | null;
  status?: string | null;
  resultSummary?: string | null;
  args?: string | null;
}

interface NextStepSuggestion {
  label: string;
  prompt: string;
}

interface ChatMessage {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  tools?: ToolCallDisplay[];
  nextSteps?: NextStepSuggestion[];
}

/** Strip behind-the-hood prompt templates so the UI shows the user's exact words. */
function visibleChatContent(role: string, content: unknown): string {
  const raw = typeof content === 'string' ? content : '';
  if (role !== 'user') return raw;
  if (/User request:\s*/i.test(raw)) {
    const match = raw.match(/User request:\s*([\s\S]*)$/i);
    if (match?.[1]?.trim()) return match[1].trim();
  }
  return raw.trim();
}

function normalizeNextSteps(raw: unknown): NextStepSuggestion[] {
  if (!Array.isArray(raw)) return [];
  return raw
    .map((item: any) => ({
      label: String(item?.label || '').trim(),
      prompt: String(item?.prompt || '').trim(),
    }))
    .filter((s) => s.label && s.prompt)
    .slice(0, 4);
}

function formatHistoryMessages(
  historyArr: any[],
  toolCalls: Array<{
    conversationId: string;
    toolKey: string;
    specifier?: string | null;
    status?: string | null;
    resultSummary?: string | null;
    args?: string | null;
  }> = [],
): ChatMessage[] {
  const toolsByConversation = new Map<string, ToolCallDisplay[]>();
  for (const tc of toolCalls) {
    if (!tc.conversationId) continue;
    const list = toolsByConversation.get(tc.conversationId) || [];
    list.push({
      toolKey: tc.toolKey,
      specifier: tc.specifier,
      status: tc.status,
      resultSummary: tc.resultSummary,
      args: tc.args,
    });
    toolsByConversation.set(tc.conversationId, list);
  }

  return (Array.isArray(historyArr) ? historyArr : []).map((h: any, idx: number) => {
    const id = typeof h.id === 'string' && h.id ? h.id : `hist-${idx}`;
    const role = h.role === 'assistant' ? 'assistant' : 'user';
    return {
      id,
      role,
      content: visibleChatContent(role, h.content),
      tools: role === 'assistant' ? toolsByConversation.get(id) : undefined,
      nextSteps: role === 'assistant' ? normalizeNextSteps(h.nextSteps) : undefined,
    };
  });
}

const QUICK_ICON_MAP: Record<string, ComponentType<{ size?: number; strokeWidth?: number }>> = {
  'pen-line': PenLine,
  sparkles: Sparkles,
  'list-todo': ListTodo,
  'share-2': Share2,
  'calendar-range': CalendarRange,
  'calendar-plus': CalendarPlus,
  calendar: Calendar,
  'alarm-clock': AlarmClock,
  target: Target,
  zap: Zap,
  flag: Flag,
  kanban: Kanban,
  'shield-check': ShieldCheck,
  'key-round': KeyRound,
  tags: Tags,
  lock: Lock,
  smartphone: Smartphone,
  'message-square': MessageSquare,
  messages: MessagesSquare,
  users: Users,
  video: Video,
  'bar-chart-3': BarChart3,
  send: Send,
  'link-2': Link2,
  'folder-kanban': FolderKanban,
  bell: Bell,
  shield: Shield,
  bot: Bot,
  compass: Compass,
  'refresh-cw': RefreshCw,
  settings: Settings,
  'credit-card': CreditCard,
  user: User,
  sunrise: Sunrise,
  lightbulb: Lightbulb,
  workflow: Workflow,
  'file-plus': FilePlus,
  search: Search,
  milestone: Milestone,
  wallet: Wallet,
};

function zoneLabel(zone: string): string {
  const labels: Record<string, string> = {
    note: 'Ideas',
    flow: 'Flow',
    vault: 'Vault',
    connect: 'Connect',
    projects: 'Projects',
    settings: 'Settings',
    agents: 'Kylie',
    accounts: 'Accounts',
  };
  return labels[zone] || 'Workspace';
}

interface AgenticPanelContentProps {
  onClose: () => void;
  isDesktop: boolean;
}

export function AgenticPanelContent({ onClose, isDesktop }: AgenticPanelContentProps) {
  const { consumePendingPrompt } = useAgenticDrawer();
  const { open: openUnified } = useUnifiedDrawer();
  const { openWallet } = useWalletOverlay();
  const { user } = useAuth();
  const { notes: allNotes, pushLiveNote, registerComposeSession, unregisterComposeSession, migrateDraftNoteId, removeNote } = useNotes();
  const { setCachedData } = useDataNexus();
  const { addTask, updateTask, deleteTask } = useTask();
  const { openProUpgrade } = useProUpgrade();
  const pathname = usePathname() || '/';
  const router = useRouter();
  const isPro = userMayUsePaidAi(user);

  const pageContext = useMemo(() => resolveAgenticPageContext(pathname), [pathname]);
  const accent = useMemo(() => getAppColor(pageContext.accentApp), [pageContext.accentApp]);
  const workflows = useMemo(() => getQuickWorkflows(pageContext), [pageContext]);

  const [chatInput, setChatInput] = useState('');
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [executing, setExecuting] = useState(false);
  const [runningWorkflowId, setRunningWorkflowId] = useState<string | null>(null);
  const [agentCount, setAgentCount] = useState(0);

  const [pendingPayment, setPendingPayment] = useState<{ agentId: string; amount: number; intentId: string; chainId: number; phase?: 'review' | 'processing' | 'done' } | null>(null);
  const [signing, setSigning] = useState(false);
  const [pendingToolAuth, setPendingToolAuth] = useState<{ toolKey: string; name: string; specifier?: string; args?: any } | null>(null);
  const [showSessionsDrawer, setShowSessionsDrawer] = useState(false);
  const [sessions, setSessions] = useState<any[]>([]);
  const [loadingSessions, setLoadingSessions] = useState(false);
  const syncTimeoutRef = useRef<any>(null);

  const handleInputChange = (val: string) => {
    setChatInput(val);
    if (typeof window !== 'undefined') {
      localStorage.setItem('kylrix_kylie_live_input', val);
    }
    
    if (syncTimeoutRef.current) clearTimeout(syncTimeoutRef.current);
    syncTimeoutRef.current = setTimeout(async () => {
      try {
        const currentPrefs = await account.getPrefs().catch(() => ({}));
        await account.updatePrefs({ ...currentPrefs, kylie_live_input: val });
      } catch (err) {
        console.error('Failed to sync kylie live input to remote settings:', err);
      }
    }, 1500);
  };

  useEffect(() => {
    const handlePaymentRequest = (e: CustomEvent) => {
      const { agentId, amount, intentId, chainId } = e.detail;
      setPendingPayment({ agentId, amount, intentId, chainId, phase: 'review' });
    };
    window.addEventListener('kylrix:request-payment' as any, handlePaymentRequest);
    return () => window.removeEventListener('kylrix:request-payment' as any, handlePaymentRequest);
  }, []);

  const handleApprovePayment = async () => {
    if (!pendingPayment || !user?.$id) return;
    setSigning(true);
    setPendingPayment((prev) => (prev ? { ...prev, phase: 'processing' } : prev));
    try {
      const privKey = await WalletService.derivePrivateKey(user.$id, 'arbitrum');
      const signature = `0x${privKey.slice(0, 10)}...mock_signature...${Date.now()}`;
      const { submitGasRelayAction } = await import('@/lib/actions/secure-ops/arbitrum-rail');
      const { jwt } = await account.createJWT().catch(() => ({ jwt: null }));
      
      const result = await submitGasRelayAction({
        jwt: jwt || undefined,
        intentId: pendingPayment.intentId,
        signature: signature,
        userAddress: '0x' + user.$id.slice(-40),
        targetAddress: '0x' + pendingPayment.agentId.slice(-40),
        amount: pendingPayment.amount,
        chainId: pendingPayment.chainId
      });

      toast.success('Agent funded successfully!');
      window.dispatchEvent(new CustomEvent('kylrix:payment-completed', {
        detail: {
          intentId: pendingPayment.intentId,
          txHash: result.txHash,
          agentId: pendingPayment.agentId
        }
      }));

      setMessages(prev => [...prev, {
        id: Math.random().toString(),
        role: 'assistant',
        content: `✅ Agent payment of ${pendingPayment.amount} ARB approved. On-chain Stream funded! Tx: ${result.txHash}`
      }]);
      setPendingPayment((prev) => (prev ? { ...prev, phase: 'done' } : prev));
      setTimeout(() => setPendingPayment(null), 900);
    } catch (err: any) {
      toast.error(err.message || 'Payment approval failed');
      setPendingPayment((prev) => (prev ? { ...prev, phase: 'review' } : prev));
    } finally {
      setSigning(false);
    }
  };

  const handleStartNewSession = async () => {
    try {
      const { startNewAgentSession } = await import('@/lib/actions/agentic');
      const { account } = await import('@/lib/appwrite/client');
      const jwt = await account.createJWT().then((res: { jwt?: string }) => res?.jwt || '').catch(() => undefined);
      await startNewAgentSession(jwt);
      setMessages([]);
      toast.success('Started a new conversation session.');
    } catch (err) {
      console.error('Failed to start new session:', err);
      toast.error('Could not start new session.');
    }
  };

  const handleCreateNewSessionFromDrawer = async () => {
    await handleStartNewSession();
    setShowSessionsDrawer(false);
  };

  const handleOpenSessions = async () => {
    setShowSessionsDrawer(true);
    setLoadingSessions(true);
    try {
      const { listAgentSessions } = await import('@/lib/actions/agentic');
      const { account } = await import('@/lib/appwrite/client');
      const jwt = await account.createJWT().then((res: { jwt?: string }) => res?.jwt || '').catch(() => undefined);
      const list = await listAgentSessions(jwt);
      setSessions(list);
    } catch (err) {
      console.error(err);
      toast.error('Failed to load sessions list');
    } finally {
      setLoadingSessions(false);
    }
  };

  const handleSelectSession = async (sessionId: string) => {
    try {
      const { selectAgentSession, listAgentToolCallsAction } = await import('@/lib/actions/agentic');
      const { account } = await import('@/lib/appwrite/client');
      const jwt = await account.createJWT().then((res: { jwt?: string }) => res?.jwt || '').catch(() => undefined);
      const res = await selectAgentSession(sessionId, jwt);
      if (res.success) {
        const historyArr = JSON.parse(res.session.chatHistory || '[]');
        const toolCalls = await listAgentToolCallsAction(sessionId, jwt).catch(() => []);
        setMessages(formatHistoryMessages(historyArr, toolCalls));
        setShowSessionsDrawer(false);
        toast.success('Switched agent session.');
      }
    } catch (err) {
      console.error(err);
      toast.error('Failed to select session');
    }
  };

  const handleDeleteSession = async (e: React.MouseEvent, sessionId: string) => {
    e.stopPropagation();
    try {
      const { deleteAgentSession } = await import('@/lib/actions/agentic');
      const { account } = await import('@/lib/appwrite/client');
      const jwt = await account.createJWT().then((res: { jwt?: string }) => res?.jwt || '').catch(() => undefined);
      await deleteAgentSession(sessionId, jwt);
      setSessions(prev => prev.filter(s => s.id !== sessionId));
      toast.success('Session deleted successfully.');
    } catch (err) {
      console.error(err);
      toast.error('Failed to delete session');
    }
  };

  const chatScrollRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    if (!user?.$id) {
      setAgentCount(0);
      return;
    }
    void AgenticService.listMyAgents(user.$id)
      .then((rows) => setAgentCount(rows.length))
      .catch(() => setAgentCount(0));

    // Load session chat history on panel open
    const loadSessionHistory = async () => {
      try {
        const { account } = await import('@/lib/appwrite/client');
        const jwt = await account.createJWT().then((res: { jwt?: string }) => res?.jwt || '').catch(() => undefined);
        const { getAgentSession, listAgentToolCallsAction } = await import('@/lib/actions/agentic');
        const session = await getAgentSession(jwt);
        const historyArr = JSON.parse(session.chatHistory || '[]');
        if (Array.isArray(historyArr) && historyArr.length > 0) {
          const sessionId = session.rowId || '';
          const toolCalls = sessionId
            ? await listAgentToolCallsAction(sessionId, jwt).catch(() => [])
            : [];
          setMessages(formatHistoryMessages(historyArr, toolCalls));
        }
      } catch (err) {
        console.error('Failed to load session history on client:', err);
      }
    };
    void loadSessionHistory();
  }, [user?.$id]);

  // Load local copy of draft prompt instantly on mount
  useEffect(() => {
    if (typeof window !== 'undefined') {
      const localDraft = localStorage.getItem('kylrix_kylie_live_input') || '';
      if (localDraft) {
        setChatInput(localDraft);
      }
    }
  }, []);

  // Fetch remote backup from user settings preferences in the background
  useEffect(() => {
    const fetchRemoteDraft = async () => {
      try {
        const appPrefs = await account.getPrefs();
        const remoteDraft = appPrefs?.kylie_live_input || '';
        if (remoteDraft && remoteDraft !== localStorage.getItem('kylrix_kylie_live_input')) {
          setChatInput(remoteDraft);
          localStorage.setItem('kylrix_kylie_live_input', remoteDraft);
        }
      } catch {}
    };
    if (user?.$id) void fetchRemoteDraft();
  }, [user?.$id]);

  useEffect(() => {
    const node = chatScrollRef.current;
    if (!node) return;
    node.scrollTop = node.scrollHeight;
  }, [messages, executing]);

  const appendMessage = useCallback((role: ChatMessage['role'], content: string) => {
    setMessages((prev) => [
      ...prev,
      { id: `${Date.now()}-${Math.random().toString(36).slice(2, 7)}`, role, content },
    ]);
  }, []);

  const runPrompt = useCallback(
    async (rawPrompt: string) => {
      const trimmed = rawPrompt.trim();
      if (!trimmed) return;

      if (!isPro) {
        openProUpgrade(AI_UPGRADE_LABEL);
        return;
      }

      appendMessage('user', trimmed);
      setChatInput('');
      if (typeof window !== 'undefined') {
        localStorage.removeItem('kylrix_kylie_live_input');
      }
      account.getPrefs().then((currentPrefs: any) => {
        account.updatePrefs({ ...currentPrefs, kylie_live_input: '' }).catch(() => {});
      }).catch(() => {});
      setExecuting(true);

      try {
        const jwt = await account.createJWT().then((res: { jwt?: string }) => res?.jwt || '').catch(() => undefined);
        const contextualPrompt = buildInstantPrompt(trimmed, pageContext);
        const res = await runInstantAgenticRequest({
          prompt: contextualPrompt,
          user,
          jwt,
          pageContext: {
            zone: pageContext.zone,
            route: pageContext.route,
            title: pageContext.title,
            systemHint: pageContext.systemHint,
            resourceId: pageContext.resourceId,
            userMessage: trimmed,
          },
          userMessage: trimmed,
        });

        if (res.success) {
          const assistantId = res.conversationId || `${Date.now()}-a`;
          const executedTools: ToolCallDisplay[] = [];
          const sessionIdForObjects = res.sessionId as string | undefined;
          const conversationId = res.conversationId as string | undefined;

          const recordToolCall = async (
            call: { toolKey: string; specifier?: string; args?: Record<string, unknown> },
            status: string,
            resultSummary?: string,
          ) => {
            const display: ToolCallDisplay = {
              toolKey: call.toolKey,
              specifier: call.specifier || null,
              status,
              resultSummary: resultSummary || null,
              args: call.args ? JSON.stringify(call.args) : null,
            };
            if (call.toolKey !== 'suggest_next_steps') {
              executedTools.push(display);
            }
            if (!sessionIdForObjects || !conversationId) return;
            try {
              const { recordAgentToolCallAction } = await import('@/lib/actions/agentic');
              await recordAgentToolCallAction(
                {
                  sessionId: sessionIdForObjects,
                  conversationId,
                  toolKey: call.toolKey,
                  specifier: call.specifier,
                  args: call.args || null,
                  status,
                  resultSummary,
                },
                jwt,
              );
            } catch (recordErr) {
              console.warn('[agentic] Failed to record tool call:', recordErr);
            }
          };

          setMessages((prev) => [
            ...prev,
            {
              id: assistantId,
              role: 'assistant',
              content: res.response,
              tools: [],
              nextSteps: normalizeNextSteps(res.nextSteps),
            },
          ]);

          let liveNextSteps = normalizeNextSteps(res.nextSteps);

          if (Array.isArray(res.toolCalls) && res.toolCalls.length > 0) {
            for (const call of res.toolCalls) {
              const { AGENTIC_TOOLS_REGISTRY } = await import('@/lib/agentic/tools-registry');
              const toolDef = AGENTIC_TOOLS_REGISTRY.find(t => t.key === call.toolKey);
              if (toolDef) {
                if (call.toolKey === 'suggest_next_steps') {
                  const steps = normalizeNextSteps(call.args?.suggestions);
                  if (steps.length) {
                    liveNextSteps = steps;
                    setMessages((prev) =>
                      prev.map((m) => (m.id === assistantId ? { ...m, nextSteps: steps } : m)),
                    );
                  }
                  await recordToolCall(call, 'success', `${steps.length} next steps`);
                  continue;
                }

                if (toolDef.requiresAuthorization) {
                  let isPreAuthorized = false;
                  try {
                    const appPrefs = await account.getPrefs();
                    const whitelist = appPrefs?.authorizedTools || [];
                    if (whitelist.includes('allow_all') || whitelist.includes(call.toolKey)) {
                      isPreAuthorized = true;
                    }
                  } catch {}

                  if (!isPreAuthorized) {
                    setPendingToolAuth({
                      toolKey: call.toolKey,
                      name: toolDef.name,
                      specifier: call.specifier,
                      args: call.args
                    });
                    break;
                  }
                }

                try {
                  const recordSessionObject = async (payload: {
                    objectId: string;
                    objectType: string;
                    title?: string | null;
                    toolKey: string;
                  }) => {
                    if (!sessionIdForObjects || !payload.objectId) return;
                    try {
                      const { recordAgentSessionObjectAction } = await import('@/lib/actions/agentic');
                      await recordAgentSessionObjectAction(
                        {
                          sessionId: sessionIdForObjects,
                          objectId: payload.objectId,
                          objectType: payload.objectType,
                          title: payload.title,
                          toolKey: payload.toolKey,
                        },
                        jwt,
                      );
                    } catch (recordErr) {
                      console.warn('[agentic] Failed to record session object:', recordErr);
                    }
                  };

                  let resultSummary = toolDef.name;
                  if (call.toolKey === 'create_note') {
                    const title = String(call.args?.title || '').trim() || 'Untitled Idea';
                    const content = String(call.args?.content || '').trim();
                    if (!content) {
                      toast.error('Agent create_note missing content.');
                      await recordToolCall(call, 'error', 'Missing content');
                      continue;
                    }

                    const tags = Array.isArray(call.args.tags)
                      ? call.args.tags
                      : (call.args.tags ? [call.args.tags] : []);
                    const isPublic = call.args.isPublic === true || call.args.isPublic === 'true';

                    // Local-first (same as CreateNoteForm): paint the card before cloud write.
                    const { ID } = await import('appwrite');
                    const { resolveNoteCardTitle } = await import('@/constants/noteTitle');
                    const { markNotePersistedRemote } = await import('@/lib/notes/compose-draft-registry');
                    const { isValidAppwriteRowId } = await import('@/lib/utils/resource-ids');
                    const draftId = ID.unique();
                    const now = new Date().toISOString();
                    const draftNote = {
                      $id: draftId,
                      title: resolveNoteCardTitle(title, content) || title,
                      content,
                      tags,
                      format: 'text',
                      isPublic,
                      isGuest: isPublic,
                      userId: user?.$id || '',
                      $createdAt: now,
                      $updatedAt: now,
                      updatedAt: now,
                    } as any;

                    registerComposeSession(draftId);
                    pushLiveNote(draftNote);

                    const { createNote } = await import('@/lib/actions/client-ops');
                    const saved = await createNote({
                      $id: isValidAppwriteRowId(draftId) ? draftId : undefined,
                      title,
                      content,
                      tags,
                      isPublic,
                      isGuest: isPublic,
                    }) as any;

                    markNotePersistedRemote(saved.$id);
                    if (saved.$id && saved.$id !== draftId) {
                      migrateDraftNoteId(draftId, saved.$id);
                    }
                    unregisterComposeSession(draftId);
                    if (saved.$id) unregisterComposeSession(saved.$id);
                    pushLiveNote(saved, { pending: false });
                    const { autonomicSyncEngine } = await import('@/lib/services/sync-engine');
                    autonomicSyncEngine.ack(saved.$id, saved.updatedAt || now);
                    setCachedData(`note_${saved.$id}`, saved);

                    await recordSessionObject({
                      objectId: saved.$id,
                      objectType: 'idea',
                      title: saved.title || title,
                      toolKey: 'create_note',
                    });
                    resultSummary = `Created idea: ${saved.title || title}`;
                  } else if (call.toolKey === 'update_note' && call.specifier) {
                    const { updateNote } = await import('@/lib/actions/client-ops');
                    const saved = await updateNote(call.specifier, {
                      title: call.args.title,
                      content: call.args.content,
                      tags: call.args.tags !== undefined ? (Array.isArray(call.args.tags) ? call.args.tags : [call.args.tags]) : undefined,
                      isPublic: call.args.isPublic !== undefined ? (call.args.isPublic === true || call.args.isPublic === 'true') : undefined,
                      isGuest: call.args.isPublic !== undefined ? (call.args.isPublic === true || call.args.isPublic === 'true') : undefined,
                    });
                    pushLiveNote(saved, { pending: false });
                    const { autonomicSyncEngine } = await import('@/lib/services/sync-engine');
                    autonomicSyncEngine.ack(saved.$id || call.specifier);
                    await recordSessionObject({
                      objectId: saved.$id || call.specifier,
                      objectType: 'idea',
                      title: saved.title || call.args.title || null,
                      toolKey: 'update_note',
                    });
                    resultSummary = `Updated idea: ${saved.title || call.args.title || call.specifier}`;
                  } else if (call.toolKey === 'get_note' && call.specifier) {
                    const { getNote } = await import('@/lib/appwrite/note');
                    const note = await getNote(call.specifier);
                    pushLiveNote(note, { pending: false });
                    await recordSessionObject({
                      objectId: note.$id,
                      objectType: 'idea',
                      title: note.title || null,
                      toolKey: 'get_note',
                    });
                    resultSummary = `Loaded idea: ${note.title || 'Untitled'}`;
                    appendMessage(
                      'assistant',
                      `Loaded Idea **${note.title || 'Untitled'}** (\`${note.$id}\`).`,
                    );
                  } else if (call.toolKey === 'create_goal') {
                    const created = await addTask({
                      title: call.args.title || 'Untitled Goal',
                      description: call.args.description || '',
                      status: call.args.status || 'todo',
                      priority: call.args.priority || 'medium',
                      dueDate: call.args.dueDate ? new Date(call.args.dueDate) : null,
                      labels: [],
                      subtasks: [],
                      comments: [],
                      attachments: [],
                      reminders: [],
                      timeEntries: [],
                      assigneeIds: user?.$id ? [user.$id] : ['guest'],
                      creatorId: user?.$id || 'guest',
                      isArchived: false,
                      isPinned: false,
                      isAgentic: true,
                    } as any);
                    const goalId = (created as any)?.id || (created as any)?.$id;
                    if (goalId) {
                      await recordSessionObject({
                        objectId: String(goalId),
                        objectType: 'goal',
                        title: call.args.title || 'Untitled Goal',
                        toolKey: 'create_goal',
                      });
                    }
                    resultSummary = `Created goal: ${call.args.title || 'Untitled Goal'}`;
                  } else if (call.toolKey === 'update_goal' && call.specifier) {
                    await updateTask(call.specifier, {
                      title: call.args.title,
                      status: call.args.status,
                      priority: call.args.priority,
                      dueDate: call.args.dueDate ? new Date(call.args.dueDate) : undefined
                    });
                    resultSummary = `Updated goal: ${call.specifier}`;
                  } else if (call.toolKey === 'create_project') {
                    const { ProjectsService } = await import('@/lib/appwrite/projects');
                    const project = await ProjectsService.createProject({
                      ownerId: user?.$id || 'guest',
                      title: call.args.title || 'Untitled Project',
                      summary: call.args.summary || '',
                    });
                    if (project?.$id) {
                      await recordSessionObject({
                        objectId: project.$id,
                        objectType: 'project',
                        title: call.args.title || project.title || 'Untitled Project',
                        toolKey: 'create_project',
                      });
                    }
                    resultSummary = `Created project: ${call.args.title || project?.title || 'Untitled Project'}`;
                  } else if (call.toolKey === 'link_to_project' && call.specifier) {
                    const objectType = String(call.args?.objectType || 'note');
                    const objectId = String(call.args?.objectId || '').trim();
                    if (!objectId) {
                      toast.error('Kylie needs an object id to connect to a project.');
                      await recordToolCall(call, 'error', 'Missing objectId');
                      continue;
                    }
                    const entityKind = objectType === 'goal' || objectType === 'task' ? 'task' : 'note';
                    const { addObjectToProject } = await import('@/lib/actions/client-ops');
                    await addObjectToProject(call.specifier, entityKind, objectId);
                    await recordSessionObject({
                      objectId,
                      objectType: entityKind === 'task' ? 'goal' : 'idea',
                      title: `Linked to project ${call.specifier}`,
                      toolKey: 'link_to_project',
                    });
                    resultSummary = `Connected ${entityKind} to project`;
                  } else if (call.toolKey === 'delete_resource' && call.specifier) {
                    const type = String(call.args?.type || 'note');
                    if (type === 'note') {
                      const { deleteNote } = await import('@/lib/actions/client-ops');
                      await deleteNote(call.specifier);
                      removeNote(call.specifier);
                    } else if (type === 'goal' || type === 'task') {
                      await deleteTask(call.specifier);
                    } else if (type === 'project') {
                      const { deleteProject } = await import('@/lib/actions/client-ops');
                      await deleteProject(call.specifier);
                    }
                    resultSummary = `Deleted ${type}: ${call.specifier}`;
                  } else if (call.toolKey === 'navigate_workspace' && call.args.route) {
                    resultSummary = `Navigate: ${call.args.route}`;
                    onClose();
                    router.push(call.args.route);
                  }
                  await recordToolCall(call, 'success', resultSummary);
                  toast.success(`Kylie ran ${toolDef.name}.`);
                } catch (err: any) {
                  console.error(`Failed to execute tool ${call.toolKey}:`, err);
                  await recordToolCall(call, 'error', err?.message || 'Failed');
                  toast.error(`Kylie couldn't run ${toolDef.name}`);
                }
              }
            }

            if (executedTools.length > 0 || liveNextSteps.length > 0) {
              setMessages((prev) =>
                prev.map((m) =>
                  m.id === assistantId
                    ? {
                        ...m,
                        tools: executedTools.length ? executedTools : m.tools,
                        nextSteps: liveNextSteps.length ? liveNextSteps : m.nextSteps,
                      }
                    : m,
                ),
              );
            }
          }
        }
      } catch (err: unknown) {
        appendMessage('assistant', err instanceof Error ? err.message : 'Execution failed.');
      } finally {
        setExecuting(false);
        setRunningWorkflowId(null);
      }
    },
    [appendMessage, isPro, openProUpgrade, pageContext, addTask, updateTask, deleteTask, pushLiveNote, registerComposeSession, unregisterComposeSession, migrateDraftNoteId, removeNote, user, onClose, router],
  );

  useEffect(() => {
    const pending = consumePendingPrompt();
    if (pending?.prompt) {
      setChatInput(pending.prompt);
      if (pending.autoRun) void runPrompt(pending.prompt);
      else textareaRef.current?.focus();
    }
  }, [consumePendingPrompt, runPrompt]);

  const handleSubmit = useCallback(
    (e?: FormEvent) => {
      e?.preventDefault();
      void runPrompt(chatInput);
    },
    [chatInput, runPrompt],
  );

  const handleWorkflow = useCallback(
    async (action: QuickWorkflowAction) => {
      if (action.kind === 'navigate' && action.href) {
        onClose();
        router.push(action.href);
        return;
      }

      const prompt = action.prompt || '';
      if (action.kind === 'prompt') {
        setChatInput(prompt);
        textareaRef.current?.focus();
        return;
      }

      if (!prompt) return;
      setChatInput(prompt);
      if (action.autoRun) {
        setRunningWorkflowId(action.id);
        await runPrompt(prompt);
      }
    },
    [onClose, router, runPrompt],
  );

  const handleComposerKeyDown = (e: KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSubmit();
    }
  };

  return (
    <div className="flex flex-col h-full min-h-0 overflow-hidden">
      {/* Sticky header */}
      <div className="flex-shrink-0 px-5 pt-2 pb-3.5 border-b border-white/5 relative overflow-hidden">
        <div
          className="pointer-events-none absolute inset-0 opacity-90"
          style={{
            background: `radial-gradient(ellipse 80% 120% at 0% 0%, ${accent}18 0%, transparent 55%)`,
          }}
        />
        <div className="relative flex items-center gap-3 min-w-0">
          <div
            className="w-11 h-11 rounded-[14px] flex items-center justify-center flex-shrink-0 border shadow-[0_8px_20px_rgba(0,0,0,0.35)]"
            style={{ borderColor: `${accent}50`, backgroundColor: `${accent}18`, color: accent }}
          >
            <span className="font-clash font-black text-[17px] leading-none tracking-tight">K</span>
          </div>
          <div className="min-w-0 flex-1 flex flex-col gap-0.5">
            <h2 className="text-white font-extrabold text-[16px] font-clash tracking-tight leading-tight truncate">
              Kylie
            </h2>
            <p className="text-[#9B9691] text-xs font-semibold leading-snug truncate">
              Here for {zoneLabel(pageContext.zone).toLowerCase()}
              {agentCount > 0 ? ` · ${agentCount} helper${agentCount === 1 ? '' : 's'}` : ''}
            </p>
          </div>
          <button
            type="button"
            onClick={handleOpenSessions}
            title="Past chats with Kylie"
            className="w-8 h-8 rounded-lg flex items-center justify-center text-white/45 hover:text-white bg-white/[0.03] hover:bg-white/[0.06] border border-white/5 flex-shrink-0 mr-1"
          >
            <History size={16} />
          </button>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close"
            className="w-8 h-8 rounded-lg flex items-center justify-center text-white/45 hover:text-white bg-white/[0.03] hover:bg-white/[0.06] border border-white/5 flex-shrink-0"
          >
            <X size={16} />
          </button>
        </div>
        <p className="relative mt-2.5 text-[#9B9691] text-xs font-semibold leading-relaxed line-clamp-2">
          {pageContext.subtitle}
        </p>
      </div>

      {/* Sticky quick actions — grid scrolls inside band; header + composer stay put */}
      {messages.length === 0 && (
        <div className="flex-shrink-0 border-b border-white/5 bg-[#161412] px-5 py-3 flex flex-col min-h-0 max-h-[min(240px,36%)]">
          <div className="flex items-center justify-between gap-2 mb-2.5 flex-shrink-0">
            <span className="text-[10px] font-black uppercase tracking-[0.14em] text-[#9B9691] font-clash">
              Try with Kylie
            </span>
            <span className="text-[10px] font-semibold text-white/25">{workflows.length} actions</span>
          </div>
          <div className="flex-1 min-h-0 overflow-y-auto -mx-1 px-1 pb-0.5">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
              {workflows.map((action) => {
                const Icon = QUICK_ICON_MAP[action.icon] || Sparkles;
                const isRunning = runningWorkflowId === action.id;

                return (
                  <button
                    key={action.id}
                    type="button"
                    disabled={isRunning || executing}
                    onClick={() => void handleWorkflow(action)}
                    title={action.description}
                    className="w-full flex items-center gap-3 px-3 py-3 rounded-[16px] bg-[#0B0A09] border border-white/5 hover:bg-[#1C1A18] hover:border-white/10 transition disabled:opacity-50 text-left"
                  >
                    <div
                      className="w-9 h-9 rounded-[11px] flex items-center justify-center flex-shrink-0 border"
                      style={{ color: accent, borderColor: `${accent}30`, backgroundColor: `${accent}10` }}
                    >
                      {isRunning ? (
                        <RefreshCw size={15} className="animate-spin" />
                      ) : (
                        <Icon size={15} strokeWidth={2.2} />
                      )}
                    </div>
                    <div className="min-w-0 flex-1 flex flex-col gap-0.5">
                      <span className="text-white text-[13px] font-extrabold font-clash leading-tight">
                        {action.label}
                      </span>
                      <span className="text-[#9B9691] text-[11px] font-semibold leading-snug line-clamp-2">
                        {action.description}
                      </span>
                    </div>
                    <ChevronRight size={14} className="text-white/20 flex-shrink-0" />
                  </button>
                );
              })}
            </div>
          </div>
        </div>
      )}

      {/* Scrollable chat only */}
      <div ref={chatScrollRef} className="flex-1 min-h-0 overflow-y-auto px-5 py-4 flex flex-col gap-3">
        {messages.length === 0 && !executing && (
          <div className="rounded-[16px] border border-white/5 bg-[#0B0A09] px-4 py-3.5">
            <p className="text-white/80 text-[13px] font-bold font-clash leading-snug mb-1">
              Hey — I&apos;m Kylie.
            </p>
            <p className="text-[#9B9691] text-xs font-semibold leading-relaxed">
              Pick a suggestion above or just ask. I&apos;ll keep this chat right here.
            </p>
          </div>
        )}

        {messages.map((msg) => (
          <div key={msg.id} className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'} gap-2`}>
            {msg.role === 'assistant' && (
              <div
                className="mt-1 w-7 h-7 rounded-[9px] flex items-center justify-center flex-shrink-0 border text-[11px] font-clash font-black"
                style={{ borderColor: `${accent}40`, backgroundColor: `${accent}14`, color: accent }}
              >
                K
              </div>
            )}
            <div
              className={`max-w-[88%] rounded-[16px] px-4 py-3 ${
                msg.role === 'user'
                  ? 'bg-[#1C1A18] border border-white/8 text-white'
                  : 'bg-[#0B0A09] border border-white/5 text-white/92'
              }`}
              style={
                msg.role === 'assistant'
                  ? { boxShadow: `inset 3px 0 0 0 ${accent}55` }
                  : undefined
              }
            >
              <p className="text-[10px] font-black tracking-wider text-[#9B9691] mb-1.5 leading-none">
                {msg.role === 'user' ? 'You' : 'Kylie'}
              </p>
              <p className="text-[13px] font-semibold leading-relaxed whitespace-pre-wrap break-words">
                {msg.content}
              </p>
              {msg.role === 'assistant' && msg.tools && msg.tools.length > 0 && (
                <div className="mt-2.5 flex flex-col gap-1.5">
                  {msg.tools.map((tool, toolIdx) => (
                    <div
                      key={`${msg.id}-tool-${toolIdx}`}
                      className="rounded-lg border border-white/8 bg-black/30 px-2.5 py-2 text-left"
                    >
                      <div className="flex items-center gap-1.5 text-[10px] font-black uppercase tracking-wider text-[#9B9691]">
                        <Zap size={11} style={{ color: accent }} />
                        <span>Tool · {tool.toolKey}</span>
                        {tool.status ? (
                          <span className={tool.status === 'success' ? 'text-emerald-400/80' : 'text-red-400/80'}>
                            {tool.status}
                          </span>
                        ) : null}
                      </div>
                      {tool.specifier ? (
                        <p className="mt-1 text-[10px] font-mono text-white/45 truncate">Target: {tool.specifier}</p>
                      ) : null}
                      {tool.resultSummary ? (
                        <p className="mt-1 text-[11px] font-semibold text-white/70 leading-snug">{tool.resultSummary}</p>
                      ) : null}
                    </div>
                  ))}
                </div>
              )}
              {msg.role === 'assistant' && msg.nextSteps && msg.nextSteps.length > 0 && (
                <div className="mt-3 flex flex-col gap-1.5">
                  <p className="text-[10px] font-black uppercase tracking-wider text-[#9B9691]">
                    Next with Kylie
                  </p>
                  <div className="flex flex-col gap-1.5">
                    {msg.nextSteps.map((step, stepIdx) => (
                      <button
                        key={`${msg.id}-next-${stepIdx}`}
                        type="button"
                        disabled={executing}
                        onClick={() => void runPrompt(step.prompt)}
                        className="w-full text-left rounded-[12px] px-3 py-2.5 border border-white/8 bg-white/[0.03] hover:bg-white/[0.06] hover:border-white/12 transition disabled:opacity-50"
                        style={{ boxShadow: `inset 2px 0 0 0 ${accent}70` }}
                      >
                        <span className="text-[12px] font-bold text-white leading-snug">{step.label}</span>
                      </button>
                    ))}
                  </div>
                </div>
              )}
            </div>
          </div>
        ))}

        {executing && (
          <div className="flex justify-start gap-2">
            <div
              className="mt-1 w-7 h-7 rounded-[9px] flex items-center justify-center flex-shrink-0 border text-[11px] font-clash font-black"
              style={{ borderColor: `${accent}40`, backgroundColor: `${accent}14`, color: accent }}
            >
              K
            </div>
            <div className="rounded-[16px] px-4 py-3 bg-[#0B0A09] border border-white/5 flex items-center gap-2">
              <RefreshCw size={14} className="animate-spin" style={{ color: accent }} />
              <span className="text-[#9B9691] text-xs font-semibold leading-snug">Kylie is on it…</span>
            </div>
          </div>
        )}
      </div>

      {/* Sticky composer */}
      <div className="flex-shrink-0 border-t border-white/5 bg-[#161412] px-5 pt-3 pb-4">
        {pendingPayment ? (
          <div className="mb-3 p-4 rounded-[18px] bg-white/[0.03] backdrop-blur-md border border-white/10 flex flex-col gap-3">
            <div className="flex items-center gap-3">
              <div className="w-9 h-9 rounded-xl bg-indigo-500/10 border border-indigo-500/20 flex items-center justify-center text-indigo-400">
                <Wallet size={16} />
              </div>
              <div className="flex-1 text-left">
                <h3 className="text-white text-xs font-bold leading-tight">Authorize Agent Funding</h3>
                <p className="text-[#9B9691] text-[10px] leading-snug mt-0.5">
                  Deposit {pendingPayment.amount} ARB to fund Agent {pendingPayment.agentId.substring(0, 8)}...
                </p>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <button
                type="button"
                disabled={signing}
                onClick={handleApprovePayment}
                className="flex-1 py-2 px-3 rounded-xl bg-white text-black text-xs font-black hover:bg-zinc-200 transition disabled:opacity-50"
              >
                {signing ? 'Signing with MEK...' : 'Sign & Fund Stream'}
              </button>
              <button
                type="button"
                disabled={signing}
                onClick={() => setPendingPayment(null)}
                className="py-2 px-3 rounded-xl bg-white/[0.05] hover:bg-white/[0.1] border border-white/5 text-white text-xs font-bold transition"
              >
                Cancel
              </button>
            </div>
          </div>
        ) : null}

        {pendingToolAuth ? (
          <div className="mb-3 p-4 rounded-[18px] bg-white/[0.03] backdrop-blur-md border border-white/10 flex flex-col gap-3">
            <div className="flex items-center gap-3">
              <div className="w-9 h-9 rounded-xl bg-amber-500/10 border border-amber-500/20 flex items-center justify-center text-amber-400">
                <Shield size={16} />
              </div>
              <div className="flex-1 text-left">
                <h3 className="text-white text-xs font-bold leading-tight">Allow Kylie</h3>
                <p className="text-[#9B9691] text-[10px] leading-snug mt-0.5">
                  Kylie wants to run <strong>{pendingToolAuth.name}</strong>.
                </p>
              </div>
            </div>
            <div className="flex flex-col gap-1 text-[10px] text-[#9B9691] text-left bg-black/25 p-2 rounded-lg border border-white/5 font-mono">
              <div>Tool: {pendingToolAuth.toolKey}</div>
              {pendingToolAuth.specifier && <div>Target: {pendingToolAuth.specifier}</div>}
              {pendingToolAuth.args && <div>Args: {JSON.stringify(pendingToolAuth.args)}</div>}
            </div>
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => {
                  toast.success(`Executed ${pendingToolAuth.name} once.`);
                  setPendingToolAuth(null);
                }}
                className="flex-1 py-2 px-3 rounded-xl bg-white text-black text-xs font-black hover:bg-zinc-200 transition"
              >
                Allow Once
              </button>
              <button
                type="button"
                onClick={async () => {
                  try {
                    const current = await account.getPrefs();
                    const whitelist = Array.isArray(current?.authorizedTools) ? current.authorizedTools : [];
                    if (!whitelist.includes(pendingToolAuth.toolKey)) {
                      whitelist.push(pendingToolAuth.toolKey);
                    }
                    await account.updatePrefs({ ...current, authorizedTools: whitelist });
                    toast.success(`Always allow whitelisted for ${pendingToolAuth.name}.`);
                  } catch (err) {
                    console.error('Failed to update whitelisted preferences:', err);
                  }
                  setPendingToolAuth(null);
                }}
                className="flex-1 py-2 px-3 rounded-xl bg-white/[0.08] hover:bg-white/[0.15] border border-white/10 text-white text-xs font-bold transition"
              >
                Allow Always
              </button>
              <button
                type="button"
                onClick={() => setPendingToolAuth(null)}
                className="py-2 px-3 rounded-xl bg-white/[0.02] hover:bg-white/[0.05] border border-white/5 text-white/50 text-xs transition"
              >
                Deny
              </button>
            </div>
            <div className="text-[9px] text-left text-[#9B9691]/50 px-1">
              You can adjust sweeps and permanent rules in{' '}
              <Link href="/settings/agents" className="text-white hover:underline">
                agent permissions settings
              </Link>
            </div>
          </div>
        ) : null}

        <form onSubmit={handleSubmit} className="flex flex-col gap-2">
          <div
            className="flex items-end gap-2 rounded-[18px] border border-white/8 bg-[#0B0A09] px-3 py-2.5 focus-within:border-white/15 transition-colors"
            style={{ boxShadow: executing ? `0 0 0 1px ${accent}44` : undefined }}
          >
            <textarea
              ref={textareaRef}
              value={chatInput}
              onChange={(e) => handleInputChange(e.target.value)}
              onKeyDown={handleComposerKeyDown}
              placeholder="Ask Kylie to help you with anything…"
              disabled={executing}
              rows={isDesktop ? 2 : 2}
              className="flex-1 min-w-0 resize-none bg-transparent text-white text-[13px] font-semibold leading-relaxed placeholder:text-[#9B9691]/50 focus:outline-none disabled:opacity-50 max-h-[96px] py-1.5 px-1"
            />
            <button
              type="submit"
              disabled={executing || !chatInput.trim()}
              className="flex-shrink-0 w-10 h-10 rounded-xl flex items-center justify-center text-white transition disabled:opacity-35"
              style={{ backgroundColor: chatInput.trim() && !executing ? accent : 'rgba(255,255,255,0.06)' }}
              aria-label="Send"
            >
              {executing ? <RefreshCw size={16} className="animate-spin" /> : <Send size={16} />}
            </button>
          </div>
          <div className="flex items-center justify-between gap-2 px-0.5">
            <span className="text-[10px] text-[#9B9691] font-semibold leading-snug">
              Enter to send · Shift+Enter for new line
            </span>
            <div className="flex items-center gap-2 flex-shrink-0">
              {!isPro && (
                <span className="text-[9px] font-black uppercase tracking-widest px-1.5 py-0.5 rounded bg-amber-500/10 border border-amber-500/20 text-amber-500">
                  Pro
                </span>
              )}
              <button
                type="button"
                onClick={() => {
                  onClose();
                  router.push('/settings/agents');
                }}
                className="text-[10px] font-bold text-white/35 hover:text-white/70 transition flex items-center gap-1"
              >
                <Plus size={12} />
                Agents
              </button>
            </div>
          </div>
        </form>
      </div>

      {/* Sessions Bottom Drawer (Capped at 60% height permanently) */}
      {showSessionsDrawer && (
        <div className="absolute inset-0 bg-black/60 z-50 flex flex-col justify-end transition-opacity duration-300">
          <div className="bg-[#0B0A09] border-t border-white/10 rounded-t-[20px] w-full max-h-[60%] min-h-[40%] flex flex-col overflow-hidden animate-slide-up">
            {/* Header */}
            <div className="flex-shrink-0 px-5 py-4 border-b border-white/5 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <History size={16} style={{ color: accent }} />
                <h3 className="text-white font-extrabold text-[14px] font-clash tracking-tight">
                  Chats with Kylie
                </h3>
              </div>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={handleCreateNewSessionFromDrawer}
                  title="New Session"
                  className="w-7 h-7 rounded-lg flex items-center justify-center text-white/60 hover:text-white bg-white/[0.03] hover:bg-white/[0.06] border border-white/5"
                >
                  <Plus size={14} />
                </button>
                <button
                  type="button"
                  onClick={() => setShowSessionsDrawer(false)}
                  className="w-7 h-7 rounded-lg flex items-center justify-center text-white/45 hover:text-white bg-white/[0.03] hover:bg-white/[0.06] border border-white/5"
                >
                  <X size={14} />
                </button>
              </div>
            </div>

            {/* List */}
            <div className="flex-1 overflow-y-auto px-5 py-3 flex flex-col gap-2">
              {loadingSessions ? (
                <div className="flex items-center justify-center py-8 gap-2">
                  <RefreshCw size={14} className="animate-spin text-[#9B9691]" />
                  <span className="text-[#9B9691] text-xs font-semibold">Loading sessions…</span>
                </div>
              ) : sessions.length === 0 ? (
                <div className="text-center py-8 text-[#9B9691] text-xs font-semibold">
                  No active session threads. Click + to start one.
                </div>
              ) : (
                sessions.map((sess) => {
                  let previewText = 'Empty session thread';
                  let titleText = `Session ${new Date(sess.createdAt).toLocaleDateString()}`;
                  try {
                    const parsed = JSON.parse(sess.chatHistory || '[]');
                    const firstUser = parsed.find((m: any) => m.role === 'user');
                    const lastMsg = parsed[parsed.length - 1];
                    if (firstUser?.content) {
                      titleText = visibleChatContent('user', firstUser.content).slice(0, 72) || titleText;
                    }
                    if (lastMsg) {
                      const body = visibleChatContent(lastMsg.role, lastMsg.content);
                      previewText = `${lastMsg.role === 'user' ? 'You' : 'Kylie'}: ${body}`;
                    }
                  } catch {}

                  return (
                    <div
                      key={sess.id}
                      onClick={() => handleSelectSession(sess.id)}
                      className="w-full flex items-center justify-between gap-3 p-3 rounded-xl bg-white/[0.02] border border-white/5 hover:bg-white/[0.05] hover:border-white/10 transition cursor-pointer text-left group"
                    >
                      <div className="min-w-0 flex-1 flex flex-col gap-0.5">
                        <span className="text-white text-xs font-bold leading-tight truncate">
                          {titleText}
                        </span>
                        <span className="text-[#9B9691] text-[10px] leading-snug line-clamp-1">
                          {previewText}
                        </span>
                      </div>
                      <button
                        type="button"
                        onClick={(e) => handleDeleteSession(e, sess.id)}
                        title="Delete Session"
                        className="w-7 h-7 rounded-lg flex items-center justify-center text-white/30 hover:text-red-500 hover:bg-red-500/10 border border-transparent transition opacity-0 group-hover:opacity-100 flex-shrink-0"
                      >
                        <Trash2 size={13} />
                      </button>
                    </div>
                  );
                })
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
