import * as vscode from 'vscode';
import { getClient, hasAuth } from '@/packages/cli/src/client';
import { extractItems } from '@/packages/cli/src/local/sync-resolver';

export class ChatItem extends vscode.TreeItem {
  constructor(
    public readonly chatId: string,
    public readonly title: string,
    public readonly subtitle?: string
  ) {
    super(title, vscode.TreeItemCollapsibleState.None);
    this.description = subtitle;
    this.iconPath = new vscode.ThemeIcon('comment-discussion');
    this.contextValue = 'chatItem';
  }
}

export class ChatsTreeProvider implements vscode.TreeDataProvider<ChatItem> {
  private _onDidChangeTreeData: vscode.EventEmitter<ChatItem | undefined | void> = new vscode.EventEmitter<ChatItem | undefined | void>();
  readonly onDidChangeTreeData: vscode.Event<ChatItem | undefined | void> = this._onDidChangeTreeData.event;

  refresh(): void {
    this._onDidChangeTreeData.fire();
  }

  getTreeItem(element: ChatItem): vscode.TreeItem {
    return element;
  }

  async getChildren(element?: ChatItem): Promise<ChatItem[]> {
    if (element) return [];

    if (!hasAuth()) {
      return [
        new ChatItem('auth', 'Cloud Authentication Required', 'Login to access chats & threads'),
      ];
    }

    try {
      const client = getClient();
      const conversations = await client.chats.list();
      const items = extractItems(conversations);

      if (items.length === 0) {
        return [new ChatItem('empty', 'No active chat discussions', 'Start one from web or CLI')];
      }

      return items.map(
        (c: any) =>
          new ChatItem(
            c.id,
            c.title || c.name || `Chat ${c.id.substring(0, 8)}`,
            c.updatedAt ? new Date(c.updatedAt).toLocaleDateString() : ''
          )
      );
    } catch (err: any) {
      return [new ChatItem('err', 'Unable to fetch chats', err.message)];
    }
  }
}
