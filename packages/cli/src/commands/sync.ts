import pc from 'picocolors';
import * as clack from '@clack/prompts';
import { getClient, hasAuth } from '../client';
import { LocalStore } from '../local/store';
import { printError, printJson, printSuccess } from '../formatter';

export async function syncCommand(opts: { url?: string; token?: string; workspace?: string; json?: boolean }) {
  if (!hasAuth(opts)) {
    if (opts.json) {
      printJson({ synced: false, error: 'Authentication required to sync local items to cloud' });
    } else {
      console.log(pc.yellow('⚠ Not logged in. Run `kylrix login` first to sync your local data to cloud.'));
    }
    return;
  }

  const client = getClient(opts);
  const localIdeas = LocalStore.listIdeas().items;
  const localGoals = LocalStore.listGoals().items;
  const spinner = clack.spinner();
  spinner.start('Syncing local-first data with Kylrix Cloud...');

  let syncedIdeas = 0;
  let syncedGoals = 0;

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
        syncedGoals++;
      }
    }

    spinner.stop(pc.green('Sync complete!'));

    if (opts.json) {
      printJson({ synced: true, syncedIdeas, syncedGoals });
      return;
    }

    printSuccess(`Successfully synced ${syncedIdeas} ideas and ${syncedGoals} goals to your cloud workspace.`);
  } catch (err: any) {
    spinner.stop(pc.red('Sync interrupted'));
    printError('Sync failed', err);
    process.exit(1);
  }
}
