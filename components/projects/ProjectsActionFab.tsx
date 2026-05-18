'use client';

import React, { useMemo, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import {
  Backdrop,
  Box,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  Button,
  Stack,
  SpeedDial,
  SpeedDialAction,
  SpeedDialIcon,
  Typography,
  alpha,
} from '@mui/material';
import {
  ArrowLeftRight,
  Bot,
  FileDown,
  FileUp,
  FolderKanban,
  Sparkles,
  X,
} from 'lucide-react';
import { useToast } from '@/components/ui/Toast';

type ProjectFabAction = 'insights' | 'convert' | 'export' | 'import';

const actionItems: Array<{
  id: ProjectFabAction;
  label: string;
  icon: React.ReactNode;
}> = [
  { id: 'insights', label: 'AI insights', icon: <Sparkles size={20} strokeWidth={1.8} /> },
  { id: 'convert', label: 'Convert', icon: <ArrowLeftRight size={20} strokeWidth={1.8} /> },
  { id: 'export', label: 'Export', icon: <FileDown size={20} strokeWidth={1.8} /> },
  { id: 'import', label: 'Import', icon: <FileUp size={20} strokeWidth={1.8} /> },
];

export default function ProjectsActionFab() {
  const router = useRouter();
  const { showSuccess, showInfo } = useToast();
  const [open, setOpen] = useState(false);
  const [dialog, setDialog] = useState<ProjectFabAction | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const fabColor = '#6366F1';

  const dialogCopy = useMemo(() => {
    switch (dialog) {
      case 'insights':
        return {
          title: 'AI insights',
          body: 'Generate a project-level readout across notes, tasks, calls, and vault-linked context.',
        };
      case 'convert':
        return {
          title: 'Convert project',
          body: 'Turn the current project into another ecosystem shape without leaving the hub.',
        };
      case 'export':
        return {
          title: 'Export project',
          body: 'Download a portable project bundle for backup or handoff.',
        };
      case 'import':
        return {
          title: 'Import project',
          body: 'Load a project bundle from disk and rebuild the hub context.',
        };
      default:
        return null;
    }
  }, [dialog]);

  const downloadBundle = () => {
    const payload = {
      kind: 'kylrix-project-bundle',
      exportedAt: new Date().toISOString(),
      source: '/projects',
    };

    const blob = new Blob([JSON.stringify(payload, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = 'kylrix-project-bundle.json';
    link.click();
    URL.revokeObjectURL(url);
    showSuccess('Project exported', 'Downloaded a project bundle.');
  };

  const handleAction = (id: ProjectFabAction) => {
    setOpen(false);
    if (id === 'export') {
      downloadBundle();
      return;
    }
    if (id === 'import') {
      inputRef.current?.click();
      return;
    }
    setDialog(id);
  };

  return (
    <>
      <Backdrop
        open={open}
        onClick={() => setOpen(false)}
        sx={{
          zIndex: 1299,
          bgcolor: open ? 'rgba(10, 9, 8, 0.35)' : 'transparent',
          backdropFilter: open ? 'blur(12px) saturate(170%)' : 'none',
        }}
      />

      <input
        ref={inputRef}
        type="file"
        accept="application/json"
        hidden
        onChange={(event) => {
          const file = event.target.files?.[0];
          event.currentTarget.value = '';
          if (!file) return;
          showInfo(`Imported ${file.name}`, 'Project bundle import is ready for the next sync step.');
        }}
      />

      <Box
        sx={{
          position: 'fixed',
          right: { xs: 16, md: 28 },
          bottom: { xs: 'calc(28px + env(safe-area-inset-bottom))', md: 32 },
          zIndex: 1310,
        }}
      >
        <SpeedDial
          ariaLabel="Project actions"
          open={open}
          onOpen={() => setOpen(true)}
          onClose={() => setOpen(false)}
          direction="up"
          icon={<SpeedDialIcon icon={<FolderKanban size={24} strokeWidth={1.8} />} openIcon={<X size={24} strokeWidth={1.8} />} />}
          sx={{
            '& .MuiFab-primary': {
              width: 64,
              height: 64,
              borderRadius: '20px',
              bgcolor: fabColor,
              color: '#000',
              boxShadow: `0 18px 40px ${alpha(fabColor, 0.4)}`,
              '&:hover': {
                bgcolor: '#5356E8',
                transform: 'translateY(-2px)',
              },
            },
            '& .MuiSpeedDialAction-fab': {
              bgcolor: 'rgba(10, 9, 8, 0.96)',
              border: '1px solid rgba(255,255,255,0.08)',
              color: 'rgba(255,255,255,0.86)',
              '&:hover': {
                bgcolor: 'rgba(99, 102, 241, 0.12)',
                borderColor: fabColor,
                color: fabColor,
              },
            },
            '& .MuiSpeedDialAction-staticTooltipLabel': {
              bgcolor: 'rgba(10, 9, 8, 0.96)',
              border: '1px solid rgba(255,255,255,0.08)',
              color: '#fff',
              fontWeight: 800,
              letterSpacing: '0.06em',
              textTransform: 'uppercase',
            },
          }}
        >
          {actionItems.map((item) => (
            <SpeedDialAction
              key={item.id}
              icon={item.icon}
              tooltipTitle={item.label}
              tooltipOpen
              onClick={() => handleAction(item.id)}
            />
          ))}
        </SpeedDial>
      </Box>

      <Dialog
        open={Boolean(dialogCopy)}
        onClose={() => setDialog(null)}
        maxWidth="sm"
        fullWidth
        PaperProps={{
          sx: {
            bgcolor: '#161412',
            border: '1px solid rgba(255,255,255,0.08)',
            backgroundImage: 'none',
            borderRadius: '28px',
          },
        }}
      >
        <DialogTitle sx={{ fontWeight: 900, color: '#fff' }}>{dialogCopy?.title}</DialogTitle>
        <DialogContent>
          <Stack spacing={2}>
            <Typography sx={{ color: 'rgba(255,255,255,0.7)', lineHeight: 1.7 }}>
              {dialogCopy?.body}
            </Typography>
            <Box sx={{ p: 2, borderRadius: '20px', bgcolor: '#0A0908', border: '1px solid rgba(255,255,255,0.06)' }}>
              <Typography sx={{ color: '#fff', fontWeight: 800, mb: 1 }}>Next step</Typography>
              <Typography sx={{ color: 'rgba(255,255,255,0.62)' }}>
                {dialog === 'insights' && 'Analyze linked notes and surface the gaps, risks, and next actions.'}
                {dialog === 'convert' && 'Convert this workspace into a note, task, or handoff artifact.'}
                {dialog === 'export' && 'Export a portable bundle that other ecosystem tools can ingest.'}
                {dialog === 'import' && 'Import a bundle and reconcile it into the current workspace.'}
              </Typography>
            </Box>
          </Stack>
        </DialogContent>
        <DialogActions sx={{ p: 3 }}>
          <Button onClick={() => setDialog(null)} sx={{ color: 'rgba(255,255,255,0.8)', textTransform: 'none' }}>
            Close
          </Button>
          <Button
            variant="contained"
            onClick={() => {
              if (dialog === 'insights') {
                router.push('/note/notes');
              } else if (dialog === 'convert') {
                router.push('/note/notes');
              } else if (dialog === 'export') {
                downloadBundle();
              } else if (dialog === 'import') {
                inputRef.current?.click();
              }
              setDialog(null);
            }}
            startIcon={<Bot size={16} />}
            sx={{ bgcolor: fabColor, color: '#000', textTransform: 'none', fontWeight: 800 }}
          >
            Continue
          </Button>
        </DialogActions>
      </Dialog>
    </>
  );
}
