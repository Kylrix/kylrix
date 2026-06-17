'use client';

import React, { useState, useEffect, useRef } from 'react';
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
  FormControl,
  InputLabel,
  Select,
  Switch,
  FormControlLabel,
  Paper,
  alpha,
  Tooltip,
  Alert,
  Chip,
  useTheme,
  useMediaQuery,
} from '@/lib/mui-tailwind/material';
import {
  Add as AddIcon,
  Delete as DeleteIcon,
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
  ChevronDownIcon,
} from '@/lib/mui-tailwind/icons';
import { FormsService } from '@/lib/services/forms';
import { DraftsService, FormDraft } from '@/lib/services/drafts';
import { Forms, FormsStatus } from '@/generated/appwrite/types';
import { useAuth } from '@/context/auth/AuthContext';
import { useDataNexus } from '@/context/DataNexusContext';
import { hasPaidKylrixPlan } from '@/lib/utils';
import { useProUpgrade } from '@/context/ProUpgradeContext';
import { useDrawerState } from '@/components/ui/DrawerStateContext';

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
  openSelectorDrawer,
  openSettingsDrawer
}: any) {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging
  } = useSortable({ id: field.id });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    zIndex: isDragging ? 1000 : 1,
    opacity: isDragging ? 0.6 : 1,
  };

  return (
    <Paper 
      ref={setNodeRef}
      style={style}
      sx={{ 
        p: 3, 
        bgcolor: isDragging ? alpha('#6366F1', 0.05) : '#0B0A09', 
        border: isDragging ? '1px solid var(--color-primary)' : '1px solid rgba(255, 255, 255, 0.05)',
        borderRadius: '20px',
        transition: 'all 0.3s cubic-bezier(0.16, 1, 0.3, 1)',
        '&:hover': { 
          borderColor: 'rgba(255, 255, 255, 0.1)',
          transform: 'scale(1.01)',
          boxShadow: '0 8px 24px rgba(0, 0, 0, 0.4)'
        },
        position: 'relative'
      }}
    >
      <Stack spacing={3}>
        <Stack direction="row" spacing={2} alignItems="center" sx={{ width: '100%' }}>
            <Box 
              {...attributes} 
              {...listeners}
              sx={{ 
                display: { xs: 'none', md: 'block' }, 
                cursor: 'grab',
                '&:active': { cursor: 'grabbing' },
                color: 'rgba(255,255,255,0.2)',
                '&:hover': { color: 'rgba(255,255,255,0.5)' }
              }}
            >
                <Tooltip title="Drag to reorder">
                    <Box sx={{ display: 'grid', gridTemplateColumns: 'repeat(2, 4px)', gap: '2px' }}>
                        {[...Array(6)].map((_, i) => (
                            <Box key={i} sx={{ width: 3, height: 3, borderRadius: '50%', bgcolor: 'currentColor' }} />
                        ))}
                    </Box>
                </Tooltip>
            </Box>
            
            <Stack direction="row" spacing={1.5} alignItems="center" sx={{ flexGrow: 1, minWidth: 0 }}>
                <TextField
                    fullWidth
                    variant="standard"
                    placeholder="Question Label"
                    value={field.label}
                    onChange={(e: React.ChangeEvent<HTMLInputElement>) => updateField(fIdx, { label: e.target.value })}
                    InputProps={{ 
                      disableUnderline: true, 
                      sx: { 
                        fontSize: '1rem', 
                        fontWeight: 900, 
                        color: 'white',
                        px: 2,
                        py: 1.25,
                        borderRadius: '12px',
                        bgcolor: 'rgba(255, 255, 255, 0.02)',
                        border: '1px solid rgba(255, 255, 255, 0.05)',
                        '&::placeholder': { color: 'rgba(255,255,255,0.25)' }
                      } 
                    }}
                    sx={{ flex: 1, minWidth: 0 }}
                />
                
                <Tooltip title="Remove Field">
                    <IconButton 
                      size="small" 
                      sx={{ 
                        color: 'rgba(255, 255, 255, 0.3)', 
                        bgcolor: 'rgba(255, 255, 255, 0.03)',
                        border: '1px solid rgba(255, 255, 255, 0.05)',
                        borderRadius: '12px',
                        p: 1.25,
                        '&:hover': { color: '#ef4444', bgcolor: 'rgba(239, 68, 68, 0.1)', borderColor: 'rgba(239, 68, 68, 0.2)' } 
                      }} 
                      onClick={() => removeField(fIdx)}
                    >
                        <CloseIcon style={{ fontSize: 16 }} />
                    </IconButton>
                </Tooltip>
            </Stack>
        </Stack>

        <Stack direction="row" spacing={2} alignItems="center" sx={{ pl: { md: 5 } }}>
            {/* Bottom Drawer Select Trigger */}
            <Button
                variant="text"
                onClick={() => openSelectorDrawer(fIdx)}
                sx={{
                    bgcolor: 'rgba(255, 255, 255, 0.03)',
                    border: '1px solid rgba(255, 255, 255, 0.05)',
                    borderRadius: '12px',
                    px: 2.5,
                    py: 1.25,
                    color: 'rgba(255, 255, 255, 0.7)',
                    fontSize: '0.8rem',
                    fontWeight: 700,
                    textTransform: 'none',
                    display: 'flex',
                    alignItems: 'center',
                    gap: 1.5,
                    '&:hover': {
                        bgcolor: 'rgba(255, 255, 255, 0.06)',
                        borderColor: 'rgba(255, 255, 255, 0.1)'
                    }
                }}
            >
                {FIELD_TYPES.find(t => t.value === field.type)?.icon}
                <span>{FIELD_TYPES.find(t => t.value === field.type)?.label}</span>
            </Button>
            
            <FormControlLabel
                control={
                    <Switch 
                        size="small" 
                        checked={field.required} 
                        onChange={(e: React.ChangeEvent<HTMLInputElement>) => updateField(fIdx, { required: e.target.checked })} 
                    />
                }
                label={<Typography variant="caption" sx={{ fontWeight: 800, opacity: 0.6 }}>REQUIRED</Typography>}
            />

            <Tooltip title="Field Settings">
                <IconButton 
                    size="small" 
                    onClick={() => openSettingsDrawer(fIdx)}
                    sx={{ 
                        color: 'rgba(255,255,255,0.3)',
                        '&:hover': { bgcolor: alpha('#6366F1', 0.1), color: 'var(--color-primary)' } 
                    }}
                >
                    <SettingsIcon fontSize="small" />
                </IconButton>
            </Tooltip>
        </Stack>

        {isChoiceType(field.type) && (
            <Box sx={{ pl: { md: 5 } }}>
                <Typography variant="caption" sx={{ color: 'text.secondary', fontWeight: 900, mb: 1.5, display: 'block', letterSpacing: '0.05em' }}>
                    CONFIGURE OPTIONS
                </Typography>
                <Stack spacing={1}>
                    {(field.options || []).map((opt: string, oIdx: number) => (
                        <Stack key={oIdx} direction="row" spacing={1.5} alignItems="center" sx={{ width: '100%', minWidth: 0 }}>
                            <IconButton 
                              size="small" 
                              onClick={() => removeOption(fIdx, oIdx)} 
                              sx={{ 
                                color: 'rgba(255,255,255,0.25)', 
                                '&:hover': { color: '#ef4444', bgcolor: 'rgba(239,68,68,0.1)' } 
                              }}
                            >
                                <CloseIcon style={{ fontSize: 14 }} />
                            </IconButton>
                            <TextField
                                fullWidth
                                size="small"
                                variant="standard"
                                value={opt}
                                onChange={(e: React.ChangeEvent<HTMLInputElement>) => updateOption(fIdx, oIdx, e.target.value)}
                                InputProps={{ 
                                  disableUnderline: true, 
                                  sx: { 
                                    fontSize: '0.85rem', 
                                    color: 'white',
                                    bgcolor: 'rgba(255,255,255,0.02)',
                                    border: '1px solid rgba(255, 255, 255, 0.05)',
                                    borderRadius: '8px',
                                    px: 1.5,
                                    py: 0.5
                                  } 
                                }}
                                sx={{ flex: 1, minWidth: 0 }}
                            />
                        </Stack>
                    ))}
                    <Button 
                        size="small" 
                        onClick={() => addOption(fIdx)} 
                        sx={{ 
                            justifyContent: 'flex-start', 
                            color: 'var(--color-primary)', 
                            fontWeight: 800, 
                            fontSize: '0.7rem',
                            mt: 1
                        }}
                    >
                        + ADD OPTION
                    </Button>
                </Stack>
            </Box>
        )}
      </Stack>
    </Paper>
  );
}

export default function FormDialog({ open, onClose, form, initialDraft, onSaved }: FormDialogProps) {
  const theme = useTheme();
  const isMobile = useMediaQuery(theme.breakpoints.down('md'));
  const [loading, setLoading] = useState(false);
  const { user } = useAuth();
  const { openProUpgrade } = useProUpgrade();
  const { invalidate } = useDataNexus();
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
      coordinateGetter: sortableKeyboardCoordinates,
    })
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

    const loadData = async () => {
        if (initialDraft) {
            setTitle(initialDraft.title || '');
            setDescription(initialDraft.description || '');
            setStatus(initialDraft.status as any || 'draft');
            setFields(initialDraft.fields || []);
            setIsRestored(true);
            setHasUnsavedChanges(true);
        } else {
            const formId = form?.$id || 'new';
            const savedDraft = await DraftsService.getDraft(formId);

            if (savedDraft) {
                setTitle(savedDraft.title || '');
                setDescription(savedDraft.description || '');
                setStatus(savedDraft.status as any || 'draft');
                setFields(savedDraft.fields || []);
                setIsRestored(true);
                setHasUnsavedChanges(true);
            } else if (form) {
                setTitle(form.title);
                setDescription(form.description || '');
                setStatus(form.status as any);
                try {
                    setFields(JSON.parse(form.schema || '[]'));
                } catch (_e) {
                    setFields([]);
                }
                setIsRestored(false);
                setHasUnsavedChanges(false);
            } else {
                setTitle('');
                setDescription('');
                setStatus('draft');
                setFields([{ id: 'field_1', label: 'Full Name', type: 'text', required: true }]);
                setIsRestored(false);
                setHasUnsavedChanges(false);
            }
        }
        
        setTimeout(() => {
            initialLoadRef.current = false;
        }, 100);
    };
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

  const discardDraft = () => {
    const formId = form?.$id || (initialDraft ? initialDraft.id : 'new');
    DraftsService.clearDraft(formId);
    if (form) {
      setTitle(form.title);
      setDescription(form.description || '');
      setStatus(form.status as any);
      try {
        setFields(JSON.parse(form.schema || '[]'));
      } catch (_e) {
        setFields([]);
      }
    } else {
      setTitle('');
      setDescription('');
      setStatus('draft');
      setFields([{ id: 'field_1', label: 'Full Name', type: 'text', required: true }]);
    }
    setHasUnsavedChanges(false);
    setIsRestored(false);
  };

  const handleSave = async () => {
    if (!user) {
        console.error('Unauthorized: No user found');
        return;
    }

    setLoading(true);
    try {
      const formData = {
        title,
        description,
        status: status as FormsStatus,
        schema: JSON.stringify(fields),
        settings: form?.settings || '{}',
      };

      if (form) {
        await FormsService.updateForm(form.$id, formData);
        if (user) invalidate(`f_user_forms_${user.$id}`);
        invalidate(`f_form_schema_${form.$id}`);
        DraftsService.clearDraft(form.$id);
      } else {
        const newForm = await FormsService.createForm(user.$id, formData);
        if (user) invalidate(`f_user_forms_${user.$id}`);
        // Clear both possible draft source IDs
        DraftsService.clearDraft('new');
        if (initialDraft) DraftsService.clearDraft(initialDraft.id);
        DraftsService.clearDraft(newForm.$id);
      }
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
          zIndex: 1300
        }
      }}
    >

      <Box sx={{ 
        px: 4, 
        py: 3, 
        borderBottom: '1px solid rgba(255, 255, 255, 0.05)',
        flexShrink: 0,
        display: 'flex',
        flexDirection: 'column',
        gap: 2.5
      }}>
        <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 4 }}>
          <TextField
            fullWidth
            variant="standard"
            value={title}
            onChange={(e: React.ChangeEvent<HTMLInputElement>) => setTitle(e.target.value)}
            placeholder="Form Title..."
            InputProps={{ 
              disableUnderline: true, 
              sx: { 
                fontSize: '1.25rem', 
                fontWeight: 900, 
                fontFamily: 'var(--font-clash)',
                letterSpacing: '-0.02em',
                color: 'white',
                px: 2,
                py: 1.25,
                borderRadius: '12px',
                bgcolor: 'rgba(255, 255, 255, 0.02)',
                border: '1px solid rgba(255, 255, 255, 0.05)',
                '&::placeholder': { color: 'rgba(255,255,255,0.25)' }
              } 
            }}
          />
          <IconButton onClick={handleClose} size="small" sx={{ bgcolor: 'rgba(255, 255, 255, 0.05)', '&:hover': { bgcolor: 'rgba(255, 255, 255, 0.1)' }, flexShrink: 0 }}>
              <CloseIcon fontSize="small" />
          </IconButton>
        </Box>

        {/* Row 2: Metadata / Secondary Action Bar */}
        <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 2 }}>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5 }}>
            {hasUnsavedChanges && (
                <Chip 
                    label="UNSYNCED" 
                    size="small" 
                    icon={<WarningIcon style={{ fontSize: 12, color: '#FFB020' }} />}
                    sx={{ 
                        height: 20, 
                        fontSize: '9px', 
                        fontWeight: 900, 
                        bgcolor: alpha('#FFB020', 0.1), 
                        color: '#FFB020',
                        border: '1px solid rgba(255, 176, 32, 0.2)'
                    }} 
                />
            )}
          </Box>
          <Box sx={{ display: 'flex', gap: 1.5 }}>
            <Button 
                variant="outlined" 
                size="small" 
                startIcon={<AddIcon />} 
                onClick={addField} 
                sx={{ 
                    borderRadius: '12px', 
                    fontWeight: 900, 
                    fontSize: '0.75rem',
                    borderColor: alpha('#6366F1', 0.3),
                    bgcolor: alpha('#6366F1', 0.05),
                    color: 'var(--color-primary)',
                    '&:hover': { 
                        borderColor: 'var(--color-primary)', 
                        bgcolor: alpha('#6366F1', 0.15) 
                    }
                }}
            >
                Insert
            </Button>
          </Box>
        </Box>
      </Box>

      <Box sx={{ p: 4, pt: 1, flex: 1, overflowY: 'auto', overflowX: 'hidden', maxHeight: 'calc(100vh - 180px)' }}>
        <Stack spacing={5}>


          <Box>
            <Stack spacing={3}>


              <Stack spacing={1}>
                <Typography variant="caption" sx={{ color: 'rgba(255,255,255,0.4)', fontWeight: 800, letterSpacing: '0.05em', ml: 1 }}>
                  FORM DESCRIPTION
                </Typography>
                <TextField
                  fullWidth
                  variant="standard"
                  multiline
                  rows={2}
                  value={description}
                  onChange={(e: React.ChangeEvent<HTMLInputElement>) => setDescription(e.target.value)}
                  placeholder="Briefly describe the purpose of this form..."
                  InputProps={{ 
                    disableUnderline: true, 
                    sx: { 
                      borderRadius: '16px',
                      bgcolor: '#0B0A09',
                      border: '1px solid rgba(255, 255, 255, 0.05)',
                      px: 2.5,
                      py: 1.5,
                      color: 'white',
                      '&:hover': { bgcolor: '#0B0A09' },
                      '&.Mui-focused': { bgcolor: '#0B0A09', borderColor: 'var(--color-primary)' }
                    } 
                  }}
                />
              </Stack>

              <Stack spacing={1}>
                <Typography variant="caption" sx={{ color: 'rgba(255,255,255,0.4)', fontWeight: 800, letterSpacing: '0.05em', ml: 1 }}>
                  DEPLOYMENT STATUS
                </Typography>
                <Button
                  onClick={() => setStatusDrawerOpen(true)}
                  sx={{ 
                    borderRadius: '16px',
                    bgcolor: '#0B0A09',
                    border: '1px solid rgba(255, 255, 255, 0.05)',
                    px: 2.5,
                    py: 2,
                    color: 'white',
                    justifyContent: 'space-between',
                    textTransform: 'none',
                    fontWeight: 800,
                    width: '100%',
                    '&:hover': { bgcolor: '#0B0A09', borderColor: 'var(--color-primary)' }
                  }}
                >
                  <span>
                    {status === 'draft' && 'DRAFT (INTERNAL)'}
                    {status === 'published' && 'PUBLISHED (PUBLIC ACCESS)'}
                    {status === 'archived' && 'ARCHIVED (READ-ONLY)'}
                  </span>
                  <ChevronDownIcon fontSize="small" sx={{ opacity: 0.5 }} />
                </Button>
              </Stack>
            </Stack>
          </Box>

          <Divider sx={{ opacity: 0.08 }} />

          <Box>
            <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 3 }}>
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5 }}>
                    <Box sx={{ width: 4, height: 16, bgcolor: 'var(--color-primary)', borderRadius: 2 }} />
                    <Typography variant="overline" sx={{ color: 'text.secondary', fontWeight: 900, letterSpacing: '0.15em' }}>
                        LOGIC SCHEMA
                    </Typography>
                </Box>
            </Box>

            <Stack spacing={3}>
              <DndContext 
                sensors={sensors}
                collisionDetection={closestCenter}
                onDragEnd={handleDragEnd}
                modifiers={[restrictToVerticalAxis]}
              >
                <SortableContext 
                  items={fields.map(f => f.id)}
                  strategy={verticalListSortingStrategy}
                >
                  {fields.map((field, fIdx) => (
                    <SortableField
                      key={field.id}
                      field={field}
                      fIdx={fIdx}
                      fieldsLength={fields.length}
                      updateField={updateField}
                      removeField={removeField}
                      addOption={addOption}
                      updateOption={updateOption}
                      removeOption={removeOption}
                      isChoiceType={isChoiceType}
                      user={user}
                      openProUpgrade={openProUpgrade}
                      openSelectorDrawer={openSelectorDrawer}
                      openSettingsDrawer={openSettingsDrawer}
                    />
                  ))}
                </SortableContext>
              </DndContext>
              <div ref={fieldsEndRef} />
            </Stack>
          </Box>
        </Stack>
      </Box>

      <Box sx={{ p: 4, pt: 2, gap: 2, display: 'flex', borderTop: '1px solid rgba(255, 255, 255, 0.05)', flexShrink: 0 }}>
        <Box sx={{ flexGrow: 1 }}>
            {hasUnsavedChanges && (
                <Typography variant="caption" sx={{ color: '#FFB020', fontWeight: 700, ml: 1, display: 'flex', alignItems: 'center', gap: 0.5 }}>
                    <SyncIcon sx={{ fontSize: 14 }} /> AUTOSAVE
                </Typography>
            )}
        </Box>
        <Button onClick={handleClose} disabled={loading} sx={{ fontWeight: 800, color: 'rgba(255,255,255,0.4)', '&:hover': { color: 'white' } }}>Cancel</Button>
        <Button 
          variant="contained" 
          onClick={handleSave} 
          disabled={loading || !title}
          sx={{ 
            borderRadius: '16px', 
            px: 4, 
            py: 1.5,
            fontWeight: 900,
            bgcolor: 'var(--color-primary)',
            color: 'white',
            boxShadow: `0 8px 32px ${alpha('#6366F1', 0.3)}`,
            '&:hover': { bgcolor: alpha('#6366F1', 0.9) },
            '&.Mui-disabled': {
              bgcolor: 'rgba(255, 255, 255, 0.04) !important',
              color: 'rgba(255, 255, 255, 0.15) !important',
              boxShadow: 'none !important'
            }
          }}
        >
          {loading ? 'Saving...' : (form ? 'Save' : 'Create')}
        </Button>
      </Box>
    </Drawer>

    {/* Bottom Drawer Input Type Selector */}
    <Drawer
      anchor="bottom"
      open={selectorOpen}
      onClose={() => setSelectorOpen(false)}
      ModalProps={{ keepMounted: false, disablePortal: true }}
      PaperProps={{
        sx: {
          width: '100%',
          maxWidth: 720,
          mx: 'auto',
          borderRadius: '28px 28px 0 0',
          bgcolor: '#161412',
          borderTop: '1px solid rgba(255, 255, 255, 0.05)',
          borderLeft: '1px solid rgba(255, 255, 255, 0.05)',
          borderRight: '1px solid rgba(255, 255, 255, 0.05)',
          backgroundImage: 'none',
          p: 4,
          pb: 6,
          zIndex: 1400
        }
      }}
    >
      <Typography variant="h6" sx={{ fontWeight: 900, fontFamily: 'var(--font-clash)', color: 'white', mb: 3, letterSpacing: '-0.01em' }}>
        Select Input Type
      </Typography>
      <Box sx={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: 2 }}>
        {FIELD_TYPES.map((t) => (
          <Button
            key={t.value}
            variant="text"
            onClick={() => {
              if (activeFieldIndex !== null) {
                if (t.value === 'file' && !hasPaidKylrixPlan(user)) {
                  openProUpgrade('Form File Uploads');
                  return;
                }
                updateField(activeFieldIndex, { type: t.value });
              }
              setSelectorOpen(false);
            }}
            sx={{
              justifyContent: 'flex-start',
              px: 2.5,
              py: 2,
              borderRadius: '16px',
              bgcolor: 'rgba(255, 255, 255, 0.02)',
              border: '1px solid rgba(255, 255, 255, 0.04)',
              color: 'white',
              fontSize: '0.85rem',
              fontWeight: 800,
              gap: 2,
              transition: 'all 0.2s ease',
              '&:hover': {
                bgcolor: 'rgba(255, 255, 255, 0.06)',
                borderColor: 'rgba(255, 255, 255, 0.1)',
                transform: 'translateY(-1px)'
              }
            }}
          >
            {t.icon}
            {t.label}
          </Button>
        ))}
      </Box>
    </Drawer>

    {/* Bottom Drawer Deployment Status Selector */}
    <Drawer
      anchor="bottom"
      open={statusDrawerOpen}
      onClose={() => setStatusDrawerOpen(false)}
      ModalProps={{ keepMounted: false, disablePortal: true }}
      PaperProps={{
        sx: {
          width: '100%',
          maxWidth: 720,
          mx: 'auto',
          borderRadius: '28px 28px 0 0',
          bgcolor: '#161412',
          borderTop: '1px solid rgba(255, 255, 255, 0.05)',
          borderLeft: '1px solid rgba(255, 255, 255, 0.05)',
          borderRight: '1px solid rgba(255, 255, 255, 0.05)',
          backgroundImage: 'none',
          p: 4,
          pb: 6,
          zIndex: 1400
        }
      }}
    >
      <Typography variant="h6" sx={{ fontWeight: 900, fontFamily: 'var(--font-clash)', color: 'white', mb: 3, letterSpacing: '-0.01em' }}>
        Select Deployment Status
      </Typography>
      <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
        {[
          { value: 'draft', label: 'DRAFT (INTERNAL)', desc: 'Only visible to form creators and workspace collaborators' },
          { value: 'published', label: 'PUBLISHED (PUBLIC ACCESS)', desc: 'Open to public submission and response collection' },
          { value: 'archived', label: 'ARCHIVED (READ-ONLY)', desc: 'Closed to new submissions, keeping existing records intact' }
        ].map((s) => (
          <Button
            key={s.value}
            variant="text"
            onClick={() => {
              setStatus(s.value as any);
              setStatusDrawerOpen(false);
            }}
            sx={{
              justifyContent: 'flex-start',
              flexDirection: 'column',
              alignItems: 'flex-start',
              px: 2.5,
              py: 2,
              borderRadius: '16px',
              bgcolor: status === s.value ? 'rgba(99, 102, 241, 0.08)' : 'rgba(255, 255, 255, 0.02)',
              border: '1px solid',
              borderColor: status === s.value ? 'var(--color-primary)' : 'rgba(255, 255, 255, 0.04)',
              color: 'white',
              gap: 0.5,
              textTransform: 'none',
              transition: 'all 0.2s ease',
              width: '100%',
              '&:hover': {
                bgcolor: status === s.value ? 'rgba(99, 102, 241, 0.12)' : 'rgba(255, 255, 255, 0.06)',
                borderColor: status === s.value ? 'var(--color-primary)' : 'rgba(255, 255, 255, 0.1)',
                transform: 'translateY(-1px)'
              }
            }}
          >
            <Typography sx={{ fontWeight: 900, fontSize: '0.9rem', color: status === s.value ? 'var(--color-primary)' : 'white' }}>
              {s.label}
            </Typography>
            <Typography sx={{ fontSize: '0.75rem', color: 'rgba(255,255,255,0.4)', fontWeight: 500 }}>
              {s.desc}
            </Typography>
          </Button>
        ))}
      </Box>
    </Drawer>

    {/* Bottom Drawer Field Settings & Conditional Branching */}
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
          borderTop: '1px solid rgba(255, 255, 255, 0.05)',
          borderLeft: '1px solid rgba(255, 255, 255, 0.05)',
          borderRight: '1px solid rgba(255, 255, 255, 0.05)',
          backgroundImage: 'none',
          p: 4,
          pb: 6,
          zIndex: 1400,
          maxHeight: '80vh',
          overflowY: 'auto'
        }
      }}
    >
      {activeSettingsFieldIndex !== null && fields[activeSettingsFieldIndex] && (() => {
        const field = fields[activeSettingsFieldIndex];
        const precedingChoiceFields = fields.slice(0, activeSettingsFieldIndex).filter(f => ['select', 'radio', 'checkbox'].includes(f.type));
        
        return (
          <Stack spacing={4}>
            <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <Typography variant="h6" sx={{ fontWeight: 900, fontFamily: 'var(--font-clash)', color: 'white', letterSpacing: '-0.01em' }}>
                Settings: {field.label || 'Question'}
              </Typography>
              <IconButton onClick={() => setSettingsOpen(false)} size="small" sx={{ bgcolor: 'rgba(255, 255, 255, 0.05)', '&:hover': { bgcolor: 'rgba(255, 255, 255, 0.1)' } }}>
                <CloseIcon fontSize="small" />
              </IconButton>
            </Box>

            <Stack spacing={3}>
              <Stack direction="row" spacing={2} sx={{ mb: 1 }}>
                <Button
                  variant="outlined"
                  onClick={() => moveFieldUp(activeSettingsFieldIndex)}
                  disabled={activeSettingsFieldIndex === 0}
                  sx={{ 
                    flex: 1, 
                    borderRadius: '12px',
                    borderColor: 'rgba(255,255,255,0.05)',
                    color: activeSettingsFieldIndex === 0 ? 'rgba(255,255,255,0.15)' : 'white',
                    fontWeight: 800,
                    fontSize: '0.8rem',
                    textTransform: 'none',
                    py: 1.25,
                    '&:hover': { borderColor: 'rgba(255,255,255,0.1)', bgcolor: 'rgba(255,255,255,0.02)' }
                  }}
                >
                  Move Up
                </Button>
                <Button
                  variant="outlined"
                  onClick={() => moveFieldDown(activeSettingsFieldIndex)}
                  disabled={activeSettingsFieldIndex === fields.length - 1}
                  sx={{ 
                    flex: 1, 
                    borderRadius: '12px',
                    borderColor: 'rgba(255,255,255,0.05)',
                    color: activeSettingsFieldIndex === fields.length - 1 ? 'rgba(255,255,255,0.15)' : 'white',
                    fontWeight: 800,
                    fontSize: '0.8rem',
                    textTransform: 'none',
                    py: 1.25,
                    '&:hover': { borderColor: 'rgba(255,255,255,0.1)', bgcolor: 'rgba(255,255,255,0.02)' }
                  }}
                >
                  Move Down
                </Button>
              </Stack>

              <FormControlLabel
                control={
                  <Switch 
                    checked={!!field.required} 
                    onChange={(e: React.ChangeEvent<HTMLInputElement>) => updateField(activeSettingsFieldIndex, { required: e.target.checked })} 
                  />
                }
                label={<Typography sx={{ fontWeight: 800, fontSize: '0.9rem', color: 'white' }}>Required Field</Typography>}
              />

              {/* Validation section depending on field type */}
              {(field.type === 'text' || field.type === 'textarea') && (
                <Stack spacing={2}>
                  <Typography variant="caption" sx={{ color: 'rgba(255,255,255,0.4)', fontWeight: 800, letterSpacing: '0.05em' }}>
                    VALIDATION CONSTRAINTS
                  </Typography>
                  <Stack direction="row" spacing={2}>
                    <TextField
                      label="Min Length"
                      type="number"
                      size="small"
                      variant="filled"
                      value={field.validation?.minLength || ''}
                      onChange={(e: React.ChangeEvent<HTMLInputElement>) => updateField(activeSettingsFieldIndex, { 
                        validation: { ...field.validation, minLength: e.target.value } 
                      })}
                      InputProps={{ 
                        disableUnderline: true, 
                        sx: { 
                          borderRadius: '12px', 
                          fontSize: '0.75rem',
                          bgcolor: '#0B0A09',
                          border: '1px solid rgba(255,255,255,0.05)',
                          color: 'white',
                          '&:hover': { bgcolor: '#0B0A09' }
                        } 
                      }}
                      InputLabelProps={{ style: { color: 'rgba(255,255,255,0.4)', fontSize: '0.7rem' } }}
                      sx={{ flex: 1 }}
                    />
                    <TextField
                      label="Max Length"
                      type="number"
                      size="small"
                      variant="filled"
                      value={field.validation?.maxLength || ''}
                      onChange={(e: React.ChangeEvent<HTMLInputElement>) => updateField(activeSettingsFieldIndex, { 
                        validation: { ...field.validation, maxLength: e.target.value } 
                      })}
                      InputProps={{ 
                        disableUnderline: true, 
                        sx: { 
                          borderRadius: '12px', 
                          fontSize: '0.75rem',
                          bgcolor: '#0B0A09',
                          border: '1px solid rgba(255,255,255,0.05)',
                          color: 'white',
                          '&:hover': { bgcolor: '#0B0A09' }
                        } 
                      }}
                      InputLabelProps={{ style: { color: 'rgba(255,255,255,0.4)', fontSize: '0.7rem' } }}
                      sx={{ flex: 1 }}
                    />
                  </Stack>
                  <TextField
                    label="Pattern Regex"
                    size="small"
                    variant="filled"
                    placeholder="e.g., ^[a-zA-Z]+$"
                    value={field.validation?.pattern || ''}
                    onChange={(e) => updateField(activeSettingsFieldIndex, { 
                      validation: { ...field.validation, pattern: e.target.value } 
                    })}
                    InputProps={{ 
                      disableUnderline: true, 
                      sx: { 
                        borderRadius: '12px', 
                        fontSize: '0.75rem',
                        bgcolor: '#0B0A09',
                        border: '1px solid rgba(255,255,255,0.05)',
                        color: 'white',
                        '&:hover': { bgcolor: '#0B0A09' }
                      } 
                    }}
                    InputLabelProps={{ style: { color: 'rgba(255,255,255,0.4)', fontSize: '0.7rem' } }}
                    sx={{ width: '100%' }}
                  />
                </Stack>
              )}

              {field.type === 'number' && (
                <Stack spacing={2}>
                  <Typography variant="caption" sx={{ color: 'rgba(255,255,255,0.4)', fontWeight: 800, letterSpacing: '0.05em' }}>
                    VALIDATION CONSTRAINTS
                  </Typography>
                  <Stack direction="row" spacing={2}>
                    <TextField
                      label="Min Value"
                      type="number"
                      size="small"
                      variant="filled"
                      value={field.validation?.min || ''}
                      onChange={(e: React.ChangeEvent<HTMLInputElement>) => updateField(activeSettingsFieldIndex, { 
                        validation: { ...field.validation, min: e.target.value } 
                      })}
                      InputProps={{ 
                        disableUnderline: true, 
                        sx: { 
                          borderRadius: '12px', 
                          fontSize: '0.75rem',
                          bgcolor: '#0B0A09',
                          border: '1px solid rgba(255,255,255,0.05)',
                          color: 'white',
                          '&:hover': { bgcolor: '#0B0A09' }
                        } 
                      }}
                      InputLabelProps={{ style: { color: 'rgba(255,255,255,0.4)', fontSize: '0.7rem' } }}
                      sx={{ flex: 1 }}
                    />
                    <TextField
                      label="Max Value"
                      type="number"
                      size="small"
                      variant="filled"
                      value={field.validation?.max || ''}
                      onChange={(e: React.ChangeEvent<HTMLInputElement>) => updateField(activeSettingsFieldIndex, { 
                        validation: { ...field.validation, max: e.target.value } 
                      })}
                      InputProps={{ 
                        disableUnderline: true, 
                        sx: { 
                          borderRadius: '12px', 
                          fontSize: '0.75rem',
                          bgcolor: '#0B0A09',
                          border: '1px solid rgba(255,255,255,0.05)',
                          color: 'white',
                          '&:hover': { bgcolor: '#0B0A09' }
                        } 
                      }}
                      InputLabelProps={{ style: { color: 'rgba(255,255,255,0.4)', fontSize: '0.7rem' } }}
                      sx={{ flex: 1 }}
                    />
                  </Stack>
                </Stack>
              )}

              {/* Conditional Branching Logic */}
              <Divider sx={{ opacity: 0.08 }} />
              
              <Stack spacing={2}>
                <Typography variant="caption" sx={{ color: 'rgba(255,255,255,0.4)', fontWeight: 800, letterSpacing: '0.05em' }}>
                  CONDITIONAL BRANCHING
                </Typography>

                {precedingChoiceFields.length === 0 ? (
                  <Typography variant="caption" sx={{ color: 'rgba(255,255,255,0.25)', fontStyle: 'italic' }}>
                    Create choice questions (radio, checkbox, dropdown) before this step to enable branching logic.
                  </Typography>
                ) : (
                  <Stack spacing={2}>
                    <FormControlLabel
                      control={
                        <Switch 
                          checked={!!field.logic?.enabled} 
                          onChange={(e) => {
                            const enabled = e.target.checked;
                            updateField(activeSettingsFieldIndex, {
                              logic: {
                                ...field.logic,
                                enabled,
                                showIfFieldId: enabled ? (field.logic?.showIfFieldId || precedingChoiceFields[0].id) : '',
                                showIfValue: enabled ? (field.logic?.showIfValue || precedingChoiceFields[0].options?.[0] || '') : ''
                              }
                            });
                          }} 
                        />
                      }
                      label={<Typography sx={{ fontWeight: 800, fontSize: '0.9rem', color: 'white' }}>Enable logic branch</Typography>}
                    />

                    {field.logic?.enabled && (
                      <Stack spacing={2} sx={{ pl: 1 }}>
                        <Typography variant="caption" sx={{ color: 'rgba(255,255,255,0.4)', fontWeight: 800 }}>
                          Show this question only if:
                        </Typography>
                        
                        <Select
                          value={field.logic.showIfFieldId || precedingChoiceFields[0].id}
                          onChange={(e) => {
                            const targetId = e.target.value;
                            const targetField = precedingChoiceFields.find(f => f.id === targetId);
                            updateField(activeSettingsFieldIndex, {
                              logic: {
                                ...field.logic,
                                showIfFieldId: targetId,
                                showIfValue: targetField?.options?.[0] || ''
                              }
                            });
                          }}
                          disableUnderline
                          sx={{
                            borderRadius: '12px',
                            bgcolor: '#0B0A09',
                            border: '1px solid rgba(255, 255, 255, 0.05)',
                            px: 2,
                            py: 1,
                            color: 'white',
                            fontSize: '0.85rem',
                            fontWeight: 700
                          }}
                        >
                          {precedingChoiceFields.map(f => (
                            <MenuItem key={f.id} value={f.id} sx={{ fontSize: '0.85rem' }}>
                              {f.label || `Question (${f.id})`}
                            </MenuItem>
                          ))}
                        </Select>

                        <Typography variant="caption" sx={{ color: 'rgba(255,255,255,0.4)', fontWeight: 800 }}>
                          equals value:
                        </Typography>

                        {(() => {
                          const parentField = precedingChoiceFields.find(f => f.id === (field.logic.showIfFieldId || precedingChoiceFields[0].id));
                          const options = parentField?.options || [];
                          return (
                            <Select
                              value={field.logic.showIfValue || options[0] || ''}
                              onChange={(e) => {
                                updateField(activeSettingsFieldIndex, {
                                  logic: {
                                    ...field.logic,
                                    showIfValue: e.target.value
                                  }
                                });
                              }}
                              disableUnderline
                              sx={{
                                borderRadius: '12px',
                                bgcolor: '#0B0A09',
                                border: '1px solid rgba(255, 255, 255, 0.05)',
                                px: 2,
                                py: 1,
                                color: 'white',
                                fontSize: '0.85rem',
                                fontWeight: 700
                              }}
                            >
                              {options.map(opt => (
                                <MenuItem key={opt} value={opt} sx={{ fontSize: '0.85rem' }}>
                                  {opt}
                                </MenuItem>
                              ))}
                            </Select>
                          );
                        })()}
                      </Stack>
                    )}
                  </Stack>
                )}
              </Stack>
            </Stack>
          </Stack>
        );
      })()}
    </Drawer>
    </>
  );
}
