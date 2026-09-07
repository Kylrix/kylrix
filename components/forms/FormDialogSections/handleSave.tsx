'use client';

import React, { useState, useEffect, useRef, useCallback } from 'react';
import {

export function handleSave(bag: any) {
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
        settings: form?.settings || '{}'};

      if (form) {
        await FormsService.updateForm(form.$id, formData);
        autonomicSyncEngine.ack(form.$id);
        if (user) invalidate(`f_user_forms_${user.$id}`);
        invalidate(`f_form_schema_${form.$id}`);
      } else {
        const isCustomWorkspace = Boolean(activeWorkspace && !activeWorkspace.isPersonal);
        const newForm = await FormsService.createForm(user.$id, {
          ...formData,
          isWorkspace: isCustomWorkspace,
        } as any);
        if (isCustomWorkspace && newForm?.$id) {
          void attachEntityToActiveWorkspace('form', newForm.$id);
        }
        autonomicSyncEngine.ack(newForm.$id);
        if (user) invalidate(`f_user_forms_${user.$id}`);
      }
      setHasUnsavedChanges(false);
      
      onSaved();
      onClose();
    } catch (error) {
      console.error('Failed to save form', error);
    } finally {
      setLoading(false);
    }
}
