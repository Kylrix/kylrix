import * as vscode from 'vscode';
import { LocalStore } from '@/packages/cli/src/local/store';

export class AgentOrContextItem extends vscode.TreeItem {
  constructor(
    public readonly itemId: string,
    public readonly title: string,
    public readonly detail?: string,
    public readonly iconName: string = 'robot'
  ) {
    super(title, vscode.TreeItemCollapsibleState.None);
    this.description = detail;
    this.iconPath = new vscode.ThemeIcon(iconName);
    this.contextValue = 'agentItem';
  }
}

export class AgentsTreeProvider implements vscode.TreeDataProvider<AgentOrContextItem> {
  private _onDidChangeTreeData: vscode.EventEmitter<AgentOrContextItem | undefined | void> = new vscode.EventEmitter<AgentOrContextItem | undefined | void>();
  readonly onDidChangeTreeData: vscode.Event<AgentOrContextItem | undefined | void> = this._onDidChangeTreeData.event;

  refresh(): void {
    this._onDidChangeTreeData.fire();
  }

  getTreeItem(element: AgentOrContextItem): vscode.TreeItem {
    return element;
  }

  async getChildren(element?: AgentOrContextItem): Promise<AgentOrContextItem[]> {
    if (element) return [];

    try {
      const tools = LocalStore.listConnectedTools();
      const currentWorkspace = vscode.workspace.workspaceFolders?.[0]?.uri.fsPath;
      const contexts = LocalStore.listExternalContexts({ directory: currentWorkspace });

      const items: AgentOrContextItem[] = [];

      if (tools.length > 0) {
        for (const t of tools) {
          items.push(
            new AgentOrContextItem(
              `tool:${t.id}`,
              `Tool: ${t.name || t.client}`,
              `Connected: ${t.directory || 'Global'}`,
              'plug'
            )
          );
        }
      }

      if (contexts.length > 0) {
        for (const ctx of contexts) {
          items.push(
            new AgentOrContextItem(
              `ctx:${ctx.id}`,
              `Context: ${ctx.title}`,
              `Client: ${ctx.client}`,
              'symbol-misc'
            )
          );
        }
      }

      if (items.length === 0) {
        items.push(
          new AgentOrContextItem(
            'connect',
            'No tool context connected',
            'Run "Kylrix: Connect Workspace Tool Context"',
            'link'
          )
        );
      }

      return items;
    } catch (err: any) {
      return [new AgentOrContextItem('err', 'Error reading context', err.message, 'error')];
    }
  }
}
