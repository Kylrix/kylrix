'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import {

export function hydrate(bag: any) {
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

      if (!initial || !open) return;

      let row: any = { ...initial };
      try {
        const { looksEncrypted, decryptField } = await import('@/lib/masterpass-crypto');
        if (masterPassCrypto.isVaultUnlocked()) {
          let dekKey: CryptoKey | null = null;
          if (row.dek) {
            try {
              const dekBase64 = await decryptField(row.dek);
              const rawKey = new Uint8Array(atob(dekBase64).split('').map((c) => c.charCodeAt(0)));
              dekKey = await crypto.subtle.importKey('raw', rawKey, { name: 'AES-GCM', length: 256 }, true, ['decrypt']);
            } catch {}
          }
          const fields = ['name', 'username', 'password', 'url', 'notes', 'customFields', 'cardNumber', 'cardholderName', 'cardExpiry', 'cardCVV', 'cardPIN'];
          for (const field of fields) {
            const val = row[field];
            if (typeof val === 'string' && val && looksEncrypted(val)) {
              try {
                if (dekKey) {
                  const dataBytes = atob(val).split('').map((c: string) => c.charCodeAt(0));
                  const dataIv = new Uint8Array(dataBytes.slice(0, 16));
                  const dataEncrypted = new Uint8Array(dataBytes.slice(16));
                  const dec = await crypto.subtle.decrypt({ name: 'AES-GCM', iv: dataIv }, dekKey, dataEncrypted);
                  row[field] = new TextDecoder().decode(dec);
                } else {
                  row[field] = await decryptField(val);
                }
              } catch {}
            }
          }
        }
      } catch {}

      if (cancelled) return;
      setForm({
        name: row.name || '',
        username: row.username || '',
        password: row.password || '',
        url: row.url || '',
        notes: row.notes || '',
        tags: row.tags ? row.tags.join(', ') : '',
        cardNumber: row.cardNumber || '',
        cardholderName: row.cardholderName || '',
        cardExpiry: row.cardExpiry || '',
        cardCVV: row.cardCVV || '',
        cardPIN: row.cardPIN || '',
        cardType: row.cardType || '',
      });
      setCustomFields(normalizeCustomFields(row.customFields));
      setIsEnvMode(Boolean(row.isEnv));
      setIsNameManuallyEdited(true);
      try {
        setAttachments(row.attachments ? JSON.parse(row.attachments) : []);
      } catch {
        setAttachments([]);
      }
      setEnvHint(null);
      setError(null);
}
