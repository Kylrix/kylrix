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
} from 'lucide-react';
import { toast } from 'react-hot-toast';
import type { WebMcpToolDefinition } from '@/lib/webmcp/types';

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
  const [activeTab, setActiveTab] = useState<'tools' | 'runner' | 'logs' | 'setup'>('tools');
  const [selectedTool, setSelectedTool] = useState<WebMcpToolDefinition | null>(null);
  const [inputArgs, setInputArgs] = useState<string>('{}');
  const [executing, setExecuting] = useState(false);
  const [copiedCode, setCopiedCode] = useState(false);
  const [lastResult, setLastResult] = useState<any>(null);

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

  if (!mounted || !isInspectorOpen) return null;

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

  return createPortal(
    <div className="fixed inset-0 z-[15000] flex flex-col justify-end md:flex-row md:justify-end pointer-events-auto">
      {/* Backdrop */}
      <div
        className="fixed inset-0 bg-black/80 backdrop-blur-sm transition-opacity duration-200 animate-in fade-in"
        onClick={closeInspector}
      />

      {/* Drawer Container:
          Mobile: bottom sheet (h-[88dvh] max-h-[88dvh] rounded-t-[28px])
          Desktop: right side drawer docked below the 88px topbar (top-[88px] h-[calc(100dvh-88px)] rounded-tl-[28px])
      */}
      <div className="relative w-full max-w-[620px] h-[88dvh] max-h-[88dvh] md:h-[calc(100dvh-88px)] md:max-h-[calc(100dvh-88px)] md:top-[88px] bg-[#161412] border-t md:border-t md:border-l border-white/10 rounded-t-[28px] md:rounded-none md:rounded-tl-[28px] shadow-2xl z-[15001] flex flex-col text-neutral-200 overflow-hidden animate-in slide-in-from-bottom md:slide-in-from-right duration-300">
        
        {/* Mobile Drag Indicator Handle */}
        <div className="flex md:hidden justify-center pt-2.5 pb-1 bg-[#161412]">
          <div className="w-10 h-1 rounded-full bg-white/20" />
        </div>

        {/* Sticky Header with prominent close button */}
        <div className="px-5 py-3.5 border-b border-white/10 flex items-center justify-between bg-[#161412] shrink-0">
          <div className="flex items-center gap-3 min-w-0">
            <div className="w-9 h-9 rounded-xl bg-emerald-500/10 border border-emerald-500/30 flex items-center justify-center text-emerald-400 shrink-0">
              <Terminal className="w-4 h-4" />
            </div>
            <div className="min-w-0">
              <div className="flex items-center gap-2">
                <h2 className="text-sm font-extrabold text-white tracking-tight truncate font-clash">WebMCP Inspector</h2>
                <span className="text-[10px] uppercase font-mono font-bold px-1.5 py-0.5 rounded bg-emerald-950/80 text-emerald-300 border border-emerald-800/80 shrink-0">
                  W3C Ready
                </span>
              </div>
              <p className="text-[11px] text-white/50 font-mono truncate mt-0.5">
                navigator.modelContext • {tools.length} active tools
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={closeInspector}
            aria-label="Close Inspector"
            className="p-2 rounded-xl bg-white/[0.04] hover:bg-white/10 border border-white/10 text-white/70 hover:text-white transition-all cursor-pointer shrink-0 ml-2"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Tab Navigation */}
        <div className="flex border-b border-white/10 bg-[#0A0908] px-3 overflow-x-auto no-scrollbar shrink-0">
          <button
            type="button"
            onClick={() => setActiveTab('tools')}
            className={`flex items-center gap-2 px-3 py-2.5 text-xs font-mono font-semibold border-b-2 transition-all whitespace-nowrap cursor-pointer ${
              activeTab === 'tools'
                ? 'border-emerald-500 text-emerald-400 bg-emerald-500/10'
                : 'border-transparent text-white/50 hover:text-white'
            }`}
          >
            <Layers className="w-3.5 h-3.5" />
            Tools Catalog ({tools.length})
          </button>
          <button
            type="button"
            onClick={() => setActiveTab('runner')}
            className={`flex items-center gap-2 px-3 py-2.5 text-xs font-mono font-semibold border-b-2 transition-all whitespace-nowrap cursor-pointer ${
              activeTab === 'runner'
                ? 'border-emerald-500 text-emerald-400 bg-emerald-500/10'
                : 'border-transparent text-white/50 hover:text-white'
            }`}
          >
            <Play className="w-3.5 h-3.5" />
            Interactive Runner
          </button>
          <button
            type="button"
            onClick={() => setActiveTab('logs')}
            className={`flex items-center gap-2 px-3 py-2.5 text-xs font-mono font-semibold border-b-2 transition-all whitespace-nowrap cursor-pointer ${
              activeTab === 'logs'
                ? 'border-emerald-500 text-emerald-400 bg-emerald-500/10'
                : 'border-transparent text-white/50 hover:text-white'
            }`}
          >
            <Activity className="w-3.5 h-3.5" />
            Live Logs ({executionHistory.length})
          </button>
          <button
            type="button"
            onClick={() => setActiveTab('setup')}
            className={`flex items-center gap-2 px-3 py-2.5 text-xs font-mono font-semibold border-b-2 transition-all whitespace-nowrap cursor-pointer ${
              activeTab === 'setup'
                ? 'border-emerald-500 text-emerald-400 bg-emerald-500/10'
                : 'border-transparent text-white/50 hover:text-white'
            }`}
          >
            <Info className="w-3.5 h-3.5" />
            Integration & Flags
          </button>
        </div>

        {/* Tab Content */}
        <div className="flex-1 overflow-y-auto p-4 sm:p-5 space-y-4 pb-[calc(1.5rem+env(safe-area-inset-bottom,0px))]">
          {/* TAB 1: TOOLS CATALOG */}
          {activeTab === 'tools' && (
            <div className="space-y-3">
              <div className="p-3.5 bg-[#0A0908] border border-emerald-500/20 rounded-2xl text-xs text-white/80 leading-relaxed">
                <span className="font-bold text-emerald-400">Browser-Native Tools:</span> Visiting AI agents in Chrome or ChatGPT in-app browser discover and invoke these tools directly in this web page without plugins or backend credentials.
              </div>

              <div className="grid gap-2.5">
                {tools.map((t) => (
                  <div
                    key={t.name}
                    className="p-3.5 rounded-2xl border border-white/[0.06] bg-[#0A0908] hover:border-emerald-500/30 transition-all flex flex-col gap-2.5"
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0">
                        <div className="flex items-center gap-2 flex-wrap">
                          <code className="text-xs font-bold text-emerald-400 font-mono">{t.name}</code>
                          {t.category && (
                            <span className="text-[10px] px-1.5 py-0.5 rounded bg-white/[0.04] text-white/60 border border-white/[0.08] font-mono">
                              {t.category}
                            </span>
                          )}
                        </div>
                        <p className="text-xs text-white/60 mt-1 leading-relaxed">{t.description}</p>
                      </div>
                      <button
                        type="button"
                        onClick={() => {
                          handleSelectTool(t);
                          setActiveTab('runner');
                        }}
                        className="px-3 py-1.5 text-xs rounded-xl bg-white/[0.04] hover:bg-emerald-500/20 hover:text-emerald-300 hover:border-emerald-500/40 border border-white/10 text-white font-mono flex items-center gap-1.5 transition-colors shrink-0 cursor-pointer"
                      >
                        <Play className="w-3 h-3 text-emerald-400" />
                        Run
                      </button>
                    </div>

                    <details className="text-[11px] font-mono text-white/50 pt-1 border-t border-white/[0.04]">
                      <summary className="cursor-pointer hover:text-white/80 select-none py-0.5">
                        View Input Schema
                      </summary>
                      <pre className="mt-2 p-2.5 rounded-xl bg-black/80 border border-white/[0.06] overflow-x-auto text-emerald-400/90 text-[10px] leading-relaxed">
                        {JSON.stringify(t.inputSchema, null, 2)}
                      </pre>
                    </details>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* TAB 2: INTERACTIVE RUNNER */}
          {activeTab === 'runner' && (
            <div className="space-y-4">
              <div className="flex flex-col sm:flex-row sm:items-center gap-2">
                <label className="text-xs font-mono font-bold text-white/70">Selected Tool:</label>
                <select
                  value={selectedTool?.name || ''}
                  onChange={(e) => {
                    const found = tools.find((t) => t.name === e.target.value);
                    if (found) handleSelectTool(found);
                  }}
                  className="flex-1 bg-[#0A0908] border border-white/10 rounded-xl px-3 py-2 text-xs text-white font-mono focus:outline-none focus:border-emerald-500 cursor-pointer"
                >
                  {tools.map((t) => (
                    <option key={t.name} value={t.name} className="bg-[#161412] text-white">
                      {t.name} — {t.description.slice(0, 45)}...
                    </option>
                  ))}
                </select>
              </div>

              {selectedTool && (
                <div className="space-y-3.5">
                  <div className="p-3.5 bg-[#0A0908] border border-white/[0.06] rounded-2xl">
                    <p className="text-xs text-white/70 leading-relaxed">{selectedTool.description}</p>
                  </div>

                  <div>
                    <div className="flex items-center justify-between mb-1.5">
                      <label className="text-xs font-mono text-white/70 font-bold">
                        JSON Arguments (inputSchema):
                      </label>
                      <button
                        type="button"
                        onClick={copyJsSnippet}
                        className="text-[11px] font-mono text-white/50 hover:text-white flex items-center gap-1 cursor-pointer transition-colors"
                      >
                        {copiedCode ? <Check className="w-3 h-3 text-emerald-400" /> : <Copy className="w-3 h-3" />}
                        Copy JS Snippet
                      </button>
                    </div>
                    <textarea
                      value={inputArgs}
                      onChange={(e) => setInputArgs(e.target.value)}
                      rows={6}
                      className="w-full bg-[#0A0908] border border-white/10 rounded-xl p-3 text-xs font-mono text-emerald-300 focus:outline-none focus:border-emerald-500 leading-relaxed"
                    />
                  </div>

                  <div className="flex gap-2">
                    <button
                      type="button"
                      onClick={handleRunSelected}
                      disabled={executing}
                      className="flex-1 py-3 rounded-xl bg-emerald-600 hover:bg-emerald-500 disabled:opacity-50 text-white font-mono text-xs font-extrabold uppercase tracking-wider flex items-center justify-center gap-2 transition-all shadow-[0_4px_12px_rgba(16,185,129,0.25)] cursor-pointer"
                    >
                      <Play className="w-3.5 h-3.5" />
                      {executing ? 'Executing...' : `Execute ${selectedTool.name}`}
                    </button>
                  </div>

                  {lastResult && (
                    <div className="mt-4 space-y-1.5">
                      <div className="flex items-center justify-between">
                        <label className="text-xs font-mono font-bold text-white/70">Result Output:</label>
                        <span
                          className={`text-[10px] font-mono font-bold px-1.5 py-0.5 rounded ${
                            lastResult.isError
                              ? 'bg-rose-950/80 text-rose-300 border border-rose-800'
                              : 'bg-emerald-950/80 text-emerald-300 border border-emerald-800'
                          }`}
                        >
                          {lastResult.isError ? 'Error' : 'Success'}
                        </span>
                      </div>
                      <pre className="p-3 bg-black/80 border border-white/10 rounded-xl text-xs font-mono text-white/90 overflow-x-auto max-h-60 leading-relaxed">
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
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <span className="text-xs font-mono text-white/60">
                  Total Executions: {executionHistory.length}
                </span>
                {executionHistory.length > 0 && (
                  <button
                    type="button"
                    onClick={clearHistory}
                    className="text-xs text-white/50 hover:text-rose-400 font-mono flex items-center gap-1 cursor-pointer transition-colors"
                  >
                    <Trash2 className="w-3 h-3" />
                    Clear Logs
                  </button>
                )}
              </div>

              {executionHistory.length === 0 ? (
                <div className="p-8 text-center border border-dashed border-white/10 rounded-2xl text-xs text-white/40 font-mono bg-[#0A0908]">
                  No WebMCP tool executions recorded yet.
                </div>
              ) : (
                <div className="space-y-2.5">
                  {executionHistory.map((item) => (
                    <div
                      key={item.id}
                      className="p-3.5 rounded-2xl border border-white/[0.06] bg-[#0A0908] space-y-2"
                    >
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2 flex-wrap">
                          <code className="text-xs font-bold text-emerald-400 font-mono">
                            {item.toolName}
                          </code>
                          <span className="text-[10px] px-1.5 py-0.5 rounded bg-white/[0.04] text-white/60 border border-white/[0.08] font-mono">
                            {item.durationMs}ms
                          </span>
                          <span className="text-[10px] px-1.5 py-0.5 rounded bg-white/[0.04] text-white/50 font-mono">
                            {item.origin}
                          </span>
                        </div>
                        <span
                          className={`text-[10px] font-mono font-bold px-1.5 py-0.5 rounded ${
                            item.error
                              ? 'text-rose-400 bg-rose-950/50 border border-rose-800/40'
                              : 'text-emerald-400 bg-emerald-950/50 border border-emerald-800/40'
                          }`}
                        >
                          {item.error ? 'failed' : 'ok'}
                        </span>
                      </div>
                      <details className="text-[10px] font-mono text-white/50 pt-1 border-t border-white/[0.04]">
                        <summary className="cursor-pointer hover:text-white/80 select-none py-0.5">
                          Inspect Payload & Output
                        </summary>
                        <div className="mt-2 space-y-1.5">
                          <div className="text-white/40 font-bold">Args:</div>
                          <pre className="p-2 bg-black/80 rounded-xl border border-white/[0.06] text-white/80 overflow-x-auto">
                            {JSON.stringify(item.args, null, 2)}
                          </pre>
                          <div className="text-white/40 font-bold">Output:</div>
                          <pre className="p-2 bg-black/80 rounded-xl border border-white/[0.06] text-emerald-400 overflow-x-auto">
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
            <div className="space-y-4 text-xs text-white/70 leading-relaxed">
              <div className="p-4 bg-[#0A0908] border border-emerald-500/20 rounded-2xl space-y-2">
                <h4 className="font-bold text-white flex items-center gap-1.5 font-clash text-sm">
                  <Sparkles className="w-4 h-4 text-emerald-400" />
                  WebMCP Protocol Compliance
                </h4>
                <p className="text-white/60 leading-relaxed">
                  Kylrix implements the W3C Web Model Context Protocol specification directly in the browser runtime. When AI agents navigate to Kylrix, they automatically detect <code className="text-emerald-300 font-mono">navigator.modelContext</code> and <code className="text-emerald-300 font-mono">document.modelContext</code>.
                </p>
              </div>

              <div className="space-y-2">
                <h5 className="font-bold text-white font-mono text-xs">1. Testing in Google Chrome</h5>
                <p className="text-white/60">
                  Enable the experimental flag in your Chrome browser:
                </p>
                <div className="p-3 bg-black/80 border border-white/10 rounded-xl font-mono text-emerald-400 flex items-center justify-between text-xs">
                  <span className="truncate pr-2">chrome://flags/#enable-webmcp-testing</span>
                  <button
                    type="button"
                    onClick={() => {
                      navigator.clipboard.writeText('chrome://flags/#enable-webmcp-testing');
                      toast.success('Copied flag URI');
                    }}
                    className="p-1.5 rounded-lg bg-white/[0.04] hover:bg-white/10 text-white/70 hover:text-white cursor-pointer transition-colors shrink-0"
                  >
                    <Copy className="w-3.5 h-3.5" />
                  </button>
                </div>
              </div>

              <div className="space-y-2">
                <h5 className="font-bold text-white font-mono text-xs">2. Testing in ChatGPT In-App Browser</h5>
                <p className="text-white/60 leading-relaxed">
                  Open Kylrix directly inside ChatGPT&apos;s browsing environment. ChatGPT natively queries <code className="text-emerald-300 font-mono">navigator.modelContext.listTools()</code> and can invoke tools on behalf of the user with their active session permissions.
                </p>
              </div>

              <div className="space-y-2">
                <h5 className="font-bold text-white font-mono text-xs">3. Programmatic Invocation Example</h5>
                <pre className="p-3.5 bg-black/80 border border-white/10 rounded-xl font-mono text-emerald-400 overflow-x-auto text-[11px] leading-relaxed">
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
    </div>,
    document.body
  );
}
