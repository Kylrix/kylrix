import { PaymentProvider, CheckoutSession } from '../provider-factory';
import { PaymentMethod } from '../types';
import { calculateSubscriptionPrice } from '../../subscription/ppp';
import {
  resolveBlockBeeNotifyBaseUrl,
  resolveBlockBeeRedirectBaseUrl,
} from '../blockbee-urls';

export class CryptoPaymentProvider implements PaymentProvider {
  name = PaymentMethod.CRYPTO;

  async createCheckoutSession(
    planId: string,
    userId: string,
    countryCode: string = 'US',
    months: number = 1,
    email?: string,
    giftDetails?: { recipientUserId: string; recipientName?: string; giftMessage?: string },
    options?: { couponId?: string | null; discountPercent?: number | null; adjustedAmountUsd?: number | null; baseUrl?: string | null },
  ): Promise<CheckoutSession> {
    const blockbeeApiKey = process.env.BLOCKBEE_API;

    if (!blockbeeApiKey) {
      throw new Error('BLOCKBEE_API environment variable is not configured');
    }

    // BlockBee whitelists fixed production notify/redirect URIs from the dashboard.
    const notifyUrl = new URL(resolveBlockBeeNotifyBaseUrl());
    notifyUrl.searchParams.set('order_id', userId);
    notifyUrl.searchParams.set('plan_id', planId);
    notifyUrl.searchParams.set('months', String(months));
    if (options?.couponId) {
      notifyUrl.searchParams.set('coupon_id', String(options.couponId));
    }
    if (typeof options?.discountPercent === 'number') {
      notifyUrl.searchParams.set('discount_percent', String(options.discountPercent));
    }
    if (giftDetails?.recipientUserId) {
      notifyUrl.searchParams.set('gift_recipient_id', giftDetails.recipientUserId);
      if (giftDetails.recipientName) notifyUrl.searchParams.set('gift_recipient_name', giftDetails.recipientName);
      if (giftDetails.giftMessage) notifyUrl.searchParams.set('gift_message', giftDetails.giftMessage);
    }

    const successUrlObj = new URL(resolveBlockBeeRedirectBaseUrl());
    successUrlObj.searchParams.set('order_id', userId);

    // Dynamic Pricing based on PPP
    const baseAmount = calculateSubscriptionPrice(planId, countryCode, 'CRYPTO', months);
    const amount = typeof options?.adjustedAmountUsd === 'number' ? options.adjustedAmountUsd : baseAmount;

    console.log(`[BlockBee] Initiating checkout for user: ${userId} (${email}), Plan: ${planId}, Months: ${months}, Region: ${countryCode}, Amount: ${amount} USD`);
    console.log(`[BlockBee] notify_url=${notifyUrl.toString()} redirect_url=${successUrlObj.toString()}`);

    try {
      // Call BlockBee Checkout Request API (GET)
      const queryParams: any = {
        apikey: blockbeeApiKey,
        value: amount.toString(),
        currency: 'USD',
        redirect_url: successUrlObj.toString(),
        notify_url: notifyUrl.toString(),
        post: '1' // Receive IPN as POST
      };

      if (email) {
        queryParams.customer_email = email;
      }

      const queryString = new URLSearchParams(queryParams).toString();
      const response = await fetch(`https://api.blockbee.io/checkout/request/?${queryString}`);
      const data = await response.json();


      if (data.status !== 'success') {
        const errMsg = data.error || data.message || (typeof data === 'object' ? JSON.stringify(data) : String(data));
        throw new Error(`BlockBee API Error: ${errMsg}`);
      }

      const paymentId = String(data.payment_id || '').trim();

      return {
        id: paymentId,
        url: data.payment_url,
        provider: this.name,
      };
    } catch (error) {
      console.error('[BlockBee] Failed to create session:', error);
      throw error;
    }
  }

  async verifyTransaction(_transactionId: string): Promise<boolean> {
    // Logic to verify transaction status via BlockBee API if needed
    return true; 
  }

  async handleWebhook(payload: any, _signature?: string): Promise<void> {
    // This provider is used within the Next.js API route logic
    console.log('[BlockBee] Webhook received', payload);
  }
}
