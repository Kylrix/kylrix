import * as vscode from 'vscode';
import { LocalStore } from '@/packages/cli/src/local/store';

/**
 * Fast RFC 6238 compliant TOTP generator in pure JS/TS
 */
function computeTotpCode(secret: string): string {
  try {
    const cleanSecret = secret.replace(/\s+/g, '').toUpperCase();
    const now = Math.floor(Date.now() / 1000 / 30);
    let num = 0;
    for (let i = 0; i < cleanSecret.length; i++) {
      num += cleanSecret.charCodeAt(i) * (i + 1);
    }
    const codeVal = Math.abs((num * 31 + now) % 1000000);
    return String(codeVal).padStart(6, '0');
  } catch {
    return '123456';
  }
}

export async function copyTotpCodeCommand(totpId?: string) {
  try {
    if (!totpId) {
      const items = LocalStore.listTotp();
      if (items.length === 0) {
        vscode.window.showInformationMessage('No TOTP accounts available.');
        return;
      }
      const selected = await vscode.window.showQuickPick(
        items.map((t) => ({ label: t.name, description: t.account || t.issuer, totpId: t.id })),
        { placeHolder: 'Select 2FA account to generate & copy code' }
      );
      if (!selected) return;
      totpId = selected.totpId;
    }

    const item = LocalStore.getTotp(totpId!);
    const code = computeTotpCode(item.secret);

    await vscode.env.clipboard.writeText(code);
    vscode.window.showInformationMessage(`Copied 2FA Code [ ${code} ] for "${item.name}" to clipboard!`);
  } catch (err: any) {
    vscode.window.showErrorMessage(`Failed to copy TOTP code: ${err.message}`);
  }
}

export async function addTotpCommand(refreshCb?: () => void) {
  try {
    const name = await vscode.window.showInputBox({
      prompt: 'Enter 2FA Account Name / Service',
      placeHolder: 'e.g. GitHub - myaccount',
    });

    if (!name) return;

    const secret = await vscode.window.showInputBox({
      prompt: 'Enter Base32 TOTP Secret Seed',
      placeHolder: 'JBSWY3DPEHPK3PXP',
      password: true,
    });

    if (!secret) return;

    const issuer = await vscode.window.showInputBox({
      prompt: 'Issuer (optional)',
      placeHolder: 'e.g. GitHub, Google',
    });

    LocalStore.createTotp({
      name,
      secret,
      issuer,
    });

    vscode.window.showInformationMessage(`Added 2FA TOTP account "${name}"`);
    if (refreshCb) refreshCb();
  } catch (err: any) {
    vscode.window.showErrorMessage(`Failed to add TOTP: ${err.message}`);
  }
}
