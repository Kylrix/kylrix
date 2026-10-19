import * as vscode from 'vscode';
import * as fs from 'node:fs';
import * as path from 'node:path';
import { LocalStore } from '@/packages/cli/src/local/store';

let _inMemoryMasterKey: string | null = null;

export async function unlockVaultCommand() {
  try {
    const password = await vscode.window.showInputBox({
      prompt: 'Enter Vault Master Password',
      password: true,
    });

    if (!password) return;

    _inMemoryMasterKey = password;
    vscode.window.showInformationMessage('Vault unlocked for active editor session.');
  } catch (err: any) {
    vscode.window.showErrorMessage(`Failed to unlock vault: ${err.message}`);
  }
}

export async function lockVaultCommand() {
  _inMemoryMasterKey = null;
  vscode.window.showInformationMessage('Vault locked and session encryption key purged.');
}

export async function createSecretCommand(refreshCb?: () => void) {
  try {
    const name = await vscode.window.showInputBox({
      prompt: 'Enter secret name / service label',
      placeHolder: 'e.g. AWS Production API Key',
    });

    if (!name) return;

    const username = await vscode.window.showInputBox({
      prompt: 'Username / Key Identifier (optional)',
    });

    const password = await vscode.window.showInputBox({
      prompt: 'Password / Secret Payload',
      password: true,
    });

    LocalStore.createVault({
      name,
      username,
      password,
      itemType: 'login',
    });

    vscode.window.showInformationMessage(`Created secret "${name}"`);
    if (refreshCb) refreshCb();
  } catch (err: any) {
    vscode.window.showErrorMessage(`Failed to create secret: ${err.message}`);
  }
}

export async function pullEnvCommand(vaultId?: string) {
  try {
    const workspaceFolder = vscode.workspace.workspaceFolders?.[0]?.uri.fsPath;
    if (!workspaceFolder) {
      vscode.window.showErrorMessage('No active workspace folder opened in VS Code.');
      return;
    }

    if (!vaultId) {
      const items = LocalStore.listVault();
      if (items.length === 0) {
        vscode.window.showInformationMessage('No secrets or .env sets in vault.');
        return;
      }
      const selected = await vscode.window.showQuickPick(
        items.map((v) => ({ label: v.name, description: v.username || v.itemType, vaultId: v.id })),
        { placeHolder: 'Select secret / .env bundle to pull into workspace' }
      );
      if (!selected) return;
      vaultId = selected.vaultId;
    }

    const secret = LocalStore.getVault(vaultId!);
    const targetEnvPath = path.join(workspaceFolder, '.env');

    let payloadLines = secret.notes || secret.password || '';
    if (!payloadLines && secret.customFields) {
      payloadLines = typeof secret.customFields === 'string' ? secret.customFields : JSON.stringify(secret.customFields, null, 2);
    }

    if (!payloadLines) {
      vscode.window.showWarningMessage(`Secret "${secret.name}" contains no env variable lines.`);
      return;
    }

    fs.writeFileSync(targetEnvPath, payloadLines, 'utf-8');
    vscode.window.showInformationMessage(`Successfully pulled env variables from "${secret.name}" into .env`);

    // Open .env in VS Code
    const doc = await vscode.workspace.openTextDocument(targetEnvPath);
    await vscode.window.showTextDocument(doc);
  } catch (err: any) {
    vscode.window.showErrorMessage(`Failed to pull .env: ${err.message}`);
  }
}

export async function pushEnvCommand(refreshCb?: () => void) {
  try {
    const workspaceFolder = vscode.workspace.workspaceFolders?.[0]?.uri.fsPath;
    if (!workspaceFolder) {
      vscode.window.showErrorMessage('No active workspace folder opened in VS Code.');
      return;
    }

    const targetEnvPath = path.join(workspaceFolder, '.env');
    if (!fs.existsSync(targetEnvPath)) {
      vscode.window.showErrorMessage('No .env file found in root workspace folder.');
      return;
    }

    const envContent = fs.readFileSync(targetEnvPath, 'utf-8');

    const name = await vscode.window.showInputBox({
      prompt: 'Enter label for this workspace .env bundle in Kylrix Vault',
      value: `Workspace .env (${path.basename(workspaceFolder)})`,
    });

    if (!name) return;

    LocalStore.createVault({
      name,
      notes: envContent,
      isEnv: true,
      itemType: 'env',
    });

    vscode.window.showInformationMessage(`Successfully pushed .env file to vault secret "${name}"`);
    if (refreshCb) refreshCb();
  } catch (err: any) {
    vscode.window.showErrorMessage(`Failed to push .env: ${err.message}`);
  }
}
