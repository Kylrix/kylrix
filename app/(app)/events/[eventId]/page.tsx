'use client';

import React, { useEffect, useState } from 'react';
import { useParams } from 'next/navigation';
import {
  Box,
  Typography,
  Button,
  Avatar,
  AvatarGroup,
  Paper,
  Container,
  
  useTheme,
  alpha,
  TextField,
  CircularProgress,
  Stack,
  IconButton,
  Chip,
} from '@/lib/openbricks/primitives';
import {
  ContentCopy as ContentCopyIcon,
} from '@/lib/openbricks/icons';
import { useAuth } from '@/context/auth/AuthContext';
import { useUnifiedDrawer } from '@/context/UnifiedDrawerContext';
import { getResourceCollaboratorsSecure } from '@/lib/actions/secure-ops';
import { account } from '@/lib/appwrite/client';
import { useCallback } from 'react';
import { events as eventApi, eventGuests as guestApi } from '@/lib/kylrixflow';
import { Event } from '@/types/kylrixflow';
import { formatTime } from '@/lib/time-util';
import { Query } from 'appwrite';
import { createGhostNoteForResource, promoteGhostResourceThreadToStory } from '@/lib/actions/client-ops';
import { createComment, listComments, getNote } from '@/lib/appwrite/note';
import { client } from '@/lib/appwrite/client';
import { APPWRITE_CONFIG } from '@/lib/appwrite/config';
import { useToast } from '@/components/ui/Toast';
import { AppwriteService } from '@/lib/appwrite';
import { MessageSquare, Clock, FileText, Globe, Send } from 'lucide-react';
import { generateEventPattern } from '@/utils/patternGenerator';
import { fetchProfilePreview } from '@/lib/profile-preview';
import { IdentityAvatar, computeIdentityFlags } from '@/components/common/IdentityBadge';
import { MultiSectionContainer } from '@/context/SectionContext';

function AttendeeAvatar({ guest, theme }: { guest: any, theme: any }) {
  const [url, setUrl] = useState<string | null>(null);
  const [identity, setIdentity] = useState<{ verified: boolean; pro: boolean }>({ verified: false, pro: false });
  const searchKey = guest.username || guest.displayName || guest.email || guest.userId;

  useEffect(() => {
    let mounted = true;
    const load = async () => {
      try {
        const { searchGlobalUsers } = await import('@/lib/ecosystem/identity');
        const users = searchKey ? await searchGlobalUsers(searchKey, 1) : [];
        if (users.length > 0) {
          const user = users[0] as any;
          setIdentity(computeIdentityFlags({
            createdAt: user.$createdAt || user.createdAt || null,
            lastUsernameEdit: user.last_username_edit || null,
            profilePicId: user.profilePicId || user.avatar || null,
            username: user.username || null,
            bio: user.bio || null,
            tier: user.tier || null,
            publicKey: user.publicKey || null,
          }));
        }
        const fileId = users[0]?.profilePicId || users[0]?.avatar || guest.profilePicId || guest.avatar || null;
        if (users.length > 0 && fileId) {
          const preview = await fetchProfilePreview(fileId, 64, 64);
          if (mounted) setUrl(preview);
        }
      } catch { }
    };
    load();
    return () => { mounted = false; };
  }, [searchKey, guest.profilePicId, guest.avatar]);

  return (
    <IdentityAvatar
      src={url || undefined}
      alt={guest.email}
      fallback={guest.email?.charAt(0).toUpperCase() || 'U'}
      verified={identity.verified}
      pro={identity.pro}
      size={40}
    />
  );
}

export default function EventPage() {
  const { eventId } = useParams<{ eventId: string }>();
  const theme = useTheme();
  const { user, isAuthenticated, openIDMWindow } = useAuth();

  const [rawEvent, setRawEvent] = useState<Event | null>(null);
  const [loading, setLoading] = useState(true);

  const event = rawEvent || (loading ? {
    $id: eventId as string,
    title: 'Loading Event...',
    startTime: new Date().toISOString(),
    endTime: new Date(Date.now() + 3600000).toISOString(),
    location: 'Loading address...',
    description: 'Fetching event details...',
    coverImageId: '',
    $createdAt: new Date().toISOString(),
    $updatedAt: new Date().toISOString(),
  } as any : null);
  const [error, setError] = useState<string | null>(null);
  const [isRegistered, setIsRegistered] = useState(false);
  const [guestId, setGuestId] = useState<string | null>(null);
  const [registering, setRegistering] = useState(false);
  const [attendees, setAttendees] = useState<any[]>([]);

  const { open: openUnified } = useUnifiedDrawer();
  const [organizers, setOrganizers] = useState<any[]>([]);
  const [loadingOrganizers, setLoadingOrganizers] = useState(false);

  const fetchOrganizers = useCallback(async () => {
    if (!eventId) return;
    setLoadingOrganizers(true);
    try {
        const { jwt } = await account.createJWT();
        const { collaborators } = await getResourceCollaboratorsSecure({
            resourceId: eventId as string,
            resourceType: 'event',
            jwt
        });
        setOrganizers(collaborators || []);
    } catch (orgErr) {
        console.error('Failed to fetch event organizers:', orgErr);
    } finally {
        setLoadingOrganizers(false);
    }
  }, [eventId]);

  useEffect(() => {
    fetchOrganizers();
  }, [fetchOrganizers]);

  // Huddle Discussion State & Effects
  const { showSuccess, showError } = useToast();
  const [huddleMessages, setHuddleMessages] = useState<any[]>([]);
  const [huddleLoading, setHuddleLoading] = useState(false);
  const [huddleSending, setHuddleSending] = useState(false);
  const [isHuddleInit, setIsHuddleInit] = useState(false);
  const [huddleTimeRemaining, setHuddleTimeRemaining] = useState('');
  const [inputText, setInputText] = useState('');
  const huddleMessageEndRef = React.useRef<HTMLDivElement>(null);

  // Check if Huddle is initialized
  useEffect(() => {
    if (!eventId) return;
    let active = true;

    const checkHuddle = async () => {
      try {
        const note = await getNote(eventId);
        if (!active) return;
        if (note && note.metadata) {
          setIsHuddleInit(true);
          const noteMeta = JSON.parse(note.metadata);
          const expiresAt = new Date(noteMeta.expiresAt).getTime();
          const updateTimer = () => {
            const diff = expiresAt - Date.now();
            if (diff <= 0) {
              setHuddleTimeRemaining('Expired');
            } else {
              const days = Math.floor(diff / (24 * 60 * 60 * 1000));
              const hours = Math.floor((diff % (24 * 60 * 60 * 1000)) / (60 * 60 * 1000));
              setHuddleTimeRemaining(`${days}d ${hours}h remaining`);
            }
          };
          updateTimer();
        }
      } catch (err) {
        if (active) setIsHuddleInit(false);
      }
    };

    checkHuddle();
    return () => { active = false; };
  }, [eventId]);

  // Load comments and subscribe
  useEffect(() => {
    if (!eventId || !isHuddleInit) return;
    let active = true;
    setHuddleLoading(true);

    const loadHuddleComments = async () => {
      try {
        const res = await listComments(eventId);
        if (!active) return;
        const msgs = await Promise.all(
          res.rows.map(async (doc: any) => {
            let senderName = 'Attendee';
            if (user && doc.userId === user.$id) {
              senderName = user.name || 'You';
            } else {
              try {
                const profile = await AppwriteService.getProfile(doc.userId);
                if (profile) senderName = profile.name || 'Attendee';
              } catch {}
            }
            return {
              id: doc.$id,
              senderId: doc.userId,
              senderName,
              content: doc.content,
              timestamp: new Date(doc.createdAt).getTime(),
            };
          })
        );
        msgs.sort((a: any, b: any) => a.timestamp - b.timestamp);
        setHuddleMessages(msgs);
      } catch (err) {
        console.error('Failed to load huddle comments:', err);
      } finally {
        if (active) setHuddleLoading(false);
      }
    };

    loadHuddleComments();

    const unsubscribe = client.subscribe(
      `databases.${APPWRITE_CONFIG.DATABASES.NOTE}.tables.comments.rows`,
      async (response: any) => {
        if (!active) return;
        const events = response.events;
        const payload = response.payload;

        if (events.some((e: string) => e.includes('.create')) && payload.noteId === eventId) {
          let senderName = 'Attendee';
          if (user && payload.userId === user.$id) {
            senderName = user.name || 'You';
          } else {
            try {
              const profile = await AppwriteService.getProfile(payload.userId);
              if (profile) senderName = profile.name || 'Attendee';
            } catch {}
          }
          const msg = {
            id: payload.$id,
            senderId: payload.userId,
            senderName,
            content: payload.content,
            timestamp: new Date(payload.createdAt).getTime(),
          };
          setHuddleMessages(prev => {
            if (prev.some(m => m.id === msg.id)) return prev;
            return [...prev, msg].sort((a, b) => a.timestamp - b.timestamp);
          });
        }
      }
    );

    return () => {
      active = false;
      unsubscribe();
    };
  }, [eventId, isHuddleInit, user]);

  useEffect(() => {
    huddleMessageEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [huddleMessages]);

  const handleInitHuddle = async () => {
    if (!event) return;
    setHuddleLoading(true);
    try {
      await createGhostNoteForResource(eventId, 'event', `${event.title} Discussion`);
      setIsHuddleInit(true);
      showSuccess('Event discussion huddle initialized!');
    } catch (err) {
      console.error('Failed to init huddle:', err);
      showError('Failed to initialize huddle.');
    } finally {
      setHuddleLoading(false);
    }
  };

  const handleSendHuddleMessage = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!inputText.trim() || huddleSending) return;
    if (!isAuthenticated) { openIDMWindow(); return; }
    setHuddleSending(true);
    try {
      await createComment(eventId, inputText.trim());
      setInputText('');
    } catch (err) {
      console.error('Failed to send comment:', err);
      showError('Failed to send message.');
    } finally {
      setHuddleSending(false);
    }
  };

  const handleSaveHuddleAsStory = async () => {
    setHuddleLoading(true);
    try {
      await promoteGhostResourceThreadToStory(eventId, 'event');
      showSuccess('Discussion promoted to permanent Story note!');
      setIsHuddleInit(false);
      setHuddleMessages([]);
    } catch (err) {
      console.error('Failed to save story:', err);
      showError('Failed to promote discussion.');
    } finally {
      setHuddleLoading(false);
    }
  };

  // Fetch event details
  useEffect(() => {
    const fetchEvent = async () => {
      try {
        setLoading(true);
        const eventData = await eventApi.get(eventId);
        if (eventData.visibility === 'private' && (!user || eventData.userId !== user.$id)) {
          setError('This event is private.');
          return;
        }
        setRawEvent(eventData);
      } catch (err: any) {
        if (err?.code === 401 || err?.code === 404) {
          setError('This event is private or does not exist.');
        } else {
          setError('Event not found or failed to load.');
        }
      } finally {
        setLoading(false);
      }
    };
    if (eventId) fetchEvent();
  }, [eventId, user]);

  // Check registration status
  useEffect(() => {
    const checkRegistration = async () => {
      if (!user || !eventId) return;
      try {
        const guests = await guestApi.list([
          Query.equal('eventId', eventId),
          Query.equal('userId', user.$id)]);
        if (guests.total > 0) {
          setIsRegistered(true);
          setGuestId(guests.rows[0].$id);
        } else {
          setIsRegistered(false);
          setGuestId(null);
        }
      } catch { }
    };
    checkRegistration();
  }, [user, eventId]);

  // Fetch all attendees
  useEffect(() => {
    const fetchAttendees = async () => {
      if (!eventId) return;
      try {
        const guests = await guestApi.list([Query.equal('eventId', eventId)]);
        setAttendees(guests.rows);
      } catch { }
    };
    fetchAttendees();
  }, [eventId, isRegistered]);

  const handleRegister = async () => {
    if (!isAuthenticated) { openIDMWindow(); return; }
    if (!user || !event) return;
    try {
      setRegistering(true);
      const newGuest = await guestApi.create({
        eventId: event.$id,
        userId: user.$id,
        email: user.email,
        status: 'accepted',
        role: 'attendee',
      });
      setIsRegistered(true);
      setGuestId(newGuest.$id);
    } catch { } finally { setRegistering(false); }
  };

  const handleCancelRegistration = async () => {
    if (!guestId) return;
    try {
      setRegistering(true);
      await guestApi.delete(guestId);
      setIsRegistered(false);
      setGuestId(null);
    } catch { } finally { setRegistering(false); }
  };

  const handleCopyLink = () => {
    navigator.clipboard.writeText(window.location.href);
  };

  if (!loading && (error || !event)) {
    return (
      <Box sx={{ minHeight: '100vh', bgcolor: '#000000', display: 'grid', placeItems: 'center', p: 4 }}>
        <Typography variant="h4" sx={{ color: 'white', fontFamily: 'var(--font-clash)', fontWeight: 900 }}>{error || "Event not found"}</Typography>
      </Box>
    );
  }

  const startDate = new Date(event.startTime);
  const endDate = new Date(event.endTime);
  const coverStyle = event.coverImageId
    ? { backgroundImage: `url(${event.coverImageId})` }
    : { background: generateEventPattern(event.$id + event.title) };

  return (
    <Box sx={{ minHeight: '100vh', pb: 8, bgcolor: '#000000', p: { xs: 2, md: 4 } }}>
      <MultiSectionContainer panels={['note', 'huddles', 'goals']} contextId={eventId}>
      <Container maxWidth="md" sx={{ px: { xs: 0, sm: 2 } }}>
        <Paper sx={{ overflow: 'hidden', borderRadius: { xs: 0, sm: '28px' }, mb: 4, bgcolor: '#161412', border: '1px solid #34322F', backgroundImage: 'none' }}>
          {loading ? (
            <></>
          ) : (
            <Box sx={{ height: { xs: 250, md: 350 }, position: 'relative', backgroundSize: 'cover', ...coverStyle }}>
              <Box sx={{ position: 'absolute', top: 16, right: 16 }}>
                <Button 
                  variant="contained" 
                  onClick={handleCopyLink}
                  sx={{
                    bgcolor: '#000000',
                    color: 'white',
                    border: '1px solid #34322F',
                    minWidth: 'auto',
                    p: 1.25,
                    borderRadius: '12px',
                    '&:hover': { bgcolor: '#1C1A18' }
                  }}
                >
                  <ContentCopyIcon fontSize="small" />
                </Button>
              </Box>
            </Box>
          )}

          <Box sx={{ p: { xs: 3, md: 5 } }}>
            {loading ? (
              <></>
            ) : (
              <Typography variant="h3" fontWeight={900} gutterBottom sx={{ fontFamily: 'var(--font-clash)', letterSpacing: '-0.02em', color: 'white', fontSize: { xs: '2rem', md: '3rem' } }}>{event.title}</Typography>
            )}

            {loading ? (
              <></>
            ) : (
              <Paper sx={{ p: 3, mb: 4, display: 'flex', justifyContent: 'space-between', alignItems: 'center', bgcolor: '#1C1A18', border: '1px solid #34322F', borderRadius: '16px', backgroundImage: 'none' }}>
                <Box>
                  <Typography variant="subtitle1" fontWeight={700} sx={{ color: 'white', fontFamily: 'var(--font-satoshi)' }}>{formatTime(startDate, { weekday: 'long', month: 'long', day: 'numeric', year: 'numeric' })}</Typography>
                  <Typography variant="body2" sx={{ color: '#8E8A86', fontFamily: 'var(--font-satoshi)', fontWeight: 600 }}>{formatTime(startDate, { hour: 'numeric', minute: '2-digit', hour12: true })} - {formatTime(endDate, { hour: 'numeric', minute: '2-digit', hour12: true })}</Typography>
                </Box>
                <Button 
                  variant="contained" 
                  onClick={isRegistered ? handleCancelRegistration : handleRegister} 
                  disabled={registering}
                  sx={{
                    bgcolor: '#6366F1',
                    color: 'white',
                    fontWeight: 800,
                    borderRadius: '12px',
                    px: 3,
                    py: 1.25,
                    fontFamily: 'var(--font-satoshi)',
                    textTransform: 'none',
                    '&:hover': { bgcolor: '#4F46E5' }
                  }}
                >
                  {registering ? '...' : isRegistered ? 'Cancel' : 'Register'}
                </Button>
              </Paper>
            )}

            {loading ? (
              <Box sx={{ mb: 4 }}>
                <></>
                <></>
                <></>
              </Box>
            ) : (
              <Box sx={{ mb: 4 }}>
                <Typography variant="h6" fontWeight={700} gutterBottom sx={{ color: '#8E8A86', fontFamily: 'var(--font-satoshi)', textTransform: 'uppercase', letterSpacing: '0.05em', fontSize: '0.85rem' }}>About</Typography>
                <Typography variant="body1" sx={{ color: '#C1BEBA', fontFamily: 'var(--font-satoshi)', lineHeight: 1.6 }}>{event.description}</Typography>
              </Box>
            )}

            <Box sx={{ mb: 4 }}>
              <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 2 }}>
                <Typography variant="h6" fontWeight={700} sx={{ color: '#8E8A86', fontFamily: 'var(--font-satoshi)', textTransform: 'uppercase', letterSpacing: '0.05em', fontSize: '0.85rem' }}>Organizers</Typography>
                {!loading && user && event.userId === user.$id && (
                  <Button 
                    size="small"
                    onClick={() => openUnified('share-note', {
                      resourceId: eventId as string,
                      resourceType: 'event',
                      resourceTitle: event.title,
                      onShared: () => fetchOrganizers()
                    })}
                    sx={{ color: '#F59E0B', fontWeight: 800, fontSize: '0.75rem', fontFamily: 'var(--font-satoshi)', textTransform: 'none', '&:hover': { textDecoration: 'underline' } }}
                  >
                    + Manage Organizers
                  </Button>
                )}
              </Box>
              
              {loading ? (
                <></>
              ) : loadingOrganizers ? (
                <CircularProgress size={16} sx={{ color: '#F59E0B' }} />
              ) : organizers.length === 0 ? (
                <Typography variant="body2" sx={{ color: '#8E8A86', fontFamily: 'var(--font-satoshi)', fontStyle: 'italic' }}>
                  No co-organizers added yet.
                </Typography>
              ) : (
                <Stack direction="row" spacing={1.5} flexWrap="wrap" sx={{ gap: 1.5 }}>
                  {organizers.map((org) => (
                    <Chip
                      key={org.$id || org.userId}
                      avatar={
                        <IdentityAvatar
                          fileId={org.avatar || null}
                          alt={org.displayName || org.username}
                          fallback={(org.displayName || org.username || 'O').charAt(0).toUpperCase()}
                          size={24}
                        />
                      }
                      label={`${org.displayName || org.username} (${org.permissionLevel || 'Viewer'})`}
                      onClick={() => {
                        if (user && event.userId === user.$id) {
                          openUnified('share-note', {
                            resourceId: eventId as string,
                            resourceType: 'event',
                            resourceTitle: event.title,
                            initialCollaborator: org,
                            onShared: () => fetchOrganizers()
                          });
                        }
                      }}
                      sx={{ 
                        bgcolor: '#1C1A18', 
                        border: '1px solid #34322F',
                        color: 'white',
                        fontWeight: 700,
                        fontFamily: 'var(--font-satoshi)',
                        fontSize: '0.75rem',
                        '&:hover': { bgcolor: '#242220', borderColor: '#6366F1' }
                      }}
                    />
                  ))}
                </Stack>
              )}
            </Box>

            <Box>
              <Typography variant="h6" fontWeight={700} sx={{ mb: 2, color: '#8E8A86', fontFamily: 'var(--font-satoshi)', textTransform: 'uppercase', letterSpacing: '0.05em', fontSize: '0.85rem' }}>Attendees</Typography>
              <AvatarGroup max={6} sx={{ justifyContent: 'flex-start' }}>
                {attendees.map((attendee) => (
                  <AttendeeAvatar key={attendee.$id} guest={attendee} theme={theme} />
                ))}
              </AvatarGroup>
            </Box>
          </Box>
        </Paper>

        {/* Public Huddle Discussion Thread */}
        <Paper sx={{ mt: 4, display: 'flex', flexDirection: 'column', height: 500, bgcolor: '#161412', borderRadius: '28px', border: '1px solid #34322F', overflow: 'hidden', position: 'relative', backgroundImage: 'none' }}>
          {/* Mode Control & Toolbar */}
          <Stack direction="row" justifyContent="space-between" alignItems="center" sx={{ p: 2.25, borderBottom: '1px solid #34322F', bgcolor: '#1C1A18' }}>
            <Typography variant="body2" sx={{ fontWeight: 900, color: 'white', fontFamily: 'var(--font-clash)', letterSpacing: '-0.01em' }}>Public Huddle Thread</Typography>
            {isHuddleInit && huddleTimeRemaining && (
              <Stack direction="row" spacing={1.5} alignItems="center">
                <Stack direction="row" spacing={0.75} alignItems="center" sx={{ color: '#F59E0B' }}>
                  <Clock size={14} style={{ color: '#F59E0B' }} />
                  <Typography variant="caption" sx={{ fontWeight: 800, fontFamily: 'var(--font-satoshi)' }}>{huddleTimeRemaining}</Typography>
                </Stack>
                {/* Save Story button - only event owner can promote */}
                {user && event.userId === user.$id && (
                  <Button
                    size="small"
                    startIcon={<FileText size={14} />}
                    onClick={handleSaveHuddleAsStory}
                    sx={{
                      bgcolor: '#1C1A18',
                      border: '1px solid #34322F',
                      color: '#EC4899',
                      fontWeight: 800,
                      fontSize: '0.75rem',
                      px: 2,
                      py: 0.75,
                      borderRadius: '8px',
                      textTransform: 'none',
                      fontFamily: 'var(--font-satoshi)',
                      '&:hover': { bgcolor: '#242220', borderColor: '#EC4899' }
                    }}
                  >
                    Save Story
                  </Button>
                )}
              </Stack>
            )}
          </Stack>

          {/* Main Viewport */}
          <Box sx={{ flex: 1, minHeight: 0, display: 'flex', flexDirection: 'column', position: 'relative' }}>
            {huddleLoading && (
              <Box sx={{ position: 'absolute', inset: 0, display: 'grid', placeItems: 'center', bgcolor: '#161412', zIndex: 2 }}>
                <CircularProgress size={28} sx={{ color: '#6366F1' }} />
              </Box>
            )}

            {!isHuddleInit ? (
              <Box sx={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', p: 4, textAlign: 'center' }}>
                <Box sx={{ width: 56, height: 56, borderRadius: '16px', display: 'grid', placeItems: 'center', bgcolor: '#1C1A18', color: '#6366F1', border: '1px solid #34322F', mb: 2.5 }}>
                  <Globe size={26} style={{ color: '#6366F1' }} />
                </Box>
                <Typography variant="body2" sx={{ fontWeight: 800, color: 'white', mb: 1, fontFamily: 'var(--font-clash)' }}>Initialize Event Discussion</Typography>
                <Typography variant="caption" sx={{ color: '#8E8A86', maxWidth: 360, lineHeight: 1.5, mb: 3, fontFamily: 'var(--font-satoshi)' }}>
                  Start a temporary public huddle chat thread for this event. Registered attendees and guests can read and post. Ephemeral chat automatically purges in 7 days.
                </Typography>
                <Button 
                  onClick={handleInitHuddle}
                  sx={{ bgcolor: '#6366F1', color: '#fff', fontWeight: 800, fontSize: '0.8rem', py: 1.25, px: 3, borderRadius: '12px', textTransform: 'none', fontFamily: 'var(--font-satoshi)', '&:hover': { bgcolor: '#4F46E5' } }}
                >
                  Start Huddle
                </Button>
              </Box>
            ) : (
              <>
                <Box sx={{ flex: 1, overflowY: 'auto', p: 3, display: 'flex', flexDirection: 'column', gap: 2 }}>
                  {huddleMessages.length === 0 ? (
                    <Box sx={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                      <Typography variant="caption" sx={{ fontStyle: 'italic', color: '#8E8A86', fontFamily: 'var(--font-satoshi)' }}>No messages yet. Start the event huddle!</Typography>
                    </Box>
                  ) : (
                    huddleMessages.map((msg) => {
                      const isSelf = user && msg.senderId === user.$id;
                      return (
                        <Box key={msg.id} sx={{ alignSelf: isSelf ? 'flex-end' : 'flex-start', maxWidth: '75%' }}>
                          <Typography variant="caption" sx={{ color: '#8E8A86', fontWeight: 800, display: 'block', mb: 0.5, textAlign: isSelf ? 'right' : 'left', fontFamily: 'var(--font-satoshi)' }}>
                            {msg.senderName}
                          </Typography>
                          <Paper 
                            elevation={0}
                            sx={{
                              p: 1.75,
                              borderRadius: '16px',
                              borderTopRightRadius: isSelf ? 0 : '16px',
                              borderTopLeftRadius: isSelf ? '16px' : 0,
                              bgcolor: isSelf ? '#6366F1' : '#1C1A18',
                              border: isSelf ? 'none' : '1px solid #34322F',
                              color: '#fff',
                              boxShadow: 'none',
                              backgroundImage: 'none'
                            }}
                          >
                            <Typography variant="body2" sx={{ fontWeight: 600, lineHeight: 1.5, wordBreak: 'break-word', fontSize: '0.85rem', fontFamily: 'var(--font-satoshi)' }}>
                              {msg.content}
                            </Typography>
                          </Paper>
                          <Typography variant="caption" sx={{ color: '#5E5B58', fontSize: '0.65rem', display: 'block', mt: 0.5, textAlign: isSelf ? 'right' : 'left', fontFamily: 'var(--font-mono)' }}>
                            {new Date(msg.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                          </Typography>
                        </Box>
                      );
                    })
                  )}
                  <div ref={huddleMessageEndRef} />
                </Box>

                {/* Input Form */}
                <Box component="form" onSubmit={handleSendHuddleMessage} sx={{ p: 2.25, borderTop: '1px solid #34322F', bgcolor: '#1C1A18' }}>
                  <Stack direction="row" spacing={1.5}>
                    <TextField
                      fullWidth
                      size="small"
                      value={inputText}
                      onChange={(e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => setInputText(e.target.value)}
                      placeholder={isAuthenticated ? "Type huddle message (auto-cleans in 7 days)..." : "Sign in to send messages..."}
                      disabled={!isAuthenticated}
                      variant="standard"
                      InputProps={{
                        disableUnderline: true,
                        sx: {
                          bgcolor: '#000000',
                          borderRadius: '12px',
                          color: 'white',
                          px: 2,
                          py: 1,
                          fontWeight: 600,
                          fontSize: '0.85rem',
                          fontFamily: 'var(--font-satoshi)',
                          border: '1px solid #34322F',
                          '&:hover': { borderColor: '#6366F1' }
                        }
                      }}
                    />
                    <IconButton 
                      type="submit"
                      disabled={!inputText.trim() || huddleSending || !isAuthenticated}
                      sx={{
                        bgcolor: '#6366F1',
                        color: '#fff',
                        borderRadius: '12px',
                        width: 40,
                        height: 40,
                        '&:hover': { bgcolor: '#4F46E5' },
                        '&.ob-disabled': { bgcolor: '#1C1A18', color: '#5E5B58' }
                      }}
                    >
                      <Send size={16} style={{ color: '#fff' }} />
                    </IconButton>
                  </Stack>
                </Box>
              </>
            )}
          </Box>
        </Paper>
      </Container>
      </MultiSectionContainer>
    </Box>
  );
}
