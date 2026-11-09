'use client';

import { useEffect, useState, useRef } from 'react';
import { useRouter } from 'next/navigation';
import {
  X,
  Sparkles,
  Bot,
  Send,
  CheckCircle2,
  WifiOff,
  Cpu,
} from 'lucide-react';
import { Drawer, Box } from '@/lib/openbricks/primitives';
import { LocalEngine } from '@/lib/services/LocalEngine';
import { useAuth } from '@/context/auth/AuthContext';
import { useNotes } from '@/context/NotesContext';
import { useTask } from '@/context/TaskContext';
import { useUnifiedDrawer } from '@/context/UnifiedDrawerContext';
import { AgenticMarkdown } from '@/components/agentic/AgenticMarkdown';
import {
  executeDualPathAgent,
  WORKSPACE_SLASH_COMMANDS,
  type DualPathExecutionResult,
} from '@/lib/agentic/offline-engine';

export interface WorkspaceCopilotDrawerProps {
  workspaceId: string;
  workspaceTitle?: string;
  onClose: () => void;
  open?: boolean;
  embedded?: boolean;
}

type CopilotMessage = {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  mode?: 'online' | 'offline';
  toolCall?: {
    toolKey: string;
    specifier?: string;
    args?: Record<string, unknown>;
  };
  at?: string;
};

const QUICK_ACTION_PILLS = [
  { label: 'Draft meeting notes', prompt: 'Create note: Workspace Meeting Notes' },
  { label: 'List overdue goals', prompt: '/search overdue' },
  { label: 'Export workspace envs', prompt: 'Export workspace envs' },
  { label: 'Provision agent key', prompt: 'Provision agent key' },
];

export function WorkspaceCopilotDrawer({
  workspaceId,
  workspaceTitle = 'Workspace',
  onClose,
  open = true,
  embedded = false,
}: WorkspaceCopilotDrawerProps) {
  const router = useRouter();
  const { user } = useAuth();
  const { notes = [] } = useNotes();
  const { tasks = [] } = useTask();
  const { open: openUnified } = useUnifiedDrawer();

  const [input, setInput] = useState('');
  const [messages, setMessages] = useState<CopilotMessage[]>([]);
  const [sending, setSending] = useState(false);
  const [isOfflineMode, setIsOfflineMode] = useState(false);
  const [isMobile, setIsMobile] = useState(false);
  const listRef = useRef<HTMLDivElement>(null);

  // Monitor connectivity
  useEffect(() => {
    const updateOnlineStatus = () => {
      setIsOfflineMode(!navigator.onLine);
    };
    updateOnlineStatus();
    window.addEventListener('online', updateOnlineStatus);
    window.addEventListener('offline', updateOnlineStatus);
    return () => {
      window.removeEventListener('online', updateOnlineStatus);
      window.removeEventListener('offline', updateOnlineStatus);
    };
  }, []);

  // Screen size tracking
  useEffect(() => {
    const handleResize = () => setIsMobile(window.innerWidth < 768);
    handleResize();
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  // Hydrate chat from LocalEngine for instant 0ms launch
  const chatCacheKey = `workspace_copilot:chat:${workspaceId}`;
  useEffect(() => {
    if (!open) return;
    LocalEngine.cacheGet<CopilotMessage[]>(chatCacheKey)
      .then((cached) => {
        if (Array.isArray(cached) && cached.length) {
          setMessages(cached);
        } else {
          // Default welcoming greeting
          setMessages([
            {
              id: `welcome_${workspaceId}`,
              role: 'assistant',
              content: `Welcome to **Kylrix Copilot** for **${workspaceTitle}**.\n\nI can autonomously manage notes, goals, secrets, search ecosystem data, and automate workflows across your entire workspace.\n\nType a command or pick a quick action below.`,
              mode: 'online',
              at: new Date().toISOString(),
            },
          ]);
        }
      })
      .catch(() => {});
  }, [open, workspaceId, workspaceTitle, chatCacheKey]);

  // Auto-scroll on new message
  useEffect(() => {
    if (listRef.current) {
      listRef.current.scrollTop = listRef.current.scrollHeight;
    }
  }, [messages, sending]);

  const handleSend = async (overridePrompt?: string) => {
    const promptToSend = (overridePrompt || input).trim();
    if (!promptToSend || sending) return;

    setSending(true);
    setInput('');

    const userMsg: CopilotMessage = {
      id: `u_${Date.now()}`,
      role: 'user',
      content: promptToSend,
      at: new Date().toISOString(),
    };

    const nextMessages = [...messages, userMsg];
    setMessages(nextMessages);
    LocalEngine.cacheSet(chatCacheKey, nextMessages).catch(() => {});

    try {
      // Setup online executor wrapping executeSidekickChat in workspace mode
      const onlineExecutor = async (text: string) => {
        const { account } = await import('@/lib/data');
        const jwt = await account.createJWT().then((r: any) => r.jwt || '').catch(() => undefined);
        const { executeSidekickChat } = await import('@/lib/actions/sidekick');
        const res = await executeSidekickChat({
          target: {
            type: 'workspace',
            id: workspaceId,
            title: workspaceTitle,
          },
          message: text,
          jwt,
        });

        if (res.success && (res.response || (res as any).result)) {
          const raw = res.response || JSON.stringify((res as any).result);
          return { success: true, response: raw };
        }
        return { success: false, error: res.error || 'Server execution failed' };
      };

      // Dual-path dispatch
      const executionResult: DualPathExecutionResult = await executeDualPathAgent({
        prompt: promptToSend,
        workspaceId,
        workspaceTitle,
        userId: user?.$id,
        onlineExecutor,
      });

      const assistantMsg: CopilotMessage = {
        id: `a_${Date.now()}`,
        role: 'assistant',
        content: executionResult.response,
        mode: executionResult.mode,
        toolCall: executionResult.toolCall,
        at: new Date().toISOString(),
      };

      const updatedHistory = [...nextMessages, assistantMsg];
      setMessages(updatedHistory);
      LocalEngine.cacheSet(chatCacheKey, updatedHistory).catch(() => {});

      // If a toolCall was generated, run client side tool execution
      if (executionResult.toolCall?.toolKey) {
        try {
          const { executeAgenticToolCallWithToast } = await import('@/lib/agentic/client-executor');
          await executeAgenticToolCallWithToast(
            {
              toolKey: executionResult.toolCall.toolKey,
              specifier: executionResult.toolCall.specifier,
              args: executionResult.toolCall.args || {},
            },
            {
              user: user ? { $id: user.$id } : null,
              router,
              notes,
              tasks,
              openDrawer: (type: string, payload?: Record<string, unknown>) => {
                openUnified(type as any, payload);
              },
            }
          );
        } catch (toolErr) {
          console.warn('[WorkspaceCopilot] Client tool executor warning:', toolErr);
        }
      }
    } catch (err: any) {
      console.error('[WorkspaceCopilot] Execution failure:', err);
      const errMsg: CopilotMessage = {
        id: `e_${Date.now()}`,
        role: 'assistant',
        content: `Error processing request: ${err?.message || 'Unknown error'}`,
        at: new Date().toISOString(),
      };
      setMessages((prev) => [...prev, errMsg]);
    } finally {
      setSending(false);
    }
  };

  const content = (
    <div className="h-full flex flex-col bg-[#0A0908] overflow-hidden text-white font-satoshi">
      {/* Copilot Header */}
      <div className="px-5 py-4 border-b border-white/[0.08] flex items-center justify-between shrink-0 bg-[#0A0908]">
        <div className="flex items-center gap-3 min-w-0">
          <div className="w-9 h-9 rounded-xl bg-[#6366F1]/15 border border-[#6366F1]/30 flex items-center justify-center shrink-0">
            <Bot size={18} className="text-[#6366F1]" />
          </div>
          <div className="min-w-0">
            <div className="flex items-center gap-2">
              <span className="font-clash font-extrabold text-sm text-white tracking-tight truncate">
                Kylrix Copilot
              </span>
              <span className="text-[10px] font-mono text-white/40">•</span>
              <span className="text-xs font-semibold text-white/70 truncate max-w-[140px]">
                {workspaceTitle}
              </span>
            </div>
            <div className="flex items-center gap-2 mt-0.5">
              <span className="px-1.5 py-0.2 rounded text-[9px] font-mono font-bold uppercase bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
                APK Active
              </span>
              <span className="text-[10px] text-white/40 font-mono">
                Tokens: Dynamic
              </span>
            </div>
          </div>
        </div>

        <div className="flex items-center gap-1.5 shrink-0">
          {isOfflineMode && (
            <div className="flex items-center gap-1 px-2 py-1 rounded-lg bg-amber-500/15 border border-amber-500/30 text-amber-300 text-[11px] font-bold">
              <WifiOff size={12} />
              <span>Offline Engine</span>
            </div>
          )}
          <button
            onClick={onClose}
            aria-label="Close Workspace Copilot"
            className="w-8 h-8 rounded-xl bg-white/5 hover:bg-white/10 text-white/60 hover:text-white flex items-center justify-center transition-colors cursor-pointer"
          >
            <X size={16} />
          </button>
        </div>
      </div>

      {/* Quick Action Pills */}
      <div className="px-4 py-2 border-b border-white/[0.05] bg-[#121110] flex items-center gap-1.5 overflow-x-auto no-scrollbar shrink-0">
        {QUICK_ACTION_PILLS.map((pill) => (
          <button
            key={pill.label}
            onClick={() => handleSend(pill.prompt)}
            disabled={sending}
            className="px-2.5 py-1 rounded-full bg-white/[0.04] hover:bg-[#6366F1]/15 border border-white/[0.08] hover:border-[#6366F1]/30 text-[11px] font-medium text-white/80 hover:text-white transition-all whitespace-nowrap cursor-pointer shrink-0 disabled:opacity-50"
          >
            {pill.label}
          </button>
        ))}
      </div>

      {/* Messages Stream */}
      <div
        ref={listRef}
        className="flex-1 overflow-y-auto px-5 py-4 flex flex-col gap-4 min-h-0"
      >
        {messages.map((m) => {
          const isUser = m.role === 'user';
          return (
            <div
              key={m.id}
              className={`flex flex-col gap-1 max-w-[88%] ${isUser ? 'self-end items-end' : 'self-start items-start'}`}
            >
              <div
                className={`rounded-2xl px-4 py-3 text-[13px] leading-relaxed ${
                  isUser
                    ? 'bg-[#6366F1] text-white shadow-sm font-medium'
                    : 'bg-[#161412] border border-white/[0.08] text-white/90 shadow-sm'
                }`}
              >
                <AgenticMarkdown content={m.content} />

                {/* Tool Invocation Feedback Card */}
                {m.toolCall && (
                  <div className="mt-2.5 pt-2 border-t border-white/10 flex items-center gap-2 text-[11px] font-mono text-[#818CF8]">
                    <CheckCircle2 size={13} className="text-emerald-400 shrink-0" />
                    <span className="font-bold">Tool Executed:</span>
                    <span className="truncate">{m.toolCall.toolKey}</span>
                  </div>
                )}
              </div>

              {!isUser && m.mode === 'offline' && (
                <div className="flex items-center gap-1 text-[10px] text-amber-400/80 px-1 font-mono">
                  <Cpu size={10} />
                  <span>Executed locally via Offline Engine</span>
                </div>
              )}
            </div>
          );
        })}

        {sending && (
          <div className="self-start flex items-center gap-2 rounded-2xl bg-[#161412] border border-white/[0.08] px-4 py-3 text-xs text-white/60 animate-pulse">
            <Sparkles size={14} className="text-[#6366F1] animate-spin" />
            <span>Kylrix Copilot thinking…</span>
          </div>
        )}
      </div>

      {/* Slash command helpers */}
      <div className="px-4 py-1.5 bg-[#121110] border-t border-white/[0.05] flex items-center gap-1.5 overflow-x-auto no-scrollbar shrink-0">
        <span className="text-[10px] uppercase font-mono tracking-wider text-white/40 mr-1">
          Commands:
        </span>
        {WORKSPACE_SLASH_COMMANDS.map((chip) => (
          <button
            key={chip.label}
            onClick={() => setInput(chip.command)}
            className="px-2 py-0.5 rounded-md bg-white/[0.03] hover:bg-white/[0.08] border border-white/[0.06] text-[10px] font-mono text-white/60 hover:text-white transition-colors cursor-pointer whitespace-nowrap"
            title={chip.description}
          >
            {chip.label}
          </button>
        ))}
      </div>

      {/* Input Composer */}
      <div className="p-4 border-t border-white/[0.08] bg-[#0A0908] shrink-0">
        <div className="flex items-center gap-2">
          <input
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter' && !e.shiftKey) {
                e.preventDefault();
                handleSend();
              }
            }}
            placeholder={`Ask Copilot across ${workspaceTitle} (or type /note, /goal)…`}
            className="flex-1 bg-[#161412] border border-white/[0.08] rounded-xl px-4 py-3 text-sm text-white placeholder:text-white/30 focus:outline-none focus:border-[#6366F1] min-w-0 font-satoshi"
          />
          <button
            onClick={() => handleSend()}
            disabled={sending || !input.trim()}
            aria-label="Send prompt to Workspace Copilot"
            className="px-4 py-3 rounded-xl bg-[#6366F1] hover:bg-[#5254E8] disabled:opacity-40 text-white font-bold flex items-center justify-center shrink-0 cursor-pointer transition-all"
          >
            <Send size={16} />
          </button>
        </div>
      </div>
    </div>
  );

  if (!open) return null;
  if (embedded) return content;

  if (!isMobile) {
    const { NativeSidebarMount } = require('@/components/layout/NativeSidebarMount');
    return (
      <NativeSidebarMount
        active={open}
        sidebarKey={`workspace-copilot-${workspaceId}`}
        width={520}
        title="Workspace Copilot"
      >
        {content}
      </NativeSidebarMount>
    );
  }

  return (
    <Drawer
      anchor="bottom"
      open={open}
      onClose={onClose}
      PaperProps={{
        sx: {
          height: '84dvh',
          maxHeight: '90dvh',
          bgcolor: '#0A0908',
          borderTop: '1px solid rgba(255,255,255,0.08)',
          borderTopLeftRadius: '24px',
          borderTopRightRadius: '24px',
          zIndex: 1401,
        } as any,
      }}
      ModalProps={{ keepMounted: false, disablePortal: true, sx: { zIndex: 1400 } as any }}
    >
      <Box sx={{ display: 'flex', justifyContent: 'center', py: 1.5 }}>
        <Box sx={{ width: 40, height: 4, borderRadius: 2, bgcolor: '#3D3A36' }} />
      </Box>
      <div className="h-[calc(100%-24px)] overflow-hidden">{content}</div>
    </Drawer>
  );
}
