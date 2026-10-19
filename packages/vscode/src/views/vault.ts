import * as vscode from 'vscode';
import { LocalStore } from '@/packages/cli/src/local/store';

export class VaultItem extends vscode.TreeItem {
  constructor(
    public readonly vaultId: string,
    public readonly name: string,
    public readonly username?: string,
    public readonly isEnv?: boolean,
    public readonly itemType?: string,
    public readonly isHeader?: boolean
  ) {
    super(
      name,
      isHeader ? vscode.TreeItemCollapsibleState.Expanded : vscode.TreeItemCollapsibleState.None
    );

    if (!isHeader) {
      this.description = isEnv ? 'Environment Variables (.env)' : username ? `User: ${username}` : 'Secret Item';
      this.tooltip = `${name}\nType: ${itemType || (isEnv ? 'env' : 'login')}\nUsername: ${username || 'N/A'}`;
      this.iconPath = new vscode.ThemeIcon(isEnv ? 'file-code' : 'key');
      this.contextValue = isEnv ? 'envItem' : 'vaultItem';
      this.command = {
        command: isEnv ? 'kylrix.pullEnv' : 'kylrix.unlockVault',
        title: isEnv ? 'Pull .env' : 'View Secret',
        arguments: [vaultId],
      };
    } else {
      this.iconPath = new vscode.ThemeIcon('shield');
      this.contextValue = 'vaultHeader';
    }
  }
}

export class VaultTreeProvider implements vscode.TreeDataProvider<VaultItem> {
  private _onDidChangeTreeData: vscode.EventEmitter<VaultItem | undefined | void> = new vscode.EventEmitter<VaultItem | undefined | void>();
  readonly onDidChangeTreeData: vscode.Event<VaultItem | undefined | void> = this._onDidChangeTreeData.event;

  refresh(): void {
    this._onDidChangeTreeData.fire();
  }

  getTreeItem(element: VaultItem): vscode.TreeItem {
    return element;
  }

  async getChildren(element?: VaultItem): Promise<VaultItem[]> {
    if (element) return [];

    try {
      const items = LocalStore.listVault();
      if (items.length === 0) {
        return [
          new VaultItem('empty', 'No secrets stored locally.', '', false, 'none', false),
        ];
      }

      return items.map(
        (v) =>
          new VaultItem(
            v.id,
            v.name || '(Untitled Secret)',
            v.username,
            v.isEnv,
            v.itemType,
            false
          )
      );
    } catch (err: any) {
      return [new VaultItem('err', `Error: ${err.message}`, '', false, 'error', false)];
    }
  }
}
