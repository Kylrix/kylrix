import type { DiscoverFlow } from '@/lib/flows/types';
import { KYLRIX_PUBLISHER } from '@/lib/flows/types';

/** System flows shipped with Kylrix — always discoverable. */
export const BUILTIN_FLOWS: DiscoverFlow[] = [
  {
    id: 'kylrix-sidekick',
    name: 'Sidekick',
    description: 'Per-object companion — one agentic session per note/idea/goal with summary, one-liners, and mind-map. Chat persists for months.',
    niche: 'workspace',
    steps: [
      { actionId: 'tool.object.read', timestamp: '', importance: 'high' },
      { actionId: 'tool.sidekick.summarize', timestamp: '', importance: 'high' },
      { actionId: 'tool.agentic.chat', timestamp: '', importance: 'high' },
      { actionId: 'tool.object.map.render', timestamp: '', importance: 'high' },
      { actionId: 'tool.sidekick.persist', timestamp: '', importance: 'high' },
    ],
    isPublic: true,
    isAnonymized: true,
    createdAt: '2026-01-01T00:00:00.000Z',
    publisher: KYLRIX_PUBLISHER,
    source: 'builtin',
    // @ts-ignore preInstalled flag — handled as always-installed in UI
    preInstalled: true,
  } as DiscoverFlow,
  {
    id: 'kylrix-custom-agent',
    name: 'Custom Agent',
    description: 'Every agent is its prompt. View and inspect the exact system prompts powering Kylrix — Sidekick, agentic, vault and flow templates. Read-only, pre-installed.',
    niche: 'workspace',
    steps: [
      { actionId: 'tool.prompt.view', timestamp: '', importance: 'high' },
      { actionId: 'tool.prompt.inspect', timestamp: '', importance: 'high' },
      { actionId: 'tool.system.prompt.read', timestamp: '', importance: 'high' },
      { actionId: 'tool.prompt.template.view', timestamp: '', importance: 'high' },
      { actionId: 'tool.agent.prompt.render', timestamp: '', importance: 'high' },
    ],
    isPublic: true,
    isAnonymized: true,
    createdAt: '2026-01-02T00:00:00.000Z',
    publisher: KYLRIX_PUBLISHER,
    source: 'builtin',
    // @ts-ignore preInstalled flag
    preInstalled: true,
  } as DiscoverFlow,
  {
    id: 'kylrix-math-mode',
    name: 'Math Mode',
    description:
      'Write math, solve equations, and plot charts right in your notes. Install this flow to turn it on.',
    niche: 'workspace',
    steps: [
      { actionId: 'markdown.transform', timestamp: '', importance: 'high' },
      { actionId: 'markdown.math.render', timestamp: '', importance: 'high' },
      { actionId: 'math.solve', timestamp: '', importance: 'high' },
      { actionId: 'markdown.chart.render', timestamp: '', importance: 'high' },
      { actionId: 'objects.idea.create', timestamp: '', importance: 'high' },
    ],
    isPublic: true,
    isAnonymized: true,
    createdAt: '2026-08-02T00:00:00.000Z',
    publisher: KYLRIX_PUBLISHER,
    source: 'builtin',
  },
];

export function getBuiltinFlow(id: string): DiscoverFlow | null {
  return BUILTIN_FLOWS.find((f) => f.id === id) || null;
}
