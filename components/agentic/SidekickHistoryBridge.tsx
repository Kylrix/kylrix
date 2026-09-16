'use client';
import { useEffect, useState } from 'react';
import { SidekickDrawer, type SidekickTarget } from './SidekickDrawer';

export function SidekickHistoryBridge() {
  const [target, setTarget] = useState<SidekickTarget | null>(null);
  const [open, setOpen] = useState(false);

  useEffect(() => {
    const handler = async (e: Event) => {
      const detail = (e as CustomEvent).detail as { type: string; id: string; title?: string };
      if (!detail?.type || !detail?.id) return;
      // Try to hydrate title/content from local copy (LocalEngine / Notes) before opening
      let title: string | undefined = detail.title;
      let content: string | undefined;
      let tags: string[] | undefined;
      let metadata: Record<string, unknown> | undefined;
      try {
        const { LocalEngine } = await import('@/lib/services/LocalEngine');
        if (detail.type === 'note' || detail.type === 'idea') {
          const note = await LocalEngine.cacheGet<any>(`note_${detail.id}`).catch(() => null);
          if (note) {
            title = title || note.title;
            content = content || note.content;
            tags = tags || note.tags;
          }
        } else if (detail.type === 'goal' || detail.type === 'task') {
          const tasks = (await LocalEngine.cacheGet<any[]>('f_tasks_list').catch(() => null)) || [];
          const goal = tasks.find((t) => t.id === detail.id || t.$id === detail.id);
          if (goal) {
            title = title || goal.title;
            content = content || goal.description;
            tags = tags || goal.labels || goal.tags;
            metadata = { status: goal.status, priority: goal.priority };
          }
        } else if (detail.type === 'event') {
          const events = (await LocalEngine.cacheGet<any[]>('f_events_list').catch(() => null)) || [];
          const evt = events.find((e) => e.id === detail.id || e.$id === detail.id);
          if (evt) {
            title = title || evt.title;
            content = content || evt.description;
            metadata = { startTime: evt.startTime, location: evt.location };
          }
        } else if (detail.type === 'form') {
          const form = await LocalEngine.cacheGet<any>(`form_${detail.id}`).catch(() => null);
          if (form) {
            title = title || form.title;
            content = content || form.description;
          }
        } else if (detail.type === 'credential' || detail.type === 'secret') {
          const cred = await LocalEngine.cacheGet<any>(`credential_${detail.id}`).catch(() => null);
          if (cred) {
            title = title || cred.name;
            content = content || cred.notes;
            tags = tags || cred.tags;
          }
        }
      } catch {}
      setTarget({ type: detail.type, id: detail.id, title, content, tags, metadata });
      setOpen(true);
    };
    window.addEventListener('kylrix:open-sidekick' as any, handler);
    return () => window.removeEventListener('kylrix:open-sidekick' as any, handler);
  }, []);

  return <SidekickDrawer open={open} target={target} onClose={() => setOpen(false)} />;
}
