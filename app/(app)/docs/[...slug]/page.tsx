import { redirect } from 'next/navigation';

const DOC_MAP: Record<string, string> = {
  api: 'https://github.com/Kylrix/kylrix/blob/master/docs/api.md',
  mcp: 'https://github.com/Kylrix/kylrix/blob/master/docs/mcp.md',
  oauth2: 'https://github.com/Kylrix/kylrix/blob/master/docs/oauth2.md',
  agents: 'https://github.com/Kylrix/kylrix/blob/master/docs/agents.md',
  markdown: 'https://github.com/Kylrix/kylrix/blob/master/docs/markdown.md',
};

export default async function DocsSlugPage({
  params,
}: {
  params: Promise<{ slug?: string[] }>;
}) {
  const { slug } = await params;
  const first = slug?.[0];
  if (first && DOC_MAP[first]) {
    redirect(DOC_MAP[first]);
  }
  redirect('https://github.com/Kylrix/kylrix/tree/master/docs');
}
