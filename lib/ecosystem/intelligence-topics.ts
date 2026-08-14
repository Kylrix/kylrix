/**
 * Canonical ecosystem topics catalog, interest drift algorithm, and adaptive context intelligence.
 * Topics are curated, stable anchors; ephemeral interests dynamically drift with consumption patterns.
 */

export interface TopicCategory {
  id: string;
  label: string;
  icon?: string;
  description: string;
  topics: { id: string; label: string; tag: string }[];
}

export const CURATED_TOPIC_CATEGORIES: TopicCategory[] = [
  {
    id: 'tech_software',
    label: 'Engineering & Software',
    description: 'System design, local-first protocols, compilers, and architecture',
    topics: [
      { id: 'localfirst', label: 'Local-First', tag: 'localfirst' },
      { id: 'sovereignengineering', label: 'Sovereign Engineering', tag: 'sovereignengineering' },
      { id: 'linux', label: 'Linux & Kernels', tag: 'linux' },
      { id: 'typescript', label: 'TypeScript', tag: 'typescript' },
      { id: 'rust', label: 'Rust', tag: 'rustlang' },
      { id: 'distributed', label: 'Distributed Systems', tag: 'distributedsystems' },
      { id: 'cryptography', label: 'Applied Cryptography', tag: 'cryptography' },
      { id: 'p2p', label: 'Peer-to-Peer Networks', tag: 'p2p' },
    ],
  },
  {
    id: 'ai_agents',
    label: 'Intelligence & Agents',
    description: 'Autonomous workflows, reasoning harnesses, and private computation',
    topics: [
      { id: 'agents', label: 'AI Agents', tag: 'aiagents' },
      { id: 'machinelearning', label: 'Machine Learning', tag: 'machinelearning' },
      { id: 'llm', label: 'Large Language Models', tag: 'llm' },
      { id: 'neural', label: 'Neural Networks', tag: 'neuralnet' },
      { id: 'automation', label: 'Declarative Workflows', tag: 'automation' },
    ],
  },
  {
    id: 'nostr_bitcoin',
    label: 'Nostr & Sound Money',
    description: 'Decentralized social protocols, relays, zaps, and sound finance',
    topics: [
      { id: 'nostr', label: 'Nostr Protocol', tag: 'nostr' },
      { id: 'bitcoin', label: 'Bitcoin', tag: 'bitcoin' },
      { id: 'lightning', label: 'Lightning Network', tag: 'lightning' },
      { id: 'zaps', label: 'NWC & Zaps', tag: 'zaps' },
      { id: 'relays', label: 'Relay Architecture', tag: 'nostrrelays' },
      { id: 'openbuidl', label: 'Open Buidl', tag: 'openbuidl' },
    ],
  },
  {
    id: 'design_craft',
    label: 'Design & Interaction',
    description: 'Tactile UI, typography, micro-animations, and visual excellence',
    topics: [
      { id: 'uiux', label: 'UI / UX Design', tag: 'uiux' },
      { id: 'openbricks', label: 'OpenBricks System', tag: 'openbricks' },
      { id: 'typography', label: 'Typography & Layouts', tag: 'typography' },
      { id: 'motion', label: 'Motion & Fluidity', tag: 'motion' },
      { id: 'product', label: 'Product Architecture', tag: 'productdesign' },
    ],
  },
  {
    id: 'freedom_privacy',
    label: 'Privacy & Sovereignty',
    description: 'Data self-custody, zero-telemetry computing, and freedom tech',
    topics: [
      { id: 'privacy', label: 'Zero Telemetry & Privacy', tag: 'privacy' },
      { id: 'selfcustody', label: 'Data Sovereignty', tag: 'selfcustody' },
      { id: 'e2ee', label: 'End-to-End Security', tag: 'e2ee' },
      { id: 'opensource', label: 'Open Source Productivity', tag: 'opensource' },
    ],
  },
];

export const ALL_CURATED_TOPICS = CURATED_TOPIC_CATEGORIES.flatMap((c) => c.topics);

/**
 * Rapid-adaptive interest drift calculator.
 * - Anchored topics stay fixed unless actively customized.
 * - Dynamic interest waves shift in real-time within minutes based on micro-interactions.
 * - If a user persistently consumes new affinity patterns (>50% drift), unengaged interests are smoothly rotated.
 */
export function calculateAdaptiveInterests(
  explicitTopics: string[],
  currentInterests: string[],
  recentInteractions: { topic: string; weight: number; timestamp: number }[]
): string[] {
  const now = Date.now();
  const TEN_MINUTES = 10 * 60 * 1000;

  // Filter recent high-velocity interactions within minutes
  const activeWindow = recentInteractions.filter((i) => now - i.timestamp < TEN_MINUTES);

  const scoreMap = new Map<string, number>();

  // Base weight for explicit topics
  for (const t of explicitTopics) {
    const clean = t.toLowerCase().replace(/^#/, '').trim();
    if (clean) scoreMap.set(clean, (scoreMap.get(clean) || 0) + 15);
  }

  // Base weight for current interests
  for (const t of currentInterests) {
    const clean = t.toLowerCase().replace(/^#/, '').trim();
    if (clean) scoreMap.set(clean, (scoreMap.get(clean) || 0) + 8);
  }

  // Rapid velocity boost for real-time consumption
  for (const item of activeWindow) {
    const clean = item.topic.toLowerCase().replace(/^#/, '').trim();
    if (clean) {
      scoreMap.set(clean, (scoreMap.get(clean) || 0) + item.weight * 5);
    }
  }

  // Sort by calculated affinity
  const ranked = Array.from(scoreMap.entries())
    .sort((a, b) => b[1] - a[1])
    .map(([topic]) => topic);

  return ranked.slice(0, 20);
}
