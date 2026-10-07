'use client';

import React, { useState, useEffect, Suspense } from 'react';
import { useSearchParams } from 'next/navigation';
import Link from 'next/link';
import {
  Bot,
  ExternalLink,
  ShieldCheck,
  CheckCircle2,
  ArrowRight,
  Sparkles,
  KeyRound,
  FileText,
  CheckSquare,
  Compass,
  Copy,
  Check,
  Loader2,
} from 'lucide-react';

const DEFAULT_PERMISSIONS = '277025778752';

export default function DiscordConnectPage() {
  return (
    <Suspense
      fallback={
        <div className="min-h-screen bg-[#000000] text-white flex items-center justify-center font-mono text-sm">
          <Loader2 className="animate-spin text-[#5865F2]" size={24} />
        </div>
      }
    >
      <DiscordConnectContent />
    </Suspense>
  );
}

function DiscordConnectContent() {
  const searchParams = useSearchParams();
  const queryAppId = searchParams.get('client_id') || searchParams.get('app_id') || '';
  const autoRedirect = searchParams.get('auto') === 'true' || searchParams.get('redirect') === 'true';

  const [applicationId, setApplicationId] = useState<string>(
    queryAppId || process.env.NEXT_PUBLIC_DISCORD_APPLICATION_ID || ''
  );
  const [installUrl, setInstallUrl] = useState<string>('');
  const [loading, setLoading] = useState<boolean>(true);
  const [copiedCmd, setCopiedCmd] = useState<string | null>(null);

  useEffect(() => {
    let isMounted = true;

    async function fetchDiscordConfig() {
      try {
        const res = await fetch('/api/discord', { headers: { Accept: 'application/json' } });
        const data = await res.json();
        if (isMounted && data.ok) {
          const resolvedId = queryAppId || data.applicationId || process.env.NEXT_PUBLIC_DISCORD_APPLICATION_ID || '';
          if (resolvedId) {
            setApplicationId(resolvedId);
            const resolvedUrl =
              data.installUrl ||
              `https://discord.com/oauth2/authorize?client_id=${resolvedId}&scope=bot+applications.commands&permissions=${DEFAULT_PERMISSIONS}&integration_type=0,1`;
            setInstallUrl(resolvedUrl);

            if (autoRedirect && resolvedUrl) {
              window.location.href = resolvedUrl;
            }
          }
        }
      } catch {
        // Fallback to queryAppId if API is unreachable
        if (queryAppId) {
          const fallbackUrl = `https://discord.com/oauth2/authorize?client_id=${queryAppId}&scope=bot+applications.commands&permissions=${DEFAULT_PERMISSIONS}&integration_type=0,1`;
          setInstallUrl(fallbackUrl);
        }
      } finally {
        if (isMounted) setLoading(false);
      }
    }

    fetchDiscordConfig();

    return () => {
      isMounted = false;
    };
  }, [queryAppId, autoRedirect]);

  const effectiveInstallUrl =
    installUrl ||
    (applicationId
      ? `https://discord.com/oauth2/authorize?client_id=${applicationId}&scope=bot+applications.commands&permissions=${DEFAULT_PERMISSIONS}&integration_type=0,1`
      : '');

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text);
    setCopiedCmd(text);
    setTimeout(() => setCopiedCmd(null), 2000);
  };

  return (
    <div className="min-h-screen bg-[#000000] text-white flex flex-col items-center justify-center p-4 selection:bg-[#5865F2]/30">
      <div className="w-full max-w-xl bg-[#161412] border-2 border-white/20 rounded-[28px] p-6 md:p-8 shadow-2xl space-y-6">
        {/* Header */}
        <div className="text-center space-y-3">
          <div className="w-16 h-16 rounded-2xl bg-[#5865F2]/10 text-[#5865F2] border-2 border-[#5865F2]/30 flex items-center justify-center mx-auto shadow-lg relative">
            <Bot size={32} />
            <span className="absolute -bottom-1 -right-1 w-4 h-4 rounded-full bg-emerald-500 border-2 border-[#161412]" />
          </div>
          <div>
            <h1 className="text-2xl font-black font-mono tracking-tight text-white">
              Connect Kylrix to Discord
            </h1>
            <p className="text-xs text-white/60 font-sans mt-1">
              Add the official Kylrix bot to your Discord servers or user account to manage ideas, goals, and agent workflows.
            </p>
          </div>
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-white/5 border border-white/10 text-[11px] font-mono text-emerald-400">
            <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
            Slash Commands & Interactions Ready
          </div>
        </div>

        {/* Primary Install Action */}
        <div className="bg-[#000000] border-2 border-white/15 rounded-2xl p-5 space-y-4">
          <div className="flex items-start justify-between gap-3">
            <div>
              <h2 className="text-sm font-black font-mono text-white flex items-center gap-2">
                <Sparkles size={16} className="text-[#5865F2]" />
                Step 1: Install Discord Application
              </h2>
              <p className="text-xs text-white/50 mt-1">
                Install to your Discord account as a User App or invite to servers you manage.
              </p>
            </div>
            <span className="px-2 py-0.5 rounded bg-[#5865F2]/20 border border-[#5865F2]/40 text-[#5865F2] text-[10px] font-mono font-bold shrink-0">
              OAuth 2.0
            </span>
          </div>

          {loading ? (
            <div className="w-full py-3.5 rounded-xl bg-white/5 border-2 border-white/10 text-white/40 font-mono text-xs flex items-center justify-center gap-2">
              <Loader2 className="animate-spin" size={16} />
              Resolving Discord Bot ID...
            </div>
          ) : effectiveInstallUrl ? (
            <a
              href={effectiveInstallUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="w-full py-3.5 rounded-xl bg-[#5865F2] hover:bg-[#4752C4] text-white font-black text-xs font-mono flex items-center justify-center gap-2 transition-all cursor-pointer border-2 border-[#5865F2] shadow-lg hover:scale-[1.01] active:scale-[0.99]"
            >
              <span>Add to Discord</span>
              <ExternalLink size={15} />
            </a>
          ) : (
            <div className="space-y-3">
              <p className="text-xs text-amber-400/90 font-mono">
                Set DISCORD_APPLICATION_ID in your environment, or pass ?client_id=YOUR_APP_ID in the URL.
              </p>
              <div className="flex gap-2">
                <input
                  type="text"
                  placeholder="Paste Discord Application ID"
                  value={applicationId}
                  onChange={(e) => setApplicationId(e.target.value.trim())}
                  className="flex-1 bg-[#161412] border border-white/20 rounded-xl px-3 py-2 text-xs font-mono text-white placeholder-white/30 focus:border-[#5865F2] outline-none"
                />
                <button
                  type="button"
                  onClick={() => {
                    if (applicationId) {
                      setInstallUrl(
                        `https://discord.com/oauth2/authorize?client_id=${applicationId}&scope=bot+applications.commands&permissions=${DEFAULT_PERMISSIONS}&integration_type=0,1`
                      );
                    }
                  }}
                  className="px-4 py-2 rounded-xl bg-white/10 hover:bg-white/20 text-xs font-mono text-white border border-white/20 transition-colors"
                >
                  Generate Link
                </button>
              </div>
            </div>
          )}
        </div>

        {/* Step 2: Link & Pair Workspace */}
        <div className="bg-[#000000] border-2 border-white/15 rounded-2xl p-5 space-y-3">
          <div className="flex items-start justify-between gap-3">
            <div>
              <h2 className="text-sm font-black font-mono text-white flex items-center gap-2">
                <KeyRound size={16} className="text-emerald-400" />
                Step 2: Link Workspace (/pair)
              </h2>
              <p className="text-xs text-white/50 mt-1">
                After adding the bot, type <code className="text-white font-mono bg-white/10 px-1 py-0.5 rounded">/pair</code> in Discord to receive your 8-character verification code, then enter it here to link your workspace.
              </p>
            </div>
          </div>

          <Link
            href="/pair"
            className="w-full py-2.5 rounded-xl bg-white/10 hover:bg-white/15 text-white font-bold text-xs font-mono flex items-center justify-center gap-2 transition-all border border-white/20"
          >
            <span>Open Pairing Screen (/pair)</span>
            <ArrowRight size={14} />
          </Link>
        </div>

        {/* Command Reference */}
        <div className="space-y-3">
          <h3 className="text-xs font-mono font-bold text-white/60 uppercase tracking-wider">
            Available Slash Commands
          </h3>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-xs font-mono">
            {[
              { cmd: '/pair', desc: 'Link Discord user to your workspace', icon: KeyRound },
              { cmd: '/ideas', desc: 'Browse your recent sovereign ideas', icon: FileText },
              { cmd: '/idea', desc: 'Quick capture idea directly into Kylrix', icon: FileText },
              { cmd: '/goals', desc: 'List active priorities and milestones', icon: CheckSquare },
              { cmd: '/goal_done', desc: 'Complete a goal by title or ID', icon: CheckCircle2 },
              { cmd: '/menu', desc: 'Open interactive bot control card', icon: Compass },
            ].map(({ cmd, desc, icon: Icon }) => (
              <button
                key={cmd}
                type="button"
                onClick={() => copyToClipboard(cmd)}
                className="bg-[#000000] border border-white/10 hover:border-white/30 rounded-xl p-2.5 flex items-center justify-between text-left transition-colors group cursor-pointer"
              >
                <div className="flex items-center gap-2 min-w-0">
                  <Icon size={14} className="text-[#5865F2] shrink-0" />
                  <div className="min-w-0">
                    <span className="font-bold text-white block">{cmd}</span>
                    <span className="text-[10px] text-white/50 truncate block">{desc}</span>
                  </div>
                </div>
                {copiedCmd === cmd ? (
                  <Check size={12} className="text-emerald-400 shrink-0" />
                ) : (
                  <Copy size={12} className="text-white/30 group-hover:text-white/70 shrink-0" />
                )}
              </button>
            ))}
          </div>
        </div>

        {/* Security & Verification Callout */}
        <div className="flex items-start gap-3 p-3.5 rounded-xl bg-white/[0.03] border border-white/10 text-xs text-white/60">
          <ShieldCheck size={18} className="text-emerald-400 shrink-0 mt-0.5" />
          <p className="leading-relaxed">
            Interactions are verified with Ed25519 signatures. Access tokens are scoped to your user account and never exposed in Discord channels.
          </p>
        </div>
      </div>
    </div>
  );
}
