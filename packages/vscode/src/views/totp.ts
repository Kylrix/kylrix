import * as vscode from 'vscode';
import { LocalStore } from '@/packages/cli/src/local/store';

export class TotpItem extends vscode.TreeItem {
  constructor(
    public readonly totpId: string,
    public readonly name: string,
    public readonly account?: string,
    public readonly issuer?: string,
    public readonly secret?: string
  ) {
    super(name, vscode.TreeItemCollapsibleState.None);

    this.description = issuer ? `[${issuer}] ${account || ''}` : account || '2FA Seed';
    this.tooltip = `${name}\nIssuer: ${issuer || 'N/A'}\nAccount: ${account || 'N/A'}`;
    this.iconPath = new vscode.ThemeIcon('device-mobile');
    this.contextValue = 'totpItem';
    this.command = {
      command: 'kylrix.copyTotpCode',
      title: 'Copy 2FA Code',
      arguments: [totpId],
    };
  }
}

export class TotpTreeProvider implements vscode.TreeDataProvider<TotpItem> {
  private _onDidChangeTreeData: vscode.EventEmitter<TotpItem | undefined | void> = new vscode.EventEmitter<TotpItem | undefined | void>();
  readonly onDidChangeTreeData: vscode.Event<TotpItem | undefined | void> = this._onDidChangeTreeData.event;

  refresh(): void {
    this._onDidChangeTreeData.fire();
  }

  getTreeItem(element: TotpItem): vscode.TreeItem {
    return element;
  }

  async getChildren(element?: TotpItem): Promise<TotpItem[]> {
    if (element) return [];

    try {
      const items = LocalStore.listTotp();
      if (items.length === 0) {
        return [
          new TotpItem('empty', 'No 2FA TOTP accounts. Click + to add.', '', '', ''),
        ];
      }

      return items.map(
        (t) =>
          new TotpItem(
            t.id,
            t.name || '2FA Account',
            t.account,
            t.issuer,
            t.secret
          )
      );
    } catch (err: any) {
      return [new TotpItem('err', `Error: ${err.message}`, '', '', '')];
    }
  }
}
