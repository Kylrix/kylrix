"use client";

import { useState } from 'react';
import { Drawer } from '@/components/ui/Drawer';
import {
  Upload,
  Download,
  Key,
  Shield,
  Lock,
  ChevronRight,
  ArrowRight,
  Database,
  CheckCircle2,
  FileText,
  AlertTriangle,
  Info,
  Copy,
} from 'lucide-react';
import { useAppwriteVault } from '@/context/appwrite-context';
import { useBackgroundTask } from '@/context/BackgroundTaskContext';
import { validateBitwardenExport, analyzeBitwardenExport } from '@/utils/import/bitwarden-mapper';
import { parseCSV, detectColumnMapping, mapRowsToItems } from '@/utils/import/generic-parser';
import { encryptExportData, generateEncryptedHtmlPage } from '@/utils/import/encrypted-html-exporter';
import { porterExport } from '@/lib/data-porter';
import toast from 'react-hot-toast';
import { useSudo } from '@/context/SudoContext';

interface VaultPorterDrawerProps {
  isOpen: boolean;
  onClose: () => void;
}

type PorterMode = 'menu' | 'import-type' | 'import-vendor' | 'import-upload' | 'import-preview' | 'export-config' | 'export-encrypt';

export function VaultPorterDrawer({ isOpen, onClose }: VaultPorterDrawerProps) {
  const { user } = useAppwriteVault();
  const { startImport, isImporting } = useBackgroundTask();
  const { requestSudo } = useSudo();

  // Navigation state
  const [mode, setMode] = useState<PorterMode>('menu');
  const [importTarget, setImportTarget] = useState<'password' | 'totp' | null>(null);
  const [vendor, setVendor] = useState<'kylrixvault' | 'bitwarden' | 'google' | 'generic' | null>(null);

  // File/Import state
  const [file, setFile] = useState<File | null>(null);
  const [rawText, setRawText] = useState<string>('');
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [parsedItems, setParsedItems] = useState<any[]>([]);

  // Export State
  const [exportScope, setExportScope] = useState<'vault' | 'workspace'>('vault');
  const [exportFormat, setExportFormat] = useState<'json' | 'encrypted-html'>('json');
  const [exportPassword, setExportPassword] = useState<string>('');
  const [isExporting, setIsExporting] = useState(false);

  // Step Reset helpers
  const handleReset = () => {
    setMode('menu');
    setImportTarget(null);
    setVendor(null);
    setFile(null);
    setRawText('');
    setErrorMsg(null);
    setParsedItems([]);
    setExportPassword('');
  };

  const handleSelectImportTarget = (target: 'password' | 'totp') => {
    setImportTarget(target);
    setMode('import-vendor');
  };

  const handleSelectVendor = (selectedVendor: 'kylrixvault' | 'bitwarden' | 'google' | 'generic') => {
    if (selectedVendor === 'google') return; // Greyed out/coming soon
    setVendor(selectedVendor);
    setMode('import-upload');
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const selectedFile = e.target.files?.[0] || null;
    setFile(selectedFile);
    setErrorMsg(null);
  };

  const handleParseAndPreview = async () => {
    setErrorMsg(null);
    try {
      let items: any[] = [];

      if (vendor === 'generic') {
        const text = file ? await file.text() : rawText;
        if (!text.trim()) {
          throw new Error("Please upload a file or paste some data.");
        }
        const rows = parseCSV(text);
        if (rows.length === 0) {
          throw new Error("No readable CSV rows found.");
        }
        const mapping = detectColumnMapping(rows);
        const mapped = mapRowsToItems(rows, mapping, true);
        items = mapped;
      } else if (file) {
        const text = await file.text();
        const data = JSON.parse(text);

        if (vendor === 'bitwarden') {
          if (!validateBitwardenExport(data)) {
            throw new Error("Invalid Bitwarden JSON export format.");
          }
          const mapped = analyzeBitwardenExport(data, user?.$id || '');
          items = mapped.credentials.map(c => ({ ...c, _status: 'new' }));
        } else if (vendor === 'kylrixvault') {
          // Native kylrix structure (superset or subset)
          const targetData = data.data?.vault || data.vault || data;
          const credentials = targetData.credentials || [];
          const totps = targetData.totpSecrets || [];

          if (importTarget === 'password') {
            if (credentials.length === 0) {
              throw new Error("No password credentials found in Kylrix Vault file.");
            }
            items = credentials.map((c: any) => ({ ...c, _status: 'new' }));
          } else {
            if (totps.length === 0) {
              throw new Error("No TOTP secrets found in Kylrix Vault file.");
            }
            items = totps.map((t: any) => ({ ...t, name: t.issuer || t.accountName, _status: 'new' }));
          }
        }
      } else {
        throw new Error("Please select a file to import.");
      }

      if (items.length === 0) {
        throw new Error("No credentials found matching selected criteria.");
      }

      setParsedItems(items);
      setMode('import-preview');
    } catch (err: any) {
      setErrorMsg(err.message || "Failed to parse import file.");
    }
  };

  const handleFinalImport = () => {
    requestSudo({
      onSuccess: () => {
        try {
          let payload = "";
          if (vendor === 'kylrixvault') {
            // Native structure
            payload = JSON.stringify({
              version: 2,
              format: 'kylrix-vault',
              credentials: importTarget === 'password' ? parsedItems : [],
              totpSecrets: importTarget === 'totp' ? parsedItems : [],
              folders: [],
            });
          } else {
            // Map other vendor data to native format
            payload = JSON.stringify({
              version: 2,
              format: 'kylrix-vault',
              credentials: importTarget === 'password' ? parsedItems : [],
              totpSecrets: importTarget === 'totp' ? parsedItems : [],
              folders: [],
            });
          }

          startImport('kylrixvault', payload, user?.$id || '');
          toast.success(`Importing ${parsedItems.length} items in the background...`);
          onClose();
          handleReset();
        } catch (err: any) {
          toast.error("Import execution failed: " + err.message);
        }
      }
    });
  };

  // Export process
  const handleExport = async () => {
    if (!user) return;
    requestSudo({
      onSuccess: async () => {
        setIsExporting(true);
        try {
          const result = await porterExport(user.$id);
          let finalData = result.data;

          // Filter subset if vault scope is requested
          if (exportScope === 'vault') {
            finalData = {
              version: 2,
              format: 'kylrix-vault',
              exportedAt: new Date().toISOString(),
              userId: user.$id,
              data: {
                vault: result.data.data?.vault || (result.data as any).vault || { folders: [], credentials: [], totpSecrets: [] }
              }
            } as any;
          }

          const jsonString = JSON.stringify(finalData, null, 2);

          if (exportFormat === 'encrypted-html') {
            if (!exportPassword) {
              setErrorMsg("Please enter a master password to encrypt the file.");
              setIsExporting(false);
              return;
            }

            // Encrypt using Master password
            const encrypted = await encryptExportData(jsonString, exportPassword);
            const htmlPage = generateEncryptedHtmlPage(encrypted.ciphertext, encrypted.salt, encrypted.iv, user.email || 'Kylrix User');
            
            // Trigger download
            const blob = new Blob([htmlPage], { type: 'text/html' });
            const url = URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.href = url;
            a.download = `kylrix-${exportScope}-backup-encrypted.html`;
            document.body.appendChild(a);
            a.click();
            document.body.removeChild(a);
            URL.revokeObjectURL(url);

            toast.success(`Encrypted HTML backup generated successfully.`);
          } else {
            // Standard JSON export
            const blob = new Blob([jsonString], { type: 'application/json' });
            const url = URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.href = url;
            a.download = `kylrix-${exportScope}-backup-${new Date().toISOString().split('T')[0]}.json`;
            document.body.appendChild(a);
            a.click();
            document.body.removeChild(a);
            URL.revokeObjectURL(url);

            toast.success(`Standard JSON backup downloaded.`);
          }
          onClose();
          handleReset();
        } catch (err: any) {
          toast.error('Export failed: ' + err.message);
        } finally {
          setIsExporting(false);
        }
      }
    });
  };

  return (
    <Drawer open={isOpen} onClose={onClose}>
      <div className="flex flex-col gap-6 p-4 select-none">
        
        {/* Navigation / Header */}
        <div className="flex items-center gap-3 pb-4 border-b border-white/5">
          <div className="p-2.5 rounded-xl bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
            <Database size={20} />
          </div>
          <div>
            <h2 className="text-xl font-black font-clash text-white">Vault Data Porter</h2>
            <p className="text-xs font-semibold text-white/40">Secure import and export engine</p>
          </div>
        </div>

        {/* --- Screen Router --- */}

        {mode === 'menu' && (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 pt-2">
            {/* Import Option */}
            <button
              onClick={() => setMode('import-type')}
              className="p-6 rounded-[24px] bg-white/[0.02] border border-white/5 hover:border-emerald-500/30 hover:bg-emerald-500/[0.01] text-left transition flex flex-col justify-between h-[200px]"
            >
              <div className="w-12 h-12 rounded-xl bg-emerald-500/10 text-emerald-500 border border-emerald-500/20 flex items-center justify-center">
                <Upload size={22} />
              </div>
              <div>
                <h3 className="text-lg font-black text-white font-clash">Import Data</h3>
                <p className="text-xs text-white/40 mt-1 leading-relaxed">
                  Migrate credentials, passwords, and TOTPs into Kylrix from other secure providers.
                </p>
              </div>
            </button>

            {/* Export Option */}
            <button
              onClick={() => setMode('export-config')}
              className="p-6 rounded-[24px] bg-white/[0.02] border border-white/5 hover:border-indigo-500/30 hover:bg-indigo-500/[0.01] text-left transition flex flex-col justify-between h-[200px]"
            >
              <div className="w-12 h-12 rounded-xl bg-indigo-500/10 text-indigo-400 border border-indigo-500/20 flex items-center justify-center">
                <Download size={22} />
              </div>
              <div>
                <h3 className="text-lg font-black text-white font-clash">Export Data</h3>
                <p className="text-xs text-white/40 mt-1 leading-relaxed">
                  Export standard JSON or encrypted local HTML files to backup credentials and tokens.
                </p>
              </div>
            </button>
          </div>
        )}

        {/* Import Type Selection */}
        {mode === 'import-type' && (
          <div className="flex flex-col gap-4">
            <h3 className="text-sm font-bold text-white/40 uppercase tracking-wider">Select Import Category</h3>
            <div className="flex flex-col gap-3">
              <button
                onClick={() => handleSelectImportTarget('password')}
                className="w-full p-4 rounded-2xl bg-white/[0.02] border border-white/5 hover:border-emerald-500/20 hover:bg-white/[0.04] text-left transition flex items-center justify-between"
              >
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-xl bg-[#6366F1]/10 text-[#6366F1] flex items-center justify-center">
                    <Key size={18} />
                  </div>
                  <div>
                    <h4 className="text-sm font-extrabold text-white">Import Passwords & Credentials</h4>
                    <p className="text-xs text-white/40 mt-0.5">Import usernames, passwords, URLs, and notes</p>
                  </div>
                </div>
                <ChevronRight size={16} className="text-white/30" />
              </button>

              <button
                onClick={() => handleSelectImportTarget('totp')}
                className="w-full p-4 rounded-2xl bg-white/[0.02] border border-white/5 hover:border-emerald-500/20 hover:bg-white/[0.04] text-left transition flex items-center justify-between"
              >
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-xl bg-[#10B981]/10 text-[#10B981] flex items-center justify-center">
                    <Shield size={18} />
                  </div>
                  <div>
                    <h4 className="text-sm font-extrabold text-white">Import TOTP Secrets</h4>
                    <p className="text-xs text-white/40 mt-0.5">Import authenticators, tokens, and 2FA secrets</p>
                  </div>
                </div>
                <ChevronRight size={16} className="text-white/30" />
              </button>
            </div>

            <button onClick={handleReset} className="mt-4 text-xs font-bold text-white/40 hover:text-white transition self-start">
              ← Back to Main Menu
            </button>
          </div>
        )}

        {/* Vendor/Format Selection */}
        {mode === 'import-vendor' && (
          <div className="flex flex-col gap-4">
            <h3 className="text-sm font-bold text-white/40 uppercase tracking-wider">Select Source Vendor</h3>
            
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              {[
                { id: 'kylrixvault', label: 'Kylrix Vault', desc: 'Native json backups', badge: null },
                { id: 'bitwarden', label: 'Bitwarden', desc: 'Bitwarden JSON files', badge: null },
                { id: 'google', label: 'Google Password', desc: 'Import from chrome', badge: 'COMING SOON' },
                { id: 'generic', label: 'Generic CSV / Text', desc: 'Smart column parser', badge: 'FAIL-SAFE' },
              ].map((item) => (
                <button
                  key={item.id}
                  onClick={() => handleSelectVendor(item.id as any)}
                  className={`p-4 rounded-2xl bg-white/[0.02] border border-white/5 text-left transition relative flex flex-col justify-between min-h-[90px] ${
                    item.id === 'google' ? 'opacity-30 cursor-not-allowed' : 'hover:border-emerald-500/20 hover:bg-white/[0.04]'
                  }`}
                >
                  {item.badge && (
                    <span className="absolute top-3.5 right-3.5 px-2 py-0.5 rounded text-[8px] font-black tracking-widest bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
                      {item.badge}
                    </span>
                  )}
                  <div>
                    <h4 className="text-sm font-extrabold text-white">{item.label}</h4>
                    <p className="text-xs text-white/40 mt-0.5 leading-snug">{item.desc}</p>
                  </div>
                </button>
              ))}
            </div>

            <button onClick={() => setMode('import-type')} className="mt-4 text-xs font-bold text-white/40 hover:text-white transition self-start">
              ← Change Import Category
            </button>
          </div>
        )}

        {/* Upload Screen */}
        {mode === 'import-upload' && (
          <div className="flex flex-col gap-5">
            <div>
              <h3 className="text-sm font-bold text-white/40 uppercase tracking-wider mb-1">
                Upload Backup File
              </h3>
              <p className="text-xs text-white/40">
                Please select the file matching the chosen provider structure.
              </p>
            </div>

            {vendor === 'generic' && (
              <div className="flex flex-col gap-2.5">
                <label className="text-xs font-bold text-white/30 uppercase tracking-widest">
                  Paste Raw Delimited Text (Or Upload File Below)
                </label>
                <textarea
                  value={rawText}
                  onChange={(e) => setRawText(e.target.value)}
                  placeholder="name,username,password,url,notes&#10;Google,user@gmail.com,secretPass,google.com,My notes"
                  className="w-full h-32 p-3.5 rounded-2xl bg-black/40 border border-white/5 text-white placeholder-slate-700 font-mono text-xs focus:outline-none focus:border-emerald-500/30 transition resize-none"
                />
              </div>
            )}

            <div className="flex flex-col gap-2">
              <label className="flex flex-col items-center justify-center p-8 rounded-2xl border-2 border-dashed border-white/10 bg-white/1 hover:bg-white/3 hover:border-emerald-500/30 cursor-pointer transition">
                <input type="file" hidden onChange={handleFileChange} accept={vendor === 'generic' ? ".csv,.txt,.json" : ".json"} />
                <Upload className="w-8 h-8 text-white/20 mb-3" />
                <span className="text-sm font-bold text-white mb-1">
                  {file ? file.name : "Click to select backup file"}
                </span>
                <span className="text-xs text-white/40">
                  {file ? `${(file.size / 1024).toFixed(1)} KB` : "Supports JSON and CSV formats"}
                </span>
              </label>
            </div>

            {errorMsg && (
              <div className="flex gap-2.5 p-3.5 rounded-2xl bg-red-500/10 border border-red-500/20 text-red-200 text-xs">
                <AlertTriangle className="w-4.5 h-4.5 flex-shrink-0 text-red-400" />
                <span>{errorMsg}</span>
              </div>
            )}

            <button
              onClick={handleParseAndPreview}
              disabled={!file && !rawText}
              className="w-full py-3.5 rounded-2xl font-black bg-emerald-500 text-black hover:bg-emerald-400 transition flex items-center justify-center gap-1.5 text-sm shadow-[0_4px_20px_rgba(16,185,129,0.15)] disabled:opacity-40 disabled:cursor-not-allowed"
            >
              <span>Parse & Preview</span>
              <ArrowRight size={16} />
            </button>

            <button onClick={() => setMode('import-vendor')} className="text-xs font-bold text-white/40 hover:text-white transition self-start">
              ← Change Provider
            </button>
          </div>
        )}

        {/* Preview Screen */}
        {mode === 'import-preview' && (
          <div className="flex flex-col gap-5">
            <div>
              <h3 className="text-sm font-bold text-white/40 uppercase tracking-wider mb-1">
                Verify Identified Data
              </h3>
              <p className="text-xs text-white/40">
                Found <strong className="text-white">{parsedItems.length}</strong> items in source. Verify the structure.
              </p>
            </div>

            {/* Preview Box */}
            <div className="max-h-[220px] overflow-y-auto border border-white/5 rounded-2xl bg-black/40 divide-y divide-white/5">
              {parsedItems.map((item, idx) => (
                <div key={idx} className="p-3 flex items-center justify-between text-xs hover:bg-white/[0.01]">
                  <div className="flex flex-col gap-0.5 truncate pr-2">
                    <span className="font-extrabold text-white truncate">{item.name || "Untitled Item"}</span>
                    <span className="text-slate-500 truncate">{item.username || item.url || "No details"}</span>
                  </div>
                  <span className="px-2 py-0.5 rounded text-[9px] bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 uppercase font-black tracking-widest flex-shrink-0">
                    {item.password ? 'PASSWORD' : 'DATA'}
                  </span>
                </div>
              ))}
            </div>

            <div className="p-3.5 bg-amber-500/10 border border-amber-500/20 rounded-2xl flex gap-2.5 items-start">
              <Info className="w-4 h-4 text-amber-400 mt-0.5 flex-shrink-0" />
              <div>
                <span className="block text-[10px] font-black text-amber-400 uppercase tracking-wider">DO NOT CLOSE TAB OR REFRESH</span>
                <span className="block text-[10px] text-white/50 leading-relaxed mt-0.5">
                  The import runs in the background but requires the current window to remain open to securely index and decrypt keys.
                </span>
              </div>
            </div>

            <button
              onClick={handleFinalImport}
              disabled={isImporting}
              className="w-full py-4 rounded-2xl font-black bg-emerald-500 text-black hover:bg-emerald-400 transition flex items-center justify-center gap-1.5 text-sm"
            >
              <CheckCircle2 size={18} />
              <span>Import {parsedItems.length} Items</span>
            </button>

            <button onClick={() => setMode('import-upload')} className="text-xs font-bold text-white/40 hover:text-white transition self-start">
              ← Re-upload File
            </button>
          </div>
        )}

        {/* Export Configuration Screen */}
        {mode === 'export-config' && (
          <div className="flex flex-col gap-5">
            <div>
              <h3 className="text-sm font-bold text-white/40 uppercase tracking-wider mb-1">
                Configure Export Settings
              </h3>
              <p className="text-xs text-white/40">
                Choose the size and structure format for your database export.
              </p>
            </div>

            {/* Scope selection */}
            <div className="flex flex-col gap-2">
              <label className="text-xs font-bold text-white/30 uppercase tracking-wider">Export Scope</label>
              <div className="grid grid-cols-2 gap-3">
                <button
                  onClick={() => setExportScope('vault')}
                  className={`p-3 rounded-xl font-bold border text-xs transition ${
                    exportScope === 'vault'
                      ? 'bg-indigo-500/10 border-indigo-500 text-indigo-400'
                      : 'border-white/10 text-white/60 hover:text-white hover:border-white/30'
                  }`}
                >
                  Vault Only
                </button>
                <button
                  onClick={() => setExportScope('workspace')}
                  className={`p-3 rounded-xl font-bold border text-xs transition ${
                    exportScope === 'workspace'
                      ? 'bg-indigo-500/10 border-indigo-500 text-indigo-400'
                      : 'border-white/10 text-white/60 hover:text-white hover:border-white/30'
                  }`}
                >
                  Full Workspace
                </button>
              </div>
            </div>

            {/* Format selection */}
            <div className="flex flex-col gap-2">
              <label className="text-xs font-bold text-white/30 uppercase tracking-wider">Format Mode</label>
              <div className="grid grid-cols-2 gap-3">
                <button
                  onClick={() => setExportFormat('json')}
                  className={`p-3 rounded-xl font-bold border text-xs transition ${
                    exportFormat === 'json'
                      ? 'bg-indigo-500/10 border-indigo-500 text-indigo-400'
                      : 'border-white/10 text-white/60 hover:text-white hover:border-white/30'
                  }`}
                >
                  Standard JSON
                </button>
                <button
                  onClick={() => setExportFormat('encrypted-html')}
                  className={`p-3 rounded-xl font-bold border text-xs transition ${
                    exportFormat === 'encrypted-html'
                      ? 'bg-indigo-500/10 border-indigo-500 text-indigo-400'
                      : 'border-white/10 text-white/60 hover:text-white hover:border-white/30'
                  }`}
                >
                  Encrypted HTML
                </button>
              </div>
            </div>

            {exportFormat === 'encrypted-html' && (
              <div className="flex flex-col gap-2.5 animate-in fade-in slide-in-from-top-2 duration-200">
                <label className="text-xs font-bold text-white/30 uppercase tracking-wider">
                  Set Encryption Password
                </label>
                <input
                  type="password"
                  value={exportPassword}
                  onChange={(e) => setExportPassword(e.target.value)}
                  placeholder="••••••••"
                  className="w-full px-4 py-3 rounded-xl bg-black/40 border border-white/10 text-white placeholder-slate-700 focus:outline-none focus:border-indigo-500/30 transition text-sm"
                />
                <span className="text-[10px] text-slate-500 leading-snug">
                  You will need to input this password to decrypt your credentials locally if you open the HTML file.
                </span>
              </div>
            )}

            {errorMsg && (
              <div className="flex gap-2.5 p-3 rounded-xl bg-red-500/10 border border-red-500/20 text-red-200 text-xs">
                <AlertTriangle className="w-4.5 h-4.5 flex-shrink-0 text-red-400" />
                <span>{errorMsg}</span>
              </div>
            )}

            <button
              onClick={handleExport}
              disabled={isExporting || (exportFormat === 'encrypted-html' && !exportPassword)}
              className="w-full py-3.5 rounded-2xl font-black bg-indigo-500 text-black hover:bg-indigo-400 transition flex items-center justify-center gap-1.5 text-sm shadow-[0_4px_20px_rgba(99,102,241,0.15)] disabled:opacity-40"
            >
              <Download size={18} />
              <span>{isExporting ? 'Exporting...' : 'Export File'}</span>
            </button>

            <div className="p-3.5 bg-amber-500/10 border border-amber-500/20 rounded-2xl flex gap-2.5 items-start">
              <Info className="w-4 h-4 text-amber-400 mt-0.5 flex-shrink-0" />
              <div>
                <span className="block text-[10px] font-black text-amber-400 uppercase tracking-wider">KEEP TAB OPEN UNTIL COMPLETE</span>
                <span className="block text-[10px] text-white/50 leading-relaxed mt-0.5">
                  Exporting queries and package-wraps data on the fly. Do not refresh or close this tab while processing.
                </span>
              </div>
            </div>

            <button onClick={handleReset} className="text-xs font-bold text-white/40 hover:text-white transition self-start">
              ← Cancel Export
            </button>
          </div>
        )}

      </div>
    </Drawer>
  );
}
