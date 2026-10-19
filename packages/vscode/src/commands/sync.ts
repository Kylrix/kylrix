import * as vscode from 'vscode';
import { hasAuth } from '@/packages/cli/src/client';
import { LocalStore } from '@/packages/cli/src/local/store';
import { bidirectionalSync, pullCloudItemsToLocal } from '@/packages/cli/src/local/sync-resolver';

async function runSyncAttempt(): Promise<void> {
  try {
    await bidirectionalSync();
    return;
  } catch (err: any) {
    const message = String(err?.message || err || '');
    if (message.includes('Free accounts operate 100% offline')) {
      return;
    }
  }
  await pullCloudItemsToLocal();
}

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
        title: 'Kylrix: Syncing your workspace...',
        cancellable: false,
      },
      async () => {
        await runSyncAttempt();
      },
    );

    vscode.window.showInformationMessage('Kylrix sync completed.');
    if (refreshCb) refreshCb();
  } catch (err: any) {
    vscode.window.showErrorMessage(`Sync failed: ${err.message}`);
  }
}

export async function autoSyncOnStartup(refreshCb?: () => void) {
  if (!hasAuth()) return;
  try {
    await runSyncAttempt();
    refreshCb?.();
  } catch (err: any) {
    vscode.window.showWarningMessage(`Kylrix could not load cloud data: ${err?.message || String(err)}`);
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
