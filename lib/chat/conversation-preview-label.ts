import { isLikelyChatCiphertext } from '@/lib/chat/local-chat-cache';

export const ENCRYPTED_LIST_PREVIEW_LABEL = 'Encrypted';

export function shouldMaskConversationPreview(
  text: string | null | undefined,
  opts: { isEncrypted?: boolean; isVaultUnlocked?: boolean },
): boolean {
  const raw = String(text || '').trim();
  if (!raw) return false;
  if (isLikelyChatCiphertext(raw)) return true;
  if (opts.isEncrypted && !opts.isVaultUnlocked) return true;
  return false;
}

/** List-row preview — never surface ciphertext; mask until vault decrypt completes. */
export function resolveConversationPreviewText(
  text: string | null | undefined,
  opts: {
    isEncrypted?: boolean;
    isVaultUnlocked?: boolean;
    fallback?: string;
  },
): string {
  const fallback = opts.fallback ?? 'No messages yet';
  const raw = String(text || '').trim();
  if (!raw) return fallback;
  if (shouldMaskConversationPreview(raw, opts)) return ENCRYPTED_LIST_PREVIEW_LABEL;
  return raw;
}

export function isEncryptedListPreviewLabel(text?: string | null): boolean {
  return String(text || '').trim() === ENCRYPTED_LIST_PREVIEW_LABEL;
}
