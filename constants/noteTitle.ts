export const AUTO_TITLE_CONFIG = {
  baseCharLimit: 32,
  minCharLength: 18,
  avgWordThreshold: 6,
  extraPerLongWord: 2,
  maxExtraCharLimit: 24,
  maxWords: 8
};

/**
 * Intelligent title generation logic shared across the ecosystem.
 * Stops at word boundaries and follows dynamic character limits.
 */
export const buildAutoTitleFromContent = (rawContent: string): string => {
  const normalized = rawContent.trim().replace(/\s+/g, ' ');
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

  return titleCandidate;
};
