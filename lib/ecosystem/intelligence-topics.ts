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

export interface WeightedInterest {
  name: string;
  weight: number;
  isWeighted?: boolean;
}

export const ALL_CURATED_TOPICS = CURATED_TOPIC_CATEGORIES.flatMap((c) => c.topics);

export function parseInterestsWithWeights(raw: any[]): WeightedInterest[] {
  if (!Array.isArray(raw)) return [];
  return raw.map((item) => {
    if (typeof item === 'string') {
      const parts = item.split(':');
      if (parts.length === 2 && !isNaN(Number(parts[1]))) {
        return { name: parts[0].toLowerCase().trim(), weight: Number(parts[1]), isWeighted: true };
      }
      return { name: item.toLowerCase().trim(), weight: 1, isWeighted: false };
    }
    if (typeof item === 'object' && item !== null) {
      return {
        name: String(item.name || item.topic || '').toLowerCase().trim(),
        weight: typeof item.weight === 'number' ? item.weight : 1,
        isWeighted: Boolean(item.isWeighted ?? (item.weight && item.weight > 1)),
      };
    }
    return { name: String(item).toLowerCase().trim(), weight: 1, isWeighted: false };
  }).filter((i) => i.name.length > 0);
}

export function formatInterestsForStorage(interests: WeightedInterest[]): string[] {
  return interests.map((i) => (i.weight > 1 ? `${i.name}:${i.weight}` : i.name));
}

/**
 * Rapid-adaptive interest drift calculator.
 * - Anchored topics stay fixed unless actively customized.
 * - Dynamic interest waves shift in real-time within minutes based on micro-interactions.
 * - Search query keywords receive higher weight multiplier (high intent).
 * - If a user persistently consumes new affinity patterns (>50% drift), unengaged interests are smoothly rotated.
 */
export function calculateAdaptiveInterests(
  explicitTopics: string[],
  currentInterests: (string | WeightedInterest)[],
  recentInteractions: { topic: string; weight: number; timestamp: number }[]
): string[] {
  const now = Date.now();
  const TEN_MINUTES = 10 * 60 * 1000;

  // Filter recent high-velocity interactions within minutes
  const activeWindow = recentInteractions.filter((i) => now - i.timestamp < TEN_MINUTES);

  const scoreMap = new Map<string, { totalScore: number; isHighIntent: boolean }>();

  // Base weight for explicit topics
  for (const t of explicitTopics) {
    const clean = t.toLowerCase().replace(/^#/, '').trim();
    if (clean) {
      const existing = scoreMap.get(clean) || { totalScore: 0, isHighIntent: false };
      scoreMap.set(clean, { totalScore: existing.totalScore + 18, isHighIntent: existing.isHighIntent });
    }
  }

  // Base weight for current interests
  const parsed = parseInterestsWithWeights(currentInterests);
  for (const item of parsed) {
    const clean = item.name.replace(/^#/, '').trim();
    if (clean) {
      const existing = scoreMap.get(clean) || { totalScore: 0, isHighIntent: false };
      const base = item.weight > 1 ? item.weight * 6 : 8;
      scoreMap.set(clean, {
        totalScore: existing.totalScore + base,
        isHighIntent: existing.isHighIntent || Boolean(item.isWeighted),
      });
    }
  }

  // Rapid velocity boost for real-time consumption and high-intent searches
  for (const item of activeWindow) {
    const clean = item.topic.toLowerCase().replace(/^#/, '').trim();
    if (clean) {
      const existing = scoreMap.get(clean) || { totalScore: 0, isHighIntent: false };
      const boost = (item.weight || 1) * 5; // e.g. search query with weight 3 gets +15 boost
      scoreMap.set(clean, {
        totalScore: existing.totalScore + boost,
        isHighIntent: existing.isHighIntent || (item.weight || 1) >= 2.5,
      });
    }
  }

  // Sort by calculated affinity
  const ranked = Array.from(scoreMap.entries())
    .sort((a, b) => b[1].totalScore - a[1].totalScore)
    .map(([topic, meta]) => (meta.isHighIntent ? `${topic}:3` : topic));

  return ranked.slice(0, 20);
}
