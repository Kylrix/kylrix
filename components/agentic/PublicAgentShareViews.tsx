'use client';

import React from 'react';
import Link from 'next/link';
import { Bot, Lock, MessageSquare } from 'lucide-react';
import { AgenticMarkdown } from '@/components/agentic/AgenticMarkdown';
import { SharedWorkspaceBar } from '@/components/common/SharedWorkspaceBar';

export type PublicAgentMessage = {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  isPublic?: boolean;
  isGuest?: boolean;
};

const ACCENT = '#6366F1';

function AccessUnavailable({ kind }: { kind: 'session' | 'message' }) {
  return (
    <div className="min-h-[70vh] flex items-center justify-center bg-[#0A0908] px-4 sm:px-6 py-16">
      <div className="w-full max-w-md">
        <div className="rounded-[28px] border border-[#34322F] bg-[#161412] overflow-hidden">
          <div className="flex items-start gap-3.5 p-5 sm:p-6">
            <div className="w-12 h-12 rounded-2xl flex-shrink-0 grid place-items-center border border-[#2C2A28] bg-[#1C1A18]">
              <Lock className="h-5 w-5 text-[#9B9691]" />
            </div>
            <div className="min-w-0 flex-1 flex flex-col gap-1.5">
              <h1 className="text-lg sm:text-xl font-bold text-white font-clash leading-snug">
                {kind === 'session' ? 'This chat is not available' : 'This reply is not available'}
              </h1>
              <p className="text-sm text-[#9B9691] font-satoshi leading-relaxed">
                The link may be wrong, or the owner has not shared this publicly.
              </p>
            </div>
          </div>
          <div className="px-5 sm:px-6 pb-5 sm:pb-6 pt-0">
            <Link
              href="/app"
              className="inline-flex items-center justify-center rounded-xl bg-[#6366F1] px-4 py-2.5 text-sm font-semibold text-white hover:bg-[#5254E8] transition-colors font-satoshi"
            >
              Open Kylrix
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
}

function MessageBubble({ message }: { message: PublicAgentMessage }) {
  const isUser = message.role === 'user';
  return (
    <div className={`flex ${isUser ? 'justify-end' : 'justify-start'} gap-2.5`}>
      {!isUser && (
        <div
          className="mt-1 w-8 h-8 rounded-[10px] flex-shrink-0 grid place-items-center border text-[11px] font-clash font-black"
          style={{ borderColor: `${ACCENT}40`, backgroundColor: `${ACCENT}14`, color: ACCENT }}
        >
          K
        </div>
      )}
      <div
        className={`max-w-[min(100%,520px)] min-w-0 rounded-[18px] border px-4 py-3.5 ${
          isUser
            ? 'bg-[#1C1A18] border-white/8 text-white'
            : 'bg-[#0B0A09] border-white/5 text-white/92'
        }`}
        style={
          !isUser
            ? { boxShadow: `inset 3px 0 0 0 ${ACCENT}55` }
            : undefined
        }
      >
        <div className="flex flex-col gap-1.5 min-w-0">
          <span className="text-[10px] font-black tracking-wider text-[#9B9691] leading-none font-mono uppercase">
            {isUser ? 'You' : 'Kylie'}
          </span>
          {isUser ? (
            <p className="text-[13px] sm:text-sm font-semibold leading-relaxed whitespace-pre-wrap break-words font-satoshi">
              {message.content}
            </p>
          ) : (
            <AgenticMarkdown content={message.content} />
          )}
        </div>
      </div>
    </div>
  );
}

export function PublicAgentUnavailable({ kind }: { kind: 'session' | 'message' }) {
  return <AccessUnavailable kind={kind} />;
}

export function PublicAgentSessionView({
  title,
  messages,
  updatedAt,
}: {
  title: string;
  messages: PublicAgentMessage[];
  updatedAt?: string;
}) {
  return (
    <div className="min-h-[70vh] bg-[#0A0908] text-white relative overflow-x-hidden">
      <div
        className="pointer-events-none absolute top-0 left-1/2 -translate-x-1/2 w-full max-w-[900px] h-[220px]"
        style={{
          background: 'radial-gradient(ellipse 70% 100% at 50% 0%, rgba(99,102,241,0.08) 0%, transparent 70%)',
        }}
      />

      <div className="relative mx-auto max-w-3xl px-4 sm:px-6 py-8 sm:py-10">
        <SharedWorkspaceBar objectType="session" />

        <header className="rounded-[28px] border border-[#34322F] bg-[#161412] mb-6 overflow-hidden">
          <div className="flex items-start gap-3.5 p-5 sm:p-6">
            <div
              className="w-12 h-12 rounded-2xl flex-shrink-0 grid place-items-center border"
              style={{ borderColor: `${ACCENT}40`, backgroundColor: `${ACCENT}14`, color: ACCENT }}
            >
              <Bot className="h-5 w-5" />
            </div>
            <div className="min-w-0 flex-1 flex flex-col gap-1.5">
              <span className="font-mono text-[10px] uppercase tracking-[0.18em] text-[#818CF8]">
                Shared chat
              </span>
              <h1 className="text-xl sm:text-2xl font-bold font-clash text-white leading-snug break-words">
                {title}
              </h1>
              <div className="flex flex-wrap items-center gap-2 pt-0.5">
                <span className="inline-flex items-center gap-1.5 rounded-lg border border-[#2C2A28] bg-[#1C1A18] px-2.5 py-1 text-[10px] font-mono font-bold uppercase tracking-wider text-[#9B9691]">
                  <MessageSquare className="h-3 w-3 flex-shrink-0" />
                  {messages.length} {messages.length === 1 ? 'message' : 'messages'}
                </span>
                {updatedAt ? (
                  <span className="text-[10px] font-mono font-bold uppercase tracking-wider text-[#6B6762]">
                    Updated {new Date(updatedAt).toLocaleDateString()}
                  </span>
                ) : null}
              </div>
            </div>
          </div>
        </header>

        <div className="rounded-[28px] border border-[#34322F] bg-[#161412] p-4 sm:p-5">
          <div className="flex flex-col gap-3.5">
            {messages.length === 0 ? (
              <p className="text-sm text-[#9B9691] font-satoshi leading-relaxed px-1 py-6 text-center">
                This shared chat has no messages yet.
              </p>
            ) : (
              messages.map((m) => <MessageBubble key={m.id} message={m} />)
            )}
          </div>
        </div>

        <p className="mt-8 text-xs text-[#6B6762] font-satoshi leading-relaxed">
          Read-only view. Sign in to start your own chat with Kylie.
        </p>
      </div>
    </div>
  );
}

export function PublicAgentMessageView({
  message,
  sessionId,
}: {
  message: PublicAgentMessage;
  sessionId: string;
}) {
  return (
    <div className="min-h-[70vh] bg-[#0A0908] text-white relative overflow-x-hidden">
      <div
        className="pointer-events-none absolute top-0 left-1/2 -translate-x-1/2 w-full max-w-[900px] h-[220px]"
        style={{
          background: 'radial-gradient(ellipse 70% 100% at 50% 0%, rgba(99,102,241,0.08) 0%, transparent 70%)',
        }}
      />

      <div className="relative mx-auto max-w-3xl px-4 sm:px-6 py-8 sm:py-10">
        <SharedWorkspaceBar objectType="message" />

        <header className="rounded-[28px] border border-[#34322F] bg-[#161412] mb-6 overflow-hidden">
          <div className="flex items-start gap-3.5 p-5 sm:p-6">
            <div
              className="w-12 h-12 rounded-2xl flex-shrink-0 grid place-items-center border"
              style={{ borderColor: `${ACCENT}40`, backgroundColor: `${ACCENT}14`, color: ACCENT }}
            >
              <MessageSquare className="h-5 w-5" />
            </div>
            <div className="min-w-0 flex-1 flex flex-col gap-1.5">
              <span className="font-mono text-[10px] uppercase tracking-[0.18em] text-[#818CF8]">
                Shared {message.role === 'assistant' ? 'reply' : 'prompt'}
              </span>
              <h1 className="text-xl sm:text-2xl font-bold font-clash text-white leading-snug">
                From a chat with Kylie
              </h1>
              <p className="text-xs text-[#9B9691] font-satoshi leading-relaxed">
                Only this message was shared — not the full conversation.
              </p>
            </div>
          </div>
        </header>

        <div className="rounded-[28px] border border-[#34322F] bg-[#161412] p-4 sm:p-5">
          <MessageBubble message={message} />
        </div>

        <div className="mt-6">
          <Link
            href={`/agents/session/${sessionId}`}
            className="inline-flex items-center justify-center rounded-xl border border-white/10 bg-white/[0.03] px-4 py-2.5 text-xs font-bold text-white/70 hover:text-white hover:bg-white/[0.06] transition-colors font-satoshi"
          >
            Try opening the full session
          </Link>
        </div>

        <p className="mt-8 text-xs text-[#6B6762] font-satoshi leading-relaxed">
          Read-only view. Full session opens only if the owner shared it too.
        </p>
      </div>
    </div>
  );
}
