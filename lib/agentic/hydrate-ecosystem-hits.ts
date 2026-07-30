/**
 * Hydrate ecosystem hit refs from local copy — titles, snippets, thumbnails in milliseconds.
 */

import type { SearchDomain } from './search-engine';
import type { EcosystemHitRef } from './message-blocks';
import { resolveUiDestination, UI_DESTINATIONS } from './ui-catalog';
import { resolveNoteCardTitle } from '@/constants/noteTitle';

export interface HydratedEcosystemHit {
  domain: SearchDomain;
  id: string;
  title: string;
  snippet?: string;
  route?: string;
  accent: string;
  tags?: string[];
  meta?: {
    dueDate?: string;
    status?: string;
    attachmentCount?: number;
    hasImage?: boolean;
    previewImageUrl?: string | null;
    updatedAt?: string;
  };
}

const DOMAIN_ACCENT: Record<SearchDomain, string> = {
  idea: '#EC4899',
  goal: '#A855F7',
  event: '#6366F1',
  form: '#6366F1',
  project: '#10B981',
  tag: '#F59E0B',
  ui: '#818CF8',
  all: '#9B9691'};

const DOMAIN_LABEL: Record<SearchDomain, string> = {
  idea: 'Idea',
  goal: 'Goal',
  event: 'Event',
  form: 'Form',
  project: 'Project',
  tag: 'Tag',
  ui: 'Page',
  all: 'Item'};

export function ecosystemDomainLabel(domain: SearchDomain): string {
  return DOMAIN_LABEL[domain] || 'Item';
}

function extractNotePreviewImage(note: any): string | null {
  if (!note || note.isEncrypted) return null;
  const content = String(note.content || '');
  const mdMatch = content.match(/!\[.*?\]\((.*?)\)/);
  if (mdMatch?.[1]) return mdMatch[1];

  const htmlMatch = content.match(/<img\s+[^>]*src=["']([^"']+)["']/i);
  if (htmlMatch?.[1]) return htmlMatch[1];

  const OBJECT_BLOCK_REGEX = /\[\[kylrix-object:(\{.*?\})\]\]/g;
  let objMatch;
  while ((objMatch = OBJECT_BLOCK_REGEX.exec(content)) !== null) {
    try {
      const payload = JSON.parse(objMatch[1]);
      if (payload.childKind === 'image' || payload.type === 'image') {
        const url = payload.metadata?.fileUrl || payload.src || payload.url;
        if (url) return url;
      }
    } catch {
      /* skip */
    }
  }

  if (Array.isArray(note.attachments)) {
    for (const att of note.attachments) {
      try {
        const parsed = typeof att === 'string' ? JSON.parse(att) : att;
        if (parsed?.mimeType?.startsWith('image/') || parsed?.name?.match(/\.(jpeg|jpg|gif|png|webp|svg)$/i)) {
          if (parsed.fileUrl) return parsed.fileUrl;
        }
      } catch {
        /* skip */
      }
    }
  }
  return null;
}

function plainSnippet(text: string, max = 140): string {
  const stripped = text
    .replace(/\[\[kylrix-object:\{.*?\}\]\]/g, '')
    .replace(/!\[.*?\]\(.*?\)/g, '')
    .replace(/<[^>]+>/g, '')
    .replace(/[#*_>`~-]/g, '')
    .replace(/\s+/g, ' ')
    .trim();
  if (!stripped) return '';
  return stripped.length > max ? `${stripped.slice(0, max).trim()}…` : stripped;
}

export function hydrateEcosystemHitsSync(
  refs: EcosystemHitRef[],
  sources: {
    notes?: any[];
    tasks?: any[];
    getCachedData?: (key: string) => unknown;
  }): HydratedEcosystemHit[] {
  const notesById = new Map((sources.notes || []).map((n: any) => [n.$id || n.id, n]));
  const tasksById = new Map((sources.tasks || []).map((t: any) => [t.id || t.$id, t]));

  return refs.map((ref: any) => {
    const accent = DOMAIN_ACCENT[ref.domain as keyof typeof DOMAIN_ACCENT] || DOMAIN_ACCENT.all;

    if (ref.domain === 'idea') {
      const note =
        notesById.get(ref.id) ||
        (sources.getCachedData?.(`note_${ref.id}`) as any) ||
        null;
      const title = note
        ? resolveNoteCardTitle(note.title, note.content) || note.title || 'Untitled Idea'
        : 'Idea';
      const previewImageUrl = note ? extractNotePreviewImage(note) : null;
      const snippet = note ? plainSnippet(String(note.content || '')) : undefined;
      const tags = Array.isArray(note?.tags) ? note.tags.slice(0, 3) : undefined;
      return {
        domain: ref.domain,
        id: ref.id,
        title,
        snippet,
        route: `/app/${ref.id}`,
        accent,
        tags,
        meta: {
          attachmentCount: Array.isArray(note?.attachments) ? note.attachments.length : 0,
          hasImage: !!previewImageUrl,
          previewImageUrl,
          updatedAt: note?.$updatedAt || note?.updatedAt}};
    }

    if (ref.domain === 'goal') {
      const task = tasksById.get(ref.id) || null;
      return {
        domain: ref.domain,
        id: ref.id,
        title: task?.title || 'Goal',
        snippet: task?.description ? plainSnippet(String(task.description)) : undefined,
        route: '/goals',
        accent,
        tags: Array.isArray(task?.labels) ? task.labels.slice(0, 3) : undefined,
        meta: {
          dueDate: task?.dueDate ? String(task.dueDate) : undefined,
          status: task?.status,
          updatedAt: task?.updatedAt ? String(task.updatedAt) : undefined}};
    }

    if (ref.domain === 'ui') {
      const dest = resolveUiDestination(ref.id) || UI_DESTINATIONS.find((d) => d.id === ref.id);
      return {
        domain: ref.domain,
        id: ref.id,
        title: dest?.label || ref.id,
        snippet: dest?.description,
        route: dest?.route,
        accent};
    }

    if (ref.domain === 'form') {
      const cached = sources.getCachedData?.('f_forms_list') as any;
      const rows = Array.isArray(cached) ? cached : cached?.rows || [];
      const form = rows.find((r: any) => r.$id === ref.id);
      return {
        domain: ref.domain,
        id: ref.id,
        title: form?.title || 'Form',
        route: `/forms/${ref.id}`,
        accent,
        meta: { status: form?.status }};
    }

    if (ref.domain === 'project') {
      const cached = sources.getCachedData?.('f_projects_list') as any;
      const rows = Array.isArray(cached) ? cached : cached?.rows || [];
      const project = rows.find((r: any) => r.$id === ref.id);
      return {
        domain: ref.domain,
        id: ref.id,
        title: project?.title || 'Project',
        snippet: project?.summary ? plainSnippet(String(project.summary)) : undefined,
        route: `/workspaces/${ref.id}`,
        accent};
    }

    return {
      domain: ref.domain,
      id: ref.id,
      title: ecosystemDomainLabel(ref.domain),
      accent};
  });
}
