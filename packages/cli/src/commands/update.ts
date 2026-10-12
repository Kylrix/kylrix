import pc from 'picocolors';
import * as clack from '@clack/prompts';
import {
  CURRENT_VERSION,
  PACKAGE_NAME,
  compareSemver,
  executeUpgrade,
  fetchLatestVersion,
  writeCachedUpdate,
} from '../updater';
import { printError, printJson } from '../formatter';

export async function updateCommand(opts: { json?: boolean; force?: boolean }) {
  if (opts.json) {
    const latest = await fetchLatestVersion();
    const updateAvailable = latest ? compareSemver(latest, CURRENT_VERSION) > 0 : false;
    printJson({
      packageName: PACKAGE_NAME,
      currentVersion: CURRENT_VERSION,
      latestVersion: latest || CURRENT_VERSION,
      updateAvailable,
    });
    return;
  }

  clack.intro(pc.bgCyan(pc.black(' Kylrix CLI Updater ')));
  clack.log.step('Checking for updates on npm registry...');

  const latest = await fetchLatestVersion(5000);
  if (!latest) {
    clack.log.warn('Could not reach npm registry or version not published yet.');
    clack.outro(pc.dim('Please check your network connection and try again.'));
    return;
  }

  const hasUpdate = compareSemver(latest, CURRENT_VERSION) > 0;

  if (!hasUpdate && !opts.force) {
    clack.log.success(pc.green(`You are already running the latest version (v${CURRENT_VERSION})!`));
    writeCachedUpdate(CURRENT_VERSION);
    clack.outro(pc.dim('No update required.'));
    return;
  }

  clack.log.info(
    hasUpdate
      ? `New version available: ${pc.dim(`v${CURRENT_VERSION}`)} → ${pc.green(pc.bold(`v${latest}`))}`
      : `Re-installing v${CURRENT_VERSION}...`
  );

  try {
    await executeUpgrade(latest);
    writeCachedUpdate(latest);
    clack.outro(pc.green(`✔ ${PACKAGE_NAME} is now up to date (v${latest})!`));
  } catch (err: any) {
    printError('Update failed', err);
    process.exit(1);
  }
}
