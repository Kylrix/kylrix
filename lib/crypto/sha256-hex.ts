/** Browser-safe SHA-256 → lowercase hex (UTF-8 input). Used for ephemeral creator-delete proofs. */
export async function sha256HexUtf8(message: string): Promise<string> {
  const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(message));
  return Array.from(new Uint8Array(digest))
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('');
}
