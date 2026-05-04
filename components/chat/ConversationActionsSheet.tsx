'use client';

import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import {
  Avatar,
  Box,
  Button,
  Chip,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  Divider,
  Drawer,
  IconButton,
  ListItemAvatar,
  Paper,
  InputAdornment,
  Stack,
  Tab,
  Tabs,
  TextField,
  Typography,
  alpha,
  useMediaQuery,
  useTheme,
} from '@mui/material';
import { Query } from 'appwrite';
import { Link as LinkIcon, MessageCircle, Phone, Search, Shield, Trash2, UserMinus, UserPlus, Users, X } from 'lucide-react';
import toast from 'react-hot-toast';

import { useAuth } from '@/lib/auth';
import { tablesDB } from '@/lib/appwrite/client';
import { APPWRITE_CONFIG } from '@/lib/appwrite/config';
import { ChatService } from '@/lib/services/chat';
import { UsersService } from '@/lib/services/users';
import { getCachedIdentityById, seedIdentityCache } from '@/lib/identity-cache';
import { fetchProfilePreview } from '@/lib/profile-preview';

type ConversationActionsSheetProps = {
  conversation: any | null;
  open: boolean;
  onClose: () => void;
  onConversationUpdated?: (conversation: any) => void;
  onConversationDeleted?: (conversationId: string) => void;
};

const ConversationAvatar = ({ user }: { user: any }) => {
  const [avatarUrl, setAvatarUrl] = useState<string | null>(null);

  useEffect(() => {
    let active = true;
    const resolve = async () => {
      const avatar = user?.avatar;
      if (!avatar) {
        if (active) setAvatarUrl(null);
        return;
      }

      if (String(avatar).startsWith('http')) {
        if (active) setAvatarUrl(avatar);
        return;
      }

      try {
        const preview = await fetchProfilePreview(avatar, 96, 96);
        if (active) setAvatarUrl(preview as unknown as string);
      } catch {
        if (active) setAvatarUrl(null);
      }
    };

    void resolve();
    return () => {
      active = false;
    };
  }, [user?.avatar]);

  return (
    <Avatar
      src={avatarUrl || undefined}
      sx={{
        width: 64,
        height: 64,
        bgcolor: '#F59E0B',
        color: '#FFFFFF',
        border: '1px solid rgba(255,255,255,0.08)',
      }}
    >
      {!avatarUrl && (user?.displayName || user?.username || '?').charAt(0).toUpperCase()}
    </Avatar>
  );
};

const MemberAvatar = ({ user }: { user: any }) => {
  const [avatarUrl, setAvatarUrl] = useState<string | null>(null);

  useEffect(() => {
    let active = true;
    const resolve = async () => {
      const avatar = user?.avatar;
      if (!avatar) {
        if (active) setAvatarUrl(null);
        return;
      }

      if (String(avatar).startsWith('http')) {
        if (active) setAvatarUrl(avatar);
        return;
      }

      try {
        const preview = await fetchProfilePreview(avatar, 64, 64);
        if (active) setAvatarUrl(preview as unknown as string);
      } catch {
        if (active) setAvatarUrl(null);
      }
    };

    void resolve();
    return () => {
      active = false;
    };
  }, [user?.avatar]);

  return (
    <Avatar
      src={avatarUrl || undefined}
      sx={{
        width: 44,
        height: 44,
        bgcolor: '#F59E0B',
        color: '#FFFFFF',
        border: '1px solid rgba(255,255,255,0.06)',
      }}
    >
      {!avatarUrl && (user?.displayName || user?.username || '?').charAt(0).toUpperCase()}
    </Avatar>
  );
};

function formatActionError(error: any, fallback: string) {
  const message = String(error?.message || '').trim();
  if (message) return message;
  return fallback;
}

export default function ConversationActionsSheet({
  conversation,
  open,
  onClose,
  onConversationUpdated,
  onConversationDeleted,
}: ConversationActionsSheetProps) {
  const router = useRouter();
  const theme = useTheme();
  const isMobile = useMediaQuery(theme.breakpoints.down('md'), { noSsr: true });
  const { user } = useAuth();

  const [currentConversation, setCurrentConversation] = useState<any | null>(conversation);
  const [directProfile, setDirectProfile] = useState<any | null>(null);
  const [directLoading, setDirectLoading] = useState(false);
  const [groupMembers, setGroupMembers] = useState<any[]>([]);
  const [membersLoading, setMembersLoading] = useState(false);
  const [pendingJoinRequests, setPendingJoinRequests] = useState<any[]>([]);
  const [pendingRequestsLoading, setPendingRequestsLoading] = useState(false);
  const [requesterProfiles, setRequesterProfiles] = useState<Record<string, any>>({});
  const [groupNameDraft, setGroupNameDraft] = useState('');
  const [groupDescriptionDraft, setGroupDescriptionDraft] = useState('');
  const [detailsSaving, setDetailsSaving] = useState(false);
  const [avatarUploading, setAvatarUploading] = useState(false);
  const [memberTab, setMemberTab] = useState<'invite' | 'members' | 'add' | 'remove'>('members');
  const [memberQuery, setMemberQuery] = useState('');
  const [memberResults, setMemberResults] = useState<any[]>([]);
  const [memberSearching, setMemberSearching] = useState(false);
  const [mutating, setMutating] = useState(false);
  const [deleteConfirmOpen, setDeleteConfirmOpen] = useState(false);

  const isGroup = currentConversation?.type === 'group';
  const isDirect = Boolean(currentConversation && !isGroup);
  const inviteEnabled = Boolean(currentConversation?.inviteLink && currentConversation.inviteLink === currentConversation.$id);
  const groupAvatarSrc = currentConversation?.avatarUrl || undefined;
  const inviteLink = useMemo(() => {
    if (!currentConversation?.$id || typeof window === 'undefined') return '';
    return `${window.location.origin}/groups/invite/${currentConversation.$id}`;
  }, [currentConversation?.$id]);
  const isDetailsDirty = useMemo(() => {
    const currentName = String(currentConversation?.name || '').trim();
    const currentDescription = String(currentConversation?.description || '').trim();
    return groupNameDraft.trim() !== currentName || groupDescriptionDraft.trim() !== currentDescription;
  }, [currentConversation?.description, currentConversation?.name, groupDescriptionDraft, groupNameDraft]);
  const participantIds = useMemo(
    () => {
      const ids = Array.isArray(currentConversation?.participants)
        ? currentConversation.participants.filter((id: unknown): id is string => typeof id === 'string' && id.trim().length > 0)
        : [];
      return Array.from(new Set<string>(ids));
    },
    [currentConversation?.participants]
  );
  const isAdmin = Boolean(user?.$id && (
    currentConversation?.admins?.includes(user.$id) ||
    currentConversation?.creatorId === user.$id
  ));

  const refreshConversation = useCallback(async () => {
    if (!currentConversation?.$id || !user?.$id) return null;
    try {
      const updated = await ChatService.getConversationById(currentConversation.$id, user.$id);
      setCurrentConversation(updated);
      onConversationUpdated?.(updated);
      return updated;
    } catch (error) {
      console.warn('[ConversationActionsSheet] Failed to refresh conversation:', error);
      return currentConversation;
    }
  }, [currentConversation, onConversationUpdated, user?.$id]);

  const loadPendingRequests = useCallback(async () => {
    if (!open || !isGroup || !isAdmin || !currentConversation?.$id) {
      setPendingJoinRequests([]);
      return;
    }

    setPendingRequestsLoading(true);
    try {
      const { rows } = await tablesDB.listRows(APPWRITE_CONFIG.DATABASES.CHAT, APPWRITE_CONFIG.TABLES.CHAT.JOIN_REQUESTS, [
        Query.equal('resourceType', 'chat.conversation'),
        Query.equal('resourceId', currentConversation.$id),
        Query.equal('status', 'pending'),
        Query.orderAsc('createdAt'),
        Query.limit(100),
      ]);

      setPendingJoinRequests(rows || []);

      const unknownProfiles = Array.from(new Set(
        (rows || [])
          .map((row: any) => row.requesterId)
          .filter((id: unknown): id is string => typeof id === 'string' && id.length > 0)
          .filter((id: string) => !getCachedIdentityById(id) && !requesterProfiles[id])
      ));

      if (unknownProfiles.length > 0) {
        const profiles = await Promise.all(
          unknownProfiles.map((id) => UsersService.getProfileById(id).then((profile) => seedIdentityCache(profile)).catch(() => null))
        );

        const mapped = profiles.reduce<Record<string, any>>((acc, profile) => {
          if (profile?.userId) {
            acc[profile.userId] = profile;
          }
          return acc;
        }, {});

        if (Object.keys(mapped).length > 0) {
          setRequesterProfiles((current) => ({ ...current, ...mapped }));
        }
      }
    } catch (error) {
      console.error('[ConversationActionsSheet] Failed to load join requests:', error);
      setPendingJoinRequests([]);
    } finally {
      setPendingRequestsLoading(false);
    }
  }, [currentConversation?.$id, isAdmin, isGroup, open, requesterProfiles]);

  useEffect(() => {
    if (!open || !conversation) return;
    setCurrentConversation(conversation);
    setGroupNameDraft(conversation?.name || '');
    setGroupDescriptionDraft(conversation?.description || '');
    setMemberTab('members');
    setMemberQuery('');
    setMemberResults([]);
    setPendingJoinRequests([]);
    setRequesterProfiles({});
    setDeleteConfirmOpen(false);
  }, [open, conversation]);

  useEffect(() => {
    if (!open || !currentConversation) return;

    if (isDirect) {
      const targetUserId = currentConversation.otherUserId || participantIds.find((id) => id !== user?.$id) || currentConversation.creatorId;
      if (!targetUserId) return;

      let active = true;
      setDirectLoading(true);
      UsersService.getProfileById(targetUserId)
        .then((profile) => {
          if (active) setDirectProfile(profile);
        })
        .catch((error) => {
          console.error('[ConversationActionsSheet] Failed to load profile:', error);
          if (active) setDirectProfile(null);
        })
        .finally(() => {
          if (active) setDirectLoading(false);
        });

      return () => {
        active = false;
      };
    }

    if (isGroup) {
      let active = true;
      setMembersLoading(true);
      Promise.all(participantIds.map((id: string) => UsersService.getProfileById(id)))
        .then((profiles) => {
          if (!active) return;
          const mapped = profiles
            .filter(Boolean)
            .sort((left: any, right: any) => {
              if (left?.userId === user?.$id) return -1;
              if (right?.userId === user?.$id) return 1;
              const leftAdmin = currentConversation?.admins?.includes(left?.userId);
              const rightAdmin = currentConversation?.admins?.includes(right?.userId);
              if (leftAdmin === rightAdmin) return 0;
              return leftAdmin ? -1 : 1;
            });
          setGroupMembers(mapped);
        })
        .catch((error) => {
          console.error('[ConversationActionsSheet] Failed to load members:', error);
          if (active) setGroupMembers([]);
        })
        .finally(() => {
          if (active) setMembersLoading(false);
        });

      return () => {
        active = false;
      };
    }
  }, [open, currentConversation, isDirect, isGroup, participantIds, user?.$id]);

  useEffect(() => {
    if (!open || !isGroup) return;
    if (memberTab !== 'add' || memberQuery.trim().length < 2) {
      setMemberResults([]);
      setMemberSearching(false);
      return;
    }

    let active = true;
    const timer = window.setTimeout(() => {
      setMemberSearching(true);
      UsersService.searchUsers(memberQuery, { requirePublicKey: true })
        .then((res) => {
          if (!active) return;
          const filtered = (res.rows || []).filter((item: any) => {
            const id = item.userId || item.$id;
            if (!id) return false;
            if (id === user?.$id) return false;
            if (participantIds.includes(id)) return false;
            return true;
          });
          setMemberResults(filtered);
        })
        .catch((error) => {
          console.error('[ConversationActionsSheet] Member search failed:', error);
          if (active) setMemberResults([]);
        })
        .finally(() => {
          if (active) setMemberSearching(false);
        });
    }, 300);

    return () => {
      active = false;
      clearTimeout(timer);
    };
  }, [open, isGroup, memberTab, memberQuery, participantIds, user?.$id]);

  useEffect(() => {
    void loadPendingRequests();
  }, [loadPendingRequests]);

  const handleOpenDirectChat = () => {
    if (!currentConversation) return;
    router.push(`/chat/${currentConversation.$id}`);
    onClose();
  };

  const handleCall = () => {
    if (!currentConversation) return;
    router.push(`/call/${currentConversation.$id}?caller=true&type=video`);
    onClose();
  };

  const handleOpenInfo = () => {
    const username = directProfile?.username;
    if (!username) return;
    router.push(`/u/${username}`);
    onClose();
  };

  const handleAddMember = async (target: any) => {
    if (!currentConversation?.$id) return;
    const targetId = target.userId || target.$id;
    if (!targetId) return;

    setMutating(true);
    try {
      await ChatService.addParticipant(currentConversation.$id, targetId);
      await refreshConversation();
      toast.success('Member added');
      setMemberQuery('');
      setMemberResults([]);
    } catch (error: any) {
      console.error('[ConversationActionsSheet] Failed to add member:', error);
      toast.error(formatActionError(error, 'Failed to add member'));
    } finally {
      setMutating(false);
    }
  };

  const handleRemoveMember = async (target: any) => {
    if (!currentConversation?.$id) return;
    const targetId = target.userId || target.$id;
    if (!targetId) return;

    setMutating(true);
    try {
      await ChatService.removeParticipant(currentConversation.$id, targetId);
      setGroupMembers((current) => current.filter((member: any) => (member.userId || member.$id) !== targetId));
      setCurrentConversation((current: any) => {
        if (!current) return current;
        const nextParticipants = Array.isArray(current.participants)
          ? current.participants.filter((id: string) => id !== targetId)
          : current.participants;
        return {
          ...current,
          participants: nextParticipants,
          participantCount: Array.isArray(nextParticipants) ? nextParticipants.length : current.participantCount,
          admins: Array.isArray(current.admins)
            ? current.admins.filter((id: string) => id !== targetId)
            : current.admins,
        };
      });
      await refreshConversation();
      toast.success('Member removed');
    } catch (error: any) {
      console.error('[ConversationActionsSheet] Failed to remove member:', error);
      toast.error(error?.message || 'Failed to remove member');
    } finally {
      setMutating(false);
    }
  };

  const handleToggleInviteLink = async () => {
    if (!currentConversation?.$id) return;

    setMutating(true);
    try {
      await ChatService.updateConversationInvite(currentConversation.$id, !inviteEnabled);
      await refreshConversation();
      toast.success(inviteEnabled ? 'Invite link disabled' : 'Invite link enabled');
    } catch (error: any) {
      console.error('[ConversationActionsSheet] Failed to update invite link:', error);
      toast.error(error?.message || 'Failed to update invite link');
    } finally {
      setMutating(false);
    }
  };

  const handleSaveGroupDetails = async () => {
    if (!currentConversation?.$id) return;
    const nextName = groupNameDraft.trim();
    const nextDescription = groupDescriptionDraft.trim();

    if (!nextName) {
      toast.error('Group name is required');
      return;
    }

    setDetailsSaving(true);
    try {
      await ChatService.updateConversation(currentConversation.$id, {
        name: nextName,
        description: nextDescription,
      });
      await refreshConversation();
      toast.success('Group details updated');
    } catch (error: any) {
      console.error('[ConversationActionsSheet] Failed to update group details:', error);
      toast.error(error?.message || 'Failed to update group details');
    } finally {
      setDetailsSaving(false);
    }
  };

  const handleUploadGroupAvatar = async (file: File | null) => {
    if (!currentConversation?.$id || !file) return;

    setAvatarUploading(true);
    try {
      await ChatService.updateConversationAvatar(currentConversation.$id, file);
      await refreshConversation();
      toast.success('Group avatar updated');
    } catch (error: any) {
      console.error('[ConversationActionsSheet] Failed to update group avatar:', error);
      toast.error(error?.message || 'Failed to update group avatar');
    } finally {
      setAvatarUploading(false);
    }
  };

  const handleCopyInviteLink = async () => {
    if (!inviteEnabled || !inviteLink) return;
    try {
      await navigator.clipboard.writeText(inviteLink);
      toast.success('Invite link copied');
    } catch (error) {
      console.error('[ConversationActionsSheet] Failed to copy invite link:', error);
      toast.error('Failed to copy invite link');
    }
  };

  const handleResolveRequest = async (request: any, action: 'accept' | 'reject') => {
    if (!currentConversation?.$id || !request?.requesterId) return;

    setMutating(true);
    try {
      await ChatService.resolveJoinRequest('chat.conversation', currentConversation.$id, request.requesterId, action);
      await refreshConversation();
      await loadPendingRequests();
      toast.success(action === 'accept' ? 'Request accepted' : 'Request rejected');
    } catch (error: any) {
      console.error('[ConversationActionsSheet] Failed to resolve join request:', error);
      toast.error(formatActionError(error, 'Failed to update request'));
    } finally {
      setMutating(false);
    }
  };

  const handleDeleteGroup = async () => {
    if (!currentConversation?.$id) return;

    setMutating(true);
    try {
      await ChatService.deleteConversationFully(currentConversation.$id);
      onConversationDeleted?.(currentConversation.$id);
      toast.success('Group deleted');
      setDeleteConfirmOpen(false);
      onClose();
    } catch (error: any) {
      console.error('[ConversationActionsSheet] Failed to delete group:', error);
      toast.error(error?.message || 'Failed to delete group');
    } finally {
      setMutating(false);
    }
  };

  if (!open || !currentConversation) return null;

  if (isDirect) {
    return (
      <>
        <Dialog
          open={open}
          onClose={onClose}
          fullScreen={isMobile}
          fullWidth
          maxWidth="xs"
          PaperProps={{
            sx: {
              bgcolor: '#000000',
              backgroundImage: 'none',
              borderRadius: isMobile ? 0 : '24px',
              border: '1px solid rgba(255,255,255,0.08)',
            },
          }}
        >
          <DialogTitle sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', pb: 1 }}>
            <Typography sx={{ fontWeight: 900, fontFamily: 'var(--font-clash)' }}>Profile Preview</Typography>
            <IconButton onClick={onClose} sx={{ color: 'text.secondary' }}>
              <X size={18} />
            </IconButton>
          </DialogTitle>
          <DialogContent sx={{ pt: 1 }}>
            <Stack spacing={2} alignItems="center" textAlign="center">
              {directLoading ? (
                <Box sx={{ minHeight: 96, display: 'grid', placeItems: 'center' }}>
                  <Typography variant="body2" sx={{ opacity: 0.6 }}>Loading profile...</Typography>
                </Box>
              ) : (
                <>
                  <ConversationAvatar user={directProfile || { username: currentConversation.name, displayName: currentConversation.name }} />
                  <Box>
                    <Typography sx={{ fontWeight: 900, fontSize: '1.1rem' }}>
                      {directProfile?.displayName || directProfile?.username || currentConversation.name || 'Unknown'}
                    </Typography>
                    <Typography variant="body2" sx={{ opacity: 0.65 }}>
                      @{directProfile?.username || currentConversation.otherUserId?.slice(0, 8) || 'unknown'}
                    </Typography>
                  </Box>
                  <Stack direction="row" spacing={1} sx={{ width: '100%' }}>
                    <Button fullWidth variant="contained" startIcon={<MessageCircle size={18} />} onClick={handleOpenDirectChat}>
                      Message
                    </Button>
                    <Button fullWidth variant="outlined" startIcon={<Phone size={18} />} onClick={handleCall} disabled={currentConversation.isSelf}>
                      Call
                    </Button>
                  </Stack>
                  <Button
                    fullWidth
                    variant="text"
                    startIcon={<Shield size={18} />}
                    onClick={handleOpenInfo}
                    disabled={!directProfile?.username}
                    sx={{ color: '#F59E0B' }}
                  >
                    Info
                  </Button>
                </>
              )}
            </Stack>
          </DialogContent>
        </Dialog>
      </>
    );
  }

  return (
    <>
      <Drawer
        anchor="bottom"
        open={open}
        onClose={onClose}
        ModalProps={{
          keepMounted: true,
        }}
        PaperProps={{
          sx: {
            top: '88px',
            bottom: 0,
            height: 'calc(100dvh - 88px)',
            maxHeight: 'calc(100dvh - 88px)',
            borderRadius: '24px 24px 0 0',
            bgcolor: '#000000',
            backgroundImage: 'none',
            border: '1px solid rgba(255,255,255,0.08)',
            overflow: 'hidden',
            zIndex: 1305,
          },
        }}
      >
          <Box sx={{ display: 'flex', flexDirection: 'column', height: '100%', pt: { xs: 'env(safe-area-inset-top)', md: 0 } }}>
          <Box sx={{ px: 2.5, pt: 2.5, pb: 1.5, display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <Stack direction="row" spacing={1.5} alignItems="center">
              <Avatar
                src={groupAvatarSrc}
                sx={{
                  width: 56,
                  height: 56,
                  bgcolor: alpha('#6366F1', 0.12),
                  color: '#6366F1',
                  border: '1px solid rgba(255,255,255,0.08)',
                }}
              >
                {!groupAvatarSrc && <Users size={24} />}
              </Avatar>
              <Box>
                <Typography sx={{ fontWeight: 900, fontFamily: 'var(--font-clash)' }}>
                  {currentConversation.name || 'Group'}
                </Typography>
                <Typography variant="body2" sx={{ opacity: 0.6 }}>
                  {participantIds.length} members
                </Typography>
                {currentConversation.description ? (
                  <Typography
                    variant="body2"
                    sx={{
                      mt: 0.5,
                      opacity: 0.72,
                      lineHeight: 1.4,
                      display: '-webkit-box',
                      WebkitBoxOrient: 'vertical',
                      WebkitLineClamp: 2,
                      overflow: 'hidden',
                    }}
                  >
                    {currentConversation.description}
                  </Typography>
                ) : null}
              </Box>
            </Stack>
            <IconButton onClick={onClose} sx={{ color: 'text.secondary' }}>
              <X size={18} />
            </IconButton>
          </Box>

          <Divider sx={{ borderColor: 'rgba(255,255,255,0.06)' }} />

          <Box sx={{ px: 2.5, pt: 1.5, position: 'sticky', top: 0, zIndex: 2, bgcolor: '#000000' }}>
            <Tabs
              value={isAdmin ? memberTab : 'members'}
              onChange={(_, value) => setMemberTab(value as 'invite' | 'members' | 'add' | 'remove')}
              textColor="inherit"
              indicatorColor="secondary"
              variant="fullWidth"
              sx={{
                minHeight: 42,
                '& .MuiTab-root': {
                  minHeight: 42,
                  textTransform: 'none',
                  fontWeight: 800,
                  minWidth: 0,
                  px: isMobile ? 0.5 : 2,
                  gap: 0.75,
                },
              }}
            >
              {isAdmin && (
                <Tab
                  value="invite"
                  icon={<LinkIcon size={18} />}
                  label={isMobile ? '' : 'Invite'}
                  aria-label="Invite"
                />
              )}
              <Tab
                value="members"
                icon={<Users size={18} />}
                label={isMobile ? '' : 'Members'}
                aria-label="Members"
              />
              {isAdmin && (
                <Tab
                  value="add"
                  icon={<UserPlus size={18} />}
                  label={isMobile ? '' : 'Add Members'}
                  aria-label="Add Members"
                />
              )}
              {isAdmin && (
                <Tab
                  value="remove"
                  icon={<UserMinus size={18} />}
                  label={isMobile ? '' : 'Remove Members'}
                  aria-label="Remove Members"
                />
              )}
            </Tabs>
          </Box>

          <DialogContent sx={{ flex: 1, px: 2.5, py: 2, overflowY: 'auto', minHeight: 0 }}>
            {isAdmin ? null : (
              <Paper sx={{ p: 1.5, mb: 2, bgcolor: 'rgba(255,255,255,0.02)', border: '1px solid rgba(255,255,255,0.05)' }}>
                <Typography variant="body2" sx={{ opacity: 0.75 }}>
                  You can view this group, but only admins can manage members.
                </Typography>
              </Paper>
            )}

            {isAdmin && memberTab === 'invite' && (
              <Stack spacing={1.5} sx={{ mb: 2 }}>
                <Paper
                  sx={{
                    p: 1.5,
                    borderRadius: '18px',
                    bgcolor: 'rgba(255,255,255,0.02)',
                    border: '1px solid rgba(255,255,255,0.05)',
                  }}
                >
                  <Stack spacing={1.25}>
                    <Stack direction="row" alignItems="center" justifyContent="space-between" spacing={1}>
                      <Box>
                        <Typography sx={{ fontWeight: 800 }}>Invite link</Typography>
                        <Typography variant="body2" sx={{ opacity: 0.65 }}>
                          {inviteEnabled ? 'Anyone with the link can request access.' : 'Invite link is disabled.'}
                        </Typography>
                      </Box>
                      <Button
                        variant={inviteEnabled ? 'outlined' : 'contained'}
                        size="small"
                        onClick={() => void handleToggleInviteLink()}
                        disabled={mutating}
                      >
                        {inviteEnabled ? 'Disable' : 'Enable'}
                      </Button>
                    </Stack>

                    <TextField
                      fullWidth
                      size="small"
                      value={inviteEnabled ? inviteLink : 'Disabled'}
                      InputProps={{
                        readOnly: true,
                      }}
                    />

                    <Button
                      variant="outlined"
                      size="small"
                      onClick={() => void handleCopyInviteLink()}
                      disabled={!inviteEnabled}
                    >
                      Copy link
                    </Button>
                  </Stack>
                </Paper>

                {isGroup && (
                  <Paper
                    sx={{
                      p: 1.5,
                      borderRadius: '18px',
                      bgcolor: 'rgba(255,255,255,0.02)',
                      border: '1px solid rgba(255,255,255,0.05)',
                    }}
                  >
                    <Stack spacing={1.5}>
                      <Typography sx={{ fontWeight: 800 }}>Group details</Typography>
                      <Stack direction="row" spacing={1.5} alignItems="center">
                        <Avatar
                          src={groupAvatarSrc}
                          sx={{
                            width: 56,
                            height: 56,
                            bgcolor: alpha('#6366F1', 0.12),
                            color: '#6366F1',
                            border: '1px solid rgba(255,255,255,0.08)',
                          }}
                        >
                          {!groupAvatarSrc && <Users size={22} />}
                        </Avatar>
                        <Button component="label" variant="outlined" size="small" disabled={avatarUploading}>
                          {avatarUploading ? 'Uploading...' : 'Upload avatar'}
                          <input
                            hidden
                            type="file"
                            accept="image/png,image/jpeg,image/webp,image/gif"
                            onChange={(e) => {
                              const file = e.target.files?.[0] || null;
                              void handleUploadGroupAvatar(file);
                              e.target.value = '';
                            }}
                          />
                        </Button>
                      </Stack>
                      <TextField
                        fullWidth
                        size="small"
                        label="Group name"
                        value={groupNameDraft}
                        onChange={(e) => setGroupNameDraft(e.target.value)}
                      />
                      <TextField
                        fullWidth
                        multiline
                        minRows={3}
                        label="Description"
                        value={groupDescriptionDraft}
                        onChange={(e) => setGroupDescriptionDraft(e.target.value)}
                      />
                    <Button
                      variant="contained"
                      onClick={() => void handleSaveGroupDetails()}
                      disabled={detailsSaving || !isDetailsDirty}
                      sx={{
                        opacity: detailsSaving || !isDetailsDirty ? 0.45 : 1,
                        filter: detailsSaving || !isDetailsDirty ? 'blur(0.5px)' : 'none',
                      }}
                    >
                      Save details
                    </Button>
                    </Stack>
                  </Paper>
                )}
              </Stack>
            )}

            {memberTab === 'members' && (
              <Stack spacing={1}>
                {isAdmin && (
                  <Paper
                    sx={{
                      p: 1.5,
                      mb: 1,
                      bgcolor: 'rgba(245,158,11,0.06)',
                      border: '1px solid rgba(245,158,11,0.18)',
                      borderRadius: '18px',
                    }}
                  >
                    <Stack direction="row" alignItems="center" justifyContent="space-between" sx={{ mb: 1 }}>
                      <Box>
                        <Typography sx={{ fontWeight: 800 }}>Pending requests</Typography>
                        <Typography variant="body2" sx={{ opacity: 0.7 }}>
                          {pendingJoinRequests.length} awaiting review
                        </Typography>
                      </Box>
                      <Chip size="small" label={pendingJoinRequests.length} sx={{ bgcolor: 'rgba(245,158,11,0.14)' }} />
                    </Stack>

                    {pendingRequestsLoading ? (
                      <Typography variant="body2" sx={{ opacity: 0.6 }}>
                        Loading requests...
                      </Typography>
                    ) : pendingJoinRequests.length === 0 ? (
                      <Typography variant="body2" sx={{ opacity: 0.6 }}>
                        No pending requests.
                      </Typography>
                    ) : (
                      <Stack spacing={1}>
                        {pendingJoinRequests.map((request: any) => {
                          const requesterId = request.requesterId;
                          const requester =
                            requesterProfiles[requesterId] ||
                            getCachedIdentityById(requesterId) ||
                            { userId: requesterId, username: requesterId?.slice(0, 8), displayName: requesterId?.slice(0, 8) };

                          return (
                            <Paper
                              key={request.$id || requesterId}
                              sx={{
                                p: 1.25,
                                bgcolor: 'rgba(255,255,255,0.02)',
                                border: '1px solid rgba(255,255,255,0.05)',
                                borderRadius: '16px',
                              }}
                            >
                              <Stack direction="row" alignItems="center" spacing={1.5}>
                                <MemberAvatar user={requester} />
                                <Box sx={{ flex: 1, minWidth: 0 }}>
                                  <Typography sx={{ fontWeight: 800 }} noWrap>
                                    {requester.displayName || requester.username || 'Unknown'}
                                  </Typography>
                                  <Typography variant="body2" sx={{ opacity: 0.6 }} noWrap>
                                    @{requester.username || requesterId?.slice(0, 8)}
                                  </Typography>
                                </Box>
                                <Stack direction="row" spacing={1}>
                                  <Button
                                    size="small"
                                    variant="outlined"
                                    onClick={() => void handleResolveRequest(request, 'reject')}
                                    disabled={mutating}
                                  >
                                    Reject
                                  </Button>
                                  <Button
                                    size="small"
                                    variant="contained"
                                    onClick={() => void handleResolveRequest(request, 'accept')}
                                    disabled={mutating}
                                  >
                                    Accept
                                  </Button>
                                </Stack>
                              </Stack>
                            </Paper>
                          );
                        })}
                      </Stack>
                    )}
                  </Paper>
                )}

                {membersLoading ? (
                  <Typography variant="body2" sx={{ opacity: 0.6 }}>Loading members...</Typography>
                ) : (
                  groupMembers.map((member: any) => {
                    const id = member.userId || member.$id;
                    const isCurrentUser = id === user?.$id;
                    const isCreator = id === currentConversation.creatorId;
                    const isGroupAdmin = currentConversation.admins?.includes(id);
                    return (
                      <Paper
                        key={id}
                        sx={{
                          p: 1.25,
                          bgcolor: 'rgba(255,255,255,0.02)',
                          border: '1px solid rgba(255,255,255,0.05)',
                          borderRadius: '18px',
                        }}
                      >
                        <Stack direction="row" alignItems="center" spacing={1.5}>
                          <ListItemAvatar sx={{ minWidth: 0 }}>
                            <MemberAvatar user={member} />
                          </ListItemAvatar>
                          <Box sx={{ flex: 1, minWidth: 0 }}>
                            <Typography sx={{ fontWeight: 800 }} noWrap>
                              {member.displayName || member.username || 'Unknown'}
                            </Typography>
                            <Typography variant="body2" sx={{ opacity: 0.6 }} noWrap>
                              @{member.username || id.slice(0, 8)}
                            </Typography>
                          </Box>
                          <Stack direction="row" spacing={0.5}>
                            {isCurrentUser && <Chip size="small" label="You" sx={{ bgcolor: 'rgba(99,102,241,0.12)' }} />}
                            {isCreator && <Chip size="small" label="Creator" sx={{ bgcolor: 'rgba(245,158,11,0.12)' }} />}
                            {isGroupAdmin && <Chip size="small" label="Admin" sx={{ bgcolor: 'rgba(16,185,129,0.12)' }} />}
                          </Stack>
                        </Stack>
                      </Paper>
                    );
                  })
                )}
              </Stack>
            )}

            {memberTab === 'add' && isAdmin && (
              <Stack spacing={1.5}>
                <TextField
                  fullWidth
                  value={memberQuery}
                  onChange={(e) => setMemberQuery(e.target.value)}
                  placeholder="Search people to add..."
                  InputProps={{
                    startAdornment: (
                      <InputAdornment position="start">
                        <Search size={16} style={{ opacity: 0.5 }} />
                      </InputAdornment>
                    ),
                  }}
                />

                {memberSearching && (
                  <Typography variant="body2" sx={{ opacity: 0.6 }}>Searching...</Typography>
                )}

                {memberResults.map((result: any) => {
                  const id = result.userId || result.$id;
                  return (
                    <Paper key={id} sx={{ p: 1.25, bgcolor: 'rgba(255,255,255,0.02)', border: '1px solid rgba(255,255,255,0.05)' }}>
                      <Stack direction="row" alignItems="center" spacing={1.5}>
                        <MemberAvatar user={result} />
                        <Box sx={{ flex: 1, minWidth: 0 }}>
                          <Typography sx={{ fontWeight: 800 }} noWrap>
                            {result.displayName || result.username}
                          </Typography>
                          <Typography variant="body2" sx={{ opacity: 0.6 }} noWrap>
                            @{result.username}
                          </Typography>
                        </Box>
                        <Button
                          variant="contained"
                          size="small"
                          startIcon={<UserPlus size={16} />}
                          onClick={() => void handleAddMember(result)}
                          disabled={mutating}
                        >
                          Add
                        </Button>
                      </Stack>
                    </Paper>
                  );
                })}

                {memberQuery.trim().length >= 2 && !memberSearching && memberResults.length === 0 && (
                  <Typography variant="body2" sx={{ opacity: 0.6, textAlign: 'center', py: 2 }}>
                    No users found
                  </Typography>
                )}
              </Stack>
            )}

            {memberTab === 'remove' && isAdmin && (
              <Stack spacing={1.5}>
                {groupMembers
                  .filter((member: any) => (member.userId || member.$id) !== user?.$id)
                  .map((member: any) => {
                    const id = member.userId || member.$id;
                    const isCreator = id === currentConversation.creatorId;
                    return (
                      <Paper key={id} sx={{ p: 1.25, bgcolor: 'rgba(255,255,255,0.02)', border: '1px solid rgba(255,255,255,0.05)' }}>
                        <Stack direction="row" alignItems="center" spacing={1.5}>
                          <MemberAvatar user={member} />
                          <Box sx={{ flex: 1, minWidth: 0 }}>
                            <Typography sx={{ fontWeight: 800 }} noWrap>
                              {member.displayName || member.username}
                            </Typography>
                            <Typography variant="body2" sx={{ opacity: 0.6 }} noWrap>
                              @{member.username}
                            </Typography>
                          </Box>
                          <Button
                            variant="outlined"
                            color="error"
                            size="small"
                            startIcon={<UserMinus size={16} />}
                            onClick={() => void handleRemoveMember(member)}
                            disabled={mutating || isCreator}
                          >
                            Remove
                          </Button>
                        </Stack>
                      </Paper>
                    );
                  })}
              </Stack>
            )}
          </DialogContent>

          {isAdmin && (
            <Box sx={{ p: 2.5, pt: 0, borderTop: '1px solid rgba(255,255,255,0.06)' }}>
              <Button
                fullWidth
                color="error"
                variant="contained"
                startIcon={<Trash2 size={16} />}
                onClick={() => setDeleteConfirmOpen(true)}
                disabled={mutating}
              >
                Delete Group
              </Button>
            </Box>
          )}
        </Box>
      </Drawer>

      <Dialog
        open={deleteConfirmOpen}
        onClose={() => setDeleteConfirmOpen(false)}
        fullScreen={isMobile}
        PaperProps={{
          sx: {
            bgcolor: '#000000',
            backgroundImage: 'none',
            border: '1px solid rgba(255,255,255,0.08)',
            borderRadius: isMobile ? 0 : '20px',
          },
        }}
      >
        <DialogTitle sx={{ fontWeight: 900 }}>Delete group?</DialogTitle>
        <DialogContent>
          <Typography variant="body2" sx={{ opacity: 0.7 }}>
            This will permanently delete the group, its messages, membership rows, and conversation record.
          </Typography>
        </DialogContent>
        <DialogActions sx={{ p: 2 }}>
          <Button onClick={() => setDeleteConfirmOpen(false)} sx={{ color: 'text.secondary' }}>
            Cancel
          </Button>
          <Button color="error" variant="contained" onClick={() => void handleDeleteGroup()} disabled={mutating}>
            Delete Forever
          </Button>
        </DialogActions>
      </Dialog>
    </>
  );
}
