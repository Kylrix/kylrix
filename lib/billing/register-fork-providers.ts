/**
 * Fork extension hook — upstream is a no-op.
 *
 * In a fork, implement your processor adapter (install its npm package in the fork only),
 * then register it here. Example:
 *
 *   import { registerBillingAdapter } from '@/lib/billing/providers/registry';
 *   import { MyProcessorAdapter } from './my-processor-adapter';
 *
 *   export function registerForkBillingProviders(): void {
 *     registerBillingAdapter(new MyProcessorAdapter());
 *   }
 */

import { registerBillingAdapter } from '@/lib/billing/providers/registry';

export function registerForkBillingProviders(): void {
  // Intentionally empty in upstream Kylrix — forks edit this file.
}

export { registerBillingAdapter };
