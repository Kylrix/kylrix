import * as vscode from 'vscode';
import { StatusTreeProvider } from './views/status';
import { IdeasTreeProvider } from './views/ideas';
import { GoalsTreeProvider } from './views/goals';
import { VaultTreeProvider } from './views/vault';
import { TotpTreeProvider } from './views/totp';
import { EventsTreeProvider } from './views/events';
import { ChatsTreeProvider } from './views/chats';
import { AgentsTreeProvider } from './views/agents';
import { TrashTreeProvider } from './views/trash';

import {
  loginCommand,
  loginWithApiKey,
  loginWithBrowser,
  logoutCommand,
  whoamiCommand,
  switchAccountCommand,
  switchServerCommand,
  switchWorkspaceCommand,
} from './commands/auth';
import { createNoteCommand, openNoteCommand, deleteNoteCommand } from './commands/notes';
import { createGoalCommand, updateGoalProgressCommand } from './commands/goals';
import {
  unlockVaultCommand,
  lockVaultCommand,
  createSecretCommand,
  pullEnvCommand,
  pushEnvCommand,
} from './commands/vault';
import { copyTotpCodeCommand, addTotpCommand } from './commands/totp';
import { globalSearchCommand } from './commands/search';
import { syncCommand, connectWorkspaceCommand } from './commands/sync';
import { resolveEnvironment } from '@/packages/cli/src/config';
import { hasAuth } from '@/packages/cli/src/client';

let statusBarItem: vscode.StatusBarItem;

export function activate(context: vscode.ExtensionContext) {
  console.log('[Kylrix] Activating Kylrix VS Code Extension...');

  // 1. Initialize Tree Data Providers
  const statusProvider = new StatusTreeProvider();
  const ideasProvider = new IdeasTreeProvider();
  const goalsProvider = new GoalsTreeProvider();
  const vaultProvider = new VaultTreeProvider();
  const totpProvider = new TotpTreeProvider();
  const eventsProvider = new EventsTreeProvider();
  const chatsProvider = new ChatsTreeProvider();
  const agentsProvider = new AgentsTreeProvider();
  const trashProvider = new TrashTreeProvider();

  const refreshAllViews = () => {
    statusProvider.refresh();
    ideasProvider.refresh();
    goalsProvider.refresh();
    vaultProvider.refresh();
    totpProvider.refresh();
    eventsProvider.refresh();
    chatsProvider.refresh();
    agentsProvider.refresh();
    trashProvider.refresh();
    updateStatusBar();
  };

  // 2. Register Views
  context.subscriptions.push(
    vscode.window.registerTreeDataProvider('kylrix.view.status', statusProvider),
    vscode.window.registerTreeDataProvider('kylrix.view.ideas', ideasProvider),
    vscode.window.registerTreeDataProvider('kylrix.view.goals', goalsProvider),
    vscode.window.registerTreeDataProvider('kylrix.view.vault', vaultProvider),
    vscode.window.registerTreeDataProvider('kylrix.view.totp', totpProvider),
    vscode.window.registerTreeDataProvider('kylrix.view.events', eventsProvider),
    vscode.window.registerTreeDataProvider('kylrix.view.chats', chatsProvider),
    vscode.window.registerTreeDataProvider('kylrix.view.agents', agentsProvider),
    vscode.window.registerTreeDataProvider('kylrix.view.trash', trashProvider)
  );

  // 3. Register Commands
  context.subscriptions.push(
    vscode.commands.registerCommand('kylrix.refreshViews', refreshAllViews),
    vscode.commands.registerCommand('kylrix.login', () => loginCommand(refreshAllViews)),
    vscode.commands.registerCommand('kylrix.loginWithApiKey', () =>
      loginWithApiKey(refreshAllViews).catch((err: any) =>
        vscode.window.showErrorMessage(`API key login failed: ${err?.message || String(err)}`)
      )
    ),
    vscode.commands.registerCommand('kylrix.loginWithBrowser', () =>
      loginWithBrowser(refreshAllViews).catch((err: any) =>
        vscode.window.showErrorMessage(`Browser login failed: ${err?.message || String(err)}`)
      )
    ),
    vscode.commands.registerCommand('kylrix.logout', () => logoutCommand(refreshAllViews)),
    vscode.commands.registerCommand('kylrix.whoami', whoamiCommand),
    vscode.commands.registerCommand('kylrix.switchAccount', () => switchAccountCommand(refreshAllViews)),
    vscode.commands.registerCommand('kylrix.switchServer', () => switchServerCommand(refreshAllViews)),
    vscode.commands.registerCommand('kylrix.switchWorkspace', () => switchWorkspaceCommand(refreshAllViews)),

    vscode.commands.registerCommand('kylrix.createNote', () => createNoteCommand(refreshAllViews)),
    vscode.commands.registerCommand('kylrix.openNote', (id?: string) => openNoteCommand(id)),
    vscode.commands.registerCommand('kylrix.deleteNote', (id?: string) => deleteNoteCommand(id, refreshAllViews)),

    vscode.commands.registerCommand('kylrix.createGoal', () => createGoalCommand(refreshAllViews)),
    vscode.commands.registerCommand('kylrix.updateGoalProgress', (id?: string) => updateGoalProgressCommand(id, refreshAllViews)),

    vscode.commands.registerCommand('kylrix.unlockVault', unlockVaultCommand),
    vscode.commands.registerCommand('kylrix.lockVault', lockVaultCommand),
    vscode.commands.registerCommand('kylrix.createSecret', () => createSecretCommand(refreshAllViews)),
    vscode.commands.registerCommand('kylrix.pullEnv', (id?: string) => pullEnvCommand(id)),
    vscode.commands.registerCommand('kylrix.pushEnv', () => pushEnvCommand(refreshAllViews)),

    vscode.commands.registerCommand('kylrix.copyTotpCode', (id?: string) => copyTotpCodeCommand(id)),
    vscode.commands.registerCommand('kylrix.addTotp', () => addTotpCommand(refreshAllViews)),

    vscode.commands.registerCommand('kylrix.search', globalSearchCommand),
    vscode.commands.registerCommand('kylrix.sync', () => syncCommand(refreshAllViews)),
    vscode.commands.registerCommand('kylrix.connectWorkspace', () => connectWorkspaceCommand(refreshAllViews))
  );

  // 4. Register Status Bar Item
  statusBarItem = vscode.window.createStatusBarItem(vscode.StatusBarAlignment.Right, 100);
  statusBarItem.command = 'kylrix.whoami';
  context.subscriptions.push(statusBarItem);
  updateStatusBar();

  // 5. Connect Workspace context automatically if folder opened
  if (vscode.workspace.workspaceFolders && vscode.workspace.workspaceFolders.length > 0) {
    connectWorkspaceCommand(refreshAllViews);
  }

  console.log('[Kylrix] Kylrix Extension successfully activated.');
}

function updateStatusBar() {
  if (!statusBarItem) return;
  try {
    const env = resolveEnvironment();
    const isAuthed = hasAuth();
    const ws = env.workspaceId ? ` [ws:${env.workspaceId}]` : '';
    statusBarItem.text = `$(shield) Kylrix${ws}`;
    statusBarItem.tooltip = `Server: ${env.apiUrl}\nStatus: ${isAuthed ? 'Logged In' : 'Local Mode'}\nClick to view identity`;
    statusBarItem.show();
  } catch {
    statusBarItem.hide();
  }
}

export function deactivate() {
  console.log('[Kylrix] Kylrix Extension deactivated.');
}
