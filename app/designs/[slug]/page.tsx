import { notFound } from 'next/navigation';
import DesignStudio from '@/components/designs/DesignStudio';
import { getDesignFlyerBySlug } from '@/components/designs/flyers';

export default function DesignFlyerPage({ params }: { params: { slug: string } }) {
  const flyer = getDesignFlyerBySlug(params.slug);
  if (!flyer) notFound();

  return <DesignStudio slug={params.slug} />;
}
