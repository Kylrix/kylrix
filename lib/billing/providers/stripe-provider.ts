import { PaymentProvider, CheckoutSession } from '../provider-factory';
import { PaymentMethod } from '../types';
import Stripe from 'stripe';

let stripeInstance: Stripe | null = null;

function getStripe() {
  if (!stripeInstance) {
    stripeInstance = new Stripe(process.env.STRIPE_SECRET_KEY || '', {
      apiVersion: '2026-01-28.clover' as any,
    });
  }
  return stripeInstance;
}

export class StripeProvider implements PaymentProvider {
  name = PaymentMethod.STRIPE;

  async createCheckoutSession(
    planId: string,
    userId: string,
    _countryCode: string = 'US',
    months: number = 1,
    email?: string,
    giftDetails?: { recipientUserId: string; recipientName?: string; giftMessage?: string },
    _options?: { couponId?: string | null; discountPercent?: number | null; adjustedAmountUsd?: number | null },
  ): Promise<CheckoutSession> {
    const stripe = getStripe();
    const isGift = Boolean(giftDetails?.recipientUserId);
    const session = await stripe.checkout.sessions.create({
      payment_method_types: ['card'],
      customer_email: email,
      line_items: [
        {
          price: planId, // planId should be the Stripe Price ID
          quantity: months,
        },
      ],

      mode: months >= 12 ? 'subscription' : 'payment', // Adjust mode based on months if needed

      success_url: `${process.env.NEXT_PUBLIC_APP_URL}/settings/billing?success=true`,
      cancel_url: `${process.env.NEXT_PUBLIC_APP_URL}/settings/billing?canceled=true`,
      client_reference_id: userId,
      metadata: {
        userId,
        isGift: isGift ? 'true' : 'false',
        giftRecipientId: giftDetails?.recipientUserId || '',
        giftRecipientName: giftDetails?.recipientName || '',
        giftMessage: giftDetails?.giftMessage || '',
      },
    });

    return {
      id: session.id,
      url: session.url || '',
      provider: this.name,
    };
  }

  async verifyTransaction(transactionId: string): Promise<boolean> {
    const stripe = getStripe();
    const session = await stripe.checkout.sessions.retrieve(transactionId);
    return session.payment_status === 'paid';
  }

  async handleWebhook(_payload: any, _signature?: string): Promise<void> {
    // Standard Stripe webhook logic
  }
}
