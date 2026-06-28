'use client';

import React, { useEffect, useState } from 'react';
import { CallService } from '@/lib/services/call';
import { UsersService } from '@/lib/services/users';
import { useAuth } from '@/lib/auth';
import { useRouter } from 'next/navigation';
import { 
    Phone, 
    Video, 
    PhoneIncoming, 
    PhoneOutgoing, 
    PhoneCall, 
    Trash2, 
    RefreshCw, 
    History,
    Pin,
    Lock,
    Link as LinkIcon
} from 'lucide-react';
import toast from 'react-hot-toast';
import { seedIdentityCache } from '@/lib/identity-cache';
import { useSection } from '@/context/SectionContext';
import { ShareLockButton } from '../share/ShareLockButton';
import { useResourcePins } from '@/context/ResourcePinContext';
import { useUnifiedDrawer } from '@/context/UnifiedDrawerContext';

export const CallHistory = ({ onNewCall }: { onNewCall?: () => void }) => {
    const { user } = useAuth();
    const [calls, setCalls] = useState<any[]>([]);
    const [activeCalls, setActiveCalls] = useState<any[]>([]);
    const [loading, setLoading] = useState(true);
    const router = useRouter();
    
    const [isDesktop, setIsDesktop] = useState(false);
    useEffect(() => {
        const media = window.matchMedia('(min-width: 1024px)');
        setIsDesktop(media.matches);
        const listener = (e: MediaQueryListEvent) => setIsDesktop(e.matches);
        media.addEventListener('change', listener);
        return () => media.removeEventListener('change', listener);
    }, []);
    
    const { setActiveDetail } = useSection();
    const { open: openUnified } = useUnifiedDrawer();

    const { isPinned: isResourcePinned, togglePin } = useResourcePins();

    const handlePinToggle = async (call: any, e?: React.MouseEvent) => {
      if (e) e.stopPropagation();
      try {
        await togglePin({
          resourceType: 'call',
          resourceId: call.$id,
          ownerId: call.callerId,
          rowIsPinned: call.isPinned,
          setOwnerRowPin: async (pinned) => {
              // Update logic if needed
          },
        });
      } catch (err: any) {
        console.error('Failed to toggle pin:', err);
      }
    };

    const loadCalls = React.useCallback(async () => {
        if (!user) return;
        setLoading(true);
        try {
            const [history, ongoing] = await Promise.all([
                CallService.getCallHistory(user.$id),
                CallService.getActiveCalls(user.$id)
            ]);
            
            const enrich = async (callList: any[]) => {
                return await Promise.all(callList.map(async (call: any) => {
                    const isCaller = call.callerId === user.$id;
                    const otherId = isCaller ? call.receiverId : call.callerId;
                    
                    try {
                        const profile = otherId ? await UsersService.getProfileById(otherId) : null;
                        if (profile) seedIdentityCache(profile);
                        return {
                            ...call,
                            otherUser: profile || { 
                                username: call.isLink ? (call.title || 'Public Link') : 'User', 
                                displayName: call.isLink ? (call.title || 'Public Link Session') : undefined,
                                $id: otherId 
                            },
                            direction: isCaller ? 'outgoing' : 'incoming'
                        };
                    } catch (_e: unknown) {
                        return { 
                            ...call, 
                            otherUser: { 
                                username: call.isLink ? (call.title || 'Public Link') : 'User', 
                                $id: otherId 
                            }, 
                            direction: isCaller ? 'outgoing' : 'incoming' 
                        };
                    }
                }));
            };
            
            const [enrichedHistory, enrichedActive] = await Promise.all([
                enrich(history),
                enrich(ongoing)
            ]);

            setCalls(enrichedHistory);
            setActiveCalls(enrichedActive);
        } catch (error: unknown) {
            console.error('Failed to load call history:', error);
            toast.error('Failed to load calls');
        } finally {
            setLoading(false);
        }
    }, [user]);

    useEffect(() => {
        if (user) {
            loadCalls();
        }
    }, [user, loadCalls]);

    const handleDeleteCall = (callId: string) => {
        openUnified('delete-confirm', {
            title: 'Delete Huddle',
            description: 'Are you sure you want to delete this huddle call record? This action cannot be undone.',
            confirmLabel: 'Delete',
            onConfirm: async () => {
                try {
                    await CallService.deleteCall(callId);
                    toast.success('Call deleted');
                    loadCalls();
                } catch (_e) {
                    toast.error('Failed to delete call');
                }
            }
        });
    };

    const startCall = (call: any) => {
        if (call.isLink) {
            if (isDesktop) {
                setActiveDetail({ type: 'call', id: call.$id, data: call });
            } else {
                router.push(`/connect/call/${call.$id}`);
            }
            return;
        }
        if (!call.otherUser?.$id) {
            toast.error("User ID not available for this call");
            return;
        }
        router.push(`/connect/chat/${call.otherUser.$id}`);
    };

    if (loading) {
        return (
            <div className="flex flex-col gap-4">
                {[1, 2, 3].map((i) => (
                    <div key={i} className="p-4 rounded-2xl bg-white/2 border border-white/5 animate-pulse flex items-center gap-4">
                        <div className="w-10 h-10 bg-white/5 rounded-full" />
                        <div className="flex-1 space-y-2">
                            <div className="h-4 bg-white/10 rounded w-1/3" />
                            <div className="h-3 bg-white/5 rounded w-1/2" />
                        </div>
                    </div>
                ))}
            </div>
        );
    }

    return (
        <div className="flex flex-col gap-4 relative min-h-[50vh] w-full">
            <div className="flex justify-between items-center">
                <span className="text-xs font-bold text-[#9B9691] uppercase tracking-wider font-mono">
                    {activeCalls.length > 0 ? `Ongoing Sessions (${activeCalls.length})` : 'No active sessions'}
                </span>
                <button 
                    onClick={loadCalls} 
                    className="p-1 rounded-lg text-white/60 hover:text-white hover:bg-white/5 transition-all"
                >
                    <RefreshCw size={16} />
                </button>
            </div>

            {activeCalls.length > 0 && (
                <div className="space-y-3 mb-4">
                    {activeCalls.map((call) => (
                        <div 
                            key={call.$id} 
                            onClick={() => startCall(call)}
                            className="p-4 rounded-2xl border border-[#6366F1] bg-[#161412] hover:bg-[#6366F1]/5 hover:-translate-y-0.5 transition-all duration-200 cursor-pointer flex items-center justify-between"
                        >
                            <div className="flex items-center gap-4">
                                <div className="relative">
                                    <div className="w-10 h-10 rounded-full bg-[#6366F1] text-white flex items-center justify-center">
                                        {call.type === 'video' ? <Video size={18} /> : <Phone size={18} />}
                                    </div>
                                    <span className="absolute bottom-0 right-0 w-2.5 h-2.5 bg-[#10B981] border border-[#161412] rounded-full" />
                                </div>
                                <div className="flex flex-col gap-0.5">
                                    <span className="font-bold text-[#6366F1] text-sm">
                                        {call.otherUser.displayName || call.otherUser.username}
                                    </span>
                                    <span className="text-xs text-[#9B9691]">
                                        Started {new Date(call.startedAt).toLocaleTimeString()}
                                    </span>
                                </div>
                            </div>
                            <div className="flex items-center gap-0.5" onClick={(e) => e.stopPropagation()}>
                                <button 
                                    onClick={(e) => handlePinToggle(call, e)} 
                                    className={`p-1.5 rounded-lg transition-all duration-200 ${isResourcePinned('call', call.$id, call.callerId, call.isPinned) ? 'text-[#F59E0B] bg-[#F59E0B]/5' : 'text-white/20 hover:text-[#F59E0B] hover:bg-[#F59E0B]/5'}`}
                                >
                                    <Pin size={16} className={isResourcePinned('call', call.$id, call.callerId, call.isPinned) ? 'fill-[#F59E0B]' : ''} />
                                </button>
                                <ShareLockButton 
                                    resourceType="call"
                                    resourceId={call.$id}
                                    isPublic={!!call.isPublic}
                                    isGuest={!!call.isGuest}
                                    accentColor="#6366F1"
                                    onPublished={() => loadCalls()}
                                />
                                <button 
                                    onClick={(e) => { e.stopPropagation(); handleDeleteCall(call.$id); }} 
                                    className="p-1.5 rounded-lg text-[#EF4444]/40 hover:text-[#EF4444] hover:bg-[#EF4444]/10 transition-all"
                                    title="Delete Permanently"
                                >
                                    <Trash2 size={16} />
                                </button>
                            </div>
                        </div>
                    ))}
                </div>
            )}

            <div className="border-t border-white/5 my-2" />
            
            <div className="flex justify-between items-center mb-2">
                <span className="text-xs font-bold text-[#9B9691] uppercase tracking-wider font-mono">Recent History</span>
                <div className="flex items-center gap-1 text-white/50 cursor-help" title="Call logs are cleared every 7 days">
                    <History size={14} />
                    <span className="text-[10px] font-black tracking-wider uppercase font-mono">7D Retention</span>
                </div>
            </div>

            {calls.filter(c => c.status !== 'ongoing').length === 0 ? (
                <div className="text-center py-12 text-[#9B9691] flex flex-col items-center gap-2">
                    <Phone size={48} className="opacity-40" />
                    <span className="text-sm font-medium">No recent calls</span>
                </div>
            ) : (
                <div className="space-y-3">
                    {calls.filter(c => c.status !== 'ongoing').map((call) => (
                        <div 
                            key={call.$id} 
                            onClick={() => startCall(call)}
                            className="p-4 rounded-2xl border border-white/5 bg-[#161412] hover:bg-white/2 hover:-translate-y-0.5 transition-all duration-200 cursor-pointer flex items-center justify-between"
                        >
                            <div className="flex items-center gap-4">
                                <div className={`w-10 h-10 rounded-full flex items-center justify-center ${
                                    call.status === 'missed' ? 'bg-[#EF4444]/10 text-[#EF4444]' : 'bg-[#6366F1]/10 text-[#6366F1]'
                                }`}>
                                    {call.type === 'video' ? <Video size={18} /> : <Phone size={18} />}
                                </div>
                                <div className="flex flex-col gap-0.5">
                                    <span className="font-bold text-white text-sm">
                                        {call.otherUser.displayName || call.otherUser.username}
                                    </span>
                                    <div className="flex items-center gap-2 mt-0.5">
                                        {call.direction === 'outgoing' ? <PhoneOutgoing size={12} className="text-[#9B9691]" /> : <PhoneIncoming size={12} className="text-[#9B9691]" />}
                                        <span className="text-xs text-[#9B9691]">
                                            {new Date(call.startedAt).toLocaleDateString()}
                                        </span>
                                        {call.status === 'missed' && (
                                            <span className="px-1.5 py-0.5 text-[10px] font-bold uppercase tracking-wider text-[#EF4444] border border-[#EF4444]/20 rounded-md bg-[#EF4444]/5">
                                                Missed
                                            </span>
                                        )}
                                    </div>
                                </div>
                            </div>
                            <div>
                                <button 
                                    onClick={(e) => { e.stopPropagation(); handleDeleteCall(call.$id); }} 
                                    className="p-1.5 rounded-lg text-white/30 hover:text-white/80 hover:bg-white/5 transition-all"
                                >
                                    <Trash2 size={16} />
                                </button>
                            </div>
                        </div>
                    ))}
                </div>
            )}
            
            {/* Floating Action Button */}
            <button 
                onClick={() => onNewCall ? onNewCall() : router.push('/chats')}
                className="fixed bottom-20 right-6 w-14 h-14 rounded-full bg-[#6366F1] hover:bg-[#4F46E5] text-white flex items-center justify-center shadow-lg hover:scale-105 active:scale-95 transition-all z-20"
                aria-label="add call"
            >
                <PhoneCall size={24} />
            </button>
        </div>
    );
};
