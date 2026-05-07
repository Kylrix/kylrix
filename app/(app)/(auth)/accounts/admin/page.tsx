"use client";

import React, { useState, useEffect } from 'react';
import Link from 'next/link';
import { 
  Box, 
  Grid, 
  Paper, 

  Typography, 
  alpha,
  Button,
  IconButton,
  Avatar,
  CircularProgress,
  Tooltip
} from '@mui/material';
import { 
  Users, 
  Activity, 
  Cpu, 
  TrendingUp, 
  ChevronRight,
  Zap,
  RefreshCw
} from 'lucide-react';
import AdminLayout from './components/AdminLayout';
import { getAdminStatsAction } from '../actions/admin';

export default function AdminDashboard() {
  const [stats, setStats] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  const fetchStats = async () => {
    setLoading(true);
    try {
      const data = await getAdminStatsAction();
      setStats(data);
    } catch (error: any) {
      console.error('Failed to fetch stats:', error);
      // fallback so the UI still renders the structure
      setStats({ error: error.message });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchStats();
  }, []);

  const statCards = [
    { label: 'Total Users', value: stats?.totalUsers || '0', icon: Users, color: '#6366F1', trend: stats?.growth || '+0%' },
    { label: 'Active Sessions', value: stats?.activeNow || '0', icon: Activity, color: '#10B981', trend: '+5%' },
    { label: 'API Requests', value: '48.2k', icon: Zap, color: '#F59E0B', trend: '+18%' },
    { label: 'System Health', value: stats?.systemHealth || '99.9%', icon: Cpu, color: '#EC4899', trend: 'Stable' },
  ];

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
            System Overview
          </Typography>
          <Typography sx={{ color: alpha('#FFFFFF', 0.4), fontSize: '0.9rem' }}>
            Real-time analytics and management across the Kylrix Ecosystem.
          </Typography>
        </Box>
        <IconButton 
          onClick={fetchStats} 
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
      </Box>

      <Grid container spacing={3} sx={{ mb: 6 }}>
        {statCards.map((stat) => (
          <Grid size={{ xs: 12, sm: 6, md: 3 }} key={stat.label}>
            <Paper sx={{ 
              p: 3, 
              borderRadius: '24px', 
              bgcolor: '#161412', 
              border: '1px solid rgba(255, 255, 255, 0.05)',
              display: 'flex',
              flexDirection: 'column',
              gap: 2,
              position: 'relative',
              overflow: 'hidden',
              transition: 'all 0.3s cubic-bezier(0.4, 0, 0.2, 1)',
              '&:hover': {
                transform: 'translateY(-4px)',
                borderColor: alpha(stat.color, 0.3),
                boxShadow: `0 20px 40px -20px ${alpha(stat.color, 0.2)}`
              }
            }}>
              <Box sx={{ 
                p: 1.5, 
                borderRadius: '16px', 
                bgcolor: alpha(stat.color, 0.1), 
                color: stat.color,
                width: 'fit-content'
              }}>
                <stat.icon size={24} strokeWidth={2.5} />
              </Box>
              <Box>
                <Typography sx={{ fontSize: '0.75rem', fontWeight: 700, color: alpha('#FFFFFF', 0.4), mb: 0.5 }}>
                  {stat.label}
                </Typography>
                <Box sx={{ display: 'flex', alignItems: 'baseline', gap: 1.5 }}>
                  <Typography variant="h5" sx={{ fontWeight: 900, fontFamily: 'var(--font-satoshi)' }}>
                    {loading ? <CircularProgress size={20} sx={{ color: alpha('#FFFFFF', 0.2) }} /> : stat.value}
                  </Typography>
                  <Typography sx={{ 
                    fontSize: '0.7rem', 
                    fontWeight: 900, 
                    color: stat.trend.includes('+') ? '#10B981' : alpha('#FFFFFF', 0.4),
                    bgcolor: stat.trend.includes('+') ? alpha('#10B981', 0.1) : 'transparent',
                    px: 1,
                    py: 0.2,
                    borderRadius: '6px'
                  }}>
                    {stat.trend}
                  </Typography>
                </Box>
              </Box>
            </Paper>
          </Grid>
        ))}
      </Grid>

      <Grid container spacing={3}>
        <Grid size={{ xs: 12, lg: 8 }}>
          <Paper sx={{ 
            p: 4, 
            borderRadius: '32px', 
            bgcolor: '#161412', 
            border: '1px solid rgba(255, 255, 255, 0.05)',
            minHeight: 400
          }}>
            <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 4 }}>
              <Typography variant="h6" sx={{ fontWeight: 800 }}>Ecosystem Activity</Typography>
              <Button 
                endIcon={<ChevronRight size={16} />}
                sx={{ 
                  borderRadius: '12px', 
                  textTransform: 'none', 
                  fontSize: '0.8rem', 
                  fontWeight: 800,
                  color: '#6366F1'
                }}
              >
                Full Analytics
              </Button>
            </Box>
            
            <Box sx={{ 
              height: 300, 
              width: '100%', 
              display: 'flex', 
              alignItems: 'flex-end', 
              justifyContent: 'space-between',
              p: 3,
              gap: 2,
              border: '1px dashed rgba(255, 255, 255, 0.05)',
              borderRadius: '24px',
              bgcolor: alpha('#6366F1', 0.02)
            }}>
              {stats?.analytics ? stats.analytics.map((day: any, i: number) => {
                const max = Math.max(...stats.analytics.map((d: any) => d.users));
                const height = (day.users / max) * 100;
                return (
                  <Box key={i} sx={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 1, flex: 1 }}>
                    <Tooltip title={`${day.users} active`}>
                      <Box sx={{ 
                        width: '100%', 
                        height: `${height}%`, 
                        minHeight: '10%',
                        bgcolor: i === 6 ? '#6366F1' : alpha('#6366F1', 0.2),
                        borderRadius: '8px',
                        transition: 'all 0.3s ease',
                        '&:hover': { bgcolor: '#6366F1' }
                      }} />
                    </Tooltip>
                    <Typography sx={{ fontSize: '0.7rem', color: alpha('#FFFFFF', 0.4), fontWeight: 700 }}>
                      {day.name}
                    </Typography>
                  </Box>
                );
              }) : (
                <Box sx={{ textAlign: 'center', width: '100%' }}>
                  <TrendingUp size={48} color={alpha('#6366F1', 0.2)} strokeWidth={1.5} />
                  <Typography sx={{ color: alpha('#FFFFFF', 0.2), fontWeight: 700, mt: 2 }}>
                    Loading Chart Data...
                  </Typography>
                </Box>
              )}
            </Box>
          </Paper>
        </Grid>

        <Grid size={{ xs: 12, lg: 4 }}>
          <Paper sx={{ 
            p: 4, 
            borderRadius: '32px', 
            bgcolor: '#161412', 
            border: '1px solid rgba(255, 255, 255, 0.05)',
            height: '100%'
          }}>
            <Typography variant="h6" sx={{ fontWeight: 800, mb: 4 }}>Recent Signups</Typography>
            
            <Box sx={{ display: 'flex', flexDirection: 'column', gap: 3 }}>
              {stats?.recentUsers?.length ? stats.recentUsers.slice(0, 4).map((u: any, idx: number) => (
                <Box key={idx} sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
                  <Avatar sx={{ bgcolor: alpha('#6366F1', 0.1), color: '#6366F1', fontWeight: 800 }}>
                    {u.name.charAt(0).toUpperCase()}
                  </Avatar>
                  <Box sx={{ flex: 1, minWidth: 0 }}>
                    <Typography sx={{ fontSize: '0.875rem', fontWeight: 800, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                      {u.name}
                    </Typography>
                    <Typography sx={{ fontSize: '0.75rem', color: alpha('#FFFFFF', 0.4), whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                      {u.email}
                    </Typography>
                  </Box>
                  <Box sx={{ textAlign: 'right', flexShrink: 0 }}>
                    <Typography sx={{ fontSize: '0.75rem', color: alpha('#FFFFFF', 0.6) }}>
                      {new Date(u.date).toLocaleDateString(undefined, { month: 'short', day: 'numeric' })}
                    </Typography>
                    <Typography sx={{ fontSize: '0.65rem', color: '#10B981', fontWeight: 800 }}>NEW</Typography>
                  </Box>
                </Box>
              )) : (
                <Typography sx={{ color: alpha('#FFFFFF', 0.4), textAlign: 'center', py: 4 }}>
                  No recent users to show yet.
                </Typography>
              )}
            </Box>

            <Link href="/accounts/admin/users" passHref legacyBehavior>
              <Button 
                fullWidth
                component="a"
                sx={{ 
                  mt: 4, 
                  borderRadius: '16px', 
                  py: 1.5,
                  bgcolor: alpha('#FFFFFF', 0.03),
                  border: '1px solid rgba(255, 255, 255, 0.05)',
                  color: 'white',
                  fontWeight: 800,
                  textTransform: 'none',
                  '&:hover': { bgcolor: alpha('#FFFFFF', 0.05) }
                }}
              >
                Manage All Users
              </Button>
            </Link>
          </Paper>
        </Grid>
      </Grid>
    </AdminLayout>
  );
}
