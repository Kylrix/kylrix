'use client';
import React, { useMemo, useState } from 'react';
import { FileText, Target, Boxes, Lock, Search, Navigation, Tag, FormInput, Calculator, Sparkles, Bot, Shield, X, Eye, Copy } from 'lucide-react';
import type { DiscoverFlow } from '@/lib/flows/types';
import type { WorkflowChain } from '@/lib/workflow-engine';
import { buildSidekickSystemInstruction } from '@/lib/agentic/prompts/sidekick';
import { assembleSystemInstructionBlocks } from '@/lib/agentic/prompt-framework';

// Per-tool visual mapping for beautiful prompt/tool formatting
const TOOL_VISUAL: Record<string, { icon: React.ElementType; color: string; bg: string; label: string }> = {
  'objects.idea.create': { icon: FileText, color:'#A855F7', bg:'rgba(168,85,247,0.12)', label:'Idea' },
  'objects.idea.read': { icon: FileText, color:'#A855F7', bg:'rgba(168,85,247,0.12)', label:'Idea' },
  'objects.idea.search': { icon: FileText, color:'#A855F7', bg:'rgba(168,85,247,0.12)', label:'Idea' },
  'create_note': { icon: FileText, color:'#A855F7', bg:'rgba(168,85,247,0.12)', label:'Idea' },
  'get_note': { icon: FileText, color:'#A855F7', bg:'rgba(168,85,247,0.12)', label:'Idea' },
  'objects.goal.create': { icon: Target, color:'#22C55E', bg:'rgba(34,197,94,0.12)', label:'Goal' },
  'create_goal': { icon: Target, color:'#22C55E', bg:'rgba(34,197,94,0.12)', label:'Goal' },
  'workspace.create': { icon: Boxes, color:'#6366F1', bg:'rgba(99,102,241,0.12)', label:'Workspace' },
  'objects.vault.secret.create': { icon: Lock, color:'#F59E0B', bg:'rgba(245,158,11,0.12)', label:'Vault' },
  'search.ecosystem': { icon: Search, color:'#06B6D4', bg:'rgba(6,182,214,0.12)', label:'Search' },
  'search_ecosystem': { icon: Search, color:'#06B6D4', bg:'rgba(6,182,214,0.12)', label:'Search' },
  'ui.navigate': { icon: Navigation, color:'#EC4899', bg:'rgba(236,72,153,0.12)', label:'Navigate' },
  'navigate_workspace': { icon: Navigation, color:'#EC4899', bg:'rgba(236,72,153,0.12)', label:'Navigate' },
  'objects.tag.create': { icon: Tag, color:'#EAB308', bg:'rgba(234,179,8,0.12)', label:'Tag' },
  'objects.form.read': { icon: FormInput, color:'#8B5CF6', bg:'rgba(139,92,246,0.12)', label:'Form' },
  'math.solve': { icon: Calculator, color:'#F97316', bg:'rgba(249,115,22,0.12)', label:'Math' },
};

function ToolChip({ actionId }: { actionId: string }) {
  const v = TOOL_VISUAL[actionId] || { icon: Sparkles, color:'#9CA3AF', bg:'rgba(255,255,255,0.06)', label:'Tool' };
  const Icon = v.icon;
  return (
    <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full border text-[11px] font-bold" style={{ background: v.bg, borderColor: `${v.color}30`, color: v.color }}>
      <Icon size={12} />{v.label} <span className="opacity-60 font-mono text-[10px]">{actionId}</span>
    </span>
  );
}

function SectionBlock({ title, children, icon: Icon, accent }: { title: string; children: React.ReactNode; icon?: React.ElementType; accent?: string }) {
  return (
    <div className="rounded-[18px] bg-[#0A0908] border border-white/[0.06] p-4 space-y-3">
      <div className="flex items-center gap-2">
        {Icon && <div className="p-1.5 rounded-lg bg-white/[0.04] border border-white/[0.06]" style={{ color: accent }}><Icon size={14} /></div>}
        <h3 className="text-[11px] font-extrabold uppercase tracking-wider text-white/55">{title}</h3>
      </div>
      <div>{children}</div>
    </div>
  );
}

type PromptDrawerProps = {
  flow: DiscoverFlow | (WorkflowChain & { publisher?: any });
  onClose: () => void;
  // when viewing a flow as prompt template, flow itself is the template
};

const INBUILT_TABS = [
  { id:'sidekick', label:'Sidekick', desc:'Per-object companion' },
  { id:'agentic', label:'Agentic', desc:'Kylie workspace partner' },
  { id:'vault', label:'Vault', desc:'Organize / audit' },
  { id:'flow', label:'This Flow', desc:'Agent = prompt + tools' },
] as const;

export function PromptDrawer({ flow, onClose }: PromptDrawerProps) {
  const [tab, setTab] = useState<'sidekick'|'agentic'|'vault'|'flow'>('flow');
  const isCustomAgent = flow.id === 'kylrix-custom-agent';
  // default tab: if custom agent, show sidekick; otherwise show flow
  const activeTab = isCustomAgent ? tab : 'flow';

  const sidekickPrompt = useMemo(() => buildSidekickSystemInstruction({ id: flow.id, type: 'note', title: flow.name }), [flow.id, flow.name]);
  const agenticPrompt = useMemo(() => assembleSystemInstructionBlocks({}), []);
  const vaultPrompt = useMemo(() => `VAULT_ORGANIZE / PASSWORD_AUDIT / URL_SAFETY — lib/actions/ai.ts\n- Organize duplicates, weak passwords, breached urls.\n- Tool calls: objects.vault.secret.read, objects.vault.secret.search, user.profile.read`, []);

  const copy = async (text: string) => {
    try { await navigator.clipboard.writeText(text); } catch {}
  };

  return (
    <div className="relative flex h-full min-h-0 w-full flex-col bg-[#161412] text-white font-satoshi">
      <header className="flex items-start justify-between gap-3 px-5 py-4 border-b border-white/[0.06] shrink-0">
        <div className="min-w-0">
          <p className="text-[10px] font-extrabold uppercase tracking-wider text-white/40 mb-1 flex items-center gap-1.5"><Bot size={12}/> Prompt</p>
          <h2 className="font-clash text-lg font-semibold truncate">{flow.name}</h2>
          <p className="text-[11px] text-white/40 mt-1">Agents are prompts — system instructions + tools. Beautifully sectioned below.</p>
        </div>
        <button type="button" onClick={onClose} className="p-2 rounded-xl bg-[#0A0908] border border-white/[0.06] text-white/45 hover:text-white cursor-pointer shrink-0"><X size={16}/></button>
      </header>

      {isCustomAgent && (
        <div className="px-5 pt-3 flex gap-1.5 overflow-x-auto shrink-0">
          {INBUILT_TABS.map(t => (
            <button key={t.id} type="button" onClick={()=>setTab(t.id as any)} className={`px-3 py-1.5 rounded-xl text-xs font-extrabold border whitespace-nowrap cursor-pointer ${activeTab===t.id ? 'bg-[#A855F7] border-[#A855F7] text-white' : 'bg-[#0A0908] border-white/[0.06] text-white/50 hover:text-white'}`}>{t.label}</button>
          ))}
        </div>
      )}

      <div className="flex-1 overflow-y-auto min-h-0 p-5 space-y-4">
        {activeTab === 'flow' && (
          <>
            <SectionBlock title="Agent Definition" icon={Bot} accent="#A855F7">
              <p className="text-xs text-white/60 leading-relaxed">{flow.description || 'This flow is an agent: its prompt + tool allowlist define its behavior.'}</p>
              <div className="mt-3 flex flex-wrap gap-1.5">
                {(flow.steps||[]).map((s,i)=>(<ToolChip key={i} actionId={s.actionId}/>))}
                {(!flow.steps || flow.steps.length===0) && <span className="text-xs text-white/30">No tools yet — add tools in Create Flow.</span>}
              </div>
            </SectionBlock>

            <SectionBlock title="System Instructions (rendered)" icon={Eye} accent="#22C55E">
              <div className="rounded-xl bg-[#0A0908] border border-white/[0.06] p-3 space-y-2">
                <p className="text-xs font-bold text-white">Flow: {flow.name}</p>
                <p className="text-[11px] text-white/50">Niche: {(flow as any).niche}</p>
                <div className="h-px bg-white/[0.06]" />
                <p className="text-xs text-white/70 leading-relaxed whitespace-pre-wrap">You are an agent for &quot;{flow.name}&quot;. Use the tools above to fulfill the flow. Follow step order, emit one toolCall at a time, keep mutations scoped to the signed-in user.</p>
                <div className="flex flex-wrap gap-1.5 pt-1">
                  {(flow.steps||[]).slice(0,6).map((s,i)=>(<span key={i} className="text-[10px] font-mono px-2 py-1 rounded-lg bg-[#161412] border border-white/[0.06] text-white/50">{s.actionId}</span>))}
                </div>
              </div>
            </SectionBlock>

            <SectionBlock title="Flow JSON (prompt template)" icon={FileText} accent="#6366F1">
              <div className="rounded-xl bg-[#0A0908] border border-white/[0.06] overflow-hidden">
                <div className="flex items-center justify-between px-3 py-2 border-b border-white/[0.06] bg-[#161412]">
                  <span className="text-[11px] font-mono text-white/40">{(flow.name || 'untitled').toLowerCase().replace(/[^a-z0-9]+/g,'-')}.json</span>
                  <button type="button" onClick={()=>copy(JSON.stringify(flow, null, 2))} className="p-1.5 rounded-lg bg-white/[0.04] border border-white/[0.06] text-white/40 hover:text-white cursor-pointer"><Copy size={12}/></button>
                </div>
                <pre className="p-3 text-[11px] font-mono text-white/70 whitespace-pre-wrap max-h-[280px] overflow-auto">{JSON.stringify({ id: flow.id, name: flow.name, description: flow.description, niche: (flow as any).niche, steps: flow.steps }, null, 2)}</pre>
              </div>
            </SectionBlock>
          </>
        )}

        {activeTab === 'sidekick' && (
          <SectionBlock title="Sidekick — per-object companion" icon={Sparkles} accent="#A855F7">
            <div className="space-y-2">
              <div className="flex flex-wrap gap-1.5"><ToolChip actionId="tool.object.read"/><ToolChip actionId="tool.sidekick.summarize"/><ToolChip actionId="tool.agentic.chat"/><ToolChip actionId="tool.object.map.render"/></div>
              <pre className="rounded-xl bg-[#0A0908] border border-white/[0.06] p-3 text-[11px] font-mono text-white/65 whitespace-pre-wrap max-h-[420px] overflow-auto">{sidekickPrompt}</pre>
              <button type="button" onClick={()=>copy(sidekickPrompt)} className="w-full py-2 rounded-xl bg-white/[0.04] border border-white/[0.06] text-xs font-bold text-white/60 hover:text-white cursor-pointer flex items-center justify-center gap-1.5"><Copy size={12}/> Copy prompt</button>
            </div>
          </SectionBlock>
        )}
        {activeTab === 'agentic' && (
          <SectionBlock title="Agentic — Kylie workspace partner" icon={Bot} accent="#6366F1">
            <div className="space-y-2">
              <div className="flex flex-wrap gap-1.5"><ToolChip actionId="create_note"/><ToolChip actionId="create_goal"/><ToolChip actionId="search.ecosystem"/><ToolChip actionId="ui.navigate"/></div>
              <pre className="rounded-xl bg-[#0A0908] border border-white/[0.06] p-3 text-[11px] font-mono text-white/65 whitespace-pre-wrap max-h-[420px] overflow-auto">{agenticPrompt.slice(0, 8000)}</pre>
              <button type="button" onClick={()=>copy(agenticPrompt)} className="w-full py-2 rounded-xl bg-white/[0.04] border border-white/[0.06] text-xs font-bold text-white/60 hover:text-white cursor-pointer flex items-center justify-center gap-1.5"><Copy size={12}/> Copy prompt</button>
            </div>
          </SectionBlock>
        )}
        {activeTab === 'vault' && (
          <SectionBlock title="Vault — organizer & audit" icon={Shield} accent="#F59E0B">
            <div className="space-y-2">
              <div className="flex flex-wrap gap-1.5"><ToolChip actionId="objects.vault.secret.search"/><ToolChip actionId="objects.vault.secret.create"/></div>
              <pre className="rounded-xl bg-[#0A0908] border border-white/[0.06] p-3 text-[11px] font-mono text-white/65 whitespace-pre-wrap max-h-[420px] overflow-auto">{vaultPrompt}</pre>
              <p className="text-[11px] text-white/30">Source: lib/actions/ai.ts — VAULT_ORGANIZE, PASSWORD_AUDIT, URL_SAFETY</p>
            </div>
          </SectionBlock>
        )}
      </div>
    </div>
  );
}
