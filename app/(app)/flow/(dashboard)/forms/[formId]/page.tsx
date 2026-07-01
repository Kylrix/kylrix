'use client';

import React, { useEffect, useState, use, useCallback } from 'react';
import { useAuth } from '@/context/auth/AuthContext';
import { FormsService } from '@/lib/services/forms';
import { Forms } from '@/generated/appwrite/types';
import Link from 'next/link';
import FormDialog from '@/components/forms/FormDialog';
import SubmissionViewer from '@/components/forms/SubmissionViewer';
import { createGhostNoteForResource, promoteGhostResourceThreadToStory } from '@/lib/actions/client-ops';
import { createComment, listComments, getNote } from '@/lib/appwrite/note';
import { client } from '@/lib/appwrite/client';
import { APPWRITE_CONFIG } from '@/lib/appwrite/config';
import { useToast } from '@/components/ui/Toast';
import { AppwriteService } from '@/lib/appwrite';
import { useUnifiedDrawer } from '@/context/UnifiedDrawerContext';
import { getResourceCollaboratorsSecure } from '@/lib/actions/secure-ops';
import { account } from '@/lib/appwrite/client';
import { 
  MessageSquare, 
  Clock, 
  FileText, 
  Globe, 
  Send, 
  Share2, 
  ArrowLeft,
  Copy,
  Edit,
  ExternalLink,
  BarChart2
} from 'lucide-react';
import { MultiSectionContainer } from '@/context/SectionContext';
import { IdentityAvatar } from '@/components/common/IdentityBadge';

export default function FormDetailsPage({ params, formId: propFormId, onBack }: { params?: Promise<{ formId: string }>; formId?: string; onBack?: () => void }) {
    const resolvedParams = {
        formId: propFormId || (params ? use(params).formId : '')
    };
    const [rawForm, setRawForm] = useState<Forms | null>(null);
    const [loading, setLoading] = useState(true);

    const form = rawForm || (loading ? {
        $id: resolvedParams.formId as string,
        title: 'Loading Form...',
        status: 'draft',
        schema: '[]',
        $createdAt: new Date().toISOString(),
        $updatedAt: new Date().toISOString(),
    } as any : null);
    const [tab, setTab] = useState(0);
    const [isEditing, setIsEditing] = useState(false);

    // Huddle Discussion State & Effects
    const { showSuccess, showError } = useToast();
    const { user } = useAuth();
    const [huddleMessages, setHuddleMessages] = useState<any[]>([]);
    const [huddleLoading, setHuddleLoading] = useState(false);
    const [huddleSending, setHuddleSending] = useState(false);
    const [isHuddleInit, setIsHuddleInit] = useState(false);
    const [huddleTimeRemaining, setHuddleTimeRemaining] = useState('');
    const [inputText, setInputText] = useState('');
    const huddleMessageEndRef = React.useRef<HTMLDivElement>(null);

    const { open: openUnified } = useUnifiedDrawer();
    const [collaborators, setCollaborators] = useState<any[]>([]);
    const [loadingCollaborators, setLoadingCollaborators] = useState(false);

    const fetchCollaborators = useCallback(async () => {
        if (!resolvedParams.formId) return;
        setLoadingCollaborators(true);
        try {
            const { jwt } = await account.createJWT();
            const { collaborators: collabs } = await getResourceCollaboratorsSecure({
                resourceId: resolvedParams.formId,
                resourceType: 'form',
                jwt
            });
            setCollaborators(collabs || []);
        } catch (err) {
            console.error('Failed to fetch form collaborators:', err);
        } finally {
            setLoadingCollaborators(false);
        }
    }, [resolvedParams.formId]);

    useEffect(() => {
        fetchCollaborators();
    }, [fetchCollaborators]);

    // Check if Huddle is initialized
    useEffect(() => {
        if (!resolvedParams.formId) return;
        let active = true;

        const checkHuddle = async () => {
            try {
                const note = await getNote(resolvedParams.formId);
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
    }, [resolvedParams.formId]);

    // Load comments and subscribe
    useEffect(() => {
        if (!resolvedParams.formId || !isHuddleInit) return;
        let active = true;
        setHuddleLoading(true);

        const loadHuddleComments = async () => {
            try {
                const res = await listComments(resolvedParams.formId);
                if (!active) return;
                const msgs = await Promise.all(
                    res.rows.map(async (doc: any) => {
                        let senderName = 'Collaborator';
                        if (user && doc.userId === user.$id) {
                            senderName = user.name || 'You';
                        } else {
                            try {
                                const profile = await AppwriteService.getProfile(doc.userId);
                                if (profile) senderName = profile.name || 'Collaborator';
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

                if (events.some((e: string) => e.includes('.create')) && payload.noteId === resolvedParams.formId) {
                    let senderName = 'Collaborator';
                    if (user && payload.userId === user.$id) {
                        senderName = user.name || 'You';
                    } else {
                        try {
                            const profile = await AppwriteService.getProfile(payload.userId);
                            if (profile) senderName = profile.name || 'Collaborator';
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
    }, [resolvedParams.formId, isHuddleInit, user]);

    useEffect(() => {
        huddleMessageEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    }, [huddleMessages]);

    const handleInitHuddle = async () => {
        if (!form) return;
        setHuddleLoading(true);
        try {
            await createGhostNoteForResource(resolvedParams.formId, 'form', `${form.title} Discussion`);
            setIsHuddleInit(true);
            showSuccess('Form huddle thread initialized!');
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
        setHuddleSending(true);
        try {
            await createComment(resolvedParams.formId, inputText.trim());
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
            await promoteGhostResourceThreadToStory(resolvedParams.formId, 'form');
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

    const fetchForm = useCallback(async () => {
        setLoading(true);
        try {
            const data = await FormsService.getForm(resolvedParams.formId);
            setRawForm(data);
        } catch (err) {
            console.error("Failed to fetch form", err);
        } finally {
            setLoading(false);
        }
    }, [resolvedParams.formId]);

    useEffect(() => {
        fetchForm();
    }, [fetchForm]);

    const handleCopyLink = () => {
        const url = `${window.location.origin}/flow/form/${resolvedParams.formId}`;
        navigator.clipboard.writeText(url);
        showSuccess('Link Copied', 'Public link copied to clipboard.');
    };

    if (!loading && !form) {
      return (
        <div className="p-6 text-center font-satoshi text-red-500">
          Form not found.
        </div>
      );
    }

    const getStatusColor = (status: string) => {
        switch (status) {
            case 'published': return 'text-[#10B981] border-[#10B981]';
            case 'draft': return 'text-[#FFB020] border-[#FFB020]';
            case 'archived': return 'text-[#D14343] border-[#D14343]';
            default: return 'text-[#9B9691] border-[#34322F]';
        }
    };

    return (
        <div className="animate-fadeIn min-h-screen bg-[#000000] p-4 md:p-8 font-satoshi relative">
            {/* Ambient background glow */}
            <div className="absolute inset-0 bg-[radial-gradient(circle_at_50%_-20%,rgba(99,102,241,0.08),transparent_60%)] pointer-events-none" />

            <MultiSectionContainer panels={['projects', 'huddles', 'goals']}>
            {/* Header Toolbar */}
            <div className="relative z-10 flex flex-col md:flex-row gap-4 justify-between items-start md:items-center mb-8">
                <div className="flex items-center gap-3.5">
                    {onBack ? (
                        <button
                            type="button"
                            onClick={onBack}
                            className="p-2.5 bg-[#161412] hover:bg-[#1C1A18] text-[#6366F1] border border-[#34322F] hover:border-[#6366F1] rounded-xl transition-all"
                        >
                            <ArrowLeft className="w-5 h-5" />
                        </button>
                    ) : (
                        <Link
                            href="/flow/forms"
                            className="p-2.5 bg-[#161412] hover:bg-[#1C1A18] text-[#6366F1] border border-[#34322F] hover:border-[#6366F1] rounded-xl transition-all inline-flex items-center justify-center"
                        >
                            <ArrowLeft className="w-5 h-5" />
                        </Link>
                    )}
                    <div>
                        <div className="flex items-center gap-2 flex-wrap">
                            <h1 className="text-xl md:text-2xl font-black font-clash text-white tracking-tight uppercase">
                              {form.title}
                            </h1>
                            {!loading && (
                                <span className={`px-2 py-0.5 rounded text-[9px] font-black border uppercase tracking-wider font-mono ${getStatusColor(form.status || 'draft')}`}>
                                    {form.status || 'unknown'}
                                </span>
                            )}
                        </div>
                        {!loading && (
                            <span className="block text-xs text-[#9B9691] font-medium font-satoshi mt-0.5">Form ID: {form.$id}</span>
                        )}
                    </div>
                </div>

                <div className="flex flex-wrap gap-2.5 w-full md:w-auto">
                    {form.status === 'published' && (
                        <button 
                            type="button"
                            onClick={handleCopyLink}
                            className="flex items-center gap-1.5 px-4 py-2 text-xs font-bold bg-[#161412] border border-[#34322F] text-white hover:border-[#6366F1] rounded-xl transition-all font-satoshi"
                        >
                            <Copy className="w-3.5 h-3.5" />
                            <span>Copy Link</span>
                        </button>
                    )}
                    <button 
                        type="button"
                        onClick={() => openUnified('share-note', {
                            resourceId: resolvedParams.formId,
                            resourceType: 'form',
                            resourceTitle: form.title,
                            onShared: () => fetchCollaborators()
                        })}
                        className="flex items-center gap-1.5 px-4 py-2 text-xs font-bold bg-[#161412] border border-[#34322F] text-white hover:border-[#6366F1] rounded-xl transition-all font-satoshi"
                    >
                        <Share2 className="w-3.5 h-3.5" />
                        <span>Share Form</span>
                    </button>
                    <button 
                        type="button"
                        onClick={() => setIsEditing(true)}
                        className="flex items-center gap-1.5 px-5 py-2.5 text-xs font-extrabold bg-[#6366F1] text-black shadow-[0_8px_30px_rgb(99,102,241,0.2)] hover:bg-[#5254E8] hover:translate-y-[-1px] rounded-xl transition-all font-satoshi"
                    >
                        <Edit className="w-3.5 h-3.5" />
                        <span>Edit Design</span>
                    </button>
                </div>
            </div>

            {/* Live Status Flag */}
            {form.status === 'published' && (
                <div className="relative z-10 p-4 mb-6 rounded-2xl bg-[#161412] border border-[#10B981] flex items-center justify-between gap-3 shadow-[0_4px_24px_rgba(16,185,129,0.05)]">
                    <div className="flex items-center gap-2">
                        <span className="w-2 h-2 rounded-full bg-[#10B981] shadow-[0_0_8px_#10B981] animate-pulse" />
                        <span className="text-[10px] font-black text-[#10B981] tracking-wider uppercase font-mono">FORM IS LIVE & ACCEPTING RESPONSES</span>
                    </div>
                    <Link href={`/flow/form/${form.$id}`} target="_blank" className="p-1 text-[#10B981] hover:text-white transition-colors">
                        <ExternalLink className="w-4 h-4" />
                    </Link>
                </div>
            )}

            {/* Navigation Tabs */}
            <div className="relative z-10 flex border-b border-[#34322F] mb-6 gap-2 font-satoshi text-xs overflow-x-auto shrink-0 scrollbar-none">
                {[
                    { id: 0, label: 'RESPONSES', icon: <BarChart2 className="w-4 h-4" /> },
                    { id: 1, label: 'PREVIEW & SCHEMA', icon: <FileText className="w-4 h-4" /> },
                    { id: 2, label: 'DISCUSSION', icon: <MessageSquare className="w-4 h-4" /> },
                ].map((item) => {
                    const isActive = tab === item.id;
                    return (
                        <button
                            key={item.id}
                            type="button"
                            onClick={() => setTab(item.id)}
                            className={`flex items-center gap-2 px-4 py-3 font-extrabold border-b-2 transition-all whitespace-nowrap ${
                                isActive 
                                    ? 'border-[#6366F1] text-[#6366F1]' 
                                    : 'border-transparent text-[#9B9691] hover:text-white'
                            }`}
                        >
                            {item.icon}
                            <span>{item.label}</span>
                        </button>
                    );
                })}
            </div>

            {/* Tab Contents */}
            <div className="relative z-10">
                {/* Responses Tab */}
                {tab === 0 && (
                    <div className="animate-fadeIn">
                        {loading ? (
                            <div className="space-y-4">
                                {[1, 2, 3].map((i) => (
                                    <div key={i} className="h-16 bg-white/5 rounded-2xl animate-pulse" />
                                ))}
                            </div>
                        ) : (
                            <SubmissionViewer formId={resolvedParams.formId} formSchema={form.schema} />
                        )}
                    </div>
                )}

                {/* Preview & Schema Tab */}
                {tab === 1 && (
                    <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 items-start animate-fadeIn">
                        {/* Schema Preview */}
                        <div className="lg:col-span-2 p-5 md:p-6 rounded-[28px] bg-[#161412] border border-[#34322F] shadow-[0_12px_32px_rgba(0,0,0,0.4)]">
                            <span className="text-[10px] font-black text-[#9B9691] uppercase tracking-wider mb-4 block font-mono">SCHEMA PREVIEW</span>
                            <div className="flex flex-col gap-4">
                                {loading ? (
                                    <div className="space-y-3">
                                        <div className="w-1/3 h-4 bg-white/5 rounded animate-pulse" />
                                        <div className="w-full h-10 bg-white/5 rounded-xl animate-pulse" />
                                    </div>
                                ) : JSON.parse(form.schema || '[]').length === 0 ? (
                                    <div className="text-xs text-[#9B9691] italic font-satoshi py-4">No fields defined. Click Edit Design to build your schema.</div>
                                ) : JSON.parse(form.schema || '[]').map((field: any) => (
                                    <div key={field.id}>
                                        <span className="block text-xs font-bold text-white mb-1.5 font-satoshi">
                                            {field.label} {field.required && <span className="text-red-500">*</span>}
                                        </span>
                                        <div className="p-3 rounded-xl bg-black border border-[#34322F] text-[#9B9691] text-xs font-satoshi">
                                            {field.placeholder || `Input for ${field.type}...`}
                                        </div>
                                    </div>
                                ))}
                            </div>
                        </div>

                        {/* Raw JSON & Collaborators Side columns */}
                        <div className="flex flex-col gap-6">
                            {/* Raw JSON */}
                            <div className="p-5 md:p-6 rounded-[28px] bg-[#161412] border border-[#34322F] shadow-[0_12px_32px_rgba(0,0,0,0.4)]">
                                <span className="text-[10px] font-black text-[#9B9691] uppercase tracking-wider mb-3 block font-mono">RAW JSON</span>
                                {loading ? (
                                    <div className="h-32 bg-white/5 rounded-xl animate-pulse" />
                                ) : (
                                    <pre className="text-[10px] text-[#9B9691] overflow-auto max-h-[220px] font-mono bg-black border border-[#34322F] p-3 rounded-xl scrollbar-thin">
                                        {JSON.stringify(JSON.parse(form.schema || '[]'), null, 2)}
                                    </pre>
                                )}
                            </div>

                            {/* Collaborators */}
                            <div className="p-5 md:p-6 rounded-[28px] bg-[#161412] border border-[#34322F] shadow-[0_12px_32px_rgba(0,0,0,0.4)]">
                                <div className="flex justify-between items-center mb-3.5">
                                    <span className="text-[10px] font-black text-[#9B9691] uppercase tracking-wider font-mono">COLLABORATORS</span>
                                    {!loading && (
                                        <button 
                                            type="button"
                                            onClick={() => openUnified('share-note', {
                                                resourceId: resolvedParams.formId,
                                                resourceType: 'form',
                                                resourceTitle: form.title,
                                                onShared: () => fetchCollaborators()
                                            })}
                                            className="text-[#10B981] font-bold text-xs hover:underline font-satoshi"
                                        >
                                            + Manage
                                        </button>
                                    )}
                                </div>
                                
                                {loading ? (
                                    <div className="w-5 h-5 border-2 border-[#10B981] border-t-transparent rounded-full animate-spin" />
                                ) : loadingCollaborators ? (
                                    <div className="w-5 h-5 border-2 border-[#10B981] border-t-transparent rounded-full animate-spin" />
                                ) : collaborators.length === 0 ? (
                                    <span className="text-xs text-[#9B9691] italic block font-satoshi">
                                        No collaborators added yet.
                                    </span>
                                ) : (
                                    <div className="space-y-2">
                                        {collaborators.map((profile) => (
                                            <div 
                                                key={profile.$id || profile.userId} 
                                                onClick={() => openUnified('share-note', {
                                                    resourceId: resolvedParams.formId,
                                                    resourceType: 'form',
                                                    resourceTitle: form.title,
                                                    initialCollaborator: profile,
                                                    onShared: () => fetchCollaborators()
                                                })}
                                                className="flex items-center gap-2 p-2 rounded-xl bg-[#1C1A18] border border-[#34322F] cursor-pointer hover:border-[#6366F1] transition-all"
                                            >
                                                <IdentityAvatar
                                                    fileId={profile.avatar || profile.profilePicId || null}
                                                    alt={profile.displayName || profile.username}
                                                    fallback={(profile.displayName || profile.username || 'U').charAt(0).toUpperCase()}
                                                    size={26}
                                                />
                                                <div className="flex-1 min-w-0">
                                                    <span className="block text-xs font-bold text-white truncate font-satoshi">
                                                        {profile.displayName || profile.username}
                                                    </span>
                                                    <span className="block text-[9px] text-[#9B9691] font-mono">
                                                        {profile.permissionLevel || 'Viewer'}
                                                    </span>
                                                </div>
                                            </div>
                                        ))}
                                    </div>
                                )}
                            </div>
                        </div>
                    </div>
                )}

                {/* Discussion Tab */}
                {tab === 2 && (
                    <div className="flex flex-col h-[520px] bg-[#161412] rounded-[28px] border border-[#34322F] shadow-[0_12px_32px_rgba(0,0,0,0.4)] overflow-hidden animate-fadeIn relative">
                        {/* Discussion Header */}
                        <div className="flex justify-between items-center p-4 border-b border-[#34322F] bg-black shrink-0 relative z-10">
                            <span className="text-xs font-bold text-white font-clash uppercase tracking-wider">Public Huddle Thread</span>
                            {isHuddleInit && huddleTimeRemaining && (
                                <div className="flex items-center gap-2">
                                    <div className="flex items-center gap-1 text-[#FFB020] font-mono text-[10px] font-bold">
                                        <Clock className="w-3.5 h-3.5" />
                                        <span>{huddleTimeRemaining}</span>
                                    </div>
                                    <button
                                        type="button"
                                        onClick={handleSaveHuddleAsStory}
                                        className="flex items-center gap-1.5 px-3 py-1 bg-[#1C1A18] border border-[#34322F] hover:border-[#EC4899] text-[#EC4899] font-bold text-[10px] rounded-xl transition-all font-satoshi uppercase tracking-wider"
                                    >
                                        <FileText className="w-3.5 h-3.5" />
                                        <span>Save Story</span>
                                    </button>
                                </div>
                            )}
                        </div>

                        {/* Discussion Body */}
                        <div className="flex-1 min-h-0 flex flex-col relative">
                            {huddleLoading && (
                                <div className="absolute inset-0 flex items-center justify-center bg-black/70 z-20">
                                    <div className="w-6 h-6 border-2 border-[#6366F1] border-t-transparent rounded-full animate-spin" />
                                </div>
                            )}

                            {!isHuddleInit ? (
                                <div className="flex-1 flex flex-col items-center justify-center p-6 text-center">
                                    <div className="w-12 h-12 rounded-xl flex items-center justify-center bg-[#1C1A18] border border-[#34322F] text-[#6366F1] mb-3">
                                        <Globe className="w-5 h-5" />
                                    </div>
                                    <h3 className="font-extrabold text-white mb-2 font-clash text-sm">Initialize Public Huddle</h3>
                                    <p className="text-xs text-[#9B9691] max-w-xs leading-relaxed mb-4 font-satoshi">
                                        Coordinate form structure, survey target audience, or review field submissions with your collaborators in this temporary real-time public thread. Comments auto-clean in 7 days.
                                    </p>
                                    <button 
                                        type="button"
                                        onClick={handleInitHuddle}
                                        className="px-4 py-2 bg-[#6366F1] text-black font-extrabold text-xs rounded-xl hover:bg-[#5254E8] transition-all font-satoshi shadow-[0_8px_30px_rgb(99,102,241,0.2)] hover:translate-y-[-1px]"
                                    >
                                        Start Huddle
                                    </button>
                                </div>
                            ) : (
                                <>
                                    <div className="flex-1 overflow-y-auto p-4 flex flex-col gap-3 scrollbar-thin">
                                        {huddleMessages.length === 0 ? (
                                            <div className="flex-1 flex items-center justify-center text-xs text-[#9B9691] italic font-satoshi">
                                                No messages yet. Start the discussion!
                                            </div>
                                        ) : (
                                            huddleMessages.map((msg) => {
                                                const isSelf = msg.senderId === user?.$id;
                                                return (
                                                    <div key={msg.id} className={`flex flex-col gap-0.5 max-w-[80%] ${isSelf ? 'align-self-end items-end ml-auto' : 'align-self-start items-start'}`}>
                                                        <span className="text-[9px] font-bold text-white/30 font-mono">{msg.senderName}</span>
                                                        <div className={`p-2.5 rounded-2xl text-xs leading-relaxed border ${
                                                            isSelf 
                                                                ? 'bg-[#6366F1] border-[#6366F1]/20 text-black font-semibold rounded-tr-none' 
                                                                : 'bg-[#1C1A18] border-[#34322F] text-white rounded-tl-none'
                                                        }`}>
                                                            {msg.content}
                                                        </div>
                                                        <span className="text-[8px] text-white/30 font-mono mt-0.5">
                                                            {new Date(msg.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                                                        </span>
                                                    </div>
                                                );
                                            })
                                        )}
                                        <div ref={huddleMessageEndRef} />
                                    </div>

                                    {/* Discussion Input */}
                                    <form onSubmit={handleSendHuddleMessage} className="p-3 border-t border-[#34322F] bg-black flex gap-2 shrink-0">
                                        <input
                                            type="text"
                                            value={inputText}
                                            onChange={(e) => setInputText(e.target.value)}
                                            placeholder="Type huddle message (auto-cleans in 7 days)..."
                                            className="w-full bg-[#161412] border border-[#34322F] rounded-xl text-white px-3 py-2 text-xs font-semibold focus:border-[#6366F1] focus:ring-4 focus:ring-[#6366F1]/10 focus:outline-none transition-all font-satoshi"
                                        />
                                        <button 
                                            type="submit"
                                            disabled={!inputText.trim() || huddleSending}
                                            className="w-9 h-9 flex items-center justify-center bg-[#6366F1] text-black rounded-xl hover:bg-[#5254E8] disabled:bg-[#1C1A18] disabled:text-[#34322F] transition-all shrink-0"
                                        >
                                            <Send className="w-4 h-4" />
                                        </button>
                                    </form>
                                </>
                            )}
                        </div>
                    </div>
                )}
            </div>

            {/* Edit Dialog Integration */}
            {isEditing && (
                <FormDialog 
                    open={isEditing} 
                    onClose={() => setIsEditing(false)} 
                    form={form} 
                    onSaved={fetchForm} 
                />
            )}
            </MultiSectionContainer>
        </div>
    );
}
