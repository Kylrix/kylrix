'use client';

import React, { useState, useCallback } from 'react';
import { useAuth } from '@/context/auth/AuthContext';
import Link from 'next/link';
import {
  FileText,
  Bot,
  Copy,
  CheckCircle2,
  Share2,
  X,
  Code,
  Terminal,
  Sparkles,
  Link as LinkIcon
} from 'lucide-react';

export interface SharedObjectData {
  title?: string;
  content?: string;
  description?: string;
  status?: string;
  priority?: string;
  dueDate?: string;
  type?: string;
  id?: string;
  url?: string;
  fields?: Array<{ label: string; value: string }>;
  rawJson?: any;
}

interface SharedWorkspaceBarProps {
  objectType: 'note' | 'goal' | 'form' | 'event' | 'call' | 'session' | 'message' | 'credential' | 'totp' | string;
  itemData?: SharedObjectData;
  hideWorkspaceButton?: boolean;
}

export function SharedWorkspaceBar({ objectType, itemData, hideWorkspaceButton }: SharedWorkspaceBarProps) {
  const { isAuthenticated, isLoading } = useAuth();
  const [copiedField, setCopiedField] = useState<string | null>(null);
  const [showAgentModal, setShowAgentModal] = useState(false);
  const [activeTab, setActiveTab] = useState<'claude' | 'cursor' | 'codex' | 'raw'>('claude');

  const getPageUrl = useCallback(() => {
    if (typeof window !== 'undefined') {
      return window.location.href;
    }
    return itemData?.url || '';
  }, [itemData?.url]);

  const generateMarkdown = useCallback(() => {
    const title = itemData?.title || `Shared ${objectType}`;
    const pageUrl = getPageUrl();
    const content = itemData?.content || itemData?.description || '';

    let md = `# ${title}\n\n`;
    md += `> **Source**: [Kylrix Shared ${objectType}](${pageUrl})\n`;
    if (itemData?.status) md += `> **Status**: ${itemData.status}\n`;
    if (itemData?.priority) md += `> **Priority**: ${itemData.priority}\n`;
    if (itemData?.dueDate) md += `> **Due Date**: ${itemData.dueDate}\n`;
    md += `\n`;

    if (content) {
      md += `## Details\n\n${content}\n\n`;
    }

    if (itemData?.fields && itemData.fields.length > 0) {
      md += `## Fields\n\n`;
      for (const f of itemData.fields) {
        md += `- **${f.label}**: ${f.value}\n`;
      }
      md += `\n`;
    }

    md += `---\n*Exported from Kylrix Sovereign Agent Memory* (${pageUrl})\n`;
    return md;
  }, [itemData, objectType, getPageUrl]);

  const handleCopyMarkdown = useCallback(async () => {
    try {
      const md = generateMarkdown();
      await navigator.clipboard.writeText(md);
      setCopiedField('markdown');
      setTimeout(() => setCopiedField(null), 2000);
    } catch {
      // Fallback
    }
  }, [generateMarkdown]);

  const handleCopyLink = useCallback(async () => {
    try {
      const url = getPageUrl();
      await navigator.clipboard.writeText(url);
      setCopiedField('link');
      setTimeout(() => setCopiedField(null), 2000);
    } catch {
      // Fallback
    }
  }, [getPageUrl]);

  const getAgentSnippet = useCallback((target: 'claude' | 'cursor' | 'codex' | 'raw') => {
    const url = getPageUrl();
    const title = itemData?.title || `Shared ${objectType}`;
    const md = generateMarkdown();

    if (target === 'claude') {
      return `# Share with Claude Code
# Run this command in your terminal to feed this shared context to Claude Code:
claude "Read and inspect shared context from ${url} for '${title}'"

# Or pass directly as prompt context:
claude "${md.replace(/"/g, '\\"')}"`;
    }

    if (target === 'cursor') {
      return `/* Cursor / Windsurf Agent Prompt */
Please review and import the following shared ${objectType} context from Kylrix:

${md}

URL: ${url}`;
    }

    if (target === 'codex') {
      return `/* OpenAI Codex / Custom Agent Instruction */
SYSTEM: You are receiving sovereign context from Kylrix.
RESOURCE_TYPE: ${objectType}
RESOURCE_URL: ${url}

DATA_PAYLOAD:
${md}`;
    }

    return JSON.stringify(
      {
        type: objectType,
        url,
        title,
        content: itemData?.content || itemData?.description || null,
        metadata: {
          status: itemData?.status,
          priority: itemData?.priority,
          fields: itemData?.fields,
        },
      },
      null,
      2
    );
  }, [getPageUrl, itemData, objectType, generateMarkdown]);

  const handleCopyAgentPrompt = useCallback(async (target: 'claude' | 'cursor' | 'codex' | 'raw') => {
    try {
      const snippet = getAgentSnippet(target);
      await navigator.clipboard.writeText(snippet);
      setCopiedField(`agent-${target}`);
      setTimeout(() => setCopiedField(null), 2000);
    } catch {
      // Fallback
    }
  }, [getAgentSnippet]);

  if (isLoading) return null;

  return (
    <>
      <div className="w-full max-w-3xl mx-auto mb-6">
        <div className="relative overflow-hidden rounded-2xl border border-[#34322F] bg-[#161412] p-4 transition-all duration-300 hover:border-white/10">
          {/* Subtle ambient light */}
          <div className="absolute top-0 left-0 w-full h-[1px] bg-gradient-to-r from-transparent via-[#6366F1]/30 to-transparent pointer-events-none" />

          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
            {/* Left Header Info */}
            <div className="flex items-center gap-3 min-w-0">
              <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-[#0B0A09] border border-white/5 font-mono text-xs font-black text-[#6366F1]">
                KX
              </div>
              <div className="min-w-0 flex-1 flex flex-col gap-0.5">
                <p className="text-xs font-bold text-white font-satoshi leading-snug truncate">
                  Viewing shared {objectType}
                </p>
                <p className="text-[10px] font-bold text-[#9B9691] font-mono tracking-wide uppercase leading-snug">
                  {isAuthenticated ? 'Workspace active' : 'Read-only view'}
                </p>
              </div>
            </div>

            {/* Action Buttons */}
            <div className="flex flex-wrap items-center gap-2 flex-shrink-0">
              {/* Copy as Markdown */}
              <button
                type="button"
                onClick={handleCopyMarkdown}
                className="inline-flex items-center gap-1.5 rounded-xl bg-[#0B0A09] border border-white/8 px-3 py-1.5 text-xs font-bold text-white/80 hover:text-white hover:bg-white/5 hover:border-white/15 transition-all font-satoshi"
                title="Copy context formatted as Markdown"
              >
                {copiedField === 'markdown' ? (
                  <>
                    <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400" />
                    <span className="text-emerald-400">Copied MD</span>
                  </>
                ) : (
                  <>
                    <FileText className="w-3.5 h-3.5 text-[#6366F1]" />
                    <span>Copy as Markdown</span>
                  </>
                )}
              </button>

              {/* Share with Agent */}
              <button
                type="button"
                onClick={() => setShowAgentModal(true)}
                className="inline-flex items-center gap-1.5 rounded-xl bg-[#6366F1]/10 border border-[#6366F1]/30 px-3 py-1.5 text-xs font-bold text-[#A855F7] hover:bg-[#6366F1]/20 hover:border-[#6366F1]/50 transition-all font-satoshi"
                title="Format context for AI agents (Claude Code, Cursor, Codex)"
              >
                <Bot className="w-3.5 h-3.5" />
                <span>Share with Agent</span>
              </button>

              {/* Copy Link */}
              <button
                type="button"
                onClick={handleCopyLink}
                className="inline-flex items-center gap-1.5 rounded-xl bg-[#0B0A09] border border-white/8 p-1.5 text-xs font-bold text-white/70 hover:text-white hover:bg-white/5 transition-all"
                title="Copy share link"
              >
                {copiedField === 'link' ? (
                  <CheckCircle2 className="w-4 h-4 text-emerald-400" />
                ) : (
                  <LinkIcon className="w-4 h-4" />
                )}
              </button>

              {/* Workspace CTA Button */}
              {!hideWorkspaceButton && (
                isAuthenticated ? (
                  <Link
                    href="/app"
                    className="inline-flex items-center justify-center rounded-xl bg-[#0B0A09] border border-white/8 px-3 py-1.5 text-xs font-bold text-white hover:bg-white/5 hover:border-white/15 transition-all font-satoshi"
                  >
                    Workspace
                  </Link>
                ) : (
                  <Link
                    href="/app"
                    className="inline-flex items-center justify-center rounded-xl bg-[#6366F1] px-3 py-1.5 text-xs font-black text-white hover:bg-[#5254E8] transition-all font-satoshi"
                  >
                    Join Kylrix
                  </Link>
                )
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Share with Agent Modal */}
      {showAgentModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-in fade-in duration-200">
          <div
            className="relative w-full max-w-2xl overflow-hidden rounded-2xl border border-white/15 bg-[#161412] p-6 shadow-2xl"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Modal Header */}
            <div className="flex items-center justify-between pb-4 border-b border-white/10">
              <div className="flex items-center gap-3">
                <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-[#6366F1]/10 border border-[#6366F1]/30 text-[#A855F7]">
                  <Sparkles className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-base font-bold text-white font-clash">
                    Share Context with AI Agent
                  </h3>
                  <p className="text-xs text-white/50">
                    Prompt snippets configured for Claude Code, Cursor, Codex, and raw JSON.
                  </p>
                </div>
              </div>

              <button
                type="button"
                onClick={() => setShowAgentModal(false)}
                className="rounded-lg p-1.5 text-white/50 hover:bg-white/10 hover:text-white transition-all"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Modal Tabs */}
            <div className="flex items-center gap-2 mt-4 pb-3 border-b border-white/5 overflow-x-auto">
              <button
                type="button"
                onClick={() => setActiveTab('claude')}
                className={`flex items-center gap-2 px-3 py-1.5 rounded-lg text-xs font-bold transition-all ${
                  activeTab === 'claude'
                    ? 'bg-[#6366F1] text-white'
                    : 'bg-white/5 text-white/60 hover:text-white hover:bg-white/10'
                }`}
              >
                <Terminal className="w-3.5 h-3.5" />
                Claude Code
              </button>

              <button
                type="button"
                onClick={() => setActiveTab('cursor')}
                className={`flex items-center gap-2 px-3 py-1.5 rounded-lg text-xs font-bold transition-all ${
                  activeTab === 'cursor'
                    ? 'bg-[#6366F1] text-white'
                    : 'bg-white/5 text-white/60 hover:text-white hover:bg-white/10'
                }`}
              >
                <Code className="w-3.5 h-3.5" />
                Cursor / Windsurf
              </button>

              <button
                type="button"
                onClick={() => setActiveTab('codex')}
                className={`flex items-center gap-2 px-3 py-1.5 rounded-lg text-xs font-bold transition-all ${
                  activeTab === 'codex'
                    ? 'bg-[#6366F1] text-white'
                    : 'bg-white/5 text-white/60 hover:text-white hover:bg-white/10'
                }`}
              >
                <Bot className="w-3.5 h-3.5" />
                Codex / Custom AI
              </button>

              <button
                type="button"
                onClick={() => setActiveTab('raw')}
                className={`flex items-center gap-2 px-3 py-1.5 rounded-lg text-xs font-bold transition-all ${
                  activeTab === 'raw'
                    ? 'bg-[#6366F1] text-white'
                    : 'bg-white/5 text-white/60 hover:text-white hover:bg-white/10'
                }`}
              >
                <Share2 className="w-3.5 h-3.5" />
                Raw JSON
              </button>
            </div>

            {/* Modal Content */}
            <div className="mt-4">
              <div className="relative rounded-xl border border-white/10 bg-[#0B0A09] p-4 font-mono text-xs text-emerald-400 max-h-64 overflow-y-auto whitespace-pre-wrap break-all select-all">
                {getAgentSnippet(activeTab)}
              </div>
            </div>

            {/* Modal Footer */}
            <div className="flex items-center justify-between mt-5 pt-4 border-t border-white/10">
              <span className="text-[11px] text-white/40">
                Tip: Kylrix CLI (`kylrix exec`) can also inject credentials directly into agent processes.
              </span>

              <button
                type="button"
                onClick={() => handleCopyAgentPrompt(activeTab)}
                className="flex items-center gap-2 rounded-xl bg-[#6366F1] hover:bg-[#5254E8] px-4 py-2 text-xs font-bold text-white transition-all shadow-lg shadow-[#6366F1]/20"
              >
                {copiedField === `agent-${activeTab}` ? (
                  <>
                    <CheckCircle2 className="w-4 h-4 text-emerald-300" />
                    <span>Copied Agent Prompt!</span>
                  </>
                ) : (
                  <>
                    <Copy className="w-4 h-4" />
                    <span>Copy Prompt Snippet</span>
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
