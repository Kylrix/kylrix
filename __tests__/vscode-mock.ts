export class TreeItem {
  constructor(public label: string, public collapsibleState: number = 0) {}
}

export const TreeItemCollapsibleState = {
  None: 0,
  Collapsed: 1,
  Expanded: 2,
};

export class ThemeIcon {
  constructor(public id: string) {}
}

export class EventEmitter<_T = any> {
  event = () => {};
  fire = () => {};
}

export class StatusBarItem {
  text = '';
  tooltip = '';
  command = '';
  show() {}
  hide() {}
}

export const StatusBarAlignment = {
  Left: 1,
  Right: 2,
};

export const createdTerminals: any[] = [];

export const window = {
  registerTreeDataProvider: () => ({ dispose: () => {} }),
  createStatusBarItem: () => new StatusBarItem(),
  showInformationMessage: async () => {},
  showWarningMessage: async () => {},
  showErrorMessage: async () => {},
  showInputBox: async () => '',
  showQuickPick: async () => undefined,
  showTextDocument: async () => {},
  withProgress: async (_opts: any, task: any) => task({ report: () => {} }),
  activeTerminal: undefined as any,
  createTerminal: (opts?: any) => {
    const t = {
      options: opts,
      show() {},
      sendText(_text?: string, _addNewLine?: boolean) {},
      dispose() {},
    };
    createdTerminals.push(t);
    return t;
  },
};

export const workspace = {
  getConfiguration: () => ({
    get: (_key: string) => 'https://www.kylrix.space',
  }),
  workspaceFolders: [{ uri: { fsPath: '/mock/workspace' } }],
  openTextDocument: async () => ({}),
};

export const commands = {
  registerCommand: () => ({ dispose: () => {} }),
  executeCommand: async () => {},
};

export const env = {
  clipboard: {
    writeText: async () => {},
  },
};

export const ProgressLocation = {
  Notification: 15,
};
