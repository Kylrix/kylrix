'use client';

import React, { useEffect, useState, useCallback, useRef } from 'react';
import { 
    Plus, 
    Edit, 
    Trash2, 
    FileText, 
    Sparkles, 
    History, 
    Settings, 
    Pin, 
    FolderKanban,
    ChevronRight
} from 'lucide-react';
import { FormsService } from '@/lib/services/forms';
import { DraftsService, FormDraft } from '@/lib/services/drafts';
import { Forms } from '@/generated/appwrite/types';
import FormDialog from '@/components/forms/FormDialog';
import FormSettingsDialog from '@/components/forms/FormSettingsDialog';
import { FormDetail } from '@/components/forms/FormDetail';
import { useAuth } from '@/context/auth/AuthContext';
import { useResourcePins } from '@/context/ResourcePinContext';
import { useAccessControlMenuItems } from '@/components/share/AccessControlMenuItems';
import { useContextMenu } from '@/components/ui/ContextMenuContext';
import { MultiSectionContainer } from '@/context/SectionContext';
import { useUnifiedDrawer } from '@/context/UnifiedDrawerContext';
import { useDynamicSidebar } from '@/components/ui/DynamicSidebar';
import { useOverlay } from '@/components/ui/OverlayContext';
import { useFAB } from '@/context/FABContext';
import { LocalEngine } from '@/lib/services/LocalEngine';
import { useWorkspace } from '@/context/WorkspaceContext';
import { useWorkspaceFilteredItems } from '@/hooks/useWorkspaceFilteredItems';
import { HangoutTabTrigger } from '@/components/hangout/HangoutTabTrigger';
import { MomentTabTrigger } from '@/components/connect/MomentTabTrigger';
import { FlowTabTrigger } from '@/components/flows/FlowTabTrigger';



export default function FormsDashboard() {
    const { user } = useAuth();
    const { isPinned: isResourcePinned, togglePin } = useResourcePins();
    const { open: openDrawer } = useUnifiedDrawer();
    const { openSidebar, closeSidebar } = useDynamicSidebar();
    const { openOverlay, closeOverlay } = useOverlay();
    const { setConfiguration, resetConfiguration } = useFAB();
    const { activeWorkspace } = useWorkspace();
    const [forms, setForms] = useState<Forms[]>([]);
    const { filteredItems: workspaceScopedForms } = useWorkspaceFilteredItems(forms, 'form');
    const [offlineDrafts, setOfflineDrafts] = useState<FormDraft[]>([]);
    const [loading, setLoading] = useState(true);
    const [tabValue, setTabValue] = useState(0);
    const [dialogOpen, setDialogOpen] = useState(false);
    const [settingsOpen, setSettingsOpen] = useState(false);
    const [selectedForm, setSelectedForm] = useState<Forms | null>(null);
    const [selectedDraft, setSelectedDraft] = useState<FormDraft | null>(null);

    const handleCreate = () => {
        setSelectedForm(null);
        setSelectedDraft(null);
        setDialogOpen(true);
    };

    useEffect(() => {
        setConfiguration({
            isVisible: true,
            mainColor: '#6366F1',
            mainIcon: <Plus size={32} strokeWidth={3} />,
            onMainClick: handleCreate,
            actions: [
                { id: 'create-form', label: 'CREATE FORM', icon: <Plus size={20} />, onClick: handleCreate }
            ]
        });
        return () => resetConfiguration();
    }, [setConfiguration, resetConfiguration]);

    const formsRef = useRef<Forms[]>([]);
    useEffect(() => {
        formsRef.current = forms;
    }, [forms]);

    const sortForms = useCallback((rows: Forms[]) => {
        return [...rows].sort((a: any, b: any) => {
            const aPinned = isResourcePinned('form', a.$id, a.userId, a.isPinned);
            const bPinned = isResourcePinned('form', b.$id, b.userId, b.isPinned);
            if (aPinned && !bPinned) return -1;
            if (!aPinned && bPinned) return 1;
            return (
                new Date(b.$createdAt || Date.now()).getTime() -
                new Date(a.$createdAt || Date.now()).getTime()
            );
        });
    }, [isResourcePinned]);

    const fetchForms = useCallback(async (showLoading = true) => {
        const userId = user?.$id || 'guest';
        const isStateEmpty = formsRef.current.length === 0;
        if (showLoading && isStateEmpty) setLoading(true);

        try {
            let items: any[] = [];
            try {
                const { getRxDB } = await import('@/lib/webrtc/RxDBManager');
                const db = await getRxDB();
                items = (await db.forms.find().exec()).map((d: any) => d.toJSON());
            } catch {
                items = [];
            }
            if (items.length === 0) {
                items = (await LocalEngine.cacheGet<any[]>('f_forms_list')) || [];
            }

            if (items.length > 0) {
                const activeLocal = items.filter((f: any) => !f.isTrash);
                setForms(sortForms(activeLocal as unknown as Forms[]));
                setLoading(false);
            }

            // Sync drafts
            const drafts = await DraftsService.listDrafts();
            setOfflineDrafts(drafts);

            if (userId === 'guest') return;

            const res = await FormsService.listUserForms(userId);
            const remoteRows = Array.isArray(res) ? res : (res?.rows || []);

            if (Array.isArray(remoteRows)) {
                const byId = new Map<string, Forms>();
                items.filter((item: any) => !item.isTrash).forEach((item: any) => item?.$id && byId.set(item.$id, item));
                remoteRows.filter((row: any) => !row.isTrash).forEach((row: any) => row?.$id && byId.set(row.$id, row));
                const merged = Array.from(byId.values());

                setForms(sortForms(merged as unknown as Forms[]));
                await LocalEngine.cacheSet('f_forms_list', merged);
            }
        } catch (error) {
            console.error('Failed to fetch forms', error);
        } finally {
            setLoading(false);
        }
    }, [user?.$id, sortForms]);

    useEffect(() => {
        void fetchForms(false);

        // Realtime subscription: live sync for forms mutations without manual polling
        let unsubscribe: (() => void) | undefined;
        void (async () => {
            try {
                const { client } = await import('@/lib/appwrite/client');
                const { APPWRITE_CONFIG } = await import('@/lib/appwrite/config');
                const dbId = APPWRITE_CONFIG.DATABASES.FLOW;
                const tableId = APPWRITE_CONFIG.TABLES.FLOW.FORMS;
                const channel = `databases.${dbId}.collections.${tableId}.documents`;
                unsubscribe = client.subscribe(channel, (response: any) => {
                    if (response.events.some((event: string) => event.includes('.create') || event.includes('.update') || event.includes('.delete'))) {
                        void fetchForms(false);
                    }
                });
            } catch {}
        })();

        return () => {
            if (unsubscribe) unsubscribe();
        };
    }, [fetchForms]);

    // Eagerly pull custom workspace forms into local state when switching workspaces
    useEffect(() => {
        if (!activeWorkspace || activeWorkspace.isPersonal) return;
        const wsId = activeWorkspace.id;
        let cancelled = false;

        void (async () => {
            try {
                const { ProjectsService } = await import('@/lib/appwrite/projects');
                const tagged = await ProjectsService.listTaggedResources(wsId).catch(() => null);
                if (tagged?.forms && Array.isArray(tagged.forms) && tagged.forms.length > 0 && !cancelled) {
                    setForms((prev) => {
                        const byId = new Map(prev.map((f) => [f.$id, f]));
                        tagged.forms.forEach((f: any) => {
                            const id = f.$id || f.id;
                            if (id) byId.set(id, { ...byId.get(id), ...f, $id: id, projectId: wsId, isWorkspace: true });
                        });
                        return Array.from(byId.values());
                    });
                }
            } catch {}
        })();

        return () => {
            cancelled = true;
        };
    }, [activeWorkspace?.id]);

    const handleEdit = (form: Forms) => {
        setSelectedForm(form);
        setSelectedDraft(null);
        setDialogOpen(true);
    };

    const handleEditDraft = (draft: FormDraft) => {
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
                    setForms((prev) => prev.filter((f) => f.$id !== form.$id));
                    try {
                        const cached = (await LocalEngine.cacheGet<any[]>('f_forms_list')) || [];
                        await LocalEngine.cacheSet(
                            'f_forms_list',
                            cached.filter((f: any) => f.$id !== form.$id),
                        );
                    } catch {}
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
            onConfirm: async () => {
                await DraftsService.clearDraft(draft.id);
                fetchForms(false);
            }
        });
    };

    const handleOpenSettings = (form: Forms) => {
        setSelectedForm(form);
        setSelectedDraft(null);
        setSettingsOpen(true);
    };

    const handleOpenDetail = useCallback((form: Forms) => {
        const isDesktop = typeof window !== 'undefined' && window.innerWidth >= 900;
        if (isDesktop) {
            openSidebar(
                <FormDetail
                    formId={form.$id}
                    form={form}
                    embedded
                    onClose={closeSidebar}
                    onEdit={handleEdit}
                    onDelete={handleDelete}
                />,
                `form_${form.$id}`,
                { hideHeader: true }
            );
        } else {
            openOverlay(
                <FormDetail
                    formId={form.$id}
                    form={form}
                    embedded
                    onClose={closeOverlay}
                    onEdit={handleEdit}
                    onDelete={handleDelete}
                />
            );
        }
    }, [openSidebar, closeSidebar, openOverlay, closeOverlay]);

    const handleTogglePin = async (form: Forms) => {
        if (!user?.$id) return;
        const ownerId = form.userId || user.$id;
        try {
            const nextPinned = await togglePin({
                resourceType: 'form',
                resourceId: form.$id,
                ownerId,
                rowIsPinned: form.isPinned,
                setOwnerRowPin: async (pinned) => {
                    await FormsService.updateForm(form.$id, { isPinned: pinned } as any);
                }
            });
            setForms((prev) =>
                sortForms(
                    prev.map((f) => (f.$id === form.$id ? { ...f, isPinned: nextPinned } : f))
                )
            );
        } catch {}
    };

    return (
        <div className="flex-1 min-h-screen bg-[#0A0908] text-white p-4 md:p-8">
            <MultiSectionContainer panels={['projects', 'huddles', 'goals']}>
                {/* Header Row */}
                <div className="flex justify-between items-center mb-8">
                    <div>
                        <h1 className="text-3xl font-black mb-1 tracking-tight font-clash text-white">
                            Forms
                        </h1>
                        <p className="text-[#9B9691] font-semibold font-satoshi text-sm">
                            Design structured intake portals and workflows.
                        </p>
                    </div>
                    <div className="flex items-center gap-3">
                        <FlowTabTrigger />
                        <MomentTabTrigger />
                        <HangoutTabTrigger />
                        <button 


                            type="button"
                            onClick={handleCreate}
                            className="flex items-center gap-2 px-5 py-2.5 font-extrabold rounded-2xl bg-[#6366F1] hover:bg-[#5254D8] text-white font-satoshi transition-all shadow-[0_4px_16px_rgba(99,102,241,0.3)] cursor-pointer text-sm"
                        >
                            <Plus size={16} strokeWidth={2.5} />
                            <span>Create Form</span>
                        </button>
                    </div>
                </div>

                <div className="flex border-b border-white/6 mb-8 overflow-x-auto whitespace-nowrap scrollbar-none gap-8">
                    {[
                        { label: 'Active Forms', icon: FileText },
                        { label: 'Templates', icon: Sparkles },
                        { 
                            label: (
                                <div className="flex items-center gap-1.5">
                                    <span>Drafts</span>
                                    {offlineDrafts.length > 0 && (
                                        <span className="bg-[#FFB020] text-black rounded-full px-1.5 py-0.2 text-[10px] flex items-center justify-center font-bold font-mono">
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
                                        : 'border-transparent text-white/40 hover:text-white'
                                }`}
                            >
                                <Icon className="h-4.5 w-4.5" />
                                <span>{tab.label}</span>
                            </button>
                        );
                    })}
                </div>

                {loading && forms.length === 0 ? (
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
                        {[1, 2, 3].map((i) => (
                            <div key={i} className="bg-[#000000] border border-white/[0.08] rounded-2xl p-5 animate-pulse space-y-4">
                                <div className="flex justify-between">
                                    <div className="h-5 w-24 bg-white/5 rounded-lg" />
                                    <div className="h-5 w-12 bg-white/5 rounded-lg" />
                                </div>
                                <div className="h-4 w-3/4 bg-white/5 rounded-lg" />
                                <div className="h-3 w-full bg-white/5 rounded-lg" />
                            </div>
                        ))}
                    </div>
                ) : (
                    <div>
                        {tabValue === 0 && (
                            <>
                                {workspaceScopedForms.length === 0 ? (
                                    <div className="py-24 text-center bg-[#000000] border border-dashed border-white/10 rounded-3xl">
                                        <FileText className="h-14 w-14 mx-auto text-white/20 mb-3" />
                                        <h3 className="text-lg font-clash font-bold text-white mb-4">No active forms</h3>
                                        <button 
                                            type="button" 
                                            onClick={handleCreate} 
                                            className="inline-flex items-center gap-2 px-5 py-2.5 bg-[#161412] border border-white/10 hover:border-[#6366F1] text-white font-bold rounded-xl text-xs font-satoshi transition-all cursor-pointer"
                                        >
                                            <Plus size={14} />
                                            <span>Build First Form</span>
                                        </button>
                                    </div>
                                ) : (
                                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
                                        {workspaceScopedForms.map((form) => (
                                             <FormCard
                                                key={form.$id}
                                                form={form}
                                                onSelect={() => handleOpenDetail(form)}
                                                onTogglePin={handleTogglePin}
                                                onEdit={handleEdit}
                                                onOpenSettings={handleOpenSettings}
                                                onDelete={handleDelete}
                                                onUpdate={() => fetchForms(false)}
                                            />
                                        ))}
                                    </div>
                                )}
                            </>
                        )}

                        {tabValue === 1 && (
                            <div className="py-24 text-center bg-[#000000] border border-dashed border-white/10 rounded-3xl">
                                <Sparkles className="h-14 w-14 mx-auto text-white/20 mb-3" />
                                <h3 className="text-lg font-bold font-clash text-white tracking-tight">Form Templates Catalog Coming Soon</h3>
                            </div>
                        )}

                        {tabValue === 2 && (
                            <>
                                {offlineDrafts.length === 0 ? (
                                    <div className="py-24 text-center bg-[#000000] border border-dashed border-white/10 rounded-3xl">
                                        <History className="h-14 w-14 mx-auto text-white/20 mb-3" />
                                        <h3 className="text-lg font-bold font-clash text-white tracking-tight">No offline form drafts</h3>
                                    </div>
                                ) : (
                                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
                                        {offlineDrafts.map((draft) => (
                                            <div 
                                                key={draft.id}
                                                onClick={() => handleEditDraft(draft)}
                                                className="bg-[#000000] border border-white/[0.08] hover:border-[#FFB020]/40 rounded-2xl p-5 transition-all flex flex-col justify-between cursor-pointer group"
                                            >
                                                <div>
                                                    <div className="flex justify-between items-center mb-3">
                                                        <span className="text-[9px] font-bold font-mono px-2 py-0.5 rounded border border-[#FFB020]/40 text-[#FFB020] bg-[#FFB020]/10 tracking-wider">
                                                            LOCAL DRAFT
                                                        </span>
                                                        <span className="text-xs text-white opacity-60 font-mono">
                                                            {new Date(draft.updatedAt).toLocaleTimeString()}
                                                        </span>
                                                    </div>
                                                    <h2 className="text-base font-bold text-white font-clash tracking-tight truncate group-hover:text-[#FFB020] transition-colors">
                                                        {draft.title || 'Untitled Draft'}
                                                    </h2>
                                                    <p className="text-white opacity-60 text-xs font-satoshi line-clamp-2 mt-1">
                                                        Unsynced changes stored in device engine.
                                                    </p>
                                                </div>

                                                <div className="pt-4 mt-4 border-t border-white/[0.08] flex items-center justify-between">
                                                    <span className="text-xs font-bold text-[#FFB020] font-satoshi">
                                                        Resume Draft
                                                    </span>
                                                    <button
                                                        type="button"
                                                        onClick={(e) => {
                                                            e.stopPropagation();
                                                            handleDeleteDraft(draft);
                                                        }}
                                                        className="text-white hover:text-red-400 p-1 transition-colors"
                                                    >
                                                        <Trash2 size={14} />
                                                    </button>
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

function FormCard({
    form,
    onSelect,
    onTogglePin,
    onEdit,
    onOpenSettings,
    onDelete,
    onUpdate
}: {
    form: any;
    onSelect: () => void;
    onTogglePin: (form: any) => void;
    onEdit: (form: any) => void;
    onOpenSettings: (form: any) => void;
    onDelete: (form: any) => void;
    onUpdate: () => void;
}) {
    const { isPinned: isResourcePinned } = useResourcePins();
    const contextMenu = useContextMenu();
    const openMenu = contextMenu?.openMenu;
    const { open: openDrawer } = useUnifiedDrawer();

    const pinned = isResourcePinned('form', form.$id, form.userId, form.isPinned);
    const accessControlItems = useAccessControlMenuItems({
        resourceType: 'form',
        resourceId: form.$id,
        isPublic: !!form.isPublic,
        isGuest: !!form.isGuest,
        resourceTitle: form.title,
        onUpdate
    });

    const contextMenuItems = [
        { label: 'View Details', icon: <FileText size={16} />, onClick: onSelect },
        { 
            label: 'Sanitize', 
            icon: <Sparkles size={16} className="text-[#6366F1]" />, 
            onClick: () => openDrawer('sanitize', {
                targetKind: 'form',
                targetId: form.$id,
                targetTitle: form.title,
                onSanitized: onUpdate
            })
        },
        { label: pinned ? 'Unpin' : 'Pin', icon: <Pin size={16} className={pinned ? 'rotate-45 text-[#F59E0B]' : ''} />, onClick: () => onTogglePin(form) },
        ...accessControlItems,
        { label: 'Edit Schema', icon: <Edit size={16} />, onClick: () => onEdit(form) },
        { label: 'Settings', icon: <Settings size={16} />, onClick: () => onOpenSettings(form) },
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
        { label: 'Delete', icon: <Trash2 size={16} />, variant: 'destructive' as const, onClick: () => onDelete(form) }
    ];

    const handleRightClick = (e: React.MouseEvent) => {
        e.preventDefault();
        e.stopPropagation();
        if (openMenu) {
            openMenu({
                x: e.clientX,
                y: e.clientY,
                items: contextMenuItems,
                appType: 'flow'
            });
        }
    };

    const isPublished = form.status === 'published';

    return (
        <div 
            onClick={onSelect}
            onContextMenu={handleRightClick}
            className="group relative bg-[#000000] hover:bg-[#080808] border border-white/[0.08] hover:border-[#6366F1]/50 rounded-2xl p-5 transition-all flex flex-col justify-between cursor-pointer select-none"
        >
            <div className="space-y-3">
                <div className="flex items-start justify-between gap-3">
                    <div className="flex items-center gap-2.5 min-w-0">
                        <div className="w-8 h-8 rounded-xl bg-[#161412] border border-white/10 flex items-center justify-center text-[#6366F1] shrink-0 group-hover:border-[#6366F1]/40 transition-colors">
                            <FileText size={15} />
                        </div>
                        <h3 className="font-clash font-extrabold text-white text-base tracking-tight group-hover:text-[#6366F1] transition-colors truncate">
                            {form.title || 'Untitled Form'}
                        </h3>
                    </div>

                    <div className="flex items-center gap-1.5 shrink-0">
                        <span className={`px-2 py-0.5 rounded-full text-[9px] font-extrabold uppercase font-mono tracking-wider border ${
                            isPublished 
                                ? 'bg-emerald-500/10 border-emerald-500/20 text-emerald-400' 
                                : 'bg-amber-500/10 border-amber-500/20 text-amber-400'
                        }`}>
                            {form.status || 'draft'}
                        </span>
                        {pinned && <Pin size={13} className="rotate-45 text-[#F59E0B] fill-[#F59E0B]" />}
                    </div>
                </div>

                <p className="text-xs text-white opacity-70 font-satoshi line-clamp-2 min-h-[2.5rem] leading-relaxed">
                    {form.description || 'No description provided.'}
                </p>
            </div>

            <div className="pt-4 mt-4 border-t border-white/[0.08] flex items-center justify-between">
                <div className="text-[11px] text-white opacity-60 font-mono">
                    {new Date(form.updatedAt || form.$createdAt).toLocaleDateString()}
                </div>

                <div className="flex items-center gap-2">
                    <button 
                        type="button" 
                        onClick={(e) => {
                            e.stopPropagation();
                            onEdit(form);
                        }}
                        className="px-2.5 py-1 rounded-lg bg-[#161412] border border-white/10 hover:border-[#6366F1] text-[11px] font-bold text-white hover:bg-[#6366F1]/15 transition-colors font-satoshi cursor-pointer"
                    >
                        Edit
                    </button>
                    <div className="text-white opacity-40 group-hover:opacity-100 transition-opacity">
                        <ChevronRight size={14} />
                    </div>
                </div>
            </div>
        </div>
    );
}
