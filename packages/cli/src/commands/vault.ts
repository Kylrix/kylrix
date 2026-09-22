import * as clack from '@clack/prompts';
import * as fs from 'node:fs';
import pc from 'picocolors';
import { getClient, hasAuth } from '../client';
import { printError, printJson, printSuccess, printTable, printWarning } from '../formatter';
import { getVaultSession, setVaultSession, clearVaultSession } from '../crypto/session';
import { LocalStore } from '../local/store';

export async function unlockVaultCommand(opts: {
  url?: string;
  token?: string;
  password?: string;
  expiryMinutes?: string;
  json?: boolean;
}) {
  try {
    const isAuthed = hasAuth(opts);
    let masterPassword = opts.password;

    if (!masterPassword) {
      const passAnswer = await clack.password({
        message: 'Enter your Master Password:',
        validate: (val) => (!val ? 'Master Password cannot be empty' : undefined),
      });

      if (clack.isCancel(passAnswer)) {
        clack.cancel('Unlock cancelled.');
        process.exit(0);
      }
      masterPassword = String(passAnswer);
    }

    const spinner = clack.spinner();
    spinner.start('Deriving and unlocking Master Encryption Key (MEK)...');

    let mek = 'local_mek_active';
    if (isAuthed) {
      const res = await getClient(opts).vault.unlockUserMek(masterPassword);
      if (!res.mek) {
        spinner.stop(pc.red('Unlock failed.'));
        throw new Error('Could not unwrap Master Encryption Key. Verify your Master Password.');
      }
      mek = res.mek;
    }

    const expiry = opts.expiryMinutes ? parseInt(opts.expiryMinutes, 10) : 60;
    const session = setVaultSession(mek, expiry);
    spinner.stop(pc.green('Vault unlocked successfully!'));

    if (opts.json) {
      printJson(session);
      return;
    }

    printSuccess(`Vault unlocked for the next ${expiry} minutes.`);
    console.log(pc.dim('Tip: Use `kylrix vault lock` anytime to immediately seal your secrets.'));
  } catch (err: any) {
    printError('Failed to unlock vault', err);
    process.exit(1);
  }
}

export function lockVaultCommand(opts: { json?: boolean } = {}) {
  clearVaultSession();
  if (opts.json) {
    printJson({ locked: true });
    return;
  }
  printSuccess('Vault locked. Unlocked session key wiped from memory.');
}

export function statusVaultCommand(opts: { json?: boolean } = {}) {
  const session = getVaultSession();
  const unlocked = session !== null;

  if (opts.json) {
    printJson({
      unlocked,
      expiresAt: session?.expiresAt ? new Date(session.expiresAt).toISOString() : null,
      remainingMinutes: session ? Math.max(0, Math.round((session.expiresAt - Date.now()) / 60000)) : 0,
    });
    return;
  }

  console.log('\n' + pc.bold('Vault Security Status:'));
  if (unlocked && session) {
    const remaining = Math.max(0, Math.round((session.expiresAt - Date.now()) / 60000));
    console.log(`  Status:    ${pc.green(pc.bold('UNLOCKED'))}`);
    console.log(`  Expires:   In ${remaining} minute(s)`);
  } else {
    console.log(`  Status:    ${pc.yellow(pc.bold('LOCKED'))}`);
    console.log(pc.dim('  Run `kylrix vault unlock` to decrypt credentials and environment variables.'));
  }
  console.log();
}

export async function listVaultCommand(opts: {
  url?: string;
  token?: string;
  workspace?: string;
  decrypt?: boolean;
  json?: boolean;
  limit?: string;
}) {
  try {
    const isAuthed = hasAuth(opts);
    const limit = opts.limit ? parseInt(opts.limit, 10) : 50;
    const session = opts.decrypt ? getVaultSession() : null;

    if (opts.decrypt && !session && isAuthed) {
      printWarning('Vault is locked. Run `kylrix vault unlock` first or run without `--decrypt`.');
    }

    const items = isAuthed
      ? await getClient(opts).vault.list({
          limit,
          workspaceId: opts.workspace,
          mek: session?.mekHex,
        })
      : LocalStore.listVault();

    if (opts.json) {
      printJson(items);
      return;
    }

    const rows = (items || []).map((v: any) => ({
      id: v.id,
      name: v.name,
      type: v.itemType || (v.isEnv ? 'env' : 'login'),
      username: v.username || v.identity || (v.isEnv ? '(env-vars)' : ''),
      mode: isAuthed ? (v.workspaceId || 'cloud') : pc.dim('local'),
      updatedAt: v.updatedAt?.substring(0, 10) || '',
    }));

    printTable(rows, ['id', 'name', 'type', 'username', 'mode', 'updatedAt']);
    if (!isAuthed) {
      console.log(pc.dim('💡 Local-first mode. Run `kylrix login` to sync secrets with cloud.'));
    }
  } catch (err: any) {
    printError('Failed to list vault items', err);
    process.exit(1);
  }
}

export async function getVaultCommand(
  id: string,
  opts: {
    url?: string;
    token?: string;
    decrypt?: boolean;
    format?: string;
    pure?: boolean;
    json?: boolean;
  }
) {
  try {
    const isAuthed = hasAuth(opts);
    const session = opts.decrypt ? getVaultSession() : null;

    const item = isAuthed
      ? await getClient(opts).vault.get(id, {
          mek: session?.mekHex,
          format: opts.format,
          pure: opts.pure,
        })
      : LocalStore.getVault(id);

    if (opts.json) {
      printJson(item);
      return;
    }

    if (opts.format === 'env' && item.envText) {
      console.log(item.envText);
      return;
    }

    console.log('\n' + pc.bold(item.name || '(Untitled Secret)'));
    console.log(pc.dim('─'.repeat(40)));
    console.log(`ID:        ${item.id}`);
    console.log(`Type:      ${item.itemType || (item.isEnv ? 'env' : 'login')}`);
    console.log(`Mode:      ${isAuthed ? 'Cloud' : 'Local-First'}`);
    if (item.username) console.log(`Username:  ${item.username}`);
    if (item.password) console.log(`Password:  ${item.password}`);
    if (item.url) console.log(`URL:       ${item.url}`);
    if (item.notes) {
      console.log(pc.dim('─'.repeat(40)));
      console.log(item.notes);
    }
    if (item.customFields) {
      console.log(pc.dim('─'.repeat(40)));
      console.log(pc.bold('Custom Fields / Environment Variables:'));
      console.log(typeof item.customFields === 'string' ? item.customFields : JSON.stringify(item.customFields, null, 2));
    }
    console.log();
  } catch (err: any) {
    printError(`Failed to get secret "${id}"`, err);
    process.exit(1);
  }
}

export async function createVaultCommand(
  name: string,
  opts: {
    url?: string;
    token?: string;
    workspace?: string;
    username?: string;
    password?: string;
    serviceUrl?: string;
    notes?: string;
    isEnv?: boolean;
    envFile?: string;
    itemType?: string;
    json?: boolean;
  }
) {
  try {
    const isAuthed = hasAuth(opts);
    const session = getVaultSession();

    let customFields: any = undefined;
    if (opts.envFile) {
      if (!fs.existsSync(opts.envFile)) {
        throw new Error(`File not found: ${opts.envFile}`);
      }
      customFields = fs.readFileSync(opts.envFile, 'utf-8');
    }

    const payload = {
      name,
      username: opts.username,
      password: opts.password,
      url: opts.serviceUrl,
      notes: opts.notes,
      isEnv: opts.isEnv || Boolean(opts.envFile),
      itemType: opts.itemType || (opts.isEnv || opts.envFile ? 'env' : 'login'),
      customFields,
    };

    const item = isAuthed
      ? await getClient(opts).vault.create(payload, {
          mek: session?.mekHex,
          workspaceId: opts.workspace,
        })
      : LocalStore.createVault(payload);

    if (opts.json) {
      printJson(item);
      return;
    }

    printSuccess(`Created secret "${pc.bold(item.name || item.id)}" (ID: ${item.id}) [${isAuthed ? 'Cloud' : 'Local'}]`);
  } catch (err: any) {
    printError('Failed to create vault secret', err);
    process.exit(1);
  }
}

export async function deleteVaultCommand(id: string, opts: { url?: string; token?: string; json?: boolean }) {
  try {
    const isAuthed = hasAuth(opts);
    if (isAuthed) {
      await getClient(opts).vault.delete(id);
    } else {
      LocalStore.deleteVault(id);
    }

    if (opts.json) {
      printJson({ success: true, id });
      return;
    }

    printSuccess(`Deleted vault secret "${id}"`);
  } catch (err: any) {
    printError(`Failed to delete secret "${id}"`, err);
    process.exit(1);
  }
}
