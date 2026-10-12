/**
 * Billing provider registry — env-selected adapters, zero bundled processor SDKs.
 *
 * Upstream ships only:
 *   - blockbee  (hosted crypto checkout via fetch — no npm package)
 *   - stub      (no processor; for AGPL self-host / local dev)
 *
 * Forks that need another processor (Stripe, BTCPay, etc.) must:
 *   1. Add their own npm dependency in the fork (not in upstream).
 *   2. Implement BillingProviderAdapter in the fork.
 *   3. Register it via registerBillingAdapter() from register-fork-providers.ts.
 *   4. Point BILLING_CRYPTO_PROVIDER (or a new method) at the adapter id.
 */

import { parseEnvCsv } from '@/lib/config/env-flags';
import type { BillingProviderAdapter } from '@/lib/billing/providers/types';
import { BlockBeeBillingAdapter } from '@/lib/billing/providers/blockbee';
import { StubBillingAdapter } from '@/lib/billing/providers/stub';
import { PaymentMethod } from '@/lib/billing/types';

const BUILTIN_ADAPTERS: BillingProviderAdapter[] = [
  new BlockBeeBillingAdapter(),
  new StubBillingAdapter(),
];

const adapterById = new Map<string, BillingProviderAdapter>(
  BUILTIN_ADAPTERS.map((adapter) => [adapter.id, adapter]),
);

/** Fork-registered adapters (never populated in upstream). */
const forkAdapters: BillingProviderAdapter[] = [];

export function registerBillingAdapter(adapter: BillingProviderAdapter): void {
  const id = adapter.id.trim().toLowerCase();
  if (!id) throw new Error('Billing adapter id is required');
  if (adapterById.has(id)) {
    throw new Error(`Billing adapter "${id}" is already registered`);
  }
  adapterById.set(id, adapter);
  forkAdapters.push(adapter);
}

export function listBillingAdapters(): BillingProviderAdapter[] {
  return [...BUILTIN_ADAPTERS, ...forkAdapters];
}

export function getBillingAdapter(adapterId: string): BillingProviderAdapter | undefined {
  return adapterById.get(adapterId.trim().toLowerCase());
}

export function resolveCryptoBillingAdapter(): BillingProviderAdapter {
  const explicit = (process.env.BILLING_CRYPTO_PROVIDER || '').trim().toLowerCase();
  if (explicit) {
    const adapter = getBillingAdapter(explicit);
    if (!adapter) {
      throw new Error(
        `Unknown BILLING_CRYPTO_PROVIDER="${explicit}". Registered: ${listBillingAdapters()
          .map((a) => a.id)
          .join(', ')}`,
      );
    }
    if (!adapter.isConfigured()) {
      throw new Error(`Billing adapter "${explicit}" is not configured for this deployment.`);
    }
    return adapter;
  }

  const blockbee = getBillingAdapter('blockbee')!;
  if (blockbee.isConfigured()) return blockbee;
  return getBillingAdapter('stub')!;
}

export function resolveBillingAdapterForMethod(method: PaymentMethod): BillingProviderAdapter {
  const normalized = String(method).toUpperCase();
  if (normalized === PaymentMethod.CRYPTO) {
    return resolveCryptoBillingAdapter();
  }
  throw new Error(
    `No built-in billing adapter for payment method "${method}". Forks must register one via registerBillingAdapter().`,
  );
}

export function listEnabledPaymentMethods(): PaymentMethod[] {
  const raw = parseEnvCsv(process.env.BILLING_ENABLED_METHODS);
  if (!raw.length) {
    return [PaymentMethod.CRYPTO];
  }
  const allowed = new Set(Object.values(PaymentMethod));
  return raw
    .map((v) => v.toUpperCase())
    .filter((v): v is PaymentMethod => allowed.has(v as PaymentMethod));
}

export function isPaymentMethodEnabled(method: PaymentMethod): boolean {
  return listEnabledPaymentMethods().includes(method);
}
