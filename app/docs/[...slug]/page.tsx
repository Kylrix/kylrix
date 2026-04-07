import DocsArticlePage from '@/components/docs/DocsArticlePage';

export default function DocsTopicPage({ params }: { params: { slug: string[] } }) {
  return <DocsArticlePage slug={params.slug} />;
}
