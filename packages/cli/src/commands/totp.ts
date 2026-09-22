import pc from 'picocolors';
import { requireAuthClient } from '../client';
import { printError, printJson, printSuccess, printTable, printWarning } from '../formatter';
import { getVaultSession } from '../crypto/session';
import { generateTotp } from '../crypto/totp';

export async function listTotpCommand(opts: {
  url?: string;
  token?: string;
  workspace?: string;
  json?: boolean;
  limit?: string;
}) {
  try {
    const client = requireAuthClient(opts);
    const limit = opts.limit ? parseInt(opts.limit, 10) : 50;
    const session = getVaultSession();

    const items = await client.totp.list({
      limit,
      workspaceId: opts.workspace,
      mek: session?.mekHex,
    });

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
        workspace: t.workspaceId || 'personal',
      };
    });

    printTable(rows, ['id', 'name', 'issuer', 'account', 'code', 'workspace']);
    if (!session) {
      console.log(pc.dim('\nTip: Run `kylrix vault unlock` to show live 2FA verification codes.'));
    }
  } catch (err: any) {
    printError('Failed to list TOTP entries', err);
    process.exit(1);
  }
}

export async function getTotpCodeCommand(id: string, opts: { url?: string; token?: string; pure?: boolean }) {
  try {
    const client = requireAuthClient(opts);
    const session = getVaultSession();

    const item = await client.totp.get(id, {
      mek: session?.mekHex,
    });

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
    const client = requireAuthClient(opts);
    const session = getVaultSession();

    const item = await client.totp.create(
      {
        name,
        secret: opts.secret,
        issuer: opts.issuer,
        account: opts.account,
      },
      {
        mek: session?.mekHex,
        workspaceId: opts.workspace,
      }
    );

    if (opts.json) {
      printJson(item);
      return;
    }

    printSuccess(`Created TOTP seed "${pc.bold(item.name || item.id)}" (ID: ${item.id})`);
  } catch (err: any) {
    printError('Failed to create TOTP entry', err);
    process.exit(1);
  }
}

export async function deleteTotpCommand(id: string, opts: { url?: string; token?: string; json?: boolean }) {
  try {
    const client = requireAuthClient(opts);
    await client.totp.delete(id);

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
