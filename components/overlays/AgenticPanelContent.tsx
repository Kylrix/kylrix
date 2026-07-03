'use client';

import { useCallback, useEffect, useMemo, useRef, useState, type ComponentType, type FormEvent, type KeyboardEvent } from 'react';
import { usePathname, useRouter } from 'next/navigation';
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
  User,
  Users,
  Video,
  Wallet,
  Workflow,
  X,
  Zap,
} from 'lucide-react';

import { useAgenticDrawer } from '@/context/AgenticDrawerContext';
import { useAuth } from '@/context/auth/AuthContext';
import { AgenticService } from '@/lib/services/agentic';
import { executeInstantRequestAction } from '@/lib/actions/agentic';
import {
  buildInstantPrompt,
  getQuickWorkflows,
  resolveAgenticPageContext,
  type QuickWorkflowAction,
} from '@/lib/agentic/context-workflows';
import { getAppColor } from '@/lib/ecosystem-app-colors';
import { useProUpgrade } from '@/context/ProUpgradeContext';
import { hasPaidKylrixPlan } from '@/lib/utils';
import { account } from '@/lib/appwrite/client';

interface ChatMessage {
  id: string;
  role: 'user' | 'assistant';
  content: string;
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
    agents: 'Smart System',
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
  const { user } = useAuth();
  const { openProUpgrade } = useProUpgrade();
  const pathname = usePathname() || '/';
  const router = useRouter();
  const isPro = hasPaidKylrixPlan(user);

  const pageContext = useMemo(() => resolveAgenticPageContext(pathname), [pathname]);
  const accent = useMemo(() => getAppColor(pageContext.accentApp), [pageContext.accentApp]);
  const workflows = useMemo(() => getQuickWorkflows(pageContext), [pageContext]);

  const [chatInput, setChatInput] = useState('');
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [executing, setExecuting] = useState(false);
  const [runningWorkflowId, setRunningWorkflowId] = useState<string | null>(null);
  const [agentCount, setAgentCount] = useState(0);

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
        openProUpgrade('Smart System request');
        return;
      }

      appendMessage('user', trimmed);
      setChatInput('');
      setExecuting(true);

      try {
        const jwt = await account.createJWT().then((res: { jwt?: string }) => res?.jwt || '').catch(() => undefined);
        const contextualPrompt = buildInstantPrompt(trimmed, pageContext);
        const res = await executeInstantRequestAction(contextualPrompt, jwt, {
          zone: pageContext.zone,
          route: pageContext.route,
          title: pageContext.title,
          systemHint: pageContext.systemHint,
          resourceId: pageContext.resourceId,
        });
        if (res.success) appendMessage('assistant', res.response);
      } catch (err: unknown) {
        appendMessage('assistant', err instanceof Error ? err.message : 'Execution failed.');
      } finally {
        setExecuting(false);
        setRunningWorkflowId(null);
      }
    },
    [appendMessage, isPro, openProUpgrade, pageContext],
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
      <div className="flex-shrink-0 px-5 pt-1 pb-3 border-b border-white/5">
        <div className="flex items-center gap-3 min-w-0">
          <div
            className="w-10 h-10 rounded-[12px] flex items-center justify-center flex-shrink-0 border"
            style={{ borderColor: `${accent}40`, backgroundColor: `${accent}14`, color: accent }}
          >
            <Bot size={18} strokeWidth={2.2} />
          </div>
          <div className="min-w-0 flex-1 flex flex-col gap-0.5">
            <h2 className="text-white font-extrabold text-[15px] font-clash tracking-tight leading-tight truncate">
              Smart System
            </h2>
            <p className="text-[#9B9691] text-xs font-semibold leading-snug truncate">
              {zoneLabel(pageContext.zone)} · {pageContext.title}
              {agentCount > 0 ? ` · ${agentCount} agent${agentCount === 1 ? '' : 's'}` : ''}
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close"
            className="w-8 h-8 rounded-lg flex items-center justify-center text-white/45 hover:text-white bg-white/[0.03] hover:bg-white/[0.06] border border-white/5 flex-shrink-0"
          >
            <X size={16} />
          </button>
        </div>
        <p className="mt-2.5 text-[#9B9691] text-xs font-semibold leading-relaxed line-clamp-2">
          {pageContext.subtitle}
        </p>
      </div>

      {/* Sticky quick actions — grid scrolls inside band; header + composer stay put */}
      <div className="flex-shrink-0 border-b border-white/5 bg-[#161412] px-5 py-3 flex flex-col min-h-0 max-h-[min(240px,36%)]">
        <div className="flex items-center justify-between gap-2 mb-2.5 flex-shrink-0">
          <span className="text-[10px] font-black uppercase tracking-[0.14em] text-[#9B9691] font-clash">
            Suggested here
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

      {/* Scrollable chat only */}
      <div ref={chatScrollRef} className="flex-1 min-h-0 overflow-y-auto px-5 py-4 flex flex-col gap-3">
        {messages.length === 0 && !executing && (
          <div className="rounded-[16px] border border-white/5 bg-[#0B0A09] px-4 py-3.5">
            <p className="text-[#9B9691] text-xs font-semibold leading-relaxed">
              Pick a suggestion above or type below. Your conversation stays in this panel.
            </p>
          </div>
        )}

        {messages.map((msg) => (
          <div key={msg.id} className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}>
            <div
              className={`max-w-[92%] rounded-[16px] px-4 py-3 ${
                msg.role === 'user'
                  ? 'bg-[#1C1A18] border border-white/8 text-white'
                  : 'bg-[#0B0A09] border border-white/5 text-white/92'
              }`}
            >
              <p className="text-[10px] font-black uppercase tracking-wider text-[#9B9691] mb-1.5 leading-none">
                {msg.role === 'user' ? 'You' : 'System'}
              </p>
              <p className="text-[13px] font-semibold leading-relaxed whitespace-pre-wrap break-words">
                {msg.content}
              </p>
            </div>
          </div>
        ))}

        {executing && (
          <div className="flex justify-start">
            <div className="rounded-[16px] px-4 py-3 bg-[#0B0A09] border border-white/5 flex items-center gap-2">
              <RefreshCw size={14} className="animate-spin" style={{ color: accent }} />
              <span className="text-[#9B9691] text-xs font-semibold leading-snug">Working…</span>
            </div>
          </div>
        )}
      </div>

      {/* Sticky composer */}
      <div className="flex-shrink-0 border-t border-white/5 bg-[#161412] px-5 pt-3 pb-4">
        <form onSubmit={handleSubmit} className="flex flex-col gap-2">
          <div
            className="flex items-end gap-2 rounded-[18px] border border-white/8 bg-[#0B0A09] px-3 py-2.5 focus-within:border-white/15 transition-colors"
            style={{ boxShadow: executing ? `0 0 0 1px ${accent}44` : undefined }}
          >
            <textarea
              ref={textareaRef}
              value={chatInput}
              onChange={(e) => setChatInput(e.target.value)}
              onKeyDown={handleComposerKeyDown}
              placeholder={pageContext.placeholder}
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
    </div>
  );
}
