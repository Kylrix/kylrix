import { redirect } from 'next/navigation';
export default function DesignFlyerPage({ params }: { params: { slug: string } }) {
  redirect(`/designs?design=${params.slug}`);
}
