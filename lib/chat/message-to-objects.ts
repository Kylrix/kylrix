/**
 * Heuristics to seed object creates from a chat message body.
 * Secrets: KEY=VALUE / label: value — strip spaces around delimiters;
 * password-like values strip all whitespace (copy/paste wraps must not poison passwords).
 */

export function messageTitleFromContent(content: string, max = 72): string {
  const line = String(content || '')
    .trim()
    .split(/\r?\n/)
    .map((l) => l.trim())
    .find(Boolean);
  if (!line) return 'From chat';
  return line.length > max ? `${line.slice(0, max - 1)}…` : line;
}

const USER_KEYS = /^(user(name)?|login|email|account|id)$/i;
const PASS_KEYS = /^(pass(word|wd|phrase)?|secret|token|key|pwd|passwd)$/i;
const URL_KEYS = /^(url|uri|host|website|site|link)$/i;
const NAME_KEYS = /^(name|title|service|app|site.?name)$/i;

function stripAllSpaces(s: string): string {
  return s.replace(/\s+/g, '');
}

function parseKvLine(line: string): { key: string; value: string } | null {
  const trimmed = line.trim();
  if (!trimmed || trimmed.startsWith('#')) return null;
  const eq = trimmed.match(/^([A-Za-z_][\w.\-]*)\s*[=:]\s*(.*)$/);
  if (eq) {
    return { key: eq[1].trim(), value: eq[2].trim() };
  }
  return null;
}

export type ParsedSecretPrefill = {
  name?: string;
  username?: string;
  password?: string;
  url?: string;
  notes?: string;
};

/** Extract login material from free text / env-style dumps. */
export function parseSecretPrefillFromMessage(content: string): ParsedSecretPrefill {
  const raw = String(content || '').trim();
  if (!raw) return {};

  const lines = raw.split(/\r?\n/);
  const out: ParsedSecretPrefill = {};
  const leftovers: string[] = [];

  for (const line of lines) {
    const kv = parseKvLine(line);
    if (!kv) {
      if (line.trim()) leftovers.push(line.trim());
      continue;
    }
    const { key, value } = kv;
    if (!value) continue;
    if (USER_KEYS.test(key) && !out.username) {
      out.username = stripAllSpaces(value);
      continue;
    }
    if (PASS_KEYS.test(key) && !out.password) {
      out.password = stripAllSpaces(value);
      continue;
    }
    if (URL_KEYS.test(key) && !out.url) {
      out.url = stripAllSpaces(value);
      continue;
    }
    if (NAME_KEYS.test(key) && !out.name) {
      out.name = value.trim();
      continue;
    }
    leftovers.push(`${key}=${stripAllSpaces(value)}`);
  }

  // Single-line `user:pass` or `user/pass` without labels
  if (!out.username && !out.password && lines.length === 1) {
    const m = raw.match(/^([^\s:=/]{2,64})\s*[:=\s/]\s*(\S{4,})$/);
    if (m && !USER_KEYS.test(m[1]) && !/^https?:/i.test(m[1])) {
      out.username = stripAllSpaces(m[1]);
      out.password = stripAllSpaces(m[2]);
    }
  }

  // Bare base64/hex-ish blob alone → password
  if (!out.password && lines.length === 1) {
    const alone = stripAllSpaces(raw);
    if (alone.length >= 8 && /^[A-Za-z0-9+/=_\-.]{8,}$/.test(alone) && !alone.includes('://')) {
      out.password = alone;
    }
  }

  if (!out.name) {
    out.name = messageTitleFromContent(raw, 48);
  }
  if (leftovers.length && !out.password && leftovers.length <= 3) {
    // leftover KEY=VALUE dumps often are the secret itself
    const joined = leftovers.join('\n');
    if (!out.notes) out.notes = joined;
  } else if (leftovers.length > 3) {
    out.notes = leftovers.join('\n');
  }

  return out;
}
