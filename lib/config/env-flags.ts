const TRUTHY = new Set(['true', '1', 'yes', 'on']);

export function parseEnvFlag(value: string | undefined | null): boolean {
  return TRUTHY.has(String(value ?? '').trim().toLowerCase());
}

export function parseEnvInt(value: string | undefined | null, fallback: number): number {
  const parsed = Number.parseInt(String(value ?? '').trim(), 10);
  return Number.isFinite(parsed) ? parsed : fallback;
}

export function parseEnvCsv(value: string | undefined | null): string[] {
  if (!value?.trim()) return [];
  return value
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean);
}
