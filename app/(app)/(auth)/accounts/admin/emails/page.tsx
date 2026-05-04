"use client";

import React, { useState, useEffect } from 'react';
import { 
  Box, 
  Grid, 
  Paper, 
  Typography, 
  alpha, 
  TextField, 
  Button, 
  Avatar,
  FormControl,
  InputLabel,
  Select,
  MenuItem,
  List,
  ListItem,
  ListItemAvatar,
  ListItemText,
  Checkbox,
  CircularProgress
} from '@mui/material';
import { 
  Send, 
  Layout, 
  Users,
  CheckCircle2,
  Eye,
} from 'lucide-react';
import AdminLayout from '../components/AdminLayout';
import { EMAIL_TEMPLATES } from '@/lib/email-template-catalog';
import { KYLRIX_AUTH_URI } from '@/lib/appwrite/config';

interface User {
  id: string;
  name: string;
  email: string;
}

const logoVariations = [
  { id: 'root', name: 'Kylrix (Root)', color: '#6366F1' },
  { id: 'vault', name: 'Vault', color: '#10B981' },
  { id: 'note', name: 'Note', color: '#EC4899' },
  { id: 'flow', name: 'Flow', color: '#A855F7' },
  { id: 'connect', name: 'Connect', color: '#F59E0B' }
];

export default function EmailOrchestrator() {
  const [selectedUsers, setSelectedUsers] = useState<string[]>([]);
  const [template, setTemplate] = useState(EMAIL_TEMPLATES[0].id);
  const [logoVar, setLogoVar] = useState(logoVariations[0].id);
  const [customSubject, setCustomSubject] = useState('');
  const [customBody, setCustomBody] = useState('');
  const [users, setUsers] = useState<User[]>([]);
  const [loadingUsers, setLoadingUsers] = useState(true);
  const [loadingMoreUsers, setLoadingMoreUsers] = useState(false);
  const [hasMoreUsers, setHasMoreUsers] = useState(true);
  const [nextCursor, setNextCursor] = useState<string | null>(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [sending, setSending] = useState(false);
  const [sendResult, setSendResult] = useState<string | null>(null);
  const [userLoadError, setUserLoadError] = useState<string | null>(null);

  const fetchUsers = async (cursorAfter: string | null = null, append = false) => {
    const isInitialLoad = !append;
    if (isInitialLoad) {
      setLoadingUsers(true);
    } else {
      setLoadingMoreUsers(true);
    }

    try {
      setUserLoadError(null);
      const params = new URLSearchParams({
        verified: 'true',
        limit: '50',
      });

      if (cursorAfter) {
        params.set('cursorAfter', cursorAfter);
      }

      const response = await fetch(`/api/admin/users?${params.toString()}`);
      const data = await response.json();
      if (!response.ok) {
        throw new Error(data.error || 'Failed to fetch users');
      }

      const batch = data.users || [];
      setUsers((prev) => {
        if (!append) {
          return batch;
        }

        const seen = new Set(prev.map((user) => user.id));
        const merged = [...prev];

        for (const user of batch) {
          if (!seen.has(user.id)) {
            seen.add(user.id);
            merged.push(user);
          }
        }

        return merged;
      });
      setNextCursor(data.nextCursor || null);
      setHasMoreUsers(Boolean(data.hasMore));
    } catch (error: any) {
      console.error('Failed to fetch users:', error);
      setUserLoadError(error.message || 'Failed to fetch users');
    } finally {
      setLoadingUsers(false);
      setLoadingMoreUsers(false);
    }
  };

  useEffect(() => {
    void fetchUsers();
  }, []);

  const filteredUsers = users.filter(u => 
    u.name.toLowerCase().includes(searchTerm.toLowerCase()) || 
    u.email.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const selectedTemplate = EMAIL_TEMPLATES.find((item) => item.id === template) || EMAIL_TEMPLATES[0];

  const handleLoadMoreUsers = async () => {
    if (!hasMoreUsers || loadingMoreUsers) return;
    await fetchUsers(nextCursor, true);
  };

  const handleToggleUser = (userId: string) => {
    setSelectedUsers(prev => 
      prev.includes(userId) ? prev.filter(id => id !== userId) : [...prev, userId]
    );
  };

  const handleSelectAll = () => {
    if (selectedUsers.length === filteredUsers.length) {
      setSelectedUsers([]);
    } else {
      setSelectedUsers(filteredUsers.map(u => u.id));
    }
  };

  const handleSend = async () => {
    if (selectedUsers.length === 0) return;
    setSending(true);
    setSendResult(null);
    try {
      const response = await fetch('/api/admin/emails/send', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          recipientIds: selectedUsers,
          templateId: template,
          subject: customSubject.trim() || selectedTemplate.subject,
          html: customBody.trim() || undefined,
          ctaUrl: KYLRIX_AUTH_URI,
        }),
      });

      const data = await response.json();
      if (!response.ok) {
        throw new Error(data.error || 'Failed to send emails');
      }

      setSendResult(`Queued ${data.sent} email(s) successfully.`);
      setSelectedUsers([]);
      setCustomBody('');
      setCustomSubject('');
    } catch (error: any) {
      setSendResult(error.message || 'Failed to send emails.');
    } finally {
      setSending(false);
    }
  };

  return (
    <AdminLayout>
      <Box sx={{ mb: 6 }}>
        <Typography variant="h4" sx={{ 
          fontFamily: 'var(--font-clash)', 
          fontWeight: 900, 
          letterSpacing: '-0.02em', 
          mb: 1 
        }}>
          Email Center
        </Typography>
        <Typography sx={{ color: alpha('#FFFFFF', 0.4), fontSize: '0.9rem' }}>
          Design and orchestrate branded ecosystem communications.
        </Typography>
      </Box>

      <Grid container spacing={4}>
        {/* Recipient Selection */}
        <Grid size={{ xs: 12, lg: 4 }}>
          <Paper sx={{ 
            borderRadius: '24px', 
            bgcolor: '#161412', 
            border: '1px solid rgba(255, 255, 255, 0.05)',
            height: '100%',
            display: 'flex',
            flexDirection: 'column',
            overflow: 'hidden'
          }}>
            <Box sx={{ p: 3, borderBottom: '1px solid rgba(255, 255, 255, 0.05)' }}>
              <Typography variant="h6" sx={{ fontWeight: 800, mb: 2, display: 'flex', alignItems: 'center', gap: 1.5 }}>
                <Users size={20} color="#6366F1" />
                Recipients
              </Typography>
              <TextField 
                fullWidth
                size="small"
                placeholder="Search users..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                sx={{ 
                  '& .MuiOutlinedInput-root': { 
                    borderRadius: '12px',
                    bgcolor: 'rgba(255, 255, 255, 0.02)',
                    '& fieldset': { borderColor: 'rgba(255, 255, 255, 0.05)' }
                  } 
                }}
              />
              <Button 
                onClick={handleSelectAll}
                sx={{ mt: 2, textTransform: 'none', fontWeight: 700, fontSize: '0.8rem', color: '#6366F1' }}
              >
                {selectedUsers.length === filteredUsers.length ? 'Deselect All' : `Select All (${filteredUsers.length})`}
              </Button>
            </Box>
            
            <List sx={{ flex: 1, overflow: 'auto', p: 0 }}>
              {loadingUsers ? (
                <Box sx={{ p: 4, textAlign: 'center' }}><CircularProgress size={24} /></Box>
              ) : filteredUsers.length === 0 ? (
                <Box sx={{ p: 4, textAlign: 'center' }}>
                  <Typography sx={{ color: alpha('#FFFFFF', 0.4), fontSize: '0.85rem' }}>
                    No users found.
                  </Typography>
                </Box>
              ) : filteredUsers.map((user) => (
                <ListItem 
                  key={user.id} 
                  sx={{ 
                    borderBottom: '1px solid rgba(255, 255, 255, 0.02)',
                    '&:hover': { bgcolor: alpha('#FFFFFF', 0.01) }
                  }}
                  secondaryAction={
                    <Checkbox 
                      edge="end" 
                      checked={selectedUsers.includes(user.id)}
                      onChange={() => handleToggleUser(user.id)}
                      sx={{ color: alpha('#FFFFFF', 0.2), '&.Mui-checked': { color: '#6366F1' } }}
                    />
                  }
                >
                  <ListItemAvatar>
                    <Avatar sx={{ width: 32, height: 32, fontSize: '0.75rem', bgcolor: alpha('#6366F1', 0.1), color: '#6366F1' }}>
                      {user.name.charAt(0)}
                    </Avatar>
                  </ListItemAvatar>
                  <ListItemText 
                    primary={user.name} 
                    secondary={user.email} 
                    primaryTypographyProps={{ sx: { fontWeight: 700, fontSize: '0.875rem' } }}
                    secondaryTypographyProps={{ sx: { fontSize: '0.75rem', color: alpha('#FFFFFF', 0.4) } }}
                  />
                </ListItem>
              ))}
            </List>
            <Box sx={{ p: 2, borderTop: '1px solid rgba(255, 255, 255, 0.05)' }}>
              {userLoadError ? (
                <Typography sx={{ mb: 1, color: '#FCA5A5', fontSize: '0.8rem', fontWeight: 700 }}>
                  {userLoadError}
                </Typography>
              ) : null}
              <Button
                fullWidth
                variant="outlined"
                onClick={handleLoadMoreUsers}
                disabled={!hasMoreUsers || loadingMoreUsers || loadingUsers}
                sx={{
                  borderRadius: '12px',
                  textTransform: 'none',
                  fontWeight: 800,
                  borderColor: 'rgba(255, 255, 255, 0.08)',
                  color: hasMoreUsers ? '#6366F1' : alpha('#FFFFFF', 0.3),
                  '&:hover': {
                    borderColor: hasMoreUsers ? '#6366F1' : 'rgba(255, 255, 255, 0.08)',
                    bgcolor: hasMoreUsers ? alpha('#6366F1', 0.06) : 'transparent',
                  },
                }}
              >
                {loadingMoreUsers ? (
                  <CircularProgress size={18} sx={{ color: '#6366F1' }} />
                ) : hasMoreUsers ? (
                  `Load more verified users (${users.length})`
                ) : (
                  'All verified users loaded'
                )}
              </Button>
            </Box>
            
            <Box sx={{ p: 2, bgcolor: alpha('#6366F1', 0.05), borderTop: '1px solid rgba(255, 255, 255, 0.05)' }}>
              <Typography sx={{ fontSize: '0.75rem', fontWeight: 800, color: '#6366F1', textAlign: 'center' }}>
                {selectedUsers.length} Users Selected
              </Typography>
            </Box>
          </Paper>
        </Grid>

        {/* Email Designer */}
        <Grid size={{ xs: 12, lg: 8 }}>
          <Paper sx={{ 
            p: 4, 
            borderRadius: '24px', 
            bgcolor: '#161412', 
            border: '1px solid rgba(255, 255, 255, 0.05)'
          }}>
            <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 4 }}>
              <Typography variant="h6" sx={{ fontWeight: 800, display: 'flex', alignItems: 'center', gap: 1.5 }}>
                <Layout size={20} color="#6366F1" />
                Rich Orchestrator
              </Typography>
              <Box sx={{ display: 'flex', gap: 2 }}>
                <Button variant="outlined" startIcon={<Eye size={18} />} sx={{ borderRadius: '12px', textTransform: 'none', borderColor: 'rgba(255, 255, 255, 0.1)', color: 'white' }}>
                  Preview
                </Button>
                <Button 
                  variant="contained" 
                  startIcon={sending ? <CircularProgress size={18} color="inherit" /> : <Send size={18} />}
                  onClick={handleSend}
                  disabled={selectedUsers.length === 0 || sending}
                  sx={{ 
                    borderRadius: '12px', 
                    bgcolor: '#6366F1', 
                    fontWeight: 800, 
                    textTransform: 'none',
                    px: 3,
                    '&:hover': { bgcolor: '#4F46E5' }
                  }}
                >
                  Send Orchestration
                </Button>
              </Box>
            </Box>

            <Grid container spacing={3}>
              <Grid size={{ xs: 12, md: 6 }}>
                <FormControl fullWidth>
                  <InputLabel sx={{ color: alpha('#FFFFFF', 0.4) }}>Select Template</InputLabel>
                  <Select
                    value={template}
                    label="Select Template"
                    onChange={(e) => setTemplate(e.target.value)}
                    sx={{ 
                      borderRadius: '14px', 
                      bgcolor: 'rgba(255, 255, 255, 0.02)',
                      '& .MuiOutlinedInput-notchedOutline': { borderColor: 'rgba(255, 255, 255, 0.05)' }
                    }}
                  >
                    {EMAIL_TEMPLATES.map(t => <MenuItem key={t.id} value={t.id}>{t.name}</MenuItem>)}
                  </Select>
                </FormControl>
              </Grid>
              <Grid size={{ xs: 12, md: 6 }}>
                <FormControl fullWidth>
                  <InputLabel sx={{ color: alpha('#FFFFFF', 0.4) }}>Logo Variation</InputLabel>
                  <Select
                    value={logoVar}
                    label="Logo Variation"
                    onChange={(e) => setLogoVar(e.target.value)}
                    sx={{ 
                      borderRadius: '14px', 
                      bgcolor: 'rgba(255, 255, 255, 0.02)',
                      '& .MuiOutlinedInput-notchedOutline': { borderColor: 'rgba(255, 255, 255, 0.05)' }
                    }}
                  >
                    {logoVariations.map(l => (
                      <MenuItem key={l.id} value={l.id}>
                        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                          <Box sx={{ width: 12, height: 12, borderRadius: '2px', bgcolor: l.color }} />
                          {l.name}
                        </Box>
                      </MenuItem>
                    ))}
                  </Select>
                </FormControl>
              </Grid>

              <Grid size={{ xs: 12 }}>
                <TextField 
                  fullWidth
                  label="Email Subject"
                  placeholder="Enter custom subject or use template default"
                  value={customSubject}
                  onChange={(e) => setCustomSubject(e.target.value)}
                  sx={{ 
                    '& .MuiOutlinedInput-root': { 
                      borderRadius: '14px',
                      bgcolor: 'rgba(255, 255, 255, 0.02)',
                      '& fieldset': { borderColor: 'rgba(255, 255, 255, 0.05)' }
                    } 
                  }}
                />
              </Grid>

              <Grid size={{ xs: 12 }}>
                <TextField 
                  fullWidth
                  multiline
                  rows={10}
                  label="Email Content"
                  placeholder="The template will be used, but you can inject custom HTML or text here..."
                  value={customBody}
                  onChange={(e) => setCustomBody(e.target.value)}
                  sx={{ 
                    '& .MuiOutlinedInput-root': { 
                      borderRadius: '18px',
                      bgcolor: 'rgba(255, 255, 255, 0.02)',
                      '& fieldset': { borderColor: 'rgba(255, 255, 255, 0.05)' },
                      fontFamily: 'var(--font-mono)',
                      fontSize: '0.85rem'
                    } 
                  }}
                />
              </Grid>

              <Grid size={{ xs: 12 }}>
                <Box sx={{ p: 2, borderRadius: '16px', bgcolor: alpha('#10B981', 0.05), border: '1px solid rgba(16, 185, 129, 0.1)', display: 'flex', gap: 2, alignItems: 'center' }}>
                  <CheckCircle2 color="#10B981" size={20} />
                  <Typography sx={{ fontSize: '0.8rem', color: alpha('#FFFFFF', 0.6) }}>
                    This orchestration will be delivered with <strong>E2EE Signing</strong> and Kylrix branded metadata.
                  </Typography>
                </Box>
              </Grid>
              {sendResult && (
                <Grid size={{ xs: 12 }}>
                  <Box sx={{ p: 2, borderRadius: '16px', bgcolor: alpha('#6366F1', 0.08), border: '1px solid rgba(99, 102, 241, 0.18)' }}>
                    <Typography sx={{ fontSize: '0.85rem', color: 'white', fontWeight: 700 }}>{sendResult}</Typography>
                  </Box>
                </Grid>
              )}
            </Grid>
          </Paper>
        </Grid>
      </Grid>
    </AdminLayout>
  );
}
