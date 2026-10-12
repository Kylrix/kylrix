/**
 * Client-safe pricing plan snapshot (inlined at build time via next.config.js).
 */

export type PublicPricingPlan = {
  index: number;
  name: string;
  description: string;
  priceUsd: number;
  ledgerKey: string;
  exclusiveFeatures: Array<{ id: string; label: string }>;
};

export function getPublicPricingPlans(): PublicPricingPlan[] {
  const raw = process.env.NEXT_PUBLIC_PRICING_PLANS_JSON;
  if (!raw) return [];
  try {
    const parsed = JSON.parse(raw) as PublicPricingPlan[];
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

/** Client plans with Pro/Teams fallback when build JSON is empty. */
export function getPublicPricingPlansOrDefault(): PublicPricingPlan[] {
  const plans = getPublicPricingPlans();
  if (plans.length > 0) return plans;
  return [
    {
      index: 1,
      name: 'Pro',
      description: 'Full private suite for individuals',
      priceUsd: 10,
      ledgerKey: 'PRO',
      exclusiveFeatures: [
        { id: 'ai', label: 'Intelligent AI Sidekick & Agents' },
        { id: 'voice', label: 'Audio messages & voice notes' },
        { id: 'file_upload', label: 'Cloud file storage & attachments' },
        { id: 'sharing', label: 'Direct sharing & collaborators on objects' },
        { id: 'pinned_notes', label: 'Pinned notes' },
        { id: 'discussions', label: 'Resource discussions' },
      ],
    },
    {
      index: 2,
      name: 'Teams',
      description: 'Projects, higher API limits, and group hangouts',
      priceUsd: 50,
      ledgerKey: 'TEAMS',
      exclusiveFeatures: [
        { id: 'ai', label: 'Intelligent AI Sidekick & Agents' },
        { id: 'projects', label: 'Projects & team workspaces' },
        { id: 'group_hangouts', label: 'Group hangouts & channels' },
        { id: 'api_limits', label: 'Higher API rate limits' },
        { id: 'sharing', label: 'Direct sharing & collaborators on objects' },
        { id: 'file_upload', label: 'Cloud file storage & attachments' },
      ],
    },
  ];
}
