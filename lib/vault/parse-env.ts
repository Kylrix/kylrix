/**
 * Parse KEY=VALUE env text into vault custom-field rows.
 * Tolerates quotes, export prefix, blank lines, and # comments.
 */

export type EnvField = { id: string; label: string; value: string };

const LINE_RE =
  /^\s*(?:export\s+)?([A-Za-z_][A-Za-z0-9_]*)\s*=\s*(.*)$/;

function stripWrappingQuotes(raw: string): string {
  const v = raw.trim();
  if (
    (v.startsWith('"') && v.endsWith('"') && v.length >= 2) ||
    (v.startsWith("'") && v.endsWith("'") && v.length >= 2)
  ) {
    return v.slice(1, -1);
  }
  return v;
}

export function parseEnvText(text: string): EnvField[] {
  const out: EnvField[] = [];
  const seen = new Set<string>();
  const lines = String(text || '').split(/\r?\n/);
  let i = 0;
  for (const line of lines) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('#')) continue;
    const m = LINE_RE.exec(line);
    if (!m) continue;
    const label = m[1];
    if (seen.has(label)) continue;
    seen.add(label);
    out.push({
      id: `env-${Date.now()}-${i++}`,
      label,
      value: stripWrappingQuotes(m[2] ?? ''),
    });
  }
  return out;
}

/** Soft ceiling so sealed customFields stay under the 65k column. */
export const ENV_CUSTOM_FIELDS_SOFT_MAX_CHARS = 40_000;

export function measureEnvFieldsJson(fields: EnvField[]): number {
  try {
    return JSON.stringify(fields).length;
  } catch {
    return ENV_CUSTOM_FIELDS_SOFT_MAX_CHARS + 1;
  }
}
