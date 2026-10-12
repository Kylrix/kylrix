/**
 * Ensure ghost text is a true continuation — never restate what the user already typed.
 */

function collapseWs(s: string): string {
  return String(s || '').replace(/\s+/g, ' ').trim();
}

/**
 * Strip any leading overlap between draft and candidate so only new text remains.
 * Returns '' when the candidate adds nothing useful.
 */
export function asSuggestionSuffix(draft: string, candidate: string): string {
  const dRaw = String(draft || '');
  const cRaw = String(candidate || '');
  if (!cRaw.trim()) return '';

  let out = cRaw.replace(/^\s+/, '');
  const d = collapseWs(dRaw);
  if (!d) {
    // Empty draft — full candidate is allowed (proactive reply), but trim junk wrappers
    return collapseWs(out).slice(0, 280);
  }

  const dLower = d.toLowerCase();
  let outLower = out.toLowerCase();

  // Exact / near-exact echo
  if (outLower === dLower) return '';
  if (dLower.startsWith(outLower) && outLower.length >= Math.min(8, dLower.length)) return '';

  // Candidate begins with the full draft
  if (outLower.startsWith(dLower)) {
    out = out.slice(d.length).replace(/^\s+/, '');
    outLower = out.toLowerCase();
  }

  // Candidate begins with draft ignoring case/spacing (token walk)
  {
    const dTokens = dLower.split(' ').filter(Boolean);
    const oTokens = collapseWs(out).toLowerCase().split(' ').filter(Boolean);
    let i = 0;
    while (i < dTokens.length && i < oTokens.length && dTokens[i] === oTokens[i]) i++;
    if (i >= 2 && i >= Math.ceil(dTokens.length * 0.6)) {
      // Shared opening words — drop them from suggestion
      out = collapseWs(out).split(/\s+/).slice(i).join(' ');
      outLower = out.toLowerCase();
    }
  }

  // Overlap: end of draft === start of suggestion (user mid-word / mid-phrase)
  {
    const dFull = dRaw.replace(/\s+/g, ' ');
    const max = Math.min(dFull.length, out.length, 80);
    let best = 0;
    for (let n = max; n >= 2; n--) {
      const tail = dFull.slice(-n).toLowerCase();
      if (outLower.startsWith(tail)) {
        best = n;
        break;
      }
    }
    if (best > 0) {
      out = out.slice(best).replace(/^\s+/, '');
      outLower = out.toLowerCase();
    }
  }

  out = out.replace(/^(SUFFIX|Continuation|Draft)\s*:\s*/i, '').trim();
  if (!out || out.length < 2) return '';
  if (collapseWs(out).toLowerCase() === dLower) return '';

  // Still mostly restating draft first line
  const firstDraftWords = dLower.split(' ').slice(0, 4).join(' ');
  if (firstDraftWords.length >= 8 && outLower.startsWith(firstDraftWords)) {
    out = out.slice(firstDraftWords.length).replace(/^\s+/, '');
  }

  return out.trim();
}
