import pc from 'picocolors';
import * as clack from '@clack/prompts';
import {
  CURRENT_VERSION,
  PACKAGE_NAME,
  compareSemver,
  executeUpgrade,
  fetchLatestVersion,
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

  const spinner = clack.spinner();
  spinner.start('Checking for updates on npm registry...');

  const latest = await fetchLatestVersion(5000);
  if (!latest) {
    spinner.stop(pc.yellow('Could not reach npm registry or version not published yet.'));
    return;
  }

  const hasUpdate = compareSemver(latest, CURRENT_VERSION) > 0;

  if (!hasUpdate && !opts.force) {
    spinner.stop(pc.green(`You are already running the latest version (v${CURRENT_VERSION})!`));
    clack.outro(pc.dim('No update required.'));
    return;
  }

  spinner.stop(
    hasUpdate
      ? pc.yellow(`New version available: ${pc.dim(`v${CURRENT_VERSION}`)} → ${pc.green(pc.bold(`v${latest}`))}`)
      : `Re-installing v${CURRENT_VERSION}...`
  );

  try {
    await executeUpgrade(latest);
    clack.outro(pc.green(`✔ ${PACKAGE_NAME} is now up to date (v${latest})!`));
  } catch (err: any) {
    printError('Update failed', err);
    process.exit(1);
  }
}
