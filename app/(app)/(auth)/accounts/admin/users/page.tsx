"use client";

import React, { useState, useEffect, useCallback } from 'react';
import { 
  Box, 
  Paper, 
  Typography, 
  alpha, 
  TextField, 
  Button, 
  Avatar,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  IconButton,
  Tooltip,
  InputAdornment,
  Chip,
  CircularProgress
} from '@mui/material';
import { 
  Search, 
  Mail, 
  MoreVertical, 
  UserPlus, 
  Shield, 
  Activity,
  Trash2,
  RefreshCw,
  CheckCircle2
} from 'lucide-react';
import AdminLayout from '../components/AdminLayout';

interface User {
  id: string;
  name: string;
  email: string;
  status: string;
  role: string;
  joinDate: string;
  emailVerification: boolean;
  labels: string[];
}

export default function UsersManagement() {
  const [searchTerm, setSearchTerm] = useState('');
  const [users, setUsers] = useState<User[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchUsers = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const response = await fetch(`/api/admin/users${searchTerm ? `?search=${encodeURIComponent(searchTerm)}` : ''}`);
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || 'Failed to fetch users');
      setUsers(data.users);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }, [searchTerm]);

  useEffect(() => {
    const timer = setTimeout(() => {
      fetchUsers();
    }, 500);
    return () => clearTimeout(timer);
  }, [fetchUsers]);

  return (
    <AdminLayout>
      <Box sx={{ mb: 6, display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end' }}>
        <Box>
          <Typography variant="h4" sx={{ 
            fontFamily: 'var(--font-clash)', 
            fontWeight: 900, 
            letterSpacing: '-0.02em', 
            mb: 1 
          }}>
            User Directory
          </Typography>
          <Typography sx={{ color: alpha('#FFFFFF', 0.4), fontSize: '0.9rem' }}>
            Manage ecosystem members, permissions, and status.
          </Typography>
        </Box>
        <Box sx={{ display: 'flex', gap: 2 }}>
          <IconButton 
            onClick={() => fetchUsers()} 
            disabled={loading}
            sx={{ 
              borderRadius: '12px', 
              bgcolor: alpha('#FFFFFF', 0.05),
              color: alpha('#FFFFFF', 0.6),
              '&:hover': { bgcolor: alpha('#FFFFFF', 0.1) }
            }}
          >
            <RefreshCw size={18} className={loading ? 'animate-spin' : ''} />
          </IconButton>
          <Button 
            variant="contained" 
            startIcon={<UserPlus size={18} />}
            sx={{ 
              borderRadius: '16px', 
              bgcolor: '#6366F1', 
              px: 3, 
              py: 1.5,
              fontWeight: 800,
              textTransform: 'none',
              '&:hover': { bgcolor: '#4F46E5' }
            }}
          >
            Add Member
          </Button>
        </Box>
      </Box>

      {/* Filter Bar */}
      <Paper sx={{ 
        p: 2, 
        borderRadius: '20px', 
        bgcolor: '#161412', 
        border: '1px solid rgba(255, 255, 255, 0.05)',
        mb: 4,
        display: 'flex',
        gap: 2
      }}>
        <TextField 
          fullWidth
          placeholder="Search users by name, email, or ID..."
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
          sx={{ 
            '& .MuiOutlinedInput-root': { 
              borderRadius: '14px',
              bgcolor: 'rgba(255, 255, 255, 0.02)',
              '& fieldset': { borderColor: 'rgba(255, 255, 255, 0.05)' }
            } 
          }}
          InputProps={{
            startAdornment: (
              <InputAdornment position="start">
                <Search size={18} color={alpha('#FFFFFF', 0.4)} />
              </InputAdornment>
            ),
          }}
        />
      </Paper>

      {/* Users Table */}
      <TableContainer component={Paper} sx={{ 
        borderRadius: '24px', 
        bgcolor: '#161412', 
        border: '1px solid rgba(255, 255, 255, 0.05)',
        backgroundImage: 'none',
        overflow: 'hidden',
        minHeight: '200px',
        display: 'flex',
        flexDirection: 'column'
      }}>
        {loading && users.length === 0 ? (
          <Box sx={{ p: 8, display: 'flex', justifyContent: 'center' }}>
            <CircularProgress size={32} sx={{ color: '#6366F1' }} />
          </Box>
        ) : error ? (
          <Box sx={{ p: 8, textAlign: 'center' }}>
            <Typography sx={{ color: '#F43F5E', fontWeight: 700 }}>{error}</Typography>
            <Button onClick={() => fetchUsers()} sx={{ mt: 2, color: '#6366F1' }}>Retry</Button>
          </Box>
        ) : (
          <Table>
            <TableHead sx={{ bgcolor: alpha('#FFFFFF', 0.02) }}>
              <TableRow>
                <TableCell sx={{ color: alpha('#FFFFFF', 0.4), fontWeight: 800, borderBottom: '1px solid rgba(255, 255, 255, 0.05)' }}>MEMBER</TableCell>
                <TableCell sx={{ color: alpha('#FFFFFF', 0.4), fontWeight: 800, borderBottom: '1px solid rgba(255, 255, 255, 0.05)' }}>STATUS</TableCell>
                <TableCell sx={{ color: alpha('#FFFFFF', 0.4), fontWeight: 800, borderBottom: '1px solid rgba(255, 255, 255, 0.05)' }}>ROLE</TableCell>
                <TableCell sx={{ color: alpha('#FFFFFF', 0.4), fontWeight: 800, borderBottom: '1px solid rgba(255, 255, 255, 0.05)' }}>JOINED</TableCell>
                <TableCell align="right" sx={{ color: alpha('#FFFFFF', 0.4), fontWeight: 800, borderBottom: '1px solid rgba(255, 255, 255, 0.05)' }}>ACTIONS</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {users.map((user) => (
                <TableRow key={user.id} sx={{ '&:hover': { bgcolor: alpha('#FFFFFF', 0.01) } }}>
                  <TableCell sx={{ borderBottom: '1px solid rgba(255, 255, 255, 0.03)' }}>
                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
                      <Avatar sx={{ bgcolor: alpha('#6366F1', 0.1), color: '#6366F1', fontWeight: 800, width: 36, height: 36, fontSize: '0.875rem' }}>
                        {user.name.charAt(0)}
                      </Avatar>
                      <Box>
                        <Typography sx={{ fontWeight: 800, fontSize: '0.875rem' }}>{user.name}</Typography>
                        <Typography sx={{ fontSize: '0.75rem', color: alpha('#FFFFFF', 0.4) }}>{user.email}</Typography>
                      </Box>
                    </Box>
                  </TableCell>
                  <TableCell sx={{ borderBottom: '1px solid rgba(255, 255, 255, 0.03)' }}>
                    <Chip 
                      label={user.status} 
                      size="small" 
                      sx={{ 
                        borderRadius: '8px', 
                        fontSize: '0.65rem', 
                        fontWeight: 900, 
                        textTransform: 'uppercase',
                        bgcolor: user.status === 'active' ? alpha('#10B981', 0.1) : alpha('#FFFFFF', 0.05),
                        color: user.status === 'active' ? '#10B981' : alpha('#FFFFFF', 0.4),
                        border: `1px solid ${user.status === 'active' ? alpha('#10B981', 0.2) : 'transparent'}`
                      }} 
                    />
                  </TableCell>
                  <TableCell sx={{ borderBottom: '1px solid rgba(255, 255, 255, 0.03)' }}>
                    <Typography sx={{ fontSize: '0.875rem', fontWeight: 600, display: 'flex', alignItems: 'center', gap: 1 }}>
                      {user.role === 'admin' ? <Shield size={14} color="#6366F1" /> : <Activity size={14} color={alpha('#FFFFFF', 0.2)} />}
                      {user.role}
                    </Typography>
                  </TableCell>
                  <TableCell sx={{ borderBottom: '1px solid rgba(255, 255, 255, 0.03)' }}>
                    <Typography sx={{ fontSize: '0.875rem', color: alpha('#FFFFFF', 0.6) }}>{user.joinDate}</Typography>
                  </TableCell>
                  <TableCell align="right" sx={{ borderBottom: '1px solid rgba(255, 255, 255, 0.03)' }}>
                    <Box sx={{ display: 'flex', justifyContent: 'flex-end', gap: 1 }}>
                      <Tooltip title="Send Email">
                        <IconButton size="small" sx={{ color: alpha('#FFFFFF', 0.4), '&:hover': { color: '#6366F1', bgcolor: alpha('#6366F1', 0.1) } }}>
                          <Mail size={18} />
                        </IconButton>
                      </Tooltip>
                      <Tooltip title={user.status === 'active' ? "Suspend User" : "Activate User"}>
                        <IconButton size="small" sx={{ color: alpha('#FFFFFF', 0.4), '&:hover': { color: user.status === 'active' ? '#EF4444' : '#10B981', bgcolor: alpha(user.status === 'active' ? '#EF4444' : '#10B981', 0.1) } }}>
                          {user.status === 'active' ? <Trash2 size={18} /> : <CheckCircle2 size={18} />}
                        </IconButton>
                      </Tooltip>
                      <IconButton size="small" sx={{ color: alpha('#FFFFFF', 0.4) }}>
                        <MoreVertical size={18} />
                      </IconButton>
                    </Box>
                  </TableCell>
                </TableRow>
              ))}
              {!loading && users.length === 0 && (
                <TableRow>
                  <TableCell colSpan={5} sx={{ textAlign: 'center', py: 8, color: alpha('#FFFFFF', 0.4), borderBottom: 'none' }}>
                    No users found matching your search.
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        )}
      </TableContainer>
    </AdminLayout>
  );
}
