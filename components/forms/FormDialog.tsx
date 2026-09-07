'use client';

import React, { useState, useEffect, useRef, useCallback } from 'react';
import {
  Drawer,
  Button,
  TextField,
  Box,
  Typography,
  IconButton,
  MenuItem,
  Divider,
  Stack,
  Select,
  Switch,
  FormControlLabel,
  Paper,
  alpha,
  Tooltip,
  Chip} from '@/lib/openbricks/primitives';
import {
  Add as AddIcon,
  Close as CloseIcon,
  List as ListIcon,
  RadioButtonChecked as RadioIcon,
  CheckBox as CheckIcon,
  Abc as TextIcon,
  Notes as TextAreaIcon,
  AlternateEmail as EmailIcon,
  Numbers as NumberIcon,
  CloudUpload as SyncIcon,
  Warning as WarningIcon,
  Settings as SettingsIcon,
  UploadFile as FileUploadIcon,
  ChevronDownIcon} from '@/lib/openbricks/icons';
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
import { useTypeIntelligence, useTypeIntelEnabled } from '@/hooks/useTypeIntelligence';
import { TypeIntelToggle, TypeIntelGhostLayer } from '@/components/agentic/TypeIntelBar';
import { useContextualAutocomplete } from '@/lib/contextual-engine';

import {
  DndContext, 
  closestCenter,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
  DragEndEvent
} from '@dnd-kit/core';
import {
  arrayMove,
  SortableContext,
  sortableKeyboardCoordinates,
  verticalListSortingStrategy,
  useSortable
} from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { restrictToVerticalAxis } from '@dnd-kit/modifiers';
import { SortableField as SortableField_ext } from './FormDialogSections/SortableField';
import { loadData as loadData_ext } from './FormDialogSections/loadData';
import { handleSave as handleSave_ext } from './FormDialogSections/handleSave';
import { FormDialogView } from './FormDialogSections/FormDialogView';



interface FormDialogProps {
  open: boolean;
  onClose: () => void;
  form?: Forms | null;
  initialDraft?: FormDraft;
  onSaved: () => void;
}

const FIELD_TYPES = [
  { value: 'text', label: 'Short Text', icon: <TextIcon fontSize="small" /> },
  { value: 'textarea', label: 'Long Text', icon: <TextAreaIcon fontSize="small" /> },
  { value: 'email', label: 'Email', icon: <EmailIcon fontSize="small" /> },
  { value: 'number', label: 'Number', icon: <NumberIcon fontSize="small" /> },
  { value: 'select', label: 'Dropdown', icon: <ListIcon fontSize="small" /> },
  { value: 'radio', label: 'Single Choice (Radio)', icon: <RadioIcon fontSize="small" /> },
  { value: 'checkbox', label: 'Multiple Choice (Checkbox)', icon: <CheckIcon fontSize="small" /> },
  { value: 'file', label: 'File Upload (Pro)', icon: <FileUploadIcon fontSize="small" /> }
];

const SortableField = (..._args: any[]) => SortableField_ext({ SortableField, acceptGhost, activeFieldIndex, activeSettingsFieldIndex, addField, addOption, description, fields, fieldsEndRef, ghostSuggestion, handleClose, handleDragEnd, handleSave, hasUnsavedChanges, initialLoadRef, isChoiceType, isExpanded, isPro, isRestored, loadData, loading, moveFieldDown, moveFieldUp, openPro, openSelectorDrawer, openSettingsDrawer, removeField, removeOption, selectorOpen, sensors, setActiveFieldIndex, setActiveSettingsFieldIndex, setDescription, setFields, setHasUnsavedChanges, setIsExpanded, setIsRestored, setLoading, setSelectorOpen, setSettingsOpen, setStatus, setStatusDrawerOpen, setTitle, settingsOpen, status, statusDrawerOpen, style, title, updateField, updateOption, validateFieldsLogic });

export default function FormDialog({ open, onClose, form, initialDraft, onSaved }: FormDialogProps) {
  const [loading, setLoading] = useState(false);
  const { user } = useAuth();
  const { openProUpgrade } = useProUpgrade();
  const isPro = hasPaidKylrixPlan(user);
  const { enabled: createWithAgent, persist: persistAgent } = useTypeIntelEnabled('form');
  const openPro = useCallback(() => openProUpgrade('Kylie Assist'), [openProUpgrade]);
  const { invalidate } = useDataNexus();
  const { activeWorkspace, attachEntityToActiveWorkspace } = useWorkspace();
  const { setIsDrawerOpen } = useDrawerState();
  const [isExpanded, setIsExpanded] = useState(true);
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [status, setStatus] = useState<'draft' | 'published' | 'archived'>('draft');
  const [statusDrawerOpen, setStatusDrawerOpen] = useState(false);
  const [fields, setFields] = useState<any[]>([]);
  const [hasUnsavedChanges, setHasUnsavedChanges] = useState(false);
  const [isRestored, setIsRestored] = useState(false);
  const [selectorOpen, setSelectorOpen] = useState(false);
  const [activeFieldIndex, setActiveFieldIndex] = useState<number | null>(null);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [activeSettingsFieldIndex, setActiveSettingsFieldIndex] = useState<number | null>(null);
  
  const openSettingsDrawer = (fIdx: number) => {
    setActiveSettingsFieldIndex(fIdx);
    setSettingsOpen(true);
  };
  
  const openSelectorDrawer = (fIdx: number) => {
    setActiveFieldIndex(fIdx);
    setSelectorOpen(true);
  };
  
  const initialLoadRef = useRef(true);

  const {
    learningStatus,
    learningLabel,
    suggestion: agentSuggestion,
    busy: agentBusy,
    acceptSuggestion: acceptAgentSuggestion,
    runTakeover,
    handleKeyDown: handleAgentKeyDown,
    accent: agentAccent,
  } = useTypeIntelligence({
    kind: 'form',
    userId: user?.$id,
    displayName: user?.name || user?.email || undefined,
    draft: description || title,
    enabled: createWithAgent && open,
    isPro,
    onOpenPro: openPro,
    setDraft: (next) => {
      if (description.trim().length > 0 || !title.trim()) {
        setDescription(next);
      } else {
        // Completing from title-only draft → put full text in description
        setDescription(next);
      }
    },
  });

  const {
    inlineSuffix,
    handleKeyDown: handleAutoKeyDown,
  } = useContextualAutocomplete(description || title, {
    niche: 'productivity',
    onAccept: (completedText) => setDescription(completedText),
  });

  const ghostSuggestion =
    createWithAgent && agentSuggestion ? agentSuggestion : inlineSuffix || '';

  const acceptGhost = useCallback(() => {
    if (createWithAgent && agentSuggestion) {
      acceptAgentSuggestion();
      return;
    }
    if (inlineSuffix) {
      const base = description || title;
      setDescription(base + inlineSuffix);
    }
  }, [createWithAgent, agentSuggestion, acceptAgentSuggestion, inlineSuffix, description, title]);

  // Sync isDrawerOpen global state and body class when open
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

  // Sync document body class when expanded changes
  useEffect(() => {
    if (typeof window !== 'undefined') {
      if (open && isExpanded) {
        document.body.classList.add('drawer-expanded');
      } else {
        document.body.classList.remove('drawer-expanded');
      }
    }
  }, [open, isExpanded]);

  const handleClose = () => {
    setIsExpanded(false);
    onClose();
  };

  const sensors = useSensors(
    useSensor(PointerSensor),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates})
  );

  const validateFieldsLogic = (currentFields: any[]) => {
    return currentFields.map((field, idx) => {
      if (field.logic?.enabled && field.logic.showIfFieldId) {
        const parentIdx = currentFields.findIndex(f => f.id === field.logic.showIfFieldId);
        if (parentIdx === -1 || parentIdx >= idx) {
          return {
            ...field,
            logic: {
              ...field.logic,
              enabled: false,
              showIfFieldId: '',
              showIfValue: ''
            }
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
    setFields(prev => {
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
    setFields(prev => {
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

    const loadData = (..._args: any[]) => loadData_ext({ SortableField, acceptGhost, activeFieldIndex, activeSettingsFieldIndex, addField, addOption, description, fields, fieldsEndRef, ghostSuggestion, handleClose, handleDragEnd, handleSave, hasUnsavedChanges, initialLoadRef, isChoiceType, isExpanded, isPro, isRestored, loadData, loading, moveFieldDown, moveFieldUp, openPro, openSelectorDrawer, openSettingsDrawer, removeField, removeOption, selectorOpen, sensors, setActiveFieldIndex, setActiveSettingsFieldIndex, setDescription, setFields, setHasUnsavedChanges, setIsExpanded, setIsRestored, setLoading, setSelectorOpen, setSettingsOpen, setStatus, setStatusDrawerOpen, setTitle, settingsOpen, status, statusDrawerOpen, style, title, updateField, updateOption, validateFieldsLogic });
    loadData();
  }, [form, open, initialDraft]);

  // Autosave logic
  useEffect(() => {
    if (initialLoadRef.current || !open) return;

    const formId = form?.$id || (initialDraft ? initialDraft.id : 'new');
    const currentFieldsStr = JSON.stringify(fields);
    
    // Check if actually different from the original database version (if not a restored draft)
    let isDifferent = true;
    if (form && !isRestored) {
        try {
            const originalFields = JSON.parse(form.schema || '[]');
            if (title === form.title && description === (form.description || '') && status === form.status && currentFieldsStr === JSON.stringify(originalFields)) {
                isDifferent = false;
            }
        } catch(_e) {}
    }

    if (isDifferent) {
        DraftsService.saveDraft(formId, { title, description, status, fields });
        setHasUnsavedChanges(true);
    } else {
        DraftsService.clearDraft(formId);
        setHasUnsavedChanges(false);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [title, description, status, fields, open, isRestored]);

  // Handle focus behavior when fields change
  const fieldsEndRef = useRef<HTMLDivElement>(null);

  const addField = () => {
    const id = `field_${Date.now()}`;
    setFields([...fields, { 
      id, 
      label: 'New Question', 
      type: 'text', 
      required: false,
      options: ['Option 1'],
      showSettings: false,
      validation: {}
    }]);
    
    // Scroll to new field after render
    setTimeout(() => {
        fieldsEndRef.current?.scrollIntoView({ behavior: 'smooth', block: 'center' });
    }, 100);
  };

  const removeField = (index: number) => {
    setFields(prev => {
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
    newFields[fieldIndex].options = newFields[fieldIndex].options.filter((_: any, i: number) => i !== optionIndex);
    setFields(newFields);
  };


  const handleSave = (..._args: any[]) => handleSave_ext({ SortableField, acceptGhost, activeFieldIndex, activeSettingsFieldIndex, addField, addOption, description, fields, fieldsEndRef, ghostSuggestion, handleClose, handleDragEnd, handleSave, hasUnsavedChanges, initialLoadRef, isChoiceType, isExpanded, isPro, isRestored, loadData, loading, moveFieldDown, moveFieldUp, openPro, openSelectorDrawer, openSettingsDrawer, removeField, removeOption, selectorOpen, sensors, setActiveFieldIndex, setActiveSettingsFieldIndex, setDescription, setFields, setHasUnsavedChanges, setIsExpanded, setIsRestored, setLoading, setSelectorOpen, setSettingsOpen, setStatus, setStatusDrawerOpen, setTitle, settingsOpen, status, statusDrawerOpen, style, title, updateField, updateOption, validateFieldsLogic });

  const isChoiceType = (type: string) => ['select', 'radio', 'checkbox'].includes(type);

  return <FormDialogView {...({ acceptGhost, activeFieldIndex, activeSettingsFieldIndex, addField, addOption, base, currentFieldsStr, description, fields, fieldsEndRef, form, formId, ghostSuggestion, handleClose, handleDragEnd, handleSave, hasUnsavedChanges, id, initialDraft, initialLoadRef, isChoiceType, isDifferent, isExpanded, isPro, isRestored, loadData, loading, moveFieldDown, moveFieldUp, newFields, newIndex, next, nextItems, oldIndex, onClose, onSaved, open, openPro, openSelectorDrawer, openSettingsDrawer, options, originalFields, parentIdx, removeField, removeOption, selectorOpen, sensors, setActiveFieldIndex, setActiveSettingsFieldIndex, setDescription, setFields, setHasUnsavedChanges, setIsExpanded, setIsRestored, setLoading, setSelectorOpen, setSettingsOpen, setStatus, setStatusDrawerOpen, setTitle, settingsOpen, status, statusDrawerOpen, temp, title, updateField, updateOption, validateFieldsLogic })} />;
}
