import * as vscode from 'vscode';
import { LocalStore } from '@/packages/cli/src/local/store';

export class TrashOrTagItem extends vscode.TreeItem {
  constructor(
    public readonly itemId: string,
    public readonly isTag: boolean,
    public readonly labelName: string,
    public readonly detail?: string
  ) {
    super(labelName, vscode.TreeItemCollapsibleState.None);
    this.description = detail;
    this.iconPath = new vscode.ThemeIcon(isTag ? 'tag' : 'trash');
    this.contextValue = isTag ? 'tagItem' : 'trashSubItem';
  }
}

export class TrashTreeProvider implements vscode.TreeDataProvider<TrashOrTagItem> {
  private _onDidChangeTreeData: vscode.EventEmitter<TrashOrTagItem | undefined | void> = new vscode.EventEmitter<TrashOrTagItem | undefined | void>();
  readonly onDidChangeTreeData: vscode.Event<TrashOrTagItem | undefined | void> = this._onDidChangeTreeData.event;

  refresh(): void {
    this._onDidChangeTreeData.fire();
  }

  getTreeItem(element: TrashOrTagItem): vscode.TreeItem {
    return element;
  }

  async getChildren(element?: TrashOrTagItem): Promise<TrashOrTagItem[]> {
    if (element) return [];

    try {
      const items: TrashOrTagItem[] = [];

      // Tags
      const tags = LocalStore.listTags().items;
      if (tags.length > 0) {
        for (const t of tags) {
          items.push(new TrashOrTagItem(t.id, true, `Tag: #${t.name}`, `Color: ${t.color}`));
        }
      }

      // Trash
      const trash = LocalStore.listTrash().items;
      if (trash.length > 0) {
        for (const tr of trash) {
          items.push(
            new TrashOrTagItem(
              tr.id,
              false,
              `[Deleted] ${tr.title || tr.id}`,
              `Kind: ${tr.kind} | ${tr.deletedAt?.substring(0, 10)}`
            )
          );
        }
      }

      if (items.length === 0) {
        items.push(new TrashOrTagItem('empty', false, 'Trash is empty & no tags', 'Clean state'));
      }

      return items;
    } catch (err: any) {
      return [new TrashOrTagItem('err', false, 'Error loading trash', err.message)];
    }
  }
}
