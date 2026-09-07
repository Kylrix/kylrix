'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import {

export function executeImport(bag: any) {
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

    if (!discerned || !userId) return;
    setConfirmKind(null);
    requestSudo({
      onSuccess: () => {
        void (async () => {
          setBusy(true);
          setProgressMsg('Importing…');
          try {
            const result = await runOfflinePorterImport(discerned, userId, (msg, processed, total) =>
              setProgressMsg(total ? `${msg} (${processed}/${total})` : msg),
            );
            if (result.success) {
              const skipped = result.summary.skippedExisting + result.summary.skipped;
              toast.success(
                skipped > 0
                  ? `Saved locally — syncing ${result.summary.credentialsCreated} secrets · ${result.summary.totpSecretsCreated} codes · skipped ${skipped}`
                  : `Saved locally — syncing ${result.summary.credentialsCreated} secrets · ${result.summary.totpSecretsCreated} codes`,
              );
            } else {
              toast.error(result.errors[0] || 'Import finished with errors');
            }
            await clearPorterDraft(userId);
            setCachedSession(null);
            onImported?.();
            handleClose();
          } catch (e: any) {
            setError(e?.message || 'Import failed');
          } finally {
            setBusy(false);
            setProgressMsg(null);
          }
        })();
      },
    });
}
