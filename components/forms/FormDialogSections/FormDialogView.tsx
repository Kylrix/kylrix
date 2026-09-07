'use client';

import React, { useState, useEffect, useRef, useCallback } from 'react';
import {

export function FormDialogView(bag: any) {
  const {
    acceptGhost,
    activeFieldIndex,
    activeSettingsFieldIndex,
    addField,
    addOption,
    base,
    currentFieldsStr,
    description,
    fields,
    fieldsEndRef,
    form,
    formId,
    ghostSuggestion,
    handleClose,
    handleDragEnd,
    handleSave,
    hasUnsavedChanges,
    id,
    initialDraft,
    initialLoadRef,
    isChoiceType,
    isDifferent,
    isExpanded,
    isPro,
    isRestored,
    loadData,
    loading,
    moveFieldDown,
    moveFieldUp,
    newFields,
    newIndex,
    next,
    nextItems,
    oldIndex,
    onClose,
    onSaved,
    open,
    openPro,
    openSelectorDrawer,
    openSettingsDrawer,
    options,
    originalFields,
    parentIdx,
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
    temp,
    title,
    updateField,
    updateOption,
    validateFieldsLogic
  } = bag as any;
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
          <Typography sx={{ fontSize: '1.25rem', fontWeight: 900, fontFamily: 'var(--font-clash)', letterSpacing: '-0.02em', color: 'white' }}>
            {form ? 'Edit Form' : 'Create New Form'}
          </Typography>
          <IconButton onClick={handleClose} size="small" sx={{ bgcolor: 'rgba(255, 255, 255, 0.05)', '&:hover': { bgcolor: 'rgba(255, 255, 255, 0.1)' }, flexShrink: 0, color: 'white' }}>
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


              <div className="bg-[#1C1A18] border border-[#2C2A28] rounded-[24px] p-5 flex flex-col gap-3 shadow-[0_12px_32px_rgba(0,0,0,0.4)] mb-4">
                <input
                  type="text"
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  placeholder="Name this form..."
                  className="w-full bg-transparent border-0 outline-none text-base font-black text-[#F5F2ED] focus:ring-0 font-clash"
                />
                <div className="h-px bg-white/5" />
                <div className="relative min-h-[72px]">
                  <textarea
                    rows={3}
                    value={description}
                    onChange={(e) => setDescription(e.target.value)}
                    onKeyDown={(e) => {
                      if (
                        (e.key === 'ArrowRight' || e.key === 'Tab') &&
                        ghostSuggestion &&
                        e.currentTarget.selectionStart === e.currentTarget.value.length
                      ) {
                        e.preventDefault();
                        acceptGhost();
                        return;
                      }
                      handleAgentKeyDown(e);
                      handleAutoKeyDown(e);
                    }}
                    placeholder="Briefly describe the purpose of this form..."
                    className="relative w-full bg-transparent border-0 outline-none text-sm text-[#9B9691] focus:ring-0 resize-none font-satoshi"
                  />
                  <TypeIntelGhostLayer
                    draft={description}
                    suggestion={ghostSuggestion}
                    enabled={Boolean(ghostSuggestion) || createWithAgent}
                    showWand={createWithAgent}
                    busy={agentBusy}
                    accent={agentAccent}
                    onAccept={acceptGhost}
                    onTakeover={() => void runTakeover()}
                    className="text-sm leading-normal font-satoshi"
                  />
                </div>
                <TypeIntelToggle
                  enabled={createWithAgent}
                  onToggle={persistAgent}
                  locked={!isPro}
                  onLockedAttempt={openPro}
                  accent={agentAccent}
                  learningStatus={learningStatus}
                  learningLabel={learningLabel}
                  busy={agentBusy}
                />
              </div>

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
            '&.ob-disabled': {
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
                    onChange={(e: React.ChangeEvent<HTMLInputElement>) => updateField(activeSettingsFieldIndex, { 
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
                          onChange={(e: React.ChangeEvent<HTMLInputElement>) => {
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
                          onChange={(e: React.ChangeEvent<HTMLInputElement>) => {
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
                              onChange={(e: React.ChangeEvent<HTMLInputElement>) => {
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
                              {options.map((opt: string) => (
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
