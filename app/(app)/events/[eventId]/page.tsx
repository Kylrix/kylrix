'use client';

import React, { useEffect, useState, useCallback, useRef } from 'react';
import { useParams, useRouter } from 'next/navigation';
import {
  Calendar,
  Clock,
  MapPin,
  Share2,
  Video,
  Globe,
  Lock,
  ArrowLeft,
  Check,
  Users,
  Send,
  Sparkles,
  UserCheck,
  UserPlus,
  MessageSquare,
  FileText,
  Copy,
} from 'lucide-react';
import { useAuth } from '@/context/auth/AuthContext';
import { useUnifiedDrawer } from '@/context/UnifiedDrawerContext';
import { getResourceCollaboratorsSecure } from '@/lib/actions/secure-ops';
import { account } from '@/lib/appwrite/client';
import { events as eventApi, eventGuests as guestApi } from '@/lib/kylrixflow';
import type { Event as AppwriteEvent } from '@/types/kylrixflow';
import { formatTime } from '@/lib/time-util';
import { Query } from 'appwrite';
import {
  createGhostNoteForResource,
  promoteGhostResourceThreadToStory,
  getOrCreateThread,
  findThread,
  listThreadMessages,
  postThreadMessage,
} from '@/lib/actions/client-ops';
import { client } from '@/lib/appwrite/client';
import { APPWRITE_CONFIG } from '@/lib/appwrite/config';
import { useToast } from '@/components/ui/Toast';
import { AppwriteService } from '@/lib/appwrite';
import { generateEventPattern } from '@/utils/patternGenerator';
import { IdentityAvatar } from '@/components/common/IdentityBadge';
import { MultiSectionContainer } from '@/context/SectionContext';
import { SyncStatusDot, SyncStatusLabel } from '@/components/ui/SyncStatusDot';
import { exportToICS } from '@/lib/utils/export';
import toast from 'react-hot-toast';

export default function EventPage() {
  const { eventId } = useParams<{ eventId: string }>();
  const router = useRouter();
  const { user, isAuthenticated, openIDMWindow } = useAuth();
  const { showSuccess, showError } = useToast();

  const [event, setEvent] = useState<AppwriteEvent | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [isRegistered, setIsRegistered] = useState(false);
  const [guestId, setGuestId] = useState<string | null>(null);
  const [registering, setRegistering] = useState(false);
  const [attendees, setAttendees] = useState<any[]>([]);

  const { open: openUnified } = useUnifiedDrawer();
  const [organizers, setOrganizers] = useState<any[]>([]);
  const [loadingOrganizers, setLoadingOrganizers] = useState(false);

  // Huddle Discussion State
  const [huddleMessages, setHuddleMessages] = useState<any[]>([]);
  const [huddleLoading, setHuddleLoading] = useState(false);
  const [huddleSending, setHuddleSending] = useState(false);
  const [threadId, setThreadId] = useState<string | null>(null);
  const [isHuddleInit, setIsHuddleInit] = useState(false);
  const [inputText, setInputText] = useState('');
  const huddleMessageEndRef = useRef<HTMLDivElement>(null);

  const fetchOrganizers = useCallback(async () => {
    if (!eventId) return;
    setLoadingOrganizers(true);
    try {
      const { jwt } = await account.createJWT();
      const { collaborators } = await getResourceCollaboratorsSecure({
        resourceId: eventId,
        resourceType: 'event',
        jwt,
      });
      setOrganizers(collaborators || []);
    } catch (orgErr) {
      console.error('Failed to fetch event organizers:', orgErr);
    } fontally {
      setLoadingOrganizers(false);
    }
  }, [eventId]);

  useEffect(() => {
    fetchOrganizers();
  }, [fetchOrganizers]);

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
      } catch {
        /* quiet */
      }
    };
    checkRegistration();
  }, [user, eventId]);

  // Fetch attendees
  useEffect(() => {
    const fetchAttendees = async () => {
      if (!eventId) return;
      try {
        const guests = await guestApi.list([Query.equal('eventId', eventId)]);
        setAttendees(guests.rows);
      } catch {
        /* quiet */
      }
    };
    fetchAttendees();
  }, [eventId, isRegistered]);

  // Huddle check
  useEffect(() => {
    if (!eventId) return;
    let active = true;

    const checkHuddle = async () => {
      try {
        const existing = await findThread({ parentKind: 'event', parentId: eventId, channel: 'discuss' });
        if (!active) return;
        if (existing?.id) {
          setThreadId(existing.id);
          setIsHuddleInit(true);
        } else {
          setIsHuddleInit(false);
        }
      } catch {
        if (active) setIsHuddleInit(false);
      }
    };

    checkHuddle();
    return () => {
      active = false;
    };
  }, [eventId]);

  // Load Huddle comments
  useEffect(() => {
    if (!eventId || !isHuddleInit) return;
    let active = true;
    setHuddleLoading(true);

    const loadHuddleComments = async () => {
      try {
        let tid = threadId;
        if (!tid) {
          const ensured = await getOrCreateThread({ parentKind: 'event', parentId: eventId, channel: 'discuss' });
          tid = (ensured as any)?.thread?.id || null;
          if (tid) setThreadId(tid);
        }
        if (!tid) return;
        const rows = await listThreadMessages(tid, { limit: 200 });
        if (!active) return;

        const msgs = await Promise.all(
          rows.map(async (doc: any) => {
            let senderName = 'Attendee';
            if (user && doc.userId === user.$id) {
              senderName = user.name || 'You';
            } else {
              try {
                const profile = await AppwriteService.getProfile(doc.userId);
                if (profile) senderName = profile.name || 'Attendee';
              } catch {
                /* quiet */
              }
            }
            return {
              id: doc.id || doc.$id,
              senderId: doc.userId,
              senderName,
              content: doc.content,
              timestamp: new Date(doc.createdAt || Date.now()).getTime(),
            };
          }),
        );
        msgs.sort((a, b) => a.timestamp - b.timestamp);
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
        const eventsList = response.events;
        const payload = response.payload;

        if (eventsList.some((e: string) => e.includes('.create')) && payload.noteId === eventId) {
          let senderName = 'Attendee';
          if (user && payload.userId === user.$id) {
            senderName = user.name || 'You';
          } else {
            try {
              const profile = await AppwriteService.getProfile(payload.userId);
              if (profile) senderName = profile.name || 'Attendee';
            } catch {
              /* quiet */
            }
          }
          const msg = {
            id: payload.$id,
            senderId: payload.userId,
            senderName,
            content: payload.content,
            timestamp: new Date(payload.createdAt).getTime(),
          };
          setHuddleMessages((prev) => {
            if (prev.some((m) => m.id === msg.id)) return prev;
            return [...prev, msg].sort((a, b) => a.timestamp - b.timestamp);
          });
        }
      },
    );

    return () => {
      active = false;
      unsubscribe();
    };
  }, [eventId, isHuddleInit, threadId, user]);

  useEffect(() => {
    huddleMessageEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [huddleMessages]);

  const handleRegister = async () => {
    if (!isAuthenticated) {
      openIDMWindow();
      return;
    }
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
      toast.success('Successfully registered for event!');
    } catch {
      toast.error('Failed to register');
    } finally {
      setRegistering(false);
    }
  };

  const handleCancelRegistration = async () => {
    if (!guestId) return;
    try {
      setRegistering(true);
      await guestApi.delete(guestId);
      setIsRegistered(false);
      setGuestId(null);
      toast.success('Registration cancelled');
    } catch {
      toast.error('Failed to cancel registration');
    } finally {
      setRegistering(false);
    }
  };

  const handleCopyLink = () => {
    navigator.clipboard.writeText(window.location.href);
    toast.success('Event share link copied to clipboard');
  };

  const handleInitHuddle = async () => {
    if (!event) return;
    setHuddleLoading(true);
    try {
      const res = await createGhostNoteForResource(eventId, 'event', `${event.title} Discussion`);
      setThreadId((res as any)?.$id || (res as any)?.primaryThreadId || null);
      setIsHuddleInit(true);
      showSuccess('Event discussion thread created!');
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
    if (!isAuthenticated) {
      openIDMWindow();
      return;
    }
    setHuddleSending(true);
    try {
      let tid = threadId;
      if (!tid) {
        const ensured = await getOrCreateThread({
          parentKind: 'event',
          parentId: eventId,
          channel: 'discuss',
          title: `${event?.title || 'Event'} Discussion`,
        });
        tid = (ensured as any)?.thread?.id || null;
        setThreadId(tid);
      }
      if (!tid) throw new Error('No discussion thread');
      await postThreadMessage({ threadId: tid, content: inputText.trim() });
      setInputText('');
      const rows = await listThreadMessages(tid, { limit: 200 });
      setHuddleMessages(
        rows
          .map((doc: any) => ({
            id: doc.id,
            senderId: doc.userId,
            senderName: user?.name || 'You',
            content: doc.content,
            timestamp: new Date(doc.createdAt || Date.now()).getTime(),
          }))
          .sort((a: any, b: any) => a.timestamp - b.timestamp),
      );
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

  if (loading) {
    return (
      <div className="min-h-screen bg-[#0A0908] flex items-center justify-center">
        <div className="flex flex-col items-center gap-3">
          <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-[#6366F1]" />
          <span className="text-xs font-mono font-bold text-white/50">Loading event details...</span>
        </div>
      </div>
    );
  }

  if (error || !event) {
    return (
      <div className="min-h-screen bg-[#0A0908] flex items-center justify-center p-4">
        <div className="max-w-md w-full p-8 rounded-[28px] bg-[#161412] border border-[#34322F] text-center flex flex-col items-center gap-4">
          <div className="p-3 rounded-2xl bg-red-500/10 text-red-400 border border-red-500/20">
            <Lock className="w-8 h-8" />
          </div>
          <h2 className="text-xl font-bold font-clash text-white">{error || 'Event not found'}</h2>
          <p className="text-xs text-[#8E8A86] font-satoshi">
            This event might be private, deleted, or accessible only by authorized invitees.
          </p>
          <button
            type="button"
            onClick={() => router.push('/events')}
            className="mt-2 px-5 py-2.5 rounded-xl bg-[#6366F1] hover:bg-[#4F46E5] text-white font-bold text-xs font-mono uppercase tracking-wider transition-all cursor-pointer"
          >
            Back to Events
          </button>
        </div>
      </div>
    );
  }

  const startDate = new Date(event.startTime);
  const endDate = new Date(event.endTime);
  const isPublic = event.visibility === 'public' || Boolean(event.isPublic);
  const coverImage = event.coverImageId || (event as any).coverImage;
  const meetingUrl = event.meetingUrl || (event as any).url;
  const coverStyle = coverImage
    ? { backgroundImage: `url(${coverImage})` }
    : { background: generateEventPattern(event.$id + event.title) };

  return (
    <div className="min-h-screen bg-[#0A0908] text-white font-satoshi pb-16 selection:bg-[#6366F1]/30">
      <MultiSectionContainer panels={['note', 'huddles', 'goals']} contextId={eventId}>
        {/* Cover Header */}
        <div className="relative w-full h-[260px] md:h-[360px] overflow-hidden">
          <div
            className="w-full h-full bg-cover bg-center transition-all duration-500"
            style={coverStyle}
          />
          <div className="absolute inset-0 bg-gradient-to-t from-[#0A0908] via-[#0A0908]/40 to-black/60" />

          {/* Top Bar Navigation */}
          <div className="absolute top-4 inset-x-4 max-w-5xl mx-auto flex items-center justify-between z-10">
            <button
              type="button"
              onClick={() => router.push('/events')}
              className="p-2.5 rounded-xl bg-black/60 backdrop-blur-md border border-white/10 text-white/80 hover:text-white hover:bg-black/80 transition-all flex items-center gap-2 text-xs font-mono font-bold cursor-pointer"
            >
              <ArrowLeft className="w-4 h-4" />
              <span className="hidden sm:inline">Events</span>
            </button>

            <div className="flex items-center gap-2">
              <span className="px-3 py-1.5 rounded-xl bg-black/60 backdrop-blur-md border border-white/10 text-white text-xs font-bold font-mono capitalize flex items-center gap-1.5">
                {isPublic ? (
                  <Globe className="w-3.5 h-3.5 text-emerald-400" />
                ) : (
                  <Lock className="w-3.5 h-3.5 text-purple-400" />
                )}
                <span>{isPublic ? 'Public Event' : 'Private'}</span>
              </span>

              <button
                type="button"
                onClick={handleCopyLink}
                className="p-2.5 rounded-xl bg-black/60 backdrop-blur-md border border-white/10 text-white/80 hover:text-white hover:bg-black/80 transition-all flex items-center justify-center cursor-pointer"
                title="Share Event"
              >
                <Share2 className="w-4 h-4" />
              </button>
            </div>
          </div>
        </div>

        {/* Main Content Container */}
        <div className="max-w-4xl mx-auto px-4 -mt-20 relative z-20 flex flex-col gap-8">
          {/* Main Card Hero */}
          <div className="p-6 md:p-8 rounded-[28px] bg-[#161412] border border-[#34322F] shadow-2xl flex flex-col gap-6 backdrop-blur-md">
            <div className="flex flex-col gap-3">
              <div className="flex items-center justify-between flex-wrap gap-2">
                <div className="flex items-center gap-2 text-xs text-[#8E8A86] font-mono">
                  <SyncStatusDot resourceId={`event:${event.$id}`} />
                  <SyncStatusLabel resourceId={`event:${event.$id}`} />
                </div>
                <span className="px-3 py-1 rounded-full bg-[#6366F1]/10 border border-[#6366F1]/20 text-[#818CF8] text-xs font-mono font-bold">
                  {attendees.length} {attendees.length === 1 ? 'Attendee' : 'Attendees'}
                </span>
              </div>

              <h1 className="text-3xl md:text-5xl font-black font-clash text-white tracking-tight leading-tight">
                {event.title}
              </h1>

              {/* Host Badge */}
              <div className="flex items-center gap-3 pt-2">
                <IdentityAvatar userId={event.userId} size={40} />
                <div className="flex flex-col">
                  <span className="text-xs font-mono uppercase tracking-wider text-[#8E8A86]">Hosted by</span>
                  <span className="text-sm font-bold text-white">Event Organizer</span>
                </div>
              </div>
            </div>

            {/* Quick RSVP Banner Action */}
            <div className="p-4 rounded-2xl bg-[#1C1A18] border border-[#34322F] flex flex-col sm:flex-row items-center justify-between gap-4">
              <div className="flex items-center gap-3">
                <div className="p-2.5 rounded-xl bg-[#6366F1]/10 text-[#6366F1] border border-[#6366F1]/20 shrink-0">
                  <Users className="w-5 h-5" />
                </div>
                <div className="flex flex-col">
                  <span className="text-sm font-bold text-white">
                    {isRegistered ? 'You are attending this event!' : 'RSVP to confirm your attendance'}
                  </span>
                  <span className="text-xs text-[#8E8A86] font-mono">
                    {isRegistered
                      ? 'Registration confirmed. See schedule details below.'
                      : 'Join other guests in the event schedule.'}
                  </span>
                </div>
              </div>

              <button
                type="button"
                onClick={isRegistered ? handleCancelRegistration : handleRegister}
                disabled={registering}
                className={`w-full sm:w-auto px-6 py-3 rounded-xl font-mono font-extrabold text-xs uppercase tracking-wider transition-all flex items-center justify-center gap-2 cursor-pointer shadow-lg shrink-0 ${
                  isRegistered
                    ? 'bg-red-500/10 hover:bg-red-500/20 text-red-400 border border-red-500/30'
                    : 'bg-[#6366F1] hover:bg-[#4F46E5] text-white shadow-[0_4px_12px_rgba(99,102,241,0.3)]'
                }`}
              >
                {registering ? (
                  <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-current" />
                ) : isRegistered ? (
                  <>
                    <Check className="w-4 h-4" />
                    <span>Cancel RSVP</span>
                  </>
                ) : (
                  <>
                    <UserPlus className="w-4 h-4" />
                    <span>Register Now</span>
                  </>
                )}
              </button>
            </div>
          </div>

          {/* Details Grid: When & Where */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {/* When Card */}
            <div className="p-6 rounded-[28px] bg-[#161412] border border-[#34322F] flex flex-col gap-4">
              <div className="flex items-center justify-between pb-2 border-b border-white/5">
                <span className="text-xs font-mono font-bold uppercase tracking-wider text-[#818CF8] flex items-center gap-2">
                  <Calendar className="w-4 h-4 text-[#6366F1]" />
                  Schedule (When)
                </span>
                <button
                  type="button"
                  onClick={() =>
                    exportToICS({
                      title: event.title,
                      description: event.description,
                      startTime: event.startTime,
                      endTime: event.endTime,
                      location: event.location,
                    })
                  }
                  className="text-[10px] font-mono font-bold text-white/50 hover:text-white transition-colors"
                >
                  + Add to Calendar
                </button>
              </div>

              <div className="flex flex-col gap-1.5">
                <span className="text-lg font-extrabold text-white">
                  {formatTime(startDate, { weekday: 'long', month: 'long', day: 'numeric', year: 'numeric' })}
                </span>
                <div className="flex items-center gap-2 text-xs text-[#8E8A86] font-mono">
                  <Clock className="w-3.5 h-3.5 text-[#818CF8]" />
                  <span>
                    {formatTime(startDate, { hour: 'numeric', minute: '2-digit', hour12: true })} -{' '}
                    {formatTime(endDate, { hour: 'numeric', minute: '2-digit', hour12: true })}
                  </span>
                </div>
              </div>
            </div>

            {/* Where Card */}
            <div className="p-6 rounded-[28px] bg-[#161412] border border-[#34322F] flex flex-col gap-4">
              <div className="flex items-center justify-between pb-2 border-b border-white/5">
                <span className="text-xs font-mono font-bold uppercase tracking-wider text-emerald-400 flex items-center gap-2">
                  <MapPin className="w-4 h-4 text-emerald-500" />
                  Location (Where)
                </span>
              </div>

              <div className="flex flex-col gap-2">
                <span className="text-base font-bold text-white leading-snug">
                  {event.location || 'Online / Remote Event'}
                </span>
                {meetingUrl && (
                  <a
                    href={meetingUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center gap-2 px-4 py-2 text-xs font-mono font-extrabold text-white bg-[#6366F1] hover:bg-[#4F46E5] rounded-xl transition-all w-fit cursor-pointer shadow-[0_4px_12px_rgba(99,102,241,0.25)]"
                  >
                    <Video className="w-4 h-4" />
                    <span>Join Huddle Meeting</span>
                  </a>
                )}
              </div>
            </div>
          </div>

          {/* About Event */}
          <div className="p-6 md:p-8 rounded-[28px] bg-[#161412] border border-[#34322F] flex flex-col gap-4">
            <span className="text-xs font-mono font-bold uppercase tracking-wider text-[#8E8A86]">
              About Event
            </span>
            <div className="text-sm md:text-base leading-relaxed text-[#C1BEBA] font-satoshi whitespace-pre-line break-words">
              {event.description || 'No detailed description provided for this event.'}
            </div>
          </div>

          {/* Organizers & Attendees Section */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {/* Organizers */}
            <div className="p-6 rounded-[28px] bg-[#161412] border border-[#34322F] flex flex-col gap-4">
              <div className="flex items-center justify-between">
                <span className="text-xs font-mono font-bold uppercase tracking-wider text-[#8E8A86]">
                  Organizers
                </span>
                {user && event.userId === user.$id && (
                  <button
                    type="button"
                    onClick={() =>
                      openUnified('share-note', {
                        resourceId: eventId,
                        resourceType: 'event',
                        resourceTitle: event.title,
                        onShared: () => fetchOrganizers(),
                      })
                    }
                    className="text-[10px] font-mono text-[#F59E0B] hover:underline font-bold"
                  >
                    + Manage Organizers
                  </button>
                )}
              </div>

              {loadingOrganizers ? (
                <div className="flex items-center gap-2 text-xs text-[#8E8A86]">
                  <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-[#F59E0B]" />
                  <span>Loading organizers...</span>
                </div>
              ) : organizers.length === 0 ? (
                <span className="text-xs text-[#8E8A86] italic font-mono">Hosted by event creator</span>
              ) : (
                <div className="flex flex-wrap gap-2">
                  {organizers.map((org) => (
                    <div
                      key={org.$id || org.userId}
                      className="flex items-center gap-2 px-3 py-1.5 rounded-xl bg-[#1C1A18] border border-[#34322F] text-white text-xs font-bold font-satoshi"
                    >
                      <IdentityAvatar userId={org.userId} size={20} />
                      <span>{org.displayName || org.username}</span>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Attendees */}
            <div className="p-6 rounded-[28px] bg-[#161412] border border-[#34322F] flex flex-col gap-4">
              <span className="text-xs font-mono font-bold uppercase tracking-wider text-[#8E8A86]">
                Confirmed Attendees ({attendees.length})
              </span>
              {attendees.length === 0 ? (
                <span className="text-xs text-[#8E8A86] italic font-mono">No attendees registered yet. Be the first!</span>
              ) : (
                <div className="flex items-center gap-2 flex-wrap">
                  {attendees.slice(0, 10).map((att) => (
                    <div key={att.$id || att.userId} className="relative group">
                      <IdentityAvatar userId={att.userId} size={36} />
                    </div>
                  ))}
                  {attendees.length > 10 && (
                    <div className="w-9 h-9 rounded-full bg-[#1C1A18] border border-[#34322F] flex items-center justify-center text-xs font-bold font-mono text-white/70">
                      +{attendees.length - 10}
                    </div>
                  )}
                </div>
              )}
            </div>
          </div>

          {/* Public Huddle Discussion Thread */}
          <div className="rounded-[28px] bg-[#161412] border border-[#34322F] overflow-hidden flex flex-col h-[480px]">
            {/* Thread Header */}
            <div className="p-4 bg-[#1C1A18] border-b border-[#34322F] flex items-center justify-between">
              <div className="flex items-center gap-2">
                <MessageSquare className="w-4 h-4 text-[#6366F1]" />
                <span className="font-clash font-extrabold text-sm text-white">Public Huddle Thread</span>
              </div>
              {isHuddleInit && user && event.userId === user.$id && (
                <button
                  type="button"
                  onClick={handleSaveHuddleAsStory}
                  className="px-3 py-1 rounded-lg bg-pink-500/10 border border-pink-500/20 text-pink-400 hover:bg-pink-500/20 text-xs font-mono font-bold transition-all flex items-center gap-1.5"
                >
                  <FileText className="w-3.5 h-3.5" />
                  <span>Save Story</span>
                </button>
              )}
            </div>

            {/* Viewport */}
            <div className="flex-1 overflow-y-auto p-4 flex flex-col gap-3 min-h-0 relative scrollbar-thin">
              {huddleLoading && (
                <div className="absolute inset-0 bg-[#161412]/80 backdrop-blur-sm flex items-center justify-center z-10">
                  <div className="animate-spin rounded-full h-7 w-7 border-b-2 border-[#6366F1]" />
                </div>
              )}

              {!isHuddleInit ? (
                <div className="flex-1 flex flex-col items-center justify-center text-center p-6 gap-3">
                  <div className="w-12 h-12 rounded-2xl bg-[#1C1A18] border border-[#34322F] flex items-center justify-center text-[#6366F1]">
                    <Sparkles className="w-6 h-6" />
                  </div>
                  <h3 className="font-clash font-extrabold text-base text-white">Event Discussion Thread</h3>
                  <p className="text-xs text-[#8E8A86] max-w-sm font-satoshi">
                    Start a public chat thread for attendees to coordinate, share updates, and discuss event details.
                  </p>
                  <button
                    type="button"
                    onClick={handleInitHuddle}
                    className="mt-1 px-5 py-2.5 rounded-xl bg-[#6366F1] hover:bg-[#4F46E5] text-white font-mono font-extrabold text-xs uppercase tracking-wider transition-all cursor-pointer shadow-lg"
                  >
                    Start Huddle Discussion
                  </button>
                </div>
              ) : huddleMessages.length === 0 ? (
                <div className="flex-1 flex items-center justify-center text-xs text-[#8E8A86] font-mono italic">
                  No messages yet. Be the first to start the conversation!
                </div>
              ) : (
                huddleMessages.map((msg) => {
                  const isSelf = user && msg.senderId === user.$id;
                  return (
                    <div
                      key={msg.id}
                      className={`flex flex-col max-w-[80%] ${isSelf ? 'align-self-end self-end items-end' : 'align-self-start self-start items-start'}`}
                    >
                      <span className="text-[10px] font-mono font-bold text-[#8E8A86] mb-1 px-1">
                        {msg.senderName}
                      </span>
                      <div
                        className={`p-3 rounded-2xl text-xs font-satoshi leading-relaxed break-words ${
                          isSelf
                            ? 'bg-[#6366F1] text-white rounded-tr-none'
                            : 'bg-[#1C1A18] border border-[#34322F] text-white rounded-tl-none'
                        }`}
                      >
                        {msg.content}
                      </div>
                      <span className="text-[9px] font-mono text-[#5E5B58] mt-1 px-1">
                        {new Date(msg.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                      </span>
                    </div>
                  );
                })
              )}
              <div ref={huddleMessageEndRef} />
            </div>

            {/* Input Form */}
            {isHuddleInit && (
              <form onSubmit={handleSendHuddleMessage} className="p-3 bg-[#1C1A18] border-t border-[#34322F] flex items-center gap-2">
                <input
                  type="text"
                  value={inputText}
                  onChange={(e) => setInputText(e.target.value)}
                  placeholder={isAuthenticated ? 'Type message in event huddle...' : 'Sign in to post messages...'}
                  disabled={!isAuthenticated}
                  className="flex-1 bg-[#0A0908] border border-[#34322F] focus:border-[#6366F1] rounded-xl px-4 py-2 text-xs text-white font-satoshi focus:outline-none transition-all"
                />
                <button
                  type="submit"
                  disabled={!inputText.trim() || huddleSending || !isAuthenticated}
                  className="p-2.5 rounded-xl bg-[#6366F1] hover:bg-[#4F46E5] disabled:opacity-40 text-white transition-all cursor-pointer shrink-0"
                >
                  <Send className="w-4 h-4" />
                </button>
              </form>
            )}
          </div>
        </div>
      </MultiSectionContainer>
    </div>
  );
}
