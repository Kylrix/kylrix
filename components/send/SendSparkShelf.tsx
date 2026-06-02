'use client';

import React, { useEffect, useMemo, useState } from 'react';
import {
  alpha,
  Box,
  Card,
  CardContent,
  IconButton,
  Menu,
  MenuItem,
  Stack,
  Typography,
  ListItemIcon,
  ListItemText,
} from '@/lib/mui-tailwind/material';
import { Clock, Copy, ExternalLink, Import, MoreVertical, Trash2, FileText, KeyRound, ListTodo, Shield, Upload, MessageSquare, Sparkles } from 'lucide-react';

import type { SendSparkRef, SendKind } from '@/lib/send/types';
import toast from 'react-hot-toast';
import { burnEphemeralNoteWithProof } from '@/lib/ephemeral/burn-note';

const BG_PAGE = '#0A0908';
const SURFACE_HOVER = '#1C1A18';
const RIM = '1px solid #34322F';
const PRIMARY = '#6366F1';

const KIND_COLORS: Record<SendKind, string> = {
  note: '#EC4899',       // Pink (Note App)
  password: '#10B981',   // Green (Vault App)
  totp: '#10B981',       // Green (Vault App)
  task: '#A855F7',       // Purple (Flow App)
  file: '#6366F1',       // Indigo (Accounts/Send)
  discussion: '#F59E0B'  // Amber/Orange (Connect App)
};

function SendSparkClock({ createdAt, expiresAt, color = PRIMARY }: { createdAt: string; expiresAt: string; color?: string }) {
  const [pct, setPct] = React.useState(100);

  React.useEffect(() => {
    const tick = () => {
      const created = new Date(createdAt).getTime();
      const expires = new Date(expiresAt).getTime();
      const now = Date.now();
      const total = expires - created;
      const remaining = Math.max(0, expires - now);
      setPct(total > 0 ? (remaining / total) * 100 : 0);
    };
    tick();
    const id = window.setInterval(tick, 15000);
    return () => window.clearInterval(id);
  }, [createdAt, expiresAt]);

  const size = 18;
  const stroke = 2;
  const c = size / 2;
  const r = c - stroke;
  const circum = 2 * Math.PI * r;
  const offset = circum - (pct / 100) * circum;

  return (
    <Box sx={{ display: 'inline-flex', ml: 0.75 }}>
      <svg width={size} height={size}>
        <circle stroke="rgba(255,255,255,0.08)" strokeWidth={stroke} fill="transparent" r={r} cx={c} cy={c} />
        <circle
          stroke={color}
          strokeWidth={stroke}
          strokeDasharray={`${circum} ${circum}`}
          style={{ strokeDashoffset: offset, transition: 'stroke-dashoffset 0.5s ease' }}
          strokeLinecap="round"
          fill="transparent"
          r={r}
          cx={c}
          cy={c}
          transform={`rotate(-90 ${c} ${c})`}
        />
      </svg>
    </Box>
  );
}

interface Props {
  sparks: SendSparkRef[];
  onSaveSparks: (next: SendSparkRef[]) => void;
  onClaim?: (spark: SendSparkRef) => void;
}

export function SendSparkShelf({ sparks, onSaveSparks, onClaim }: Props) {
  const [menu, setMenu] = useState<{ mouseX: number; mouseY: number; id: string } | null>(null);
  const [nowTs, setNowTs] = useState(0);

  useEffect(() => {
    const tick = () => setNowTs(Date.now());
    tick();
    const id = window.setInterval(tick, 30_000);
    return () => window.clearInterval(id);
  }, []);

  const active = useMemo(() => {
    if (!nowTs) return sparks;
    return sparks.filter((s) => new Date(s.expiresAt).getTime() > nowTs);
  }, [sparks, nowTs]);
  const stale = useMemo(() => {
    if (!nowTs) return [];
    return sparks.filter((s) => new Date(s.expiresAt).getTime() <= nowTs);
  }, [sparks, nowTs]);

  const ctxNote = useMemo(() => {
    if (!menu) return undefined;
    return sparks.find((s) => s.id === menu.id);
  }, [menu, sparks]);

  const openMenu = (e: React.MouseEvent, id: string) => {
    e.preventDefault();
    setMenu({ mouseX: e.clientX + 2, mouseY: e.clientY - 6, id });
  };

  const closeMenu = () => setMenu(null);

  const handleRemoveOrBurn = async () => {
    const id = menu?.id;
    if (!id) return;
    const spark = sparks.find((s) => s.id === id);
    closeMenu();

    if (spark?.deletionSecret) {
      try {
        await burnEphemeralNoteWithProof(id, spark.deletionSecret);
      } catch {
        toast.error('Could not delete this link on the server.');
        return;
      }
      toast.success('Link deleted — it no longer works.');
    }

    onSaveSparks(sparks.filter((s) => s.id !== id));
  };

  const copyUrl = async (url: string) => {
    try {
      await navigator.clipboard.writeText(url);
      toast.success('Link copied');
    } catch {
      /* ignore */
    }
  };

  if (sparks.length === 0) return null;

  const renderCard = (spark: SendSparkRef, staleRow: boolean) => {
    const sparkColor = KIND_COLORS[spark.kind] || PRIMARY;
    const Icon = (() => {
      switch (spark.kind) {
        case 'note': return FileText;
        case 'password': return KeyRound;
        case 'task': return ListTodo;
        case 'totp': return Shield;
        case 'file': return Upload;
        case 'discussion': return MessageSquare;
        default: return Sparkles;
      }
    })();

    return (
      <Card
        key={spark.id}
        onContextMenu={(e) => openMenu(e, spark.id)}
        sx={{
          bgcolor: staleRow ? '#0A0908' : '#161412',
          borderRadius: '24px',
          border: '1px solid #34322F',
          boxShadow: '0 4px 4px -4px rgba(0,0,0,0.9), 0 2px 3px -3px rgba(37,35,33,0.9)',
          opacity: staleRow ? 0.72 : 1,
          transition: 'all 0.4s cubic-bezier(0.16, 1, 0.3, 1)',
          '&:hover': {
            borderColor: staleRow ? '#34322F' : sparkColor,
            bgcolor: staleRow ? '#0A0908' : '#1C1A18',
            opacity: 1,
            boxShadow: '0 8px 10px -8px rgba(0,0,0,1), 0 6px 8px -6px rgba(37,35,33,1.0)',
            transform: 'translateY(-2px)',
          },
        }}
      >
        <CardContent sx={{ p: 2, '&:last-child': { pb: 2 } }}>
          <Stack direction="row" justifyContent="space-between" alignItems="flex-start" spacing={1}>
            <Stack direction="row" spacing={1.5} sx={{ minWidth: 0, flex: 1 }}>
              <Box sx={{ color: sparkColor, mt: 0.5 }}>
                <Icon size={20} />
              </Box>
              <Box sx={{ minWidth: 0, flex: 1 }}>
                <Typography
                  sx={{
                    fontWeight: 800,
                    fontSize: '0.9rem',
                    letterSpacing: '-0.02em',
                    fontFamily: 'var(--font-satoshi)',
                  }}
                  noWrap
                >
                  {spark.title}
                </Typography>
                <Typography variant="caption" sx={{ display: 'block', opacity: 0.45, mt: 0.35 }}>
                  {spark.kind.toUpperCase()} · {new Date(spark.createdAt).toLocaleDateString()}
                </Typography>
                {staleRow && (
                  <Typography variant="caption" sx={{ display: 'block', color: alpha('#fff', 0.55), mt: 0.75, fontWeight: 700 }}>
                    Expired — delete still works if the item is still on the server.
                  </Typography>
                )}
              </Box>
            </Stack>
            <Stack direction="row" spacing={0.25} alignItems="center">
              <SendSparkClock createdAt={spark.createdAt} expiresAt={spark.expiresAt} color={sparkColor} />
              <IconButton size="small" onClick={(e) => openMenu(e, spark.id)} sx={{ color: alpha('#fff', 0.35) }}>
                <MoreVertical size={14} />
              </IconButton>
            </Stack>
          </Stack>
          <Stack direction="row" spacing={0.5} sx={{ mt: 1.25 }} justifyContent="flex-end">
            <IconButton size="small" aria-label="Copy link" onClick={() => void copyUrl(spark.url)} sx={{ color: sparkColor }}>
              <Copy size={16} />
            </IconButton>
            <IconButton size="small" aria-label="Open" onClick={() => window.open(spark.url, '_blank')} sx={{ color: sparkColor }}>
              <ExternalLink size={16} />
            </IconButton>
          </Stack>
        </CardContent>
      </Card>
    );
  };

  return (
    <Stack spacing={2}>
      <Stack direction="row" spacing={1} alignItems="center">
        <Clock size={16} color="#6366F1" />
        <Typography
          sx={{
            fontFamily: 'var(--font-clash)',
            fontWeight: 700,
            fontSize: '1rem',
            letterSpacing: '-0.02em',
          }}
        >
          Stash
        </Typography>
      </Stack>

      {active.length > 0 && (
        <Stack spacing={1.25}>{active.map((s) => renderCard(s, false))}</Stack>
      )}
      {stale.length > 0 && (
        <Box>
          <Typography variant="caption" sx={{ fontWeight: 800, opacity: 0.5, letterSpacing: '0.08em', display: 'block', mb: 1 }}>
            EXPIRED
          </Typography>
          <Stack spacing={1.25}>{stale.map((s) => renderCard(s, true))}</Stack>
        </Box>
      )}

      <Menu
        open={menu !== null}
        onClose={closeMenu}
        anchorReference="anchorPosition"
        anchorPosition={menu !== null ? { top: menu.mouseY, left: menu.mouseX } : undefined}
        slotProps={{
          paper: {
            sx: {
              minWidth: 200,
              bgcolor: '#161412',
              border: '1px solid #34322F',
              borderRadius: '12px',
              py: 0.5,
              boxShadow: '0 16px 32px rgba(0,0,0,0.8)',
            },
          },
        }}
      >
        {onClaim && ctxNote ? (
          <MenuItem
            onClick={() => {
              closeMenu();
              onClaim(ctxNote);
            }}
            sx={{
              gap: 1.25,
              color: PRIMARY,
              '&:hover': { bgcolor: '#1C1A18' },
            }}
          >
            <ListItemIcon sx={{ minWidth: 'auto', color: 'inherit' }}>
              <Import size={16} />
            </ListItemIcon>
            <ListItemText
              primary="Claim to account"
              slotProps={{ primary: { sx: { fontSize: '0.82rem', fontWeight: 700, fontFamily: 'var(--font-satoshi)' } } }}
            />
          </MenuItem>
        ) : null}
        <MenuItem
          onClick={() => void handleRemoveOrBurn()}
          sx={{
            gap: 1.25,
            color: '#FF453A',
            '&:hover': { bgcolor: '#1C1A18' },
          }}
        >
          <ListItemIcon sx={{ minWidth: 'auto', color: 'inherit' }}>
            <Trash2 size={16} />
          </ListItemIcon>
          <ListItemText
            primary={ctxNote?.deletionSecret ? 'Delete link' : 'Remove from this device'}
            slotProps={{ primary: { sx: { fontSize: '0.82rem', fontWeight: 700, fontFamily: 'var(--font-satoshi)' } } }}
          />
        </MenuItem>
      </Menu>
    </Stack>
  );
}
