import pc from 'picocolors';
import * as clack from '@clack/prompts';
import { getClient, hasAuth } from '../client';
import { LocalStore } from '../local/store';
import { printError, printJson, printSuccess } from '../formatter';
import { resolveEnvironment, loadConfig, saveMasterConfig } from '../config';
import { evaluateOfflineAutoSync, migrateOfflineData } from '../local/sync-resolver';
import { getNativeSqlite, getDatabase } from '../local/sqlite';

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

  const client = getClient(opts);
  const localIdeas = LocalStore.listIdeas().items;
  const localGoals = LocalStore.listGoals().items;
  const spinner = clack.spinner();
  if (!opts.json) {
    spinner.start('Syncing local-first data with Kylrix Cloud...');
  }

  let syncedIdeas = 0;
  let syncedGoals = 0;

  const DatabaseSync = getNativeSqlite();
  const db = DatabaseSync ? getDatabase(env.siloDbPath) : null;

  try {
    // Sync local ideas
    for (const idea of localIdeas) {
      if (idea.isLocal) {
        const tags = [...(idea.tags || [])];
        if (idea.category) {
          tags.push(`category:${idea.category}`);
        }
        await client.ideas.create({
          title: idea.title,
          content: idea.content,
          tags: tags.length > 0 ? tags : undefined,
          workspaceId: opts.workspace,
        });
        if (db) {
          try {
            db.prepare('UPDATE ideas SET is_local = 0 WHERE id = ?').run(idea.id);
          } catch {}
        }
        syncedIdeas++;
      }
    }

    // Sync local goals
    for (const goal of localGoals) {
      if (goal.isLocal) {
        await client.goals.create({
          title: goal.title,
          description: goal.description,
          status: (goal.status as any) || 'todo',
          workspaceId: opts.workspace,
        });
        if (db) {
          try {
            db.prepare('UPDATE goals SET is_local = 0 WHERE id = ?').run(goal.id);
          } catch {}
        }
        syncedGoals++;
      }
    }

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
      printJson({ synced: true, syncedIdeas, syncedGoals });
      return;
    }

    printSuccess(`Successfully synced ${syncedIdeas} ideas and ${syncedGoals} goals to your cloud workspace.`);
  } catch (err: any) {
    if (!opts.json) {
      spinner.stop(pc.red('Sync interrupted'));
    }
    printError('Sync failed', err);
    process.exit(1);
  }
}
