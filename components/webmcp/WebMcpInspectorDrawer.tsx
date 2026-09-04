'use client';

import React, { useState, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { useWebMcpContext } from '@/context/WebMcpContext';
import {
  X,
  Play,
  Terminal,
  Activity,
  Copy,
  Check,
  Trash2,
  Layers,
  Sparkles,
  Info,
  Bot,
  Send,
  Loader2,
} from 'lucide-react';
import { toast } from 'react-hot-toast';
import type { WebMcpToolDefinition } from '@/lib/webmcp/types';
import { NativeSidebarMount } from '@/components/layout/NativeSidebarMount';
import { useNativeSidebarApiOptional } from '@/context/RightRailContext';

export function WebMcpInspectorDrawer() {
  const {
    isInspectorOpen,
    closeInspector,
    tools,
    executionHistory,
    executeTool,
    clearHistory,
  } = useWebMcpContext();

  const [mounted, setMounted] = useState(false);
  const nativeSidebar = useNativeSidebarApiOptional();
  const [isDesktop, setIsDesktop] = useState(false);

  useEffect(() => {
    const updateMedia = () => {
      setIsDesktop(typeof window !== 'undefined' && window.innerWidth >= 768);
    };
    updateMedia();
    window.addEventListener('resize', updateMedia);
    return () => window.removeEventListener('resize', updateMedia);
  }, []);
  const [activeTab, setActiveTab] = useState<'tools' | 'ai-tester' | 'runner' | 'logs' | 'setup'>('tools');
  const [selectedTool, setSelectedTool] = useState<WebMcpToolDefinition | null>(null);
  const [inputArgs, setInputArgs] = useState<string>('{}');
  const [executing, setExecuting] = useState(false);
  const [copiedCode, setCopiedCode] = useState(false);
  const [lastResult, setLastResult] = useState<any>(null);
  // AI Tester (Localhost Dev only)
  const [aiPrompt, setAiPrompt] = useState('');
  const [aiLoading, setAiLoading] = useState(false);
  const [aiMessages, setAiMessages] = useState<Array<{ role: 'user' | 'agent' | 'tool'; content: string; toolCalls?: any[] }>>([]);
  const [isLocalhost, setIsLocalhost] = useState(false);

  useEffect(() => {
    if (typeof window !== 'undefined') {
      const host = window.location.hostname;
      setIsLocalhost(host === 'localhost' || host === '127.0.0.1');
    }
  }, []);

  const handleSendAiPrompt = async (promptToSend?: string) => {
    const query = (promptToSend || aiPrompt).trim();
    if (!query || aiLoading) return;

    setAiPrompt('');
    setAiLoading(true);
    setAiMessages((prev) => [...prev, { role: 'user', content: query }]);

    try {
      const res = await fetch('/api/dev/webmcp-agent', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          prompt: query,
          tools: tools.map((t) => ({
            name: t.name,
            description: t.description,
            inputSchema: t.inputSchema,
          })),
        }),
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || 'AI Agent test failed');
      }

      if (data.functionCalls && data.functionCalls.length > 0) {
        for (const call of data.functionCalls) {
          setAiMessages((prev) => [
            ...prev,
            {
              role: 'agent',
              content: 'Invoking WebMCP Tool: `' + call.name + '`',
              toolCalls: [call],
            },
          ]);

          try {
            const execRes = await executeTool(call.name, call.args || {});
            setAiMessages((prev) => [
              ...prev,
              {
                role: 'tool',
                content: 'Tool Result (' + call.name + '):\n' + JSON.stringify(execRes, null, 2),
              },
            ]);
            if (execRes.isError) {
              toast.error('WebMCP tool ' + call.name + ' error');
            } else {
              toast.success('WebMCP executed ' + call.name + '!');
            }
          } catch (e: any) {
            setAiMessages((prev) => [
              ...prev,
              {
                role: 'tool',
                content: 'Execution Exception: ' + (e?.message || 'Failed to run tool'),
              },
            ]);
          }
        }
      }

      if (data.text) {
        setAiMessages((prev) => [...prev, { role: 'agent', content: data.text }]);
      }
    } catch (err: any) {
      toast.error(err?.message || 'AI Tester error');
      setAiMessages((prev) => [
        ...prev,
        { role: 'agent', content: '⚠️ Error: ' + (err?.message || 'Failed to fetch AI agent response.') },
      ]);
    } finally {
      setAiLoading(false);
    }
  };

  useEffect(() => {
    setMounted(true);
  }, []);

  // Update selectedTool when tools list changes or on initial open
  useEffect(() => {
    if (!selectedTool && tools.length > 0) {
      setSelectedTool(tools[0]);
    }
  }, [tools, selectedTool]);

  // Handle ESC key to exit cleanly
  useEffect(() => {
    if (!isInspectorOpen) return;
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        closeInspector();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isInspectorOpen, closeInspector]);

  if (!mounted) return null;

  const handleSelectTool = (tool: WebMcpToolDefinition) => {
    setSelectedTool(tool);
    // Populate sample args from inputSchema
    const sample: Record<string, any> = {};
    if (tool.inputSchema.properties) {
      for (const [key, prop] of Object.entries(tool.inputSchema.properties)) {
        if (prop.type === 'string') sample[key] = (prop as any).default || '';
        else if (prop.type === 'number') sample[key] = (prop as any).default || 25;
        else if (prop.type === 'boolean') sample[key] = (prop as any).default || false;
        else if (prop.type === 'array') sample[key] = [];
        else if (prop.type === 'object') sample[key] = {};
      }
    }
    setInputArgs(JSON.stringify(sample, null, 2));
    setLastResult(null);
  };

  const handleRunSelected = async () => {
    if (!selectedTool) return;
    setExecuting(true);
    try {
      let parsed = {};
      try {
        parsed = JSON.parse(inputArgs || '{}');
      } catch (_err: any) {
        toast.error('Invalid JSON arguments');
        setExecuting(false);
        return;
      }

      const res = await executeTool(selectedTool.name, parsed);
      setLastResult(res);
      if (res.isError) {
        toast.error(`Tool execution failed: ${selectedTool.name}`);
      } else {
        toast.success(`Executed ${selectedTool.name}`);
      }
    } catch (err: any) {
      toast.error(err?.message || 'Execution error');
    } finally {
      setExecuting(false);
    }
  };

  const copyJsSnippet = () => {
    if (!selectedTool) return;
    const snippet = `// WebMCP In-Browser Invocation\nconst res = await navigator.modelContext.executeTool("${selectedTool.name}", ${inputArgs});\nconsole.log(res);`;
    navigator.clipboard.writeText(snippet);
    setCopiedCode(true);
    setTimeout(() => setCopiedCode(false), 2000);
    toast.success('Copied JS invocation snippet');
  };

  const inspectorContent = (
    <div className="flex flex-col h-full min-h-0 w-full bg-[#161412] text-[#FFFFFF] overflow-hidden select-none font-satoshi">
      {/* Sticky Header with prominent close button */}
      <div className="px-5 py-4 border-b border-white/[0.08] flex items-center justify-between bg-[#161412] shrink-0">
        <div className="flex items-center gap-3.5 min-w-0">
          <div className="w-10 h-10 rounded-xl bg-emerald-500/10 border border-emerald-500/40 flex items-center justify-center text-emerald-400 shrink-0">
            <Terminal className="w-5 h-5" />
          </div>
          <div className="min-w-0">
            <div className="flex items-center gap-2">
              <h2 className="text-base font-extrabold text-[#FFFFFF] tracking-tight truncate font-clash">WebMCP Inspector</h2>
              <span className="text-xs uppercase font-mono font-bold px-2 py-0.5 rounded-md bg-emerald-950 text-emerald-300 border border-emerald-700/80 shrink-0">
                W3C Standard
              </span>
            </div>
            <p className="text-xs text-[#FFFFFF] font-mono truncate mt-0.5 font-medium">
              navigator.modelContext • {tools.length} browser tools ready
            </p>
          </div>
        </div>

        <button
          type="button"
          onClick={closeInspector}
          aria-label="Close Inspector"
          className="p-2 rounded-xl bg-white/[0.06] hover:bg-white/15 border border-white/10 text-[#FFFFFF] transition-all cursor-pointer shrink-0 ml-2"
        >
          <X className="w-5 h-5" />
        </button>
      </div>

      {/* Tab Navigation */}
      <div className="flex border-b border-white/[0.08] bg-[#000000] px-3 overflow-x-auto no-scrollbar shrink-0">
        <button
          type="button"
          onClick={() => setActiveTab('tools')}
          className={`flex items-center gap-2 px-3.5 py-3 text-xs font-mono font-bold border-b-2 transition-all whitespace-nowrap cursor-pointer ${
            activeTab === 'tools'
              ? 'border-emerald-400 text-emerald-300 bg-emerald-500/10'
              : 'border-transparent text-[#FFFFFF] hover:bg-white/[0.04]'
          }`}
        >
          <Layers className="w-4 h-4" />
          Tools Catalog ({tools.length})
        </button>
        <button
          type="button"
          onClick={() => setActiveTab('ai-tester')}
          className={`flex items-center gap-2 px-3.5 py-3 text-xs font-mono font-bold border-b-2 transition-all whitespace-nowrap cursor-pointer ${
            activeTab === 'ai-tester'
              ? 'border-emerald-400 text-emerald-300 bg-emerald-500/10'
              : 'border-transparent text-[#FFFFFF] hover:bg-white/[0.04]'
          }`}
        >
          <Sparkles className="w-4 h-4 text-emerald-400" />
          AI Tester {isLocalhost ? '(Dev)' : ''}
        </button>
        <button
          type="button"
          onClick={() => setActiveTab('runner')}
          className={`flex items-center gap-2 px-3.5 py-3 text-xs font-mono font-bold border-b-2 transition-all whitespace-nowrap cursor-pointer ${
            activeTab === 'runner'
              ? 'border-emerald-400 text-emerald-300 bg-emerald-500/10'
              : 'border-transparent text-[#FFFFFF] hover:bg-white/[0.04]'
          }`}
        >
          <Play className="w-4 h-4" />
          Interactive Runner
        </button>
        <button
          type="button"
          onClick={() => setActiveTab('logs')}
          className={`flex items-center gap-2 px-3.5 py-3 text-xs font-mono font-bold border-b-2 transition-all whitespace-nowrap cursor-pointer ${
            activeTab === 'logs'
              ? 'border-emerald-400 text-emerald-300 bg-emerald-500/10'
              : 'border-transparent text-[#FFFFFF] hover:bg-white/[0.04]'
          }`}
        >
          <Activity className="w-4 h-4" />
          Live Logs ({executionHistory.length})
        </button>
        <button
          type="button"
          onClick={() => setActiveTab('setup')}
          className={`flex items-center gap-2 px-3.5 py-3 text-xs font-mono font-bold border-b-2 transition-all whitespace-nowrap cursor-pointer ${
            activeTab === 'setup'
              ? 'border-emerald-400 text-emerald-300 bg-emerald-500/10'
              : 'border-transparent text-[#FFFFFF] hover:bg-white/[0.04]'
          }`}
        >
          <Info className="w-4 h-4" />
          Integration & Flags
        </button>
      </div>

      {/* Tab Content */}
      <div className="flex-1 overflow-y-auto p-4 sm:p-5 space-y-4 pb-[calc(2rem+env(safe-area-inset-bottom,0px))]">
        {/* TAB 1: TOOLS CATALOG */}
        {activeTab === 'tools' && (
          <div className="space-y-3.5">
            <div className="p-4 bg-[#000000] border border-emerald-500/30 rounded-2xl text-xs text-[#FFFFFF] leading-relaxed">
              <span className="font-extrabold text-emerald-400 uppercase tracking-wider block mb-1">Browser-Native Tools</span>
              Visiting AI agents in Chrome or ChatGPT in-app browser discover and invoke these tools directly in this web page without plugins or backend credentials.
            </div>

            <div className="grid gap-3">
              {tools.map((t) => (
                <div
                  key={t.name}
                  className="p-4 rounded-2xl border border-white/[0.08] bg-[#000000] hover:border-emerald-500/50 transition-all flex flex-col gap-3"
                >
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <code className="text-sm font-bold text-emerald-400 font-mono">{t.name}</code>
                        {t.category && (
                          <span className="text-xs px-2 py-0.5 rounded bg-white/[0.08] text-[#FFFFFF] border border-white/[0.12] font-mono font-bold uppercase">
                            {t.category}
                          </span>
                        )}
                      </div>
                      <p className="text-sm text-[#FFFFFF] mt-1.5 leading-relaxed font-normal">{t.description}</p>
                    </div>
                    <button
                      type="button"
                      onClick={() => {
                        handleSelectTool(t);
                        setActiveTab('runner');
                      }}
                      className="px-3.5 py-2 text-xs rounded-xl bg-white/[0.08] hover:bg-emerald-600 hover:text-white border border-white/15 text-[#FFFFFF] font-mono font-bold flex items-center gap-1.5 transition-colors shrink-0 cursor-pointer"
                    >
                      <Play className="w-3.5 h-3.5 text-emerald-400" />
                      Run
                    </button>
                  </div>

                  <details className="text-xs font-mono text-[#FFFFFF] pt-2 border-t border-white/[0.08]">
                    <summary className="cursor-pointer hover:text-emerald-400 select-none py-1 font-bold">
                      View Input Schema
                    </summary>
                    <pre className="mt-2 p-3 rounded-xl bg-[#0A0908] border border-white/[0.08] overflow-x-auto text-emerald-300 text-xs leading-relaxed">
                      {JSON.stringify(t.inputSchema, null, 2)}
                    </pre>
                  </details>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* TAB: AI TESTER (DEV LOCALHOST ONLY) */}
        {activeTab === 'ai-tester' && (
          <div className="space-y-4 flex flex-col h-full min-h-0">
            {!isLocalhost ? (
              <div className="p-4 bg-[#000000] border border-amber-500/40 rounded-2xl space-y-2">
                <div className="flex items-center gap-2 text-amber-400 text-sm font-bold font-mono">
                  <span>🔒 Localhost Only Feature</span>
                </div>
                <p className="text-xs text-[#FFFFFF] leading-relaxed">
                  The live in-browser AI tool tester executes without subscription gating to allow rapid testing and development of WebMCP tools. For security and cost protection, this testing endpoint is restricted strictly to local dev environments (<code className="text-amber-300 font-mono">localhost:3005</code>).
                </p>
              </div>
            ) : (
              <>
                <div className="p-4 bg-[#000000] border border-emerald-500/30 rounded-2xl text-xs text-[#FFFFFF] leading-relaxed">
                  <div className="flex items-center justify-between mb-1.5">
                    <span className="font-extrabold text-emerald-400 flex items-center gap-1.5 text-sm">
                      <Sparkles className="w-4 h-4" />
                      WebMCP Browser-Native AI Tester
                    </span>
                    <span className="text-xs uppercase font-mono font-bold px-2 py-0.5 rounded bg-emerald-950 text-emerald-300 border border-emerald-700/80">
                      Localhost Active
                    </span>
                  </div>
                  <p className="text-xs text-[#FFFFFF] font-normal">
                    Type a natural language instruction below. The AI agent evaluates your prompt and dynamically invokes your live WebMCP tools in this web tab in real time.
                  </p>
                </div>

                {/* Sample prompts */}
                <div className="flex items-center gap-2 overflow-x-auto no-scrollbar pb-1 text-xs font-mono">
                  <span className="text-[#FFFFFF] shrink-0 text-xs uppercase font-extrabold tracking-wider">Try:</span>
                  {[
                    "create an idea titled 'into the unknown' talking bout uncertainties of adulthood",
                    "list all my current notes in this workspace",
                    "create a goal titled 'Launch WebMCP' with target 2026-10-01",
                  ].map((sample) => (
                    <button
                      key={sample}
                      type="button"
                      onClick={() => handleSendAiPrompt(sample)}
                      disabled={aiLoading}
                      className="px-3 py-1.5 rounded-lg bg-[#000000] hover:bg-white/15 border border-white/15 text-[#FFFFFF] truncate max-w-[280px] shrink-0 transition-colors cursor-pointer disabled:opacity-50 text-xs font-medium"
                    >
                      {sample}
                    </button>
                  ))}
                </div>

                {/* Message Stream */}
                <div className="flex-1 overflow-y-auto min-h-[260px] max-h-[420px] space-y-3 p-3.5 bg-[#000000] rounded-2xl border border-white/[0.08]">
                  {aiMessages.length === 0 && (
                    <div className="h-full flex flex-col items-center justify-center text-center py-12 text-[#FFFFFF] text-xs font-mono space-y-2">
                      <Bot className="w-10 h-10 text-emerald-400 mb-1" />
                      <p className="font-bold text-sm">No tests run yet.</p>
                      <p className="text-xs text-[#FFFFFF]">Enter a prompt below to see the agent discover and execute WebMCP tools.</p>
                    </div>
                  )}
                  {aiMessages.map((m, idx) => (
                    <div
                      key={idx}
                      className={`p-3.5 rounded-xl text-xs font-mono leading-relaxed ${
                        m.role === 'user'
                          ? 'bg-emerald-950/60 border border-emerald-500/40 text-emerald-100 ml-4'
                          : m.role === 'tool'
                          ? 'bg-[#000000] border border-white/15 text-[#FFFFFF] overflow-x-auto'
                          : 'bg-[#161412] border border-white/15 text-[#FFFFFF] mr-4'
                      }`}
                    >
                      <div className="flex items-center justify-between gap-2 mb-1.5 text-xs text-[#FFFFFF] uppercase font-bold">
                        <span>{m.role === 'user' ? 'User Prompt' : m.role === 'tool' ? 'Tool Output' : 'WebMCP Agent'}</span>
                      </div>
                      <pre className="whitespace-pre-wrap font-mono text-xs break-words text-[#FFFFFF]">{m.content}</pre>
                    </div>
                  ))}
                  {aiLoading && (
                    <div className="p-3.5 rounded-xl bg-[#000000] border border-white/15 text-xs font-mono flex items-center gap-2.5 text-[#FFFFFF]">
                      <Loader2 className="w-4 h-4 animate-spin text-emerald-400" />
                      <span className="font-bold">AI evaluating WebMCP tool declarations & executing...</span>
                    </div>
                  )}
                </div>

                {/* Input Form */}
                <form
                  onSubmit={(e) => {
                    e.preventDefault();
                    handleSendAiPrompt();
                  }}
                  className="flex items-center gap-2.5 pt-1"
                >
                  <input
                    type="text"
                    value={aiPrompt}
                    onChange={(e) => setAiPrompt(e.target.value)}
                    placeholder="Test prompt (e.g. create a note titled into the unknown)..."
                    disabled={aiLoading}
                    className="flex-1 bg-[#000000] border border-white/15 focus:border-emerald-500 text-[#FFFFFF] placeholder-white/50 text-xs font-mono rounded-xl px-4 py-3 focus:outline-none transition-colors disabled:opacity-50"
                  />
                  <button
                    type="submit"
                    disabled={aiLoading || !aiPrompt.trim()}
                    className="px-5 py-3 rounded-xl bg-emerald-600 hover:bg-emerald-500 disabled:opacity-50 text-white text-xs font-mono font-extrabold flex items-center gap-2 transition-all shadow-[0_2px_10px_rgba(16,185,129,0.3)] cursor-pointer"
                  >
                    {aiLoading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
                    <span>Send</span>
                  </button>
                </form>
              </>
            )}
          </div>
        )}

        {/* TAB 2: INTERACTIVE RUNNER */}
        {activeTab === 'runner' && (
          <div className="space-y-4">
            <div className="flex flex-col sm:flex-row sm:items-center gap-2.5">
              <label className="text-xs font-mono font-bold text-[#FFFFFF] uppercase tracking-wider">Selected Tool:</label>
              <select
                value={selectedTool?.name || ''}
                onChange={(e) => {
                  const found = tools.find((t) => t.name === e.target.value);
                  if (found) handleSelectTool(found);
                }}
                className="flex-1 bg-[#000000] border border-white/15 rounded-xl px-3.5 py-2.5 text-xs text-[#FFFFFF] font-mono focus:outline-none focus:border-emerald-500 cursor-pointer"
              >
                {tools.map((t) => (
                  <option key={t.name} value={t.name} className="bg-[#161412] text-white">
                    {t.name} — {t.description.slice(0, 45)}...
                  </option>
                ))}
              </select>
            </div>

            {selectedTool && (
              <div className="space-y-4">
                <div className="p-4 bg-[#000000] border border-white/[0.08] rounded-2xl">
                  <p className="text-xs text-[#FFFFFF] leading-relaxed font-normal">{selectedTool.description}</p>
                </div>

                <div>
                  <div className="flex items-center justify-between mb-2">
                    <label className="text-xs font-mono text-[#FFFFFF] font-bold uppercase tracking-wider">
                      JSON Arguments (inputSchema):
                    </label>
                    <button
                      type="button"
                      onClick={copyJsSnippet}
                      className="text-xs font-mono text-[#FFFFFF] hover:text-emerald-400 flex items-center gap-1.5 cursor-pointer transition-colors font-bold"
                    >
                      {copiedCode ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
                      Copy JS Snippet
                    </button>
                  </div>
                  <textarea
                    value={inputArgs}
                    onChange={(e) => setInputArgs(e.target.value)}
                    rows={6}
                    className="w-full bg-[#000000] border border-white/15 rounded-xl p-3.5 text-xs font-mono text-emerald-300 focus:outline-none focus:border-emerald-500 leading-relaxed"
                  />
                </div>

                <div className="flex gap-2">
                  <button
                    type="button"
                    onClick={handleRunSelected}
                    disabled={executing}
                    className="flex-1 py-3.5 rounded-xl bg-emerald-600 hover:bg-emerald-500 disabled:opacity-50 text-white font-mono text-xs font-extrabold uppercase tracking-wider flex items-center justify-center gap-2 transition-all shadow-[0_4px_12px_rgba(16,185,129,0.3)] cursor-pointer"
                  >
                    <Play className="w-4 h-4" />
                    {executing ? 'Executing...' : `Execute ${selectedTool.name}`}
                  </button>
                </div>

                {lastResult && (
                  <div className="mt-4 space-y-2">
                    <div className="flex items-center justify-between">
                      <label className="text-xs font-mono font-bold text-[#FFFFFF] uppercase tracking-wider">Result Output:</label>
                      <span
                        className={`text-xs font-mono font-bold px-2 py-0.5 rounded ${
                          lastResult.isError
                            ? 'bg-rose-950 text-rose-300 border border-rose-800'
                            : 'bg-emerald-950 text-emerald-300 border border-emerald-800'
                        }`}
                      >
                        {lastResult.isError ? 'Error' : 'Success'}
                      </span>
                    </div>
                    <pre className="p-3.5 bg-[#000000] border border-white/15 rounded-xl text-xs font-mono text-emerald-300 overflow-x-auto max-h-60 leading-relaxed">
                      {JSON.stringify(lastResult, null, 2)}
                    </pre>
                  </div>
                )}
              </div>
            )}
          </div>
        )}

        {/* TAB 3: LIVE LOGS */}
        {activeTab === 'logs' && (
          <div className="space-y-3.5">
            <div className="flex items-center justify-between">
              <span className="text-xs font-mono text-[#FFFFFF] font-bold">
                Total Executions: {executionHistory.length}
              </span>
              {executionHistory.length > 0 && (
                <button
                  type="button"
                  onClick={clearHistory}
                  className="text-xs text-[#FFFFFF] hover:text-rose-400 font-mono flex items-center gap-1.5 cursor-pointer transition-colors font-bold"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                  Clear Logs
                </button>
              )}
            </div>

            {executionHistory.length === 0 ? (
              <div className="p-8 text-center border border-dashed border-white/15 rounded-2xl text-xs text-[#FFFFFF] font-mono bg-[#000000]">
                No WebMCP tool executions recorded yet.
              </div>
            ) : (
              <div className="space-y-3">
                {executionHistory.map((item) => (
                  <div
                    key={item.id}
                    className="p-4 rounded-2xl border border-white/[0.08] bg-[#000000] space-y-2.5"
                  >
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2 flex-wrap">
                        <code className="text-xs font-bold text-emerald-400 font-mono">
                          {item.toolName}
                        </code>
                        <span className="text-xs px-2 py-0.5 rounded bg-white/[0.08] text-[#FFFFFF] border border-white/[0.12] font-mono font-bold">
                          {item.durationMs}ms
                        </span>
                        <span className="text-xs px-2 py-0.5 rounded bg-white/[0.08] text-[#FFFFFF] font-mono">
                          {item.origin}
                        </span>
                      </div>
                      <span
                        className={`text-xs font-mono font-bold px-2 py-0.5 rounded ${
                          item.error
                            ? 'text-rose-300 bg-rose-950 border border-rose-800'
                            : 'text-emerald-300 bg-emerald-950 border border-emerald-800'
                        }`}
                      >
                        {item.error ? 'failed' : 'ok'}
                      </span>
                    </div>
                    <details className="text-xs font-mono text-[#FFFFFF] pt-1.5 border-t border-white/[0.08]">
                      <summary className="cursor-pointer hover:text-emerald-400 select-none py-1 font-bold">
                        Inspect Payload & Output
                      </summary>
                      <div className="mt-2 space-y-2">
                        <div className="text-xs text-[#FFFFFF] font-bold uppercase">Args:</div>
                        <pre className="p-3 bg-[#0A0908] rounded-xl border border-white/[0.08] text-[#FFFFFF] overflow-x-auto text-xs">
                          {JSON.stringify(item.args, null, 2)}
                        </pre>
                        <div className="text-xs text-[#FFFFFF] font-bold uppercase">Output:</div>
                        <pre className="p-3 bg-[#0A0908] rounded-xl border border-white/[0.08] text-emerald-300 overflow-x-auto text-xs">
                          {JSON.stringify(item.result, null, 2)}
                        </pre>
                      </div>
                    </details>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* TAB 4: SETUP & W3C */}
        {activeTab === 'setup' && (
          <div className="space-y-4 text-xs text-[#FFFFFF] leading-relaxed">
            <div className="p-4 bg-[#000000] border border-emerald-500/30 rounded-2xl space-y-2">
              <h4 className="font-bold text-white flex items-center gap-1.5 font-clash text-sm">
                <Sparkles className="w-4 h-4 text-emerald-400" />
                WebMCP Protocol Compliance
              </h4>
              <p className="text-xs text-[#FFFFFF] leading-relaxed">
                Kylrix implements the W3C Web Model Context Protocol specification directly in the browser runtime. When AI agents navigate to Kylrix, they automatically detect <code className="text-emerald-300 font-mono font-bold">navigator.modelContext</code> and <code className="text-emerald-300 font-mono font-bold">document.modelContext</code>.
              </p>
            </div>

            <div className="space-y-2">
              <h5 className="font-bold text-white font-mono text-xs uppercase tracking-wider">1. Testing in Google Chrome</h5>
              <p className="text-xs text-[#FFFFFF]">
                Enable the experimental flag in your Chrome browser:
              </p>
              <div className="p-3 bg-[#000000] border border-white/15 rounded-xl font-mono text-emerald-400 flex items-center justify-between text-xs">
                <span className="truncate pr-2">chrome://flags/#enable-webmcp-testing</span>
                <button
                  type="button"
                  onClick={() => {
                    navigator.clipboard.writeText('chrome://flags/#enable-webmcp-testing');
                    toast.success('Copied flag URI');
                  }}
                  className="p-1.5 rounded-lg bg-white/[0.08] hover:bg-white/20 text-[#FFFFFF] cursor-pointer transition-colors shrink-0"
                >
                  <Copy className="w-3.5 h-3.5" />
                </button>
              </div>
            </div>

            <div className="space-y-2">
              <h5 className="font-bold text-white font-mono text-xs uppercase tracking-wider">2. Testing in ChatGPT In-App Browser</h5>
              <p className="text-xs text-[#FFFFFF] leading-relaxed">
                Open Kylrix directly inside ChatGPT&apos;s browsing environment. ChatGPT natively queries <code className="text-emerald-300 font-mono font-bold">navigator.modelContext.listTools()</code> and can invoke tools on behalf of the user with their active session permissions.
              </p>
            </div>

            <div className="space-y-2">
              <h5 className="font-bold text-white font-mono text-xs uppercase tracking-wider">3. Programmatic Invocation Example</h5>
              <pre className="p-3.5 bg-[#000000] border border-white/15 rounded-xl font-mono text-emerald-300 overflow-x-auto text-xs leading-relaxed">
{`// Query available tools
const tools = await navigator.modelContext.listTools();

// Create a new note directly in the active session
const result = await navigator.modelContext.executeTool('kylrix_create_note', {
  title: 'Meeting Notes from Agent',
  content: 'Captured action items and goals.',
  tags: ['agent', 'hackathon']
});`}
              </pre>
            </div>
          </div>
        )}
      </div>
    </div>
  );

  // Close inspector when native sidebar dismisses or swaps away
  useEffect(() => {
    if (!isDesktop || !nativeSidebar || !isInspectorOpen) return;
    const interval = setInterval(() => {
      const activeKey = nativeSidebar.getActiveKey();
      if (activeKey !== 'webmcp-inspector') {
        closeInspector();
      }
    }, 150);
    return () => clearInterval(interval);
  }, [isDesktop, nativeSidebar, isInspectorOpen, closeInspector]);

  if (isDesktop && nativeSidebar) {
    return (
      <NativeSidebarMount
        active={isInspectorOpen}
        sidebarKey="webmcp-inspector"
        width={560}
        title="WebMCP Inspector"
      >
        {inspectorContent}
      </NativeSidebarMount>
    );
  }

  if (!isInspectorOpen) return null;

  return createPortal(
    <div className="fixed inset-0 z-[15000] flex flex-col justify-end pointer-events-auto">
      {/* Backdrop */}
      <div
        className="fixed inset-0 bg-black/80 transition-opacity duration-200 animate-in fade-in"
        onClick={closeInspector}
      />

      {/* Mobile Drawer Container */}
      <div className="relative w-full h-[88dvh] max-h-[88dvh] bg-[#000000] border-t border-white/10 rounded-t-[28px] shadow-2xl z-[15001] flex flex-col text-neutral-200 overflow-hidden animate-in slide-in-from-bottom duration-300">
        {/* Mobile Drag Indicator Handle */}
        <div className="flex justify-center pt-2.5 pb-1 bg-[#000000]">
          <div className="w-10 h-1 rounded-full bg-white/20" />
        </div>
        {inspectorContent}
      </div>
    </div>,
    document.body
  );
}