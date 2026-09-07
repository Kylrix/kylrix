'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import {

export function buildCredentialData(bag: any) {
  const {
  addCustomField,
  applyEnvText,
  attachments,
  buildCredentialData,
  credentialForm,
  currentType,
  customFields,
  draftReady,
  draftTimerRef,
  envHint,
  error,
  fileInputRef,
  form,
  handleClose,
  handleDeleteAttachment,
  handleEnvFile,
  handleGeneratePassword,
  handleMorphToDetail,
  handlePasteEnv,
  handleSubmit,
  handleUploadAttachment,
  hydrate,
  isEnvMode,
  isExpanded,
  isMobile,
  isNameManuallyEdited,
  loading,
  removeCustomField,
  resolveSecretName,
  setAttachments,
  setCustomFields,
  setDraftReady,
  setEnvHint,
  setError,
  setForm,
  setIsEnvMode,
  setIsExpanded,
  setIsMobile,
  setIsNameManuallyEdited,
  setLoading,
  setShowPassword,
  setUploadingAttachment,
  showLoginFields,
  showPassword,
  syncNameFromUsername,
  updateCustomField,
  uploadingAttachment
  } = bag as any;

    if (!user) throw new Error('Not authenticated');
    const type = initial?.itemType || defaultType;
    const credentialData: CredentialsCreate = {
      userId: user.$id,
      itemType: type,
      name: resolveSecretName(),
      url: null,
      username: null,
      notes: null,
      totpId: initial?.totpId || null,
      cardNumber: null,
      cardholderName: null,
      cardExpiry: null,
      cardCVV: null,
      cardPIN: null,
      cardType: null,
      folderId: initial?.folderId || null,
      tags: null,
      customFields: null,
      faviconUrl: null,
      isFavorite: initial?.isFavorite || false,
      isDeleted: initial?.isDeleted || false,
      deletedAt: initial?.deletedAt || null,
      lastAccessedAt: initial?.lastAccessedAt || null,
      passwordChangedAt: initial?.passwordChangedAt || null,
      password: null,
      isEnv: Boolean(isEnvMode),
      createdAt:
        initial && initial.createdAt ? initial.createdAt : new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };

    if (isEnvMode) {
      const usable = customFields.filter((f) => f.label.trim());
      if (!usable.length) throw new Error('Add at least one environment variable.');
      if (measureEnvFieldsJson(usable) > ENV_CUSTOM_FIELDS_SOFT_MAX_CHARS) {
        throw new Error('Environment bundle is too large. Split into smaller secrets.');
      }
      if (!resolveSecretName()) throw new Error('Title is required.');
      credentialData.name = resolveSecretName();
      credentialData.customFields = JSON.stringify(usable);
      credentialData.password = null;
      credentialData.username = null;
      credentialData.url = null;
      credentialData.isEnv = true;
    } else if (type === 'login') {
      credentialData.username = form.username.trim() || null;
      credentialData.password = form.password.trim() || null;
      if (form.url && form.url.trim()) credentialData.url = form.url.trim();
      if (customFields.length > 0) {
        credentialData.customFields = JSON.stringify(customFields);
      }
      if (!resolveSecretName()) throw new Error('Title is required.');
      credentialData.name = resolveSecretName();
    } else if (type === 'card') {
      credentialData.cardNumber = form.cardNumber.trim();
      credentialData.cardholderName = form.cardholderName.trim();
      credentialData.cardExpiry = form.cardExpiry.trim();
      credentialData.cardCVV = form.cardCVV.trim();
      credentialData.cardPIN = form.cardPIN.trim();
      credentialData.cardType = form.cardType.trim();
    }

    if (form.notes && form.notes.trim()) credentialData.notes = form.notes.trim();
    if (form.tags && form.tags.trim()) {
      const tagsArr = form.tags
        .split(',')
        .map((t) => t.trim())
        .filter((t) => t.length > 0);
      if (tagsArr.length > 0) credentialData.tags = tagsArr;
    }

    return credentialData;
}
