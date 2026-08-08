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
      try {
        const { LocalEngine } = await import('@/lib/services/LocalEngine');
        // Try note cache first
        const note = await LocalEngine.cacheGet<any>(`note_${detail.id}`).catch(() => null);
        if (note) {
          title = title || note.title;
          content = note.content;
          tags = note.tags;
        }
      } catch {}
      setTarget({ type: detail.type, id: detail.id, title, content, tags });
      setOpen(true);
    };
    window.addEventListener('kylrix:open-sidekick' as any, handler);
    return () => window.removeEventListener('kylrix:open-sidekick' as any, handler);
  }, []);

  return <SidekickDrawer open={open} target={target} onClose={() => setOpen(false)} />;
}
