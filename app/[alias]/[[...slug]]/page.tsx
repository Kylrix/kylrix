import { notFound, redirect } from 'next/navigation';
import { getEcosystemUrl } from '@/lib/ecosystem';

const ALIAS_TO_SUBDOMAIN: Record<string, string> = {
  n: 'note',
  note: 'note',
  c: 'connect',
  connect: 'connect',
  v: 'vault',
  vault: 'vault',
  f: 'flow',
  flow: 'flow',
};

function buildTargetUrl(subdomain: string, slug: string[]) {
  return getEcosystemUrl(subdomain, slug.length > 0 ? `/${slug.map(encodeURIComponent).join('/')}` : '');
}

export default async function EcosystemAliasRedirectPage({
  params,
  searchParams,
}: {
  params: Promise<{ alias: string; slug?: string[] }>;
  searchParams?: Promise<Record<string, string | string[] | undefined>>;
}) {
  const { alias, slug } = await params;
  const resolvedSearchParams = await searchParams;

  const subdomain = ALIAS_TO_SUBDOMAIN[alias?.toLowerCase() || ''];
  if (!subdomain) notFound();

  const targetPath = buildTargetUrl(subdomain, slug || []);
  const targetSearchParams = new URLSearchParams();
  if (resolvedSearchParams) {
    for (const [key, value] of Object.entries(resolvedSearchParams)) {
      if (typeof value === 'undefined') continue;
      if (Array.isArray(value)) {
        for (const item of value) targetSearchParams.append(key, item);
      } else {
        targetSearchParams.set(key, value);
      }
    }
  }

  const query = targetSearchParams.toString();
  redirect(query ? `${targetPath}?${query}` : targetPath);
}
