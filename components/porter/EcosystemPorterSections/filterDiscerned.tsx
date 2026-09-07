'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import {

export function filterDiscerned(bag: any) {
  const {
  a,
  blob,
  busy,
  cachedSession,
  confirmDrawer,
  confirmKind,
  confirmKindPick,
  confirmLeaveFlow,
  counts,
  dataKind,
  direction,
  discerned,
  endFlowAndClose,
  error,
  executeExport,
  executeImport,
  exportFormat,
  exportPassword,
  fileName,
  fileRef,
  filterDiscerned,
  goBack,
  handleClose,
  lockWithPasskey,
  onFile,
  pasteTimer,
  persistSession,
  portalReady,
  progressMsg,
  rawText,
  requestLeaveFlow,
  resumeCachedSession,
  runDiscern,
  scheduleDiscernFromPaste,
  setBusy,
  setCachedSession,
  setConfirmKind,
  setDataKind,
  setDirection,
  setDiscerned,
  setError,
  setExportFormat,
  setExportPassword,
  setFileName,
  setLockWithPasskey,
  setPortalReady,
  setProgressMsg,
  setRawText,
  setView,
  shellClass,
  startDirection,
  url,
  userId,
  view,
  visibleKinds
  } = bag as any;

  const base: PorterDiscernResult = {
    ...result,
    credentials: Array.isArray(result.credentials) ? result.credentials : [],
    totpSecrets: Array.isArray(result.totpSecrets) ? result.totpSecrets : [],
    workspaces: Array.isArray(result.workspaces) ? result.workspaces : [],
    warnings: Array.isArray(result.warnings) ? result.warnings : [],
  };
  if (kind === 'auto' || kind === 'mixed') return base;
  if (kind === 'secrets') {
    return {
      ...base,
      totpSecrets: [],
      summary: base.credentials.length
        ? `${base.credentials.length} secret${base.credentials.length === 1 ? '' : 's'}`
        : 'No secrets in this file for the Secrets filter',
      warnings: [
        ...base.warnings,
        ...(result.totpSecrets?.length
          ? [`Hid ${result.totpSecrets.length} smart code(s) — Secrets selected.`]
          : []),
      ],
    };
  }
  return {
    ...base,
    credentials: [],
    workspaces: [],
    summary: base.totpSecrets.length
      ? `${base.totpSecrets.length} smart code${base.totpSecrets.length === 1 ? '' : 's'}`
      : 'No smart codes in this file for the Codes filter',
    warnings: [
      ...base.warnings,
      ...(result.credentials?.length
        ? [`Hid ${result.credentials.length} secret(s) — Smart codes selected.`]
        : []),
    ],
  };
}
