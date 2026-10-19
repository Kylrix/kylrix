import * as vscode from 'vscode';
import { resolveEnvironment, saveConfig, switchAccount, switchServer, listAccounts, listServers } from '@/packages/cli/src/config';
import { getClient, hasAuth } from '@/packages/cli/src/client';

export async function loginCommand(refreshCb?: () => void) {
  try {
    const token = await vscode.window.showInputBox({
      prompt: 'Enter your Kylrix Personal Access Token (PAT) or Agent Key',
      placeHolder: 'kyl_pat_...',
      password: true,
    });

    if (!token) return;

    const apiUrl = vscode.workspace.getConfiguration('kylrix').get<string>('apiUrl') || 'https://www.kylrix.space';
    saveConfig({ token, apiUrl });

    vscode.window.showInformationMessage('Successfully authenticated with Kylrix!');
    if (refreshCb) refreshCb();
  } catch (err: any) {
    vscode.window.showErrorMessage(`Login failed: ${err.message}`);
  }
}

export async function logoutCommand(refreshCb?: () => void) {
  try {
    saveConfig({ token: undefined });
    vscode.window.showInformationMessage('Logged out from Kylrix session.');
    if (refreshCb) refreshCb();
  } catch (err: any) {
    vscode.window.showErrorMessage(`Logout failed: ${err.message}`);
  }
}

export async function whoamiCommand() {
  try {
    const env = resolveEnvironment();
    const isAuthed = hasAuth();
    if (!isAuthed) {
      vscode.window.showInformationMessage('Kylrix: Currently in Anonymous / Local-First mode.');
      return;
    }

    const client = getClient();
    let detail = `Account: ${env.email || env.userId || 'Authenticated'}\nServer: ${env.apiUrl}\nWorkspace: ${env.workspaceId || 'Personal'}`;
    try {
      const user = await client.auth.me();
      if (user?.email) detail += `\nVerified Email: ${user.email}`;
    } catch {}

    vscode.window.showInformationMessage(`Kylrix Identity:\n${detail}`, { modal: true });
  } catch (err: any) {
    vscode.window.showErrorMessage(`WhoAmI error: ${err.message}`);
  }
}

export async function switchAccountCommand(refreshCb?: () => void) {
  try {
    const { accounts } = listAccounts();
    if (accounts.length === 0) {
      vscode.window.showInformationMessage('No additional account profiles found. Login first.');
      return;
    }

    const pickItems = accounts.map((a) => ({
      label: a.email || a.userId,
      description: a.lastUsedAt ? `Last used: ${a.lastUsedAt.substring(0, 10)}` : undefined,
      accountId: a.userId,
    }));

    const selected = await vscode.window.showQuickPick(pickItems, {
      placeHolder: 'Select an account profile to switch to',
    });

    if (selected) {
      switchAccount(selected.accountId);
      vscode.window.showInformationMessage(`Switched active account profile to ${selected.label}`);
      if (refreshCb) refreshCb();
    }
  } catch (err: any) {
    vscode.window.showErrorMessage(`Switch account failed: ${err.message}`);
  }
}

export async function switchServerCommand(refreshCb?: () => void) {
  try {
    const servers = listServers();
    const pickItems = servers.map((s) => ({
      label: s.baseUrl,
      description: s.isCurrent ? 'Current' : `${s.accountCount} accounts`,
      serverUrl: s.baseUrl,
    }));
    pickItems.push({
      label: '+ Add custom server base URL',
      description: 'Enter custom self-hosted endpoint URL',
      serverUrl: '__ADD_NEW__',
    });

    const selected = await vscode.window.showQuickPick(pickItems, {
      placeHolder: 'Select active Kylrix server base URL',
    });

    if (!selected) return;

    if (selected.serverUrl === '__ADD_NEW__') {
      const customUrl = await vscode.window.showInputBox({
        prompt: 'Enter self-hosted Kylrix base URL',
        placeHolder: 'https://kylrix.my-domain.com',
      });
      if (customUrl) {
        switchServer(customUrl);
        vscode.window.showInformationMessage(`Switched server base URL to ${customUrl}`);
        if (refreshCb) refreshCb();
      }
    } else {
      switchServer(selected.serverUrl);
      vscode.window.showInformationMessage(`Switched server base URL to ${selected.serverUrl}`);
      if (refreshCb) refreshCb();
    }
  } catch (err: any) {
    vscode.window.showErrorMessage(`Switch server failed: ${err.message}`);
  }
}

export async function switchWorkspaceCommand(refreshCb?: () => void) {
  try {
    const isAuthed = hasAuth();
    let workspaceOptions: { label: string; workspaceId: string; description?: string }[] = [
      { label: 'Personal Virtual Workspace', workspaceId: '', description: 'Default personal scope' },
    ];

    if (isAuthed) {
      try {
        const client = getClient();
        const res: any = await client.workspaces.list();
        const items = Array.isArray(res) ? res : res?.items || res?.documents || [];
        for (const w of items) {
          workspaceOptions.push({
            label: w.title || w.name || w.id,
            workspaceId: w.id,
            description: `ID: ${w.id}`,
          });
        }
      } catch {}
    }

    const selected = await vscode.window.showQuickPick(workspaceOptions, {
      placeHolder: 'Select active workspace context',
    });

    if (selected !== undefined) {
      saveConfig({ workspaceId: selected.workspaceId });
      vscode.window.showInformationMessage(`Switched active workspace to "${selected.label}"`);
      if (refreshCb) refreshCb();
    }
  } catch (err: any) {
    vscode.window.showErrorMessage(`Switch workspace failed: ${err.message}`);
  }
}
