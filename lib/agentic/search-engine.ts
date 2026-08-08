/**
 * Ecosystem search engine — multi-domain, token-efficient traversal.
 * Resolves vague queries ("what's for today") into domain hints + ranked hits.
 */

import { redactPIIAndSensitiveFields } from '@/lib/tools/registry';

export type SearchDomain =
  | 'idea'
  | 'goal'
  | 'event'
  | 'form'
  | 'project'
  | 'tag'
  | 'ui'
  | 'all';

export interface SearchHit {
  domain: SearchDomain;
  id: string;
  title: string;
  snippet?: string;
  route?: string;
  score: number;
  meta?: Record<string, unknown>;
}

export interface SearchPlan {
  domains: SearchDomain[];
  reasoning: string;
  temporal?: 'today' | 'week' | 'overdue' | 'none';
}

const TEMPORAL_PATTERNS: Array<{ re: RegExp; temporal: SearchPlan['temporal']; domains: SearchDomain[] }> = [
  { re: /\b(today|tonight|this morning|this afternoon)\b/i, temporal: 'today', domains: ['goal', 'event'] },
  { re: /\b(this week|upcoming|soon)\b/i, temporal: 'week', domains: ['goal', 'event'] },
  { re: /\b(overdue|late|missed)\b/i, temporal: 'overdue', domains: ['goal'] },
  { re: /\b(note|idea|ideas)\b/i, temporal: 'none', domains: ['idea'] },
  { re: /\b(goal|task|todo)\b/i, temporal: 'none', domains: ['goal'] },
  { re: /\b(event|calendar|meeting)\b/i, temporal: 'none', domains: ['event'] },
  { re: /\b(form|survey|response)\b/i, temporal: 'none', domains: ['form'] },
  { re: /\b(project|workspace)\b/i, temporal: 'none', domains: ['project'] },
  { re: /\b(settings?|passkey|security)\b/i, temporal: 'none', domains: ['ui'] },
];

function planSearchQuery(query: string): SearchPlan {
  const q = String(query || '').trim();
  if (!q) {
    return { domains: ['all'], reasoning: 'Empty query — broad scan', temporal: 'none' };
  }

  const domainSet = new Set<SearchDomain>();
  let temporal: SearchPlan['temporal'] = 'none';
  const reasons: string[] = [];

  for (const pat of TEMPORAL_PATTERNS) {
    if (pat.re.test(q)) {
      pat.domains.forEach((d) => domainSet.add(d));
      if (pat.temporal && pat.temporal !== 'none') temporal = pat.temporal;
      reasons.push(`matched ${pat.domains.join('+')}`);
    }
  }

  if (domainSet.size === 0) {
    domainSet.add('all');
    reasons.push('no domain keyword — scan all');
  }

  return {
    domains: Array.from(domainSet),
    reasoning: reasons.join('; ') || 'keyword routing',
    temporal};
}

function scoreMatch(hay: string, needle: string): number {
  const h = hay.toLowerCase();
  const n = needle.toLowerCase().trim();
  if (!n) return 0;
  if (h === n) return 1;
  if (h.startsWith(n)) return 0.85;
  if (h.includes(n)) return 0.6;
  const tokens = n.split(/\s+/).filter(Boolean);
  const hit = tokens.filter((t) => h.includes(t)).length;
  return hit / Math.max(tokens.length, 1) * 0.5;
}

function isToday(iso?: string | null): boolean {
  if (!iso) return false;
  const d = new Date(iso);
  const now = new Date();
  return (
    d.getFullYear() === now.getFullYear() &&
    d.getMonth() === now.getMonth() &&
    d.getDate() === now.getDate()
  );
}

export async function executeEcosystemSearch(
  query: string,
  opts?: {
    limit?: number;
    userId?: string;
    localNotes?: any[];
    localTasks?: any[];
  }): Promise<{ plan: SearchPlan; hits: SearchHit[] }> {
  const limit = opts?.limit ?? 20;
  const plan = planSearchQuery(query);
  const hits: SearchHit[] = [];
  const domains = plan.domains.includes('all')
    ? (['idea', 'goal', 'event', 'form', 'project', 'ui'] as SearchDomain[])
    : plan.domains;

  for (const domain of domains) {
    try {
      if (domain === 'idea') {
        let rows: any[] = Array.isArray(opts?.localNotes) ? opts!.localNotes! : [];
        if (!rows.length) {
          const { listNotes } = await import('@/lib/appwrite/note');
          const res = await listNotes();
          rows = res.rows || [];
        }
        for (const row of rows) {
          const title = String((row as any).title || 'Untitled');
          const content = String((row as any).content || '');
          const score = Math.max(scoreMatch(title, query), scoreMatch(content.slice(0, 500), query));
          if (score > 0.2 || plan.domains.includes('all')) {
            hits.push({
              domain: 'idea',
              id: (row as any).$id,
              title,
              snippet: content.slice(0, 120),
              route: `/app/${(row as any).$id}`,
              score});
          }
        }
      } else if (domain === 'goal') {
        let rows: any[] = Array.isArray(opts?.localTasks) ? opts!.localTasks! : [];
        if (!rows.length) {
          const { listFlowTasks } = await import('@/lib/appwrite/note');
          const res = await listFlowTasks();
          rows = res.rows || [];
        }
        for (const row of rows) {
          const title = String((row as any).title || 'Untitled');
          const desc = String((row as any).description || '');
          let score = Math.max(scoreMatch(title, query), scoreMatch(desc, query));
          const due = (row as any).dueDate as string | undefined;
          if (plan.temporal === 'today' && isToday(due)) score += 0.4;
          if (plan.temporal === 'overdue' && due && new Date(due) < new Date()) score += 0.5;
          if (score > 0.2 || plan.temporal !== 'none') {
            hits.push({
              domain: 'goal',
              id: (row as any).$id,
              title,
              snippet: desc.slice(0, 120),
              route: '/goals',
              score,
              meta: { dueDate: due, status: (row as any).status }});
          }
        }
      } else if (domain === 'ui') {
        const { resolveUiDestination, UI_DESTINATIONS } = await import('./ui-catalog');
        const resolved = resolveUiDestination(query);
        if (resolved) {
          hits.push({
            domain: 'ui',
            id: resolved.id,
            title: resolved.label,
            snippet: resolved.description,
            route: resolved.route,
            score: 0.95});
        } else {
          for (const d of UI_DESTINATIONS) {
            const score = scoreMatch([d.label, ...d.aliases].join(' '), query);
            if (score > 0.3) {
              hits.push({
                domain: 'ui',
                id: d.id,
                title: d.label,
                snippet: d.description,
                route: d.route,
                score});
            }
          }
        }
      } else if (domain === 'form' && opts?.userId) {
        const { FormsService } = await import('@/lib/services/forms');
        const res = await FormsService.listUserForms(opts.userId);
        const rows = Array.isArray(res) ? res : (res as any)?.rows || [];
        for (const row of rows) {
          const title = String(row.title || 'Untitled Form');
          const score = scoreMatch(title, query);
          if (score > 0.2) {
            hits.push({
              domain: 'form',
              id: row.$id,
              title,
              route: `/forms/${row.$id}`,
              score});
          }
        }
      } else if (domain === 'project') {
        const { ProjectsService } = await import('@/lib/appwrite/projects');
        const list = await ProjectsService.listProjects(true);
        for (const row of list.rows || []) {
          const title = String((row as any).title || 'Untitled');
          const score = scoreMatch(title + ' ' + ((row as any).summary || ''), query);
          if (score > 0.2) {
            hits.push({
              domain: 'project',
              id: (row as any).$id,
              title,
              route: `/workspace/${(row as any).$id}`,
              score});
          }
        }
      }
    } catch (e) {
      console.warn(`[SearchEngine] domain ${domain} failed:`, e);
    }
  }

  const ranked = hits.sort((a: any, b: any) => b.score - a.score).slice(0, limit);
  return {
    plan,
    hits: redactPIIAndSensitiveFields(ranked) as SearchHit[]};
}
