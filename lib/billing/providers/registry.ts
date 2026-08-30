/**
 * Billing provider registry — select adapters via env without hardcoding BlockBee.
 *
 * BILLING_CRYPTO_PROVIDER=blockbee|stub  (default: blockbee when BLOCKBEE_API set, else stub)
 * BILLING_ENABLED_METHODS=CRYPTO          (comma-separated PaymentMethod ids)
 */

import { parseEnvCsv } from '@/lib/config/env-flags';
import type { BillingProviderAdapter } from '@/lib/billing/providers/types';
import { BlockBeeBillingAdapter } from '@/lib/billing/providers/blockbee';
import { StubBillingAdapter } from '@/lib/billing/providers/stub';
import { PaymentMethod } from '@/lib/billing/types';

const ADAPTERS: BillingProviderAdapter[] = [
  new BlockBeeBillingAdapter(),
  new StubBillingAdapter(),
];

const adapterById = new Map(ADAPTERS.map((a) => [a.id, a]));

export function listBillingAdapters(): BillingProviderAdapter[] {
  return [...ADAPTERS];
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
        `Unknown BILLING_CRYPTO_PROVIDER="${explicit}". Available: ${ADAPTERS.map((a) => a.id).join(', ')}`,
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
  throw new Error(`No billing adapter registered for payment method: ${method}`);
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
