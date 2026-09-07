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
  exportVaultOffline,
  loadPorterDraft,
  type PorterDiscernResult,
} from '@/lib/porter';
import { runOfflinePorterImport } from '@/lib/porter/offline';
import { encryptExportData, generateEncryptedHtmlPage } from '@/utils/import/encrypted-html-exporter';
import { porterExport } from '@/lib/data-porter';

type PorterView = 'home' | 'import' | 'preview' | 'export';

export type EcosystemPorterProps = {
  onClose?: () => void;
  /** Desktop sidebar embeds without outer chrome chrome */
  embedded?: boolean;
  onImported?: () => void;
  /** Marker for Overlay / sidebar fullscreen detection */
  'data-porter'?: boolean;
};

export default function EcosystemPorter({
  onClose,
  embedded = false,
  onImported,
  'data-porter': _porterMarker = true,
}: EcosystemPorterProps) {
  const { user } = useAppwriteVault();
  const { requestSudo } = useSudo();
  const fileRef = useRef<HTMLInputElement>(null);

  const [view, setView] = useState<PorterView>('home');
  const [rawText, setRawText] = useState('');
  const [fileName, setFileName] = useState<string | null>(null);
  const [discerned, setDiscerned] = useState<PorterDiscernResult | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [exportFormat, setExportFormat] = useState<'json' | 'encrypted-html'>('json');
  const [exportPassword, setExportPassword] = useState('');
  const [progressMsg, setProgressMsg] = useState<string | null>(null);

  const userId = user?.$id || '';

  useEffect(() => {
    if (!userId) return;
    void (async () => {
      const draft = await loadPorterDraft(userId);
      if (draft?.result && (draft.result.credentials.length || draft.result.totpSecrets.length)) {
        setDiscerned(draft.result);
        setView('preview');
      }
    })();
  }, [userId]);

  const handleClose = useCallback(() => {
    onClose?.();
  }, [onClose]);

  const runDiscern = useCallback(
    async (text: string, name?: string | null) => {
      setError(null);
      setBusy(true);
      try {
        const result = discernImportPayload(text, userId);
        setDiscerned(result);
        setFileName(name || null);
        if (userId) await cachePorterDraft(userId, result);
        if (result.credentials.length + result.totpSecrets.length + result.folders.length === 0) {
          setError(result.warnings[0] || 'Nothing recognized.');
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
    [userId],
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
            let finalData: any;
            try {
              const result = await porterExport(userId);
              finalData = {
                version: 2,
                format: 'kylrix-vault',
                exportedAt: new Date().toISOString(),
                userId,
                data: {
                  vault:
                    result.data.data?.vault ||
                    (result.data as any).vault || {
                      folders: result.data.folders || [],
                      credentials: result.data.credentials || [],
                      totpSecrets: result.data.totpSecrets || [],
                    },
                },
              };
            } catch {
              finalData = await exportVaultOffline(userId);
            }

            const jsonString = JSON.stringify(finalData, null, 2);

            if (exportFormat === 'encrypted-html') {
              if (!exportPassword.trim()) {
                setError('Enter a password to lock the export file.');
                setBusy(false);
                return;
              }
              const encrypted = await encryptExportData(jsonString, exportPassword);
              const htmlPage = generateEncryptedHtmlPage(
                encrypted.ciphertext,
                encrypted.salt,
                encrypted.iv,
                user?.email || 'Kylrix User',
              );
              downloadBlob(htmlPage, 'kylrix-vault-backup-encrypted.html', 'text/html');
            } else {
              downloadBlob(jsonString, 'kylrix-vault-backup.json', 'application/json');
            }
            toast.success('Export ready');
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
          onClick={() => {
            if (view === 'home') handleClose();
            else if (view === 'preview') setView('import');
            else setView('home');
          }}
          className="p-2 rounded-xl bg-black border border-white/20 text-white hover:border-white/40 transition-colors"
          aria-label="Back"
        >
          {view === 'home' ? <X className="w-4 h-4" /> : <ArrowLeft className="w-4 h-4" />}
        </button>
        <div className="min-w-0 flex-1">
          <h1 className="text-lg font-black text-white font-clash truncate">Transfer</h1>
          <p className="text-[0.72rem] font-medium uppercase tracking-[0.08em] text-white">
            Import · Export · Offline-first
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
              onClick={() => setView('import')}
              className="w-full text-left rounded-2xl border border-white/20 bg-black px-5 py-5 hover:border-white/40 transition-colors"
            >
              <div className="flex items-center gap-3 mb-2">
                <span className="w-10 h-10 rounded-xl bg-[#161412] border border-white/20 flex items-center justify-center">
                  <Upload className="w-5 h-5 text-[#10B981]" />
                </span>
                <span className="text-base font-black text-white font-clash">Import</span>
              </div>
              <p className="text-sm font-medium text-white">
                Drop a file or paste. We figure out secrets, smart codes, or both.
              </p>
            </button>

            <button
              type="button"
              onClick={() => setView('export')}
              className="w-full text-left rounded-2xl border border-white/20 bg-black px-5 py-5 hover:border-white/40 transition-colors"
            >
              <div className="flex items-center gap-3 mb-2">
                <span className="w-10 h-10 rounded-xl bg-[#161412] border border-white/20 flex items-center justify-center">
                  <Download className="w-5 h-5 text-[#10B981]" />
                </span>
                <span className="text-base font-black text-white font-clash">Export</span>
              </div>
              <p className="text-sm font-medium text-white">
                Download a vault backup — plain JSON or password-locked HTML.
              </p>
            </button>
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

        {view === 'export' && (
          <>
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
              <input
                type="password"
                value={exportPassword}
                onChange={(e) => setExportPassword(e.target.value)}
                placeholder="Export password"
                className="w-full rounded-xl border border-white/20 bg-black px-4 py-3 text-sm text-white outline-none"
              />
            )}

            <p className="text-sm font-medium text-white">
              Works offline from your local vault copy when the network is unavailable.
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
