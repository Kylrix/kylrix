import pc from 'picocolors';
import * as clack from '@clack/prompts';
import { hasAuth } from '../client';
import { printError, printJson, printSuccess } from '../formatter';
import { resolveEnvironment, loadConfig, saveMasterConfig } from '../config';
import { evaluateOfflineAutoSync, migrateOfflineData, bidirectionalSync } from '../local/sync-resolver';

export async function syncCommand(opts: { url?: string; token?: string; workspace?: string; json?: boolean }) {
  if (!hasAuth(opts)) {
    if (opts.json) {
      printJson({ synced: false, error: 'Authentication required to sync local items to cloud' });
    } else {
      console.log(pc.yellow('⚠ Not logged in. Run `kylrix login` first to sync your local data to cloud.'));
    }
    return;
  }

  const env = resolveEnvironment(opts);

  // Check if active account is missing local data but an offline container has items
  const verdict = evaluateOfflineAutoSync(env.apiUrl, env.userId);
  if (verdict.canAutoSync && verdict.sourceContainer && verdict.itemCount > 0) {
    if (!opts.json) {
      console.log(pc.dim(`Migrating ${verdict.itemCount} items from offline container "${verdict.sourceContainer}" to active account...`));
    }
    migrateOfflineData(verdict.sourceContainer, env.userId, 'default');
  } else if (!verdict.canAutoSync && verdict.reason && !opts.json) {
    console.log(pc.yellow(`⚠ Warning: ${verdict.reason}`));
  }

  const spinner = clack.spinner();
  if (!opts.json) {
    spinner.start('Performing two-way sync with Kylrix Cloud...');
  }

  try {
    const syncRes = await bidirectionalSync(opts);

    if (!opts.json) {
      spinner.stop(pc.green('Sync complete!'));
    }

    // Clear pending warning on successful sync
    const config = loadConfig();
    if (config.pendingWarning) {
      delete config.pendingWarning;
      saveMasterConfig(config);
    }

    if (opts.json) {
      printJson({
        synced: true,
        pushed: syncRes.pushed,
        pulled: syncRes.pulled,
      });
      return;
    }

    const { pushed, pulled } = syncRes;
    const pushedTotal = (pushed as any).total ?? (pushed.pushedIdeas + pushed.pushedGoals);
    console.log();
    printSuccess('Synchronized with Kylrix Cloud:');
    console.log(
      pc.cyan(
        `  ↑ Pushed to cloud: ${pushedTotal} items (${pushed.pushedIdeas} ideas, ${pushed.pushedGoals} goals, ${(pushed as any).pushedEvents || 0} events, ${(pushed as any).pushedForms || 0} forms, ${(pushed as any).pushedFlows || 0} flows)`
      )
    );
    console.log(pc.green(`  ↓ Pulled to local: ${pulled.total} items (${pulled.pulledIdeas} ideas, ${pulled.pulledGoals} goals, ${pulled.pulledEvents} events, ${pulled.pulledForms} forms, ${pulled.pulledFlows} flows)`));
    console.log(pc.dim('  ⚡ Local SQLite database is up to date.\n'));
  } catch (err: any) {
    if (!opts.json) {
      spinner.stop(pc.red('Sync interrupted'));
    }
    printError('Sync failed', err);
    process.exit(1);
  }
}
