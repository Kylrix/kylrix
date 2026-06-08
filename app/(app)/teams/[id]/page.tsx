'use client';

import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { useParams, useRouter, notFound } from 'next/navigation';
import {
  Box,
  Button,
  CircularProgress,
  IconButton,
  Paper,
  Stack,
  Typography,
  alpha,
} from '@/lib/mui-tailwind/material';
import {
  ArrowLeft,
  Calendar,
  Crown,
  FolderKanban,
  Shield,
  Trash2,
  UserPlus,
  Users,
} from 'lucide-react';
import { type Models } from 'appwrite';
import { TeamsService } from '@/lib/appwrite/teams';
import { ProjectsService } from '@/lib/appwrite/projects';
import { useAuth } from '@/lib/auth';
import { useToast } from '@/components/ui/Toast';
import { MultiSectionContainer } from '@/context/SectionContext';
import { IdentityAvatar } from '@/components/common/IdentityBadge';
import type { Projects } from '@/types/appwrite';

function memberLabel(member: Models.Membership) {
  return member.userName || member.userEmail || member.userId || 'Member';
}

function memberInitial(member: Models.Membership) {
  const label = memberLabel(member);
  return label.charAt(0).toUpperCase() || 'M';
}

function formatRole(roles: string[]) {
  if (!roles.length) return 'Member';
  return roles
    .map((role) => role.charAt(0).toUpperCase() + role.slice(1))
    .join(', ');
}

export default function TeamDetailPage() {
  const router = useRouter();
  const params = useParams<{ id: string }>();
  const teamId = params?.id;
  const { user } = useAuth();
  const { showSuccess, showError } = useToast();

  const [team, setTeam] = useState<Models.Team | null>(null);
  const [memberships, setMemberships] = useState<Models.Membership[]>([]);
  const [linkedProjects, setLinkedProjects] = useState<Projects[]>([]);
  const [loading, setLoading] = useState(true);
  const [notFoundState, setNotFoundState] = useState(false);
  const [deleting, setDeleting] = useState(false);

  const currentMembership = useMemo(
    () => memberships.find((member) => member.userId === user?.$id),
    [memberships, user?.$id],
  );

  const isOwner = useMemo(
    () => currentMembership?.roles?.includes('owner') ?? false,
    [currentMembership],
  );

  const loadTeam = useCallback(async () => {
    if (!teamId) return;
    setLoading(true);
    setNotFoundState(false);

    try {
      const [teamDoc, membershipRes, projectsRes] = await Promise.all([
        TeamsService.getTeam(teamId),
        TeamsService.listMemberships(teamId),
        ProjectsService.listProjects(),
      ]);

      setTeam(teamDoc);
      setMemberships(membershipRes.memberships);
      setLinkedProjects(
        projectsRes.rows.filter((project) => project.$id === teamId),
      );
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Failed to load team';
      if (message.toLowerCase().includes('not found') || message.includes('404')) {
        setNotFoundState(true);
      } else {
        showError('Failed to load team workspace', message);
      }
    } finally {
      setLoading(false);
    }
  }, [teamId, showError]);

  useEffect(() => {
    void loadTeam();
  }, [loadTeam]);

  const handleDeleteTeam = async () => {
    if (!teamId || !isOwner || deleting) return;
    const confirmed = window.confirm(
      `Delete "${team?.name}"? This cannot be undone.`,
    );
    if (!confirmed) return;

    setDeleting(true);
    try {
      await TeamsService.deleteTeam(teamId);
      showSuccess('Team deleted');
      router.replace('/teams');
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Failed to delete team';
      showError('Delete failed', message);
    } finally {
      setDeleting(false);
    }
  };

  if (!teamId) {
    notFound();
  }

  if (!loading && notFoundState) {
    notFound();
  }

  return (
    <Box sx={{ minHeight: '100vh', bgcolor: '#0A0908', color: '#fff', pt: { xs: 4, md: 6 }, pb: 10 }}>
      <MultiSectionContainer panels={['team_workspace', 'team_members', 'team_projects']}>
        <Box sx={{ maxWidth: 1000, mx: 'auto', px: { xs: 2, md: 4 }, width: '100%' }}>
          <IconButton
            onClick={() => router.push('/teams')}
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

          {loading ? (
            <Box sx={{ display: 'flex', justifyContent: 'center', py: 12 }}>
              <CircularProgress sx={{ color: '#10B981' }} />
            </Box>
          ) : team ? (
            <>
              <Stack
                direction={{ xs: 'column', md: 'row' }}
                spacing={4}
                justifyContent="space-between"
                alignItems={{ xs: 'flex-start', md: 'flex-end' }}
                sx={{ mb: 6 }}
              >
                <Box>
                  <Stack direction="row" spacing={2} alignItems="center" sx={{ mb: 2 }}>
                    <Box
                      sx={{
                        width: 64,
                        height: 64,
                        borderRadius: '20px',
                        bgcolor: alpha('#10B981', 0.1),
                        color: '#10B981',
                        display: 'grid',
                        placeItems: 'center',
                        border: '1px solid rgba(16,185,129,0.2)',
                      }}
                    >
                      <Users size={30} />
                    </Box>
                    <Box>
                      <Typography
                        variant="h1"
                        sx={{
                          fontWeight: 900,
                          fontFamily: 'var(--font-clash)',
                          fontSize: { xs: '2rem', md: '3rem' },
                          lineHeight: 1,
                          letterSpacing: '-0.03em',
                        }}
                      >
                        {team.name}
                      </Typography>
                      <Stack direction="row" spacing={1.5} sx={{ mt: 1.5 }} flexWrap="wrap" useFlexGap>
                        <Typography
                          component="span"
                          sx={{
                            color: 'rgba(255,255,255,0.45)',
                            fontSize: '0.7rem',
                            fontWeight: 800,
                            textTransform: 'uppercase',
                            letterSpacing: '0.08em',
                            bgcolor: 'rgba(255,255,255,0.04)',
                            px: 1.5,
                            py: 0.5,
                            borderRadius: '999px',
                            border: '1px solid rgba(255,255,255,0.06)',
                          }}
                        >
                          {team.total} Members
                        </Typography>
                        <Typography
                          component="span"
                          sx={{
                            color: 'rgba(255,255,255,0.45)',
                            fontSize: '0.7rem',
                            fontWeight: 800,
                            textTransform: 'uppercase',
                            letterSpacing: '0.08em',
                            display: 'inline-flex',
                            alignItems: 'center',
                            gap: 0.75,
                          }}
                        >
                          <Calendar size={12} />
                          Est. {new Date(team.$createdAt).toLocaleDateString(undefined, { month: 'short', year: 'numeric' })}
                        </Typography>
                        {isOwner && (
                          <Typography
                            component="span"
                            sx={{
                              color: '#10B981',
                              fontSize: '0.7rem',
                              fontWeight: 800,
                              textTransform: 'uppercase',
                              letterSpacing: '0.08em',
                              display: 'inline-flex',
                              alignItems: 'center',
                              gap: 0.75,
                            }}
                          >
                            <Crown size={12} />
                            Owner
                          </Typography>
                        )}
                      </Stack>
                    </Box>
                  </Stack>
                  <Typography
                    component="span"
                    sx={{
                      color: 'rgba(255,255,255,0.4)',
                      maxWidth: 560,
                      fontSize: '0.95rem',
                      fontWeight: 500,
                      lineHeight: 1.55,
                      display: 'block',
                    }}
                  >
                    Coordinate projects, shared access, and huddles from this team workspace.
                  </Typography>
                </Box>

                <Stack direction="row" spacing={1.5}>
                  <Button
                    variant="outlined"
                    startIcon={<UserPlus size={16} />}
                    sx={{
                      borderRadius: '12px',
                      borderColor: 'rgba(255,255,255,0.1)',
                      color: '#fff',
                      fontWeight: 800,
                      textTransform: 'none',
                    }}
                    disabled
                  >
                    Invite
                  </Button>
                  {isOwner && (
                    <Button
                      variant="outlined"
                      color="error"
                      startIcon={<Trash2 size={16} />}
                      onClick={handleDeleteTeam}
                      disabled={deleting}
                      sx={{
                        borderRadius: '12px',
                        fontWeight: 800,
                        textTransform: 'none',
                      }}
                    >
                      {deleting ? 'Deleting...' : 'Delete Team'}
                    </Button>
                  )}
                </Stack>
              </Stack>

              <Box sx={{ mb: 6 }}>
                <Typography
                  variant="caption"
                  sx={{
                    color: 'rgba(255,255,255,0.3)',
                    fontWeight: 800,
                    textTransform: 'uppercase',
                    letterSpacing: '0.15em',
                    display: 'block',
                    mb: 2,
                  }}
                >
                  Team Roster ({memberships.length})
                </Typography>

                <Paper
                  elevation={0}
                  sx={{
                    bgcolor: '#161412',
                    border: '1px solid rgba(255,255,255,0.06)',
                    borderRadius: '28px',
                    overflow: 'hidden',
                  }}
                >
                  {memberships.length === 0 ? (
                    <Box sx={{ p: 6, textAlign: 'center' }}>
                      <Typography sx={{ color: 'rgba(255,255,255,0.45)', fontWeight: 600 }}>
                        No members found for this team yet.
                      </Typography>
                    </Box>
                  ) : (
                    memberships.map((member, index) => (
                      <Box
                        key={member.$id}
                        sx={{
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'space-between',
                          gap: 2,
                          px: 3,
                          py: 2.25,
                          borderBottom:
                            index < memberships.length - 1
                              ? '1px solid rgba(255,255,255,0.04)'
                              : 'none',
                        }}
                      >
                        <Stack direction="row" spacing={2} alignItems="center" sx={{ minWidth: 0 }}>
                          <IdentityAvatar
                            fallback={memberInitial(member)}
                            alt={memberLabel(member)}
                            size={42}
                          />
                          <Box sx={{ minWidth: 0 }}>
                            <Typography
                              sx={{
                                color: '#fff',
                                fontWeight: 800,
                                fontSize: '0.95rem',
                                whiteSpace: 'nowrap',
                                overflow: 'hidden',
                                textOverflow: 'ellipsis',
                              }}
                            >
                              {memberLabel(member)}
                            </Typography>
                            {member.userEmail && member.userEmail !== member.userName && (
                              <Typography
                                sx={{
                                  color: 'rgba(255,255,255,0.4)',
                                  fontSize: '0.8rem',
                                  fontWeight: 600,
                                  whiteSpace: 'nowrap',
                                  overflow: 'hidden',
                                  textOverflow: 'ellipsis',
                                }}
                              >
                                {member.userEmail}
                              </Typography>
                            )}
                          </Box>
                        </Stack>

                        <Stack direction="row" spacing={1} alignItems="center" flexShrink={0}>
                          <Typography
                            component="span"
                            sx={{
                              color: member.roles?.includes('owner') ? '#10B981' : 'rgba(255,255,255,0.45)',
                              fontSize: '0.65rem',
                              fontWeight: 800,
                              textTransform: 'uppercase',
                              letterSpacing: '0.08em',
                              display: 'inline-flex',
                              alignItems: 'center',
                              gap: 0.5,
                              bgcolor: 'rgba(255,255,255,0.04)',
                              px: 1.25,
                              py: 0.5,
                              borderRadius: '999px',
                            }}
                          >
                            {member.roles?.includes('owner') ? <Shield size={10} /> : null}
                            {formatRole(member.roles || [])}
                          </Typography>
                          {member.userId === user?.$id && (
                            <Typography
                              component="span"
                              sx={{
                                color: 'rgba(255,255,255,0.25)',
                                fontSize: '0.65rem',
                                fontWeight: 800,
                                textTransform: 'uppercase',
                              }}
                            >
                              You
                            </Typography>
                          )}
                        </Stack>
                      </Box>
                    ))
                  )}
                </Paper>
              </Box>

              <Box>
                <Typography
                  variant="caption"
                  sx={{
                    color: 'rgba(255,255,255,0.3)',
                    fontWeight: 800,
                    textTransform: 'uppercase',
                    letterSpacing: '0.15em',
                    display: 'block',
                    mb: 2,
                  }}
                >
                  Linked Projects ({linkedProjects.length})
                </Typography>

                {linkedProjects.length === 0 ? (
                  <Paper
                    elevation={0}
                    sx={{
                      bgcolor: '#161412',
                      border: '1px dashed rgba(255,255,255,0.08)',
                      borderRadius: '28px',
                      p: 5,
                      textAlign: 'center',
                    }}
                  >
                    <Box
                      sx={{
                        width: 56,
                        height: 56,
                        borderRadius: '18px',
                        bgcolor: alpha('#10B981', 0.05),
                        color: '#10B981',
                        display: 'grid',
                        placeItems: 'center',
                        mx: 'auto',
                        mb: 2,
                      }}
                    >
                      <FolderKanban size={24} />
                    </Box>
                    <Typography sx={{ color: '#fff', fontWeight: 800, mb: 0.5 }}>
                      No linked projects yet
                    </Typography>
                    <Typography sx={{ color: 'rgba(255,255,255,0.45)', fontSize: '0.9rem', mb: 3 }}>
                      Projects that share this team ID will appear here.
                    </Typography>
                    <Button
                      variant="outlined"
                      onClick={() => router.push('/projects')}
                      sx={{
                        borderRadius: '12px',
                        borderColor: 'rgba(255,255,255,0.1)',
                        color: '#fff',
                        fontWeight: 800,
                        textTransform: 'none',
                      }}
                    >
                      Browse Projects
                    </Button>
                  </Paper>
                ) : (
                  <Stack spacing={2}>
                    {linkedProjects.map((project) => (
                      <Paper
                        key={project.$id}
                        elevation={0}
                        onClick={() => router.push(`/projects/${project.$id}`)}
                        sx={{
                          bgcolor: '#161412',
                          border: '1px solid rgba(255,255,255,0.06)',
                          borderRadius: '24px',
                          p: 3,
                          cursor: 'pointer',
                          transition: 'border-color 0.2s ease',
                          '&:hover': { borderColor: 'rgba(16,185,129,0.35)' },
                        }}
                      >
                        <Stack direction="row" spacing={2} alignItems="center">
                          <Box
                            sx={{
                              width: 44,
                              height: 44,
                              borderRadius: '14px',
                              bgcolor: alpha('#10B981', 0.1),
                              color: '#10B981',
                              display: 'grid',
                              placeItems: 'center',
                            }}
                          >
                            <FolderKanban size={20} />
                          </Box>
                          <Box sx={{ minWidth: 0, flex: 1 }}>
                            <Typography sx={{ color: '#fff', fontWeight: 800, fontSize: '1rem' }}>
                              {project.name || 'Untitled Project'}
                            </Typography>
                            <Typography sx={{ color: 'rgba(255,255,255,0.4)', fontSize: '0.8rem', fontWeight: 600 }}>
                              Open project workspace
                            </Typography>
                          </Box>
                        </Stack>
                      </Paper>
                    ))}
                  </Stack>
                )}
              </Box>
            </>
          ) : null}
        </Box>
      </MultiSectionContainer>
    </Box>
  );
}
