import pc from 'picocolors';
import {
  listAccounts,
  switchAccount,
  removeAccount,
  resolveEnvironment,
  loadConfig,
} from '../config';
import { printError, printInfo, printJson, printSuccess } from '../formatter';

export function listAccountsCommand(opts: { all?: boolean; json?: boolean; url?: string } = {}) {
  const env = resolveEnvironment({ url: opts.url });

  if (opts.all) {
    const config = loadConfig();
    const result: any[] = [];

    if (opts.json) {
      for (const server of Object.values(config.servers)) {
        result.push({
          serverUrl: server.baseUrl,
          partitionKey: server.partitionKey,
          activeAccountId: server.activeAccountId,
          accounts: Object.values(server.accounts),
        });
      }
      printJson(result);
      return;
    }

    console.log();
    console.log(pc.bold('Kylrix Accounts (All Base URIs & Silos):'));

    for (const server of Object.values(config.servers)) {
      const isCurrentServer = server.baseUrl === env.apiUrl;
      const marker = isCurrentServer ? pc.green('● ') : pc.dim('○ ');
      console.log(`\n  ${marker}${pc.cyan(server.baseUrl)} ${pc.dim(`(Partition: ${server.partitionKey})`)}`);

      const accs = Object.values(server.accounts);
      if (accs.length === 0) {
        console.log(`    ${pc.dim('No authenticated accounts. Run `kylrix login --url ' + server.baseUrl + '`')}`);
      } else {
        for (const acc of accs) {
          const isActive = acc.userId === server.activeAccountId;
          const accMarker = isActive ? pc.green('  * ') : '    ';
          const emailStr = acc.email ? pc.bold(acc.email) : pc.bold(acc.userId);
          const idStr = acc.email ? pc.dim(`(${acc.userId})`) : '';
          const tierStr = acc.tier ? pc.cyan(`[${acc.tier}]`) : '';
          const activeTag = isActive ? pc.bgGreen(pc.black(' ACTIVE ')) : '';
          console.log(`${accMarker}${emailStr} ${idStr} ${tierStr} ${activeTag}`);
          if (isActive) {
            console.log(`      ${pc.dim(`Silo: ~/.kylrix/silos/${server.partitionKey}/${acc.userId}/`)}`);
          }
        }
      }
    }
    console.log();
    return;
  }

  const { serverUrl, partitionKey, activeAccountId, accounts } = listAccounts(env.apiUrl);

  if (opts.json) {
    printJson({
      serverUrl,
      partitionKey,
      activeAccountId,
      accounts,
    });
    return;
  }

  console.log();
  console.log(pc.bold(`Kylrix Accounts on ${pc.cyan(serverUrl)}:`));
  console.log(`  ${pc.dim('Partition:')} ${pc.yellow(partitionKey)}`);

  if (accounts.length === 0) {
    console.log(`\n  ${pc.dim('No accounts configured on this base URI.')}`);
    console.log(`  ${pc.dim(`Run \`kylrix login --url ${serverUrl}\` to authenticate a new account.`)}\n`);
    return;
  }

  console.log();
  for (const acc of accounts) {
    const isActive = acc.userId === activeAccountId;
    const marker = isActive ? pc.green('  * ') : '    ';
    const emailStr = acc.email ? pc.bold(acc.email) : pc.bold(acc.userId);
    const idStr = acc.email ? pc.dim(`(${acc.userId})`) : '';
    const tierStr = acc.tier ? pc.cyan(`[${acc.tier}]`) : '';
    const activeTag = isActive ? pc.bgGreen(pc.black(' ACTIVE ')) : '';
    console.log(`${marker}${emailStr} ${idStr} ${tierStr} ${activeTag}`);
    if (isActive) {
      console.log(`      ${pc.dim(`Silo: ~/.kylrix/silos/${partitionKey}/${acc.userId}/`)}`);
    }
  }
  console.log();
}

export function switchAccountCommand(
  idOrEmail: string,
  opts: { url?: string; json?: boolean } = {}
) {
  try {
    const env = resolveEnvironment({ url: opts.url });
    const switched = switchAccount(idOrEmail, env.apiUrl);
    const updated = resolveEnvironment({ url: env.apiUrl });

    if (opts.json) {
      printJson(switched);
      return;
    }

    printSuccess(`Switched active account to ${pc.bold(switched.email || switched.userId)}`);
    printInfo(`Server:    ${pc.cyan(env.apiUrl)}`);
    printInfo(`Partition: ${pc.yellow(env.partitionKey)}`);
    printInfo(`Data Silo: ${pc.dim(updated.siloDir)}`);
  } catch (err: any) {
    printError('Failed to switch account', err);
    process.exit(1);
  }
}

export function currentAccountCommand(opts: { url?: string; json?: boolean } = {}) {
  const env = resolveEnvironment({ url: opts.url });

  if (opts.json) {
    printJson({
      serverUrl: env.apiUrl,
      partitionKey: env.partitionKey,
      activeAccountId: env.activeAccountId,
      email: env.email,
      siloDir: env.siloDir,
    });
    return;
  }

  if (!env.activeAccountId) {
    printInfo(`No active account logged in on ${pc.cyan(env.apiUrl)}.`);
    printInfo(`Local anonymous silo: ${pc.dim(env.siloDir)}`);
    return;
  }

  console.log();
  console.log(pc.bold('Active Account Profile:'));
  console.log(`  ${pc.dim('User ID:')}      ${pc.bold(env.userId || 'N/A')}`);
  console.log(`  ${pc.dim('Email:')}        ${env.email || 'N/A'}`);
  console.log(`  ${pc.dim('Tier:')}         ${pc.cyan(env.tier || 'FREE')}`);
  console.log(`  ${pc.dim('Base URI:')}     ${pc.cyan(env.apiUrl)}`);
  console.log(`  ${pc.dim('Partition:')}    ${pc.yellow(env.partitionKey)}`);
  console.log(`  ${pc.dim('Data Silo:')}    ${pc.dim(env.siloDir)}`);
  if (env.workspaceId) {
    console.log(`  ${pc.dim('Workspace:')}    ${pc.green(env.workspaceId)}`);
  }
  console.log();
}

export function removeAccountCommand(idOrEmail: string, opts: { url?: string } = {}) {
  const env = resolveEnvironment({ url: opts.url });
  const ok = removeAccount(idOrEmail, env.apiUrl);

  if (ok) {
    printSuccess(`Removed account profile "${idOrEmail}" from ${pc.cyan(env.apiUrl)}.`);
  } else {
    printError(`Account "${idOrEmail}" not found on server ${env.apiUrl}.`);
    process.exit(1);
  }
}
