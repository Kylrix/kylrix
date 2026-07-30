/**
 * HintEngine foundation — contextual suggestions while user types or agent plans.
 * Providers register hints; consumers resolve by zone + input prefix.
 */

export interface HintCandidate {
  id: string;
  label: string;
  prompt?: string;
  route?: string;
  target?: string;
  score: number;
  source: string;
}

type HintProvider = (ctx: {
  zone: string;
  route: string;
  input: string;
  resourceId?: string;
}) => Promise<HintCandidate[]> | HintCandidate[];

const providers: HintProvider[] = [];

function registerHintProvider(provider: HintProvider): () => void {
  providers.push(provider);
  return () => {
    const idx = providers.indexOf(provider);
    if (idx >= 0) providers.splice(idx, 1);
  };
}

export async function resolveHints(ctx: {
  zone: string;
  route: string;
  input: string;
  resourceId?: string;
  limit?: number;
}): Promise<HintCandidate[]> {
  const limit = ctx.limit ?? 6;
  const merged: HintCandidate[] = [];

  for (const provider of providers) {
    try {
      const batch = await provider(ctx);
      if (Array.isArray(batch)) merged.push(...batch);
    } catch (e) {
      console.warn('[HintEngine] provider failed:', e);
    }
  }

  return merged
    .sort((a: any, b: any) => b.score - a.score)
    .slice(0, limit);
}

/** Built-in: map partial input to UI destinations */
registerHintProvider(({ input }) => {
  const q = input.trim().toLowerCase();
  if (q.length < 2) return [];
  return import('./ui-catalog').then(({ UI_DESTINATIONS }) =>
    UI_DESTINATIONS.filter((d) => {
      const hay = [d.label, ...d.aliases].join(' ').toLowerCase();
      return hay.includes(q);
    }).map((d: any) => ({
      id: `ui:${d.id}`,
      label: `Go to ${d.label}`,
      route: d.route,
      target: d.id,
      score: 0.7,
      source: 'ui-catalog',
    })),
  );
});
