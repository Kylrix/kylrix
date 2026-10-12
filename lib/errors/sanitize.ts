/**
 * Sanitize error messages for UI toasts and displays, ensuring Next.js server error
 * masks, digests, and raw stack traces are never exposed to standard users.
 */
export function sanitizeClientErrorMessage(
  msg?: unknown,
  fallback = 'An unexpected error occurred. Please try again.'
): string {
  if (!msg) return fallback;
  const str = typeof msg === 'string' ? msg : msg instanceof Error ? msg.message : String(msg);
  const lower = str.toLowerCase();
  if (
    lower.includes('server components render') ||
    lower.includes('omitted in production') ||
    lower.includes('digest') ||
    lower.includes('internal server error') ||
    lower.includes('failed to fetch') ||
    lower.includes('chunkloaderror')
  ) {
    return fallback;
  }
  return str;
}
