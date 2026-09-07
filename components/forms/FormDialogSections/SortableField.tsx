'use client';

import React, { useState, useEffect, useRef, useCallback } from 'react';
import {

export function SortableField(bag: any) {
  const {
  SortableField,
  acceptGhost,
  activeFieldIndex,
  activeSettingsFieldIndex,
  addField,
  addOption,
  description,
  fields,
  fieldsEndRef,
  ghostSuggestion,
  handleClose,
  handleDragEnd,
  handleSave,
  hasUnsavedChanges,
  initialLoadRef,
  isChoiceType,
  isExpanded,
  isPro,
  isRestored,
  loadData,
  loading,
  moveFieldDown,
  moveFieldUp,
  openPro,
  openSelectorDrawer,
  openSettingsDrawer,
  removeField,
  removeOption,
  selectorOpen,
  sensors,
  setActiveFieldIndex,
  setActiveSettingsFieldIndex,
  setDescription,
  setFields,
  setHasUnsavedChanges,
  setIsExpanded,
  setIsRestored,
  setLoading,
  setSelectorOpen,
  setSettingsOpen,
  setStatus,
  setStatusDrawerOpen,
  setTitle,
  settingsOpen,
  status,
  statusDrawerOpen,
  style,
  title,
  updateField,
  updateOption,
  validateFieldsLogic
  } = bag as any;

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
    opacity: isDragging ? 0.6 : 1};

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
