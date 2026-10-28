import { spawn } from 'node:child_process';
import pc from 'picocolors';
import {
  decryptRowField,
  isAgentEnclaveToken,
  zeroClearBytes,
  type AetResourceKey,
} from '@/lib/security/zero-knowledge';
import { openEnclave, type OpenEnclave } from '../enclave';
import { getClient } from '../client';
import { resolveEnvSource } from './envs';
import { printError, printJson } from '../formatter';

const MAX_SEALED_ROWS = 500;
const ENV_FIELDS = ['name', 'username', 'password', 'url', 'notes', 'customFields'] as const;

/**
 * Pure argv resolution for `kylrix exec`. Non-AET behavior is unchanged:
 * idOrUrl is required and everything after `--` is the command.
 */
export function resolveExecArgs(
  idOrUrl: string | undefined,
  commandArgs: string[] | undefined,
  rawArgs: string[],
  aetMode: boolean
): { idOrUrl?: string; command: string[] } {
  const sep = rawArgs.indexOf('--');
  if (sep >= 0) {
    const before = rawArgs.slice(0, sep).filter((a) => !a.startsWith('-'));
    return { idOrUrl: before[0] ?? (idOrUrl || undefined), command: rawArgs.slice(sep + 1) };
  }
  if (commandArgs && commandArgs.length > 0) {
    return { idOrUrl, command: commandArgs };
  }
  if (!aetMode) {
    return { idOrUrl, command: rawArgs.filter((a) => !a.startsWith('-') && a !== idOrUrl) };
  }
  return { idOrUrl, command: [] };
}

function sanitizeName(name: string | undefined, fallbackId: string): string {
  const clean = String(name || '')
    .toUpperCase()
    .replace(/[^A-Z0-9]+/g, '_')
    .replace(/^_+|_+$/g, '');
  return clean || String(fallbackId).toUpperCase().replace(/[^A-Z0-9]+/g, '_');
}

function parseDotenv(text: string): Record<string, string> {
  const out: Record<string, string> = {};
  for (const line of text.split(/\r?\n/)) {
    const t = line.trim();
    if (!t || t.startsWith('#')) continue;
    const m = /^\s*(?:export\s+)?([A-Za-z_][A-Za-z0-9_]*)\s*=\s*(.*)$/.exec(t);
    if (!m) continue;
    let val = m[2];
    if (
      (val.startsWith('"') && val.endsWith('"')) ||
      (val.startsWith("'") && val.endsWith("'"))
    ) {
      val = val.slice(1, -1);
    }
    out[m[1]] = val;
  }
  return out;
}

function looksLikeEnvBundle(item: any, unsealed: Record<string, string | null>): boolean {
  if (item?.isEnv) return true;
  const notes = unsealed.notes || '';
  return /^\s*(?:export\s+)?[A-Za-z_][A-Za-z0-9_]*\s*=/m.test(notes);
}

/** Builds env vars for one decrypted vault Row. Names are never secret values. */
export function buildAetEnvVars(
  item: any,
  unsealed: Record<string, string | null>,
  taken: Set<string>
): Record<string, string> {
  const vars: Record<string, string> = {};
  const claim = (key: string, val: string) => {
    let k = key;
    let n = 2;
    while (taken.has(k)) k = `${key}_${n++}`;
    taken.add(k);
    vars[k] = val;
  };

  if (looksLikeEnvBundle(item, unsealed)) {
    for (const [k, v] of Object.entries(parseDotenv(unsealed.notes || ''))) claim(k, v);
    // env bundles may also use customFields KEY=VALUE JSON
    try {
      const cf = typeof unsealed.customFields === 'string' ? JSON.parse(unsealed.customFields) : unsealed.customFields;
      if (cf && typeof cf === 'object') {
        const entries = Array.isArray(cf)
          ? cf.map((f: any) => [f.label || f.key || f.name, f.value])
          : Object.entries(cf);
        for (const [k, v] of entries as any[]) {
          if (k && v != null) claim(String(k).trim(), String(v));
        }
      }
    } catch {}
    return vars;
  }

  const base = `KYLRIX_SECRET_${sanitizeName(unsealed.name || item?.name, item?.id || 'ITEM')}`;
  if (unsealed.username) claim(`${base}_USERNAME`, unsealed.username);
  if (unsealed.password) claim(`${base}_PASSWORD`, unsealed.password);
  if (unsealed.url) claim(`${base}_URL`, unsealed.url);
  return vars;
}

async function decryptGrantedRows(enclave: OpenEnclave, items: any[]) {
  const taken = new Set<string>();
  const vars: Record<string, string> = {};
  const names: string[] = [];
  for (const item of items) {
    const key = `credential:${item.id}` as AetResourceKey;
    const dek = await enclave.unlockDek(key);
    if (!dek) continue; // not granted: stays locked
    try {
      const unsealed: Record<string, string | null> = {};
      const sealed = item.sealed || {};
      for (const f of ENV_FIELDS) {
        const v = sealed[f];
        unsealed[f] = typeof v === 'string' && v ? await decryptRowField(v, dek) : null;
      }
      Object.assign(vars, buildAetEnvVars(item, unsealed, taken));
      names.push(unsealed.name || item.id);
    } finally {
      zeroClearBytes(dek);
    }
  }
  return { vars, names };
}

async function execAetMode(
  idOrUrl: string | undefined,
  commandArgs: string[],
  opts: { url?: string; token?: string; json?: boolean }
) {
  const raw =
    (opts.token && isAgentEnclaveToken(opts.token) ? opts.token : process.env.KYLRIX_AGENT_KEY) || '';
  if (!raw) {
    printError('No agent key found. Set KYLRIX_AGENT_KEY or pass --token.');
    process.exit(1);
  }
  if (opts.token && isAgentEnclaveToken(opts.token)) {
    console.warn(pc.yellow('Your agent key may be saved in shell history. Prefer: export KYLRIX_AGENT_KEY=…'));
  }
  if (!commandArgs || commandArgs.length === 0) {
    printError('Missing command to execute. Usage: `kylrix exec [<id>] -- <command...>`');
    process.exit(1);
  }

  let enclave: OpenEnclave | null = null;
  try {
    enclave = await openEnclave(raw, opts);
    const client = getClient({ url: opts.url, token: enclave.bearer });

    let items: any[] = [];
    if (idOrUrl) {
      const one = await client.vault.get(idOrUrl, { sealed: true });
      items = one ? [one] : [];
    } else {
      let offset = 0;
      while (items.length < MAX_SEALED_ROWS) {
        const page = await client.vault.list({ limit: 100, sealed: true });
        const batch = (page as any).items || page || [];
        items = items.concat(batch);
        if (!Array.isArray(batch) || batch.length < 100) break;
        offset += batch.length;
        if (offset > MAX_SEALED_ROWS) break;
      }
      items = items.slice(0, MAX_SEALED_ROWS);
    }

    const { vars, names } = await decryptGrantedRows(enclave, items);
    enclave.close(); // unlock bytes are no longer needed before spawn

    if (opts.json) {
      printJson({ loaded: names.length, items: names });
    } else {
      console.log(pc.dim(`Loaded ${names.length} secret(s) from your agent key`));
    }

    const childEnv = { ...process.env, ...vars };
    // The child gets the secrets, not the key that unlocks everything else.
    delete childEnv.KYLRIX_AGENT_KEY;
    delete childEnv.KYLRIX_TOKEN;

    const [bin, ...args] = commandArgs;
    const child = spawn(bin, args, { stdio: 'inherit', env: childEnv, shell: true });
    child.on('error', (e) => {
      printError(`Could not start ${bin}`, e);
      process.exit(127);
    });
    child.on('exit', (code, signal) => {
      // Drop references to decrypted values; JS strings cannot be wiped from memory.
      for (const key of Object.keys(vars)) {
        delete (childEnv as any)[key];
        delete (vars as any)[key];
      }
      if (signal) process.kill(process.pid, signal);
      else process.exit(code ?? 0);
    });
  } catch (err: any) {
    printError('Could not unlock items with your agent key', err);
    process.exit(1);
  } finally {
    enclave?.close();
  }
}

export async function execCommand(
  idOrUrl: string | undefined,
  commandArgs: string[],
  opts: {
    url?: string;
    token?: string;
    shareKey?: string;
    json?: boolean;
    aetMode?: boolean;
  }
) {
  const aetMode =
    opts.aetMode ?? (isAgentEnclaveToken(opts.token) || isAgentEnclaveToken(process.env.KYLRIX_AGENT_KEY));
  if (aetMode) {
    return execAetMode(idOrUrl, commandArgs, opts);
  }
  if (!idOrUrl) {
    printError('Missing command to execute. Usage: `kylrix exec <id-or-url> -- <command...>`');
    process.exit(1);
  }
  try {
    if (!commandArgs || commandArgs.length === 0) {
      printError('Missing command to execute. Usage: `kylrix exec <id-or-url> -- <command...>`');
      process.exit(1);
    }

    const resolved = await resolveEnvSource(idOrUrl, opts);
    const varCount = Object.keys(resolved.variables).length;

    console.log(pc.dim(`⚡ [kylrix exec] Injected ${varCount} zero-leak variable(s) from "${resolved.name || idOrUrl}" into process RAM`));

    // Transient memory allocation for child process env
    const childEnv = { ...process.env, ...resolved.variables };
    const [bin, ...args] = commandArgs;

    const child = spawn(bin, args, {
      stdio: 'inherit',
      env: childEnv,
      shell: true,
    });

    child.on('exit', (code, signal) => {
      // Drop references to decrypted values; JS strings cannot be wiped from memory.
      for (const key of Object.keys(resolved.variables)) {
        delete (childEnv as any)[key];
        delete (resolved.variables as any)[key];
      }

      if (signal) {
        process.kill(process.pid, signal);
      } else {
        process.exit(code ?? 0);
      }
    });
  } catch (err: any) {
    printError(`Failed to execute process wrapper with secret "${idOrUrl}"`, err);
    process.exit(1);
  }
}
