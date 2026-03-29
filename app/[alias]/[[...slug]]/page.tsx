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
  const base = getEcosystemUrl(subdomain);
  const path = slug.length > 0 ? `/${slug.map(encodeURIComponent).join('/')}` : '';
  return `${base}${path}`;
}

export default function EcosystemAliasRedirectPage({
  params,
  searchParams,
}: {
  params: { alias: string; slug?: string[] };
  searchParams?: Record<string, string | string[] | undefined>;
}) {
  const subdomain = ALIAS_TO_SUBDOMAIN[params.alias.toLowerCase()];
  if (!subdomain) notFound();

  const target = new URL(buildTargetUrl(subdomain, params.slug || []));
  if (searchParams) {
    for (const [key, value] of Object.entries(searchParams)) {
      if (typeof value === 'undefined') continue;
      if (Array.isArray(value)) {
        for (const item of value) target.searchParams.append(key, item);
      } else {
        target.searchParams.set(key, value);
      }
    }
  }

  redirect(target.toString());
}
