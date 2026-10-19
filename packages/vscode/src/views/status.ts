import * as vscode from 'vscode';
import { resolveEnvironment, loadConfig } from '@/packages/cli/src/config';
import { hasAuth } from '@/packages/cli/src/client';
import { LocalStore } from '@/packages/cli/src/local/store';

export class StatusItem extends vscode.TreeItem {
  constructor(
    public readonly label: string,
    public readonly description?: string,
    public readonly iconName?: string,
    public readonly command?: vscode.Command,
    public readonly contextValue?: string
  ) {
    super(label, vscode.TreeItemCollapsibleState.None);
    this.description = description;
    this.contextValue = contextValue || 'statusItem';
    if (iconName) {
      this.iconPath = new vscode.ThemeIcon(iconName);
    }
  }
}

export class StatusTreeProvider implements vscode.TreeDataProvider<StatusItem> {
  private _onDidChangeTreeData: vscode.EventEmitter<StatusItem | undefined | void> = new vscode.EventEmitter<StatusItem | undefined | void>();
  readonly onDidChangeTreeData: vscode.Event<StatusItem | undefined | void> = this._onDidChangeTreeData.event;

  refresh(): void {
    this._onDidChangeTreeData.fire();
  }

  getTreeItem(element: StatusItem): vscode.TreeItem {
    return element;
  }

  async getChildren(element?: StatusItem): Promise<StatusItem[]> {
    if (element) return [];

    const items: StatusItem[] = [];
    try {
      const env = resolveEnvironment();
      const _config = loadConfig();
      const isAuthed = hasAuth();

      // Account
      const accountLabel = isAuthed ? `Account: ${env.email || env.userId || 'Logged In'}` : 'Account: Anonymous (Local Mode)';
      const accountDesc = env.tier ? `Tier: ${env.tier}` : isAuthed ? 'Cloud Connected' : 'Local Only';
      items.push(new StatusItem(accountLabel, accountDesc, 'account', {
        command: 'kylrix.whoami',
        title: 'View Identity',
      }));

      // Server
      items.push(new StatusItem(`Server: ${env.apiUrl}`, env.partitionKey === 'default' ? 'Default Cloud' : 'Self-Hosted', 'server', {
        command: 'kylrix.switchServer',
        title: 'Switch Server',
      }));

      // Workspace
      items.push(new StatusItem(`Workspace: ${env.workspaceId || 'Personal Virtual Workspace'}`, 'Active Context', 'briefcase', {
        command: 'kylrix.switchWorkspace',
        title: 'Switch Workspace',
      }));

      // Sync status count
      const unsyncedIdeas = LocalStore.listIdeas().items.filter((i) => i.syncStatus === 'unsynced').length;
      const unsyncedGoals = LocalStore.listGoals().items.filter((g) => g.syncStatus === 'unsynced').length;
      const totalUnsynced = unsyncedIdeas + unsyncedGoals;

      const syncLabel = totalUnsynced > 0 ? `Sync: ${totalUnsynced} unsynced items` : 'Sync: Up to date';
      const syncDesc = isAuthed ? (totalUnsynced > 0 ? 'Click to sync' : 'Cloud Synced') : 'Login to sync';
      items.push(new StatusItem(syncLabel, syncDesc, totalUnsynced > 0 ? 'cloud-upload' : 'cloud', {
        command: 'kylrix.sync',
        title: 'Synchronize',
      }));

      // Quick Actions
      if (!isAuthed) {
        items.push(new StatusItem('🔐 Login / Pair Device', 'Connect cloud workspace', 'key', {
          command: 'kylrix.login',
          title: 'Login',
        }));
      } else {
        items.push(new StatusItem('🔄 Switch Account Profile', 'Manage profiles', 'arrow-swap', {
          command: 'kylrix.switchAccount',
          title: 'Switch Account',
        }));
      }
    } catch (err: any) {
      items.push(new StatusItem('Error loading status', err?.message || String(err), 'error'));
    }

    return items;
  }
}
