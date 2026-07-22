'use client';

import React, { useEffect, useState, useCallback, useRef } from 'react';
import { 
    Plus, 
    Edit, 
    Trash2, 
    ExternalLink, 
    FileText, 
    MoreVertical, 
    Sparkles, 
    History, 
    Settings, 
    Pin, 
    Share2, 
    FolderKanban,
    Lock,
    Link as LinkIcon,
    RefreshCw
} from 'lucide-react';
import { FormsService } from '@/lib/services/forms';
import { DraftsService, FormDraft } from '@/lib/services/drafts';
import { Forms } from '@/generated/appwrite/types';
import Link from 'next/link';
import FormDialog from '@/components/forms/FormDialog';
import FormSettingsDialog from '@/components/forms/FormSettingsDialog';
import { useAuth } from '@/context/auth/AuthContext';
import { useResourcePins } from '@/context/ResourcePinContext';
import { useRouter } from 'next/navigation';
import { useDataNexus } from '@/context/DataNexusContext';
import { SyncStatusDot } from '@/components/ui/SyncStatusDot';
import { toast } from 'react-hot-toast';

import { useUnifiedDrawer } from '@/context/UnifiedDrawerContext';
import { useFAB } from '@/context/FABContext';
import { useSection, MultiSectionContainer } from '@/context/SectionContext';
import { ShareLockButton } from '@/components/share/ShareLockButton';
import { useAccessControlMenuItems } from '@/components/share/AccessControlMenuItems';
import { useContextMenu } from '@/components/ui/ContextMenuContext';

export default function FormsDashboard() {
    const { user } = useAuth();
    const { isPinned: isResourcePinned, togglePin, setLocalPin } = useResourcePins();
    const router = useRouter();
    const { invalidate } = useDataNexus();
    const { open: openDrawer } = useUnifiedDrawer();
    const { setActiveDetail } = useSection();
    const { setConfiguration, resetConfiguration } = useFAB();
    const [forms, setForms] = useState<Forms[]>([]);
    const [offlineDrafts, setOfflineDrafts] = useState<FormDraft[]>([]);
    const [loading, setLoading] = useState(true);
    const [tabValue, setTabValue] = useState(0);
    const [dialogOpen, setDialogOpen] = useState(false);
    const [settingsOpen, setSettingsOpen] = useState(false);
    const [selectedForm, setSelectedForm] = useState<Forms | null>(null);
    const [selectedDraft, setSelectedDraft] = useState<FormDraft | null>(null);
    const [formDraftStatus, setFormDraftStatus] = useState<Record<string, boolean>>({});
    
    // UI States
    const { openMenu } = useContextMenu();
    const [isDesktop, setIsDesktop] = useState(false);

    useEffect(() => {
        setConfiguration({
            isVisible: true,
            mainColor: '#6366F1',
            mainIcon: <Plus size={32} strokeWidth={3} />,
            onMainClick: handleCreate,
            actions: [
                { id: 'create-form', label: 'CREATE FORM', icon: <Plus size={20} />, onClick: handleCreate }]
        });
        return () => resetConfiguration();
    }, [setConfiguration, resetConfiguration]);

    useEffect(() => {
        const checkSize = () => setIsDesktop(window.innerWidth >= 1024);
        checkSize();
        window.addEventListener('resize', checkSize);
        return () => window.removeEventListener('resize', checkSize);
    }, []);

    const formsLengthRef = useRef(forms.length);
    useEffect(() => {
        formsLengthRef.current = forms.length;
    }, [forms.length]);

    const fetchForms = useCallback(async (showLoading = true) => {
        const userId = user?.$id || 'guest';
        const cacheKey = `f_user_forms_${userId}`;
        
        // Load RxDB local cache immediately if state is empty
        if (formsLengthRef.current === 0) {
            try {
                const { getRxDB } = await import('@/lib/webrtc/RxDBManager');
                const db = await getRxDB().catch(() => null);
                if (db) {
                    const cachedDoc = await db.cache.findOne(cacheKey).exec().catch(() => null);
                    if (cachedDoc?.data && Array.isArray(cachedDoc.data)) {
                        setForms(cachedDoc.data as Forms[]);
                        setLoading(false);
                    }
                }
            } catch {}
        }

        const shouldShowLoading = showLoading && formsLengthRef.current === 0;
        if (shouldShowLoading) setLoading(true);
        
        try {
            let response: any = [];
            if (user?.$id) {
                try {
                    response = await FormsService.listUserForms(user.$id);
                } catch (e) {
                    console.error('[Forms] listUserForms failed:', e);
                }
            }
            
            const formRows: any[] = Array.isArray(response) 
                ? response 
                : (Array.isArray((response as any)?.rows) 
                    ? (response as any).rows 
                    : (Array.isArray((response as any)?.documents) ? (response as any).documents : []));

            setForms((prev) => {
                const byId = new Map<string, Forms>();
                (prev || []).forEach((f) => f && f.$id && byId.set(f.$id, f));
                formRows.forEach((f: any) => f && f.$id && byId.set(f.$id, f));
                const merged = Array.from(byId.values()).sort((a: any, b: any) => {
                    const aPinned = isResourcePinned('form', a.$id, a.userId, a.isPinned);
                    const bPinned = isResourcePinned('form', b.$id, b.userId, b.isPinned);
                    if (aPinned && !bPinned) return -1;
                    if (!aPinned && bPinned) return 1;
                    return new Date(b.$createdAt || Date.now()).getTime() - new Date(a.$createdAt || Date.now()).getTime();
                });

                (async () => {
                    try {
                        const { getRxDB } = await import('@/lib/webrtc/RxDBManager');
                        const db = await getRxDB().catch(() => null);
                        if (db) {
                            await db.cache.upsert({
                                id: cacheKey,
                                data: merged as any,
                                timestamp: Date.now(),
                            }).catch(() => {});
                        }
                    } catch {}
                })();

                return merged;
            });

            // Load offline drafts
            const manifest = await DraftsService.getManifest();
            setFormDraftStatus(Object.keys(manifest).reduce((acc, id) => ({ ...acc, [id]: true }), {}));
            
            const draftList: FormDraft[] = [];
            const draftPromises = Object.keys(manifest).map(async id => {
                const d = await DraftsService.getDraft(id);
                if (d) draftList.push(d);
            });
            await Promise.all(draftPromises);
            setOfflineDrafts(draftList.sort((a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime()));

        } catch (err) {
            console.error("Failed to fetch forms", err);
        } finally {
            if (shouldShowLoading) setLoading(false);
        }
    }, [user, isResourcePinned]);

    const [isRefreshing, setIsRefreshing] = useState(false);

    const handleManualRefresh = useCallback(async () => {
        if (!user) return;
        setIsRefreshing(true);
        try {
            // Invalidate the cache to ensure we get fresh data
            invalidate(`f_user_forms_${user.$id}`);
            await fetchForms(true);
        } finally {
            // Force a minimum roll animation duration of 600ms
            setTimeout(() => setIsRefreshing(false), 600);
        }
    }, [user, fetchForms, invalidate]);

    const handleCreate = () => {
        setSelectedForm(null);
        setSelectedDraft(null);
        setDialogOpen(true);
    };

    const handleEdit = (form: Forms) => {
        setSelectedForm(form);
        setSelectedDraft(null);
        setDialogOpen(true);
    };

    const handleEditDraft = (draft: FormDraft) => {
        // If the draft corresponds to an existing form, load that form too
        const existingForm = forms.find(f => f.$id === draft.id);
        setSelectedForm(existingForm || null);
        setSelectedDraft(draft);
        setDialogOpen(true);
    };

    const handleDelete = async (form: Forms) => {
        openDrawer('delete-confirm', {
            title: `Purge "${form.title}"?`,
            description: 'This will permanently erase all metadata, configurations, and associated responses for this form.',
            resourceName: 'this form',
            confirmLabel: 'Confirm Purge',
            onConfirm: async () => {
                if (!user) return;
                try {
                    await FormsService.deleteForm(form.$id);
                    invalidate(`f_user_forms_${user.$id}`);
                    fetchForms(false);
                } catch (err) {
                    console.error("Failed to delete form", err);
                }
            }
        });
    };

    const handleDeleteDraft = (draft: FormDraft) => {
        openDrawer('delete-confirm', {
            title: `Delete Local Draft?`,
            description: `You are about to remove "${draft.title || 'Untitled Portal'}" from your local storage. This cannot be recovered.`,
            resourceName: 'this draft',
            confirmLabel: 'Delete Draft',
            onConfirm: () => {
                DraftsService.clearDraft(draft.id);
                fetchForms(false);
            }
        });
    };

    const handleOpenSettings = (form: Forms) => {
        setSelectedForm(form);
        setSelectedDraft(null);
        setSettingsOpen(true);
    };

    const handleTogglePin = async (form: Forms) => {
        if (!user?.$id) return;
        const ownerId = form.userId || user.$id;
        const currentlyPinned = isResourcePinned('form', form.$id, ownerId, form.isPinned);
        const isOwner = user.$id === ownerId;

        try {
            const nextPinned = await togglePin({
                resourceType: 'form',
                resourceId: form.$id,
                ownerId,
                rowIsPinned: form.isPinned,
                setOwnerRowPin: async (pinned) => {
                    await FormsService.updateForm(form.$id, { isPinned: pinned } as any);
                },
            });
            setForms((prev) =>
                prev.map((f) => (f.$id === form.$id && isOwner ? { ...f, isPinned: nextPinned } : f)),
            );
            toast.success(nextPinned ? 'Pinned to top' : 'Unpinned');
        } catch (err) {
            if (!isOwner) {
                setLocalPin('form', form.$id, currentlyPinned);
            }
            toast.error('Failed to toggle pin');
        }
    };

    useEffect(() => {
        if (user) {
            fetchForms();
        }
    }, [user, fetchForms]);

    const getStatusColor = (status: string) => {
        switch (status) {
            case 'published': return '#10B981';
            case 'draft': return '#FFB020';
            case 'archived': return '#D14343';
            default: return '#9B9691';
        }
    };

    const filteredForms = forms; // Active forms (published/draft on server)

    return (
        <div className="animate-fadeIn p-4 md:px-0 md:py-8 min-h-screen bg-black">
            {/* Tab Switcher */}
            <div className="flex items-center gap-2 p-1 bg-white/[0.02] border border-white/5 rounded-2xl w-fit select-none mb-8">
              <button
                type="button"
                onClick={() => router.push('/flow')}
                className="px-5 py-2.5 rounded-xl text-xs font-extrabold transition-all text-white/50 hover:text-white hover:bg-white/5"
              >
                Goals
              </button>
              <button
                type="button"
                onClick={() => router.push('/flow/forms')}
                className="px-5 py-2.5 rounded-xl text-xs font-extrabold transition-all bg-[#A855F7] text-white shadow-[0_4px_12px_rgba(168,85,247,0.25)]"
              >
                Forms
              </button>
              <button
                type="button"
                onClick={() => router.push('/flow/events')}
                className="px-5 py-2.5 rounded-xl text-xs font-extrabold transition-all text-white/50 hover:text-white hover:bg-white/5"
              >
                Events
              </button>
            </div>

            <MultiSectionContainer panels={['projects', 'huddles', 'goals']}>
                <div className="flex justify-between items-center mb-8">
                    <div>
                        <h1 className="text-3xl font-black mb-1 tracking-tight font-clash text-white">
                            Forms
                        </h1>
                        <p className="text-[#9B9691] font-semibold font-satoshi text-sm">
                            Design data collection workflows for the ecosystem.
                        </p>
                    </div>
                    <div className="flex items-center gap-3">
                        <button
                            type="button"
                            onClick={handleManualRefresh}
                            disabled={isRefreshing}
                            className="w-10 h-10 rounded-xl bg-white/3 border border-white/8 hover:border-white/15 flex items-center justify-center transition-all duration-300 disabled:opacity-40 cursor-pointer"
                            title="Refresh Forms"
                        >
                            <RefreshCw size={16} className={`transition-all ${isRefreshing ? 'animate-spin text-[#6366F1]' : 'text-white/60'}`} />
                        </button>
                        <button 
                            type="button"
                            onClick={handleCreate}
                            className="flex items-center gap-1.5 px-5 py-2.5 font-bold rounded-xl bg-[#6366F1] text-black font-satoshi hover:bg-[#575CF0] transition-colors cursor-pointer text-sm"
                        >
                            <Plus className="h-4 w-4" />
                            <span>Create Form</span>
                        </button>
                    </div>
                </div>

                {/* Custom Tab Switcher */}
                <div className="flex border-b border-[#34322F] mb-8 overflow-x-auto whitespace-nowrap scrollbar-none gap-8">
                    {[
                        { label: 'Active Forms', icon: FileText },
                        { label: 'Templates', icon: Sparkles },
                        { 
                            label: (
                                <div className="flex items-center gap-1.5">
                                    <span>Drafts</span>
                                    {offlineDrafts.length > 0 && (
                                        <span className="bg-[#FFB020] text-black rounded-full w-4.5 h-4.5 text-[10px] flex items-center justify-center font-bold font-mono">
                                            {offlineDrafts.length}
                                        </span>
                                    )}
                                </div>
                            ),
                            icon: History 
                        }
                    ].map((tab, idx) => {
                        const Icon = tab.icon;
                        const isActive = tabValue === idx;
                        return (
                            <button
                                key={idx}
                                type="button"
                                onClick={() => setTabValue(idx)}
                                className={`flex items-center gap-2 pb-3 border-b-2 font-bold text-sm transition-all font-satoshi cursor-pointer ${
                                    isActive 
                                        ? 'border-[#6366F1] text-[#6366F1]' 
                                        : 'border-transparent text-[#9B9691] hover:text-white'
                                }`}
                            >
                                <Icon className="h-4.5 w-4.5" />
                                <span>{tab.label}</span>
                            </button>
                        );
                    })}
                </div>

                {loading ? (
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                        {[1, 2, 3].map((i) => (
                            <div key={i} className="bg-[#161412] border border-[#34322F] rounded-[28px] p-6 animate-pulse">
                                <div className="flex justify-between mb-4">
                                    <div className="h-5 w-20 bg-neutral-800 rounded-md" />
                                    <div className="h-8 w-8 bg-neutral-800 rounded-md" />
                                </div>
                                <div className="h-6 w-3/4 bg-neutral-800 rounded-md mb-2" />
                                <div className="h-4 w-full bg-neutral-800 rounded-md mb-2" />
                                <div className="h-4 w-5/6 bg-neutral-800 rounded-md mb-6" />
                                <hr className="border-[#34322F] mb-6" />
                                <div className="flex gap-2">
                                    <div className="h-8 w-8 bg-neutral-800 rounded-md" />
                                    <div className="ml-auto h-8 w-8 bg-neutral-800 rounded-md" />
                                    <div className="h-8 w-8 bg-neutral-800 rounded-md" />
                                </div>
                            </div>
                        ))}
                    </div>
                ) : (
                    <div>
                        {/* ACTIVE FORMS TAB */}
                        {tabValue === 0 && (
                            <>
                                {filteredForms.length === 0 ? (
                                    <div className="py-24 text-center bg-[#161412] border border-dashed border-[#34322F] rounded-[24px]">
                                        <FileText className="h-16 w-16 mx-auto text-[#9B9691] opacity-35 mb-4" />
                                        <h3 className="text-lg font-clash text-white opacity-85 mb-6">No active forms.</h3>
                                        <button 
                                            type="button" 
                                            onClick={handleCreate} 
                                            className="inline-flex items-center gap-1.5 px-5 py-2.5 border border-[#34322F] hover:border-[#6366F1] text-white font-bold rounded-xl hover:bg-[#161412] transition-colors font-satoshi text-sm cursor-pointer"
                                        >
                                            <Plus className="h-4 w-4" />
                                            <span>Start Building</span>
                                        </button>
                                    </div>
                                ) : (
                                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                                        {filteredForms.map((form) => {
                                            const pinned = isResourcePinned('form', form.$id, form.userId, form.isPinned);
                                            
// eslint-disable-next-line react-hooks/rules-of-hooks
                                            const accessControlItems = useAccessControlMenuItems({
                                                resourceType: 'form',
                                                resourceId: form.$id,
                                                isPublic: !!form.isPublic,
                                                isGuest: !!form.isGuest,
                                                resourceTitle: form.title,
                                                onUpdate: () => fetchForms(false)
                                            });

// eslint-disable-next-line react-hooks/rules-of-hooks
                                            const contextMenuItems = [
                                                { label: pinned ? 'Unpin' : 'Pin', icon: <Pin size={16} className={pinned ? 'rotate-45 text-[#F59E0B]' : ''} />, onClick: () => handleTogglePin(form) },
                                                ...accessControlItems,
                                                { label: 'Edit Schema', icon: <Edit size={16} />, onClick: () => handleEdit(form) },
                                                { label: 'Settings', icon: <Settings size={16} />, onClick: () => handleOpenSettings(form) },
                                                { 
                                                    label: 'Project Workflow', 
                                                    icon: <FolderKanban size={16} />, 
                                                    onClick: () => openDrawer('new-project', {
                                                        template: {
                                                            id: 'form-to-project',
                                                            title: 'Analyze Responses', 
                                                            summary: 'Convert intake forms into context and auto-spin execution tasks.',
                                                            color: '#6366F1'
                                                        },
                                                        formId: form.$id,
                                                        selectedResourceId: form.$id,
                                                        formTitle: form.title,
                                                        formDescription: form.description || ''
                                                    })
                                                },
                                                { label: 'Delete', icon: <Trash2 size={16} />, variant: 'destructive' as const, onClick: () => handleDelete(form) }
                                            ];

                                            const handleRightClick = (e: React.MouseEvent) => {
                                                e.preventDefault();
                                                e.stopPropagation();
                                                openMenu({
                                                    x: e.clientX,
                                                    y: e.clientY,
                                                    items: contextMenuItems,
                                                    appType: 'flow'
                                                });
                                            };

                                            return (
                                                <div 
                                                    key={form.$id}
                                                    onClick={() => {
                                                        if (isDesktop) {
                                                            setActiveDetail({ type: 'form', id: form.$id, data: form });
                                                        } else {
                                                            router.push(`/flow/forms/${form.$id}`);
                                                        }
                                                    }}
                                                    onContextMenu={handleRightClick}
                                                    className="bg-[#161412] border border-[#34322F] hover:border-[#6366F1] rounded-[28px] cursor-pointer p-6 transition-all duration-300 hover:-translate-y-0.5 hover:shadow-[0_12px_24px_rgba(0,0,0,0.5)] flex flex-col justify-between h-full"
                                                >
                                                    <div>
                                                        <div className="flex justify-between items-center mb-4">
                                                             <div className="flex items-center gap-2">
                                                                 <span 
                                                                     className="text-[9px] font-bold font-mono px-2 py-0.5 rounded border tracking-wider" 
                                                                     style={{ 
                                                                         color: getStatusColor(form.status || 'draft'),
                                                                         borderColor: getStatusColor(form.status || 'draft')
                                                                     }}
                                                                 >
                                                                     {(form.status || 'draft').toUpperCase()}
                                                                 </span>
                                                                 <SyncStatusDot resourceId={form.$id} />
                                                                 {formDraftStatus[form.$id] && (
                                                                     <span className="text-[9px] font-bold font-mono px-2 py-0.5 rounded border bg-[#1C1A18] text-[#FFB020] border-[#FFB020] tracking-wider">
                                                                         UNSYNCED
                                                                     </span>
                                                                 )}
                                                             </div>
                                                            <div className="flex items-center gap-0.5">
                                                                <button
                                                                    type="button"
                                                                    onClick={(e) => {
                                                                        e.stopPropagation();
                                                                        handleTogglePin(form);
                                                                    }}
                                                                    className={`p-1.5 rounded-lg transition-all duration-200 ${pinned ? 'text-[#F59E0B] bg-[#F59E0B]/5' : 'text-white/20 hover:text-[#F59E0B] hover:bg-[#F59E0B]/5'}`}
                                                                >
                                                                    <Pin size={16} className={pinned ? 'fill-[#F59E0B]' : ''} />
                                                                </button>
                                                                <ShareLockButton 
                                                                    resourceType="form"
                                                                    resourceId={form.$id}
                                                                    isPublic={!!form.isPublic}
                                                                    isGuest={!!form.isGuest}
                                                                    accentColor="#10B981"
                                                                    onPublished={() => fetchForms(false)}
                                                                />
                                                            </div>
                                                        </div>
                                                        <h2 className="text-lg font-bold mb-1 text-white font-clash tracking-tight truncate">
                                                            {form.title}
                                                        </h2>
                                                        <p className="text-[#9B9691] text-xs sm:text-sm font-satoshi leading-relaxed mb-4 min-h-[3em] line-clamp-2">
                                                            {form.description || 'No description provided.'}
                                                        </p>
                                                    </div>
                                                    
                                                    <div>
                                                        <hr className="border-[#34322F] mb-4" />
                                                        <div className="flex items-center justify-between">
                                                            <span className="text-[10px] font-bold text-white/20 font-mono">
                                                                {new Date(form.$createdAt).toLocaleDateString()}
                                                            </span>
                                                            <div className="flex gap-2">
                                                                <button 
                                                                    type="button"
                                                                    onClick={(e) => {
                                                                        e.stopPropagation();
                                                                        handleEdit(form);
                                                                    }} 
                                                                    className="p-1.5 text-[#9B9691] bg-[#1C1A18] border border-[#34322F] hover:border-[#6366F1] hover:text-white rounded-xl transition-all"
                                                                >
                                                                    <Edit className="h-4 w-4" />
                                                                </button>
                                                            </div>
                                                        </div>
                                                    </div>
                                                </div>
                                            );
                                        })}
                                    </div>
                                )}
                            </>
                        )}

                        {/* TEMPLATES TAB */}
                        {tabValue === 1 && (
                            <div className="py-24 text-center bg-[#161412] border border-dashed border-[#34322F] rounded-[24px]">
                                <Sparkles className="h-16 w-16 mx-auto text-[#9B9691] opacity-35 mb-4" />
                                <h3 className="text-lg font-bold font-clash text-white tracking-tight">Templates coming soon.</h3>
                            </div>
                        )}

                        {/* OFFLINE DRAFTS TAB */}
                        {tabValue === 2 && (
                            <>
                                {offlineDrafts.length === 0 ? (
                                    <div className="py-24 text-center bg-[#161412] border border-dashed border-[#34322F] rounded-[24px]">
                                        <History className="h-16 w-16 mx-auto text-[#9B9691] opacity-35 mb-4" />
                                        <h3 className="text-lg font-bold font-clash text-white tracking-tight">No offline drafts found.</h3>
                                    </div>
                                ) : (
                                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                                        {offlineDrafts.map((draft) => (
                                            <div 
                                                key={draft.id}
                                                className="bg-[#161412] border border-[#34322F] rounded-[28px] p-6 hover:shadow-[0_12px_24px_rgba(0,0,0,0.5)] transition-all duration-300 hover:border-[#FFB020] hover:-translate-y-0.5 flex flex-col justify-between h-full"
                                            >
                                                <div>
                                                    <div className="flex justify-between items-center mb-4">
                                                        <span className="text-[9px] font-bold font-mono px-2 py-0.5 rounded border bg-transparent text-[#FFB020] border-[#FFB020] tracking-wider">
                                                            LOCAL DRAFT
                                                        </span>
                                                        <span className="text-xs text-[#9B9691] font-mono">
                                                            {new Date(draft.updatedAt).toLocaleTimeString()}
                                                        </span>
                                                    </div>
                                                    <h2 className="text-lg font-bold mb-1 text-white font-clash tracking-tight truncate">
                                                        {draft.title || 'Untitled Portal'}
                                                    </h2>
                                                    <p className="text-[#9B9691] text-xs sm:text-sm font-satoshi leading-relaxed mb-4 min-h-[3em]">
                                                        Last saved locally. Sync required to publish.
                                                    </p>
                                                </div>

                                                <div>
                                                    <hr className="border-[#34322F] mb-4" />
                                                    <div className="flex gap-2 items-center">
                                                        <button 
                                                            type="button"
                                                            onClick={() => handleEditDraft(draft)}
                                                            className="flex items-center gap-1.5 px-4 py-2 bg-[#1C1A18] border border-[#34322F] hover:bg-[#34322F] text-white hover:text-white rounded-xl transition-all font-satoshi text-xs font-bold cursor-pointer"
                                                        >
                                                            <Edit className="h-3.5 w-3.5" />
                                                            <span>Resume</span>
                                                        </button>
                                                        <div className="flex-grow" />
                                                        <button 
                                                            type="button"
                                                            onClick={() => handleDeleteDraft(draft)} 
                                                            className="p-1.5 text-[#D14343] bg-[#1C1A18] border border-[#34322F] hover:bg-[#34322F] hover:text-[#ff4444] rounded-xl transition-colors inline-flex items-center justify-center cursor-pointer"
                                                        >
                                                            <Trash2 className="h-4 w-4" />
                                                        </button>
                                                    </div>
                                                </div>
                                            </div>
                                        ))}
                                    </div>
                                )}
                            </>
                        )}
                    </div>
                )}

                {dialogOpen && (
                    <FormDialog 
                        open={dialogOpen} 
                        onClose={() => setDialogOpen(false)} 
                        form={selectedForm}
                        initialDraft={selectedDraft || undefined}
                        onSaved={() => fetchForms(false)} 
                    />
                )}

                {settingsOpen && (
                    <FormSettingsDialog
                        open={settingsOpen}
                        onClose={() => setSettingsOpen(false)}
                        form={selectedForm}
                        onSaved={() => fetchForms(false)}
                    />
                )}
            </MultiSectionContainer>
        </div>
    );
}
