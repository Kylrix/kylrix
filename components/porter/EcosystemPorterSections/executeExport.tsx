'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import {

export function executeExport(bag: any) {
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

    if (!userId) return;
    setConfirmKind(null);
    requestSudo({
      onSuccess: () => {
        void (async () => {
          setBusy(true);
          setError(null);
          try {
            let finalData = await exportVaultPlaintext(userId);
            const localVault = finalData.data.vault;
            const localEmpty = !(
              localVault.credentials?.length ||
              localVault.totpSecrets?.length ||
              localVault.workspaces?.length || (localVault as any).folders?.length
            );

            if (localEmpty) {
              try {
                const result = await porterExport(userId);
                const vault =
                  result.data.data?.vault ||
                  (result.data as any).vault || {
                    workspaces: (result.data as any).workspaces || result.data.folders || [],
                    credentials: result.data.credentials || [],
                    totpSecrets: result.data.totpSecrets || [],
                  };
                finalData = {
                  ...finalData,
                  data: { vault },
                } as any;
              } catch {
                /* keep empty */
              }
            }

            const vault = {
              workspaces: [...((finalData?.data?.vault as any)?.workspaces || (finalData?.data?.vault as any)?.folders || [])],
              credentials: [...(finalData?.data?.vault?.credentials || [])],
              totpSecrets: [...(finalData?.data?.vault?.totpSecrets || [])],
            };
            if (dataKind === 'secrets') {
              vault.totpSecrets = [];
            } else if (dataKind === 'totp') {
              vault.credentials = [];
              vault.workspaces = [];
            }

            if (dataKind === 'totp' && vault.totpSecrets.length === 0) {
              setError('No smart codes found to export. Open the Codes tab once, then try again.');
              setBusy(false);
              return;
            }
            if (dataKind === 'secrets' && vault.credentials.length === 0) {
              setError('No secrets found to export.');
              setBusy(false);
              return;
            }

            const payload = {
              version: 2,
              format: 'kylrix-vault',
              plaintext: true,
              exportedAt: new Date().toISOString(),
              userId,
              exportKind: dataKind,
              data: { vault },
            };

            const jsonString = JSON.stringify(payload, null, 2);
            const suffix =
              dataKind === 'secrets' ? 'secrets' : dataKind === 'totp' ? 'codes' : 'vault';

            if (exportFormat === 'encrypted-html') {
              if (!exportPassword.trim()) {
                setError('Choose a password to lock this HTML file (passkey unlock is optional).');
                setBusy(false);
                return;
              }
              const passkeyWrap = lockWithPasskey
                ? await tryCreatePasskeyWrapKey().catch(() => null)
                : null;
              const sealed = await sealPlaintextExport(
                jsonString,
                exportPassword.trim(),
                passkeyWrap,
              );
              const htmlPage = generateEncryptedHtmlPage(sealed, user?.email || 'Kylrix User');
              downloadBlob(htmlPage, `kylrix-${suffix}-backup-locked.html`, 'text/html');
            } else {
              downloadBlob(jsonString, `kylrix-${suffix}-backup.json`, 'application/json');
            }
            toast.success(
              dataKind === 'totp'
                ? `Exported ${vault.totpSecrets.length} smart codes`
                : dataKind === 'secrets'
                  ? `Exported ${vault.credentials.length} secrets`
                  : 'Export ready',
            );
            if (userId) await clearPorterDraft(userId);
            setCachedSession(null);
            handleClose();
          } catch (e: any) {
            setError(e?.message || 'Export failed');
          } finally {
            setBusy(false);
          }
        })();
      },
    });
}
