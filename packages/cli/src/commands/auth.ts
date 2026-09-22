import { exec } from 'node:child_process';
import pc from 'picocolors';
import { getClient } from '../client';
import { saveConfig, clearConfig, resolveEnvironment } from '../config';
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

    console.log();
    console.log(pc.cyan('╭────────────────────────────────────────────────────────╮'));
    console.log(pc.cyan('│') + pc.bold('  Kylrix 1-Click Web Authorization                      ') + pc.cyan('│'));
    console.log(pc.cyan('├────────────────────────────────────────────────────────┤'));
    console.log(pc.cyan('│') + '  1. Open browser URL:                                  ' + pc.cyan('│'));
    console.log(pc.cyan('│') + '     ' + pc.underline(pc.cyan(directLoginUrl.padEnd(51))) + pc.cyan('│'));
    console.log(pc.cyan('│') + '                                                         ' + pc.cyan('│'));
    console.log(pc.cyan('│') + '  2. Authorization Code:                                 ' + pc.cyan('│'));
    console.log(pc.cyan('│') + '     ' + pc.bgYellow(pc.black(pc.bold(` ${session.userCode} `))) + '                                            ' + pc.cyan('│'));
    console.log(pc.cyan('╰────────────────────────────────────────────────────────╯'));
    console.log();

    // Auto-open browser
    tryOpenBrowser(directLoginUrl);

    if (process.stdout.isTTY) {
      process.stdout.write(pc.dim('⏳ Waiting for approval in browser...'));
    } else {
      console.log(pc.dim('Waiting for approval in browser...'));
    }

    let pollCount = 0;
    const result = await client.pairing.pollExchange(session.deviceCode, {
      intervalSeconds: session.interval || 3,
      timeoutSeconds: session.expiresIn || 600,
      onPoll: () => {
        if (process.stdout.isTTY) {
          pollCount++;
          const dots = '.'.repeat((pollCount % 3) + 1);
          process.stdout.write(`\r${pc.dim(`⏳ Waiting for approval in browser${dots.padEnd(3)}`)}`);
        }
      },
    });

    if (process.stdout.isTTY) {
      process.stdout.write('\r' + ' '.repeat(50) + '\r');
    }

    saveConfig({
      apiUrl: env.apiUrl,
      token: result.token,
      userId: result.userId,
    });

    printSuccess(`Logged in successfully as user ${pc.bold(result.userId)}`);
  } catch (err: any) {
    if (process.stdout.isTTY) {
      process.stdout.write('\r' + ' '.repeat(50) + '\r');
    }
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
