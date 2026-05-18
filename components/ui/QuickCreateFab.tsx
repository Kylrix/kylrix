'use client';

import { useMemo, useState } from 'react';
import { usePathname, useRouter } from 'next/navigation';
import {
  Box,
  SpeedDial,
  SpeedDialAction,
  SpeedDialIcon,
} from '@mui/material';
import { FolderKanban, FileText, Hash, Plus, X } from 'lucide-react';
import CreateNoteForm from '@/app/(app)/note/(app)/notes/CreateNoteForm';
import { useOverlay } from '@/components/ui/OverlayContext';
import { useNotes } from '@/context/NotesContext';

type CreateKind = 'note' | 'project';

const actions = [
  { icon: <FileText size={20} strokeWidth={1.5} />, name: 'Note', action: 'note' },
  { icon: <Hash size={20} strokeWidth={1.5} />, name: 'Tag', action: 'tag' },
  { icon: <FolderKanban size={20} strokeWidth={1.5} />, name: 'Project', action: 'project' },
];

function openComposerSession(kind: CreateKind) {
  try {
    sessionStorage.setItem(kind === 'project' ? 'open-create-project' : 'open-create-note', '1');
  } catch {
    // Ignore storage failures; navigation still works.
  }
}

export default function QuickCreateFab() {
  const router = useRouter();
  const pathname = usePathname();
  const { openOverlay } = useOverlay();
  const { upsertNote } = useNotes();
  const [open, setOpen] = useState(false);
  const isNoteSpace = pathname?.startsWith('/note');

  const baseSx = useMemo(
    () => ({
      position: 'fixed',
      right: { xs: 16, md: 32 },
      bottom: { xs: 'calc(104px + env(safe-area-inset-bottom))', md: 32 },
      zIndex: 1000,
      '& .MuiFab-primary': {
        width: 64,
        height: 64,
        bgcolor: '#6366F1',
        color: '#000000',
        boxShadow: '0 0 30px rgba(99, 102, 241, 0.4)',
        transition: 'transform 0.2s ease, background-color 0.2s ease, box-shadow 0.2s ease',
        '&:hover': {
          bgcolor: '#00D1DA',
          transform: 'translateY(-2px) scale(1.04)',
          boxShadow: '0 0 50px rgba(99, 102, 241, 0.6)',
        },
      },
      '& .MuiSpeedDialAction-fab': {
        bgcolor: 'rgba(10, 10, 10, 0.98)',
        border: '1px solid rgba(255, 255, 255, 0.1)',
        color: 'rgba(255, 255, 255, 0.8)',
        transition: 'transform 0.18s ease, background-color 0.18s ease, border-color 0.18s ease, color 0.18s ease',
        '&:hover': {
          bgcolor: 'rgba(99, 102, 241, 0.1)',
          color: '#6366F1',
          borderColor: '#6366F1',
          transform: 'translateY(-4px)',
        },
      },
      '& .MuiSpeedDialAction-staticTooltipLabel': {
        bgcolor: 'rgba(10, 10, 10, 0.98)',
        border: '1px solid rgba(255, 255, 255, 0.1)',
        color: '#FFFFFF',
        fontFamily: '"Space Grotesk", sans-serif',
        fontWeight: 700,
        textTransform: 'uppercase',
        letterSpacing: '0.05em',
        fontSize: '0.75rem',
        padding: '6px 12px',
        borderRadius: '8px',
      },
    }),
    []
  );

  const openNoteComposer = (kind: CreateKind) => {
    setOpen(false);
    if (isNoteSpace) {
      openOverlay(<CreateNoteForm noteKind={kind} onNoteCreated={upsertNote} />);
      return;
    }

    openComposerSession(kind);
    router.push('/note/notes');
  };

  const handleAction = (action: string) => {
    if (action === 'note') {
      openNoteComposer('note');
      return;
    }

    if (action === 'project') {
      openNoteComposer('project');
      return;
    }

    if (action === 'tag') {
      setOpen(false);
      router.push('/note/tags');
    }
  };

  return (
    <>
      <Box
        aria-hidden
        sx={{
          position: 'fixed',
          inset: 0,
          zIndex: 999,
          pointerEvents: 'none',
          opacity: open ? 1 : 0,
          transition: 'opacity 220ms ease',
          backdropFilter: open ? 'blur(14px) saturate(170%)' : 'blur(0px)',
          bgcolor: open ? 'rgba(10, 9, 8, 0.22)' : 'transparent',
        }}
      />
      <SpeedDial
        ariaLabel="Quick create"
        sx={baseSx}
        icon={<SpeedDialIcon icon={<Plus size={24} strokeWidth={1.5} />} openIcon={<X size={24} strokeWidth={1.5} />} />}
        onClose={() => setOpen(false)}
        onOpen={() => setOpen(true)}
        open={open}
        direction="up"
      >
        {actions.map((action) => (
          <SpeedDialAction
            key={action.action}
            icon={action.icon}
            tooltipTitle={action.name}
            tooltipOpen
            onClick={() => handleAction(action.action)}
          />
        ))}
      </SpeedDial>
    </>
  );
}
