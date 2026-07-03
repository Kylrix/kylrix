'use client';

import { useCallback, useEffect, useMemo, useRef, useState, type ComponentType, type FormEvent, type KeyboardEvent } from 'react';
import { usePathname, useRouter } from 'next/navigation';
import {
  AlarmClock,
  BarChart3,
  Bell,
  Bot,
  CalendarRange,
  ChevronRight,
  Compass,
  CreditCard,
  FolderKanban,
  Kanban,
  KeyRound,
  Lightbulb,
  Link2,
  ListTodo,
  Lock,
  MessageSquare,
  PenLine,
  Plus,
  RefreshCw,
  Send,
  Settings,
  Share2,
  Shield,
  ShieldCheck,
  Sparkles,
  Sunrise,
  Tags,
  Target,
  User,
  Users,
  Video,
  Workflow,
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
  'alarm-clock': AlarmClock,
  target: Target,
  kanban: Kanban,
  'shield-check': ShieldCheck,
  'key-round': KeyRound,
  tags: Tags,
  lock: Lock,
  'message-square': MessageSquare,
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
    setMessages((prev) => [...prev, { id: `${Date.now()}-${Math.random().toString(36).slice(2, 7)}`, role, content }]);
  }, []);

  const runPrompt = useCallback(
    async (rawPrompt: string, options?: { skipUserBubble?: boolean }) => {
      const trimmed = rawPrompt.trim();
      if (!trimmed) return;

      if (!isPro) {
        openProUpgrade('Smart System request');
        return;
      }

      if (!options?.skipUserBubble) {
        appendMessage('user', trimmed);
      }
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
        const message = err instanceof Error ? err.message : 'Execution failed.';
        appendMessage('assistant', message);
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
      {/* Header */}
      <div className="flex items-center gap-3.5 px-5 pb-4 flex-shrink-0">
        <div
          className="w-11 h-11 rounded-[14px] flex items-center justify-center flex-shrink-0 border"
          style={{ borderColor: `${accent}40`, backgroundColor: `${accent}14`, color: accent }}
        >
          <Bot size={20} strokeWidth={2.2} />
        </div>
        <div className="min-w-0 flex-1 flex flex-col gap-1">
          <h2 className="text-white font-extrabold text-[15px] font-clash tracking-tight leading-tight">
            Smart System
          </h2>
          <p className="text-[#9B9691] text-xs font-semibold leading-snug">
            {zoneLabel(pageContext.zone)}
            {agentCount > 0 ? ` · ${agentCount} agent${agentCount === 1 ? '' : 's'} ready` : ''}
          </p>
        </div>
      </div>

      {/* Scrollable chat + suggestions */}
      <div ref={chatScrollRef} className="flex-1 min-h-0 overflow-y-auto px-5 pb-4 flex flex-col gap-4">
        {/* Context pill */}
        <div
          className="flex items-start gap-3 px-4 py-3.5 rounded-[18px] border border-white/5 bg-[#0B0A09]"
        >
          <span
            className="mt-1 w-2 h-2 rounded-full flex-shrink-0"
            style={{ backgroundColor: accent, boxShadow: `0 0 8px ${accent}` }}
          />
          <div className="min-w-0 flex-1 flex flex-col gap-1">
            <span className="text-white text-[13px] font-extrabold font-clash leading-snug">
              {pageContext.title}
            </span>
            <span className="text-[#9B9691] text-xs font-semibold leading-relaxed">
              {pageContext.subtitle}
            </span>
          </div>
        </div>

        {/* Chat thread */}
        {messages.length === 0 && !executing && (
          <div className="px-1 py-2">
            <p className="text-[#9B9691] text-xs font-semibold leading-relaxed">
              Type below or pick a quick action. Responses show up here.
            </p>
          </div>
        )}

        {messages.map((msg) => (
          <div
            key={msg.id}
            className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}
          >
            <div
              className={`max-w-[92%] rounded-[18px] px-4 py-3 ${
                msg.role === 'user'
                  ? 'bg-[#1C1A18] border border-white/8 text-white'
                  : 'bg-[#0B0A09] border border-white/5 text-white/92'
              }`}
            >
              <p className="text-[11px] font-black uppercase tracking-wider text-[#9B9691] mb-1.5 leading-none">
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
            <div className="rounded-[18px] px-4 py-3 bg-[#0B0A09] border border-white/5 flex items-center gap-2">
              <RefreshCw size={14} className="animate-spin" style={{ color: accent }} />
              <span className="text-[#9B9691] text-xs font-semibold">Working…</span>
            </div>
          </div>
        )}

        {/* Quick actions */}
        <div className="flex flex-col gap-2.5 pt-1">
          <span className="text-[10px] font-black uppercase tracking-[0.14em] text-[#9B9691] font-clash px-0.5">
            Quick actions
          </span>

          <div className="flex flex-col gap-2">
            {workflows.map((action) => {
              const Icon = QUICK_ICON_MAP[action.icon] || Sparkles;
              const isRunning = runningWorkflowId === action.id;

              return (
                <button
                  key={action.id}
                  type="button"
                  disabled={isRunning || executing}
                  onClick={() => void handleWorkflow(action)}
                  className="w-full flex items-center gap-3 px-4 py-3.5 rounded-[18px] bg-[#0B0A09] border border-white/5 text-left transition-all duration-200 hover:bg-[#1C1A18] hover:border-white/10 disabled:opacity-55"
                >
                  <div
                    className="w-[38px] h-[38px] rounded-xl flex items-center justify-center flex-shrink-0 border"
                    style={{ color: accent, borderColor: `${accent}30`, backgroundColor: `${accent}12` }}
                  >
                    {isRunning ? (
                      <RefreshCw size={16} className="animate-spin" />
                    ) : (
                      <Icon size={16} strokeWidth={2.2} />
                    )}
                  </div>

                  <div className="min-w-0 flex-1 flex flex-col gap-1 pr-1">
                    <span className="text-white font-extrabold text-[13px] font-clash leading-tight truncate">
                      {action.label}
                    </span>
                    <span className="text-[#9B9691] text-xs font-semibold leading-snug line-clamp-2">
                      {action.description}
                    </span>
                  </div>

                  <ChevronRight size={16} className="text-white/15 flex-shrink-0" />
                </button>
              );
            })}
          </div>

          <button
            type="button"
            onClick={() => {
              onClose();
              router.push('/settings/agents');
            }}
            className="w-full flex items-center justify-center gap-2 py-3 rounded-[16px] border border-white/6 bg-white/[0.02] text-[#9B9691] text-xs font-extrabold hover:text-white hover:bg-white/[0.04] transition"
          >
            <Plus size={14} />
            Configure agents
          </button>
        </div>
      </div>

      {/* Chat composer — pinned bottom */}
      <div className="flex-shrink-0 border-t border-white/5 bg-[#161412] px-5 pt-3 pb-4 md:pb-5">
        <form onSubmit={handleSubmit} className="flex flex-col gap-2">
          <div
            className="flex items-end gap-2 rounded-[20px] border border-white/8 bg-[#0B0A09] px-3 py-2.5 focus-within:border-white/15 transition-colors"
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
              className="flex-1 min-w-0 resize-none bg-transparent text-white text-[13px] font-semibold leading-relaxed placeholder:text-[#9B9691]/50 focus:outline-none disabled:opacity-50 max-h-[120px] py-1.5 px-1"
            />
            <button
              type="submit"
              disabled={executing || !chatInput.trim()}
              className="flex-shrink-0 w-10 h-10 rounded-xl flex items-center justify-center text-white transition disabled:opacity-35 disabled:cursor-not-allowed"
              style={{ backgroundColor: chatInput.trim() && !executing ? accent : 'rgba(255,255,255,0.06)' }}
              aria-label="Send"
            >
              {executing ? <RefreshCw size={16} className="animate-spin" /> : <Send size={16} />}
            </button>
          </div>
          <div className="flex items-center justify-between px-1">
            <span className="text-[10px] text-[#9B9691] font-semibold">
              Enter to send · Shift+Enter for new line
            </span>
            {!isPro && (
              <span className="text-[9px] font-black uppercase tracking-widest px-1.5 py-0.5 rounded bg-amber-500/10 border border-amber-500/20 text-amber-500">
                Pro
              </span>
            )}
          </div>
        </form>
      </div>
    </div>
  );
}
