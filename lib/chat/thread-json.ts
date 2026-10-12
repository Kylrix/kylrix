/**
 * Unwraps older thread messages stored as JSON wrappers e.g.
 * {"text":"...","type":"text","sendToGeneral":true} or {"content":"..."} or {"message":"..."} or {"body":"..."}.
 * Preserves encrypted ciphertext payloads (starting with {"iv", {"data", {"ct", {"ciphertext").
 */
export function unwrapThreadJsonContent(content: unknown): string {
  if (typeof content !== 'string') {
    return typeof content === 'number' ? String(content) : '';
  }

  let current = content;
  for (let depth = 0; depth < 3; depth++) {
    if (!current || typeof current !== 'string') break;
    const trimmed = current.trim();
    if (!trimmed.startsWith('{')) break;

    // Do not attempt to unwrap encrypted payloads
    if (
      trimmed.startsWith('{"iv"') ||
      trimmed.startsWith('{"data"') ||
      trimmed.startsWith('{"ct"') ||
      trimmed.startsWith('{"ciphertext"') ||
      trimmed.startsWith('[DECRYPTION_')
    ) {
      break;
    }

    try {
      const parsed = JSON.parse(trimmed);
      if (parsed && typeof parsed === 'object' && !Array.isArray(parsed)) {
        if (typeof parsed.text === 'string') {
          current = parsed.text;
          continue;
        }
        if (typeof parsed.content === 'string') {
          current = parsed.content;
          continue;
        }
        if (typeof parsed.message === 'string') {
          current = parsed.message;
          continue;
        }
        if (typeof parsed.body === 'string') {
          current = parsed.body;
          continue;
        }
      }
    } catch {
      break;
    }
    break;
  }

  return current;
}
