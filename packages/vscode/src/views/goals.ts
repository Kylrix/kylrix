import * as vscode from 'vscode';
import { LocalStore } from '@/packages/cli/src/local/store';

export class GoalItem extends vscode.TreeItem {
  constructor(
    public readonly goalId: string,
    public readonly title: string,
    public readonly status: string,
    public readonly currentValue: number,
    public readonly targetValue: number,
    public readonly unit: string,
    public readonly syncStatus: string
  ) {
    const percent = Math.min(100, Math.max(0, Math.round((currentValue / (targetValue || 100)) * 100)));
    const filledBlocks = Math.round(percent / 10);
    const progressBar = '█'.repeat(filledBlocks) + '░'.repeat(10 - filledBlocks);

    super(`[${progressBar}] ${percent}% - ${title}`, vscode.TreeItemCollapsibleState.None);

    this.description = `Status: ${status} (${currentValue}/${targetValue} ${unit})`;
    this.tooltip = `${title}\nProgress: ${percent}% (${currentValue}/${targetValue} ${unit})\nStatus: ${status}\nSync: ${syncStatus}`;
    this.contextValue = 'goalItem';

    if (status === 'completed' || percent >= 100) {
      this.iconPath = new vscode.ThemeIcon('pass-filled');
    } else if (status === 'in_progress') {
      this.iconPath = new vscode.ThemeIcon('play-circle');
    } else {
      this.iconPath = new vscode.ThemeIcon('target');
    }

    this.command = {
      command: 'kylrix.updateGoalProgress',
      title: 'Update Goal',
      arguments: [goalId],
    };
  }
}

export class GoalsTreeProvider implements vscode.TreeDataProvider<GoalItem> {
  private _onDidChangeTreeData: vscode.EventEmitter<GoalItem | undefined | void> = new vscode.EventEmitter<GoalItem | undefined | void>();
  readonly onDidChangeTreeData: vscode.Event<GoalItem | undefined | void> = this._onDidChangeTreeData.event;

  refresh(): void {
    this._onDidChangeTreeData.fire();
  }

  getTreeItem(element: GoalItem): vscode.TreeItem {
    return element;
  }

  async getChildren(element?: GoalItem): Promise<GoalItem[]> {
    if (element) return [];

    try {
      const res = LocalStore.listGoals();
      const allGoals = res.items || [];

      if (allGoals.length === 0) {
        return [
          new GoalItem('empty', 'No goals created yet. Click + to add one.', 'not_started', 0, 100, '%', 'local'),
        ];
      }

      return allGoals.map(
        (g) =>
          new GoalItem(
            g.id,
            g.title || '(Untitled Goal)',
            g.status || 'not_started',
            g.currentValue ?? 0,
            g.targetValue ?? 100,
            g.unit || '%',
            g.syncStatus || 'local'
          )
      );
    } catch (err: any) {
      return [new GoalItem('err', `Error: ${err.message}`, 'error', 0, 100, '%', 'local')];
    }
  }
}
