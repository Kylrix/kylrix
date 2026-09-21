'use client';

import React, { useEffect, useState, useCallback, useRef, useMemo } from 'react';
import { 
    Plus, 
    Edit, 
    Trash2, 
    FileText, 
    Sparkles, 
    Wand2,
    History, 
    Settings, 
    Pin, 
    FolderKanban,
    ChevronRight,
    FileSpreadsheet,
    FolderInput,
    Copy,
    Code
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
import { useUnifiedDrawer } from '@/context/UnifiedDrawerContext';
import { useDynamicSidebar } from '@/components/ui/DynamicSidebar';
import { useOverlay } from '@/components/ui/OverlayContext';
import { useFAB } from '@/context/FABContext';
import { LocalEngine } from '@/lib/services/LocalEngine';
import { useWorkspace } from '@/context/WorkspaceContext';
import { useWorkspaceFilteredItems } from '@/hooks/useWorkspaceFilteredItems';
import { HangoutTabTrigger } from '@/components/hangout/HangoutTabTrigger';
import { FlowTabTrigger } from '@/components/flows/FlowTabTrigger';
import { ShareLockButton } from '@/components/share/ShareLockButton';
import { ObjectWorkflowsDrawer } from '@/components/workflows/ObjectWorkflowsDrawer';
import { FormResponsesWorkflowDrawer } from '@/components/forms/FormResponsesWorkflowDrawer';
import Link from 'next/link';
import toast from 'react-hot-toast';

function formatDateSafe(val: unknown, fallback = 'Recently'): string {
    if (!val) return fallback;
    try {
        const d = new Date(val as any);
        if (isNaN(d.getTime())) return fallback;
        return d.toLocaleDateString();
    } catch {
        return fallback;
    }
}

function formatTimeSafe(val: unknown, fallback = 'Recently'): string {
    if (!val) return fallback;
    try {
        const d = new Date(val as any);
        if (isNaN(d.getTime())) return fallback;
        return d.toLocaleTimeString();
    } catch {
        return fallback;
    }
}

function parseSchemaSafe(schema: unknown): any[] {
    if (!schema) return [];
    if (Array.isArray(schema)) return schema;
    if (typeof schema === 'string') {
        try {
            const parsed = JSON.parse(schema);
            return Array.isArray(parsed) ? parsed : [];
        } catch {
            return [];
        }
    }
    return [];
}

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

    const [showWorkflows, setShowWorkflows] = useState(false);
    const [showResponsesWorkflow, setShowResponsesWorkflow] = useState(false);
    const [workflowTargetForm, setWorkflowTargetForm] = useState<Forms | null>(null);

    const handleCreate = useCallback(() => {
        setSelectedForm(null);
        setSelectedDraft(null);
        setDialogOpen(true);
    }, []);

    useEffect(() => {
        setConfiguration({
            isVisible: true,
            mainColor: '#6366F1',
            mainIcon: <Plus size={26} strokeWidth={3} />,
            onMainClick: handleCreate,
            actions: [
                { id: 'create-form', label: 'CREATE FORM', icon: <Plus size={20} />, onClick: handleCreate }
            ]
        });
        return () => resetConfiguration();
    }, [setConfiguration, resetConfiguration, handleCreate]);

    const formsRef = useRef<Forms[]>([]);
    useEffect(() => {
        formsRef.current = forms;
    }, [forms]);

    const sortForms = useCallback((rows: Forms[]) => {
        if (!Array.isArray(rows)) return [];
        return [...rows].sort((a: any, b: any) => {
            if (!a) return 1;
            if (!b) return -1;
            const aId = a.$id || a.id;
            const bId = b.$id || b.id;
            const aPinned = aId ? isResourcePinned('form', aId, a.userId, a.isPinned) : false;
            const bPinned = bId ? isResourcePinned('form', bId, b.userId, b.isPinned) : false;
            if (aPinned && !bPinned) return -1;
            if (!aPinned && bPinned) return 1;

            const timeA = a.$createdAt || a.createdAt ? new Date(a.$createdAt || a.createdAt).getTime() : 0;
            const timeB = b.$createdAt || b.createdAt ? new Date(b.$createdAt || b.createdAt).getTime() : 0;
            const validA = isNaN(timeA) ? 0 : timeA;
            const validB = isNaN(timeB) ? 0 : timeB;
            return validB - validA;
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
                if (db?.forms) {
                    items = (await db.forms.find().exec()).map((d: any) => d.toJSON());
                }
            } catch {
                items = [];
            }
            if (items.length === 0) {
                const [userScopedList, userScopedForms, legacyList] = await Promise.all([
                    LocalEngine.cacheGet<any[]>(`f_forms_list_${userId}`).catch(() => null),
                    LocalEngine.cacheGet<any[]>(`f_forms_${userId}`).catch(() => null),
                    LocalEngine.cacheGet<any[]>('f_forms_list').catch(() => null),
                ]);
                items = userScopedList || userScopedForms || legacyList || [];
            }

            const isFormActive = (f: any) => f && !f.isTrash && !f.isDeleted && !LocalEngine.isDeleted(f.$id || f.id || '', userId);

            if (items.length > 0) {
                const activeLocal = items.filter(isFormActive);
                setForms(sortForms(activeLocal as unknown as Forms[]));
                setLoading(false);
            }

            // Sync drafts safely
            try {
                const drafts = await DraftsService.listDrafts();
                setOfflineDrafts(Array.isArray(drafts) ? drafts : []);
            } catch {
                setOfflineDrafts([]);
            }

            if (userId === 'guest') return;

            const res = await FormsService.listUserForms(userId);
            const remoteRows = Array.isArray(res) ? res : (res?.rows || []);

            if (Array.isArray(remoteRows)) {
                const activeRemote = remoteRows.filter(isFormActive);
                const currentFormsMap = new Map(formsRef.current.map((f) => [f.$id || (f as any).id, f]));
                const activeLocal = items.filter(isFormActive);
                const localItemsMap = new Map(activeLocal.map((f) => [f.$id || (f as any).id, f]));

                const mergedMap = new Map<string, Forms>();

                // 1. Add active remote rows, preserving workspace properties if set locally
                activeRemote.forEach((remoteRow: any) => {
                    const id = remoteRow.$id || remoteRow.id;
                    if (!id) return;
                    const existingCurrent = currentFormsMap.get(id) as any;
                    const existingLocal = localItemsMap.get(id) as any;
                    const mergedForm = {
                        ...existingLocal,
                        ...existingCurrent,
                        ...remoteRow,
                        $id: id,
                        projectId: remoteRow.projectId || existingCurrent?.projectId || existingLocal?.projectId,
                        isWorkspace: remoteRow.isWorkspace ?? existingCurrent?.isWorkspace ?? existingLocal?.isWorkspace ?? Boolean(remoteRow.projectId || existingCurrent?.projectId || existingLocal?.projectId),
                    };
                    mergedMap.set(id, mergedForm);
                });

                // 2. Preserve active local items that belong to custom workspaces or are pending sync
                activeLocal.forEach((localItem: any) => {
                    const id = localItem.$id || localItem.id;
                    if (!id) return;
                    if (!mergedMap.has(id)) {
                        if (localItem.projectId || localItem.isWorkspace) {
                            mergedMap.set(id, localItem);
                        }
                    }
                });

                const merged = Array.from(mergedMap.values());
                setForms(sortForms(merged as unknown as Forms[]));
                await LocalEngine.cacheSet(`f_forms_list_${userId}`, merged);
                await LocalEngine.cacheSet(`f_forms_${userId}`, merged);
                await LocalEngine.cacheSet('f_forms_list', merged);
            }
        } catch (error) {
            console.error('Failed to fetch forms', error);
        } finally {
            setLoading(false);
        }
    }, [user?.$id, sortForms]);
    const fetchFormsRef = useRef(fetchForms);
    useEffect(() => {
        fetchFormsRef.current = fetchForms;
    }, [fetchForms]);

    useEffect(() => {
        void fetchForms(false);

        // Realtime subscription: live sync for forms mutations (initialized once per user)
        let unsubscribe: (() => void) | undefined;
        void (async () => {
            try {
                const { client } = await import('@/lib/appwrite/client');
                const { APPWRITE_CONFIG } = await import('@/lib/appwrite/config');
                const dbId = APPWRITE_CONFIG.DATABASES.FLOW;
                const tableId = APPWRITE_CONFIG.TABLES.FLOW.FORMS;
                const channel = `databases.${dbId}.collections.${tableId}.documents`;
                unsubscribe = client.subscribe(channel, (response: any) => {
                    if (response?.events?.some((event: string) => event.includes('.create') || event.includes('.update') || event.includes('.delete'))) {
                        void fetchFormsRef.current(false);
                    }
                });
            } catch {}
        })();

        return () => {
            if (unsubscribe) unsubscribe();
        };
    }, [user?.$id]);

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

    const handleEdit = useCallback((form: Forms) => {
        setSelectedForm(form);
        setSelectedDraft(null);
        setDialogOpen(true);
    }, []);

    const handleEditDraft = useCallback((draft: FormDraft) => {
        const existingForm = formsRef.current.find(f => f.$id === draft.id);
        setSelectedForm(existingForm || null);
        setSelectedDraft(draft);
        setDialogOpen(true);
    }, []);

    const handleDelete = useCallback(async (form: Forms) => {
        openDrawer('delete-confirm', {
            title: `Purge "${form.title || 'this form'}"?`,
            description: 'This will permanently erase all metadata, configurations, and associated responses for this form.',
            resourceName: 'this form',
            confirmLabel: 'Confirm Purge',
            onConfirm: async () => {
                const formId = form.$id || (form as any).id;
                const userId = user?.$id || 'guest';

                closeSidebar();
                closeOverlay();

                // Instantly mark as deleted in LocalEngine tombstones and update UI state
                void LocalEngine.markDeleted(formId, userId);
                setForms((prev) => prev.filter((f) => (f.$id || (f as any).id) !== formId));

                try {
                    await FormsService.deleteForm(formId);
                } catch (err) {
                    console.error("Failed to delete form", err);
                }
            }
        });
    }, [openDrawer, user?.$id, closeSidebar, closeOverlay]);

    const handleDeleteDraft = useCallback((draft: FormDraft) => {
        openDrawer('delete-confirm', {
            title: `Delete Local Draft?`,
            description: `You are about to remove "${draft.title || 'Untitled Portal'}" from your local storage. This cannot be recovered.`,
            resourceName: 'this draft',
            confirmLabel: 'Delete Draft',
            onConfirm: async () => {
                await DraftsService.clearDraft(draft.id);
                void fetchForms(false);
            }
        });
    }, [openDrawer, fetchForms]);

    const handleOpenSettings = useCallback((form: Forms) => {
        setSelectedForm(form);
        setSelectedDraft(null);
        setSettingsOpen(true);
    }, []);

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
    }, [openSidebar, closeSidebar, openOverlay, closeOverlay, handleEdit, handleDelete]);

    const handleTogglePin = useCallback(async (form: Forms) => {
        if (!user?.$id || !form?.$id) return;
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
    }, [user?.$id, togglePin, sortForms]);

    const activeFormsCount = useMemo(() => workspaceScopedForms.length, [workspaceScopedForms]);

    return (
        <div className="flex-1 min-h-screen pointer-events-auto">
            <div className="w-full max-w-[1440px] mx-auto p-4 md:p-8">
                <div className="min-w-0 w-full flex flex-col gap-6">
                    {/* Top Nav Switcher */}
                    <div className="flex items-center justify-between gap-3 w-full">
                        <div className="flex items-center gap-1.5 sm:gap-2 p-1.5 bg-[#000000] border-2 border-white/20 rounded-2xl w-fit select-none shadow-md">
                            <Link
                                href="/app"
                                className="flex items-center gap-1.5 px-3.5 sm:px-5 py-2 sm:py-2.5 rounded-xl text-xs font-extrabold transition-all text-white border border-white/10 hover:border-white/30 hover:bg-white/[0.06]"
                                title="Ideas"
                                aria-label="Ideas"
                            >
                                <FileText size={15} />
                                <span className="hidden sm:inline">Ideas</span>
                            </Link>
                            <Link
                                href="/forms"
                                className="flex items-center gap-1.5 px-3.5 sm:px-5 py-2 sm:py-2.5 rounded-xl text-xs font-extrabold transition-all bg-[#6366F1] text-white border border-[#6366F1] shadow-[0_4px_12px_rgba(99,102,241,0.25)]"
                                title="Forms"
                                aria-label="Forms"
                            >
                                <FileSpreadsheet size={15} />
                                <span className="hidden sm:inline">Forms</span>
                            </Link>
                        </div>

                        <div className="flex items-center gap-2">
                            <FlowTabTrigger />
                            <HangoutTabTrigger />
                            <button 
                                type="button"
                                onClick={handleCreate}
                                className="hidden md:inline-flex items-center gap-2 px-4 py-2.5 rounded-xl text-xs font-extrabold bg-[#6366F1] text-white hover:bg-[#5254D8] active:scale-95 transition-all shadow-[0_4px_14px_rgba(99,102,241,0.3)] select-none shrink-0 cursor-pointer"
                            >
                                <Plus size={16} strokeWidth={2.5} />
                                <span>Create Form</span>
                            </button>
                        </div>
                    </div>

                    {/* Filter Tabs Bar */}
                    <div className="overflow-x-auto scrollbar-none p-1.5 bg-[#000000] border-2 border-white/20 rounded-[24px] flex items-center gap-2 select-none w-fit shadow-md">
                        {[
                            { 
                                label: (
                                    <div className="flex items-center gap-1.5">
                                        <span>Active Forms</span>
                                        {activeFormsCount > 0 && (
                                            <span className="bg-[#6366F1]/20 border border-[#6366F1]/40 text-[#6366F1] rounded-full px-1.5 py-0.2 text-[10px] flex items-center justify-center font-bold font-mono">
                                                {activeFormsCount}
                                            </span>
                                        )}
                                    </div>
                                ), 
                                icon: FileSpreadsheet 
                            },
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
                                    className={`flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-bold transition-all font-satoshi cursor-pointer border ${
                                        isActive 
                                            ? 'bg-[#161412] text-white border-2 border-[#FFFFFF] shadow-sm' 
                                            : 'border border-white/20 text-white hover:border-white/50 hover:bg-[#161412]'
                                    }`}
                                >
                                    <Icon className="h-4 w-4" />
                                    <span>{tab.label}</span>
                                </button>
                            );
                        })}
                    </div>

                    {/* Main Content Area */}
                    {loading && forms.length === 0 ? (
                        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
                            {[1, 2, 3].map((i) => (
                                <div key={i} className="bg-[#000000] border-2 border-white/10 rounded-2xl p-5 animate-pulse space-y-4">
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
                                        <div className="py-24 text-center bg-[#000000] border-2 border-dashed border-white/15 rounded-3xl">
                                            <FileSpreadsheet className="h-14 w-14 mx-auto text-white/20 mb-3" />
                                            <h3 className="text-lg font-clash font-bold text-white mb-2">No active forms</h3>
                                            <p className="text-xs text-white/50 font-satoshi max-w-sm mx-auto mb-5">
                                                Create customized intake forms to collect data, feedback, and structured responses.
                                            </p>
                                            <button 
                                                type="button" 
                                                onClick={handleCreate} 
                                                className="inline-flex items-center gap-2 px-5 py-2.5 bg-[#6366F1] hover:bg-[#5254D8] text-white font-bold rounded-xl text-xs font-satoshi transition-all cursor-pointer shadow-[0_4px_14px_rgba(99,102,241,0.25)]"
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
                                                    onOpenWorkflows={(f) => {
                                                        setWorkflowTargetForm(f);
                                                        setShowWorkflows(true);
                                                    }}
                                                />
                                            ))}
                                        </div>
                                    )}
                                </>
                            )}

                            {tabValue === 1 && (
                                <div className="py-24 text-center bg-[#000000] border-2 border-dashed border-white/15 rounded-3xl">
                                    <Sparkles className="h-14 w-14 mx-auto text-[#6366F1] mb-3" />
                                    <h3 className="text-lg font-bold font-clash text-white tracking-tight">Form Templates Catalog Coming Soon</h3>
                                    <p className="text-xs text-white/50 font-satoshi max-w-sm mx-auto mt-2">
                                        Pre-configured intake workflows, bug triage forms, and registration templates will appear here.
                                    </p>
                                </div>
                            )}

                            {tabValue === 2 && (
                                <>
                                    {offlineDrafts.length === 0 ? (
                                        <div className="py-24 text-center bg-[#000000] border-2 border-dashed border-white/15 rounded-3xl">
                                            <History className="h-14 w-14 mx-auto text-white/20 mb-3" />
                                            <h3 className="text-lg font-bold font-clash text-white tracking-tight">No offline form drafts</h3>
                                            <p className="text-xs text-white/50 font-satoshi max-w-sm mx-auto mt-2">
                                                Uncommitted edits and offline changes stored on this device will appear here.
                                            </p>
                                        </div>
                                    ) : (
                                        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
                                            {offlineDrafts.map((draft) => (
                                                <div 
                                                    key={draft.id}
                                                    onClick={() => handleEditDraft(draft)}
                                                    className="bg-[#000000] border-2 border-white/20 hover:border-white/40 rounded-2xl p-5 transition-all flex flex-col justify-between cursor-pointer group"
                                                >
                                                    <div>
                                                        <div className="flex justify-between items-center mb-3">
                                                            <span className="text-[9px] font-bold font-mono px-2 py-0.5 rounded border border-[#FFB020]/40 text-[#FFB020] bg-[#FFB020]/10 tracking-wider">
                                                                LOCAL DRAFT
                                                            </span>
                                                            <span className="text-xs text-white opacity-70 font-mono">
                                                                {formatTimeSafe(draft.updatedAt)}
                                                            </span>
                                                        </div>
                                                        <h2 className="text-base font-bold text-white font-clash tracking-tight truncate group-hover:text-[#FFB020] transition-colors">
                                                            {draft.title || 'Untitled Draft'}
                                                        </h2>
                                                        <p className="text-white opacity-70 text-xs font-satoshi line-clamp-2 mt-1">
                                                            Unsynced changes stored in device engine.
                                                        </p>
                                                    </div>

                                                    <div className="pt-4 mt-4 border-t-2 border-white/20 flex items-center justify-between">
                                                        <span className="text-xs font-bold text-[#FFB020] font-satoshi">
                                                            Resume Draft
                                                        </span>
                                                        <button
                                                            type="button"
                                                            onClick={(e) => {
                                                                e.stopPropagation();
                                                                handleDeleteDraft(draft);
                                                            }}
                                                            className="text-white hover:text-red-400 p-1 transition-colors cursor-pointer"
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

                    {/* Dialogs & Workflow Drawers */}
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

                    {workflowTargetForm && (
                        <>
                            <ObjectWorkflowsDrawer
                                isOpen={showWorkflows}
                                onClose={() => setShowWorkflows(false)}
                                objectType="form"
                                targetObject={{
                                    id: workflowTargetForm.$id,
                                    title: workflowTargetForm.title || 'Form',
                                    description: workflowTargetForm.description || '',
                                    raw: workflowTargetForm,
                                }}
                                onOpenFormResponsesWorkflow={() => setShowResponsesWorkflow(true)}
                            />
                            <FormResponsesWorkflowDrawer
                                isOpen={showResponsesWorkflow}
                                onClose={() => setShowResponsesWorkflow(false)}
                                formId={workflowTargetForm.$id}
                                formTitle={workflowTargetForm.title || 'Form'}
                                submissions={(workflowTargetForm as any).submissions || (workflowTargetForm as any).responses || []}
                                liveFields={parseSchemaSafe(workflowTargetForm.schema)}
                                activeWorkspaceId={activeWorkspace?.id || null}
                            />
                        </>
                    )}
                </div>
            </div>
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
    onUpdate,
    onOpenWorkflows
}: {
    form: any;
    onSelect: () => void;
    onTogglePin: (form: any) => void;
    onEdit: (form: any) => void;
    onOpenSettings: (form: any) => void;
    onDelete: (form: any) => void;
    onUpdate: () => void;
    onOpenWorkflows: (form: any) => void;
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
        { label: pinned ? 'Unpin' : 'Pin', icon: <Pin size={16} className={pinned ? 'rotate-45 text-[#F59E0B]' : ''} />, onClick: () => onTogglePin(form) },
        {
            label: 'Copy Form',
            icon: <Copy size={16} className="text-[#3B82F6]" />,
            submenu: [
                {
                    label: 'Copy as Markdown',
                    icon: <FileText size={16} />,
                    onClick: async () => {
                        try {
                            const parsedFields = parseSchemaSafe(form.schema);
                            let md = `# ${form.title || 'Untitled Form'}\n`;
                            if (form.description) md += `\n${form.description}\n`;
                            md += `\n## Form Fields\n\n`;
                            if (Array.isArray(parsedFields) && parsedFields.length > 0) {
                                parsedFields.forEach((f: any, idx: number) => {
                                    const fieldLabel = f.label || f.name || `Field ${idx + 1}`;
                                    const fieldType = f.type || 'text';
                                    const req = f.required ? ' (Required)' : '';
                                    md += `- **${fieldLabel}** [${fieldType}]${req}\n`;
                                    if (f.description) md += `  *${f.description}*\n`;
                                    if (Array.isArray(f.options) && f.options.length > 0) {
                                        f.options.forEach((opt: any) => {
                                            const optLabel = typeof opt === 'string' ? opt : opt.label || opt.value;
                                            md += `  - ${optLabel}\n`;
                                        });
                                    }
                                });
                            } else {
                                md += `*No fields defined.*\n`;
                            }
                            await navigator.clipboard.writeText(md);
                            toast.success('Form copied as Markdown');
                        } catch (err: any) {
                            toast.error(err?.message || 'Failed to copy form as Markdown');
                        }
                    }
                },
                {
                    label: 'Copy as JSON',
                    icon: <Code size={16} className="text-[#10B981]" />,
                    onClick: async () => {
                        try {
                            const parsedFields = parseSchemaSafe(form.schema);
                            const jsonPayload = {
                                id: form.$id,
                                title: form.title || 'Untitled Form',
                                description: form.description || '',
                                status: form.status,
                                fields: parsedFields,
                            };
                            await navigator.clipboard.writeText(JSON.stringify(jsonPayload, null, 2));
                            toast.success('Form copied as JSON');
                        } catch (err: any) {
                            toast.error(err?.message || 'Failed to copy form as JSON');
                        }
                    }
                }
            ]
        },
        {
            label: 'Move to Workspace',
            icon: <FolderInput size={16} className="text-[#6366F1]" />,
            onClick: () => openDrawer('move-to-workspace', {
                entityKind: 'form',
                entityId: form.$id,
                entityTitle: form.title || 'Untitled Form',
                currentWorkspaceId: form.projectId || undefined,
            })
        },
        { label: 'Workflows', icon: <Sparkles size={16} className="text-[#A855F7]" />, onClick: () => onOpenWorkflows(form) },
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
    const fields = parseSchemaSafe(form.schema);

    return (
        <div 
            onClick={onSelect}
            onContextMenu={handleRightClick}
            className="group relative bg-[#000000] hover:bg-[#080808] border-2 border-white/20 hover:border-white/40 rounded-2xl p-5 transition-all flex flex-col justify-between cursor-pointer select-none shadow-sm"
        >
            <div className="space-y-3">
                <div className="flex items-start justify-between gap-3">
                    <div className="flex items-center gap-2.5 min-w-0">
                        <div className="w-8 h-8 rounded-xl bg-[#161412] border-2 border-white/20 flex items-center justify-center text-[#6366F1] shrink-0 group-hover:border-[#6366F1]/60 transition-colors">
                            <FileSpreadsheet size={15} />
                        </div>
                        <h3 className="font-clash font-extrabold text-white text-base tracking-tight group-hover:text-[#6366F1] transition-colors truncate">
                            {form.title || 'Untitled Form'}
                        </h3>
                    </div>

                    <div className="flex items-center gap-1.5 shrink-0" onClick={(e) => e.stopPropagation()}>
                        <button
                            type="button"
                            onClick={(e) => {
                                e.stopPropagation();
                                window.dispatchEvent(
                                    new CustomEvent('kylrix:open-sidekick', {
                                        detail: {
                                            type: 'form',
                                            id: form.$id,
                                            title: form.title,
                                            content: form.description || '',
                                        },
                                    })
                                );
                            }}
                            className="p-1.5 rounded-lg transition-all duration-200 text-white hover:text-[#6366F1] hover:bg-[#6366F1]/10 cursor-pointer"
                            title="Sidekick Assist"
                            aria-label="Sidekick Assist"
                        >
                            <Wand2 size={15} />
                        </button>
                        <ShareLockButton
                            resourceType="form"
                            resourceId={form.$id}
                            isPublic={!!form.isPublic}
                            isGuest={!!form.isGuest}
                            resourceTitle={form.title}
                            accentColor="#6366F1"
                            onPublished={onUpdate}
                        />
                        <span className={`px-2 py-0.5 rounded-full text-[9px] font-extrabold uppercase font-mono tracking-wider border ${
                            isPublished 
                                ? 'bg-emerald-500/10 border-emerald-500/20 text-emerald-400' 
                                : 'bg-amber-500/10 border-amber-500/20 text-amber-400'
                        }`}>
                            {form.status || 'draft'}
                        </span>
                    </div>
                </div>

                <p className="text-xs text-white opacity-70 font-satoshi line-clamp-2 min-h-[2.5rem] leading-relaxed">
                    {form.description || 'No description provided.'}
                </p>
            </div>

            <div className="pt-4 mt-4 border-t-2 border-white/20 flex items-center justify-between">
                <div className="flex items-center gap-2 text-[11px] text-white opacity-70 font-mono">
                    <span>{formatDateSafe(form.updatedAt || form.$createdAt)}</span>
                    <span>•</span>
                    <span>{fields.length} {fields.length === 1 ? 'field' : 'fields'}</span>
                </div>

                <div className="flex items-center gap-2">
                    <button 
                        type="button" 
                        onClick={(e) => {
                            e.stopPropagation();
                            onEdit(form);
                        }}
                        className="px-2.5 py-1 rounded-lg bg-[#161412] border-2 border-white/20 hover:border-white/40 text-[11px] font-bold text-white hover:bg-[#6366F1]/15 transition-colors font-satoshi cursor-pointer"
                    >
                        Edit
                    </button>
                    <div className="text-white opacity-50 group-hover:opacity-100 transition-opacity">
                        <ChevronRight size={14} />
                    </div>
                </div>
            </div>
        </div>
    );
}
