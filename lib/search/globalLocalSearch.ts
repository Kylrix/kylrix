'use client';

export type GlobalResultKind =
  | 'note'
  | 'goal'
  | 'workspace'
  | 'event'
  | 'form'
  | 'flow'
  | 'secret'
  | 'totp'
  | 'moment'
  | 'chat'
  | 'thread'
  | 'tag';

export interface GlobalResult {
  kind: GlobalResultKind;
  id: string;
  title: string;
  subtitle: string;
  href: string;
  accent: string;
  raw?: any;
}

function includes(hay: string | undefined, q: string) {
  return (hay || '').toLowerCase().includes(q);
}

export interface GlobalSearchCtx {
  notes?: any[];
  tasks?: any[];
  workspaces?: any[];
  events?: any[];
  forms?: any[];
  flows?: any[];
  vaultCreds?: any[];
  vaultTotp?: any[];
  moments?: any[];
  chats?: any[];
  threads?: any[];
  tags?: any[];
}

const ACCENT: Record<GlobalResultKind, string> = {
  note: '#EC4899',
  goal: '#A855F7',
  workspace: '#6366F1',
  event: '#F472B6',
  form: '#A78BFA',
  flow: '#818CF8',
  secret: '#10B981',
  totp: '#06B6D4',
  moment: '#F59E0B',
  chat: '#F59E0B',
  thread: '#34D399',
  tag: '#F87171',
};

export function searchLocalEngine(qRaw: string, ctx: GlobalSearchCtx): GlobalResult[] {
  const q = qRaw.trim().toLowerCase();
  if (q.length < 2) return [];
  const out: GlobalResult[] = [];

  const notes = ctx.notes || [];
  for (const n of notes) {
    const title = n.title || n.name || 'Untitled';
    if (includes(title, q) || includes(n.content, q) || (Array.isArray(n.tags) && n.tags.join(' ').toLowerCase().includes(q))) {
      out.push({
        kind: 'note',
        id: n.$id || n.id,
        title,
        subtitle: (n.content || '').slice(0, 70) || (n.tags || []).join(' · '),
        href: `/app?openNoteId=${encodeURIComponent(n.$id || n.id)}`,
        accent: ACCENT.note,
        raw: n,
      });
    }
  }

  const tasks = ctx.tasks || [];
  for (const t of tasks) {
    const title = t.title || t.name || 'Untitled Goal';
    if (includes(title, q) || includes(t.description, q) || includes(t.status, q)) {
      out.push({
        kind: 'goal',
        id: t.id || t.$id,
        title,
        subtitle: t.description?.slice(0, 70) || t.status || '',
        href: `/goals`,
        accent: ACCENT.goal,
        raw: t,
      });
    }
  }

  const workspaces = ctx.workspaces || [];
  for (const w of workspaces) {
    const title = w.name || w.title || 'Workspace';
    if (includes(title, q) || includes(w.description, q) || includes(w.summary, q)) {
      out.push({
        kind: 'workspace',
        id: w.$id || w.id,
        title,
        subtitle: w.description?.slice(0, 60) || '',
        href: `/workspace/${encodeURIComponent(w.$id || w.id)}`,
        accent: ACCENT.workspace,
        raw: w,
      });
    }
  }

  const events = ctx.events || [];
  for (const e of events) {
    const title = e.title || 'Event';
    if (includes(title, q) || includes(e.description, q) || includes(e.location, q)) {
      out.push({
        kind: 'event',
        id: e.id || e.$id,
        title,
        subtitle: e.location || new Date(e.startTime || e.$createdAt).toLocaleDateString(),
        href: `/events`,
        accent: ACCENT.event,
        raw: e,
      });
    }
  }

  const forms = ctx.forms || [];
  for (const f of forms) {
    const title = f.title || 'Form';
    if (includes(title, q) || includes(f.description, q)) {
      out.push({
        kind: 'form',
        id: f.$id || f.id,
        title,
        subtitle: f.description?.slice(0, 60) || f.status || '',
        href: `/forms`,
        accent: ACCENT.form,
        raw: f,
      });
    }
  }

  const flows = ctx.flows || [];
  for (const fl of flows) {
    const title = fl.name || fl.title || 'Flow';
    if (includes(title, q) || includes(fl.description, q)) {
      out.push({
        kind: 'flow',
        id: fl.id || fl.$id,
        title,
        subtitle: `${fl.steps?.length || 0} steps`,
        href: `/flows`,
        accent: ACCENT.flow,
        raw: fl,
      });
    }
  }

  const vaultCreds = ctx.vaultCreds || [];
  for (const c of vaultCreds) {
    const title = c.title || c.name || c.username || 'Secret';
    if (includes(title, q) || includes(c.username, q) || includes(c.url, q)) {
      out.push({
        kind: 'secret',
        id: c.$id || c.id,
        title,
        subtitle: c.username || c.url || '',
        href: `/vault`,
        accent: ACCENT.secret,
        raw: c,
      });
    }
  }

  const vaultTotp = ctx.vaultTotp || [];
  for (const t of vaultTotp) {
    const title = t.issuer || t.label || t.title || 'TOTP';
    if (includes(title, q) || includes(t.label, q) || includes(t.accountName, q)) {
      out.push({
        kind: 'totp',
        id: t.$id || t.id,
        title,
        subtitle: t.label || t.accountName || '',
        href: `/vault`,
        accent: ACCENT.totp,
        raw: t,
      });
    }
  }

  const moments = ctx.moments || [];
  for (const m of moments) {
    const title = m.caption || m.title || 'Moment';
    if (includes(title, q) || includes(m.content, q)) {
      out.push({
        kind: 'moment',
        id: m.$id || m.id,
        title: title.slice(0, 50),
        subtitle: (m.content || '').slice(0, 60),
        href: `/connect`,
        accent: ACCENT.moment,
        raw: m,
      });
    }
  }

  const chats = ctx.chats || [];
  for (const ch of chats) {
    const title = ch.name || ch.title || 'Chat';
    if (includes(title, q) || includes(ch.lastMessageText, q)) {
      out.push({
        kind: 'chat',
        id: ch.$id || ch.id,
        title,
        subtitle: ch.lastMessageText?.slice(0, 60) || '',
        href: `/connect/chats?c=${encodeURIComponent(ch.$id || ch.id)}`,
        accent: ACCENT.chat,
        raw: ch,
      });
    }
  }

  const threads = ctx.threads || [];
  for (const th of threads) {
    const title = th.name || th.title || 'Thread';
    if (includes(title, q) || includes(th.lastMessageText, q)) {
      out.push({
        kind: 'thread',
        id: th.$id || th.id,
        title,
        subtitle: th.lastMessageText?.slice(0, 60) || '',
        href: `/connect/chats?c=${encodeURIComponent(th.$id || th.id)}`,
        accent: ACCENT.thread,
        raw: th,
      });
    }
  }

  const tags = ctx.tags || [];
  for (const tg of tags) {
    const title = tg.name || tg.title || 'Tag';
    if (includes(title, q)) {
      out.push({
        kind: 'tag',
        id: tg.$id || tg.id,
        title,
        subtitle: `#${title}`,
        href: `/tags`,
        accent: ACCENT.tag,
        raw: tg,
      });
    }
  }

  // Cap per kind to keep UI fast, sort by title relevance (startsWith first)
  const byKind: Record<string, GlobalResult[]> = {};
  for (const r of out) {
    byKind[r.kind] = byKind[r.kind] || [];
    byKind[r.kind].push(r);
  }
  const orderedKinds: GlobalResultKind[] = ['note','goal','workspace','event','form','flow','secret','totp','moment','chat','thread','tag'];
  const capped: GlobalResult[] = [];
  for (const k of orderedKinds) {
    const arr = byKind[k];
    if (!arr) continue;
    arr.sort((a,b) => {
      // LocalEngine SoT: pinned first then $updatedAt desc (sync skill) before relevance
      const aPinned = a.raw?.isPinned ? 0 : 1;
      const bPinned = b.raw?.isPinned ? 0 : 1;
      if (aPinned !== bPinned) return aPinned - bPinned;
      const aT = new Date(a.raw?.$updatedAt || a.raw?.updatedAt || a.raw?.createdAt || 0).getTime();
      const bT = new Date(b.raw?.$updatedAt || b.raw?.updatedAt || b.raw?.createdAt || 0).getTime();
      if (aT !== bT) return bT - aT;
      const aStarts = a.title.toLowerCase().startsWith(q) ? 0 : 1;
      const bStarts = b.title.toLowerCase().startsWith(q) ? 0 : 1;
      return aStarts - bStarts;
    });
    capped.push(...arr.slice(0, 6));
  }
  return capped;
}
