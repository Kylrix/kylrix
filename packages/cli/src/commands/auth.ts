import { exec } from 'node:child_process';
import pc from 'picocolors';
import { getClient } from '../client';
import {
  saveConfig,
  clearConfig,
  resolveEnvironment,
  removeAccount,
  clearServerAccounts,
} from '../config';
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
  const env = resolveEnvironment(opts);

  if (opts.token) {
    const client = getClient({ url: env.apiUrl, token: opts.token });
    try {
      const profile = await client.auth.me();
      saveConfig(
        {
          apiUrl: env.apiUrl,
          token: opts.token,
          userId: profile.id,
          email: profile.email,
          tier: profile.tier,
        },
        env.apiUrl
      );
      printSuccess(`Logged in as ${pc.bold(profile.email || profile.id)}`);
      printInfo(`Server:    ${pc.cyan(env.apiUrl)}`);
      printInfo(`Partition: ${pc.yellow(env.partitionKey)}`);
      printInfo(`Data Silo: ${pc.dim(env.siloDir)}`);
      return;
    } catch (err: any) {
      printError('Invalid token provided', err);
      process.exit(1);
    }
  }

  // Instant 1-Click Browser Pairing flow targeting env.apiUrl
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
    console.log(pc.cyan('│') + '  Target Server: ' + pc.yellow(env.apiUrl.slice(0, 40).padEnd(40)) + pc.cyan('│'));
    console.log(pc.cyan('│') + '  Partition:     ' + pc.dim(env.partitionKey.slice(0, 40).padEnd(40)) + pc.cyan('│'));
    console.log(pc.cyan('│') + '                                                         ' + pc.cyan('│'));
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

    // Try fetching full profile with newly minted token
    let profileEmail: string | undefined;
    let profileTier: string | undefined;
    try {
      const authClient = getClient({ url: env.apiUrl, token: result.token });
      const profile = await authClient.auth.me();
      profileEmail = profile.email;
      profileTier = profile.tier;
    } catch {}

    saveConfig(
      {
        apiUrl: env.apiUrl,
        token: result.token,
        userId: result.userId,
        email: profileEmail,
        tier: profileTier,
      },
      env.apiUrl
    );

    const updatedEnv = resolveEnvironment({ url: env.apiUrl });

    printSuccess(`Logged in successfully as user ${pc.bold(profileEmail || result.userId)}`);
    printInfo(`Server:    ${pc.cyan(env.apiUrl)}`);
    printInfo(`Partition: ${pc.yellow(env.partitionKey)}`);
    printInfo(`Data Silo: ${pc.dim(updatedEnv.siloDir)}`);
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
        printJson({ authenticated: false, message: 'Not authenticated', server: env.apiUrl, partition: env.partitionKey });
      } else {
        printInfo(`Not currently logged in on ${pc.cyan(env.apiUrl)}.`);
        printInfo(`Run \`kylrix login\` or \`kylrix login --url ${env.apiUrl}\` to authenticate.`);
        printInfo(`Local-first SQLite silo: ${pc.dim(env.siloDbPath)}`);
      }
      return;
    }

    const profile = await client.auth.me();

    if (opts.json) {
      printJson({
        ...profile,
        apiUrl: env.apiUrl,
        partitionKey: env.partitionKey,
        siloDir: env.siloDir,
        siloDbPath: env.siloDbPath,
      });
      return;
    }

    console.log('\n' + pc.bold('Kylrix Session Info:'));
    console.log(`  ${pc.dim('User ID:')}      ${pc.bold(profile.id)}`);
    console.log(`  ${pc.dim('Email:')}        ${profile.email || 'N/A'}`);
    console.log(`  ${pc.dim('Tier:')}         ${pc.cyan(profile.tier || 'FREE')}`);
    console.log(`  ${pc.dim('API URL:')}      ${pc.cyan(env.apiUrl)}`);
    console.log(`  ${pc.dim('Partition:')}    ${pc.yellow(env.partitionKey)}`);
    console.log(`  ${pc.dim('Data Silo:')}    ${pc.dim(env.siloDir)}`);
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

export function logoutCommand(opts: { all?: boolean; purge?: boolean; url?: string } = {}) {
  const env = resolveEnvironment({ url: opts.url });

  if (opts.purge) {
    clearConfig();
    printSuccess('Purged all stored servers, account profiles, and local sessions.');
    return;
  }

  if (opts.all) {
    clearServerAccounts(env.apiUrl);
    printSuccess(`Removed all stored accounts for server ${pc.cyan(env.apiUrl)}.`);
    return;
  }

  if (env.activeAccountId) {
    const targetId = env.activeAccountId;
    removeAccount(targetId, env.apiUrl);
    const updated = resolveEnvironment({ url: env.apiUrl });
    printSuccess(`Logged out active account ${pc.bold(targetId)} from ${pc.cyan(env.apiUrl)}.`);
    if (updated.activeAccountId) {
      printInfo(`Active account switched to ${pc.bold(updated.email || updated.activeAccountId)}.`);
    }
  } else {
    printInfo(`No active account session found on ${pc.cyan(env.apiUrl)}.`);
  }
}
