'use client';

import React, { useState } from 'react';
import { useWebMcpContext } from '@/context/WebMcpContext';
import {
  X,
  Play,
  Terminal,
  Code2,
  Activity,
  Copy,
  Check,
  Trash2,
  ExternalLink,
  Layers,
  Sparkles,
  Info,
  ChevronRight,
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

  const [activeTab, setActiveTab] = useState<'tools' | 'runner' | 'logs' | 'setup'>('tools');
  const [selectedTool, setSelectedTool] = useState<WebMcpToolDefinition | null>(tools[0] || null);
  const [inputArgs, setInputArgs] = useState<string>('{}');
  const [executing, setExecuting] = useState(false);
  const [copiedCode, setCopiedCode] = useState(false);
  const [lastResult, setLastResult] = useState<any>(null);

  if (!isInspectorOpen) return null;

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
      } catch (err: any) {
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

  return (
    <div className="fixed inset-0 z-[100] flex justify-end bg-black/60 backdrop-blur-sm animate-in fade-in duration-200">
      <div className="w-full max-w-2xl h-full bg-[#0a0a0a] border-l border-[#262626] flex flex-col text-neutral-200 shadow-2xl overflow-hidden">
        {/* Header */}
        <div className="p-4 border-b border-[#262626] flex items-center justify-between bg-[#121212]">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-lg bg-emerald-500/10 border border-emerald-500/30 flex items-center justify-center text-emerald-400">
              <Terminal className="w-4 h-4" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-sm font-semibold text-white tracking-wide">WebMCP Inspector</h2>
                <span className="text-[10px] uppercase font-mono px-1.5 py-0.5 rounded bg-emerald-950 text-emerald-300 border border-emerald-800">
                  W3C Ready
                </span>
              </div>
              <p className="text-xs text-neutral-400 font-mono mt-0.5">
                navigator.modelContext • {tools.length} active tools exposed
              </p>
            </div>
          </div>
          <button
            onClick={closeInspector}
            className="p-1.5 rounded-lg text-neutral-400 hover:text-white hover:bg-[#222] transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Tab Navigation */}
        <div className="flex border-b border-[#262626] bg-[#0e0e0e] px-4">
          <button
            onClick={() => setActiveTab('tools')}
            className={`flex items-center gap-2 px-3 py-2.5 text-xs font-medium border-b-2 transition-colors ${
              activeTab === 'tools'
                ? 'border-emerald-500 text-emerald-400 bg-emerald-500/5'
                : 'border-transparent text-neutral-400 hover:text-neutral-200'
            }`}
          >
            <Layers className="w-3.5 h-3.5" />
            Tools Catalog ({tools.length})
          </button>
          <button
            onClick={() => setActiveTab('runner')}
            className={`flex items-center gap-2 px-3 py-2.5 text-xs font-medium border-b-2 transition-colors ${
              activeTab === 'runner'
                ? 'border-emerald-500 text-emerald-400 bg-emerald-500/5'
                : 'border-transparent text-neutral-400 hover:text-neutral-200'
            }`}
          >
            <Play className="w-3.5 h-3.5" />
            Interactive Runner
          </button>
          <button
            onClick={() => setActiveTab('logs')}
            className={`flex items-center gap-2 px-3 py-2.5 text-xs font-medium border-b-2 transition-colors ${
              activeTab === 'logs'
                ? 'border-emerald-500 text-emerald-400 bg-emerald-500/5'
                : 'border-transparent text-neutral-400 hover:text-neutral-200'
            }`}
          >
            <Activity className="w-3.5 h-3.5" />
            Live Logs ({executionHistory.length})
          </button>
          <button
            onClick={() => setActiveTab('setup')}
            className={`flex items-center gap-2 px-3 py-2.5 text-xs font-medium border-b-2 transition-colors ${
              activeTab === 'setup'
                ? 'border-emerald-500 text-emerald-400 bg-emerald-500/5'
                : 'border-transparent text-neutral-400 hover:text-neutral-200'
            }`}
          >
            <Info className="w-3.5 h-3.5" />
            Integration & Flags
          </button>
        </div>

        {/* Tab Content */}
        <div className="flex-1 overflow-y-auto p-4 space-y-4">
          {/* TAB 1: TOOLS CATALOG */}
          {activeTab === 'tools' && (
            <div className="space-y-3">
              <div className="p-3 bg-[#141414] border border-[#262626] rounded-lg text-xs text-neutral-300">
                <span className="font-semibold text-emerald-400">Browser-Native Tools:</span> Visiting AI agents in Chrome or ChatGPT in-app browser discover and invoke these tools directly in this web page without plugins or backend credentials.
              </div>

              <div className="grid gap-2">
                {tools.map((t) => (
                  <div
                    key={t.name}
                    className="p-3 rounded-lg border border-[#222] bg-[#111] hover:border-[#333] transition-all flex flex-col gap-2"
                  >
                    <div className="flex items-start justify-between">
                      <div>
                        <div className="flex items-center gap-2">
                          <code className="text-xs font-bold text-white font-mono">{t.name}</code>
                          {t.category && (
                            <span className="text-[10px] px-1.5 py-0.5 rounded bg-[#1e1e1e] text-neutral-400 border border-[#2c2c2c] font-mono">
                              {t.category}
                            </span>
                          )}
                        </div>
                        <p className="text-xs text-neutral-400 mt-1">{t.description}</p>
                      </div>
                      <button
                        onClick={() => {
                          handleSelectTool(t);
                          setActiveTab('runner');
                        }}
                        className="px-2.5 py-1 text-xs rounded bg-[#1e1e1e] hover:bg-emerald-500/10 hover:text-emerald-400 hover:border-emerald-500/30 border border-[#333] text-neutral-300 font-mono flex items-center gap-1 transition-colors"
                      >
                        <Play className="w-3 h-3" />
                        Run
                      </button>
                    </div>

                    <details className="text-[11px] font-mono text-neutral-400">
                      <summary className="cursor-pointer hover:text-neutral-200">
                        View Input Schema
                      </summary>
                      <pre className="mt-2 p-2 rounded bg-black/60 border border-[#222] overflow-x-auto text-emerald-400/90 text-[10px]">
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
              <div className="flex items-center gap-2">
                <label className="text-xs font-mono text-neutral-400">Selected Tool:</label>
                <select
                  value={selectedTool?.name || ''}
                  onChange={(e) => {
                    const found = tools.find((t) => t.name === e.target.value);
                    if (found) handleSelectTool(found);
                  }}
                  className="flex-1 bg-[#141414] border border-[#2c2c2c] rounded px-2.5 py-1.5 text-xs text-white font-mono focus:outline-none focus:border-emerald-500"
                >
                  {tools.map((t) => (
                    <option key={t.name} value={t.name}>
                      {t.name} — {t.description.slice(0, 40)}...
                    </option>
                  ))}
                </select>
              </div>

              {selectedTool && (
                <div className="space-y-3">
                  <div className="p-3 bg-[#111] border border-[#222] rounded-lg">
                    <p className="text-xs text-neutral-300">{selectedTool.description}</p>
                  </div>

                  <div>
                    <div className="flex items-center justify-between mb-1.5">
                      <label className="text-xs font-mono text-neutral-400">
                        JSON Arguments (inputSchema):
                      </label>
                      <button
                        onClick={copyJsSnippet}
                        className="text-[11px] font-mono text-neutral-400 hover:text-white flex items-center gap-1"
                      >
                        {copiedCode ? <Check className="w-3 h-3 text-emerald-400" /> : <Copy className="w-3 h-3" />}
                        Copy JS Snippet
                      </button>
                    </div>
                    <textarea
                      value={inputArgs}
                      onChange={(e) => setInputArgs(e.target.value)}
                      rows={6}
                      className="w-full bg-[#111] border border-[#262626] rounded-lg p-3 text-xs font-mono text-emerald-300 focus:outline-none focus:border-emerald-500"
                    />
                  </div>

                  <div className="flex gap-2">
                    <button
                      onClick={handleRunSelected}
                      disabled={executing}
                      className="flex-1 py-2 rounded-lg bg-emerald-600 hover:bg-emerald-500 disabled:opacity-50 text-white font-mono text-xs font-medium flex items-center justify-center gap-2 transition-all shadow-lg"
                    >
                      <Play className="w-3.5 h-3.5" />
                      {executing ? 'Executing...' : `Execute ${selectedTool.name}`}
                    </button>
                  </div>

                  {lastResult && (
                    <div className="mt-4 space-y-1.5">
                      <div className="flex items-center justify-between">
                        <label className="text-xs font-mono text-neutral-400">Result Output:</label>
                        <span
                          className={`text-[10px] font-mono px-1.5 py-0.5 rounded ${
                            lastResult.isError
                              ? 'bg-rose-950 text-rose-300 border border-rose-800'
                              : 'bg-emerald-950 text-emerald-300 border border-emerald-800'
                          }`}
                        >
                          {lastResult.isError ? 'Error' : 'Success'}
                        </span>
                      </div>
                      <pre className="p-3 bg-black/80 border border-[#262626] rounded-lg text-xs font-mono text-neutral-200 overflow-x-auto max-h-60">
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
                <span className="text-xs font-mono text-neutral-400">
                  Total Executions: {executionHistory.length}
                </span>
                {executionHistory.length > 0 && (
                  <button
                    onClick={clearHistory}
                    className="text-xs text-neutral-400 hover:text-rose-400 font-mono flex items-center gap-1"
                  >
                    <Trash2 className="w-3 h-3" />
                    Clear Logs
                  </button>
                )}
              </div>

              {executionHistory.length === 0 ? (
                <div className="p-8 text-center border border-dashed border-[#222] rounded-lg text-xs text-neutral-500 font-mono">
                  No WebMCP tool executions recorded yet.
                </div>
              ) : (
                <div className="space-y-2">
                  {executionHistory.map((item) => (
                    <div
                      key={item.id}
                      className="p-3 rounded-lg border border-[#222] bg-[#111] space-y-1.5"
                    >
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2">
                          <code className="text-xs font-bold text-white font-mono">
                            {item.toolName}
                          </code>
                          <span className="text-[10px] px-1.5 py-0.2 rounded bg-[#1e1e1e] text-neutral-400 font-mono">
                            {item.durationMs}ms
                          </span>
                          <span className="text-[10px] px-1.5 py-0.2 rounded bg-neutral-900 text-neutral-400 font-mono">
                            {item.origin}
                          </span>
                        </div>
                        <span
                          className={`text-[10px] font-mono px-1.5 py-0.2 rounded ${
                            item.error
                              ? 'text-rose-400 bg-rose-950/50'
                              : 'text-emerald-400 bg-emerald-950/50'
                          }`}
                        >
                          {item.error ? 'failed' : 'ok'}
                        </span>
                      </div>
                      <details className="text-[10px] font-mono text-neutral-400">
                        <summary className="cursor-pointer hover:text-neutral-200">
                          Inspect Payload & Output
                        </summary>
                        <div className="mt-2 space-y-1">
                          <div className="text-neutral-500">Args:</div>
                          <pre className="p-1.5 bg-black/60 rounded border border-[#222] text-neutral-300">
                            {JSON.stringify(item.args, null, 2)}
                          </pre>
                          <div className="text-neutral-500">Output:</div>
                          <pre className="p-1.5 bg-black/60 rounded border border-[#222] text-emerald-400">
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
            <div className="space-y-4 text-xs text-neutral-300 leading-relaxed">
              <div className="p-3 bg-[#141414] border border-[#262626] rounded-lg space-y-2">
                <h4 className="font-semibold text-white flex items-center gap-1.5">
                  <Sparkles className="w-4 h-4 text-emerald-400" />
                  WebMCP Protocol Compliance
                </h4>
                <p className="text-neutral-400">
                  Kylrix implements the W3C Web Model Context Protocol specification directly in the browser runtime. When AI agents navigate to Kylrix, they automatically detect <code className="text-emerald-300">navigator.modelContext</code> and <code className="text-emerald-300">document.modelContext</code>.
                </p>
              </div>

              <div className="space-y-2">
                <h5 className="font-semibold text-white font-mono">1. Testing in Google Chrome</h5>
                <p className="text-neutral-400">
                  Enable the experimental flag in your Chrome browser:
                </p>
                <div className="p-2.5 bg-black border border-[#262626] rounded font-mono text-emerald-400 flex items-center justify-between">
                  <span>chrome://flags/#enable-webmcp-testing</span>
                  <button
                    onClick={() => {
                      navigator.clipboard.writeText('chrome://flags/#enable-webmcp-testing');
                      toast.success('Copied flag URI');
                    }}
                    className="p-1 hover:text-white"
                  >
                    <Copy className="w-3.5 h-3.5" />
                  </button>
                </div>
              </div>

              <div className="space-y-2">
                <h5 className="font-semibold text-white font-mono">2. Testing in ChatGPT In-App Browser</h5>
                <p className="text-neutral-400">
                  Open Kylrix directly inside ChatGPT's browsing environment. ChatGPT natively queries <code className="text-emerald-300">navigator.modelContext.listTools()</code> and can invoke tools on behalf of the user with their active session permissions.
                </p>
              </div>

              <div className="space-y-2">
                <h5 className="font-semibold text-white font-mono">3. Programmatic Invocation Example</h5>
                <pre className="p-3 bg-black border border-[#262626] rounded-lg font-mono text-emerald-400 overflow-x-auto">
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
    </div>
  );
}
