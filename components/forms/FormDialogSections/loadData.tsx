'use client';

import React, { useState, useEffect, useRef, useCallback } from 'react';
import {

export function loadData(bag: any) {
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
}
