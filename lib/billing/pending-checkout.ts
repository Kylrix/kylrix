/**
 * Provider-agnostic pending checkout registry.
 * BlockBee IPN and future webhooks resolve fulfillment via payment_id + adapter id.
 */

export type {
  BlockBeePendingCheckoutMeta as PendingCheckoutMeta} from '@/lib/services/internal/blockbee-pending-checkout';

export {
  registerBlockBeePendingCheckout as registerPendingCheckout,
  getBlockBeePendingCheckout as getPendingCheckout,
  markBlockBeePendingCheckoutConsumed as markPendingCheckoutConsumed,
  acquireBlockBeeIpnLock as acquireCheckoutIpnLock,
  completeBlockBeeIpnLock as completeCheckoutIpnLock,
  releaseBlockBeeIpnLock as releaseCheckoutIpnLock} from '@/lib/services/internal/blockbee-pending-checkout';

import { registerBlockBeePendingCheckout } from '@/lib/services/internal/blockbee-pending-checkout';

export async function registerPendingCheckoutWithAdapter(
  meta: Omit<
    import('@/lib/services/internal/blockbee-pending-checkout').BlockBeePendingCheckoutMeta,
    'createdAt'
  > & { providerAdapterId?: string },
) {
  const { providerAdapterId: _adapter, ...rest } = meta;
  return registerBlockBeePendingCheckout(rest);
}
