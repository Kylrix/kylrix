import Link from 'next/link';
import {
  KYLRIX_MCP_SKILL_INSTALL,
  KYLRIX_DOCS_API,
} from '@/lib/api/public';
import { MCP_TOOLS } from '@/lib/mcp/handler';

function CodeBlock({ children }: { children: string }) {
  return (
    <pre className="text-[11px] font-mono text-white/70 whitespace-pre-wrap break-all bg-[#0A0908] rounded-xl p-3 border border-white/[0.05]">
      {children}
    </pre>
  );
}

const CLAUDE_CODE_SETUP = `claude mcp add --transport http kylrix https://www.kylrix.space/api/v1/mcp \\
  --header "Authorization: Bearer <YOUR_PAT_TOKEN>"`;

const CLAUDE_DESKTOP_CONFIG = `{
  "mcpServers": {
    "kylrix": {
      "type": "http",
      "url": "https://www.kylrix.space/api/v1/mcp",
      "headers": {
        "Authorization": "Bearer <YOUR_PAT_TOKEN>"
      }
    }
  }
}`;

const CURSOR_CONFIG = `{
  "name": "kylrix",
  "type": "http",
  "url": "https://www.kylrix.space/api/v1/mcp",
  "headers": {
    "Authorization": "Bearer <YOUR_PAT_TOKEN>"
  }
}`;

export default function DocsMcpPage() {
  return (
    <div className="min-h-screen bg-black text-white font-satoshi">
      <div className="max-w-3xl mx-auto px-4 py-10 md:py-16 space-y-6">
        <div>
          <Link
            href="/docs"
            className="text-[11px] font-extrabold uppercase tracking-wider text-white/40 hover:text-white"
          >
            ← Docs
          </Link>
          <h1 className="font-clash text-3xl font-semibold tracking-tight mt-3">
            Model Context Protocol (MCP)
          </h1>
          <p className="mt-2 text-sm text-white/50">
            Connect Claude Desktop, Cursor, Claude Code, and autonomous AI agents directly to your Kylrix workspace over Streamable HTTP and Server-Sent Events (SSE).
          </p>
        </div>

        <section className="rounded-[22px] bg-[#161412] border border-white/[0.06] p-5 space-y-3">
          <h2 className="text-[11px] font-extrabold uppercase tracking-wider text-white/55">
            Agent skill
          </h2>
          <CodeBlock>{KYLRIX_MCP_SKILL_INSTALL}</CodeBlock>
          <p className="text-xs text-white/40">
            Automate prompt engineering and agent tool execution. For REST endpoints and direct token management, see the{' '}
            <Link href="/docs/api" className="text-[#A5B4FC] hover:text-white">
              HTTP API docs
            </Link>.
          </p>
        </section>

        <section className="rounded-[22px] bg-[#161412] border border-white/[0.06] p-5 space-y-4">
          <h2 className="text-[11px] font-extrabold uppercase tracking-wider text-white/55">
            Client quick start
          </h2>

          <div className="space-y-2">
            <h3 className="text-xs font-bold text-white/80">1. Claude Code</h3>
            <CodeBlock>{CLAUDE_CODE_SETUP}</CodeBlock>
          </div>

          <div className="space-y-2">
            <h3 className="text-xs font-bold text-white/80">2. Claude Desktop (`claude_desktop_config.json`)</h3>
            <CodeBlock>{CLAUDE_DESKTOP_CONFIG}</CodeBlock>
          </div>

          <div className="space-y-2">
            <h3 className="text-xs font-bold text-white/80">3. Cursor Settings (MCP Servers)</h3>
            <CodeBlock>{CURSOR_CONFIG}</CodeBlock>
          </div>
        </section>

        <section className="rounded-[22px] bg-[#161412] border border-white/[0.06] p-5 space-y-3">
          <h2 className="text-[11px] font-extrabold uppercase tracking-wider text-white/55">
            Authentication & Security
          </h2>
          <p className="text-xs text-white/60 leading-relaxed">
            MCP requests are authenticated using Personal Access Tokens (<code className="text-[#FBBF24]">kyl_pat_...</code>), Agent Provisioning Keys, or Sign in with Kylrix OAuth 2.1 tokens.
          </p>
          <ul className="text-xs text-white/50 space-y-1.5 list-disc list-inside">
            <li>Generate tokens under <Link href="/settings?tab=developers" className="text-[#A5B4FC] hover:text-white">Settings &gt; Developers</Link>.</li>
            <li>Workspace isolation is strictly enforced — items in agentic or team workspaces never leak into personal lists.</li>
            <li>Zero-trust scoped permissions apply to each tool call (<code className="text-white/70">notes:write</code>, <code className="text-white/70">goals:write</code>, etc.).</li>
          </ul>
        </section>

        <section className="rounded-[22px] bg-[#161412] border border-white/[0.06] p-5 space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="text-[11px] font-extrabold uppercase tracking-wider text-white/55">
              Available MCP Tools ({MCP_TOOLS.length})
            </h2>
            <span className="text-[10px] font-mono text-emerald-400/80 bg-emerald-500/10 px-2 py-0.5 rounded-full border border-emerald-500/20">
              Live Protocol 2024-11-05
            </span>
          </div>

          <div className="divide-y divide-white/[0.05]">
            {MCP_TOOLS.map((tool) => (
              <div key={tool.name} className="py-3 first:pt-0 last:pb-0 space-y-1">
                <div className="flex items-center justify-between gap-2">
                  <span className="text-xs font-mono font-bold text-[#FBBF24]">
                    {tool.name}
                  </span>
                  {tool.inputSchema.required && tool.inputSchema.required.length > 0 && (
                    <span className="text-[10px] font-mono text-white/35">
                      req: {tool.inputSchema.required.join(', ')}
                    </span>
                  )}
                </div>
                <p className="text-xs text-white/60">{tool.description}</p>
                {tool.inputSchema.properties && Object.keys(tool.inputSchema.properties).length > 0 && (
                  <div className="mt-1 flex flex-wrap gap-1.5">
                    {Object.entries(tool.inputSchema.properties).map(([paramName, paramDef]: [string, any]) => (
                      <span
                        key={paramName}
                        className="text-[10px] font-mono text-white/40 bg-white/[0.03] px-1.5 py-0.5 rounded border border-white/[0.04]"
                      >
                        {paramName}: {paramDef.type || 'any'}
                      </span>
                    ))}
                  </div>
                )}
              </div>
            ))}
          </div>
        </section>
      </div>
    </div>
  );
}
