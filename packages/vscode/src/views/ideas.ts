import * as vscode from 'vscode';
import { LocalStore } from '@/packages/cli/src/local/store';

export class IdeaItem extends vscode.TreeItem {
  constructor(
    public readonly ideaId: string,
    public readonly title: string,
    public readonly category: string,
    public readonly content: string,
    public readonly syncStatus: string,
    public readonly isCategoryGroup: boolean = false
  ) {
    super(
      title,
      isCategoryGroup ? vscode.TreeItemCollapsibleState.Expanded : vscode.TreeItemCollapsibleState.None
    );

    if (!isCategoryGroup) {
      const syncBadge = syncStatus === 'synced' ? '● synced' : '○ local';
      this.description = `[${category}] ${syncBadge}`;
      this.tooltip = `${title}\nCategory: ${category}\nSync: ${syncStatus}\n\n${content.substring(0, 200)}`;
      this.iconPath = new vscode.ThemeIcon(syncStatus === 'synced' ? 'notebook' : 'edit');
      this.contextValue = 'ideaItem';
      this.command = {
        command: 'kylrix.openNote',
        title: 'Open Note',
        arguments: [ideaId],
      };
    } else {
      this.iconPath = new vscode.ThemeIcon('folder');
      this.contextValue = 'categoryGroup';
    }
  }
}

export class IdeasTreeProvider implements vscode.TreeDataProvider<IdeaItem> {
  private _onDidChangeTreeData: vscode.EventEmitter<IdeaItem | undefined | void> = new vscode.EventEmitter<IdeaItem | undefined | void>();
  readonly onDidChangeTreeData: vscode.Event<IdeaItem | undefined | void> = this._onDidChangeTreeData.event;

  refresh(): void {
    this._onDidChangeTreeData.fire();
  }

  getTreeItem(element: IdeaItem): vscode.TreeItem {
    return element;
  }

  async getChildren(element?: IdeaItem): Promise<IdeaItem[]> {
    try {
      const res = LocalStore.listIdeas();
      const allIdeas = res.items || [];

      if (!element) {
        // Group by category
        const categoriesMap = new Map<string, any[]>();
        for (const idea of allIdeas) {
          const cat = idea.category || 'general';
          if (!categoriesMap.has(cat)) {
            categoriesMap.set(cat, []);
          }
          categoriesMap.get(cat)!.push(idea);
        }

        const categoryNodes: IdeaItem[] = [];
        for (const [cat, ideas] of categoriesMap.entries()) {
          categoryNodes.push(
            new IdeaItem(
              `cat:${cat}`,
              `${cat.toUpperCase()} (${ideas.length})`,
              cat,
              '',
              '',
              true
            )
          );
        }
        return categoryNodes;
      } else if (element.isCategoryGroup) {
        const cat = element.category;
        const matching = allIdeas.filter((i) => (i.category || 'general') === cat);
        return matching.map(
          (i) => new IdeaItem(i.id, i.title || '(Untitled Note)', i.category || 'general', i.content || '', i.syncStatus || 'local', false)
        );
      }
    } catch (err: any) {
      return [new IdeaItem('err', `Error: ${err.message}`, 'error', '', '', false)];
    }
    return [];
  }
}
