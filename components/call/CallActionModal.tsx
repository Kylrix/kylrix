'use client';

import React, { useState, useEffect, useCallback } from 'react';
import {
    Plus,
    Calendar,
    X,
    Users,
    Clock,
    Type,
    Timer,
    ArrowLeft,
    Copy,
    ExternalLink,
    Mic,
    Video as VideoIcon,
    ShieldCheck
} from 'lucide-react';
import { useRouter } from 'next/navigation';
import { ChatService } from '@/lib/services/chat';
import { useAuth } from '@/lib/auth';
import { CallService } from '@/lib/services/call';
import { createChatCallAction } from '@/lib/actions/call';
import { UsersService } from '@/lib/services/users';
import toast from 'react-hot-toast';
import type { CallLaunchContext } from '@/context/CallLauncherContext';
import { updateNote } from '@/lib/actions/client-ops';
import { tasks as taskApi } from '@/lib/kylrixflow';
import { ActivityService } from '@/lib/services/activity';
import { useDrawerState } from '@/components/ui/DrawerStateContext';

// Brand Colors

const truncate = (value: string, max = 44) => {
    const text = String(value || '').trim();
    if (text.length <= max) return text;
    return `${text.slice(0, Math.max(0, max - 1)).trimEnd()}…`;
};

const shortTime = () =>
    new Intl.DateTimeFormat(undefined, { hour: 'numeric', minute: '2-digit' }).format(new Date());

export const CallActionModal = ({
    open,
    onClose,
    launchContext}: {
    open: boolean;
    onClose: () => void;
    launchContext?: CallLaunchContext;
}) => {
    const { user } = useAuth();
    const router = useRouter();
    const { setIsDrawerOpen } = useDrawerState();

    useEffect(() => {
        setIsDrawerOpen(open);
        return () => setIsDrawerOpen(false);
    }, [open, setIsDrawerOpen]);

    const [isMobile, setIsMobile] = useState(false);
    useEffect(() => {
        const media = window.matchMedia('(max-width: 768px)');
        setIsMobile(media.matches);
        const listener = (e: MediaQueryListEvent) => setIsMobile(e.matches);
        media.addEventListener('change', listener);
        return () => media.removeEventListener('change', listener);
    }, []);

    const [_conversations, setConversations] = useState<any[]>([]);
    const [_loading, setLoading] = useState(false);
    const [showScheduleForm, setShowScheduleForm] = useState(false);
    const [showJoinWithId, setShowJoinWithId] = useState(false);
    const [scheduleTitle, setScheduleTitle] = useState('');
    const [instantTitle, setInstantTitle] = useState('');
    const [scheduleTime, setScheduleTime] = useState('');
    const [_joinId, setJoinId] = useState('');
    const [duration, setDuration] = useState(120); // Default 2 hours
    const [creating, setCreating] = useState(false);
    const [allowGuests, setAllowGuests] = useState(true);
    const [approveParticipants, setApproveParticipants] = useState(false);
    const [liveCallState, setLiveCallState] = useState<null | {
        callId: string;
        title: string;
        participantIds: string[];
        type: 'audio' | 'video';
    }>(null);
    const isScopedLaunch = Boolean(launchContext?.conversationId);
    const isNoteLaunch = Boolean(launchContext?.noteId);
    const isTaskLaunch = Boolean(launchContext?.taskId);

    useEffect(() => {
        if (open) {
            setAllowGuests(!(isScopedLaunch || isNoteLaunch || isTaskLaunch));
        }
    }, [open, isScopedLaunch, isNoteLaunch, isTaskLaunch]);

    const annotateTaskHuddle = async (taskId: string, callId: string, startedAtIso: string, durationMinutes: number) => {
        try {
            const task = await taskApi.get(taskId);
            const baseDescription = String(task?.description || '').trim();
            const stamp = `\n\n[Kylrix Huddle]\ncallId=${callId}\nstartedAt=${startedAtIso}\ndurationMinutes=${durationMinutes}`;
            await taskApi.update(taskId, {
                description: `${baseDescription}${stamp}`.trim()});
        } catch (error) {
            console.warn('[CallActionModal] Failed to annotate task huddle metadata', error);
        }
    };

    const resolveDefaultInstantTitle = useCallback(async () => {
        if (!launchContext) return '';

        const now = shortTime();

        if (launchContext.noteId) {
            const base = truncate(launchContext.title || 'Shared Note', 42);
            return `${base} • ${now}`;
        }

        if (launchContext.conversationId && user?.$id) {
            try {
                const conversation = await ChatService.getConversationById(launchContext.conversationId, user.$id);
                const participants = Array.isArray(conversation?.participants)
                    ? Array.from(new Set(conversation.participants.filter((id: unknown): id is string => typeof id === 'string' && id.trim().length > 0)))
                    : Array.from(new Set((launchContext.participantIds || []).filter((id): id is string => typeof id === 'string' && id.trim().length > 0)));

                if (conversation?.type === 'group') {
                    const groupName = truncate(conversation?.name || launchContext.conversationName || 'Group', 34);
                    return `${groupName} • ${now}`;
                }

                const pair = Array.from(new Set([user.$id, ...participants])).slice(0, 2);
                if (pair.length >= 2) {
                    const profiles = await Promise.all(pair.map((id) => UsersService.getProfileById(id as string).catch(() => null)));
                    const names = profiles.map((profile, idx) => {
                        const fallback = idx === 0 ? 'You' : 'Guest';
                        return profile?.username || profile?.displayName || fallback;
                    });
                    return `${names[0]} + ${names[1]} • ${now}`;
                }
            } catch {
                // fallback handled below
            }

            const fallbackName = truncate(launchContext.conversationName || 'Call', 34);
            return `${fallbackName} • ${now}`;
        }

        return '';
    }, [launchContext, user?.$id]);

    const loadConversations = useCallback(async () => {
        if (!user) return;
        setLoading(true);
        try {
            const res = await ChatService.getConversations(user.$id);
            const filtered = res.rows.filter((c: any) => {
                const isSelf = c.type === 'direct' && c.participants && 
                              (c.participants.length === 1 || 
                               (c.participants.length === 2 && c.participants.every((p: string) => p === user.$id)));
                return !isSelf;
            });
            setConversations(filtered);
        } catch (e) {
            console.error('Failed to load individuals:', e);
        } finally {
            setLoading(false);
        }
    }, [user]);

    useEffect(() => {
        if (open && user) {
            loadConversations();
            setShowScheduleForm(false);
            setShowJoinWithId(false);
            setScheduleTitle('');
            setInstantTitle('');
            setScheduleTime('');
            setJoinId('');
            setDuration(120);
            setAllowGuests(true);
            setApproveParticipants(false);
            setLiveCallState(null);
            resolveDefaultInstantTitle().then((title) => {
                if (title) setInstantTitle(title);
            }).catch(() => undefined);
            if (launchContext?.existingCallId) {
                const participants = Array.from(new Set([user.$id, ...(launchContext.participantIds || [])]));
                setLiveCallState({
                    callId: launchContext.existingCallId,
                    title: launchContext.title || launchContext.conversationName || 'Live Call',
                    participantIds: participants,
                    type: 'video'});
            }
        }
    }, [launchContext, open, user, loadConversations, resolveDefaultInstantTitle]);

    const handleStartPublicCall = async () => {
        if (!user) return;
        setCreating(true);
        try {
            let _link;
            if (launchContext?.conversationId) {
                const conversation = await ChatService.getConversationById(launchContext.conversationId, user.$id);
                const participants: string[] = Array.isArray(conversation?.participants)
                    ? Array.from(new Set(
                        conversation.participants.filter(
                            (id: unknown): id is string => typeof id === 'string' && id.trim().length > 0
                        )
                    ))
                    : (launchContext.participantIds || []).filter(
                        (id): id is string => typeof id === 'string' && id.trim().length > 0
                    );

                const serverResult = await createChatCallAction({
                    conversationId: launchContext.conversationId,
                    participantIds: participants,
                    type: 'audio',
                    title: instantTitle || launchContext.title || conversation?.name || undefined,
                    durationMinutes: duration,
                    scope: conversation?.type === 'group' ? 'group' : 'direct'});
                _link = { $id: serverResult.$id };
            } else if (launchContext?.noteId) {
                const participants: string[] = Array.from(new Set(launchContext.participantIds || [user.$id]));
                _link = await CallService.createScopedCallLink({
                    userId: user.$id,
                    type: 'video',
                    title: instantTitle || launchContext.title || 'Note Huddle',
                    durationMinutes: duration,
                    scope: 'note',
                    sourceApp: 'note',
                    noteId: launchContext.noteId,
                    participantIds: participants,
                    isPrivate: true,
                    allowGuests,
                    approveParticipants});
                const startedAtIso = new Date().toISOString();
                await updateNote(launchContext.noteId, {
                    huddleStartedAt: startedAtIso,
                    huddleDurationMinutes: duration} as any);
            } else if (launchContext?.taskId) {
                const participants: string[] = Array.from(new Set(launchContext.participantIds || [user.$id]));
                _link = await CallService.createScopedCallLink({
                    userId: user.$id,
                    type: 'video',
                    title: instantTitle || launchContext.title || 'Task Huddle',
                    durationMinutes: duration,
                    scope: 'huddle',
                    sourceApp: 'flow',
                    participantIds: participants,
                    isPrivate: true,
                    allowGuests,
                    approveParticipants});
                await annotateTaskHuddle(launchContext.taskId, _link.$id, new Date().toISOString(), duration);
            } else {
                _link = await CallService.createScopedCallLink({
                    userId: user.$id,
                    type: 'video',
                    title: instantTitle || undefined,
                    durationMinutes: duration,
                    scope: 'link',
                    sourceApp: 'connect',
                    allowGuests,
                    approveParticipants});
            }
            await ActivityService.setLiveCallActivity(
                user.$id,
                _link.$id,
                isNoteLaunch ? 'note' : isTaskLaunch ? 'flow' : 'connect').catch(() => undefined);
            const participants = Array.from(new Set([
                user.$id,
                ...(launchContext?.participantIds || [])]));
            setLiveCallState({
                callId: _link.$id,
                title: instantTitle || launchContext?.title || 'Live Call',
                participantIds: participants,
                type: 'video'});
        } catch (e: any) {
            console.error('[CallActionModal] Failed to start public call:', e);
            const errorMessage = e.message || "Failed to start public call";
            toast.error(errorMessage);
        } finally {
            setCreating(false);
        }
    };

    const handleScheduleCall = async () => {
        if (!user) return;
        if (!scheduleTime) {
            toast.error("Please select a start time");
            return;
        }

        setCreating(true);
        try {
            await CallService.createCallLink(
                user.$id, 
                'video', 
                undefined, 
                scheduleTitle || undefined, 
                new Date(scheduleTime).toISOString(),
                duration
            );
            toast.success("Call scheduled successfully!");
            router.push(`/calls`);
            onClose();
        } catch (e: any) {
            console.error('[CallActionModal] Failed to schedule call:', e);
            const errorMessage = e.message || "Failed to schedule call";
            toast.error(errorMessage);
        } finally {
            setCreating(false);
        }
    };



    const liveCallUrl = liveCallState ? `/connect/call/${liveCallState.callId}` : '';

    if (!open) return null;

    return (
        <div className="fixed inset-0 z-50 flex justify-end md:items-stretch items-end">
            {/* Backdrop */}
            <div 
                className="absolute inset-0 bg-black/60 transition-opacity duration-300"
                onClick={onClose}
            />
            {/* Drawer Container Panel */}
            <div className={`relative bg-[#161412] border-white/5 flex flex-col text-white shadow-2xl transition-transform duration-300 transform translate-x-0 z-10 w-full max-w-[480px] overflow-hidden ${
                isMobile 
                    ? 'h-[60dvh] max-h-[60dvh] rounded-t-3xl border-t' 
                    : 'h-screen max-h-screen rounded-l-3xl border-l'
            }`}>
                {/* Header (MUI DialogTitle) */}
                <div className="p-6 pb-4 flex items-center justify-between border-b border-white/5 flex-shrink-0">
                    <div className="flex items-center gap-3">
                        {(showScheduleForm || showJoinWithId) && (
                            <button 
                                onClick={() => { setShowScheduleForm(false); setShowJoinWithId(false); }} 
                                className="p-1 rounded-lg text-white/50 hover:text-white hover:bg-white/5 transition-all -ml-2"
                            >
                                <ArrowLeft size={20} />
                            </button>
                        )}
                        <h6 className="text-lg font-black font-clash tracking-tight text-white">
                            {showScheduleForm ? 'Schedule Session' : showJoinWithId ? 'Join with ID' : (isScopedLaunch || isNoteLaunch || isTaskLaunch) ? 'Start Call Here' : 'New Session'}
                        </h6>
                    </div>
                    <button 
                        onClick={onClose} 
                        className="p-1.5 rounded-lg text-white/30 hover:text-white hover:bg-white/5 transition-all"
                    >
                        <X size={20} />
                    </button>
                </div>

                {/* Content (MUI DialogContent) */}
                <div className="p-6 flex-1 overflow-y-auto flex flex-col gap-6">
                    {!showJoinWithId && (
                        <div className="flex flex-col gap-6">
                            {/* Selector for Duration */}
                            <div className="relative flex flex-col gap-1.5 w-full">
                                <label className="text-[11px] font-black text-white/40 uppercase tracking-wider font-mono">Call Duration</label>
                                <div className="relative flex items-center bg-[#161412] border border-white/5 hover:bg-white/4 hover:border-white/10 rounded-xl transition-all">
                                    <span className="absolute left-3 text-[#F59E0B]">
                                        <Timer size={18} />
                                    </span>
                                    <select
                                        value={duration}
                                        onChange={(e) => setDuration(Number(e.target.value))}
                                        className="w-full bg-transparent text-white pl-10 pr-10 py-3.5 rounded-xl appearance-none focus:outline-none font-medium text-sm cursor-pointer"
                                        style={{ colorScheme: 'dark' }}
                                    >
                                        <option value={15} className="bg-[#161412] text-white">15 Minutes</option>
                                        <option value={30} className="bg-[#161412] text-white">30 Minutes</option>
                                        <option value={60} className="bg-[#161412] text-white">1 Hour</option>
                                        <option value={120} className="bg-[#161412] text-white">2 Hours (Free Max)</option>
                                    </select>
                                    <span className="absolute right-3 pointer-events-none text-white/40">
                                        ▼
                                    </span>
                                </div>
                            </div>

                            {!showScheduleForm && (
                                <div className="relative flex flex-col gap-1.5 w-full">
                                    <label className="text-[11px] font-black text-white/40 uppercase tracking-wider font-mono">Meeting Title (Optional)</label>
                                    <div className="relative flex items-center bg-[#161412] border border-white/5 hover:bg-white/4 hover:border-white/10 rounded-xl transition-all">
                                        <span className="absolute left-3 text-[#6366F1]">
                                            <Type size={18} />
                                        </span>
                                        <input
                                            type="text"
                                            placeholder={launchContext?.conversationName ? `e.g. ${launchContext.conversationName}` : "e.g. Quick Sync"}
                                            value={instantTitle}
                                            onChange={(e) => setInstantTitle(e.target.value)}
                                            className="w-full bg-transparent text-white pl-10 pr-4 py-3.5 rounded-xl focus:outline-none font-medium text-sm"
                                        />
                                    </div>
                                </div>
                            )}

                            <div className="p-4 rounded-2xl bg-white/2 border border-white/5 flex items-center justify-between">
                                <div className="flex items-center gap-3">
                                    <div className={`w-9 h-9 rounded-xl flex items-center justify-center ${
                                        allowGuests ? 'bg-[#F59E0B]/10 text-[#F59E0B]' : 'bg-[#6B7280]/10 text-[#6B7280]'
                                    }`}>
                                        {allowGuests ? <Users size={18} /> : <ShieldCheck size={18} />}
                                    </div>
                                    <div className="flex flex-col">
                                        <span className="text-sm font-bold text-white">Allow Guest Access</span>
                                        <span className="text-xs text-white/40">
                                            {allowGuests ? 'Anyone with the link can join' : 'Only logged-in users can join'}
                                        </span>
                                    </div>
                                </div>
                                <button
                                    type="button"
                                    onClick={() => setAllowGuests(!allowGuests)}
                                    className={`relative inline-flex h-6 w-11 flex-shrink-0 cursor-pointer rounded-full border border-transparent transition-colors duration-200 ease-in-out focus:outline-none ${
                                        allowGuests ? 'bg-[#F59E0B]' : 'bg-[#2A2724]'
                                    }`}
                                >
                                    <span
                                        className={`pointer-events-none inline-block h-5 w-5 transform rounded-full bg-white shadow ring-0 transition duration-200 ease-in-out ${
                                            allowGuests ? 'translate-x-5' : 'translate-x-0'
                                        }`}
                                    />
                                </button>
                            </div>

                            <div className="p-4 rounded-2xl bg-white/2 border border-white/5 flex items-center justify-between">
                                <div className="flex items-center gap-3">
                                    <div className={`w-9 h-9 rounded-xl flex items-center justify-center ${
                                        approveParticipants ? 'bg-[#6366F1]/10 text-[#6366F1]' : 'bg-[#6B7280]/10 text-[#6B7280]'
                                    }`}>
                                        <ShieldCheck size={18} />
                                    </div>
                                    <div className="flex flex-col">
                                        <span className="text-sm font-bold text-white">Admit Participants</span>
                                        <span className="text-xs text-white/40">
                                            {approveParticipants ? 'Host must manually approve guests' : 'Guests can join automatically'}
                                        </span>
                                    </div>
                                </div>
                                <button
                                    type="button"
                                    onClick={() => setApproveParticipants(!approveParticipants)}
                                    className={`relative inline-flex h-6 w-11 flex-shrink-0 cursor-pointer rounded-full border border-transparent transition-colors duration-200 ease-in-out focus:outline-none ${
                                        approveParticipants ? 'bg-[#6366F1]' : 'bg-[#2A2724]'
                                    }`}
                                >
                                    <span
                                        className={`pointer-events-none inline-block h-5 w-5 transform rounded-full bg-white shadow ring-0 transition duration-200 ease-in-out ${
                                            approveParticipants ? 'translate-x-5' : 'translate-x-0'
                                        }`}
                                    />
                                </button>
                            </div>
                        </div>
                    )}

                    {liveCallState ? (
                        <div className="flex flex-col gap-4">
                            <div className="p-4 rounded-2xl bg-white/3 border border-white/5">
                                <span className="text-white font-black font-clash block">
                                    {liveCallState.title}
                                </span>
                                <span className="text-white/60 text-xs mt-1 block">
                                    Live now in this drawer
                                </span>
                                <div className="flex flex-wrap gap-2 mt-4">
                                    {liveCallState.participantIds.slice(0, 6).map((id, idx) => (
                                        <div key={id} className={`w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold ${
                                            idx === 0 ? 'bg-[#6366F1] text-white' : 'bg-[#2A2724] text-white'
                                        }`}>
                                            {idx === 0 ? 'You' : (id.slice(0, 2).toUpperCase())}
                                        </div>
                                    ))}
                                </div>
                                <div className="flex items-center gap-2 mt-6">
                                    <button className="p-2 rounded-xl bg-white/5 hover:bg-white/10 text-white transition-all">
                                        <Mic size={16} />
                                    </button>
                                    <button className="p-2 rounded-xl bg-white/5 hover:bg-white/10 text-white transition-all">
                                        <VideoIcon size={16} />
                                    </button>
                                    <button
                                        onClick={async () => {
                                            await navigator.clipboard.writeText(typeof window !== 'undefined' ? `${window.location.origin}${liveCallUrl}` : liveCallUrl);
                                            toast.success('Invite link copied');
                                        }}
                                        className="ml-auto border border-white/5 hover:border-white/10 bg-white/2 hover:bg-white/5 px-4 py-2 rounded-xl text-white font-bold text-xs flex items-center gap-1.5 transition-all"
                                    >
                                        <Copy size={14} />
                                        <span>Copy Invite</span>
                                    </button>
                                </div>
                            </div>
                            <button
                                onClick={() => router.push(`${liveCallUrl}?caller=true&view=dock`)}
                                className="w-full bg-[#6366F1] hover:bg-[#4F46E5] text-white font-black py-4 rounded-2xl text-sm flex items-center justify-center gap-2 transition-all shadow-[0_8px_20px_-6px_rgba(99,102,241,0.4)]"
                            >
                                <ExternalLink size={16} />
                                <span>Expand to Full Call UI</span>
                            </button>
                        </div>
                    ) : !showScheduleForm && !showJoinWithId ? (
                        <div className="flex flex-col gap-4">
                            <div className="flex gap-4">
                                <button
                                    onClick={handleStartPublicCall}
                                    disabled={creating}
                                    className="flex-1 bg-[#6366F1] hover:bg-[#4F46E5] disabled:bg-[#6366F1]/50 text-white py-4 rounded-2xl font-black text-sm flex items-center justify-center gap-2 transition-all shadow-[0_8px_20px_-6px_rgba(99,102,241,0.4)]"
                                >
                                    {creating ? (
                                        <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                                    ) : (
                                        <Plus size={18} />
                                    )}
                                    <span>{isScopedLaunch ? 'Start in This Chat' : isNoteLaunch ? 'Start Note Huddle' : isTaskLaunch ? 'Start Task Huddle' : 'Start Now'}</span>
                                </button>
                                {!isScopedLaunch && !isNoteLaunch && !isTaskLaunch && (
                                    <button
                                        onClick={() => setShowScheduleForm(true)}
                                        className="flex-1 border border-white/5 hover:border-white/10 hover:bg-white/5 bg-white/2 text-white py-4 rounded-2xl font-black text-sm flex items-center justify-center gap-2 transition-all"
                                    >
                                        <Calendar size={18} />
                                        <span>Schedule</span>
                                    </button>
                                )}
                            </div>
                        </div>
                    ) : (
                        <div className="flex flex-col gap-6">
                            <div className="relative flex flex-col gap-1.5 w-full">
                                <label className="text-[11px] font-black text-white/40 uppercase tracking-wider font-mono">Meeting Title</label>
                                <div className="relative flex items-center bg-[#161412] border border-white/5 hover:bg-white/4 hover:border-white/10 rounded-xl transition-all">
                                    <span className="absolute left-3 text-[#6366F1]">
                                        <Type size={18} />
                                    </span>
                                    <input
                                        type="text"
                                        placeholder="e.g. Weekly Sync"
                                        value={scheduleTitle}
                                        onChange={(e) => setScheduleTitle(e.target.value)}
                                        className="w-full bg-transparent text-white pl-10 pr-4 py-3.5 rounded-xl focus:outline-none font-medium text-sm"
                                    />
                                </div>
                            </div>

                            <div className="relative flex flex-col gap-1.5 w-full">
                                <label className="text-[11px] font-black text-white/40 uppercase tracking-wider font-mono">Start Time</label>
                                <div className="relative flex items-center bg-[#161412] border border-white/5 hover:bg-white/4 hover:border-white/10 rounded-xl transition-all">
                                    <span className="absolute left-3 text-[#F59E0B]">
                                        <Clock size={18} />
                                    </span>
                                    <input
                                        type="datetime-local"
                                        value={scheduleTime}
                                        onChange={(e) => setScheduleTime(e.target.value)}
                                        className="w-full bg-transparent text-white pl-10 pr-4 py-3.5 rounded-xl focus:outline-none font-medium text-sm"
                                        style={{ colorScheme: 'dark' }}
                                    />
                                </div>
                            </div>

                            <button
                                onClick={handleScheduleCall}
                                disabled={creating}
                                className="w-full py-4 rounded-2xl font-black text-sm text-black bg-[#F59E0B] hover:bg-[#eab308] disabled:bg-[#F59E0B]/50 flex items-center justify-center gap-2 transition-all shadow-[0_8px_20px_-6px_rgba(245,158,11,0.4)]"
                            >
                                {creating ? (
                                    <div className="w-5 h-5 border-2 border-black/30 border-t-black rounded-full animate-spin" />
                                ) : (
                                    <span>Schedule Session</span>
                                )}
                            </button>
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
};
