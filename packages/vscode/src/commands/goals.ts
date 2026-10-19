import * as vscode from 'vscode';
import { LocalStore } from '@/packages/cli/src/local/store';
import { getClient, hasAuth } from '@/packages/cli/src/client';

export async function createGoalCommand(refreshCb?: () => void) {
  try {
    const title = await vscode.window.showInputBox({
      prompt: 'Enter goal title',
      placeHolder: 'e.g. Complete VS Code Extension Parity',
    });

    if (!title) return;

    const targetVal = await vscode.window.showInputBox({
      prompt: 'Enter target numeric value (default: 100)',
      value: '100',
    });

    const unit = await vscode.window.showInputBox({
      prompt: 'Enter unit (default: %)',
      value: '%',
    });

    const isAuthed = hasAuth();
    const item = LocalStore.createGoal({
      title,
      targetValue: parseFloat(targetVal || '100'),
      currentValue: 0,
      unit: unit || '%',
      status: 'in_progress',
      syncStatus: isAuthed ? 'unsynced' : 'local',
    });

    if (isAuthed) {
      try {
        const cloudGoal = await getClient().goals.create({
          title,
          targetValue: parseFloat(targetVal || '100'),
          unit: unit || '%',
        } as any);
        LocalStore.markGoalSynced(item.id, cloudGoal.id);
      } catch {}
    }

    vscode.window.showInformationMessage(`Created goal "${title}"`);
    if (refreshCb) refreshCb();
  } catch (err: any) {
    vscode.window.showErrorMessage(`Failed to create goal: ${err.message}`);
  }
}

export async function updateGoalProgressCommand(goalId?: string, refreshCb?: () => void) {
  try {
    if (!goalId) {
      const res = LocalStore.listGoals();
      const items = res.items || [];
      if (items.length === 0) {
        vscode.window.showInformationMessage('No goals available.');
        return;
      }
      const selected = await vscode.window.showQuickPick(
        items.map((g) => ({
          label: g.title || g.id,
          description: `Progress: ${g.currentValue}/${g.targetValue} ${g.unit}`,
          goalId: g.id,
        })),
        { placeHolder: 'Select a goal to update progress' }
      );
      if (!selected) return;
      goalId = selected.goalId;
    }

    const existing = LocalStore.getGoal(goalId!);
    const newVal = await vscode.window.showInputBox({
      prompt: `Enter new current progress value (Target: ${existing.targetValue} ${existing.unit})`,
      value: String(existing.currentValue || 0),
    });

    if (newVal === undefined) return;

    const currentValue = parseFloat(newVal);
    const isCompleted = currentValue >= existing.targetValue;
    const status: 'done' | 'in_progress' = isCompleted ? 'done' : 'in_progress';

    LocalStore.updateGoal(goalId!, {
      currentValue,
      status,
    });

    if (hasAuth()) {
      try {
        await getClient().goals.update(existing.cloudId || goalId!, {
          progress: currentValue,
          status,
        } as any);
      } catch {}
    }

    vscode.window.showInformationMessage(`Updated progress for "${existing.title}" to ${currentValue} ${existing.unit}`);
    if (refreshCb) refreshCb();
  } catch (err: any) {
    vscode.window.showErrorMessage(`Failed to update goal: ${err.message}`);
  }
}
