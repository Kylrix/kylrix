'use server';

import { Query } from 'node-appwrite';
import { createSystemClient } from '@/lib/appwrite-admin';
import { APPWRITE_CONFIG } from '@/lib/appwrite/config';
import { getAuthenticatedUserForBillingAction } from '@/lib/services/internal/billing';
import { createBillingCheckoutSessionAction } from './billing';

const NOTE_DB_ID = APPWRITE_CONFIG.DATABASES.NOTE;

export interface CryptoInvoiceResponse {
  success: boolean;
  paymentUrl?: string;
  paymentId?: string;
  error?: string;
  address_in?: string;
  minimum_transaction_coin?: number;
  expected_crypto?: string;
  expected_usd?: number;
  ticker?: string;
  months?: number;
}

function resolveBillingBaseUrl(baseUrl?: string) {
  const raw = String(baseUrl || process.env.NEXT_PUBLIC_APP_URL || 'https://accounts.kylrix.space')
    .trim()
    .replace(/\/+$/, '');
  return raw.endsWith('/accounts') ? raw : `${raw}/accounts`;
}

export async function createCryptoInvoiceAction(input: {
  ticker?: string;
  planId: string;
  months: number;
  countryCode: string;
  jwt?: string;
  baseUrl?: string;
}): Promise<CryptoInvoiceResponse> {
  const { planId, months, countryCode, jwt, baseUrl } = input;

  try {
    const session = await createBillingCheckoutSessionAction({
      planId,
      method: 'CRYPTO',
      countryCode,
      months,
      jwt,
      baseUrl: resolveBillingBaseUrl(baseUrl),
    });

    if (session?.url && session?.id) {
      return {
        success: true,
        paymentUrl: session.url,
        paymentId: session.id,
      };
    }

    const sessionError = 'error' in session ? session.error : undefined;
    return {
      success: false,
      error: typeof sessionError === 'string' ? sessionError : 'Failed to generate checkout session',
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
    const list = await databases.listRows(
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
    const list = await databases.listRows(
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
      expected_usd: meta.amountCents ? meta.amountCents / 100 : parseFloat(String(doc.amountUsd || '').replace('$', '')),
      paymentId: doc.paymentId,
      ticker: meta.ticker,
      months: meta.months || doc.months
    };
  } catch {
    return null;
  }
}

export async function getActiveBlockBeeCoinsAction(input: { jwt?: string }): Promise<{
  success: boolean;
  coins?: Array<{ id: string; name: string; symbol: string }>;
  error?: string;
}> {
  try {
    const user = await getAuthenticatedUserForBillingAction({ jwt: input.jwt });
    if (!user) throw new Error('Unauthenticated');

    const blockbeeApiKey = process.env.BLOCKBEE_API;
    if (!blockbeeApiKey) {
      throw new Error('Payment gateway configuration is missing');
    }

    const infoRes = await fetch(
      `https://api.blockbee.io/info/?apikey=${blockbeeApiKey}`
    ).then(r => r.json()).catch(() => null);

    const allowedTickers = new Set(['btc', 'ltc', 'sol', 'sol/sol', 'eth', 'trx_usdt', 'trc20_usdt', 'trc20/usdt']);

    if (!infoRes || infoRes.status === 'error') {
      // Fallback if API fails
      return {
        success: true,
        coins: [
          { id: 'btc', name: 'Bitcoin', symbol: 'BTC' },
          { id: 'ltc', name: 'Litecoin', symbol: 'LTC' },
          { id: 'sol/sol', name: 'Solana', symbol: 'SOL' },
          { id: 'eth', name: 'Ethereum', symbol: 'ETH' },
          { id: 'trc20/usdt', name: 'Tether (TRC20)', symbol: 'USDT' }
        ]
      };
    }

    const symbolMap: Record<string, string> = {
      btc: 'BTC',
      ltc: 'LTC',
      sol: 'SOL',
      'sol/sol': 'SOL',
      eth: 'ETH',
      trx_usdt: 'USDT (TRC20)',
      trc20_usdt: 'USDT (TRC20)',
      'trc20/usdt': 'USDT (TRC20)'
    };

    const coins: Array<{ id: string; name: string; symbol: string }> = [];

    for (const [key, val] of Object.entries(infoRes)) {
      if (!val || typeof val !== 'object') continue;
      const lowerKey = key.toLowerCase();

      if ('coin' in val) {
        if (allowedTickers.has(lowerKey)) {
          coins.push({
            id: lowerKey,
            name: (val as any).coin || symbolMap[lowerKey] || key.toUpperCase(),
            symbol: symbolMap[lowerKey] || key.toUpperCase()
          });
        }
      } else {
        for (const [tokenKey, tokenVal] of Object.entries(val)) {
          if (!tokenVal || typeof tokenVal !== 'object') continue;
          const compositeTicker = `${lowerKey}/${tokenKey.toLowerCase()}`;
          if (allowedTickers.has(compositeTicker)) {
            coins.push({
              id: compositeTicker,
              name: (tokenVal as any).coin || symbolMap[compositeTicker] || tokenKey.toUpperCase(),
              symbol: symbolMap[compositeTicker] || tokenKey.toUpperCase()
            });
          }
        }
      }
    }

    // Sort according to user preference sequence (BTC, LTC, SOL, ETH, USDT)
    const order = ['btc', 'ltc', 'sol/sol', 'sol', 'eth', 'trc20/usdt', 'trc20_usdt', 'trx_usdt'];
    coins.sort((a, b) => order.indexOf(a.id) - order.indexOf(b.id));

    return { success: true, coins };
  } catch (err: any) {
    return { success: false, error: err.message };
  }
}
