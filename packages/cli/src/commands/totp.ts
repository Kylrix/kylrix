import pc from 'picocolors';
import { getClient, hasAuth } from '../client';
import { printError, printJson, printSuccess, printTable } from '../formatter';
import { getVaultSession } from '../crypto/session';
import { generateTotp } from '../crypto/totp';
import { LocalStore } from '../local/store';

export async function listTotpCommand(opts: {
  url?: string;
  token?: string;
  workspace?: string;
  json?: boolean;
  limit?: string;
}) {
  try {
    const isAuthed = hasAuth(opts);
    const limit = opts.limit ? parseInt(opts.limit, 10) : 50;
    const session = getVaultSession();

    const items = isAuthed
      ? await getClient(opts).totp.list({
          limit,
          workspaceId: opts.workspace,
          mek: session?.mekHex,
        })
      : LocalStore.listTotp();

    if (opts.json) {
      printJson(items);
      return;
    }

    const rows = (items || []).map((t: any) => {
      let codeDisplay = pc.dim('locked');
      if (t.secret) {
        try {
          const { code, remainingSeconds } = generateTotp(t.secret);
          codeDisplay = `${pc.bold(pc.green(code))} (${remainingSeconds}s)`;
        } catch {
          codeDisplay = pc.red('invalid secret');
        }
      }
      return {
        id: t.id,
        name: t.name || t.label || '(Untitled TOTP)',
        issuer: t.issuer || '',
        account: t.account || '',
        code: codeDisplay,
        mode: isAuthed ? (t.workspaceId || 'cloud') : pc.dim('local'),
      };
    });

    printTable(rows, ['id', 'name', 'issuer', 'account', 'code', 'mode']);
    if (isAuthed && !session) {
      console.log(pc.dim('\nTip: Run `kylrix vault unlock` to show live 2FA verification codes.'));
    }
  } catch (err: any) {
    printError('Failed to list TOTP entries', err);
    process.exit(1);
  }
}

export async function getTotpCodeCommand(id: string, opts: { url?: string; token?: string; pure?: boolean }) {
  try {
    const isAuthed = hasAuth(opts);
    const session = getVaultSession();

    const item = isAuthed
      ? await getClient(opts).totp.get(id, { mek: session?.mekHex })
      : LocalStore.getTotp(id);

    if (!item.secret) {
      throw new Error('Could not decrypt TOTP secret. Please run `kylrix vault unlock` first.');
    }

    const { code, remainingSeconds } = generateTotp(item.secret);

    if (opts.pure) {
      process.stdout.write(code + '\n');
      return;
    }

    console.log(`\n  ${pc.bold(item.name || item.issuer || '2FA Code')}: ${pc.bold(pc.green(code))} (${remainingSeconds}s remaining)\n`);
  } catch (err: any) {
    printError(`Failed to generate TOTP code for "${id}"`, err);
    process.exit(1);
  }
}

export async function createTotpCommand(
  name: string,
  opts: {
    url?: string;
    token?: string;
    workspace?: string;
    secret: string;
    issuer?: string;
    account?: string;
    json?: boolean;
  }
) {
  try {
    const isAuthed = hasAuth(opts);
    const session = getVaultSession();

    const payload = {
      name,
      secret: opts.secret,
      issuer: opts.issuer,
      account: opts.account,
    };

    const item = isAuthed
      ? await getClient(opts).totp.create(payload, {
          mek: session?.mekHex,
          workspaceId: opts.workspace,
        })
      : LocalStore.createTotp(payload);

    if (opts.json) {
      printJson(item);
      return;
    }

    printSuccess(`Created TOTP seed "${pc.bold(item.name || item.id)}" (ID: ${item.id}) [${isAuthed ? 'Cloud' : 'Local'}]`);
  } catch (err: any) {
    printError('Failed to create TOTP entry', err);
    process.exit(1);
  }
}

export async function deleteTotpCommand(id: string, opts: { url?: string; token?: string; json?: boolean }) {
  try {
    const isAuthed = hasAuth(opts);
    if (isAuthed) {
      await getClient(opts).totp.delete(id);
    } else {
      LocalStore.deleteTotp(id);
    }

    if (opts.json) {
      printJson({ success: true, id });
      return;
    }

    printSuccess(`Deleted TOTP entry "${id}"`);
  } catch (err: any) {
    printError(`Failed to delete TOTP "${id}"`, err);
    process.exit(1);
  }
}
