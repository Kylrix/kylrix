'use server';

import { ID, Permission, Query, Role } from 'node-appwrite';
import { createSystemClient } from '@/lib/appwrite-admin';
import { APPWRITE_CONFIG } from '@/lib/appwrite/config';
import { calculateSubscriptionPrice } from '@/lib/subscription/ppp';
import { getAuthenticatedUserForBillingAction } from '@/lib/services/internal/billing';

const NOTE_DB_ID = APPWRITE_CONFIG.DATABASES.NOTE;

export interface CryptoInvoiceResponse {
  success: boolean;
  address_in?: string;
  minimum_transaction_coin?: number;
  expected_crypto?: number;
  expected_usd?: number;
  paymentId?: string;
  ticker?: string;
  months?: number;
  error?: string;
}

export async function createCryptoInvoiceAction(input: {
  ticker: string;
  planId: string;
  months: number;
  countryCode: string;
  jwt?: string;
  baseUrl?: string;
}): Promise<CryptoInvoiceResponse> {
  const { ticker, planId, months, countryCode, jwt, baseUrl } = input;
  
  try {
    const user = await getAuthenticatedUserForBillingAction({ jwt });
    if (!user) {
      return { success: false, error: 'Authentication required' };
    }

    const blockbeeApiKey = process.env.BLOCKBEE_API;
    if (!blockbeeApiKey) {
      return { success: false, error: 'Payment gateway configuration is missing' };
    }

    const normalizedMonths = Math.max(1, Math.floor(months || 1));
    const usdAmount = calculateSubscriptionPrice(planId, countryCode, 'CRYPTO', normalizedMonths);

    // 1. Get Crypto Conversion
    const convertRes = await fetch(
      `https://api.blockbee.io/${ticker.toLowerCase()}/convert/?value=${usdAmount}&from=USD&apikey=${blockbeeApiKey}`
    ).then(r => r.json()).catch(() => null);

    if (!convertRes || convertRes.status !== 'success') {
      return { success: false, error: `Failed to calculate conversion rate for ${ticker.toUpperCase()}` };
    }

    const expectedCrypto = parseFloat(convertRes.value_coin);

    // 2. Fetch Ticker info / limits
    const infoRes = await fetch(
      `https://api.blockbee.io/${ticker.toLowerCase()}/info/?apikey=${blockbeeApiKey}`
    ).then(r => r.json()).catch(() => null);

    const minimumLimit = infoRes && infoRes.status === 'success' ? parseFloat(infoRes.minimum_transaction_coin) : 0;

    if (expectedCrypto < minimumLimit) {
      return { 
        success: false, 
        error: `The total amount (${expectedCrypto} ${ticker.toUpperCase()}) falls below BlockBee minimum transaction limit (${minimumLimit} ${ticker.toUpperCase()}). Please choose a longer plan duration.` 
      };
    }

    // 3. Request input address
    const paymentId = `invoice_${user.$id}_${Date.now()}`;
    const resolvedBaseUrl = String(baseUrl || process.env.NEXT_PUBLIC_APP_URL || 'https://accounts.kylrix.space').replace(/\/+$/, '');
    const callbackUrl = encodeURIComponent(`${resolvedBaseUrl}/accounts/api/pro/notify?payment_id=${paymentId}&order_id=${user.$id}&plan_id=${planId}&months=${normalizedMonths}`);

    const createRes = await fetch(
      `https://api.blockbee.io/${ticker.toLowerCase()}/create/?callback=${callbackUrl}&apikey=${blockbeeApiKey}&pending=1&post=1&json=1`
    ).then(r => r.json()).catch(() => null);

    if (!createRes || createRes.status !== 'success') {
      return { success: false, error: 'Failed to generate payment address' };
    }

    const addressIn = createRes.address_in;

    // Register inside BlockBee pending checkout registry for the webhook notify endpoint
    const { registerBlockBeePendingCheckout } = await import('@/lib/services/internal/blockbee-pending-checkout');
    await registerBlockBeePendingCheckout({
      paymentId: paymentId,
      payerUserId: user.$id,
      planId: planId,
      months: normalizedMonths,
      countryCode: countryCode,
      expectedAmountUsd: usdAmount,
    });

    // 4. Record pending transaction in Appwrite database
    const { databases } = createSystemClient();
    await databases.createDocument(
      NOTE_DB_ID,
      'billing_transactions',
      ID.unique(),
      {
        paymentId: paymentId,
        userId: user.$id,
        plan: planId,
        months: normalizedMonths,
        amountCents: Math.round(usdAmount * 100),
        amountUsd: `$${usdAmount.toFixed(2)}`,
        status: 'pending',
        provider: 'blockbee',
        metadata: JSON.stringify({
          ticker: ticker.toUpperCase(),
          address_in: addressIn,
          expected_crypto: expectedCrypto,
          countryCode: countryCode,
          createdAt: new Date().toISOString(),
        }),
      },
      [Permission.read(Role.user(user.$id))]
    );

    return {
      success: true,
      address_in: addressIn,
      minimum_transaction_coin: minimumLimit,
      expected_crypto: expectedCrypto,
      expected_usd: usdAmount,
      paymentId: paymentId,
      ticker: ticker.toUpperCase(),
      months: normalizedMonths
    };

  } catch (err: any) {
    console.error('[CryptoInvoice] Error creating crypto session:', err);
    return { success: false, error: err.message || 'Payment generation failed' };
  }
}

export async function checkCryptoTransactionStatusAction(input: {
  paymentId: string;
  jwt?: string;
}): Promise<{ status: string }> {
  try {
    const user = await getAuthenticatedUserForBillingAction({ jwt: input.jwt });
    if (!user) throw new Error('Unauthenticated');

    const { databases } = createSystemClient();
    const list = await databases.listDocuments(
      NOTE_DB_ID,
      'billing_transactions',
      [
        Query.equal('paymentId', input.paymentId),
        Query.equal('userId', user.$id),
        Query.limit(1)
      ]
    );

    const doc = list.rows[0];
    if (!doc) return { status: 'unknown' };
    return { status: doc.status || 'pending' };
  } catch {
    return { status: 'unknown' };
  }
}

export async function getActivePendingCryptoInvoiceAction(input: {
  jwt?: string;
}): Promise<CryptoInvoiceResponse | null> {
  try {
    const user = await getAuthenticatedUserForBillingAction({ jwt: input.jwt });
    if (!user) return null;

    const { databases } = createSystemClient();
    const list = await databases.listDocuments(
      NOTE_DB_ID,
      'billing_transactions',
      [
        Query.equal('userId', user.$id),
        Query.equal('status', 'pending'),
        Query.equal('provider', 'blockbee'),
        Query.orderDesc('createdAt'),
        Query.limit(1)
      ]
    );

    const doc = list.rows[0];
    if (!doc) return null;

    const meta = doc.metadata ? JSON.parse(doc.metadata) : {};
    
    // Validate if the session is older than 2 hours to avoid stale transactions
    const createdAtMs = new Date(meta.createdAt || doc.$createdAt).getTime();
    if (Date.now() - createdAtMs > 2 * 60 * 60 * 1000) {
      return null;
    }

    return {
      success: true,
      address_in: meta.address_in,
      minimum_transaction_coin: meta.minimum_transaction_coin || 0,
      expected_crypto: meta.expected_crypto,
      expected_usd: doc.amountCents ? doc.amountCents / 100 : parseFloat(String(doc.amountUsd || '').replace('$', '')),
      paymentId: doc.paymentId,
      ticker: meta.ticker,
      months: doc.months
    };
  } catch {
    return null;
  }
}
