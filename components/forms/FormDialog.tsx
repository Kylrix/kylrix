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
} from '@mui/material';
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
} from '@mui/icons-material';
import { FormsService } from '@/lib/services/forms';
import { DraftsService, FormDraft } from '@/lib/services/drafts';
import { Forms, FormsStatus } from '@/generated/appwrite/types';
import { useAuth } from '@/context/auth/AuthContext';
import { useDataNexus } from '@/context/DataNexusContext';

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
];

function SortableField({ 
  field, 
  fIdx, 
  updateField, 
  removeField, 
  addOption, 
  updateOption, 
  removeOption,
  isChoiceType 
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
        bgcolor: isDragging ? alpha('#6366F1', 0.05) : 'rgba(255, 255, 255, 0.01)', 
        border: isDragging ? '1px solid var(--color-primary)' : '1px solid rgba(255, 255, 255, 0.04)',
        borderRadius: '20px',
        transition: 'border-color 0.2s ease, background-color 0.2s ease',
        '&:hover': { borderColor: 'rgba(255, 255, 255, 0.1)' },
        position: 'relative'
      }}
    >
      <Stack spacing={3}>
        <Stack direction={{ xs: 'column', md: 'row' }} spacing={2} alignItems="flex-start">
            <Box 
              {...attributes} 
              {...listeners}
              sx={{ 
                pt: 1, 
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
            
            <Stack spacing={2} sx={{ flexGrow: 1, width: '100%' }}>
                <TextField
                    fullWidth
                    variant="standard"
                    placeholder="Question Label"
                    value={field.label}
                    onChange={(e) => updateField(fIdx, { label: e.target.value })}
                    InputProps={{ disableUnderline: true, sx: { fontSize: '1rem', fontWeight: 800 } }}
                />
                
                <Stack direction="row" spacing={2} alignItems="center">
                    <FormControl variant="filled" size="small" sx={{ minWidth: 200 }}>
                        <Select
                            value={field.type}
                            onChange={(e) => updateField(fIdx, { type: e.target.value })}
                            disableUnderline
                            sx={{ borderRadius: '10px', fontSize: '0.8rem', fontWeight: 700 }}
                            renderValue={(selected) => (
                                <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5 }}>
                                    {FIELD_TYPES.find(t => t.value === selected)?.icon}
                                    {FIELD_TYPES.find(t => t.value === selected)?.label}
                                </Box>
                            )}
                        >
                            {FIELD_TYPES.map(t => (
                            <MenuItem key={t.value} value={t.value} sx={{ fontSize: '0.85rem', gap: 1.5, py: 1.5 }}>
                                {t.icon}
                                {t.label}
                            </MenuItem>
                            ))}
                        </Select>
                    </FormControl>
                    
                    <FormControlLabel
                        control={
                            <Switch 
                                size="small" 
                                checked={field.required} 
                                onChange={(e) => updateField(fIdx, { required: e.target.checked })} 
                            />
                        }
                        label={<Typography variant="caption" sx={{ fontWeight: 800, opacity: 0.6 }}>REQUIRED</Typography>}
                    />

                    <Tooltip title="Field Settings">
                        <IconButton 
                            size="small" 
                            onClick={() => updateField(fIdx, { showSettings: !field.showSettings })}
                            sx={{ 
                                color: field.showSettings ? 'var(--color-primary)' : 'rgba(255,255,255,0.3)',
                                bgcolor: field.showSettings ? alpha('#6366F1', 0.1) : 'transparent',
                                '&:hover': { bgcolor: alpha('#6366F1', 0.1) } 
                            }}
                        >
                            <SettingsIcon fontSize="small" />
                        </IconButton>
                    </Tooltip>

                    <Box sx={{ flexGrow: 1 }} />
                    
                    <Tooltip title="Remove Field">
                        <IconButton size="small" sx={{ color: alpha('#ef4444', 0.5), '&:hover': { color: '#ef4444', bgcolor: alpha('#ef4444', 0.1) } }} onClick={() => removeField(fIdx)}>
                            <DeleteIcon fontSize="small" />
                        </IconButton>
                    </Tooltip>
                </Stack>
            </Stack>
        </Stack>

        {field.showSettings && (
            <Box sx={{ pl: { md: 5 }, pr: 2 }}>
                <Paper sx={{ p: 2, bgcolor: alpha('#fff', 0.02), borderRadius: '14px', border: '1px solid rgba(255,255,255,0.03)' }}>
                    <Typography variant="caption" sx={{ color: 'text.secondary', fontWeight: 900, mb: 2, display: 'block', letterSpacing: '0.05em' }}>
                        VALIDATION CONSTRAINTS
                    </Typography>
                    <Stack direction="row" spacing={2}>
                        {(field.type === 'text' || field.type === 'textarea') && (
                            <>
                                <TextField
                                    label="MIN LEN"
                                    type="number"
                                    size="small"
                                    variant="filled"
                                    value={field.validation?.minLength || ''}
                                    onChange={(e) => updateField(fIdx, { 
                                        validation: { ...field.validation, minLength: e.target.value } 
                                    })}
                                    InputProps={{ disableUnderline: true, sx: { borderRadius: '8px', fontSize: '0.75rem' } }}
                                    sx={{ width: 100 }}
                                />
                                <TextField
                                    label="MAX LEN"
                                    type="number"
                                    size="small"
                                    variant="filled"
                                    value={field.validation?.maxLength || ''}
                                    onChange={(e) => updateField(fIdx, { 
                                        validation: { ...field.validation, maxLength: e.target.value } 
                                    })}
                                    InputProps={{ disableUnderline: true, sx: { borderRadius: '8px', fontSize: '0.75rem' } }}
                                    sx={{ width: 100 }}
                                />
                                <TextField
                                    label="REGEX PATTERN"
                                    size="small"
                                    variant="filled"
                                    placeholder="^[a-zA-Z]+$"
                                    value={field.validation?.pattern || ''}
                                    onChange={(e) => updateField(fIdx, { 
                                        validation: { ...field.validation, pattern: e.target.value } 
                                    })}
                                    InputProps={{ disableUnderline: true, sx: { borderRadius: '8px', fontSize: '0.75rem' } }}
                                    sx={{ flexGrow: 1 }}
                                />
                            </>
                        )}
                        {field.type === 'number' && (
                            <>
                                <TextField
                                    label="MIN VALUE"
                                    type="number"
                                    size="small"
                                    variant="filled"
                                    value={field.validation?.min || ''}
                                    onChange={(e) => updateField(fIdx, { 
                                        validation: { ...field.validation, min: e.target.value } 
                                    })}
                                    InputProps={{ disableUnderline: true, sx: { borderRadius: '8px', fontSize: '0.75rem' } }}
                                    sx={{ width: 120 }}
                                />
                                <TextField
                                    label="MAX VALUE"
                                    type="number"
                                    size="small"
                                    variant="filled"
                                    value={field.validation?.max || ''}
                                    onChange={(e) => updateField(fIdx, { 
                                        validation: { ...field.validation, max: e.target.value } 
                                    })}
                                    InputProps={{ disableUnderline: true, sx: { borderRadius: '8px', fontSize: '0.75rem' } }}
                                    sx={{ width: 120 }}
                                />
                            </>
                        )}
                    </Stack>
                </Paper>
            </Box>
        )}

        {isChoiceType(field.type) && (
            <Box sx={{ pl: { md: 5 } }}>
                <Typography variant="caption" sx={{ color: 'text.secondary', fontWeight: 900, mb: 1.5, display: 'block', letterSpacing: '0.05em' }}>
                    CONFIGURE OPTIONS
                </Typography>
                <Stack spacing={1}>
                    {(field.options || []).map((opt: string, oIdx: number) => (
                        <Stack key={oIdx} direction="row" spacing={1} alignItems="center">
                            <Box sx={{ width: 6, height: 6, borderRadius: '50%', bgcolor: 'rgba(255,255,255,0.1)' }} />
                            <TextField
                                fullWidth
                                size="small"
                                variant="standard"
                                value={opt}
                                onChange={(e) => updateOption(fIdx, oIdx, e.target.value)}
                                InputProps={{ disableUnderline: true, sx: { fontSize: '0.85rem' } }}
                            />
                            <IconButton size="small" onClick={() => removeOption(fIdx, oIdx)} sx={{ opacity: 0.3 }}>
                                <CloseIcon fontSize="inherit" />
                            </IconButton>
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
  const { invalidate } = useDataNexus();
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [status, setStatus] = useState<'draft' | 'published' | 'archived'>('draft');
  const [fields, setFields] = useState<any[]>([]);
  const [hasUnsavedChanges, setHasUnsavedChanges] = useState(false);
  const [isRestored, setIsRestored] = useState(false);
  
  const initialLoadRef = useRef(true);

  const sensors = useSensors(
    useSensor(PointerSensor),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    })
  );

  const handleDragEnd = (event: DragEndEvent) => {
    const { active, over } = event;

    if (active.id !== over?.id) {
      setFields((items) => {
        const oldIndex = items.findIndex((item) => item.id === active.id);
        const newIndex = items.findIndex((item) => item.id === over?.id);

        return arrayMove(items, oldIndex, newIndex);
      });
    }
  };

  // Initial load logic
  useEffect(() => {
    if (!open) {
        initialLoadRef.current = true;
        return;
    }

    if (initialDraft) {
        setTitle(initialDraft.title || '');
        setDescription(initialDraft.description || '');
        setStatus(initialDraft.status as any || 'draft');
        setFields(initialDraft.fields || []);
        setIsRestored(true);
        setHasUnsavedChanges(true);
    } else {
        const formId = form?.$id || 'new';
        const savedDraft = DraftsService.getDraft(formId);
        
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
    setFields(fields.filter((_, i) => i !== index));
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
    <Drawer 
      anchor={isMobile ? 'bottom' : 'right'}
      open={open} 
      onClose={onClose}
      PaperProps={{
        sx: { 
          width: isMobile ? '100%' : 'min(100vw, 800px)',
          maxWidth: '100%',
          height: isMobile ? 'auto' : '100%',
          maxHeight: isMobile ? '92dvh' : '100%',
          bgcolor: 'rgba(10, 10, 10, 0.9)', 
          backdropFilter: 'blur(30px) saturate(200%)',
          border: '1px solid rgba(255, 255, 255, 0.08)',
          borderRadius: isMobile ? '28px 28px 0 0' : '0',
          backgroundImage: 'none',
          boxShadow: '0 24px 80px rgba(0,0,0,0.5)',
          display: 'flex',
          flexDirection: 'column',
        }
      }}
    >
      <Box sx={{ 
        px: 4, 
        py: 3, 
        display: 'flex', 
        justifyContent: 'space-between', 
        alignItems: 'center',
        borderBottom: '1px solid rgba(255, 255, 255, 0.05)',
        flexShrink: 0,
      }}>
        <Box>
            <Stack direction="row" spacing={1.5} alignItems="center">
                <Typography variant="h5" sx={{ fontWeight: 900, fontFamily: 'var(--font-clash)', letterSpacing: '-0.02em' }}>
                {form ? 'Refine Design' : 'Create Intelligence Portal'}
                </Typography>
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
            </Stack>
            <Typography variant="caption" sx={{ color: 'text.secondary', fontWeight: 700, letterSpacing: '0.1em' }}>
                KYLRIX FLOW / FORMS ENGINE
            </Typography>
        </Box>
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
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
                Insert Field
            </Button>
            <IconButton onClick={onClose} size="small" sx={{ bgcolor: 'rgba(255, 255, 255, 0.05)', '&:hover': { bgcolor: 'rgba(255, 255, 255, 0.1)' } }}>
                <CloseIcon fontSize="small" />
            </IconButton>
        </Box>
      </Box>

      <Box sx={{ p: 4, pt: 1, flex: 1, overflowY: 'auto' }}>
        <Stack spacing={5}>
          {isRestored && (
            <Alert 
                severity="warning" 
                action={
                    <Button color="inherit" size="small" onClick={discardDraft} sx={{ fontWeight: 800 }}>
                        DISCARD
                    </Button>
                }
                sx={{ 
                    borderRadius: '16px', 
                    bgcolor: alpha('#FFB020', 0.05), 
                    color: '#FFB020', 
                    border: '1px solid rgba(255, 176, 32, 0.1)',
                    '& .MuiAlert-icon': { color: '#FFB020' }
                }}
            >
                Restored from local cache. Your changes are unsynced.
            </Alert>
          )}

          <Box>
            <Stack spacing={2.5}>
              <TextField
                fullWidth
                label="Identity Label"
                variant="filled"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                placeholder="e.g., Nexus Registration"
                InputProps={{ disableUnderline: true, sx: { borderRadius: '16px', fontWeight: 800, fontSize: '1.1rem' } }}
              />
              <TextField
                fullWidth
                label="Mission Brief"
                variant="filled"
                multiline
                rows={2}
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                placeholder="Briefly describe the objective..."
                InputProps={{ disableUnderline: true, sx: { borderRadius: '16px' } }}
              />
              <FormControl fullWidth variant="filled">
                <InputLabel>Deployment Status</InputLabel>
                <Select
                  value={status}
                  label="Deployment Status"
                  onChange={(e) => setStatus(e.target.value as any)}
                  disableUnderline
                  sx={{ borderRadius: '16px' }}
                >
                  <MenuItem value="draft">DRAFT (INTERNAL)</MenuItem>
                  <MenuItem value="published">PUBLISHED (PUBLIC ACCESS)</MenuItem>
                  <MenuItem value="archived">ARCHIVED (READ-ONLY)</MenuItem>
                </Select>
              </FormControl>
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
                    <SyncIcon sx={{ fontSize: 14 }} /> LOCAL AUTOSAVE ACTIVE
                </Typography>
            )}
        </Box>
        <Button onClick={onClose} disabled={loading} sx={{ fontWeight: 800, color: 'text.secondary' }}>Cancel</Button>
        <Button 
          variant="contained" 
          onClick={handleSave} 
          disabled={loading || !title}
          sx={{ 
            borderRadius: '16px', 
            px: 5, 
            py: 1.5,
            fontWeight: 900,
            bgcolor: 'var(--color-primary)',
            color: 'black',
            boxShadow: `0 8px 32px ${alpha('#6366F1', 0.3)}`,
            '&:hover': { bgcolor: alpha('#6366F1', 0.9) }
          }}
        >
          {loading ? 'Encrypting...' : (form ? 'Commit Changes' : 'Initialize Portal')}
        </Button>
      </Box>
    </Drawer>
  );
}
