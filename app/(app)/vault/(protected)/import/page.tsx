"use client";

import { useState } from 'react';
import {
  Upload,
  Download,
  FileText,
  Shield,
  Info,
  CheckCircle2,
  AlertTriangle,
  Key,
  Folder,
} from 'lucide-react';
import { useAppwriteVault } from '@/context/appwrite-context';
import { validateBitwardenExport } from '@/utils/import/bitwarden-mapper';
import { useBackgroundTask } from '@/context/BackgroundTaskContext';
import { ImportPreviewModal } from '@/components/import/ImportPreviewModal';
import { ImportItem } from '@/lib/import/deduplication';
import { analyzeBitwardenExport } from '@/utils/import/bitwarden-mapper';
import { masterPassCrypto } from '@/lib/masterpass-crypto';
import { porterExport, downloadExportAsFile } from '@/lib/data-porter';
import toast from 'react-hot-toast';
import { useSudo } from '@/context/SudoContext';

export default function ImportPage() {
  const { user } = useAppwriteVault();
  const { requestSudo } = useSudo();
  const { startImport, isImporting: globalImporting } = useBackgroundTask();
  const [importType, setImportType] = useState<string>("bitwarden");
  const [file, setFile] = useState<File | null>(null);
  const [errorState, setErrorState] = useState<string | null>(null);
  const [isExporting, setIsExporting] = useState(false);

  const [isPreviewOpen, setIsPreviewOpen] = useState(false);
  const [previewItems, setPreviewItems] = useState<ImportItem[]>([]);

  const handleExport = async () => {
    if (!user) return;
    requestSudo({
      onSuccess: async () => {
        setIsExporting(true);
        try {
          const result = await porterExport(user.$id);
          downloadExportAsFile(result.data);
          toast.success(`Exported ${result.data?.credentials?.length || 0} credentials, ${result.data?.totpSecrets?.length || 0} TOTP secrets`);
        } catch (err: unknown) {
          console.error('Export failed:', err);
          toast.error('Export failed: ' + ((err as Error).message || 'Unknown error'));
        } finally {
          setIsExporting(false);
        }
      }
    });
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setFile(e.target.files?.[0] || null);
    setErrorState(null);
  };

  const parseAndPreview = async (file: File) => {
    try {
      const text = await file.text();
      let items: ImportItem[] = [];

      if (importType === "bitwarden") {
        const data = JSON.parse(text);
        if (!validateBitwardenExport(data)) throw new Error("Invalid Bitwarden format");
        const mapped = analyzeBitwardenExport(data, user?.$id || "");
        items = mapped.credentials.map(c => ({
          ...c,
          _status: 'new'
        }));
      } else if (importType === "kylrixvault") {
        const data = JSON.parse(text);
        if (!data.version && !data.credentials) throw new Error("Invalid Kylrix Vault format");
        items = (data.credentials || []).map((c: unknown) => ({
          ...(c as Partial<ImportItem>),
          _status: 'new'
        }));
      } else {
        throw new Error("Preview not supported for this format yet");
      }

      if (items.length === 0) {
        throw new Error("No items found in file");
      }

      setPreviewItems(items);
      setIsPreviewOpen(true);
    } catch (error: unknown) {
      throw error;
    }
  };

  const handleImportClick = async () => {
    if (!user) {
      setErrorState("You must be logged in to import data.");
      return;
    }
    if (!file) {
      setErrorState("Please select a file to import.");
      return;
    }
    if (globalImporting) {
      setErrorState("An import is already in progress.");
      return;
    }
    setErrorState(null);
    try {
      await parseAndPreview(file);
    } catch (error: unknown) {
      const errorMessage = error instanceof Error ? error.message : "Import failed.";
      setErrorState(errorMessage);
    }
  };

  const handleFinalImport = (finalItems: ImportItem[]) => {
    requestSudo({
      onSuccess: () => {
        setIsPreviewOpen(false);
        const processedPayload = JSON.stringify({
          version: 1,
          credentials: finalItems,
          folders: [],
          totpSecrets: []
        });
        startImport("kylrixvault", processedPayload, user!.$id);
      }
    });
  };

  const isFileValid =
    file &&
    ((importType === "bitwarden" && file.name.endsWith(".json")) ||
      (importType === "kylrixvault" && file.name.endsWith(".json")) ||
      (importType === "json" && file.name.endsWith(".json")) ||
      (!["bitwarden", "json", "kylrixvault"].includes(importType) &&
        file.name.endsWith(".csv")));

  return (
    <div className="max-w-6xl mx-auto px-4 py-6 md:py-10">
      <div className="mb-8">
        <h1 className="text-3xl md:text-4xl font-black font-space-grotesk tracking-tight text-white mb-2">
          Import Data
        </h1>
        <p className="text-sm font-medium text-white/50">
          Migrate your passwords and data from other password managers securely.
        </p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
        <div className="lg:col-span-7 flex flex-col gap-6">
          <div className="p-6 md:p-8 rounded-[28px] bg-[#0a0a0a]/90 backdrop-blur-2xl border border-white/10 flex flex-col gap-6">
            {/* Source Manager Toggle */}
            <div className="flex flex-col gap-2.5">
              <label className="text-xs font-bold text-white/40 uppercase tracking-wider">
                Source Manager
              </label>
              <div className="grid grid-cols-2 gap-3">
                {[
                  { id: "bitwarden", label: "Bitwarden", disabled: false },
                  { id: "kylrixvault", label: "Kylrix Vault", disabled: false },
                  { id: "zoho", label: "Zoho Vault", disabled: true },
                  { id: "proton", label: "Proton Pass", disabled: true },
                ].map((btn) => (
                  <button
                    key={btn.id}
                    type="button"
                    disabled={btn.disabled}
                    onClick={() => !btn.disabled && setImportType(btn.id)}
                    className={`py-3 rounded-xl font-bold transition border text-center text-sm ${
                      btn.disabled
                        ? "opacity-35 cursor-not-allowed border-white/5 text-white/30"
                        : importType === btn.id
                        ? "bg-[#6366F1]/10 text-[#6366F1] border-[#6366F1]"
                        : "text-white/50 border-white/10 hover:text-white hover:border-white/30"
                    }`}
                  >
                    {btn.label}
                  </button>
                ))}
              </div>
            </div>

            {/* Instruction box */}
            <div className="p-4 rounded-2xl bg-white/3 border border-white/5 flex gap-3 items-start">
              <Info className="w-5 h-5 flex-shrink-0 text-[#6366F1] mt-0.5" />
              <div>
                <h4 className="text-sm font-extrabold text-white mb-1">
                  {importType === "bitwarden" ? "How to export from Bitwarden" : "Restoring from Kylrix Note"}
                </h4>
                <p className="text-xs text-white/60 leading-relaxed">
                  {importType === "bitwarden" ? (
                    "Log into your Bitwarden web vault, go to Tools → Export Vault, select JSON format, and download the file."
                  ) : (
                    "Upload a JSON backup file previously exported from Kylrix Note or Kylrix Vault."
                  )}
                </p>
              </div>
            </div>

            {/* Upload Zone */}
            <div className="flex flex-col gap-2.5">
              <label className="text-xs font-bold text-white/40 uppercase tracking-wider">
                Select File
              </label>
              <label className="flex flex-col items-center justify-center p-8 rounded-2xl border-2 border-dashed border-white/10 bg-white/1 hover:bg-white/3 hover:border-[#6366F1]/30 cursor-pointer transition">
                <input type="file" hidden onChange={handleFileChange} accept=".json" />
                <Upload className="w-8 h-8 text-white/20 mb-3" />
                <span className="text-sm font-bold text-white mb-1">
                  {file ? file.name : "Click to upload or drag and drop"}
                </span>
                <span className="text-xs text-white/40">
                  {file ? `${(file.size / 1024).toFixed(1)} KB` : "JSON files only"}
                </span>
              </label>
            </div>

            {/* Submit button */}
            <button
              type="button"
              onClick={handleImportClick}
              disabled={globalImporting || !isFileValid}
              className="w-full py-3 rounded-2xl font-extrabold bg-[#6366F1] text-black hover:bg-[#00D1DA] disabled:bg-white/10 disabled:text-white/30 transition text-sm"
            >
              {globalImporting ? "Import in Progress..." : "Preview & Import"}
            </button>

            {errorState && (
              <div className="flex gap-3 p-4 rounded-2xl bg-red-500/10 border border-red-500/20 text-red-200 text-sm">
                <AlertTriangle className="w-5 h-5 flex-shrink-0 text-red-400" />
                <span>{errorState}</span>
              </div>
            )}
          </div>

          {!globalImporting && (
            <div className="p-5 rounded-3xl bg-white/2 border border-white/5 flex flex-col gap-3">
              <div className="flex gap-2 items-center text-[#FFB000]">
                <AlertTriangle className="w-4.5 h-4.5" />
                <h4 className="text-sm font-extrabold text-white">Important Notes</h4>
              </div>
              <ul className="flex flex-col gap-2">
                {[
                  "Please stay connected to the internet during import.",
                  "A floating widget will show real-time progress.",
                  "Your data is encrypted locally with your master password.",
                  "Folders and organization will be preserved."
                ].map((note, i) => (
                  <li key={i} className="flex gap-2.5 items-start">
                    <span className="w-1 h-1 rounded-full bg-white/30 mt-2 flex-shrink-0" />
                    <span className="text-xs font-medium text-white/50">{note}</span>
                  </li>
                ))}
              </ul>
            </div>
          )}

          {/* Export Section */}
          <div className="p-6 md:p-8 rounded-[28px] bg-[#0a0a0a]/90 backdrop-blur-2xl border border-white/10 flex flex-col gap-4">
            <div>
              <h3 className="text-xl font-black font-space-grotesk text-white mb-1">
                Export Vault
              </h3>
              <p className="text-sm font-medium text-white/50">
                Download all your vault data as a Kylrix Vault JSON file. This export can be re-imported into any Kylrix instance.
              </p>
            </div>
            <button
              type="button"
              onClick={handleExport}
              disabled={isExporting || !user}
              className="w-full flex items-center justify-center gap-2 py-3 rounded-2xl font-extrabold border border-white/15 text-white hover:border-[#6366F1] hover:bg-[#6366F1]/5 disabled:border-white/5 disabled:text-white/30 transition text-sm"
            >
              <Download className="w-4 h-4" />
              <span>{isExporting ? 'Exporting...' : 'Export as Kylrix Vault JSON'}</span>
            </button>
          </div>
        </div>

        {/* Sidebar Info */}
        <div className="lg:col-span-5">
          <div className="p-6 md:p-8 rounded-[28px] bg-[#0a0a0a]/90 border border-white/10 h-full flex flex-col gap-6">
            <h3 className="text-xl font-black font-space-grotesk text-white">
              What gets imported?
            </h3>
            <ul className="flex flex-col gap-4">
              {[
                { title: "Login Credentials", desc: "Usernames, passwords, URLs, and notes", icon: Key },
                { title: "TOTP Secrets", desc: "Two-factor authentication codes", icon: Shield },
                { title: "Folders", desc: "Your existing organization structure", icon: Folder },
                { title: "Custom Fields", desc: "Additional metadata and fields", icon: FileText }
              ].map((item, i) => (
                <li key={i} className="flex items-center justify-between gap-4 py-1">
                  <div className="flex items-center gap-3.5 min-w-0 flex-1">
                    <div className="w-9 h-9 rounded-xl bg-[#6366F1]/5 flex items-center justify-center flex-shrink-0">
                      <item.icon className="w-4.5 h-4.5 text-[#6366F1]" />
                    </div>
                    <div className="flex-1 min-w-0 flex flex-col">
                      <span className="text-sm font-extrabold text-white truncate">{item.title}</span>
                      <span className="text-xs text-white/40 truncate">{item.desc}</span>
                    </div>
                  </div>
                  <CheckCircle2 className="w-4 h-4 text-[#10B981] flex-shrink-0" />
                </li>
              ))}
            </ul>
          </div>
        </div>
      </div>

      {isPreviewOpen && (
        <ImportPreviewModal
          isOpen={isPreviewOpen}
          onClose={() => setIsPreviewOpen(false)}
          rawItems={previewItems}
          onConfirm={handleFinalImport}
        />
      )}
    </div>
  );
}
