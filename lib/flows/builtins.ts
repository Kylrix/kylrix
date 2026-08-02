import type { DiscoverFlow } from '@/lib/flows/types';
import { KYLRIX_PUBLISHER } from '@/lib/flows/types';

/** System flows shipped with Kylrix — always discoverable. */
export const BUILTIN_FLOWS: DiscoverFlow[] = [
  {
    id: 'kylrix-summarize-note',
    name: 'Summarize note',
    description: 'Summarize an article note and create a linked summary note.',
    niche: 'workspace',
    steps: [
      { actionId: 'tool.note.read', timestamp: '', importance: 'high' },
      { actionId: 'tool.summarize', timestamp: '', importance: 'high' },
      { actionId: 'tool.note.create', timestamp: '', importance: 'high' },
      { actionId: 'tool.link.attach', timestamp: '', importance: 'high' },
    ],
    isPublic: true,
    isAnonymized: true,
    createdAt: '2026-01-01T00:00:00.000Z',
    publisher: KYLRIX_PUBLISHER,
    source: 'builtin',
  },
  {
    id: 'kylrix-agent-playbook',
    name: 'Agent playbook',
    description: 'Repeat a fixed tool chain for agents.',
    niche: 'workspace',
    steps: [
      { actionId: 'tool.agent.plan', timestamp: '', importance: 'high' },
      { actionId: 'tool.run', timestamp: '', importance: 'high' },
      { actionId: 'tool.agent.report', timestamp: '', importance: 'high' },
    ],
    isPublic: true,
    isAnonymized: true,
    createdAt: '2026-01-01T00:00:00.000Z',
    publisher: KYLRIX_PUBLISHER,
    source: 'builtin',
  },
  {
    id: 'kylrix-object-pack',
    name: 'Object pack',
    description: 'Run a tool pack on any object.',
    niche: 'workspace',
    steps: [
      { actionId: 'tool.object.resolve', timestamp: '', importance: 'high' },
      { actionId: 'tool.compose', timestamp: '', importance: 'high' },
      { actionId: 'tool.object.write', timestamp: '', importance: 'high' },
    ],
    isPublic: true,
    isAnonymized: true,
    createdAt: '2026-01-01T00:00:00.000Z',
    publisher: KYLRIX_PUBLISHER,
    source: 'builtin',
  },
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
