'use client';

import React, { useState, useEffect, useRef } from 'react';
import {
  FileText,
  Plus,
  X,
  GripVertical,
  Settings,
  Trash2,
  Wand2,
  ChevronDown,
  ArrowUp,
  ArrowDown,
  Type,
  AlignLeft,
  Mail,
  Hash,
  ListFilter,
  CheckCircle2,
  List,
  UploadCloud,
  Ghost,
} from 'lucide-react';
import { GHOST_FIELDS_REGISTRY, getEnabledGhostFields } from '@/lib/forms/ghost-fields';
import { Drawer } from '@/lib/openbricks/primitives';
import { FormsService } from '@/lib/services/forms';
import { DraftsService, FormDraft } from '@/lib/services/drafts';
import { Forms, FormsStatus } from '@/generated/appwrite/types';
import { useAuth } from '@/context/auth/AuthContext';
import { useDataNexus } from '@/context/DataNexusContext';
import { useWorkspace } from '@/context/WorkspaceContext';
import { autonomicSyncEngine } from '@/lib/services/sync-engine';
import { hasPaidKylrixPlan } from '@/lib/utils';
import { useProUpgrade } from '@/context/ProUpgradeContext';
import { useDrawerState } from '@/components/ui/DrawerStateContext';
import { ObjectAssistDrawer } from '@/components/agentic/ObjectAssistDrawer';

import {
  DndContext,
  closestCenter,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
  DragEndEvent,
} from '@dnd-kit/core';
import {
  arrayMove,
  SortableContext,
  sortableKeyboardCoordinates,
  verticalListSortingStrategy,
  useSortable,
} from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { restrictToVerticalAxis } from '@dnd-kit/modifiers';

interface FormDialogProps {
  open: boolean;
  onClose: () => void;
  form?: Forms | null;
  initialDraft?: FormDraft;
  onSaved: () => void;
}

const FIELD_TYPES = [
  { value: 'text', label: 'Short Text', icon: <Type size={14} /> },
  { value: 'textarea', label: 'Long Text', icon: <AlignLeft size={14} /> },
  { value: 'email', label: 'Email Address', icon: <Mail size={14} /> },
  { value: 'number', label: 'Number Input', icon: <Hash size={14} /> },
  { value: 'select', label: 'Dropdown Menu', icon: <ListFilter size={14} /> },
  { value: 'radio', label: 'Single Choice (Radio)', icon: <CheckCircle2 size={14} /> },
  { value: 'checkbox', label: 'Multiple Choice (Checkbox)', icon: <List size={14} /> },
  { value: 'file', label: 'File Upload (Pro)', icon: <UploadCloud size={14} /> },
];

function SortableField({
  field,
  fIdx,
  updateField,
  removeField,
  addOption,
  updateOption,
  removeOption,
  isChoiceType,
  user,
  openProUpgrade,
  openSettingsDrawer,
}: any) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
    id: field.id,
  });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    zIndex: isDragging ? 1000 : 1,
    opacity: isDragging ? 0.6 : 1,
  };

  return (
    <div
      ref={setNodeRef}
      style={style}
      className={`rounded-[20px] bg-[#000000] border transition-all p-4 sm:p-5 space-y-4 shadow-md relative ${
        isDragging
          ? 'border-[#6366F1] shadow-[0_8px_32px_rgba(99,102,241,0.25)]'
          : 'border-white/[0.08] hover:border-white/20'
      }`}
    >
      {/* Top Header Row: Drag Handle, Question Label, Remove Button */}
      <div className="flex items-center gap-3">
        <div
          {...attributes}
          {...listeners}
          className="p-1.5 text-white/30 hover:text-white/70 cursor-grab active:cursor-grabbing rounded-lg hover:bg-white/5 transition-colors shrink-0"
          title="Drag to reorder"
        >
          <GripVertical size={16} />
        </div>

        <input
          type="text"
          placeholder="Enter question label..."
          value={field.label}
          onChange={(e) => updateField(fIdx, { label: e.target.value })}
          className="flex-1 bg-[#161412] border border-white/10 focus:border-[#6366F1] text-white text-sm font-clash font-extrabold rounded-xl px-3.5 py-2 outline-none transition-all placeholder:text-white/30"
        />

        <button
          type="button"
          onClick={() => removeField(fIdx)}
          className="p-2 text-white/40 hover:text-red-400 hover:bg-red-500/10 rounded-xl border border-transparent hover:border-red-500/20 transition-all shrink-0 cursor-pointer"
          title="Remove question"
        >
          <Trash2 size={16} />
        </button>
      </div>

      {/* Row 2: Type Dropdown, Required Toggle, Field Settings */}
      <div className="flex flex-wrap items-center justify-between gap-3 pt-1 border-t border-white/5">
        <div className="flex items-center gap-2">
          {/* Field Type Select */}
          <div className="relative">
            <select
              value={field.type}
              onChange={(e) => {
                const val = e.target.value;
                if (val === 'file' && !hasPaidKylrixPlan(user)) {
                  openProUpgrade('Form File Uploads');
                  return;
                }
                updateField(fIdx, { type: val });
              }}
              className="bg-[#161412] border border-white/10 hover:border-white/20 text-white font-satoshi text-xs font-bold rounded-xl px-3 py-2 pr-8 outline-none appearance-none cursor-pointer transition-all"
            >
              {FIELD_TYPES.map((t) => (
                <option key={t.value} value={t.value} className="bg-[#161412] text-white">
                  {t.label}
                </option>
              ))}
            </select>
            <ChevronDown size={14} className="absolute right-2.5 top-1/2 -translate-y-1/2 text-white/40 pointer-events-none" />
          </div>

          {/* Required Switch Toggle */}
          <label className="flex items-center gap-2 px-3 py-1.5 rounded-xl bg-[#161412] border border-white/5 cursor-pointer select-none">
            <input
              type="checkbox"
              checked={Boolean(field.required)}
              onChange={(e) => updateField(fIdx, { required: e.target.checked })}
              className="sr-only peer"
            />
            <div className="w-8 h-4 bg-white/10 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-3 after:w-3 after:transition-all peer-checked:bg-[#6366F1] relative" />
            <span className="text-[10px] font-mono font-bold uppercase tracking-wider text-white/70">
              Required
            </span>
          </label>
        </div>

        <button
          type="button"
          onClick={() => openSettingsDrawer(fIdx)}
          className="p-2 text-white/50 hover:text-white hover:bg-white/5 rounded-xl border border-white/5 hover:border-white/10 transition-all cursor-pointer flex items-center gap-1.5 text-xs font-satoshi font-bold"
        >
          <Settings size={14} />
          <span>Rules</span>
        </button>
      </div>

      {/* Choice Options List for Select / Radio / Checkbox */}
      {isChoiceType(field.type) && (
        <div className="space-y-2 pt-2 border-t border-white/5">
          <span className="text-[10px] font-mono font-bold uppercase tracking-wider text-[#6366F1] block">
            Configure Choice Options
          </span>
          <div className="space-y-2">
            {(field.options || []).map((opt: string, oIdx: number) => (
              <div key={oIdx} className="flex items-center gap-2">
                <input
                  type="text"
                  value={opt}
                  onChange={(e) => updateOption(fIdx, oIdx, e.target.value)}
                  className="flex-1 bg-[#161412] border border-white/5 focus:border-[#6366F1] text-white text-xs font-satoshi font-semibold rounded-xl px-3 py-1.5 outline-none transition-all"
                />
                <button
                  type="button"
                  onClick={() => removeOption(fIdx, oIdx)}
                  className="p-1.5 text-white/30 hover:text-red-400 hover:bg-white/5 rounded-lg transition-colors cursor-pointer"
                >
                  <X size={14} />
                </button>
              </div>
            ))}
          </div>

          <button
            type="button"
            onClick={() => addOption(fIdx)}
            className="text-[11px] font-mono font-bold text-[#6366F1] hover:text-[#818CF8] flex items-center gap-1 pt-1 cursor-pointer"
          >
            <Plus size={12} />
            <span>Add Option</span>
          </button>
        </div>
      )}
    </div>
  );
}

export default function FormDialog({ open, onClose, form, initialDraft, onSaved }: FormDialogProps) {
  const [loading, setLoading] = useState(false);
  const { user } = useAuth();
  const { openProUpgrade } = useProUpgrade();
  const _isPro = hasPaidKylrixPlan(user);
  const { invalidate } = useDataNexus();
  const { activeWorkspace, attachEntityToActiveWorkspace } = useWorkspace();
  const { setIsDrawerOpen } = useDrawerState();

  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [status, setStatus] = useState<'draft' | 'published' | 'archived'>('draft');
  const [fields, setFields] = useState<any[]>([]);
  const [enabledGhostFields, setEnabledGhostFields] = useState<string[]>([]);
  const [hasUnsavedChanges, setHasUnsavedChanges] = useState(false);
  const [isRestored, setIsRestored] = useState(false);

  // Drawers state
  const [assistDrawerOpen, setAssistDrawerOpen] = useState(false);
  const [ghostDrawerOpen, setGhostDrawerOpen] = useState(false);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [activeSettingsFieldIndex, setActiveSettingsFieldIndex] = useState<number | null>(null);

  const initialLoadRef = useRef(true);
  const fieldsEndRef = useRef<HTMLDivElement>(null);

  const openSettingsDrawer = (fIdx: number) => {
    setActiveSettingsFieldIndex(fIdx);
    setSettingsOpen(true);
  };

  useEffect(() => {
    setIsDrawerOpen(open);
    if (typeof window !== 'undefined') {
      if (open) {
        document.body.classList.add('drawer-expanded');
      } else {
        document.body.classList.remove('drawer-expanded');
      }
    }
    return () => {
      setIsDrawerOpen(false);
      if (typeof window !== 'undefined') {
        document.body.classList.remove('drawer-expanded');
      }
    };
  }, [open, setIsDrawerOpen]);

  const handleClose = () => {
    onClose();
  };

  const sensors = useSensors(
    useSensor(PointerSensor),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates })
  );

  const validateFieldsLogic = (currentFields: any[]) => {
    return currentFields.map((field, idx) => {
      if (field.logic?.enabled && field.logic.showIfFieldId) {
        const parentIdx = currentFields.findIndex((f) => f.id === field.logic.showIfFieldId);
        if (parentIdx === -1 || parentIdx >= idx) {
          return {
            ...field,
            logic: {
              ...field.logic,
              enabled: false,
              showIfFieldId: '',
              showIfValue: '',
            },
          };
        }
      }
      return field;
    });
  };

  const handleDragEnd = (event: DragEndEvent) => {
    const { active, over } = event;

    if (active.id !== over?.id) {
      setFields((items) => {
        const oldIndex = items.findIndex((item) => item.id === active.id);
        const newIndex = items.findIndex((item) => item.id === over?.id);
        const nextItems = arrayMove(items, oldIndex, newIndex);
        return validateFieldsLogic(nextItems);
      });
    }
  };

  const moveFieldUp = (index: number) => {
    if (index <= 0) return;
    setFields((prev) => {
      const next = [...prev];
      const temp = next[index];
      next[index] = next[index - 1];
      next[index - 1] = temp;
      return validateFieldsLogic(next);
    });
    setActiveSettingsFieldIndex(index - 1);
  };

  const moveFieldDown = (index: number) => {
    if (index >= fields.length - 1) return;
    setFields((prev) => {
      const next = [...prev];
      const temp = next[index];
      next[index] = next[index + 1];
      next[index + 1] = temp;
      return validateFieldsLogic(next);
    });
    setActiveSettingsFieldIndex(index + 1);
  };

  // Initial load logic
  useEffect(() => {
    if (!open) {
      initialLoadRef.current = true;
      return;
    }

    const loadData = async () => {
      if (initialDraft) {
        setTitle(initialDraft.title || '');
        setDescription(initialDraft.description || '');
        setStatus((initialDraft.status as any) || 'draft');
        setFields(initialDraft.fields || []);
        setIsRestored(true);
        setHasUnsavedChanges(true);
      } else if (form) {
        const savedDraft = await DraftsService.getDraft(form.$id);
        if (savedDraft) {
          setTitle(savedDraft.title || '');
          setDescription(savedDraft.description || '');
          setStatus((savedDraft.status as any) || 'draft');
          setFields(savedDraft.fields || []);
          setEnabledGhostFields((savedDraft as any).ghostFields || getEnabledGhostFields(form.settings));
          setIsRestored(true);
          setHasUnsavedChanges(true);
        } else {
          setTitle(form.title);
          setDescription(form.description || '');
          setStatus(form.status as any);
          try {
            setFields(JSON.parse(form.schema || '[]'));
          } catch (_e) {
            setFields([]);
          }
          setEnabledGhostFields(getEnabledGhostFields(form.settings));
          setIsRestored(false);
          setHasUnsavedChanges(false);
        }
      } else {
        // Brand new form creation: clear any stale 'new' draft and start fresh
        void DraftsService.clearDraft('new');
        setTitle('');
        setDescription('');
        setStatus('draft');
        setFields([{ id: 'field_1', label: 'Full Name', type: 'text', required: true }]);
        setEnabledGhostFields([]);
        setIsRestored(false);
        setHasUnsavedChanges(false);
      }

      setTimeout(() => {
        initialLoadRef.current = false;
      }, 100);
    };
    void loadData();
  }, [form, open, initialDraft]);

  // Autosave logic
  useEffect(() => {
    if (initialLoadRef.current || !open) return;

    const formId = form?.$id || (initialDraft ? initialDraft.id : 'new');
    const currentFieldsStr = JSON.stringify(fields);

    let isDifferent = true;
    if (form && !isRestored) {
      try {
        const originalFields = JSON.parse(form.schema || '[]');
        if (
          title === form.title &&
          description === (form.description || '') &&
          status === form.status &&
          currentFieldsStr === JSON.stringify(originalFields)
        ) {
          isDifferent = false;
        }
      } catch (_e) {}
    }

    if (isDifferent) {
      void DraftsService.saveDraft(formId, { title, description, status, fields, ghostFields: enabledGhostFields } as any);
      setHasUnsavedChanges(true);
    } else {
      void DraftsService.clearDraft(formId);
      setHasUnsavedChanges(false);
    }
  }, [title, description, status, fields, open, isRestored, form, initialDraft]);

  const addField = () => {
    const id = `field_${Date.now()}`;
    setFields([
      ...fields,
      {
        id,
        label: 'New Question',
        type: 'text',
        required: false,
        options: ['Option 1'],
        showSettings: false,
        validation: {},
      },
    ]);

    setTimeout(() => {
      fieldsEndRef.current?.scrollIntoView({ behavior: 'smooth', block: 'center' });
    }, 100);
  };

  const removeField = (index: number) => {
    setFields((prev) => {
      const next = prev.filter((_, i) => i !== index);
      return validateFieldsLogic(next);
    });
  };

  const updateField = (index: number, updates: any) => {
    const newFields = [...fields];
    newFields[index] = { ...newFields[index], ...updates };
    setFields(newFields);
  };

  const addOption = (fieldIndex: number) => {
    const newFields = [...fields];
    const options = newFields[fieldIndex].options || [];
    newFields[fieldIndex].options = [...options, `Option ${options.length + 1}`];
    setFields(newFields);
  };

  const updateOption = (fieldIndex: number, optionIndex: number, value: string) => {
    const newFields = [...fields];
    newFields[fieldIndex].options[optionIndex] = value;
    setFields(newFields);
  };

  const removeOption = (fieldIndex: number, optionIndex: number) => {
    const newFields = [...fields];
    newFields[fieldIndex].options = newFields[fieldIndex].options.filter(
      (_: any, i: number) => i !== optionIndex
    );
    setFields(newFields);
  };

  const handleSave = async () => {
    if (!user) {
      console.error('Unauthorized: No user found');
      return;
    }

    setLoading(true);
    try {
      let existingSettings: any = {};
      try {
        existingSettings = JSON.parse(form?.settings || '{}');
      } catch (_e) {}

      const mergedSettings = {
        ...existingSettings,
        ghostFields: enabledGhostFields,
      };

      const formDataPayload = {
        title: title || 'Untitled Form',
        description,
        status: status as FormsStatus,
        schema: JSON.stringify(fields),
        settings: JSON.stringify(mergedSettings),
      };

      const formId = form?.$id || (initialDraft ? initialDraft.id : 'new');

      if (form) {
        await FormsService.updateForm(form.$id, formDataPayload);
        autonomicSyncEngine.ack(form.$id);
        if (user) invalidate(`f_user_forms_${user.$id}`);
        invalidate(`f_form_schema_${form.$id}`);
      } else {
        const isCustomWorkspace = Boolean(activeWorkspace && !activeWorkspace.isPersonal);
        const newForm = await FormsService.createForm(user.$id, {
          ...formDataPayload,
          isWorkspace: isCustomWorkspace,
          projectId: isCustomWorkspace ? activeWorkspace!.id : undefined,
        } as any);
        if (isCustomWorkspace && newForm?.$id) {
          void attachEntityToActiveWorkspace('form', newForm.$id);
        }
        autonomicSyncEngine.ack(newForm.$id);
        if (user) invalidate(`f_user_forms_${user.$id}`);
      }

      // Clear local drafts after successful creation / update
      await DraftsService.clearDraft(formId);
      if (initialDraft?.id) {
        await DraftsService.clearDraft(initialDraft.id);
      }
      await DraftsService.clearDraft('new');

      setHasUnsavedChanges(false);

      onSaved();
      onClose();
    } catch (error) {
      console.error('Failed to save form', error);
    } finally {
      setLoading(false);
    }
  };

  const isChoiceType = (type: string) => ['select', 'radio', 'checkbox'].includes(type);

  // Handle Kylrix Assist auto-generation result
  const handleAssistApply = (generated: any) => {
    if (!generated) return;
    if (generated.title) setTitle(generated.title);
    if (generated.description) setDescription(generated.description);
    if (Array.isArray(generated.fields) && generated.fields.length > 0) {
      const formattedFields = generated.fields.map((f: any, idx: number) => ({
        id: f.id || `field_${Date.now()}_${idx}`,
        label: f.label || 'Question',
        type: f.type || 'text',
        required: Boolean(f.required),
        options: Array.isArray(f.options) ? f.options : ['Option 1', 'Option 2'],
      }));
      setFields(formattedFields);
    }
  };

  return (
    <>
      <Drawer
        anchor="bottom"
        open={open}
        onClose={handleClose}
        ModalProps={{ keepMounted: false, disablePortal: true }}
        PaperProps={{
          sx: {
            width: '100vw',
            maxWidth: '100vw',
            height: '100dvh',
            bgcolor: '#161412',
            border: 'none',
            borderRadius: 0,
            backgroundImage: 'none',
            boxShadow: 'none',
            display: 'flex',
            flexDirection: 'column',
            pointerEvents: 'auto',
            zIndex: 1300,
          },
        }}
      >
        {/* Header Bar */}
        <div className="px-4 sm:px-6 py-3.5 border-b border-white/[0.08] bg-[#161412] flex items-center justify-between gap-4 shrink-0">
          <div className="flex items-center gap-3 min-w-0">
            <div className="w-9 h-9 rounded-xl bg-[#6366F1]/10 border border-[#6366F1]/20 flex items-center justify-center text-[#6366F1] shrink-0">
              <FileText size={18} />
            </div>
            <div className="min-w-0">
              <h2 className="font-clash font-black text-lg text-white tracking-tight truncate">
                {form ? 'Edit Form' : 'Create New Form'}
              </h2>
              {hasUnsavedChanges && (
                <div className="flex items-center gap-1 mt-0.5">
                  <span className="w-2 h-2 rounded-full bg-amber-400 animate-ping" />
                  <span className="text-[10px] font-mono font-bold text-amber-400 uppercase tracking-wider">
                    Unsynced Draft
                  </span>
                </div>
              )}
            </div>
          </div>

          <div className="flex items-center gap-2 shrink-0">
            {/* Kylrix Assist trigger */}
            <button
              type="button"
              onClick={() => setAssistDrawerOpen(true)}
              title="Kylrix Assist — AI Auto-Creator"
              className="w-9 h-9 rounded-xl bg-gradient-to-r from-[#6366F1] to-[#EC4899] hover:from-[#5254E8] hover:to-[#DB2777] text-white flex items-center justify-center shrink-0 shadow-[0_4px_16px_rgba(99,102,241,0.3)] transition-all cursor-pointer"
            >
              <Wand2 size={16} className="animate-pulse" />
            </button>

            {/* Add Field */}
            <button
              type="button"
              onClick={addField}
              className="px-3 py-1.5 rounded-xl bg-[#6366F1]/10 hover:bg-[#6366F1]/20 border border-[#6366F1]/30 text-[#6366F1] font-satoshi font-bold text-xs flex items-center gap-1 transition-all cursor-pointer"
            >
              <Plus size={14} />
              <span className="hidden sm:inline">Add Question</span>
            </button>

            {/* Save Form CTA */}
            <button
              type="button"
              onClick={() => void handleSave()}
              disabled={loading || !title.trim()}
              className="px-4 py-1.5 rounded-xl bg-[#6366F1] hover:bg-[#5254E8] text-white font-clash font-black text-xs transition-all shadow-[0_4px_16px_rgba(99,102,241,0.3)] cursor-pointer disabled:opacity-40"
            >
              {loading ? 'Saving...' : form ? 'Save Form' : 'Create Form'}
            </button>

            {/* Close */}
            <button
              type="button"
              onClick={handleClose}
              className="p-1.5 rounded-xl bg-white/5 border border-white/10 hover:bg-white/10 text-white/70 hover:text-white transition-all cursor-pointer"
            >
              <X size={18} />
            </button>
          </div>
        </div>

        {/* Scrollable Form Body Container */}
        <div className="flex-1 overflow-y-auto p-4 sm:p-6 space-y-6 max-w-4xl w-full mx-auto scrollbar-thin">
          {/* Header Metadata Tile */}
          <div className="rounded-[24px] bg-[#0A0908] border border-white/[0.08] p-5 sm:p-6 space-y-4 shadow-xl">
            <input
              type="text"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="Name this form..."
              className="w-full bg-transparent border-b border-white/10 focus:border-[#6366F1] outline-none text-2xl sm:text-3xl font-black text-white font-clash pb-2 placeholder:text-white/20 transition-all"
            />

            <div className="relative">
              <textarea
                rows={2}
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                placeholder="Briefly describe the purpose or instructions for this form..."
                className="w-full bg-[#161412]/50 border border-white/5 focus:border-[#6366F1]/50 rounded-xl p-3 outline-none text-sm text-white/80 placeholder:text-white/30 focus:ring-0 resize-y font-satoshi leading-relaxed min-h-[60px]"
              />
            </div>

            {/* Deployment Status & Options Row */}
            <div className="pt-3 border-t border-white/5 flex flex-wrap items-center justify-between gap-3">
              <div className="flex items-center gap-2">
                <span className="text-[10px] font-mono font-bold uppercase tracking-wider text-white/40">
                  Status:
                </span>
                <select
                  value={status}
                  onChange={(e) => setStatus(e.target.value as any)}
                  className="bg-[#161412] border border-white/10 text-white font-satoshi text-xs font-extrabold rounded-xl px-3 py-1.5 outline-none cursor-pointer"
                >
                  <option value="draft" className="bg-[#161412] text-white">
                    Draft (Internal)
                  </option>
                  <option value="published" className="bg-[#161412] text-emerald-400">
                    Published (Public Access)
                  </option>
                  <option value="archived" className="bg-[#161412] text-amber-400">
                    Archived (Read-Only)
                  </option>
                </select>
              </div>

              <div className="flex items-center gap-3">
                <button
                  type="button"
                  onClick={() => setGhostDrawerOpen(true)}
                  className={`px-3 py-1 rounded-xl border text-xs font-satoshi font-bold flex items-center gap-1.5 transition-all cursor-pointer ${
                    enabledGhostFields.length > 0
                      ? 'bg-[#6366F1]/10 border-[#6366F1]/40 text-[#818CF8]'
                      : 'bg-white/5 border-white/10 text-white/50 hover:text-white'
                  }`}
                >
                  <Ghost size={14} />
                  <span>
                    Ghost Fields ({enabledGhostFields.length})
                  </span>
                </button>

                <span className="text-xs font-mono text-white/40">
                  {fields.length} {fields.length === 1 ? 'question' : 'questions'}
                </span>
              </div>
            </div>
          </div>

          {/* Form Questions & Logic Schema Card */}
          <div className="rounded-[24px] bg-[#0A0908] border border-white/[0.08] p-5 sm:p-6 space-y-5 shadow-xl">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <div className="w-1.5 h-4 bg-[#6366F1] rounded-full" />
                <h3 className="font-clash font-extrabold text-sm text-white uppercase tracking-wider">
                  Questions & Schema
                </h3>
              </div>

              <button
                type="button"
                onClick={addField}
                className="px-3 py-1.5 rounded-xl bg-[#6366F1]/10 hover:bg-[#6366F1]/20 border border-[#6366F1]/30 text-[#6366F1] font-satoshi font-bold text-xs flex items-center gap-1.5 transition-all cursor-pointer"
              >
                <Plus size={14} />
                <span>Add Question</span>
              </button>
            </div>

            {/* Drag and Drop Questions List */}
            <DndContext
              sensors={sensors}
              collisionDetection={closestCenter}
              onDragEnd={handleDragEnd}
              modifiers={[restrictToVerticalAxis]}
            >
              <SortableContext items={fields.map((f) => f.id)} strategy={verticalListSortingStrategy}>
                <div className="space-y-4">
                  {fields.map((field, fIdx) => (
                    <SortableField
                      key={field.id}
                      field={field}
                      fIdx={fIdx}
                      updateField={updateField}
                      removeField={removeField}
                      addOption={addOption}
                      updateOption={updateOption}
                      removeOption={removeOption}
                      isChoiceType={isChoiceType}
                      user={user}
                      openProUpgrade={openProUpgrade}
                      openSettingsDrawer={openSettingsDrawer}
                    />
                  ))}
                </div>
              </SortableContext>
            </DndContext>
            <div ref={fieldsEndRef} />
          </div>
        </div>

        {/* Bottom Bar */}
        <div className="px-6 py-3 border-t border-white/[0.08] bg-[#161412] flex items-center justify-between shrink-0">
          <span className="text-xs font-mono text-white/40">
            {hasUnsavedChanges ? 'Autosaved locally' : 'All changes saved'}
          </span>

          <div className="flex items-center gap-3">
            <button
              type="button"
              onClick={handleClose}
              className="px-4 py-2 rounded-xl text-white/50 hover:text-white font-satoshi font-bold text-xs transition-colors cursor-pointer"
            >
              Cancel
            </button>
            <button
              type="button"
              onClick={() => void handleSave()}
              disabled={loading || !title.trim()}
              className="px-5 py-2 rounded-xl bg-[#6366F1] hover:bg-[#5254E8] text-white font-clash font-extrabold text-xs shadow-lg shadow-[#6366F1]/20 transition-all cursor-pointer disabled:opacity-40"
            >
              {loading ? 'Saving...' : form ? 'Save Changes' : 'Create Form'}
            </button>
          </div>
        </div>
      </Drawer>

      {/* Modular Kylrix Assist Bottom Drawer */}
      <ObjectAssistDrawer
        open={assistDrawerOpen}
        onClose={() => setAssistDrawerOpen(false)}
        kind="form"
        targetId={form?.$id || (initialDraft ? initialDraft.id : 'new_form')}
        title="Kylrix Assist — Form Auto-Creator"
        subtitle="Prompt AI to automatically generate questions, field choices, and logic schema for your form."
        onApply={handleAssistApply}
      />

      {/* Ghost Fields Builder Drawer */}
      <Drawer
        anchor="bottom"
        open={ghostDrawerOpen}
        onClose={() => setGhostDrawerOpen(false)}
        ModalProps={{ keepMounted: false, disablePortal: true }}
        PaperProps={{
          sx: {
            width: '100%',
            maxWidth: 640,
            mx: 'auto',
            borderRadius: '28px 28px 0 0',
            bgcolor: '#161412',
            borderTop: '1px solid rgba(255, 255, 255, 0.08)',
            borderLeft: '1px solid rgba(255, 255, 255, 0.08)',
            borderRight: '1px solid rgba(255, 255, 255, 0.08)',
            backgroundImage: 'none',
            p: 5,
            pb: 6,
            zIndex: 1400,
            maxHeight: '80vh',
            overflowY: 'auto',
          },
        }}
      >
        <div className="space-y-4">
          <div className="flex items-center justify-between pb-3 border-b border-white/5">
            <div className="flex items-center gap-2">
              <Ghost size={18} className="text-[#6366F1]" />
              <h3 className="font-clash font-extrabold text-base text-white">
                Modular Ghost Fields Telemetry
              </h3>
            </div>
            <button
              type="button"
              onClick={() => setGhostDrawerOpen(false)}
              className="p-1.5 rounded-xl bg-white/5 text-white/70 hover:text-white"
            >
              <X size={16} />
            </button>
          </div>

          <p className="text-xs text-white/60 leading-relaxed font-satoshi">
            Ghost fields automatically capture diagnostic account context (such as subscription tier or 2FA status) when a user submits a bug report or form entry. Submitters will see a clear notification with an info drawer on the form link.
          </p>

          <div className="space-y-2.5 pt-2">
            {Object.values(GHOST_FIELDS_REGISTRY).map((gf) => {
              const isChecked = enabledGhostFields.includes(gf.id);
              return (
                <div
                  key={gf.id}
                  onClick={() => {
                    setEnabledGhostFields((prev) =>
                      prev.includes(gf.id) ? prev.filter((id) => id !== gf.id) : [...prev, gf.id]
                    );
                  }}
                  className={`p-3.5 rounded-2xl border flex items-start justify-between gap-3 cursor-pointer transition-all ${
                    isChecked
                      ? 'bg-[#6366F1]/10 border-[#6366F1]/40'
                      : 'bg-[#000000] border-white/5 hover:border-white/10'
                  }`}
                >
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2">
                      <span className="text-xs font-bold text-white font-satoshi">{gf.label}</span>
                      <span className="text-[9px] font-mono uppercase px-1.5 py-0.5 rounded bg-white/5 text-white/50 border border-white/10 font-bold">
                        {gf.category}
                      </span>
                    </div>
                    <span className="block text-[11px] text-white/50 mt-1 leading-relaxed">
                      {gf.description}
                    </span>
                  </div>

                  <div
                    className={`relative inline-flex h-5 w-9 items-center rounded-full transition-colors focus:outline-none shrink-0 mt-0.5 ${
                      isChecked ? 'bg-[#6366F1]' : 'bg-white/10'
                    }`}
                  >
                    <span
                      className={`inline-block h-3.5 w-3.5 transform rounded-full bg-black transition-transform ${
                        isChecked ? 'translate-x-4.5' : 'translate-x-1'
                      }`}
                    />
                  </div>
                </div>
              );
            })}
          </div>

          <button
            type="button"
            onClick={() => setGhostDrawerOpen(false)}
            className="w-full py-2.5 mt-2 rounded-xl bg-[#6366F1] hover:bg-[#5254E8] text-white font-clash font-extrabold text-xs transition-all cursor-pointer"
          >
            Apply Ghost Settings
          </button>
        </div>
      </Drawer>

      {/* Field Settings & Logic Rules Drawer */}
      <Drawer
        anchor="bottom"
        open={settingsOpen && activeSettingsFieldIndex !== null}
        onClose={() => setSettingsOpen(false)}
        ModalProps={{ keepMounted: false, disablePortal: true }}
        PaperProps={{
          sx: {
            width: '100%',
            maxWidth: 720,
            mx: 'auto',
            borderRadius: '28px 28px 0 0',
            bgcolor: '#161412',
            borderTop: '1px solid rgba(255, 255, 255, 0.08)',
            borderLeft: '1px solid rgba(255, 255, 255, 0.08)',
            borderRight: '1px solid rgba(255, 255, 255, 0.08)',
            backgroundImage: 'none',
            p: 5,
            pb: 6,
            zIndex: 1400,
            maxHeight: '80vh',
            overflowY: 'auto',
          },
        }}
      >
        {activeSettingsFieldIndex !== null && fields[activeSettingsFieldIndex] && (() => {
          const field = fields[activeSettingsFieldIndex];
          const precedingChoiceFields = fields
            .slice(0, activeSettingsFieldIndex)
            .filter((f) => ['select', 'radio', 'checkbox'].includes(f.type));

          return (
            <div className="space-y-5">
              <div className="flex items-center justify-between pb-3 border-b border-white/5">
                <h3 className="font-clash font-extrabold text-base text-white">
                  Field Rules: {field.label || 'Question'}
                </h3>
                <button
                  type="button"
                  onClick={() => setSettingsOpen(false)}
                  className="p-1.5 rounded-xl bg-white/5 text-white/70 hover:text-white"
                >
                  <X size={16} />
                </button>
              </div>

              {/* Move Position Buttons */}
              <div className="flex items-center gap-3">
                <button
                  type="button"
                  onClick={() => moveFieldUp(activeSettingsFieldIndex)}
                  disabled={activeSettingsFieldIndex === 0}
                  className="flex-1 py-2 px-3 rounded-xl bg-[#000000] border border-white/10 hover:border-white/20 text-white text-xs font-bold font-satoshi transition-all flex items-center justify-center gap-1.5 disabled:opacity-30 cursor-pointer"
                >
                  <ArrowUp size={14} />
                  <span>Move Up</span>
                </button>
                <button
                  type="button"
                  onClick={() => moveFieldDown(activeSettingsFieldIndex)}
                  disabled={activeSettingsFieldIndex === fields.length - 1}
                  className="flex-1 py-2 px-3 rounded-xl bg-[#000000] border border-white/10 hover:border-white/20 text-white text-xs font-bold font-satoshi transition-all flex items-center justify-center gap-1.5 disabled:opacity-30 cursor-pointer"
                >
                  <ArrowDown size={14} />
                  <span>Move Down</span>
                </button>
              </div>

              {/* Conditional Branching */}
              <div className="space-y-3 pt-2">
                <span className="text-[10px] font-mono font-bold uppercase tracking-wider text-[#6366F1] block">
                  Conditional Display Logic
                </span>

                {precedingChoiceFields.length === 0 ? (
                  <p className="text-xs font-satoshi text-white/40 italic">
                    Add choice questions (dropdown, radio, checkbox) above this item to enable logic branching.
                  </p>
                ) : (
                  <div className="space-y-3 p-4 rounded-2xl bg-[#000000] border border-white/10">
                    <label className="flex items-center gap-2 cursor-pointer select-none">
                      <input
                        type="checkbox"
                        checked={Boolean(field.logic?.enabled)}
                        onChange={(e) => {
                          const enabled = e.target.checked;
                          updateField(activeSettingsFieldIndex, {
                            logic: {
                              ...field.logic,
                              enabled,
                              showIfFieldId: enabled
                                ? field.logic?.showIfFieldId || precedingChoiceFields[0].id
                                : '',
                              showIfValue: enabled
                                ? field.logic?.showIfValue || precedingChoiceFields[0].options?.[0] || ''
                                : '',
                            },
                          });
                        }}
                        className="sr-only peer"
                      />
                      <div className="w-8 h-4 bg-white/10 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-3 after:w-3 after:transition-all peer-checked:bg-[#6366F1] relative" />
                      <span className="text-xs font-satoshi font-bold text-white">
                        Only display this question conditionally
                      </span>
                    </label>

                    {field.logic?.enabled && (
                      <div className="space-y-3 pt-2">
                        <div>
                          <span className="text-[10px] font-mono text-white/50 block mb-1">
                            Show if Question:
                          </span>
                          <select
                            value={field.logic.showIfFieldId || precedingChoiceFields[0].id}
                            onChange={(e) => {
                              const targetId = e.target.value;
                              const targetField = precedingChoiceFields.find((f) => f.id === targetId);
                              updateField(activeSettingsFieldIndex, {
                                logic: {
                                  ...field.logic,
                                  showIfFieldId: targetId,
                                  showIfValue: targetField?.options?.[0] || '',
                                },
                              });
                            }}
                            className="w-full bg-[#161412] border border-white/10 text-white font-satoshi text-xs font-bold rounded-xl p-2.5 outline-none"
                          >
                            {precedingChoiceFields.map((f) => (
                              <option key={f.id} value={f.id} className="bg-[#161412] text-white">
                                {f.label || `Question (${f.id})`}
                              </option>
                            ))}
                          </select>
                        </div>

                        <div>
                          <span className="text-[10px] font-mono text-white/50 block mb-1">
                            Equals answer:
                          </span>
                          {(() => {
                            const parentField = precedingChoiceFields.find(
                              (f) => f.id === (field.logic.showIfFieldId || precedingChoiceFields[0].id)
                            );
                            const options = parentField?.options || [];
                            return (
                              <select
                                value={field.logic.showIfValue || options[0] || ''}
                                onChange={(e) => {
                                  updateField(activeSettingsFieldIndex, {
                                    logic: {
                                      ...field.logic,
                                      showIfValue: e.target.value,
                                    },
                                  });
                                }}
                                className="w-full bg-[#161412] border border-white/10 text-white font-satoshi text-xs font-bold rounded-xl p-2.5 outline-none"
                              >
                                {options.map((opt: string) => (
                                  <option key={opt} value={opt} className="bg-[#161412] text-white">
                                    {opt}
                                  </option>
                                ))}
                              </select>
                            );
                          })()}
                        </div>
                      </div>
                    )}
                  </div>
                )}
              </div>
            </div>
          );
        })()}
      </Drawer>
    </>
  );
}
