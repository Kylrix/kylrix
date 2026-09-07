'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import {
  ArrowLeft,
  ArrowUpDown,
  CheckCircle2,
  Download,
  FileCode2,
  KeyRound,
  Lock,
  Upload,
  X,
} from 'lucide-react';
import toast from 'react-hot-toast';
import { useAppwriteVault } from '@/context/appwrite-context';
import { useSudo } from '@/context/SudoContext';
import {
  annotatePorterDiscernResult,
  cachePorterDraft,
  clearPorterDraft,
  discernImportPayload,
  exportVaultPlaintext,
  loadExistingVaultForDedupe,
  loadPorterDraft,
  draftHasImportPreview,
  type PorterDiscernResult,
  type PorterSessionDraft,
} from '@/lib/porter';
import { runOfflinePorterImport } from '@/lib/porter/offline';
import {
  generateEncryptedHtmlPage,
  sealPlaintextExport,
  tryCreatePasskeyWrapKey,
} from '@/utils/import/encrypted-html-exporter';
import { porterExport } from '@/lib/data-porter';

type PorterDirection = 'import' | 'export';
type PorterDataKind = 'secrets' | 'totp' | 'mixed' | 'auto';
type PorterView = 'home' | 'pick-kind' | 'import' | 'preview' | 'export-format';
type ConfirmKind = 'import' | 'export' | 'leave' | null;

export type EcosystemPorterProps = {
  onClose?: () => void;
  /** Desktop sidebar embeds without outer chrome chrome */
  embedded?: boolean;
  onImported?: () => void;
  /** Marker for Overlay / sidebar fullscreen detection */
  'data-porter'?: boolean;
  /**
   * Surface context — vault secrets/totp tabs bias the kind picker.
   * Elsewhere omit for full ecosystem options.
   */
  surface?: 'vault-secrets' | 'vault-totp' | 'settings' | 'general';
};

const KIND_OPTIONS: Array<{
  id: PorterDataKind;
  label: string;
  blurb: string;
  icon: 'lock' | 'key' | 'both' | 'auto';
  importOnly?: boolean;
}> = [
  {
    id: 'secrets',
    label: 'Secrets',
    blurb: 'Logins, passwords, cards, env bundles',
    icon: 'lock',
  },
  {
    id: 'totp',
    label: 'Smart codes',
    blurb: 'One-time codes / authenticator entries',
    icon: 'key',
  },
  {
    id: 'mixed',
    label: 'Secrets + codes',
    blurb: 'Both tables — mixed dumps welcome',
    icon: 'both',
  },
  {
    id: 'auto',
    label: 'Auto-detect',
    blurb: 'We read the file and decide',
    icon: 'auto',
    importOnly: true,
  },
];

function kindIcon(kind: (typeof KIND_OPTIONS)[number]['icon']) {
  if (kind === 'lock') return <Lock className="w-5 h-5 text-[#10B981]" />;
  if (kind === 'key') return <KeyRound className="w-5 h-5 text-[#10B981]" />;
  if (kind === 'both') return <ArrowUpDown className="w-5 h-5 text-[#10B981]" />;
  return <FileCode2 className="w-5 h-5 text-[#10B981]" />;
}

function kindLabel(kind: PorterDataKind): string {
  if (kind === 'secrets') return 'Secrets';
  if (kind === 'totp') return 'Smart codes';
  if (kind === 'auto') return 'Auto-detect';
  return 'Secrets + codes';
}

function filterDiscerned(
  result: PorterDiscernResult,
  kind: PorterDataKind,
): PorterDiscernResult {
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

export default function EcosystemPorter({
  onClose,
  embedded = false,
  onImported,
  'data-porter': _porterMarker = true,
  surface = 'general',
}: EcosystemPorterProps) {
  const { user } = useAppwriteVault();
  const { requestSudo } = useSudo();
  const fileRef = useRef<HTMLInputElement>(null);
  const pasteTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const [view, setView] = useState<PorterView>('home');
  const [direction, setDirection] = useState<PorterDirection>('import');
  const [dataKind, setDataKind] = useState<PorterDataKind>(() =>
    surface === 'vault-totp' ? 'totp' : surface === 'vault-secrets' ? 'secrets' : 'mixed',
  );
  const [rawText, setRawText] = useState('');
  const [fileName, setFileName] = useState<string | null>(null);
  const [discerned, setDiscerned] = useState<PorterDiscernResult | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [exportFormat, setExportFormat] = useState<'json' | 'encrypted-html'>('json');
  const [exportPassword, setExportPassword] = useState('');
  const [lockWithPasskey, setLockWithPasskey] = useState(true);
  const [progressMsg, setProgressMsg] = useState<string | null>(null);
  const [confirmKind, setConfirmKind] = useState<ConfirmKind>(null);
  const [portalReady, setPortalReady] = useState(false);
  const [cachedSession, setCachedSession] = useState<PorterSessionDraft | null>(null);

  const userId = user?.$id || '';

  useEffect(() => {
    setPortalReady(true);
  }, []);

  useEffect(() => {
    if (!userId) return;
    void (async () => {
      const draft = await loadPorterDraft(userId);
      setCachedSession(draft);
    })();
  }, [userId]);

  const handleClose = useCallback(() => {
    onClose?.();
  }, [onClose]);

  const persistSession = useCallback(
    async (partial: Partial<PorterSessionDraft> & { direction: PorterDirection; dataKind: PorterDataKind }) => {
      if (!userId) return;
      // Never clobber a saved preview with an empty result unless caller clears explicitly
      const keepResult =
        partial.result === undefined
          ? discerned
          : partial.result;
      const next: Omit<PorterSessionDraft, 'savedAt'> = {
        direction: partial.direction,
        dataKind: partial.dataKind,
        fileName: partial.fileName !== undefined ? partial.fileName : fileName,
        result: keepResult,
        exportFormat: partial.exportFormat ?? exportFormat,
        view: partial.view,
      };
      await cachePorterDraft(userId, next);
      setCachedSession({ ...next, savedAt: new Date().toISOString() });
    },
    [userId, fileName, discerned, exportFormat],
  );

  const resumeCachedSession = useCallback(async () => {
    setBusy(true);
    setError(null);
    try {
      // Always re-read from LocalEngine so resume is not stuck on stale React state
      const draft = userId ? (await loadPorterDraft(userId)) || cachedSession : cachedSession;
      if (!draft) {
        setError('No saved transfer found.');
        setView('home');
        return;
      }
      setCachedSession(draft);
      setDirection(draft.direction);
      setDataKind(draft.dataKind);
      setFileName(draft.fileName || null);
      if (draft.exportFormat) setExportFormat(draft.exportFormat);

      if (draft.direction === 'export') {
        setView(draft.view === 'export-format' || !draft.view ? 'export-format' : draft.view);
        return;
      }

      let result = draft.result || null;
      if (result) {
        result = filterDiscerned(result, draft.dataKind);
        if (userId) {
          try {
            const existing = await loadExistingVaultForDedupe(userId);
            result = annotatePorterDiscernResult(result, existing);
          } catch {
            /* keep filtered result */
          }
        }
      }
      setDiscerned(result);

      const hasItems =
        !!result &&
        (result.credentials?.length || 0) +
          (result.totpSecrets?.length || 0) +
          (result.workspaces?.length || 0) >
          0;

      if (hasItems || draft.view === 'preview') {
        setView('preview');
      } else if (draft.view === 'import' || draft.view === 'pick-kind') {
        setView(draft.view === 'pick-kind' ? 'pick-kind' : 'import');
      } else {
        setView(hasItems ? 'preview' : 'import');
      }
    } catch (e: any) {
      setError(e?.message || 'Could not open the saved transfer.');
      setView('home');
    } finally {
      setBusy(false);
    }
  }, [cachedSession, userId]);

  const endFlowAndClose = useCallback(async () => {
    if (userId) await clearPorterDraft(userId);
    setCachedSession(null);
    setDiscerned(null);
    setRawText('');
    setFileName(null);
    setConfirmKind(null);
    handleClose();
  }, [userId, handleClose]);

  const visibleKinds = useMemo(() => {
    return KIND_OPTIONS.filter((opt) => {
      if (opt.importOnly && direction === 'export') return false;
      return true;
    });
  }, [direction]);

  const goBack = () => {
    setError(null);
    setConfirmKind(null);
    if (view === 'home') {
      handleClose();
      return;
    }
    if (view === 'pick-kind') {
      setView('home');
      if (userId) {
        void loadPorterDraft(userId).then((d) => setCachedSession(d));
      }
      return;
    }
    if (view === 'import' || view === 'export-format') {
      setView('pick-kind');
      return;
    }
    if (view === 'preview') {
      setView('import');
      return;
    }
    setView('home');
  };

  const requestLeaveFlow = () => setConfirmKind('leave');

  const confirmLeaveFlow = () => {
    void endFlowAndClose();
  };

  const startDirection = (dir: PorterDirection) => {
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
  };

  const confirmKindPick = (kind: PorterDataKind) => {
    setDataKind(kind);
    setError(null);
    const nextView = direction === 'import' ? 'import' : 'export-format';
    void persistSession({
      direction,
      dataKind: kind,
      result: discerned ?? cachedSession?.result ?? null,
      view: nextView,
    });
    setView(nextView);
  };

  const runDiscern = useCallback(
    async (text: string, name?: string | null) => {
      const trimmed = text.trim();
      if (!trimmed) return;
      setError(null);
      setBusy(true);
      try {
        const raw = discernImportPayload(trimmed, userId);
        let result = filterDiscerned(raw, dataKind);
        if (userId) {
          const existing = await loadExistingVaultForDedupe(userId);
          result = annotatePorterDiscernResult(result, existing);
        }
        setDiscerned(result);
        setFileName(name || null);
        if (userId) {
          const hasItems =
            (result.credentials?.length || 0) +
              (result.totpSecrets?.length || 0) +
              (result.workspaces?.length || 0) >
            0;
          await persistSession({
            direction: 'import',
            dataKind,
            result,
            fileName: name || null,
            view: hasItems ? 'preview' : 'import',
          });
        }
        if (
          (result.credentials?.length || 0) +
            (result.totpSecrets?.length || 0) +
            (result.workspaces?.length || 0) ===
          0
        ) {
          setError(result.warnings?.[0] || 'Nothing matched the selected type.');
          setView('import');
        } else {
          setView('preview');
        }
      } catch (e: any) {
        setError(e?.message || 'Could not read this data.');
        setView('import');
      } finally {
        setBusy(false);
      }
    },
    [userId, dataKind, persistSession],
  );

  const scheduleDiscernFromPaste = useCallback(
    (text: string) => {
      if (pasteTimer.current) clearTimeout(pasteTimer.current);
      pasteTimer.current = setTimeout(() => {
        void runDiscern(text);
      }, 250);
    },
    [runDiscern],
  );

  useEffect(() => {
    return () => {
      if (pasteTimer.current) clearTimeout(pasteTimer.current);
    };
  }, []);

  const onFile = async (file: File | null) => {
    if (!file) return;
    setBusy(true);
    setError(null);
    try {
      const text = await file.text();
      setRawText(text);
      await runDiscern(text, file.name);
    } catch (e: any) {
      setError(e?.message || 'Failed to read file.');
      setBusy(false);
    }
  };

  const executeImport = () => {
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
  };

  const executeExport = () => {
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
  };

  const counts = useMemo(() => {
    if (!discerned) return { secrets: 0, totp: 0, workspaces: 0, importable: 0, skipped: 0 };
    const creds = Array.isArray(discerned.credentials) ? discerned.credentials : [];
    const totps = Array.isArray(discerned.totpSecrets) ? discerned.totpSecrets : [];
    const spaces = Array.isArray(discerned.workspaces) ? discerned.workspaces : [];
    const secretsNew = creds.filter(
      (c) => !c._status || c._status === 'new' || c._status === 'merged',
    ).length;
    const totpNew = totps.filter(
      (t) => !t._status || t._status === 'new' || t._status === 'merged',
    ).length;
    const skipped =
      creds.filter((c) => c._status === 'duplicate' || c._status === 'invalid').length +
      totps.filter((t) => t._status === 'duplicate' || t._status === 'invalid').length;
    return {
      secrets: creds.length,
      totp: totps.length,
      workspaces: spaces.length,
      importable: secretsNew + totpNew + spaces.length,
      skipped,
    };
  }, [discerned]);

  const shellClass = embedded
    ? 'flex h-full min-h-0 w-full flex-col bg-[#161412] overflow-hidden'
    : 'flex h-[100dvh] max-h-[100dvh] w-full flex-col bg-[#161412] overflow-hidden';

  const confirmDrawer =
    portalReady &&
    confirmKind &&
    createPortal(
      <div className="fixed inset-0 z-[9999999] flex flex-col justify-end sm:flex-row sm:justify-end pointer-events-auto">
        <button
          type="button"
          className="absolute inset-0 bg-black/70 border-0 cursor-default"
          aria-label="Dismiss"
          onClick={() => setConfirmKind(null)}
        />
        <div
          className="relative z-[9999999] w-full sm:w-[420px] sm:h-full max-h-[60dvh] sm:max-h-none bg-[#161412] border border-white/20 border-b-0 sm:border-b sm:border-r-0 sm:border-l rounded-t-[28px] sm:rounded-none sm:rounded-l-[28px] flex flex-col overflow-hidden shadow-2xl"
          role="dialog"
          aria-modal="true"
        >
          <div className="shrink-0 px-5 py-4 border-b border-white/20 flex items-center justify-between gap-3">
            <div className="min-w-0">
              <p className="text-[0.72rem] font-medium uppercase tracking-[0.08em] text-white">
                Confirm
              </p>
              <p className="text-base font-black text-white font-clash truncate">
                {confirmKind === 'import'
                  ? 'Import into vault'
                  : confirmKind === 'export'
                    ? 'Download backup'
                    : 'Cancel transfer'}
              </p>
            </div>
            <button
              type="button"
              onClick={() => setConfirmKind(null)}
              className="p-2 rounded-xl bg-black border border-white/20 text-white"
              aria-label="Close"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
          <div className="flex-1 min-h-0 overflow-y-auto px-5 py-4 space-y-3 font-satoshi">
            {confirmKind === 'import' ? (
              <>
                <p className="text-sm font-medium text-white">
                  Add {counts.importable} new item{counts.importable === 1 ? '' : 's'} to your vault.
                </p>
                {counts.skipped > 0 && (
                  <p className="text-sm font-medium text-white">
                    {counts.skipped} item{counts.skipped === 1 ? '' : 's'} will be skipped.
                  </p>
                )}
                <div className="rounded-2xl border border-white/20 bg-black px-4 py-3 space-y-1">
                  <p className="text-sm font-bold text-white">{counts.secrets} secrets in file</p>
                  <p className="text-sm font-bold text-white">{counts.totp} smart codes in file</p>
                  <p className="text-sm font-bold text-white">{counts.workspaces} workspaces in file</p>
                </div>
              </>
            ) : confirmKind === 'export' ? (
              <>
                <p className="text-sm font-medium text-white">
                  Download{' '}
                  {dataKind === 'secrets'
                    ? 'secrets'
                    : dataKind === 'totp'
                      ? 'smart codes'
                      : 'secrets and smart codes'}{' '}
                  as {exportFormat === 'json' ? 'readable JSON' : 'locked HTML'}.
                </p>
                {exportFormat === 'json' && (
                  <p className="text-sm font-medium text-white">
                    JSON is plaintext — keep the file private.
                  </p>
                )}
              </>
            ) : (
              <p className="text-sm font-medium text-white">
                Stop this transfer and clear the saved draft? You can start again anytime.
              </p>
            )}
          </div>
          <div className="shrink-0 px-5 py-4 border-t border-white/20 flex flex-col gap-2">
            <button
              type="button"
              disabled={busy || (confirmKind === 'import' && counts.importable === 0)}
              onClick={() => {
                if (confirmKind === 'import') executeImport();
                else if (confirmKind === 'export') executeExport();
                else confirmLeaveFlow();
              }}
              className="w-full py-3 rounded-xl font-bold bg-[#10B981] text-black disabled:opacity-50 font-clash"
            >
              {confirmKind === 'import'
                ? 'Yes, import'
                : confirmKind === 'export'
                  ? 'Yes, download'
                  : 'Yes, cancel transfer'}
            </button>
            <button
              type="button"
              onClick={() => setConfirmKind(null)}
              className="w-full py-3 rounded-xl font-bold bg-black border border-white/20 text-white font-clash"
            >
              Keep going
            </button>
          </div>
        </div>
      </div>,
      document.body,
    );

  return (
    <div className={shellClass}>
      <header className="shrink-0 px-5 py-4 flex items-center gap-3 border-b border-white/20">
        <button
          type="button"
          onClick={goBack}
          className="p-2 rounded-xl bg-black border border-white/20 text-white hover:border-white/40 transition-colors"
          aria-label="Back"
        >
          {view === 'home' ? <X className="w-4 h-4" /> : <ArrowLeft className="w-4 h-4" />}
        </button>
        <div className="min-w-0 flex-1">
          <h1 className="text-lg font-black text-white font-clash truncate">Transfer</h1>
          <p className="text-[0.72rem] font-medium uppercase tracking-[0.08em] text-white">
            {view === 'home'
              ? 'Import · Export'
              : view === 'pick-kind'
                ? `${direction === 'import' ? 'Import' : 'Export'} · Choose type`
                : view === 'export-format'
                  ? `Export · ${dataKind === 'totp' ? 'Smart codes' : dataKind === 'secrets' ? 'Secrets' : 'Mixed'}`
                  : view === 'import' || view === 'preview'
                    ? `Import · ${dataKind === 'auto' ? 'Auto' : dataKind === 'totp' ? 'Smart codes' : dataKind === 'secrets' ? 'Secrets' : 'Mixed'}`
                    : 'Import · Export'}
          </p>
        </div>
        {view !== 'home' ? (
          <button
            type="button"
            onClick={requestLeaveFlow}
            className="px-3 py-2 rounded-xl bg-black border border-white/20 text-white text-xs font-bold font-clash hover:border-white/40"
          >
            Cancel
          </button>
        ) : (
          <ArrowUpDown className="w-5 h-5 text-white shrink-0" />
        )}
      </header>

      <div className="flex-1 min-h-0 overflow-y-auto px-5 py-5 flex flex-col gap-4 font-satoshi">
        {error && (
          <div className="rounded-2xl border border-white/20 bg-black px-4 py-3 text-sm font-bold text-white">
            {error}
          </div>
        )}

        {view === 'home' && (
          <>
            {cachedSession && (
              <button
                type="button"
                onClick={() => void resumeCachedSession()}
                disabled={busy}
                className="w-full text-left rounded-2xl border border-[#10B981]/40 bg-black px-5 py-4 space-y-3 hover:border-[#10B981] transition-colors disabled:opacity-50"
              >
                <div>
                  <p className="text-[0.72rem] font-medium uppercase tracking-[0.08em] text-white">
                    In progress
                  </p>
                  <p className="text-base font-black text-white font-clash mt-1">
                    {cachedSession.direction === 'import' ? 'Import' : 'Export'} ·{' '}
                    {kindLabel(cachedSession.dataKind)}
                  </p>
                  <p className="text-sm font-medium text-white mt-1">
                    {cachedSession.direction === 'import'
                      ? draftHasImportPreview(cachedSession)
                        ? `${(cachedSession.result?.credentials?.length || 0) + (cachedSession.result?.totpSecrets?.length || 0)} item(s) ready to review`
                        : 'Started — pick up where you left off'
                      : `Backup as ${cachedSession.exportFormat === 'encrypted-html' ? 'locked HTML' : 'JSON'}`}
                    {cachedSession.fileName ? ` · ${cachedSession.fileName}` : ''}
                  </p>
                  <p className="text-[0.72rem] font-medium uppercase tracking-[0.08em] text-[#10B981] mt-2">
                    {busy ? 'Opening…' : 'Tap to open details'}
                  </p>
                </div>
                <div className="flex gap-2">
                  <span className="flex-1 py-2.5 rounded-xl font-bold bg-[#10B981] text-black font-clash text-center">
                    Open details
                  </span>
                  <span
                    role="button"
                    tabIndex={0}
                    onClick={(e) => {
                      e.preventDefault();
                      e.stopPropagation();
                      requestLeaveFlow();
                    }}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter' || e.key === ' ') {
                        e.preventDefault();
                        e.stopPropagation();
                        requestLeaveFlow();
                      }
                    }}
                    className="flex-1 py-2.5 rounded-xl font-bold bg-black border border-white/20 text-white font-clash text-center cursor-pointer"
                  >
                    Cancel
                  </span>
                </div>
              </button>
            )}

            <button
              type="button"
              onClick={() => startDirection('import')}
              className="w-full text-left rounded-2xl border border-white/20 bg-black px-5 py-5 hover:border-white/40 transition-colors"
            >
              <div className="flex items-center gap-3 mb-2">
                <span className="w-10 h-10 rounded-xl bg-[#161412] border border-white/20 flex items-center justify-center">
                  <Upload className="w-5 h-5 text-[#10B981]" />
                </span>
                <span className="text-base font-black text-white font-clash">Import</span>
              </div>
              <p className="text-sm font-medium text-white">
                Bring secrets or smart codes in from a file or paste.
              </p>
            </button>

            <button
              type="button"
              onClick={() => startDirection('export')}
              className="w-full text-left rounded-2xl border border-white/20 bg-black px-5 py-5 hover:border-white/40 transition-colors"
            >
              <div className="flex items-center gap-3 mb-2">
                <span className="w-10 h-10 rounded-xl bg-[#161412] border border-white/20 flex items-center justify-center">
                  <Download className="w-5 h-5 text-[#10B981]" />
                </span>
                <span className="text-base font-black text-white font-clash">Export</span>
              </div>
              <p className="text-sm font-medium text-white">
                Download a backup of secrets, smart codes, or both.
              </p>
            </button>
          </>
        )}

        {view === 'pick-kind' && (
          <>
            <p className="text-sm font-medium text-white">
              What are you {direction === 'import' ? 'importing' : 'exporting'}?
            </p>
            {visibleKinds.map((opt) => (
              <button
                key={opt.id}
                type="button"
                onClick={() => confirmKindPick(opt.id)}
                className={`w-full text-left rounded-2xl border px-5 py-4 transition-colors ${
                  dataKind === opt.id
                    ? 'border-[#10B981] bg-black'
                    : 'border-white/20 bg-black hover:border-white/40'
                }`}
              >
                <div className="flex items-center gap-3">
                  <span className="w-10 h-10 rounded-xl bg-[#161412] border border-white/20 flex items-center justify-center shrink-0">
                    {kindIcon(opt.icon)}
                  </span>
                  <div className="min-w-0">
                    <p className="text-base font-black text-white font-clash">{opt.label}</p>
                    <p className="text-[0.72rem] font-medium uppercase tracking-[0.08em] text-white">
                      {opt.blurb}
                    </p>
                  </div>
                </div>
              </button>
            ))}
          </>
        )}

        {view === 'import' && (
          <>
            <input
              ref={fileRef}
              type="file"
              accept=".json,.csv,.txt,.env,.html,text/*,application/json"
              className="hidden"
              onChange={(e) => void onFile(e.target.files?.[0] || null)}
            />
            <button
              type="button"
              onClick={() => fileRef.current?.click()}
              disabled={busy}
              className="w-full rounded-2xl border-2 border-dashed border-white/25 bg-black px-5 py-10 text-center hover:border-[#10B981] transition-colors disabled:opacity-50"
            >
              <Upload className="w-8 h-8 text-white mx-auto mb-3" />
              <p className="text-sm font-black text-white font-clash">
                {busy ? 'Reading…' : 'Drop or choose a file'}
              </p>
              <p className="text-[0.72rem] font-medium uppercase tracking-[0.08em] text-white mt-2">
                Bitwarden · Kylrix · Authenticator · CSV · .env · otpauth
              </p>
            </button>

            <div className="rounded-2xl border border-white/20 bg-black overflow-hidden">
              <div className="px-4 py-3 border-b border-white/20">
                <p className="text-[0.72rem] font-medium uppercase tracking-[0.08em] text-white">
                  Or paste
                </p>
              </div>
              <textarea
                value={rawText}
                onChange={(e) => {
                  const next = e.target.value;
                  setRawText(next);
                  if (next.trim().length >= 8) scheduleDiscernFromPaste(next);
                }}
                onPaste={(e) => {
                  const pasted = e.clipboardData.getData('text');
                  if (!pasted?.trim()) return;
                  e.preventDefault();
                  const el = e.currentTarget;
                  const start = el.selectionStart ?? rawText.length;
                  const end = el.selectionEnd ?? rawText.length;
                  const next = rawText.slice(0, start) + pasted + rawText.slice(end);
                  setRawText(next);
                  scheduleDiscernFromPaste(next);
                }}
                placeholder="Paste JSON, CSV, otpauth links, or KEY=VALUE env lines…"
                className="w-full min-h-[160px] bg-black px-4 py-3 text-sm text-white outline-none resize-y font-satoshi"
              />
            </div>

            {busy && <p className="text-sm font-bold text-white">Checking file…</p>}
          </>
        )}

        {view === 'preview' && discerned && (
          <>
            <div className="rounded-2xl border border-white/20 bg-black px-5 py-4">
              <div className="flex items-center gap-2 mb-1">
                <CheckCircle2 className="w-4 h-4 text-[#10B981]" />
                <p className="text-base font-black text-white font-clash">{discerned.label}</p>
              </div>
              <p className="text-sm font-medium text-white">{discerned.summary}</p>
              {fileName && (
                <p className="text-[0.72rem] font-medium uppercase tracking-[0.08em] text-white mt-2">
                  {fileName}
                </p>
              )}
            </div>

            <div className="grid grid-cols-3 gap-3">
              <StatTile icon={<Lock className="w-4 h-4" />} label="Secrets" value={counts.secrets} />
              <StatTile icon={<KeyRound className="w-4 h-4" />} label="Codes" value={counts.totp} />
              <StatTile icon={<FileCode2 className="w-4 h-4" />} label="Workspaces" value={counts.workspaces} />
            </div>

            {counts.skipped > 0 && (
              <p className="text-sm font-medium text-white">
                {counts.skipped} item{counts.skipped === 1 ? '' : 's'} will be skipped (already
                present or unreadable).
              </p>
            )}

            {discerned.warnings.length > 0 && (
              <ul className="rounded-2xl border border-white/20 bg-black px-4 py-3 space-y-1">
                {discerned.warnings.map((w) => (
                  <li key={w} className="text-sm font-medium text-white">
                    {w}
                  </li>
                ))}
              </ul>
            )}

            <div className="rounded-2xl border border-white/20 bg-black max-h-[240px] overflow-y-auto divide-y divide-white/10">
              {discerned.credentials.slice(0, 40).map((c, i) => {
                const disabled = c._status === 'duplicate' || c._status === 'invalid';
                return (
                  <div
                    key={`c-${i}`}
                    className={`px-4 py-3 flex items-center gap-3 ${disabled ? 'opacity-40' : ''}`}
                  >
                    <Lock className="w-3.5 h-3.5 text-white shrink-0" />
                    <div className="min-w-0 flex-1">
                      <p className="text-sm font-bold text-white truncate">{c.name}</p>
                      <p className="text-[0.72rem] font-medium uppercase tracking-[0.08em] text-white truncate">
                        {disabled
                          ? c._skipReason ||
                            (c._status === 'duplicate' ? 'Already in vault' : "Can't import")
                          : c.isEnv
                            ? 'Env bundle'
                            : c.username || c.url || 'Secret'}
                      </p>
                    </div>
                  </div>
                );
              })}
              {discerned.totpSecrets.slice(0, 40).map((t, i) => {
                const disabled = t._status === 'duplicate' || t._status === 'invalid';
                return (
                  <div
                    key={`t-${i}`}
                    className={`px-4 py-3 flex items-center gap-3 ${disabled ? 'opacity-40' : ''}`}
                  >
                    <KeyRound className="w-3.5 h-3.5 text-white shrink-0" />
                    <div className="min-w-0 flex-1">
                      <p className="text-sm font-bold text-white truncate">
                        {t.issuer} · {t.accountName}
                      </p>
                      <p className="text-[0.72rem] font-medium uppercase tracking-[0.08em] text-white truncate">
                        {disabled
                          ? t._skipReason ||
                            (t._status === 'duplicate' ? 'Already in vault' : "Can't import")
                          : 'Smart code'}
                      </p>
                    </div>
                  </div>
                );
              })}
              {counts.secrets + counts.totp > 80 && (
                <p className="px-4 py-3 text-[0.72rem] font-medium uppercase tracking-[0.08em] text-white">
                  +{counts.secrets + counts.totp - 80} more in batch
                </p>
              )}
            </div>

            {progressMsg && <p className="text-sm font-bold text-white">{progressMsg}</p>}

            <button
              type="button"
              disabled={busy}
              onClick={() => {
                if (counts.importable === 0) {
                  void endFlowAndClose();
                  return;
                }
                setConfirmKind('import');
              }}
              className="w-full py-3 rounded-xl font-bold bg-[#10B981] text-black disabled:opacity-50 font-clash"
            >
              {counts.importable === 0
                ? 'Nothing new to import'
                : `Continue · ${counts.importable} new item${counts.importable === 1 ? '' : 's'}`}
            </button>
          </>
        )}

        {view === 'export-format' && (
          <>
            <div className="rounded-2xl border border-white/20 bg-black px-4 py-3">
              <p className="text-[0.72rem] font-medium uppercase tracking-[0.08em] text-white">
                Exporting
              </p>
              <p className="text-sm font-black text-white font-clash mt-1">
                {dataKind === 'secrets'
                  ? 'Secrets only'
                  : dataKind === 'totp'
                    ? 'Smart codes only'
                    : 'Secrets + smart codes'}
              </p>
            </div>

            <p className="text-sm font-medium text-white">File format</p>
            <div className="rounded-2xl border border-white/20 bg-black p-1 flex gap-1">
              <button
                type="button"
                onClick={() => {
                  setExportFormat('json');
                  void persistSession({ direction: 'export', dataKind, exportFormat: 'json' });
                }}
                className={`flex-1 py-2.5 rounded-xl text-xs font-black transition-colors ${
                  exportFormat === 'json' ? 'bg-[#10B981] text-black' : 'text-white'
                }`}
              >
                JSON
              </button>
              <button
                type="button"
                onClick={() => {
                  setExportFormat('encrypted-html');
                  void persistSession({
                    direction: 'export',
                    dataKind,
                    exportFormat: 'encrypted-html',
                  });
                }}
                className={`flex-1 py-2.5 rounded-xl text-xs font-black transition-colors ${
                  exportFormat === 'encrypted-html' ? 'bg-[#10B981] text-black' : 'text-white'
                }`}
              >
                Locked HTML
              </button>
            </div>

            {exportFormat === 'encrypted-html' && (
              <>
                <input
                  type="password"
                  value={exportPassword}
                  onChange={(e) => setExportPassword(e.target.value)}
                  placeholder="File unlock password"
                  className="w-full rounded-xl border border-white/20 bg-black px-4 py-3 text-sm text-white outline-none"
                />
                <label className="flex items-center gap-3 rounded-xl border border-white/20 bg-black px-4 py-3 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={lockWithPasskey}
                    onChange={(e) => setLockWithPasskey(e.target.checked)}
                    className="accent-[#10B981]"
                  />
                  <span className="text-sm font-medium text-white">
                    Also allow passkey unlock in the HTML file
                  </span>
                </label>
              </>
            )}

            <p className="text-sm font-medium text-white">
              JSON downloads readable plaintext. Locked HTML opens with a confirm-access screen
              (password and optional passkey).
            </p>

            <button
              type="button"
              disabled={busy || (exportFormat === 'encrypted-html' && !exportPassword.trim())}
              onClick={() => setConfirmKind('export')}
              className="w-full py-3 rounded-xl font-bold bg-[#10B981] text-black disabled:opacity-50 font-clash"
            >
              Continue to download
            </button>
          </>
        )}
      </div>

      {confirmDrawer}
    </div>
  );
}

function StatTile({
  icon,
  label,
  value,
}: {
  icon: React.ReactNode;
  label: string;
  value: number;
}) {
  return (
    <div className="rounded-2xl border border-white/20 bg-black px-3 py-4 text-center">
      <div className="flex justify-center text-white mb-2">{icon}</div>
      <p className="text-xl font-black text-white font-clash">{value}</p>
      <p className="text-[0.72rem] font-medium uppercase tracking-[0.08em] text-white">{label}</p>
    </div>
  );
}

function downloadBlob(content: string, filename: string, mime: string) {
  const blob = new Blob([content], { type: mime });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

EcosystemPorter.displayName = 'EcosystemPorter';
