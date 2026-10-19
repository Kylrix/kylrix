import * as vscode from 'vscode';
import { LocalStore } from '@/packages/cli/src/local/store';

export class EventOrFormItem extends vscode.TreeItem {
  constructor(
    public readonly itemId: string,
    public readonly kind: 'event' | 'form' | 'flow' | 'group',
    public readonly title: string,
    public readonly detail?: string
  ) {
    super(
      title,
      kind === 'group' ? vscode.TreeItemCollapsibleState.Expanded : vscode.TreeItemCollapsibleState.None
    );

    if (kind !== 'group') {
      this.description = detail;
      this.contextValue = `${kind}Item`;
      this.iconPath = new vscode.ThemeIcon(
        kind === 'event' ? 'calendar' : kind === 'form' ? 'list-flat' : 'workflow'
      );
    } else {
      this.iconPath = new vscode.ThemeIcon('layers');
      this.contextValue = 'groupHeader';
    }
  }
}

export class EventsTreeProvider implements vscode.TreeDataProvider<EventOrFormItem> {
  private _onDidChangeTreeData: vscode.EventEmitter<EventOrFormItem | undefined | void> = new vscode.EventEmitter<EventOrFormItem | undefined | void>();
  readonly onDidChangeTreeData: vscode.Event<EventOrFormItem | undefined | void> = this._onDidChangeTreeData.event;

  refresh(): void {
    this._onDidChangeTreeData.fire();
  }

  getTreeItem(element: EventOrFormItem): vscode.TreeItem {
    return element;
  }

  async getChildren(element?: EventOrFormItem): Promise<EventOrFormItem[]> {
    if (!element) {
      return [
        new EventOrFormItem('grp:events', 'group', 'Calendar Events'),
        new EventOrFormItem('grp:forms', 'group', 'Interactive Forms'),
        new EventOrFormItem('grp:flows', 'group', 'Automated Flows'),
      ];
    }

    try {
      if (element.itemId === 'grp:events') {
        const events = LocalStore.listEvents().items;
        if (events.length === 0) return [new EventOrFormItem('empty', 'event', 'No calendar events')];
        return events.map(
          (e) => new EventOrFormItem(e.id, 'event', e.title || '(Untitled Event)', e.startTime?.substring(0, 10))
        );
      }

      if (element.itemId === 'grp:forms') {
        const forms = LocalStore.listForms().items;
        if (forms.length === 0) return [new EventOrFormItem('empty', 'form', 'No forms created')];
        return forms.map((f) => new EventOrFormItem(f.id, 'form', f.title || '(Untitled Form)', f.description));
      }

      if (element.itemId === 'grp:flows') {
        const flows = LocalStore.listFlows().items;
        if (flows.length === 0) return [new EventOrFormItem('empty', 'flow', 'No flows created')];
        return flows.map(
          (fl) => new EventOrFormItem(fl.id, 'flow', fl.title || '(Untitled Flow)', `Status: ${fl.status || 'draft'}`)
        );
      }
    } catch (err: any) {
      return [new EventOrFormItem('err', 'group', `Error: ${err.message}`)];
    }

    return [];
  }
}
