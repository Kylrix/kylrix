import * as vscode from 'vscode';
import { LocalStore } from '@/packages/cli/src/local/store';
import { openNoteCommand } from './notes';
import { pullEnvCommand } from './vault';
import { copyTotpCodeCommand } from './totp';

export async function globalSearchCommand() {
  try {
    const query = await vscode.window.showInputBox({
      prompt: 'Enter search query across notes, goals, secrets, events, forms, flows',
      placeHolder: 'Search term...',
    });

    if (!query) return;

    const results = LocalStore.search(query);

    if (results.length === 0) {
      vscode.window.showInformationMessage(`No matching results found for "${query}"`);
      return;
    }

    const pickItems = results.map((r) => ({
      label: `[${r.kind.toUpperCase()}] ${r.title}`,
      description: r.snippet || `ID: ${r.id}`,
      kind: r.kind,
      id: r.id,
    }));

    const selected = await vscode.window.showQuickPick(pickItems, {
      placeHolder: `Found ${results.length} results for "${query}"`,
    });

    if (!selected) return;

    if (selected.kind === 'idea') {
      openNoteCommand(selected.id);
    } else if (selected.kind === 'vault') {
      pullEnvCommand(selected.id);
    } else if (selected.kind === 'totp') {
      copyTotpCodeCommand(selected.id);
    } else {
      vscode.window.showInformationMessage(`Selected ${selected.kind}: "${selected.label}" (ID: ${selected.id})`);
    }
  } catch (err: any) {
    vscode.window.showErrorMessage(`Global search failed: ${err.message}`);
  }
}
