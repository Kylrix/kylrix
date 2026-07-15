export const AUTO_TITLE_CONFIG = {
  baseCharLimit: 32,
  minCharLength: 18,
  avgWordThreshold: 6,
  extraPerLongWord: 2,
  maxExtraCharLimit: 24,
  maxWords: 8
};

/** Appwrite notes.title column max length */
export const NOTE_TITLE_MAX_LENGTH = 256;

const OBJECT_BLOCK_REGEX = /\[\[kylrix-object:(\{.*?\})\]\]/g;

/** Replace inline object blocks with human labels before deriving a title. */
export function stripObjectBlocksForTitleSource(rawContent: string): string {
  if (!rawContent) return '';
  const replaced = rawContent.replace(OBJECT_BLOCK_REGEX, (_match, json: string) => {
    try {
      const payload = JSON.parse(json) as { label?: string; href?: string; childId?: string };
      const label = typeof payload.label === 'string' ? payload.label.trim() : '';
      if (label) return label;
      const href = typeof payload.href === 'string' ? payload.href.trim() : '';
      if (href) return href;
      const childId = typeof payload.childId === 'string' ? payload.childId.trim() : '';
      if (childId && !childId.startsWith('{')) return childId;
    } catch {
      // ignore malformed blocks
    }
    return '';
  });
  return replaced.replace(/\s+/g, ' ').trim();
}

export function clampNoteTitle(value: unknown, fallback = ''): string {
  const base = typeof value === 'string' ? value : value == null ? '' : String(value);
  const trimmed = base.trim();
  if (!trimmed) return fallback;
  return trimmed.length > NOTE_TITLE_MAX_LENGTH
    ? trimmed.slice(0, NOTE_TITLE_MAX_LENGTH)
    : trimmed;
}

/**
 * Intelligent title generation logic shared across the ecosystem.
 * Stops at word boundaries and follows dynamic character limits.
 */
export const buildAutoTitleFromContent = (rawContent: string): string => {
  const normalized = stripObjectBlocksForTitleSource(rawContent);
  if (!normalized) return '';

  const words = normalized.split(' ').filter(Boolean);
  if (!words.length) return '';

  const selectedWords: string[] = [];
  for (let i = 0; i < words.length && selectedWords.length < AUTO_TITLE_CONFIG.maxWords; i++) {
    const candidateWords = [...selectedWords, words[i]];
    const candidateText = candidateWords.join(' ');
    
    // Dynamic limit based on word complexity
    const averageLen = candidateWords.reduce((sum, word) => sum + word.length, 0) / candidateWords.length;
    const extra = Math.max(0, Math.round(averageLen - AUTO_TITLE_CONFIG.avgWordThreshold)) * AUTO_TITLE_CONFIG.extraPerLongWord;
    const limit = AUTO_TITLE_CONFIG.baseCharLimit + Math.min(AUTO_TITLE_CONFIG.maxExtraCharLimit, extra);

    if (selectedWords.length === 0 || candidateText.length <= limit) {
      selectedWords.push(words[i]);
      continue;
    }
    break;
  }

  let titleCandidate = selectedWords.join(' ');
  
  // Ensure minimum length if possible
  if (
    titleCandidate.length < AUTO_TITLE_CONFIG.minCharLength &&
    selectedWords.length < Math.min(words.length, AUTO_TITLE_CONFIG.maxWords)
  ) {
    let cursor = selectedWords.length;
    while (
      titleCandidate.length < AUTO_TITLE_CONFIG.minCharLength &&
      cursor < words.length &&
      selectedWords.length < AUTO_TITLE_CONFIG.maxWords
    ) {
      selectedWords.push(words[cursor]);
      cursor += 1;
      titleCandidate = selectedWords.join(' ');
    }
  }

  return clampNoteTitle(titleCandidate);
};

const GENERIC_NOTE_TITLES = new Set<string>();

export const isGenericNoteTitle = (title?: string | null): boolean => {
  return false;
};

export const resolveNoteCardTitle = (title?: string | null, content?: string | null): string => {
  const trimmed = clampNoteTitle(title);
  if (trimmed && trimmed.trim() !== '') return trimmed;
  return buildAutoTitleFromContent(content || '') || 'New Note';
};
