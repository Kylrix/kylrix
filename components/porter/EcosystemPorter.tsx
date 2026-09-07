'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
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
  cachePorterDraft,
  clearPorterDraft,
  discernImportPayload,
  exportVaultPlaintext,
  loadPorterDraft,
  type PorterDiscernResult,
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

function filterDiscerned(
  result: PorterDiscernResult,
  kind: PorterDataKind,
): PorterDiscernResult {
  if (kind === 'auto' || kind === 'mixed') return result;
  if (kind === 'secrets') {
    return {
      ...result,
      totpSecrets: [],
      summary: result.credentials.length
        ? `${result.credentials.length} secret${result.credentials.length === 1 ? '' : 's'}`
        : 'No secrets in this file for the Secrets filter',
      warnings: [
        ...result.warnings,
        ...(result.totpSecrets.length
          ? [`Hid ${result.totpSecrets.length} smart code(s) — Secrets selected.`]
          : []),
      ],
    };
  }
  return {
    ...result,
    credentials: [],
    folders: [],
    summary: result.totpSecrets.length
      ? `${result.totpSecrets.length} smart code${result.totpSecrets.length === 1 ? '' : 's'}`
      : 'No smart codes in this file for the Codes filter',
    warnings: [
      ...result.warnings,
      ...(result.credentials.length
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

  const userId = user?.$id || '';

  const visibleKinds = useMemo(() => {
    const vaultSurface = surface === 'vault-secrets' || surface === 'vault-totp';
    return KIND_OPTIONS.filter((opt) => {
      if (opt.importOnly && direction === 'export') return false;
      // Vault always offers secrets + totp + mixed (+ auto on import)
      if (vaultSurface) return true;
      return true;
    });
  }, [direction, surface]);

  useEffect(() => {
    if (!userId) return;
    void (async () => {
      const draft = await loadPorterDraft(userId);
      if (draft?.result && (draft.result.credentials.length || draft.result.totpSecrets.length)) {
        setDiscerned(filterDiscerned(draft.result, dataKind));
        setDirection('import');
        setView('preview');
      }
    })();
    // Only hydrate draft once on mount / user change
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [userId]);

  const handleClose = useCallback(() => {
    onClose?.();
  }, [onClose]);

  const goBack = () => {
    setError(null);
    if (view === 'home') {
      handleClose();
      return;
    }
    if (view === 'pick-kind') {
      setView('home');
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

  const startDirection = (dir: PorterDirection) => {
    setDirection(dir);
    setError(null);
    setDiscerned(null);
    setRawText('');
    setFileName(null);
    if (dir === 'export' && dataKind === 'auto') {
      setDataKind(surface === 'vault-totp' ? 'totp' : surface === 'vault-secrets' ? 'secrets' : 'mixed');
    }
    setView('pick-kind');
  };

  const confirmKind = (kind: PorterDataKind) => {
    setDataKind(kind);
    setError(null);
    if (direction === 'import') setView('import');
    else setView('export-format');
  };

  const runDiscern = useCallback(
    async (text: string, name?: string | null) => {
      setError(null);
      setBusy(true);
      try {
        const raw = discernImportPayload(text, userId);
        const result = filterDiscerned(raw, dataKind);
        setDiscerned(result);
        setFileName(name || null);
        if (userId) await cachePorterDraft(userId, raw);
        if (result.credentials.length + result.totpSecrets.length + result.folders.length === 0) {
          setError(result.warnings[0] || 'Nothing matched the selected type.');
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
    [userId, dataKind],
  );

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

  const handleConfirmImport = () => {
    if (!discerned || !userId) return;
    requestSudo({
      onSuccess: () => {
        void (async () => {
          setBusy(true);
          setProgressMsg('Importing offline-first…');
          try {
            const result = await runOfflinePorterImport(discerned, userId, (msg, processed, total) =>
              setProgressMsg(total ? `${msg} (${processed}/${total})` : msg),
            );
            if (result.success) {
              toast.success(
                `Imported ${result.summary.credentialsCreated} secrets · ${result.summary.totpSecretsCreated} codes`,
              );
            } else {
              toast.error(result.errors[0] || 'Import finished with errors');
            }
            await clearPorterDraft(userId);
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

  const handleExport = () => {
    if (!userId) return;
    requestSudo({
      onSuccess: () => {
        void (async () => {
          setBusy(true);
          setError(null);
          try {
            // Always decrypt to plaintext before any download.
            let finalData = await exportVaultPlaintext(userId);
            const localVault = finalData.data.vault;
            const localEmpty =
              !(localVault.credentials?.length || localVault.totpSecrets?.length || localVault.folders?.length);

            if (localEmpty) {
              try {
                const result = await porterExport(userId);
                // Server payload may still be ciphertext — only use as last resort ids, then decrypt via plaintext path already failed empty
                const vault =
                  result.data.data?.vault ||
                  (result.data as any).vault || {
                    folders: result.data.folders || [],
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
              folders: [...(finalData?.data?.vault?.folders || [])],
              credentials: [...(finalData?.data?.vault?.credentials || [])],
              totpSecrets: [...(finalData?.data?.vault?.totpSecrets || [])],
            };
            if (dataKind === 'secrets') {
              vault.totpSecrets = [];
            } else if (dataKind === 'totp') {
              vault.credentials = [];
              vault.folders = [];
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
              // Optional passkey wrap (PRF) — password always works.
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
    if (!discerned) return { secrets: 0, totp: 0, folders: 0 };
    return {
      secrets: discerned.credentials.length,
      totp: discerned.totpSecrets.length,
      folders: discerned.folders.length,
    };
  }, [discerned]);

  const shellClass = embedded
    ? 'flex h-full min-h-0 w-full flex-col bg-[#161412] overflow-hidden'
    : 'flex h-[100dvh] max-h-[100dvh] w-full flex-col bg-[#161412] overflow-hidden';

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
            {view === 'pick-kind'
              ? `${direction === 'import' ? 'Import' : 'Export'} · Choose type`
              : view === 'export-format'
                ? `Export · ${dataKind === 'totp' ? 'Smart codes' : dataKind === 'secrets' ? 'Secrets' : 'Mixed'}`
                : view === 'import' || view === 'preview'
                  ? `Import · ${dataKind === 'auto' ? 'Auto' : dataKind === 'totp' ? 'Smart codes' : dataKind === 'secrets' ? 'Secrets' : 'Mixed'}`
                  : 'Import · Export · Offline-first'}
          </p>
        </div>
        <ArrowUpDown className="w-5 h-5 text-white shrink-0" />
      </header>

      <div className="flex-1 min-h-0 overflow-y-auto px-5 py-5 flex flex-col gap-4 font-satoshi">
        {error && (
          <div className="rounded-2xl border border-white/20 bg-black px-4 py-3 text-sm font-bold text-white">
            {error}
          </div>
        )}

        {view === 'home' && (
          <>
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
                Choose what you are bringing in, then drop a file or paste.
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
                Choose secrets, smart codes, or both — then download.
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
                onClick={() => confirmKind(opt.id)}
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
                onChange={(e) => setRawText(e.target.value)}
                placeholder="Paste JSON, CSV, otpauth links, or KEY=VALUE env lines…"
                className="w-full min-h-[160px] bg-black px-4 py-3 text-sm text-white outline-none resize-y font-satoshi"
              />
            </div>

            <button
              type="button"
              disabled={busy || !rawText.trim()}
              onClick={() => void runDiscern(rawText)}
              className="w-full py-3 rounded-xl font-bold bg-[#10B981] text-black disabled:opacity-50 font-clash"
            >
              {busy ? 'Understanding…' : 'Detect & preview'}
            </button>
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
              <p className="text-[0.72rem] font-medium uppercase tracking-[0.08em] text-white mt-1">
                Confidence {Math.round(discerned.confidence * 100)}%
              </p>
            </div>

            <div className="grid grid-cols-3 gap-3">
              <StatTile icon={<Lock className="w-4 h-4" />} label="Secrets" value={counts.secrets} />
              <StatTile icon={<KeyRound className="w-4 h-4" />} label="Codes" value={counts.totp} />
              <StatTile icon={<FileCode2 className="w-4 h-4" />} label="Folders" value={counts.folders} />
            </div>

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
              {discerned.credentials.slice(0, 40).map((c, i) => (
                <div key={`c-${i}`} className="px-4 py-3 flex items-center gap-3">
                  <Lock className="w-3.5 h-3.5 text-white shrink-0" />
                  <div className="min-w-0">
                    <p className="text-sm font-bold text-white truncate">{c.name}</p>
                    <p className="text-[0.72rem] font-medium uppercase tracking-[0.08em] text-white truncate">
                      {c.isEnv ? 'Env bundle' : c.username || c.url || 'Secret'}
                    </p>
                  </div>
                </div>
              ))}
              {discerned.totpSecrets.slice(0, 40).map((t, i) => (
                <div key={`t-${i}`} className="px-4 py-3 flex items-center gap-3">
                  <KeyRound className="w-3.5 h-3.5 text-white shrink-0" />
                  <div className="min-w-0">
                    <p className="text-sm font-bold text-white truncate">
                      {t.issuer} · {t.accountName}
                    </p>
                    <p className="text-[0.72rem] font-medium uppercase tracking-[0.08em] text-white truncate">
                      Smart code
                    </p>
                  </div>
                </div>
              ))}
              {counts.secrets + counts.totp > 80 && (
                <p className="px-4 py-3 text-[0.72rem] font-medium uppercase tracking-[0.08em] text-white">
                  +{counts.secrets + counts.totp - 80} more in batch
                </p>
              )}
            </div>

            {progressMsg && (
              <p className="text-sm font-bold text-white">{progressMsg}</p>
            )}

            <button
              type="button"
              disabled={busy || counts.secrets + counts.totp + counts.folders === 0}
              onClick={handleConfirmImport}
              className="w-full py-3 rounded-xl font-bold bg-[#10B981] text-black disabled:opacity-50 font-clash"
            >
              {busy
                ? 'Importing…'
                : `Import ${counts.secrets + counts.totp + counts.folders} items`}
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
                onClick={() => setExportFormat('json')}
                className={`flex-1 py-2.5 rounded-xl text-xs font-black transition-colors ${
                  exportFormat === 'json' ? 'bg-[#10B981] text-black' : 'text-white'
                }`}
              >
                JSON
              </button>
              <button
                type="button"
                onClick={() => setExportFormat('encrypted-html')}
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
              disabled={busy}
              onClick={handleExport}
              className="w-full py-3 rounded-xl font-bold bg-[#10B981] text-black disabled:opacity-50 font-clash"
            >
              {busy ? 'Preparing…' : 'Download backup'}
            </button>
          </>
        )}
      </div>
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
