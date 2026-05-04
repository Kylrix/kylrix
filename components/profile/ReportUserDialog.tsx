'use client';

import { useMemo, useState } from 'react';
import {
  Alert,
  Box,
  Button,
  Drawer,
  MenuItem,
  Stack,
  TextField,
  Typography,
  alpha,
  useTheme,
  useMediaQuery,
} from '@mui/material';
import { Flag, ShieldAlert } from 'lucide-react';
import { getEcosystemUrl } from '@/lib/constants';

interface ReportUserDialogProps {
  open: boolean;
  onClose: () => void;
  targetUserId: string;
  targetUsername: string;
  contextType?: string;
  contextId?: string | null;
  contextUrl?: string | null;
  sourceApp?: string;
}

export default function ReportUserDialog({
  open,
  onClose,
  targetUserId,
  targetUsername,
  contextType = 'profile',
  contextId = null,
  contextUrl = null,
  sourceApp = 'connect',
}: ReportUserDialogProps) {
  const theme = useTheme();
  const isMobile = useMediaQuery(theme.breakpoints.down('md'));
  const [reason, setReason] = useState('');
  const [notes, setNotes] = useState('');
  const [selectedContextType, setSelectedContextType] = useState(contextType);
  const [submitting, setSubmitting] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  const helperText = useMemo(() => {
    return 'Reports start as unverified and stay that way until moderation reviews them. They do not change reputation on submission.';
  }, []);

  const handleSubmit = async () => {
    if (!targetUserId) return;
    if (!reason.trim()) {
      setMessage('Please provide a reason.');
      return;
    }

    setSubmitting(true);
    setMessage(null);

    try {
      const res = await fetch(`${getEcosystemUrl('accounts')}/api/reports`, {
        method: 'POST',
        credentials: 'include',
        headers: {
          'Content-Type': 'application/json',
          Accept: 'application/json',
        },
        body: JSON.stringify({
          targetUserIds: [targetUserId],
          reason: reason.trim(),
          notes: notes.trim() || undefined,
          contextType: selectedContextType,
          contextId: contextId || undefined,
          contextUrl: contextUrl || undefined,
          sourceApp,
          metadata: {
            targetUsername,
            sourceApp,
          },
        }),
      });

      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        throw new Error(data?.error || 'Failed to submit report');
      }

      setMessage('Report submitted as unverified.');
      setReason('');
      setNotes('');
    } catch (error: any) {
      setMessage(error?.message || 'Failed to submit report');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Drawer anchor={isMobile ? 'bottom' : 'right'} open={open} onClose={onClose} 
      PaperProps={{
        sx: {
          width: isMobile ? '100%' : 'min(100vw, 500px)',
          maxWidth: '100%',
          height: isMobile ? 'auto' : '100%',
          maxHeight: isMobile ? '92dvh' : '100%',
          borderRadius: isMobile ? '24px 24px 0 0' : '0',
          display: 'flex',
          flexDirection: 'column',
        }
      }}
    >
      <Box sx={{ fontWeight: 900, display: 'flex', alignItems: 'center', gap: 1, px: 3, pt: 3, pb: 2, borderBottom: '1px solid rgba(255, 255, 255, 0.05)', flexShrink: 0 }}>
        <Flag size={18} />
        Report @{targetUsername}
      </Box>
      <Box sx={{ px: 3, py: 2, flex: 1, overflowY: 'auto' }}>
        <Stack spacing={2.25} sx={{ pt: 1 }}>
          {message && <Alert severity="info">{message}</Alert>}

          <Typography variant="body2" sx={{ color: 'text.secondary' }}>
            {helperText}
          </Typography>

          <TextField
            select
            label="Report context"
            value={selectedContextType}
            onChange={(e) => setSelectedContextType(e.target.value)}
            fullWidth
          >
            <MenuItem value="profile">Profile</MenuItem>
            <MenuItem value="message">DM / Chat</MenuItem>
            <MenuItem value="post">Post</MenuItem>
            <MenuItem value="comment">Comment</MenuItem>
            <MenuItem value="other">Other</MenuItem>
          </TextField>

          <TextField
            label="Reason"
            value={reason}
            onChange={(e) => setReason(e.target.value)}
            fullWidth
            multiline
            minRows={3}
            placeholder="Why are you reporting this user?"
          />

          <TextField
            label="Extra notes"
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            fullWidth
            multiline
            minRows={3}
            placeholder="Optional supporting detail"
          />

          <Box
            sx={{
              p: 2,
              borderRadius: '16px',
              bgcolor: alpha('#6366F1', 0.06),
              border: '1px solid rgba(99,102,241,0.12)',
              display: 'flex',
              gap: 1.5,
              alignItems: 'flex-start',
            }}
          >
            <ShieldAlert size={18} color="#6366F1" />
            <Typography variant="body2" sx={{ color: 'text.secondary' }}>
              The report is stored as a pending account event and will not affect reputation until moderation changes its state.
            </Typography>
          </Box>
        </Stack>
      </Box>
      <Box sx={{ p: 3, display: 'flex', gap: 1, borderTop: '1px solid rgba(255, 255, 255, 0.05)', flexShrink: 0 }}>
        <Button onClick={onClose} disabled={submitting}>
          Cancel
        </Button>
        <Button
          variant="contained"
          onClick={handleSubmit}
          disabled={submitting || !reason.trim()}
          sx={{ fontWeight: 800 }}
        >
          {submitting ? 'Submitting...' : 'Submit Report'}
        </Button>
      </Box>
    </Drawer>
  );
}
