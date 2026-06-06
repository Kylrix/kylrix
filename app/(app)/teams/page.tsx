'use client';

import React, { useEffect, useState, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import {
  Box,
  IconButton,
  Button,
  Stack,
  Typography,
  alpha,
  useTheme,
  CircularProgress,
  Paper,
  Grid
} from '@/lib/mui-tailwind/material';
import {
  Users,
  Plus,
  ArrowLeft,
  UserPlus,
  Shield,
  Settings,
  MoreVertical,
  ArrowUpRight,
  ExternalLink,
  Lock,
  Globe,
  Trash2,
  Calendar,
  CheckCircle2
} from 'lucide-react';
import { TeamsService } from '@/lib/appwrite/teams';
import { useAuth } from '@/lib/auth';
import { useToast } from '@/components/ui/Toast';
import { type Models } from 'appwrite';
import { MultiSectionContainer } from '@/context/SectionContext';
import TeamDialog from '@/components/teams/TeamDialog';

export default function TeamsPage() {
  const router = useRouter();
  const { user } = useAuth();
  const { showSuccess, showError } = useToast();
  const [teams, setTeams] = useState<Models.Team[]>([]);
  const [loading, setLoading] = useState(true);
  const [isDialogOpen, setIsDialogOpen] = useState(false);

  const fetchTeams = useCallback(async () => {
    setLoading(true);
    try {
      const res = await TeamsService.listTeams();
      setTeams(res.teams);
    } catch (err: any) {
      showError('Failed to load ecosystem teams', err.message);
    } finally {
      setLoading(false);
    }
  }, [showError]);

  useEffect(() => {
    fetchTeams();
  }, [fetchTeams]);

  const handleCreateTeam = async (name: string) => {
    try {
        await TeamsService.createTeam(name);
        showSuccess(`Team "${name}" provisioned successfully!`);
        fetchTeams();
    } catch (err: any) {
        console.error('Failed to create team:', err);
        showError('Provisioning failed', err.message);
    }
  };

  return (
    <Box sx={{ minHeight: '100vh', bgcolor: '#0A0908', color: '#fff', pt: { xs: 4, md: 6 }, pb: 10 }}>
      <MultiSectionContainer panels={['teams_overview', 'teams_activity']}>
        <Box sx={{ maxWidth: 1000, mx: 'auto', px: { xs: 2, md: 4 }, width: '100%' }}>
          {/* Back Button */}
          <IconButton
            onClick={() => router.back()}
            sx={{
              mb: 3,
              bgcolor: '#161412',
              color: '#fff',
              border: '1px solid rgba(255,255,255,0.06)',
              '&:hover': { bgcolor: '#1C1A18' },
            }}
          >
            <ArrowLeft size={18} />
          </IconButton>

          {/* Header Section */}
          <Stack direction={{ xs: 'column', md: 'row' }} spacing={4} justifyContent="space-between" alignItems={{ xs: 'flex-start', md: 'flex-end' }} sx={{ mb: 6 }}>
              <Box>
                  <Typography variant="h1" sx={{ fontWeight: 900, fontFamily: 'var(--font-clash)', fontSize: { xs: '2.5rem', md: '3.5rem' }, lineHeight: 1, letterSpacing: '-0.03em' }}>
                      Ecosystem Teams
                  </Typography>
                  <Typography component="span" sx={{ mt: 1.5, color: 'rgba(255,255,255,0.4)', maxWidth: 500, fontSize: '1rem', fontWeight: 500, lineHeight: 1.55, display: 'block' }}>
                      Coordinate projects, huddles, and shared secrets across secure ecosystem nodes.
                  </Typography>
              </Box>

              <Box>
                <Button
                  onClick={() => setIsDialogOpen(true)}
                  variant="contained"
                  sx={{
                    bgcolor: '#10B981',
                    color: '#000',
                    borderRadius: '14px',
                    px: 4,
                    py: 1.5,
                    fontWeight: 900,
                    textTransform: 'uppercase',
                    letterSpacing: '0.05em',
                    '&:hover': { bgcolor: '#0fa976' }
                  }}
                  startIcon={<Plus size={18} strokeWidth={3} />}
                >
                  Create Team
                </Button>
              </Box>
          </Stack>

          {/* Teams List */}
          <Box>
            {loading ? (
              <Box sx={{ display: 'flex', justifyContent: 'center', py: 10 }}>
                <CircularProgress sx={{ color: '#10B981' }} />
              </Box>
            ) : teams.length === 0 ? (
              <Paper
                elevation={0}
                sx={{
                  bgcolor: '#161412',
                  border: '1px dashed rgba(255,255,255,0.08)',
                  borderRadius: '32px',
                  p: 8,
                  textAlign: 'center',
                  backgroundImage: 'none',
                }}
              >
                <Box sx={{ width: 80, height: 80, borderRadius: '24px', bgcolor: alpha('#10B981', 0.05), color: '#10B981', display: 'grid', placeItems: 'center', mx: 'auto', mb: 3 }}>
                  <Users size={40} />
                </Box>
                <Typography variant="h5" sx={{ color: '#fff', fontWeight: 900, mb: 1 }}>No active teams</Typography>
                <Typography component="span" sx={{ color: 'rgba(255,255,255,0.5)', mb: 4, maxWidth: 360, mx: 'auto', lineHeight: 1.55, display: 'block' }}>
                  Teams allow you to invite collaborators and manage shared resources securely.
                </Typography>
                <Button 
                    variant="outlined" 
                    onClick={() => setIsDialogOpen(true)}
                    sx={{ borderRadius: '12px', borderColor: 'rgba(255,255,255,0.1)', color: '#fff', px: 4, fontWeight: 800 }}
                >
                    Start Your First Team
                </Button>
              </Paper>
            ) : (
              <Grid container spacing={3}>
                {teams.map((team) => (
                  <Grid size={{ xs: 12, md: 6 }} key={team.$id}>
                    <div className="bg-[#161412] border border-white/6 rounded-[32px] p-6 space-y-5 transition-all hover:border-[#10B981]/30 group relative overflow-hidden">
                      <div className="absolute top-0 right-0 w-32 h-32 bg-[#10B981]/5 rounded-full blur-3xl pointer-events-none group-hover:bg-[#10B981]/10 transition-all duration-500" />
                      
                      <div className="flex items-start justify-between relative z-10">
                        <div className="flex items-center gap-4">
                          <div className="w-14 h-14 rounded-2xl bg-[#10B981]/10 text-[#10B981] flex items-center justify-center border border-[#10B981]/20 group-hover:scale-105 transition-transform">
                            <Users size={26} strokeWidth={2} />
                          </div>
                          <div className="min-w-0 flex-1">
                            <h3 className="text-white text-lg font-black tracking-tight leading-tight truncate">
                              {team.name}
                            </h3>
                            <div className="flex items-center gap-2 mt-1">
                                <span className="text-[#9B9691] text-[10px] font-bold uppercase tracking-wider bg-white/5 px-2 py-0.5 rounded border border-white/8">
                                    {team.total} Members
                                </span>
                                <span className="text-[#9B9691] text-[10px] font-bold uppercase tracking-wider flex items-center gap-1">
                                    <Shield size={10} /> Owner
                                </span>
                            </div>
                          </div>
                        </div>
                        <IconButton size="small" sx={{ color: 'white/20', '&:hover': { color: 'white', bgcolor: 'white/5' } }}>
                            <MoreVertical size={18} />
                        </IconButton>
                      </div>

                      <div className="flex items-center justify-between pt-4 border-t border-white/4 relative z-10">
                        <div className="flex items-center gap-1 text-[10px] text-white/30 font-bold uppercase tracking-widest">
                          <Calendar size={12} />
                          <span>Est. {new Date(team.$createdAt).toLocaleDateString(undefined, { month: 'short', year: 'numeric' })}</span>
                        </div>
                        <div className="flex gap-2">
                            <Button 
                                size="small"
                                variant="text"
                                sx={{ color: 'white/40', fontWeight: 800, textTransform: 'none', fontSize: '0.7rem', '&:hover': { color: 'white', bgcolor: 'white/5' } }}
                                startIcon={<UserPlus size={14} />}
                            >
                                Invite
                            </Button>
                            <Button 
                                size="small"
                                variant="contained"
                                onClick={() => router.push(`/teams/${team.$id}`)}
                                sx={{ bgcolor: 'white/3', color: 'white', borderRadius: '10px', fontWeight: 800, textTransform: 'none', fontSize: '0.7rem', border: '1px solid rgba(255,255,255,0.05)', '&:hover': { bgcolor: 'white/6' } }}
                                endIcon={<ArrowUpRight size={14} />}
                            >
                                Workspace
                            </Button>
                        </div>
                      </div>
                    </div>
                  </Grid>
                ))}
              </Grid>
            )}
          </Box>
        </Box>

        {isDialogOpen && (
          <TeamDialog 
            open={isDialogOpen} 
            onClose={() => setIsDialogOpen(false)} 
            onSubmit={handleCreateTeam} 
          />
        )}
      </MultiSectionContainer>
    </Box>
  );
}
