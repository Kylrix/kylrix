import pc from 'picocolors';
import {
  listServers,
  switchServer,
  removeServer,
  resolveEnvironment,
  normalizeBaseUrl,
  getBaseUriPartitionKey,
  saveConfig,
} from '../config';
import { printError, printInfo, printJson, printSuccess } from '../formatter';

export function listServersCommand(opts: { json?: boolean } = {}) {
  const servers = listServers();

  if (opts.json) {
    printJson(servers);
    return;
  }

  console.log();
  console.log(pc.bold('Kylrix Server Base URIs & Silo Partitions:'));

  for (const s of servers) {
    const marker = s.isCurrent ? pc.green('● ') : pc.dim('○ ');
    const tag = s.isCurrent ? pc.bgGreen(pc.black(' ACTIVE ')) : '';
    const accCountStr = s.accountCount === 1 ? '1 account' : `${s.accountCount} accounts`;
    const accDetail = s.activeAccount ? `[Active: ${s.activeAccount}]` : pc.dim('(no active login)');

    console.log(`\n  ${marker}${pc.cyan(s.baseUrl)} ${tag}`);
    console.log(`    ${pc.dim('Partition:')} ${pc.yellow(s.partitionKey)}`);
    console.log(`    ${pc.dim('Accounts:')}  ${accCountStr} ${accDetail}`);
    console.log(`    ${pc.dim('Silo Root:')} ~/.kylrix/silos/${s.partitionKey}/`);
  }
  console.log();
}

export function switchServerCommand(url: string, opts: { json?: boolean } = {}) {
  try {
    const norm = normalizeBaseUrl(url);
    const server = switchServer(norm);
    const env = resolveEnvironment({ url: norm });

    if (opts.json) {
      printJson(server);
      return;
    }

    printSuccess(`Switched active server to ${pc.cyan(server.baseUrl)}`);
    printInfo(`Partition: ${pc.yellow(server.partitionKey)}`);
    if (env.activeAccountId) {
      printInfo(`Active Account: ${pc.bold(env.email || env.activeAccountId)}`);
      printInfo(`Data Silo:      ${pc.dim(env.siloDir)}`);
    } else {
      printInfo(`No active account yet. Authenticate with \`kylrix login --url ${server.baseUrl}\`.`);
    }
  } catch (err: any) {
    printError('Failed to switch server base URL', err);
    process.exit(1);
  }
}

export function currentServerCommand(opts: { json?: boolean } = {}) {
  const env = resolveEnvironment();

  if (opts.json) {
    printJson({
      baseUrl: env.apiUrl,
      partitionKey: env.partitionKey,
      activeAccountId: env.activeAccountId,
      email: env.email,
      siloDir: env.siloDir,
    });
    return;
  }

  console.log();
  console.log(pc.bold('Active Server Base URI:'));
  console.log(`  ${pc.dim('URL:')}          ${pc.cyan(env.apiUrl)}`);
  console.log(`  ${pc.dim('Partition:')}    ${pc.yellow(env.partitionKey)}`);
  console.log(`  ${pc.dim('Silo Root:')}    ~/.kylrix/silos/${env.partitionKey}/`);
  if (env.activeAccountId) {
    console.log(`  ${pc.dim('Active User:')}  ${pc.bold(env.email || env.activeAccountId)}`);
    console.log(`  ${pc.dim('User Silo:')}    ${pc.dim(env.siloDir)}`);
  }
  console.log();
}

export function addServerCommand(url: string) {
  try {
    const norm = normalizeBaseUrl(url);
    const server = switchServer(norm);
    printSuccess(`Added and activated server ${pc.cyan(server.baseUrl)}`);
    printInfo(`Partition: ${pc.yellow(server.partitionKey)}`);
    printInfo(`Run \`kylrix login --url ${server.baseUrl}\` to authenticate.`);
  } catch (err: any) {
    printError('Failed to add server', err);
    process.exit(1);
  }
}

export function removeServerCommand(url: string) {
  const norm = normalizeBaseUrl(url);
  const ok = removeServer(norm);

  if (ok) {
    printSuccess(`Removed server ${pc.cyan(norm)} and its account configuration.`);
    const current = resolveEnvironment();
    printInfo(`Active server is now ${pc.cyan(current.apiUrl)} (${current.partitionKey}).`);
  } else {
    printError(`Server ${norm} is not in configuration.`);
    process.exit(1);
  }
}
