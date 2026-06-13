import React from 'react';
import TermsOfServiceClient from './TermsOfServiceClient';

interface PageProps {
  searchParams: Promise<{ section?: string }>;
}

const sectionMetadata: Record<string, { title: string; description: string }> = {
  acceptance: {
    title: "1. Acceptance of Terms",
    description: "Legal consent and agreement required to use Kylrix cloud or self-hosted instances."
  },
  "provided-as-is": {
    title: "2. Provided As-Is Warranty Waiver",
    description: "Kylrix is provided strictly without warranty. Self-hosted instances are operated at your own risk."
  },
  liability: {
    title: "3. Limitation of Liability",
    description: "Limiting direct, indirect, and aggregate damages to fifty dollars ($50) or actual amounts paid."
  },
  "open-source": {
    title: "4. Open Source Licensing",
    description: "Source code auditing, forking, and distributions are governed by open source licenses."
  },
  "cloud-vs-selfhosted": {
    title: "5. Cloud Service & Self-Hosting",
    description: "Differentiation between hosted cloud operations and isolated self-hosted deployments."
  },
  responsibilities: {
    title: "6. User Responsibilities",
    description: "Requirements for credential security, backup management, and lawful usage of the software."
  },
  suspension: {
    title: "7. Account Suspension Policy",
    description: "Conditions for hosted service termination, resource limits, and service modifications."
  },
  disputes: {
    title: "8. Governing Law & Dispute Resolution",
    description: "Legal jurisdiction, venue guidelines, and courts governing terms interpretation."
  },
  changes: {
    title: "9. Changes to Terms",
    description: "Procedure for terms modification updates and continued usage consent."
  }
};

export async function generateMetadata({ searchParams }: PageProps) {
  const { section } = await searchParams;
  const sectionId = section || '';
  const meta = sectionMetadata[sectionId];
  
  const title = meta ? `${meta.title} · Terms of Service · Kylrix` : 'Terms of Service · Kylrix';
  const description = meta ? meta.description : 'These terms apply to our cloud service, the open-source software, and any self-hosted copy you run yourself.';
  
  const ogImageUrl = sectionId 
    ? `https://kylrix.space/terms-of-service/opengraph-image?section=${sectionId}`
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
  return <TermsOfServiceClient />;
}
