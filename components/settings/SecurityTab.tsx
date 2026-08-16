'use client';

import React from 'react';
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
  KeyRound,
  ArrowUpCircle,
  Clock,
  UserCheck,
} from 'lucide-react';
import { RememberUnlockSettings } from '@/components/settings/RememberUnlockSettings';
import { AgentByokSettings } from '@/components/settings/AgentByokSettings';
import { UnlockOnDemandSettings } from '@/components/settings/UnlockOnDemandSettings';
import { HardVerificationSettings } from '@/components/settings/HardVerificationSettings';
import { FlowInstallSecuritySettings } from '@/components/settings/FlowInstallSecuritySettings';
import { ZapSecuritySettings } from '@/components/settings/ZapSecuritySettings';
import { formatDateWithFallback } from '@/lib/date-utils';
import { useAppwriteVault } from '@/context/appwrite-context';

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
              className={`py-1.5 px-3 rounded-lg text-[11px] font-extrabold cursor-pointer border-none ${
                isUnlocked ? 'bg-amber-500 text-black' : 'bg-[#6366F1] text-white'
              }`}
            >
              {isUnlocked ? 'Lock' : 'Unlock'}
            </button>
          ) : needsSetup ? (
            <button
              type="button"
              onClick={onSetupVault}
              className="py-1.5 px-3 rounded-lg text-[11px] font-extrabold cursor-pointer border-none bg-[#6366F1] text-white"
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
              ? 'Vault not set up'
              : isUnlocked
              ? 'Vault unlocked'
              : 'Vault locked'
          }
          meta={
            vaultLoading
              ? 'Verifying setup status — may take a moment if offline'
              : needsSetup
              ? 'Set up a master password to encrypt your secure chats and vault items'
              : 'Encryption key loaded in memory for this session'
          }
          trailing={
            needsSetup && !vaultLoading ? (
              <button
                type="button"
                onClick={onSetupVault}
                className="shrink-0 py-1.5 px-3 rounded-lg text-[11px] font-extrabold cursor-pointer border border-[#6366F1]/40 bg-[#6366F1]/10 text-[#6366F1]"
              >
                Set up
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
                ? 'Argon2id 64MB/3 iterations — maximum protection'
                : 'Older encryption engine — upgrade recommended for stronger security'
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
              ) : null
            }
          />
        )}

        {/* Last master password change */}
        {vaultSetup && masterpassChangedAt && (
          <Row
            icon={<Clock className="w-4 h-4" />}
            title="Master password"
            meta={
              <>
                Last changed{' '}
                {formatDateWithFallback(masterpassChangedAt, {
                  year: 'numeric',
                  month: 'short',
                  day: 'numeric',
                })}
              </>
            }
            trailing={
              <button
                type="button"
                onClick={onManageVault}
                className="shrink-0 py-1.5 px-3 rounded-lg text-[11px] font-extrabold cursor-pointer border border-white/[0.08] bg-white/5 text-white/60 hover:text-white"
              >
                Change
              </button>
            }
          />
        )}

        {/* Use master password for sign-in */}
        {vaultSetup && (
          <Row
            icon={<UserCheck className="w-4 h-4" />}
            title="Use master password for sign-in"
            meta={
              isAuthPassConfigured
                ? 'Master password also authenticates your account sign-in'
                : 'Not enabled — sign-in uses email OTP or passkeys only'
            }
            trailing={
              <span
                className={`shrink-0 text-[10px] font-black uppercase tracking-wider px-2 py-0.5 rounded border ${
                  isAuthPassConfigured
                    ? 'bg-emerald-500/10 border-emerald-500/20 text-emerald-400'
                    : 'bg-white/5 border-white/10 text-white/35'
                }`}
              >
                {isAuthPassConfigured ? 'Enabled' : 'Off'}
              </span>
            }
          />
        )}

        {/* Manage vault button when set up */}
        {vaultSetup && (
          <Row
            icon={<KeyRound className="w-4 h-4" />}
            title="Manage vault"
            meta="Change master password or upgrade encryption engine"
            trailing={
              <button
                type="button"
                onClick={onManageVault}
                className="shrink-0 py-1.5 px-3 rounded-lg text-[11px] font-extrabold cursor-pointer border border-white/[0.08] bg-white/5 text-white/60 hover:text-white"
              >
                Manage
              </button>
            }
          />
        )}
      </Section>

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
    </div>
  );
}
