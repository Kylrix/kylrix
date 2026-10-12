import type { Metadata } from 'next';
import { buildOgMetadata } from '@/lib/og/share-card';

export const metadata: Metadata = {
  ...buildOgMetadata({
    title: 'Sponsor Kylrix · Open Source Support',
    description:
      'Support open source development and tools. Back with tips, crypto checkout, and earn sponsor badges.',
    imageUrl: 'https://www.kylrix.space/sponsor/opengraph-image',
  }),
  alternates: {
    canonical: 'https://www.kylrix.space/sponsor',
  },
};

export default function SponsorLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return <>{children}</>;
}
