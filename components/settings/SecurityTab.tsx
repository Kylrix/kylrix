'use client';

import React, { useState } from 'react';
import {
  Fingerprint,
  Lock,
  LockOpen,
  Trash2,
  Plus,
  Mail,
  Smartphone,
  ShieldCheck,
  ShieldAlert,
  ArrowUpCircle,
  Clock,
  KeyRound,
} from 'lucide-react';
import { RememberUnlockSettings } from '@/components/settings/RememberUnlockSettings';
import { AgentByokSettings } from '@/components/settings/AgentByokSettings';
import { UnlockOnDemandSettings } from '@/components/settings/UnlockOnDemandSettings';
import { HardVerificationSettings } from '@/components/settings/HardVerificationSettings';
import { FlowInstallSecuritySettings } from '@/components/settings/FlowInstallSecuritySettings';
import { ZapSecuritySettings } from '@/components/settings/ZapSecuritySettings';
import { formatDateWithFallback } from '@/lib/date-utils';
import { useAppwriteVault } from '@/context/appwrite-context';
import { useAuth } from '@/lib/auth';
import { toast } from 'react-hot-toast';

function BareBonesMasterpassUnlock() {
  const { user } = useAuth();
  const [pwd, setPwd] = useState('');
  const [busy, setBusy] = useState(false);
  const [logs, setLogs] = useState<string[]>([]);
  const [copied, setCopied] = useState(false);
  const [detectedEngine, setDetectedEngine] = useState<{
    algo: 'Argon2id' | 'PBKDF2' | 'None' | 'Checking';
    saltBytes: number;
    hasPasswordEntry: boolean;
    hasPasskeyEntry: boolean;
    totalEntries: number;
    rawParams?: any;
  }>({
    algo: 'Checking',
    saltBytes: 0,
    hasPasswordEntry: false,
    hasPasskeyEntry: false,
    totalEntries: 0,
  });

  const detectLiveEngine = React.useCallback(async () => {
    if (!user?.$id) return;
    try {
      const { SecurityEnclave } = await import('@/lib/security/enclave');
      const { AppwriteService } = await import('@/lib/appwrite');

      let entries = await SecurityEnclave.getKeychain(user.$id);
      if (!entries.length && typeof navigator !== 'undefined' && navigator.onLine) {
        entries = await AppwriteService.listKeychainEntries(user.$id).catch(() => []);
      }

      if (!entries.length) {
        setDetectedEngine({
          algo: 'None',
          saltBytes: 0,
          hasPasswordEntry: false,
          hasPasskeyEntry: false,
          totalEntries: 0,
        });
        return;
      }

      const pwdEntry = entries.find((e: any) => e.type === 'password');
      const hasPasskey = entries.some((e: any) => e.type === 'passkey');

      if (!pwdEntry) {
        setDetectedEngine({
          algo: 'None',
          saltBytes: 0,
          hasPasswordEntry: false,
          hasPasskeyEntry: hasPasskey,
          totalEntries: entries.length,
        });
        return;
      }

      const decodeB64Len = (b64: string) => {
        try {
          const norm = b64.replace(/-/g, '+').replace(/_/g, '/');
          const pad = norm.padEnd(Math.ceil(norm.length / 4) * 4, '=');
          return atob(pad).length;
        } catch {
          return 0;
        }
      };

      const saltLen = pwdEntry.salt ? decodeB64Len(pwdEntry.salt) : 0;
      const isArgon = Boolean(
        pwdEntry.isArgon ||
        saltLen === 32 ||
        (typeof pwdEntry.params === 'string' && pwdEntry.params.includes('Argon2id')) ||
        pwdEntry.params?.algo === 'Argon2id'
      );

      setDetectedEngine({
        algo: isArgon ? 'Argon2id' : 'PBKDF2',
        saltBytes: saltLen,
        hasPasswordEntry: true,
        hasPasskeyEntry: hasPasskey,
        totalEntries: entries.length,
        rawParams: pwdEntry.params,
      });
    } catch {
      setDetectedEngine(prev => ({ ...prev, algo: 'None' }));
    }
  }, [user?.$id]);

  React.useEffect(() => {
    detectLiveEngine();
  }, [detectLiveEngine]);

  const handleCopyLogs = () => {
    if (!logs.length) return;
    navigator.clipboard.writeText(logs.join('\n'));
    setCopied(true);
    toast.success('Logs copied to clipboard');
    setTimeout(() => setCopied(false), 2000);
  };

  const handleTestUnlock = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!pwd || !user?.$id) return;
    setBusy(true);
    setLogs([]);
    const addLog = (msg: string) => setLogs((prev) => [...prev, `[${new Date().toLocaleTimeString()}] ${msg}`]);

    try {
      addLog(`=== STARTING DIRECT CRYPTO PROBE ===`);
      addLog(`User ID: "${user.$id}", Email: "${user.email || 'N/A'}"`);
      
      const { SecurityEnclave } = await import('@/lib/security/enclave');
      const { AppwriteService } = await import('@/lib/appwrite');
      const { APPWRITE_CONFIG } = await import('@/lib/appwrite/config');

      // 1. Inspect User Document
      try {
        const userDoc = await AppwriteService.getUserDoc(user.$id);
        addLog(`UserDoc: exists=${Boolean(userDoc)}, masterpass=${userDoc?.masterpass}, isPasskey=${userDoc?.isPasskey}, authPass=${Boolean(userDoc?.authPass)}`);
      } catch (err: any) {
        addLog(`UserDoc fetch error: ${err?.message || err}`);
      }

      // 2. Fetch Enclave and Remote Keychain
      const localKeychain = await SecurityEnclave.getKeychain(user.$id);
      addLog(`Enclave Local Cache Rows: ${localKeychain.length}`);

      const remoteEntries = await AppwriteService.listKeychainEntries(user.$id).catch((err: any) => {
        addLog(`Remote listKeychainEntries error: ${err?.message || err}`);
        return [];
      });
      addLog(`Remote Appwrite Database (${APPWRITE_CONFIG.DATABASES.VAULT}.${APPWRITE_CONFIG.TABLES.VAULT.KEYCHAIN}) Rows: ${remoteEntries.length}`);

      const allEntries = remoteEntries.length > 0 ? remoteEntries : localKeychain;
      if (allEntries.length === 0) {
        addLog(`ERROR: ZERO keychain entries found on account! Vault is uninitialized or wiped.`);
        toast.error('Zero keychain entries found');
        return;
      }

      // 3. Inspect Every Entry
      allEntries.forEach((entry: any, i: number) => {
        addLog(`--- Entry #${i + 1} [$id: ${entry.$id}, type: "${entry.type}"] ---`);
        addLog(`  salt: length=${entry.salt?.length || 0} (${entry.salt ? `${entry.salt.slice(0, 8)}...` : 'NONE'})`);
        addLog(`  wrappedKey: length=${entry.wrappedKey?.length || 0} (${entry.wrappedKey ? `${entry.wrappedKey.slice(0, 16)}...` : 'NONE'})`);
        addLog(`  isArgon: ${Boolean(entry.isArgon)}, isPending: ${Boolean(entry.isPending)}`);
        addLog(`  params: ${typeof entry.params === 'object' ? JSON.stringify(entry.params) : String(entry.params)}`);
        addLog(`  $createdAt: ${entry.$createdAt || 'N/A'}`);
      });

      const pwdEntries = allEntries.filter((e: any) => e.type === 'password');
      addLog(`Found ${pwdEntries.length} 'password' type entries to test against.`);

      if (pwdEntries.length === 0) {
        addLog(`WARNING: No entries with type: 'password' (only passkeys or uninitialized entries exist).`);
      }

      // 4. Test Step-by-Step Low-Level Derivation and AES-GCM Decrypt
      const { masterPassCrypto } = await import('@/lib/masterpass-crypto');

      for (let idx = 0; idx < pwdEntries.length; idx++) {
        const entry = pwdEntries[idx];
        addLog(`\n>>> Testing Decryption on Password Entry #${idx + 1} (${entry.$id}) <<<`);

        if (!entry.salt || !entry.wrappedKey) {
          addLog(`  SKIPPED: Missing salt or wrappedKey.`);
          continue;
        }

        // Base64 decode
        const decodeB64 = (b64: string) => {
          const norm = b64.replace(/-/g, '+').replace(/_/g, '/');
          const pad = norm.padEnd(Math.ceil(norm.length / 4) * 4, '=');
          const bin = atob(pad);
          const bytes = new Uint8Array(bin.length);
          for (let k = 0; k < bin.length; k++) bytes[k] = bin.charCodeAt(k);
          return bytes;
        };

        const saltBytes = decodeB64(entry.salt);
        const wrappedKeyBytes = decodeB64(entry.wrappedKey);
        addLog(`  Decoded Salt: ${saltBytes.length} bytes; Decoded WrappedKey: ${wrappedKeyBytes.length} bytes`);

        const iv = wrappedKeyBytes.slice(0, 16);
        const ciphertext = wrappedKeyBytes.slice(16);
        addLog(`  IV: ${iv.length} bytes, Ciphertext: ${ciphertext.length} bytes`);

        // Test with Argon2id and PBKDF2
        for (const algo of ['Argon2id', 'PBKDF2']) {
          const isArgonFlag = algo === 'Argon2id';
          const t0 = performance.now();
          try {
            addLog(`  Deriving key with [${algo}]...`);
            const authKey = await (masterPassCrypto as any).deriveKey(pwd, saltBytes, isArgonFlag);
            const dt = (performance.now() - t0).toFixed(1);
            addLog(`  Key derived in ${dt}ms. Attempting crypto.subtle.decrypt AES-GCM...`);

            const testMek = await crypto.subtle.decrypt(
              { name: 'AES-GCM', iv },
              authKey,
              ciphertext
            );
            addLog(`  >>> SUCCESS [${algo}]! Decrypted MEK byteLength: ${testMek.byteLength} <<<`);
          } catch (decryptErr: any) {
            addLog(`  FAILED [${algo}]: ${decryptErr?.name || 'Error'} - ${decryptErr?.message || String(decryptErr)}`);
          }
        }
      }

      // 5. Run full masterPassCrypto.unlock()
      addLog(`\n>>> Running official masterPassCrypto.unlock() <<<`);
      const success = await masterPassCrypto.unlock(pwd, user.$id, false);

      if (success) {
        addLog(`=== VERDICT: UNLOCK SUCCEEDED! Vault is active in memory. ===`);
        toast.success('Direct unlock succeeded!');
      } else {
        addLog(`=== VERDICT: UNLOCK FAILED! Master password did not decrypt any keychain candidate. ===`);
        toast.error('Unlock failed');
      }
    } catch (err: any) {
      addLog(`CRITICAL FATAL PROBE ERROR: ${err?.name || 'Error'}: ${err?.message || String(err)}`);
      console.error('[BareBonesUnlock]', err);
      toast.error(`Error: ${err?.message}`);
    } finally {
      setBusy(false);
    }
  };

  return (
    <Section title="Direct Masterpass Unlock (Diagnostic)">
      <div className="flex flex-col gap-3">
        <p className="text-xs text-white/50 leading-relaxed font-satoshi">
          Bare-bones first-principles diagnostic: tests key derivation (Argon2id/PBKDF2) and MEK unwrap with real-time logs.
        </p>

        {/* Live Detected Engine Status */}
        <div className="flex flex-wrap items-center justify-between gap-2 p-3 rounded-xl bg-[#0A0908] border border-white/5">
          <div className="flex items-center gap-2">
            <span className="text-xs text-white/50 font-medium">Live Detected Engine:</span>
            {detectedEngine.algo === 'Checking' ? (
              <span className="text-[11px] font-mono text-white/40">Detecting…</span>
            ) : detectedEngine.algo === 'Argon2id' ? (
              <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[11px] font-extrabold bg-emerald-500/15 text-emerald-400 border border-emerald-500/30">
                <ShieldCheck className="w-3 h-3" />
                Argon2id (T5 Modern)
              </span>
            ) : detectedEngine.algo === 'PBKDF2' ? (
              <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[11px] font-extrabold bg-amber-500/15 text-amber-400 border border-amber-500/30">
                <ShieldAlert className="w-3 h-3" />
                PBKDF2 (Legacy T4)
              </span>
            ) : (
              <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[11px] font-bold bg-white/5 text-white/40 border border-white/10">
                No Password Credential
              </span>
            )}
          </div>
          <div className="flex items-center gap-2 text-[11px] font-mono text-white/40">
            <span>Salt: {detectedEngine.saltBytes}B</span>
            <span>·</span>
            <span>Entries: {detectedEngine.totalEntries}</span>
            <button
              type="button"
              onClick={detectLiveEngine}
              className="text-[10px] text-white/60 hover:text-white underline cursor-pointer"
            >
              Refresh
            </button>
          </div>
        </div>

        <form onSubmit={handleTestUnlock} className="flex flex-col sm:flex-row gap-2">
          <input
            type="password"
            placeholder="Enter master password to test..."
            value={pwd}
            onChange={(e) => setPwd(e.target.value)}
            disabled={busy}
            className="flex-1 bg-[#0A0908] border border-white/10 rounded-xl px-3.5 py-2.5 text-xs text-white placeholder-white/30 focus:outline-none focus:border-amber-400/50 font-mono"
          />
          <button
            type="submit"
            disabled={busy || !pwd}
            className="px-4 py-2.5 rounded-xl bg-amber-500 hover:bg-amber-400 disabled:opacity-50 text-black font-extrabold text-xs shrink-0 cursor-pointer transition-all flex items-center justify-center gap-1.5"
          >
            <KeyRound className="w-3.5 h-3.5" />
            {busy ? 'Testing...' : 'Unlock Direct'}
          </button>
        </form>

        {logs.length > 0 && (
          <div className="flex flex-col gap-2 mt-1">
            <div className="flex items-center justify-between">
              <span className="text-[10px] font-mono text-white/40 uppercase tracking-wider">
                Probe Output ({logs.length} events)
              </span>
              <button
                type="button"
                onClick={handleCopyLogs}
                className="inline-flex items-center gap-1 text-[11px] font-bold text-amber-400 bg-amber-500/10 border border-amber-500/20 hover:bg-amber-500/20 px-2.5 py-1 rounded-lg cursor-pointer transition-all"
              >
                {copied ? 'Copied!' : 'Copy Full Logs'}
              </button>
            </div>
            <div className="p-3 bg-[#0A0908] border border-white/5 rounded-xl font-mono text-[11px] text-white/70 flex flex-col gap-1 max-h-64 overflow-y-auto whitespace-pre-wrap select-all">
              {logs.map((log, idx) => (
                <div
                  key={idx}
                  className={
                    log.includes('SUCCESS')
                      ? 'text-emerald-400 font-bold'
                      : log.includes('ERROR') || log.includes('FAILED') || log.includes('FATAL')
                      ? 'text-red-400 font-bold'
                      : log.includes('>>>')
                      ? 'text-amber-400 font-semibold'
                      : ''
                  }
                >
                  {log}
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </Section>
  );
}

function PasskeyPreferenceSettings() {
  const { usePasskeysByDefault, setUsePasskeysByDefault } = useAppwriteVault();
  return (
    <Section title="Unlock Preferences">
      <Row
        icon={<Fingerprint className="w-4 h-4" />}
        title="Prefer passkeys by default"
        meta="Automatically prompt passkey verification for sudo unlock modal"
        trailing={
          <button
            type="button"
            onClick={() => setUsePasskeysByDefault(!usePasskeysByDefault)}
            className={`py-1.5 px-3 rounded-lg text-[11px] font-extrabold cursor-pointer border-none transition-all ${
              usePasskeysByDefault
                ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/30'
                : 'bg-white/5 text-white/40 hover:text-white hover:bg-white/10'
            }`}
          >
            {usePasskeysByDefault ? 'Enabled' : 'Disabled'}
          </button>
        }
      />
    </Section>
  );
}

type PasskeyEntry = {
  $id: string;
  $createdAt?: string;
  authPasskey?: boolean;
  params?: {
    name?: string;
    created?: string;
    transports?: string[];
    rpId?: string;
    prf?: boolean;
  };
};

type Props = {
  isUnlocked: boolean;
  hasMasterpass?: boolean | null;
  isArgon?: boolean | null;
  isAuthPassConfigured?: boolean;
  masterpassChangedAt?: string | null;
  onLockVault: () => void;
  onUnlockVault: () => void;
  onSetupVault?: () => void;
  onManageVault?: () => void;
  onChangeMasterpass?: () => void;
  onResetVault?: () => void;
  loadingPasskeys: boolean;
  passkeyEntries: PasskeyEntry[];
  onAddPasskey: () => void;
  onRemovePasskey: (id: string) => void;
  accountMfaEnabled: boolean;
  mfaFactors: { email?: boolean; totp?: boolean; passkey?: boolean; mfaEnabled?: boolean } | null;
  onManageMfa: () => void;
};

function passkeyCreatedAt(pk: PasskeyEntry): string | null {
  return pk.params?.created || pk.$createdAt || null;
}

function passkeyDeviceKind(pk: PasskeyEntry): string {
  const transports = pk.params?.transports || [];
  if (transports.includes('internal') || transports.includes('hybrid')) return 'This device';
  if (transports.some((t) => ['usb', 'nfc', 'ble'].includes(t))) return 'Security key';
  return 'Passkey';
}

function passkeyUseLabels(pk: PasskeyEntry): string[] {
  const labels: string[] = ['Unlock'];
  if (pk.authPasskey) labels.unshift('Sign in');
  return labels;
}

/** Continuous ash panel — one fill; nested pieces bring their own surface. */
function Section({
  title,
  action,
  children,
}: {
  title: string;
  action?: React.ReactNode;
  children: React.ReactNode;
}) {
  return (
    <section className="rounded-[22px] bg-[#161412] border border-white/[0.06] p-5 space-y-3.5">
      <div className="flex items-center justify-between gap-3">
        <h3 className="text-[11px] font-extrabold uppercase tracking-wider text-white/55 font-satoshi">
          {title}
        </h3>
        {action}
      </div>
      <div className="space-y-2.5">{children}</div>
    </section>
  );
}

function Row({
  icon,
  title,
  meta,
  trailing,
}: {
  icon: React.ReactNode;
  title: string;
  meta?: React.ReactNode;
  trailing?: React.ReactNode;
}) {
  return (
    <div className="flex items-center gap-3 rounded-[16px] bg-[#0A0908] border border-white/[0.04] px-3.5 py-3.5">
      <div className="p-2 rounded-xl bg-[#161412] border border-white/[0.06] text-[#6366F1] shrink-0">
        {icon}
      </div>
      <div className="min-w-0 flex-1">
        <p className="text-sm font-bold text-white truncate">{title}</p>
        {meta ? <div className="mt-1 text-[11px] text-white/40 font-satoshi">{meta}</div> : null}
      </div>
      {trailing}
    </div>
  );
}

export function SecurityTab({
  isUnlocked,
  hasMasterpass,
  isArgon,
  isAuthPassConfigured,
  masterpassChangedAt,
  onLockVault,
  onUnlockVault,
  onSetupVault,
  onManageVault,
  onChangeMasterpass,
  onResetVault,
  loadingPasskeys,
  passkeyEntries,
  onAddPasskey,
  onRemovePasskey,
  accountMfaEnabled,
  mfaFactors,
  onManageMfa,
}: Props) {
  // hasMasterpass === null means still loading / offline — don't show setup button in that state
  const vaultSetup = hasMasterpass === true;
  const vaultLoading = hasMasterpass === null;
  const needsSetup = hasMasterpass === false;

  return (
    <div className="flex flex-col gap-4 pb-24 max-w-3xl text-white">
      <Section
        title="Vault"
        action={
          vaultSetup ? (
            <button
              type="button"
              onClick={isUnlocked ? onLockVault : onUnlockVault}
              className={`py-1.5 px-3 rounded-lg text-[11px] font-extrabold cursor-pointer border-none transition-all ${
                isUnlocked ? 'bg-amber-500 text-black' : 'bg-[#6366F1] text-white hover:bg-[#5254E8]'
              }`}
            >
              {isUnlocked ? 'Lock' : 'Unlock'}
            </button>
          ) : needsSetup ? (
            <button
              type="button"
              onClick={onSetupVault}
              className="py-1.5 px-3 rounded-lg text-[11px] font-extrabold cursor-pointer border-none bg-[#6366F1] text-white hover:bg-[#5254E8]"
            >
              Set up vault
            </button>
          ) : null
        }
      >
        {/* Lock / unlock status */}
        <Row
          icon={isUnlocked ? <LockOpen className="w-4 h-4" /> : <Lock className="w-4 h-4" />}
          title={
            vaultLoading
              ? 'Checking vault…'
              : needsSetup
              ? 'Vault not configured'
              : isUnlocked
              ? 'Vault unlocked'
              : 'Vault locked'
          }
          meta={
            vaultLoading
              ? 'Verifying status…'
              : needsSetup
              ? 'Set up a master password to encrypt your credentials and notes'
              : isUnlocked
              ? 'Decrypted encryption key active in memory'
              : 'Locked with your master password or passkey'
          }
          trailing={
            needsSetup && !vaultLoading ? (
              <button
                type="button"
                onClick={onSetupVault}
                className="shrink-0 py-1.5 px-3 rounded-lg text-[11px] font-extrabold cursor-pointer border border-[#6366F1]/40 bg-[#6366F1]/10 text-[#6366F1]"
              >
                Configure
              </button>
            ) : vaultSetup ? (
              <button
                type="button"
                onClick={onChangeMasterpass || onManageVault}
                className="shrink-0 py-1.5 px-3 rounded-lg text-[11px] font-extrabold cursor-pointer border border-white/[0.08] bg-white/5 text-white/70 hover:text-white hover:bg-white/10 transition-all"
              >
                Change password
              </button>
            ) : null
          }
        />

        {/* Encryption engine */}
        {vaultSetup && (
          <Row
            icon={
              isArgon ? (
                <ShieldCheck className="w-4 h-4 text-emerald-400" />
              ) : (
                <ShieldAlert className="w-4 h-4 text-amber-400" />
              )
            }
            title={isArgon ? 'T5 Argon2id engine' : 'Legacy T4 engine'}
            meta={
              isArgon
                ? 'Argon2id 64MB/3 iterations — maximum security'
                : 'Older encryption engine — upgrade available'
            }
            trailing={
              !isArgon ? (
                <button
                  type="button"
                  onClick={onManageVault}
                  className="shrink-0 flex items-center gap-1 py-1.5 px-3 rounded-lg text-[11px] font-extrabold cursor-pointer border border-amber-500/30 bg-amber-500/10 text-amber-400"
                >
                  <ArrowUpCircle className="w-3 h-3" />
                  Upgrade
                </button>
              ) : (
                <span className="text-[10px] font-bold text-emerald-400/80 bg-emerald-500/10 border border-emerald-500/20 px-2 py-0.5 rounded">
                  Latest
                </span>
              )
            }
          />
        )}

        {/* Master password info & sign-in status */}
        {vaultSetup && (
          <Row
            icon={<Clock className="w-4 h-4" />}
            title="Master password details"
            meta={
              masterpassChangedAt ? (
                <>
                  Last changed{' '}
                  {formatDateWithFallback(masterpassChangedAt, {
                    year: 'numeric',
                    month: 'short',
                    day: 'numeric',
                  })}
                  {' · '}
                  {isAuthPassConfigured ? 'Used for sign-in' : 'Vault encryption only'}
                </>
              ) : (
                isAuthPassConfigured ? 'Configured for sign-in & encryption' : 'Configured for vault encryption'
              )
            }
          />
        )}
      </Section>

      {/* First-principles direct unlock diagnostic */}
      <BareBonesMasterpassUnlock />

      <Section
        title="Passkeys"
        action={
          <button
            type="button"
            onClick={onAddPasskey}
            className="inline-flex items-center gap-1 py-1.5 px-2.5 rounded-lg bg-[#0A0908] border border-white/[0.08] text-white/80 text-[11px] font-extrabold cursor-pointer"
          >
            <Plus className="w-3 h-3" />
            Add
          </button>
        }
      >
        {loadingPasskeys ? (
          <div className="py-8 flex justify-center">
            <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-[#6366F1]" />
          </div>
        ) : passkeyEntries.length === 0 ? (
          <button
            type="button"
            onClick={onAddPasskey}
            className="w-full flex items-center gap-3 rounded-[16px] bg-[#0A0908] border border-dashed border-white/10 px-3 py-4 text-left cursor-pointer"
          >
            <div className="p-2 rounded-xl bg-[#161412] border border-white/[0.06] text-[#6366F1]">
              <Fingerprint className="w-4 h-4" />
            </div>
            <span className="text-sm font-bold text-white/70">Add a passkey</span>
          </button>
        ) : (
          passkeyEntries.map((pk) => {
            const created = passkeyCreatedAt(pk);
            return (
              <Row
                key={pk.$id}
                icon={<Fingerprint className="w-4 h-4" />}
                title={pk.params?.name || 'Device passkey'}
                meta={
                  <span className="flex flex-wrap gap-x-2 gap-y-0.5">
                    <span>{passkeyUseLabels(pk).join(' · ')}</span>
                    <span>{passkeyDeviceKind(pk)}</span>
                    {created ? (
                      <span>
                        {formatDateWithFallback(created, {
                          year: 'numeric',
                          month: 'short',
                          day: 'numeric',
                        })}
                      </span>
                    ) : null}
                  </span>
                }
                trailing={
                  <button
                    type="button"
                    onClick={() => onRemovePasskey(pk.$id)}
                    className="p-2 rounded-lg bg-[#161412] border border-red-500/20 text-red-400 cursor-pointer shrink-0"
                    aria-label="Remove passkey"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                }
              />
            );
          })
        )}
      </Section>

      <PasskeyPreferenceSettings />

      <UnlockOnDemandSettings />

      <HardVerificationSettings />

      <RememberUnlockSettings />

      <AgentByokSettings />

      <FlowInstallSecuritySettings />

      <ZapSecuritySettings />

      <Section
        title="2FA"
        action={
          <div className="flex items-center gap-2">
            <span
              className={`text-[10px] font-black uppercase tracking-wider px-2 py-0.5 rounded border ${
                accountMfaEnabled || mfaFactors?.mfaEnabled
                  ? 'bg-emerald-500/10 border-emerald-500/20 text-emerald-400'
                  : 'bg-white/5 border-white/10 text-white/40'
              }`}
            >
              {accountMfaEnabled || mfaFactors?.mfaEnabled ? '2FA ON' : '2FA OFF'}
            </span>
            <button
              type="button"
              onClick={onManageMfa}
              className="py-1.5 px-3 rounded-lg bg-[#6366F1] text-white text-[11px] font-extrabold cursor-pointer border-none"
            >
              Manage
            </button>
          </div>
        }
      >
        <button type="button" onClick={onManageMfa} className="w-full text-left cursor-pointer border-none bg-transparent p-0">
          <Row
            icon={<Fingerprint className="w-4 h-4" />}
            title="Passkey 2FA"
            meta="Hardware biometrics / Security keys for 2FA"
            trailing={
              <span
                className={`text-[10px] font-extrabold uppercase tracking-wide ${
                  mfaFactors?.passkey ? 'text-emerald-400' : 'text-white/35'
                }`}
              >
                {mfaFactors?.passkey ? 'On' : 'Off'}
              </span>
            }
          />
        </button>
        <button type="button" onClick={onManageMfa} className="w-full text-left cursor-pointer border-none bg-transparent p-0">
          <Row
            icon={<Smartphone className="w-4 h-4" />}
            title="TOTP 2FA"
            meta="Google Authenticator, 1Password, Aegis"
            trailing={
              <span
                className={`text-[10px] font-extrabold uppercase tracking-wide ${
                  mfaFactors?.totp ? 'text-emerald-400' : 'text-white/35'
                }`}
              >
                {mfaFactors?.totp ? 'On' : 'Off'}
              </span>
            }
          />
        </button>
        <button type="button" onClick={onManageMfa} className="w-full text-left cursor-pointer border-none bg-transparent p-0">
          <Row
            icon={<Mail className="w-4 h-4" />}
            title="Email 2FA"
            meta="One-time 2FA codes sent to your email"
            trailing={
              <span
                className={`text-[10px] font-extrabold uppercase tracking-wide ${
                  mfaFactors?.email ? 'text-emerald-400' : 'text-white/35'
                }`}
              >
                {mfaFactors?.email ? 'On' : 'Off'}
              </span>
            }
          />
        </button>
      </Section>

      {/* Danger Zone — Reset Vault (isolated at bottom) */}
      {vaultSetup && onResetVault && (
        <section className="rounded-[22px] bg-[#161412] border border-red-500/20 p-5 space-y-3.5 mt-2">
          <div className="flex items-center justify-between gap-3">
            <h3 className="text-[11px] font-extrabold uppercase tracking-wider text-red-400/80 font-satoshi">
              Danger Zone
            </h3>
          </div>
          <div className="space-y-2.5">
            <Row
              icon={<ShieldAlert className="w-4 h-4 text-red-400" />}
              title="Reset Vault"
              meta="Permanently wipe vault keys and encrypted metadata. Multi-step confirmation required."
              trailing={
                <button
                  type="button"
                  onClick={onResetVault}
                  className="shrink-0 py-1.5 px-3 rounded-lg text-[11px] font-extrabold cursor-pointer border border-red-500/30 bg-red-500/10 text-red-400 hover:bg-red-500/20 transition-all"
                >
                  Reset Vault…
                </button>
              }
            />
          </div>
        </section>
      )}
    </div>
  );
}
