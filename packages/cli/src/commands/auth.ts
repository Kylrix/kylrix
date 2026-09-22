import * as clack from '@clack/prompts';
import { exec } from 'node:child_process';
import pc from 'picocolors';
import { getClient } from '../client';
import { loadConfig, saveConfig, clearConfig, resolveEnvironment } from '../config';
import { printError, printInfo, printJson, printSuccess } from '../formatter';

function tryOpenBrowser(url: string) {
  const start =
    process.platform === 'darwin'
      ? 'open'
      : process.platform === 'win32'
      ? 'start'
      : 'xdg-open';
  exec(`${start} "${url}"`, () => {});
}

export async function loginCommand(opts: { url?: string; token?: string }) {
  if (opts.token) {
    const env = resolveEnvironment(opts);
    const client = getClient({ url: env.apiUrl, token: opts.token });
    try {
      const profile = await client.auth.me();
      saveConfig({
        apiUrl: env.apiUrl,
        token: opts.token,
        userId: profile.id,
        email: profile.email,
      });
      printSuccess(`Logged in as ${pc.bold(profile.email || profile.id)}`);
      return;
    } catch (err: any) {
      printError('Invalid token provided', err);
      process.exit(1);
    }
  }

  // Instant 1-Click Browser Pairing flow
  await pairCommand(opts);
}

export async function pairCommand(opts: { url?: string; json?: boolean }) {
  const env = resolveEnvironment({ url: opts.url });
  const client = getClient({ url: env.apiUrl });

  try {
    const session = await client.pairing.requestPairing({
      clientName: 'Kylrix CLI',
      clientType: 'cli',
      requestedScopes: ['*'],
    });

    if (opts.json) {
      printJson(session);
      return;
    }

    const baseWebUrl = env.apiUrl.replace(/\/api\/v1$/, '');
    const directLoginUrl = `${baseWebUrl}/login/${session.userCode}`;
    const pairUrl = session.verificationUri || `${baseWebUrl}/pair?code=${encodeURIComponent(session.userCode)}`;

    clack.intro(pc.bgCyan(pc.black(' Kylrix 1-Click Web Login ')));

    console.log(`\n  ${pc.bold('1. Visit authorization URL:')}`);
    console.log(`     ${pc.underline(pc.bold(pc.cyan(directLoginUrl)))}`);
    console.log(`     ${pc.dim(`(Or: ${pairUrl})`)}`);
    console.log(`\n  ${pc.bold('2. Instant Code:')}`);
    console.log(`     ${pc.bgYellow(pc.black(pc.bold(` ${session.userCode} `)))}\n`);

    // Auto-open browser
    tryOpenBrowser(directLoginUrl);

    const spinner = clack.spinner();
    spinner.start('Waiting for web authorization (click Approve in your browser)...');

    const result = await client.pairing.pollExchange(session.deviceCode, {
      intervalSeconds: session.interval || 3,
      timeoutSeconds: session.expiresIn || 600,
    });

    spinner.stop(pc.green('Authorization approved!'));

    saveConfig({
      apiUrl: env.apiUrl,
      token: result.token,
      userId: result.userId,
    });

    clack.outro(pc.green(`✔ Logged in successfully as user ${pc.bold(result.userId)}`));
  } catch (err: any) {
    printError('Authentication failed', err);
    process.exit(1);
  }
}

export async function whoamiCommand(opts: { url?: string; token?: string; json?: boolean }) {
  try {
    const client = getClient(opts);
    const env = resolveEnvironment(opts);

    if (!env.token) {
      if (opts.json) {
        printJson({ authenticated: false, message: 'Not authenticated' });
      } else {
        printInfo('Not currently logged in. Run `kylrix login` to authenticate.');
      }
      return;
    }

    const profile = await client.auth.me();

    if (opts.json) {
      printJson(profile);
      return;
    }

    console.log('\n' + pc.bold('Kylrix Session Info:'));
    console.log(`  ${pc.dim('User ID:')}      ${pc.bold(profile.id)}`);
    console.log(`  ${pc.dim('Email:')}        ${profile.email || 'N/A'}`);
    console.log(`  ${pc.dim('Tier:')}         ${pc.cyan(profile.tier || 'FREE')}`);
    console.log(`  ${pc.dim('API URL:')}      ${env.apiUrl}`);
    console.log(`  ${pc.dim('Scopes:')}       ${profile.scopes?.join(', ') || 'all'}`);
    if (env.workspaceId) {
      console.log(`  ${pc.dim('Workspace:')}    ${pc.green(env.workspaceId)}`);
    }
    console.log();
  } catch (err: any) {
    printError('Failed to fetch profile', err);
    process.exit(1);
  }
}

export function logoutCommand() {
  clearConfig();
  printSuccess('Logged out successfully. Removed stored local session.');
}
