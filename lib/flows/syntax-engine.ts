/**
 * flowSyntaxEngine — modular live syntax for workflow JSON.
 * Knows every legal actionId, validates shape, suggests autocorrect, and highlights.
 * Used by CreateFlowDrawer JSON pane and anywhere flows are edited.
 */

import type { WorkflowChain, WorkflowStep } from '@/lib/workflow-engine';
import { AGENTIC_TOOLS_REGISTRY } from '@/lib/agentic/tools-registry';

// Known tool ids from agentic + universal registry (duplicated literal to avoid client import of node registry)
// This engine is client-safe — pure string lists.
export const KNOWN_ACTION_IDS: string[] = Array.from(
  new Set([
    ...AGENTIC_TOOLS_REGISTRY.map((t) => t.key),
    // canonical agentic keys also usable as workflow actionIds
    'create_note','update_note','get_note','create_goal','update_goal','create_project',
    'create_or_select_agent','open_wallet_funding','link_to_project','suggest_next_steps',
    'toggle_privacy','navigate_workspace','switch_workspace','ui.navigate','search_ecosystem',
    'objects.form.read','objects.form.submit','ui.preview.open','delete_resource','list_goals',
    // universal tool ids
    'workspace.create','workspace.read','workspace.update','workspace.delete','workspace.search',
    'objects.idea.create','objects.idea.read','objects.idea.update','objects.idea.delete','objects.idea.search',
    'objects.goal.create','objects.goal.read','objects.goal.update','objects.goal.delete','objects.goal.search',
    'objects.vault.secret.create','objects.vault.secret.read','objects.vault.secret.delete','objects.vault.secret.search',
    'objects.tag.create','objects.tag.search','user.profile.read','user.settings.update',
    'ui.navigate','objects.form.read','objects.form.submit','search.ecosystem','developer.pat.create',
    // builtin flow steps
    'tool.object.read','tool.sidekick.summarize','tool.agentic.chat','tool.object.map.render','tool.sidekick.persist',
    'tool.prompt.view','tool.prompt.inspect','tool.system.prompt.read','tool.prompt.template.view','tool.agent.prompt.render',
    'markdown.transform','markdown.math.render','math.solve','markdown.chart.render',
    // workspace note editor style
    'workspace.note.editor.click.save_btn','workspace.note.editor.click.make_public','workspace.note.editor.click.make_private',
    'productivity.flow.board.click.complete_task',
  ])
).sort();

export type Diagnostic = {
  path: string;
  message: string;
  severity: 'error' | 'warn';
  range?: { line: number; col: number };
  suggestion?: string;
};

function levenshtein(a: string, b: string): number {
  const m = a.length, n = b.length;
  const dp: number[][] = Array.from({ length: m + 1 }, () => Array(n + 1).fill(0));
  for (let i = 0; i <= m; i++) dp[i][0] = i;
  for (let j = 0; j <= n; j++) dp[0][j] = j;
  for (let i = 1; i <= m; i++) for (let j = 1; j <= n; j++) dp[i][j] = a[i-1]===b[j-1] ? dp[i-1][j-1] : 1+Math.min(dp[i-1][j], dp[i][j-1], dp[i-1][j-1]);
  return dp[m][n];
}

export function autocorrectActionId(input: string): string | null {
  if (!input) return null;
  let best: string | null = null; let bestD = Infinity;
  for (const cand of KNOWN_ACTION_IDS) {
    const d = levenshtein(input, cand);
    if (d < bestD && d <= 3) { bestD = d; best = cand; }
  }
  return best;
}

export function suggestActionIds(prefix: string, limit = 8): string[] {
  const p = prefix.trim().toLowerCase();
  if (!p) return KNOWN_ACTION_IDS.slice(0, limit);
  const starts = KNOWN_ACTION_IDS.filter((id) => id.toLowerCase().startsWith(p));
  if (starts.length >= limit) return starts.slice(0, limit);
  const contains = KNOWN_ACTION_IDS.filter((id) => id.toLowerCase().includes(p) && !starts.includes(id));
  return [...starts, ...contains].slice(0, limit);
}

// Validate parsed flow shape (after JSON parse)
export function validateFlowStructure(obj: any): Diagnostic[] {
  const diags: Diagnostic[] = [];
  if (!obj || typeof obj !== 'object') { diags.push({ path:'$', message:'Flow must be an object', severity:'error'}); return diags; }
  if (typeof obj.name !== 'string' || !obj.name.trim()) diags.push({ path:'$.name', message:'name is required (string, non-empty)', severity:'error'});
  if (obj.description !== undefined && typeof obj.description !== 'string') diags.push({ path:'$.description', message:'description must be string', severity:'error'});
  if (obj.niche !== undefined && typeof obj.niche !== 'string') diags.push({ path:'$.niche', message:'niche must be string (workspace|productivity|security|connect|intelligence|billing|system)', severity:'warn'});
  if (!Array.isArray(obj.steps)) {
    diags.push({ path:'$.steps', message:'steps must be an array', severity:'error'});
  } else {
    obj.steps.forEach((st: any, i: number) => {
      const p = `$.steps[${i}]`;
      if (!st || typeof st !== 'object') { diags.push({ path:p, message:'step must be object', severity:'error'}); return; }
      if (typeof st.actionId !== 'string' || !st.actionId.trim()) {
        diags.push({ path:`${p}.actionId`, message:'actionId is required', severity:'error'});
      } else if (!KNOWN_ACTION_IDS.includes(st.actionId)) {
        const sug = autocorrectActionId(st.actionId);
        diags.push({ path:`${p}.actionId`, message:`Unknown actionId "${st.actionId}"`, severity:'error', suggestion: sug ? `Did you mean "${sug}"?` : undefined });
      }
      if (st.importance && !['high','low'].includes(st.importance)) diags.push({ path:`${p}.importance`, message:'importance must be high|low', severity:'warn'});
    });
  }
  if (obj.isPublic !== undefined && typeof obj.isPublic !== 'boolean') diags.push({ path:'$.isPublic', message:'isPublic must be boolean', severity:'warn'});
  return diags;
}

export function parseFlowJson(text: string): { ok: true; parsed: any; diagnostics: Diagnostic[] } | { ok: false; error: string; diagnostics: Diagnostic[]; line?: number; col?: number } {
  try {
    const parsed = JSON.parse(text);
    const diagnostics = validateFlowStructure(parsed);
    const hasError = diagnostics.some((d) => d.severity === 'error');
    // We return ok true even with structural errors — diagnostics carry them. Only JSON parse failure is ok:false
    if (hasError) {
      // still ok parse-wise, but diagnostics contain errors
    }
    return { ok: true, parsed, diagnostics };
  } catch (e: any) {
    const msg = e?.message || 'Invalid JSON';
    // try to extract line/col from SyntaxError
    let line: number | undefined, col: number | undefined;
    const m = msg.match(/position (\d+)/);
    if (m) {
      const pos = Number(m[1]);
      const before = text.slice(0, pos);
      line = before.split('\n').length;
      col = pos - before.lastIndexOf('\n');
    }
    return { ok: false, error: msg, diagnostics: [{ path:'$', message: msg, severity:'error', range: line ? { line, col: col||1 } : undefined }], line, col };
  }
}

export function buildFlowJsonTemplate(name: string, opts?: { niche?: string; description?: string; steps?: WorkflowStep[] }): string {
  const safeName = (name && name.trim()) ? name.trim() : 'Untitled';
  const chain: Record<string, any> = {
    id: safeName.toLowerCase().replace(/[^a-z0-9]+/g,'-').slice(0, 36) || 'untitled',
    name: safeName,
    description: opts?.description || '',
    niche: opts?.niche || 'workspace',
    steps: (opts?.steps || []).map((s) => ({ actionId: s.actionId, timestamp: s.timestamp || new Date().toISOString(), importance: s.importance || 'high' as const })),
    isPublic: false,
    isAnonymized: true,
    createdAt: new Date().toISOString(),
  };
  return JSON.stringify(chain, null, 2);
}

// Minimal tokenization for highlighting (key strings, values)
export type HlToken = { text: string; kind: 'key' | 'string' | 'number' | 'boolean' | 'null' | 'punct' | 'error' | 'plain' };

export function tokenizeForHighlight(jsonText: string, diagnostics: Diagnostic[]): HlToken[] {
  // naive but modular — splits on JSON structure; marks error lines
  const errorLines = new Set(diagnostics.filter(d=>d.range).map(d=>d.range!.line));
  const lines = jsonText.split('\n');
  const tokens: HlToken[] = [];
  lines.forEach((line, idx) => {
    const lineNo = idx + 1;
    const isErr = errorLines.has(lineNo);
    if (isErr) tokens.push({ text: line + '\n', kind: 'error' });
    else {
      // crude: detect "key": 
      const m = line.match(/^(\s*)"([^"]+)"(\s*:)/);
      if (m) {
        tokens.push({ text: m[1], kind:'plain'});
        tokens.push({ text: `"${m[2]}"`, kind:'key'});
        tokens.push({ text: m[3] + line.slice(m[0].length) + '\n', kind:'plain'});
      } else tokens.push({ text: line + '\n', kind:'plain'});
    }
  });
  return tokens;
}

// Heuristic flow generator for agentic prompt bar — maps natural language to tools.
const KEYWORD_MAP: Array<{ re: RegExp; ids: string[] }> = [
  { re: /\b(idea|note|document|write)\b/i, ids: ['objects.idea.create','objects.idea.search','objects.idea.update'] },
  { re: /\b(goal|task|todo|kanban)\b/i, ids: ['objects.goal.create','objects.goal.search','objects.goal.update'] },
  { re: /\b(project|workspace)\b/i, ids: ['workspace.create','workspace.search'] },
  { re: /\b(vault|secret|password|credential)\b/i, ids: ['objects.vault.secret.create','objects.vault.secret.search'] },
  { re: /\b(search|find|lookup|query)\b/i, ids: ['search.ecosystem','objects.idea.search'] },
  { re: /\b(navigate|open|go to)\b/i, ids: ['ui.navigate','navigate_workspace'] },
  { re: /\b(delete|remove|trash)\b/i, ids: ['delete_resource'] },
  { re: /\b(form|survey|response)\b/i, ids: ['objects.form.read','objects.form.submit'] },
  { re: /\b(chart|math|solve|graph|equation)\b/i, ids: ['markdown.math.render','math.solve','markdown.chart.render'] },
  { re: /\b(tag|crosslink)\b/i, ids: ['objects.tag.create'] },
];

export function heuristicGenerateSteps(prompt: string): WorkflowStep[] {
  const p = prompt.toLowerCase();
  const chosen: string[] = [];
  for (const { re, ids } of KEYWORD_MAP) if (re.test(p)) for (const id of ids) if (!chosen.includes(id)) chosen.push(id);
  if (!chosen.length) {
    // generic flow: capture intent as idea + goal
    chosen.push('objects.idea.create','objects.goal.create','search.ecosystem');
  }
  return chosen.slice(0, 8).map((actionId) => ({ actionId, timestamp: new Date().toISOString(), importance: 'high' as const }));
}

export function heuristicGenerateFlow(prompt: string, title: string): WorkflowChain {
  const steps = heuristicGenerateSteps(prompt);
  const safeTitle = title?.trim() || prompt.trim().slice(0, 40) || 'Untitled';
  return {
    id: safeTitle.toLowerCase().replace(/[^a-z0-9]+/g,'-').slice(0, 40) || `flow-${Date.now()}`,
    name: safeTitle,
    description: prompt.slice(0, 280) || 'Generated from prompt',
    niche: 'workspace' as any,
    steps,
    isPublic: false,
    isAnonymized: true,
    createdAt: new Date().toISOString(),
  };
}
