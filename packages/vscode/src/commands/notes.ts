import * as vscode from 'vscode';
import { LocalStore } from '@/packages/cli/src/local/store';
import { getClient, hasAuth } from '@/packages/cli/src/client';

export async function createNoteCommand(refreshCb?: () => void) {
  try {
    const title = await vscode.window.showInputBox({
      prompt: 'Enter note / idea title',
      placeHolder: 'e.g. System Architecture Notes',
    });

    if (!title) return;

    const category = await vscode.window.showInputBox({
      prompt: 'Enter category (default: general)',
      placeHolder: 'general, architecture, draft, article',
      value: 'general',
    });

    const content = await vscode.window.showInputBox({
      prompt: 'Enter note initial body / content (Markdown supported)',
      placeHolder: 'Content details...',
    });

    const isAuthed = hasAuth();
    const item = LocalStore.createIdea({
      title,
      category: category || 'general',
      content: content || '',
      syncStatus: isAuthed ? 'unsynced' : 'local',
    });

    if (isAuthed) {
      try {
        const cloudItem = await getClient().ideas.create({
          title,
          content: content || '',
        });
        LocalStore.markIdeaSynced(item.id, cloudItem.id);
      } catch {}
    }

    vscode.window.showInformationMessage(`Created note "${title}"`);
    if (refreshCb) refreshCb();

    // Open in editor
    openNoteCommand(item.id);
  } catch (err: any) {
    vscode.window.showErrorMessage(`Failed to create note: ${err.message}`);
  }
}

export async function openNoteCommand(noteId?: string) {
  try {
    if (!noteId) {
      const res = LocalStore.listIdeas();
      const items = res.items || [];
      if (items.length === 0) {
        vscode.window.showInformationMessage('No notes available to open.');
        return;
      }
      const selected = await vscode.window.showQuickPick(
        items.map((i) => ({ label: i.title || i.id, description: i.category, noteId: i.id })),
        { placeHolder: 'Select a note to open in editor' }
      );
      if (!selected) return;
      noteId = selected.noteId;
    }

    const note = LocalStore.getIdea(noteId!);
    if (!note) {
      vscode.window.showErrorMessage(`Note not found: ${noteId}`);
      return;
    }

    const docContent = `# ${note.title || 'Untitled Note'}\n\nCategory: ${note.category || 'general'}\nUpdated: ${note.updatedAt || note.createdAt || 'N/A'}\n\n---\n\n${note.content || ''}`;

    const doc = await vscode.workspace.openTextDocument({
      language: 'markdown',
      content: docContent,
    });

    await vscode.window.showTextDocument(doc, { preview: false });
  } catch (err: any) {
    vscode.window.showErrorMessage(`Failed to open note: ${err.message}`);
  }
}

export async function deleteNoteCommand(noteId?: string, refreshCb?: () => void) {
  try {
    if (!noteId) {
      const res = LocalStore.listIdeas();
      const items = res.items || [];
      if (items.length === 0) {
        vscode.window.showInformationMessage('No notes available to delete.');
        return;
      }
      const selected = await vscode.window.showQuickPick(
        items.map((i) => ({ label: i.title || i.id, description: i.category, noteId: i.id })),
        { placeHolder: 'Select a note to delete' }
      );
      if (!selected) return;
      noteId = selected.noteId;
    }

    const confirm = await vscode.window.showWarningMessage(
      `Are you sure you want to delete note "${noteId}"?`,
      { modal: true },
      'Delete'
    );

    if (confirm === 'Delete') {
      LocalStore.deleteIdea(noteId!);
      vscode.window.showInformationMessage(`Deleted note ${noteId}`);
      if (refreshCb) refreshCb();
    }
  } catch (err: any) {
    vscode.window.showErrorMessage(`Failed to delete note: ${err.message}`);
  }
}
