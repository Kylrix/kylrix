'use client';

import React from 'react';
import {
  Fingerprint,
  Lock,
  LockOpen,
  ShieldCheck,
  ShieldAlert,
  KeyRound,
  Trash2,
  Plus,
  Mail,
  Smartphone,
  Clock,
  Laptop,
} from 'lucide-react';
import { RememberUnlockSettings } from '@/components/settings/RememberUnlockSettings';
import { formatDateWithFallback } from '@/lib/date-utils';

type PasskeyEntry = {
  $id: string;
  $createdAt?: string;
  authPasskey?: boolean;
  credentialId?: string;
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
  onLockVault: () => void;
  onUnlockVault: () => void;
  loadingPasskeys: boolean;
  passkeyEntries: PasskeyEntry[];
  onAddPasskey: () => void;
  onRemovePasskey: (id: string) => void;
  accountMfaEnabled: boolean;
  mfaFactors: { email?: boolean; totp?: boolean } | null;
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
  const labels: string[] = ['Vault unlock'];
  if (pk.authPasskey) labels.unshift('Sign in');
  return labels;
}

function MetaChip({
  children,
  tone = 'neutral',
}: {
  children: React.ReactNode;
  tone?: 'neutral' | 'good' | 'warn' | 'accent';
}) {
  const tones = {
    neutral: 'bg-[#1C1A18] border-[#34322F] text-white/80',
    good: 'bg-emerald-500/10 border-emerald-500/25 text-emerald-400',
    warn: 'bg-amber-500/10 border-amber-500/25 text-amber-300',
    accent: 'bg-[#6366F1]/15 border-[#6366F1]/30 text-[#A5B4FC]',
  };
  return (
    <span
      className={`inline-flex items-center px-2.5 py-0.5 rounded-lg border text-[11px] font-bold font-satoshi ${tones[tone]}`}
    >
      {children}
    </span>
  );
}

function SectionLabel({ children }: { children: React.ReactNode }) {
  return (
    <span className="text-[10px] font-mono font-bold tracking-wider text-[#8E8A86] uppercase">
      {children}
    </span>
  );
}

/**
 * Security & 2FA tab — EventDetails-inspired layout. Preference + actions only.
 */
export function SecurityTab({
  isUnlocked,
  onLockVault,
  onUnlockVault,
  loadingPasskeys,
  passkeyEntries,
  onAddPasskey,
  onRemovePasskey,
  accountMfaEnabled,
  mfaFactors,
  onManageMfa,
}: Props) {
  return (
    <div className="flex flex-col gap-6 pb-24 max-w-3xl text-white">
      {/* Hero */}
      <div className="relative overflow-hidden rounded-[28px] border border-white/[0.06] bg-[#161412]">
        <div
          className="absolute inset-0 opacity-90"
          style={{
            background:
              'radial-gradient(ellipse at 20% 0%, rgba(99,102,241,0.28), transparent 55%), radial-gradient(ellipse at 90% 100%, rgba(16,185,129,0.12), transparent 45%), #0A0908',
          }}
        />
        <div className="relative p-6 md:p-8 flex flex-col gap-4">
          <div className="flex flex-wrap gap-2">
            <MetaChip tone={isUnlocked ? 'good' : 'warn'}>
              Vault {isUnlocked ? 'unlocked' : 'locked'}
            </MetaChip>
            <MetaChip tone={accountMfaEnabled ? 'good' : 'neutral'}>
              2FA {accountMfaEnabled ? 'on' : 'off'}
            </MetaChip>
            <MetaChip tone={passkeyEntries.length ? 'accent' : 'neutral'}>
              {passkeyEntries.length} passkey{passkeyEntries.length === 1 ? '' : 's'}
            </MetaChip>
          </div>
          <div className="flex items-start gap-4">
            <div className="p-3 rounded-2xl bg-white/5 border border-white/10 text-[#6366F1] shrink-0">
              <ShieldCheck className="w-6 h-6" />
            </div>
            <div className="min-w-0">
              <h2 className="text-2xl font-black font-clash tracking-tight leading-snug">
                Security &amp; 2FA
              </h2>
              <p className="mt-1.5 text-sm text-[#C1BEBA] font-satoshi leading-relaxed max-w-xl">
                Unlock your private vault, manage passkeys, and keep account sign-in
                protected.
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* Vault */}
      <section id="vault-status" className="flex flex-col gap-2">
        <SectionLabel>Private vault</SectionLabel>
        <div className="p-4 rounded-[20px] bg-[#0A0908] border border-white/[0.04] shadow-[0_8px_24px_rgba(0,0,0,0.45)] flex flex-col gap-4">
          <div className="flex items-start gap-3">
            <div
              className={`p-2.5 rounded-xl border flex-shrink-0 ${
                isUnlocked
                  ? 'bg-emerald-500/10 border-emerald-500/25 text-emerald-400'
                  : 'bg-amber-500/10 border-amber-500/25 text-amber-300'
              }`}
            >
              {isUnlocked ? <LockOpen className="w-4 h-4" /> : <Lock className="w-4 h-4" />}
            </div>
            <div className="flex-1 min-w-0">
              <h3 className="text-sm font-bold text-white leading-tight">
                {isUnlocked ? 'Unlocked on this device' : 'Locked on this device'}
              </h3>
              <p className="text-xs text-[#8E8A86] mt-1 font-satoshi leading-relaxed">
                {isUnlocked
                  ? 'Private passwords and locked items are readable in this session.'
                  : 'Private passwords and locked items stay sealed until you unlock.'}
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={isUnlocked ? onLockVault : onUnlockVault}
            className={`w-full sm:w-auto sm:self-start py-3 px-5 rounded-[14px] font-bold text-sm font-satoshi transition-all cursor-pointer border-none ${
              isUnlocked
                ? 'bg-amber-500 hover:bg-amber-600 text-black'
                : 'bg-[#6366F1] hover:bg-[#4F46E5] text-white'
            }`}
          >
            {isUnlocked ? 'Lock vault' : 'Unlock vault'}
          </button>
        </div>
      </section>

      {/* Passkeys */}
      <section id="passkeys-setup" className="flex flex-col gap-2">
        <div className="flex items-center justify-between gap-3">
          <SectionLabel>Passkeys</SectionLabel>
          <button
            type="button"
            onClick={onAddPasskey}
            className="inline-flex items-center gap-1.5 py-2 px-3 rounded-xl bg-[#1C1A18] hover:bg-[#242220] border border-[#34322F] hover:border-[#6366F1] text-white text-xs font-bold font-satoshi transition-all cursor-pointer"
          >
            <Plus className="w-3.5 h-3.5" />
            Add passkey
          </button>
        </div>

        <div className="rounded-[20px] bg-[#0A0908] border border-white/[0.04] overflow-hidden">
          {loadingPasskeys ? (
            <div className="p-8 flex justify-center">
              <div className="animate-spin rounded-full h-7 w-7 border-b-2 border-[#6366F1]" />
            </div>
          ) : passkeyEntries.length === 0 ? (
            <div className="p-6 flex flex-col items-center text-center gap-3">
              <div className="p-3 rounded-2xl bg-white/5 border border-white/10 text-[#6366F1]">
                <Fingerprint className="w-7 h-7" />
              </div>
              <div>
                <p className="text-sm font-bold text-white">No passkeys yet</p>
                <p className="text-xs text-[#8E8A86] mt-1 font-satoshi max-w-sm leading-relaxed">
                  Add a fingerprint or device passkey to unlock your vault faster — and
                  optionally sign in with it.
                </p>
              </div>
              <button
                type="button"
                onClick={onAddPasskey}
                className="mt-1 py-2.5 px-4 rounded-[12px] bg-[#6366F1] hover:bg-[#4F46E5] text-white text-xs font-bold font-satoshi cursor-pointer border-none"
              >
                Set up passkey
              </button>
            </div>
          ) : (
            <ul className="divide-y divide-white/[0.04]">
              {passkeyEntries.map((pk) => {
                const created = passkeyCreatedAt(pk);
                const uses = passkeyUseLabels(pk);
                const device = passkeyDeviceKind(pk);
                return (
                  <li
                    key={pk.$id}
                    className="p-4 md:p-5 flex flex-col sm:flex-row sm:items-center gap-4"
                  >
                    <div className="flex items-start gap-3 flex-1 min-w-0">
                      <div className="p-2.5 rounded-xl bg-[#6366F1]/15 border border-[#6366F1]/25 text-[#A5B4FC] shrink-0">
                        <Fingerprint className="w-5 h-5" />
                      </div>
                      <div className="min-w-0 flex-1 space-y-2">
                        <div>
                          <h4 className="text-sm font-bold text-white truncate font-clash">
                            {pk.params?.name || 'Device passkey'}
                          </h4>
                          <div className="flex flex-wrap gap-1.5 mt-2">
                            {uses.map((label) => (
                              <MetaChip key={label} tone="accent">
                                {label}
                              </MetaChip>
                            ))}
                            <MetaChip>
                              <span className="inline-flex items-center gap-1">
                                <Laptop className="w-3 h-3 opacity-70" />
                                {device}
                              </span>
                            </MetaChip>
                            {pk.params?.prf ? <MetaChip tone="good">Secure unlock</MetaChip> : null}
                          </div>
                        </div>
                        <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-[11px] text-[#8E8A86] font-satoshi">
                          {created ? (
                            <span className="inline-flex items-center gap-1">
                              <Clock className="w-3 h-3" />
                              Added{' '}
                              {formatDateWithFallback(created, {
                                year: 'numeric',
                                month: 'short',
                                day: 'numeric',
                              })}
                            </span>
                          ) : null}
                          {pk.params?.rpId ? (
                            <span className="truncate opacity-70">{pk.params.rpId}</span>
                          ) : null}
                        </div>
                      </div>
                    </div>
                    <button
                      type="button"
                      onClick={() => onRemovePasskey(pk.$id)}
                      className="inline-flex items-center justify-center gap-1.5 self-stretch sm:self-center py-2.5 px-3.5 rounded-xl bg-red-500/10 hover:bg-red-500/20 border border-red-500/20 text-red-400 text-xs font-bold font-satoshi transition-all cursor-pointer shrink-0"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                      Remove
                    </button>
                  </li>
                );
              })}
            </ul>
          )}
        </div>
      </section>

      <RememberUnlockSettings />

      {/* 2FA */}
      <section id="mfa" className="flex flex-col gap-2">
        <SectionLabel>Two-step sign-in</SectionLabel>
        <div className="p-4 rounded-[20px] bg-[#0A0908] border border-white/[0.04] shadow-[0_8px_24px_rgba(0,0,0,0.45)] flex flex-col gap-4">
          <div className="flex items-start gap-3">
            <div
              className={`p-2.5 rounded-xl border flex-shrink-0 ${
                accountMfaEnabled
                  ? 'bg-emerald-500/10 border-emerald-500/25 text-emerald-400'
                  : 'bg-white/5 border-white/10 text-white/50'
              }`}
            >
              {accountMfaEnabled ? (
                <ShieldCheck className="w-4 h-4" />
              ) : (
                <ShieldAlert className="w-4 h-4" />
              )}
            </div>
            <div className="flex-1 min-w-0">
              <h3 className="text-sm font-bold text-white leading-tight">
                {accountMfaEnabled ? '2FA is on' : '2FA is off'}
              </h3>
              <p className="text-xs text-[#8E8A86] mt-1 font-satoshi leading-relaxed">
                Turn on both email codes and an authenticator app for full 2FA.
              </p>
            </div>
          </div>

          <div className="flex flex-col gap-2">
            <div className="flex items-center gap-3 p-3 rounded-2xl bg-[#161412] border border-white/[0.04]">
              <div className="p-2 rounded-xl bg-white/5 border border-white/10 text-[#6366F1]">
                <Mail className="w-4 h-4" />
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-bold text-white">Email codes</p>
                <p className="text-[11px] text-[#8E8A86] font-satoshi">
                  Codes sent to your email when signing in
                </p>
              </div>
              <MetaChip tone={mfaFactors?.email ? 'good' : 'neutral'}>
                {mfaFactors?.email ? 'On' : 'Off'}
              </MetaChip>
            </div>
            <div className="flex items-center gap-3 p-3 rounded-2xl bg-[#161412] border border-white/[0.04]">
              <div className="p-2 rounded-xl bg-white/5 border border-white/10 text-[#6366F1]">
                <Smartphone className="w-4 h-4" />
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-bold text-white">Authenticator app</p>
                <p className="text-[11px] text-[#8E8A86] font-satoshi">
                  Time-based codes from an app on your phone
                </p>
              </div>
              <MetaChip tone={mfaFactors?.totp ? 'good' : 'neutral'}>
                {mfaFactors?.totp ? 'On' : 'Off'}
              </MetaChip>
            </div>
          </div>

          <button
            type="button"
            onClick={onManageMfa}
            className="w-full py-3 px-4 rounded-[14px] bg-[#6366F1] hover:bg-[#4F46E5] text-white font-bold text-sm font-satoshi transition-all flex items-center justify-center gap-2 cursor-pointer border-none"
          >
            <KeyRound className="w-4 h-4" />
            {accountMfaEnabled ? 'Manage 2FA' : 'Set up 2FA'}
          </button>
        </div>
      </section>
    </div>
  );
}
