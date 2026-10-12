/**
 * Jev Decision Engine Integration (`typesafe/jev-1.13`)
 * 
 * Jev is an ultra-fast, non-generative System One decision model on OpenRouter.
 * It evaluates state + typed questions (choice, noul, score) and returns calibrated
 * probabilities, categories, and ratings in under 500ms.
 */

export interface JevNoulQuestion {
  type: 'noul';
  instructions: string;
  criteria?: {
    true?: string;
    false?: string;
  };
}

export interface JevChoiceQuestion {
  type: 'choice';
  instructions: string;
  criteria: Record<string, string>;
}

export interface JevScoreQuestion {
  type: 'score';
  instructions: string;
  criteria: string[];
}

export type JevQuestion = JevNoulQuestion | JevChoiceQuestion | JevScoreQuestion;

export interface JevDecisionRequest {
  state: string;
  questions: Record<string, JevQuestion>;
  model?: string;
}

export interface JevChoiceAnswer {
  choice: string;
  confidence?: number;
  distribution?: Record<string, number>;
}

export interface JevDecisionResponse {
  success: boolean;
  decisions?: Record<string, any>;
  latencyMs?: number;
  error?: string;
}

export interface JevTriageResult {
  urgency: 'low' | 'medium' | 'high' | 'urgent';
  isActionable: boolean;
  domain: 'work' | 'personal' | 'finance' | 'dev' | 'ideas' | 'general';
  confidence: number;
  evaluatedBy: 'jev' | 'heuristic';
}

const JEV_MODEL = 'typesafe/jev-1.13';
const OPENROUTER_DECISIONS_URL = 'https://openrouter.ai/api/alpha/decisions';

/**
 * Returns true if JEV_API or OPENROUTER_API_KEY is configured in the environment.
 */
export function isJevAvailable(): boolean {
  return Boolean(process.env.JEV_API || process.env.OPENROUTER_API_KEY);
}

/**
 * Executes a low-latency structured decision request against Jev on OpenRouter.
 */
export async function executeJevDecision(
  request: JevDecisionRequest,
  apiKeyOverride?: string
): Promise<JevDecisionResponse> {
  const apiKey = apiKeyOverride || process.env.JEV_API || process.env.OPENROUTER_API_KEY;

  if (!apiKey) {
    return {
      success: false,
      error: 'Jev API key is not configured (missing JEV_API or OPENROUTER_API_KEY).',
    };
  }

  const start = Date.now();
  try {
    const res = await fetch(OPENROUTER_DECISIONS_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${apiKey.trim()}`,
      },
      body: JSON.stringify({
        model: request.model || JEV_MODEL,
        state: request.state,
        questions: request.questions,
      }),
    });

    const latencyMs = Date.now() - start;

    if (!res.ok) {
      const errorText = await res.text().catch(() => '');
      return {
        success: false,
        latencyMs,
        error: `Jev API error (${res.status}): ${errorText || res.statusText}`,
      };
    }

    const data = await res.json();
    return {
      success: true,
      decisions: data.decisions || data,
      latencyMs,
    };
  } catch (err: any) {
    return {
      success: false,
      latencyMs: Date.now() - start,
      error: err?.message || 'Network error while querying Jev decisions API',
    };
  }
}

/**
 * Smart Triage Utility
 * Rapidly evaluates an item (note, goal, form, or idea) to categorize urgency,
 * actionability, and primary life/work domain in <500ms.
 */
export async function triageItemUrgency(item: {
  title: string;
  content?: string;
  type?: string;
}): Promise<JevTriageResult> {
  const combinedState = `Type: ${item.type || 'item'}\nTitle: ${item.title}\nContent: ${(item.content || '').slice(0, 1500)}`;

  if (isJevAvailable()) {
    const response = await executeJevDecision({
      state: combinedState,
      questions: {
        urgency: {
          type: 'choice',
          instructions: 'How urgent or time-sensitive is this item for a user?',
          criteria: {
            urgent: 'Immediate attention required within 24 hours, critical deadline or emergency',
            high: 'Important priority needing prompt attention this week',
            medium: 'Standard priority task or important reference note',
            low: 'Someday/maybe idea, backlog item, archive reference, or casual note',
          },
        },
        actionable: {
          type: 'noul',
          instructions: 'Does this item represent an actionable task, to-do, or next physical action (true) versus passive reference information (false)?',
          criteria: {
            true: 'Contains actionable steps, to-dos, or active goals',
            false: 'Informational, read-only, reference notes, or static archive',
          },
        },
        domain: {
          type: 'choice',
          instructions: 'Which functional category does this belong to?',
          criteria: {
            work: 'Professional projects, job tasks, business requirements',
            dev: 'Software development, coding, architecture, bugs, technical specs',
            finance: 'Money, bills, investments, crypto, billing, budget',
            personal: 'Family, home, health, fitness, personal errands',
            ideas: 'Brainstorming, creative concepts, future inventions',
            general: 'General utility, misc or uncategorized',
          },
        },
      },
    });

    if (response.success && response.decisions) {
      const urgencyChoice = response.decisions.urgency?.choice || response.decisions.urgency;
      const actionableVal = response.decisions.actionable;
      const domainChoice = response.decisions.domain?.choice || response.decisions.domain;

      const urgency = ['urgent', 'high', 'medium', 'low'].includes(urgencyChoice)
        ? (urgencyChoice as JevTriageResult['urgency'])
        : 'medium';

      const isActionable = typeof actionableVal === 'number'
        ? actionableVal >= 0.5
        : typeof actionableVal === 'boolean'
        ? actionableVal
        : Boolean(actionableVal?.choice === 'true');

      const domain = ['work', 'dev', 'finance', 'personal', 'ideas', 'general'].includes(domainChoice)
        ? (domainChoice as JevTriageResult['domain'])
        : 'general';

      const confidence = typeof response.decisions.urgency?.confidence === 'number'
        ? response.decisions.urgency.confidence
        : 0.9;

      return {
        urgency,
        isActionable,
        domain,
        confidence,
        evaluatedBy: 'jev',
      };
    }
  }

  // Graceful deterministic fallback when offline / no key
  const textLower = (item.title + ' ' + (item.content || '')).toLowerCase();
  const isUrgent = textLower.includes('urgent') || textLower.includes('asap') || textLower.includes('deadline');
  const isHigh = textLower.includes('important') || textLower.includes('priority') || textLower.includes('due');
  const isDev = textLower.includes('code') || textLower.includes('api') || textLower.includes('bug') || textLower.includes('git');
  const isFinance = textLower.includes('payment') || textLower.includes('invoice') || textLower.includes('crypto') || textLower.includes('price');

  return {
    urgency: isUrgent ? 'urgent' : isHigh ? 'high' : 'medium',
    isActionable: item.type === 'goal' || textLower.includes('todo') || textLower.includes('task'),
    domain: isDev ? 'dev' : isFinance ? 'finance' : 'general',
    confidence: 0.6,
    evaluatedBy: 'heuristic',
  };
}

/**
 * Fast Workflow & Intent Router
 * Selects the highest probability workflow or action handler from candidate choices.
 */
export async function routeWorkflowAction(
  userInput: string,
  actions: Array<{ id: string; description: string }>
): Promise<{ selectedId: string; confidence: number; evaluatedBy: 'jev' | 'heuristic' }> {
  if (actions.length === 0) {
    return { selectedId: '', confidence: 0, evaluatedBy: 'heuristic' };
  }

  if (actions.length === 1) {
    return { selectedId: actions[0].id, confidence: 1, evaluatedBy: 'heuristic' };
  }

  if (isJevAvailable()) {
    const criteria: Record<string, string> = {};
    for (const a of actions) {
      criteria[a.id] = a.description;
    }

    const res = await executeJevDecision({
      state: userInput,
      questions: {
        target_action: {
          type: 'choice',
          instructions: 'Select the exact action ID that best fulfills the user input request.',
          criteria,
        },
      },
    });

    if (res.success && res.decisions?.target_action) {
      const choice = res.decisions.target_action.choice || res.decisions.target_action;
      const confidence = typeof res.decisions.target_action.confidence === 'number'
        ? res.decisions.target_action.confidence
        : 0.85;

      if (actions.some((a) => a.id === choice)) {
        return {
          selectedId: choice,
          confidence,
          evaluatedBy: 'jev',
        };
      }
    }
  }

  // Heuristic token overlap fallback
  const inputWords = new Set(userInput.toLowerCase().split(/\s+/).filter(Boolean));
  let bestId = actions[0].id;
  let bestScore = -1;

  for (const a of actions) {
    const descWords = (a.id + ' ' + a.description).toLowerCase().split(/\s+/);
    let matchCount = 0;
    for (const w of descWords) {
      if (inputWords.has(w)) matchCount++;
    }
    if (matchCount > bestScore) {
      bestScore = matchCount;
      bestId = a.id;
    }
  }

  return {
    selectedId: bestId,
    confidence: 0.5,
    evaluatedBy: 'heuristic',
  };
}
