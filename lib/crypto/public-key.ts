export function normalizeStoredSecretString(value: string): string {
  const trimmed = value.trim();
  if (!trimmed) return trimmed;

  if (trimmed.startsWith('"') && trimmed.endsWith('"')) {
    try {
      const parsed = JSON.parse(trimmed);
      if (typeof parsed === 'string') return parsed.trim();
    } catch {
      // Fall through with the raw trimmed value.
    }
  }

  return trimmed;
}

export function decodeBase64ToBytes(base64: string): Uint8Array {
  const normalized = normalizeStoredSecretString(base64)
    .replace(/-/g, '+')
    .replace(/_/g, '/')
    .replace(/\s/g, '');

  if (!normalized || normalized.startsWith('pending:')) {
    throw new Error('INVALID_PUBLIC_KEY_FORMAT');
  }

  const padded = normalized.padEnd(Math.ceil(normalized.length / 4) * 4, '=');

  try {
    const binary = atob(padded);
    const bytes = new Uint8Array(binary.length);
    for (let i = 0; i < binary.length; i++) {
      bytes[i] = binary.charCodeAt(i);
    }
    return bytes;
  } catch (error) {
    const detail = error instanceof Error ? error.message : 'unknown';
    throw new Error(`INVALID_BASE64:${detail}`);
  }
}

export function isValidX25519PublicKey(value: unknown): boolean {
  if (typeof value !== 'string' || !value.trim()) return false;
  if (value.trim().startsWith('pending:')) return false;

  try {
    return decodeBase64ToBytes(value).length === 32;
  } catch {
    return false;
  }
}

export function formatSecureChatStartError(error: unknown, mode: 'secure' | 'thread' = 'secure'): string {
  const message = error instanceof Error ? error.message : String(error || 'Unknown error');

  if (message.includes('VAULT_LOCKED') || /vault locked/i.test(message)) {
    return 'Unlock your vault first to start a secure chat.';
  }

  if (
    message.includes('Your secure identity keys could not be loaded') ||
    message.includes('secure identity keys could not be loaded')
  ) {
    return 'Your secure identity could not be loaded. Unlock your vault in Settings and try again.';
  }

  if (
    message.includes('INVALID_PUBLIC_KEY_FORMAT') ||
    message.includes('invalid secure identity key') ||
    message.includes('X25519 target key must be 32 bytes') ||
    message.includes("hasn't completed secure chat setup")
  ) {
    return mode === 'secure'
      ? "This person hasn't finished secure chat setup yet."
      : "This account isn't ready for secure chat yet.";
  }

  if (
    message.includes('Invalid base64 string') ||
    message.includes('INVALID_BASE64:') ||
    message.includes("Failed to execute 'atob'")
  ) {
    return mode === 'secure'
      ? "Secure chat couldn't start because a security key is missing or out of date. Unlock your vault again, or ask the other person to open Settings and refresh their secure identity."
      : "Couldn't read a security key for this account. Try again after unlocking your vault.";
  }

  return message.replace(/^Failed to create (secure chat|chat|thread):?\s*/i, '').trim() || message;
}
