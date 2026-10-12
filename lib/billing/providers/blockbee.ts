import type { BillingProviderAdapter, CheckoutSession, CreateCheckoutInput } from '@/lib/billing/providers/types';
import { PaymentMethod } from '@/lib/billing/types';

const DEFAULT_API_BASE = 'https://api.blockbee.io';

function apiBase(): string {
  return (process.env.BLOCKBEE_API_BASE || DEFAULT_API_BASE).replace(/\/+$/, '');
}

export class BlockBeeBillingAdapter implements BillingProviderAdapter {
  id = 'blockbee';
  method = PaymentMethod.CRYPTO;
  displayName = 'BlockBee';

  isConfigured(): boolean {
    return Boolean(process.env.BLOCKBEE_API?.trim());
  }

  async createCheckoutSession(input: CreateCheckoutInput): Promise<CheckoutSession> {
    const blockbeeApiKey = process.env.BLOCKBEE_API?.trim();
    if (!blockbeeApiKey) {
      throw new Error('BLOCKBEE_API environment variable is not configured');
    }

    const queryParams: Record<string, string> = {
      apikey: blockbeeApiKey,
      value: input.amountUsd.toString(),
      currency: 'USD',
      redirect_url: input.redirectUrl,
      notify_url: input.notifyUrl,
      post: '1',
    };
    if (input.email) {
      queryParams.customer_email = input.email;
    }

    const queryString = new URLSearchParams(queryParams).toString();
    const response = await fetch(`${apiBase()}/checkout/request/?${queryString}`);
    const data = await response.json();

    if (data.status !== 'success') {
      const errMsg =
        data.error || data.message || (typeof data === 'object' ? JSON.stringify(data) : String(data));
      throw new Error(`BlockBee API Error: ${errMsg}`);
    }

    const paymentId = String(data.payment_id || '').trim();
    if (!paymentId || !data.payment_url) {
      throw new Error('BlockBee API returned an incomplete checkout session');
    }

    return {
      id: paymentId,
      url: data.payment_url,
      provider: this.method,
      adapterId: this.id,
    };
  }

  async createDirectCryptoAddress(
    ticker: string,
    input: CreateCheckoutInput,
  ): Promise<{
    paymentId: string;
    addressIn: string;
    qrCode?: string;
    paymentUri?: string;
    minimumTransactionCoin?: number;
    coin: string;
  }> {
    const blockbeeApiKey = process.env.BLOCKBEE_API?.trim();
    if (!blockbeeApiKey) {
      throw new Error('BLOCKBEE_API environment variable is not configured');
    }

    const cleanTicker = String(ticker || 'polygon/usdt')
      .trim()
      .toLowerCase();

    const queryParams: Record<string, string> = {
      apikey: blockbeeApiKey,
      callback: input.notifyUrl,
      value: input.amountUsd.toString(),
      currency: 'USD',
      post: '1',
    };

    const queryString = new URLSearchParams(queryParams).toString();
    const response = await fetch(`${apiBase()}/${cleanTicker}/create/?${queryString}`);
    const data = await response.json();

    if (data.status !== 'success') {
      const errMsg =
        data.error || data.message || (typeof data === 'object' ? JSON.stringify(data) : String(data));
      throw new Error(`BlockBee Direct Payment Error: ${errMsg}`);
    }

    const addressIn = String(data.address_in || '').trim();
    if (!addressIn) {
      throw new Error('BlockBee API did not return an incoming deposit address');
    }

    return {
      paymentId: addressIn,
      addressIn,
      qrCode: data.qr_code || null,
      paymentUri: data.payment_uri || null,
      minimumTransactionCoin: typeof data.minimum_transaction_coin === 'number' ? data.minimum_transaction_coin : undefined,
      coin: cleanTicker,
    };
  }

  getSupportedCoins(): Array<{
    ticker: string;
    name: string;
    network: string;
    symbol: string;
    recommended?: boolean;
  }> {
    return [
      { ticker: 'polygon/usdt', name: 'Tether USD (Polygon POS)', network: 'Polygon', symbol: 'USDT', recommended: true },
      { ticker: 'solana/usdt', name: 'Tether USD (Solana)', network: 'Solana', symbol: 'USDT', recommended: true },
      { ticker: 'tron/usdt', name: 'Tether USD (TRON TRC-20)', network: 'TRON', symbol: 'USDT', recommended: true },
      { ticker: 'btc', name: 'Bitcoin', network: 'Bitcoin', symbol: 'BTC' },
      { ticker: 'eth', name: 'Ethereum', network: 'Ethereum', symbol: 'ETH' },
      { ticker: 'sol', name: 'Solana', network: 'Solana', symbol: 'SOL' },
      { ticker: 'trx', name: 'TRON', network: 'TRON', symbol: 'TRX' },
      { ticker: 'ltc', name: 'Litecoin', network: 'Litecoin', symbol: 'LTC' },
      { ticker: 'doge', name: 'Dogecoin', network: 'Dogecoin', symbol: 'DOGE' },
    ];
  }

  async verifyTransaction(_transactionId: string): Promise<boolean> {
    return true;
  }
}

