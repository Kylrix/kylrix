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
  Skeleton,
  useTheme,
  alpha,
} from '@mui/material';
import {
  ContentCopy as ContentCopyIcon,
} from '@mui/icons-material';
import { useAuth } from '@/context/auth/AuthContext';
import { events as eventApi, eventGuests as guestApi } from '@/lib/kylrixflow';
import { Event } from '@/types/kylrixflow';
import { format } from 'date-fns';
import { Query } from 'appwrite';
import { generateEventPattern } from '@/utils/patternGenerator';
import { fetchProfilePreview } from '@/lib/profile-preview';
import { IdentityAvatar, computeIdentityFlags } from '@/components/common/IdentityBadge';

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
  const { user, isAuthenticated, openLoginPopup } = useAuth();

  const [event, setEvent] = useState<Event | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [isRegistered, setIsRegistered] = useState(false);
  const [guestId, setGuestId] = useState<string | null>(null);
  const [registering, setRegistering] = useState(false);
  const [attendees, setAttendees] = useState<any[]>([]);

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
        setEvent(eventData);
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
          Query.equal('userId', user.$id),
        ]);
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
    if (!isAuthenticated) { openLoginPopup(); return; }
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

  if (loading) {
    return (
      <Container maxWidth="md" sx={{ py: 4 }}>
        <Skeleton variant="rectangular" height={300} sx={{ borderRadius: 3, mb: 4 }} />
        <Skeleton variant="text" height={60} width="80%" />
      </Container>
    );
  }

  if (error || !event) {
    return (
      <Container maxWidth="md" sx={{ py: 8, textAlign: 'center' }}>
        <Typography variant="h4">{error || "Event not found"}</Typography>
      </Container>
    );
  }

  const startDate = new Date(event.startTime);
  const endDate = new Date(event.endTime);
  const coverStyle = event.coverImageId
    ? { backgroundImage: `url(${event.coverImageId})` }
    : { background: generateEventPattern(event.$id + event.title) };

  return (
    <Box sx={{ minHeight: '100%', pb: 8 }}>
      <Container maxWidth="md" sx={{ px: { xs: 0, sm: 2 } }}>
        <Paper sx={{ overflow: 'hidden', borderRadius: { xs: 0, sm: 3 }, mb: 4 }}>
          <Box sx={{ height: { xs: 250, md: 350 }, position: 'relative', backgroundSize: 'cover', ...coverStyle }}>
            <Box sx={{ position: 'absolute', top: 16, right: 16 }}>
              <Button variant="contained" color="inherit" onClick={handleCopyLink}><ContentCopyIcon fontSize="small" /></Button>
            </Box>
          </Box>

          <Box sx={{ p: { xs: 3, md: 5 } }}>
            <Typography variant="h3" fontWeight={800} gutterBottom>{event.title}</Typography>

            <Paper variant="outlined" sx={{ p: 3, mb: 4, display: 'flex', justifyContent: 'space-between', alignItems: 'center', bgcolor: alpha(theme.palette.primary.main, 0.05) }}>
              <Box>
                <Typography variant="subtitle1" fontWeight={600}>{format(startDate, 'EEEE, MMMM d, yyyy')}</Typography>
                <Typography variant="body2" color="text.secondary">{format(startDate, 'h:mm a')} - {format(endDate, 'h:mm a')}</Typography>
              </Box>
              <Button variant="contained" onClick={isRegistered ? handleCancelRegistration : handleRegister} disabled={registering}>
                {registering ? '...' : isRegistered ? 'Cancel' : 'Register'}
              </Button>
            </Paper>

            <Box sx={{ mb: 4 }}>
              <Typography variant="h6" fontWeight={700} gutterBottom>About</Typography>
              <Typography variant="body1" color="text.secondary">{event.description}</Typography>
            </Box>

            <Box>
              <Typography variant="h6" fontWeight={700} sx={{ mb: 2 }}>Attendees</Typography>
              <AvatarGroup max={6} sx={{ justifyContent: 'flex-start' }}>
                {attendees.map((attendee) => (
                  <AttendeeAvatar key={attendee.$id} guest={attendee} theme={theme} />
                ))}
              </AvatarGroup>
            </Box>
          </Box>
        </Paper>
      </Container>
    </Box>
  );
}
