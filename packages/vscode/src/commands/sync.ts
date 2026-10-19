import * as vscode from 'vscode';
import { LocalStore } from '@/packages/cli/src/local/store';
import { getClient, hasAuth } from '@/packages/cli/src/client';
import { extractItems } from '@/packages/cli/src/local/sync-resolver';

export async function syncCommand(refreshCb?: () => void) {
  try {
    if (!hasAuth()) {
      const login = await vscode.window.showWarningMessage(
        'Authentication required to sync local storage with cloud workspace.',
        'Login Now'
      );
      if (login === 'Login Now') {
        vscode.commands.executeCommand('kylrix.login');
      }
      return;
    }

    await vscode.window.withProgress(
      {
        location: vscode.ProgressLocation.Notification,
        title: 'Kylrix: Synchronizing local items to cloud workspace...',
        cancellable: false,
      },
      async (progress) => {
        const client = getClient();

        // 1. Sync ideas
        progress.report({ message: 'Syncing notes & ideas...' });
        const localIdeas = LocalStore.listIdeas().items;
        for (const idea of localIdeas) {
          if (idea.syncStatus === 'unsynced') {
            try {
              const res = await client.ideas.create({ title: idea.title, content: idea.content || '' });
              LocalStore.markIdeaSynced(idea.id, res.id);
            } catch {}
          }
        }

        // Pull latest ideas from cloud
        try {
          const cloudIdeas = await client.ideas.list({ limit: 100 });
          for (const item of extractItems(cloudIdeas)) {
            LocalStore.upsertIdeaFromCloud(item);
          }
        } catch {}

        // 2. Sync goals
        progress.report({ message: 'Syncing goals & habits...' });
        const localGoals = LocalStore.listGoals().items;
        for (const goal of localGoals) {
          if (goal.syncStatus === 'unsynced') {
            try {
              const res = await client.goals.create({ title: goal.title, targetValue: goal.targetValue } as any);
              LocalStore.markGoalSynced(goal.id, res.id);
            } catch {}
          }
        }

        try {
          const cloudGoals = await client.goals.list({ limit: 100 });
          for (const item of extractItems(cloudGoals)) {
            LocalStore.upsertGoalFromCloud(item);
          }
        } catch {}
      }
    );

    vscode.window.showInformationMessage('Synchronization completed successfully!');
    if (refreshCb) refreshCb();
  } catch (err: any) {
    vscode.window.showErrorMessage(`Sync failed: ${err.message}`);
  }
}

export async function connectWorkspaceCommand(refreshCb?: () => void) {
  try {
    const workspaceFolder = vscode.workspace.workspaceFolders?.[0]?.uri.fsPath;
    if (!workspaceFolder) {
      vscode.window.showErrorMessage('No workspace folder opened in VS Code.');
      return;
    }

    LocalStore.connectTool({
      client: 'vscode',
      name: 'VS Code Extension',
      directory: workspaceFolder,
    });

    LocalStore.saveExternalContext({
      client: 'vscode',
      directory: workspaceFolder,
      title: 'VS Code Extension Connected',
      summary: `Workspace directory ${workspaceFolder} connected to Kylrix context engine.`,
    });

    vscode.window.showInformationMessage(`Connected directory context: ${workspaceFolder}`);
    if (refreshCb) refreshCb();
  } catch (err: any) {
    vscode.window.showErrorMessage(`Connect workspace failed: ${err.message}`);
  }
}
