export enum SubscriptionTier {
  FREE = 'FREE',
  PRO = 'PRO',
  LIFETIME = 'LIFETIME',
  STUDENT = 'STUDENT',
  TEAM = 'TEAM'
}

export enum PaymentMethod {
  CRYPTO = 'CRYPTO',
  STRIPE = 'STRIPE',
  MANUAL = 'MANUAL',
  COUPON = 'COUPON',
  GIFT = 'GIFT'
}

export interface BillingPlan {
  id: string;
  name: string;
  price: number;
  interval: 'monthly' | 'yearly' | 'lifetime';
  features: string[];
}

export interface Coupon {
  code: string;
  discountType: 'percentage' | 'fixed';
  discountValue: number;
  metadata?: {
    isStudent?: boolean;
    toggled?: boolean;
    source?: string;
  };
}

export interface SubscriptionStatus {
  tier: SubscriptionTier;
  isActive: boolean;
  expiresAt: string | null;
  paymentMethod: PaymentMethod;
  isToggled: boolean; // Manual override flag
  grantorId?: string; // If gifted/subsidized
}
