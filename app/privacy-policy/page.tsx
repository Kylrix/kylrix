import React from 'react';
import PrivacyPolicyClient from './PrivacyPolicyClient';

interface PageProps {
  searchParams: Promise<{ section?: string }>;
}

const sectionMetadata: Record<string, { title: string; description: string }> = {
  scope: {
    title: "1. Scope: Cloud vs Self-Hosted",
    description: "Overview of data boundaries on hosted cloud environments compared to isolated self-hosted deployments."
  },
  collection: {
    title: "2. What We Collect (Hosted Cloud)",
    description: "Account credentials, stored notes, diagnostic crash logs, and anonymized user tokens."
  },
  use: {
    title: "3. How We Use Data",
    description: "Authentication sync, database recovery procedures, and secure backend routing logistics."
  },
  diagnostics: {
    title: "4. Diagnostics & Stability Metrics",
    description: "System stability monitoring, error tracking, and optional smart context recording settings."
  },
  security: {
    title: "5. Security & Encryption",
    description: "Encryption implementations, secure transit protocols, and client-side password responsibilities."
  },
  "third-party": {
    title: "6. Third-Party Services & Infrastructure",
    description: "Subprocessors, payment gateways, messaging relays, and push notification transport layers."
  },
  retention: {
    title: "7. Retention, Export & Deletion",
    description: "Irreversible document purging, backup scheduling, and public data portability utilities."
  },
  choices: {
    title: "8. Your Choices & Rights",
    description: "Data access queries, correction tools, deletion request paths, and regional options."
  },
  warranty: {
    title: "9. No Warranty; Limitation of Liability",
    description: "Warranties disclaimer regarding privacy outcomes, and liability cap references."
  },
  updates: {
    title: "10. Children & Policy Updates",
    description: "Age restrictions (13+), changes notification schedule, and re-affirmation terms."
  }
};

export async function generateMetadata({ searchParams }: PageProps) {
  const { section } = await searchParams;
  const sectionId = section || '';
  const meta = sectionMetadata[sectionId];
  
  const title = meta ? `${meta.title} · Privacy Policy · Kylrix` : 'Privacy Policy · Kylrix';
  const description = meta ? meta.description : 'How we handle data on our cloud service — and what changes when you self-host.';
  
  const ogImageUrl = sectionId 
    ? `https://kylrix.space/privacy-policy/opengraph-image?section=${sectionId}`
    : 'https://kylrix.space/logo_social.png';

  return {
    title,
    description,
    openGraph: {
      title,
      description,
      images: [{ url: ogImageUrl, width: 1200, height: 630 }],
    },
    twitter: {
      card: 'summary_large_image',
      title,
      description,
      images: [ogImageUrl],
    },
  };
}

export default function Page() {
  return <PrivacyPolicyClient />;
}
