import { createHash, randomBytes } from 'crypto';

export function sha256(input: string): string {
  return createHash('sha256').update(input, 'utf8').digest('hex');
}

export function generateApiKey(prefix: string = 'wsk'): { key: string; prefix: string } {
  // 32 bytes -> 64 hex chars; include short random segment groups for readability
  const raw = randomBytes(32).toString('base64url');
  const key = `${prefix}_${raw}`;
  return { key, prefix };
}

export function hashApiKey(key: string): string {
  return sha256(key);
}

export function hashPrompt(prompt: string): string {
  // Normalize whitespace to ensure stable hashing
  const normalized = prompt.trim().replace(/\s+/g, ' ');
  return sha256(normalized);
}
