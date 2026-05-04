'use client';
import React, { useState } from 'react';
import { useAdminGate } from '@/hooks/useAdminGate';
import {
  Box,
  Typography,
  TextField,
  Button,
  Checkbox,
  FormControlLabel,
  Grid,
  Paper,
  Stack,
  Alert,
  CircularProgress,
  alpha,
  Container,
  Breadcrumbs,
  Link as MuiLink
} from '@mui/material';
import {
  Send as SendIcon,
  Preview as PreviewIcon,
  ArrowBack as BackIcon
} from '@mui/icons-material';
import Link from 'next/link';

interface SendState { status: 'idle'|'sending'|'success'|'error'; message?: string; }

export default function AdminMessages() {
  const [subject, setSubject] = useState('');
  const [body, setBody] = useState('');
  const [userIds, setUserIds] = useState('');
  const [emails, setEmails] = useState('');
  const [bcc, setBcc] = useState('');
  const [allUsers, setAllUsers] = useState(false);
  const [topic, setTopic] = useState('');
  const [state, setState] = useState<SendState>({ status: 'idle' });
  const [dryRun, setDryRun] = useState(true);
  const [preview, setPreview] = useState<any>(null);

  const { jwt } = useAdminGate();

  const getJwt = async () => jwt;

  const send = async () => {
    if (dryRun) return;
    if (!subject.trim() || !body.trim()) { setState({ status: 'error', message: 'Subject & body required'}); return; }
    if (subject.length > 200) { setState({ status: 'error', message: 'Subject too long'}); return; }
    setState({ status: 'sending' });
    try {
      const token = await getJwt();
      const res = await fetch('/api/admin/messages', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({
          subject,
          bodyHtml: body,
          userIds: userIds.split(',').map(s=>s.trim()).filter(Boolean),
          emails: emails.split(',').map(s=>s.trim()).filter(Boolean),
          bcc: bcc.split(',').map(s=>s.trim()).filter(Boolean),
          allUsers,
          topic: topic || undefined,
          dryRun: false
        })
      });
      const j = await res.json().catch(()=>({}));
      if (!res.ok) throw new Error(j.error || 'Send failed');
      setState({ status: 'success', message: `Sent to ${j.recipients || 'n/a'} recipients` });
      setSubject(''); setBody('');
    } catch (e: any) {
      setState({ status: 'error', message: e.message || 'Error' });
    }
  };

  const generatePreview = async () => {
    setState({ status: 'sending' });
    setPreview(null);
    try {
      const token = await getJwt();
      const res = await fetch('/api/admin/messages', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({
          subject,
          bodyHtml: body,
          userIds: userIds.split(',').map(s=>s.trim()).filter(Boolean),
          emails: emails.split(',').map(s=>s.trim()).filter(Boolean),
          bcc: bcc.split(',').map(s=>s.trim()).filter(Boolean),
          allUsers,
          topic: topic || undefined,
          dryRun: true
        })
      });
      const j = await res.json().catch(()=>({}));
      if (!res.ok) throw new Error(j.error || 'Preview failed');
      setPreview(j);
      setState({ status: 'idle', message: `Preview: ${j.recipients} recipients` });
    } catch (e: any) {
      setState({ status: 'error', message: e.message || 'Error' });
    }
  };

  return (
    <Container maxWidth="md" sx={{ py: 8 }}>
      <Box sx={{ mb: 6, display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <Box>
          <Breadcrumbs sx={{ color: 'rgba(255, 255, 255, 0.5)', mb: 1 }}>
            <MuiLink component={Link} href="/admin/dashboard" underline="hover" color="inherit">
              Admin
            </MuiLink>
            <Typography color="white">Messages</Typography>
          </Breadcrumbs>
          <Typography 
            variant="h4" 
            sx={{ 
              fontWeight: 900, 
              fontFamily: 'var(--font-space-grotesk)',
              background: 'linear-gradient(90deg, #fff, #6366F1)',
              WebkitBackgroundClip: 'text',
              WebkitTextFillColor: 'transparent'
            }}
          >
            Send Message
          </Typography>
        </Box>
        <Button
          component={Link}
          href="/admin/dashboard"
          startIcon={<BackIcon />}
          sx={{ 
            color: 'rgba(255, 255, 255, 0.7)',
            '&:hover': { color: '#6366F1', bgcolor: 'rgba(99, 102, 241, 0.05)' }
          }}
        >
          Back to Dashboard
        </Button>
      </Box>

      <Paper 
        sx={{ 
          p: 4, 
          bgcolor: 'rgba(255, 255, 255, 0.03)', 
          backdropFilter: 'blur(25px)',
          border: '1px solid rgba(255, 255, 255, 0.1)',
          borderRadius: '24px'
        }}
      >
        <Stack spacing={4}>
          <TextField
            fullWidth
            label="Subject"
            variant="outlined"
            value={subject}
            onChange={ (e) => setSubject(e.target.value)}
            placeholder="Enter message subject"
            sx={{
              '& .MuiOutlinedInput-root': {
                color: 'white',
                '& fieldset': { borderColor: 'rgba(255, 255, 255, 0.1)' },
                '&:hover fieldset': { borderColor: 'rgba(255, 255, 255, 0.2)' },
                '&.Mui-focused fieldset': { borderColor: '#6366F1' },
              },
              '& .MuiInputLabel-root': { color: 'rgba(255, 255, 255, 0.5)' },
              '& .MuiInputLabel-root.Mui-focused': { color: '#6366F1' },
            }}
          />

          <TextField
            fullWidth
            label="HTML Body"
            variant="outlined"
            multiline
            rows={8}
            value={body}
            onChange={ (e) => setBody(e.target.value)}
            placeholder="<p>Announcement...</p>"
            sx={{
              '& .MuiOutlinedInput-root': {
                color: 'white',
                fontFamily: 'monospace',
                fontSize: '0.9rem',
                '& fieldset': { borderColor: 'rgba(255, 255, 255, 0.1)' },
                '&:hover fieldset': { borderColor: 'rgba(255, 255, 255, 0.2)' },
                '&.Mui-focused fieldset': { borderColor: '#6366F1' },
              },
              '& .MuiInputLabel-root': { color: 'rgba(255, 255, 255, 0.5)' },
              '& .MuiInputLabel-root.Mui-focused': { color: '#6366F1' },
            }}
          />

          <Grid container spacing={3}>
            <Grid size={{ xs: 12, md: 6 }}>
              <TextField
                fullWidth
                label="User IDs (comma separated)"
                variant="outlined"
                value={userIds}
                onChange={ (e) => setUserIds(e.target.value)}
                placeholder="user1, user2"
                sx={{
                  '& .MuiOutlinedInput-root': {
                    color: 'white',
                    '& fieldset': { borderColor: 'rgba(255, 255, 255, 0.1)' },
                    '&:hover fieldset': { borderColor: 'rgba(255, 255, 255, 0.2)' },
                    '&.Mui-focused fieldset': { borderColor: '#6366F1' },
                  },
                  '& .MuiInputLabel-root': { color: 'rgba(255, 255, 255, 0.5)' },
                  '& .MuiInputLabel-root.Mui-focused': { color: '#6366F1' },
                }}
              />
            </Grid>
            <Grid size={{ xs: 12, md: 6 }}>
              <TextField
                fullWidth
                label="Emails (comma separated)"
                variant="outlined"
                value={emails}
                onChange={ (e) => setEmails(e.target.value)}
                placeholder="a@b.dev, c@d.dev"
                sx={{
                  '& .MuiOutlinedInput-root': {
                    color: 'white',
                    '& fieldset': { borderColor: 'rgba(255, 255, 255, 0.1)' },
                    '&:hover fieldset': { borderColor: 'rgba(255, 255, 255, 0.2)' },
                    '&.Mui-focused fieldset': { borderColor: '#6366F1' },
                  },
                  '& .MuiInputLabel-root': { color: 'rgba(255, 255, 255, 0.5)' },
                  '& .MuiInputLabel-root.Mui-focused': { color: '#6366F1' },
                }}
              />
            </Grid>
          </Grid>

          <Grid container spacing={3}>
            <Grid size={{ xs: 12, md: 6 }}>
              <TextField
                fullWidth
                label="BCC (comma separated)"
                variant="outlined"
                value={bcc}
                onChange={ (e) => setBcc(e.target.value)}
                placeholder="team@domain.dev"
                sx={{
                  '& .MuiOutlinedInput-root': {
                    color: 'white',
                    '& fieldset': { borderColor: 'rgba(255, 255, 255, 0.1)' },
                    '&:hover fieldset': { borderColor: 'rgba(255, 255, 255, 0.2)' },
                    '&.Mui-focused fieldset': { borderColor: '#6366F1' },
                  },
                  '& .MuiInputLabel-root': { color: 'rgba(255, 255, 255, 0.5)' },
                  '& .MuiInputLabel-root.Mui-focused': { color: '#6366F1' },
                }}
              />
            </Grid>
            <Grid size={{ xs: 12, md: 6 }}>
              <TextField
                fullWidth
                label="Topic (optional)"
                variant="outlined"
                value={topic}
                onChange={ (e) => setTopic(e.target.value)}
                placeholder="release-2025q1"
                sx={{
                  '& .MuiOutlinedInput-root': {
                    color: 'white',
                    '& fieldset': { borderColor: 'rgba(255, 255, 255, 0.1)' },
                    '&:hover fieldset': { borderColor: 'rgba(255, 255, 255, 0.2)' },
                    '&.Mui-focused fieldset': { borderColor: '#6366F1' },
                  },
                  '& .MuiInputLabel-root': { color: 'rgba(255, 255, 255, 0.5)' },
                  '& .MuiInputLabel-root.Mui-focused': { color: '#6366F1' },
                }}
              />
            </Grid>
          </Grid>

          <Stack spacing={1}>
            <FormControlLabel
              control={
                <Checkbox 
                  checked={allUsers} 
                  onChange={ (e) => setAllUsers(e.target.checked)}
                  sx={{ color: 'rgba(255, 255, 255, 0.3)', '&.Mui-checked': { color: '#6366F1' } }}
                />
              }
              label={<Typography variant="body2" sx={{ color: 'rgba(255, 255, 255, 0.7)' }}>Broadcast to all users (overrides User IDs/Emails)</Typography>}
            />
            <FormControlLabel
              control={
                <Checkbox 
                  checked={dryRun} 
                  onChange={ (e) => setDryRun(e.target.checked)}
                  sx={{ color: 'rgba(255, 255, 255, 0.3)', '&.Mui-checked': { color: '#6366F1' } }}
                />
              }
              label={<Typography variant="body2" sx={{ color: 'rgba(255, 255, 255, 0.7)' }}>Dry Run (preview only)</Typography>}
            />
          </Stack>

          <Stack direction="row" spacing={2}>
            <Button
              variant="contained"
              startIcon={state.status === 'sending' ? <CircularProgress size={20} color="inherit" /> : <PreviewIcon />}
              onClick={generatePreview}
              disabled={state.status === 'sending'}
              sx={{
                bgcolor: 'rgba(255, 255, 255, 0.1)',
                color: 'white',
                borderRadius: '12px',
                px: 4,
                py: 1.5,
                textTransform: 'none',
                fontWeight: 700,
                '&:hover': { bgcolor: 'rgba(255, 255, 255, 0.2)' },
                '&:disabled': { bgcolor: 'rgba(255, 255, 255, 0.05)', color: 'rgba(255, 255, 255, 0.3)' }
              }}
            >
              {state.status === 'sending' ? 'Working...' : 'Generate Preview'}
            </Button>
            <Button
              variant="contained"
              startIcon={state.status === 'sending' ? <CircularProgress size={20} color="inherit" /> : <SendIcon />}
              onClick={send}
              disabled={state.status === 'sending' || dryRun}
              sx={{
                bgcolor: '#6366F1',
                color: '#000',
                borderRadius: '12px',
                px: 4,
                py: 1.5,
                textTransform: 'none',
                fontWeight: 700,
                '&:hover': { bgcolor: alpha('#6366F1', 0.8) },
                '&:disabled': { bgcolor: 'rgba(99, 102, 241, 0.1)', color: 'rgba(0, 0, 0, 0.3)' }
              }}
            >
              {state.status === 'sending' ? 'Sending...' : 'Send Message'}
            </Button>
          </Stack>

          {dryRun && (
            <Typography variant="caption" sx={{ color: 'rgba(255, 255, 255, 0.4)', fontStyle: 'italic' }}>
              Disable Dry Run to enable final send after preview.
            </Typography>
          )}

          {preview && (
            <Box 
              sx={{ 
                p: 3, 
                bgcolor: 'rgba(0, 0, 0, 0.2)', 
                borderRadius: '16px', 
                border: '1px solid rgba(255, 255, 255, 0.05)' 
              }}
            >
              <Typography variant="subtitle2" sx={{ color: '#6366F1', mb: 2, fontWeight: 800 }}>Preview Results</Typography>
              <Stack spacing={1}>
                <Typography variant="body2" sx={{ color: 'white' }}>
                  <strong>Recipients:</strong> {preview.recipients}
                </Typography>
                <Typography variant="body2" sx={{ color: 'white' }}>
                  <strong>Subject:</strong> {preview.preview?.subject}
                </Typography>
                <Typography variant="body2" sx={{ color: 'rgba(255, 255, 255, 0.7)', fontStyle: 'italic' }}>
                  <strong>Snippet:</strong> {preview.preview?.snippet}
                </Typography>
              </Stack>
            </Box>
          )}

          {state.status === 'error' && (
            <Alert severity="error" sx={{ borderRadius: '12px', bgcolor: alpha('#ff4d4d', 0.1), color: '#ff4d4d', border: '1px solid rgba(255, 77, 77, 0.2)' }}>
              {state.message}
            </Alert>
          )}
          {state.status === 'success' && (
            <Alert severity="success" sx={{ borderRadius: '12px', bgcolor: alpha('#6366F1', 0.1), color: '#6366F1', border: '1px solid rgba(99, 102, 241, 0.2)' }}>
              {state.message}
            </Alert>
          )}
        </Stack>
      </Paper>
    </Container>
  );
}
