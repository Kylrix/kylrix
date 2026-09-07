/**
 * Offline-first format discernment for ecosystem Porter.
 * Understands mixed secrets + TOTP dumps without forcing the user to pick a vendor.
 */

import { parseCSV, detectColumnMapping, mapRowsToItems } from '@/utils/import/generic-parser';
import { validateBitwardenExport, analyzeBitwardenExport } from '@/utils/import/bitwarden-mapper';
import { parseTotpData } from '@/utils/import/totp-parser';
import type {
  PorterCredentialDraft,
  PorterDiscernResult,
  PorterFolderDraft,
  PorterFormat,
  PorterImportBundle,
  PorterTotpDraft,
} from './types';

const OTP_URI_RE = /otpauth:\/\/totp\/[^\s"'<>]+/gi;
const BASE32_RE = /^[A-Z2-7=]{16,}$/i;
const ENV_LINE_RE = /^\s*(?:export\s+)?([A-Za-z_][A-Za-z0-9_]*)\s*=\s*(.*)\s*$/;

function stripBom(text: string): string {
  return text.replace(/^\uFEFF/, '').trim();
}

function tryParseJson(text: string): unknown | null {
  try {
    return JSON.parse(text);
  } catch {
    return null;
  }
}

function looksLikeCsv(text: string): boolean {
  const lines = text.split(/\r?\n/).filter((l) => l.trim()).slice(0, 8);
  if (lines.length < 2) return false;
  const commas = lines.filter((l) => (l.match(/,/g) || []).length >= 2).length;
  const semis = lines.filter((l) => (l.match(/;/g) || []).length >= 2).length;
  const tabs = lines.filter((l) => (l.match(/\t/g) || []).length >= 2).length;
  return commas >= 2 || semis >= 2 || tabs >= 2;
}

function scoreResult(partial: Omit<PorterDiscernResult, 'confidence'> & { confidence?: number }): PorterDiscernResult {
  const total =
    partial.credentials.length + partial.totpSecrets.length + partial.folders.length;
  const base = partial.confidence ?? (total > 0 ? 0.75 : 0.1);
  return {
    ...partial,
    confidence: Math.min(0.99, base),
  };
}

function asCredential(c: Record<string, unknown>, source: string): PorterCredentialDraft | null {
  const name = String(c.name || c.title || c.label || c.issuer || '').trim();
  const username = (c.username ?? c.user ?? c.email ?? c.login ?? null) as string | null;
  const password = (c.password ?? c.pass ?? c.secret ?? null) as string | null;
  const url = (c.url ?? c.uri ?? c.website ?? null) as string | null;
  const notes = (c.notes ?? c.note ?? c.comment ?? null) as string | null;
  if (!name && !username && !password && !url) return null;
  return {
    kind: 'credential',
    name: name || username || url || 'Untitled secret',
    username: username ? String(username) : null,
    password: password ? String(password) : null,
    url: url ? String(url) : null,
    notes: notes ? String(notes) : null,
    totpUri: c.totp ? String(c.totp) : c.totpUri ? String(c.totpUri) : null,
    isEnv: Boolean(c.isEnv),
    itemType: String(c.itemType || 'login'),
    tags: Array.isArray(c.tags) ? (c.tags as string[]) : undefined,
    customFields: Array.isArray(c.customFields)
      ? (c.customFields as Array<{ label: string; value: string }>)
      : typeof c.customFields === 'string'
        ? (() => {
            try {
              const parsed = JSON.parse(c.customFields as string);
              return Array.isArray(parsed) ? parsed : undefined;
            } catch {
              return undefined;
            }
          })()
        : undefined,
    _status: 'new',
    _sourceHint: source,
  };
}

function asTotp(t: Record<string, unknown>, source: string): PorterTotpDraft | null {
  const secretKey = String(t.secretKey || t.secret || t.token || '').trim();
  if (!secretKey) return null;
  const parsed = parseTotpData(
    secretKey.startsWith('otpauth://')
      ? secretKey
      : `otpauth://totp/${encodeURIComponent(String(t.issuer || t.name || 'Import'))}:${encodeURIComponent(String(t.accountName || t.username || t.account || 'Account'))}?secret=${secretKey.replace(/\s+/g, '')}`,
  );
  if (!parsed) {
    if (!BASE32_RE.test(secretKey.replace(/\s+/g, ''))) return null;
    return {
      kind: 'totp',
      secretKey: secretKey.replace(/\s+/g, '').toUpperCase(),
      issuer: String(t.issuer || t.name || 'Import'),
      accountName: String(t.accountName || t.username || t.account || 'Account'),
      algorithm: String(t.algorithm || 'SHA1'),
      digits: Number(t.digits || 6),
      period: Number(t.period || 30),
      _status: 'new',
      _sourceHint: source,
    };
  }
  return {
    kind: 'totp',
    secretKey: parsed.secretKey,
    issuer: parsed.issuer || String(t.issuer || 'Import'),
    accountName: parsed.accountName || String(t.accountName || 'Account'),
    algorithm: parsed.algorithm,
    digits: parsed.digits,
    period: parsed.period,
    _status: 'new',
    _sourceHint: source,
  };
}

function discernOtpauthBlob(text: string): PorterDiscernResult | null {
  const uris = text.match(OTP_URI_RE) || [];
  const totpSecrets: PorterTotpDraft[] = [];
  for (const uri of uris) {
    const parsed = parseTotpData(uri);
    if (!parsed) continue;
    totpSecrets.push({
      kind: 'totp',
      secretKey: parsed.secretKey,
      issuer: parsed.issuer,
      accountName: parsed.accountName,
      algorithm: parsed.algorithm,
      digits: parsed.digits,
      period: parsed.period,
      _status: 'new',
      _sourceHint: 'otpauth-uri',
    });
  }

  // Lone base32 lines (Google Authenticator plain dumps / Authenticator apps)
  if (totpSecrets.length === 0) {
    const lines = text.split(/\r?\n/).map((l) => l.trim()).filter(Boolean);
    for (const line of lines) {
      if (line.includes('=') && !BASE32_RE.test(line)) continue;
      const cleaned = line.replace(/\s+/g, '');
      if (!BASE32_RE.test(cleaned)) continue;
      const parsed = parseTotpData(cleaned);
      if (!parsed) continue;
      totpSecrets.push({
        kind: 'totp',
        secretKey: parsed.secretKey,
        issuer: parsed.issuer,
        accountName: parsed.accountName,
        algorithm: parsed.algorithm,
        digits: parsed.digits,
        period: parsed.period,
        _status: 'new',
        _sourceHint: 'base32-line',
      });
    }
  }

  if (!totpSecrets.length) return null;
  return scoreResult({
    format: 'otpauth-list',
    confidence: uris.length ? 0.95 : 0.7,
    label: 'Smart codes',
    summary: `Found ${totpSecrets.length} one-time code secret${totpSecrets.length === 1 ? '' : 's'}.`,
    credentials: [],
    totpSecrets,
    folders: [],
    warnings: [],
  });
}

function discernEnvBundle(text: string): PorterDiscernResult | null {
  const lines = text.split(/\r?\n/);
  const fields: Array<{ label: string; value: string }> = [];
  let envHits = 0;
  for (const line of lines) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('#')) continue;
    const m = trimmed.match(ENV_LINE_RE);
    if (!m) continue;
    envHits++;
    let value = m[2];
    if (
      (value.startsWith('"') && value.endsWith('"')) ||
      (value.startsWith("'") && value.endsWith("'"))
    ) {
      value = value.slice(1, -1);
    }
    fields.push({ label: m[1], value });
  }
  if (envHits < 2 || fields.length < 2) return null;
  // Prefer env only when most non-empty lines look like KEY=VALUE
  const contentLines = lines.map((l) => l.trim()).filter((l) => l && !l.startsWith('#'));
  if (fields.length / Math.max(contentLines.length, 1) < 0.6) return null;

  const title = fields[0]?.label || 'Imported env';
  return scoreResult({
    format: 'env-bundle',
    confidence: 0.88,
    label: 'Environment bundle',
    summary: `Found ${fields.length} environment variables → one secret.`,
    credentials: [
      {
        kind: 'credential',
        name: title,
        username: null,
        password: null,
        url: null,
        notes: null,
        isEnv: true,
        itemType: 'login',
        customFields: fields,
        _status: 'new',
        _sourceHint: 'env-file',
      },
    ],
    totpSecrets: [],
    folders: [],
    warnings: [],
  });
}

function discernCsv(text: string): PorterDiscernResult | null {
  if (!looksLikeCsv(text)) return null;
  const rows = parseCSV(text);
  if (rows.length < 2) return null;

  const mapping = detectColumnMapping(rows);
  const headerProbe = rows[0].join(' ');
  const isHeader = /name|title|login|user|pass|pwd|url|link|uri|note|comment|totp|otp|2fa|mfa/i.test(
    headerProbe,
  );
  const mapped = mapRowsToItems(rows, mapping, isHeader);

  // Detect TOTP column
  const header = (isHeader ? rows[0] : []).map((c) => c.toLowerCase());
  const totpIdx = header.findIndex((c) => /totp|otpauth|otp|2fa|mfa|authenticator/i.test(c));
  const secretIdx = header.findIndex((c) => /secret.?key|totp.?secret/i.test(c));

  const credentials: PorterCredentialDraft[] = [];
  const totpSecrets: PorterTotpDraft[] = [];

  const dataRows = isHeader ? rows.slice(1) : rows;

  mapped.forEach((item, i) => {
    const row = dataRows[i] || [];
    const totpCell = totpIdx >= 0 ? row[totpIdx] : secretIdx >= 0 ? row[secretIdx] : '';
    if (totpCell && String(totpCell).trim()) {
      const t = asTotp(
        {
          secretKey: String(totpCell).trim(),
          issuer: item.name || 'Import',
          accountName: item.username || item.name || 'Account',
        },
        'csv-totp-column',
      );
      if (t) totpSecrets.push(t);
    }

    // Also pull otpauth embedded in password/notes
    for (const field of [item.password, item.notes, item.url]) {
      if (!field) continue;
      const uris = String(field).match(OTP_URI_RE) || [];
      for (const uri of uris) {
        const parsed = parseTotpData(uri);
        if (!parsed) continue;
        totpSecrets.push({
          kind: 'totp',
          secretKey: parsed.secretKey,
          issuer: parsed.issuer || item.name || 'Import',
          accountName: parsed.accountName || item.username || 'Account',
          algorithm: parsed.algorithm,
          digits: parsed.digits,
          period: parsed.period,
          _status: 'new',
          _sourceHint: 'csv-embedded-otpauth',
        });
      }
    }

    const hasLoginShape = Boolean(item.username || item.password || item.url || item.name);
    if (hasLoginShape) {
      credentials.push({
        kind: 'credential',
        name: item.name || item.username || item.url || 'Untitled secret',
        username: item.username || null,
        password: item.password || null,
        url: item.url || null,
        notes: item.notes || null,
        _status: 'new',
        _sourceHint: 'csv',
      });
    }
  });

  if (!credentials.length && !totpSecrets.length) return null;

  const format: PorterFormat =
    credentials.length && totpSecrets.length
      ? 'csv-mixed'
      : totpSecrets.length && !credentials.length
        ? 'otpauth-list'
        : 'csv-credentials';

  return scoreResult({
    format,
    confidence: 0.85,
    label: format === 'csv-mixed' ? 'Mixed spreadsheet' : format === 'otpauth-list' ? 'Smart codes (CSV)' : 'Secrets spreadsheet',
    summary: [
      credentials.length ? `${credentials.length} secret${credentials.length === 1 ? '' : 's'}` : null,
      totpSecrets.length ? `${totpSecrets.length} smart code${totpSecrets.length === 1 ? '' : 's'}` : null,
    ]
      .filter(Boolean)
      .join(' · '),
    credentials,
    totpSecrets,
    folders: [],
    warnings: [],
  });
}

function discernBitwarden(data: any, userId: string): PorterDiscernResult | null {
  if (!data || typeof data !== 'object') return null;
  const normalized = {
    ...data,
    folders: Array.isArray(data.folders) ? data.folders : [],
    items: Array.isArray(data.items) ? data.items : [],
  };
  if (!validateBitwardenExport(normalized)) return null;
  const mapped = analyzeBitwardenExport(normalized, userId || 'import');
  return scoreResult({
    format: 'bitwarden',
    confidence: 0.97,
    label: 'Bitwarden export',
    summary: [
      mapped.credentials.length ? `${mapped.credentials.length} secrets` : null,
      mapped.totpSecrets.length ? `${mapped.totpSecrets.length} smart codes` : null,
      mapped.folders.length ? `${mapped.folders.length} folders` : null,
    ]
      .filter(Boolean)
      .join(' · ') || 'Empty Bitwarden export',
    credentials: mapped.credentials
      .map((c) => asCredential(c as any, 'bitwarden'))
      .filter(Boolean) as PorterCredentialDraft[],
    totpSecrets: mapped.totpSecrets
      .map((t) => asTotp(t as any, 'bitwarden'))
      .filter(Boolean) as PorterTotpDraft[],
    folders: mapped.folders.map((f) => ({
      kind: 'folder' as const,
      name: String((f as any).name || 'Folder'),
      _sourceHint: 'bitwarden',
    })),
    warnings: mapped.mapping.statistics.skippedItems
      ? [`Skipped ${mapped.mapping.statistics.skippedItems} non-login item(s).`]
      : [],
  });
}

function discernAegis(data: any): PorterDiscernResult | null {
  const entries =
    data?.db?.entries ||
    data?.entries ||
    (Array.isArray(data) ? data : null);
  if (!Array.isArray(entries) || entries.length === 0) return null;
  const sample = entries[0];
  if (!sample || !(sample.type === 'totp' || sample.info?.secret || sample.secret)) {
    // weak aegis signal
    if (!data?.db && !data?.version) return null;
  }

  const totpSecrets: PorterTotpDraft[] = [];
  for (const entry of entries) {
    const secret = entry.info?.secret || entry.secret || entry.secretKey;
    if (!secret) continue;
    const t = asTotp(
      {
        secretKey: secret,
        issuer: entry.issuer || entry.name || 'Import',
        accountName: entry.name || entry.account || entry.username || 'Account',
        algorithm: entry.info?.algo || entry.algorithm || 'SHA1',
        digits: entry.info?.digits || entry.digits || 6,
        period: entry.info?.period || entry.period || 30,
      },
      'aegis',
    );
    if (t) totpSecrets.push(t);
  }
  if (!totpSecrets.length) return null;
  return scoreResult({
    format: 'aegis',
    confidence: 0.93,
    label: 'Authenticator backup',
    summary: `Found ${totpSecrets.length} smart code${totpSecrets.length === 1 ? '' : 's'}.`,
    credentials: [],
    totpSecrets,
    folders: [],
    warnings: [],
  });
}

function discernKylrix(data: any): PorterDiscernResult | null {
  const vault =
    data?.data?.vault ||
    data?.vault ||
    (data?.credentials || data?.totpSecrets || data?.folders ? data : null);
  if (!vault) return null;

  const isWorkspace = Boolean(data?.data?.notes || data?.data?.flow || data?.format === 'kylrix-workspace');
  const formatHint = String(data?.format || '').toLowerCase();
  const looksNative =
    formatHint.includes('kylrix') ||
    Boolean(data?.data?.vault) ||
    Boolean(data?.version && (vault.credentials || vault.totpSecrets));

  if (!looksNative && !vault.credentials && !vault.totpSecrets) return null;

  const credSrc = vault.credentials || data.credentials || [];
  const totpSrc = vault.totpSecrets || data.totpSecrets || [];
  const folderSrc = vault.folders || data.folders || [];

  const credentials = (Array.isArray(credSrc) ? credSrc : [])
    .map((c: any) => asCredential(c, 'kylrix'))
    .filter(Boolean) as PorterCredentialDraft[];
  const totpSecrets = (Array.isArray(totpSrc) ? totpSrc : [])
    .map((t: any) => asTotp(t, 'kylrix'))
    .filter(Boolean) as PorterTotpDraft[];
  const folders: PorterFolderDraft[] = (Array.isArray(folderSrc) ? folderSrc : []).map((f: any) => ({
    kind: 'folder',
    name: String(f.name || 'Folder'),
    _sourceHint: 'kylrix',
  }));

  if (!credentials.length && !totpSecrets.length && !folders.length) return null;

  return scoreResult({
    format: isWorkspace ? 'kylrix-workspace' : 'kylrix-vault',
    confidence: 0.98,
    label: isWorkspace ? 'Kylrix workspace backup' : 'Kylrix vault backup',
    summary: [
      credentials.length ? `${credentials.length} secrets` : null,
      totpSecrets.length ? `${totpSecrets.length} smart codes` : null,
      folders.length ? `${folders.length} folders` : null,
    ]
      .filter(Boolean)
      .join(' · '),
    credentials,
    totpSecrets,
    folders,
    warnings: [],
  });
}

function discernGenericJsonArray(data: any): PorterDiscernResult | null {
  if (!Array.isArray(data) || data.length === 0) return null;
  const credentials: PorterCredentialDraft[] = [];
  const totpSecrets: PorterTotpDraft[] = [];

  for (const row of data) {
    if (!row || typeof row !== 'object') continue;
    const t = asTotp(row, 'json-array');
    if (t && (row.secretKey || row.secret || row.type === 'totp')) {
      totpSecrets.push(t);
      continue;
    }
    const c = asCredential(row, 'json-array');
    if (c) credentials.push(c);
    // Embedded totp on login rows
    if (row.totp || row.otpauth) {
      const embedded = asTotp(
        { secretKey: row.totp || row.otpauth, issuer: c?.name, accountName: c?.username },
        'json-array-embedded',
      );
      if (embedded) totpSecrets.push(embedded);
    }
  }

  if (!credentials.length && !totpSecrets.length) return null;
  return scoreResult({
    format: credentials.length && totpSecrets.length ? 'csv-mixed' : credentials.length ? 'csv-credentials' : 'otpauth-list',
    confidence: 0.72,
    label: 'Structured list',
    summary: [
      credentials.length ? `${credentials.length} secrets` : null,
      totpSecrets.length ? `${totpSecrets.length} smart codes` : null,
    ]
      .filter(Boolean)
      .join(' · '),
    credentials,
    totpSecrets,
    folders: [],
    warnings: ['Format guessed from list shape — review before importing.'],
  });
}

function mergeResults(parts: PorterDiscernResult[]): PorterDiscernResult {
  const credentials: PorterCredentialDraft[] = [];
  const totpSecrets: PorterTotpDraft[] = [];
  const folders: PorterFolderDraft[] = [];
  const warnings: string[] = [];
  let best = parts[0];

  for (const p of parts) {
    if (p.confidence > best.confidence) best = p;
    credentials.push(...p.credentials);
    totpSecrets.push(...p.totpSecrets);
    folders.push(...p.folders);
    warnings.push(...p.warnings);
  }

  // Dedupe totp by secretKey, credentials by name|user|pass fingerprint
  const totpSeen = new Set<string>();
  const uniqueTotp = totpSecrets.filter((t) => {
    const k = t.secretKey.toUpperCase();
    if (totpSeen.has(k)) return false;
    totpSeen.add(k);
    return true;
  });
  const credSeen = new Set<string>();
  const uniqueCred = credentials.filter((c) => {
    const k = `${(c.name || '').toLowerCase()}|${(c.username || '').toLowerCase()}|${c.password || ''}|${c.url || ''}`;
    if (credSeen.has(k)) return false;
    credSeen.add(k);
    return true;
  });

  const mixed = uniqueCred.length > 0 && uniqueTotp.length > 0;
  return scoreResult({
    format: mixed ? (best.format === 'bitwarden' ? 'bitwarden' : best.format === 'kylrix-vault' || best.format === 'kylrix-workspace' ? best.format : 'csv-mixed') : best.format,
    confidence: Math.min(0.99, best.confidence + (parts.length > 1 ? 0.05 : 0)),
    label: mixed ? `${best.label} (mixed)` : best.label,
    summary: [
      uniqueCred.length ? `${uniqueCred.length} secrets` : null,
      uniqueTotp.length ? `${uniqueTotp.length} smart codes` : null,
      folders.length ? `${folders.length} folders` : null,
    ]
      .filter(Boolean)
      .join(' · ') || 'Nothing recognized',
    credentials: uniqueCred,
    totpSecrets: uniqueTotp,
    folders,
    warnings: Array.from(new Set(warnings)),
  });
}

/**
 * Primary entry: understand arbitrary paste/file text offline.
 */
export function discernImportPayload(raw: string, userId = ''): PorterDiscernResult {
  const text = stripBom(raw || '');
  if (!text) {
    return {
      format: 'unknown',
      confidence: 0,
      label: 'Empty',
      summary: 'Nothing to import.',
      credentials: [],
      totpSecrets: [],
      folders: [],
      warnings: ['Paste or drop a file to continue.'],
    };
  }

  const candidates: PorterDiscernResult[] = [];
  const json = tryParseJson(text);

  if (json && typeof json === 'object') {
    const kylrix = discernKylrix(json);
    if (kylrix) candidates.push(kylrix);
    const bitwarden = discernBitwarden(json, userId);
    if (bitwarden) candidates.push(bitwarden);
    const aegis = discernAegis(json);
    if (aegis) candidates.push(aegis);
    const arr = discernGenericJsonArray(json);
    if (arr) candidates.push(arr);
  }

  const csv = discernCsv(text);
  if (csv) candidates.push(csv);
  const env = discernEnvBundle(text);
  if (env) candidates.push(env);
  const otp = discernOtpauthBlob(text);
  if (otp) candidates.push(otp);

  if (!candidates.length) {
    return {
      format: 'unknown',
      confidence: 0.05,
      label: 'Unrecognized',
      summary: 'Could not detect secrets or smart codes in this data.',
      credentials: [],
      totpSecrets: [],
      folders: [],
      warnings: [
        'Try a Bitwarden JSON export, Kylrix backup, authenticator backup, CSV, .env file, or otpauth links.',
      ],
    };
  }

  // Prefer highest confidence; if several strong hits, merge complementary kinds
  candidates.sort((a, b) => b.confidence - a.confidence);
  const top = candidates[0];
  const strong = candidates.filter((c) => c.confidence >= 0.7);
  if (strong.length > 1) {
    // Merge only when they contribute different kinds (e.g. CSV secrets + otpauth lines)
    const hasCred = strong.some((c) => c.credentials.length);
    const hasTotp = strong.some((c) => c.totpSecrets.length);
    if (hasCred && hasTotp) return mergeResults(strong);
  }
  return top;
}

export function toImportBundle(result: PorterDiscernResult): PorterImportBundle {
  return {
    version: 2,
    format: 'kylrix-vault',
    credentials: result.credentials,
    totpSecrets: result.totpSecrets,
    folders: result.folders,
    discernedFrom: result.format,
    discernedAt: new Date().toISOString(),
  };
}

export function bundleItemCount(bundle: PorterImportBundle): number {
  return bundle.credentials.length + bundle.totpSecrets.length + bundle.folders.length;
}
