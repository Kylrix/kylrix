'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import {

export function startDirection(bag: any) {
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

    // Already have work in the other direction — ask to cancel first
    if (cachedSession && cachedSession.direction !== dir) {
      setError(
        `You have an in-progress ${cachedSession.direction}. Open it, or cancel it first.`,
      );
      return;
    }

    // Same direction with saved work → resume details
    if (
      cachedSession?.direction === dir &&
      (dir === 'export' || draftHasImportPreview(cachedSession) || cachedSession.view)
    ) {
      void resumeCachedSession();
      return;
    }

    setDirection(dir);
    setError(null);
    setDiscerned(null);
    setRawText('');
    setFileName(null);
    setConfirmKind(null);
    const nextKind =
      dir === 'export' && dataKind === 'auto'
        ? surface === 'vault-totp'
          ? 'totp'
          : surface === 'vault-secrets'
            ? 'secrets'
            : 'mixed'
        : dataKind;
    if (nextKind !== dataKind) setDataKind(nextKind);
    void persistSession({
      direction: dir,
      dataKind: nextKind,
      result: null,
      fileName: null,
      view: 'pick-kind',
    });
    setView('pick-kind');
}
