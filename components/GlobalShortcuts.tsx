"use client";

import React, { useEffect, useState, lazy, Suspense } from 'react';
import { useRouter } from 'next/navigation';
import { useOverlay } from '@/components/ui/OverlayContext';
import { useNotes } from '@/context/NotesContext';
import { createNavigationPolicy } from '@/lib/sdk';
import toast from 'react-hot-toast';

// Lazy load heavy components
const KeyboardShortcuts = lazy(() => import("@/components/KeyboardShortcuts"));
const EcosystemPortal = lazy(() => import("@/components/common/EcosystemPortal").then(m => ({ default: m.EcosystemPortal })));



function isTypingTarget(target: EventTarget | null): boolean {
  if (!(target instanceof HTMLElement)) return false;
  const editable = target.closest(
    'input, textarea, select, [contenteditable="true"], .ProseMirror'
  );
  return !!editable;
}

export default function GlobalShortcuts() {
  const router = useRouter();
  const { openOverlay } = useOverlay();
  const { upsertNote } = useNotes();
  const [openShortcuts, setOpenShortcuts] = useState(false);
  const [openEcosystem, setOpenEcosystem] = useState(false);



  useEffect(() => {
    const navigationPolicy = createNavigationPolicy({ suppressBrowserMenu: true, suppressReload: true });
    const handler = (e: KeyboardEvent) => {
      const hasMeta = e.metaKey || e.ctrlKey;
      
      const key = e.key.toLowerCase();

      if (navigationPolicy.shouldSuppressReload(e)) {
        e.preventDefault();
        return;
      }

      // Cmd/Ctrl + Space => open ecosystem portal
      if (hasMeta && key === " ") {
        e.preventDefault();
        setOpenEcosystem(prev => !prev);
        return;
      }

      // Cmd/Ctrl + Shift + S => Drawer Spark-to-Ghost Relay Snapshot
      if (hasMeta && e.shiftKey && key === "s") {
        e.preventDefault();
        
        if (typeof window !== 'undefined') {
          let draftKey = null;
          let draftData = null;
          
          for (let i = 0; i < localStorage.length; i++) {
            const k = localStorage.key(i);
            if (k && k.startsWith('kylrix:draft:')) {
              const val = localStorage.getItem(k);
              if (val) {
                try {
                  const parsed = JSON.parse(val);
                  if (parsed && Object.keys(parsed).length > 0) {
                    draftKey = k;
                    draftData = parsed;
                    break;
                  }
                } catch {}
              }
            }
          }
          
          if (!draftKey || !draftData) {
            toast.error('No active drawer draft found to snapshot.');
            return;
          }
          
          let kind = 'note';
          let title = 'Drawer Draft Snapshot';
          if (draftKey.includes('secret')) {
            kind = 'password';
            title = draftData.name || 'Secret Draft Snapshot';
          } else if (draftKey.includes('event')) {
            kind = 'event';
            title = draftData.title || 'Event Draft Snapshot';
          } else if (draftKey.includes('form')) {
            kind = 'form';
            title = draftData.title || 'Form Draft Snapshot';
          } else if (draftKey.includes('tag')) {
            kind = 'tag';
            title = draftData.name || 'Tag Draft Snapshot';
          } else if (draftKey.includes('note')) {
            kind = 'note';
            title = draftData.title || 'Note Draft Snapshot';
          }
          
          const toastId = toast.loading(`Snapshotting ${kind} draft E2EE relay...`);
          
          (async () => {
            try {
              const { encryptGhostData } = await import('@/lib/encryption/ghost-crypto');
              const { AppwriteService } = await import('@/lib/appwrite');
              
              const ghostSecret = crypto.randomUUID();
              const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString();
              
              const titleEnc = await encryptGhostData(title);
              const contentEnc = await encryptGhostData(JSON.stringify(draftData), titleEnc.key);
              
              const note = await AppwriteService.createSendGhostObject({
                title: titleEnc.encrypted,
                content: contentEnc.encrypted,
                format: 'markdown',
                ghostSecret,
                expiresAt,
                isEncrypted: true,
                sendObject: { kind }
              });
              
              const origin = typeof window !== 'undefined' ? window.location.origin : '';
              const url = `${origin}/send/${note.$id}/${titleEnc.key}`;
              
              await navigator.clipboard.writeText(url);
              
              try {
                const existing = JSON.parse(localStorage.getItem('kylrix_send_sparks') || '[]');
                const newSpark = {
                  id: note.$id,
                  kind,
                  title,
                  url,
                  expiresAt,
                };
                localStorage.setItem('kylrix_send_sparks', JSON.stringify([newSpark, ...existing]));
              } catch {}
              
              toast.success(`Relay link copied to clipboard! Share it in chat.`, { id: toastId });
            } catch (err: any) {
              console.error('Snapshot failed:', err);
              toast.error(`Relay snapshot failed: ${err.message || 'Error'}`, { id: toastId });
            }
          })();
        }
        return;
      }

      if (!hasMeta) return;

      // Cmd/Ctrl + K => focus top bar search
      if (key === "k" && !e.altKey) {
        e.preventDefault();
        const input = document.getElementById("topbar-search-input") as HTMLInputElement | null;
        if (input) {
          input.focus();
          input.select?.();
        }
        return;
      }

      // Cmd/Ctrl + / => open shortcuts
      if ((key === "/" || key === "?") && !e.altKey) {
        e.preventDefault();
        setOpenShortcuts(true);
        return;
      }

      // Avoid interfering with typing for other combos
      const typing = isTypingTarget(e.target);

      // Cmd/Ctrl + N => create new note (navigate to /note if not there)
      if (key === "n" && !e.altKey && !typing) {
        e.preventDefault();
        if (window.location.pathname.startsWith("/note")) {
          // Dynamically import CreateNoteForm when needed
          import("@/app/(app)/note/(app)/notes/CreateNoteForm").then(({ default: CreateNoteForm }) => {
            openOverlay(<CreateNoteForm onNoteCreated={(n) => upsertNote(n)} />);
          });
        } else {
          try {
            sessionStorage.setItem("open-create-note", "1");
          } catch {}
          router.push("/note/notes");
        }
        return;
      }
    };

    window.addEventListener("keydown", handler);
    const contextMenuHandler = (event: MouseEvent) => {
      if (navigationPolicy.shouldSuppressContextMenu()) {
        event.preventDefault();
      }
    };

    window.addEventListener('contextmenu', contextMenuHandler, true);

    return () => {
      window.removeEventListener("keydown", handler);
      window.removeEventListener('contextmenu', contextMenuHandler, true);
    };
  }, [openOverlay, router, upsertNote]);

  return (
    <Suspense fallback={null}>
      {openShortcuts && <KeyboardShortcuts open={openShortcuts} onClose={() => setOpenShortcuts(false)} />}
      <EcosystemPortal open={openEcosystem} onClose={() => setOpenEcosystem(false)} />
    </Suspense>
  );
}
